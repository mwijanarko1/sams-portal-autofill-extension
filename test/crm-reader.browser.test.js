const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const browser = "/Applications/Helium.app/Contents/MacOS/Helium";

function readFixture(name) {
  const fixture = pathToFileURL(path.resolve("test/fixtures", name)).href;
  const run = spawnSync(browser, ["--headless=new", "--disable-gpu", "--virtual-time-budget=30000", "--dump-dom", fixture], {
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(run.status, 0, run.stderr);
  const match = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
  assert.ok(match, "Browser fixture did not produce a CRM profile");
  return JSON.parse(match[1].replaceAll("&amp;", "&"));
}

test("CRM reader extracts the mock profile in a real browser DOM", () => {
  const profile = readFixture("crm-profile.html");

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

test("CRM reader extracts the live layout with label dd before value dt", () => {
  const profile = readFixture("crm-live-profile.html");
  assert.equal(profile.error, undefined);
  assert.equal(profile.studentName, "Rahim Uddin");
  assert.deepEqual(profile.fields, {
    givenName: "Rahim",
    familyName: "Uddin",
    nationality: "Bangladeshi",
    gender: "Male",
    maritalStatus: "Single",
    phone: "+447700900123",
    email: "rahim.uddin@example.com",
  });
});

test("CRM reader opens collapsed sections and reads their forms and lists", () => {
  const profile = readFixture("crm-expanded-profile.html");
  assert.equal(profile.error, undefined);
  assert.deepEqual(profile.fields, {
    givenName: "Rahim",
    dateOfBirth: "2001-04-15",
    funding: "Self-Funded",
    location: "1 Test Street, Example Area",
    city: "Dhaka",
    postcode: "1207",
    countryName: "Bangladesh",
    institutionName: "Example Test University",
    studyDates: "September 2019 - June 2023",
    startDate: "September 2019",
    endDate: "June 2023",
    major: "Computer Science (TEST)",
    grade: "3.50",
    graduationYear: "2023",
    degree: "Bachelor Year 1",
    passportNumber: "TEST1234567",
    passportIssueDate: "2022-01-10",
    passportExpiryDate: "2032-01-09",
    englishTestName: "IELTS",
    testDate: "2025-03-01",
    overallScore: "7",
    listeningScore: "7",
    speakingScore: "6.5",
    writingScore: "6.5",
    readingScore: "7.5",
    cvCurrentEmployer: "Example Test Ltd",
    cvWorkStartDate: "2023-07-01",
    cvWorkEndDate: "2024-06-30",
    cvCurrentJobTitle: "Intern (TEST)",
    familyName: "Uddin",
    studyStartYear: "2019",
    studyEndYear: "2023",
  });
});
