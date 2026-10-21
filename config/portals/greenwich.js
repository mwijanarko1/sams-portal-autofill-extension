{
globalThis.SAMS_PORTALS = globalThis.SAMS_PORTALS || [];
const config = {
  id: "greenwich",
  name: "University of Greenwich",
  origins: ["https://nelson.gre.ac.uk"],
  pageMatchers: [
    "bwskalog",
    "bwskanam",
    "bwskaadr",
    "bwskapcl",
    "bwskapln",
    "bwskaess",
    "bwskaudf",
    "bwskaper",
    "bwskaedu",
    "bwskates",
    "P_DispNewApp",
    "P_DispChoices",
    "P_ProcIndex",
    "P_DispIndex",
  ],
  // Only selectors unique to applicant CRM fields on a single page type.
  // No dateOfBirth: three selects (#bday_*) need split-date + section support first.
  // No location/city/postcode: #addr1/#city/#zip also appear on institution address.
  selectorOverrides: {
    givenName: ["#fname"],
    middleName: ["#mname"],
    familyName: ["#lname"],
    previousName: ["#plname"],
    title: ["#pfx"],
    passportNumber: ["#ud135"],
    // Applicant email only (not referee #ud18)
    email: ["#email", "#dup_email"],
    gender: ["#gender"],
    nationality: ["#ud65"],
    countryOfBirth: ["#ud60"],
    // Applicant phones only (not referee #ud25)
    phone: ["#mobiletelno", "#hometelno"],
    institutionName: ["#col_name"],
    // CRM reader emits "degree" for Qualification / Academic Level
    degree: ["#ud91qualtype"],
    major: ["#ud91subject"],
    grade: ["#ud91grade"],
    preferredCourse: ["#p_program_code"],
    cvCurrentEmployer: ["#ud11"],
    personalStatement: ["#p_sarstmt_desc"],
    funding: ["#ud35"],
  },
  // No separate country-code field: phone values keep their dialling prefix.
  phoneKeepsDialPrefix: true,
  // Keep synonyms narrow; avoid generic "e-mail address" / "address line 1"
  // which match referee and education institution fields.
  extraSynonyms: {
    givenName: ["first name"],
    middleName: ["middle name"],
    familyName: ["family name", "last name"],
    previousName: [
      "previous name (first name + middle name + family name)",
    ],
    title: ["title"],
    passportNumber: ["passport number (non eu applicants only)"],
    email: ["verify e-mail address"],
    gender: ["gender"],
    nationality: ["nationality"],
    countryOfBirth: ["country of birth"],
    phone: ["mobile telephone no.", "home telephone no."],
    institutionName: ["institution name"],
    degree: ["level"],
    major: ["subject including modules or units"],
    grade: ["grade leave blank if pending"],
    preferredCourse: ["programme of study"],
    cvCurrentEmployer: ["name and address of employer"],
    personalStatement: ["personal statement (max 3950 characters)"],
    funding: ["who do you expect to pay your fees?"],
  },
  // Optional fill-all (draft saves), from the 2026 supervised navigation inventory. The checklist
  // (bwskalog.P_DispIndex) links to data-entry sections by GET, each carrying the application number
  // (appno). A section posts to its own P_Proc* page through the exact Continue submit (matched by
  // name and value: the id submit_btn is duplicated on the address form). Fill all never opens
  // Signature, never presses Application is Complete or Finish Later on the checklist, and never
  // takes the address Search or Delete controls. Referee Details is left out: every field in it is
  // blocked above, so there is nothing to fill. The live response after Continue is unverified.
  fillAll: {
    kind: "checklist-link",
    bind: { field: "appno" },
    hub: { path: "/pls/prod/bwskalog.P_DispIndex", links: "a.submenulinktext2[href]" },
    steps: [
      { id: "name", label: "Name", path: "/pls/prod/bwskanam.P_DispAppName" },
      { id: "employment", label: "Employment and supporting information", path: "/pls/prod/bwskaess.P_DispAppEssay" },
      { id: "permanent-address", label: "Permanent Address", path: "/pls/prod/bwskaadr.P_DispAppAddr1" },
      { id: "mailing-address", label: "Mailing Address", path: "/pls/prod/bwskaadr.P_DispAppAddr2" },
      { id: "qualifications", label: "Qualifications", path: "/pls/prod/bwskapcl.P_DispQuals" },
      { id: "statistical", label: "Statistical Information", path: "/pls/prod/bwskaper.P_DispAppPersonal" },
      { id: "education", label: "Previous or Current Education", path: "/pls/prod/bwskapcl.P_DispAppPrvCollege" },
      { id: "programme", label: "Programme Information", path: "/pls/prod/bwskapln.P_DispAppPlan" },
    ],
    save: { controls: "input[type='submit'][name='submit_btn']", text: "^continue$" },
  },
  // #bday_* is date of birth on Statistical Information but employment start on Employment.
  splitDates: [
    { key: "dateOfBirth", page: "bwskaper\\.P_DispAppPersonal", day: "#bday_dd", month: "#bday_mm", year: "#bday_yyyy" },
    { key: "cvWorkStartDate", page: "bwskaess\\.P_DispAppEssay", day: "#bday_dd", month: "#bday_mm", year: "#bday_yyyy" },
    { key: "cvWorkEndDate", page: "bwskaess\\.P_DispAppEssay", day: "#bday_dd2", month: "#bday_mm2", year: "#bday_yyyy2" },
  ],
  blockedControls: [
    // Auth
    "#login_id",
    "#pin_id",
    "#verify_pin_id",
    "input[name='in_id']",
    "input[name='pin']",
    "input[name='newid']",
    "input[name='newpin']",
    "input[name='verifypin']",
    "input[name='submit_btn']",
    ".g-recaptcha",
    "textarea[name='g-recaptcha-response']",
    // Submits / navigation that must stay manual
    "input[type='submit']",
    "input[value='Continue']",
    "input[value='Submit']",
    "input[value='Fill Out Application']",
    "#search_btn",
    "a[href*='DispLogout']",
    "a[href*='P_DispLogout']",
    "a[href*='Signature']",
    // Signature agreements
    "#ud130",
    "#ud131",
    // Split DOB / employment date selects until section-aware split fill exists
    "#bday_dd",
    "#bday_mm",
    "#bday_yyyy",
    "#bday_dd2",
    "#bday_mm2",
    "#bday_yyyy2",
    // Institution address on Previous / Current Education (same #city/#zip as applicant address)
    "form[action*='P_ProcAppPrvCollege'] #city",
    "form[action*='P_ProcAppPrvCollege'] #zip",
    "form[action*='P_ProcAppPrvCollege'] #natn",
    // Referee Details (must not receive applicant CRM contact values)
    "#ud17",
    "#ud18",
    "#ud19",
    "#ud20",
    "#ud21",
    "#ud22",
    "#ud23",
    "#ud24",
    "#ud25",
    "#ud26",
    "#ud27",
    "#ud28",
    "#ud29",
    "#ud30",
    // Qualification rows 2-20 (#ud92*..#ud110*): CRM holds one qualification,
    // so only row 1 may fill; otherwise a repeat click duplicates it into row 2.
    ...Array.from({ length: 19 }, (_, i) =>
      ["qualtype", "subject", "grade", "month", "year"].map((field) => `#ud${92 + i}${field}`)
    ).flat(),
  ],
};
const index = globalThis.SAMS_PORTALS.findIndex((portal) => portal.id === config.id);
if (index === -1) globalThis.SAMS_PORTALS.push(config);
else globalThis.SAMS_PORTALS[index] = config;
}
