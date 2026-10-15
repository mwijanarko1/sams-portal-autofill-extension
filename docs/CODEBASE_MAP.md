---
last_mapped: 2026-10-12T12:10:26Z
---

# Codebase Map

Private Chrome MV3 / Safari Web Extension for authorised SAMS staff. Copies visible fields from an approved CRM profile into `chrome.storage.session`, then draft-fills empty fields on approved university portal pages. Never submits forms, never calls a CRM backend API.

Scanner inventory (excluding `node_modules`, `dist`, `tmp`, `.git`, binaries): **69 source/docs files**, ~132k tokens. Generated/build output and probe dumps live under `dist/` and `tmp/` and are not source of truth.

## System Overview

```text
popup.html / popup.js
  |  origin check, inject scripts, show cache/results
  v
src/background.js          session cache + 30 min alarm
  ^
  |  cacheStudent / getStudentCache / touch / clear
  |
src/crm-reader.js          CRM page only (profile guards)
config/crm-source.js       labels -> canonical keys
  |
  v
chrome.storage.session     one student profile, ephemeral
  |
  v
src/portal-fill.js         portal frame message handler
src/engine/engine.js       scan, match, format, fill
config/synonyms.js         shared field vocabulary
config/portals/*.js        per-portal origins, selectors, blocks
config/allowlist.js        exact CRM/portal origins + retention
```

Build produces independent browser outputs from the same shared JS:

| Target | Command | Output |
|---|---|---|
| Chrome dev | `npm run build` | `dist/chrome`, `dist/sams-portal-autofill-dev.zip` |
| Chrome prod | `npm run build:prod` | `dist/chrome`, prod zip (refused until allowlist complete) |
| Safari resources | `npm run build:safari` | `dist/safari-webextension` |
| Safari macOS app | `npm run build:safari:app` | unsigned app under `dist/safari-app` |

Production packaging rejects empty Campora origins or fewer than three portal origins.

## Directory Guide

| Path | Role |
|---|---|
| `manifest.json` | Source MV3 shell. Build injects `host_permissions` from allowlist. |
| `popup.html`, `popup.js` | Toolbar UI: Copy, Autofill, Clear, student card, countdown, result lists. |
| `config/allowlist.js` | Exact CRM, Campora, portal, and dev origins; 30 minute retention. |
| `config/build-mode.js` | Placeholder overwritten per build (`dev` / `prod`). |
| `config/crm-source.js` | CRM profile path/marker guards and label map. |
| `config/synonyms.js` | Shared deterministic field synonyms and autocomplete keys. |
| `config/portals/greenwich.js` | Greenwich origin, selectors, split dates, blocked controls. |
| `config/portals/bangor.js` | Bangor origin, selectors, split dates, blocked controls. |
| `config/portals/manchester.js` | Greater Manchester placeholder (no origins yet). |
| `src/background.js` | Serialized session cache, expiry alarm, identity-checked messages. |
| `src/crm-reader.js` | Visible CRM DOM reader; expands sections; refuses non-profile pages. |
| `src/portal-fill.js` | Page handler on a popup-only port; checks selected origin, sandboxing and top page; runs engine; returns fill report. |
| `src/engine/engine.js` | Core scan/match/format/fill, split dates, click guard, skip-if-filled. |
| `scripts/build.mjs` | Chrome/Safari resource package; per-target `dist` cleanup only. |
| `scripts/package-safari.mjs` | Xcode unsigned app build + embedded-resource hash check. |
| `safari/` | macOS containing app + Safari extension target. No copied JS tree. |
| `test/` | Node unit/config tests and Chromium DOM fixtures (84 tests on 2026-10-15). |
| `test/fixtures/` | Synthetic CRM HTML for reader tests. |
| `e2e/` | Loaded-extension Chromium E2E + opt-in live smoke. |
| `e2e/fixtures/` | Synthetic CRM/Bangor/Greenwich HTML for E2E and Safari checklist. |
| `e2e/safari/` | Safari fixture server and manual acceptance checklist. |
| `fixtures/` | Empty reserved root for future committed sanitized portal steps. |
| `docs/` | Staff, deploy, technical, Safari architecture, this map. |
| `docs/history/` | Historical portal notes (Greenwich inventory, Ulster/Sunderland, etc.). |
| `PORTALS.md` | Live portal verification matrix (current status). |
| `BUILD-PLAN.md` | Original phased plan; partially historical. |
| `README.md` | Product entry point and commands. |
| `tmp/` | Local probes, screenshots, live reports. Ignored; not documentation. |
| `.pstack/` | Local task notes. Not shipped. |

## Key Workflows

### Staff Copy → Autofill → Clear

1. Staff opens one CRM student profile on an approved origin.
2. Popup validates tab origin, injects `crm-reader.js` (+ config).
3. Reader re-checks origin/path/marker, maps visible labels, sends one profile to the worker.
4. Worker stores profile in `storage.session` and starts/resets the 30 minute alarm.
5. Staff opens a university form step and opens the popup from the toolbar there (temporary `activeTab` grant unless the portal is mapped). Popup discovers frames via `webNavigation.getAllFrames`.
6. Student values go only to the top frame and frames with exactly its origin, over a per-frame port; the handler re-checks origin, sandboxing and top page, and the popup re-reads the worker cache before sending.
7. Portal handler re-validates origin, runs the engine (empty fields only), returns filled/skipped/manual buckets.
8. Successful fill on at least one frame extends expiry. Clear, expiry, browser restart, or extension reload wipe the cache.

### Add an origin or portal field

1. Exact origin in `config/allowlist.js` (no path, no wildcards).
2. CRM labels in `config/crm-source.js` if needed.
3. Portal selectors/blocks/synonyms in `config/portals/<name>.js`; shared synonyms only in `config/synonyms.js`.
4. Sanitized fixture under `e2e/fixtures/` or future `fixtures/<portal>/`, plus a regression test.
5. Record journey results in `PORTALS.md`. Bump version and rebuild to ship.

### Chrome development loop

```sh
npm test
npm run build          # load dist/chrome unpacked
npm run test:e2e       # Helium + synthetic HTTPS fixtures
```

### Safari development loop

```sh
npm run build:safari:app
# operator enables unsigned extension in a dedicated Safari profile
npm run safari:fixtures   # needs free localhost:3000 and :3001
# checklist: e2e/safari/README.md
```

Safari runtime acceptance is manual. Playwright WebKit and `npm run test:e2e` do not prove Safari extension popup/worker/permissions.

### Production gate

`npm run build:prod` and `npm run build:safari:prod` refuse until Campora origin(s) and three portal origins are configured. Live CRM-to-portal journeys, signing/distribution, and Greater Manchester mapping remain open.

## Navigation: where guidance lives

| Need | Start here |
|---|---|
| Staff usage | `docs/STAFF-GUIDE.md` |
| Install / CWS / Safari package path | `docs/INSTALL-AND-DEPLOY.md` |
| Architecture, mapping how-to | `docs/TECHNICAL-AND-MAPPING.md` |
| Portal status matrix | `PORTALS.md` |
| Safari design, parity, SAMS decisions | `docs/SAFARI-ARCHITECTURE-AND-PARITY.md` |
| Safari build/enablement | `safari/README.md` |
| Safari manual acceptance | `e2e/safari/README.md` |
| Chromium E2E and live smoke rules | `e2e/README.md` |
| Historical Greenwich/Bangor inventories | `docs/history/` |
| Phased delivery plan (partly historical) | `BUILD-PLAN.md` |
| This map | `docs/CODEBASE_MAP.md` |

## Known Risks

- **Incomplete production allowlist:** Campora and Greater Manchester origins missing; prod builds intentionally fail.
- **Safari runtime unverified:** containing app builds and embeds resources; installed Safari behavior still needs operator checklist (ports 3000/3001 may be owned by other projects).
- **Localhost fixtures use generic matching:** Bangor/Greenwich portal-specific maps apply on production origins only. Safari fixture parity is not portal-origin parity.
- **Generic matching is conservative:** unmapped universities get shared personal/contact fields only; everything ambiguous or third-party stays manual. Sandboxed same-origin frames are not filled and are reported as not filled.
- **Live no-save smoke is opt-in only:** needs approved PinchTab profile and credentials in ignored `.env.local`. Not part of `npm test`.
- **Empty `fixtures/` root:** committed sanitized per-step portal HTML for warranty still largely local/`tmp` or `e2e/fixtures` synthetics.
- **Non-UK Home Telephone length:** Greenwich 11-character limit can require manual clear/correct.
- **Student replacement race:** popup cache read vs in-flight fill can race; no operation token yet (release hardening).
- **Portal autosave:** extension does not block network writes; no-save harness must detect unexpected POSTs.
- **Do not treat `tmp/` or `.pstack/` as product docs.**

## Verification snapshot at last map

- `npm test`: 61/61 pass (unit + Chromium DOM, including Safari build/fixture and session lifecycle tests).
- `npm run test:e2e`: documented 5/5 Chromium loaded-extension journeys when Helium is available (not re-run for this map refresh).
- Safari: unsigned app path and docs present; runtime acceptance still pending operator enablement.
- Version: `0.1.0` across `package.json`, `manifest.json`, and Safari `MARKETING_VERSION`.
