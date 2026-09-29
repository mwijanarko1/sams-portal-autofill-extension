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
    if (!wrapper) return element.name || element.id || "";
    return labelTextWithoutControl(wrapper, element);
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
    if (key && !fields[key]) fields[key] = value;
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

  function readProfile() {
    profileGuard();
    const fields = {};
    const profileRoot = document.querySelector("main, [role='main'], [data-sams-profile]") || document;

    profileRoot.querySelectorAll("input:not([type=password]):not([type=hidden]), select, textarea").forEach((element) => {
      if (visible(element) && (!["radio", "checkbox"].includes(element.type) || element.checked)) {
        addField(fields, labelFor(element), element.value, contextFor(element));
      }
    });
    profileRoot.querySelectorAll("dt").forEach((label) => {
      const value = label.nextElementSibling;
      if (value) addField(fields, label.textContent, value.textContent, contextFor(label));
    });
    profileRoot.querySelectorAll("tr").forEach((row) => {
      const cells = row.querySelectorAll(":scope > th, :scope > td");
      if (cells.length >= 2) addField(fields, cells[0].textContent, cells[1].textContent, contextFor(row));
    });
    profileRoot.querySelectorAll("div, li").forEach((row) => {
      const children = row.children;
      if (children.length === 2) {
        addField(fields, children[0].textContent, children[1].textContent, contextFor(row));
      }
    });
    const contactSections = Array.from(profileRoot.querySelectorAll("section, article, [role='region']"))
      .filter((section) => Array.from(section.querySelectorAll("h2, h3"))
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
      section.querySelectorAll("span, li, div").forEach((element) => {
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
      throw new Error("No mapped student fields were visible. Open any collapsed CRM sections and try again.");
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
    try {
      sendResponse({ profile: readProfile() });
    } catch (error) {
      sendResponse({ error: error.message || String(error) });
    }
  });
}
