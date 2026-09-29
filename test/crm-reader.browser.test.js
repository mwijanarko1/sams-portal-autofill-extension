const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const browser = "/Applications/Helium.app/Contents/MacOS/Helium";

test("CRM reader extracts the mock profile in a real browser DOM", () => {
  const fixture = pathToFileURL(path.resolve("test/fixtures/crm-profile.html")).href;
  const run = spawnSync(browser, ["--headless=new", "--disable-gpu", "--dump-dom", fixture], {
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(run.status, 0, run.stderr);
  const match = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
  assert.ok(match, "Browser fixture did not produce a CRM profile");
  const profile = JSON.parse(match[1].replaceAll("&amp;", "&"));

  assert.equal(profile.fields.givenName, "Aisha");
  assert.equal(profile.fields.familyName, "Rahman");
  assert.equal(profile.fields.gender, "Female");
  assert.equal(profile.fields.nationality, "Bangladeshi");
  assert.equal(profile.fields.institutionName, "Dhaka College");
  assert.equal(profile.fields.major, "Computer Science");
  assert.equal(profile.fields.email, "aisha.rahman@example.com");
  assert.notEqual(profile.fields.email, "sara.counsellor@samsglobal.co.uk");
  assert.equal(profile.fields.phone, "+44 7700 900123");
  assert.equal(profile.fields.emergencyName, "Amina Rahman");
  assert.equal(profile.fields.emergencyRelationship, "Mother");
  assert.equal(profile.fields.emergencyPhone, "+880 1712 345678");
  assert.equal(profile.fields.emergencyEmail, "amina.rahman@example.com");
});
