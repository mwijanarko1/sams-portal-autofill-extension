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
    phone: "+880 1712345678",
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
    previousStudyDestination: "Canada",
    previousStudyVisaType: "Student Visa",
    preferredDestination: "United Kingdom",
    preferredUniversity: "Example University",
    preferredLevel: "Masters",
    preferredCourse: "MSc Data Science",
    preferredStartYear: "2027",
    preferredStartMonth: "September",
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

test("CRM reader reads the individual lead Profile tab after its sections load", () => {
  const profile = readFixture("crm-profile-tab.html");
  assert.equal(profile.error, undefined);
  assert.equal(profile.studentName, "Jake Mufoy");
  assert.deepEqual(
    {
      givenName: profile.fields.givenName,
      familyName: profile.fields.familyName,
      dateOfBirth: profile.fields.dateOfBirth,
      nationality: profile.fields.nationality,
      gender: profile.fields.gender,
      maritalStatus: profile.fields.maritalStatus,
      title: profile.fields.title,
      city: profile.fields.city,
      postcode: profile.fields.postcode,
      countryName: profile.fields.countryName,
      location: profile.fields.location,
      phone: profile.fields.phone,
      email: profile.fields.email,
      emergencyName: profile.fields.emergencyName,
      emergencyRelationship: profile.fields.emergencyRelationship,
      emergencyPhone: profile.fields.emergencyPhone,
      emergencyEmail: profile.fields.emergencyEmail,
      applicantOccupation: profile.fields.applicantOccupation,
      studyBudget: profile.fields.studyBudget,
    },
    {
      givenName: "Jake",
      familyName: "Mufoy",
      dateOfBirth: "2001-04-15",
      nationality: "Angola",
      gender: "Male",
      maritalStatus: "Single",
      title: "Mr",
      city: "Dhaka",
      postcode: "1207",
      countryName: "Bangladesh",
      location: "1 Test Street, Example Area",
      phone: "+244 456746456456",
      email: "jake.mufoy.student@yopmail.com",
      emergencyName: "Test Guardian",
      emergencyRelationship: "Parent",
      emergencyPhone: "+880 1712345678",
      emergencyEmail: "guardian.test@example.com",
      applicantOccupation: "Student",
      studyBudget: "15000",
    },
  );
});

test("CRM reader reads every lead Profile tab section and its table", () => {
  const { fields } = readFixture("crm-profile-tab.html");
  assert.deepEqual(
    {
      funding: fields.funding,
      studentQuality: fields.studentQuality,
      leadStatus: fields.leadStatus,
      hasVisaHistory: fields.hasVisaHistory,
      passportExpiryDate: fields.passportExpiryDate,
      institutionName: fields.institutionName,
      degree: fields.degree,
      major: fields.major,
      grade: fields.grade,
      studyDates: fields.studyDates,
      startDate: fields.startDate,
      endDate: fields.endDate,
      englishTestName: fields.englishTestName,
      testDate: fields.testDate,
      overallScore: fields.overallScore,
      listeningScore: fields.listeningScore,
      speakingScore: fields.speakingScore,
      writingScore: fields.writingScore,
      readingScore: fields.readingScore,
      cvCurrentEmployer: fields.cvCurrentEmployer,
      cvCurrentJobTitle: fields.cvCurrentJobTitle,
      cvWorkDates: fields.cvWorkDates,
      cvWorkStartDate: fields.cvWorkStartDate,
      cvWorkEndDate: fields.cvWorkEndDate,
      referenceName: fields.referenceName,
      referenceSource: fields.referenceSource,
      referencePhone: fields.referencePhone,
      referenceEmail: fields.referenceEmail,
      passportNumber: fields.passportNumber,
      passportDates: fields.passportDates,
      passportIssueDate: fields.passportIssueDate,
      passportPlaceOfIssue: fields.passportPlaceOfIssue,
      visaType: fields.visaType,
      visaCountry: fields.visaCountry,
      visaPurpose: fields.visaPurpose,
      visaStartDate: fields.visaStartDate,
      visaEndDate: fields.visaEndDate,
      visaRefusalType: fields.visaRefusalType,
      visaRefusalCountry: fields.visaRefusalCountry,
      visaRefusalPurpose: fields.visaRefusalPurpose,
      studyGapInstitution: fields.studyGapInstitution,
      studyGapType: fields.studyGapType,
      studyGapStartDate: fields.studyGapStartDate,
      previousInstitution: fields.previousInstitution,
      previousSubject: fields.previousSubject,
      previousStudyCountryVisa: fields.previousStudyCountryVisa,
    },
    {
      funding: "Self Funded",
      studentQuality: "Best",
      leadStatus: "Regular",
      hasVisaHistory: "Yes",
      passportExpiryDate: "2032-01-09",
      institutionName: "Example Test University",
      degree: "Bachelor Year 1",
      major: "Computer Science (TEST)",
      grade: "3.50",
      studyDates: "September 2019 - June 2023",
      startDate: "September 2019",
      endDate: "June 2023",
      englishTestName: "IELTS",
      testDate: "2025-03-01",
      overallScore: "7",
      listeningScore: "7",
      speakingScore: "6.5",
      writingScore: "6.5",
      readingScore: "7.5",
      cvCurrentEmployer: "Example Test Ltd",
      cvCurrentJobTitle: "Intern (TEST)",
      cvWorkDates: "01 Jul 2023 - 30 Jun 2024",
      cvWorkStartDate: "2023-07-01",
      cvWorkEndDate: "2024-06-30",
      referenceName: "Dr Smith",
      referenceSource: "University",
      referencePhone: "+44 7700 900000",
      referenceEmail: "smith@example.com",
      passportNumber: "TEST1234567",
      passportDates: "10 Jan 2022 - 09 Jan 2032",
      passportIssueDate: "2022-01-10",
      passportPlaceOfIssue: "London",
      visaType: "Short Term Student Visa",
      visaCountry: "United Kingdom",
      visaPurpose: "Study",
      visaStartDate: "2026-08-05",
      visaEndDate: "2027-10-21",
      visaRefusalType: "Visitor Visa",
      visaRefusalCountry: "United States",
      visaRefusalPurpose: "Tourism",
      studyGapInstitution: "King's Academy",
      studyGapType: "Medical",
      studyGapStartDate: "September 2020",
      previousInstitution: "Example College",
      previousSubject: "Business",
      previousStudyCountryVisa: "United Kingdom - Student Visa",
    },
  );
});

test("CRM reader reads lead header cards, status and section flags", () => {
  const { fields } = readFixture("crm-profile-tab.html");
  assert.deepEqual(
    {
      leadRef: fields.leadRef,
      fileNumber: fields.fileNumber,
      counsellorName: fields.counsellorName,
      officeName: fields.officeName,
      studentPortalStatus: fields.studentPortalStatus,
      channel: fields.channel,
      registeredOn: fields.registeredOn,
      leadCreatedOn: fields.leadCreatedOn,
      studentQualitySummary: fields.studentQualitySummary,
      hasStudyGap: fields.hasStudyGap,
      hasWorkExperience: fields.hasWorkExperience,
      hasReference: fields.hasReference,
      hasPassport: fields.hasPassport,
      hasVisaRefusal: fields.hasVisaRefusal,
    },
    {
      leadRef: "Sep-26-2",
      fileNumber: "8398723",
      counsellorName: "Demo Admin UK",
      officeName: "Head Office",
      studentPortalStatus: "Approved",
      channel: "Instagram",
      registeredOn: "10 Sep 2026 1:06 PM",
      leadCreatedOn: "10 Sep 2026 1:06 PM",
      studentQualitySummary: "Excellent lead summary.",
      hasStudyGap: "Yes",
      hasWorkExperience: "Yes",
      hasReference: "Yes",
      hasPassport: "Yes",
      hasVisaRefusal: "No",
    },
  );
});

test("CRM reader merges both tabs with Profile precedence and first-record test scores", () => {
  const { fields } = readFixture("crm-profile-tab.html");
  // Profile wins on a shared key.
  assert.equal(fields.funding, "Self Funded");
  assert.equal(fields.studentQualitySummary, "Excellent lead summary.", "Hidden summary must not win");
  // Applications-only values survive the merge.
  assert.equal(fields.preferredDestination, "Canada");
  assert.equal(fields.preferredUniversity, "Example University");
  assert.equal(fields.preferredCourse, "MSc Data Science");
  assert.equal(fields.preferredStartYear, "2027");
  assert.equal(fields.preferredStartMonth, "September");
  assert.equal(fields.skypeId, "jake.skype");
  assert.equal(fields.whatsapp, "+8801712345678");
  // Admission "Institute Name" must not become the education institution.
  assert.equal(fields.institutionName, "Example Test University");
  // Only the first visible saved test record is read; hidden rows and a
  // different Applications test (PTE 80) must not mix into the IELTS record.
  assert.equal(fields.englishTestName, "IELTS");
  assert.equal(fields.overallScore, "7");
  assert.equal(fields.readingScore, "7.5");
  assert.notEqual(fields.readingScore, "80");
  assert.notEqual(fields.englishTestName, "GREGMAT");
});

test("CRM reader waits for a slow Profile section load", () => {
  const { fields } = readFixture("crm-profile-tab.html", "?delay=3500");
  assert.equal(fields.institutionName, "Example Test University");
  assert.equal(fields.visaType, "Short Term Student Visa");
  assert.equal(fields.readingScore, "7.5");
});

test("CRM reader does not turn an admission institute into the education institution", () => {
  const { fields } = readFixture("crm-profile-tab.html", "?emptyEducation=1");
  assert.equal(fields.preferredUniversity, "Example University");
  assert.equal("institutionName" in fields, false);
});

test("CRM reader reads the visible Applications form without a Profile tab", () => {
  const { fields } = readFixture("crm-profile-tab.html", "?noProfile=1");
  assert.equal(fields.preferredUniversity, "Example University");
  assert.equal(fields.preferredStartYear, "2027");
  assert.equal(fields.preferredDestination, "Canada");
  assert.equal("institutionName" in fields, false);
  assert.equal(fields.givenName, "Jake");
});

test("CRM reader does not borrow a missing Profile score from another test tab", () => {
  const { fields } = readFixture("crm-profile-tab.html", "?missingReading=1");
  assert.equal(fields.englishTestName, "IELTS");
  assert.equal("readingScore" in fields, false, "Applications PTE 80 must not fill an IELTS gap");
});

test("CRM reader does not merge a different attempt of the same test family", () => {
  const { fields } = readFixture("crm-profile-tab.html", "?missingReading=1&sameFamily=1");
  assert.equal(fields.englishTestName, "IELTS");
  assert.equal("readingScore" in fields, false, "A later IELTS attempt must not fill an older IELTS gap");
});

test("CRM reader maps a headerless References table to reference fields", () => {
  const { fields } = readFixture("crm-profile-tab.html", "?referenceTable=1");
  assert.equal(fields.referenceName, "Dr Smith");
  assert.equal(fields.referenceSource, "University");
  assert.equal(fields.referencePhone, "+44 7700 900000");
  assert.equal(fields.referenceEmail, "smith@example.com");
  assert.equal(fields.phone, "+244 456746456456", "Applicant phone must not take the referee phone");
  assert.equal(fields.email, "jake.mufoy.student@yopmail.com", "Applicant email must not take the referee email");
});

test("CRM reader refuses to copy when the Profile tab does not open", () => {
  const profile = readFixture("crm-profile-tab.html", "?brokenProfile=1");
  assert.match(profile.error || "", /Profile tab did not open/);
});

test("CRM reader derives dates from a headerless Visa Refusal duration", () => {
  const { fields } = readFixture("crm-profile-tab.html", "?refusalTable=1");
  assert.equal(fields.visaRefusalType, "Visitor Visa");
  assert.equal(fields.visaRefusalCountry, "United States");
  assert.equal(fields.visaRefusalPurpose, "Tourism");
  assert.equal(fields.visaRefusalDates, "01 Jan 2020 - 01 Jun 2020");
  assert.equal(fields.visaRefusalStartDate, "2020-01-01");
  assert.equal(fields.visaRefusalEndDate, "2020-06-01");
});

test("CRM reader splits a spaced UK postcode without corrupting the country", () => {
  const { fields } = readFixture(
    "crm-profile-tab.html",
    "?city=London&addr=10%20Downing%20Street%20London%20SW1A%202AA%20United%20Kingdom",
  );
  assert.equal(fields.location, "10 Downing Street");
  assert.equal(fields.postcode, "SW1A 2AA");
  assert.equal(fields.countryName, "United Kingdom");
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

test("CRM reader maps the Campora profile without unrelated Campora fields", () => {
  const profile = readFixture("campora-profile.html");
  assert.equal(profile.error, undefined);
  assert.equal(profile.studentId, "999999");
  assert.equal(profile.studentName, "Test Student");
  assert.deepEqual(
    profile.fields,
    {
      givenName: "Test",
      familyName: "Student",
      title: "Ms",
      gender: "Female",
      dateOfBirth: "2001-04-15",
      nationality: "Bangladeshi",
      maritalStatus: "Single",
      funding: "Self Funded",
      visaType: "Student Visa",
      hasVisaRefusal: "No",
      phone: "+880 1712345678",
      email: "test.student@example.com",
      emergencyName: "Test Guardian",
      emergencyFirstName: "Test",
      emergencyLastName: "Guardian",
      emergencyPhone: "+880 1711111111",
      emergencyEmail: "guardian@example.com",
      emergencyRelationship: "Parent",
      location: "2 Present Street, Test City",
      permanentAddress: "1 Test Street, Test City",
      referenceName: "Dr Ref",
      referenceEmail: "ref@example.com",
      referencePhone: "+44 7700 900000",
      institutionName: "Synthetic College",
      degree: "Bachelor Degree",
      major: "BSc Synthetic Science",
      grade: "3.50",
      studyDates: "Sep 2019 - Jun 2023",
      startDate: "Sep 2019",
      endDate: "Jun 2023",
      studyStartYear: "2019",
      studyEndYear: "2023",
      englishTestName: "IELTS",
      overallScore: "7.5",
      cvCurrentEmployer: "Synthetic Ltd",
      cvCurrentJobTitle: "Analyst",
      cvWorkStartDate: "2023-07-01",
      passportNumber: "TEST1234567",
      passportIssueDate: "2022-01-10",
      passportExpiryDate: "2032-01-09",
      preferredUniversity: "Synthetic University",
      preferredCourse: "MSc Synthetic Data",
      preferredIntake: "Sep 2026",
      preferredStartMonth: "Sep",
      preferredStartYear: "2026",
      studentId: "999999",
    },
  );
  // Exact permitted-key assertion: Campora's unconsumed fields must not enter the
  // cache, even though the reader sees them in the profile DOM.
  assert.deepEqual(Object.keys(profile.fields).sort(), [
    "cvCurrentEmployer",
    "cvCurrentJobTitle",
    "cvWorkStartDate",
    "dateOfBirth",
    "degree",
    "email",
    "emergencyEmail",
    "emergencyFirstName",
    "emergencyLastName",
    "emergencyName",
    "emergencyPhone",
    "emergencyRelationship",
    "endDate",
    "englishTestName",
    "familyName",
    "funding",
    "gender",
    "givenName",
    "grade",
    "hasVisaRefusal",
    "institutionName",
    "location",
    "major",
    "maritalStatus",
    "nationality",
    "overallScore",
    "passportExpiryDate",
    "passportIssueDate",
    "passportNumber",
    "permanentAddress",
    "phone",
    "preferredCourse",
    "preferredIntake",
    "preferredStartMonth",
    "preferredStartYear",
    "preferredUniversity",
    "referenceEmail",
    "referenceName",
    "referencePhone",
    "startDate",
    "studentId",
    "studyDates",
    "studyEndYear",
    "studyStartYear",
    "title",
    "visaType",
  ]);
  assert.equal(profile.fields.passportExpiryDate, "2032-01-09", "The relative summary must not replace the table date");
});

test("CRM reader reopens Campora's hidden, cached Profile pane on a second Copy", () => {
  const result = readFixture("campora-profile.html", "?twice=1");
  assert.equal(result.first.ok, true, result.first.error);
  assert.equal(result.second.ok, true, result.second.error);
  assert.equal(result.first.studentName, "Test Student");
  assert.equal(result.second.studentName, "Test Student");
  assert.equal(result.first.active, "Application", "Copy must restore the original tab");
  assert.equal(result.second.active, "Application", "Copy must restore the original tab");
  assert.deepEqual(result.second.keys, result.first.keys);
});

test("CRM reader rejects a non-profile Campora path", () => {
  const profile = readFixture("campora-profile.html", "?guard=1");
  assert.match(profile.error || "", /Open an individual student profile page before copying/);
});

test("Campora reader keeps both dates from a closed work range", () => {
  const { fields } = readFixture("campora-profile.html", "?workEnd=1");
  assert.equal(fields.cvWorkStartDate, "2023-07-01");
  assert.equal(fields.cvWorkEndDate, "2024-06-30");
});

test("Campora reader keeps the first test's full score breakdown", () => {
  const { fields } = readFixture("campora-profile.html", "?scores=1");
  assert.equal(fields.englishTestName, "IELTS");
  assert.equal(fields.testDate, "2025-03-01");
  assert.equal(fields.overallScore, "7.5");
  assert.equal(fields.listeningScore, "7");
  assert.equal(fields.readingScore, "7.5");
  assert.equal(fields.writingScore, "6.5");
  assert.equal(fields.speakingScore, "6.5");
});

test("Campora reader reads an already-open Profile pane", () => {
  const profile = readFixture("campora-profile.html", "?preopened=1");
  assert.equal(profile.error, undefined);
  assert.equal(profile.fields.givenName, "Test");
  assert.equal(profile.fields.institutionName, "Synthetic College");
});

test("Campora reader does not borrow a prior visa record", () => {
  const { fields } = readFixture("campora-profile.html", "?priorVisa=1");
  assert.equal(fields.visaType, "Student Visa");
  assert.equal("visaCountry" in fields, false);
  assert.equal("visaPurpose" in fields, false);
});

test("Campora reader waits for a delayed profile section", () => {
  const { fields } = readFixture("campora-profile.html", "?slowSections=1");
  assert.equal(fields.institutionName, "Synthetic College");
  assert.equal(fields.major, "BSc Synthetic Science");
});
