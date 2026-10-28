# Codebase map

SAMS Portal Autofill is a Chrome Manifest V3 extension. A Safari Web Extension build uses the same source. Staff copy visible fields from a CRM profile into a temporary session cache. The extension then fills empty fields on approved university application pages. It never submits a form.

## System overview

```text
popup.html / popup.js
  |  checks the origin, injects scripts, shows the cache and results
  v
src/background.js          session cache and 30 minute alarm
  ^
  |  cacheStudent / getStudentCache / touch / clear
  |
src/crm-reader.js          runs on the CRM page only
src/crm-documents.js       runs on the CRM page only (lists documents, fetches a file on attach)
config/crm-source.js       CRM labels -> canonical keys
  |
  v
chrome.storage.session     one student profile
  |
  v
src/portal-fill.js         message handler in each portal frame
src/engine/engine.js       scan, match, format, fill
config/synonyms.js         shared field vocabulary
config/portals/*.js        per-portal origins, selectors, blocked controls
config/allowlist.js        exact CRM and portal origins, retention time
```

## Build commands

| Target | Command | Output |
|---|---|---|
| Chrome, development | `npm run build` | `dist/chrome`, `dist/sams-portal-autofill-dev.zip` |
| Chrome, production | `npm run build:prod` | `dist/chrome`, `dist/sams-portal-autofill-prod.zip` |
| Safari resources | `npm run build:safari` | `dist/safari-webextension` |
| Safari macOS app | `npm run build:safari:app` | Unsigned app in `dist/safari-app` |

The production build stops if the Campora list is empty or if fewer than three portal origins are set. Each target cleans only its own `dist` paths.

## Directory guide

| Path | Role |
|---|---|
| `manifest.json` | Source manifest. The build writes `host_permissions` from the allowlist. |
| `popup.html`, `popup.js` | Toolbar UI: Copy, Autofill, Clear, student card, countdown, result lists, and CRM document attach (**Show on page**, **Attach**). |
| `src/popup-motion.js` | Popup animation helper. |
| `config/allowlist.js` | Exact CRM, Campora, portal, and development origins. 30 minute retention. |
| `config/build-mode.js` | Placeholder. The build overwrites it with `dev` or `prod`. |
| `config/crm-source.js` | Profile path and marker guards for SAMS CRM and Campora. Label map. |
| `config/synonyms.js` | Shared field synonyms and autocomplete keys. |
| `config/portals/greenwich.js` | Greenwich origin, selectors, split dates, blocked controls. |
| `config/portals/bangor.js` | Bangor origin, selectors, split dates, blocked controls. |
| `config/portals/manchester.js` | Greater Manchester origin (`evision.bolton.ac.uk`), selectors, split dates, blocked controls. |
| `src/background.js` | Session cache, expiry alarm, and checked messages. Serializes cache changes. |
| `src/crm-reader.js` | Reads the visible CRM page. Refuses pages that are not student profiles. See "CRM sources" below. |
| `src/crm-documents.js` | Lists the profile's documents from the nine `fp_*_docs` GET endpoints. Keeps metadata for `/tmp_aws_media/` files only. Fetches one file on attach, inside the CRM tab. |
| `src/portal-fill.js` | Handler in the portal page. Accepts values only from the popup, over a port bound to the selected page. |
| `src/engine/engine.js` | Scan, match, format, and fill. Split dates, click guard, skip-if-filled. |
| `scripts/build.mjs` | Builds the Chrome and Safari resource packages. |
| `scripts/package-safari.mjs` | Builds the unsigned macOS app and checks the embedded resources. |
| `safari/` | macOS containing app and Safari extension target. It holds no copy of the extension code. |
| `test/` | Node unit tests and Chromium DOM tests. |
| `test/fixtures/` | Synthetic CRM HTML for the reader tests. |
| `e2e/` | Chromium end-to-end tests and the opt-in live runners. |
| `e2e/fixtures/` | Synthetic CRM and portal HTML for E2E tests and the Safari checklist. |
| `e2e/safari/` | Safari fixture server and manual checklist. |
| `docs/` | Guides and this map. |
| `docs/docx/` | Word copies of the guides. |
| `docs/portal-maps/` | Field maps for Greenwich, Bangor, Greater Manchester, Campora, and the SAMS CRM Profile tab. |
| `docs/store-submission/` | Draft text and images for the Chrome Web Store and the privacy policy. |
| `PORTALS.md` | Per-portal status. |

### CRM sources

- **SAMS CRM.** The reader reads the Applications stage panels when they are mounted. It also reads the Profile tab for every lead type. Profile values win when both tabs give the same key. For older layouts without a Profile tab, it reads the page in place.
- **Campora APPLY.** The reader opens the Profile tab, reads the summary and record tables, and reads the application header. It then restores the tab that was active before Copy. The map is in [portal-maps/CAMPORA.md](portal-maps/CAMPORA.md).

## Main workflow: Copy, Autofill, Clear

1. Staff open one CRM student profile on an approved origin.
2. The popup checks the tab origin and injects `crm-reader.js` and its config.
3. The reader checks the origin, path, and page marker. It maps visible labels to keys and sends one profile to the worker.
4. The worker stores the profile in `storage.session` and starts the 30 minute alarm.
5. Staff open a university form step and open the popup from the toolbar. For an unmapped portal, the browser gives a temporary `activeTab` grant. The popup finds the frames with `webNavigation.getAllFrames`.
6. The popup sends student values only to the top frame and to frames with exactly the same origin. It uses one port per frame. The handler checks the origin, the sandbox state, and the top page again. The popup reads the worker cache again before it sends the values.
7. The portal handler runs the engine. The engine fills empty fields only. It returns lists of filled, skipped, and manual fields.
8. To attach a document, the popup lists the page's `input[type=file]` controls over the same ports. Staff choose a document for each field. A CRM tab fetches the file bytes. `portal-fill.js` assigns one `File` to the field and fires `input` and `change`. Autofill never touches file inputs.
9. A successful fill in at least one frame extends the expiry. Clear, expiry, a browser restart, or an extension reload deletes the cache.

## Derived keys

The CRM does not send a birth country, a country of residence, or a programme intake. `DERIVED_KEYS` in `src/engine/engine.js` builds them:

- `countryOfBirth` comes from `nationality`.
- `currentDomicile` comes from `countryName`.
- `preferredIntake` comes from `preferredStartMonth` and `preferredStartYear`.

The engine adds a derived key only when the active portal maps it. A portal can also set `valueMaps` (CRM value to option text) when its option list has no clean match. Values that a map omits stay unfilled.

These keys are mapped, but a real CRM profile never fills them, because the reader does not send them: `ethnicity` (all three portals), `previousName` (all three), `personalStatement` (Greenwich, Greater Manchester), and, for Greater Manchester, `previouslyApplied`, `englishFirstLanguage`, and `state` (County, `#IPR_HAD4`). They fill only if the CRM later shows the label.

The nationality format on the Applications tab (country or demonym) is unverified. The Profile tab sends a country name and wins on that key.

## Common tasks

### Add an origin or a portal field

1. Add the exact origin to `config/allowlist.js`. Use no path and no wildcard.
2. Add CRM labels to `config/crm-source.js` if you need them.
3. Add selectors, blocked controls, and synonyms to `config/portals/<name>.js`. Put synonyms in `config/synonyms.js` only when all portals share them.
4. Add a sanitized fixture under `e2e/fixtures/` and a regression test.
5. Record the result in `PORTALS.md`. Increase the version and rebuild.

### Run the checks

```sh
npm test               # unit and DOM tests
npm run build          # then load dist/chrome unpacked
npm run test:e2e       # visible Chromium (Helium by default) on synthetic pages
```

### Test Safari

```sh
npm run build:safari:app
# enable the unsigned extension in a dedicated Safari profile
npm run safari:fixtures   # needs free local ports 3000 and 3001
# then follow e2e/safari/README.md
```

Safari testing is manual. Playwright WebKit and `npm run test:e2e` cannot test the Safari extension popup, worker, or permissions.

## Where to find guidance

| Need | Start here |
|---|---|
| Staff usage | [USER-HANDOVER.md](USER-HANDOVER.md), [STAFF-GUIDE.md](STAFF-GUIDE.md) |
| Security, storage, and IT duties | [TECHNICAL-HANDOVER.md](TECHNICAL-HANDOVER.md) |
| Install, release, Safari packaging | [INSTALL-AND-DEPLOY.md](INSTALL-AND-DEPLOY.md) |
| Architecture and mapping how-to | [TECHNICAL-AND-MAPPING.md](TECHNICAL-AND-MAPPING.md) |
| Portal status | [../PORTALS.md](../PORTALS.md) |
| Field maps | [portal-maps/](portal-maps/) |
| Safari design and parity | [SAFARI-ARCHITECTURE-AND-PARITY.md](SAFARI-ARCHITECTURE-AND-PARITY.md) |
| Safari build and enablement | [../safari/README.md](../safari/README.md) |
| Safari manual checklist | [../e2e/safari/README.md](../e2e/safari/README.md) |
| End-to-end tests and live runners | [../e2e/README.md](../e2e/README.md) |
| Chrome Web Store and privacy drafts | [store-submission/](store-submission/) |

## Known limits

- **Live portals.** The tests use synthetic pages. Only one live run is recorded (Campora to Bangor, without saving). Portal-specific maps apply on the production origins only. Localhost fixtures use generic matching.
- **Safari.** The macOS app builds. Nobody has tested it in an installed Safari.
- **Generic matching.** On unmapped universities, it fills common personal and contact fields only. Sandboxed same-origin frames are not filled. The popup reports them as not filled.
- **Portal autosave.** The extension cannot block a portal from saving or uploading after `input` and `change` events.
- **Greenwich telephone.** Greenwich limits Home Telephone to 11 characters. Staff must correct longer non-UK numbers.
- **One value per field.** The cache keeps one value per key. A second education, passport, visa, work, or reference entry is not stored.
- **Student replacement.** A popup cache read can race with a fill that is already running. There is no operation token yet.
