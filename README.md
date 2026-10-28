# SAMS Portal Autofill

Private Chrome Manifest V3 extension for authorised SAMS staff. It copies visible fields from an approved SAMS CRM or Campora student profile into `chrome.storage.session`, then fills empty fields on the university application page where staff open the extension. It never submits, pays for, declares, or confirms an application, and per-page Autofill never saves or continues. Its only CRM API calls are read-only requests that list the open student's documents and fetch one file when staff attach it.

## Current status

Version `0.1.0`. The Chrome extension, CRM page reader (SAMS CRM and Campora APPLY), 30 minute session cache, runtime origin checks, safe frame targeting, draft-only fill engine, CRM document attach, production build and handover documentation are implemented. Saved field mappings exist for the University of Greenwich, Bangor University and the University of Greater Manchester. A macOS Safari development scaffold builds, but installed Safari runtime behaviour has not been verified.

Universities without a saved mapping use shared matching. It fills title, name, date of birth, gender, nationality, email, one phone number, address line 1, town, county, postcode, country, and passport number only where one control clearly asks for that value. Account, password, payment, declaration, referee, emergency-contact, agent, education, and employment fields, split dates, radio groups, search pickers, and duplicate fields stay manual. Opening the toolbar grants one-time page access where supported. On other HTTPS university websites, **Allow this website** requests access to that exact origin only. The optional `https://*/*` declaration lets staff choose a site; it does not grant blanket access. Only the selected page's own-origin frames receive student values. CRM Copy is restricted to approved SAMS CRM or Campora origins.

## Verification scope

Verified: `npm test` (135 tests), the loaded-extension `npm run test:e2e` suite (50 tests, synthetic pages), the production build, and one supervised live Campora-to-Bangor no-save run. Live runners (`npm run test:e2e:live`, `npm run test:e2e:documents:live`) and the Safari acceptance checklist are included for SAMS to run against Greenwich, Greater Manchester and installed Safari; no results for those are recorded here. The Chrome Web Store account, privacy-policy publication and Safari signing belong to SAMS. Details, owners and portal status are in [docs/RELEASE-STATUS.md](docs/RELEASE-STATUS.md) and [PORTALS.md](PORTALS.md). The codebase map is [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Development build

```bash
npm test
npm run build
```

Load `dist/chrome` from `chrome://extensions` with Developer mode enabled. The development build permits the mock CRM at `http://localhost:3000` and mock portal at `http://localhost:3001`.

## Production build

```bash
npm test
npm run build:prod
```

This writes `dist/chrome` and `dist/sams-portal-autofill-prod.zip` with only the SAMS CRM, Campora and three portal origins as host permissions (no localhost, no `<all_urls>`). The same zip is attached to each GitHub release. Packaging and store steps are in [docs/INSTALL-AND-DEPLOY.md](docs/INSTALL-AND-DEPLOY.md).

## Safari for macOS (development)

```bash
npm run build:safari        # dist/safari-webextension from the same shared source
npm run build:safari:app    # unsigned local macOS app, embedded-resource check
```

The Xcode project lives in `safari/`. It has development-only placeholder identifiers
and no signing or distribution setup. Safari runtime behavior has not been verified yet.
See [safari/README.md](safari/README.md) and the
[Safari acceptance checklist](e2e/safari/README.md).

## Staff flow

1. Open an individual student profile in SAMS CRM or Campora.
2. Select **Copy from CRM**.
3. Open the university application form, then open the extension from the browser toolbar on that page.
   If **Allow this website** appears, confirm the displayed hostname and use it to request access to that site only. Declining does not fill anything. Granting access does not automatically fill, attach files, or save; choose the next action yourself.
4. Select **Autofill this page** on each form step.
   To attach CRM documents, keep SAMS CRM open in a tab, select **Attach CRM documents**, choose a document for each upload field, and select **Attach**. **Show on page** scrolls to and outlines a field without changing it; if the portal hides its file input behind its own widget it says so, and you attach manually. Attach only assigns the file in the browser: check the portal accepted it, as some portals upload the file as soon as it is attached.
5. Review all filled and manual-review fields, then submit manually.
6. Use **Clear** when finished. Data otherwise expires after 30 minutes of inactivity.

## Structure

- `config/allowlist.js`: approved origins and expiry setting
- `config/crm-source.js`: SAMS CRM and Campora profile guards and label mapping
- `config/synonyms.js`: shared deterministic field synonyms and the generic field registry for unmapped universities
- `config/portals/`: portal-specific mappings
- `src/crm-reader.js`: visible CRM page reader for SAMS CRM (Profile tab plus the Applications stage panels when mounted; in-place fallback for older layouts) and Campora APPLY (Profile tab plus the application header)
- `src/crm-documents.js`: lists the open student's CRM documents (metadata only) and fetches one file through the CRM session when staff attach it
- `src/engine/engine.js`: scan, match, format, and fill engine
- `src/portal-fill.js`: page handler that accepts student values only from the popup, over a port bound to the selected page
- `src/background.js`: session cache and expiry alarm
- `scripts/build.mjs`: development and production packaging for the `chrome` (default) and `safari` targets
- `scripts/package-safari.mjs`: unsigned macOS app build and embedded-resource check
- `safari/`: macOS containing app and Safari extension target, no copied extension code
- `test/`, `e2e/`: unit/DOM tests, Chromium loaded-extension E2E, Safari fixture checklist
- `docs/`: handover, staff and deployment guides, [CODEBASE_MAP.md](docs/CODEBASE_MAP.md), [RELEASE-STATUS.md](docs/RELEASE-STATUS.md), Safari architecture, per-portal field maps in `docs/portal-maps/` (including the CRM Profile-tab map [CRM-LEAD-PROFILE.md](docs/portal-maps/CRM-LEAD-PROFILE.md)), and Chrome Web Store drafts in `docs/store-submission/`

No extension login, licence server, AI inference, backend writes, automatic document upload, or automatic irreversible actions are included.

## End-to-end testing

Run `npm run test:e2e` for the loaded-extension Bangor, Greenwich, Greater Manchester and unmapped-university fixture suite.
Run the explicit no-save live smoke journey only with an approved automation
profile and local credentials. Setup, safeguards, coverage, and verification
boundaries are documented in [e2e/README.md](e2e/README.md).
