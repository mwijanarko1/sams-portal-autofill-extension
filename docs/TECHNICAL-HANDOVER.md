# SAMS Portal Autofill: technical handover

This guide is for engineers who maintain or extend the extension. Staff usage steps live in [USER-HANDOVER.md](USER-HANDOVER.md). Directory ownership and navigation live in [CODEBASE_MAP.md](CODEBASE_MAP.md). Install and release packaging live in [INSTALL-AND-DEPLOY.md](INSTALL-AND-DEPLOY.md). Portal status notes live in [../PORTALS.md](../PORTALS.md).

Claims below follow the current source tree. They are not a substitute for a live CRM-to-portal verification run.

Use the architecture and data sections to understand the extension. Use [How to add a mapped university](#how-to-add-a-mapped-university) when you need to support another portal.

---

## What the product is

A Manifest V3 browser extension for authorised SAMS staff. It:

1. Reads visible labelled values from an approved SAMS CRM student profile.
2. Lists CRM document metadata (not file bytes) into one session cache.
3. Draft-fills empty controls on university application pages.
4. On explicit staff action, fetches one CRM file inside an authenticated CRM tab and assigns it to a portal `input[type=file]`.

It never clicks Save, Next, Submit, pay, or declaration controls. Portal widgets may still auto-save or auto-upload after `input` / `change` events.

---

## Architecture and file map

The popup is the small window opened from the browser toolbar. A content script runs inside a website tab. The background service worker runs separately and manages the temporary student copy. An origin means the URL scheme, hostname, and optional port, such as `https://apps.bangor.ac.uk`.

```text
popup.html / popup.js
  origin checks, inject scripts, UI, per-frame ports
        |
        v
src/background.js          chrome.storage.session studentCache + alarm
config/allowlist.js        exact origins, sessionMinutes, CRM file URL rules
        ^
        |
src/crm-reader.js          CRM DOM -> canonical field map
src/crm-documents.js       CRM document list + on-attach file fetch
config/crm-source.js       CRM path/marker guards and label aliases
        |
        v
src/portal-fill.js         port handler: prepare, autofill, listUploads, attachDocument
src/engine/engine.js       scan, match, format, fill, split dates, click guard
config/synonyms.js         shared synonyms, GENERIC_FIELDS, GENERIC_BLOCKED
config/portals/*.js        per-portal origins, pageMatchers, overrides, blocks
```

| Path | Role |
|---|---|
| `manifest.json` | Source MV3 template. Build writes `host_permissions` from the allowlist. |
| `popup.html`, `popup.js` | Toolbar UI and orchestration. `PORTAL_FILES` lists scripts injected into portal frames. |
| `config/allowlist.js` | CRM, Campora, portal, and dev origins. `sessionMinutes: 30`. File URL allow rule. |
| `config/build-mode.js` | Overwritten per build (`dev` / `prod`). |
| `config/crm-source.js` | Profile URL patterns, page markers, visible label to canonical key. |
| `config/synonyms.js` | Shared matching vocabulary and generic field set. |
| `config/portals/greenwich.js` | University of Greenwich mapping. |
| `config/portals/bangor.js` | Bangor University mapping. |
| `config/portals/manchester.js` | University of Greater Manchester mapping (`evision.bolton.ac.uk`). |
| `src/background.js` | Serialized cache mutations. Popup-sender only. |
| `src/crm-reader.js` | Profile reader. |
| `src/crm-documents.js` | Document listing and attach-time fetch. |
| `src/portal-fill.js` | Frame-bound port protocol. |
| `src/engine/engine.js` | Matching and fill engine. |
| `scripts/build.mjs` | Chrome / Safari resource package. |
| `scripts/package-safari.mjs` | Unsigned Safari app packaging. |
| `safari/` | macOS containing app. Shared JS is not proof of Safari runtime parity. |

Related docs: [TECHNICAL-AND-MAPPING.md](TECHNICAL-AND-MAPPING.md), [STAFF-GUIDE.md](STAFF-GUIDE.md), [../safari/README.md](../safari/README.md), [../e2e/README.md](../e2e/README.md), [../e2e/safari/README.md](../e2e/safari/README.md).

---

## Domain shape: one student cache

The background service worker owns a single object under `chrome.storage.session` key `studentCache`.

**Not used for this cache:** `localStorage`, `sessionStorage`, IndexedDB, `chrome.storage.local`, `chrome.storage.sync`, or HTTP browser cache.

**Lifecycle.** Session memory managed by the browser. Survives popup close and service worker suspension. Does not persist across browser restart or extension reload/update. A new successful Copy replaces the previous student.

This storage belongs to the extension, not the CRM website. It is not the system clipboard or a folder in Downloads. Website scripts cannot read it through their own storage APIs. The extension sends selected values to the portal only when staff use Autofill or Attach.

**Rough shape after a successful Copy:**

```js
const exampleCache = {
  studentId: "12345",
  studentName: "Example Student",
  sourceOrigin: "https://app.samscrm.co.uk",
  copiedAt: 1710000000000,
  fields: { givenName: "Example", familyName: "Student", email: "example@example.com" },
  documents: [
    {
      key: "passport:101",
      group: "passport",
      groupLabel: "Passport",
      documentType: null,
      name: "identity-page",
      extension: "pdf",
      url: "https://app.samscrm.co.uk/tmp_aws_media/identity-page.pdf",
    },
  ],
  lastActivityAt: 1710000000000,
  expiresAt: 1710001800000,
};
```

Document entries are metadata only. File bytes are never stored in the cache.

**Expiry.** `config/allowlist.js` sets `sessionMinutes: 30`. Copy stores a fresh deadline. A successful Autofill (at least one frame returns a fill report) or a successful Attach calls `touchStudentCache` and renews `expiresAt`. Merely opening the popup or reading the cache does not renew it. `readCache` clears when `expiresAt` is due. An alarm rechecks the stored timestamp so a stale alarm cannot delete a renewed cache. Mutations run through one serialized queue.

**Access control.** Only the extension popup (`popup.html` as sender) may call `cacheStudent`, `getStudentCache`, `touchStudentCache`, or `clearStudentCache`.

---

## CRM read and canonical keys

Copy injects into the active CRM tab:

- `config/build-mode.js`
- `config/allowlist.js`
- `config/crm-source.js`
- `src/crm-reader.js`
- `src/crm-documents.js`

The reader checks CRM origin, profile path patterns, and page markers from `config/crm-source.js`. It maps visible labels to canonical keys such as `givenName`, `familyName`, `dateOfBirth`, `email`, `phone`, `location`, `passportNumber`. Add a new CRM alias only when you have seen the real visible label on an authorised profile. Do not invent labels. The live field map for every lead type and every Profile-tab section is [history/CRM-LEAD-PROFILE.md](history/CRM-LEAD-PROFILE.md).

An individual lead page (`/agent/leads/full-profile/<id>`) has two relevant tabs. **Applications** is the lead-stage workflow with editable stage forms and the admission-preference fields. **Profile** is the read-only review tab with the lead header, sidebar and ten summary sections. Copy reads the Applications tab first (mounted stage panels plus the visible form), then opens Profile, waits for its section tables to finish loading, and restores the tab staff were on. Opening Profile removes the Applications stage tracker until the lead page reloads, so a Profile-first copy reopens Applications only far enough to read its visible form. Profile values win on shared keys; Applications fills in admission preference, social contacts and split address components.

The reader resolves labels that mean different things per panel: `Study Destination` is `preferredDestination` in Admission Preference but `previousStudyDestination` in Previous Study Abroad; `Institute Name` there is `preferredUniversity`, not `institutionName`; reference `Phone`/`Email` are `referencePhone`/`referenceEmail`. Checked checkboxes are ignored (they only carry `on`), and a dial-code select is joined with the adjacent number input rather than copied as `phone`.

Canonical keys are the shared names used between the CRM reader and the portal engine. For example, the CRM label "First name" becomes `fields.givenName`. A portal selector mapped to `givenName` receives that same value. The reader can open supported CRM sections before reading them. It keeps the first non-empty value for a key, normalizes whitespace, and converts recognised single dates to `YYYY-MM-DD`; `*Dates` range keys keep the visible range. Values shown as `N/A`, `-`, `Not Applicable`, `No X Found.` or `No X available.` are treated as absent.

The cache is flat: one saved education, passport, visa, work or reference entry per key. Multi-row CRM data beyond the first entry is not stored. Lead lists, remarks, tasks and the other tabs are not part of Copy; documents have their own list.

Document listing uses read-only CRM API `GET`s per group (`fp_cv_docs`, `fp_edu_docs`, and the other `fp_*_docs` endpoints in `src/crm-documents.js`), with the page `meta[name="api-token"]` Bearer header and same-origin credentials. The token is used transiently for listing. It is not written into `studentCache`.

---

## Data flow: Copy to Autofill

1. Popup validates the active tab is an approved CRM origin.
2. Reader returns one profile. Documents are listed separately. Listing failure does not block field Copy.
3. Background validates and stores one `studentCache`.
4. Staff open a fill target (any HTTP(S) page that is not a CRM origin). Mapped portals may already be in `host_permissions`. Others rely on toolbar `activeTab` or an optional exact-site grant via **Allow this website**.
5. Popup enumerates frames with `chrome.webNavigation.getAllFrames`.
6. Only the top frame and frames whose URL origin exactly matches the selected page origin are kept. Cross-origin embeds and opaque or sandboxed frames are skipped or rejected later.
7. Each selected frame must expose `documentId`. If any selected frame lacks it, Autofill fails closed with the popup message that binds to exact document identity (Chrome or Edge guidance). Do not claim Safari parity from `storage.session` alone.
8. Popup injects `PORTAL_FILES` per `documentId`, opens one `tabs.connect` port named `sams-autofill` per document, sends `prepare` with the selected origin, re-reads the worker cache, then sends `autofill` with the field map.
9. `portal-fill.js` accepts the port only from the popup sender, re-checks origin, `self.origin` (sandbox), and top-page origin, then runs the engine.
10. Navigation closes the port. The popup does not reconnect that port.

---

## Messages and ports

**Runtime messages (popup to background):** `cacheStudent`, `getStudentCache`, `touchStudentCache`, `clearStudentCache`.

**Tab messages (popup to CRM tab):** `copyCrmProfile`, `copyCrmDocuments`, `readCrmDocument`.

**Ports (popup to portal frames):** name `sams-autofill`. Actions `prepare`, `autofill`, `listUploads`, `attachDocument`.

Upload fields are bound by keys handed out on that port (`upload-0`, `upload-1`, ...), never by re-querying a CSS selector at attach time. That is the exact-document binding for files.

---

## Matching engine safeguards

In mapped mode, the engine scans form controls and reads their labels, names, IDs, and autocomplete attributes. An exact `selectorOverrides` match scores 1000 for its configured CRM key. Other controls use shared and portal-specific synonyms, word matches, autocomplete, and section context. A score below 50 is not enough to fill a field. The engine then checks the current value and chooses a compatible text, date, radio, or select value. A high score alone does not guarantee a fill.

High-level rules enforced in `src/engine/engine.js` and related config:

- Existing non-empty values are not overwritten.
- The normal field scanner excludes readonly, disabled, hidden, inert, and disconnected controls. Split-date controls use a separate path, so their selectors need careful review.
- Checkboxes and file inputs are never filled by Autofill. Files use **Attach CRM documents** only.
- Click guard rejects controls whose accessible text matches submit, pay, send, delete, confirm, declare, agree, next, save, or continue.
- Portal `blockedControls` selectors are excluded from normal matching. Date selects explicitly listed in `splitDates` can still be filled by that separate path.
- Generic mode uses `GENERIC_FIELDS` in `config/synonyms.js`. Recognised label, name, ID, and autocomplete hints must not disagree. A present but unrecognised label prevents a fill. The control type must be allowed, and no other control can claim the same key. Blocked field, section, and form contexts, or a password field in the same form, also prevent a fill.
- Mapped mode activates when a portal config's `origins` includes `location.origin` and a `pageMatchers` entry matches. First matching portal in the loaded `SAMS_PORTALS` array wins. Otherwise behaviour falls back to generic.

**`pageMatchers` vs `splitDates.page`:**

- `pageMatchers` string entries use `location.pathname.includes(matcher)`. RegExp objects use `matcher.test(location.pathname)`. Query strings are not part of that check.
- `splitDates` use `new RegExp(spec.page).test(location.pathname + location.search)`, and may also accept a `spec.form` RegExp against `select.form.action` when the path test fails. Inspect `fillSplitDates` before changing date maps.

Shared synonyms belong in `config/synonyms.js`. Portal-only phrases belong in that portal's `extraSynonyms`.

---

## Document discovery and authentication

**List (at Copy).** Read-only GETs from the CRM page context. Same-origin credentials. `redirect: "error"`. Rows must belong to the lead id, use an allowed extension (`pdf`, `jpg`, `jpeg`, `png`, `doc`, `docx`), and use an approved file URL.

**Approved file URL.** Same CRM origin as the copied profile, path `/tmp_aws_media/<safe-name>` only, no query, no hash, no userinfo. See `SAMS_ALLOWLIST.isCrmFileUrl`.

**Fetch (only on Attach).** Popup finds an open tab on `cache.sourceOrigin`, injects `crm-documents.js` if needed, and asks that tab for `readCrmDocument`. Fetch uses `credentials: "same-origin"`, `redirect: "error"`, `cache: "no-store"`. Rejects HTML content types, empty bodies, and bodies over 10 MiB (`10 * 1024 * 1024`). Bytes are Base64-encoded for the message. Base64 is transport encoding, not encryption.

**Portal assign.** `portal-fill.js` rebuilds a `File` with `DataTransfer`, assigns `input.files`, and dispatches `input` and `change`. An upload field that already has a file is not replaced. The portal may upload immediately. No ordinary Downloads folder write is performed by the extension. The portal holds the assigned file after Attach. Clear does not remove that file or cancel a portal upload.

**View.** Opens the original CRM media URL in a new tab (`chrome.tabs.create`). That navigation is not the same as the no-store attach fetch. Extension `cache: "no-store"` does not control CRM or portal server retention, or ordinary browser caching of a Viewed tab.

---

## Storage, clipboard, and privacy boundary

| Concern | Behaviour |
|---|---|
| Student profile | One `chrome.storage.session` object |
| Document bytes | Not kept in extension storage. Passed through JS memory and messages during Attach, then held by the portal's file input or upload system |
| Per-field Copy buttons | `navigator.clipboard.writeText` (system clipboard) |
| Clear | Removes session cache and expiry alarm only |
| Clear does not erase | Clipboard, portal field values, already attached or uploaded files |
| Sync | No extension cloud sync of student data. Browser profiles are independent |

Do not promise secure memory wiping, OS swap control, or clipboard history behaviour.

---

## Development, check, and build commands

Use a current Node.js environment and npm. Run `npm ci` in the repository to install the locked development dependencies. Then use these scripts from `package.json`:

| Script | Purpose |
|---|---|
| `npm test` | Node tests under `test/` (supporting checks) |
| `npm run test:e2e` | Loaded-extension Chromium E2E |
| `npm run test:e2e:live` | Opt-in live smoke |
| `npm run build` | Chrome **dev** package to `dist/chrome` |
| `npm run build:prod` | Chrome **prod** package (currently refused; see below) |
| `npm run build:safari` | Safari web-extension resources |
| `npm run build:safari:prod` | Safari prod resources (same allowlist gate) |
| `npm run build:safari:app` | Unsigned Safari app packaging |
| `npm run safari:fixtures` | Local fixture server for Safari checklist |

**Current release blocker.** `camporaOrigins` in `config/allowlist.js` is empty. `scripts/build.mjs` refuses production builds until Campora origins are present and at least three portal origins are configured. Do not bypass that gate. Root `manifest.json` is a template; the built manifest under `dist/` receives generated `host_permissions`. Never edit `dist/` by hand as source of truth. Reload the extension and the tested page after a rebuild. Version bumps and distribution follow the approved release process in [INSTALL-AND-DEPLOY.md](INSTALL-AND-DEPLOY.md).

The current Chromium E2E runner uses the installed Helium browser by default. Check [the E2E browser setup](../e2e/README.md) before running it on another machine. Live checks require approved test access. Do not put credentials in this guide or in fixtures.

Safari packaging of shared JS is not proof that Autofill, document binding, or exact `documentId` behaviour is verified on Safari.

---

## Current limitations

- Not every university is mapped. Unmapped sites get generic common-field matching only.
- Live CRM-to-portal acceptance may still be pending for mapped portals. Check [../PORTALS.md](../PORTALS.md).
- Exact-document Autofill requires `documentId` from `webNavigation.getAllFrames`. Browsers without that fail closed for Autofill and Attach flows that use `selectedPageFrames`.
- Top document and same-origin frames only.
- No automatic Save / Next / Submit / pay / declaration. Portal handlers may still react to filled values or attached files.
- Production packaging blocked while Campora origins are empty.
- Unit tests for new coverage are prohibited by project policy. Prefer E2E with sanitized fixtures.

---

## How to add a mapped university

Complete recipe. Replace the example names and selectors with real values from an authorised inventory. Selectors below are **invented examples**, not a verified mapping.

### 1. Inventory one page at a time

On an authorised portal account, open one form step. Record exact origin, path, control ids or names, labels, and which CRM canonical keys apply. Prefer existing keys from `config/crm-source.js` and mapped portals. Add a CRM label alias only when you have seen the real CRM text.

### 2. Create `config/portals/example.js`

Example registration pattern (structure matches current portals; values are fictional):

```js
{
globalThis.SAMS_PORTALS = globalThis.SAMS_PORTALS || [];
const config = {
  id: "example-university",
  name: "Example University",
  origins: ["https://apply.example"],
  pageMatchers: [
    "/apply/personal/",
    "/apply/contact/",
  ],
  selectorOverrides: {
    // EXAMPLE ONLY. Replace with real selectors from an authorised inventory.
    givenName: ["#id_forename"],
    familyName: ["#id_surname"],
    email: ["#id_email"],
  },
  phoneKeepsDialPrefix: true,
  extraSynonyms: {
    givenName: ["given name"],
    familyName: ["family name"],
    email: ["email address"],
  },
  splitDates: [
    // page is tested as RegExp against pathname + search (see fillSplitDates).
    { key: "dateOfBirth", page: "^/apply/personal/", day: "#id_dob_day", month: "#id_dob_month", year: "#id_dob_year" },
  ],
  blockedControls: [
    "input[type='password']",
    "input[type='file']",
    "button[type='submit']",
    "#id_dob_day",
    "#id_dob_month",
    "#id_dob_year",
  ],
};
const index = globalThis.SAMS_PORTALS.findIndex((portal) => portal.id === config.id);
if (index === -1) globalThis.SAMS_PORTALS.push(config);
else globalThis.SAMS_PORTALS[index] = config;
}
```

Supported properties used by current code include `id`, `name`, `origins`, `pageMatchers`, `selectorOverrides`, `phoneKeepsDialPrefix`, `extraSynonyms`, `splitDates`, and `blockedControls`. Do not add unsupported config keys and expect the engine to honour them.

The example blocks the split-date selectors from the normal matcher. `fillSplitDates` handles those selects separately. Use selectors that identify only the intended date on the intended page. Add a `form` condition when a portal keeps a previous step's URL after saving. Confirm that the selected controls are visible, editable date selects. Do not use selectors that also match an employer or referee date.

Use a stable unique `id`. Exact origins only (scheme + host + optional port). No paths in origin strings. No `<all_urls>` and no parent-domain wildcards.

### 3. Register the file in `popup.js` `PORTAL_FILES`

Build copies the `config/` tree, but runtime portal loading for fill is governed by the explicit `PORTAL_FILES` list in `popup.js`. Add your file **before** `src/engine/engine.js`:

```js
const PORTAL_FILES = [
  "config/build-mode.js",
  "config/allowlist.js",
  "config/synonyms.js",
  "config/portals/greenwich.js",
  "config/portals/manchester.js",
  "config/portals/bangor.js",
  "config/portals/example.js", // add here
  "src/engine/engine.js",
  "src/portal-fill.js",
];
```

Adding a file under `config/portals/` alone does not load it.

### 4. Add the origin to `config/allowlist.js` `portalOrigins`

Edit `portalOrigins` inside the existing `SAMS_ALLOWLIST_CONFIG`. Keep its other properties unchanged. The object below shows only the portal list, not a replacement for the whole configuration.

```js
const exampleAllowlist = {
  portalOrigins: [
    "https://nelson.gre.ac.uk",
    "https://apps.bangor.ac.uk",
    "https://evision.bolton.ac.uk",
    "https://apply.example", // EXAMPLE ONLY
  ],
};
```

Build generates `host_permissions` from this list (plus CRM / Campora / dev origins by mode). Keep exact origins only.

### 5. Shared vs portal synonyms

- Put truly shared vocabulary in `config/synonyms.js`.
- Put portal-specific label phrases in `extraSynonyms` on that portal.
- Keep dangerous or ambiguous controls in `blockedControls`.

### 6. Verify on the real portal

1. Rebuild the **dev** package (`npm run build`). Load or reload `dist/chrome`. Reload the tested page.
2. Copy a test student from CRM. Do not save or submit the portal application during checks.
3. Autofill one page. Confirm existing values stay untouched, blocked controls stay manual, and a second Autofill does not duplicate rows where that matters.
4. In an E2E check or a developer inspection of the frame response, confirm `report.mapping` equals your mapping name when the origin and `pageMatchers` match. The staff popup does not display that name. Off-path pages should return `mapping: null` and use generic behaviour.
5. Exercise Clear and expiry expectations.
6. Document Attach only with safe synthetic fixtures when possible. Real Attach can upload immediately because of portal `change` handlers.

### 7. Record status

Update [../PORTALS.md](../PORTALS.md) with filled, skipped, no-value, and manual fields. Keep sanitized HTML fixtures free of personal data, credentials, tokens, and application IDs. See [../e2e/README.md](../e2e/README.md). Add E2E coverage through the project's approved test process. Do not add new unit test suites.

---

## Testing guidance

Use the following checks when changing a mapping:

1. **E2E first** with sanitized fixtures and no real credentials.
2. Cover real Copy then Autofill with no saves.
3. Assert existing values preserved, blocked and manual fields unchanged, repeats without harmful duplication, mapped vs generic activation, Clear and expiry, and document Attach only on safe fixtures.
4. Existing `npm test` remains a supporting check, not a reason to grow unit coverage.

Safari checklist material: [../e2e/safari/README.md](../e2e/safari/README.md).

---

## Code examples from the current implementation

**Session store and expiry (background):**

```js
const CACHE_KEY = "studentCache";
const expiresAt = Date.now() + SAMS_ALLOWLIST.config.sessionMinutes * 60 * 1000;
const cache = { ...profile, lastActivityAt: Date.now(), expiresAt };
await chrome.storage.session.set({ [CACHE_KEY]: cache });
```

**Portal activation (engine):**

```js
var ACTIVE_PORTAL = (globalThis.SAMS_PORTALS || []).find(function (portal) {
  return (portal.origins || []).includes(location.origin) &&
    (!(portal.pageMatchers || []).length || portal.pageMatchers.some(function (matcher) {
      return typeof matcher === "string" ? location.pathname.includes(matcher) : matcher.test(location.pathname);
    }));
}) || null;
```

**CRM file URL gate (allowlist):**

```js
// Same CRM origin, path /^\/tmp_aws_media\/[A-Za-z0-9._-]+$/, no query/hash/userinfo.
function isCrmFileUrl(value, sourceOrigin) { /* see config/allowlist.js */ }
```

**Attach fetch flags (CRM page):**

```js
response = await fetch(url, { credentials: "same-origin", redirect: "error", cache: "no-store" });
```

---

## Older documentation

Some older guides describe Safari support without the current `documentId` restriction. For browser support, follow the current source and verified acceptance results. A successful package build alone does not prove that a browser can fill forms or attach documents.
