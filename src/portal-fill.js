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

  function uploadLabel(input) {
    const label = input.labels?.[0]?.textContent || input.getAttribute("aria-label") || input.name || input.id || "File upload";
    return label.replace(/\s+/g, " ").trim().slice(0, 200);
  }

  // Upload fields are only reachable by the keys handed out on this port, never by selector.
  function listUploads(uploads) {
    uploads.clear();
    return [...document.querySelectorAll("input[type=file]")].filter((input) => !input.disabled).map((input, index) => {
      const key = `upload-${index}`;
      uploads.set(key, input);
      return { key, label: uploadLabel(input), accept: input.accept.slice(0, 500), hasFile: input.files.length > 0 };
    });
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
      if (!message || !["prepare", "autofill", "listUploads", "attachDocument"].includes(message.action)) return;
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
