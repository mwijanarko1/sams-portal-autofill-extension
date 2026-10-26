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

test("CRM profile guard accepts agent and original profiles, not lists or dashboards", () => {
  const allowed = (path) => crmSource.profilePathPatterns.some((pattern) => pattern.test(path));
  for (const path of ["/leads/full-profile/student-1", "/agent/leads/full-profile/student-1/"]) {
    assert.equal(allowed(path), true, path);
  }
  for (const path of ["/agent/dashboard", "/agent/new-direct-leads", "/agent/leads/full-profile/", "/leads/full-profile/student-1/edit", "/unapproved/leads/full-profile/student-1"]) {
    assert.equal(allowed(path), false, path);
  }
});

test("Campora profile guard accepts only the application profile route", () => {
  const allowed = (path) => crmSource.camporaProfilePathPatterns.some((pattern) => pattern.test(path));
  for (const path of ["/applyuser/show/33621/profile", "/applyuser/show/33621/profile/"]) {
    assert.equal(allowed(path), true, path);
  }
  for (const path of [
    "/applyuser/dashboard",
    "/applyuser/gateway",
    "/applyuser/applicationfrom/list",
    "/applyuser/show/33621",
    "/applyuser/show/33621/profile/edit",
  ]) {
    assert.equal(allowed(path), false, path);
  }
});

test("manifest has no blanket host permission or local persistence path", () => {
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
  assert.ok(manifest.permissions.includes("alarms"));
  assert.ok(manifest.permissions.includes("webNavigation"));
  assert.equal(manifest.background.service_worker, "src/background.js");
});
