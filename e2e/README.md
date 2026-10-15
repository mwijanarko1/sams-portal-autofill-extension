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

Synthetic HTTPS pages reproduce the confirmed CRM agent route, mapped Bangor
and Greenwich control IDs, and an unmapped university origin that has no
allowlist entry, mapping, or host permission. Browser routing supplies fixture HTML and blocks all
other HTTP requests. No live credentials or applicant data are used.

Coverage:

- CRM Copy and portal Autofill on both portals.
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
```

Greater Manchester credentials are not reused for Greenwich. Missing portal keys
are reported as blocked, not passed. Existing sessions are reused when possible;
otherwise a login is attempted once. CAPTCHA or human verification requires a
human handoff, not a bypass.

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
Autofill, and clears the student cache. Only Bangor Personal and Greenwich Name
are targeted. An unavailable existing draft is a blocker. No draft or lead is
created, no documents uploaded, and no application submitted or saved.

After login, non-GET/HEAD requests are blocked. Only the current login form's POST
is allowed while authenticating. If a portal attempts an autosave or another
write, the request is blocked and the test stops. Unsaved form values are discarded
by reloading or closing the test browser. The overall deadline is 120 seconds.

The runner never prints credentials or applicant field values. Its redacted report
is `tmp/extension-e2e/live-report.json`: sample numbers, CRM field keys, counts,
and preservation/cache-clear results. This report must remain ignored.

## Verification boundaries

Offline success verifies the loaded extension on representative synthetic DOMs,
not current portal layouts, native toolbar behavior, or every live CRM layout.
Live authentication alone is not a CRM-to-portal E2E pass. Bangor Programme can
require saving Personal first; with the no-save policy it remains unverified unless
already unlocked. Greenwich live testing requires its own credentials and an
existing draft. Inspect the report's blocked and failure entries before claiming
completion.
