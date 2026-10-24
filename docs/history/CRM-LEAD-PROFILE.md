# SAMS CRM lead management and the Profile tab

Inventory date: **2026-10-23**. Source of truth for the mapping is [`config/crm-source.js`](../../config/crm-source.js) and [`src/crm-reader.js`](../../src/crm-reader.js). This note records what the live CRM actually shows, so a future maintainer can re-check coverage without guessing labels.

The extension reads **visible CRM values only**. Copy never writes, saves, submits or changes a lead. The only clicks are the profile tab strip and the read-only stage toggles, which load a panel without sending a write.

## Where lead management lives

| Menu item | Route | What it is |
|---|---|---|
| Lead Management / All Lead | `/agent/new-direct-leads` | Direct leads, with the full filter panel |
| Sub-Agents Lead | `/agent/new-sub-leads` | Leads created by a sub-agent |
| Converted Lead | `/agent/new-converted-leads` | Leads converted to applications/students |
| Import Bulk Lead | `/agent/upload_lead_data_v2` | CSV/XLS import screen |
| Facebook Lead | `/agent/fb-lead-ads-platform` | Facebook lead ads |
| Advanced Search | `/agent/leads/advanced-search/leadsearch` | Lead search form |

Every row in every list links to the same individual page:

```text
https://app.samscrm.co.uk/agent/leads/full-profile/<lead-id>
```

`config/crm-source.js` accepts `/leads/full-profile/<id>` (and the optional `/agent/` prefix). That one path is shared by direct, sub-agent and converted leads, so the reader does not need a route per list category.

## Lead types, statuses and filters

The lead API (`/api/v2/agent/ajax/fp_lead_info`) carries `lead.lead_type`. Every lead sampled on 2026-10-23 returned `"study"`. The value is not rendered in the DOM, so the reader does not branch on it; it reads the shared profile layout instead.

The lead list exposes these segments and filters. They change which rows are listed, not how an individual profile is laid out:

- **Lists:** All Lead, Sub-Agents Lead, Converted Lead.
- **Flags:** Dependent, Walk-in query, English test, Student portal active.
- **Channel (20 values):** Digital Marketing, Email, Event, Facebook, Instagram, Line, Linkedin, Messenger, Mobile, Q Form, Referral, Skype, Sub Agent, Telephone, Twitter, Viber, Walk-in query, Website, Whatsapp, YouTube.
- **Potential status (10 values):** Fast Track, Regular, Potential, 1st Follow-up, 2nd Follow-up, 3rd Follow-up, Final Follow-up, Future Lead, Not Prospective, Blacklisted.
- **Funding status (6 values):** Study Loan, Financial Support, Govt. Sponsored, Self-Funded, Scholarship, Other Funding.
- **Ratings:** 0–3 stars. **Conversion:** Converted / Non Converted. **Visa:** Yes / No.

On 2026-10-23 the demo company returned no rows for the `dependent`, `walk_in`, `english_test` and `student_portal_active` filters, but those leads open the same `/leads/full-profile/<id>` page. The sub-agent and converted lists both pointed at `/leads/full-profile/<id>` too. All sampled profiles had the same seven tabs, in the same order.

## Profile page anatomy

Tabs on an individual lead:

```text
Applications | Remarks | COMMS | Tasks | Profile | Documents | Action Required
```

Some leads also show an **Email Logs** tab. Copy reads **both** the Profile tab and, when its stage tracker is mounted, the Applications tab. The other tabs are not part of the field copy. Profile values win on shared keys; Applications fills in the fields the Profile tab does not show.

- **Applications** is the default tab and the lead-stage workflow. It has the nine-stage tracker (`Personal Information`, `Contact Information`, `Education History`, `Previous Study Abroad`, `Passport Details`, `Test Score`, `Visa History & Refusal`, `Reference & Work`, `Admission Preference`). Clicking a stage swaps one editable form and its saved-list panel into `.collapse_common`.
- **Profile** is the read-only review tab. It shows the lead header plus ten sections: Personal Information, Education History, Study Gap, Previous Study Abroad, Test Score, Work Experience, References, Passport Details, Visa History, Visa Refusal.

Opening the Profile tab removes the Applications stage tracker from the page until the lead page is reloaded. Copy therefore reads the Applications tab **first** (each mounted stage panel plus the visible form), then opens Profile, waits for its section data, and restores the tab the staff member was on. Profile values win on shared keys. If a page has no Profile tab (older layouts), Copy reads the visible page in place as a fallback.

## Lead header

Visible on both tabs.

| CRM label / control | Canonical key | Notes |
|---|---|---|
| Lead Reference (`Sep-26-2`) | `leadRef` | From the visible `.file_number` badge |
| File Number (`8398723`) | `fileNumber` | Second visible `.file_number` badge |
| Counsellor/Assistance | `counsellorName` | Header capsule |
| Office | `officeName` | Header capsule |
| Student Portal | `studentPortalStatus` | Approved / Not Yet Activated / etc. |
| Connection | `connection` | Skipped when it is the empty state "No Connection Found" |
| Sub-Agent / Referral | `subAgentReferral` | Sub-Agent / Referral / Not Applicable |
| Lead status | `leadStatus` | Selected `.lead_p_status.activate` (Regular, Potential, …) |
| Student Quality Summary | `studentQualitySummary` | Free-text summary |
| Registered on | `registeredOn` | Lead header table |
| Creation Month | `leadCreatedOn` | Lead header table |
| Channel | `channel` | Label text only, not the dropdown's option list |

## Applications tab: lead-stage fields

Copy reads the Applications stage panels when the tracker is mounted, so admission preference, social contacts and split address components are included. Profile values win on shared keys; the Applications map only fills gaps.

Each stage toggle opens one `.collapse_common` panel. The reader reads the panel form controls and the first saved `.single_part` entry. Section-aware overrides prevent labels that mean different things in different panels:

| Section | Label | Canonical key |
|---|---|---|
| Admission Preference | Study Destination | `preferredDestination` |
| Admission Preference | Institute Type | `preferredInstituteType` |
| Admission Preference | Pathway Providers | `preferredPathway` |
| Admission Preference | Institute Name | `preferredUniversity` (not `institutionName`) |
| Admission Preference | Level | `preferredLevel` |
| Admission Preference | Course Title | `preferredCourse` |
| Admission Preference | Preferred Department | `preferredDepartment` |
| Admission Preference | Start Year / Start Month | `preferredStartYear` / `preferredStartMonth` |
| Admission Preference | Enrollment Priority | `preferredPriority` |
| Previous Study Abroad | Study Destination | `previousStudyDestination` (not `preferredDestination`) |
| Previous Study Abroad | Visa Type | `previousStudyVisaType` |
| Reference & Work | Name / Reference Source / Phone / Email | `referenceName` / `referenceSource` / `referencePhone` / `referenceEmail` (not the applicant's phone/email) |
| Visa History & Refusal | Visa Type / Country / Purpose | `visaType` / `visaCountry` / `visaPurpose` |
| Visa History & Refusal | Applied Country / Refusal Reason | `visaRefusalCountry` / `refusalReason` |

Saved list entries are read from `.single_part`:

- **Education:** institution, study months, subject, result, level badge, passing year.
- **Passport:** number and issue/expiry range.
- **Test Score:** test short name, test date, Overall/Listening/Speaking/Writing/Reading.
- **Work:** employer, dates, designation.
- **Admission Preference:** the destination/university/course rows are listed, but the live demo leads only carry destination stubs.

## Profile tab: section fields

The Profile tab is table-based. The reader maps table headers per section, so a header such as `Institution | Subject` is never read as a value.

### Left sidebar

| Visible label / block | Canonical key |
|---|---|
| Given Name, Family Name | `givenName`, `familyName` |
| Date Of Birth (`15 Apr 2001 (25 Years)`) | `dateOfBirth` → `2001-04-15` |
| Nationality, Gender, Marital Status | `nationality`, `gender`, `maritalStatus` |
| Present Address (joined line) | `location` (street line), `postcode`, `countryName` |
| Permanent Address (joined line) | `permanentAddress` |
| Contact Information phone / email | `phone`, `email` |
| Emergency Contact name / relation / phone / email | `emergencyName`, `emergencyRelationship`, `emergencyPhone`, `emergencyEmail` |
| Applicant Occupation | `applicantOccupation` |
| Maximum Study Budget (amount) | `studyBudget` |

The joined present address is split using the **Current City** value from Personal Information: `1 Test Street, Example Area Dhaka 1207 Bangladesh` → `location=1 Test Street, Example Area`, `postcode=1207`, `countryName=Bangladesh`. The parser accepts a spaced UK postcode (`SW1A 2AA`) or a numeric 4–6 digit (optionally ZIP+4) postcode after the city. If the tail is ambiguous (for example `London United Kingdom`), no location, postcode or country is inferred, so a structured Applications address is not overwritten.

### Personal Information

| Table row | Canonical key |
|---|---|
| Name | already covered by `givenName` + `familyName` |
| Gender, Date of Birth, Nationality, Marital Status | `gender`, `dateOfBirth`, `nationality`, `maritalStatus` |
| Current City | `city` |
| Funding | `funding` |
| Self Funded Status | `selfFundedStatus` |
| Status | `leadStatus` |
| Student Quality | `studentQuality` |
| Visa History | `hasVisaHistory` |
| Prev Visa Refusal | `hasVisaRefusal` |
| Passport Expiry | `passportExpiryDate` |

### Education History

Columns: Institution, Subject, Result, Duration, Transcript, Certificate, Action.

| Column / cell | Canonical key |
|---|---|
| Institution (`strong`) | `institutionName` |
| Level badge | `degree` |
| Subject | `major` |
| Result | `grade` |
| Duration | `studyDates`, `startDate`, `endDate` |

`studyStartYear` and `studyEndYear` are derived from `startDate` / `endDate`.

### Study Gap

Columns: Institution, Study Gap Type, Duration.

`studyGapInstitution`, `studyGapType`, `studyGapDates`, `studyGapStartDate`, `studyGapEndDate`. The checked Yes/No radio sets `hasStudyGap`.

### Previous Study Abroad

Columns: Institution, Subject, Country & Visa Type.

`previousInstitution`, `previousSubject`, `previousStudyCountryVisa`.

### Test Score

No table header. The first cell carries the test short name (`.test_score_level`) and test date (`.test_date`); each score cell carries a number and a label.

`englishTestName`, `testDate`, `overallScore`, `listeningScore`, `speakingScore`, `writingScore`, `readingScore`. `Expiration Date` is read from the Applications test form as `testExpiryDate`; the Profile table normally shows only the Test Date.

### Work Experience

Columns: Company Name, Designation, Duration.

`cvCurrentEmployer`, `cvCurrentJobTitle`, `cvWorkDates`, `cvWorkStartDate`, `cvWorkEndDate`. The checked radio sets `hasWorkExperience`.

### References

Columns: Name, Reference Source, Phone, Email.

`referenceName`, `referenceSource`, `referencePhone`, `referenceEmail`. The checked radio sets `hasReference`.

### Passport Details

Columns: Passport Number, Duration, Comments, Status.

`passportNumber`, `passportDates`, `passportIssueDate`, `passportExpiryDate`, `passportPlaceOfIssue` (Comments). The checked radio sets `hasPassport`.

### Visa History

Columns: Visa Type, Country, Purpose, Duration.

`visaType`, `visaCountry`, `visaPurpose`, `visaDates`, `visaStartDate`, `visaEndDate`. The checked radio also sets `hasVisaHistory`.

### Visa Refusal

Columns: Visa Type, Country, Purpose, Duration.

`visaRefusalType`, `visaRefusalCountry`, `visaRefusalPurpose`, `visaRefusalDates`, `visaRefusalStartDate`, `visaRefusalEndDate`. The checked radio sets `hasVisaRefusal`.

## Reader behaviour

1. Guard: approved CRM origin, `/leads/full-profile/<id>` path, and a profile marker in the page text.
2. Read the Applications tab: each mounted stage panel and its first saved list entry, plus the visible form when the tracker is absent.
3. Open the Profile tab, wait for the Personal Information section, then wait for the CRM's `.waitMe` loading overlay to clear (falling back to a mutation-quiet settle) before reading the summary/sidebar/table layout.
4. Merge: Profile values win on shared keys; Applications fills in admission preference, social contacts and split address components.
5. Restore the tab the staff member was on.
6. If there is no Profile tab (older layout), read the visible page in place.
7. Keep the **first** non-empty value for each key. Values shown as `N/A`, `-`, `Not Applicable`, `No X Found.` or `No X available.` are treated as absent. Table header cells are never values.

Only one saved entry per section is copied because `studentCache.fields` is a flat key/value map. Multi-row data (second degree, second passport, and so on) is visible in CRM but not stored. Documents remain a separate list from [`src/crm-documents.js`](../../src/crm-documents.js).

## Not covered by Copy

- The lead list itself (rows, filters, bulk actions, export).
- Remarks, COMMS, Tasks, Documents, Action Required, Email Logs, Applications list.
- Applications stage panels when their tracker is not mounted. Copy still reads the visible application form, but saved list entries and any unrendered panel fields are omitted. A second Copy after Profile has removed the tracker can lose Applications-only values until the lead page is reloaded.
- Portal credentials or Student Portal access state beyond the header capsule text.
- Anything below the first saved entry in a list section.
- Hidden edit forms that the CRM has not rendered. The reader never opens an edit dialog or Add form.

## Verification

Live check on 2026-10-23, using the `sams-inventory` PinchTab profile and the credentials in ignored `.env.local`:

| Lead | Type | Fields copied | Notes |
|---|---|---:|---|
| `398723` | Seeded direct lead | 66 | Every Profile section populated; no missing education, passport, visa, work or test fields |
| `401630` | Sub-agent lead | 21 | Sparse Profile plus the mounted Applications form (`preferredStartYear=2026`) |
| `404892` | Seeded lead / converted Profile tab | 58 | Profile sections plus the visible Applications form; admission preference was empty in CRM |

`npm test` passes **124/124**, including the `crm-profile-tab.html` browser fixture that reproduces the Profile tab's asynchronous section load. `npm run test:e2e` passes **33/33** on the synthetic pages (the Greenwich fixture now matches the live qualification year select).

Manual re-check commands (the injected bundle is the same file set `popup.js` injects):

```sh
pinchtab nav "https://app.samscrm.co.uk/agent/leads/full-profile/<id>"
# inject config/build-mode.js, config/allowlist.js, config/crm-source.js, src/crm-reader.js
# then:
SAMS_CRM_READER.readProfile().then((p) => console.log(p.fields))
```

Credentials live in `.env.local` (`SAMS_CRM_USERNAME`, `SAMS_CRM_PASSWORD`, `SAMS_CRM_WEBSITE_LINK`). Do not commit them or paste real lead data into fixtures.
