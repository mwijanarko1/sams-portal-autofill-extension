# SAMS Portal Autofill

Private Chrome Manifest V3 extension for authorised SAMS staff. It copies visible fields from an approved SAMS CRM or Campora student profile into `chrome.storage.session`, then fills empty fields on approved university portal pages. It never submits a form or calls a CRM backend API.

## Current status

The Chrome architecture, CRM page reader, 30 minute session cache, runtime origin checks, safe frame targeting, draft-only fill engine, development build, and documentation are implemented.

~~Production packaging and the three portal mappings remain blocked until SAMS provides the exact Campora, Greenwich, Greater Manchester, and Bangor application origins plus supervised test access.~~ Greenwich's origin, field inventory, reviewed mappings, and safety fixes are complete in [PR #1](https://github.com/mwijanarko1/sams-portal-autofill-extension/pull/1), merged as `8d0f534`. All 16 automated tests and the development build pass; qualification and phone fixes also passed sanitized saved-form replay in Helium.

Live CRM-to-portal verification, committed sanitized fixtures, and the remaining Greenwich manual fields are still open. Campora, Greater Manchester, and Bangor origins/access remain pending, so `npm run build:prod` intentionally refuses the incomplete production allowlist. Non-UK numbers exceeding Home Telephone's 11-character limit need manual correction or clearing. See `BUILD-PLAN.md`, `PORTALS.md`, and `docs/history/GREENWICH.md` for completed and remaining work.

## Development build

```bash
npm test
npm run build
```

Load `dist/chrome` from `chrome://extensions` with Developer mode enabled. The development build permits the mock CRM at `http://localhost:3000` and mock portal at `http://localhost:3001`.

## Staff flow

1. Open an individual student profile in SAMS CRM or Campora.
2. Select **Copy from CRM**.
3. Open an approved university portal form.
4. Select **Autofill this portal page** on each form step.
5. Review all filled and manual-review fields, then submit manually.
6. Use **Clear** when finished. Data otherwise expires after 30 minutes of inactivity.

## Structure

- `config/allowlist.js`: approved origins and expiry setting
- `config/crm-source.js`: CRM profile guard and label mapping
- `config/synonyms.js`: shared deterministic field synonyms
- `config/portals/`: portal-specific mappings
- `src/crm-reader.js`: visible CRM page reader
- `src/engine/engine.js`: scan, match, format, and fill engine
- `src/portal-fill.js`: allowlisted portal message handler
- `src/background.js`: session cache and expiry alarm
- `scripts/build.mjs`: development and production Chrome packaging
- `docs/`: staff, deployment, and mapping guides

No extension login, licence server, AI inference, backend integration, document upload, or automatic irreversible actions are included.

## End-to-end testing

Run `npm run test:e2e` for the loaded-extension Bangor and Greenwich fixture suite.
Run the explicit no-save live smoke journey only with an approved automation
profile and local credentials. Setup, safeguards, coverage, and verification
boundaries are documented in [e2e/README.md](e2e/README.md).
