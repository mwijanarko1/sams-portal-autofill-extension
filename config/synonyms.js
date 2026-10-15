/* Shared matching configuration. Loaded before the engine. */
if (!globalThis.SAMS_SYNONYMS) {
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
  gender: [
    "gender", "sex", "gender identity", "legal gender",
    // Ulster University QA (apply.qahighereducation.com) live label / API name
    "sex identifier", "sex_identifier", "sexidentifier",
  ],
  maritalStatus: ["marital status", "marriage status", "civil status"],
  nationality: [
    "nationality", "citizenship", "country of citizenship",
    "country of origin", "country of nationality",
    "nationality / citizenship", "passport nationality",
  ],
  // Ulster QA Personal Details (live audit 2026-07-31)
  ethnicity: [
    "ethnicity", "ethnic origin", "ethnic background",
    "ethnic group", "ethnicity / ethnic origin",
  ],
  dependants: [
    "dependants", "dependents", "number of dependants",
    "do you have dependants", "dependent children",
  ],
  currentDomicile: [
    "current domicile", "domicile", "country of domicile",
    "permanent domicile", "current_domicile",
  ],
  previouslyApplied: [
    "previously applied", "have you previously applied",
    "previously applied for or enrolled",
    "applied for or enrolled onto a course with ulster",
    "qahe partner", "previous application",
  ],
  previousName: [
    "previously been known by any other name",
    "known by any other name", "previous name",
    "other name", "former name", "alias",
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
    // Ulster QA: national number fields (country code is separate combobox)
    // exact "phone" / "mobile" labels handled carefully in matchScore
  ],
  email: [
    "email address", "e-mail address", "email", "e-mail",
    "contact email", "primary email", "applicant email",
    "student email",
  ],
  funding: [
    // Main funding combobox only, NOT "Other funding source" free-text
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
    // Ulster QA live radio group (ego-browser 2026-07-31)
    "fee payment method", "fee_payment_method", "feepaymentmethod",
  ],
  phoneCountryCode: [
    "phone country code", "mobile country code",
    "telephone country code", "country code phone",
    "dialling code", "dialing code", "intl dial code",
  ],
    // Only used when funding type is Other, leave empty for Self-Funding demos
  otherFundingSource: [
    "other funding source",
    "otherfundingsource",
    "otherfundingsource__c",
    "other source of funding",
    "please specify funding",
  ],
  // ── Sunderland / Salesforce-specific helpers ──────────────────────
  title: [
    // Do NOT use bare "title", it steals Employment "Job Title" (fills "Mr").
    // Exact label "Title" is handled via matchScore special-case below.
    "title/salutation", "salutation", "honorific",
    "mr/mrs", "name title", "title mr", "title mrs", "title miss",
    "applicant title", "personal title",
  ],
  highestQualification: [
    // Step 1 "Your details" only, do NOT include bare "qualification level"
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
    "emergency contact full name", "nominated contact name",
  ],
  // Ulster QA NEW NOMINATED CONTACT modal (live 2026-07-31): First + Last, not full name
  emergencyFirstName: [
    "new contact first name", "new_contact_first_name",
    "emergency first name", "nominated first name",
    "contact first name", "emergency contact first name",
  ],
  emergencyLastName: [
    "new contact last name", "new_contact_last_name",
    "emergency last name", "nominated last name",
    "contact last name", "emergency contact last name",
  ],
  emergencyPhone: [
    "emergency phone", "emergency contact phone", "emergency telephone",
    "emergency contact number", "next of kin telephone",
    "nominated phone", "nominated contact phone",
  ],
  // Ulster modal label is "Phone Country Dialing Code" (not main "Phone Country Code")
  emergencyPhoneCountryCode: [
    "phone country dialing code", "country dialing code",
    "emergency phone country code", "nominated phone country code",
    "emergency dialing code", "phone country dialling code",
    "country dialling code",
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
    // Ulster QA NEW EDUCATION HISTORY
    "education institution", "education institution name",
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
    // avoid bare "education level" / "study level", those collide with other fields
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
    // Prefer specific phrases, bare "class"/"result" over-match other fields
    "grade", "degree class", "degree classification",
    "classification", "final grade", "overall grade",
    "award class", "honours class", "honors class",
    "overall classification", "class of degree",
  ],
  awardStatus: [
    "award status", "status of award", "completion status",
    "qualification status", "degree status", "awarded",
    "completed", "result status",
    // Ulster Results radios: Completed | In Progress
    "results", "picklist results",
  ],
  studyCountry: [
    "country you studied in", "country of study",
    "study country", "country of education",
    "country studied", "studied in",
    // Ulster education modal: bare *Country (picklist_Country)
    "picklist country", "education country",
  ],
  studyDates: [
    "study dates", "study period", "dates of attendance",
    "education dates", "attendance dates", "study timeline",
    "date range",
  ],
  startDate: [
    "start date", "from date", "begin date",
    "commencement date", "enrollment date", "enrolment date",
    "date from", "month year from", "from month year",
    "start month year", "date started", "study from month year",
    // avoid bare "start", steals unrelated fields
  ],
  endDate: [
    "end date", "to date", "completion date",
    "finish date", "date ended", "date to", "graduation date",
    "month year to", "to month year", "end month year",
    "date finished", "study to month year",
  ],
  // Ulster QA year-only picklists (not full dates)
  studyStartYear: [
    "start year", "study start year", "education start year",
    "year started", "year from", "pickist start year", "picklist start year",
    "academic start year",
  ],
  studyEndYear: [
    "end year", "study end year", "education end year",
    "year ended", "year to", "picklist end year",
    "predicted end year", "end year or predicted",
    "end year (or predicted end year if in progress)",
    "academic end year",
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
    // Prefer exact Sunderland label / API name, avoid bare "english" / "experience"
    // (those steal Job Title history "experience" or nationality autocomplete language)
    "other english language experience",
    "otherenglishlanguageexperience",
    "otherenglishlanguageexperience__c",
    "other english language evidence",
    "english language evidence",
    "english proficiency details",
  ],
  // ── Passport / Identity ───────────────────────────────────────────
  passportNumber: [
    "passport number", "passport no", "passport",
    // Ulster QA / Salesforce identity docs often label passport as Document Number
    "document number", "document no", "document #",
    "passport document number", "identity document number",
  ],
  passportIssueDate: [
    "passport issue date", "date of issue", "issue date",
    "document issue date", "date of issue of document",
  ],
  passportExpiryDate: [
    "passport expiry date", "expiry date", "date of expiry",
    "expiration date", "passport expiration",
    "document expiry date", "document expiry", "date of expiry of document",
  ],
  issuingAuthority: [
    "issuing authority", "issued by",
    "document issuing authority", "passport issuing authority",
  ],
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
  // Ulster QA NEW EMPLOYMENT HISTORY: *Employment Occupation (SOC combobox)
  occupation: [
    "employment occupation", "occupation", "job occupation",
    "occupational title", "soc occupation", "occupation title",
  ],
  cvCurrentEmployer: [
    "current employer", "employer", "company name",
    "organization", "company", "employer name",
    // Sunderland employment "Organisation" (employer)
    "organisation", "employing organisation", "employer organisation",
    "organisation__c", "workplace", "place of work",
    // Ulster Add New modal
    "new company name", "new_company_name",
  ],
    // Ulster optional: Employer's Name (contact person, not company)
  employerContactName: [
    "employer s name", "employers name", "employer's name",
    "new employer", "new_employer", "employer contact name",
    "manager name", "line manager",
  ],
  employerContactEmail: [
    "employer s email", "employers email", "employer's email",
    "employer email", "text employer email", "text_employer_email",
  ],
  employerContactPhone: [
    "employer s phone", "employers phone", "employer's phone number",
    "employer phone", "employer telephone", "employer contact phone",
  ],
  employmentCountry: [
    "employment country", "country of employment",
    "work country", "country of work", "employer country",
  ],
  cvWorkStartDate: [
    "work start date", "employment start date", "job start date",
    "started work", "employment from", "work from",
    "month year from", "from month year",
    "new start date", "new_start_date",
  ],
  cvWorkEndDate: [
    "work end date", "employment end date", "job end date",
    "ended work", "employment to", "work to",
    "month year to", "to month year",
    "new end date", "new_end_date",
  ],
  presentEmployment: [
    "present employment", "current employment", "currently employed",
    "still employed", "i currently work here", "present",
    "present__c",
    // Ulster checkbox
    "this is my current employment", "new this is my current employment",
  ],
  // Ulster *My Job Description (textarea)
  cvJobDescription: [
    "my job description", "job description", "role description",
    "position description", "description of role", "job duties summary",
  ],
    // Ulster *My Main Responsibilities (textarea), separate from job description
  mainResponsibilities: [
    "my main responsibilities", "main responsibilities",
    "key responsibilities", "main duties", "job responsibilities",
    "principal responsibilities", "responsibilities",
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
    // Avoid bare "programme"/"program"/"course", steals funding question
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
  // Ulster QA Personal Statement free text
  personalStatement: [
    "personal statement", "statement of purpose", "sop",
    "supporting statement", "motivation letter",
  ],
    // Ulster QA NEW NOMINATED CONTACT (Add New modal), live 2026-07-31
  emergencyRelationship: [
    "relationship to you", "relationship to you?",
    "new relationship to you", "new_relationship_to_you",
    "relationship", "relationship to applicant",
    "emergency relationship", "contact relationship",
    "nominated relationship",
  ],
  emergencyEmail: [
    "new text contact email", "new_text_contact_email",
    "emergency email", "emergency contact email",
    "next of kin email", "nominated contact email",
    "nominated email", "contact email emergency",
  ],
  // Required on Ulster nominated modal (label *Date of Birth, API New_u18_Date_of_Birth)
  emergencyDateOfBirth: [
    "new u18 date of birth", "new_u18_date_of_birth",
    "emergency date of birth", "nominated date of birth",
    "contact date of birth", "emergency contact date of birth",
  ],
  emergencySpecialInstructions: [
    "special instructions", "special_instructions",
    "emergency special instructions", "nominated special instructions",
  ],
};

// ─── Autocomplete attribute → CRM key mapping ─────────────────────────
// HTML autocomplete purposes that mean exactly one applicant CRM value. Purposes that are
// only part of a value (address-line2, bday-day, tel-extension), describe another person
// (cc-name), or mean a different value (name, nickname, organization) are left out.

const AUTOCOMPLETE_KEY_MAP = {
  "honorific-prefix": "title",
  "given-name": "givenName",
  "additional-name": "middleName",
  "family-name": "familyName",
  "bday": "dateOfBirth",
  "sex": "gender",
  "email": "email",
  "tel": "phone",
  "street-address": "location",
  "address-line1": "location",
  "address-level2": "city",
  "address-level1": "state",
  "postal-code": "postcode",
  "country": "countryName",
  "country-name": "countryName",
};

// Every autocomplete field purpose in the HTML standard. A recognised purpose missing from the
// map above keeps the control manual: its label cannot override what the page declared.
const AUTOCOMPLETE_PURPOSES = new Set([
  "name", "honorific-prefix", "given-name", "additional-name", "family-name", "honorific-suffix",
  "nickname", "username", "new-password", "current-password", "one-time-code", "organization-title",
  "organization", "street-address", "address-line1", "address-line2", "address-line3",
  "address-level4", "address-level3", "address-level2", "address-level1", "country", "country-name",
  "postal-code", "cc-name", "cc-given-name", "cc-additional-name", "cc-family-name", "cc-number",
  "cc-exp", "cc-exp-month", "cc-exp-year", "cc-csc", "cc-type", "transaction-currency",
  "transaction-amount", "language", "bday", "bday-day", "bday-month", "bday-year", "sex", "url",
  "photo", "tel", "tel-country-code", "tel-national", "tel-area-code", "tel-local",
  "tel-local-prefix", "tel-local-suffix", "tel-extension", "email", "impp",
]);

// ─── Generic matching for portals without a saved mapping ─────────────
// Labels, names and ids are compared as whole lowercase words after punctuation and
// bracketed hints are removed ("Middle name(s) *" is "middle name"). Only these exact
// phrases count. Controls lists the control kinds each value may be written into.

const GENERIC_FIELDS = {
  title: { aliases: ["title", "salutation", "honorific", "title salutation"], controls: ["select"] },
  givenName: {
    aliases: ["first name", "firstname", "fname", "given name", "given names", "givenname", "forename", "forenames", "legal first name"],
    controls: ["text"],
  },
  middleName: { aliases: ["middle name", "middle names", "middlename"], controls: ["text"] },
  familyName: {
    aliases: ["last name", "lastname", "lname", "surname", "family name", "familyname", "family name surname", "surname family name", "legal last name"],
    controls: ["text"],
  },
  dateOfBirth: { aliases: ["date of birth", "dob", "birth date", "birthdate", "dateofbirth"], controls: ["text", "date"] },
  gender: { aliases: ["gender", "sex", "legal sex"], controls: ["select", "text"] },
  nationality: { aliases: ["nationality", "citizenship", "country of citizenship", "country of nationality"], controls: ["select", "text"] },
  email: { aliases: ["email", "email address", "e mail", "e mail address", "emailaddress"], controls: ["text"] },
  phone: {
    aliases: ["phone", "phone number", "phonenumber", "telephone", "telephone number", "mobile", "mobile number",
      "mobile phone", "mobile phone number", "mobile telephone", "mobile telephone number", "contact number"],
    controls: ["text"],
  },
  location: { aliases: ["address", "address line 1", "address 1", "street address", "home address"], controls: ["text"] },
  city: { aliases: ["city", "town", "town city", "city town", "town or city", "postal town"], controls: ["text"] },
  state: { aliases: ["county", "state", "province", "region", "county state", "state province"], controls: ["select", "text"] },
  postcode: {
    aliases: ["postcode", "post code", "postal code", "zip", "zip code", "zipcode", "postcode zip", "zip postcode", "zip postal code"],
    controls: ["text"],
  },
  countryName: { aliases: ["country", "country of residence", "home country"], controls: ["select", "text"] },
  passportNumber: { aliases: ["passport number", "passport no", "passport"], controls: ["text"] },
};

// Words that put a control outside the applicant's own details. FIELD is checked against the
// control's own label, name, id, placeholder, description and autocomplete; SECTION against its
// enclosing legends, outline headings and embedding frame titles; FORM against form-level
// auth/recovery semantics (aria-label, action, instructions, submit labels). Form OWN metadata
// (aria-label, aria-labelledby, title, name, id) is also checked with SECTION for third-party
// purpose without scanning unrelated inner section text.
const GENERIC_BLOCKED = {
  field: /\b(password|passcode|passphrase|pin|otp|one time|verification|security|username|user name|user id|login|log in|logon|sign in|signin|sign up|signup|register|registration|account|recovery|captcha|memorable|secret|card|credit|debit|cvv|cvc|iban|swift|bic|sort code|bank|billing|shipping|payment|cardholder|expiry|expiration|declare|declaration|consent|agree|agreement|signature|sign|terms|privacy|confirm|accept|authori[sz]e|acknowledge|referee|reference|recommender|employer|employment|emergency|next of kin|kin|guardian|parent|sponsor|agent|agency|counsell?or|advis[eo]r|nominated|spouse|partner|mother|father)\b/,
  section: /\b(sign in|log in|login|sign up|create an account|create account|register|registration|password|payment|billing|bank|card details|declaration|consent|signature|terms|privacy|referee|referees|reference|references|recommender|employer|employment|work experience|work history|emergency|next of kin|guardian|parent|sponsor|agent details|agent contact|agent information|agency|representative|education|qualification|qualifications|academic history|academic background|nominated|spouse|partner|dependants?|children)\b/,
  form: /\b(reset password|password reset|forgot password|recover(?:y|ing)?|send reset|sign in|log in|login|create an account|create account|register|registration|one time|otp|verification code)\b/,
};

// Exact normalized select aliases only (never fuzzy/substring). Each inner list is one meaning.
const GENERIC_SELECT_EQUIV = {
  gender: [
    ["female", "f", "woman", "girl"],
    ["male", "m", "man", "boy"],
    // Exact Other only. Non-binary hyphen/spacing is lexical, not categorical. X stays distinct.
    ["other"],
    ["non binary", "nonbinary"],
    ["x"],
    ["prefer not to say", "information refused", "undisclosed"],
  ],
  title: [
    ["ms", "ms."],
    ["mr", "mr."],
    ["mrs", "mrs."],
    ["miss"],
    ["dr", "dr."],
    ["mx"],
  ],
  countryName: [
    ["united kingdom", "uk", "great britain", "britain"],
    ["united states", "usa", "us", "united states of america"],
    ["united arab emirates", "uae"],
  ],
};

globalThis.SAMS_SYNONYMS = {
  STOPWORDS, SYNONYM_MAP, AUTOCOMPLETE_KEY_MAP, AUTOCOMPLETE_PURPOSES,
  GENERIC_FIELDS, GENERIC_BLOCKED, GENERIC_SELECT_EQUIV,
};
}
