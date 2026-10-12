# Bangor University portal field map

**Origin:** `https://apps.bangor.ac.uk`  
**Login used for inventory:** agent apply account at `/apply/account/login/?next=/apply/agent/`  
**Inventory date:** 2026-10-08  
**Config:** `config/portals/bangor.js`

## Journey shape

After sign-in the application hub is `/apply/menu/`. Sections:

| Nav label | Path | Status |
|---|---|---|
| Personal Details | `/apply/personal/` | Inventoried |
| Programme | `/apply/course/` | Locked until Personal is saved; redirects to menu |
| Additional Information | `/apply/additionalinfo/` | Inventoried |
| Contact Details | `/apply/contacts/` | Inventoried |
| Education History | `/apply/education/` → `/apply/education/form/` | Inventoried form |
| Employment History | `/apply/employment/` | Inventoried |
| Language | `/apply/language/` → `/apply/language/form/` | Inventoried form |
| Finance | `/apply/finance/` | Inventoried |

Staff must sign in manually. The extension never fills email/password or submits.

## Mapped CRM → portal (selector overrides)

| CRM key | Portal control | Notes |
|---|---|---|
| title | `#id_title` | Select |
| givenName | `#id_forename` | Given name |
| middleName | `#id_middlenames` | |
| familyName | `#id_surname` | |
| previousName | `#id_previous_surname` | Previous surname only |
| gender | `#id_sex` | Label is Gender |
| countryOfBirth | `#id_birth_nation` | |
| nationality | `#id_nationality` | |
| ethnicity | `#id_ethnicity` | CRM may not always expose this label |
| location | `#id_address1` | Address line 1 |
| city | `#id_city` | Postal town / city |
| countryName | `#id_nation` | Contact country only |
| postcode | `#id_postcode` | |
| phone | `#id_phone_number` | Dial prefix kept |
| institutionName | `#id_institution` | Education form |
| degree | `#id_qualification_title` | Title of qualification |
| grade | `#id_result` | Grades achieved / expected |
| cvCurrentEmployer | `#id_employer` | Employment |
| funding | `#id_choice` | How will you finance your studies? |

## Explicitly not auto-filled

| Control | Reason |
|---|---|
| `#id_dob_month/day/year` | Split DOB; no split-date fill yet |
| Education/employment date selects | Split month/year |
| `#id_country` on education | Institution country ≠ applicant residence |
| `#id_name` on finance | Scholarship name, not applicant name |
| `#id_prefname` | Preferred name; no CRM key |
| File inputs | Manual upload |
| `prompt_text` | Site chat widget |
| Submit buttons | Draft-only policy |
| Login email/password | Staff sign-in only |
| Disability / studied-at-Bangor / criminal / language radios | No safe CRM mapping |
| Address line 2/3 | No CRM keys |
| Programme fields | Section locked; not inventoried |

## Missing from portal surface

- No applicant email field found on Personal/Contact during inventory.
- Programme of study selectors unknown until Personal is completed and `/apply/course/` opens.

## Verification

- Live authenticated inventory: yes (agent test account).
- Automated config test: `test/bangor.test.js`.
- Live CRM Copy → Autofill on a draft application: pending.
- Sanitized HTML fixtures in repo: pending (local inventory JSON under `tmp/bangor-inventory/` only).

## Next supervised steps

1. Complete or open a draft Personal section so Programme unlocks; inventory `/apply/course/`.
2. Run Copy from CRM + Autofill on Personal, Contact, Education, Employment, Finance.
3. Save sanitized fixtures under `fixtures/bangor/`.
4. Decide whether Preferred name and Address line 2 need CRM keys.
