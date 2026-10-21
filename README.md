# SAMS Portal Autofill

Private Chrome Manifest V3 extension for authorised SAMS staff. It copies visible fields from an approved SAMS CRM or Campora student profile into `chrome.storage.session`, then fills empty fields on the university application page where staff open the extension. It never submits, pays for, declares, or confirms an application, and per-page Autofill never saves or continues. An experimental **Fill all** mode can also click the portal's own draft-saving Save and continue across supported screens (Bangor Personal Details, Contact Details and Finance; the Greenwich checklist sections it recognises; the Greater Manchester data-entry tabs; and other sites where staff open the extension on the application page and the form has one explicit Save and continue to a page of the same application). It has been exercised against synthetic pages only: live saving and Safari are unverified. Its only CRM API calls are read-only requests that list the open student's documents and fetch one file when staff attach it.

## Current status

The Chrome architecture, CRM page reader, 30 minute session cache, runtime origin checks, safe frame targeting, draft-only fill engine, development build, and documentation are implemented.

~~Production packaging and the three portal mappings remain blocked until SAMS provides the exact Campora, Greenwich, Greater Manchester, and Bangor application origins plus supervised test access.~~ Greenwich and Bangor origins, field inventories, and reviewed mappings are in tree. PR #1 (Greenwich) merged as `8d0f534`. Automated coverage is currently **61** Node/Chromium tests (`npm test`) plus the loaded-extension suite (`npm run test:e2e`). Qualification and phone fixes also passed sanitized saved-form replay in Helium.

Universities without a saved mapping use shared matching: it fills title, name, date of birth, gender, nationality, email, one phone number, address line 1, town, county, postcode, country, and passport number only where one control clearly asks for that value. Account, password, payment, declaration, referee, emergency-contact, agent, education, and employment fields, split dates, radio groups, search pickers, and duplicate fields stay manual. Greenwich, Bangor, and Greater Manchester keep their saved mappings. Opening the toolbar grants one-time page access where supported. On other HTTPS university websites, **Allow this website** requests access to that exact origin only, including third-party application domains. The optional `https://*/*` declaration lets staff choose a site; it does not grant blanket access. Browser settings can revoke each grant. Only the selected page's own-origin frames receive student values. CRM Copy remains restricted to approved SAMS sources. Site access is not a guarantee of portal field coverage or Safari compatibility.

Live CRM-to-portal verification, committed sanitized per-step fixtures under `fixtures/<portal>/`, remaining Greenwich manual fields, and Greater Manchester / Campora origins remain open, so `npm run build:prod` intentionally refuses the incomplete production allowlist. A macOS Safari development scaffold exists (`npm run build:safari:app`); installed Safari runtime acceptance is still pending. Non-UK numbers exceeding Home Telephone's 11-character limit need manual correction or clearing. See `PORTALS.md`, `docs/CODEBASE_MAP.md`, `BUILD-PLAN.md`, and `docs/history/GREENWICH.md`.

## Development build

```bash
npm test
npm run build
```

Load `dist/chrome` from `chrome://extensions` with Developer mode enabled. The development build permits the mock CRM at `http://localhost:3000` and mock portal at `http://localhost:3001`.

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
   To attach CRM documents, keep SAMS CRM open in a tab, select **Attach CRM documents**, choose a document for each upload field, and select **Attach**. Some portals upload the file as soon as it is attached.
   Experimental: select **Autofill all & save** to fill and save the supported screens of Bangor, Greenwich (checklist sections) or Greater Manchester (data-entry tabs) in one run, or of another site after you open the extension from the toolbar on its application page. It stops at anything unclear or final, never enters Greenwich Signature or Greater Manchester Submission, and Stop is always available.
5. Review all filled and manual-review fields, then submit manually.
6. Use **Clear** when finished. Data otherwise expires after 30 minutes of inactivity.

## Structure

- `config/allowlist.js`: approved origins and expiry setting
- `config/crm-source.js`: CRM profile guard and label mapping
- `config/synonyms.js`: shared deterministic field synonyms and the generic field registry for unmapped universities
- `config/portals/`: portal-specific mappings
- `src/crm-reader.js`: visible CRM page reader
- `src/crm-documents.js`: lists the open student's CRM documents (metadata only) and fetches one file through the CRM session when staff attach it
- `src/engine/engine.js`: scan, match, format, and fill engine
- `src/portal-fill.js`: page handler that accepts student values only from the popup, over a port bound to the selected page
- `src/background.js`: session cache and expiry alarm
- `scripts/build.mjs`: development and production packaging for the `chrome` (default) and `safari` targets
- `scripts/package-safari.mjs`: unsigned macOS app build and embedded-resource check
- `safari/`: macOS containing app and Safari extension target, no copied extension code
- `test/`, `e2e/`: unit/DOM tests, Chromium loaded-extension E2E, Safari fixture checklist
- `docs/`: staff, deployment, mapping guides, Safari architecture, and [CODEBASE_MAP.md](docs/CODEBASE_MAP.md)

No extension login, licence server, AI inference, backend writes, automatic document upload, or automatic irreversible actions are included.

## End-to-end testing

Run `npm run test:e2e` for the loaded-extension Bangor, Greenwich, and unmapped-university fixture suite.
Run the explicit no-save live smoke journey only with an approved automation
profile and local credentials. Setup, safeguards, coverage, and verification
boundaries are documented in [e2e/README.md](e2e/README.md).
