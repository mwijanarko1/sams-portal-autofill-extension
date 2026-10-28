# Bangor University portal field map

Mapping update: 2026-10-28. Passport nation now follows nationality, and UK visa refusal uses UK-specific evidence or an explicit no-refusal-history value. See [approved rules](APPROVED-RULES.md). Inventory and historical live checks below keep their original dates; the new rules have synthetic extension coverage.

**Origin:** `https://apps.bangor.ac.uk`
**Login used for inventory:** agent apply account at `/apply/account/login/?next=/apply/agent/`
**Inventory date:** 2026-10-23 (full re-inventory; supersedes 2026-10-08)
**Config:** `config/portals/bangor.js`
**Raw captures:** not in this repository (they can contain applicant-like data); this document records the inventory by result.

## Journey shape

After sign-in the application hub is `/apply/menu/`. Sections:

| Nav label | Path | Status |
|---|---|---|
| Personal Details | `/apply/personal/` | Inventoried |
| International | `/apply/international/` | Inventoried |
| Programme | `/apply/course/` → `/apply/course/choices/` | Inventoried; lookup form after a programme type is chosen |
| Additional Information | `/apply/additionalinfo/` | Inventoried |
| Contact Details | `/apply/contacts/` | Inventoried |
| Education History | `/apply/education/` → `/apply/education/form/` | Inventoried form |
| Employment History | `/apply/employment/` → `/apply/employment/form/` | Inventoried form |
| Language | `/apply/language/` → `/apply/language/form/` | Inventoried form |
| Finance | `/apply/finance/` | Inventoried |

Programme is no longer locked once Personal Details has been saved. `/apply/course/` opens the
programme-type chooser; each type opens a lookup form whose only field is the programme select.
There is no applicant email field anywhere on Personal or Contact Details.

Every page also carries the site chat widget (`#id_prompt_text`, `textarea[name='prompt_text']`).
It is always blocked.

## Page-by-page inventory

Required controls are marked **required**. "Manual" means the extension deliberately leaves the
control alone; the reason is in the next section.

### Personal Details (`/apply/personal/`)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `select#id_title` | Title | select (17) | `title` | Mapped; scoped to the select so research forms' free-text Title input is not filled |
| `#id_forename` | Given name | text **required** | `givenName` | Mapped |
| `#id_middlenames` | Middle name(s) | text | `middleName` | Mapped |
| `#id_surname` | Family name | text **required** | `familyName` | Mapped |
| `#id_previous_surname` | Previous surname | text | `previousName` | Mapped |
| `#id_prefname` | Preferred name | text | — | Manual: no CRM key |
| `#id_dob_day` | Date of birth | select **required** | `dateOfBirth` | Split date |
| `#id_dob_month` | Date of birth | select **required** | `dateOfBirth` | Split date |
| `#id_dob_year` | Date of birth | select **required** | `dateOfBirth` | Split date |
| `#id_sex` | Gender | select **required** | `gender` | Mapped |
| `#id_birth_nation` | Country of birth | select **required** | `countryOfBirth` | Mapped; falls back to nationality |
| `#id_nationality` | Nationality | select **required** | `nationality` | Mapped |
| `#id_ethnicity` | Ethnicity | select **required** | `ethnicity` | Mapped when CRM exposes the label |

### International (`/apply/international/`)

Conditional sections are hidden until their yes/no radio is answered. The inventory below covers
both the visible and the revealed controls.

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#id_passport_file` | Copy of current passport | file | — | Manual: document attach |
| `#id_passport_number` | Passport number | text | `passportNumber` | Mapped |
| `#id_passport_expiry_date_day` | Passport expiry date | select | `passportExpiryDate` | Split date |
| `#id_passport_expiry_date_month` | Passport expiry date | select | `passportExpiryDate` | Split date |
| `#id_passport_expiry_date_year` | Passport expiry date | select | `passportExpiryDate` | Split date |
| `#id_passport_issue_nation` | Passport nation of issue | select (215) | `passportIssueNation` | Derived from recognised nationality under the approved passport assumption |
| `european_settlement` | EU Settlement Scheme / Indefinite Leave to Remain? | radio | — | Manual: application answer |
| `#id_european_settlement_file` | EUSS or Leave to Remain evidence | file | — | Manual: document attach |
| `dependent_visa` | In the UK on a Dependent's Visa? | radio | — | Manual: application answer |
| `#id_dependent_visa_file` | Copy of dependent visa | file | — | Manual: document attach |
| `currently_or_previously_enrolled` | Currently enrolled on a course in the UK? | radio | — | Manual: application answer |
| `#id_study_level` | Study level | text | — | Manual: no CRM key |
| `#id_visa_type` | Visa type | select (5) | `visaType` | Mapped |
| `#id_visa_number` | UK visa number | text | — | Manual: no CRM key |
| `#id_visa_start_day` | Valid from | select | `visaStartDate` | Split date |
| `#id_visa_start_month` | Valid from | select | `visaStartDate` | Split date |
| `#id_visa_start_year` | Valid from | select | `visaStartDate` | Split date |
| `#id_visa_end_day` | Valid to | select | `visaEndDate` | Split date |
| `#id_visa_end_month` | Valid to | select | `visaEndDate` | Split date |
| `#id_visa_end_year` | Valid to | select | `visaEndDate` | Split date |
| `#id_visa_file` | Copy of visa | file | — | Manual: document attach |
| `refused_visa` | Ever been refused a UK visa? | radio | `ukVisaRefusal` | UK refusal gives Yes; explicit no-refusal history gives No; unknown or conflicting evidence stays manual |
| `#id_refused_visa_count` | How many times refused? | select (6) | — | Manual: no CRM key |
| `#id_refused_visa_file` | Evidence of visa refusal | file | — | Manual: document attach |
| `course_incomplete` | Registration suspended or discontinued? | radio | — | Manual: application answer |
| `#id_course_incomplete_institution` | Institution | text | — | Manual: no CRM key |
| `#id_course_incomplete_reason` | Reason for withdrawal or suspension | textarea | — | Manual: no CRM key |
| `#id_course_incomplete_date_day` | Withdrawal or suspension date | select | — | Manual: no CRM key |
| `#id_course_incomplete_date_month` | Withdrawal or suspension date | select | — | Manual: no CRM key |
| `#id_course_incomplete_date_year` | Withdrawal or suspension date | select | — | Manual: no CRM key |
| `#id_course_incomplete_file` | Withdrawal/suspension notification | file | — | Manual: document attach |

### Programme (`/apply/course/` → `/apply/course/choices/`)

`/apply/course/` is a programme-type chooser with no form controls (links only):

- Undergraduate / Bachelor Degree → `/apply/course/lookup/form/ug/`
- Postgraduate / Taught Masters → `/apply/course/lookup/form/gt/`
- MRes → `/apply/course/lookup/form/mres/`
- Postgraduate Research, own project → `/apply/course/lookup/form/gr-own/`
- Advertised studentship → `/apply/course/studentship/form/gr-ship/`
- Distance Learning → `/apply/course/lookup/form/dl/`
- Restricted admissions (passcode) → `/apply/course/restricted/lookup/<type>/<id>/`

Lookup forms:

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#id_course` | Programme | select (211 UG / 139 PGT) | `preferredCourse` | Mapped |

The lookup form submits with **Save and Continue**; that writes the programme choice to the draft,
so Autofill fills the select but never clicks it.

The advertised-studentship form currently renders "There are no studentships open for
applications at the moment" with no controls.

### Restricted admissions (`/apply/course/restricted/form/<type>/<code>/`)

Reached from the "Restricted Admissions Passcode Required" list. 25 pages were inventoried:
22 general restricted forms, 7 UG pages with an entry-point select, and 8 research pages with a
supervisor field and a free-text project title.

| Control | Label | Type | Status |
|---|---|---|---|
| `#id_part_time` | Will you study full time or part time? | select (Full/Part) | Blocked: application choice |
| `#id_term_month` | Starting | select, required | Blocked: starting term is an application choice, not a CRM value |
| `#id_point_of_entry` | Point of entry | select (Year 1/2/3), required | Blocked: no CRM key; must not take an intake value |
| `#id_academic_contact` | Academic contact | text | Blocked: Bangor supervisor name; no CRM key, never invented |
| `input#id_title` | Title (research project) | text, required | Blocked: free-text project title, not a salutation |
| `#id_passcode` | Passcode | password | Blocked by `input[type='password']` |
| submit / chat | — | submit / textarea | Blocked |

### Additional Information (`/apply/additionalinfo/`)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `studied_at_bangor` | Current/previous Bangor University student or applicant? | radio | — | Manual: application answer |
| `disability` | Do you have any disabilities? | radio | — | Manual: application answer |
| `#id_medi_code` | Disability | select (15) | — | Manual: no CRM key |
| `#id_other_disability` | Detail of other disability | text | — | Manual: no CRM key |
| `registered_elsewhere` | Registered for another HE qualification during study? | radio | — | Manual: application answer |
| `#id_elsewhere_details` | Please provide details | textarea | — | Manual: no CRM key |
| `uk_continuously` | Lived in the UK continuously since birth? | radio | — | Manual: application answer |
| `#id_uk_continuously_details` | Countries lived in during the last 10 years | textarea | — | Manual: no CRM key |

### Contact Details (`/apply/contacts/`)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#id_address1` | Address line 1 | text **required** | `location` | Mapped |
| `#id_address2` | Address line 2 | text | — | Manual: no CRM key |
| `#id_address3` | Address line 3 | text | — | Manual: no CRM key |
| `#id_city` | Postal town / city | text **required** | `city` | Mapped |
| `#id_nation` | Country | select (215) **required** | `countryName` | Mapped |
| `#id_state` | State | select (80) | — | Manual: hidden unless the country requires it; no CRM key |
| `#id_postcode` | Postcode / ZIP | text | `postcode` | Mapped |
| `#id_phone_number` | Phone number | text **required** | `phone` | Mapped; dial prefix kept |

### Education History (`/apply/education/` → `/apply/education/form/`)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#id_institution` | Institution | text **required** | `institutionName` | Mapped |
| `#id_country` | Country | select (215) **required** | — | Manual: institution country is not applicant residence |
| `#id_qualification_title` | Title of qualification | text **required** | `degree` | Mapped |
| `#id_result` | Grades achieved / expected | text | `grade` | Mapped |
| `#id_course_start_date` / `_year` | Course attended from | select **required** | `startDate` | Split date |
| `#id_course_end_date` / `_year` | Course attended to | select **required** | `endDate` | Split date |
| `#id_qualification_date` / `_year` | Date qualification awarded / expected | select | `graduationYear` | Split date (year only) |
| `#id_transcript_file` | Academic transcript related to this qualification | file **required** | — | Manual: document attach |
| `#id_certificate_file` | Qualification certificate | file | — | Manual: document attach |
| `#id_reference_file` | Academic reference | file | — | Manual: document attach |

### Employment History (`/apply/employment/` → `/apply/employment/form/`)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#id_employer` | Employer | text **required** | `cvCurrentEmployer` | Mapped |
| `#id_position` | Position | text **required** | `cvCurrentJobTitle` | Mapped |
| `#id_start_date` / `_year` | Date from | select **required** | `cvWorkStartDate` | Split date |
| `#id_end_date` / `_year` | Date to | select | `cvWorkEndDate` | Split date |
| `#id_responsibilities` | Details of responsibilities and duties | textarea **required** | — | Manual: no CRM key |
| `#id_reference_file` | Employment reference | file | — | Manual: document attach |

### Language (`/apply/language/` → `/apply/language/form/`)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `first_language_english_or_welsh` | Is your first language either English or Welsh? | radio | — | Manual: "English or Welsh" is not the CRM first-language question |
| `welsh_comms` | Receive communications in Welsh? | radio | — | Manual: application preference |

### Finance (`/apply/finance/`)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#id_choice` | How will you finance your studies? | select (7) **required** | `funding` | Mapped |
| `#id_scholarship_name` | Name of scholarship | select (8) | — | Manual: scholarship detail |
| `#id_name` | Name | text | — | Manual: scholarship name, not applicant name |
| `#id_other_scholarship_name` | Name of scholarship authority | text | — | Manual: no CRM key |
| `#id_country` | Country | select (215) | — | Manual: scholarship country, not applicant residence |
| `#id_finance_amount` | Give details of the amount of the award | select (3) | — | Manual: no CRM key |
| `#id_partial_amount` | Sponsorship will cover | select (3) | — | Manual: no CRM key |
| `#id_value` | Value of scholarship in GBP | number | — | Manual: no CRM key |
| `#id_awarded` | Have you been awarded this funding? | radio | — | Manual: application answer |
| `#id_admission_offer_required` | Require an offer of admission to apply? | radio | — | Manual: application answer |
| `#id_file` | Evidence of financial award | file | — | Manual: document attach |

## Split dates

Filled only when the select is still on its placeholder; an existing value is never replaced.

| CRM key | Page | Controls |
|---|---|---|
| `dateOfBirth` | `/apply/personal/` | `#id_dob_day`, `#id_dob_month`, `#id_dob_year` |
| `startDate` | `/apply/education/` | `#id_course_start_date`, `#id_course_start_date_year` |
| `endDate` | `/apply/education/` | `#id_course_end_date`, `#id_course_end_date_year` |
| `graduationYear` | `/apply/education/` | `#id_qualification_date_year` |
| `cvWorkStartDate` | `/apply/employment/` | `#id_start_date`, `#id_start_date_year` |
| `cvWorkEndDate` | `/apply/employment/` | `#id_end_date`, `#id_end_date_year` |
| `passportExpiryDate` | `/apply/international/` | `#id_passport_expiry_date_day`, `_month`, `_year` |
| `visaStartDate` | `/apply/international/` | `#id_visa_start_day`, `_month`, `_year` |
| `visaEndDate` | `/apply/international/` | `#id_visa_end_day`, `_month`, `_year` |

The CRM reader supplies education/employment dates as `September 2019`; the split-date parser
accepts that, ISO dates and `YYYY-MM`. Live CRM values are what matter here.

## Explicitly not auto-filled

| Control | Reason |
|---|---|
| Preferred name | No CRM key |
| Address line 2/3, State | No CRM keys; explicitly blocked |
| Institution country (education) | Applicant residence must not be copied into it |
| Responsibilities (employment) | No CRM key |
| Disability, residency, previous-Bangor, Language questions | Application answers with no CRM source |
| Funding awarded / admission-offer questions | Application answers; blocked by radio `name` because the live ids are `id_awarded_0/1` and `id_admission_offer_required_0/1` |
| Scholarship name/authority/country/amount/value | Scholarship-specific values |
| UK refusal with a non-UK/unknown country or conflicting evidence | No supported answer; refusal count also stays manual |
| Study level, visa number, refusal count, course withdrawal fields | No CRM keys |
| Restricted-admissions part-time, starting term, point of entry, academic contact | Application choices or Bangor-specific people; no CRM keys |
| Research project Title input (`input#id_title`) | Free-text project title; the salutation override is scoped to `select#id_title` |
| File inputs | Manual upload / CRM document attach |
| Submit / Save and Continue | Draft-only policy |
| Login email/password and chat widget | Never filled |

## Missing from portal surface

- No applicant email field on Personal, Contact or International.
- No separate previous-name date or alias fields.
- No qualification level/grade type select, only free-text title and grades.

## Tests and live checks

- **Live inventory.** An authenticated agent application, all nine sections, on 2026-10-23. A second pass covered all 25 restricted-admissions pages, the other four lookup forms, and the extra hub pages. It found four restricted controls and one false positive (the research title). The config now blocks all of them. The documented sections hold 128 controls and have 0 gaps.
- **Live engine run (synthetic CRM map, 2026-10-23).** Personal, Contact, Education, Employment, Finance, and Programme filled the mapped controls and kept existing values. International filled `visaType` and both visa date ranges. No wrong-section matches remained after the blocked-control updates.
- **Automated tests.** `test/bangor.test.js`, and the Bangor cases in `npm run test:e2e`.
- **Not done.** A live CRM Copy to Autofill run on a fresh draft. Sanitized HTML fixtures of the real pages.
