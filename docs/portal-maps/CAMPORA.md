---
last_verified: 2026-10-25
---

# Campora APPLY CRM source

Supervised first-pass inventory of Campora APPLY as a second Copy source. This records the
origin, profile route, DOM map and deliberate omissions. It is not live CRM-to-portal
acceptance.

## Access and origin

- Origin: `https://v-sams-backend.samsapply.co.uk`
- Login: `/` (email and password form posts to `/applyuser/login`)
- Credentials: ignored `.env.local` keys `CAMPORA_USERNAME`, `CAMPORA_PASSWORD` and
  `CAMPORA_WEBSITE_LINK`. Never commit them.
- Profile route: `/applyuser/show/<apply_id>/profile`
- The page is a tabbed application. The **Application** tab is server-rendered. The
  **Profile** tab loads `sub-content/crm_profile?lead_id=<lead_id>&apply_id=<apply_id>`
  into `#crm_profile_div` when `.load_profile_all_data` is clicked. The reader opens that
  tab itself, waits for the summary and for the education, work, reference, passport and
  visa placeholders to finish loading, reads the summary and record tables, then restores
  the tab that was active before Copy.
- `config/allowlist.js` lists this exact origin in `camporaOrigins`. `crmOrigins()` merges
  it with the SAMS CRM origin, so the popup's existing Copy guard accepts it.

## Profile DOM map

### Read-only summary

| Block | Rows |
|---|---|
| `.single_part_primary_info` | Name (combined), Gender, Date of Birth, Nationality, Marital Status |
| `.single_part_funding_info` | Funding, Status, Student Quality |
| `.single_part_visa_info` | Visa Needed, Visa Type, Country of App, Visa History, Prev Visa Refusal, Passport Expiry |
| `.single_part_contact_info` | Contact No, Email |
| `.single_part_emr_contact_info` | Emergency contact, Name, Contact, Email, Relation |
| `.single_part_address_info` | Home Address, Present Address (label row, then value row) |

### Record tables

Each `table.list_table` follows its section's `.main_title`.

| Section | Columns used |
|---|---|
| Education History | Institution (`strong`) plus degree badge, Subject, Result, Duration |
| Test Score | `.test_score_level` plus the score/`Overall` cell |
| Work Experience | Company Name, Designation, Duration (start and end dates; open-ended records keep start only) |
| Passport Details | Passport Number, Duration (issue and expiry only) |
| References, Visa History, Visa Refusal | Not read: no consumed key, and a prior visa type is not the current visa type |

Study Gap and Previous Study Abroad expose Yes/No radios in the sampled record; their flags
have no consumer and are not read.

### Application tab

The visible application header uses `#tabsApplication .tbl-cell` blocks. Course Title sits
in a second header row outside `.enrollment_header`:

| Campora display | Read as |
|---|---|
| University (`b`) | `preferredUniversity` |
| Start Date | `preferredIntake`, plus `preferredStartMonth` and `preferredStartYear` |
| Course Title | `preferredCourse` |
| Campora Ref | `studentId` |

The Level badge, Application Status, Agent and University Ref are visible but not consumed.

The reader filters its output through `CAMPORA_OUTPUT_KEYS` so Campora-only values cannot
enter the fill engine's heuristic matching.

## Mapped canonical keys

| Campora label | Key | Notes |
|---|---|---|
| Name | `givenName`, `familyName` | Split on the final token; middle names stay in `givenName` |
| Gender | `gender` | `title` is derived from gender when the CRM has no salutation |
| Date of Birth | `dateOfBirth` | Normalised to ISO |
| Nationality | `nationality` | |
| Marital Status | `maritalStatus` | |
| Funding | `funding` | |
| Visa Type | `visaType` | Summary value only |
| Contact No | `phone` | Dial code and number are joined |
| Email | `email` | |
| Emergency contact rows | `emergencyName`, `emergencyPhone`, `emergencyEmail`, `emergencyRelationship` | Scoped to the emergency block |
| Emergency contact name | `emergencyFirstName`, `emergencyLastName` | Derived from `emergencyName` |
| Present Address | `location` | Free text |
| Education History | `institutionName`, `degree`, `major`, `grade`, `studyDates`, `startDate`, `endDate`, `studyStartYear`, `studyEndYear` | First record only |
| Test Score | `englishTestName`, `testDate`, `overallScore`, `listeningScore`, `readingScore`, `writingScore`, `speakingScore` | First saved test only |
| Work Experience | `cvCurrentEmployer`, `cvCurrentJobTitle`, `cvWorkStartDate`, `cvWorkEndDate` | First record only; open-ended `- N/A` keeps the start date |
| Passport Details | `passportNumber`, `passportIssueDate`, `passportExpiryDate` | Dates come from the record table |
| Application header | `preferredUniversity`, `preferredCourse`, `preferredIntake`, `preferredStartMonth`, `preferredStartYear` | |
| Campora Ref | `studentId` | Falls back to the apply id in the URL |

## Deliberately unmapped

Only canonical keys the fill engine or a portal map consumes are copied. These Campora
values are intentionally left alone:

- Funding **Status**: ambiguous between sponsor status and self-funded status.
- **Country of App**: the applicant's country, not a study destination.
- **Visa Needed**, **Visa History** and **Prev Visa Refusal**: flags have no consumer; the
  summary `visaType` is the only visa value read.
- Summary **Passport Expiry**: a relative string such as `11 months 1 day Left`, not a date.
  The Passport Details table supplies the real issue and expiry dates.
- **Student Quality**, **Level badge** and the per-section Yes/No radios: visible but not
  consumed.
- **City, postcode and country**: shown only in the edit form
  (`apply_profile_address_info_edit`), not in the visible summary. They are left for manual
  entry rather than guessed from the free-text address.
- **Home Address**: no portal consumer; only Present Address maps to `location`.
- **Reference records**, **passport Comments/Status**, work duration text and prior-visa
  tables: no consumer or unsupported semantics.
- Application Status, University Ref, Student Decision, Agent, document statuses, tasks,
  remarks, timelines and uploaded documents.
- Campora documents are not listed or fetched. `src/crm-documents.js` only matches the SAMS
  lead path, so it returns no Campora documents and staff attach them manually.

## Limitations

- The combined Name is split on the final token. Suffixes and compound family names need
  manual review.
- Education, test, work and passport records keep only the first saved entry, matching the
  existing single-value cache contract.
- A lead with several applications must have the intended application open; the Application
  tab values belong to the current `apply_id`.
- A first supervised Campora-to-Bangor no-save sample passed on 2026-10-25. That is one
  application, one portal and one existing draft; Greenwich, Manchester, multiple samples and
  a full field-by-field acceptance remain.
- The host is the SAMS APPLY deployment. Confirm it is still the intended production origin
  before a release build.

## Live result (2026-10-25)

One supervised `--no-save` sample with the real loaded extension in a visible Chromium browser:

- Source: Campora APPLY profile route `/applyuser/show/<id>/profile`.
- Target: the existing Bangor application draft.
- Copy returned 30 fields: summary, contact, education, work, test score, passport and the
  application header.
- Bangor education filled 3 controls, employment 4 and finance 1. Personal, contact and
  language fields preserved their existing values.
- Existing and blocked values preserved; zero blocked writes; cache cleared; no save or
  submit.
- This is not full acceptance: one application, one portal and one draft. The runner does
  not verify that the existing draft belongs to the selected Campora applicant, so treat
  this as a no-save field-fill smoke test. Greenwich, Manchester, multiple samples and a
  field-by-field value check remain outstanding.

## Read-only section endpoints

Observed while mapping; all were GET requests with the staff session:

```text
sub-content/crm_profile
sub-content/crm_education_history
sub-content/crm_education_gap
sub-content/crm_prev_study_abroad
sub-content/crm_english_requirement
sub-content/crm_work_experience
sub-content/crm_reference
sub-content/crm_passport_details
sub-content/crm_visa_history
sub-content/crm_visa_refusal
sub-content/apply_profile_primary_info_edit
sub-content/apply_profile_contact_info_edit
sub-content/apply_profile_address_info_edit
sub-content/apply_profile_emergency_contact_info_edit
sub-content/apply_profile_funding_info_edit
```

## Verification

- Synthetic fixture: `test/fixtures/campora-profile.html`
- Regression tests in `test/crm-reader.browser.test.js`: mapped profile with an exact
  permitted-key assertion, double Copy with tab-restoration assertions, the
  non-profile-path guard, a closed work range, a full test-score breakdown, an
  already-open Profile pane, a prior-visa exclusion, and a delayed section load.
  `test/config.test.js` also exercises the real Campora route expression.
- `npm test`: 135/135 on 2026-10-25
- `npm run test:e2e`: 50/50 on 2026-10-25, loaded extension against synthetic pages. This is
  not a live portal.
- `npm run test:e2e:live`: one Campora-to-Bangor no-save sample passed on 2026-10-25 with
  `SAMS_E2E_CRM=campora`. See the live result above for scope.
- Live inventory: browser-driven, 2026-10-25. No credentials or applicant values are recorded in
  this document.
