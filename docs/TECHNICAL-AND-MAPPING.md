# Technical and mapping guide

For directory ownership and navigation paths, see [CODEBASE_MAP.md](CODEBASE_MAP.md).

## Data flow

The popup validates the active origin before injecting a reader or filler. Copy requires an approved CRM origin. Autofill accepts any HTTP(S) page except CRM origins: mapped portals have persistent host access, and other pages are reachable only through the temporary `activeTab` grant the browser gives when staff open the extension from the toolbar there. Denied access is reported, never bypassed. The CRM reader validates the origin again and requires both a profile URL match and a page marker. It maps visible labelled values to canonical keys and sends one profile to the background service worker.

The service worker stores that profile only in `chrome.storage.session`. Copy and successful Autofill (at least one frame filled) reset a 30 minute alarm. Clear, expiry, browser restart, and extension reload/update remove the data. Cache mutations are serialized so a slow touch or expiry cannot resurrect a replaced student.

For Autofill, `chrome.webNavigation.getAllFrames` identifies each frame URL. Only the top frame and frames whose own origin exactly matches it are injected; other origins, including mapped portals embedded in the page, and `about:blank` / `srcdoc` frames are skipped. The popup opens one `tabs.connect` port per frame. The handler accepts the port only from the extension popup and answers a `prepare` request only if its document still has the selected origin, is not sandboxed (`self.origin`), and sits under a top page of that origin. The popup then re-reads the worker cache and sends the field map over the same port. Navigation closes the port; the popup reports that frame and never reconnects. Reports are per-frame.

The same JavaScript source is packaged for Chrome (`dist/chrome`) and Safari (`dist/safari-webextension` + `safari/` containing app). Browser-specific packaging lives in `scripts/build.mjs` and `scripts/package-safari.mjs` only.

## Add or update an origin

Edit `config/allowlist.js`, using exact origins without paths. Never add `<all_urls>` or a parent domain wildcard. Package and publish a new version. Development builds also include `http://localhost:3000` (CRM) and `http://localhost:3001` / `http://127.0.0.1:3001` (portals).

## CRM fields

Edit `config/crm-source.js` to add an exact normalized visible label and canonical key. Profile page guards must remain specific enough to reject login, dashboard, list, and settings pages.

## Portal mappings

Pages without a portal configuration use the generic registry in `config/synonyms.js` (`GENERIC_FIELDS`, `AUTOCOMPLETE_KEY_MAP`, `GENERIC_BLOCKED`). A control is filled only when its own label (exact phrase after removing punctuation and bracketed hints), name/id, and autocomplete token agree on one supported key, its control kind is allowed for that key, no blocked word appears in its own text or in its fieldset legend or nearest heading, its form has no password field, and no other control on the page resolves to the same key. A label that names anything else, or a recognised autocomplete purpose that is not one whole applicant value, keeps the control manual. Readonly, inert, disabled, hidden, and disconnected controls are never filled, and each control is rechecked immediately before writing.

Each file in `config/portals/` contains the portal's exact origins, page matchers, selector overrides, extra synonyms, split-date maps, and blocked controls. Core synonyms belong in `config/synonyms.js` only when they are genuinely shared. Portal-specific maps apply on those production origins; localhost fixture pages use the generic registry.

During supervised access:

1. Inventory one form step at a time.
2. Add the smallest config change needed.
3. Run Copy and Autofill with a test student.
4. Record filled, skipped, no-value, and manual fields in `PORTALS.md`.
5. Save sanitized HTML with no student data, credentials, tokens, or application IDs under `e2e/fixtures/` (or `test/fixtures/` for CRM reader pages).
6. Add a regression test before moving to the next step.

The engine fills inputs, selects, textareas, radio inputs, scoped listbox options, and explicit split-date control groups. Checkboxes and file inputs stay manual. Existing values remain untouched. The click guard rejects buttons, links, and controls whose accessible text contains submit, pay, send, delete, confirm, declare, agree, next, save, or continue.
