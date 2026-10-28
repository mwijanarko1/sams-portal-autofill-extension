# Technical and mapping guide

For the file layout, see [CODEBASE_MAP.md](CODEBASE_MAP.md).

## Data flow

1. The popup checks the origin of the active tab before it injects a reader or a filler.
2. **Copy** works only on an approved CRM origin. The CRM reader checks the origin again. It also needs a matching profile URL and a page marker. It maps visible labels to canonical keys and sends one profile to the background service worker.
3. The service worker stores the profile only in `chrome.storage.session`. Copy and a successful Autofill (at least one frame filled) reset a 30 minute alarm. Clear, expiry, a browser restart, and an extension reload or update delete the data. The worker runs cache changes one at a time. A slow touch or expiry cannot bring back a student that a new Copy replaced.
4. **Autofill** works on any HTTP(S) page except the CRM origins. Mapped portals have permanent host access. For other pages, the browser gives a temporary `activeTab` grant when staff open the extension from the toolbar on that page. If access is denied, the popup reports it. It does not try to bypass the denial.
5. `chrome.webNavigation.getAllFrames` gives the URL of each frame. The extension injects only into the top frame and into frames with exactly the same origin. It skips frames from other origins (including a mapped portal embedded in the page) and `about:blank` and `srcdoc` frames.
6. The popup opens one `tabs.connect` port for each frame. The handler accepts a port only from the extension popup. It answers a `prepare` request only if its document still has the selected origin, is not sandboxed, and is under a top page of that origin. Then the popup reads the worker cache again and sends the field map over the same port.
7. Navigation closes the port. The popup reports that frame and does not reconnect. Reports are per frame.

The same JavaScript source builds for Chrome (`dist/chrome`) and Safari (`dist/safari-webextension` and the `safari/` containing app). Only `scripts/build.mjs` and `scripts/package-safari.mjs` contain browser-specific packaging.

## Add or update an origin

Edit `config/allowlist.js`. Use exact origins without paths. Never add `<all_urls>` or a parent-domain wildcard. Build and publish a new version.

Development builds also include `http://localhost:3000` (CRM) and `http://localhost:3001` and `http://127.0.0.1:3001` (portals).

## Add a CRM field

Edit `config/crm-source.js`. Add the exact normalized visible label and its canonical key. Keep the profile page guards specific. They must reject login, dashboard, list, and settings pages.

## Portal mappings

### Generic matching (no portal file)

A page without a portal configuration uses the generic registry in `config/synonyms.js` (`GENERIC_FIELDS`, `AUTOCOMPLETE_KEY_MAP`, `GENERIC_BLOCKED`). The engine fills a control only when all of these are true:

- The control's own label, its name or id, and its autocomplete token agree on one supported key. The engine compares the label as an exact phrase, after it removes punctuation and bracketed hints.
- The control type is allowed for that key.
- No blocked word appears in the control's own text, in its fieldset legend, or in its nearest heading.
- The form has no password field.
- No other control on the page resolves to the same key.

A label that names anything else keeps the control manual. An autocomplete purpose that is not one whole applicant value also keeps it manual. The engine never fills readonly, inert, disabled, hidden, or disconnected controls. It checks each control again immediately before it writes.

### Portal files

The [approved rules](portal-maps/APPROVED-RULES.md) define which assumptions can replace a block. `withDerivedKeys` computes only keys mapped by the active portal; cached CRM data stays unchanged. `COUNTRIES` and `EU_COUNTRIES` in `config/synonyms.js` resolve recognised names/demonyms conservatively. Greenwich reused address IDs and referee contacts are form-scoped, including negative scopes that also reject controls without a form. Manchester `revealingKeys` permits one bounded follow-up scan after a correspondence answer reveals controls. It never selects a save/navigation control.

Permanent address values must not fall back to present address values. Compare complete ordered components, not unordered word sets. Refusal flags need UK-specific country evidence for Yes, and qualification completion needs a definitely past end date. Read the contract before changing these rules; unsupported application questions remain manual.

Each file in `config/portals/` holds the exact origins of one portal. It also holds page matchers, selector overrides, extra synonyms, split-date maps, and blocked controls. Put a synonym in `config/synonyms.js` only when all portals share it. Portal-specific maps apply on the production origins only. Localhost fixture pages use the generic registry.

### Work on a new portal

Work with supervised access, one form step at a time:

1. Make an inventory of the form step.
2. Make the smallest config change that you need.
3. Run Copy and Autofill with a test student.
4. Record the filled, skipped, no-value, and manual fields in `PORTALS.md`.
5. Save sanitized HTML under `e2e/fixtures/` (or `test/fixtures/` for CRM reader pages). The HTML must contain no student data, credentials, tokens, or application IDs.
6. Add a regression test before you start the next step.

### What the engine fills

The engine fills inputs, selects, textareas, radio inputs, scoped listbox options, and explicit split-date groups. Checkboxes and file inputs stay manual. The engine does not change an existing value.

The click guard rejects buttons, links, and controls with accessible text that contains submit, pay, send, delete, confirm, declare, agree, next, save, or continue.
