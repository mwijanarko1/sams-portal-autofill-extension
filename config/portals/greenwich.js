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
  // Only selectors for applicant CRM fields. Split dates are filled only by splitDates;
  // generic matching never touches them. Applicant address ids are reused on Previous /
  // Current Education (institution address), so those controls are blocked by form action.
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
    ethnicity: ["#ethn"],
    // Applicant phones only (not referee #ud25)
    phone: ["#mobiletelno", "#hometelno"],
    // Applicant address (Permanent and Mailing); institution address is blocked
    location: ["#addr1"],
    city: ["#city"],
    postcode: ["#zip"],
    countryName: ["#natn"],
    state: ["#ud70"],
    institutionName: ["#col_name"],
    // CRM reader emits "degree" for Qualification / Academic Level
    degree: ["#ud91qualtype"],
    major: ["#ud91subject"],
    grade: ["#ud91grade"],
    preferredCourse: ["#p_program_code"],
    preferredRoute: ["#p_mode_poe"],
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
  // #bday_* is date of birth on Statistical Information but employment start on Employment.
  splitDates: [
    { key: "dateOfBirth", page: "bwskaper\\.P_DispAppPersonal", form: "bwskaper\\.P_ProcAppPersonal", day: "#bday_dd", month: "#bday_mm", year: "#bday_yyyy" },
    { key: "cvWorkStartDate", page: "bwskaess\\.P_DispAppEssay", form: "bwskaess\\.P_ProcAppEssay", day: "#bday_dd", month: "#bday_mm", year: "#bday_yyyy" },
    { key: "cvWorkEndDate", page: "bwskaess\\.P_DispAppEssay", form: "bwskaess\\.P_ProcAppEssay", day: "#bday_dd2", month: "#bday_mm2", year: "#bday_yyyy2" },
    { key: "startDate", page: "bwskapcl\\.P_DispAppPrvCollege", form: "bwskapcl\\.P_ProcAppPrvCollege", day: "#beg_date_dd", month: "#beg_date_mm", year: "#beg_date_yyyy" },
    { key: "endDate", page: "bwskapcl\\.P_DispAppPrvCollege", form: "bwskapcl\\.P_ProcAppPrvCollege", day: "#end_date_dd", month: "#end_date_mm", year: "#end_date_yyyy" },
    { key: "endDate", page: "bwskapcl\\.P_DispQuals", form: "bwskapcl\\.P_ProcQuals", month: "#ud91month", year: "#ud91year" },
    { key: "graduationYear", page: "bwskapcl\\.P_DispQuals", form: "bwskapcl\\.P_ProcQuals", year: "#ud91year" },
    { key: "preferredIntake", page: "bwskapln\\.P_DispAppPlan", form: "bwskapln\\.P_ProcAppPlan", month: "#p_month", year: "#p_year" },
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
    // Name: fields with no CRM key (agent reference, previous student number, legal name, previous-apply)
    "#ud50",
    "#ud2",
    "#ud3",
    "input[name='ud1']",
    // Employment: job description and full/part-time have no CRM key
    "#ud16",
    "#ud12",
    // Statistical Information: sensitive or application-specific answers
    "#medi",
    "#ud80",
    "input[name='ud4']",
    "input[name='ud5']",
    "#ud204",
    "input[name='ud204']",
    "#addrflag",
    "input[name='addrflag']",
    "#euk_dd",
    "#euk_mm",
    "#euk_yyyy",
    "#ud8",
    "#ud40",
    "#ud45",
    // Address lines 2/3 have no CRM key; institution address must not take the applicant address
    "#addr2",
    "#addr3",
    "form[action*='P_ProcAppPrvCollege'] #addr1",
    // Qualification award date selects are split-date targets
    "#ud91month",
    "#ud91year",
    // Previous / Current Education attendance dates are split-date targets
    "#beg_date_dd",
    "#beg_date_mm",
    "#beg_date_yyyy",
    "#end_date_dd",
    "#end_date_mm",
    "#end_date_yyyy",
    // Programme entry month/year are split-date targets; teacher-training subject has no CRM key
    "#p_month",
    "#p_year",
    "#ud138",
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
