/* Exact production origins are completed after SAMS provides portal access. */
{
const SAMS_ALLOWLIST_CONFIG = {
  sessionMinutes: 30,
  crmOrigins: ["https://app.samscrm.co.uk"],
  camporaOrigins: [],
  // Mapped portals get persistent site access. Other university pages are reached only through the
  // one-time access the browser grants when staff open the extension on that page.
  portalOrigins: [
    "https://nelson.gre.ac.uk",
    "https://apps.bangor.ac.uk",
    "https://evision.bolton.ac.uk",
  ],
  devCrmOrigins: ["http://localhost:3000"],
  devPortalOrigins: ["http://localhost:3001", "http://127.0.0.1:3001"],
};

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function crmOrigins() {
  const dev = globalThis.SAMS_BUILD_MODE !== "prod";
  return SAMS_ALLOWLIST_CONFIG.crmOrigins
    .concat(SAMS_ALLOWLIST_CONFIG.camporaOrigins)
    .concat(dev ? SAMS_ALLOWLIST_CONFIG.devCrmOrigins : []);
}

function isCrmOrigin(value) {
  return crmOrigins().includes(normalizeOrigin(value));
}

globalThis.SAMS_ALLOWLIST = {
  config: SAMS_ALLOWLIST_CONFIG,
  isCrmOrigin,
  // Autofill may run on any web page staff select, never on the CRM source itself.
  isFillTarget(value) {
    const origin = normalizeOrigin(value);
    return /^https?:\/\//.test(origin) && !isCrmOrigin(origin);
  },
  // Only this extension's own popup page may read the student cache or deliver it to a page.
  isPopupSender(sender) {
    return Boolean(sender) && sender.id === chrome.runtime.id
      && typeof sender.url === "string"
      && sender.url.split(/[?#]/)[0] === chrome.runtime.getURL("popup.html");
  },
  normalizeOrigin,
};

if (typeof module !== "undefined") module.exports = SAMS_ALLOWLIST_CONFIG;
}
