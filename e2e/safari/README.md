# Safari manual acceptance (synthetic fixtures)

See also [docs/CODEBASE_MAP.md](../../docs/CODEBASE_MAP.md) and [safari/README.md](../../safari/README.md).

No automated runner exists for the installed Safari extension. Playwright WebKit,
SafariDriver and `npm run test:e2e` do not exercise Safari's extension popup, worker,
permissions or messaging. Use this manual checklist, and record each case as Passed,
Failed or Blocked. A case that cannot run is Blocked, not Passed.

## Setup

1. Check who owns ports 3000, 3001 and 3002. For each port, list the listener, then
   that process's working directory:

   ```sh
   lsof -nP -iTCP:3000 -sTCP:LISTEN
   lsof -a -p <PID> -d cwd
   ```

   If another service owns a port, leave it running unless its owner approves stopping
   it. Record every fixture case as Blocked (port conflict), naming the port and owning
   project. Do not stop processes just to run this checklist. The fixture server checks
   the ports itself and refuses to start while anything answers on them.
2. Build the development resources and app: `npm run build:safari:app`.
3. Enable the extension as described in [safari/README.md](../../safari/README.md).
   Use a dedicated test profile or user account.
4. Start the fixtures: `npm run safari:fixtures`.

Known blocker on 2026-10-12: ports 3000 and 3001 on the implementation Mac were owned by
unrelated Next.js development servers (`ihsaan-member-platform` and
`ihsaan-public-website`). The fixture cases stay Blocked there until those owners free the
ports. This checklist does not change the allowlist or move fixtures to other origins.

The server binds only to `127.0.0.1` and `::1`, serves synthetic pages to `GET`
requests, and logs and refuses any other method.

| Page | URL | Role |
|---|---|---|
| CRM profile | `http://localhost:3000/agent/leads/full-profile/e2e-synthetic/` | Approved development CRM origin and profile path |
| CRM non-profile | `http://localhost:3000/agent/dashboard` | Approved origin, rejected path |
| Bangor DOM | `http://localhost:3001/bangor/` | Approved development portal origin |
| Greenwich DOM | `http://localhost:3001/greenwich/` | Approved development portal origin |
| Frames | `http://localhost:3001/frames/` | Selected top frame, cross-origin `127.0.0.1:3001` development portal child, cross-origin `localhost:3002` child |

Portal pages show a **Fixture snapshot** with each control's value and the page's
click, submit and change counters. Compare snapshots instead of reading each field.

**Mapping boundary:** Greenwich and Bangor mappings apply only on their production
origins. On these localhost pages the engine uses generic matching, so values differ from
`npm run test:e2e`. Portal-specific Safari parity needs production-origin fixtures or a
supervised live journey. Portal-specific Safari runtime behavior remains Blocked and
unverified until one is approved.

## Chrome reference

Run the same cases in Chrome with `npm run build` and `dist/chrome` loaded unpacked.
Record the Chrome snapshot for each portal case. Safari passes a fill case only when its
snapshot matches Chrome's on the same page.

**Superseded 2026-10-15:** generic matching and frame targeting changed after this run.
Unmapped pages now use the conservative generic registry (no login, referee, or split-DOB
fills) and only frames with the top page's exact origin are filled, so the `127.0.0.1:3001`
child is no longer filled. Re-record the Chrome reference before comparing Safari; the
numbers below are kept only as history.

A reference run on 2026-10-12 (Helium, development build, source after this Safari
change) observed these results on the fixture pages:

- Copy on the profile copied 18 fields. Copy on the dashboard was refused.
- Bangor DOM: 8 fields filled, clicks 0, submissions 0, password and file empty.
  Generic matching also filled `login_email` and only the DOB day.
- Greenwich DOM: 10 fields filled, clicks 0, submissions 0. Generic matching also filled
  `ud18` and `ud92grade`, and only the DOB day.
- Repeat Autofill filled one more field on each page: the DOB month
  (`id_dob_month`, `bday_mm`).
- Frames: the top frame and the approved `127.0.0.1:3001` child were filled. The
  unapproved `localhost:3002` child had no changes.

Those extra fills happen because production portal mappings, blocked controls and split
dates do not apply on localhost. They are the parity reference for these pages, not
accepted portal behavior.

## Cases

| # | Steps | Expected |
|---|---|---|
| S1 | Open the app. | Help text, enablement state, and no student data. |
| S2 | Open the toolbar popup on an unrelated website. Choose Copy, then Autofill. | Copy says to open an approved SAMS CRM profile. Autofill is disabled with no student. |
| S3 | With website access set to Ask or Deny for `localhost:3000`, open the CRM profile and choose Copy. | Website-access guidance. No student copied. |
| S4 | Allow access, then choose Copy on the CRM profile. | Student `Aisha Rahman`, copied time and countdown shown. If the popup says student data actions are only available from the extension popup, record a messaging failure: Safari's sender URL differs from `runtime.getURL("popup.html")`. |
| S5 | Choose Copy on the CRM non-profile page. | Refused. The earlier student is still shown. |
| S6 | Autofill the Bangor and Greenwich DOM pages. | Snapshot matches the Chrome reference. Clicks 0, submissions 0. Password and file controls empty. |
| S7 | Autofill again on the same page. | Snapshot matches the Chrome reference repeat run. |
| S8 | Autofill the Frames page. | Top frame filled. Both cross-origin children's snapshots unchanged, and the popup does not report them as failed frames. |
| S9 | Open the popup in two windows. Choose Clear in one, then Autofill in the other. | Second popup reports no copied student and hides it. Page snapshot unchanged. |
| S10 | Copy, close the popup, wait for Safari to suspend the worker, reopen. | Same student and expiry. |
| S11 | Copy, then quit and relaunch Safari. | No student shown. |
| S12 | Copy, disable and re-enable the extension. | No student shown. |
| S13 | Leave a copied student for 30 minutes without Autofill, including a sleep and wake. | Student removed. Autofill disabled. |
| S14 | Use the popup with keyboard and VoiceOver. Expand long result lists. | All controls reachable and announced. Lists scroll. |
| S15 | In Web Inspector for the extension, inspect `storage.local` and `storage.sync`. | Both empty. |
| S16 | Open a private window on a fixture page. | Record behavior only. Release policy is not approved. Make no isolation claim. |

## Record

For each case, record:

- macOS and Safari version, and install type: containing app or temporary extension.
- Extension version and source commit.
- Result and failure category: permission, messaging, storage, DOM value, popup UI or
  other.
- The synthetic fixture snapshot when relevant. Never record real student data or
  authenticated URLs.

Keep Safari results separate from the Chromium suite and from live-test reports.
