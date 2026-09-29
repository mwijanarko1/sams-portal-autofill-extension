# Ulster University QA — Portal autofill readiness

**Applicant portal:** https://apply.qahighereducation.com/  
**Course marketing site:** https://qa.ulster.ac.uk/  
**System:** Salesforce Experience Cloud + Flow (`flowruntime-*`, LWC, **closed** shadow picklists)  
**Account:** Bitwarden item `Ulster University QA` (password never stored here)  
**CRM student:** #5 Mikhail Wijanarko  
**Extension:** SAMS Portal Autofill **v2.3.10**  
**Last full field audit:** 2026-07-31 via ego-browser  

> Agent portal (`agent.qahighereducation.com`) is a separate login; this map is for the **applicant** application journey.

### Application split (same Bitwarden account)

| Role | App # | Course | URL | Notes |
|---|---|---|---|---|
| **Agent / fixing** | **APP-213476** | MBA - London Rosebery Avenue - Daytime 09/2026 | https://apply.qahighereducation.com/s/application/a0UTv00000a8D1nMAE/app213476 | Agent workspace — may have partial fills from mapping work |
| **Demo** | **APP-213478** | MBA - Birmingham Louisa Ryland House - Daytime 09/2026 | https://apply.qahighereducation.com/s/application/a0UTv00000a8N7ZMAU/app213478 | **Empty** (0%) — keep clean for demos |
| **User test** | **APP-213479** | MBA - Manchester Saint James - Daytime 09/2026 | https://apply.qahighereducation.com/s/application/a0UTv00000a8Ml0MAE/app213479 | **Empty** (0%) — your testing now |

Do not use APP-213478 for agent experiments. Prefer APP-213476 when fixing autofill.

---

## Stages (application journey)

1. **Start Application** from course product page (e.g. MBA)  
2. **Personal Details** — mapped (live audit)  
3. **Contact Details** — mapped (live audit; **Add New** nominated/emergency required)  
4. **Address** — open form / Add New when present; standard address CRM keys  
5. **Medical Conditions** — leave manual (sensitive / not in CRM demo)  
6. **Employment Details** — expand / Add New first; same CV keys as Sunderland  
7. **Education Details** — expand / Add New first; same education keys as Sunderland  
8. **Personal Statement** — `personalStatement` / `cvProfessionalSummary`  
9. **Review & Submission** — **do not automate submit**

Re-run **Autofill This Page** on each step (multi-step wizard). Open every **Add New** / expand form **before** Autofill so fields are in the DOM.

---

## Personal Details — live field matrix

| Portal field | Type / name | CRM key | Live portal option / value | Status |
|---|---|---|---|---|
| Name | read-only | — | Profile / passport name | Portal pre-filled |
| Date of Birth | read-only | — | Profile DOB | Portal pre-filled |
| **Title** | select `Salutation` | `title` | **Mr.** (period) | Mapped — aliases Mr / Mr. |
| **Nationality** | select `Nationality` | `nationality` | **Indonesia** | Mapped |
| **Ethnicity** | select `Ethnicity` | `ethnicity` | **Any other Asian background** | Mapped |
| **Sex Identifier** | select `Sex_Identifier` | `gender` | **Male** | Mapped (exclusive) |
| **Dependants** | select `Dependants` | `dependants` | **No Dependants** | Mapped |
| **Current Domicile** | select `Current_Domicile` | `currentDomicile` | **United Kingdom** | Mapped |
| **Fee Payment Method** | radio | `funding` | **Self Funding** (no hyphen) | Mapped — radio + aliases |
| **Previously applied / enrolled Ulster or QAHE?** | radio Yes/No | `previouslyApplied` | **No** | Mapped |
| **Document Number** (passport) | text | `passportNumber` | **C8123456** | Mapped — Ulster labels passport as Document Number |

**Note:** Closed-shadow `<select>` picklists require Chrome `chrome.dom.openOrClosedShadowRoot` (v2.3.9+ pierce). Reload unpacked extension after upgrade.

### Live picklists (verified 2026-07-31)

**Title:** None (Blank) · Dr. · Lord · Miss · Ms. · **Mr.** · Mrs. · MX · Senior · Other  

**Sex Identifier:** Male · Female · Other · Information Refused · Not Available  

**Dependants:** No Dependants · Young People/Children · Other Relative/Friends · Both Young people/children & Other relative/friends · Prefer not to say · Not available  

**Fee Payment Method:** Self Funding · Sponsorship  

**Ethnicity (sample):** Any other Asian background · Asian - Indian or Indian British · Black - African or African British · Prefer not to say · White - British… · …

---

## Contact Details — live field matrix

| Portal field | Type | CRM key | Demo value | Status |
|---|---|---|---|---|
| Email | read-only | email | account email | Pre-filled from profile |
| **Phone Country Code** | lookup combobox | `phoneCountryCode` | **United Kingdom (+44)** | Mapped — must pick list option |
| **Phone** | tel | `phone` | national digits | Mapped (strips +44) |
| **Mobile Country Code** | lookup combobox | `phoneCountryCode` | **United Kingdom (+44)** | Same key (both fields) |
| **Mobile** | tel | `phone` | national digits | Same key |
| **Known by any other name?** | radio Yes/No | `previousName` | **No** | Mapped |

Portal error if missing emergency contact:  
*“You must add an Emergency Contact before continuing. Please click Add New.”*

---

## Contact Details → Add New — NEW NOMINATED CONTACT (live 2026-07-31)

Open **Add New** on Nominated Contacts, then **Autofill This Page** again (fields only exist while the form is open).

| Portal field | Type / API name | CRM key | Live portal option / value | Status |
|---|---|---|---|---|
| **Relationship To You?** | radio `New_Relationship_To_You` | `emergencyRelationship` | **Parent** | Mapped (exclusive) |
| **First Name** | text `New_contact_First_Name` | `emergencyFirstName` | **Siti** | Mapped (not applicant givenName) |
| **Last Name** | text `New_contact_Last_Name` | `emergencyLastName` | **Wijanarko** | Mapped (not applicant familyName) |
| **Phone Country Dialing Code** | lookup | `emergencyPhoneCountryCode` | **United Kingdom (+44)** | Mapped (not main phoneCountryCode) |
| **Phone** | tel | `emergencyPhone` | national digits | Mapped (exclusive to modal) |
| **Email** | text `New_text_Contact_Email` | `emergencyEmail` | demo parent email | Mapped (not applicant email) |
| **Date of Birth** | text `New_u18_Date_of_Birth` | `emergencyDateOfBirth` | **15 Mar 1975** (Format: 31 Dec 2024) | Mapped (not applicant DOB) |
| **Special Instructions** | text `Special_Instructions` | `emergencySpecialInstructions` | (empty optional) | Mapped when CRM has value |

**Relationship radios (exact labels):** Parent · Guardian · Host · Grandparent · Spouse · Sibling · Other · Next of Kin  

Internal option values seen live: `parentPicklist`, `guardianPicklist`, `hostPicklist`, `choice_Grandparent`, `choice_Spouse`, `choice_Sibling`, `choice_Other`, `choice_NextofKin`.

**After fill:** click portal **Save** on the modal (extension never clicks Save). Then **Save & Continue** on Contact Details when ready.

**Portal quirk:** Add New may briefly show Salesforce *“Sorry to interrupt – CSS Error”*; dismiss/refresh if needed — the modal form can still be present underneath.

---

## Later steps (shared heuristics)

Wizard often blocks later steps until Contact (with emergency) is complete. Open each **Add New** / expand row before Autofill.

| Section | CRM keys | Notes |
|---|---|---|
| Address | `location`, `city`, `postcode`, `countryName`, `state` | Standard UK address synonyms |
| Employment | Open **Add New** first | See matrix below |

### Employment Details → Add New — NEW EMPLOYMENT HISTORY (live 2026-07-31)

| Portal field | Type | CRM key | Demo value | Status |
|---|---|---|---|---|
| This is my current employment | checkbox | `presentEmployment` | No | Checkbox skip (manual if needed) |
| **Company Name** | text | `cvCurrentEmployer` | Pivot2Tech | Mapped |
| Employer's Name | text | `employerContactName` | Hiring Manager | Mapped (optional) |
| Employer's Email | text | `employerContactEmail` | demo email | Mapped (optional) |
| Employer's Phone | tel | `employerContactPhone` | demo phone | Mapped (optional) |
| **Employment Start Date** | date | `cvWorkStartDate` | 1 Dec 2025 | Mapped (Format: 31 Dec 2024) |
| **Employment End Date** | date | `cvWorkEndDate` | 1 Dec 2026 | Mapped |
| **Employment Occupation** | SOC lookup | `occupation` | **Programmers and Software Development Professionals** | Mapped — not free-typed job title |
| **My Job Description** | textarea | `cvJobDescription` | role summary | Mapped |
| **My Main Responsibilities** | textarea | `mainResponsibilities` | bullet responsibilities | Mapped |

Occupation is a searchable picklist (typed “Software” → *Programmers and Software Development Professionals*).
| Education | Open **Add New** first | See matrix below |

### Education Details → Add New — NEW EDUCATION HISTORY (live 2026-07-31)

| Portal field | Type | CRM key | Demo value | Status |
|---|---|---|---|---|
| **Education Institution** | search lookup | `institutionName` | **The University of Sheffield** | Mapped |
| **Qualification** | search / text | `degree` | MEng Aerospace Engineering | Mapped |
| **Results** | radio | `awardStatus` | **Completed** | Mapped (Completed / In Progress) |
| **Country** | select `picklist_Country` | `studyCountry` | **United Kingdom** | Mapped (short label, not long ISO) |
| **Start Year** | select `pickist_Start_Year` | `studyStartYear` | **2021** | Mapped (year-only) |
| **End Year** | select `picklist_End_Year` | `studyEndYear` | **2025** | Mapped (year-only) |

Year selects are **YYYY only** (not full dates). ISO CRM dates still expand to the year via aliases.
| Personal Statement | `personalStatement`, `cvProfessionalSummary` | Free text |
| Medical | — | Manual |
| Review & Submit | — | Never auto-submit |

---

## CRM values for student #5 (after re-seed)

| Key | Value |
|---|---|
| title | Mr → portal **Mr.** |
| nationality | Indonesian → **Indonesia** |
| ethnicity | Any other Asian background |
| gender | Male |
| dependants | No Dependants |
| currentDomicile | United Kingdom |
| funding | Self-Funding → portal **Self Funding** |
| phoneCountryCode | United Kingdom (+44) |
| previouslyApplied | No |
| previousName | No |
| phone | from CRM contact phones |
| personalStatement | professional summary text |
| **emergencyFirstName** | Siti |
| **emergencyLastName** | Wijanarko |
| **emergencyName** | Siti Wijanarko |
| **emergencyRelationship** | Parent |
| **emergencyEmail** | siti.wijanarko.demo@example.com |
| **emergencyPhone** | +44 7700 900221 |
| **emergencyPhoneCountryCode** | United Kingdom (+44) |
| **emergencyDateOfBirth** | 1975-03-15 → portal **15 Mar 1975** |

`emergency_contacts` table row matches the above (name / relationship / phone / email). Extra portal-only keys live in `extra_fields_json`.

---

## Gaps / caveats

1. **Closed shadow DOM** — pierces via `chrome.dom.openOrClosedShadowRoot`. Confirm unpacked **v2.3.10** reload.  
2. **Country code / dialing code lookups** — free-typed text is not enough; extension opens list and clicks **United Kingdom (+44)**.  
3. **Emergency modal** — must open **Add New** before Autofill; exclusive locks keep applicant vs nominated fields separate.  
4. **Medical conditions** — not mapped (leave manual).  
5. **Address / Employment / Education Add New** — use shared Sunderland-style keys once forms are expanded; re-audit if a step uses unusual labels.  
6. **Skip-if-filled** — wrong pre-filled values need clear then Autofill.  
7. **Never submits** — counsellor reviews; no Save / Save & Continue / Submit automation.

## Performance / tech (v2.3.10 Ulster)

- Closed + open shadow deep scan  
- Native `<select>` value setter + `change` for Flow picklists  
- Radio group fill (Yes/No, Fee Payment Method, **Relationship To You**)  
- `aria-autocomplete=list` treated as Lightning-style combobox  
- Nominated-modal detection so bare *Phone / *Email / *First Name* map to emergency keys  
- Exclusive match locks: Sex Identifier, Ethnicity, Dependants, Domicile, Phone Country Code, previous apply/name, **full nominated modal set**

## Demo steps for meeting

1. CRM running (`npm run dev` on :3000); re-seed student #5 if needed (`node scripts/seed-mikhail-profile.mjs`).  
2. Chrome: reload unpacked extension **v2.3.10**.  
3. Log into https://apply.qahighereducation.com (Bitwarden Ulster University QA).  
4. Open draft application on **Personal Details** → student **#5** → **Autofill This Page**.  
5. **Contact Details** → Autofill phones / previous name → **Add New** emergency → **Autofill again** → portal **Save** on modal.  
6. Continue step-by-step; open **Add New** on Address / Employment / Education when shown; re-run Autofill on each page.  
7. **Never** click final Submit from automation.

## Security notes

- Do not commit Bitwarden secrets.  
- Extension never submits forms.  
- Local CRM only.
