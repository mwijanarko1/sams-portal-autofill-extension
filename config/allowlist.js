/* Exact production origins are completed after SAMS provides portal access. */
{
const SAMS_ALLOWLIST_CONFIG = {
  sessionMinutes: 30,
  crmOrigins: ["https://app.samscrm.co.uk"],
  camporaOrigins: [],
  portalOrigins: ["https://nelson.gre.ac.uk"],
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

function originsFor(kind) {
  const dev = globalThis.SAMS_BUILD_MODE !== "prod";
  if (kind === "crm") {
    return SAMS_ALLOWLIST_CONFIG.crmOrigins
      .concat(SAMS_ALLOWLIST_CONFIG.camporaOrigins)
      .concat(dev ? SAMS_ALLOWLIST_CONFIG.devCrmOrigins : []);
  }
  return SAMS_ALLOWLIST_CONFIG.portalOrigins
    .concat(dev ? SAMS_ALLOWLIST_CONFIG.devPortalOrigins : []);
}

globalThis.SAMS_ALLOWLIST = {
  config: SAMS_ALLOWLIST_CONFIG,
  isCrmOrigin(value) {
    return originsFor("crm").includes(normalizeOrigin(value));
  },
  isPortalOrigin(value) {
    return originsFor("portal").includes(normalizeOrigin(value));
  },
  normalizeOrigin,
  originsFor,
};

if (typeof module !== "undefined") module.exports = SAMS_ALLOWLIST_CONFIG;
}
