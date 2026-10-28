# End-to-end tests

For the file layout, see [docs/CODEBASE_MAP.md](../docs/CODEBASE_MAP.md). Safari has its own manual checklist: [safari/README.md](safari/README.md).

## Offline tests (synthetic pages)

```sh
npm ci
npm run test:e2e
```

The runner loads the extension from the current source into a temporary Helium profile. It uses the real popup page, the real background session cache, the real CRM reader, and the real portal engine. It selects the active browser tab. It does not mock the Chrome APIs. The popup runs as an extension tab, not as the native toolbar popover.

Synthetic HTTPS pages stand in for the CRM and the portals:

- the confirmed CRM agent route,
- the control IDs of the mapped Bangor, Greenwich, and Manchester Personal Details pages,
- an unmapped university origin that has no allowlist entry, no mapping, and no host permission.

Browser routing supplies the fixture HTML and blocks all other HTTP requests. The tests use no live credentials and no applicant data.

### Approved-rule regressions

The `Approved rules:` cases in `extension.e2e.mjs` cover the [2026-10-28 contract](../docs/portal-maps/APPROVED-RULES.md). They use `*-approved-mapping.html` fixtures and the existing Campora asynchronous Profile fixture. Both approved CRM origins are present in the test manifest. Campora's standalone reader harness is removed for this runner, so only the installed extension performs Copy.

Coverage includes nationality/UK/EU distinctions, unknown and ambiguous inputs, fixed agency name, separate home and correspondence addresses, conditional correspondence reveal, legal name, reference isolation, missing/incomplete addresses, reordered street numbers, past versus current/future education dates, UK-specific refusal records from both CRM layouts, existing values, cache immutability, repeat fills and no Save/Submit clicks. A synthetic Campora refusal table verifies the recognised table shape, not the existence of a live refusal record.

Screenshots from representative passing states are written under `tmp/approved-rules-evidence/`. They show appearance; the assertions prove interaction behaviour. Native Safari and authenticated live portal checks remain separate. See the [verification record](../docs/portal-maps/APPROVED-RULES-VERIFICATION.md).

### What the tests cover

- CRM Copy and portal Autofill on Bangor and Greenwich. Targeted checks of the Manchester Personal Details mapping. These are not a complete Manchester tab journey.
- Greenwich split date of birth on Statistical Information, including a previous address-save URL. Employment dates on the display URL and the previous-save URL, using form actions.
- Greenwich country of birth. It uses nationality when the CRM has no birth country. It keeps an existing portal selection. It leaves the cached student data unchanged.
- Greenwich funding. Self-funded variants map to private finance. Unsupported funding values stay manual, including inputs with inherited property names.
- Greenwich intake. It comes from the CRM start month and year when no explicit intake exists. An explicit intake wins. Job title fills the job description, not Full-time or Part-time. Referee fields never receive the applicant's contact details.
- Residence on Greenwich and Manchester. It comes from the CRM address country when missing. Manchester Personal Details also derives birth country from nationality and keeps an existing residence. Derived values do not change the copied cache.
- Existing values stay. A repeated Autofill adds no duplicates.
- Blocked controls stay empty: date-of-birth controls, referee fields, signatures, authentication fields, finance-name controls, chat, uploads, and secondary qualification rows.
- The tests never select a portal submit, pay, or save control.
- Clear removes the session cache and hides the student card.
- Session expiry disables Autofill and clears the cache.
- The extension rejects unapproved origins. It does not use local or sync storage for student data.
- An unmapped university through the real toolbar popup:
  - The tab-popup page cannot reach it. It shows website-access guidance.
  - After the toolbar action grants `activeTab`, shared fields fill in the top page and in a same-origin child frame only.
  - These stay unchanged: login, emergency, referee, agent, education, payment, and declaration fields, a sandboxed same-URL frame, a `srcdoc` frame, and an embedded Greenwich portal.
  - A repeated Autofill changes nothing.
- CRM documents. Copy keeps only valid metadata from the nine listings. Missing token, unauthorized, and network failures leave field Copy working. Accept-filtered choices attach exact PDF and JPEG bytes to the chosen frame input only. An occupied file input is disabled. HTML, redirect, non-OK, and oversized responses fail without attaching. Clear in another popup wins over a scanned selection. Ordinary Autofill never fills file inputs.

### How the tests open the toolbar popup

The tests open the popup with the CDP command `Extensions.triggerAction`. The test-only flag `--enable-unsafe-extension-debugging` enables this command. Playwright does not expose the toolbar popup. The test drives it through its own CDP target session. Screenshots go to `tmp/general-portal-evidence/`.

### Browser choice

The runner opens a visible browser. On macOS it uses Helium at `/Applications/Helium.app/Contents/MacOS/Helium` by default. Set `SAMS_E2E_BROWSER` to the path of another compatible Chromium to use it.

`SAMS_E2E_HEADLESS=1` is for diagnosis only. Helium stopped fixture navigation in headless mode. Headless mode is not a verified way to run the tests.

### Files the tests create

Temporary profiles and staging files go to the ignored folder `tmp/e2e-*`. The offline tests never replace existing `dist` files or authenticated profiles. The test staging is not a release package. It does not bypass the production build's check for incomplete origins.

## Live random-sample smoke test

Live tests are opt-in. `npm test` and the offline suite do not run them.

Use only an approved PinchTab automation profile. The runner refuses a profile that is not under `~/.pinchtab/profiles`. Stop the browser instance of that profile first, to avoid a profile lock. Never point the runner at a normal personal browser profile.

The ignored file `.env.local` supplies these keys:

```text
SAMS_CRM_USERNAME
SAMS_CRM_PASSWORD
CAMPORA_USERNAME
CAMPORA_PASSWORD
BANGOR_USERNAME
BANGOR_PASSWORD
GREENWICH_LOGINID
GREENWICH_PIN
GREATER_MANCHESTER_USERNAME
GREATER_MANCHESTER_PASSWORD
```

Greater Manchester credentials are not used for Greenwich. The runner reports a missing portal key as blocked, not as passed. It reuses an existing session when possible. Otherwise it tries to log in once. A CAPTCHA or other human check needs a person to take over. The runner does not bypass it.

The default portals are Bangor, Greenwich, and Greater Manchester. A portal runs only when both of its credential keys exist. Set `SAMS_E2E_PORTALS=greater-manchester` to run Manchester alone. You can also set a comma-separated list of `bangor`, `greenwich`, and `greater-manchester`.

```sh
SAMS_E2E_PROFILE='/absolute/path/to/approved/.pinchtab/profiles/profile-directory' \
  npm run test:e2e:live -- --no-save --random-leads
```

The runner uses the real loaded extension in a visible Helium window. It picks up to three different profiles at random from the visible CRM Lead Management page. Set `SAMS_E2E_SAMPLE_COUNT=1` or `2` to reduce the number. The maximum is three. The run does not cover the whole lead database or every portal section.

### Campora as the Copy source

Set `SAMS_E2E_CRM=campora`. Give `SAMS_E2E_LEADS_FILE` one or more Campora profile URLs. Random lead selection does not work for Campora.

```sh
SAMS_E2E_CRM=campora \
SAMS_E2E_PROFILE='/absolute/path/to/approved/.pinchtab/profiles/profile-directory' \
SAMS_E2E_PORTALS=bangor \
SAMS_E2E_SAMPLE_COUNT=1 \
SAMS_E2E_LEADS_FILE='/absolute/path/to/campora-leads.json' \
  npm run test:e2e:live -- --no-save
```

The file is a JSON array of URLs like `https://v-sams-backend.samsapply.co.uk/applyuser/show/<id>/profile`. The runner opens the Profile tab and copies the Campora fields. Then it fills the chosen real portal draft. Campora documents stay a manual attachment.

The first supervised Campora-to-Bangor run without saving was on 2026-10-25. Copy returned 30 fields. Bangor education, employment, and finance gained eight filled controls. The run kept existing and blocked values. It made no blocked writes. It cleared the cache. This is one sample. It does not prove full portal or Campora acceptance. The runner does not check that the existing draft belongs to the selected applicant. Treat it as a smoke test of field filling without saving.

### What each sample does

For each sample, the runner:

1. copies the visible CRM profile,
2. fills an existing portal form,
3. checks that existing and blocked fields did not change,
4. repeats Autofill,
5. clears the student cache.

Per portal:

- **Bangor.** It targets the configured data-entry forms.
- **Greenwich.** It targets the configured sections, including Statistical and Programme Information.
- **Greater Manchester.** It uses the existing application hub at `https://evision.bolton.ac.uk`. It selects only the PD, CD, QU, and EX tab links. Each pane loads asynchronously (`#TAB-MAIN-<code>`). The runner waits up to 30 seconds for the controls, then runs the same Autofill checks. Each sample reloads the hub to discard unsaved values. The runner never selects Manchester Save, Save and Continue, Submit, or the Submission tab.

An unavailable existing draft is a blocker. In the default no-save mode, the runner creates no draft and no lead, uploads no documents, and does not submit or save an application.

### Write protection

After login, the runner blocks all requests except GET and HEAD. During login it allows only the POST of the current login form. If a portal tries to autosave or write in another way, the runner blocks the request and stops the test.

Manchester tab loading has no POST exception. If a tab needs a request other than GET or HEAD, the runner marks the portal as blocked with `blockedTabLoad`. `blockedWriteStages` then records `tabLoadBlocked: true`, the tab code, the method, and the redacted SITS routine path (no query string and no record ID). Unknown paths stay `[redacted]`. Inspect this evidence. Get approval for one confirmed read-only request before you change the allowlist. This runner allows no such request.

The runner discards unsaved form values when it reloads or closes the test browser. The total time limit is 10 minutes. The limit pauses for a human CAPTCHA step. The option `--save-bangor-personal-once` is an exception. It needs separate explicit approval. It does not allow any Manchester save or tab-loading POST.

### Report

The runner never prints credentials or applicant field values. The redacted report is `tmp/extension-e2e/live-report.json`. It holds sample numbers, CRM field keys, counts, and the results of the preservation and cache-clear checks. Each completed form lists `filledControls` (the IDs or names of controls that the first Autofill changed, never their values). It also lists `changedFields`, `emptyBefore`, `emptyAfter`, and `repeatFilled`. `emptyAfter` holds control identifiers, not values.

A listed identifier shows that the control changed. It does not show that the CRM-derived value is correct. The runner keeps existing values, so a control that already had a value does not need to appear. Keep this report out of Git.

### Limits of the live test

- The offline tests prove behaviour on representative synthetic pages. They do not prove behaviour on current portal layouts, the native toolbar popover, or every live CRM layout.
- A live login alone is not a CRM-to-portal pass.
- Bangor Programme can need a saved Personal section first. With the no-save rule, Programme stays unverified unless the draft is already unlocked.
- Greenwich live testing needs its own credentials and an existing draft.
- Read the blocked and failure entries of the report before you call a run complete.

## Live document attachment

Run this with the private `.env.local` credentials and an installed Helium:

```sh
npm run test:e2e:documents:live -- --no-save
```

The runner creates its own temporary browser profile. It copies real CRM documents through the extension and visits real Bangor, Greenwich, and Greater Manchester pages. It never answers portal requests with fixtures. It does not create applications. It never selects Save or Submit.

The runner blocks writes other than login. It checks **Show on page**, the exact CRM file bytes in the native file input, and the guard for occupied fields. Then it clears the session cache and deletes its temporary profile. A successful file assignment does not prove a server upload or acceptance by a custom upload widget. The runner reports forms that it cannot reach, and authentication challenges, as blocked, not as passed.

Set `SAMS_DOCUMENT_WAIT_CAPTCHA=1` to pause for a person to log in to Greenwich. During that login the runner allows only the exact login action and the Google reCAPTCHA authentication POST paths. Do not automate the challenge.

Redacted popup screenshots and count-only reports go to the ignored folder `tmp/generic-upload-evidence/`. You can change the folder with `SAMS_DOCUMENT_EVIDENCE`. It must stay inside `tmp/`. `SAMS_DOCUMENT_BASELINE=1` puts the Git HEAD versions of the three changed UI files into the temporary extension. This gives a before-and-after check without changing your working tree.

## What these tests do not prove

The offline tests prove these points on synthetic pages: Copy keeps metadata only, Attach fetches the one chosen file, the exact PDF and JPEG bytes transfer, an occupied input stays protected, failures are handled, and Clear and expiry work.

They do not prove any of these points:

- CRM media links need a login.
- Employee revocation ends existing sessions.
- Devices, clipboards, and university uploads are securely erased.

No offboarding simulation and no live upload is part of these suites. The system owners must check those controls. See the [offboarding checklist](../docs/TECHNICAL-HANDOVER.md#employee-offboarding-and-device-loss).
