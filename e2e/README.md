# Extension E2E

Repository layout and related docs: [docs/CODEBASE_MAP.md](../docs/CODEBASE_MAP.md). Safari has a separate manual checklist under [e2e/safari/README.md](safari/README.md).

## Offline regression

```sh
npm ci
npm run test:e2e
```

The runner loads the real MV3 extension from current source into an isolated
temporary Helium profile. It uses the real popup page, background session cache,
CRM reader, and portal engine. It selects the actual active browser tab, rather
than mocking Chrome APIs. The popup runs as an extension tab, not the native
toolbar popover.

Synthetic HTTPS pages reproduce the confirmed CRM agent route, mapped Bangor,
Greenwich, and Manchester Personal Details control IDs, and an unmapped university origin that has no
allowlist entry, mapping, or host permission. Browser routing supplies fixture HTML and blocks all
other HTTP requests. No live credentials or applicant data are used.

Coverage:

- CRM Copy and portal Autofill on Bangor and Greenwich, plus targeted Manchester
  Personal Details mapping checks. This is not a complete Manchester tab journey.
- Greenwich split DOB on Statistical Information at a previous address-save URL,
  and employment dates on both display and previous-save URLs, via form actions.
- Greenwich country of birth uses nationality when the CRM has no birth country,
  preserves an existing portal selection, and leaves cached student data unchanged.
- Greenwich funding maps self-funded variants to private finance and leaves
  unsupported funding values manual, including inherited-property-name inputs.
- Greenwich intake derives from CRM start month and year when no explicit intake
  exists. Explicit intake wins. Job title fills the job description, not Full-time
  or Part-time. Referee fields never receive applicant contact details.
- Greenwich and Manchester derive missing residence from the CRM address country.
  Manchester Personal Details also derives birth country from nationality and
  preserves an existing residence. Derived values do not change the copied cache.
- Existing values preserved and repeated Autofill does not duplicate values.
- Blocked DOB controls, referee fields, signatures, authentication fields,
  finance-name controls, chat, uploads, and secondary qualification rows.
- No portal submit, pay, or save clicks.
- Clear removes the session cache and visibly hides the student card.
- Session expiry disables Autofill and clears the cache.
- Unapproved origins rejected; no local or sync storage of student data.
- Unmapped university through the real toolbar popup: the tab-popup page cannot
  reach it and shows website-access guidance; after the browser's toolbar action
  trigger grants `activeTab`, shared fields fill in the top page and a same-origin
  child frame only. Login, emergency, referee, agent, education, payment, and
  declaration fields, a sandboxed same-URL frame, a `srcdoc` frame, and an
  embedded Greenwich portal stay unchanged. Repeat Autofill changes nothing.

The toolbar popup is opened with the CDP `Extensions.triggerAction` command,
which the test-only `--enable-unsafe-extension-debugging` flag enables. Playwright
does not expose that popup, so the test drives it through its own CDP target
session. Screenshots are written to `tmp/general-portal-evidence/`.

Helium is visible by default. The installed executable is
`/Applications/Helium.app/Contents/MacOS/Helium`. Override `SAMS_E2E_BROWSER` only
with an explicitly selected compatible Chromium executable.
`SAMS_E2E_HEADLESS=1` is diagnostic only: the installed Helium aborted fixture
navigation in headless mode. It is not the verified test mode.

Temporary profiles and staging files remain under ignored `tmp/e2e-*`. Existing
`dist` files and authenticated profiles are never replaced by offline tests.
Test staging is not a release package and does not bypass the production build's
incomplete-origin release gate.

## Live random-sample smoke test

Live testing is an explicit opt-in, not part of `npm test` or the offline suite.
Use only an approved PinchTab automation profile. Stop its browser instance first
to avoid a profile lock. Never point this at a normal personal browser profile.

The ignored extension `.env.local` supplies these keys:

```text
SAMS_CRM_USERNAME
SAMS_CRM_PASSWORD
BANGOR_USERNAME
BANGOR_PASSWORD
GREENWICH_LOGINID
GREENWICH_PIN
GREATER_MANCHESTER_USERNAME
GREATER_MANCHESTER_PASSWORD
```

Greater Manchester credentials are not reused for Greenwich. Missing portal keys
are reported as blocked, not passed. Existing sessions are reused when possible;
otherwise a login is attempted once. CAPTCHA or human verification requires a
human handoff, not a bypass.

The default portal list is Bangor, Greenwich, and Greater Manchester. Each portal
runs only when both of its credential keys exist; missing keys produce a blocked
entry. Set `SAMS_E2E_PORTALS=greater-manchester` to select Manchester alone, or use
a comma-separated list of `bangor`, `greenwich`, and `greater-manchester`.

```sh
SAMS_E2E_PROFILE='/absolute/path/to/approved/.pinchtab/profiles/profile-directory' \
  npm run test:e2e:live -- --no-save --random-leads
```

The runner uses the real loaded extension in visible Helium. It randomly selects
up to three distinct profiles from the currently visible CRM Lead Management
page. `SAMS_E2E_SAMPLE_COUNT=1` or `2` reduces that count; the maximum is three.
It does not claim coverage of the entire lead database or every portal section.

For each sample, it copies the current visible CRM profile, fills an existing
portal form, checks that existing and blocked fields are unchanged, repeats
Autofill, and clears the student cache. Bangor's configured data-entry forms and
Greenwich's configured sections, including Statistical and Programme Information,
are targeted. Greater Manchester uses the existing application hub at
`https://evision.bolton.ac.uk` and clicks only the PD, CD, QU, and EX tab links.
Each asynchronously loaded `#TAB-MAIN-<code>` pane gets up to 30 seconds to expose
its controls before the same Autofill checks run. Samples reload the hub to discard
unsaved values. The runner never clicks Manchester Save, Save and Continue, Submit,
or the Submission tab. An unavailable existing draft is a blocker. No draft or
lead is created, no documents uploaded, and no application submitted or saved in
the default no-save mode.

After login, non-GET/HEAD requests are blocked. Only the current login form's POST
is allowed while authenticating. If a portal attempts an autosave or another
write, the request is blocked and the test stops. Manchester tab loading gets no
POST exception: if it requires a non-GET/HEAD request, the portal is marked blocked
with `blockedTabLoad`, and `blockedWriteStages` records `tabLoadBlocked: true`, the
tab code, method, and redacted SITS routine path (without query strings or record
ids). Unknown paths remain `[redacted]`. The lead must inspect this evidence and
ask for approval of a single confirmed read-only request before any allowlist
change. No such request is allowed by this runner.

Unsaved form values are discarded by reloading or closing the test browser. The
overall deadline is 10 minutes, paused for a human CAPTCHA handoff. The existing
`--save-bangor-personal-once` exception requires separate explicit approval and
does not permit any Manchester saves or tab-loading POSTs.

The runner never prints credentials or applicant field values. Its redacted report
is `tmp/extension-e2e/live-report.json`: sample numbers, CRM field keys, counts,
and preservation/cache-clear results. Each completed form includes `filledControls`,
an array of control ids or names changed by the first Autofill, never their values,
alongside `changedFields`, `emptyBefore`, `emptyAfter`, and `repeatFilled`.
`emptyAfter` contains control identifiers, not values. A listed identifier proves
that control changed, not that the CRM-derived value is correct. Existing values
are preserved, so an already populated mapped control need not appear. This report
must remain ignored.

## Verification boundaries

Offline success verifies the loaded extension on representative synthetic DOMs,
not current portal layouts, native toolbar behavior, or every live CRM layout.
Live authentication alone is not a CRM-to-portal E2E pass. Bangor Programme can
require saving Personal first; with the no-save policy it remains unverified unless
already unlocked. Greenwich live testing requires its own credentials and an
existing draft. Inspect the report's blocked and failure entries before claiming
completion.

## Security evidence boundary

The current automated baseline at source revision `dbb76d8` is 126/126 supporting
tests (`npm test`) and 50/50 loaded-extension E2E cases (`npm run test:e2e`).
Regenerate these counts by running the commands rather than treating them as
permanent totals. The document cases prove metadata-only Copy, explicit selected-file
fetch, exact PDF and JPEG transfer, occupied-input protection, failure handling,
Clear, and expiry on synthetic pages.

They do not prove that CRM media links require login, that employee revocation
invalidates existing sessions, or that devices, clipboards, and university uploads
are securely erased. No offboarding simulation or live upload was performed for
the handover update. Those controls require approved checks by the system owners.
See [the technical handover](../docs/TECHNICAL-HANDOVER.md#employee-offboarding-and-device-loss).
