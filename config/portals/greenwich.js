{
globalThis.SAMS_PORTALS = globalThis.SAMS_PORTALS || [];
const config = {
  id: "greenwich",
  name: "University of Greenwich",
  origins: ["https://nelson.gre.ac.uk"],
  pageMatchers: [
    "bwskalog", "bwskanam", "bwskaadr", "bwskapcl", "bwskapln",
    "bwskaess", "bwskaudf", "bwskaper", "bwskaedu", "bwskates",
    "P_DispNewApp", "P_DispChoices", "P_ProcIndex", "P_DispIndex",
  ],
  selectorOverrides: {
  "givenName": [
    "#fname"
  ],
  "middleName": [
    "#mname"
  ],
  "familyName": [
    "#lname"
  ],
  "previousName": [
    "#plname"
  ],
  "title": [
    "#pfx"
  ],
  "passportNumber": [
    "#ud135"
  ],
  "email": [
    "#email",
    "#dup_email"
  ],
  "gender": [
    "#gender"
  ],
  "dateOfBirth": [
    "#bday_dd",
    "#bday_mm",
    "#bday_yyyy"
  ],
  "nationality": [
    "#ud65"
  ],
  "countryOfBirth": [
    "#ud60"
  ],
  "city": [
    "#city"
  ],
  "postcode": [
    "#zip"
  ],
  "phone": [
    "#mobiletelno",
    "#hometelno"
  ],
  "location": [
    "#addr1"
  ],
  "institutionName": [
    "#col_name"
  ],
  "qualificationLevel": [
    "#ud91qualtype"
  ],
  "major": [
    "#ud91subject"
  ],
  "grade": [
    "#ud91grade"
  ],
  "preferredCourse": [
    "#p_program_code"
  ],
  "cvCurrentEmployer": [
    "#ud11"
  ],
  "personalStatement": [
    "#p_sarstmt_desc"
  ],
  "funding": [
    "#ud35"
  ]
},
  extraSynonyms: {
  "givenName": [
    "first name"
  ],
  "middleName": [
    "middle name"
  ],
  "familyName": [
    "family name",
    "last name"
  ],
  "previousName": [
    "previous name (first name + middle name + family name)"
  ],
  "title": [
    "title"
  ],
  "passportNumber": [
    "passport number (non eu applicants only)"
  ],
  "email": [
    "e-mail address",
    "verify e-mail address"
  ],
  "gender": [
    "gender"
  ],
  "dateOfBirth": [
    "date of birth"
  ],
  "nationality": [
    "nationality"
  ],
  "countryOfBirth": [
    "country of birth"
  ],
  "city": [
    "town",
    "city"
  ],
  "postcode": [
    "postcode"
  ],
  "phone": [
    "mobile telephone no.",
    "home telephone no."
  ],
  "location": [
    "address",
    "street1",
    "address line 1"
  ],
  "institutionName": [
    "institution name"
  ],
  "qualificationLevel": [
    "level"
  ],
  "major": [
    "subject including modules or units"
  ],
  "grade": [
    "grade leave blank if pending"
  ],
  "preferredCourse": [
    "programme of study"
  ],
  "cvCurrentEmployer": [
    "name and address of employer"
  ],
  "personalStatement": [
    "personal statement (max 3950 characters)"
  ],
  "funding": [
    "who do you expect to pay your fees?"
  ]
},
  blockedControls: [
    "#login_id", "#pin_id", "#verify_pin_id",
    "input[name='in_id']", "input[name='pin']",
    "input[name='newid']", "input[name='newpin']", "input[name='verifypin']",
    "input[name='submit_btn']", "input[type='submit']",
    "input[value='Continue']", "input[value='Submit']",
    "input[value='Fill Out Application']",
    "#search_btn",
    "a[href*='DispLogout']", "a[href*='P_DispLogout']",
    "a[href*='Signature']",
    "#ud130", "#ud131",
    ".g-recaptcha", "textarea[name='g-recaptcha-response']",
  ],
};
const index = globalThis.SAMS_PORTALS.findIndex((portal) => portal.id === config.id);
if (index === -1) globalThis.SAMS_PORTALS.push(config);
else globalThis.SAMS_PORTALS[index] = config;
}
