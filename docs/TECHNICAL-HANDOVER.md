# SAMS Portal Autofill: technical handover

This guide is for engineers, IT administrators, and security reviewers who maintain or deploy the extension. Staff usage steps live in [USER-HANDOVER.md](USER-HANDOVER.md). Directory ownership and navigation live in [CODEBASE_MAP.md](CODEBASE_MAP.md). Install and release packaging live in [INSTALL-AND-DEPLOY.md](INSTALL-AND-DEPLOY.md). Portal status notes live in [../PORTALS.md](../PORTALS.md).

Claims below follow the current source tree. They are not a substitute for a live CRM-to-portal verification run.

Use the architecture and data sections to understand the extension. Use [How to add a mapped university](#how-to-add-a-mapped-university) when you need to support another portal.

## Security questions at a glance

| Question | Current answer | Detail |
|---|---|---|
| How are student details copied? | Staff select Copy. Injected scripts read the signed-in CRM profile and list document metadata. No background student sync runs. | [CRM read](#crm-read-and-canonical-keys) |
| Where is the copy stored? | One `studentCache` in the extension's `chrome.storage.session`, inside that browser profile. No extension cloud database or student-data sync. | [Cache](#domain-shape-one-student-cache) |
| How long does it stay? | A rolling 30-minute deadline. A new Copy replaces the student and starts a fresh deadline. Successful Autofill or Attach resets it to 30 minutes from that moment. Continued use can keep a copy longer than 30 minutes. | [Retention](#retention-and-clear-behaviour) |
| Are documents copied into storage? | Copy keeps names, types, groups, and CRM URLs, not document contents. Attach fetches one chosen file into memory. | [Document flow](#document-discovery-and-authentication) |
| Are files parsed to fill fields? | No. Autofill uses CRM text fields. Attach transfers the selected file without extracting its contents or generating answers from it. | [Document flow](#document-discovery-and-authentication) |
| What happens when an employee leaves? | Nothing automatic. The extension has no employee account, employment-status check, central logout, or remote-wipe endpoint. IT must revoke access and secure the device. | [Offboarding](#employee-offboarding-and-device-loss) |
| Does Clear recall data? | No. It removes the extension cache, not portal values, uploaded files, clipboard contents, or CRM records. | [Storage inventory](#storage-clipboard-and-privacy-boundary) |
| Can revoked staff still use a copy? | An unexpired copy can still fill forms without a fresh CRM login. File access depends on the CRM media server's own authorisation. | [Access limits](#access-controls-and-security-limits) |

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

**Lifecycle.** Session memory managed by the browser. Survives popup close and service worker suspension. In Chrome, disabling, reloading, or updating the extension, or restarting the browser, clears session storage. Closing a browser window is not necessarily a full browser shutdown. A new successful Copy replaces the previous student. This lifecycle follows [Chrome's storage API documentation](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session), not a claim of tested Safari parity.

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

Treat the whole copy as confidential student data. Depending on the populated CRM sections, fields can include contact details, date of birth, passport information, education, employment, visa history, and references. File groups include CV, education, work history, English tests, references, visa history, visa refusal, passport, and additional documents. No persistent file bytes does not mean no sensitive data.

**Expiry.** `config/allowlist.js` sets `sessionMinutes: 30`. Copy stores a fresh deadline. A successful Autofill (at least one frame returns a fill report) or a successful Attach calls `touchStudentCache`, which resets `expiresAt` to 30 minutes from that moment (`Date.now()` plus `sessionMinutes`), not 30 minutes added to the previous deadline. A fill report with zero changed fields still counts as activity. Merely opening the popup or reading the cache does not renew it. `readCache` clears when `expiresAt` is due. An alarm rechecks the stored timestamp so a stale alarm cannot delete a renewed cache. Mutations run through one serialized queue.

**Access control.** Only the extension popup (`popup.html` as sender) may call `cacheStudent`, `getStudentCache`, `touchStudentCache`, or `clearStudentCache`.

The worker accepts 2 to 200 field entries, each with a string value of at most 4,000 characters, and at most 100 document entries. It validates the identity, origin, field keys, and document metadata before replacing the cache. Invalid profiles are rejected, not silently truncated into an accepted cache.

### Retention and Clear behaviour

| Event | Effect on the extension cache |
|---|---|
| Successful Copy | Replaces the previous student, including document metadata, and starts a new 30-minute deadline |
| Successful Autofill or Attach | Resets the deadline to 30 minutes from that moment. There is no separate maximum lifetime from the original Copy |
| Open popup, inspect copied details, copy one field, view a file, or scan upload fields | Does not renew the deadline |
| Failed Copy | Does not replace a previously valid student. Check the card instead of assuming it was cleared |
| All Autofill frames fail, or Attach fails | Does not renew the deadline |
| Deadline reached | Alarm removes the cache when processed. Every cache read also checks expiry and refuses expired data |
| Clear | Removes `studentCache` and its expiry alarm. The initiating popup clears its displayed student and upload choices |
| Close popup or suspend service worker | Cache remains until another removal event |
| CRM logout, permission removal, or employee account disablement | No automatic cache removal. These are not extension lifecycle events |

The popup re-reads the worker cache before it starts Autofill or fetches an attachment. This prevents an already-cleared or expired worker cache from being reused by a stale popup at that check. Another open popup may still display its previous copy until it refreshes or closes. Clear and expiry do not cancel a fill or file transfer that has already started, and do not securely zero JavaScript memory. Close extension windows and the affected pages during sensitive cleanup.

---

## CRM read and canonical keys

Copy injects into the active CRM tab:

- `config/build-mode.js`
- `config/allowlist.js`
- `config/crm-source.js`
- `src/crm-reader.js`
- `src/crm-documents.js`

The reader checks CRM origin, profile path patterns, and page markers from `config/crm-source.js`. It maps visible labels to canonical keys such as `givenName`, `familyName`, `dateOfBirth`, `email`, `phone`, `location`, `passportNumber`. Add a new CRM alias only when you have seen the real visible label on an authorised profile. Do not invent labels. The live field map for every lead type and every Profile-tab section is [portal-maps/CRM-LEAD-PROFILE.md](portal-maps/CRM-LEAD-PROFILE.md).

An individual lead page (`/agent/leads/full-profile/<id>`) has two relevant tabs. **Applications** is the lead-stage workflow with editable stage forms and the admission-preference fields. **Profile** is the read-only review tab with the lead header, sidebar and ten summary sections. Copy reads the Applications tab first (mounted stage panels plus the visible form), then opens Profile, waits for its section tables to finish loading, and restores the tab staff were on. Opening Profile removes the Applications stage tracker until the lead page reloads, so a Profile-first copy reopens Applications only far enough to read its visible form. Profile values win on shared keys; Applications fills in admission preference, social contacts and split address components.

The reader resolves labels that mean different things per panel: `Study Destination` is `preferredDestination` in Admission Preference but `previousStudyDestination` in Previous Study Abroad; `Institute Name` in Admission Preference is `preferredUniversity`, not `institutionName`; reference `Phone`/`Email` are `referencePhone`/`referenceEmail`. Checked checkboxes are ignored (they only carry `on`), and a dial-code select is joined with the adjacent number input rather than copied as `phone`.

Canonical keys are the shared names used between the CRM reader and the portal engine. For example, the CRM label "First name" becomes `fields.givenName`. A portal selector mapped to `givenName` receives that same value. The reader can open supported CRM sections before reading them. It keeps the first non-empty value for a key, normalizes whitespace, and converts recognised single dates to `YYYY-MM-DD`; `*Dates` range keys keep the visible range. Values shown as `N/A`, `-`, `Not Applicable`, `No X Found.` or `No X available.` are treated as absent.

The cache is flat: one saved education, passport, visa, work or reference entry per key. Multi-row CRM data beyond the first entry is not stored. Lead lists, remarks, tasks and the other tabs are not part of Copy; documents have their own list.

Document listing uses read-only CRM API `GET`s per group (`fp_cv_docs`, `fp_edu_docs`, and the other `fp_*_docs` endpoints in `src/crm-documents.js`), with the page `meta[name="api-token"]` Bearer header and same-origin credentials. The token is used transiently for listing. It is not written into `studentCache`.

---

## Data flow: Copy to Autofill

1. Popup validates the active tab is an approved CRM origin.
2. Reader returns one profile. Documents are listed separately. Listing failure does not block field Copy.
3. Background validates and stores one `studentCache`.
4. Staff open a fill target (any HTTP(S) page that is not a CRM origin). Mapped portals may already be in `host_permissions`. Others rely on toolbar `activeTab` or an optional exact-site grant via **Allow this website**. That button appears only for HTTPS origins (`optional_host_permissions` is `https://*/*`), so a plain HTTP page outside the build's host permissions can be filled only through `activeTab`, which the browser grants when staff open the extension from the toolbar on that tab.
5. Popup enumerates frames with `chrome.webNavigation.getAllFrames`.
6. Only the top frame and frames whose URL origin exactly matches the selected page origin are kept. Cross-origin embeds and opaque or sandboxed frames are skipped or rejected later.
7. Each selected frame must expose `documentId`. If any selected frame lacks it, Autofill fails closed before any injection and the popup shows: "This browser cannot bind Autofill to the exact page document. Fill the form manually, or use Chrome or Edge." Before that, the top frame must still be on the selected origin, otherwise the popup shows "The page changed before Autofill started. Try again on the form." **Attach CRM documents** uses the same frame selection, so its upload scan fails in the same way. Do not claim Safari parity from `storage.session` alone.
8. Popup injects `PORTAL_FILES` per `documentId`, opens one `tabs.connect` port named `sams-autofill` per document, sends `prepare` with the selected origin, re-reads the worker cache, then sends `autofill` with the field map.
9. `portal-fill.js` accepts the port only from the popup sender, re-checks origin, `self.origin` (sandbox), and top-page origin, then runs the engine.
10. Navigation closes the port. The popup does not reconnect that port.

Each selected frame's injected extension script receives the copied field map for local matching, not only the fields that will eventually match. The extension does not POST that map to the university server. Once values enter the page's controls, the page and its scripts can read, autosave, or transmit them. Not clicking Submit is not a guarantee that the university has received no data.

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
- Mapped mode activates when a portal config's `origins` includes `location.origin` and a `pageMatchers` entry matches. A portal with a missing or empty `pageMatchers` list activates on every page of its origins. First matching portal in the loaded `SAMS_PORTALS` array wins. Otherwise behaviour falls back to generic.

**`pageMatchers` vs `splitDates.page`:**

- `pageMatchers` string entries use `location.pathname.includes(matcher)`. RegExp objects use `matcher.test(location.pathname)`. Query strings are not part of that check.
- `splitDates` use `new RegExp(spec.page).test(location.pathname + location.search)`, and may also accept a `spec.form` RegExp against `select.form.action` when the path test fails. Inspect `fillSplitDates` before changing date maps.

Shared synonyms belong in `config/synonyms.js`. Portal-only phrases belong in that portal's `extraSynonyms`.

### Derived values and portal option maps

Mapped Autofill calls `withDerivedKeys` before matching. It adds a missing key only when the active portal declares that key in `selectorOverrides` or `splitDates`. Generic matching does not use these derivations. An explicit non-empty CRM value takes precedence, and derivation does not change the cached CRM fields or the Copied details list.

| Missing key | Fallback | Current use |
|---|---|---|
| `countryOfBirth` | `nationality` | Greenwich, Manchester, and Bangor birth-country selects (`#ud60`, `#IPQ_OA_COB`, `#id_birth_nation`) |
| `currentDomicile` | `countryName` | Greenwich Area of Permanent Residence and Manchester Country of residence |
| `preferredIntake` | `preferredStartMonth` plus `preferredStartYear`, when both exist | Greenwich Programme month and year |

Nationality does not prove country of birth. Address country does not establish every portal's legal definition of domicile. Staff must verify these answers and correct the portal when the fallback is wrong.

`valueMaps` maps a normalised CRM value to an ordered array of permitted portal option labels. A missing CRM value in a declared map produces no candidates rather than falling back to a fuzzy match. `portalValueMap` checks own properties, so values such as `constructor` do not select an inherited property. Greenwich funding accepts the normalised self-funded variants `self funded` and `self funding`, selecting `Entire cost of tuition fees is paid by private finance.` Other funding values stay manual. Greenwich job title maps to `#ud16`, not Full-time or Part-time.

---

## Document discovery and authentication

**List (at Copy).** Read-only GETs from the CRM page context. Same-origin credentials. `redirect: "error"`. Rows must belong to the lead id, use an allowed extension (`pdf`, `jpg`, `jpeg`, `png`, `doc`, `docx`), and use an approved file URL.

**Approved file URL.** Same CRM origin as the copied profile, path `/tmp_aws_media/<safe-name>` only, no query, no hash, no userinfo. See `SAMS_ALLOWLIST.isCrmFileUrl`.

**Fetch (only on Attach).** Popup finds an open tab on `cache.sourceOrigin`, injects `crm-documents.js` if needed, and asks that tab for `readCrmDocument`. Fetch uses `credentials: "same-origin"`, `redirect: "error"`, `cache: "no-store"`. Rejects HTML content types, empty bodies, and bodies over 10 MiB (`10 * 1024 * 1024` bytes). The staff-facing error calls this limit 10 MB. Bytes are Base64-encoded for the message. Base64 is transport encoding, not encryption.

**Portal assign.** `portal-fill.js` rebuilds a `File` with `DataTransfer`, assigns `input.files`, and dispatches `input` and `change`. An upload field that already has a file is not replaced. The portal may upload immediately. No ordinary Downloads folder write is performed by the extension. The portal holds the assigned file after Attach. Clear does not remove that file or cancel a portal upload.

**View.** Opens the original CRM media URL in a new tab (`chrome.tabs.create`). That navigation is not the same as the no-store attach fetch. Extension `cache: "no-store"` does not control CRM or portal server retention, or ordinary browser caching of a Viewed tab.

### What happens to a document at each step

1. Copy lists metadata from nine CRM document groups. It does not fetch file bytes. If listing fails, field Copy can still succeed with no attachable documents.
2. **Attach CRM documents** scans enabled file inputs in the selected page's supported frames. The popup filters choices by each input's `accept` hints and labels suggested matches. Staff must choose the file and destination. Scanning or choosing alone does not fetch it.
3. On **Attach**, the popup checks the current cache and that the upload list belongs to the same Copy. It finds an open tab on the copied CRM origin. That tab need not display the original student's profile because the selected file URL comes from the cached metadata.
4. `readCrmDocument` fetches that one URL in the CRM tab with same-origin cookies. The CRM cookie is not copied into the student cache or sent to the portal. The file fetch uses the existing web session, not a stored extension password.
5. The CRM script reads the response bytes and returns Base64 through extension messages to the popup. The popup sends the selected filename, MIME type, and Base64 to the exact portal document and upload key recorded during the scan.
6. The portal script decodes the bytes and creates a `File`. It assigns that file to the original input without replacing an existing file, then emits `input` and `change`. A successful assignment is not proof that the university has finished uploading or accepted the document.
7. Transient buffers are left for browser garbage collection. The portal retains its `File` or uploaded copy under its own lifecycle. The extension does not track or delete that copy.

The extension does not OCR, summarise, edit, redact, or malware-scan files. It does not fill portal text fields from PDF or Word contents. MIME type comes from the file extension, not a full content inspection. The 10 MiB limit is a per-file acceptance limit, not a guaranteed cap on total browser memory. The implementation may read a whole response before rejecting its actual size, and Base64 creates additional memory copies.

### Authentication and media-link limits

The document-listing Bearer token comes from the signed-in CRM page and stays transient. Document names and URLs can still identify a student, so metadata is sensitive even without file bytes.

The extension's URL gate checks origin and path shape. It does not establish that the CRM media server protects every `/tmp_aws_media/` URL with authentication. Same-origin credentials allow the server to enforce access, but do not force it to do so. Whether a copied URL works after logout, session revocation, or without cookies is a backend property and has not been verified here. IT and the CRM owner must verify that behaviour on approved test files before relying on account revocation to block file access. View also relies on the media server's controls.

---

## Storage, clipboard, and privacy boundary

| Data | Location and retention |
|---|---|
| Original student records and files | SAMS CRM and its media backend. The extension does not delete them or define their server location, backups, or retention |
| Copied student fields and document names, types, groups, and URLs | One `chrome.storage.session` object per browser profile. Rolling 30-minute expiry and the removal events described above |
| Popup display, fill reports, field map, and transfer buffers | Browser JavaScript memory while the relevant extension or page contexts remain alive. No secure-wipe guarantee |
| File bytes during Attach | Transient CRM script, popup, message, and portal script memory. No file-byte entry in extension storage and no extension-created Downloads copy |
| Values filled into a university form | Page DOM, then any autosave or server storage the portal uses. Clear does not remove them |
| Attached files | Portal file input and any university upload service or storage. Clear does not remove them or cancel an upload |
| Per-field Copy text | System clipboard through `navigator.clipboard.writeText`. May remain in clipboard history or be synced by OS or third-party tools |
| Files opened with View or saved manually | Normal browser tab, cache, history, viewer, or downloaded file. Retention is outside the extension's session-cache rules |
| Website permission grants and login cookies | Browser permission and website session systems, separate from `studentCache`. Clear neither revokes site access nor signs staff out |

There is no extension-operated cloud storage, analytics upload, or cross-profile student-data sync in the current code. This does not prevent the CRM, university, browser, operating system, or another installed tool from retaining data under its own rules. Physical server region and downstream retention are not configured or proven by this repository.

Do not promise secure memory wiping, OS swap control, or clipboard history behaviour.

---

## Access controls and security limits

- The extension has no separate staff login, SSO integration, employee directory, per-employee permissions, or central admin service. Access to an installed browser profile is access to its unexpired copied student. The extension does not reauthenticate staff before displaying or filling that copy.
- The worker validates popup senders and the cache schema. `chrome.storage.session` is not exposed to content scripts by default, and this code does not widen that access. These checks do not protect against a compromised device, browser, or authorised user inspecting extension data in DevTools.
- A private or incognito window is not a verified separate student cache. Do not use private browsing as a substitute for an approved separate browser profile or device. Actual private-window behaviour needs browser-specific acceptance.
- CRM Copy depends on the staff member's existing CRM access. Autofill of cached text does not require a currently signed-in CRM tab. Logout or account revocation does not recall already-copied values.
- Portal mappings and configured host permissions are not an enforced list of allowed destinations. Staff can invoke generic Autofill on a non-CRM HTTP(S) page they select, subject to browser site access. Optional **Allow this website** grants one HTTPS origin. The extension has no DLP rule preventing a user from choosing an inappropriate recipient. Use approved portals and browser-management controls.
- The current code has no application-level encryption or per-user encryption key for the cached fields. HTTPS encrypts web transfers in transit. Generic matching also permits HTTP targets, so the extension does not enforce encrypted destinations. Staff must use approved HTTPS portals. Browser isolation and OS device controls are not a promise of encryption or secure erasure of every memory copy.
- Clear, cache expiry, and browser shutdown cannot recall a clipboard copy, screenshot, manual download, or data already received by another service.
- The popup shows operation results, but the extension has no durable central audit trail of which employee copied or attached which record. CRM and portal audit coverage must be confirmed with those system owners.

Managed-device enrolment, disk encryption, screen locking, least-privilege CRM accounts, browser extension policy, and server-side session revocation are organisational controls to confirm before rollout. They are not controls implemented by this extension. Do not enable it on shared or personal browser profiles without an approved data-handling policy.

---

## Employee offboarding and device loss

An employee leaving does not trigger an extension event. There is no remote-wipe or central kill switch in this code. An offline or unmanaged device cannot be cleared remotely by this extension. Do not wait for the 30-minute timer as an offboarding control, since ongoing use renews it.

The following is an IT procedure to adapt to the organisation's approved offboarding and incident policies. It is not an automated product feature.

1. Revoke the employee's SAMS CRM and university access through the owners of those systems. Invalidate active sessions and relevant tokens, not only passwords. Address shared credentials under the organisation's policy. Confirm which session-revocation controls the servers actually support.
2. Secure or recover every managed device and browser profile used for student work. If a device is unavailable, invoke the approved lost-device process and endpoint-management controls. Escalate possible data exposure instead of assuming the extension erased it.
3. On an available device, stop active fills and transfers, select **Clear**, and confirm the student card is absent. Close other extension popups, CRM tabs, file viewers, and portal pages. Clear alone does not cancel an operation already in progress.
4. Disable or remove the extension through the managed-browser process and fully quit the browser. Prevent unapproved reinstallation if that is part of the offboarding policy. Removing the extension does not erase data held by websites or the OS.
5. Review clipboard history, downloads, screenshots, printouts, support captures, and synced personal storage under the approved retention and evidence-preservation policy. Do not delete incident evidence or business records without the responsible owner's approval.
6. Review university drafts and uploads with the admissions owner. Correct or remove inappropriate copies through that portal's process. Reassign legitimate work rather than deleting records indiscriminately.
7. Verify revocation on an approved test account and file. Confirm that old sessions and direct media URLs cannot retrieve new protected data. Record completion in the organisation's offboarding system, since the extension provides no central completion log.

If unauthenticated media links remain accessible, cached copies remain on an uncontrolled device, or data went to the wrong portal, refer the incident to the CRM owner and the organisation's security or privacy lead. This guide does not establish a legal retention period, breach-reporting decision, or compliance approval.

---

## Support evidence and local test data

Share redacted error messages, page names, and control identifiers rather than student values, file URLs, tokens, or full browser profiles. Treat document names as potentially identifying. The live runner writes a redacted report under ignored `tmp/`, but ignoring a file in Git is not access control or a retention policy. Credentials in a local `.env.local`, authenticated browser profiles, and any manual captures need separate workstation and cleanup controls. They are developer or test artifacts, not part of the deployed extension's session cache.

---

## Development, check, and build commands

Use a current Node.js environment and npm. Run `npm ci` in the repository to install the locked development dependencies. Then use these scripts from `package.json`:

| Script | Purpose |
|---|---|
| `npm test` | Node tests under `test/` (supporting checks) |
| `npm run test:e2e` | Loaded-extension Chromium E2E |
| `npm run test:e2e:live` | Opt-in live smoke |
| `npm run build` | Chrome **dev** package to `dist/chrome` |
| `npm run build:prod` | Chrome **prod** package (allowlist gate passes; release acceptance pending) |
| `npm run build:safari` | Safari web-extension resources |
| `npm run build:safari:prod` | Safari prod resources (same allowlist gate) |
| `npm run build:safari:app` | Unsigned Safari app packaging |
| `npm run safari:fixtures` | Local fixture server for Safari checklist |

**Production packaging is enabled; release acceptance is not complete.** `config/allowlist.js` now lists the Campora origin and three portal origins, so `scripts/build.mjs` produces production packages. Live Campora-to-portal acceptance, the remaining portal journeys and Safari runtime acceptance still block release. If the allowlist becomes incomplete again, the build refuses; do not bypass that gate. Root `manifest.json` is a template; the built manifest under `dist/` receives generated `host_permissions`. Never edit `dist/` by hand as source of truth. Reload the extension and the tested page after a rebuild. Version bumps and distribution follow the approved release process in [INSTALL-AND-DEPLOY.md](INSTALL-AND-DEPLOY.md).

The current Chromium E2E runner uses the installed Helium browser by default. Check [the E2E browser setup](../e2e/README.md) before running it on another machine. Live checks require approved test access. Do not put credentials in this guide or in fixtures.

The live runner targets Bangor, Greenwich, and Greater Manchester when their separate credentials and an existing test draft are available. Manchester checks the Personal Details (PD), Contact Details (CD), Qualifications (QU), and Experience (EX) tabs after lazy tab loading. It blocks non-GET/HEAD traffic after login, including tab-loading POSTs, and records blocked stages without field values. This is a test-runner safeguard, not a network firewall in the deployed extension. A blocked tab is not a pass. See [live smoke instructions and boundaries](../e2e/README.md#live-random-sample-smoke-test).

Safari packaging of shared JS is not proof that Autofill, document binding, or exact `documentId` behaviour is verified on Safari.

---

## Current limitations

- Not every university is mapped. Unmapped sites get generic common-field matching only.
- Live CRM-to-portal acceptance may still be pending for mapped portals. Check [../PORTALS.md](../PORTALS.md).
- Exact-document Autofill requires `documentId` from `webNavigation.getAllFrames`. Browsers without that fail closed for Autofill and Attach flows that use `selectedPageFrames`.
- Top document and same-origin frames only.
- No automatic Save / Next / Submit / pay / declaration. Portal handlers may still react to filled values or attached files.
- The production allowlist is configured (Campora APPLY and three portal origins); one Campora-to-Bangor no-save sample passed, while full Campora and Safari runtime acceptance remain open.
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

Supported properties used by current code include `id`, `name`, `origins`, `pageMatchers`, `selectorOverrides`, `phoneKeepsDialPrefix`, `extraSynonyms`, `valueMaps`, `splitDates`, and `blockedControls`. Do not add unsupported config keys and expect the engine to honour them. Use `valueMaps` for reviewed CRM-value to portal-option translations. Its object keys must match the engine's `normalize` output, and each value must be an array of exact option labels. Unsupported source values in that map stay manual. See [derived values and portal option maps](#derived-values-and-portal-option-maps) and the current Greenwich config.

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

Security claims above can be traced to these implementation and regression checks:

| Claim | Implementation | Existing evidence |
|---|---|---|
| One validated cache with expiry and serialized Clear | `src/background.js`, `config/allowlist.js` | `test/session-lifecycle.test.js`; loaded-extension Clear and expiry cases |
| Copy stores metadata, never file bytes or listing tokens | `src/crm-documents.js`, `src/background.js` | E2E metadata filtering and nine-group authenticated listing cases |
| Only explicit Attach fetches and assigns the selected file | `popup.js`, `src/crm-documents.js`, `src/portal-fill.js` | E2E exact PDF and JPEG bytes, target-frame selection, occupied inputs, redirect and HTML rejection |
| Ordinary Autofill does not attach files | `src/engine/engine.js`, `src/portal-fill.js` | E2E ordinary-Autofill file-input case |
| Derived fields preserve the CRM cache and existing portal values | `src/engine/engine.js`, portal configs | E2E portal mapping cases A through E |

These checks do not verify employee revocation, media-server authorisation, device encryption, portal retention, or secure erasure. Those require the system owners and approved operational checks described above.

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
