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

  function labelTextWithoutControl(label, control) {
    return Array.from(label.childNodes)
      .filter((node) => node !== control && !(node.contains && node.contains(control)))
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(" ");
  }

  function labelFor(element) {
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
    if (key && value && !fields[key]) fields[key] = /date/i.test(key) ? isoDate(value) || value : value;
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

  // Expanded CRM sections list saved records as .single_part entries; the first entry is copied.
  function readListEntries(panel, fields) {
    const heading = normalizeLabel(panel.querySelector(".title_in_border, .title_in_borders")?.textContent);
    const entry = panel.querySelector(".single_part");
    if (!entry) return;
    const title = entry.querySelector(".progress-lbl")?.textContent;
    const spans = Array.from(entry.querySelectorAll("span")).map((span) => span.textContent.replace(/\s+/g, " ").trim()).filter(Boolean);
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

  // Only the CRM's section toggles are clicked; they render one read-only panel at a time and send no writes.
  async function readExpandedSections(profileRoot, readPanel) {
    for (const toggle of profileRoot.querySelectorAll("li[class*='btn_collapse_']")) {
      const before = document.querySelector(".collapse_common")?.innerText || "";
      toggle.click();
      for (let waited = 0; waited < 5000; waited += 100) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const panel = document.querySelector(".collapse_common");
        if (panel && visible(panel) && panel.innerText && panel.innerText !== before) {
          // Dropdown options and selected values arrive after the panel first renders.
          const snapshot = () => panel.innerHTML + Array.from(panel.querySelectorAll("select")).map((select) => select.selectedIndex).join();
          for (let settled = 0, last = snapshot(), elapsed = 0; settled < 500 && elapsed < 3000; elapsed += 100) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const next = snapshot();
            settled = next === last ? settled + 100 : 0;
            last = next;
          }
          readPanel(panel);
          break;
        }
      }
    }
  }

  function collectFields(profileRoot, fields) {
    profileRoot.querySelectorAll("input:not([type=password]):not([type=hidden]), select:not(.select_unit), textarea").forEach((element) => {
      const shown = visible(element) || element.classList.contains("select2-hidden-accessible");
      if (shown && (!["radio", "checkbox"].includes(element.type) || element.checked)) {
        addField(fields, labelFor(element), controlValue(element), contextFor(element));
      }
    });
    // Empty CRM sections render a .text-danger placeholder value such as "No Present Address Found."
    const isEmptyState = (element) => element.classList.contains("text-danger");
    // SAMS CRM puts the label in <dd> and the value in <dt>; whichever tag leads its parent is the label.
    profileRoot.querySelectorAll("dt, dd").forEach((label) => {
      const labelTag = label.parentElement.querySelector(":scope > dt, :scope > dd").tagName;
      const value = label.nextElementSibling;
      if (label.tagName !== labelTag || !value || !["DT", "DD"].includes(value.tagName) || value.tagName === labelTag) return;
      if (!isEmptyState(value)) addField(fields, label.textContent, value.textContent, contextFor(label));
    });
    profileRoot.querySelectorAll("tr").forEach((row) => {
      const cells = row.querySelectorAll(":scope > th, :scope > td");
      if (cells.length >= 2) addField(fields, cells[0].textContent, cells[1].textContent, contextFor(row));
    });
    profileRoot.querySelectorAll("div, li").forEach((row) => {
      const children = row.children;
      if (children.length === 2 && !isEmptyState(children[1])) {
        addField(fields, children[0].textContent, children[1].textContent, contextFor(row));
      }
    });
    const contactSections = Array.from(profileRoot.querySelectorAll("section, article, [role='region']"))
      .filter((section) => Array.from(section.querySelectorAll("h2, h3, strong"))
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

  async function readProfile() {
    profileGuard();
    const fields = {};
    const profileRoot = document.querySelector("main, [role='main'], [data-sams-profile]") || document;
    // Expanded edit forms hold exact values; the summary card joins address parts into one line.
    await readExpandedSections(profileRoot, (panel) => {
      readListEntries(panel, fields);
      collectFields(panel, fields);
    });
    collectFields(profileRoot, fields);

    if (fields.emergencyName) {
      const names = fields.emergencyName.split(/\s+/).filter(Boolean);
      fields.emergencyFirstName ||= names[0] || "";
      fields.emergencyLastName ||= names.slice(1).join(" ");
    }
    for (const [source, target] of [["startDate", "studyStartYear"], ["endDate", "studyEndYear"]]) {
      const year = fields[source] && fields[source].match(/\b\d{4}\b/);
      if (year) fields[target] = year[0];
    }

    const studentName = [fields.givenName, fields.familyName].filter(Boolean).join(" ");
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
