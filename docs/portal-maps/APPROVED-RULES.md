# Approved portal answer rules

Approved by the operator on 2026-10-28. These rules replace selected blanket blocks, not the draft-only safety policy. They apply only to controls mapped by the active portal. They do not change CRM records or cached source fields. An existing portal value always wins.

## Nationality and immigration

- Assume passport country and citizenship follow the CRM nationality. Manchester British-passport and EU-citizenship answers use a recognised country name or unambiguous demonym. The UK, Switzerland and non-EU EEA countries are not EU members. Missing, unknown, shared or multiple nationality names stay unanswered.
- Bangor passport nation of issue follows the same nationality assumption. It does not use the issuing authority.
- Manchester applying from within the UK uses the current residence country, not nationality or permanent address. UK means Yes and a recognised non-UK country means No. Missing or conflicting current-residence values stay manual.
- Bangor UK visa refusal is Yes only for a UK-specific refusal record. An explicit no-refusal-history value gives No unless a refusal record contradicts it. A non-UK refusal, unknown refusal country or missing history stays manual. Refusal count stays manual.

These are approved application assumptions, not proof of passport ownership, citizenship or physical location. Staff must check the answers before saving.

## Identity and agency

- Greenwich Full Legal Name joins available CRM given, middle and family names in that order. Whitespace is normalised; missing name parts are not invented.
- Greenwich referee name, email and telephone use only `referenceName`, `referenceEmail` and `referencePhone`. They never use applicant contact details. Referee organisation, address and other unsupported details stay manual.
- Manchester Agency Name is `SAMS Global`. Agency city, email, group and agent identifiers stay manual. Student and counsellor contact data are not agency contact data.

## Addresses

| Portal target | CRM source |
|---|---|
| Manchester Home Address and Greenwich Permanent Address | Explicit `permanentAddress`, `permanentCity`, `permanentPostcode`, `permanentCountry` |
| Manchester Correspondence Address and Greenwich Mailing Address | Present `location`, `city`, `postcode`, `countryName` |

Never substitute one address kind for the other. Manchester present county can fill correspondence county; there is no permanent-county source. Student phone and email remain separate contact values.

Infer same-address answers only when both addresses have a line, city, postcode and recognised country. Compare ordered address components with case/whitespace and postcode-spacing normalisation. Reordered house numbers are not the same address. A joined sidebar address that cannot be compared safely stays manual.

For equal addresses, Greenwich mailing-same is Yes and Manchester add-correspondence is No. For different complete addresses, the answers reverse. Incomplete addresses do not establish equality or inequality. Manchester makes one bounded rescan after revealing correspondence fields, so synchronously revealed fields can fill in the same Autofill action. Slowly loaded fields may need another pass.

Greenwich reused address IDs are scoped to the expected form actions, not the previous page URL. Referee contacts are scoped to the referee form. A control outside a known form stays blocked. The mailing form action `bwskaadr.P_ProcAppAddr2` follows the inventoried display route, but needs confirmation on the real portal. An unrecognised form stays manual rather than falling back to the other address kind.

Campora Home Address is copied as free text to `permanentAddress`, and its References table supplies the reference contacts. Present Address stays `location`. The visible summary has no separate city, postcode or country, so the reader does not invent those components or a same-address answer. The Campora refusal summary supplies the general flag; a recognised refusal table can supply a country. A summary Yes alone does not prove a UK refusal.

## Qualification completion

Manchester Completed is Yes only when the education end date is definitely in the past. A grade is not required. A month/year qualifies only after the entire month has ended; a year alone qualifies only after that year has ended. Current, future, invalid, unknown or missing dates do not imply either Yes or No.

## Still manual

No conditional workflows were selected in the approval questionnaire. The following remain manual:

- Manchester qualification, subject and grade category selection, including selecting Other.
- Manchester English-test reveal questions and test-specific score branches.
- Manchester statement upload/text mode selection.
- Bangor restricted-admissions starting term, study mode and point of entry.
- Sensitive declarations, consent, login, Save, Continue, Submit and payment.
- Unsupported source fields and additional records beyond the first copied entry.

The CRM can contain multiple education and work records. The extension currently stores one record per section in a flat map; this is an extension limitation, not a CRM limitation.

## Verification scope

The loaded-extension regressions are in `e2e/extension.e2e.mjs`, with synthetic HTTPS pages in `e2e/fixtures/*-approved-mapping.html` and the existing Campora fixture. They exercise real popup Copy and Autofill, source isolation, conditional address reveal, repeat-fill idempotence, cache immutability and draft-only behaviour. Local screenshots and command logs are under ignored `tmp/approved-rules-*` paths. See [APPROVED-RULES-VERIFICATION.md](APPROVED-RULES-VERIFICATION.md) for the final results.

These checks do not replace an authenticated live portal check or a native Safari behaviour check. In particular, real Manchester passport option labels and the Greenwich mailing form action require supervised confirmation. Unsupported option labels are not guessed.
