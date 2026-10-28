# University of Greenwich portal field map

**Origin:** `https://nelson.gre.ac.uk`
**System:** Ellucian Banner Self-Service Admissions RELEASE 8.7.2
**Login used for inventory:** Admissions Login at
`/pls/prod/bwskalog.P_DispLoginNon` (Login ID + PIN)
**Inventory date:** 2026-10-23 (full re-inventory; supersedes PR #1's 2026-09 inventory)
**Config:** `config/portals/greenwich.js`
**Raw captures:** not in this repository (they can contain applicant-like data); this document records the inventory by result.

## Journey shape

After sign-in the application checklist is
`/pls/prod/bwskalog.P_DispIndex?appno=1`. The checklist links to ten sections:

| Section | Path (relative to `/pls/prod/`) | Controls |
|---|---|---|
| Name | `bwskanam.P_DispAppName?appno=1&wsct=NAME` | 10 |
| Employment / Supporting Info. | `bwskaess.P_DispAppEssay?appno=1&wsct=ESSAY` | 10 |
| Permanent Address | `bwskaadr.P_DispAppAddr1?appno=1&wsct=ADDR1` | 9 |
| Referee Details | `bwskaudf.P_DispAppUserDef?appno=1&wsct=ADDITIONAL` | 14 |
| Mailing Address | `bwskaadr.P_DispAppAddr2?appno=1&wsct=ADDR2` | 7 |
| Qualifications | `bwskapcl.P_DispQuals?appno=1&wsct=QUALS` | 100 |
| Statistical Information | `bwskaper.P_DispAppPersonal?appno=1&wsct=PERSONAL` | 22 |
| Previous / Current Education | `bwskapcl.P_DispAppPrvCollege?appno=1&wsct=PRVCOLLEGE` | 13 |
| Programme Information | `bwskapln.P_DispAppPlan?appno=1&wsct=PLAN` | 5 |
| Signature | `bwskanam.P_Signature?appno=1&wsct=SIGNATURE` | 2 |

Staff must sign in manually. The extension never fills Login ID/PIN, CAPTCHA, or clicks
Continue / Submit / Application is Complete / Signature.

The Permanent Address form is now **plain text** (`#addr1`, `#addr2`, `#addr3`, `#zip`,
`#city`, `#natn`, `#hometelno`, `#mobiletelno`, `#addrflag`). The older postcode-search
controls (`#searchzip`, `#search_btn`, address picker) no longer exist on this form.

## Page-by-page inventory

Required controls are marked **required** in the source inventory. "Blocked" means the
control is in `blockedControls` and is never written, even when a synonym matches its label.

### Name

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#pfx` | Title | select (8) | `title` | Mapped |
| `#fname` | First Name | text | `givenName` | Mapped |
| `#mname` | Middle Name | text | `middleName` | Mapped |
| `#lname` | Family Name | text | `familyName` | Mapped |
| `#plname` | Previous Name (first + middle + family) | text | `previousName` | Mapped |
| `#ud50` | Full Legal Name | text | — | Blocked: no CRM key (not a name-part field) |
| `#ud135` | Passport Number (Non EU applicants only) | text | `passportNumber` | Mapped |
| `input[name='ud1']` | Previously applied to Greenwich? | radio (Y/N) | — | Blocked: application answer |
| `#ud2` | Previous 9 digit ID / student number | text | — | Blocked: no CRM key |
| `#ud3` | International Agent 9 digit ID | text | — | Blocked: no CRM key (contains "state" in its label) |

### Employment / Supporting Info.

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#ud11` | Name and Address of Employer | textarea | `cvCurrentEmployer` | Mapped |
| `#ud16` | Description of Job / Nature of Employment | text | `cvCurrentJobTitle` | Mapped |
| `#ud12` | Full or Part Time? | radio (Y/N) | — | Blocked: application answer |
| `#bday_dd` | Employment Start Date | select | `cvWorkStartDate` | Split date |
| `#bday_mm` | Employment Start Date | select | `cvWorkStartDate` | Split date |
| `#bday_yyyy` | Employment Start Date | select | `cvWorkStartDate` | Split date |
| `#bday_dd2` | Employment End Date | select | `cvWorkEndDate` | Split date |
| `#bday_mm2` | Employment End Date | select | `cvWorkEndDate` | Split date |
| `#bday_yyyy2` | Employment End Date | select | `cvWorkEndDate` | Split date |
| `#p_sarstmt_desc` | Personal Statement (max 3950 characters) | textarea | `personalStatement` | Mapped |

### Permanent Address

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#addr1` | Address Line 1 | text | `location` | Mapped |
| `#addr2` | Address Line 2 | text | — | Blocked: no CRM key |
| `#addr3` | Address Line 3 | text | — | Blocked: no CRM key |
| `#zip` | Postcode / Zipcode | text | `postcode` | Mapped |
| `#city` | City / Town | text | `city` | Mapped |
| `#natn` | Country | select (249) | `countryName` | Mapped |
| `#hometelno` | Home Telephone No. | text | `phone` | Mapped |
| `#mobiletelno` | Mobile Telephone No. | text | `phone` | Mapped |
| `#addrflag` | Mailing address same as permanent? | radio (Y/N) | — | Blocked: application answer |

### Referee Details

All 14 controls are blocked: the referee is a different person from the CRM applicant.

| Control | Label |
|---|---|
| `#ud17` | Name of Referee |
| `#ud18` | E-mail Address |
| `#ud19` | Address Line 1 |
| `#ud20` | Address Line 2 |
| `#ud21` | Address Line 3 |
| `#ud22` | City |
| `#ud23` | Postcode |
| `#ud24` | Country (select, 249) |
| `#ud25` | Telephone Number |
| `#ud26` | Fax Number |
| `#ud27` | Organisation Name |
| `#ud28` | Post / Occupation / Relationship to Applicant |
| `#ud29` | How long have you known this applicant / referee? |
| `#ud30` | Reference text (max 2000) |

### Mailing Address

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#addr1` | Address Line 1 | text | `location` | Mapped |
| `#addr2` | Address Line 2 | text | — | Blocked: no CRM key |
| `#addr3` | Address Line 3 | text | — | Blocked: no CRM key |
| `#zip` | Postcode / Zipcode | text | `postcode` | Mapped |
| `#city` | City / Town | text | `city` | Mapped |
| `#natn` | Country | select (249) | `countryName` | Mapped |
| `#hometelno` | Home Telephone No. | text | `phone` | Mapped |

### Qualifications

Twenty identical rows. Each row has five controls:
`#ud<N>qualtype` (Level), `#ud<N>subject` (Subject including Modules or Units),
`#ud<N>grade` (Grade leave blank if pending), `#ud<N>month` and `#ud<N>year`
(Date Awarded / Expected), where `<N>` runs from 91 to 110.

| Row | Controls | CRM key | Status |
|---|---|---|---|
| Row 1 (`#ud91*`) | Level, Subject, Grade | `degree`, `major`, `grade` | Mapped |
| Row 1 date (`#ud91month`, `#ud91year`) | Date Awarded / Expected | `endDate`; `graduationYear` fallback | Split date |
| Rows 2-20 (`#ud92*`..`#ud110*`) | Level, Subject, Grade, Month, Year | — | Blocked: CRM holds one qualification |

### Statistical Information

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#email` | E-mail Address | text | `email` | Mapped |
| `#dup_email` | Verify e-mail address | text | `email` | Mapped |
| `#gender` | Gender | select (3) | `gender` | Mapped |
| `#bday_dd` | Date of Birth | select | `dateOfBirth` | Split date |
| `#bday_mm` | Date of Birth | select | `dateOfBirth` | Split date |
| `#bday_yyyy` | Date of Birth | select | `dateOfBirth` | Split date |
| `#ethn` | Ethnicity | select (20) | `ethnicity` | Mapped |
| `#medi` | Disability / Special Needs | select (10, multi) | — | Blocked: sensitive |
| `#ud80` | Other disability details | text | — | Blocked: sensitive |
| `#ud4` | Have you been in care? | radio | — | Blocked: sensitive |
| `#ud5` | Parents attended Higher Education? | radio | — | Blocked: application answer |
| `#ud204` | First UK entry is date of birth? | checkbox | — | Blocked (never filled) |
| `#euk_dd` | Date of First Entry to the UK | select | — | Blocked: not the same value as DOB |
| `#euk_mm` | Date of First Entry to the UK | select | — | Blocked |
| `#euk_yyyy` | Date of First Entry to the UK | select | — | Blocked |
| `#ud60` | Country of Birth | select (256) | `countryOfBirth` | Mapped |
| `#ud65` | Nationality | select (253) | `nationality` | Mapped |
| `#ud70` | Area of Permanent Residence | select (513) | `currentDomicile` | Mapped; derived from the CRM address country, fills only when a live option matches |
| `#ud35` | Who do you expect to pay your fees? | select (13) | `funding` | Mapped through `valueMaps`: only self-funded fills ("Entire cost of tuition fees is paid by private finance."); other CRM funding values stay for staff |
| `#ud8` | Dates unavailable for interview | text | — | Blocked: contains "State" in its label |
| `#ud40` | Confidential Contact Name | text | — | Blocked: nominated access |
| `#ud45` | Confidential Contact Password | text | — | Blocked: nominated access |

### Previous / Current Education

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#col_name` | Institution Name | text | `institutionName` | Mapped |
| `#addr1` | Street1 | text | — | Blocked: institution address |
| `#addr2` | Street2 | text | — | Blocked |
| `#addr3` | Street3 | text | — | Blocked |
| `#city` | City | text | — | Blocked: institution address |
| `#zip` | Postcode | text | — | Blocked: institution address |
| `#natn` | Country | select (249) | — | Blocked: institution address |
| `#beg_date_dd` | Attended From | select | `startDate` | Split date |
| `#beg_date_mm` | Attended From | select | `startDate` | Split date |
| `#beg_date_yyyy` | Attended From | select | `startDate` | Split date |
| `#end_date_dd` | Attended To | select | `endDate` | Split date |
| `#end_date_mm` | Attended To | select | `endDate` | Split date |
| `#end_date_yyyy` | Attended To | select | `endDate` | Split date |

The CRM supplies education dates as month/year (for example `September 2016`). Month and year
fill; the day select stays manual because the CRM has no day.

### Programme Information

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#p_month` | Month/Year of Entry (month) | select (12) | `preferredIntake` | Split date; intake is derived from the CRM start month and year |
| `#p_year` | Month/Year of Entry (year) | select (2026-2028) | `preferredIntake` | Split date |
| `#p_program_code` | Programme of Study | select (237 after intake) | `preferredCourse` | Mapped |
| `#p_mode_poe` | Mode/Point of Entry | select (14 after programme) | `preferredRoute` | Mapped |
| `#ud138` | Teacher-training subject(s) | text | — | Blocked: no CRM key |

The CRM sends a start month and a start year, never an intake. The engine joins them (`September 2027`) when the portal maps `preferredIntake`.

Programme is a three-step cascade and fills over successive Autofill passes:

1. Pass 1 fills Month/Year of Entry (`preferredIntake`). The Programme select now loads 237 options.
2. Pass 2 fills Programme (`preferredCourse`). The Mode/PoE select now loads 14 options.
3. Pass 3 fills Mode/Point of Entry (`preferredRoute`).

Verified live on 2026-10-23. Each pass is a draft-only UI change; the extension never saves.

### Signature

| Control | Label | Type | Status |
|---|---|---|---|
| `#ud130` | I agree to the Terms and Conditions | checkbox | Blocked |
| `#ud131` | I have read the Guidance Notes | checkbox | Blocked |

## Split dates

| CRM key | Page | Controls |
|---|---|---|
| `dateOfBirth` | `bwskaper.P_DispAppPersonal` | `#bday_dd`, `#bday_mm`, `#bday_yyyy` |
| `cvWorkStartDate` | `bwskaess.P_DispAppEssay` | `#bday_dd`, `#bday_mm`, `#bday_yyyy` |
| `cvWorkEndDate` | `bwskaess.P_DispAppEssay` | `#bday_dd2`, `#bday_mm2`, `#bday_yyyy2` |
| `startDate` | `bwskapcl.P_DispAppPrvCollege` | `#beg_date_dd`, `#beg_date_mm`, `#beg_date_yyyy` |
| `endDate` | `bwskapcl.P_DispAppPrvCollege` | `#end_date_dd`, `#end_date_mm`, `#end_date_yyyy` |
| `endDate` | `bwskapcl.P_DispQuals` | `#ud91month`, `#ud91year` |
| `graduationYear` | `bwskapcl.P_DispQuals` | `#ud91year` |
| `preferredIntake` | `bwskapln.P_DispAppPlan` | `#p_month`, `#p_year` |

`#bday_*` is Date of Birth on Statistical Information but Employment Start Date on
Employment / Supporting Info. The page and form patterns keep the two uses apart.

## Explicitly not auto-filled

| Control | Reason |
|---|---|
| Full Legal Name, previous student number, agent ID | No CRM keys |
| Address Line 2/3 | No CRM keys |
| Full/Part Time | Application answer |
| Referee block | Different person |
| Disability, care status, parents' HE, UK entry dates | Sensitive or application-specific |
| Confidential contact name/password | Nominated access |
| Qualification rows 2-20 | CRM holds one qualification |
| Institution address on Previous Education | Must not take the applicant address |
| Teacher-training subject | No CRM key |
| Signature checkboxes, Continue/Submit | Draft-only policy |

## Fixes made in this pass

The live run exposed four mis-fills that the old config allowed:

| Field | Old behaviour | Fix |
|---|---|---|
| `#ud3` agent 9-digit ID | Filled with the CRM county because its label contains "state" | Blocked |
| `#addr2` address line 2 | Filled with the full address when line 1 was already populated | `location` is now scoped to `#addr1`; `#addr2`/`#addr3` blocked |
| `#ud8` interview dates | Filled with the CRM county because its label starts "State any dates…" | Blocked |
| `#ud138` teacher-training subject | Filled with the CRM major | Blocked |

Also fixed: qualification award month/year and education attendance dates were left blank or
received an unsplit month-year string in a day select; both now use split-date specs.

The 2026-10-23 screenshot audit added two selector fixes: the mailing-same radios are blocked
by `input[name='addrflag']`, and the "From Birth" checkbox is blocked by `input[name='ud204']`
because the live control has no id. Both were re-checked live as blocked.

## Verification

- Full live authenticated inventory: 2026-10-23, all ten sections, including the existing
  application's populated values.
- Live engine run on 2026-10-23 with a synthetic CRM map:
  - Name filled middle and previous name; existing title, names and passport were preserved;
    the agent-ID mis-fill is gone.
  - Employment filled employer, personal statement and work start month/year.
  - Permanent and Mailing Address matched only line 1 / city / postcode / country / phone;
    address lines 2-3 stayed untouched.
  - Statistical filled gender, nationality, birth country, ethnicity, email pair, funding, and
    split DOB; `#ud70` matched only when the residence option exists.
  - Qualifications filled row 1 plus award month/year; rows 2-20 stayed empty.
  - Previous Education filled institution and both attendance month/year ranges.
  - Programme filled intake, then programme, then mode across three passes.
- Automated config tests: `test/greenwich.test.js` (part of `npm test`, 112/112 on 2026-10-23).
- Live CRM Copy → Autofill with a real profile: still pending.
- Sanitized HTML fixtures in repo: pending.
