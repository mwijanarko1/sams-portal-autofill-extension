const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const browser = "/Applications/Helium.app/Contents/MacOS/Helium";

function readFixture(name, search = "") {
  const fixture = pathToFileURL(path.resolve("test/fixtures", name)).href + search;
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
  assert.equal(profile.fields.title, "Ms");
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
    title: "Mr",
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

test("CRM reader derives a missing title from gender", () => {
  const cases = [
    ["?gender=Female", "Ms"],
    ["?gender=Male", "Mr"],
    ["?gender=%20%20fEmAlE%20", "Ms"],
    ["?gender=%20mALE%20", "Mr"],
    ["?gender=F", "Ms"],
    ["?gender=m", "Mr"],
    ["?gender=%20f%20", "Ms"],
  ];
  for (const [search, title] of cases) {
    const profile = readFixture("crm-title-profile.html", search);
    assert.equal(profile.error, undefined, search);
    assert.equal(profile.fields.title, title, search);
  }
});

test("CRM reader leaves title unset for unknown or missing gender", () => {
  for (const search of ["", "?gender=Other", "?gender=Non-binary", "?gender=X", "?gender=Prefer%20not%20to%20say", "?gender=%20%20"]) {
    const profile = readFixture("crm-title-profile.html", search);
    assert.equal(profile.error, undefined, search);
    assert.equal("title" in profile.fields, false, `${search || "no gender"} must not derive a title`);
  }
});

test("CRM reader preserves an explicit CRM title over gender", () => {
  const explicit = readFixture("crm-title-profile.html", "?gender=Female&title=Dr");
  assert.equal(explicit.fields.title, "Dr");
  assert.equal(explicit.fields.gender, "Female");
  const mismatched = readFixture("crm-title-profile.html", "?gender=Male&title=Mrs");
  assert.equal(mismatched.fields.title, "Mrs");
  const withoutGender = readFixture("crm-title-profile.html", "?title=Prof");
  assert.equal(withoutGender.fields.title, "Prof");
});

test("CRM reader reads the selected gender radio through its shared field label", () => {
  for (const [selected, gender, title] of [["Male", "Male", "Mr"], ["Female", "Female", "Ms"]]) {
    const profile = readFixture("crm-radio-profile.html", `?selected=${selected}`);
    assert.equal(profile.error, undefined, selected);
    assert.equal(profile.fields.gender, gender, selected);
    assert.equal(profile.fields.title, title, selected);
    assert.equal(profile.fields.givenName, "Rahim");
  }
  // The selected radio wins over a saved summary because the open form holds the current value.
  const conflicting = readFixture("crm-radio-profile.html", "?selected=Female&summary=Male");
  assert.equal(conflicting.fields.gender, "Female");
  assert.equal(conflicting.fields.title, "Ms");
  const inline = readFixture("crm-radio-profile.html", "?selected=Male&placement=inline");
  assert.equal(inline.fields.gender, "Male");
  assert.equal(inline.fields.title, "Mr");
});

test("CRM reader never joins unselected gender radio choices into a value", () => {
  const withSummary = readFixture("crm-radio-profile.html", "?summary=Male");
  assert.equal(withSummary.error, undefined);
  assert.equal(withSummary.fields.gender, "Male");
  assert.equal(withSummary.fields.title, "Mr");

  for (const search of ["", "?placement=inline"]) {
    const none = readFixture("crm-radio-profile.html", search);
    assert.equal(none.error, undefined, search);
    assert.equal("gender" in none.fields, false, `${search || "default"} must not pick a gender`);
    assert.equal("title" in none.fields, false, `${search || "default"} must not derive a title`);
    assert.equal(none.fields.givenName, "Rahim");
  }
});

test("CRM reader keeps an explicit title when gender comes from a radio group", () => {
  const profile = readFixture("crm-radio-profile.html", "?selected=Female&title=Dr");
  assert.equal(profile.fields.gender, "Female");
  assert.equal(profile.fields.title, "Dr");
});
