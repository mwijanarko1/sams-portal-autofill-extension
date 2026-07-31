/* ===================================================================
 * content.js — SAMS Portal Autofill Extension
 *
 * Injected programmatically via chrome.scripting when the user
 * triggers scan or autofill from the popup (including allFrames).
 *
 * Listens for messages from the popup:
 *
 *   { action: "ping" }          → health check (returns { pong: true })
 *   { action: "scan" }          → scans the page for form fields
 *   { action: "autofill", fieldMap } → fills matched fields
 *
 * NEVER clicks submit/save buttons.
 * NEVER collects credentials.
 * Only fills visible, enabled, non-hidden form fields.
 * =================================================================== */

// Prevent double listeners when content.js is re-injected into the same frame.
if (globalThis.__SAMS_PORTAL_AUTOFILL_LOADED__) {
  // Already initialised in this frame — skip re-registration.
} else {
globalThis.__SAMS_PORTAL_AUTOFILL_LOADED__ = true;

// ─── Common stopwords excluded from word-overlap scoring ─────────────

const STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "of", "for", "by", "or",
  "and", "is", "if", "as", "it", "be", "no", "not", "do", "up",
  "name", "date", "number", "no", "nbr", "type", "id", "code", "ref",
  "info", "details", "desc", "description", "other", "please",
  "enter", "select", "choose", "add", "new", "your", "our",
  "field", "value", "label", "text",
  "application", "form", "section", "page", "required", "optional",
]);

// ─── Synonym map (CRM key → human-readable label patterns) ──────────
// Each key maps to an array of label text patterns that might appear on
// portal forms. Patterns are normalized for comparison.
// Includes common UK admissions / e:Vision / Salesforce agent-portal labels.

const SYNONYM_MAP = {
  // ── Name ──────────────────────────────────────────────────────────
  givenName: [
    "first name", "firstname", "forename", "forenames", "given name",
    "given names", "first/given name", "legal first name",
    "first given name", "applicant first name", "student first name",
    "preferred first name", "christian name",
    // Salesforce API names (Sunderland Online Applications)
    "firstname", "first_name", "givenname",
  ],
  familyName: [
    "last name", "lastname", "surname", "family name",
    "surname/family/last name", "legal last name", "family/surname",
    "applicant surname", "student surname", "applicant last name",
    "lastname", "last_name", "surname",
  ],
  middleName: [
    "middle name", "middle initial", "middle", "middle names",
    "middle name(s)", "middlename", "middle_name",
  ],
  // ── Personal ──────────────────────────────────────────────────────
  dateOfBirth: [
    "date of birth", "dob", "birth date", "birthdate",
    "birth day", "birthday", "date of birth (dob)",
    "applicant date of birth", "date of birth dd/mm/yyyy",
    "birth date", "dateofbirth", "date_of_birth",
  ],
  gender: ["gender", "sex", "gender identity", "legal gender"],
  maritalStatus: ["marital status", "marriage status", "civil status"],
  nationality: [
    "nationality", "citizenship", "country of citizenship",
    "country of origin", "country of nationality",
    "nationality / citizenship", "passport nationality",
  ],
  // ── Contact ───────────────────────────────────────────────────────
  location: [
    "location", "address", "street address", "current address",
    "permanent address", "residence", "home address",
    "mailing address", "postal address", "correspondence address",
    "address line 1", "address line1", "line 1", "line1",
    "residential address", "permanent residence",
    "house/flat number and street", "house flat number and street",
    "mailingstreet", "mailing street", "street",
  ],
  city: [
    "city", "town", "city/town", "city name", "town/city",
    "town or city", "mailingcity", "mailing city",
  ],
  state: [
    "state", "province", "region", "state/province",
    "county", "territory", "county/state",
  ],
  postcode: [
    "postcode", "zip code", "zip", "postal code",
    "post code", "zip/postal code", "uk postcode",
    "mailingpostalcode", "mailing postal code", "mailing postcode",
  ],
  countryName: [
    "country", "nation", "country of residence",
    "country code", "country of permanent residence",
    "home country", "residence country", "mailing country",
  ],
  phone: [
    "phone number", "telephone number", "mobile number",
    "contact number", "phone", "telephone", "mobile",
    "cell", "tel", "cell phone", "mobile phone",
    "mobile telephone", "home telephone", "contact telephone",
    "primary phone", "daytime telephone", "mobilephone", "mobile_phone",
  ],
  email: [
    "email address", "e-mail address", "email", "e-mail",
    "contact email", "primary email", "applicant email",
    "student email",
  ],
  funding: [
    // Main funding combobox only — NOT "Other funding source" free-text
    // (that field is Otherfundingsource__c and must stay empty for Self-Funding)
    "how are you intending to fund this programme",
    "how are you intending to fund this program",
    "how are you intending to fund",
    "intend to fund",
    "programme funding",
    "program funding",
    "tuition funding",
    "funding source",
    "fundingsource",
    // bare "funding" is OK for exact label; guarded against "other funding" below
    "funding",
  ],
  // Only used when funding type is Other — leave empty for Self-Funding demos
  otherFundingSource: [
    "other funding source",
    "otherfundingsource",
    "otherfundingsource__c",
    "other source of funding",
    "please specify funding",
  ],
  // ── Sunderland / Salesforce-specific helpers ──────────────────────
  title: [
    // Do NOT use bare "title" — it steals Employment "Job Title" (fills "Mr").
    // Exact label "Title" is handled via matchScore special-case below.
    "title/salutation", "salutation", "honorific",
    "mr/mrs", "name title", "title mr", "title mrs", "title miss",
    "applicant title", "personal title",
  ],
  highestQualification: [
    // Step 1 "Your details" only — do NOT include bare "qualification level"
    // (that label is Academic History and maps to qualificationLevel → Higher Education)
    "highest qualification", "highest education", "highest award",
    "uk masters degree", "highest academic qualification",
  ],
  hasUniversityDegree: [
    "do you have a university degree", "university degree",
    "have a degree", "hold a degree",
  ],
  hasTwoYearsWorkExperience: [
    "minimum of two years work experience",
    "two years work experience", "2 years work experience",
    "minimum two years",
  ],
  emergencyName: [
    "emergency contact", "emergency contact name", "emergency name",
    "emergency person", "next of kin", "next of kin name",
    "emergency contact full name",
  ],
  emergencyPhone: [
    "emergency phone", "emergency contact phone", "emergency telephone",
    "emergency contact number", "next of kin telephone",
  ],
  // ── Education (incl. Sunderland Academic History) ─────────────────
  institutionName: [
    "institution name", "school name", "college name", "university name",
    "institution", "school", "university", "college",
    "previous institution", "educational institution",
    "name of institution", "name of school", "name of university",
    "school attended", "attended institution",
    "institution attended", "alma mater",
    // Sunderland academic "Organisation" (university)
    "organisation", "organization", "academic organisation",
    "academic organization", "awarding institution",
    "awarding body", "place of study",
  ],
  degree: [
    "degree", "qualification", "degree qualification",
    "qualification name", "education level",
    "level of education", "highest qualification",
    "highest education", "level of study", "study level",
    "degree name", "degree awarded",
  ],
  qualificationLevel: [
    "qualification level", "level of qualification",
    "academic level", "he level",
    "nqf level", "rqf level",
    // avoid bare "education level" / "study level" — those collide with other fields
  ],
  qualificationType: [
    "qualification type", "type of qualification",
    "award type", "degree type", "type of degree",
  ],
  major: [
    "major", "field of study", "area of study", "subject area",
    "major subject", "course of study", "study field",
    "academic program", "program of study", "discipline",
    "concentration", "specialization", "specialisation",
    // Sunderland
    "program title/subject", "program title", "programme title",
    "programme title/subject", "subject", "course title",
    "program title subject",
  ],
  grade: [
    // Prefer specific phrases — bare "class"/"result" over-match other fields
    "grade", "degree class", "degree classification",
    "classification", "final grade", "overall grade",
    "award class", "honours class", "honors class",
    "overall classification", "class of degree",
  ],
  awardStatus: [
    "award status", "status of award", "completion status",
    "qualification status", "degree status", "awarded",
    "completed", "result status",
  ],
  studyCountry: [
    "country you studied in", "country of study",
    "study country", "country of education",
    "country studied", "studied in",
  ],
  studyDates: [
    "study dates", "study period", "dates of attendance",
    "education dates", "attendance dates", "study timeline",
    "date range",
  ],
  startDate: [
    "start date", "from date", "start", "begin date",
    "commencement date", "enrollment date", "enrolment date",
    "date from", "month year from", "from month year",
    "start month year", "date started", "study from month year",
  ],
  endDate: [
    "end date", "to date", "until", "completion date",
    "finish date", "date ended", "date to", "graduation date",
    "month year to", "to month year", "end month year",
    "date finished", "study to month year",
  ],
  studyFromMonthYear: [
    "month year from", "from month year", "study from",
    "attendance from", "education from",
  ],
  studyToMonthYear: [
    "month year to", "to month year", "study to",
    "attendance to", "education to",
  ],
  graduationYear: [
    "graduation year", "year of graduation", "passing year",
    "year of passing", "completion year", "year completed",
    "year of completion",
  ],
  gpa: ["gpa", "grade point average", "gpa grade", "gpa score"],
  previousEducation: [
    "previous education", "prior education",
    "previous study", "past education",
  ],
  englishFirstLanguage: [
    "is english your first language", "english first language",
    "first language english", "native english",
    "english as first language",
  ],
  otherEnglishLanguageExperience: [
    // Prefer exact Sunderland label / API name — avoid bare "english" / "experience"
    // (those steal Job Title history "experience" or nationality autocomplete language)
    "other english language experience",
    "otherenglishlanguageexperience",
    "otherenglishlanguageexperience__c",
    "other english language evidence",
    "english language evidence",
    "english proficiency details",
  ],
  // ── Passport / Identity ───────────────────────────────────────────
  passportNumber: ["passport number", "passport no", "passport"],
  passportIssueDate: [
    "passport issue date", "date of issue", "issue date",
  ],
  passportExpiryDate: [
    "passport expiry date", "expiry date", "date of expiry",
    "expiration date", "passport expiration",
  ],
  issuingAuthority: ["issuing authority", "issued by"],
  // ── English test ───────────────────────────────────────────────────
  englishTestName: [
    "english test name", "english proficiency", "english test",
    "proficiency test", "test name", "test type",
  ],
  overallScore: [
    "overall score", "total score", "overall band",
    "overall result",
  ],
  listeningScore: ["listening score", "listening band"],
  readingScore: ["reading score", "reading band"],
  writingScore: ["writing score", "writing band"],
  speakingScore: ["speaking score", "speaking band"],
  testDate: ["test date", "exam date", "date of test"],
  // ── Visa / Authorisation ───────────────────────────────────────────
  visaType: ["visa type", "visa category"],
  visaCountry: ["visa country", "country of visa"],
  visaStatus: ["visa status", "current visa status"],
  visaStartDate: ["visa start date", "visa valid from", "visa begins"],
  visaEndDate: ["visa end date", "visa valid until", "visa expires"],
  refusalReason: ["refusal reason", "refusal details", "reason for refusal"],
  workAuthorization: [
    "work authorization", "work permit", "sponsorship",
    "visa status", "authorization to work",
    "work eligibility", "right to work",
    "employment authorization",
  ],
  // ── CV / Employment (incl. Sunderland Employment History) ──────────
  cvEmploymentStatus: [
    "employment status", "current employment status",
  ],
  cvCurrentJobTitle: [
    "current job title", "job title", "position",
    "position title", "current position",
    "jobtitle", "jobtitle__c", "role title", "job role",
    // Sunderland Employment History label
    "*job title", "job title *",
  ],
  cvCurrentEmployer: [
    "current employer", "employer", "company name",
    "organization", "company", "employer name",
    // Sunderland employment "Organisation" (employer)
    "organisation", "employing organisation", "employer organisation",
    "organisation__c", "workplace", "place of work",
  ],
  employmentCountry: [
    "employment country", "country of employment",
    "work country", "country of work", "employer country",
  ],
  cvWorkStartDate: [
    "work start date", "employment start date", "job start date",
    "started work", "employment from", "work from",
    "month year from", "from month year",
  ],
  cvWorkEndDate: [
    "work end date", "employment end date", "job end date",
    "ended work", "employment to", "work to",
    "month year to", "to month year",
  ],
  presentEmployment: [
    "present employment", "current employment", "currently employed",
    "still employed", "i currently work here", "present",
    "present__c",
  ],
  cvYearsExperience: [
    "years of experience", "years experience", "work experience",
    "total experience",
  ],
  cvProfessionalSummary: [
    "professional summary", "summary", "profile summary",
    "personal statement",
  ],
  cvReferee1Name: [
    "referee name", "referee 1 name", "reference name",
    "referee", "reference contact",
  ],
  cvReferee1Email: [
    "referee email", "referee 1 email", "reference email",
  ],
  cvReferee1Phone: [
    "referee phone", "referee 1 phone", "reference phone",
  ],
  employerName: [
    "employer", "employer name", "company name",
    "organization", "current employer",
    "workplace",
  ],
  jobTitle: [
    "job title", "position", "position title",
    "current position", "current job title",
    "job position",
  ],
  // ── ATS / Portal ──────────────────────────────────────────────────
  linkedinUrl: [
    "linkedin", "linkedin url", "linkedin profile",
    "linkedin address", "linkedin link",
  ],
  portfolioUrl: [
    "portfolio", "portfolio url", "portfolio website",
    "personal website", "website url", "web portfolio",
  ],
  resumeCv: [
    "resume", "cv", "curriculum vitae",
    "upload resume", "upload cv", "attach resume",
    "attach cv", "resume/cv",
  ],
  coverLetter: [
    "cover letter", "cover letter text", "cover note",
  ],
  salaryExpectation: [
    "salary expectation", "expected salary", "desired salary",
    "salary requirement",
  ],
  availabilityDate: [
    "availability date", "available from", "start availability",
    "earliest start date",
  ],
  // ── Admission preferences ──────────────────────────────────────────
  preferredUniversity: [
    "preferred university", "university preference",
    "target university", "chosen university",
    "university choice",
  ],
  preferredCourse: [
    // Avoid bare "programme"/"program"/"course" — steals funding question
    // ("How are you intending to fund this programme?")
    "preferred course", "preferred subject",
    "course of interest", "course title", "programme title",
    "program title", "programme of study", "program of study",
    "course applied for", "intended course", "preferred programme",
    "preferred program", "fml_programname", "fml_programname__c",
  ],
  preferredIntake: [
    "preferred intake", "intake", "start date", "semester", "term",
    "enrollment term", "admission term", "entry point",
    "intended start date", "proposed start date", "intake date",
    "year of entry", "entry year",
  ],
  preferredRoute: [
    "preferred route", "route", "study route", "study level",
    "route type", "mode of study", "level of study",
  ],
};

// ─── Autocomplete attribute → CRM key mapping ─────────────────────────
// HTML autocomplete spec values mapped to CRM keys for strong-signal matching.

const AUTOCOMPLETE_KEY_MAP = {
  "given-name": "givenName",
  "additional-name": "middleName",
  "family-name": "familyName",
  "name": "givenName",
  "honorific-prefix": "givenName",
  "nickname": "givenName",
  "email": "email",
  "tel": "phone",
  "tel-country-code": "phone",
  "tel-national": "phone",
  "tel-area-code": "phone",
  "tel-local": "phone",
  "tel-extension": "phone",
  "organization": "institutionName",
  "organization-title": "cvCurrentJobTitle",
  "street-address": "location",
  "address-line1": "location",
  "address-line2": "location",
  "address-level1": "state",
  "address-level2": "city",
  "address-level3": "city",
  "address-level4": "location",
  "postal-code": "postcode",
  "country": "countryName",
  "country-name": "countryName",
  "bday": "dateOfBirth",
  "bday-day": "dateOfBirth",
  "bday-month": "dateOfBirth",
  "bday-year": "dateOfBirth",
  "sex": "gender",
  "job-title": "jobTitle",
  "url": "portfolioUrl",
  "photo": "resumeCv",
  // Do not map autocomplete "language" → nationality (steals English language fields).
  // Nationality is matched via label synonyms only.
  // "language": "nationality",
  "cc-name": "givenName",
  "cc-given-name": "givenName",
  "cc-family-name": "familyName",
};

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison: lowercase, collapse whitespace/dashes/underscores.
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/**
 * Truncate a string for display.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + "\u2026" : str;
}

/**
 * Escape HTML special characters for safe display.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Extract a meaningful terminal (last) token from a dotted/bracketed path.
 * E.g. "student[firstName]" → "firstName", "user.name" → "name", "input_123" → "input_123".
 * @param {string} str
 * @returns {string}
 */
function getTerminalToken(str) {
  if (!str) return "";
  // Split on common separators and path delimiters
  const parts = String(str).split(/[.\[\]_\-/\\:]+/).filter(Boolean);
  // Return the last part that isn't purely numeric
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!/^\d+$/.test(parts[i]) && parts[i].length >= 2) {
      return parts[i].toLowerCase().trim();
    }
  }
  return parts.length > 0 ? parts[parts.length - 1].toLowerCase().trim() : "";
}

/** @type {Record<string, string[]>} */
var SYNONYM_CACHE = Object.create(null);
/** @type {Record<string, {synonyms:string[], synWords:Set<string>}>} */
var SYNONYM_META_CACHE = Object.create(null);

/**
 * Get all synonym strings (including the key itself) for a CRM field key,
 * normalized for comparison. Cached after first call.
 * @param {string} key
 * @returns {string[]}
 */
function getSynonyms(key) {
  if (SYNONYM_CACHE[key]) return SYNONYM_CACHE[key];
  var extras = SYNONYM_MAP[key] || [];
  var result = [key].concat(extras).map(normalize);
  SYNONYM_CACHE[key] = result;
  return result;
}

/**
 * Precomputed synonym list + word set for scoring. Cached per CRM key.
 * @param {string} key
 * @returns {{synonyms:string[], synWords:Set<string>}}
 */
function getSynonymMeta(key) {
  if (SYNONYM_META_CACHE[key]) return SYNONYM_META_CACHE[key];
  var synonyms = getSynonyms(key);
  var synWords = new Set();
  for (var t = 0; t < synonyms.length; t++) {
    var parts = synonyms[t].split(/\s+/);
    for (var p = 0; p < parts.length; p++) {
      if (parts[p].length > 2 && !STOPWORDS.has(parts[p])) synWords.add(parts[p]);
    }
  }
  var meta = { synonyms: synonyms, synWords: synWords };
  SYNONYM_META_CACHE[key] = meta;
  return meta;
}

/** Warm synonym caches for all known CRM keys (once). */
function warmSynonymCaches() {
  var keys = Object.keys(SYNONYM_MAP);
  for (var i = 0; i < keys.length; i++) getSynonymMeta(keys[i]);
}

/**
 * Build a stable CSS selector path for an element. Stops at the first
 * element with an id (since ids are unique within a page).
 * @param {Element} el
 * @returns {string}
 */
function getSelectorPath(el) {
  const parts = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = "#" + CSS.escape(current.id);
      parts.unshift(selector);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        selector += "." + classes.map(function (c) { return CSS.escape(c); }).join(".");
      }
    }
    // Add nth-of-type for positional uniqueness among same-tag siblings
    var parent = current.parentElement;
    if (parent) {
      var sameTag = Array.from(parent.children).filter(function (s) {
        return s.tagName === current.tagName;
      });
      if (sameTag.length > 1) {
        var index = sameTag.indexOf(current) + 1;
        selector += ":nth-of-type(" + index + ")";
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

/**
 * Check if an element is visible and enabled.
 * @param {Element} el
 * @returns {boolean}
 */
function isFillable(el) {
  if (el.disabled) return false;

  var rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  var style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;

  return true;
}

// ─── Label detection ────────────────────────────────────────────────────

/**
 * Get the best human-readable label for a form element.
 * Uses multiple strategies in priority order, never mutating the DOM.
 *
 * @param {Element} el
 * @returns {string}
 */
function getLabelForElement(el) {
  // 1. aria-label
  var ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // 2. aria-labelledby (support multiple ids)
  var labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    var ids = labelledby.split(/\s+/);
    var texts = [];
    for (var i = 0; i < ids.length; i++) {
      var ref = document.getElementById(ids[i]);
      if (ref) {
        var t = ref.textContent.trim();
        if (t) texts.push(t);
      }
    }
    if (texts.length > 0) return texts.join(" ");
  }

  // 3. label[for="elId"]
  if (el.id) {
    var labelEl = document.querySelector("label[for=\"" + CSS.escape(el.id) + "\"]");
    if (labelEl) {
      var text = labelEl.textContent.trim();
      if (text) return text;
    }
  }

  // 4. Wrapping <label> ancestor (without mutating DOM)
  var parent = el.parentElement;
  while (parent) {
    if (parent.tagName === "LABEL") {
      // Collect label text while excluding the input's own contribution
      var labelText = extractLabelTextExcludingChild(parent, el);
      if (labelText) return labelText;
    }
    parent = parent.parentElement;
  }

  // 5. Nearest preceding label element (sibling or nearby)
  var prevLabel = findNearestPrecedingLabel(el);
  if (prevLabel) return prevLabel;

  // 6. placeholder
  var placeholder = el.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) return placeholder.trim();

  // 7. title attribute
  var title = el.getAttribute("title");
  if (title && title.trim()) return title.trim();

  // 8. name or id as fallback
  return el.name || el.id || "";
}

/**
 * Extract text from a label element, excluding the text contributed by a child element.
 * Does NOT mutate the DOM (does not clone or remove children).
 * @param {Element} labelEl - the <label> element
 * @param {Element} childEl - the child to exclude (usually the input/select/textarea)
 * @returns {string}
 */
function extractLabelTextExcludingChild(labelEl, childEl) {
  var parts = [];
  for (var i = 0; i < labelEl.childNodes.length; i++) {
    var node = labelEl.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      var t = node.textContent.trim();
      if (t) parts.push(t);
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.contains(childEl) && node !== childEl) {
      var t = node.textContent.trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(" ").trim();
}

/**
 * Find the nearest preceding <label> element in the DOM that could be
 * associated with the given element.
 * Checks:
 *   - Previous element sibling
 *   - Previous sibling's contained <label>
 *   - Closest ancestor's previous sibling <label>
 * @param {Element} el
 * @returns {string|null}
 */
function findNearestPrecedingLabel(el) {
  // Check previous sibling
  var prev = el.previousElementSibling;
  if (prev) {
    if (prev.tagName === "LABEL") {
      var t = prev.textContent.trim();
      if (t) return t;
    }
    // Check if previous sibling contains a label
    var innerLabel = prev.querySelector("label");
    if (innerLabel) {
      var t = innerLabel.textContent.trim();
      if (t) return t;
    }
  }

  // Walk up and look for a parent's previous sibling with a label
  var walk = el.parentElement;
  while (walk && walk !== document.body) {
    var psib = walk.previousElementSibling;
    if (psib) {
      if (psib.tagName === "LABEL") {
        var t = psib.textContent.trim();
        if (t) return t;
      }
      // Maybe the previous sibling has a label inside
      var inner = psib.querySelector("label");
      if (inner) {
        var t = inner.textContent.trim();
        if (t) return t;
      }
      // Maybe the previous sibling itself is a heading that acts as label
      if (/^H[1-6]$/.test(psib.tagName)) {
        var t = psib.textContent.trim();
        if (t) return t;
      }
    }
    walk = walk.parentElement;
  }

  return null;
}

/**
 * Get the text content of aria-describedby references.
 * @param {Element} el
 * @returns {string}
 */
function getAriaDescribedbyText(el) {
  var describedby = el.getAttribute("aria-describedby");
  if (!describedby) return "";
  var ids = describedby.split(/\s+/);
  var texts = [];
  for (var i = 0; i < ids.length; i++) {
    var ref = document.getElementById(ids[i]);
    if (ref) {
      var t = ref.textContent.trim();
      if (t) texts.push(t);
    }
  }
  return texts.join(" ");
}

/**
 * Find the text of the closest fieldset legend ancestor.
 * @param {Element} el
 * @returns {string}
 */
function getClosestFieldsetLegend(el) {
  var parent = el.parentElement;
  while (parent) {
    if (parent.tagName === "FIELDSET") {
      var legend = parent.querySelector("legend");
      if (legend) {
        var t = legend.textContent.trim();
        return t || "";
      }
      return "";
    }
    parent = parent.parentElement;
  }
  return "";
}

/**
 * Find the text of the nearest preceding heading (h1-h6).
 * @param {Element} el
 * @returns {string}
 */
function getNearestHeading(el) {
  // Walk up the tree (including Lightning shadow hosts), checking previous siblings.
  var current = el;
  var steps = 0;
  while (current && steps < 30) {
    steps++;
    var prev = current.previousElementSibling;
    if (prev) {
      var headings = prev.querySelectorAll ? prev.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, .slds-section__title, .slds-form-element__legend") : [];
      if (headings && headings.length > 0) {
        return headings[headings.length - 1].textContent.trim();
      }
      if (prev.tagName && (/^H[1-6]$/.test(prev.tagName) || prev.tagName === "LEGEND")) {
        return prev.textContent.trim();
      }
      // Salesforce section titles often use spans/divs with strong text
      var t = (prev.textContent || "").trim();
      if (t && t.length < 80 && /academic history|employment history|english language|your details|education|qualification/i.test(t)) {
        return t;
      }
    }
    var parent = current.parentElement;
    if (parent) {
      var parentPrev = parent.previousElementSibling;
      if (parentPrev) {
        var headings2 = parentPrev.querySelectorAll
          ? parentPrev.querySelectorAll("h1, h2, h3, h4, h5, h6, legend")
          : [];
        if (headings2 && headings2.length > 0) {
          return headings2[headings2.length - 1].textContent.trim();
        }
        if (parentPrev.tagName && /^H[1-6]$/.test(parentPrev.tagName)) {
          return parentPrev.textContent.trim();
        }
        var t2 = (parentPrev.textContent || "").trim();
        if (t2 && t2.length < 80 && /academic history|employment history|english language/i.test(t2)) {
          return t2;
        }
      }
    }
    // Climb out of open shadow roots
    try {
      var root = current.getRootNode && current.getRootNode();
      if (root && root.host) {
        current = root.host;
        continue;
      }
    } catch (e) { /* ignore */ }
    current = parent;
  }
  return "";
}

/**
 * Get nearby text snippets from siblings and container for context.
 * Collects short text nodes from the parent and grandparent.
 * @param {Element} el
 * @returns {string}
 */
function getNearbyText(el) {
  var snippets = [];
  var parent = el.parentElement;
  if (!parent) return "";

  // From the parent, collect text from non-label element siblings
  var children = parent.children;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child === el || child.tagName === "LABEL" || child.contains(el)) continue;
    var t = child.textContent.trim();
    if (t && t.length > 3 && t.length < 200) {
      snippets.push(t);
    }
  }

  // From the grandparent, look for descriptive text
  var grandparent = parent.parentElement;
  if (grandparent && snippets.length < 3) {
    var gpChildren = grandparent.children;
    for (var j = 0; j < gpChildren.length; j++) {
      var gpChild = gpChildren[j];
      if (gpChild === parent || gpChild.contains(parent)) continue;
      var t = gpChild.textContent.trim();
      if (t && t.length > 3 && t.length < 200) {
        snippets.push(t);
      }
    }
  }

  return snippets.join(" | ").slice(0, 300);
}

// ─── Form field scanning ────────────────────────────────────────────────

/**
 * CSS selectors for fillable form fields.
 * Excludes hidden, password, submit, button, reset, file, image,
 * checkbox, radio, color, and range inputs.
 */
const FIELD_SELECTORS = [
  "input:not([type=hidden]):not([type=password]):not([type=submit])" +
  ":not([type=button]):not([type=reset]):not([type=file])" +
  ":not([type=image]):not([type=checkbox]):not([type=radio])" +
  ":not([type=color]):not([type=range])",
  "select",
  "textarea",
].join(", ");

/**
 * Query selector across open shadow roots (Salesforce Lightning / LWC).
 * Closed shadow roots cannot be scanned from a content script.
 * @param {string} selector
 * @param {Document|ShadowRoot|Element} [root]
 * @returns {Element[]}
 */
function querySelectorAllDeep(selector, root) {
  var out = [];
  var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function walk(node, depth) {
    if (!node || depth > 20) return;
    try {
      if (node.querySelectorAll) {
        var matches = node.querySelectorAll(selector);
        for (var i = 0; i < matches.length; i++) {
          var el = matches[i];
          if (seen) {
            if (seen.has(el)) continue;
            seen.add(el);
          }
          out.push(el);
        }
      }
      var all = node.querySelectorAll ? node.querySelectorAll("*") : [];
      for (var j = 0; j < all.length; j++) {
        var child = all[j];
        if (child.shadowRoot) walk(child.shadowRoot, depth + 1);
      }
    } catch (e) {
      // Cross-origin or closed shadow — skip
    }
  }

  walk(root || document, 0);
  return out;
}

/**
 * Label heuristics for Lightning Web Components (Salesforce Experience Cloud).
 * Walks out of shadow roots via .host when needed.
 * @param {Element} el
 * @returns {string}
 */
function getLightningLabel(el) {
  // 1. Standard strategies already cover aria/label[for]/placeholder
  // 2. Climb composed path: lightning-input / lightning-combobox often holds the label
  var node = el;
  for (var depth = 0; depth < 8 && node; depth++) {
    var host = null;
    try {
      var root = node.getRootNode && node.getRootNode();
      if (root && root.host) host = root.host;
    } catch (e) { /* ignore */ }

    var candidates = [node, host].filter(Boolean);
    for (var c = 0; c < candidates.length; c++) {
      var cand = candidates[c];
      var tag = (cand.tagName || "").toLowerCase();
      if (tag.indexOf("lightning-") === 0 || tag.indexOf("c-") === 0 || tag.indexOf("runtime_") === 0) {
        var lab =
          cand.getAttribute("label") ||
          cand.getAttribute("data-label") ||
          cand.getAttribute("field-label") ||
          cand.getAttribute("aria-label") ||
          "";
        if (lab && lab.trim() && lab.trim().toLowerCase() !== "select an option") {
          return lab.trim();
        }
        // label in host shadow
        try {
          if (cand.shadowRoot) {
            var labEl = cand.shadowRoot.querySelector(
              "label, .slds-form-element__label, legend, .slds-form-element__legend"
            );
            if (labEl) {
              var t = (labEl.textContent || "").replace(/\*/g, "").trim();
              if (t && t.toLowerCase() !== "select an option") return t;
            }
          }
        } catch (e2) { /* ignore */ }
      }
      // name attribute on host often matches Salesforce API name
      if (cand.getAttribute && cand.getAttribute("name") && !el.name) {
        // prefer human label; fall through
      }
    }

    if (host) node = host;
    else node = node.parentElement;
  }
  return "";
}

/**
 * Scan the document for fillable form fields.
 * Returns an array of rich field descriptors with full metadata.
 * Pierces open shadow DOM (required for Salesforce Lightning portals).
 *
 * @returns {Array<{element:Element, name:string, id:string, label:string, type:string, tagName:string, selector:string, autocomplete:string, title:string, required:boolean, placeholder:string, currentValue:string, hasValue:boolean, fieldsetLegend:string, nearestHeading:string, nearbyText:string, ariaDescribedby:string, options:Array<{value:string,text:string}>|null, visible:boolean, enabled:boolean}>}
 */
function scanFormFields(opts) {
  var lean = !!(opts && (opts.lean || opts.mode === "lean"));
  var fillMode = true;
  if (opts && opts.mode === "full") fillMode = false;
  if (lean) fillMode = false;

  var results = [];
  var elements = querySelectorAllDeep(FIELD_SELECTORS);

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (!isFillable(el)) continue;

    var tagName = el.tagName.toLowerCase();
    var type = el.getAttribute("type") || tagName;
    var name = el.name || "";
    // Salesforce host name often more useful than generated id
    if (!name) {
      try {
        var root = el.getRootNode && el.getRootNode();
        if (root && root.host && root.host.getAttribute) {
          name = root.host.getAttribute("name") || root.host.getAttribute("data-field") || "";
        }
      } catch (e) { /* ignore */ }
    }
    var id = el.id || "";
    var currentVal = el.value || "";
    var autocomplete = el.getAttribute("autocomplete") || "";
    var required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";

    var label = getLabelForElement(el);
    if (!label || label === id || label === name) {
      var lit = getLightningLabel(el);
      if (lit) label = lit;
    }

    // Lean auto-scan: identity only (no expensive context walks / selector paths)
    if (lean) {
      results.push({
        element: el,
        name: name,
        id: id,
        label: label,
        type: type,
        tagName: tagName,
        autocomplete: autocomplete,
        currentValue: currentVal,
        hasValue: !!(currentVal && currentVal.trim()),
        visible: true,
        enabled: true,
      });
      continue;
    }

    // Select options only in full mode (autofill reads live el.options)
    var options = null;
    if (!fillMode && tagName === "select") {
      options = [];
      for (var j = 0; j < el.options.length; j++) {
        var o = el.options[j];
        options.push({ value: o.value, text: o.text });
      }
    }

    var descriptor = {
      element: el,
      name: name,
      id: id,
      label: label,
      type: type,
      tagName: tagName,
      selector: fillMode ? "" : getSelectorPath(el),
      autocomplete: autocomplete,
      title: el.getAttribute("title") || "",
      placeholder: el.getAttribute("placeholder") || "",
      required: required,
      currentValue: currentVal,
      hasValue: !!(currentVal && currentVal.trim()),
      fieldsetLegend: getClosestFieldsetLegend(el),
      nearestHeading: getNearestHeading(el),
      nearbyText: fillMode ? "" : getNearbyText(el),
      ariaDescribedby: fillMode ? "" : getAriaDescribedbyText(el),
      options: options,
      visible: true,
      enabled: true,
    };

    results.push(descriptor);
  }

  return results;
}

/**
 * Precompute match metadata once per scanned field.
 * Avoids repeated sectionFromDom walks inside the K×D scoring loop.
 * @param {Array} fields
 */
function precomputeFieldMatchMeta(fields) {
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    f._identifier = getFieldIdentifier(f);
    f._terminalToken = getTerminalToken(f.name);
    f._sectionKind = getSectionKind(f);
  }
}

/**
 * Get all unique identifier strings for a field descriptor.
 * Uses field-specific tokens (name, id, label). Section context is applied
 * separately via sectionKindBoost (academic vs employment).
 * @param {{name:string, id:string, label:string}} field
 * @returns {string}
 */
function getFieldIdentifier(field) {
  return [field.name, field.id, field.label].filter(Boolean).join(" ");
}

/** CRM keys that belong to academic / education history sections. */
const ACADEMIC_CRM_KEYS = new Set([
  "institutionName", "degree", "major", "studyDates", "startDate", "endDate",
  "graduationYear", "gpa", "previousEducation", "qualificationLevel",
  "qualificationType", "grade", "awardStatus", "studyCountry",
  "englishFirstLanguage", "otherEnglishLanguageExperience",
  "highestQualification", "hasUniversityDegree",
]);

/** CRM keys that belong to employment / work history sections. */
const EMPLOYMENT_CRM_KEYS = new Set([
  "cvCurrentJobTitle", "cvCurrentEmployer", "cvEmploymentStatus",
  "cvYearsExperience", "cvWorkStartDate", "cvWorkEndDate",
  "employerName", "jobTitle", "employmentCountry", "presentEmployment",
  "hasTwoYearsWorkExperience", "cvWorkLocation", "cvJobDescription",
]);

/**
 * Infer whether a field sits under Academic or Employment history.
 * Critical for Sunderland where both sections use "Organisation" and
 * "Month Year From/To".
 * @param {{label?:string,name?:string,id?:string,fieldsetLegend?:string,nearestHeading?:string,nearbyText?:string}} field
 * @returns {"academic"|"employment"|""}
 */
/**
 * Walk composed tree (including shadow hosts) looking for Academic/Employment section titles.
 * @param {Element} el
 * @returns {"academic"|"employment"|""}
 */
function sectionFromDom(el) {
  if (!el) return "";
  var node = el;
  for (var depth = 0; depth < 25 && node; depth++) {
    try {
      var probe = node;
      while (probe) {
        var prev = probe.previousElementSibling;
        while (prev) {
          var t = (prev.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240);
          if (/employment history/i.test(t)) return "employment";
          if (/academic history/i.test(t)) return "academic";
          if (/english language skills/i.test(t)) return "academic";
          prev = prev.previousElementSibling;
        }
        // Also scan parent text lightly (section wrappers)
        if (probe.className && /section|history|employment|academic/i.test(String(probe.className))) {
          var pt = (probe.textContent || "").slice(0, 120);
          if (/^[\s\S]{0,40}employment history/i.test(pt)) return "employment";
          if (/^[\s\S]{0,40}academic history/i.test(pt)) return "academic";
        }
        var root = probe.getRootNode && probe.getRootNode();
        if (root && root.host) probe = root.host;
        else probe = probe.parentElement;
      }
    } catch (e) { /* ignore */ }
    try {
      var r = node.getRootNode && node.getRootNode();
      if (r && r.host) node = r.host;
      else node = node.parentElement;
    } catch (e2) {
      node = node.parentElement;
    }
  }
  return "";
}

function getSectionKind(field) {
  var lab = normalize([field.label, field.name, field.id].filter(Boolean).join(" "));
  var type = normalize(field.type || "");
  // Strong label/name signals first
  if (/jobtitle|job title|present employment|present__c|employer|employment country/.test(lab)) {
    return "employment";
  }
  if (/qualification|program title|programme title|award status|\bgrade\b|studied|academic|education level/.test(lab)) {
    return "academic";
  }
  if (/otherenglish|english first language|english language/.test(lab)) {
    return "academic";
  }
  // Sunderland: Academic Organisation = search combobox; Employment Organisation = text Organisation__c
  if (/^organisation$|^organization$|organisation__c|organization__c/.test(lab)) {
    if (/organisation__c|organization__c/.test(lab)) return "employment";
    if (type === "search") return "academic";
    if (type === "text") return "employment";
  }

  // Live DOM section titles (Academic history / Employment history)
  if (field.element) {
    var fromDom = sectionFromDom(field.element);
    if (fromDom) return fromDom;
  }

  var ctx = normalize(
    [field.fieldsetLegend, field.nearestHeading, field.nearbyText].filter(Boolean).join(" ")
  );
  var hasEmp = /employment history|work history|professional experience|job history|employer/.test(ctx);
  var hasAca = /academic history|education history|higher education|qualification/.test(ctx);
  // "Academic and professional background" is the page stage — prefer more specific
  if (hasEmp && !/academic history/.test(ctx)) return "employment";
  if (hasAca && /academic history|education history|higher education/.test(ctx)) return "academic";
  if (hasEmp) return "employment";
  if (hasAca) return "academic";
  return "";
}

/**
 * Section-aware score adjustment so education keys don't win on employment
 * "Organisation" and vice versa.
 * @param {string} crmKey
 * @param {"academic"|"employment"|""} section
 * @param {number} score
 * @returns {number}
 */
function applySectionBoost(crmKey, section, score) {
  if (!section || score <= 0) return score;
  var isAca = ACADEMIC_CRM_KEYS.has(crmKey);
  var isEmp = EMPLOYMENT_CRM_KEYS.has(crmKey);
  if (section === "academic") {
    if (isEmp && !isAca) return Math.floor(score * 0.25);
    if (isAca) return score + 25;
  }
  if (section === "employment") {
    if (isAca && !isEmp) return Math.floor(score * 0.25);
    if (isEmp) return score + 25;
  }
  // Ambiguous "organisation"/"month year from" with no section: prefer label-specific keys only
  return score;
}

// ─── Matching and scoring ───────────────────────────────────────────────

/**
 * Score how well a field identifier matches a CRM key.
 * Returns an integer; higher = better match.
 *
 * Scoring components:
 *   1. Base synonym score (0-100): exact match, prefix/suffix, contains, etc.
 *   2. Word overlap score (0-30): proportion of meaningful field words in synonyms
 *   3. Autocomplete boost (0 or 65): autocomplete attribute maps to this CRM key
 *   4. Terminal token boost (0 or 50): last meaningful path segment matches a synonym
 *   5. Section boost/penalty (academic vs employment)
 *
 * Threshold for filling is 50 (checked in autofillPage).
 *
 * @param {string} crmKey
 * @param {string} fieldId - the combined identifier (name + " " + id + " " + label)
 * @param {string} [autocompleteValue] - the field's autocomplete attribute
 * @param {string} [terminalToken] - the field name's terminal path token
 * @param {"academic"|"employment"|""} [sectionKind]
 * @returns {number}
 */
function matchScore(crmKey, fieldId, autocompleteValue, terminalToken, sectionKind) {
  var nField = normalize(fieldId);

  // ── Reject empty or near-empty identifiers ───────────────────────
  if (!nField || nField.length < 3) {
    return 0;
  }

  // ── Salutation "title" vs employment "Job Title" ─────────────────
  // CRM key `title` is Mr/Mrs only. Never map it to Job Title / jobtitle__c.
  if (crmKey === "title") {
    if (/\bjob\b|\bposition\b|\brole\b|jobtitle|job_title|program title|programme title|course title|subject/.test(nField)) {
      return 0;
    }
  }

  // ── Other English Language Experience (Sunderland OtherEnglishLanguageExperience__c)
  // Exclusive: only the dedicated CRM key may claim this field.
  // Blocks nationality (autocomplete "language"), work experience, IELTS scores, etc.
  var isOtherEnglishField =
    /otherenglishlanguageexperience/.test(nField.replace(/\s+/g, "")) ||
    /\bother english language (experience|evidence)\b/.test(nField);
  if (isOtherEnglishField && crmKey !== "otherEnglishLanguageExperience") {
    return 0;
  }
  // Do not put Other-English free text into the Yes/No first-language combobox
  if (crmKey === "otherEnglishLanguageExperience") {
    if (/\bis english your first language\b|\benglish first language\b|\bfirst language\b/.test(nField) &&
        !isOtherEnglishField) {
      return 0;
    }
  }
  // Nationality must not match English-language fields (autocomplete "language" trap)
  if (crmKey === "nationality" && /\benglish\b|\blanguage experience\b|\blanguage skills\b/.test(nField)) {
    return 0;
  }

  // ── Funding: main combobox vs "Other funding source" free-text ─────
  // Live Sunderland: "How are you intending to fund this programme?" → Self-Funding
  // "Other funding source" (Otherfundingsource__c) only when type is Other.
  var isOtherFundingField =
    /otherfundingsource/.test(nField.replace(/\s+/g, "")) ||
    /\bother funding source\b|\bother source of funding\b/.test(nField);
  var isMainFundingField =
    !isOtherFundingField &&
    (/\bhow are you intending to fund\b/.test(nField) ||
      (/\bfund(ing)?\b/.test(nField) && /\b(programme|program|tuition|intend)\b/.test(nField)) ||
      nField === "funding" ||
      nField === "funding source");
  if (isOtherFundingField && crmKey !== "otherFundingSource") {
    return 0; // never dump Self-Funding into Other funding source text
  }
  if (isMainFundingField && crmKey !== "funding") {
    return 0; // preferredCourse must not claim funding via bare "programme"
  }
  if (crmKey === "funding" && isOtherFundingField) {
    return 0;
  }
  if (crmKey === "preferredCourse" && /\bfund\b/.test(nField)) {
    return 0;
  }

  var synMeta = getSynonymMeta(crmKey);
  var synonyms = synMeta.synonyms;
  var baseScore = 0;

  // Salutation: exact "Title" label (no bare "title" synonym — removed to protect Job Title)
  if (crmKey === "title" && (nField === "title" || /^title\b/.test(nField))) {
    baseScore = Math.max(baseScore, 100);
  }
  // Exact Sunderland Other English field → lock score
  if (crmKey === "otherEnglishLanguageExperience" && isOtherEnglishField) {
    baseScore = Math.max(baseScore, 100);
  }
  // Main funding combobox → lock score for funding key
  if (crmKey === "funding" && isMainFundingField) {
    baseScore = Math.max(baseScore, 100);
  }

  // ── 1. Base synonym scoring ──────────────────────────────────────
  for (var s = 0; s < synonyms.length; s++) {
    var syn = synonyms[s];
    if (!syn || syn.length < 2) continue;

    // Exact match is strongest, but still subject to section boost/penalty
    // (e.g. "Organisation" maps to both university and employer).
    if (nField === syn) {
      baseScore = Math.max(baseScore, 100);
      continue;
    }

    // Word-boundary-aware check using \b regex
    var escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var wordBoundaryRe = new RegExp('\\b' + escaped + '\\b', 'i');
    var hasWordBoundary = wordBoundaryRe.test(nField);

    // starts-with or ends-with as a whole word
    if (hasWordBoundary && (nField.startsWith(syn + " ") || nField.endsWith(" " + syn))) {
      baseScore = Math.max(baseScore, 85);
    }
    // Word-boundaried contains (but not start/end — already scored above)
    else if (hasWordBoundary) {
      baseScore = Math.max(baseScore, 65);
    }

    // Bare substring contains — lowered well below threshold; only helps combined signals.
    // Short synonyms (<=4 chars) skip bare substring entirely to avoid false positives.
    if (syn.length > 4 && nField.includes(syn)) {
      baseScore = Math.max(baseScore, 35);
    }

    // Synonym contains the field identifier as a whole word (checked with word boundary)
    if (nField.length >= 4) {
      var escapedField = nField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var fieldBoundaryRe = new RegExp('\\b' + escapedField + '\\b', 'i');
      if (fieldBoundaryRe.test(syn)) {
        baseScore = Math.max(baseScore, 40);
      }
    }
  }

  // ── 2. Word-overlap scoring (uses cached syn word set) ───────────
  var fieldWords = nField.split(/\s+/).filter(function (w) {
    return w.length > 2 && !STOPWORDS.has(w);
  });
  var synWords = synMeta.synWords;

  if (fieldWords.length > 0 && synWords.size > 0) {
    var matchCount = 0;
    for (var f = 0; f < fieldWords.length; f++) {
      if (synWords.has(fieldWords[f])) matchCount++;
    }
    if (matchCount > 0) {
      var proportion = matchCount / fieldWords.length;
      if (proportion >= 0.3) {
        baseScore = Math.max(baseScore, Math.min(30, Math.round(proportion * 30)));
      }
    }
  }

  // ── 3. Autocomplete boost ────────────────────────────────────────
  var autoScore = 0;
  if (autocompleteValue) {
    var normAuto = normalize(autocompleteValue);
    var mappedKey = AUTOCOMPLETE_KEY_MAP[normAuto];
    if (mappedKey === crmKey) {
      autoScore = 65;
    }
    // Also check: autocomplete value itself might be in the synonym set
    if (autoScore === 0) {
      for (var a = 0; a < synonyms.length; a++) {
        if (synonyms[a].includes(normAuto) || normAuto === synonyms[a]) {
          autoScore = Math.max(autoScore, 40);
          break;
        }
      }
    }
  }

  // ── 4. Terminal token boost ──────────────────────────────────────
  var terminalScore = 0;
  if (terminalToken) {
    var normToken = normalize(terminalToken);
    if (normToken.length >= 3) {
      for (var tk = 0; tk < synonyms.length; tk++) {
        var syn = synonyms[tk];
        if (normToken === syn) {
          terminalScore = 50;
          break;
        }
        if (syn.includes(normToken) || normToken.includes(syn)) {
          terminalScore = Math.max(terminalScore, 30);
        }
      }
    }
  }

  var total = baseScore + autoScore + terminalScore;
  return applySectionBoost(crmKey, sectionKind || "", total);
}

// ─── Filling ────────────────────────────────────────────────────────────

/**
 * Parse a date-ish string into { y, m, d } or null.
 * Accepts ISO (YYYY-MM-DD), UK (DD/MM/YYYY or DD-MM-YYYY), and US (MM/DD/YYYY) when unambiguous.
 * @param {string} raw
 * @returns {{y:string,m:string,d:string}|null}
 */
function parseDateParts(raw) {
  if (!raw || typeof raw !== "string") return null;
  var s = raw.trim();
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return {
      y: iso[1],
      m: iso[2].padStart(2, "0"),
      d: iso[3].padStart(2, "0"),
    };
  }
  var slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slash) {
    var a = parseInt(slash[1], 10);
    var b = parseInt(slash[2], 10);
    var y = slash[3];
    // Prefer UK DD/MM/YYYY for agent portals (day > 12 forces UK; month-first only if day part > 12).
    if (a > 12 && b <= 12) {
      return { y: y, m: String(b).padStart(2, "0"), d: String(a).padStart(2, "0") };
    }
    if (b > 12 && a <= 12) {
      return { y: y, m: String(a).padStart(2, "0"), d: String(b).padStart(2, "0") };
    }
    // Ambiguous: assume UK DD/MM/YYYY (target portals are UK universities).
    return {
      y: y,
      m: String(b).padStart(2, "0"),
      d: String(a).padStart(2, "0"),
    };
  }
  return null;
}

/**
 * Format CRM values for UK university portal field types.
 * - input[type=date] → YYYY-MM-DD
 * - text/tel fields that look like DOB → DD/MM/YYYY
 * @param {Element} el
 * @param {string} value
 * @param {{label?:string,name?:string,id?:string}} [meta]
 * @returns {string}
 */
function formatValueForField(el, value, meta) {
  if (!value || typeof value !== "string") return value;
  var type = (el.getAttribute("type") || "text").toLowerCase();
  // Include nearby form-element help text (e.g. Sunderland "Format: 31 Dec 2024")
  var nearby = "";
  try {
    var host = el.closest && (el.closest(".slds-form-element") || el.closest("lightning-input") || el.parentElement);
    if (host && host.innerText) nearby = host.innerText.slice(0, 200);
  } catch (e) { /* ignore */ }
  var hint = normalize(
    [
      (meta && meta.label) || "",
      (meta && meta.name) || "",
      (meta && meta.id) || "",
      el.getAttribute("placeholder") || "",
      el.name || "",
      nearby,
    ].join(" ")
  );
  // Sunderland Academic/Employment: "Month Year From/To" → MM-YYYY
  var isMonthYear =
    /\bmonth year\b/.test(hint) ||
    /\b(from|to) month year\b/.test(hint) ||
    (/\b(start|end|from|to)\b/.test(hint) && /\b(month|year)\b/.test(hint) && !/\b(date of birth|dob|birth)\b/.test(hint));

  var isBirth =
    /\b(dob|date of birth|birth date|birthdate)\b/.test(hint) ||
    /^(birthdate|dateofbirth)$/i.test(el.name || "");

  var isDateHint =
    type === "date" ||
    type === "datetime-local" ||
    isMonthYear ||
    isBirth ||
    /\b(passport (issue|expiry)|expiry date|issue date|test date|start date|end date)\b/.test(hint);

  if (!isDateHint && type !== "date" && type !== "datetime-local") {
    return value;
  }

  // Already MM-YYYY / MM/YYYY / Mon YYYY → normalise to MM-YYYY for Sunderland
  if (isMonthYear) {
    var my = value.trim().match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if (my) return my[1].padStart(2, "0") + "-" + my[2];
    var isoMy = value.trim().match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
    if (isoMy) return isoMy[2].padStart(2, "0") + "-" + isoMy[1];
    var mon = value.trim().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-\/]+(\d{4})$/i);
    if (mon) {
      var months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };
      var m = months[mon[1].toLowerCase().slice(0, 3)] || months[mon[1].toLowerCase()];
      if (m) return m + "-" + mon[2];
    }
  }

  var parts = parseDateParts(value);
  if (!parts) return value;

  if (isMonthYear) {
    return parts.m + "-" + parts.y;
  }
  if (type === "date") {
    return parts.y + "-" + parts.m + "-" + parts.d;
  }
  if (type === "datetime-local") {
    return parts.y + "-" + parts.m + "-" + parts.d + "T00:00";
  }
  // Sunderland Your details Birth Date: "Format: 31 Dec 2024" → "6 Jan 2003"
  var wantsMonDay =
    isBirth &&
    (/\bformat\b/.test(hint) && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(hint) ||
      /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b/.test(hint) ||
      /birthdate/i.test(el.name || ""));
  if (wantsMonDay) {
    var monNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var mi = parseInt(parts.m, 10) - 1;
    if (mi >= 0 && mi < 12) {
      return String(parseInt(parts.d, 10)) + " " + monNames[mi] + " " + parts.y;
    }
  }
  // Default UK text date fields (e:Vision etc.)
  return parts.d + "/" + parts.m + "/" + parts.y;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function waitMs(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Set the value of a form element.
 * Dispatches input and change events so JS frameworks react.
 *
 * Uses the correct prototype setter for each element type:
 *   - HTMLTextAreaElement.prototype.value for <textarea>
 *   - HTMLInputElement.prototype.value for <input>
 * This ensures React/Angular/Vue detect the change.
 *
 * Lightning comboboxes are async (waits for option list).
 *
 * @param {Element} el
 * @param {string} value
 * @param {{label?:string,name?:string,id?:string,crmKey?:string}} [meta]
 * @returns {Promise<boolean>} true if value was set / option selected
 */
async function setElementValue(el, value, meta) {
  var tagName = el.tagName.toLowerCase();
  var type = (el.getAttribute("type") || "text").toLowerCase();
  value = formatValueForField(el, value, meta || {});

  // Skip checkbox / radio for MVP — no boolean mapping yet.
  if (type === "checkbox" || type === "radio") {
    return false;
  }

  if (tagName === "select") {
    var options = Array.from(el.options);
    var trimmedValue = value.trim();
    var normValue = trimmedValue.toLowerCase();

    // Helper: skip placeholder/default options (e.g. "— Select —", "Choose one\u2026")
    function isPlaceholderOption(o) {
      var t = o.text.trim().toLowerCase();
      return !o.value || o.value === "" || /^[\u2014\u2013\u2012]/.test(t) || /^(select|choose|pick|please)/.test(t);
    }

    // 1. Exact value match
    var exactValue = null;
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === trimmedValue) { exactValue = options[i]; break; }
    }
    if (exactValue) {
      el.value = exactValue.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // 2. Case-insensitive text match (skip placeholders)
    var textMatch = null;
    for (var j = 0; j < options.length; j++) {
      if (!isPlaceholderOption(options[j]) && options[j].text.trim().toLowerCase() === normValue) {
        textMatch = options[j]; break;
      }
    }
    if (textMatch) {
      el.value = textMatch.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // 3. Starts-with match on option text
    var startsWithMatch = null;
    for (var k = 0; k < options.length; k++) {
      if (!isPlaceholderOption(options[k]) && options[k].text.trim().toLowerCase().startsWith(normValue)) {
        startsWithMatch = options[k]; break;
      }
    }
    if (startsWithMatch) {
      el.value = startsWithMatch.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // 4. Partial text match (skip placeholders)
    var partialMatch = null;
    for (var m = 0; m < options.length; m++) {
      if (!isPlaceholderOption(options[m]) && options[m].text.trim().toLowerCase().includes(normValue)) {
        partialMatch = options[m]; break;
      }
    }
    if (partialMatch) {
      el.value = partialMatch.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // 5. Fuzzy: value might be a substring of an option text
    if (normValue.length >= 3) {
      var fuzzyMatch = null;
      for (var n = 0; n < options.length; n++) {
        if (!isPlaceholderOption(options[n]) && normValue.includes(options[n].text.trim().toLowerCase())) {
          fuzzyMatch = options[n]; break;
        }
      }
      if (fuzzyMatch) {
        el.value = fuzzyMatch.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }

    return false; // no matching option
  }

  if (tagName === "textarea") {
    var nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    );
    if (nativeTextAreaSetter && nativeTextAreaSetter.set) {
      nativeTextAreaSetter.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // Input elements (text, tel, email, url, number, date, search/combobox, etc.)
  if (tagName === "input") {
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    if (nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(el, value);
    } else {
      el.value = value;
    }
    // Standard events (minimal set that frameworks need)
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Salesforce Experience Cloud comboboxes (type=search): open list and pick option
    var isSearch = type === "search" || el.getAttribute("role") === "combobox";
    if (isSearch) {
      try {
        el.focus();
        el.click();
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      } catch (e3) { /* ignore */ }
      var picked = await pickLightningComboboxOption(el, value, meta && meta.crmKey);
      // Honest success: combobox only counts if a real option was selected
      if (!picked) {
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        return false;
      }
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      try {
        var rootCb = el.getRootNode && el.getRootNode();
        if (rootCb && rootCb.host) {
          rootCb.host.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } catch (eHost) { /* ignore */ }
      return true;
    }

    el.dispatchEvent(new Event("blur", { bubbles: true }));
    // Notify host lightning-input of value change when inside open shadow
    try {
      var root = el.getRootNode && el.getRootNode();
      if (root && root.host) {
        root.host.value = value;
        root.host.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } catch (e2) { /* ignore */ }
    return true;
  }

  // Fallback (unusual element types)
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/**
 * Expand a CRM value into portal combobox candidates (UK HE / Sunderland).
 * Tried in order; first that matches a live option wins.
 * @param {string} crmKey
 * @param {string} value
 * @returns {string[]}
 */
function expandComboboxCandidates(crmKey, value) {
  var v = (value || "").trim();
  var out = [];
  function add(x) {
    if (!x || typeof x !== "string") return;
    var t = x.trim();
    if (!t) return;
    if (out.indexOf(t) === -1) out.push(t);
  }
  add(v);

  if (crmKey === "grade" || crmKey === "gpa") {
    var n = normalize(v);
    // Sunderland live Grade picklist (exact, verified 2026-07-31):
    // First Class | Upper Second | Lower Second | Third Class | Unclassified |
    // Aegrotat | Commendation | Distinction | Merit | Pass | Failed Award | Other
    if (/2\s*:\s*1|two division one|upper second|2\.1|ii\.?i\b|class two division one/.test(n)) {
      add("Upper Second"); // exact Sunderland option — try first
      add("Upper Second Class Honours (2:1)");
      add("Upper Second Class Honours");
      add("Upper Second Class (2:1)");
      add("2:1");
      add("2.1");
      add("Class Two Division One Honours");
      add("Second Class Honours, Upper Division");
      add("Second Class Honours Upper Division");
      add("II.i");
    }
    if (/2\s*:\s*2|two division two|lower second|2\.2|ii\.?ii\b/.test(n)) {
      add("Lower Second"); // exact Sunderland option
      add("Lower Second Class Honours (2:2)");
      add("Lower Second Class Honours");
      add("2:2");
      add("Class Two Division Two Honours");
    }
    if (/first class|1st|first-class|\b1\s*:\s*1\b/.test(n)) {
      add("First Class"); // exact Sunderland option
      add("First Class Honours");
      add("1st");
    }
    if (/third|3rd|\biii\b/.test(n)) {
      add("Third Class"); // exact Sunderland option
      add("Third Class Honours");
    }
    if (/distinction/.test(n)) add("Distinction");
    if (/merit/.test(n)) add("Merit");
    if (/pass/.test(n)) add("Pass");
    if (/unclassified/.test(n)) add("Unclassified");
    if (/aegrotat/.test(n)) add("Aegrotat");
    if (/commendation/.test(n)) add("Commendation");
  }

  // Academic History "Qualification Level" ≠ step-1 "Highest Qualification"
  if (crmKey === "qualificationLevel") {
    var nql = normalize(v);
    // Sunderland Academic History: menu/option is "Higher Education" (verified live)
    if (/higher education|he\b|master|meng|msc|bachelor|beng|bsc|postgrad|undergrad|level\s*[67]|university|degree/.test(nql) || !nql) {
      add("Higher Education");
    }
    if (/further education|\bfe\b/.test(nql)) add("Further Education");
    if (/secondary|school|a\s*level|gcse/.test(nql)) add("Secondary Education");
    // legacy CRM values still expand to HE
    if (/master|meng|level\s*7|pg(t|r)?/.test(nql)) {
      add("Higher Education");
      add("Masters");
      add("Level 7");
    }
  }

  if (crmKey === "highestQualification") {
    var nq = normalize(v);
    if (/master|meng|msc|postgrad|level\s*7|pg(t|r)?|uk masters|higher education/.test(nq)) {
      // Step 1 "Highest Qualification" options on Sunderland Your details:
      add("UK Masters degree");
      add("Non-UK Master degree");
      add("Masters Degree");
      add("Master's Degree");
      add("Masters");
      add("Master");
      add("Postgraduate");
      add("Postgraduate Taught");
      add("Level 7");
    }
    if (/bachelor|beng|bsc|first degree|undergrad|level\s*6/.test(nq)) {
      add("UK First degree");
      add("Non-UK First degree");
      add("Bachelors");
      add("Bachelor's Degree");
      add("Undergraduate");
      add("Level 6");
    }
    if (/foundation|level\s*3|level\s*4/.test(nq)) {
      add("Foundation");
      add("Foundation Degree");
    }
    if (/phd|doctor|level\s*8/.test(nq)) {
      add("Doctorate");
      add("PhD");
      add("Level 8");
    }
  }

  if (crmKey === "qualificationType") {
    var nt = normalize(v);
    // Sunderland live codes: BA (Hons), BSc (Hons), BA, BENG, BENG (Hons), MA, MBA,
    // MENG, MSc, MSci, MPhil, PhD, PGDip, PGCert, … (verified 2026-07-31)
    if (/master of engineering|\bmeng\b/.test(nt)) {
      add("MENG"); // exact Sunderland option
      add("MEng");
      add("Master of Engineering");
      add("Master of Engineering (MENG)");
    }
    if (/master of science|\bmsc\b/.test(nt)) {
      add("MSc");
      add("Master of Science");
    }
    if (/\bma\b|master of arts/.test(nt)) add("MA");
    if (/\bmba\b|master of business/.test(nt)) add("MBA");
    if (/bachelor of engineering|\bbeng\b/.test(nt)) {
      add("BENG");
      add("BENG (Hons)");
      add("BEng");
      add("Bachelor of Engineering");
    }
    if (/\bbsc\b|bachelor of science/.test(nt)) {
      add("BSc (Hons)");
      add("BSc");
    }
    if (/\bba\b|bachelor of arts/.test(nt)) {
      add("BA (Hons)");
      add("BA");
    }
    if (/\bphd\b|doctor/.test(nt)) add("PhD");
  }

  if (crmKey === "awardStatus") {
    var na = normalize(v);
    // Sunderland live: Awarded | Exam to be taken | Pending Award | Still Studying | Not Awarded
    if (/award|complete|pass|confer|finish/.test(na) || !na) {
      add("Awarded");
      add("Completed");
      add("Passed");
      add("Conferred");
      add("Finished");
    }
    if (/pending|expect/.test(na)) {
      add("Pending Award");
      add("Pending");
      add("Expected");
    }
    if (/current|ongoing|studying|still/.test(na)) {
      add("Still Studying");
      add("In Progress");
      add("Current");
    }
    if (/exam|to be taken/.test(na)) add("Exam to be taken");
    if (/not award|fail/.test(na)) add("Not Awarded");
  }

  if (crmKey === "studyCountry" || crmKey === "countryName" || crmKey === "employmentCountry") {
    var nc = normalize(v);
    if (/united kingdom|\buk\b|great britain|england|scotland|wales|britain/.test(nc)) {
      add("United Kingdom of Great Britain and Northern Ireland (the)");
      add("United Kingdom");
      add("UK");
      add("Great Britain");
    }
    if (/united arab emirates|\buae\b/.test(nc)) {
      add("United Arab Emirates (the)");
      add("United Arab Emirates");
      add("UAE");
    }
  }

  if (crmKey === "funding") {
    var nf = normalize(v);
    if (/self/.test(nf)) {
      // Sunderland live option (ego-browser 2026-07-31): "Self-Funding"
      add("Self-Funding");
      add("Self Funding");
      add("Self-Funded");
      add("Self Funded");
      add("Private");
    }
    if (/sponsor|company|employer/.test(nf)) {
      add("Sponsored");
      add("Sponsor");
      add("Company Sponsored");
      add("Employer Sponsored");
    }
    if (/scholar|bursar/.test(nf)) {
      add("Scholarship");
      add("Scholarship / Bursary");
      add("Bursary");
    }
    if (/student loan|loan|slc|sfas/.test(nf)) {
      add("Student Loan");
      add("Student Finance");
    }
    if (/other/.test(nf)) {
      add("Other");
      add("Other funding source");
    }
  }

  if (crmKey === "hasUniversityDegree") {
    var ny = normalize(v);
    if (/^(y|yes|true|1)$/.test(ny) || /have|hold|yes/.test(ny)) {
      add("Yes");
    }
    if (/^(n|no|false|0)$/.test(ny)) {
      add("No");
    }
  }

  return out;
}

/**
 * Score how well a CRM candidate string matches a combobox option label.
 * Prefers pre-normalized candidate when provided.
 * @param {string} candidateNorm - already normalized candidate
 * @param {string} optionText
 * @param {string[]} [candidateTokens]
 * @returns {number}
 */
function scoreComboboxOption(candidateNorm, optionText, candidateTokens) {
  var c = candidateNorm;
  var t = normalize(optionText);
  if (!c || !t || t === "no option found." || t === "no matches found.") return 0;
  if (t === c) return 100;
  // digit-aware: "2:1" vs "2.1" vs "2 1"
  var cDigits = c.replace(/[^a-z0-9]/g, "");
  var tDigits = t.replace(/[^a-z0-9]/g, "");
  if (cDigits.length >= 2 && cDigits === tDigits) return 95;
  if (t.startsWith(c) || c.startsWith(t)) return 85;
  if (t.includes(c) || c.includes(t)) return 70;
  // token overlap
  var cTok = candidateTokens || c.split(/\s+/).filter(function (w) { return w.length > 1; });
  var tSet = new Set(t.split(/\s+/));
  var hits = 0;
  for (var i = 0; i < cTok.length; i++) if (tSet.has(cTok[i])) hits++;
  if (cTok.length && hits / cTok.length >= 0.6) return 55 + Math.round((hits / cTok.length) * 20);
  return 0;
}

/**
 * Collect option elements scoped to the open combobox near inputEl.
 * Avoids whole-document walks over thousands of Sunderland picklist nodes.
 * @param {Element} inputEl
 * @returns {Element[]}
 */
function getScopedComboboxOptions(inputEl) {
  var out = [];
  var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function addOpts(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll(
      "[role='option'], lightning-base-combobox-item, .slds-listbox__option"
    );
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (seen) {
        if (seen.has(n)) continue;
        seen.add(n);
      }
      // Prefer visible options
      try {
        var r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
      } catch (e) { /* keep */ }
      out.push(n);
    }
  }

  function walkShadow(root, depth) {
    if (!root || depth > 8) return;
    addOpts(root);
    try {
      var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
      for (var j = 0; j < all.length; j++) {
        if (all[j].shadowRoot) walkShadow(all[j].shadowRoot, depth + 1);
      }
    } catch (e2) { /* ignore */ }
  }

  // 1. aria-controls / aria-owns on input or host
  var controlledIds = [];
  try {
    var hosts = [inputEl];
    var rn = inputEl.getRootNode && inputEl.getRootNode();
    if (rn && rn.host) hosts.push(rn.host);
    for (var h = 0; h < hosts.length; h++) {
      var el = hosts[h];
      if (!el || !el.getAttribute) continue;
      var ac = el.getAttribute("aria-controls") || el.getAttribute("aria-owns") || "";
      if (ac) {
        ac.split(/\s+/).forEach(function (id) {
          if (id) controlledIds.push(id);
        });
      }
    }
  } catch (e3) { /* ignore */ }

  for (var c = 0; c < controlledIds.length; c++) {
    var byId = null;
    var cid = controlledIds[c];
    try {
      byId = document.getElementById(cid);
    } catch (e4) { /* ignore */ }
    if (!byId) {
      // Search in open shadows for id
      var esc =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(cid)
          : String(cid).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
      try {
        var deepId = querySelectorAllDeep("#" + esc);
        if (deepId[0]) byId = deepId[0];
      } catch (e4b) { /* ignore */ }
    }
    if (byId) walkShadow(byId, 0);
  }

  // 2. Nearest lightning-combobox / slds-combobox host
  if (!out.length) {
    var node = inputEl;
    for (var d = 0; d < 12 && node; d++) {
      var tag = (node.tagName || "").toLowerCase();
      if (
        tag === "lightning-combobox" ||
        tag === "lightning-base-combobox" ||
        (node.classList && (node.classList.contains("slds-combobox") || node.classList.contains("slds-form-element")))
      ) {
        walkShadow(node, 0);
        if (node.shadowRoot) walkShadow(node.shadowRoot, 0);
        if (out.length) break;
      }
      try {
        var rootN = node.getRootNode && node.getRootNode();
        if (rootN && rootN.host) node = rootN.host;
        else node = node.parentElement;
      } catch (e5) {
        node = node.parentElement;
      }
    }
  }

  // 3. Visible listboxes only (not whole-document option dump)
  if (!out.length) {
    var listboxes = querySelectorAllDeep("[role='listbox'], .slds-listbox, .slds-dropdown");
    for (var lb = 0; lb < listboxes.length; lb++) {
      try {
        var rect = listboxes[lb].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) walkShadow(listboxes[lb], 0);
      } catch (e6) { /* ignore */ }
    }
  }

  // 4. Last resort: visible options only (never score display:none catalog dumps)
  if (!out.length) {
    var any = querySelectorAllDeep(
      "[role='option'], lightning-base-combobox-item, .slds-listbox__option"
    );
    for (var a = 0; a < any.length; a++) {
      try {
        var rr = any[a].getBoundingClientRect();
        if (rr.width > 0 && rr.height > 0) out.push(any[a]);
      } catch (e7) { /* ignore */ }
    }
  }

  return out;
}

/**
 * After typing into a Lightning combobox search input, click the best matching option.
 * Options are scoped to the open listbox (not the whole document).
 * Waits briefly for async Lightning rendering.
 * @param {Element} inputEl
 * @param {string} value
 * @param {string} [crmKey]
 * @returns {Promise<boolean>}
 */
async function pickLightningComboboxOption(inputEl, value, crmKey) {
  var candidates = expandComboboxCandidates(crmKey || "", value);
  if (!candidates.length) return false;

  // Pre-normalize candidates once
  var candMeta = candidates.map(function (raw) {
    var n = normalize(raw);
    return {
      raw: raw,
      norm: n,
      tokens: n.split(/\s+/).filter(function (w) { return w.length > 1; }),
    };
  });

  // Filter input with best candidate text to shrink Lightning's async list
  try {
    var filterText = candidates[0];
    var setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    if (setter && setter.set) setter.set.call(inputEl, filterText);
    else inputEl.value = filterText;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.focus();
    inputEl.click();
  } catch (e0) { /* ignore */ }

  var options = [];
  var attempts = 8;
  for (var attempt = 0; attempt < attempts; attempt++) {
    options = getScopedComboboxOptions(inputEl);
    if (options.length > 0) break;
    await waitMs(40 + attempt * 35);
    try {
      inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    } catch (e1) { /* ignore */ }
  }
  if (!options.length) return false;

  // Exact-label index first (O(O) once), then fuzzy only if needed
  var exactMap = Object.create(null);
  var optionTexts = [];
  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    var text = (
      opt.getAttribute("data-value") ||
      opt.getAttribute("title") ||
      opt.textContent ||
      ""
    ).replace(/\s+/g, " ").trim();
    optionTexts.push(text);
    var tn = normalize(text);
    if (tn && !exactMap[tn]) exactMap[tn] = { opt: opt, text: text };
  }

  var best = null;
  var bestScore = 0;
  var bestCandidate = "";

  for (var c = 0; c < candMeta.length; c++) {
    var cm = candMeta[c];
    if (exactMap[cm.norm]) {
      best = exactMap[cm.norm].opt;
      bestScore = 100;
      bestCandidate = cm.raw;
      break;
    }
  }

  if (bestScore < 100) {
    for (var oi = 0; oi < options.length; oi++) {
      var otext = optionTexts[oi];
      if (!otext || /no option found|no matches found|stage complete|stage not started/i.test(otext)) {
        continue;
      }
      for (var cj = 0; cj < candMeta.length; cj++) {
        var sc = scoreComboboxOption(candMeta[cj].norm, otext, candMeta[cj].tokens);
        if (sc > bestScore) {
          bestScore = sc;
          best = options[oi];
          bestCandidate = candMeta[cj].raw;
        }
      }
      if (bestScore >= 100) break;
    }
  }

  if (best && bestScore >= 55) {
    try {
      if (bestCandidate) {
        var setter2 = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        );
        if (setter2 && setter2.set) setter2.set.call(inputEl, bestCandidate);
        else inputEl.value = bestCandidate;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e2) { /* ignore */ }
    try {
      best.click();
      return true;
    } catch (e3) {
      try {
        best.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
        );
        return true;
      } catch (e4) {
        return false;
      }
    }
  }
  return false;
}

// ─── Autofill logic ─────────────────────────────────────────────────────

/**
 * Match CRM keys to form fields using heuristic scoring, then fill them.
 * Precomputes field match meta once; tries next empty candidate if best is filled.
 *
 * @param {Record<string,string>} fieldMap - CRM key → value
 * @param {Array} fields - detected form fields (from scanFormFields)
 * @returns {Promise<{filled:Array, skippedEmpty:Array, skippedExisting:Array, skippedSelect:Array, unmatched:string[]}>}
 */
async function autofillPage(fieldMap, fields) {
  /** @type {Array<{name:string,value:string,fieldName:string,fieldLabel:string,score:number,matchReason:string}>} */
  var filled = [];

  /** @type {Array<{name:string,reason:string}>} */
  var skippedEmpty = [];

  /** @type {Array<{name:string,fieldName:string,fieldLabel:string,existingValue:string,reason:string}>} */
  var skippedExisting = [];

  /** @type {Array<{name:string,reason:string}>} */
  var skippedSelect = [];

  /** @type {string[]} */
  var unmatched = [];

  /** @type {Set<Element>} */
  var usedElements = new Set();

  warmSynonymCaches();
  precomputeFieldMatchMeta(fields);

  var entries = Object.entries(fieldMap);
  for (var e = 0; e < entries.length; e++) {
    var crmKey = entries[e][0];
    var value = entries[e][1];

    // Skip empty CRM values
    if (!value || (typeof value === "string" && !value.trim())) {
      skippedEmpty.push({ name: crmKey, reason: "Empty CRM value" });
      continue;
    }

    // Score every unused field once; sort descending for fallthrough
    var ranked = [];
    for (var f = 0; f < fields.length; f++) {
      if (usedElements.has(fields[f].element)) continue;
      var identifier = fields[f]._identifier || getFieldIdentifier(fields[f]);
      var terminalToken = fields[f]._terminalToken != null
        ? fields[f]._terminalToken
        : getTerminalToken(fields[f].name);
      var sectionKind = fields[f]._sectionKind != null
        ? fields[f]._sectionKind
        : getSectionKind(fields[f]);
      var score = matchScore(
        crmKey,
        identifier,
        fields[f].autocomplete,
        terminalToken,
        sectionKind
      );
      if (score >= 50) {
        ranked.push({ field: fields[f], score: score });
      }
    }
    ranked.sort(function (a, b) { return b.score - a.score; });

    if (!ranked.length) {
      unmatched.push(crmKey);
      continue;
    }

    var didFill = false;
    var notedExisting = false;

    for (var r = 0; r < ranked.length; r++) {
      var cand = ranked[r];
      var bestField = cand.field;
      var bestScore = cand.score;
      var existingVal = bestField.element.value || "";

      // Skip non-empty; try next empty candidate (e.g. countryName → residence)
      if (existingVal.trim()) {
        if (!notedExisting) {
          skippedExisting.push({
            name: crmKey,
            fieldName: bestField.name || bestField.id || "",
            fieldLabel: bestField.label || "",
            existingValue: truncate(existingVal, 30),
            reason: "Field already has a value",
          });
          notedExisting = true;
        }
        continue;
      }

      var success = await setElementValue(bestField.element, value, {
        label: bestField.label,
        name: bestField.name,
        id: bestField.id,
        crmKey: crmKey,
      });
      if (success) {
        usedElements.add(bestField.element);
        var matchReason = "";
        if (bestScore >= 100) matchReason = "Exact synonym match";
        else if (bestScore >= 85) matchReason = "Strong prefix/suffix match";
        else if (bestScore >= 65) matchReason = "Substring match";
        else matchReason = "Combined signals match";

        filled.push({
          name: crmKey,
          value: truncate(value, 30),
          fieldName: bestField.name || bestField.id || "",
          fieldLabel: bestField.label || "",
          score: bestScore,
          matchReason: matchReason,
        });
        didFill = true;
        break;
      } else {
        skippedSelect.push({
          name: crmKey,
          reason: "Could not match select/combobox option",
        });
        // try next ranked field
      }
    }

    if (!didFill && !notedExisting && skippedSelect.every(function (s) { return s.name !== crmKey; })) {
      unmatched.push(crmKey);
    }
  }

  // Combine all skipped for backward compatibility
  var skippedAll = [].concat(
    skippedEmpty.map(function (s) { return { name: s.name, reason: s.reason }; }),
    skippedExisting.map(function (s) {
      return { name: s.name, reason: s.reason, existingValue: s.existingValue };
    }),
    skippedSelect.map(function (s) { return { name: s.name, reason: s.reason }; })
  );

  return {
    filled: filled,
    skipped: skippedAll,
    skippedEmpty: skippedEmpty,
    skippedExisting: skippedExisting,
    skippedSelect: skippedSelect,
    unmatched: unmatched,
  };
}

/**
 * Optional enrichment for full scans (not used on lean auto-scan path).
 * @param {Array} fields
 * @param {Record<string,string>} fieldMap
 * @returns {Array}
 */
function enrichFieldsWithMapping(fields, fieldMap) {
  warmSynonymCaches();
  precomputeFieldMatchMeta(fields);
  var crmKeys = Object.keys(fieldMap);
  return fields.map(function (field) {
    var enriched = Object.assign({}, field);
    delete enriched.element;

    var identifier = field._identifier || getFieldIdentifier(field);
    var terminalToken = field._terminalToken != null
      ? field._terminalToken
      : getTerminalToken(field.name);
    var sectionKind = field._sectionKind != null
      ? field._sectionKind
      : getSectionKind(field);
    var bestScore = 0;
    var bestKey = null;

    for (var k = 0; k < crmKeys.length; k++) {
      var score = matchScore(
        crmKeys[k],
        identifier,
        field.autocomplete,
        terminalToken,
        sectionKind
      );
      if (score > bestScore) {
        bestScore = score;
        bestKey = crmKeys[k];
      }
    }

    enriched.suggestedCrmKey = bestKey;
    enriched.confidence = bestScore;
    enriched.matchReason = bestKey && bestScore >= 50
      ? "Score " + bestScore + " (best match)"
      : (bestKey ? "Score " + bestScore + " (below threshold)" : "No match");

    return enriched;
  });
}

// ─── Message handler ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // Async path for autofill (Lightning option wait)
  if (message && message.action === "autofill") {
    (async function () {
      try {
        var fields = scanFormFields({ mode: "fill" });
        var result = await autofillPage(message.fieldMap || {}, fields);
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: err.message || String(err) });
      }
    })();
    return true;
  }

  try {
    switch (message.action) {
      case "ping": {
        sendResponse({ pong: true, version: "2.3.8" });
        break;
      }

      case "scan": {
        var lean = !!(message.lean || message.mode === "lean");
        // Never run expensive fieldMap enrichment on lean auto-scan
        var scanned = scanFormFields(lean ? { lean: true } : { mode: "full" });
        var fieldCount = scanned.length;
        var descriptors = scanned.map(function (f) {
          var d = Object.assign({}, f);
          delete d.element;
          return d;
        });

        if (!lean && message.fieldMap && typeof message.fieldMap === "object") {
          descriptors = enrichFieldsWithMapping(scanned, message.fieldMap);
        }

        // Lean: still return thin descriptors for count + optional UI; no enrichment
        sendResponse({ fields: descriptors, fieldCount: fieldCount });
        break;
      }

      default:
        sendResponse({ error: "Unknown action: " + (message && message.action) });
    }
  } catch (err) {
    sendResponse({ error: err.message });
  }

  // Keep the message channel open for async response
  return true;
});

} // end __SAMS_PORTAL_AUTOFILL_LOADED__ guard
