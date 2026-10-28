# Safari architecture and Chrome parity

This guide explains how the extension runs in Safari on macOS, what must match Chrome, and what SAMS must decide before release.

Status: a macOS development build exists. It has a shared Safari build, a containing app, hardening of the cache, messages, and frames, and regression tests. Nobody has run the extension in an installed Safari. See the [Safari checklist](../e2e/safari/README.md) and [safari/README.md](../safari/README.md).

Test results and live portal results are in [CODEBASE_MAP.md](CODEBASE_MAP.md) and [../PORTALS.md](../PORTALS.md).

The [2026-10-28 answer rules](portal-maps/APPROVED-RULES.md) use shared JavaScript and portal configs, including form-scoped referee/address selectors and Manchester's bounded conditional rescan. Chrome and Safari packages must embed the same mapping source. Chromium E2E and missing-API compatibility checks are supporting cross-platform evidence, not native Safari acceptance. See [current verification](portal-maps/APPROVED-RULES-VERIFICATION.md) before rollout.

## Contents

- [1. Recommendation and SAMS decisions](#1-recommendation-and-sams-decisions)
- [2. Chrome baseline](#2-chrome-baseline)
- [3. Safari architecture](#3-safari-architecture)
- [4. Manifest and API compatibility](#4-manifest-and-api-compatibility)
- [5. Feature parity](#5-feature-parity)
- [6. Safari website access and popup behaviour](#6-safari-website-access-and-popup-behaviour)
- [7. Safety rules and known gaps](#7-safety-rules-and-known-gaps)
- [8. Build and resources](#8-build-and-resources)
- [9. Install, sign, and distribute](#9-install-sign-and-distribute)
- [10. Tests and acceptance](#10-tests-and-acceptance)
- [11. iPhone and iPad](#11-iphone-and-ipad)
- [12. Risks](#12-risks)
- [13. References](#13-references)

## 1. Recommendation and SAMS decisions

Ship a **Safari Web Extension** that uses the existing Manifest V3 JavaScript. Put it in a minimal Apple containing app. Chrome and Safari share the CRM reader, the fill engine, the portal configuration, the popup, and the safety rules. Do not rewrite the fill engine in Swift. Do not build a Safari App Extension.

Use local Safari and Xcode for the compatibility checks and for the checks of the signed app. Apple's packaging tool is `safari-web-extension-packager` (formerly `safari-web-extension-converter`). App Store Connect also offers web-based packaging. It does not replace tests in Safari. [A1, A2]

The first release targets **macOS only**. iPhone and iPad are a separate decision (see [section 11](#11-iphone-and-ipad)). SAMS has not yet approved the supported OS versions or the distribution channel.

The acceptance rule is **same behaviour**. The same synthetic student, portal page, mappings, and prefilled controls must give the same field values and the same safety results in Chrome and Safari. The browser interface and the install steps can differ.

### Decisions still owned by SAMS

| Decision | Recommendation | Needed before |
|---|---|---|
| Apple platforms | macOS first. Evaluate iPad separately. | Creating release targets |
| Supported Safari and macOS versions | Agree the inventory of staff devices. Safari 16.4 is the storage and API floor. It is not a tested support promise. | Deployment targets and the test matrix |
| Distribution | A Developer ID signed and notarized macOS app for a controlled staff rollout. Use the App Store if you prefer managed updates. | Release packaging |
| Developer account | A SAMS-owned Apple Developer team, with identifiers, signing access, and a distribution account. | Signing or external uploads |
| Portal scope | Keep the production gate, unless SAMS approves a narrower release. | Any production package |
| Private browsing | Refuse Copy and Autofill at first. Do not assume profile isolation. | Compatibility work |
| Acceptance owner | A named SAMS tester approves the supported workflows and the manual exclusions. | Release |

These are decisions to make. They do not give permission to enrol accounts, change production policy, publish, or start authenticated tests.

## 2. Chrome baseline

### 2.1 Components

Paths are relative to the repository root.

| File | Responsibility | In Safari |
|---|---|---|
| `manifest.json` | MV3 identity, toolbar popup, worker, permissions, hosts | Shared. Make a separate Safari manifest only where required. |
| `popup.html`, `popup.js` | Copy, Clear, Autofill, student card, countdown, result lists | Reuse. Check the native Safari popover and permission errors. |
| `src/background.js` | Session cache, expiry time, activity extension, cleanup alarm | Reuse. Check suspension and restart behaviour. |
| `src/crm-reader.js` | Profile guards, section expansion, reading of labelled data | Reuse. Test real WebKit layouts and asynchronous panels. |
| `config/crm-source.js` | Exact labels, canonical keys, allowed CRM profile paths | Shared. No Safari fork. |
| `config/allowlist.js` | Exact CRM and portal origins, dev and prod origins, 30 minute retention | One source for both browsers. |
| `src/portal-fill.js` | Page message handler that checks the origin, and result serialization | Reuse. Check messages to a chosen frame. |
| `src/engine/engine.js` | Field scan, matching, DOM setters, section context, split dates | Shared. Isolate any browser difference that you prove. |
| `config/synonyms.js` | Shared field vocabulary | Shared. |
| `config/portals/*.js` | Greenwich, Bangor, and Greater Manchester selectors, dates, blocked controls | Shared. |
| `scripts/build.mjs` | Dev and prod resource copy, host generation, Chrome zip | Builds independent browser outputs. |
| `test/` | Node tests and Chromium DOM tests | Keep. Add Safari regression tests. |
| `e2e/extension.e2e.mjs` | Loaded Chromium extension with synthetic HTTPS fixtures | Keep as the Chrome regression. Safari needs its own harness. |
| `e2e/live.mjs` | Opt-in live smoke test in Chromium | Not a Safari runner. |

### 2.2 Origins

| Integration | Production origin | Evidence |
|---|---|---|
| SAMS CRM | `https://app.samscrm.co.uk` | Reader, agent and full-profile path guards, fixture tests |
| Campora APPLY | `https://v-sams-backend.samsapply.co.uk` | Reader mapping and synthetic fixture. No live Safari test. |
| University of Greenwich | `https://nelson.gre.ac.uk` | Portal config, fixtures, regression tests |
| Bangor University | `https://apps.bangor.ac.uk` | Portal config, fixtures, regression tests |
| University of Greater Manchester | `https://evision.bolton.ac.uk` | Portal config and fixtures. No live Safari test. |

Development builds add `http://localhost:3000` (CRM) and `http://localhost:3001` and `http://127.0.0.1:3001` (portal fixtures). Production must not include them.

The production build stops if the Campora list is empty or if fewer than three portal origins are set. This proves that the allowlist is complete. It does not prove that the integrations work.

### 2.3 Dates and fixtures

`splitDates` mappings and `fillSplitDates()` fill explicit split-date controls. They cover Greenwich date of birth and employment dates, Bangor education dates, and Manchester date of birth and graduation year. They keep an existing date selection. Generic scanning still blocks split-date controls. The page-scoped path fills them separately.

Synthetic fixtures are in `e2e/fixtures/`. CRM HTML is in `test/fixtures/`.

## 3. Safari architecture

```text
One version-controlled JavaScript source
  |
  +-- shared configuration, CRM reader, engine, popup, worker
  |
  +-- Chrome build --> dist/chrome --> Chrome zip
  |
  +-- Safari build --> dist/safari-webextension
                         |
                         +-- temporary Safari install (where available)
                         |
                         +-- Xcode project
                               |
                               +-- containing macOS app
                               +-- embedded Safari Web Extension target
                                      |
                                      +-- popup: staff commands and results
                                      +-- worker: temporary student cache
                                      +-- CRM content script: profile DOM only
                                      +-- portal content scripts: own-origin frames of the selected page
```

### 3.1 Runtime parts

1. **Containing app.** It installs the extension. It explains enablement, website permissions, support, and privacy. It does not handle student records.
2. **Safari extension target.** It bundles the web resources and the Safari registration data. The generated native handler is packaging code. It is not an autofill backend.
3. **Popup.** It checks the active tab and handles explicit staff actions. It injects scripts. It shows the copied student and the results.
4. **Background worker.** It owns the one student cache and the expiry rule. Listeners register at startup. State lives in `storage.session`, not in worker variables.
5. **CRM content script.** It reads the approved profile and returns a serializable profile. It can open profile sections. It cannot save CRM forms.
6. **Portal content script.** It receives data only over a popup port, in a frame with exactly the origin of the selected page. It checks its own origin, sandbox, and top page. It fills eligible empty fields and returns a serializable report.

The design needs no server, no native messaging, no App Group, no Keychain cache, no database, no AI service, no clipboard pipeline, and no sync between browsers. The Chrome and Safari caches are separate. After a browser switch, staff copy again.

Never send student fields through Swift, logs, analytics, crash attachments, or support uploads. Do not add a broad entitlement or a native host permission to work around a WebExtension difference.

### 3.2 Shared and browser-specific code

Safari supports both `chrome.*` and `browser.*`, with callbacks and Promises. The current `chrome.*` calls need no namespace rewrite and no polyfill. [A3]

If a compatibility check proves a needed difference, add the smallest shared helper at that boundary. Possible helpers: API detection, host-permission error normalization, and access to closed shadow roots. Do not add a general browser abstraction without evidence.

Keep selectors and mappings the same for both browsers. A browser-specific selector needs a repeatable WebKit DOM difference and a regression fixture. Prefer to fix a shared DOM assumption. Do not keep two portal configurations.

## 4. Manifest and API compatibility

### 4.1 Manifest rules

- Keep Manifest V3, the toolbar `action.default_popup`, and the classic `background.service_worker` that uses `importScripts`. Safari supports MV3 and background service workers from version 15.4. `storage.session` raises this project's floor to 16.4. [A3, M1, M5]
- Keep these permissions: `activeTab`, `scripting`, `storage`, `alarms`, `webNavigation`. Generate exact `host_permissions` from the same allowlist for both browsers.
- Do not add `tabs`, `nativeMessaging`, `unlimitedStorage`, `<all_urls>`, blanket content scripts, or web-accessible resources without a proven need and a review.
- Do not set `background.type: "module"` while the worker uses `importScripts`.
- Do not ship an MV2 or persistent-background fallback for older Safari. If session storage is missing, disable Copy and Autofill and show an unsupported-version message. Never switch silently to persistent storage.
- The packager reports unsupported manifest keys. Record and classify every warning. A package without warnings does not prove the same behaviour at run time.
- Safari updates come through the chosen Apple channel. They do not come from the Chrome Web Store or a Chrome `update_url`. [A1, A3]

### 4.2 API inventory

| API used today | Safari evidence | What to verify |
|---|---|---|
| `tabs.query({ active: true, currentWindow: true })` | Safari tabs need host permission. [A3] | Real toolbar popup, several windows, missing URL or ID, revoked permission, `activeTab` grant on an unmapped university |
| `scripting.executeScript({ target: { tabId, frameIds }, files })` | Safari supports script injection. The call does not use the unsupported `injectImmediately`. [A3, M2] | File order, isolated-world globals, repeated injection, child frames |
| `tabs.connect(..., { frameId })` and `runtime.onConnect` | Safari supports WebExtension messaging. [A3] Frame-targeted ports and `Port.sender.url` are unverified. | The right frame gets the data. The popup sender is accepted. Navigation closes the port with a useful error. |
| `runtime.sendMessage` and `runtime.onMessage` | Safari support from version 14. [M6] | Lifetime of async replies, thrown or rejected calls, serializable objects |
| `storage.session.get/set/remove` | Safari support from 16.4. [A3, M1] | Survives worker suspension. Does not survive a browser restart. Gives no extra access to content scripts. |
| `alarms.create/clear/onAlarm` | Safari support from 14. [M3] | Cleanup after sleep and wake. Rescheduling. The timestamp stays the authority. |
| `webNavigation.getAllFrames` | macOS Safari from 14, iOS from 15. [M4] | Frame URLs and IDs under granted hosts. Rejection of cross-origin frames. |
| `chrome.dom.openOrClosedShadowRoot` | Optional engine helper. Safari support from 26. [M7] | Feature detection, any needed permission, real namespace and DOM access |
| DOM selectors, events, native value setters | Shared engine. Not only extension API parity. | WebKit dates and selects, reaction of the page framework, shadow roots, popup focus |

The closed-shadow-root helper returns `null` when the API is missing. Below Safari 26, the helper cannot give parity for controls inside closed shadow roots only. The engine can still scan open shadow roots. The approved portals do not need closed shadow roots.

API tables are evidence for a first check. They are not acceptance tests. They do not set the minimum macOS version. Test the approved Safari and OS combinations, including the oldest release that you advertise.

## 5. Feature parity

**Required** means that the Safari release must reproduce the Chrome behaviour. **Conditional** means that parity depends on the CRM data, the portal scope, or a browser capability. All Safari run-time entries are unverified.

| Feature | Chrome baseline | Safari | Evidence to collect |
|---|---|---|---|
| Toolbar popup | Copy, Clear, Autofill, identity and countdown, result lists | Required | Native popover, keyboard, long lists, resizing, focus |
| CRM profile guard | Exact origin, profile path, and marker checks | Required | Profile accepted. Login, list, dashboard, and settings rejected. |
| Expanded CRM extraction | Label and value, forms, lists, contact context, panel settling | Required | Same canonical fields from all CRM fixtures |
| Single student replacement | Copy overwrites the cache | Required | Copy A, then B. Only B fills. |
| Temporary cache | `storage.session`, 30 minute activity expiry | Required | Suspension, timestamp expiry, Clear, browser restart, update |
| Exact hosts and dev/prod split | Allowlist at the popup and page boundary | Required | No localhost in prod, no wildcard, denied hosts untouched |
| Frames of the selected origin only | Frame URL filter, targeted injection, per-frame ports | Required | Same-origin child, cross-origin child (including a mapped portal), sandboxed child, navigation race |
| Text, email, tel, textarea | Eligible empty controls, section-aware matching | Required | Same values. Prefilled controls unchanged. |
| Native select and radio | Matched options and eligible radio groups | Required | Same choice. No unrelated option. Keyboard and page events work. |
| Custom combobox or listbox | Scoped option matching with click guard | Conditional on the page DOM | WebKit fixture. No navigation or irreversible clicks. |
| Date input | Shared normalization to ISO values | Required where Chrome maps it | Safari value and validation agree with the expected date |
| Explicit split dates | Page-scoped Greenwich and Bangor configs | Required | Correct date for each section. Preselected parts kept. |
| Phones | Portal-specific dial-prefix handling | Required | UK and non-UK examples. Maxlength reporting. |
| Address context | Applicant residence does not fill institution or referee context | Required | Negative fixtures for education and referee |
| Qualification limits | Greenwich qualification row 1 only | Required | No rows 2 to 20 on the first or repeat fill |
| Repeat Autofill | Existing values kept, no duplicate mappings | Required | Same values and event counts on the second click |
| Result reporting | Filled, existing, missing, unmatched, manual categories | Required | Same outcomes. Partial frame failures visible. |
| Repeated injection | Guards in reader and handler. Portal configs do not duplicate. | Required | Reload, inject, and fill many times with no duplicate listeners |
| Open shadow DOM | Shared scanning | Conditional on portal use | Fixture in real Safari |
| Closed shadow DOM | Optional Chrome API helper | Conditional on Safari version and API | No invented workaround. Unsupported controls stay manual. |
| Bangor Programme | Selector mapping incomplete. The workflow can need a saved Personal section. | No parity claim yet | A confirmed draft and access. A separately approved inventory. |
| Campora and Greater Manchester | Chrome config and fixtures | No Safari parity claim | Supervised Safari tests of the configured origins and flows |
| Files, checkboxes, authentication, declarations | Manual or blocked | Required safety parity | No writes, clicks, uploads, or agreement changes |
| Submit, save, pay, next, continue | The extension never selects them | Required safety parity | Negative action and event checks |
| Transfer between browsers | Not implemented | Not requested | Safari starts with its own empty cache |

Missing CRM values stay missing. Safari must not invent a country of birth, ethnicity, previous name, course, dates, funding, referee details, or other application answers to raise the fill count.

## 6. Safari website access and popup behaviour

Safari has a second gate beyond the manifest allowlist. Users can grant, ask, or deny website access. The popup must tell an unsupported origin apart from an approved origin without Safari permission. A granted website access does not widen the exact-origin rule of the extension. [A4]

Use the toolbar interaction and the Safari permission interface first. Explain how to allow the exact CRM or portal website. If a run-time permission request is necessary, ask for the one approved host, from an explicit user action. Never ask for all websites. Catch failures at the injection and messaging boundaries. Do not assume access from the manifest alone.

The popup needs these states:

- **No copied student.** Autofill is disabled. Copy instructions show.
- **Unsupported Safari version or capability.** Copy and Autofill are disabled. Supported-version guidance shows.
- **Approved website with Ask or Deny.** Clear website-access instructions show. The extension does not scan and does not send data.
- **Wrong website, login page, missing tab URL, or no active tab.** A safe error shows. The extension reads and fills nothing.
- **Valid student.** Name, copy time, expiry, and Clear show. The extension never selects another student silently.
- **Expired or cleared student.** The identity is removed. Staff must copy again.
- **Partial fill or frame error.** Successful counts show with a warning. Staff check the form before they continue.

Test the real native popover. Do not test only `popup.html` in an extension tab. Check scrollable result lists, text zoom, VoiceOver and keyboard labels, disabled states, status announcements, and the return of focus to the form. Keep local assets and script-only event handlers. Do not load remote scripts or fonts.

Safari 17 and later can share granted website access across profiles and private browsing. This is permission behaviour. It does not prove that student caches are separate. [A4] Test several profiles and windows. Refuse private browsing in the first release, if SAMS approves. Do not claim that private windows give a separate secure cache, unless you observe it in every supported configuration.

## 7. Safety rules and known gaps

### 7.1 Rules

1. Only approved exact origins can read or receive student data. Child frames must qualify on their own.
2. Copy only reads the approved student profile. Section expansion in the CRM must not save or submit.
3. The extension writes only to eligible empty portal controls. It does not change existing values.
4. The extension never completes authentication, payment, file upload, declaration, signature, consent, or navigation controls.
5. The extension never selects Submit, Save, Pay, Send, Delete, Confirm, Declare, Agree, Next, Continue, or a similar irreversible control.
6. The cache expires after 30 minutes of inactivity. The extension checks it again before use. It does not persist or sync it.
7. Clear and cache loss cannot bring back stale data from another popup or a kept variable.
8. Production artifacts contain no localhost hosts, test credentials, personal fixtures, logs, `.env` files, CRM snapshots, or development-only resources.
9. Reports and support files contain synthetic identifiers, field keys, counts, and error categories. They never contain real field values, authenticated URLs, or tokens.
10. Staff check the draft and do any saving or submitting themselves.

### 7.2 Gaps to evaluate before release

These are limits of the shared source. Nobody has shown them to be Safari defects. A fix changes shared behaviour and needs targeted tests in both browsers.

| Observation | Risk | Acceptance rule |
|---|---|---|
| `autofill()` sends `cache.fields` from popup memory before a fresh worker read. | A popup with stale state can use expired or cleared data. | Check again before sending. Test an expired cache and Clear from another popup. |
| `cache = touched.cache \|\| cache` after Autofill. | A `null` worker result keeps an invalid student in the UI. | `null` means clear and disable. Never fall back to the old cache. |
| The worker ignores `_sender` and accepts a profile shape without validation. | Privileged data actions lack a sender and schema boundary. | Reject unauthorized action sources and malformed or unapproved profiles. A rejected message must not clear a valid cache. |
| The portal handler checks the origin, not a required application-page guard. | Other forms on an approved host can reach generic matching. | Negative-test non-application pages. Add a narrow shared page guard if needed. |
| Parallel frame handling uses `Promise.all`. | One failure can stop the report or give a misleading partial success. | Collect the outcome of each frame. Show partial failure clearly. |
| Engine reports include shortened filled values and existing values. | Logs or support tools could expose personal data. | Keep values out of persistent diagnostics and external reports. |

Cache actions come from the extension popup. Check the extension identity and the expected sender URL of the extension page. Do not trust an origin string that the caller supplies. Check profile keys and types, the approved `sourceOrigin`, and size limits. Content-script responses stay tied to the requested tab and frame. The design needs no external messaging and no native bridge.

If you need operation tokens or background-owned dispatch to prevent a Clear or Copy race, keep the mechanism small. Do not add a job service for this. Test Copy of student B, or Clear, during a fill that is already running. Refuse every later send that uses the invalidated cache of student A. The extension cannot recall values that it already wrote.

**Important limit.** If the extension does not select Save, the website can still make write requests. DOM changes can start portal autosave or analytics. The extension does not block requests. The supervised no-save test harness must detect or block unexpected writes and stop. Do not describe the extension as a network write blocker. Unexpected autosave blocks acceptance until SAMS approves the effect on the workflow.

Cache cleanup removes only what the extension controls. It cannot guarantee a memory wipe against forensic tools. It cannot delete the original CRM data. It cannot erase the visible portal values. Privacy notices must describe the real local processing. Do not promise that no personal data is handled.

## 8. Build and resources

`scripts/build.mjs` takes `dev` or `prod` and an optional target (`chrome` or `safari`). Each target deletes only its own paths: `dist/chrome` and its zips, or `dist/safari-webextension`. A Chrome build does not delete the Safari output.

The root `manifest.json` has no Greenwich or Bangor host permissions. The build generates them from `config/allowlist.js`. Package the generated, validated resources. Do not copy the repository root.

- `npm run build` and `npm run build:prod` build Chrome.
- `npm run build:safari` and `npm run build:safari:prod` write `dist/safari-webextension`.
- `npm run build:safari:app` runs `scripts/package-safari.mjs`. It makes an unsigned Debug app with `xcodebuild` and checks that the embedded resources match `dist/safari-webextension`.
- Both targets share the resource copy, the version check, the exact-host generation, and the rejection of incomplete production origins.
- Nobody edits `dist/` by hand.
- The app and extension `MARKETING_VERSION` match `package.json` and `manifest.json` (`0.3.0`). Apple build numbers can change on their own when signing starts.

The native project is created once and kept in Git. Its web resources come from the generated Safari output through stable project-relative references to `dist/safari-webextension`. A build system must create that folder before Xcode builds. Check the resource membership of every target and the contents of the archive. [A1]

If references do not suit your build layout, use an explicit build-time copy and check hashes. Never keep a second JavaScript tree by hand. `--copy-resources` makes a snapshot. Later source edits do not update it.

The original packaging command is in [safari/README.md](../safari/README.md). The project already exists and has hand edits. Avoid `--force` and routine regeneration, which could overwrite native changes. The identifier `com.example.sams.portalautofill` in earlier plans was an example. The project uses `com.example.dev.*` placeholders. Neither is a SAMS identifier to register.

## 9. Install, sign, and distribute

### 9.1 Local development

Current Apple documentation supports a temporary install of a web extension folder or zip in macOS Safari, where that interface exists. Safari removes temporary extensions after 24 hours or when it quits. This is a fast compatibility check. It is not a distribution artifact. It does not test the final signed containing app. Older Safari versions may need the Xcode route. [A5]

For Xcode tests, build and run the containing app, enable the extension, and grant access only to the fixture or approved sites. Testing an unsigned extension needs a developer setting. Safari may reset it when it quits. The operator must approve this setting. Do not change the settings of a normal staff browser. Do not weaken release requirements.

Use a dedicated test environment or profile. A local HTTP test does not prove injection into the production HTTPS origin. The final acceptance run must use the packaged extension and the real toolbar popup.

### 9.2 Distribution channels

| Channel | Needs | Trade-offs |
|---|---|---|
| Developer ID app outside the Mac App Store | A SAMS developer team, identifiers, signing, notarization, and controlled app delivery | Suits staff-only macOS use. SAMS must own and document update delivery. |
| Mac App Store | A SAMS developer and App Store Connect account, a signed archive, review assets, privacy disclosures, and review | Managed store updates. Plan for review time and reviewer access. |
| TestFlight | An App Store Connect build and an approved beta setup | For beta tests. Not a permanent production rollout. |
| Unsigned or temporary local install | Developer settings | For development only. Not a staff deployment method. |

Apple supports Developer ID signing and notarization outside the Mac App Store. Chrome force-install policy does not work as a Safari deployment policy. If SAMS uses MDM, ask its administrator about device management and about the controls for extension enablement and website access. Do not promise a silent install or silent grants. [A6]

The web packager of App Store Connect can package macOS and iOS resources, deliver TestFlight builds, and submit to App Store review. It uses the Xcode Cloud compute allowance and needs Apple Developer Program membership. It is an alternative way to package after compatibility is proven. It is not a compatibility converter and not a Developer ID route. [A2]

### 9.3 Release checklist

- SAMS owns the team, the app and extension identifiers, the account access, and the recovery plans.
- Signing certificates, profiles, and notarization credentials stay outside Git and ordinary logs.
- Confirm the macOS deployment target, the Safari requirements, Intel and Apple Silicon support (if both apply), and the archive architectures.
- Check signing, identifiers, versions, and entitlements of the app and of the embedded extension. Check the exported artifact, not only the Debug build.
- Compare the generated privacy-manifest requirements and the store privacy disclosures with the real APIs and data collection. Do not invent a general exemption.
- Prepare the app icon, name, screenshots, enablement instructions, privacy policy and support URLs, and the permission justification.
- For App Store review, agree a safe demo or reviewer route with SAMS. Never show production student accounts or real student screenshots.
- Test install, enablement, grant, upgrade, cache loss, disable and enable, and uninstall on a clean test machine or account.
- Record the source commit, version, Apple build number, artifact hash, channel, supported browser and OS matrix, and redacted acceptance evidence.
- Get approval before you sign for distribution, upload, publish, or roll out.

For rollback, keep the last accepted signed artifact and the steps for a controlled reinstall. Do not migrate the Safari cache between versions. Recovery in the App Store may need a new build with the reverted code. Do not assume that a public version can be downgraded.

## 10. Tests and acceptance

### 10.1 What existing tests prove

`npm test` runs unit and config tests, CRM reader DOM tests, session lifecycle tests, and Safari packaging and fixture checks. A pass does not prove installed Safari extension APIs, native popover behaviour, signing, or current live portal layouts.

`npm run test:e2e` loads the extension in a Chromium browser (Helium by default) with synthetic HTTPS routing. It covers the real Chromium flow from popup to worker to content script. It opens the popup as an extension tab. Keep it as the Chrome regression gate. Changing the Playwright browser to WebKit does not turn it into a Safari extension test.

Playwright WebKit can test shared DOM logic. It is not the Safari Web Extension run time of Apple. SafariDriver or ordinary page automation also does not prove permission, popup, and worker integration. The repeatable manual script is [e2e/safari/README.md](../e2e/safari/README.md). Automate only the parts that the tools can really control.

### 10.2 Verification layers

| Layer | Scope | Pass criteria |
|---|---|---|
| Shared unit and config | Current tests plus new lifecycle and build cases | Chrome regressions stay green. Outcomes are deterministic. |
| WebKit DOM fixtures | CRM panels, selects, dates, radio and listbox, shadow DOM | Same canonical extraction and field values on the fixture DOMs |
| Installed Safari extension with fixtures | Real popup, worker, permissions, messages | Copy, fill, repeat, Clear, and expiry work. Denied frames get no data. |
| Smoke test of the signed package | Exported containing app and extension | Clean install, enablement, upgrade, and cache reset work |
| Supervised live acceptance | Approved CRM and portal draft journeys | Same mapping and safety results. No unauthorized save, submit, or write. |

Do not mix the results of these layers. Keep synthetic reports apart from ignored, redacted live reports.

### 10.3 Mandatory test cases

1. Copy each current CRM fixture, including the reversed `dd` and `dt` layout and sections that expand asynchronously. Compare the canonical fields.
2. Reject a wrong CRM origin, login, list, dashboard, and settings routes, missing markers, and malformed profile messages. Check separately that nothing is written to non-application portal pages on an approved host.
3. Copy student A, then B. Check that the identity and cache are replaced and that the next fill uses B.
4. Fill the Bangor and Greenwich fixtures. Compare the values, report categories, and kept existing values with Chrome.
5. Repeat the fill. Check for no secondary qualifications, no repeated address lines, no unrelated option, and no new field-change events.
6. Split-date cases: Greenwich date of birth against the reuse of `#bday_*` for employment. Bangor month and year for education and employment. Keep selected parts.
7. Negative controls: passwords, account emails, CAPTCHA, chat, referee data, institution residence fields, signatures, the finance scholarship name, checkboxes, and files stay unchanged.
8. Count the attempted clicks, submissions, and unexpected network writes. Tell an intended safe listbox or radio action apart from an irreversible action.
9. A denied or unapproved child frame gets no student data. An approved child gets the right data. Test a frame that disappears or navigates between discovery and send.
10. Ask, Allow, and Deny website access. Grant expiry and revocation. Inactive windows. Missing active-tab URL. Private-browsing behaviour.
11. Worker suspension and wake keep an unexpired cache. After a sleep and wake, the timestamp expiry rejects the cache whatever the alarm timing is.
12. Keep a popup open during expiry, Clear in another popup, and a student replacement. Stale memory cannot send or bring back invalid data.
13. Close the popup during Copy or a fill. When you open it again, it shows the real completion or cancellation and the right cache identity.
14. Quit and restart Safari. Reload, update, or disable the extension. No cache of the previous student remains. Temporary installs that disappear on quit are a separate case.
15. No student fields appear in `storage.local`, `storage.sync`, native app storage, console or support logs, or exported reports.
16. Real toolbar popover: keyboard and VoiceOver access, countdown, long reports, focus, and error display.
17. Package resource, version, and host checks. A clean install of the signed app on the oldest supported Safari and OS combination and on the current supported releases.

For each case, record the browser and OS version, the install type, the fixture or redacted journey identifier, the result, and the failure category. A test that cannot run is Blocked, not Passed.

### 10.4 Live-test controls

Get explicit approval for the browser and profile, the credentials, the student sample, the portals, and the existing drafts. Reuse the no-save safeguards of [e2e/README.md](../e2e/README.md). Do not use its Chromium runner as a Safari test.

Never create an application, upload documents, save a step, submit, or bypass a CAPTCHA to complete this acceptance. If Bangor Programme stays locked until Personal is saved, use an approved draft that is already unlocked, or mark it Blocked. Never put real data in committed fixtures or screenshots.

## 11. iPhone and iPad

Do not claim mobile Safari support as a result of a macOS archive. If SAMS approves it, add an iOS containing app and an embedded extension target that use the same web resources. Apple provides a packager route to add iOS. [A1, A5]

Extra work:

- Confirm that the CRM and each portal support the mobile or tablet workflow. Responsive DOMs can differ from desktop selectors and panel behaviour.
- Test the Safari extension menu or sheet, touch, the on-screen keyboard, focus, viewport changes, text zoom, and long reports. Change the fixed desktop sizes only where needed.
- Check inactive-tab behaviour, background suspension, the short life of a popup or sheet, frame messaging, and permission requests on a device.
- Keep session-only storage. Do not use native persistence to work around mobile lifecycle limits.
- Require acceptance on a physical device in addition to simulator tests.
- Provision and sign the containing app and the extension. Agree TestFlight or App Store delivery and the mobile privacy and review assets.
- Review private browsing and shared website permissions for mobile on their own.
- State the mobile support limits if portal controls or required draft steps cannot be tested safely.

Safari on iOS lacks some desktop extension APIs, including `webRequest`, several window operations, and context menus. This extension does not use them in its product flow. The request-blocking tools of the Chromium test harness may not exist in a mobile extension. [A3]

## 12. Risks

| Risk or dependency | Consequence | Control |
|---|---|---|
| Live acceptance for Campora and the portals | The production package builds, but nobody has verified the release | Complete the live CRM-to-portal tests and Safari acceptance before release |
| Safari permission grants and revocation | An approved site fails injection or hides the tab URL | Native access guidance and tested fail-closed errors |
| WebKit control and framework differences | Fields look filled, but the portal state rejects the values | Check the DOM value, the selected option, and validation and events in Safari |
| Background and popover lifetime | A lost Copy response, a late expiry, a stale UI | Session storage, fresh reads, cancellation and lifecycle tests |
| Mixed frame success | A misleading report or a wrong data destination | Per-frame outcomes, a check of the current origin, no broad fallback |
| Changes to shared code | Chrome regression | Shared tests and loaded-Chrome tests on every behaviour change |
| Closed shadow controls on older Safari | Conditional features are not reachable | Detect the feature. Declare manual exclusions. Do not bypass isolation. |
| Live autosave or locked drafts | The no-save acceptance cannot finish | Stop. Hand over to a person, use an existing approved draft, or record Blocked. |
| Delays in account, signing, or distribution | A working development build cannot reach staff | Settle SAMS ownership and the channel before release work |
| Out-of-date documentation | False claims about features or verification | Use the code and tests as the baseline. Record evidence by version. |

No reliable effort estimate exists until SAMS settles the compatibility checks, the staff platform inventory, the distribution decision, and the scope of missing integrations. The main unknown is validation at run time and on portals. The amount of Swift code is small.

## 13. References

Repository:

- [Codebase map](CODEBASE_MAP.md)
- [README](../README.md)
- [Technical and mapping guide](TECHNICAL-AND-MAPPING.md)
- [Install and deploy](INSTALL-AND-DEPLOY.md)
- [Safari build and enablement](../safari/README.md)
- [Safari checklist](../e2e/safari/README.md)
- [Portal status](../PORTALS.md)
- [E2E tests and live safeguards](../e2e/README.md)
- [Safari build tests](../test/safari-build.test.js), [split-date tests](../test/split-dates.test.js)

Apple documentation (reviewed on 2026-10-12; check it again before you pick an older support floor):

- **A1:** [Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari). Packager name, Xcode targets, resource references, flags, and iOS rebuild.
- **A2:** [Packaging and distributing Safari Web Extensions with App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect). Browser-based packaging, membership, TestFlight and App Store, compute allowance.
- **A3:** [Assessing your Safari web extension's browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility). Namespaces, promises, MV3, storage, and API limits.
- **A4:** [Managing Safari web extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions). Website grants and the Safari 17 behaviour for profiles and private browsing.
- **A5:** [Running your Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension). Temporary folder install, Xcode app install, unsigned development, and enablement.
- **A6:** [Distributing your Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension). Signed app distribution, App Store, and notarized Developer ID delivery.

MDN browser compatibility data (live upstream data, not fixed test results):

- **M1:** [Storage](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/storage.json). `storage.session` from Safari 16.4.
- **M2:** [Scripting](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/scripting.json). Script injection.
- **M3:** [Alarms](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/alarms.json). Safari support from 14.
- **M4:** [Web navigation](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/webNavigation.json). `getAllFrames` support.
- **M5:** [Background manifest](https://github.com/mdn/browser-compat-data/blob/main/webextensions/manifest/background.json). Service worker from Safari 15.4.
- **M6:** [Runtime](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/runtime.json). Messaging support.
- **M7:** [DOM extension API](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/dom.json). `openOrClosedShadowRoot` from Safari 26.
