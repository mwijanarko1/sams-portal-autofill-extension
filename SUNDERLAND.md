# University of Sunderland — Portal autofill readiness

**Portal:** https://apply.online.sunderland.ac.uk/  
**System:** Salesforce Experience Cloud (Lightning Web Components, open shadow DOM)  
**Account:** Bitwarden item `Sunderland Portal` (username only logged; password never stored here)  
**CRM student:** #5 Mikhail Wijanarko  
**Extension:** SAMS Portal Autofill **v2.3.8**  
**Last full field audit:** 2026-07-31 via ego-browser (live picklists verified)

## Stages

1. Create Account — complete  
2. **Your details** — mapped (live audit)  
3. **Academic and professional background** — mapped (live audit)  
4. **Evidence** — file uploads only (not CRM text autofill)  
5. Submit — **do not automate**

---

## Your details (step=1) — live field matrix

| Portal field | Type / name | CRM key | Live portal value | Status |
|---|---|---|---|---|
| Programme | text `fml_ProgramName__c` | preferredCourse / locked | MSc Computer Science with Cyber Security (Full-Time) | Portal pre-filled |
| Highest Qualification | combobox | `highestQualification` | **UK Masters degree** | Mapped |
| Other Qualification | text `UKOtherDegree__c` | — | (empty) | Only if needed |
| Do you have a university degree? | combobox | `hasUniversityDegree` | **Yes** | Mapped |
| Min. two years work experience? | combobox | `hasTwoYearsWorkExperience` | **No** | Mapped |
| Email | text `email` | email | account email | Pre-filled |
| Country Code | combobox | — | United Kingdom +44 | Pre-filled |
| Mobile Phone | tel `mobilephone` | phone | 7756526296 | Digits only (code separate) |
| Alternative Phone | tel `homephone` | — | optional | Skip |
| Title | combobox | `title` | **Mr** | Mapped |
| First Name | text `firstname` | `givenName` | Mikhail | Mapped |
| Middle Name(s) | text `middlename` | `middleName` | Orion | Mapped |
| Last Name | text `lastname` | `familyName` | Wijanarko | Mapped |
| Gender | combobox | `gender` | Male | Mapped |
| Birth Date | text `birthdate` | `dateOfBirth` | **6 Jan 2003** | Format **D MMM YYYY** (help: `31 Dec 2024`) — v2.3.4 |
| House/Flat + Street | text `MailingStreet` | `location` | **126 Henry Street** | Mapped |
| City/Town | text `mailingcity` | `city` | Sheffield | Mapped |
| Post Code | text `mailingpostalcode` | `postcode` | S3 7LU | Mapped |
| Country | combobox | `countryName` | United Kingdom | Mapped (+ full ISO alias) |
| Nationality | combobox | `nationality` | British (account) | CRM has Indonesian — skip if filled |
| Dual Nationality | combobox | — | optional | Skip |
| Country of Residence | combobox | `countryName` | United Kingdom of Great Britain and Northern Ireland (the) | Mapped |
| Funding | combobox | `funding` | **Self-Funding** | Exclusive match (v2.3.7) — not preferredCourse |
| Other funding source | text `Otherfundingsource__c` | `otherFundingSource` (empty) | empty when Self-Funding | Never fill with Self-Funding |
| Previously graduated Sunderland? | checkbox | — | unchecked | Leave |

---

## Academic and professional background (step=2)

Open **Add Academic History → Higher Education** and **Add Employment History** before Autofill when forms are collapsed.

### Academic History (live values)

| Portal field | Type | CRM key | Exact portal option / value |
|---|---|---|---|
| Qualification Level | combobox | `qualificationLevel` | **Higher Education** |
| Organisation | combobox | `institutionName` | The University of Sheffield |
| Country you studied in | combobox | `studyCountry` | United Kingdom of Great Britain and Northern Ireland (the) |
| Month Year From | text `mm-yyyy` | `startDate` / `studyFromMonthYear` | **09-2021** |
| Month Year To | text `mm-yyyy` | `endDate` / `studyToMonthYear` | **06-2025** |
| Qualification Type | combobox | `qualificationType` | **MENG** |
| Program Title/Subject | combobox | `major` | Aerospace Engineering |
| Grade | combobox | `grade` | **Upper Second** |
| Award Status | combobox | `awardStatus` | **Awarded** |

### Live picklists (verified 2026-07-31)

**Grade:** First Class · Upper Second · Lower Second · Third Class · Unclassified · Aegrotat · Commendation · Distinction · Merit · Pass · Failed Award · Other  

**Qualification Type (sample):** BA (Hons) · BSc (Hons) · BA · BENG · BENG (Hons) · MA · MBA · **MENG** · MSc · MSci · MPhil · PhD · PGDip · PGCert · …  

**Award Status:** Awarded · Exam to be taken · Pending Award · Still Studying · Not Awarded  

**Qualification Level (Academic History):** Higher Education (from Add Academic History → Higher Education). This is **not** the same as step-1 Highest Qualification.

**Sheffield official text → portal Grade:**  
`Class Two Division One Honours` (= UK 2:1) → portal **`Upper Second`**. Extension aliases expand 2:1 / Upper Second Class Honours → Upper Second.

### Employment History

| Portal field | Type / name | CRM key | Demo value |
|---|---|---|---|
| Organisation | text `Organisation__c` | `cvCurrentEmployer` | Pivot2Tech |
| Country | combobox | `employmentCountry` | United Arab Emirates (+ full ISO alias) |
| Job Title | text `jobtitle__c` | `cvCurrentJobTitle` | Software Engineer Intern (not salutation `title`/Mr — fixed v2.3.5) |
| Month Year From | text `mm-yyyy` | `cvWorkStartDate` | 12-2025 |
| Month Year To | text `mm-yyyy` | `cvWorkEndDate` | 12-2026 |
| Present Employment | checkbox `present__c` | `presentEmployment` | Unsupported — checkbox is excluded from scanning; set manually |

### English language skills

| Portal field | Type / name | CRM key | Demo value |
|---|---|---|---|
| Is English your first language? | combobox | `englishFirstLanguage` | Yes |
| Other English Language Experience | text `OtherEnglishLanguageExperience__c` | **`otherEnglishLanguageExperience` only** | Degree taught and assessed in English: MEng Aerospace Engineering, The University of Sheffield (Upper Second, 2021–2025). |

**Mapping rules (v2.3.6):**
- Other English is **exclusive** to `otherEnglishLanguageExperience` (not nationality, work experience, IELTS scores, or first-language Yes/No).
- Autocomplete `language` → nationality was removed (it stole English fields).
- Value is medium-of-instruction evidence (portal list includes “Degree in English”), not job history.

**Disambiguation:** Academic vs Employment both use “Organisation” and “Month Year From/To”. Extension uses section detection (Academic history / Employment history + `Organisation__c` / `jobtitle__c`).

---

## Evidence (step=3) — file uploads only

| Document | Type | CRM mapping |
|---|---|---|
| Degree Certificate | file | Not autofilled (manual / separate upload) |
| English Language Certification | file | Not autofilled |
| CV (Work Experience Entry Route) | file | Not autofilled |
| Degree Transcript | file | Not autofilled |
| Competency Based Questionnaire | file | Not autofilled |

Extension never submits and does not implement file upload in MVP.

---

## CRM values for student #5 (after re-seed)

| Key | Value |
|---|---|
| grade | Upper Second |
| qualificationLevel | Higher Education |
| qualificationType | MENG |
| highestQualification | UK Masters degree |
| awardStatus | Awarded |
| studyCountry | United Kingdom of Great Britain and Northern Ireland (the) |
| funding | Self-Funding |
| hasUniversityDegree | Yes |
| location | 126 Henry Street |
| city | Sheffield |
| postcode | S3 7LU |
| dateOfBirth | 2003-01-06 → portal **6 Jan 2003** |

---

## Gaps / caveats

1. **Combobox option latency** — v2.3.8 waits briefly for Lightning options and scopes to the open listbox; re-run Autofill if a list never opened.  
2. **Nationality** — portal account may show British; CRM Indonesian. Extension skips non-empty.  
3. **Evidence** — uploads only; not text-mapped.  
4. **Present Employment checkbox** — unsupported; checkboxes are excluded from scanning and must be set manually.  
5. **Skip-if-filled** — wrong values already on the form need clear then Autofill; empty second-best fields can still fill.  
6. **Phone** — mobile is national number; country code is a separate combobox.

## Performance (v2.3.8)

- Ping-before-inject; parallel frame messages  
- Lean auto-scan (count only; no fieldMap enrichment)  
- Precomputed synonyms + per-field match meta  
- Scoped Lightning option pick (not whole-document catalogs)  
- Honest combobox success (failed pick → skipped, not “filled”)

## Demo steps for meeting

1. CRM running (`npm run dev` on :3000).  
2. Chrome: reload unpacked extension **v2.3.8**.  
3. Log into Sunderland portal.  
4. Open **Your details** → student **#5 Mikhail** → **Autofill This Page**.  
5. Open **Academic** stage → **Edit** academic row (or Add Higher Education) → Autofill again.  
6. Open **Add Employment History** → Autofill.  
7. Review comboboxes; re-run once if needed.  
8. **Never** click final Submit from automation.

## Security notes

- Do not commit Bitwarden secrets.  
- Temp login env files should be deleted after use.  
- Extension never submits forms.
