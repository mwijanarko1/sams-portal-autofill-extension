if (!globalThis.__SAMS_CRM_READER_LOADED__) {
  globalThis.__SAMS_CRM_READER_LOADED__ = true;

  const normalizeLabel = (value) => String(value || "")
    .toLowerCase()
    .replace(/[\s_*:]+/g, " ")
    .trim();

  function visible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function pickVisible(selector, root = document) {
    return Array.from(root.querySelectorAll(selector)).find((element) => visible(element)) || null;
  }

  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function labelTextWithoutControl(label, control) {
    return Array.from(label.childNodes)
      .filter((node) => node !== control && !(node.contains && node.contains(control)))
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(" ");
  }

  // A radio's own label is its option text; the field label is a sibling label before the choice container.
  function radioGroupLabel(element) {
    const choices = (element.closest("label") || element).parentElement;
    for (let sibling = choices?.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.tagName === "LABEL" && !sibling.querySelector("input")) return sibling.textContent;
    }
    return "";
  }

  function labelFor(element) {
    if (element.type === "radio") {
      const group = radioGroupLabel(element);
      if (group) return group;
    }
    if (element.labels && element.labels[0]) return labelTextWithoutControl(element.labels[0], element);
    const aria = element.getAttribute("aria-label");
    if (aria) return aria;
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) return labelTextWithoutControl(label, element);
    }
    const wrapper = element.closest("label");
    if (wrapper) return labelTextWithoutControl(wrapper, element);
    const groupLabel = element.closest(".form-group")?.querySelector("label");
    if (groupLabel) return labelTextWithoutControl(groupLabel, element);
    return element.name || element.id || "";
  }

  function controlValue(element) {
    if (element.tagName !== "SELECT") return element.value;
    const text = element.selectedOptions[0]?.textContent.trim() || "";
    return /^(choose|select)\b|^(year|month)$/i.test(text) ? "" : text;
  }

  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function isoDate(text) {
    const match = String(text || "").match(/\b(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})\b/);
    const month = match ? MONTHS.indexOf(match[2].toLowerCase()) : -1;
    return month < 0 ? "" : `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }

  function setField(fields, key, rawValue) {
    const value = String(rawValue || "").replace(/\s+/g, " ").trim().replace(/\s+\([A-Z]{3}\)$/, "");
    if (/^(choose one|select\b)/i.test(value)) return;
    // CRM empty states: N/A, a dash, or "No X Found." / "No X available."
    if (/^(n\/a|not applicable|-|\u2014)$/i.test(value)) return;
    if (/^no\s.+?\s(found|available)\.?$/i.test(value)) return;
    if (key && value && !fields[key]) fields[key] = /date/i.test(key) && !/Dates$/.test(key) ? isoDate(value) || value : value;
  }

  function contextFor(element) {
    let node = element.parentElement;
    for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
      const heading = node.querySelector(":scope > h2, :scope > h3");
      if (heading) return normalizeLabel(heading.textContent);
      const emergencyHeading = Array.from(node.children || [])
        .find((child) => normalizeLabel(child.textContent) === "emergency contact");
      if (emergencyHeading) return "emergency contact";
    }
    return "";
  }

  function addField(fields, rawLabel, rawValue, context = "") {
    const label = normalizeLabel(rawLabel);
    const value = String(rawValue || "").trim();
    if (!label || !value || value === "\u2014") return;
    const baseLabel = label.replace(/\s+\d+$/, "");
    const emergencyKeys = {
      name: "emergencyName",
      relationship: "emergencyRelationship",
      phone: "emergencyPhone",
      email: "emergencyEmail",
    };
    const key = context.includes("emergency contact")
      ? emergencyKeys[label] || emergencyKeys[baseLabel] || SAMS_CRM_SOURCE.labels[label] || SAMS_CRM_SOURCE.labels[baseLabel]
      : SAMS_CRM_SOURCE.labels[label] || SAMS_CRM_SOURCE.labels[baseLabel];
    setField(fields, key, value);
  }

  function profileGuard() {
    if (!SAMS_ALLOWLIST.isCrmOrigin(location.origin)) {
      throw new Error("Copy is only available on an approved CRM origin.");
    }
    const pathMatches = SAMS_CRM_SOURCE.profilePathPatterns.some((pattern) => pattern.test(location.pathname));
    const pageText = normalizeLabel(document.body.innerText.slice(0, 12000));
    const markerMatches = SAMS_CRM_SOURCE.profileMarkers.some((marker) => pageText.includes(marker));
    if (!pathMatches || !markerMatches) {
      throw new Error("Open an individual student profile page before copying.");
    }
  }

  // ─── Tab handling ────────────────────────────────────────────────────
  // An individual lead profile is a tabbed page: "Applications" holds the
  // editable stage forms, "Profile" holds the read-only summary. Staff copy
  // from either, so the reader opens both and restores the tab they were on.

  const tabContent = () => Array.from(document.querySelectorAll(".tab_content_components")).find(visible)
    || document.querySelector(".tab_content_components");

  function hasSectionTitle(name) {
    return Array.from(tabContent()?.querySelectorAll(".main_title") || [])
      .some((title) => normalizeLabel(title.textContent) === name);
  }

  function tabElement(name) {
    const wanted = normalizeLabel(name);
    return Array.from(document.querySelectorAll(".nav-link"))
      .find((element) => normalizeLabel(element.innerText) === wanted) || null;
  }

  function activeTabName() {
    const active = Array.from(document.querySelectorAll(".nav-link"))
      .find((element) => element.classList.contains("active"));
    return active ? normalizeLabel(active.innerText) : "";
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(predicate, timeout = 6000) {
    for (let elapsed = 0; elapsed < timeout; elapsed += 150) {
      if (predicate()) return true;
      await sleep(150);
    }
    return predicate();
  }

  async function ensureTab(name, ready) {
    const tab = tabElement(name);
    if (!tab) return false;
    if (tab.classList.contains("active")) return true;
    tab.click();
    if (ready) return waitFor(ready, 6000);
    return waitFor(() => tabElement(name)?.classList.contains("active"), 5000);
  }

  // Section tables arrive after the Profile tab first paints its empty states.
  // A MutationObserver detects the section request's render (including equal-length
  // replacements and staggered updates) without assuming a fixed load time.
  async function waitForDomSettled(root, timeout = 10000, quiet = 700, minElapsed = 400) {
    if (!root) return false;
    const started = Date.now();
    let lastChange = started;
    const observer = new MutationObserver(() => { lastChange = Date.now(); });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    try {
      while (Date.now() - started < timeout) {
        await sleep(100);
        const now = Date.now();
        if (now - started >= minElapsed && now - lastChange >= quiet) return true;
      }
      return false;
    } finally {
      observer.disconnect();
    }
  }

  // The CRM covers the profile with its own .waitMe overlay while the section
  // request runs. That overlay is the reliable completion signal; the mutation
  // settle is the fallback for cached responses and layouts without it.
  // The popup installs a MAIN-world tracker and bridges its state through
  // data attributes; the isolated reader cannot observe page-owned requests.
  function profileRequestState() {
    const root = document.documentElement;
    return {
      pending: Number(root.dataset.samsProfilePending || 0),
      seen: Number(root.dataset.samsProfileSeen || 0),
    };
  }

  async function waitForProfileReady(root, timeout = 15000) {
    const overlay = () => pickVisible(".waitMe");
    // The overlay normally appears immediately after the tab click, but a slow
    // CRM can mount it later. Watch for it for a short grace period first.
    const started = Date.now();
    let sawOverlay = false;
    while (Date.now() - started < 4000) {
      if (overlay()) { sawOverlay = true; break; }
      await sleep(100);
    }
    if (sawOverlay) {
      if (!await waitFor(() => !overlay(), timeout)) return false;
      await sleep(300);
      return waitForDomSettled(root, 5000, 500, 0);
    }
    return waitForDomSettled(root, timeout, 700, 1200);
  }

  // ─── Applications tab: expanded stage forms and list entries ─────────

  // Expanded CRM sections list saved records as .single_part entries; the first entry is copied.
  function readListEntries(panel, fields) {
    const heading = normalizeLabel(panel.querySelector(".title_in_border, .title_in_borders")?.textContent);
    const entry = Array.from(panel.querySelectorAll(".single_part")).find(visible);
    if (!entry) return;
    const title = Array.from(entry.querySelectorAll(".progress-lbl")).find(visible)?.textContent;
    const spans = Array.from(entry.querySelectorAll("span")).filter(visible)
      .map((span) => span.textContent.replace(/\s+/g, " ").trim()).filter(Boolean);
    const dayRange = spans.map((text) => text.match(/(\d{1,2} [A-Za-z]{3} \d{4})\s+-\s+(\d{1,2} [A-Za-z]{3} \d{4})/)).find(Boolean);
    if (heading.includes("education")) {
      setField(fields, "institutionName", title);
      const months = spans.map((text) => text.match(/([A-Za-z]+ \d{4})\s+-\s+([A-Za-z]+ \d{4})/)).find(Boolean);
      if (months) {
        setField(fields, "studyDates", `${months[1]} - ${months[2]}`);
        setField(fields, "startDate", months[1]);
        setField(fields, "endDate", months[2]);
      }
      const subject = spans.map((text) => text.match(/^(.+?)\s*\(([^()]+)\)$/)).find(Boolean);
      if (subject) {
        setField(fields, "major", subject[1]);
        setField(fields, "grade", subject[2]);
      }
      const badges = Array.from(entry.querySelectorAll(".label_badge_light")).map((badge) => badge.textContent.replace(/\s+/g, " ").trim());
      setField(fields, "graduationYear", badges.map((text) => text.match(/passing year\s*-\s*(\d{4})/i)?.[1]).find(Boolean));
      setField(fields, "degree", badges.find((text) => !/passing year/i.test(text)));
    } else if (heading.includes("passport")) {
      setField(fields, "passportNumber", title);
      if (dayRange) {
        setField(fields, "passportIssueDate", dayRange[1]);
        setField(fields, "passportExpiryDate", dayRange[2]);
      }
    } else if (heading.includes("test score")) {
      setField(fields, "englishTestName", title?.match(/\(([^()]+)\)\s*$/)?.[1] || title);
      setField(fields, "testDate", spans.map((text) => text.match(/test date\s*(.+)$/i)?.[1]).find(Boolean));
      entry.querySelectorAll(".col").forEach((column) => {
        const [label, score] = column.innerText.split("\n").map((part) => part.trim()).filter(Boolean);
        addField(fields, normalizeLabel(label) === "overall" ? "overall score" : label, score);
      });
    } else if (heading.includes("work")) {
      setField(fields, "cvCurrentEmployer", title);
      if (dayRange) {
        setField(fields, "cvWorkStartDate", dayRange[1]);
        setField(fields, "cvWorkEndDate", dayRange[2]);
      }
      setField(fields, "cvCurrentJobTitle", spans.filter((text) => text !== title?.trim() && !/\d{4}|\byears?\b|\bmonths?\b/.test(text)).pop());
    }
  }

  async function settlePanel(panel) {
    // Dropdown options and selected values arrive after the panel first renders.
    const snapshot = () => panel.innerHTML + Array.from(panel.querySelectorAll("select")).map((select) => select.selectedIndex).join();
    for (let settled = 0, last = snapshot(), elapsed = 0; settled < 500 && elapsed < 3000; elapsed += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const next = snapshot();
      settled = next === last ? settled + 100 : 0;
      last = next;
    }
  }

  // Only the CRM's section toggles are clicked; they render one read-only panel
  // at a time and send no writes. A single overall deadline keeps a slow CRM
  // from multiplying the per-panel waits across nine stages.
  async function readExpandedSections(profileRoot, readPanel) {
    const deadline = Date.now() + 30000;
    const panelSection = (panel) => normalizeLabel(panel?.querySelector(".main_title")?.textContent || "");
    const matches = (panel, section) => {
      const title = panelSection(panel);
      return Boolean(title) && (title.includes(section) || section.includes(title));
    };
    for (const toggle of profileRoot.querySelectorAll("li[class*='btn_collapse_']")) {
      if (Date.now() > deadline) return;
      const section = normalizeLabel(toggle.textContent);
      let panel = document.querySelector(".collapse_common");
      // Some layouts mount a stage (for example Personal Information) before Copy.
      if (panel && visible(panel) && panel.innerText && matches(panel, section)) {
        await settlePanel(panel);
        readPanel(panel, section);
        continue;
      }
      const before = panel?.innerText || "";
      toggle.click();
      let ready = null;
      for (let waited = 0; waited < 2000 && Date.now() < deadline; waited += 100) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        panel = document.querySelector(".collapse_common");
        if (!panel || !visible(panel) || !panel.innerText) continue;
        if (panel.innerText !== before || matches(panel, section)) {
          ready = panel;
          break;
        }
      }
      if (!ready) continue;
      await settlePanel(ready);
      readPanel(ready, section);
    }
  }

  // Some labels mean different things per section: "Study Destination" is the
  // applied-to country in Admission Preference but the studied-in country in
  // Previous Study Abroad, and "Institute Name" there is the target university.
  const ADMISSION_LABEL_KEYS = {
    "study destination": "preferredDestination",
    "institute type": "preferredInstituteType",
    "pathway providers(if any)": "preferredPathway",
    "pathway providers": "preferredPathway",
    "institute name": "preferredUniversity",
    level: "preferredLevel",
    "course title": "preferredCourse",
    "preferred department": "preferredDepartment",
    "start year": "preferredStartYear",
    "start month": "preferredStartMonth",
    "enrollment priority": "preferredPriority",
  };
  const PREVIOUS_STUDY_LABEL_KEYS = {
    "study destination": "previousStudyDestination",
    "visa type": "previousStudyVisaType",
  };
  const REFERENCE_LABEL_KEYS = {
    name: "referenceName",
    "reference source": "referenceSource",
    phone: "referencePhone",
    email: "referenceEmail",
  };
  const VISA_LABEL_KEYS = {
    "visa type": "visaType",
    country: "visaCountry",
    purpose: "visaPurpose",
    "applied country": "visaRefusalCountry",
    "refusal reason": "refusalReason",
  };
  const VISA_REFUSAL_LABEL_KEYS = {
    "visa type": "visaRefusalType",
    country: "visaRefusalCountry",
    purpose: "visaRefusalPurpose",
    duration: "visaRefusalDates",
    "applied country": "visaRefusalCountry",
    "refusal reason": "refusalReason",
  };

  function sectionLabelKeys(section) {
    if (section.includes("admission preference")) return ADMISSION_LABEL_KEYS;
    if (section.includes("previous study")) return PREVIOUS_STUDY_LABEL_KEYS;
    if (section.includes("reference")) return REFERENCE_LABEL_KEYS;
    if (section.includes("visa refusal")) return VISA_REFUSAL_LABEL_KEYS;
    if (section.includes("visa")) return VISA_LABEL_KEYS;
    return null;
  }

  // Read only rendered forms, each with its own section context. A page-wide
  // scan would re-read an Admission Preference "Institute Name" as the education
  // institution and a referee "Phone" as the applicant's phone.
  function readVisibleForms(root, fields) {
    Array.from(root.querySelectorAll("form")).forEach((form) => {
      if (!visible(form)) return;
      const section = normalizeLabel(
        form.querySelector(".main_title")?.textContent
        || form.closest(".collapse_common")?.querySelector(".main_title")?.textContent
        || form.closest(".tab_content_components")?.querySelector(".main_title")?.textContent
        || ""
      );
      collectFields(form, fields, section);
    });
  }

  function addSectionField(fields, sectionKeys, rawLabel, rawValue, context) {
    const override = sectionKeys?.[normalizeLabel(rawLabel)];
    if (override) setField(fields, override, rawValue);
    else addField(fields, rawLabel, rawValue, context);
  }

  function collectFields(profileRoot, fields, section = "", options = {}) {
    const sectionKeys = sectionLabelKeys(section);
    profileRoot.querySelectorAll("input:not([type=password]):not([type=hidden]), select:not(.select_unit), textarea").forEach((element) => {
      // Checked checkboxes only carry UI state ("on"), never a CRM value.
      if (element.type === "checkbox") return;
      if (options.skipForms && element.closest("form")) return;
      if (options.skipContainers && element.closest(".collapse_common, .tab_content_components")) return;
      // A native Select2 control is an accessibility proxy: never read it
      // directly, only through its visible rendered widget.
      const select2 = element.classList.contains("select2-hidden-accessible");
      const select2Widget = element.closest(".form-group")?.querySelector(".select2-container, .select2-selection");
      const shown = select2 ? Boolean(select2Widget) && visible(select2Widget) : visible(element);
      if (!shown || (element.type === "radio" && !element.checked)) return;
      const label = labelFor(element);
      const override = sectionKeys?.[normalizeLabel(label)];
      const key = override || (SAMS_CRM_SOURCE.labels[normalizeLabel(label)] || SAMS_CRM_SOURCE.labels[normalizeLabel(label).replace(/\s+\d+$/, "")]);
      // A dial-code select sits beside the number input; join the digits instead
      // of copying "Algeria +213" as the whole phone number.
      if (element.tagName === "SELECT" && (key === "phone" || key === "emergencyPhone")) {
        const code = String(controlValue(element)).match(/\+\d+/)?.[0] || "";
        const row = element.closest(".row, .form-row");
        const number = clean(row?.querySelector('input[type="text"], input[type="tel"]')?.value);
        if (code && number) setField(fields, key, `${code} ${number}`);
        return;
      }
      if (override) setField(fields, override, controlValue(element));
      else addField(fields, label, controlValue(element), contextFor(element));
    });
    // Empty CRM sections render a .text-danger placeholder value such as "No Present Address Found."
    const isEmptyState = (element) => element.classList.contains("text-danger");
    // SAMS CRM puts the label in <dd> and the value in <dt>; whichever tag leads its parent is the label.
    profileRoot.querySelectorAll("dt, dd").forEach((label) => {
      const labelTag = label.parentElement.querySelector(":scope > dt, :scope > dd").tagName;
      const value = label.nextElementSibling;
      if (label.tagName !== labelTag || !value || !["DT", "DD"].includes(value.tagName) || value.tagName === labelTag) return;
      if (!visible(label) || !visible(value)) return;
      if (options.skipForms && label.closest("form")) return;
      if (options.skipContainers && label.closest(".collapse_common, .tab_content_components")) return;
      if (!isEmptyState(value)) addSectionField(fields, sectionKeys, label.textContent, value.textContent, contextFor(label));
    });
    // Label/value table rows. Table headers are never values: skipping <thead> stops
    // "Institution | Subject" being read as institutionName="Subject".
    profileRoot.querySelectorAll("table tr").forEach((row) => {
      if (row.closest("thead") || !visible(row)) return;
      if (options.skipForms && row.closest("form")) return;
      if (options.skipContainers && row.closest(".collapse_common, .tab_content_components")) return;
      const cells = Array.from(row.querySelectorAll(":scope > th, :scope > td"));
      if (cells.length < 2) return;
      if (cells.every((cell) => cell.tagName === "TH")) return;
      if (!visible(cells[0]) || !visible(cells[1])) return;
      addSectionField(fields, sectionKeys, cells[0].innerText, cells[1].innerText, contextFor(row));
    });
    const contactSections = Array.from(profileRoot.querySelectorAll("section, article, [role='region']"))
      .filter((section) => visible(section)
        && (!options.skipContainers || !section.closest(".collapse_common, .tab_content_components"))
        && Array.from(section.querySelectorAll("h2, h3, strong"))
          .some((heading) => normalizeLabel(heading.textContent).includes("contact information")));
    contactSections.forEach((section) => {
      const emergencyHeading = Array.from(section.querySelectorAll("h2, h3, div, span"))
        .find((element) => normalizeLabel(element.textContent) === "emergency contact");
      if (emergencyHeading) {
        const identity = Array.from(emergencyHeading.parentElement.querySelectorAll("div"))
          .map((row) => Array.from(row.querySelectorAll(":scope > span")))
          .find((spans) => spans.length === 2);
        if (identity) {
          addField(fields, "Name", identity[0].textContent, "emergency contact");
          addField(fields, "Relationship", identity[1].textContent, "emergency contact");
        }
      }
      section.querySelectorAll("span, li, div, dt:not(.text-danger)").forEach((element) => {
        if (!visible(element)) return;
        const text = String(element.innerText || element.textContent || "").trim();
        const children = Array.from(element.children || []);
        const isLabelValuePair = children.length === 2 && children.every((child) => child.textContent.trim());
        if (!text || isLabelValuePair || children.some((child) => (
          ["DIV", "LI", "SPAN"].includes(child.tagName) && child.textContent.trim()
        ))) return;
        const context = contextFor(element);
        const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
        const phone = text.match(/\+\d[\d\s().-]{6,}\d/);
        if (email) addField(fields, "Email", email[0], context);
        if (phone) addField(fields, "Phone", phone[0], context);
        if (context.includes("emergency contact")) {
          const details = text.split(/[\n·]/).map((part) => part.trim()).filter((part) => (
            part && part !== email?.[0] && part !== phone?.[0] && normalizeLabel(part) !== "emergency contact"
          ));
          if (details[0]) addField(fields, "Name", details[0], context);
          if (details[1]) addField(fields, "Relationship", details[1], context);
        }
      });
    });
  }

  // ─── Profile tab: deterministic read of the summary layout ───────────
  // The Profile tab shows one row per section in <table> elements and a left
  // sidebar with dd/dt pairs. Reading it needs no clicking, so it works for
  // direct, sub-agent, converted and dependent leads alike.

  const FLAG_RADIOS = [
    ["s_gap", "hasStudyGap"],
    ["work_ex", "hasWorkExperience"],
    ["radio_ref", "hasReference"],
    ["has_passport", "hasPassport"],
    ["has_visa", "hasVisaHistory"],
    ["Vref", "hasVisaRefusal"],
  ];

  const SECTION_TABLE_KEYS = {
    "education history": {
      institution: "institutionName",
      subject: "major",
      result: "grade",
      duration: "studyDates",
    },
    "study gap": {
      institution: "studyGapInstitution",
      "study gap type": "studyGapType",
      duration: "studyGapDates",
    },
    "previous study abroad": {
      institution: "previousInstitution",
      subject: "previousSubject",
      "country & visa type": "previousStudyCountryVisa",
    },
    "work experience": {
      "company name": "cvCurrentEmployer",
      designation: "cvCurrentJobTitle",
      duration: "cvWorkDates",
    },
    references: {
      name: "referenceName",
      "reference source": "referenceSource",
      phone: "referencePhone",
      email: "referenceEmail",
    },
    "passport details": {
      "passport number": "passportNumber",
      duration: "passportDates",
      comments: "passportPlaceOfIssue",
    },
    "visa history": {
      "visa type": "visaType",
      country: "visaCountry",
      purpose: "visaPurpose",
      duration: "visaDates",
    },
    "visa refusal": {
      "visa type": "visaRefusalType",
      country: "visaRefusalCountry",
      purpose: "visaRefusalPurpose",
      duration: "visaRefusalDates",
    },
  };

  const DATE_RANGE = /([A-Za-z]+ \d{4}|\d{1,2} [A-Za-z]{3} \d{4})\s*-\s*([A-Za-z]+ \d{4}|\d{1,2} [A-Za-z]{3} \d{4})/;

  const RANGE_KEYS = {
    "education history": ["startDate", "endDate"],
    "study gap": ["studyGapStartDate", "studyGapEndDate"],
    "work experience": ["cvWorkStartDate", "cvWorkEndDate"],
    "passport details": ["passportIssueDate", "passportExpiryDate"],
    "visa history": ["visaStartDate", "visaEndDate"],
    "visa refusal": ["visaRefusalStartDate", "visaRefusalEndDate"],
  };

  function setDateRange(fields, sectionName, text) {
    const keys = RANGE_KEYS[sectionName];
    const range = String(text || "").match(DATE_RANGE);
    if (!keys || !range) return;
    setField(fields, keys[0], range[1]);
    setField(fields, keys[1], range[2]);
  }

  function readTestScoreTable(table, fields) {
    // Only the first saved test is the primary one. Scanning every row mixed an
    // IELTS overall score with a following PTE reading score.
    const row = Array.from(table.querySelectorAll("tbody tr"))
      .find((entry) => visible(entry) && entry.querySelector(".test_score_level"));
    if (!row) return false;
    setField(fields, "englishTestName", row.querySelector(".test_score_level")?.textContent);
    setField(fields, "testDate", row.querySelector(".test_date")?.textContent?.replace(/^test date\s*:\s*/i, ""));
    const scoreKeys = {
      overall: "overallScore",
      listening: "listeningScore",
      speaking: "speakingScore",
      writing: "writingScore",
      reading: "readingScore",
    };
    row.querySelectorAll("td").forEach((cell) => {
      if (!visible(cell)) return;
      const lines = String(cell.innerText || "").split("\n").map(clean).filter(Boolean);
      for (let index = 0; index < lines.length - 1; index++) {
        const key = scoreKeys[normalizeLabel(lines[index + 1])];
        if (key) setField(fields, key, lines[index]);
      }
    });
    return true;
  }

  function readProfileTable(table, sectionName, fields) {
    if (!visible(table) || readTestScoreTable(table, fields)) return;
    const headers = Array.from(table.querySelectorAll("thead th")).map((cell) => normalizeLabel(cell.textContent));
    const rows = Array.from(table.querySelectorAll("tbody tr"))
      .filter((row) => visible(row) && row.querySelectorAll(":scope > td").length);
    if (!headers.length) {
      // Headerless summary tables use the same column meanings as the matching
      // section table, plus any section-specific label overrides.
      const pairKeys = { ...(sectionLabelKeys(sectionName) || {}), ...(SECTION_TABLE_KEYS[sectionName] || {}) };
      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll(":scope > td"));
        if (cells.length >= 2 && visible(cells[0]) && visible(cells[1])) {
          addSectionField(fields, pairKeys, cells[0].innerText, cells[1].innerText, sectionName);
        }
      });
      return;
    }
    const row = rows[0];
    if (!row) return;
    const keys = SECTION_TABLE_KEYS[sectionName] || {};
    const cells = Array.from(row.querySelectorAll(":scope > td"));
    headers.forEach((header, index) => {
      const key = keys[header];
      const cell = cells[index];
      if (!key || !cell || !visible(cell)) return;
      const text = clean(cell.innerText);
      if (sectionName === "education history" && header === "institution") {
        const institution = Array.from(cell.querySelectorAll("strong")).find(visible);
        const badge = Array.from(cell.querySelectorAll(".label_badge_light")).find(visible);
        setField(fields, "institutionName", institution?.innerText || text);
        setField(fields, "degree", badge?.innerText);
      } else {
        setField(fields, key, text);
      }
      if (header === "duration") setDateRange(fields, sectionName, text);
    });
  }

  // The Profile sidebar joins the address into one line. Split the city, postcode
  // and country back out so portals with separate controls still fill. Spaced
  // postcodes (SW1A 2AA) are matched as one token; an ambiguous tail is left
  // unsplit so a structured Applications value is not defeated.
  function splitAddress(text, city) {
    const value = clean(text);
    if (!value || !city) return null;
    const index = value.toLowerCase().lastIndexOf(city.toLowerCase());
    if (index <= 0) return null;
    const line = value.slice(0, index).replace(/[,\s]+$/, "").trim();
    const tail = value.slice(index + city.length).trim();
    const uk = tail.match(/^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s+(.+)$/i);
    if (uk) return { line, postcode: uk[1].toUpperCase(), country: uk[2] };
    const ukOnly = tail.match(/^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i);
    if (ukOnly) return { line, postcode: ukOnly[1].toUpperCase(), country: "" };
    // Only accept a postcode-shaped candidate; a word such as "United" is not a
    // postcode and must not turn "United Kingdom" into postcode/country garbage.
    const generic = tail.match(/^(\d{4,6}(?:-\d{4})?)\s+(.+)$/);
    return generic ? { line, postcode: generic[1], country: generic[2] } : null;
  }

  function readSidebar(root, fields) {
    const sidebar = Array.from(root.querySelectorAll(".pro_left_side_part")).find(visible);
    if (!sidebar) return;
    const pick = (selector) => Array.from(sidebar.querySelectorAll(selector)).find(visible) || null;
    sidebar.querySelectorAll(".load_primary_information").forEach((box) => {
      if (!visible(box)) return;
      const children = Array.from(box.children);
      for (let index = 0; index < children.length; index++) {
        const label = children[index];
        const value = children[index + 1];
        if (label.tagName === "DD" && value && value.tagName === "DT" && visible(label) && visible(value)) {
          addField(fields, label.textContent, value.textContent);
        }
      }
    });
    const currentCity = Array.from(root.querySelectorAll("td"))
      .find((cell) => visible(cell) && normalizeLabel(cell.textContent) === "current city");
    const city = clean(currentCity?.nextElementSibling?.textContent);
    const present = pick(".only_present_address_div .hover_for_edit_pre_address")?.innerText;
    setField(fields, "permanentAddress", pick(".only_home_address_div .hover_for_edit_address")?.innerText);
    const split = splitAddress(present, city);
    if (split) {
      setField(fields, "location", split.line);
      setField(fields, "postcode", split.postcode);
      setField(fields, "countryName", split.country);
    }
    const contact = pick(".only_contact_detail_div");
    setField(fields, "phone", contact?.querySelector(".hover_for_edit_phone")?.innerText);
    setField(fields, "email", contact?.querySelector(".hover_for_edit_mail")?.innerText);
    const emergency = pick(".only_emg_contact_div");
    if (emergency) {
      const rows = Array.from(emergency.querySelectorAll("dt")).filter(visible);
      setField(fields, "emergencyName", rows[0]?.innerText);
      const relationship = Array.from(emergency.children).find((child) => child.tagName === "SPAN" && visible(child));
      setField(fields, "emergencyRelationship", relationship?.innerText);
      setField(fields, "emergencyPhone", rows.map((row) => clean(row.innerText)).find((text) => /^\+?\d[\d\s().-]{6,}\d$/.test(text)));
      setField(fields, "emergencyEmail", rows.map((row) => clean(row.innerText)).find((text) => /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text)));
    }
    // Quick Contacts: the label sits beside the control, outside its .form-group.
    sidebar.querySelectorAll(".other_part_item_right").forEach((part) => {
      if (!visible(part)) return;
      const label = normalizeLabel(part.querySelector("label.form_label")?.textContent);
      if (label === "applicant occupation") {
        setField(fields, "applicantOccupation", part.querySelector("input[type=text]")?.value);
      } else if (label === "maximum study budget") {
        const budget = part.querySelector('input[type="number"]')?.value;
        if (budget && budget !== "0") setField(fields, "studyBudget", budget);
      }
    });
  }

  function readStatusRadios(root, fields) {
    FLAG_RADIOS.forEach(([name, key]) => {
      const checked = Array.from(root.querySelectorAll(`input[name="${name}"]:checked`))
        .find((element) => visible(element));
      if (checked) setField(fields, key, checked.value === "1" ? "Yes" : "No");
    });
  }

  function readHeaderCards(root, fields) {
    root.querySelectorAll(".top_capsule_title").forEach((titleElement) => {
      if (!visible(titleElement)) return;
      const title = normalizeLabel(titleElement.textContent);
      const top = titleElement.closest(".student_portal_top") || titleElement.parentElement;
      const valueElement = top.querySelector(".top_capsule_info .name")
        || top.nextElementSibling?.querySelector?.(".name")
        || (top.nextElementSibling?.classList?.contains("top_capsule_info") ? top.nextElementSibling : null);
      const value = valueElement && visible(valueElement) ? clean(valueElement.innerText) : "";
      const key = {
        "student portal": "studentPortalStatus",
        connection: "connection",
        "sub-agent / referral": "subAgentReferral",
        "counsellor/assistance": "counsellorName",
        office: "officeName",
      }[title];
      if (key) setField(fields, key, value);
    });
    const referenceNumbers = Array.from(root.querySelectorAll(".file_number"))
      .filter((element) => visible(element))
      .map((element) => clean(element.innerText)).filter(Boolean);
    setField(fields, "leadRef", referenceNumbers[0]);
    setField(fields, "fileNumber", referenceNumbers[1]);
    setField(fields, "leadStatus", pickVisible(".lead_p_status.activate", root)?.textContent);
    setField(fields, "studentQualitySummary", pickVisible(".summary_bordered_box .hover_for_edit_delete", root)?.innerText);
    // Channel is a text label plus a dropdown of every option; read the label only.
    const channel = pickVisible(".channel_drop", root);
    if (channel) {
      const label = Array.from(channel.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => clean(node.textContent)).filter(Boolean).join(" ");
      setField(fields, "channel", label || clean(channel.innerText).split("\n")[0]);
    }
    // Lead header table: Registered on, Creation Month.
    root.querySelectorAll(".top_right_info_box tr").forEach((row) => {
      if (!visible(row)) return;
      const cells = Array.from(row.querySelectorAll(":scope > td, :scope > th"));
      if (cells.length >= 2) addField(fields, cells[0].innerText, cells[1].innerText);
    });
  }

  function readProfileTab(root, fields) {
    readSidebar(root, fields);
    const scope = Array.from(root.querySelectorAll(".tab_content_components")).find(visible) || root;
    const seen = new Set();
    scope.querySelectorAll(".main_title").forEach((titleElement) => {
      if (!visible(titleElement)) return;
      const section = titleElement.closest(".row");
      if (!section || !visible(section) || seen.has(section)) return;
      seen.add(section);
      const sectionName = normalizeLabel(titleElement.textContent);
      section.querySelectorAll("table").forEach((table) => {
        if (visible(table)) readProfileTable(table, sectionName, fields);
      });
    });
    readStatusRadios(root, fields);
    readHeaderCards(root, fields);
  }

  // The CRM stores gender but no salutation; unknown genders deliberately map to nothing.
  const TITLE_BY_GENDER = new Map([["male", "Mr"], ["m", "Mr"], ["female", "Ms"], ["f", "Ms"]]);

  async function readProfile() {
    profileGuard();
    const fields = {};
    const applicationFields = {};
    const originalTab = activeTabName();
    const tracker = () => document.querySelector("#stages") || document.querySelector("li[class*='btn_collapse_']");

    // Applications stage panels: admission preference, social contacts and the
    // split address components that the Profile tab does not show. Read into a
    // separate map so the Profile tab can win on shared keys.
    const readApplications = async () => {
      if (tabElement("Applications") && activeTabName() !== "applications") {
        await ensureTab("Applications");
      }
      // The tracker renders with the page. When it is absent, the visible
      // application form still carries admission preference and contact fields.
      await waitFor(tracker, 1500);
      await readExpandedSections(document, (panel, section) => {
        readListEntries(panel, applicationFields);
        collectFields(panel, applicationFields, section);
      });
      readVisibleForms(document, applicationFields);
    };

    // Older layouts without a tab strip are read in place. Forms get their own
    // section context; the page-wide pass covers non-form profile content only.
    const readInPlace = async () => {
      await waitFor(tracker, 1500);
      await readExpandedSections(document, (panel, section) => {
        readListEntries(panel, fields);
        collectFields(panel, fields, section);
      });
      readVisibleForms(document, fields);
      // Non-form profile content outside the tab containers (legacy sidebars and
      // summaries) is read page-wide; containers below get their own section.
      collectFields(document, fields, "", { skipForms: true, skipContainers: true });
      // Read visible non-form containers with their own section context. This
      // keeps an Admission "Institute Name" from becoming the education institution.
      const containers = Array.from(document.querySelectorAll(".collapse_common, .tab_content_components")).filter(visible);
      containers.forEach((container) => {
        const section = normalizeLabel(container.querySelector(".main_title")?.textContent || "");
        collectFields(container, fields, section, { skipForms: true });
      });
    };

    try {
      if (tabElement("Profile")) {
        // Read Applications first: it fills in admission preference and contact
        // fields, and its stage tracker disappears once Profile opens. Profile is
        // read second so its values win on shared keys.
        if (tabElement("Applications")) await readApplications();

        const ready = await ensureTab("Profile", () => hasSectionTitle("personal information"));
        if (!ready) throw new Error("The CRM Profile tab did not open. Try Copy again.");
        await waitFor(() => hasSectionTitle("personal information"));
        // Prefer the MAIN-world section request state; fall back to the
        // overlay/mutation settle for cached data and layouts without it.
        if (profileRequestState().seen === 0) await waitFor(() => profileRequestState().seen > 0, 1000);
        if (profileRequestState().seen > 0) {
          const done = await waitFor(() => profileRequestState().pending === 0, 15000);
          if (!done) throw new Error("The CRM profile is still loading. Try Copy again.");
          await sleep(500);
          if (!await waitForDomSettled(tabContent(), 5000, 500, 0)) {
            throw new Error("The CRM profile is still loading. Try Copy again.");
          }
        } else {
          const settled = await waitForProfileReady(tabContent(), 15000);
          if (!settled) throw new Error("The CRM profile is still loading. Try Copy again.");
        }
        // Final gate: the overlay can outlive the request (fetch headers vs body).
        if (pickVisible(".waitMe")) {
          if (!await waitFor(() => !pickVisible(".waitMe"), 5000)) {
            throw new Error("The CRM profile is still loading. Try Copy again.");
          }
          await sleep(300);
          if (!await waitForDomSettled(tabContent(), 5000, 500, 0)) {
            throw new Error("The CRM profile is still loading. Try Copy again.");
          }
        }
        readProfileTab(document, fields);
        // Test records merge as a unit: never borrow a score from a different test.
        const testIdentity = (value) => {
          const text = normalizeLabel(value);
          if (text.includes("ielts")) return "ielts";
          if (text.includes("pte")) return "pte";
          if (text.includes("toefl")) return "toefl";
          if (text.includes("gre")) return "gre";
          if (text.includes("gmat")) return "gmat";
          return text;
        };
        const TEST_KEYS = ["englishTestName", "testDate", "testExpiryDate",
          "overallScore", "listeningScore", "readingScore", "writingScore", "speakingScore"];
        const sameFamily = fields.englishTestName && applicationFields.englishTestName
          && testIdentity(fields.englishTestName) === testIdentity(applicationFields.englishTestName);
        const sameDate = fields.testDate && applicationFields.testDate
          && fields.testDate === applicationFields.testDate;
        const sameRecord = sameFamily && (!fields.testDate || !applicationFields.testDate || sameDate);
        if (fields.englishTestName && applicationFields.englishTestName && !sameRecord) {
          TEST_KEYS.forEach((key) => { delete applicationFields[key]; });
        }
        // Profile wins on shared keys; Applications only fills the gaps.
        for (const [key, value] of Object.entries(applicationFields)) {
          if (!(key in fields)) fields[key] = value;
        }
      } else {
        await readInPlace();
      }
      readHeaderCards(document, fields);
    } finally {
      if (originalTab && originalTab !== activeTabName()) await ensureTab(originalTab);
    }

    if (fields.emergencyName) {
      const names = fields.emergencyName.split(/\s+/).filter(Boolean);
      fields.emergencyFirstName ||= names[0] || "";
      fields.emergencyLastName ||= names.slice(1).join(" ");
    }
    for (const [source, target] of [["startDate", "studyStartYear"], ["endDate", "studyEndYear"]]) {
      const year = fields[source] && fields[source].match(/\b\d{4}\b/);
      if (year) fields[target] = year[0];
    }

    const derivedTitle = TITLE_BY_GENDER.get(normalizeLabel(fields.gender));
    if (!fields.title && derivedTitle) fields.title = derivedTitle;

    // The worker rejects any value over 4000 characters. Free-text lead summaries
    // can exceed that, so keep the profile cacheable instead of failing Copy.
    for (const [key, value] of Object.entries(fields)) {
      if (value.length > 4000) fields[key] = value.slice(0, 4000);
    }

    const studentName = [fields.givenName, fields.familyName].filter(Boolean).join(" ").slice(0, 4000);
    if (!studentName || Object.keys(fields).length < 2) {
      throw new Error("No mapped student fields were found on this CRM profile.");
    }
    return {
      studentId: fields.studentId || location.pathname.split("/").filter(Boolean).pop(),
      studentName,
      sourceOrigin: location.origin,
      copiedAt: Date.now(),
      fields,
    };
  }

  globalThis.SAMS_CRM_READER = { readProfile, labelFor, contextFor, addField };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== "copyCrmProfile") return;
    readProfile()
      .then((profile) => sendResponse({ profile }))
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  });
}
