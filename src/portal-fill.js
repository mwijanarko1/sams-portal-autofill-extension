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

  // One port per popup request, bound to this document. Navigation closes it, and the popup never reconnects.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "sams-autofill") return;
    if (!globalThis.SAMS_ALLOWLIST || !SAMS_ALLOWLIST.isPopupSender(port.sender)) {
      port.disconnect();
      return;
    }
    let origin = "";
    // The popup may close mid-fill; a reply to a closed port has nobody to inform.
    const reply = (response) => {
      try { port.postMessage(response); } catch { /* port closed */ }
    };
    port.onMessage.addListener(async (message) => {
      if (!message || !["prepare", "autofill"].includes(message.action)) return;
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
      try {
        reply(await SAMS_ENGINE.autofillPage(message.fieldMap || {}, SAMS_ENGINE.scanFormFields({ mode: "fill" })));
      } catch (error) {
        reply({ error: error.message || String(error) });
      }
    });
  });
}
