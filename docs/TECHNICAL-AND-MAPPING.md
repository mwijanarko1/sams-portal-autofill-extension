# Technical and mapping guide

## Data flow

The popup validates the active origin before injecting a reader or filler. The CRM reader validates the origin again and requires both a profile URL match and a page marker. It maps visible labelled values to canonical keys and sends one profile to the background service worker.

The service worker stores that profile only in `chrome.storage.session`. Copy and successful Autofill reset a 30 minute alarm. Clear, expiry, browser restart, and extension reload/update remove the data.

For Autofill, `chrome.webNavigation.getAllFrames` identifies each frame URL. Student values are sent only to frame IDs whose own origin is approved. The portal handler validates its origin again before scanning or filling.

## Add or update an origin

Edit `config/allowlist.js`, using exact origins without paths. Never add `<all_urls>` or a parent domain wildcard. Package and publish a new version.

## CRM fields

Edit `config/crm-source.js` to add an exact normalized visible label and canonical key. Profile page guards must remain specific enough to reject login, dashboard, list, and settings pages.

## Portal mappings

Each file in `config/portals/` contains the portal's exact origins, page matchers, selector overrides, extra synonyms, and blocked controls. Core synonyms belong in `config/synonyms.js` only when they are genuinely shared.

During supervised access:

1. Inventory one form step at a time.
2. Add the smallest config change needed.
3. Run Copy and Autofill with a test student.
4. Record filled, skipped, no-value, and manual fields in `PORTALS.md`.
5. Save sanitized HTML with no student data, credentials, tokens, or application IDs under `fixtures/<portal>/`.
6. Add a regression test before moving to the next step.

The engine fills inputs, selects, textareas, radio inputs, and scoped listbox options. Checkboxes and file inputs stay manual. Existing values remain untouched. The click guard rejects buttons, links, and controls whose accessible text contains submit, pay, send, delete, confirm, declare, agree, next, save, or continue.
