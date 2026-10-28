# SAMS Portal Autofill: technical handover

This guide is for engineers, IT administrators, and security reviewers who maintain or deploy the extension. Other guides:

- Staff steps: [USER-HANDOVER.md](USER-HANDOVER.md)
- File layout: [CODEBASE_MAP.md](CODEBASE_MAP.md)
- Install and release: [INSTALL-AND-DEPLOY.md](INSTALL-AND-DEPLOY.md)
- Portal status: [../PORTALS.md](../PORTALS.md)

The statements below describe the current source. A live CRM-to-portal test can show different results.

To add support for another portal, see [How to add a mapped university](#how-to-add-a-mapped-university).

## Security questions at a glance

| Question | Answer | Detail |
|---|---|---|
| How does the extension copy student details? | Staff select Copy. Injected scripts read the signed-in CRM profile and list the document metadata. No background sync runs. | [CRM read](#crm-read-and-canonical-keys) |
| Where does it store the copy? | In one `studentCache` in `chrome.storage.session`, in that browser profile. There is no extension cloud database and no sync of student data. | [Cache](#the-student-cache) |
| How long does the copy stay? | The deadline is 30 minutes and it rolls forward. A new Copy replaces the student and starts a new deadline. A successful Autofill or Attach sets the deadline to 30 minutes from that moment. With continued use, a copy can stay longer than 30 minutes. | [Retention](#retention-and-clear) |
| Does it copy document files into storage? | No. Copy keeps names, types, groups, and CRM URLs. Attach fetches one chosen file into memory. | [Documents](#document-discovery-and-authentication) |
| Does it read files to fill fields? | No. Autofill uses CRM text fields. Attach moves the chosen file and does not read its contents. | [Documents](#document-discovery-and-authentication) |
| What happens when an employee leaves? | Nothing happens automatically. The extension has no employee account, no employment check, no central logout, and no remote wipe. IT must revoke access and secure the device. | [Offboarding](#employee-offboarding-and-device-loss) |
| Does Clear recall data? | No. Clear removes the extension cache. It does not remove portal values, uploaded files, clipboard text, or CRM records. | [Storage](#storage-clipboard-and-privacy-boundary) |
| Can revoked staff still use a copy? | Yes, until the copy expires. An unexpired copy can fill forms without a new CRM login. File access depends on the CRM media server's own authorisation. | [Access limits](#access-controls-and-security-limits) |

---

## What the product is

A Manifest V3 browser extension for authorised SAMS staff. It does these things:

1. It reads visible labelled values from an approved SAMS CRM or Campora APPLY student profile.
2. It lists SAMS CRM document metadata (not file bytes) in one session cache. It does not list Campora documents.
3. It fills empty controls on university application pages. It saves nothing itself.
4. When staff ask, it fetches one CRM file inside an authenticated CRM tab and assigns it to a portal `input[type=file]`.

The extension never selects Save, Next, Submit, pay, or declaration controls. A portal widget can still save or upload after an `input` or `change` event.

---

## Architecture and file map

- The **popup** is the small window that opens from the browser toolbar.
- A **content script** runs inside a website tab.
- The **background service worker** runs separately. It manages the temporary student copy.
- An **origin** is the URL scheme, host name, and optional port. Example: `https://apps.bangor.ac.uk`.

```text
popup.html / popup.js
  origin checks, script injection, UI, per-frame ports
        |
        v
src/background.js          chrome.storage.session studentCache + alarm
config/allowlist.js        exact origins, sessionMinutes, CRM file URL rules
        ^
        |
src/crm-reader.js          CRM DOM -> canonical field map
src/crm-documents.js       CRM document list + file fetch on attach
config/crm-source.js       CRM path and marker guards, label aliases
        |
        v
src/portal-fill.js         port handler: prepare, autofill, listUploads, showUpload, attachDocument
src/engine/engine.js       scan, match, format, fill, split dates, click guard
config/synonyms.js         shared synonyms, GENERIC_FIELDS, GENERIC_BLOCKED
config/portals/*.js        per-portal origins, pageMatchers, overrides, blocks
```

| Path | Role |
|---|---|
| `manifest.json` | Source MV3 template. The build writes `host_permissions` from the allowlist. |
| `popup.html`, `popup.js` | Toolbar UI and orchestration. `PORTAL_FILES` lists the scripts that the popup injects into portal frames. |
| `config/allowlist.js` | CRM, Campora, portal, and development origins. `sessionMinutes: 30`. File URL rule. |
| `config/build-mode.js` | The build overwrites it with `dev` or `prod`. |
| `config/crm-source.js` | Profile URL patterns, page markers, and visible label to canonical key. |
| `config/synonyms.js` | Shared matching vocabulary and the generic field set. |
| `config/portals/greenwich.js` | University of Greenwich mapping. |
| `config/portals/bangor.js` | Bangor University mapping. |
| `config/portals/manchester.js` | University of Greater Manchester mapping (`evision.bolton.ac.uk`). |
| `src/background.js` | Serialized cache changes. Accepts messages from the popup only. |
| `src/crm-reader.js` | Profile reader. |
| `src/crm-documents.js` | Document listing and file fetch on attach. |
| `src/portal-fill.js` | Frame-bound port protocol. |
| `src/engine/engine.js` | Matching and fill engine. |
| `scripts/build.mjs` | Chrome and Safari resource package. |
| `scripts/package-safari.mjs` | Unsigned Safari app package. |
| `safari/` | macOS containing app. Shared JavaScript does not prove that Safari behaves the same. |

Related guides: [TECHNICAL-AND-MAPPING.md](TECHNICAL-AND-MAPPING.md), [STAFF-GUIDE.md](STAFF-GUIDE.md), [../safari/README.md](../safari/README.md), [../e2e/README.md](../e2e/README.md), [../e2e/safari/README.md](../e2e/safari/README.md).

---

## The student cache

The background service worker owns one object. Its key in `chrome.storage.session` is `studentCache`.

The extension does not use `localStorage`, `sessionStorage`, IndexedDB, `chrome.storage.local`, `chrome.storage.sync`, or the HTTP browser cache for this data.

**Lifecycle.** The browser manages session memory. The memory survives a popup close and a service worker suspension. In Chrome, these events clear session storage: disabling, reloading, or updating the extension, and restarting the browser. Closing one browser window is not always a full browser shutdown. A new successful Copy replaces the previous student. This lifecycle follows the [Chrome storage API documentation](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session). Nobody has tested whether Safari behaves the same.

The storage belongs to the extension, not to the CRM website. It is not the system clipboard and it is not a folder in Downloads. Website scripts cannot read it through their own storage APIs. The extension sends selected values to a portal only when staff use Autofill or Attach.

**Shape of the cache after a successful Copy:**

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

A document entry holds metadata only. The cache never holds file bytes.

Treat the whole copy as confidential student data. Depending on the CRM sections, the fields can include contact details, date of birth, passport information, education, employment, visa history, and references. The document groups are CV, education, work history, English tests, references, visa history, visa refusal, passport, and additional documents. The cache holds no file bytes, but it still holds sensitive data.

**Expiry.**

- `config/allowlist.js` sets `sessionMinutes: 30`.
- Copy stores a new deadline.
- A successful Autofill (at least one frame returns a fill report) or a successful Attach calls `touchStudentCache`. This sets `expiresAt` to `Date.now()` plus `sessionMinutes`. It does not add 30 minutes to the old deadline.
- A fill report with zero changed fields still counts as activity.
- Opening the popup or reading the cache does not renew the deadline.
- `readCache` clears the cache when `expiresAt` has passed.
- An alarm checks the stored timestamp again, so an old alarm cannot delete a renewed cache.
- One serialized queue runs all cache changes.

**Access control.** Only the extension popup (`popup.html` as the sender) can call `cacheStudent`, `getStudentCache`, `touchStudentCache`, or `clearStudentCache`.

**Validation.** The worker accepts 2 to 200 field entries. Each value is a string of at most 4,000 characters. It accepts at most 100 document entries. It checks the identity, origin, field keys, and document metadata before it replaces the cache. It rejects an invalid profile. It does not shorten the profile and accept it.

### Retention and Clear

| Event | Effect on the extension cache |
|---|---|
| Successful Copy | Replaces the previous student and the document metadata. Starts a new 30 minute deadline. |
| Successful Autofill or Attach | Sets the deadline to 30 minutes from that moment. There is no maximum lifetime from the first Copy. |
| Open the popup, look at copied details, copy one field, view a file, or scan upload fields | Does not renew the deadline. |
| Failed Copy | Does not replace a valid student. Check the card. Do not assume that the cache was cleared. |
| All Autofill frames fail, or Attach fails | Does not renew the deadline. |
| Deadline reached | The alarm removes the cache when it runs. Every cache read also checks the deadline and refuses expired data. |
| Clear | Removes `studentCache` and its alarm. The popup that started Clear removes its student card and upload choices. |
| Close the popup, or the service worker suspends | The cache stays until another removal event. |
| CRM logout, removal of a permission, or disabling of an employee account | No automatic cache removal. These are not extension lifecycle events. |

The popup reads the worker cache again before it starts Autofill or fetches a file. This stops a stale popup from using a cache that is already cleared or expired. Another open popup can still show its old copy until it refreshes or closes. Clear and expiry do not cancel a fill or file transfer that has already started. They do not securely overwrite JavaScript memory. During a sensitive cleanup, close the extension windows and the affected pages.

---

## CRM read and canonical keys

Copy injects these files into the active CRM tab:

- `config/build-mode.js`
- `config/allowlist.js`
- `config/crm-source.js`
- `src/crm-reader.js`
- `src/crm-documents.js`

The reader checks the CRM origin, the profile path patterns, and the page markers from `config/crm-source.js`. It maps visible labels to canonical keys such as `givenName`, `familyName`, `dateOfBirth`, `email`, `phone`, `location`, and `passportNumber`. Add a CRM label alias only after you have seen the real label on an authorised profile. Do not invent labels. The field map for every lead type and every Profile-tab section is in [portal-maps/CRM-LEAD-PROFILE.md](portal-maps/CRM-LEAD-PROFILE.md).

### SAMS CRM

An individual lead page (`/agent/leads/full-profile/<id>`) has two relevant tabs:

- **Applications.** The lead-stage workflow. It has editable stage forms and the admission-preference fields.
- **Profile.** A read-only review tab. It has the lead header, the sidebar, and ten summary sections.

Copy reads the Applications tab first (the mounted stage panels and the visible form). Then it opens Profile and waits for the section tables to finish loading. Then it restores the tab that staff were on. Opening Profile removes the Applications stage tracker until the lead page reloads. After a Profile-first copy, the reader opens Applications again, only far enough to read its visible form. Profile values win on shared keys. Applications adds admission preference, social contacts, and split address parts.

### Campora APPLY

Campora APPLY (`https://v-sams-backend.samsapply.co.uk`, route `/applyuser/show/<id>/profile`) is a second Copy source. Its Profile tab loads on demand. The reader opens that tab and waits for the sections to load. It reads the summary, the record tables, and the application header. Then it restores the tab that was active. The field map, the deliberate omissions, and the read-only endpoints are in [portal-maps/CAMPORA.md](portal-maps/CAMPORA.md).

### Label rules

- Some labels mean different things in different panels. `Study Destination` is `preferredDestination` in Admission Preference and `previousStudyDestination` in Previous Study Abroad. `Institute Name` in Admission Preference is `preferredUniversity`, not `institutionName`. Reference `Phone` and `Email` are `referencePhone` and `referenceEmail`.
- The reader ignores checked checkboxes, because they carry only `on`.
- The reader joins a dial-code select with the adjacent number input. It does not copy the dial code as `phone`.
- The reader keeps the first non-empty value for a key and normalizes white space.
- It converts recognised single dates to `YYYY-MM-DD`. Keys that end in `Dates` keep the visible range.
- It treats these values as absent: `N/A`, `-`, `Not Applicable`, `No X Found.`, and `No X available.`

The cache is flat. It keeps one saved education, passport, visa, work, or reference entry for each key. It does not store later rows. Lead lists, remarks, tasks, and the other tabs are not part of Copy. Documents have their own list.

### Document listing

The reader lists documents with read-only CRM API `GET` requests. There is one request for each group (`fp_cv_docs`, `fp_edu_docs`, and the other `fp_*_docs` endpoints in `src/crm-documents.js`). Each request sends the page `meta[name="api-token"]` value as a Bearer header, with same-origin credentials. The extension uses the token only while it lists. It does not write the token into `studentCache`.

---

## Data flow: Copy to Autofill

1. The popup checks that the active tab is on an approved CRM origin.
2. The reader returns one profile. The extension lists documents separately. A failed document list does not block field Copy.
3. The background worker validates the profile and stores one `studentCache`.
4. Staff open a fill target. This is any HTTP(S) page that is not a CRM origin.
   - Mapped portals can already be in `host_permissions`.
   - Other pages use the toolbar `activeTab` grant, or an optional exact-site grant from **Allow this website**.
   - **Allow this website** shows only for HTTPS origins, because `optional_host_permissions` is `https://*/*`. A plain HTTP page outside the build's host permissions can be filled only through `activeTab`. The browser grants `activeTab` when staff open the extension from the toolbar on that tab.
5. The popup lists the frames with `chrome.webNavigation.getAllFrames`.
6. The popup keeps the top frame and the frames with exactly the same origin as the selected page. It skips cross-origin embeds. It skips or later rejects opaque and sandboxed frames.
7. Each selected frame must have a `documentId`.
   - If a selected frame has no `documentId`, Autofill stops before it injects anything. The popup shows: "This browser cannot bind Autofill to the exact page document. Fill the form manually, or use Chrome or Edge."
   - Before that check, the top frame must still be on the selected origin. If not, the popup shows: "The page changed before Autofill started. Try again on the form."
   - **Attach CRM documents** uses the same frame selection. Its upload scan fails in the same way.
   - Do not claim Safari parity from `storage.session` alone.
8. The popup injects `PORTAL_FILES` into each `documentId`. It opens one `tabs.connect` port named `sams-autofill` for each document. It sends `prepare` with the selected origin. It reads the worker cache again. Then it sends `autofill` with the field map.
9. `portal-fill.js` accepts the port only from the popup. It checks the origin, `self.origin` (the sandbox), and the top-page origin again. Then it runs the engine.
10. Navigation closes the port. The popup does not reconnect it.

The injected script in each selected frame receives the whole copied field map for local matching. It does not receive only the fields that will match. The extension does not send that map to the university server. When values enter the page controls, the page and its scripts can read, autosave, or send them. If staff do not select Submit, this does not guarantee that the university received no data.

---

## Messages and ports

- **Runtime messages (popup to background):** `cacheStudent`, `getStudentCache`, `touchStudentCache`, `clearStudentCache`.
- **Tab messages (popup to CRM tab):** `copyCrmProfile`, `copyCrmDocuments`, `readCrmDocument`.
- **Ports (popup to portal frames):** the port name is `sams-autofill`. The actions are `prepare`, `autofill`, `listUploads`, `showUpload`, and `attachDocument`.

The port gives each upload field a key (`upload-0`, `upload-1`, and so on). Show and Attach use that key. They never query a CSS selector again at attach time. This is the exact-document binding for files.

---

## Matching engine safeguards

In mapped mode, the engine scans the form controls. It reads their labels, names, IDs, and autocomplete attributes. A control that matches a `selectorOverrides` entry exactly scores 1000 for its configured CRM key. Other controls use shared and portal synonyms, word matches, autocomplete values, and section context. A score below 50 does not fill a field. Then the engine checks the current value and chooses a compatible text, date, radio, or select value. A high score does not guarantee a fill.

`src/engine/engine.js` and the config files enforce these rules:

- The engine does not overwrite a non-empty value.
- The normal scanner skips readonly, disabled, hidden, inert, and disconnected controls. Split-date controls use a separate path. Review their selectors carefully.
- Autofill never fills checkboxes or file inputs. Files use **Attach CRM documents** only.
- The click guard rejects controls with accessible text that matches submit, pay, send, delete, confirm, declare, agree, next, save, or continue.
- The normal matcher skips the selectors in a portal's `blockedControls`. The separate path can still fill date selects that `splitDates` lists.
- Generic mode uses `GENERIC_FIELDS` in `config/synonyms.js`. The label, name, ID, and autocomplete hints must not disagree. A label that is present but not recognised prevents a fill. The control type must be allowed. No other control can claim the same key. A blocked field, section, or form context prevents a fill. A password field in the same form also prevents a fill.
- Mapped mode starts when a portal config's `origins` include `location.origin` and a `pageMatchers` entry matches. A portal with a missing or empty `pageMatchers` list starts on every page of its origins. The first matching portal in the loaded `SAMS_PORTALS` array wins. Otherwise the engine uses generic mode.

**`pageMatchers` and `splitDates.page`:**

- A string in `pageMatchers` uses `location.pathname.includes(matcher)`. A RegExp uses `matcher.test(location.pathname)`. The query string is not part of this check.
- `splitDates` uses `new RegExp(spec.page).test(location.pathname + location.search)`. If the path test fails, it can also test a `spec.form` RegExp against `select.form.action`. Read `fillSplitDates` before you change date maps.

Put shared synonyms in `config/synonyms.js`. Put portal-only phrases in that portal's `extraSynonyms`.

### Derived values and portal option maps

Mapped Autofill calls `withDerivedKeys` before matching. It adds a missing key only when the active portal declares that key in `selectorOverrides` or `splitDates`. Generic matching does not derive keys. A non-empty CRM value takes precedence. A derived value does not change the cached CRM fields or the Copied details list.

| Missing key | Fallback | Current use |
|---|---|---|
| `countryOfBirth` | `nationality` | Birth-country selects on Greenwich (`#ud60`), Manchester (`#IPQ_OA_COB`), and Bangor (`#id_birth_nation`) |
| `currentDomicile` | `countryName` | Greenwich Area of Permanent Residence and Manchester Country of residence |
| `preferredIntake` | `preferredStartMonth` plus `preferredStartYear`, when both exist | Greenwich Programme month and year |

Nationality does not prove the country of birth. The address country does not match every portal's legal definition of domicile. Staff must check these answers and correct the portal when the fallback is wrong.

`valueMaps` maps a normalised CRM value to an ordered array of allowed portal option labels.

- If the CRM value is missing and a map is declared, there are no candidates. The engine does not fall back to a fuzzy match.
- `portalValueMap` checks own properties only. A value such as `constructor` does not select an inherited property.
- Greenwich funding accepts the normalised self-funded values `self funded` and `self funding`. It selects `Entire cost of tuition fees is paid by private finance.` All other funding values stay manual.
- Greenwich job title maps to `#ud16`. It does not map to Full-time or Part-time.

---

## Document discovery and authentication

This section starts with a plain-language summary of Attach. The reference parts that follow give the exact checks, limits, and security notes.

### Attach in plain language

#### Does Attach download files to the laptop?

No. Copy only notes which documents exist (names and links). Attach fetches the one file that staff choose, from the CRM page where they are already signed in. The file stays in browser memory for a short time. The extension hands it to the portal and then forgets it. Nothing goes to the Downloads folder. The portal keeps its own copy. **View** is different. It opens the CRM file in a normal browser tab, so the browser may cache it, or staff may save it by hand.

#### How does the extension fill the portal's upload box?

It fills the box from inside the portal page. It does not use the file picker.

1. The extension passes the file name, type, and contents to a script on the portal page (`portal-fill.js`).
2. The script rebuilds the contents into a `File` object. This is the same kind of object the browser makes when a person picks a file.
3. The script puts that `File` into the portal's upload input.
4. The script fires the `input` and `change` events. The portal hears them and reacts as if staff had chosen the file. Many portals start to upload at this point.

A successful hand-off does not mean that the university accepted the file. If the portal hides its real input behind its own widget, the extension cannot fill it, and staff attach the file by hand (see **Show on page** below).

#### How does a `DataTransfer` object work?

A `DataTransfer` object is a container for data that moves inside a web page. Browsers use it for drag and drop and for copy and paste. When a person drags a file onto a page, the browser puts that file in a `DataTransfer` object, and the page reads it from there.

The `files` property of an upload input is normally read-only. Code cannot build a file list by hand, and it cannot push files into the list. But code can assign a ready-made file list to the input. A `DataTransfer` object makes that list:

```js
const dt = new DataTransfer();
dt.items.add(new File([bytes], "passport.pdf", { type: "application/pdf" }));
input.files = dt.files;
```

1. Make an empty `DataTransfer`.
2. Add the `File` to it. The extension builds the `File` from the bytes that it fetched.
3. Assign `dt.files` to the input. The input now holds the file, and the form can submit it.

Setting `files` does not tell the portal anything by itself. This is why the script also fires `input` and `change`. The file comes from memory, not from a path on the laptop. The page never reads the disk. This works only for a file that the extension already holds.

### Reference: list, fetch, and assign

These paragraphs give the exact rules behind the summary above.

**List (at Copy).** The extension sends read-only GET requests from the CRM page. It uses same-origin credentials and `redirect: "error"`. A row must belong to the lead ID, have an allowed extension (`pdf`, `jpg`, `jpeg`, `png`, `doc`, `docx`), and have an approved file URL.

**Approved file URL.** The URL has the same CRM origin as the copied profile. The path is `/tmp_aws_media/<safe-name>` only. There is no query, no hash, and no userinfo. See `SAMS_ALLOWLIST.isCrmFileUrl`.

**Fetch (on Attach only).** The popup finds an open tab on `cache.sourceOrigin`. If needed, it injects `crm-documents.js`. Then it asks that tab for `readCrmDocument`. The fetch uses `credentials: "same-origin"`, `redirect: "error"`, and `cache: "no-store"`. It rejects HTML content types, empty bodies, and bodies larger than 10 MiB (`10 * 1024 * 1024` bytes). The staff-facing error calls this limit 10 MB. The extension encodes the bytes in Base64 for the message. Base64 is a transport encoding. It is not encryption.

**Portal assign.** `portal-fill.js` assigns the file as described in the summary above. It does not replace an existing file. The portal may upload immediately. The extension does not write to the Downloads folder. After Attach, the portal holds the file. Clear does not remove the file and does not cancel a portal upload.

**Show on page.** The `showUpload` action scrolls to an upload field and outlines it for a few seconds. It does not change the field. If the portal hides its file input behind its own widget, the handler returns a message, and staff attach the file in the portal.

**View.** View opens the original CRM media URL in a new tab (`chrome.tabs.create`). This is not the same as the no-store fetch of Attach. The extension setting `cache: "no-store"` does not control CRM or portal server retention. It does not control normal browser caching of a viewed tab.

### What happens to a document at each step

This is the full sequence, from Copy to the portal.

1. Copy lists metadata from nine CRM document groups. It does not fetch file bytes. If listing fails, field Copy can still succeed with no documents to attach.
2. **Attach CRM documents** scans the enabled file inputs in the supported frames of the selected page. The popup filters the choices by the `accept` hints of each input. It marks suggested matches. Staff choose the file and the destination. Scanning or choosing does not fetch a file.
3. When staff select **Attach**, the popup checks the current cache. It checks that the upload list belongs to the same Copy. It finds an open tab on the copied CRM origin. That tab does not need to show the original student's profile, because the file URL comes from the cached metadata.
4. `readCrmDocument` fetches that one URL in the CRM tab, with the same-origin cookies. The extension does not copy the CRM cookie into the student cache and does not send it to the portal. The fetch uses the existing web session. It does not use a stored extension password.
5. The CRM script reads the response bytes. It returns them as Base64 through extension messages to the popup. The popup sends the chosen file name, MIME type, and Base64 data to the exact portal document and upload key from the scan.
6. The portal script decodes the bytes and creates a `File`. It assigns the file to the original input and does not replace an existing file. Then it fires `input` and `change`. A successful assignment does not prove that the university finished the upload or accepted the document.
7. The browser garbage collector frees the temporary buffers. The portal keeps its `File` or uploaded copy under its own lifecycle. The extension does not track or delete that copy.

The extension does not run OCR on files. It does not summarise, edit, redact, or scan files for malware. It does not fill portal text fields from PDF or Word contents. It takes the MIME type from the file extension and does not inspect the content. The 10 MiB limit applies to each file. It is not a limit on total browser memory. The implementation can read a whole response before it rejects the real size, and Base64 makes extra copies in memory.

### Authentication and media-link limits

The document-listing Bearer token comes from the signed-in CRM page. The extension keeps it only while it lists. Document names and URLs can identify a student. The metadata is sensitive even without file bytes.

The extension's URL gate checks the origin and the shape of the path. It does not prove that the CRM media server protects every `/tmp_aws_media/` URL with authentication. Same-origin credentials let the server enforce access. They do not force it to do so. This repository has not verified whether a copied URL still works after logout, after session revocation, or without cookies. This is a backend property. IT and the CRM owner must test it on approved test files before they rely on account revocation to block file access. View also relies on the controls of the media server.

---

## Storage, clipboard, and privacy boundary

| Data | Location and retention |
|---|---|
| Original student records and files | SAMS CRM and its media backend. The extension does not delete them. It does not set their server location, backups, or retention. |
| Copied student fields, and document names, types, groups, and URLs | One `chrome.storage.session` object in each browser profile. Rolling 30 minute expiry and the removal events above. |
| Popup display, fill reports, field map, and transfer buffers | Browser JavaScript memory, while the extension or page contexts stay alive. No secure-wipe guarantee. |
| File bytes during Attach | Short-lived memory in the CRM script, popup, messages, and portal script. No file bytes in extension storage. The extension makes no copy in Downloads. |
| Values filled into a university form | The page DOM, then any autosave or server storage that the portal uses. Clear does not remove them. |
| Attached files | The portal file input and any university upload service or storage. Clear does not remove them and does not cancel an upload. |
| Text from the per-field Copy control | The system clipboard (`navigator.clipboard.writeText`). It can stay in clipboard history or sync through the operating system or other tools. |
| Files opened with View or saved by hand | A normal browser tab, cache, history, viewer, or downloaded file. The session-cache rules do not apply. |
| Website permission grants and login cookies | Browser permission and website session systems. They are separate from `studentCache`. Clear does not revoke site access and does not sign staff out. |

The current code has no extension-run cloud storage, no analytics upload, and no sync of student data between profiles. The CRM, the university, the browser, the operating system, or another installed tool can still keep data under its own rules. This repository does not configure or prove the physical server region or the downstream retention.

Do not promise secure memory wiping, control of OS swap, or any clipboard history behaviour.

---

## Access controls and security limits

- The extension has no staff login, no SSO, no employee directory, no per-employee permissions, and no central admin service. Access to an installed browser profile is access to its unexpired copied student. The extension does not ask staff to sign in again before it shows or fills the copy.
- The worker checks popup senders and the cache schema. Content scripts cannot read `chrome.storage.session` by default, and this code does not widen that access. These checks do not protect against a compromised device or browser. They do not protect against an authorised user who inspects extension data in DevTools.
- A private or incognito window is not a verified separate student cache. Do not use private browsing instead of an approved separate browser profile or device. Private-window behaviour needs browser-specific acceptance tests.
- CRM Copy depends on the CRM access of the staff member. Autofill of cached text does not need a signed-in CRM tab. Logout or account revocation does not recall values that staff already copied.
- Portal mappings and configured host permissions are not a list of allowed destinations that the code enforces. Staff can start generic Autofill on any non-CRM HTTP(S) page that they select, if the browser allows site access. **Allow this website** grants one HTTPS origin. The extension has no data-loss-prevention rule that stops a user from choosing a wrong recipient. Use approved portals and browser-management controls.
- The code has no application-level encryption and no per-user encryption key for the cached fields. HTTPS encrypts web transfers. Generic matching also allows HTTP targets, so the extension does not enforce encrypted destinations. Staff must use approved HTTPS portals. Browser isolation and device controls do not promise encryption or secure erasure of every memory copy.
- Clear, cache expiry, and browser shutdown cannot recall a clipboard copy, a screenshot, a manual download, or data that another service already received.
- The popup shows operation results. The extension has no lasting central audit trail of which employee copied or attached which record. Confirm the CRM and portal audit coverage with those system owners.

Confirm these organisational controls before rollout: managed-device enrolment, disk encryption, screen lock, least-privilege CRM accounts, browser extension policy, and server-side session revocation. The extension does not implement them. Do not enable the extension on shared or personal browser profiles without an approved data-handling policy.

---

## Employee offboarding and device loss

An employee who leaves does not trigger an extension event. The code has no remote wipe and no central kill switch. The extension cannot clear an offline or unmanaged device remotely. Do not use the 30 minute timer as an offboarding control. Continued use renews it.

The steps below are an IT procedure. Adapt it to the offboarding and incident policies of your organisation. It is not an automatic feature.

1. Revoke the access of the employee to SAMS CRM and to the university portals. Ask the owners of those systems. Invalidate active sessions and the related tokens, not only passwords. Handle shared credentials under your policy. Confirm which session-revocation controls the servers support.
2. Secure or recover every managed device and browser profile that the employee used for student work. If a device is not available, start your approved lost-device process and use endpoint-management controls. Escalate possible data exposure. Do not assume that the extension erased the data.
3. On a device that you can reach, stop active fills and transfers. Select **Clear**. Check that the student card is gone. Close other extension popups, CRM tabs, file viewers, and portal pages. Clear does not cancel an operation that is already running.
4. Disable or remove the extension through your managed-browser process. Quit the browser fully. If your policy requires it, prevent reinstallation that you did not approve. Removing the extension does not erase data that websites or the operating system hold.
5. Review clipboard history, downloads, screenshots, printouts, support captures, and synced personal storage. Follow your retention and evidence-preservation policy. Do not delete incident evidence or business records without the approval of the responsible owner.
6. Review the university drafts and uploads with the admissions owner. Correct or remove wrong copies through the process of that portal. Reassign valid work. Do not delete records without checking them.
7. Test revocation with an approved test account and file. Check that old sessions and direct media URLs cannot get new protected data. Record the completion in your offboarding system. The extension has no central completion log.

Refer the incident to the CRM owner and to your security or privacy lead in these cases: media links that need no authentication still work, cached copies remain on a device that you do not control, or data went to the wrong portal. This guide does not set a legal retention period. It does not decide whether to report a breach. It does not approve compliance.

---

## Support evidence and local test data

When you ask for support, share redacted error messages, page names, and control identifiers. Do not share student values, file URLs, tokens, or full browser profiles. Document names can identify a student.

The live runner writes a redacted report under the ignored `tmp/` folder. An ignored Git file is not access control and is not a retention policy. A local `.env.local` file, authenticated browser profiles, and manual captures need their own workstation controls and cleanup. These are developer and test files. They are not part of the session cache of the deployed extension.

---

## Commands

Use a current Node.js and npm. Run `npm ci` to install the locked development dependencies. Then use these scripts:

| Script | Purpose |
|---|---|
| `npm test` | Node tests in `test/` (supporting checks) |
| `npm run test:e2e` | Chromium end-to-end tests with the extension loaded |
| `npm run test:e2e:live` | Opt-in live smoke test without saving |
| `npm run test:e2e:documents:live` | Opt-in live document-attach check (Show on page, exact file bytes) |
| `npm run build` | Chrome development package in `dist/chrome` |
| `npm run build:prod` | Chrome production package and `dist/sams-portal-autofill-prod.zip` |
| `npm run build:safari` | Safari web-extension resources |
| `npm run build:safari:prod` | Safari production resources (same allowlist gate) |
| `npm run build:safari:app` | Unsigned Safari app |
| `npm run safari:fixtures` | Local fixture server for the Safari checklist |

**Production build.** `config/allowlist.js` lists the SAMS CRM origin, the Campora origin, and three portal origins. `scripts/build.mjs` builds the production packages from them. If the Campora list is empty or fewer than three portal origins are set, the build stops. Do not bypass that gate. The root `manifest.json` is a template. The build writes `host_permissions` into the manifest under `dist/`. Never edit `dist/` by hand. After a rebuild, reload the extension and the tested page. Version changes and distribution follow [INSTALL-AND-DEPLOY.md](INSTALL-AND-DEPLOY.md).

**E2E browser.** The Chromium E2E runner uses Helium on macOS by default. Set `SAMS_E2E_BROWSER` to use another Chromium. See [../e2e/README.md](../e2e/README.md) before you run it on another computer. Live checks need approved test access. Never put credentials in this guide or in fixtures.

**Live runner.** It targets Bangor, Greenwich, and Greater Manchester when their separate credentials and an existing test draft are available. On Manchester, it checks the Personal Details (PD), Contact Details (CD), Qualifications (QU), and Experience (EX) tabs after the lazy tab load. After login, it blocks all requests except GET and HEAD, including tab-loading POST requests. It records blocked stages without field values. This is a safeguard of the test runner. It is not a network firewall in the deployed extension. A blocked tab is not a pass. See the [live smoke instructions](../e2e/README.md#live-random-sample-smoke-test).

Building the shared JavaScript for Safari does not prove that Autofill, document binding, or exact `documentId` behaviour works on Safari.

---

## Current limitations

- Not every university is mapped. Unmapped sites get generic matching of common fields only.
- [../PORTALS.md](../PORTALS.md) lists the live CRM-to-portal results for each portal. A portal with no recorded run has only been tested on synthetic fixtures.
- Exact-document Autofill needs `documentId` from `webNavigation.getAllFrames`. A browser without it fails closed for the Autofill and Attach flows that use `selectedPageFrames`.
- The extension fills the top document and same-origin frames only.
- The extension never selects Save, Next, Submit, pay, or declaration controls. A portal handler can still react to filled values or attached files.
- Nobody has tested the extension in an installed Safari. See [../e2e/safari/README.md](../e2e/safari/README.md).
- For new test coverage, prefer E2E with sanitized fixtures over unit tests.

---

## How to add a mapped university

The recipe below uses invented example names and selectors. Replace them with real values from an authorised inventory. The selectors are not a verified mapping.

### 1. Make an inventory, one page at a time

Use an authorised portal account. Open one form step. Record the exact origin, the path, the control IDs or names, the labels, and the CRM canonical keys that apply. Prefer existing keys from `config/crm-source.js` and from the mapped portals. Add a CRM label alias only after you have seen the real CRM text.

### 2. Create `config/portals/example.js`

The structure matches the current portals. The values are invented.

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

The engine supports these properties: `id`, `name`, `origins`, `pageMatchers`, `selectorOverrides`, `phoneKeepsDialPrefix`, `extraSynonyms`, `valueMaps`, `splitDates`, and `blockedControls`. The engine ignores other keys. Use `valueMaps` for reviewed translations from a CRM value to a portal option. The object keys must match the output of the engine's `normalize` function. Each value must be an array of exact option labels. A source value that the map does not support stays manual. See [Derived values and portal option maps](#derived-values-and-portal-option-maps) and the Greenwich config.

The example lists the split-date selectors in `blockedControls`. This keeps them out of the normal matcher. `fillSplitDates` fills those selects separately. Use selectors that match only the intended date on the intended page. Add a `form` condition when a portal keeps the URL of the previous step after a save. Check that the selected controls are visible, editable date selects. Do not use a selector that also matches an employer date or a referee date.

Use a stable, unique `id`. Use exact origins only (scheme, host, and optional port). Do not put paths in origin strings. Never add `<all_urls>` or a parent-domain wildcard.

### 3. Register the file in `PORTAL_FILES` in `popup.js`

The build copies the whole `config/` tree. At run time, the explicit `PORTAL_FILES` list in `popup.js` decides which portal files load for a fill. Add your file **before** `src/engine/engine.js`:

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

A new file in `config/portals/` does not load by itself.

### 4. Add the origin to `portalOrigins` in `config/allowlist.js`

Edit `portalOrigins` inside the existing `SAMS_ALLOWLIST_CONFIG`. Do not change its other properties. The code below shows the portal list only. It is not a replacement for the whole configuration.

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

The build creates `host_permissions` from this list. It adds the CRM, Campora, and development origins, depending on the mode. Use exact origins only.

### 5. Choose shared or portal synonyms

- Put vocabulary that all portals share in `config/synonyms.js`.
- Put label phrases for one portal in `extraSynonyms` of that portal.
- Put dangerous or ambiguous controls in `blockedControls`.

### 6. Test on the real portal

1. Run `npm run build`. Load or reload `dist/chrome`. Reload the tested page.
2. Copy a test student from the CRM. Do not save or submit the portal application during the checks.
3. Autofill one page. Check that existing values stay, that blocked controls stay manual, and that a second Autofill does not duplicate rows (where this matters).
4. In an E2E test or in a developer inspection of the frame response, check that `report.mapping` equals the name of your mapping when the origin and `pageMatchers` match. The staff popup does not show this name. A page outside the matchers must return `mapping: null` and use generic behaviour.
5. Test Clear and the expiry.
6. Test Attach only with safe synthetic fixtures where possible. A real Attach can upload at once because of portal `change` handlers.

### 7. Record the result

Update [../PORTALS.md](../PORTALS.md) with the filled, skipped, no-value, and manual fields. Keep sanitized HTML fixtures free of personal data, credentials, tokens, and application IDs. Add E2E coverage in `e2e/extension.e2e.mjs` with a sanitized fixture under `e2e/fixtures/`. See [../e2e/README.md](../e2e/README.md).

---

## Testing guidance

When you change a mapping:

1. Write E2E tests first. Use sanitized fixtures and no real credentials.
2. Cover a real Copy followed by Autofill, with no saves.
3. Check these points: existing values stay, blocked and manual fields stay unchanged, repeats do not cause harmful duplicates, mapped and generic modes start correctly, Clear and expiry work, and Attach works only on safe fixtures.
4. Keep `npm test` as a supporting check. Prefer E2E for new coverage.

The Safari checklist is in [../e2e/safari/README.md](../e2e/safari/README.md).

The table below links each security claim to its code and its tests:

| Claim | Code | Tests |
|---|---|---|
| One validated cache with expiry and serialized Clear | `src/background.js`, `config/allowlist.js` | `test/session-lifecycle.test.js`; loaded-extension Clear and expiry cases |
| Copy stores metadata, never file bytes or listing tokens | `src/crm-documents.js`, `src/background.js` | E2E metadata filtering and the nine-group authenticated listing cases |
| Only an explicit Attach fetches and assigns the chosen file | `popup.js`, `src/crm-documents.js`, `src/portal-fill.js` | E2E exact PDF and JPEG bytes, target-frame selection, occupied inputs, redirect and HTML rejection |
| Ordinary Autofill does not attach files | `src/engine/engine.js`, `src/portal-fill.js` | E2E ordinary-Autofill file-input case |
| Derived fields keep the CRM cache and existing portal values | `src/engine/engine.js`, portal configs | E2E portal mapping cases A to E |

These tests do not verify employee revocation, media-server authorisation, device encryption, portal retention, or secure erasure. The system owners must verify those with approved operational checks, as described above.

---

## Code examples

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
