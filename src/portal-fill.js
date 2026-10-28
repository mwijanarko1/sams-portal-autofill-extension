if (!globalThis.__SAMS_PORTAL_FILL_LOADED__) {
  globalThis.__SAMS_PORTAL_FILL_LOADED__ = true;

  const PAGE_CHANGED = "This page changed. Open the extension again on the form.";

  // Why this document is not the page staff selected, or "" when it is: the same web origin, not
  // sandboxed (self.origin is "null" there even when the URL matches), inside a top page of that origin.
  function pageProblem(origin) {
    if (!globalThis.SAMS_ALLOWLIST || !SAMS_ALLOWLIST.isFillTarget(origin) || location.origin !== origin) return PAGE_CHANGED;
    if (self.origin !== origin) return "This part of the page is sandboxed, so it was not filled. Complete it manually.";
    try {
      if (window.top.location.origin === origin) return "";
    } catch { /* top page has another origin */ }
    return PAGE_CHANGED;
  }

  const clean = (text, max = 200) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
  // A label that only names the browse control ("Choose file") does not say which document belongs here.
  const GENERIC_CONTROL = /^(browse|choose( a)? files?|select( a)? files?|upload( files?)?|add files?|attach|drop files? here)\.{0,3}$/i;
  const HEADING = "h1, h2, h3, h4, h5, h6, legend";
  const STOP_TAGS = new Set(["FORM", "MAIN", "BODY", "HTML"]);

  function referencedText(input, attribute) {
    const root = input.getRootNode();
    const ids = (input.getAttribute(attribute) || "").split(/\s+/).filter(Boolean);
    return clean(ids.map((id) => root.getElementById?.(id)?.textContent).filter(Boolean).join(" "));
  }

  // Generated ids such as html5_1k3j9x_1 name nothing. Only a short run of plain words counts as a label.
  function nameLabel(value) {
    const words = clean(value, 80).replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_.\-[\]]+/).filter(Boolean);
    if (!words.length || words.length > 5 || words.some((word) => word.length > 20 || !/^([A-Za-z]+|\d{1,2})$/.test(word))) return "";
    if (!words.some((word) => /^[A-Za-z]{3,}$/.test(word))) return "";
    const text = words.join(" ");
    if (GENERIC_CONTROL.test(text) || /^(file|files|userfile|input|attachment)$/i.test(text)) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // "" when the page names this field nowhere readable; the popup then numbers it.
  function uploadLabel(input) {
    const labels = [...(input.labels || [])].map((label) => clean(label.textContent)).filter((text) => text && !GENERIC_CONTROL.test(text));
    return labels[0] || referencedText(input, "aria-labelledby") || clean(input.getAttribute("aria-label")) || nameLabel(input.name) || nameLabel(input.id);
  }

  // Only the field's own fieldset legend, named group, nearby section heading, or help text. Never
  // the whole form or page, which would pull in unrelated and personal text.
  function sectionContext(input) {
    const legend = input.closest("fieldset")?.querySelector(":scope > legend");
    if (legend) return clean(legend.textContent, 120);
    const group = input.closest("[role=group], [role=region], section");
    const named = group && (clean(group.getAttribute("aria-label"), 120) || referencedText(group, "aria-labelledby").slice(0, 120));
    if (named) return named;
    let branch = input;
    for (let depth = 0; depth < 3; depth++) {
      const parent = branch.parentElement;
      if (!parent || STOP_TAGS.has(parent.tagName)) break;
      const heading = [...parent.children].filter((child) => child.matches(HEADING) && branch.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_PRECEDING).pop();
      if (heading) return clean(heading.textContent, 120);
      branch = parent;
    }
    return "";
  }

  function helpText(input) {
    const described = referencedText(input, "aria-describedby").slice(0, 160);
    if (described) return described;
    for (let wrapper = input.parentElement, depth = 0; wrapper && depth < 2 && !STOP_TAGS.has(wrapper.tagName); wrapper = wrapper.parentElement, depth++) {
      if (wrapper.querySelectorAll("input[type=file]").length !== 1) break;
      const help = [...wrapper.children].find((child) => child.matches("small, .help-block, .form-text, .hint") && !child.contains(input));
      if (help) return clean(help.textContent, 160);
    }
    return "";
  }

  function uploadContext(input, label) {
    return [...new Set([sectionContext(input), helpText(input)])].filter((text) => text && text !== label).join(" · ").slice(0, 240);
  }

  // Upload fields are only reachable by the keys handed out on this port, never by selector. Every
  // enabled file input is listed, including hidden ones that back a portal's custom upload widget.
  function listUploads(uploads) {
    uploads.clear();
    return [...document.querySelectorAll("input[type=file]")].filter((input) => !input.disabled).map((input, index) => {
      const key = `upload-${index}`;
      const label = uploadLabel(input);
      uploads.set(key, input);
      return { key, label, context: uploadContext(input, label), accept: input.accept.slice(0, 500), hasFile: input.files.length > 0 };
    });
  }

  const UPLOAD_CONTROL = /\b(browse|choose|select|upload|attach|add|drop|files?|documents?)\b/i;
  const OUTLINE = ["outline-width", "outline-style", "outline-color", "outline-offset"];
  // One highlight per document, so a second Show or a rescan restores the first outline before saving its own.
  let highlight = null;

  function isVisible(element) {
    if (!element.isConnected || element.getClientRects().length === 0) return false;
    if (element.checkVisibility && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const box = element.getBoundingClientRect();
    return box.width >= 4 && box.height >= 4;
  }

  // The one visible upload button in a small container that holds only this file input, or null
  // when there is none or more than one. Nothing is revealed, clicked, or guessed from geometry.
  function localUploadControl(input) {
    for (let container = input.parentElement, depth = 0; container && depth < 3 && !STOP_TAGS.has(container.tagName); container = container.parentElement, depth++) {
      if (container.querySelectorAll("input[type=file]").length !== 1) return null;
      const controls = [...container.querySelectorAll("button, [role=button], a")].filter((control) => {
        if (control.matches("[type=submit], [type=reset]") || !isVisible(control)) return false;
        const text = clean(control.getAttribute("aria-label") || control.innerText || control.textContent, 80);
        return text && UPLOAD_CONTROL.test(text);
      });
      if (controls.length) return controls.length === 1 ? controls[0] : null;
    }
    return null;
  }

  function visibleAnchor(input) {
    if (isVisible(input)) return input;
    return [...(input.labels || [])].find(isVisible) || localUploadControl(input);
  }

  function clearHighlight() {
    if (!highlight) return;
    clearTimeout(highlight.timer);
    for (const [property, value, priority] of highlight.saved) {
      if (value) highlight.anchor.style.setProperty(property, value, priority);
      else highlight.anchor.style.removeProperty(property);
    }
    highlight = null;
  }

  // Scroll and a temporary outline only: no focus, click, or event reaches the portal.
  function showUpload(uploads, key) {
    const input = uploads.get(key);
    if (!input || !input.isConnected || input.disabled) return { error: "This upload field changed. Scan the page again." };
    const anchor = visibleAnchor(input);
    if (!anchor) {
      return { manual: "Cannot show this field: the portal hides its file input behind its own upload widget. Find the upload control in the portal and attach the document there manually." };
    }
    clearHighlight();
    highlight = { anchor, saved: OUTLINE.map((property) => [property, anchor.style.getPropertyValue(property), anchor.style.getPropertyPriority(property)]) };
    anchor.scrollIntoView({ block: "center", inline: "nearest" });
    anchor.style.setProperty("outline", "3px solid #4f46e5", "important");
    anchor.style.setProperty("outline-offset", "2px", "important");
    highlight.timer = setTimeout(clearHighlight, 4000);
    return { shown: true };
  }

  // Staff chose this file for this field in the popup. Assigning it is the only page change:
  // no click, no submit. The portal's own widget may upload it on change.
  function attachDocument(uploads, key, file) {
    const input = uploads.get(key);
    if (!input || !input.isConnected || input.disabled) return { error: "This upload field changed. Scan the page again." };
    if (input.files.length) return { error: "This field already has a file." };
    if (!file || typeof file.name !== "string" || typeof file.type !== "string" || typeof file.base64 !== "string") {
      return { error: "The document could not be read." };
    }
    const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], file.name, { type: file.type }));
    input.files = transfer.files;
    if (input.files.length !== 1 || input.files[0].name !== file.name) return { error: "This portal did not accept the file. Attach it manually." };
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { attached: true, name: file.name };
  }

  // One port per popup request, bound to this document. Navigation closes it, and the popup never reconnects.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "sams-autofill") return;
    if (!globalThis.SAMS_ALLOWLIST || !SAMS_ALLOWLIST.isPopupSender(port.sender)) {
      port.disconnect();
      return;
    }
    let origin = "";
    const uploads = new Map();
    // The popup may close mid-fill; a reply to a closed port has nobody to inform.
    const reply = (response) => {
      try { port.postMessage(response); } catch { /* port closed */ }
    };
    port.onMessage.addListener(async (message) => {
      if (!message || !["prepare", "autofill", "listUploads", "showUpload", "attachDocument"].includes(message.action)) return;
      if (message.action === "prepare") origin = message.origin;
      const problem = pageProblem(origin);
      if (problem) {
        reply({ error: problem });
        return;
      }
      if (!globalThis.SAMS_ENGINE) {
        reply({ error: "Autofill engine is unavailable." });
        return;
      }
      if (message.action === "prepare") {
        reply({ ready: true });
        return;
      }
      if (message.action === "listUploads") {
        reply({ uploads: listUploads(uploads) });
        return;
      }
      if (message.action === "showUpload") {
        reply(showUpload(uploads, message.key));
        return;
      }
      if (message.action === "attachDocument") {
        reply(attachDocument(uploads, message.key, message.file));
        return;
      }
      try {
        reply(await SAMS_ENGINE.autofillPage(message.fieldMap || {}, SAMS_ENGINE.scanFormFields({ mode: "fill" })));
      } catch (error) {
        reply({ error: error.message || String(error) });
      }
    });
  });
}
