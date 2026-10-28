# Portal status

This page shows what the extension supports for each portal and what has been tested live. Do not guess or widen the production host permissions.

## Portals

| Portal | Origin | Mapped sections | Synthetic test page | Live test result | Field map |
|---|---|---|---|---|---|
| University of Greenwich | `nelson.gre.ac.uk` | Personal, Contact, Education, Employment, and the other checklist sections (all ten inventoried on 2026-10-23) | `e2e/fixtures/greenwich.html` | None recorded | [GREENWICH.md](docs/portal-maps/GREENWICH.md) |
| University of Greater Manchester | `evision.bolton.ac.uk` | Personal Details, Contact Details, Qualifications, Experience, and the other SITS tabs (inventoried on 2026-10-23) | `e2e/fixtures/manchester-personal-mapping.html` (Personal Details) | None recorded | [MANCHESTER.md](docs/portal-maps/MANCHESTER.md) |
| Bangor University | `apps.bangor.ac.uk` | Personal, International, Programme lookup, Additional Info, Contact, Education, Employment, Language, Finance (inventoried on 2026-10-23) | `e2e/fixtures/bangor.html` | One Campora-to-Bangor run without saving (2026-10-25) | [BANGOR.md](docs/portal-maps/BANGOR.md) |

Notes:

- **Approved answer rules, 2026-10-28.** Nationality now supplies Manchester British-passport/EU answers and Bangor passport nation. Current residence supplies Manchester application location. Greenwich legal name and referee contacts, separate permanent/present addresses, Manchester past-date completion and Bangor UK-specific refusal answers are mapped. Agency Name is SAMS Global; agency city/email remain manual. These changes have [synthetic extension coverage](docs/portal-maps/APPROVED-RULES-VERIFICATION.md), not a new live run. See the [complete rules and exclusions](docs/portal-maps/APPROVED-RULES.md).

- **Greenwich.** Programme fills in three passes: intake, then programme, then mode. Split dates cover the applicant address, the qualification award date, and the education attendance dates.
- **Greater Manchester.** Qualification name, subject, grade, and the typed statement need a two-pass reveal. Staff answer the conditional questions first and then run Autofill again.
- **Bangor.** The Programme section opens only after Personal is saved. The extension never saves, so Programme stays untested unless the draft is already unlocked.

## CRM sources

Copy reads two approved sources:

- **SAMS CRM** (`https://app.samscrm.co.uk`). The reader uses the lead header, the Applications tab (stage panels when mounted, otherwise the visible form), and the Profile tab (all ten sections). It works for direct, sub-agent, and converted leads. The layout is the same: `/agent/leads/full-profile/<id>`. Profile values win when both tabs give the same key. The full field map is in [CRM-LEAD-PROFILE.md](docs/portal-maps/CRM-LEAD-PROFILE.md).
- **Campora APPLY** (`https://v-sams-backend.samsapply.co.uk`, route `/applyuser/show/<id>/profile`). The Profile tab loads when it is opened. The reader opens it, reads only the keys that the engine and portal maps use, and restores the previous tab. It includes separate Home/Present Address text, reference contacts and refusal evidence; it does not map unrelated status flags, student quality or the level badge. Missing address components are not guessed. Campora documents are not listed or fetched. Staff attach them manually. The full map is in [CAMPORA.md](docs/portal-maps/CAMPORA.md).

## Live test result

On 2026-10-25, one supervised run copied a real Campora application and filled a real Bangor draft without saving. Copy returned 30 fields. The Bangor education, employment, and finance sections gained eight filled controls. The run kept existing and blocked values, made no blocked writes, and cleared the cache.

This is one application and one portal. The run did not check that the draft belonged to the same applicant. Treat it as a field-fill smoke test, not as acceptance.

No other live CRM-to-portal run is recorded. The live runners can target all three portals, but a configured journey is not a passed journey. See [e2e/README.md](e2e/README.md).

## Record a new journey

For each supervised journey, record:

- the exact origin and page matcher,
- the fields filled,
- the existing values skipped,
- the fields with no CRM value,
- the fields left for manual review,
- a sanitized HTML fixture in `e2e/fixtures/`, where possible.

Greenwich limits Home Telephone to 11 characters. Staff must correct longer non-UK numbers.
