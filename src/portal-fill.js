if (!globalThis.__SAMS_PORTAL_FILL_LOADED__) {
  globalThis.__SAMS_PORTAL_FILL_LOADED__ = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !["ping", "scan", "autofill"].includes(message.action)) return;
    if (!globalThis.SAMS_ALLOWLIST || !SAMS_ALLOWLIST.isPortalOrigin(location.origin)) {
      sendResponse({ error: "Autofill is only available on an approved portal origin." });
      return false;
    }
    if (!globalThis.SAMS_ENGINE) {
      sendResponse({ error: "Autofill engine is unavailable." });
      return false;
    }
    if (message.action === "ping") {
      sendResponse({ pong: true, version: "0.1.0" });
      return false;
    }

    (async () => {
      try {
        const fields = SAMS_ENGINE.scanFormFields(
          message.action === "scan" && (message.lean || message.mode === "lean")
            ? { lean: true }
            : { mode: message.action === "scan" ? "full" : "fill" }
        );
        if (message.action === "autofill") {
          sendResponse(await SAMS_ENGINE.autofillPage(message.fieldMap || {}, fields));
          return;
        }
        let descriptors = fields.map((field) => {
          const descriptor = { ...field };
          delete descriptor.element;
          return descriptor;
        });
        if (!message.lean && message.fieldMap) {
          descriptors = SAMS_ENGINE.enrichFieldsWithMapping(fields, message.fieldMap);
        }
        sendResponse({ fields: descriptors, fieldCount: fields.length });
      } catch (error) {
        sendResponse({ error: error.message || String(error) });
      }
    })();
    return true;
  });
}
