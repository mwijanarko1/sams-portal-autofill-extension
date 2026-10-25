# University of Greater Manchester portal field map

**Origin:** `https://evision.bolton.ac.uk`
**Login used for inventory:** agent IPP login at
`/urd/sits.urd/run/siw_ipp_lgn.login?process=siw_ipp_app&code1=0994-D&code2=0010`
**Inventory date:** 2026-10-23 (full re-inventory; supersedes 2026-10-15)
**Config:** `config/portals/manchester.js`
**Course sample:** MBA Global Healthcare Management STV (`0994-D` / seq `0010`, start Sep 2027)
**Raw captures:** `tmp/gm-inventory-2026-10-23/` (local only, gitignored)

## Journey shape

Tribal SITS e:Vision IPP application. After sign-in the checklist is
`/urd/sits.urd/run/SIW_IPP_USR.start_url?...`. The hub shows **Status - Unsubmitted**
and a checklist of links; clicking a link calls `ul_click_tab('<code>')`, which loads that
pane's content asynchronously into `#TAB-MAIN-<code>` (typically 5-25 seconds). The pane is
re-created on each tab switch, so the engine only sees the currently active tab.

| Tab | Code | Status on this course |
|---|---|---|
| Checklist | AS | Hub only (Print / Preview button) |
| Personal Details | PD | Inventoried (21 controls) |
| Contact Details | CD | Inventoried (20 controls) |
| Spare Tab | AG | Empty shell |
| Other Information | PI | Inventoried (criminal conviction only) |
| Qualifications | QU | Inventoried (90 controls incl. English branch) |
| Experience | EX | Inventoried (49 controls incl. prior rows) |
| Personal Statement | PS | Inventoried (3 controls) |
| Research Proposal | RP | Empty / hidden on this course |
| Passport | PA | Inventoried (15 controls incl. helper buttons) |
| Referees | RF | Empty / hidden on this course |
| Funding | FD | Empty / hidden on this course |
| Submission | SU | Inventoried (5 controls) |

Staff must sign in manually. The extension never fills email/password or clicks
Save / Save and Continue / Submit.

## Page-by-page inventory

Required controls are marked **required** in the source inventory. "Blocked" means the
control is in `blockedControls` and is never written, even when it matches a synonym.

### Personal Details (PD)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#IPR_TITL` | Title | select (15) | `title` | Mapped |
| `#IPR_FNM1` | Forename | text | `givenName` | Mapped |
| `#IPR_FNM2` | Second forename | text | `middleName` | Mapped |
| `#IPR_FNM3` | Third forename | text | — | Blocked: no CRM key |
| `#IPR_SURN` | Surname | text | `familyName` | Mapped |
| `#IPR_DOB_DAY` | Date of birth | select | `dateOfBirth` | Split date |
| `#IPR_DOB_MONTH` | Date of birth | select | `dateOfBirth` | Split date |
| `#IPR_DOB_YEAR` | Date of birth | select | `dateOfBirth` | Split date |
| `#IPR_FUSD` | Known as | text | — | Blocked: no CRM key |
| `#IPQ_OA_PRVSURN` | Previous surname | text | `previousName` | Mapped |
| `#IPR_GEND` | Gender | select | `gender` | Mapped |
| `#IPQ_OA_COB` | Country of birth | select (273) | `countryOfBirth` | Mapped |
| `#IPQ_OA_COD` | Country of residence | select (257) | `currentDomicile` | Mapped; derived from the CRM address country (`countryName`) |
| `#IPQ_OA_ETH` | Ethnic Background | select (20) | `ethnicity` | Mapped |
| `#IPQ_OA_ALUM` | Previously applied to or studied with us? | select (3) | `previouslyApplied` | Mapped |
| `#IPQ_OA_STUN` | UoB Student Number | text | — | Blocked: CRM internal id is not a UoB student number |
| `#IPQ_OA_CARE` | Ever been in care? | select (4) | — | Blocked: sensitive |
| `#IPQ_OA_CAREDUR` | How long in care? | select (7) | — | Blocked: conditional/sensitive |
| `#IPQ_OA_DISYN` | Do you have a disability? | select (3) | — | Blocked: sensitive |
| `#IPQ_OA_DISAB` | Disability list | select (11) | — | Blocked: conditional/sensitive |
| `#IPQ_OA_SPDETS` | Disability details | text | — | Blocked: conditional/sensitive |

### Contact Details (CD)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#IPR_CODC` | Country | select (257) | `countryName` | Mapped |
| `#IPR_HAPC` | Postcode | text | `postcode` | Mapped |
| `#PCOD_HA` | Postcode lookup | button | — | Blocked (button) |
| `#IPR_HAD1` | Address Line 1 | text | `location` | Mapped |
| `#IPR_HAD2` | Address Line 2 | text | — | Blocked: no CRM key |
| `#IPR_HAD3` | City | text | `city` | Mapped |
| `#IPR_HAD4` | County | text | `state` | Mapped when CRM exposes a county |
| `#IPR_HAT3` | Mobile | text | `phone` | Mapped |
| `#IPR_HTEL` | Home Telephone | text | `phone` | Mapped (second ranked target) |
| `#IPQ_OA_CORADD` | Add a correspondence address? | select (3) | — | Blocked: application answer |
| `#IPR_COD2` | Correspondence Country | select (257) | — | Blocked: must not take home country |
| `#IPR_CAPC` | Correspondence Postcode | text | — | Blocked |
| `#PCOD_CA` | Correspondence postcode lookup | button | — | Blocked (button) |
| `#IPR_CAD1` | Correspondence Address Line 1 | text | — | Blocked |
| `#IPR_CAD2` | Correspondence Address Line 2 | text | — | Blocked |
| `#IPR_CAD3` | Correspondence City | text | — | Blocked |
| `#IPR_CAD4` | Correspondence County | text | — | Blocked |
| `#IPR_CAT3` | Correspondence Mobile | text | — | Blocked |
| `#IPR_CAT1` | Correspondence Home Telephone | text | — | Blocked |
| `#IPR_CAEM` | Correspondence Email | email | `email` | Mapped when the correspondence block is shown |

There is no visible applicant email control on this course. `#IPR_CAEM` only appears after
"add a correspondence address?" is set to Yes.

### Other Information (PI)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#IPQ_OA_CRIMCON` | Any unspent criminal convictions? | select (3) | — | Blocked: sensitive declaration |

### Qualifications (QU)

Row 1:

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#IPQ_OA_QUINS1` | Institution / School / College | text | `institutionName` | Mapped |
| `#IPQ_OA_QTYP1` | Type of qualification | select (3) | — | Blocked: Academic / Professional category |
| `#IPQ_OA_QEQEC1` | Select Qualification | select (26) | — | Blocked: category list, not the qualification name |
| `#IPQ_OA_QEQEN1` | Qualification Name | text | `degree` | Mapped; revealed by Select Qualification = Other |
| `#IPQ_OA_QESUC1` | Select Subject | select (24) | — | Blocked: subject category list |
| `#IPQ_OA_QESUN1` | Subject | text | `major` | Mapped; revealed by Select Subject = Other |
| `#IPQ_OA_QCOM1` | Completed | select (3) | — | Blocked: application answer |
| `#IPQ_OA_QGRD1` | Select Grade | select (2, Other only) | — | Blocked; revealed only when Completed = Yes |
| `#IPQ_OA_QGRDN1` | Grade | text | `grade` | Mapped; revealed by Select Grade = Other |
| `#IPQ_OA_QENDD1_DAY` | Expected Completion Date | select | `endDate` | Split date |
| `#IPQ_OA_QENDD1_MONTH` | Expected Completion Date | select | `endDate` | Split date |
| `#IPQ_OA_QENDD1_YEAR` | Expected Completion Date | select | `endDate` / `graduationYear` | Split date |
| certificate upload | Please upload your certificates | file | — | Manual: document attach |
| transcript upload | Please upload your transcript | file | — | Manual: document attach |

Row 2 repeats the same controls and is blocked (CRM holds one qualification):
`#IPQ_OA_QUINS2`, `#IPQ_OA_QTYP2`, `#IPQ_OA_QEQEC2`, `#IPQ_OA_QEQEN2`, `#IPQ_OA_QESUC2`,
`#IPQ_OA_QESUN2`, `#IPQ_OA_QCOM2`, `#IPQ_OA_QGRD2`, `#IPQ_OA_QGRDN2`,
`#IPQ_OA_QENDD2_DAY`, `#IPQ_OA_QENDD2_MONTH`, `#IPQ_OA_QENDD2_YEAR`, plus row 2's upload and
remove button.

The live page has only two qualification rows. `Add Qualification` reveals row 2; there is no
row 3+ markup or JavaScript, so no further row blocks are needed.

APEL and English branch:

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#OA_APEL` | Credits for APL? | select (3) | — | Blocked: no CRM key |
| `#IPQ_OA_APLDET` | APL details | textarea | — | Blocked: conditional |
| `#IPQ_OA_ENGFIRST` | Is English your first language? | select (3) | `englishFirstLanguage` | Mapped |
| `#IPQ_OA_ENGLANG` | What is your first language? | text | — | Blocked: conditional, no CRM key |
| `#IPQ_OA_ENGST` | Taught in English? | select (3) | — | Blocked: conditional |
| `#IPQ_OA_ENGSTYRS` | For how many years? | select (11) | — | Blocked: conditional |
| `#IPQ_OA_ENGUKVI` | Majority English-speaking country national? | select (3) | — | Blocked: conditional |
| `#IPQ_OA_ENGDEGR` | UK-equivalent degree taught in English? | select (3) | — | Blocked: conditional |
| `#IPQ_OA_ENGLANGT` | Sat an English language test? | select (3) | — | Blocked: conditional |
| `#IPQ_OA_ENGTYPE` | Type of Qualification | select (3) | `englishTestName` | Mapped |
| TOEFL / IELTS / MELAB / PTE / Other branches | Registration number, test date, and each score | text/select | — | Blocked: conditional, no reliable single CRM target |
| `IPQ_OA_OTHEDATE_*`, `#IPQ_OA_OTHENAM` | Other test details | text/select | — | Blocked: conditional |

The English score widgets have **zero options** until a test type is chosen, so they cannot be
scored or filled safely.

### Professional Experience (EX)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| CV upload | Upload your CV | file | — | Manual: document attach |
| `#IPQ_OA_CREMP` | Employer name and address | textarea | `cvCurrentEmployer` | Mapped |
| `#IPQ_OA_CRJOB` | Job title and main duties | textarea | `cvCurrentJobTitle` | Mapped |
| `#IPQ_OA_CRMOA` | Full time / Part time | select (3) | — | Blocked: no CRM key |
| `#IPQ_OA_CRAPPD_DAY` | Date of Appointment | select | `cvWorkStartDate` | Split date |
| `#IPQ_OA_CRAPPD_MONTH` | Date of Appointment | select | `cvWorkStartDate` | Split date |
| `#IPQ_OA_CRAPPD_YEAR` | Date of Appointment | select | `cvWorkStartDate` | Split date |
| `#IPQ_OA_CRENDD_DAY` | End date (if applicable) | select | `cvWorkEndDate` | Split date |
| `#IPQ_OA_CRENDD_MONTH` | End date (if applicable) | select | `cvWorkEndDate` | Split date |
| `#IPQ_OA_CRENDD_YEAR` | End date (if applicable) | select | `cvWorkEndDate` | Split date |
| `#IPQ_OA_VOL` | Other relevant work experience? | select (3) | — | Blocked: application answer |
| `#IPQ_OA_VOLDET` | Experience details | textarea | — | Blocked: conditional |
| `#IPQ_OA_PRONO1` | Professional registration number | text | — | Blocked: no CRM key |

Prior employment rows 1-3 are blocked (CRM holds one current employer):
`#IPQ_OA_PREMP1/2/3`, `#IPQ_OA_PRJOB1/2/3`, `#IPQ_OA_PRMOA1/2/3`,
`#IPQ_OA_PRAPPD1/2/3_DAY/MONTH/YEAR`, `#IPQ_OA_PRENDD1/2/3_DAY/MONTH/YEAR`,
`#add-e-2/3/4`.

### Personal Statement (PS)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#IPQ_OA_PS_NEEDED` | Do you have a personal statement to upload? | select (3) | — | Blocked: application answer |
| upload | Upload | file | — | Manual |
| `#IPQ_OA_PS` | Please type your personal statement | textarea | `personalStatement` | Mapped; revealed when upload = No |

### Passport and Visa (PA)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#IPQ_OA_UKPPT` | Do you hold a British passport? | select (4) | — | Blocked: application answer |
| `#IPQ_OA_RESIDENCE` | Lived outside the UK in the last 3 years? | select (3) | — | Blocked: conditional |
| `#IPQ_OA_EUPPT` | Citizen of an EU country? | select (3) | — | Blocked: application answer |
| `#IPQ_OA_AGNAGL` | Agent group | select (5) | — | Blocked: agency attribution |
| `#IPQ_OA_AGNAGL2` | Agent | select (26) | — | Blocked: agency attribution |
| `#IPQ_OA_AGNNAM` | Agency Name | text | — | Blocked: agency attribution |
| `#IPQ_OA_AGNCIT` | Agency City | text | — | Blocked: agency attribution |
| `#IPQ_OA_AGNEML` | Agency Email | email | — | Blocked: agency attribution |
| `#IPQ_OA_INUK` | Applying from within the UK? | select (3) | — | Blocked: conditional |
| `#IPQ_OA_CURRVISA` | Immigration documents | select (5) | — | Blocked: no CRM key for this wording |
| `#IPQ_OA_OTHVISA` | Please specify | text | — | Blocked: conditional |
| `#IPQ_OA_UKPREV` | Previously studied in the UK? | select (3) | — | Blocked: no CRM key |

This course has **no passport number field**. CRM `passportNumber` has no target on PA.

### Submission (SU)

| Control | Label | Type | CRM key | Status |
|---|---|---|---|---|
| `#IPQ_OA_SOIC` | How did you find out about the course? | select (14) | — | Blocked: marketing source |
| `#IPQ_OA_SOICDET` | Please specify | text | — | Blocked: conditional |
| `#IPQ_OA_AGREE` | Declaration checkbox | checkbox | — | Blocked: declaration |
| `#but_fake_submit` | (validation trigger) | button | — | Blocked (button) |
| `#but_submit` | Submit | submit | — | Blocked: submission |

### Empty tabs

`AS` (checklist) contains only `#print_preview`. `AG` (Spare Tab), `RP` (Research Proposal),
`RF` (Referees) and `FD` (Funding) render no form controls on this course.

## Conditional two-pass workflow

Several mapped controls are revealed only after a category dropdown is chosen. They are hidden
during the first scan, so they fill on a second Autofill pass:

1. Qualifications: choose **Other** in `#IPQ_OA_QEQEC1` (Select Qualification) and
   `#IPQ_OA_QESUC1` (Select Subject), and set `#IPQ_OA_QCOM1` (Completed) to **Yes**, then
   choose **Other** in `#IPQ_OA_QGRD1`. Run Autofill again; `#IPQ_OA_QEQEN1`, `#IPQ_OA_QESUN1`
   and `#IPQ_OA_QGRDN1` then fill from `degree`, `major` and `grade`.
2. Personal Statement: set `#IPQ_OA_PS_NEEDED` to **No**, then run Autofill again to fill
   `#IPQ_OA_PS`.
3. Correspondence address: set `#IPQ_OA_CORADD` to **Yes** to reveal the correspondence block,
   including `#IPR_CAEM`.

Verified live on 2026-10-23: after choosing those options, a second Autofill filled
`degree` → `#IPQ_OA_QEQEN1`, `major` → `#IPQ_OA_QESUN1`, `grade` → `#IPQ_OA_QGRDN1`.

## Split dates

| CRM key | Controls |
|---|---|
| `dateOfBirth` | `#IPR_DOB_DAY`, `#IPR_DOB_MONTH`, `#IPR_DOB_YEAR` |
| `cvWorkStartDate` | `#IPQ_OA_CRAPPD_DAY`, `_MONTH`, `_YEAR` |
| `cvWorkEndDate` | `#IPQ_OA_CRENDD_DAY`, `_MONTH`, `_YEAR` |
| `endDate` | `#IPQ_OA_QENDD1_DAY`, `_MONTH`, `_YEAR` |
| `graduationYear` | `#IPQ_OA_QENDD1_YEAR` |

## Explicitly not auto-filled

| Control | Reason |
|---|---|
| Third forename, Known as, Address Line 2 | No CRM keys |
| County (`#IPR_HAD4`) | Mapped to `state`; fills only when the CRM exposes a county |
| Care, disability, criminal conviction | Sensitive declarations with no CRM source |
| Qualification/Subject/Grade category dropdowns | Category lists, not the CRM values; choosing Other reveals the mapped free-text fields |
| Completed / Full-time / Part-time / APL / voluntary work | Application answers with no CRM key |
| English score branches | Conditional; score select options are empty until a test is chosen |
| Passport, visa, UK-residence and agent fields | Application answers; no passport number field on this course |
| Correspondence address block | Must not take home address/phone |
| Qualification row 2, prior employment rows | CRM holds one qualification and one employer |
| File uploads | Manual / CRM document attach |
| Save, Save and continue, Submit, declaration | Draft-only / submission policy |

## Missing from inventoried surface

- No applicant primary email on Personal Details; only the conditional correspondence email.
- No passport number field on Passport for this MBA course.
- No programme/course picker (course fixed by the IPP `code1` / `code2` entry URL).
- Referees, Funding and Research Proposal tabs are hidden (`sv-hidden`) for this course.

## Verification

- Full live authenticated inventory: 2026-10-23, all tabs loaded through `ul_click_tab`.
- Live engine run on 2026-10-23 with a synthetic CRM map:
  - PD filled middle name, previous surname, country of residence, ethnicity and
    previously-applied; existing name/gender/birth-country values were preserved.
  - CD filled county; existing address, city, postcode, country and mobile were preserved.
  - QU filled `englishFirstLanguage`, expected completion month/year, and (after the reveal
    workflow) qualification name, subject and grade.
  - EX filled employer, job title and appointment month/year.
  - PS, PA and SU reported no writable CRM targets.
- Automated config tests: `test/manchester.test.js` (part of `npm test`).
- Live CRM Copy → Autofill with a real profile: still pending.
- Sanitized HTML fixtures in repo: pending.

### Fill all (draft saves), added 2026-10-19

`fillAll` in `config/portals/manchester.js` lets the optional, consented Fill all mode fill and save the data-entry tabs (PD, CD, PI, QU, EX, PS, PA) of the single-document jQuery tab UI. `#but_save` and `#but_save_and_cont` are `input[type=button]`, not native submits; a save is counted only after a fresh "saved" acknowledgement observed after the click (plus the expected tab being active for Save and continue; a stale success message or tab switch alone is not enough), and the Submission tab (SU, `#but_submit`) is never entered. Synthetic E2E only; unverified live: the save request, its acknowledgement markup, the selected-tab and hidden-SU classes. The host `evision.bolton.ac.uk` (formerly Bolton) is confirmed as the University of Greater Manchester origin in repo config and history.
