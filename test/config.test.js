const test = require("node:test");
const assert = require("node:assert/strict");
const allowlist = require("../config/allowlist.js");
const crmSource = require("../config/crm-source.js");
const manifest = require("../manifest.json");

test("development and production origins remain separate", () => {
  assert.ok(allowlist.crmOrigins.includes("https://app.samscrm.co.uk"));
  assert.ok(allowlist.devCrmOrigins.every((origin) => origin.startsWith("http://localhost")));
  assert.ok(allowlist.devPortalOrigins.every((origin) => !allowlist.portalOrigins.includes(origin)));
});

test("core CRM labels map to canonical keys", () => {
  assert.equal(crmSource.labels["given name"], "givenName");
  assert.equal(crmSource.labels["family name"], "familyName");
  assert.equal(crmSource.labels["date of birth"], "dateOfBirth");
  assert.equal(crmSource.labels["primary email"], "email");
});

test("manifest has no blanket host permission or local persistence path", () => {
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
  assert.ok(manifest.permissions.includes("alarms"));
  assert.ok(manifest.permissions.includes("webNavigation"));
  assert.equal(manifest.background.service_worker, "src/background.js");
});
