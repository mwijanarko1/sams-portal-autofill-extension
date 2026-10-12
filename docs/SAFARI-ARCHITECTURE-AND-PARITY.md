# Safari architecture and Chrome parity plan

Status: architecture and implementation roadmap; a macOS development build exists, but installed Safari runtime acceptance is pending.

Implementation status (2026-10-12): a macOS app/extension project, shared Safari build, cache/message/frame hardening, and regression tests now exist. Not every proposed section 8.2 improvement is implemented. See [safari/README.md](../safari/README.md). Safari runtime parity is unverified; see the [Safari acceptance checklist](../e2e/safari/README.md).

Baseline inspected: Chrome extension `0.1.0`, commit `1b774cb`, on 2026-10-12. This document describes the source at that point, not every feature mentioned in historical project notes.

## Contents

- [Recommendation and decisions](#1-executive-recommendation)
- [Current Chrome architecture](#2-chrome-baseline-what-actually-exists)
- [Target Safari architecture](#3-target-architecture)
- [Data contracts and flows](#4-data-contracts-and-end-to-end-flows)
- [Manifest and API compatibility](#5-manifest-and-api-compatibility)
- [Feature-parity matrix](#6-feature-parity-matrix)
- [Safari UX and website access](#7-safari-specific-ux-and-website-access)
- [Safety, privacy and existing gaps](#8-safety-and-privacy-release-invariants-and-existing-gaps)
- [Build and resource ownership](#9-build-and-resource-ownership)
- [Installation, signing and distribution](#10-installation-signing-and-distribution)
- [Tests and acceptance](#11-test-and-acceptance-architecture)
- [Implementation phases](#12-sequenced-implementation-plan-and-gates)
- [Optional iPhone/iPad support](#13-optional-iphone-and-ipad-delta)
- [Risks and dependencies](#14-risks-and-dependencies)
- [Evidence and references](#15-evidence-toolchain-and-references)

## 1. Executive recommendation

Ship a **Safari Web Extension using the existing Manifest V3 JavaScript extension**, packaged in a minimal Apple containing app. Keep the CRM reader, autofill engine, portal configuration, popup, and safety rules shared with Chrome. Do not rewrite the autofill system in Swift or build a Safari App Extension.

Use local Safari and Xcode for the compatibility spike and signed-app verification. Apple's current tool is `safari-web-extension-packager`, formerly `safari-web-extension-converter`. App Store Connect also offers web-based packaging, but that does not replace testing in Safari. [A1, A2]

Working release assumption: **macOS first**. iPhone and iPad support is a separate scope decision, with its architectural differences documented in section 13. Neither the supported OS floor nor the distribution channel has been approved yet.

The essential acceptance condition is behavioral parity: the same synthetic student, portal page, mappings, and prefilled controls must produce the same field values and safety outcomes in Chrome and Safari. Identical browser chrome or installation steps are not required.

### Decisions still owned by SAMS

| Decision | Recommendation | Required before |
|---|---|---|
| Apple platforms | macOS first; evaluate iPad separately | Creating release targets |
| Supported Safari and macOS versions | Agree the staff device inventory; Safari 16.4 is the storage/API floor, not a tested support promise | Deployment targets and test matrix |
| Distribution | Developer ID signed and notarized macOS app for a controlled staff rollout; App Store if managed updates/store delivery are preferred | Release packaging |
| Developer account ownership | SAMS-owned Apple Developer team, identifiers, signing access, and distribution account | Signing or external uploads |
| Portal scope | Preserve the existing production gate unless a narrower release is explicitly approved | Any production package |
| Private browsing | Recommend refusing Copy/Autofill initially; do not assume profile isolation | Compatibility implementation |
| Acceptance owner | Named SAMS tester approves the supported workflows and manual exclusions | Release |

These are decision gates, not permission to enroll accounts, change production policy, publish, or start authenticated testing.

## 2. Chrome baseline: what actually exists

### 2.1 Component ownership

All paths in this document are relative to the extension repository.

| Current file | Responsibility | Safari treatment |
|---|---|---|
| `manifest.json` | MV3 identity, toolbar popup, worker, permissions and hosts | Shared base; produce a Safari manifest only where required |
| `popup.html`, `popup.js` | Copy, Clear, Autofill, cached-student card, countdown, result lists | Reuse; verify native Safari popover and permission errors |
| `src/background.js` | Session cache, expiry timestamp, activity extension, cleanup alarm | Reuse; verify suspension and restart behavior |
| `src/crm-reader.js` | Profile guards, expand CRM sections, read labelled DOM data | Reuse; test real WebKit layouts and asynchronous panels |
| `config/crm-source.js` | Exact labels and canonical field keys, allowed CRM profile paths | Shared, no Safari fork |
| `config/allowlist.js` | Exact CRM and portal origins, dev/prod distinction, 30-minute retention | Single source for both browsers |
| `src/portal-fill.js` | Origin-guarded page message handler and result serialization | Reuse; verify targeted frame messaging |
| `src/engine/engine.js` | Field scanning, matching, safe DOM setters, section context, split dates | Shared engine; isolate any proven browser-specific differences |
| `config/synonyms.js` | Shared field-name vocabulary | Shared |
| `config/portals/greenwich.js` | Greenwich selectors, page-specific dates and blocked controls | Shared |
| `config/portals/bangor.js` | Bangor selectors, page-specific dates and blocked controls | Shared |
| `config/portals/manchester.js` | Greater Manchester placeholder with no origins or selectors | Remains unavailable |
| `scripts/build.mjs` | Dev/prod resource copy, host generation, Chrome ZIP | Refactor narrowly to support independent browser outputs |
| `test/` | Node tests and Chromium DOM tests | Keep; add Safari-specific regression coverage |
| `e2e/extension.e2e.mjs` | Loaded Chromium extension with synthetic HTTPS fixtures | Retain as Chrome regression; create a separate Safari harness |
| `e2e/live.mjs` | Explicit opt-in no-save Chromium live smoke | Not a Safari runner |

### 2.2 Current origins and unavailable integrations

| Integration | Exact production origin | Current evidence |
|---|---|---|
| SAMS CRM | `https://app.samscrm.co.uk` | Reader, agent/full-profile path guards, fixture tests |
| Campora | None configured | `camporaOrigins` is empty; no parity promise |
| University of Greenwich | `https://nelson.gre.ac.uk` | Portal config, fixtures, regression coverage |
| Bangor University | `https://apps.bangor.ac.uk` | Portal config, fixtures, regression coverage |
| University of Greater Manchester | None configured | Empty portal placeholder; access and mapping required |

Development adds `http://localhost:3000` for CRM and `http://localhost:3001` plus `http://127.0.0.1:3001` for portal fixtures. Production must exclude these.

The production build currently rejects an empty Campora list or fewer than three portal origins. This blocks production packaging today. Matching Chrome's two configured portals is not sufficient to bypass that gate. Confirm the missing integrations, or obtain approval for a separately documented scope/gate change. The existing check counts origins; it does not by itself prove three working portal integrations.

### 2.3 Source versus older documentation

The source now has `splitDates` mappings and `fillSplitDates()` support. Dedicated tests cover Greenwich DOB, Greenwich employment dates, Bangor education dates, and preserving an existing date selection. Older comments and guides still describe split-date controls as blocked. Generic scanning continues to block these controls; the explicit page-scoped split-date path handles them separately.

The repository contains synthetic fixtures in `e2e/fixtures/` and CRM HTML under `test/fixtures/`. Older notes describing no fixtures or a 16-test baseline are historical, not the current test inventory. Navigation for the whole repo is in [CODEBASE_MAP.md](CODEBASE_MAP.md).

Do not infer live acceptance from docs alone. Verification snapshot on 2026-10-12: `npm test` **61/61**; Chromium `npm run test:e2e` documented 5/5 when Helium is available. Production packaging, authenticated CRM-to-portal journeys, and installed Safari runtime acceptance remain open.

## 3. Target architecture

```text
One version-controlled JavaScript source
  |
  +-- shared configuration, CRM reader, engine, popup, worker
  |
  +-- Chrome build --> dist/chrome --> Chrome distribution ZIP
  |
  +-- Safari build --> dist/safari-webextension
                         |
                         +-- local temporary Safari install, where available
                         |
                         +-- Xcode packaging project
                               |
                               +-- containing macOS app
                               +-- embedded Safari Web Extension target
                                      |
                                      +-- popup: operator commands/results
                                      +-- worker: ephemeral student cache
                                      +-- CRM content script: profile DOM only
                                      +-- portal content scripts: approved frames
```

### 3.1 Runtime boundaries

1. **Containing app:** installs/registers the extension and explains enablement, website permissions, support, and privacy. It does not handle student records.
2. **Safari extension target:** bundles the web resources and Safari extension registration metadata. Generated native handler code is packaging infrastructure, not an autofill backend.
3. **Popup:** validates the active tab, handles explicit staff actions, injects scripts, displays the currently copied student and outcome lists.
4. **Background worker:** owns the single student cache and expiry policy. Listeners register synchronously at startup; state lives in `storage.session`, not worker globals.
5. **CRM content script:** reads the approved profile and returns a serializable profile. It can open profile sections, but cannot save CRM forms.
6. **Portal content script:** receives data only in an approved frame, validates its own origin, fills eligible empty fields, returns a serializable report.

No server, native messaging, App Group, Keychain student cache, database, AI service, clipboard pipeline, or cross-browser synchronization is needed. Chrome and Safari caches are independent. Switching browsers requires Copy again in that browser.

Do not route student fields through Swift, logs, analytics, crash attachments, or support uploads. No broad entitlement or native host permission should be added to work around a WebExtension incompatibility.

### 3.2 Shared code and browser-specific code

Safari supports both `chrome.*` and `browser.*`, including callback and Promise forms. The current `chrome.*` calls therefore do not require an automatic namespace rewrite or a polyfill. Start with the existing source. [A3]

If the compatibility spike demonstrates a necessary difference, add the smallest shared helper at the relevant boundary. Possible helper responsibilities are API feature detection, host-permission error normalization, and optional closed-shadow-root access. Do not introduce a general browser abstraction framework without evidence that it is needed.

Keep selectors and mappings browser-neutral. A browser-specific selector must have a reproducible WebKit DOM difference and a regression fixture. Prefer fixing a shared DOM assumption rather than maintaining two portal configurations.

### 3.3 Proposed additional files

This is the original proposed layout, not an inventory of current files. See [safari/README.md](../safari/README.md) for the implemented project layout and commands.

```text
scripts/
  build.mjs                    extend existing build with browser target
  package-safari.mjs           optional repeatable local packaging helper
safari/
  README.md                    signing, resource sync, build/release procedure
  <generated project>.xcodeproj
  <containing-app sources>     onboarding and extension enablement only
  <extension target sources>  generated Safari handler and target metadata
e2e/
  safari/                      actual Safari install/permission/runtime checks
test/
  safari-build.test.js         manifest/resource and production-host assertions
  session-lifecycle.test.js    shared expiry, Clear and stale-popup regressions
dist/
  chrome/                     generated, ignored
  safari-webextension/        generated, ignored
  safari-app/                 generated archives/artifacts, ignored
```

Retain the existing CommonJS Node-test and plain-script conventions. Introducing TypeScript, a bundler, or a framework is not required for this port.

## 4. Data contracts and end-to-end flows

### 4.1 Student profile and cache

The current reader returns:

```text
profile = {
  studentId: string,
  studentName: string,
  sourceOrigin: exact approved CRM origin,
  copiedAt: epoch milliseconds,
  fields: record of canonical field keys and string values
}

cache = {
  ...profile,
  lastActivityAt: epoch milliseconds,
  expiresAt: epoch milliseconds
}
```

`studentId` falls back to the profile path's final segment. `studentName` is built from given/family names. A missing name or fewer than two mapped fields rejects Copy.

Representative canonical groups include identity/contact, education and study dates, course/intake/route/funding, passport, English test scores, visa details, employment, and emergency contacts. `config/crm-source.js` and the reader's contextual mapping remain authoritative. A key supported by the engine or a selector is not proof that the CRM reader supplies it, or that every portal accepts it.

Only one student is cached. Copying another student replaces the previous cache. The popup must visibly identify the new student before staff use Autofill. Student fields are personal data even when no server receives them.

### 4.2 Existing message protocol

| Receiver | Action | Payload | Response |
|---|---|---|---|
| CRM content script | `copyCrmProfile` | No student payload | `{ profile }` or `{ error }` |
| Worker | `cacheStudent` | `profile` | `{ cache }` or `{ error }` |
| Worker | `getStudentCache` | None | `{ cache }`, possibly `null` |
| Worker | `touchStudentCache` | None | `{ cache }`, possibly `null` |
| Worker | `clearStudentCache` | None | `{ cleared: true }` |
| Portal content script | `ping` | None | `{ pong, version }` |
| Portal content script | `scan` | Optional `lean`, `mode`, `fieldMap` | Serializable descriptors/count or `{ error }` |
| Portal content script | `autofill` | `fieldMap` | Fill report or `{ error }` |

Preserve these contracts unless a tested change is necessary. `ping`/`scan` are implementation capabilities, not additional popup features. DOM elements cannot cross the message boundary.

Existing handlers use `sendResponse` and return `true` for asynchronous replies. Test this exact pattern in Safari, including CRM panels that take several seconds to settle. Distinguish an absent receiver, a closed popup, a permission denial, and a portal validation error.

### 4.3 Copy flow

1. Staff open an approved CRM profile and choose Copy.
2. Query the actual active tab and validate its exact origin.
3. Inject, in order: build mode, allowlist, CRM mapping, reader. Target frame `0` only.
4. Reader checks origin, accepted profile path, and profile-page markers.
5. Reader expands known sections and extracts labelled, contextual values, including selected list/form values and derived year/name parts.
6. Reader returns the profile to the popup; popup requests worker caching.
7. Worker replaces `studentCache` in session storage, sets expiry to now plus 30 minutes, and schedules `expire-student-cache`.
8. Popup displays student identity, copied time, countdown, and field count.

Do not treat Copy as an OS clipboard action. If the popup closes before the response is cached, do not claim that Copy succeeded. Test cancellation and consider moving only the operation orchestration to the worker if Safari popup lifetime causes reproducible failures.

### 4.4 Target Autofill flow

This retains the existing flow but includes the proposed freshness and failure-reporting hardening called out in section 8.2. Those changes are not implemented in the Chrome baseline.

1. Staff manually open the desired application step and choose Autofill.
2. Revalidate current cache availability and expiry immediately before transmitting fields. The current popup-held cache alone is not an authoritative freshness check.
3. Query the active tab and validate its exact portal origin.
4. Enumerate frames using `webNavigation.getAllFrames`; keep only frames whose **own URL origin** is approved.
5. Inject build mode, allowlist, synonyms, all three portal config files, engine, then portal handler into those frame IDs.
6. Send each approved frame the canonical field map using `tabs.sendMessage(..., { frameId })`.
7. Handler rechecks its current origin, scans eligible controls and uses the shared engine.
8. Engine preserves existing values, applies section-specific rules and split dates, and returns results.
9. Popup merges reports and displays Filled, Skipped existing, No CRM value, Unmatched CRM fields, and Manual review.
10. Extend cache expiry only for a valid, completed Autofill operation. A missing/expired cache returned by the worker must not resurrect stale popup data.

An approved top-level tab does not authorize a third-party child frame. Reject `about:blank`, `srcdoc`, opaque/sandboxed origins, and unknown frames rather than inheriting the parent's permission. Recheck after navigation; do not replace targeted injection with `allFrames: true`.

If one frame fails, show which frame failed using an origin-safe identifier and retain successful counts. Do not present an unqualified complete-success message when only some frames were processed. Current code can hide per-frame errors or stop on a rejected `Promise.all`; this needs explicit regression coverage.

### 4.5 Clear and expiry

Clear removes session cache, clears the alarm, empties popup memory, hides identity, and disables Autofill. It does **not** erase fields already filled into a portal; staff remain responsible for the visible draft.

Reads compare `expiresAt` with the current time and remove expired data. Alarms provide cleanup but must not be the sole enforcement mechanism: sleep, suspension, and popup timers can delay delivery. Browser quit/relaunch, extension disable/re-enable, reload, and update must be tested for cache removal on every supported Safari version.

Changing pages does not prolong retention. Do not persist data to `local`, `sync`, native files, preferences, or Keychain to survive browser restarts.

### 4.6 Engine pipeline to preserve

`src/engine/engine.js` is the shared matching implementation, not a collection of Safari-specific selectors. Preserve its phases and their safety boundaries:

1. Detect the applicable portal from exact origin/page matchers; apply its selector overrides, extra synonyms, section restrictions and blocked controls.
2. Scan form controls and accessible shadow trees; collect labels, identifiers, autocomplete hints, required/type metadata and section context. Reinjection must not duplicate portal registration or message handlers.
3. Prepare synonyms and field-match metadata, then rank candidates for each supplied canonical CRM key. Exact portal overrides outrank generic label signals; missing values are not synthesized.
4. Preserve occupied controls, reject ineligible targets and constrain multi-fill behavior. Applicant residence/contact keys must not drift into institution, referee or scholarship sections.
5. Normalize values for the control type, match native select/radio options or the appropriate visible custom listbox, and use DOM setters/events. A visible value alone does not prove a page framework accepted the update.
6. Report filled, skipped-existing, skipped-empty/select, unmatched, no-CRM-value and manual-review outcomes. The popup displays a subset/merge of those categories.
7. Run the explicit page-scoped split-date path separately from generic scanning; preserve components already chosen by staff.

Do not loosen match thresholds, remove blocked selectors or expand fuzzy option selection just to make a WebKit test pass. Custom listbox code has fallback searches beyond directly associated options, so include unrelated visible-listbox negative fixtures rather than assuming scope safety from the helper's name. Date normalization, country/qualification aliases, phone formatting and safe native event delivery need the same expected values on both browsers.

Unlike the CRM profile guard, `src/portal-fill.js` checks the portal origin but does not enforce a mandatory application-path guard. Portal page matchers select configuration, not a universal refusal on other page types. Test login, account/settings and non-application forms on an approved portal origin; decide whether a shared per-portal page guard is needed rather than claiming it already exists.

## 5. Manifest and API compatibility

### 5.1 Manifest policy

Preserve Manifest V3, the toolbar `action.default_popup`, and the classic `background.service_worker` using `importScripts`. Safari supports MV3 and background service workers from 15.4; `storage.session` raises this project's API floor to 16.4. [A3, M1, M5]

Keep the current permissions: `activeTab`, `scripting`, `storage`, `alarms`, and `webNavigation`. Generate exact `host_permissions` from the same allowlist for both browsers. Do not add `tabs`, `nativeMessaging`, `unlimitedStorage`, `<all_urls>`, blanket content scripts, or web-accessible resources without a demonstrated requirement and review.

Do not add `background.type: "module"` while the worker uses `importScripts`. Do not ship an MV2/persistent-background fallback to support older Safari. Missing session storage must disable Copy/Autofill with an unsupported-version message, not silently switch to persistent storage.

The packager reports unsupported manifest keys. Capture and classify every warning during the spike. Warning-free packaging is not proof of runtime parity. Safari app updates are distributed through the selected Apple app channel, not the Chrome Web Store or a Chrome `update_url`. [A1, A3]

### 5.2 API inventory

| API used today | Safari evidence | Required verification |
|---|---|---|
| `tabs.query({ active: true, currentWindow: true })` | Safari tabs require host permission [A3] | Real toolbar popup, multiple windows, missing URL/id, permission revoked |
| `scripting.executeScript({ target: { tabId, frameIds }, files })` | Safari supports script injection; current call does not use unsupported `injectImmediately` [A3, M2] | File ordering, isolated-world globals, reinjection and targeted child frames |
| `tabs.sendMessage(..., { frameId })` | WebExtension messaging supported [A3] | Correct frame receives data; absent/navigated frame returns a useful error |
| `runtime.sendMessage`, `runtime.onMessage` | Safari support recorded from 14 [M6] | Async response lifetime, thrown/rejected calls and serializable objects |
| `storage.session.get/set/remove` | Safari support from 16.4 [A3, M1] | Survives worker suspension, not browser restart; no content-script access expansion |
| `alarms.create/clear/onAlarm` | Safari support from 14 [M3] | Cleanup after sleep/wake and rescheduling; timestamp check remains authoritative |
| `webNavigation.getAllFrames` | Safari macOS support from 14, iOS from 15 [M4] | Frame URLs/IDs available under granted hosts, cross-origin rejection |
| `chrome.dom.openOrClosedShadowRoot` | Optional engine helper; Safari support recorded from 26 [M7] | Feature detection, any required permission, actual namespace availability and DOM access |
| DOM selectors, events and native value setters | Shared engine, not extension API parity alone | WebKit dates/selects, page-framework reaction, shadow roots and popup focus |

The optional closed-shadow-root helper already returns `null` when the API is absent. Below Safari 26, closed-shadow-only controls cannot be promised parity through that helper. Open shadow roots can still be scanned. Current approved portals do not establish a closed-shadow requirement; historical Ulster/Salesforce notes do not make that portal supported. Even on newer Safari, verify the helper and permission setup rather than assuming the Chrome call works unchanged.

API support tables are evidence for a spike, not an acceptance test. They also do not define the minimum supported macOS version. Test the approved Safari/OS combinations explicitly, including the oldest release to be advertised.

## 6. Feature-parity matrix

Legend: **Required** means the Safari release must reproduce the current Chrome behavior. **Conditional** means parity depends on supplied CRM data, portal scope, or a browser capability. All Safari runtime entries below are unverified.

| Feature | Chrome baseline | Safari requirement | Evidence to collect |
|---|---|---|---|
| Toolbar popup | Copy, Clear, Autofill, identity/countdown, result lists | Required | Native popover, keyboard, long lists, resizing and focus |
| CRM profile guard | Exact origin, profile path and marker checks | Required | Profile accepted; login/list/dashboard/settings rejected |
| Expanded CRM extraction | Label/value, forms, lists, contact context, panel settling | Required | Same canonical fields from all three CRM fixtures |
| Single student replacement | Copy overwrites cache | Required | Copy A then B, only B fills |
| Ephemeral cache | `storage.session`, 30-minute activity expiry | Required | Suspension, timestamp expiry, Clear, browser restart, update |
| Exact hosts and dev/prod separation | Allowlist at popup and page boundary | Required | No localhost in prod, no wildcard, denied hosts stay untouched |
| Approved frames only | Frame URL filtering and targeted injection/messaging | Required | Same-origin child, approved cross-origin child, denied child, navigation race |
| Text/email/tel/textarea | Eligible empty controls, section-aware matching | Required | Same resulting values and unchanged prefilled controls |
| Native select/radio | Matched options and eligible radio groups | Required | Same choice; no unrelated option, keyboard/page events work |
| Custom combobox/listbox | Scoped option matching with click guard | Conditional on actual page DOM | Controlled WebKit fixture; no navigation or irreversible control clicks |
| Date input | Shared normalization to ISO values | Required where Chrome maps it | Safari value and validation agree with expected date |
| Explicit split dates | Page-scoped Greenwich/Bangor configs | Required | Correct date by section; preselected components preserved |
| Phones | Portal-specific dial-prefix preservation | Required | UK/non-UK examples and maxlength reporting |
| Address context | Applicant residence does not fill institution/referee context | Required | Education and referee negative fixtures |
| Qualification limits | Greenwich qualification row 1 only | Required | No rows 2-20 on first or repeat fill |
| Repeat Autofill | Existing values preserved, no duplicate mappings | Required | Same second-click values and event counts |
| Result reporting | Filled/existing/missing/unmatched/manual categories | Required | Equivalent outcomes; partial frame failures visible |
| Reinjection | Reader/handler guards, portal configs do not duplicate | Required | Reload/inject/fill repeatedly without duplicate listeners |
| Open shadow DOM | Shared scanning capability | Conditional on portal use | Representative fixture in real Safari |
| Closed shadow DOM | Optional Chrome API helper | Conditional on Safari version/API | No invented workaround; unsupported controls stay manual |
| Bangor Programme | Selector mapping incomplete; workflow may require saved Personal | Not a release parity claim yet | Confirmed draft/access and a separately approved inventory |
| Campora/Greater Manchester | Not configured | Not included by pretending Chrome supports them | Access, exact origin, mapping, fixtures, supervised acceptance |
| Files/checkboxes/auth/declarations | Manual/blocked | Required safety parity | No writes, clicks, uploads or agreement changes |
| Submit/save/pay/next/continue | Never clicked by extension | Required safety parity | Negative action/event assertions |
| Cross-browser transfer | Not implemented | Not requested | Safari starts with an independent empty cache |

Missing CRM values remain missing. Safari must not fabricate country of birth, ethnicity, previous name, course, dates, funding, referee details, or other application answers to increase fill counts.

## 7. Safari-specific UX and website access

Safari has a second access gate beyond the manifest allowlist: users can grant, ask, or deny website access. The popup must distinguish an unsupported origin from an approved origin lacking Safari permission. Granted website access does not expand the application's exact-origin policy. [A4]

Use existing toolbar interaction and Safari permission UI first. Explain how to allow the exact CRM or portal website. If runtime permission requests prove necessary, request the specific approved host from an explicit user gesture, not all websites. Catch failures at both injection and messaging boundaries; do not infer granted access from the manifest alone.

Required UX states:

- No copied student: Autofill disabled; Copy instructions visible.
- Unsupported Safari capability/version: Copy and Autofill disabled; supported-version guidance.
- Approved website with Ask/Deny: actionable website-access instructions, no scan or payload delivery.
- Wrong website, login page, missing tab URL or no active tab: safe error without reading or filling.
- Valid student: name, copied time, expiry, and Clear visible; never silently select another student.
- Expired or cleared student: identity removed and Copy required again.
- Partial fill/frame error: successful counts plus a warning; staff review before navigating.

Test the actual native popover, not only `popup.html` opened as an extension tab. Verify scrollable result lists, text zoom, VoiceOver/keyboard labels, disabled states, status announcements, and focus returning to the form. Preserve local assets and script-only event handlers; do not load remote scripts or fonts.

Safari 17+ can share granted website access across profiles and private browsing. That is **permission behavior**, not proof of student-cache isolation. [A4] Test multiple profiles/windows explicitly. Recommend a private-browsing refusal for the first release, pending approval. Do not claim that private windows provide a separate secure cache unless observed on every supported configuration.

## 8. Safety and privacy: release invariants and existing gaps

### 8.1 Invariants

1. Only approved exact origins can read or receive student data; child frames must qualify independently.
2. Copy only reads the approved student profile. CRM section expansion must not save or submit.
3. Only eligible empty portal controls are written. Existing operator/application values remain untouched.
4. No authentication, payment, file upload, declaration, signature, consent, or navigation control is completed automatically.
5. No clicks on Submit, Save, Pay, Send, Delete, Confirm, Declare, Agree, Next, Continue, or equivalent irreversible controls.
6. Cache expires after 30 minutes of inactivity, is revalidated before use, and is not persisted or synced.
7. Clear and cache loss cannot restore stale data from another popup or retained variable.
8. Production artifacts contain no localhost hosts, test credentials, personal fixtures, logs, `.env` files, source CRM snapshots, or development-only resources.
9. Reports and support artifacts contain synthetic identifiers, field keys, counts and error categories, not real field values or authenticated URLs/tokens.
10. Staff manually review the draft and perform any saving/submission themselves.

### 8.2 Shared hardening to evaluate before shipping

These are observed Chrome-source limitations, not verified Safari defects. Addressing them changes shared behavior and requires targeted tests in both browsers. This document does not implement them.

| Source observation | Risk | Proposed acceptance rule |
|---|---|---|
| `autofill()` sends `cache.fields` held in popup memory before a fresh worker read | Expired or cleared data can be used while a popup has stale state | Revalidate before dispatch; test expired cache and Clear from another popup |
| `cache = touched.cache || cache` after Autofill | A `null` worker result can retain an invalid student in UI memory | `null` means clear/disable, never fall back to the old cache |
| Worker ignores `_sender` and accepts profile shape without validation | Privileged data actions lack an explicit sender/schema boundary | Reject unauthorized action sources and malformed/unapproved profiles; do not clear a valid cache on a rejected message |
| Portal handler gates by origin, not a mandatory application-page guard | Other forms on an approved host can reach generic matching | Negative-test non-application pages and add a narrow shared page guard if needed |
| Parallel frame handling uses `Promise.all`; individual errors can be omitted from the final display | One failure aborts reporting or produces misleading partial success | Collect frame outcomes and visibly distinguish partial failure |
| Engine reports include truncated filled values and existing values | Dumping reports into logs/support tools could disclose personal data | Keep values out of persistent diagnostics and external reports |

For the current protocol, cache actions originate in the extension popup. Validate the extension identity and expected extension-page sender URL, not a caller-supplied origin string. Validate profile keys/types, approved `sourceOrigin` and sensible size limits. Content-script responses remain tied to the requested tab/frame; no external messaging surface or native bridge is needed.

If operation tokens or background-owned dispatch are needed to avoid a Clear/Copy race, keep that mechanism narrowly scoped. Do not introduce a job service just for this port. Test Copy B or Clear during an in-flight fill and refuse any subsequent sends using A's invalidated cache. Values already written cannot be recalled automatically.

**Important boundary:** not clicking Save does not guarantee the website makes no write requests. DOM changes can trigger portal autosave or analytics. The extension currently does not block requests. The supervised no-save test harness must detect/block unexpected writes and stop; do not advertise the extension as a network write blocker. Unexpected portal autosave is an acceptance blocker until SAMS approves the workflow implications.

Session cache cleanup removes extension-controlled storage. It cannot guarantee memory forensic erasure, delete original CRM data, or erase visible portal values. Privacy disclosures must describe the actual local processing rather than promise zero personal-data handling.

## 9. Build and resource ownership

### 9.1 Build changes

**Implemented.** `scripts/build.mjs` takes `dev|prod` and optional `chrome|safari`. Each target deletes only its own owned paths (`dist/chrome` + zips, or `dist/safari-webextension`). A Chrome build does not wipe Safari output.

The checked-in `manifest.json` does not include Greenwich or Bangor host permissions; the build generates them from `config/allowlist.js`. Package the generated, validated resources, not a raw copy of the repository root.

Current build contract:

- `npm run build` / `npm run build:prod` remain Chrome commands.
- `npm run build:safari` / `npm run build:safari:prod` write `dist/safari-webextension`.
- `npm run build:safari:app` runs `scripts/package-safari.mjs` (unsigned Xcode Debug build + embedded resource hash check into `dist/safari-app`).
- Shared resource copy, version validation, exact-host generation, and incomplete-production-origin rejection apply to both targets.
- Generated files under `dist/` are never edited as source.
- App/extension `MARKETING_VERSION` stays aligned with `package.json` / `manifest.json` (`0.1.0`); Apple build numbers can move independently when signing is introduced.

### 9.2 Xcode resource strategy

Create the native project once, commit its source/project metadata, and keep its web resources synchronized from the generated Safari output. The packager references input resources by default. A stable project-relative reference to `dist/safari-webextension` avoids a second editable copy, but CI must generate that directory before Xcode builds. Verify all target resource memberships and archive contents. [A1]

If references are unsuitable for the approved CI/build layout, use an explicit build-time copy and verify hashes. Do not manually maintain a second JavaScript tree. `--copy-resources` creates a snapshot; subsequent source edits do not automatically update that snapshot.

Packaging sketch, not an instruction to execute now:

```sh
# Run from the repository after building the Safari resources.
# Replace the example identifier with a SAMS-approved registered identifier.
xcrun safari-web-extension-packager 'dist/safari-webextension' \
  --project-location 'safari' \
  --app-name 'SAMS Portal Autofill' \
  --bundle-identifier 'com.example.sams.portalautofill' \
  --swift --macos-only --no-open
```

`com.example.sams.portalautofill` is an illustrative placeholder, not an identifier to register. Confirm generated target names, schemes, extension identifier, Info.plist settings, entitlements and provisioning before writing build/archive commands. Avoid `--force` and routine project regeneration that could overwrite native customizations.

## 10. Installation, signing and distribution

### 10.1 Local development

Current Apple documentation supports temporary installation of a web-extension folder/ZIP in macOS Safari where that UI is available. Safari removes temporary extensions after 24 hours or on quit. This is a fast compatibility path, not a distribution artifact or a test of the final signed containing app. Older supported versions may require the Xcode route. [A5]

For Xcode testing, build/run the containing app, enable the extension, and grant access only to the fixture/approved sites. Unsigned-extension testing requires a developer setting and may reset after Safari quits. The operator must approve this setting; do not alter normal staff-browser settings or weaken release requirements.

Use a dedicated test environment/profile. A synthetic local HTTP test does not prove injection into the production HTTPS origin. The final acceptance run includes the packaged extension and actual toolbar popup.

### 10.2 Distribution choices

| Channel | Requirements | Trade-offs |
|---|---|---|
| Developer ID app outside Mac App Store | SAMS Developer team, identifiers, signing, notarization, controlled app delivery | Suitable for staff-only macOS; update delivery must be owned/documented |
| Mac App Store | SAMS Developer/App Store Connect account, signed archive, review assets, privacy disclosures, review | Managed store updates; review timing and reviewer access need planning |
| TestFlight | App Store Connect build and approved beta setup | Beta testing, not a permanent production rollout |
| Unsigned/temporary local install | Developer settings | Development only; not a staff deployment strategy |

Developer ID signing/notarization outside the Mac App Store is supported by Apple. Chrome force-install policy cannot be reused as Safari deployment policy. If SAMS uses MDM, confirm device management and extension enablement/website-access controls with its administrator instead of promising silent installation or grants. [A6]

App Store Connect's web packager can package macOS/iOS resources, deliver TestFlight builds, and submit to App Store review. It consumes Xcode Cloud compute allowance and needs Apple Developer Program membership. It is an alternative packaging route after compatibility is established, not a compatibility converter or a Developer ID distribution route. [A2]

### 10.3 Release checklist

- SAMS owns the team, app and extension identifiers, account access, and recovery arrangements.
- Signing certificates/profiles and notarization credentials remain outside Git and ordinary logs.
- Confirm macOS deployment target, Safari requirements, Intel/Apple Silicon support if both are in scope, and archive architectures.
- App and embedded extension have correct signing, identifiers, versions and entitlements; verify the exported artifact, not only Debug output.
- Review generated privacy-manifest requirements and store privacy disclosures against actual APIs and collection. Do not invent a blanket exemption.
- Prepare app icon, name, screenshots, enablement instructions, privacy-policy/support URLs and permission justification.
- For App Store review, provide a safe demonstration/reviewer route agreed with SAMS; never expose production student accounts or real student screenshots.
- Verify install, enablement, grant, upgrade, cache loss, disable/re-enable and uninstall on a clean test machine/account.
- Record source commit, version, Apple build number, artifact hash, channel, supported browser/OS matrix and redacted acceptance evidence.
- Obtain approval before signing for distribution, uploading, publishing or rolling out.

For rollback, retain the last accepted signed artifact and instructions for controlled reinstall. Safari cache must not be migrated between versions. App Store recovery may require a new build carrying reverted code rather than assuming a public version can be downgraded.

## 11. Test and acceptance architecture

### 11.1 What existing tests prove

`npm test` runs Node's test runner, including unit/config tests, CRM reader DOM tests, session lifecycle tests, and Safari packaging/fixture checks (61 tests on 2026-10-12). Passing it does not prove installed Safari extension APIs, native popover behavior, signing, or current live portal layouts.

`npm run test:e2e` loads the extension in Helium with synthetic HTTPS routing. It covers real Chromium popup-to-worker-to-content-script flow, but opens the popup as an extension tab. Keep it as a Chrome regression gate. It cannot be converted into a Safari-extension test merely by changing the Playwright browser to WebKit.

Playwright WebKit can help exercise shared DOM logic, but it is not Apple's Safari Web Extension runtime. SafariDriver or ordinary browser-page automation alone also does not establish permission/popup/worker integration. The reproducible manual Safari acceptance script is [e2e/safari/README.md](../e2e/safari/README.md); automate only the parts the selected tools can actually control.

### 11.2 Verification layers

| Layer | Scope | Pass criteria |
|---|---|---|
| Shared unit/config | Current tests plus new lifecycle/build cases | Chrome regressions remain green; deterministic expected outcomes |
| WebKit DOM fixtures | CRM panels, selects, dates, radio/listbox, shadow DOM | Same canonical extraction and field values on fixture DOMs |
| Installed Safari extension fixtures | Actual popup, worker, permissions and messages | Copy/fill/repeat/Clear/expiry work with no denied-frame data |
| Signed package smoke | Exported containing app/extension | Clean install, enablement, upgrade and cache reset work |
| Supervised live acceptance | Approved CRM and portal draft journeys | Same mapping/safety outcomes, no unauthorized save/submit/write |

Do not mix results from these layers. Store synthetic reports separately from ignored/redacted live reports.

### 11.3 Mandatory test cases

1. Copy each current CRM fixture, including reversed `dd`/`dt` layout and asynchronously expanded sections; compare canonical fields.
2. Reject wrong CRM origin, login/list/dashboard/settings routes, missing markers and malformed profile messages. Separately verify no writes to non-application portal pages on an approved host.
3. Copy student A, then B; verify identity/cache replacement and that subsequent fill uses B.
4. Fill Bangor and Greenwich fixtures; compare expected values, report categories and existing-value preservation with Chrome.
5. Repeat fill: no secondary qualifications, additional address-line duplication, unrelated option selection, or new field-change events.
6. Split-date cases: Greenwich DOB versus employment reuse of `#bday_*`; Bangor month/year education and employment; preserve selected components.
7. Negative controls: passwords, account emails, CAPTCHA, chat, referee data, institution residence fields, signatures, finance scholarship name, checkboxes and files stay unchanged.
8. Count attempted clicks/submissions and unexpected network writes. Intentional safe listbox/radio interaction must be distinguished from irreversible action.
9. Denied/unapproved child frame receives no student payload; approved child receives the right payload. Exercise frame disappearance/navigation between discovery and send.
10. Ask/Allow/Deny website access, grant expiry/revocation, inactive windows, missing active-tab URL and private-browsing behavior.
11. Worker suspension and wake preserve an unexpired cache; timestamp expiry after sleep/wake rejects it regardless of alarm timing.
12. Keep popup open across expiry, Clear in another popup, and student replacement; stale memory cannot send/resurrect invalid data.
13. Close popup during Copy or fill; reopening accurately reflects completion/cancellation and cache identity.
14. Quit/relaunch Safari, reload/update/disable extension: no previous student's cache remains. Temporary installs disappearing on quit are a separate case.
15. No student fields in `storage.local`, `storage.sync`, native app storage, console/support logs or exported reports.
16. Real toolbar popover: keyboard/VoiceOver access, countdown, long reports, focus and error display.
17. Package resource/version/host checks and clean signed-app installation on the oldest supported Safari/OS combination and current supported releases.

For each case record browser/OS version, install type, fixture or redacted journey identifier, result, and failure category. A test that cannot run is Blocked, not Passed.

### 11.4 Live-testing controls

Require explicit approval for the browser/profile, credentials, student sample, portals and existing drafts. Reuse the documented no-save safeguards from `e2e/README.md`; do not reuse its Chromium runner as if it tested Safari.

Never create an application, upload documents, save a step, submit, or bypass CAPTCHA to complete this port's acceptance. If Bangor Programme is locked until Personal is saved, use an already unlocked approved draft or mark it blocked. Do not use real data in committed fixtures or screenshots.

## 12. Sequenced implementation plan and gates

This is a proposed execution checklist. Implementation, signing and release remain separate approvals. The Safari work does not authorize unrelated refactors or changes to production scope.

### Phase A: approve scope and establish compatibility

- [ ] Agree platforms, staff Safari/OS inventory, developer-account ownership, private-browsing policy and intended channel.
- [ ] Stage generated development resources, including confirmed portal hosts, without changing the allowlist or production gates.
- [ ] Package/install locally and inventory actual manifest warnings and missing APIs.
- [ ] Exercise Copy, simple text/select fill, session storage, alarm expiry, targeted frames and the native popover with synthetic data.
- [ ] Record the smallest necessary source changes and any unsupported/manual features.

**Exit evidence:** compatibility report for actual Safari versions, not an assumption from API tables. Stop and revise the plan if core ephemeral storage or origin-safe frame targeting cannot be preserved.

### Phase B: shared build and minimal Apple shell

- [ ] Introduce independent browser outputs and preserve current Chrome scripts.
- [ ] Add Safari output/resource/host/version tests and retain the production rejection.
- [ ] Create the macOS containing app and extension target with approved identifiers.
- [ ] Establish one-way generated resource synchronization and clean CI build order.
- [ ] Add only onboarding, enablement guidance, privacy and support to the containing app.

**Exit evidence:** Chrome build unchanged in behavior; Safari resources reproducible; local app embeds the correct shared code. Native storage contains no student records.

### Phase C: parity and required hardening

- [ ] Reproduce any API or DOM differences before changing shared code.
- [ ] Add fresh-cache, Clear/replacement race, null-cache and message-validation regressions.
- [ ] Implement the smallest confirmed compatibility/permission changes.
- [ ] Surface frame failures without weakening origin checks.
- [ ] Run shared tests, Chrome loaded-extension fixtures, and real Safari fixture acceptance.

**Exit evidence:** equivalent supported outcomes, preserved safety controls, documented manual exclusions, no regression hidden behind a browser-only fork.

### Phase D: supervised acceptance and release preparation

- [ ] Resolve the existing production-origin/integration gate or obtain an explicit scope revision.
- [ ] Complete the approved Safari/OS matrix and live no-save journeys with SAMS.
- [ ] Prepare signing, privacy, support, screenshots and the selected distribution procedure.
- [ ] Test the exported signed package and upgrade/cache-reset behavior on a clean environment.
- [ ] Present artifact/evidence and obtain release approval before external distribution.

**Exit evidence:** SAMS acceptance, signed-package verification, resolved release blockers, and an owned update/rollback process. Conversion or an Xcode build alone is not Done.

## 13. Optional iPhone and iPad delta

Do not claim mobile Safari support as a by-product of a macOS archive. If approved, add an iOS containing app and embedded extension target using the same web resources. Apple provides a packager rebuild route for adding iOS. [A1, A5]

Additional work:

- Confirm whether the CRM and each portal genuinely support the mobile/tablet workflow. Responsive DOMs may differ from desktop selectors and panel behavior.
- Test the Safari extension menu/sheet, touch, on-screen keyboard, focus, viewport resizing, text zoom and long reports. Replace fixed desktop sizing only where necessary.
- Verify inactive-tab behavior, background suspension, short popup/sheet lifetime, frame messaging and permission requests on device.
- Preserve session-only storage; do not use native persistence to compensate for mobile lifecycle limits.
- Require physical-device acceptance in addition to simulator tests. Follow the repository's approved simulator tooling; no unpinned simulator/browser-mirroring setup.
- Provision and sign the containing app and extension; agree TestFlight/App Store delivery and mobile privacy/review assets.
- Review private browsing and shared website-permission behavior independently from desktop.
- Define mobile support limits explicitly if portal controls or required draft steps cannot be exercised safely.

Safari iOS lacks some desktop extension APIs, including `webRequest`, several window operations and context menus, but this extension does not currently rely on those for its product flow. The existing Chromium test harness's request-blocking mechanisms still cannot be assumed to exist inside the mobile extension. [A3]

## 14. Risks and dependencies

| Risk/dependency | Consequence | Control |
|---|---|---|
| Incomplete Campora/third portal scope | Existing production package cannot be released | Keep gate; obtain origins/access/mappings or explicit scope decision |
| Safari permission grants/revocation | Approved site fails injection or hides tab URL | Native access guidance and tested fail-closed errors |
| WebKit control/framework differences | Fields appear filled but portal state rejects values | Check DOM value, selected option and validation/events in Safari |
| Background/popover lifetime | Copy response lost, expiry late, stale UI | Session storage, fresh reads, cancellation/lifecycle tests |
| Mixed frame success | Misleading report or unintended data destination | Per-frame outcomes, current-origin recheck, no broad fallback |
| Shared-code changes | Chrome regression | Shared and loaded-Chrome tests on every behavioral change |
| Closed shadow controls on older Safari | Conditional features not accessible | Feature-detect; declare manual exclusions, do not bypass isolation |
| Live autosave or locked drafts | No-save acceptance cannot complete | Stop, human handoff, existing approved draft or blocked result |
| Account/signing/distribution delays | Working dev build cannot reach staff | Resolve SAMS ownership/channel before release work |
| Stale documentation | False feature or verification claims | Use code/tests as baseline and record evidence by version |

No reliable effort estimate is assigned before the compatibility spike, staff platform inventory, distribution decision, and missing-integration scope are resolved. The main unknown is runtime/portal validation, not the amount of Swift code.

## 15. Evidence, toolchain and references

### Local observations for this document

- Original architecture baseline: `1b774cb` (`Document Greenwich progress and portal matrix updates`).
- Implementation commits after that baseline added the Safari Xcode project, shared Safari build, fixture server/checklist, and session/frame hardening (see `safari/README.md` verification snapshot).
- Cartographer refresh 2026-10-12: `npm test` 61 passed, 0 failed. Loaded-extension E2E and Safari runtime were not re-executed for the doc-only map pass.
- `xcode-select -p`: `/Applications/Xcode.app/Contents/Developer`.
- Installed Safari app metadata (one local environment, not a support minimum): version `27.0.1`, build `22625.1.29.11.28`.
- Packaging tool: `safari-web-extension-packager` (project already generated and hand-edited under `safari/`).
- Still not done by docs work alone: signed archive, distribution account, host-policy change, authenticated Safari journey, or production upload.

### Repository references

- [Codebase map](CODEBASE_MAP.md)
- [Chrome README](../README.md)
- [Technical and mapping guide](TECHNICAL-AND-MAPPING.md)
- [Install and controlled deployment](INSTALL-AND-DEPLOY.md)
- [Safari build and enablement](../safari/README.md)
- [Safari acceptance checklist](../e2e/safari/README.md)
- [Portal verification matrix](../PORTALS.md), with the historical limitations noted in section 2.3
- [Existing E2E architecture and live safeguards](../e2e/README.md)
- [Chrome manifest](../manifest.json), [build](../scripts/build.mjs), [Safari app package](../scripts/package-safari.mjs), [allowlist](../config/allowlist.js)
- [Popup orchestration](../popup.js), [worker](../src/background.js), [CRM reader](../src/crm-reader.js), [portal handler](../src/portal-fill.js), [engine](../src/engine/engine.js)
- [Split-date regression tests](../test/split-dates.test.js), [Safari build tests](../test/safari-build.test.js)

### Apple documentation

Reviewed on 2026-10-12. Recheck relevant documentation and tool help when implementing or selecting an older support floor.

- **A1:** [Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari): packager name, Xcode targets, resource references, flags and iOS rebuild.
- **A2:** [Packaging and distributing Safari Web Extensions with App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect): browser-based packaging, membership, TestFlight/App Store and compute allowance.
- **A3:** [Assessing your Safari web extension's browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility): namespaces, promises, MV3, storage and API limitations.
- **A4:** [Managing Safari web extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions): website grants and Safari 17+ profile/private access behavior.
- **A5:** [Running your Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension): temporary folder installation, Xcode app installation, unsigned development and enablement.
- **A6:** [Distributing your Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension): signed app distribution, App Store and notarized Developer ID delivery.

### MDN browser compatibility data

These are live upstream data links inspected on the review date, not immutable test results.

- **M1:** [Storage](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/storage.json): `storage.session` from Safari 16.4.
- **M2:** [Scripting](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/scripting.json): script-injection compatibility.
- **M3:** [Alarms](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/alarms.json): Safari support from 14.
- **M4:** [Web navigation](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/webNavigation.json): `getAllFrames` support.
- **M5:** [Background manifest](https://github.com/mdn/browser-compat-data/blob/main/webextensions/manifest/background.json): service worker from Safari 15.4.
- **M6:** [Runtime](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/runtime.json): messaging support.
- **M7:** [DOM extension API](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/dom.json): `openOrClosedShadowRoot` support from Safari 26.
