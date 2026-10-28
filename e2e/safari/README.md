# Safari manual checklist (synthetic fixtures)

See also [docs/CODEBASE_MAP.md](../../docs/CODEBASE_MAP.md) and [safari/README.md](../../safari/README.md).

No automated runner exists for the installed Safari extension. Playwright WebKit, SafariDriver, and `npm run test:e2e` cannot test the Safari extension popup, worker, permissions, or messaging. Use this manual checklist. Record each case as Passed, Failed, or Blocked. A case that cannot run is Blocked, not Passed.

## Setup

1. Find out who owns ports 3000, 3001, and 3002. For each port, list the listener and the working directory of its process:

   ```sh
   lsof -nP -iTCP:3000 -sTCP:LISTEN
   lsof -a -p <PID> -d cwd
   ```

   If another service owns a port, leave it running unless its owner approves a stop. Record every fixture case as Blocked (port conflict). Name the port and the owning project. Do not stop processes only to run this checklist. The fixture server checks the ports itself. It refuses to start while anything answers on them.
2. Build the development resources and the app: `npm run build:safari:app`.
3. Enable the extension as described in [safari/README.md](../../safari/README.md). Use a dedicated test profile or user account.
4. Start the fixtures: `npm run safari:fixtures`.

The fixture server binds only to `127.0.0.1` and `::1`. It serves synthetic pages to `GET` requests. It logs and refuses all other methods.

| Page | URL | Role |
|---|---|---|
| CRM profile | `http://localhost:3000/agent/leads/full-profile/e2e-synthetic/` | Approved development CRM origin and profile path |
| CRM non-profile | `http://localhost:3000/agent/dashboard` | Approved origin, rejected path |
| Bangor DOM | `http://localhost:3001/bangor/` | Approved development portal origin |
| Greenwich DOM | `http://localhost:3001/greenwich/` | Approved development portal origin |
| Frames | `http://localhost:3001/frames/` | Selected top frame, a cross-origin `127.0.0.1:3001` development portal child, and a cross-origin `localhost:3002` child |

Portal pages show a **Fixture snapshot**. It lists the value of each control and the click, submit, and change counters of the page. Compare snapshots. Do not read each field by hand.

**Mapping boundary.** The Greenwich and Bangor mappings apply only on their production origins. On these localhost pages, the engine uses generic matching. The values differ from `npm run test:e2e`. To test portal-specific behaviour in Safari, you need production-origin fixtures or an approved live journey. Until then, portal-specific Safari behaviour stays Blocked and unverified.

## Chrome reference

Run the same cases in Chrome. Run `npm run build` and load `dist/chrome` unpacked. Record the Chrome snapshot of each portal case. A fill case passes in Safari only when its snapshot matches the Chrome snapshot of the same page.

Localhost pages use the shared generic registry. Production portal mappings, blocked controls, and split dates do not apply there. Compare Safari with the Chrome result on the same fixture pages. Do not compare it with a production-portal result. The extension fills only frames with exactly the same origin as the top page. So it does not fill the `127.0.0.1:3001` child when the top page is `localhost:3001`.

## Cases

| # | Steps | Expected |
|---|---|---|
| S1 | Open the app. | Help text, enablement state, and no student data. |
| S2 | Open the toolbar popup on an unrelated website. Select Copy, then Autofill. | Copy says to open an approved SAMS CRM profile. Autofill is disabled, because no student is copied. |
| S3 | Set website access to Ask or Deny for `localhost:3000`. Open the CRM profile. Select Copy. | Website-access guidance. No student copied. |
| S4 | Allow access. Select Copy on the CRM profile. | The popup shows student `Aisha Rahman`, the copy time, and the countdown. If the popup says that student data actions are only available from the extension popup, record a messaging failure. The sender URL of Safari differs from `runtime.getURL("popup.html")`. |
| S5 | Select Copy on the CRM non-profile page. | Copy is refused. The earlier student is still shown. |
| S6 | Autofill the Bangor and Greenwich DOM pages. | The snapshot matches the Chrome reference. Clicks 0, submissions 0. Password and file controls are empty. |
| S7 | Autofill again on the same page. | The snapshot matches the Chrome reference of the repeat run. |
| S8 | Autofill the Frames page. | The top frame is filled. The snapshots of both cross-origin children do not change. The popup does not report them as failed frames. |
| S9 | Open the popup in two windows. Select Clear in one. Select Autofill in the other. | The second popup reports no copied student and hides it. The page snapshot does not change. |
| S10 | Copy. Close the popup. Wait until Safari suspends the worker. Open the popup again. | The same student and expiry show. |
| S11 | Copy. Quit and restart Safari. | No student shows. |
| S12 | Copy. Disable and enable the extension. | No student shows. |
| S13 | Leave a copied student for 30 minutes without Autofill. Include a sleep and wake of the computer. | The student is removed. Autofill is disabled. |
| S14 | Use the popup with the keyboard and with VoiceOver. Expand long result lists. | You can reach and hear all controls. The lists scroll. |
| S15 | In Web Inspector for the extension, inspect `storage.local` and `storage.sync`. | Both are empty. |
| S16 | Open a private window on a fixture page. | Record the behaviour only. SAMS has not approved a private-browsing policy. Do not claim isolation. |

## What to record

For each case, record:

- the macOS and Safari versions, and the install type (containing app or temporary extension),
- the extension version and the source commit,
- the result and the failure category (permission, messaging, storage, DOM value, popup UI, or other),
- the synthetic fixture snapshot, when it applies.

Never record real student data or authenticated URLs. Keep Safari results separate from the Chromium suite and from live-test reports.
