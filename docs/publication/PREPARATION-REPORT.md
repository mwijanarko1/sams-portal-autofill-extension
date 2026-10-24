# Publication preparation report

Status date: 2026-10-22. Extension version `0.1.0`, branch `main`.

This is the current record of what has been checked locally and what is still blocked for Safari acceptance, three-portal acceptance and store submission. It supersedes the older status lines in `README.md`, `PORTALS.md`, `docs/CODEBASE_MAP.md` and `BUILD-PLAN.md`, which are kept for history. Nothing here is a release approval. No package has been distribution-signed, uploaded, published or submitted.

Related: [store submission pack](STORE-SUBMISSION-PACK.md), [privacy policy extension addendum draft](PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md), [historical standalone privacy policy draft](PRIVACY-POLICY-DRAFT.md), [Safari manual checklist](../../e2e/safari/README.md), [Safari build notes](../../safari/README.md), [portal matrix](../../PORTALS.md).

Paths under `tmp/` are local, git-ignored evidence, and `.pstack/` records are local and untracked. They are quoted here by result so this report stands on its own.

## Privacy policy status

SAMS already publishes a privacy policy at https://samscrm.co.uk/privacy-policy/. It was fetched on 2026-10-22 and returned HTTP 200, `text/html`, canonical same URL, title "Privacy Policy - SAMS CRM". It names SAMS GLOBAL SOLUTIONS LIMITED, The Workstation, 15 Paternoster Row, Sheffield S1 2BX, with privacy contact contact@samsglobal.co.uk. The page does not currently describe this extension, session storage, draft saving or staff-granted website access.

The preferred route is a draft insertion into that page, in [PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md](PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md). Status: existing public policy found; extension-specific amendment pending publisher and legal review, not published. The older standalone [privacy policy draft](PRIVACY-POLICY-DRAFT.md) is retained as a historical reference. This is not a claim that the extension is already covered or compliant.

## What the release gate actually is

`scripts/build.mjs` refuses any production build unless `camporaOrigins` is non-empty and `portalOrigins` has at least three entries. `config/allowlist.js` already lists three portal origins (`https://nelson.gre.ac.uk`, `https://apps.bangor.ac.uk`, `https://evision.bolton.ac.uk`) and an empty `camporaOrigins`. The single failing condition is therefore the missing confirmed Campora origin. The error text ("Add the confirmed Campora and three portal origins") is broader than the real condition.

Both `npm run build:prod` and `npm run build:safari:prod` exit 1 on this gate (result supplied by the lead; not re-run here). That is outside this preparation work and was not changed. Until a confirmed Campora origin is added by whoever owns that decision, no production Chrome zip and no production Safari resources can be generated, so every "production" item below is blocked, not merely unchecked.

A production `manifest.json` therefore cannot be produced yet. By the logic in `scripts/build.mjs` its `host_permissions` will be the CRM origin `https://app.samscrm.co.uk`, the confirmed Campora origin (TBD), and the three portal origins, each as `<origin>/*`. All localhost entries are dropped in production. `optional_host_permissions` stays `https://*/*`.

## Item 2: Safari acceptance and distribution

| Check | Command or source | Result | Verdict |
|---|---|---|---|
| Unsigned dev app builds and embeds current resources | `npm run build:safari:app` | Exit 0 on 2026-10-22. 23 embedded resources identical to `dist/safari-webextension`. App `com.example.dev.SAMSPortalAutofill` 0.1.0 (1), extension `com.example.dev.SAMSPortalAutofill.Extension` 0.1.0 (1). Earlier records say 18 and 22 resources; the count grew with new source files. | verified (packaging only) |
| Signature of the built app | `codesign -dv` on the built app | `Signature=adhoc`, flags `adhoc,linker-signed`, `TeamIdentifier=not set`. | verified: unsigned, not releasable |
| Containing app opens | Earlier runner, `tmp/safari-runtime-evidence/` (case S1) | Passed 2026-10-20. Help page text only. Not repeated today. | verified earlier |
| S2 to S16 (Copy, Autofill, repeat-fill, Clear, expiry, frames, private window) in actual Safari | `e2e/safari/README.md` | Not executed. | blocked |
| Chromium or WebKit as a Safari substitute | n/a | Not used and not claimed. | not applicable |
| Signed or notarised build | n/a | No SAMS signing identity or Apple team is available locally. The Xcode project has no team set, `CODE_SIGN_STYLE = Automatic`, and development identifiers. Nothing was signed and no account or keychain setting was changed. | blocked |

Why S2 to S16 are blocked now:

- **Fixture ports.** The checklist needs ports 3000, 3001 and 3002. On 2026-10-22 port 3000 is held by a `node` listener (PID 2994) whose working directory belongs to another project (`pareto-website`). Ports 3001 and 3002 are free. The listener was left running, as the checklist requires. `npm run safari:fixtures` refuses to start while port 3000 answers, so it was not run.
- **Extension enablement and driving.** The previous attempt (2026-10-20, `tmp/safari-live-evidence/report.json`) found the unsigned unpacked extension enabled with zero granted website origins and no way to drive the toolbar popup through AppleScript or System Events. `pluginkit` shows no registered SAMS web extension for this user. No Safari setting, permission or profile was changed in this round.
- **Operator step.** A person must enable unsigned extensions in a dedicated Safari test profile or user, grant access to the fixture hosts, and operate the popup. That cannot be automated safely from here.

Smallest unblock: the port 3000 owner frees it (or approves stopping that listener), an operator prepares a dedicated Safari test profile with the development extension enabled, then runs S2 to S16 by hand and records Passed, Failed or Blocked per case. A caution for that run: `npm run build:safari:app` rewrites `dist/safari-webextension`. A temporarily loaded unpacked extension that points at that folder must be reloaded afterwards.

Even a full pass on localhost fixtures only shows generic matching. The checklist states that Bangor and Greenwich mappings apply on their production origins only, so portal-specific Safari parity needs supervised live runs (item 3).

Prerequisites for any signed Safari distribution, none of which exist locally:

1. A SAMS-owned Apple developer team.
2. The distribution route chosen by SAMS: Developer ID signing and notarisation for distribution outside the Mac App Store, or signing of the app and extension plus an App Store Connect archive for App Store distribution. The lead verified these routes against Apple's [Safari distribution guide](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension) through its [DocC JSON](https://developer.apple.com/tutorials/data/documentation/safariservices/distributing-your-safari-web-extension.json). Account-specific certificates and access remain unconfirmed.
3. Production bundle identifiers to replace `com.example.dev.*`, and an approved minimum macOS and Safari version (current deployment targets are packager defaults).
4. A public privacy policy URL that explicitly covers the extension. The existing page is found, but extension coverage is not yet published.

## Item 3: Three-portal acceptance

Three kinds of evidence are kept apart. A cell is blank only where nothing was run.

| Portal | Origin in allowlist | Synthetic fixture in Chromium (Helium) | Live portal in Chromium | Actual Safari |
|---|---|---|---|---|
| Bangor University (`apps.bangor.ac.uk`) | Yes | `npm run test:e2e`: "Bangor: real Copy, Autofill, repeat, safety, and Clear" passed 2026-10-22. Mapping unit tests pass. | Historical, from the 2026-10-09 full-section run (local record `.pstack/full-section-coverage.md`, not in the repository): partial live Autofill on the accessible sections (seven on one seeded lead, repeat filled 0), Programme locked, live acceptance not complete. The Personal Details save was then blocked client-side by required fields recorded as having no CRM source (title, birth nation, ethnicity). Title derivation from gender radios was added later (`bab6e30`), so that list may be out of date. The run predates generic matching, Fill all, CRM documents and the popup redesign. Not re-run today. | Blocked |
| University of Greenwich (`nelson.gre.ac.uk`) | Yes | `npm run test:e2e` Greenwich journey passed 2026-10-22. `npm run test:e2e:fill-all:portals`: checklist run and foreign-application refusal passed. | Historical: login needs a human CAPTCHA; the full path was never completed (last three attempts timed out). Not re-run today and must not be bypassed. | Blocked |
| University of Greater Manchester (`evision.bolton.ac.uk`) | Yes, confirmed 2026-10-15 | `npm run test:e2e:fill-all:portals`: lazy-panel run, save-failure stop, validation-correction rerun, and stale-acknowledgement rejection passed 2026-10-22. Mapping unit tests pass. No Autofill-only loaded-extension journey exists for this portal. | Field inventory only (`docs/history/MANCHESTER.md`, 2026-10-15). A live CRM-to-portal Autofill has not been run. | Blocked |

Today's runs (Helium 0.19.3.1, development build, synthetic pages, 2026-10-22):

| Command | Result |
|---|---|
| `npm test` | 108 of 108 passed. Supporting evidence only. Replaces the stale "61" figure. |
| `npm run test:e2e` | 28 of 28 passed in the lead rerun, exit 0. The initial Sonnet run passed 27 of 28; stale assertion corrected as described below. |
| `npm run test:e2e:fill-all` | 9 of 9 passed. |
| `npm run test:e2e:fill-all:portals` | 12 of 12 passed. |

The initial `test:e2e` failure was "Unmapped university: real toolbar popup fills shared fields in the selected origin only" (`e2e/extension.e2e.mjs`). It expected the failed-frames section to read `Frames not filled (1)`, but `popup.js` `addList` renders the title and count as separate elements. The test owner (Pi GPT 6.1 Sol lead) corrected only that E2E assertion: title, count, one list row and the full failure message are now checked separately. No production code changed and no safety assertion was removed. The lead reran the complete `npm run test:e2e` suite: exit 0, 28 passed, 0 failed, 24.94 seconds including npm. The previously unreachable field-value, excluded-frame and repeat-Autofill checks now pass. Evidence: `tmp/publication-lead-e2e.log` and `tmp/publication-lead-e2e-result.json`; the initial failure remains in `tmp/pub-prep-e2e.log`.

Not run, with reason:

- `npm run test:e2e:live`. It needs the approved PinchTab Helium profile, which is in use by a running browser instance (PID 19066) that must be stopped first, plus live CRM and portal credentials in `.env.local`, and Greenwich needs a human CAPTCHA. It also never touches Greater Manchester. It needs operator approval and a freed profile. It is not feasible for an unattended run.
- Any live CRM write, document upload, draft save or final submit. None was performed.

Human-assisted prerequisites for live acceptance:

- Supervised, approved test applications at each portal, with a CRM test lead that has the needed fields.
- Bangor: a decision on the required Personal Details fields that have no CRM source, before Programme can unlock.
- Greenwich: a person to complete the CAPTCHA.
- Greater Manchester: a live session and a test course with the data-entry tabs visible.
- A recorded boundary on whether drafts may be saved (Fill all saves portal drafts).
- Sanitised per-step fixtures under `fixtures/<portal>/` are still empty in the repository.

## Item 5: Store submission preparation

Drafted locally in [the submission pack](STORE-SUBMISSION-PACK.md), with the proposed privacy wording in [the privacy policy extension addendum draft](PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md):

- Single purpose, per-permission justification, remote code answer, data-use disclosures and listing text for Chrome.
- Reviewer instructions, screenshot and image inventory, and controlled distribution options.
- Store-sized image drafts in `docs/publication/assets/`: two 1280x800 screenshots, a 440x280 promotional image and a 128x128 store icon (artwork at 96x96 inside 16 px transparent padding; the runtime `icon128.png` has no padding and was not changed). They are scaled authentic popup captures from the synthetic E2E fixtures and the existing icon. Local drafts, pending publisher review. No Safari image exists because actual Safari operation is unverified. Inventory and provenance: the pack's section 4 and `assets/MANIFEST.json`.
- Safari and App Store notes, with the official Safari distribution routes verified by the lead through Apple's DocC JSON.

Still outstanding: published extension coverage in the public privacy policy (the URL itself is known), a SAMS developer identity and account, the controlled-distribution choice, publisher approval of the draft store images, an in-product data-handling disclosure (see open decisions), and any upload or submission. These require publisher inputs, external access or separately approved product work; none is claimed complete. All wording about item 4 (SAMS agreement to the expanded scope) is deliberately silent: the pack describes what the code does and claims no approval.

## Open decisions and gaps found

1. **Campora origin** (item 1, excluded). Required before any production build.
2. **In-product disclosure.** Chrome's [Disclosure Requirements](https://developer.chrome.com/docs/webstore/program-policies/policies#disclosure_requirements) and [user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) require prominent disclosure and affirmative consent for user-data handling. The FAQ says this must happen in the product's interface, not only in the policy or store listing. No private-staff-tool exemption was established. The popup has no such agreement step today. This remains a submission gap; a UI and behaviour change needs separate approval and E2E/UI verification, so none was made here.
3. **Stale E2E assertion resolved** by the lead/test owner, with the full 28-case suite now passing as described above.
4. **Expanded scope** (item 4, excluded). The code handles CRM documents, opt-in draft saves and staff-chosen website access. The submission text describes them as they are.
5. **Safari identifiers and signing** need SAMS decisions, as listed under item 2.

Lead/self-review corrected disclosure wording to acknowledge transient CRM authentication information, sensitive contents of selected documents, authorised human access, and the university page's control over autosave and onward processing. No claim is made that filling a field prevents a network transfer or that an unlisted store link restricts installation to staff. This was not an independent review. No UI changed, so a visual acceptance gate was not invoked.

Image follow-up: the lead viewed all four final PNGs, verified the source/output SHA-256 inventory, rebuilt locally and confirmed identical hashes, checked the two 1280x800 screenshots, 440x280 promo and 128x128 RGBA icon dimensions, and checked the icon's transparent-padding bounds `(16,16,112,112)`. These are local synthetic-data marketing drafts, not evidence of actual Safari or live-portal acceptance. The builder depends on Pillow and macOS Helvetica Neue.
