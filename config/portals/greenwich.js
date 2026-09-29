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
