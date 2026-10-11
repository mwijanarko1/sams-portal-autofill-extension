# SAMS Portal Autofill: Build Plan (Chrome first)

**Created:** 2026-09-29
**Scope source:** `../SAMS-PORTAL-AUTOFILL-AGREED-CONTEXT.md` (canonical), PRD `../sams-crm-ai-demo/docs/SAMS-PORTAL-AUTOFILL-UPDATED-PRD-AND-QUOTATION.md` (section 02A), Agreed Project Terms.
**Browser focus:** Chrome MV3 now. Safari after Chrome is feature-complete.
**Baseline:** commit `bb3e1e4` is the localhost demo snapshot (was v2.3.10). Versioning restarts at **0.1.0**.

---

## Versioning

| Version | Gate |
|---|---|
| 0.1.0 | Rebuild starts (demo engine, localhost source still present) |
| 0.2.0 | Week 1 proof: Copy from CRM + allowlisted Autofill + session cache on mocks/real CRM |
| 0.5.0 | Week 2 feature-complete: Greenwich, Greater Manchester, Bangor mapped and verified |
| 1.0.0 | Week 3 handover: Chrome build, source, docs, unlisted CWS package |

Timeline assumes the 3-week PRD cadence. If SAMS picks the 6-week terms, gates move to end W2 / W4 / W6.

---

## Current state (what exists)

**Keep (reusable engine in `content.js`):**
- Synonym-scored matching, label/aria/legend/heading discovery, shadow DOM walk
- Date, select, radio, and Lightning combobox fill
- Skip-if-filled (`skippedExisting`)
- Checkboxes already excluded from `FIELD_SELECTORS`; never clicks submit

**Replace:**
- `popup.js` student search + `BACKEND_URL = "http://localhost:3000"` + `fetchProfile` / `buildFieldMap` API path
- Student picker UI in `popup.html`

**Fix:**
- `host_permissions` is localhost only; no origin allowlist
- `runAcrossFrames` injects into `allFrames` and sends `fieldMap` to every frame, including cross-origin (payment, analytics) iframes
- `selectedStudent` persisted in `chrome.storage.local`
- Radio and combobox paths call `.click()` with no guard against declaration or action controls
- Summary lists unmatched CRM keys, but not portal fields left empty (PRD Q6 asks for these)

---

## Phase 0: Baseline and structure (0.5 day)

1. [x] Commit demo snapshot (`bb3e1e4`).
2. [x] Reset version to 0.1.0.
3. [ ] Split `content.js` into engine + config. Plain JS, no bundler. Inject in order with `chrome.scripting.executeScript({ files: [...] })`. Same files convert to Safari later.

Target layout:

```
config/
  allowlist.js          CRM/Campora origins + portal origins
  crm-source.js         student profile URL pattern + CRM label -> canonical key map
  synonyms.js           moved SYNONYM_MAP + AUTOCOMPLETE_KEY_MAP
  portals/
    greenwich.js
    manchester.js
    bangor.js
src/
  engine/               scan, match, format, fill (from content.js)
  crm-reader.js         Copy from CRM page reader
  portal-fill.js        message handler for Autofill
  background.js         session expiry alarm
  popup.{html,js}
scripts/
  build.mjs             dev/prod manifest + dist/chrome + zip
fixtures/               sanitized portal step HTML (no real student data)
docs/
  history/              SUNDERLAND.md, ULSTER_QA.md, old PORTALS.md
```

## Phase 1: Config and allowlist (1 day)

1. `config/allowlist.js`
   - CRM: `https://app.samscrm.co.uk` (confirm), Campora origin (TBC by SAMS)
   - Portals: Greenwich, Greater Manchester, Bangor origins (TBC at kickoff)
2. `config/crm-source.js`: profile page URL pattern, DOM marker, label -> key map.
3. `config/portals/*.js`: origin, page/step matchers, per-field selector overrides, extra synonyms, per-portal blocked controls.
4. `scripts/build.mjs` (approved): generates `host_permissions` from the allowlist.
   - `dev` build adds localhost (mock CRM + `university-portal-demo`)
   - `prod` build has only the allowlist; no `<all_urls>`, no localhost
   - Outputs `dist/chrome/` and a CWS zip
5. List is config only. No end-user UI to edit origins. Changes ship as a new version.

## Phase 2: Copy from CRM (1.5 days)

1. `crm-reader.js`, injected only on click, only after popup and reader both confirm an allowlisted CRM origin.
2. Page guard: profile URL pattern + DOM marker. Login, dashboard, settings, lists refuse with a clear message.
3. Read visible label/value pairs into canonical keys. Keep derived values the demo already builds (emergency first/last split, date parts).
4. Result: `{ studentId, studentName, sourceOrigin, copiedAt, fields }`.
5. Remove student search, student list, localhost fetch, `buildFieldMap` API parsing.
6. Develop against the CRM clone (`../sams-crm-ai-demo`, route `leads/full-profile/[id]`), then confirm labels on the live CRM with a SAMS test account.
7. Kickoff check: are some CRM sections lazy-loaded tabs? If yes, staff open them before Copy, or reader reports "section not loaded".

## Phase 3: Session cache (1 day)

1. `chrome.storage.session` only (memory, cleared on browser restart and extension reload/update, not exposed to content scripts by default).
2. `background.js` service worker + `chrome.alarms`: wipe after 30 min idle. Copy and Autofill reset the timer. Expiry value in config (SAMS may shorten at kickoff).
3. **Clear student data** button. New Copy replaces the previous student.
4. Remove all `chrome.storage.local` use.
5. Popup shows the cached student name, copied time, and time until expiry.

## Phase 4: Autofill guardrails and summary (1.5 days)

1. Origin check in popup before inject, re-check `location.origin` in the content script.
2. Frames: send data only to frames whose own origin is on the portal allowlist.
3. Click guard: allow only radio inputs and listbox options belonging to the field being filled. Never click buttons, links, or controls whose text/aria matches submit, pay, send, delete, confirm, declare, agree, next, save, continue.
4. Skip-if-filled stays the default.
5. Summary buckets:
   - Filled
   - Skipped (portal already had a value)
   - No CRM value
   - **Portal fields left empty: needs manual review**
6. UI copy states draft only; staff review and submit.

## Phase 5: Portal mappings (Week 2, needs access)

### Greenwich progress after PR #1

Completed in [PR #1](https://github.com/mwijanarko1/sams-portal-autofill-extension/pull/1), merged as `8d0f534` on 2026-09-29. These completions apply to Greenwich only, not the three-portal feature-complete gate.

- [x] ~~Confirm and allowlist the Greenwich application origin (`https://nelson.gre.ac.uk`).~~
- [x] ~~Inventory Greenwich checklist sections and document the 191 discovered fields.~~
- [x] ~~Add reviewed Greenwich selector overrides, synonyms, and blocked controls.~~
- [x] ~~Block shared DOB/employment date selects, referee fields, and institution city/postcode/country from unsafe applicant fills.~~
- [x] ~~Prevent duplicate qualifications on repeat Autofill by blocking rows 2-20.~~
- [x] ~~Fill first-row qualification Level from the CRM's `degree` key.~~
- [x] ~~Preserve phone dialling prefixes, using UK national format where needed.~~
- [x] ~~Add regression coverage and verify the development build (16/16 tests pass).~~
- [x] ~~Replay qualification and phone fills against sanitized saved Greenwich forms in Helium.~~

Still open for Greenwich: live Copy + Autofill with a CRM test student, a per-step filled/skipped/manual summary, committed sanitized fixtures, split-date and section-aware support, and a complete select-option audit. Non-UK Home Telephone values need manual correction or clearing when they exceed the 11-character limit; Mobile permits 16 characters. See `docs/history/GREENWICH.md`.

Per portal (Greenwich, Greater Manchester, Bangor), per form step:

1. Inventory fields with PinchTab during supervised access.
2. Write/adjust `config/portals/<portal>.js`.
3. Run Copy + Autofill; record filled / skipped / manual per step in a new `PORTALS.md` matrix.
4. Save sanitized step HTML to `fixtures/<portal>/` for regression and the 30-day warranty.
5. Target: every applicable field available on the CRM profile page, per PRD Q6.

## Phase 6: Tests (ongoing)

1. Playwright with the Helium executable, loading unpacked `dist/chrome` (dev build).
2. Flows: Copy on mock CRM profile, refuse on mock dashboard, Autofill on `university-portal-demo` and fixtures.
3. Assertions: expected values filled, filled fields untouched, cross-origin frame receives nothing, no forbidden control clicked, session cleared by Clear and by expiry (shortened in test).

## Phase 7: Packaging (Week 3)

1. `prod` build, version 1.0.0, zip for **unlisted** Chrome Web Store.
2. CWS needs: SAMS developer account (SAMS cost), privacy policy URL, data-use disclosures, host permission justification.
3. Document enterprise force-install as the alternative controlled route.

## Phase 8: Docs and handover (Week 3)

1. `docs/INSTALL-AND-DEPLOY.md`: unlisted CWS install, update process, force-install option.
2. `docs/STAFF-GUIDE.md`: Copy, Autofill, Clear, review, expiry.
3. `docs/TECHNICAL-AND-MAPPING.md`: architecture, config files, adding a portal/origin, build and publish a new version.
4. Rewrite `README.md` for the contracted product; move demo docs to `docs/history/`.
5. Verified demo on three portal journeys + live or recorded handover.

## Safari (after Chrome feature-complete)

- Convert with `xcrun safari-web-extension-converter` from `dist/chrome`.
- Verify `storage.session`, `alarms`, and `scripting` behaviour in Safari before relying on them.
- Distribution method agreed at kickoff (controlled, not public search).

---

## Blockers and inputs from SAMS

| Needed | For phase |
|---|---|
| GBP 500 kickoff payment (SG-2026-001) | Start of paid work |
| 3-week vs 6-week timeline confirmed in writing | Gates |
| CRM test account + exact student profile URL | 2 |
| Campora URL | 1, 2 |
| Test student records | 2, 5 |
| Access to ~~Greenwich~~, Greater Manchester, Bangor application journeys | 5 (Greenwich mapping access completed; live CRM-to-portal journey still pending) |
| Named approver for demos/acceptance | 5, 8 |
| CWS developer account owner + privacy policy owner/host | 7 |

## Open risks

- **Privacy policy for CWS:** not a listed deliverable. Raise at kickoff: who writes and hosts it.
- **CRM lazy-loaded sections** may limit what "visible fields" covers.
- **Portal DOM changes** after acceptance are out of warranty.

## Out of scope (do not build)

Extension login, licence server, CRM API/backend access, AI/inferred values, auto submit/pay/send/confirm/declare, document upload automation, bulk export, portals beyond the three, public store listing without SAMS written approval.
