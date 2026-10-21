# University of Greater Manchester portal field map

**Origin:** `https://evision.bolton.ac.uk`  
**Login used for inventory:** agent IPP login at  
`/urd/sits.urd/run/siw_ipp_lgn.login?process=siw_ipp_app&code1=0994-D&code2=0010`  
**Inventory date:** 2026-10-15  
**Config:** `config/portals/manchester.js`  
**Course sample:** MBA Global Healthcare Management STV (`0994-D` / seq `0010`, start Sep 2027)

## Journey shape

Tribal SITS e:Vision IPP application. After sign-in the hub is  
`/urd/sits.urd/run/SIW_IPP_USR.start_url?...` with jQuery UI tabs. Section bodies
load lazily into `#TAB-MAIN-*` (often 5-12s after activate).

| Tab | Code | Status on sample course |
|---|---|---|
| Checklist | AS | Hub only |
| Personal Details | PD | Inventoried |
| Contact Details | CD | Inventoried |
| Spare Tab | AG | Empty shell |
| Other Information | PI | Inventoried (criminal conviction only) |
| Qualifications | QU | Inventoried (row 1 + English branch) |
| Experience | EX | Inventoried (current job + prior rows) |
| Personal Statement | PS | Inventoried |
| Research Proposal | RP | `sv-hidden` on this course |
| Passport | PA | Inventoried (no passport number field) |
| Referees | RF | `sv-hidden` on this course |
| Funding | FD | `sv-hidden` on this course |
| Submission | SU | Inventoried (source + agreement) |

Staff must sign in manually. The extension never fills email/password or clicks
Save / Save and Continue / Submit.

## Mapped CRM → portal (selector overrides + split dates)

Policy: every CRM key with a portal control is mapped. Portal-only fields stay manual.

| CRM key | Portal control | Notes |
|---|---|---|
| title | `#IPR_TITL` | Select |
| givenName | `#IPR_FNM1` | Forename |
| middleName | `#IPR_FNM2` | Second forename only |
| familyName | `#IPR_SURN` | Surname |
| previousName | `#IPQ_OA_PRVSURN` | Previous surname |
| dateOfBirth | `#IPR_DOB_*` | Split-date fill |
| gender | `#IPR_GEND` | Female / Male / Other |
| countryOfBirth | `#IPQ_OA_COB` | |
| currentDomicile | `#IPQ_OA_COD` | Country of residence |
| ethnicity | `#IPQ_OA_ETH` | |
| previouslyApplied | `#IPQ_OA_ALUM` | Applied/studied with us |
| location | `#IPR_HAD1` | Home address line 1 |
| city | `#IPR_HAD3` | Home city |
| state | `#IPR_HAD4` | County |
| postcode | `#IPR_HAPC` | Home postcode |
| countryName | `#IPR_CODC` | Home country |
| phone | `#IPR_HAT3`, `#IPR_HTEL` | Mobile then home telephone |
| email | `#IPR_CAEM` | Correspondence email only on form |
| institutionName | `#IPQ_OA_QUINS1` | Qualification row 1 |
| degree | `#IPQ_OA_QEQEN1` | Qualification name (free text) |
| major | `#IPQ_OA_QESUN1` | Subject free text |
| grade | `#IPQ_OA_QGRDN1` | Grade free text |
| endDate | `#IPQ_OA_QENDD1_*` | Expected completion split-date |
| graduationYear | `#IPQ_OA_QENDD1_YEAR` | Year-only if no full endDate |
| cvCurrentEmployer | `#IPQ_OA_CREMP` | Current employer name and address |
| cvCurrentJobTitle | `#IPQ_OA_CRJOB` | Job title and main duties |
| cvWorkStartDate / cvWorkEndDate | `#IPQ_OA_CRAPPD_*` / `#IPQ_OA_CRENDD_*` | Split-date |
| personalStatement | `#IPQ_OA_PS` | Textarea |
| englishTestName | `#IPQ_OA_ENGTYPE` | IELTS / Other |
| englishFirstLanguage | `#IPQ_OA_ENGFIRST` | Yes/No |

## Explicitly not auto-filled

| Control | Reason |
|---|---|
| `#IPR_DOB_*` / employment / qual date selects | Generic match blocked; filled only via `splitDates` when CRM has the key |
| `#IPR_FNM3` | Third forename; no CRM key |
| CRM `nationality` | No nationality control on inventoried surface (use `currentDomicile` → residence) |
| CRM English scores / test date | No single test-agnostic score widgets; IELTS branch has TRF only |
| CRM funding / passport / visa | Funding tab hidden; no passport number; visa labels do not match CRM keys |
| Correspondence block `#IPR_CAD*` / `#IPR_CAT*` / `#IPR_COD2` | Must not take home CRM contact |
| `#IPR_CAEM` already mapped; keep correspondence address manual | |
| Qualification row 2+ | CRM holds one qualification |
| Previous employment rows | CRM holds one current employer |
| Disability / care / criminal | Sensitive; no safe CRM map |
| Passport / visa / agent fields | No passport number on surface; immigration manual |
| File uploads | Manual |
| `#but_save`, `#but_save_and_cont`, login | Draft-only / staff auth |
| `#IPQ_OA_AGREE` | Submission declaration |
| English score branch fields | Conditional; IELTS score widgets not confirmed |

## Missing from inventoried surface

- No applicant primary email on Personal Details; only correspondence email on Contact.
- No passport number field on Passport tab for this course.
- No programme/course picker (course fixed by IPP `code1` / `code2` in the entry URL).
- Referees, Funding, Research Proposal tabs hidden (`li.sv-hidden`) for this MBA sample.

## Verification

- Live authenticated inventory: yes (agent test account, 2026-10-15).
- Automated config test: `test/manchester.test.js`.
- Live CRM Copy → Autofill Helium smoke (2026-10-15): Personal + Contact no-save; gender and phones filled from an 8-field CRM sample. Re-run after CRM-key map expansion.
- Sanitized HTML fixtures in repo: pending (local inventory JSON under `tmp/gm-inventory/` only).

## Next supervised steps

1. Run Copy → Autofill on Personal and Contact with a test student; record fill report.
2. Confirm IELTS score controls after selecting English test type Yes/IELTS.
3. Inventory Referees / Funding on a course where those tabs are visible.
4. Commit sanitized fixtures under `fixtures/manchester/` when a clean draft is available.

### Fill all (draft saves), added 2026-10-19

`fillAll` in `config/portals/manchester.js` lets the optional, consented Fill all mode fill and save the data-entry tabs (PD, CD, PI, QU, EX, PS, PA) of the single-document jQuery tab UI. `#but_save` and `#but_save_and_cont` are `input[type=button]`, not native submits; a save is counted only after a fresh "saved" acknowledgement observed after the click (plus the expected tab being active for Save and continue; a stale success message or tab switch alone is not enough), and the Submission tab (SU, `#but_submit`) is never entered. Synthetic E2E only; unverified live: the save request, its acknowledgement markup, the selected-tab and hidden-SU classes. The host `evision.bolton.ac.uk` (formerly Bolton) is confirmed as the University of Greater Manchester origin in repo config and history.
