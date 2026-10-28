# SAMS Portal Autofill

A private Chrome extension (Manifest V3) for authorised SAMS staff. It copies student data from a SAMS CRM or Campora profile and fills empty fields on university application forms.

## What it does

- **Copy.** Staff open one student profile and select **Copy from CRM**. The extension reads the visible fields. It keeps them in `chrome.storage.session` for 30 minutes of inactivity.
- **Autofill.** Staff open a university application page and select **Autofill this page**. The extension fills empty fields only.
- **Attach.** Staff can attach CRM documents to upload fields, one file at a time.

## What it does not do

- It never submits, pays for, declares, or confirms an application.
- Autofill never saves or continues to the next page.
- It has no login, licence server, AI service, or backend of its own.
- Its only CRM API calls are read-only. They list the open student's documents and fetch one file when staff attach it.

## Supported portals

| Portal | Support |
|---|---|
| University of Greenwich | Saved field mapping |
| Bangor University | Saved field mapping |
| University of Greater Manchester | Saved field mapping |
| Other HTTPS university sites | Shared matching for common personal and contact fields |

Shared matching fills a field only when one control clearly asks for that value. Staff complete these fields themselves: account, password, payment, declaration, referee, emergency contact, agent, education, and employment fields. Split dates, radio groups, search pickers, and duplicate fields also stay manual.

On other university sites, **Allow this website** asks the browser for access to that one site. It does not grant access to other sites. Only frames with the same origin as the selected page receive student data.

Per-portal status is in [PORTALS.md](PORTALS.md).

## Setup

You need [Node.js](https://nodejs.org/) with npm and the `zip` command. The project was developed on Node 26. Other versions are untested.

Install the locked dependencies once after you clone the repository:

```bash
npm ci
```

The only dependency is `playwright-core`. `npm test` and `npm run test:e2e` use it. The build commands use only Node built-ins. Use `npm install` only when you change dependencies.

## Build

Development build:

```bash
npm test
npm run build
```

Open `chrome://extensions`, turn on Developer mode, and load `dist/chrome`. The development build also allows the mock CRM at `http://localhost:3000` and the mock portal at `http://localhost:3001`.

Production build:

```bash
npm run build:prod
```

This writes `dist/chrome` and `dist/sams-portal-autofill-prod.zip`. The production manifest allows only the SAMS CRM, Campora, and the three portal origins. It has no localhost entry and no `<all_urls>`. Each GitHub release has the production zip attached. See [docs/INSTALL-AND-DEPLOY.md](docs/INSTALL-AND-DEPLOY.md) for the release steps.

## Safari for macOS (development only)

```bash
npm run build:safari        # dist/safari-webextension
npm run build:safari:app    # unsigned macOS app
```

The Xcode project is in `safari/`. It has placeholder identifiers and no signing. Nobody has tested the extension in an installed Safari. See [safari/README.md](safari/README.md) and the [Safari checklist](e2e/safari/README.md).

## How staff use it

1. Open one student profile in SAMS CRM or Campora.
2. Select **Copy from CRM**.
3. Open the university application form. Open the extension from the browser toolbar on that page.
4. If **Allow this website** appears, check the host name. Select it to give access to that site only. The extension does not fill anything until you select **Autofill this page**.
5. Select **Autofill this page** on each form step.
6. To attach documents, keep SAMS CRM open in a tab. Select **Attach CRM documents**. Choose a document for each upload field. Select **Attach**.
   - **Show on page** scrolls to the field and outlines it. It does not change the field.
   - If the portal hides its file input behind its own widget, the popup tells you. Attach the file in the portal.
   - Attach only gives the file to the browser field. Check that the portal accepted it. Some portals upload the file immediately.
7. Check all filled fields and all fields marked for manual review. Then save and submit in the portal yourself.
8. Select **Clear** when you finish.

The full guides are [docs/USER-HANDOVER.md](docs/USER-HANDOVER.md) (staff) and [docs/TECHNICAL-HANDOVER.md](docs/TECHNICAL-HANDOVER.md) (engineers and IT).

## Repository layout

| Path | Contents |
|---|---|
| `config/` | Approved origins, CRM label map, shared synonyms, and one mapping file per portal in `config/portals/` |
| `src/` | CRM reader, document access, fill engine, page handler, background worker |
| `popup.html`, `popup.js` | Toolbar popup |
| `scripts/` | Build scripts for Chrome and Safari |
| `safari/` | macOS containing app and Safari extension target |
| `test/` | Node unit tests and browser DOM tests |
| `e2e/` | Chromium end-to-end tests, live test runners, and the Safari checklist |
| `docs/` | Guides, codebase map, per-portal field maps, and store drafts |
| `docs/docx/` | Word copies of the README, `PORTALS.md`, and the guides in `docs/` |

[docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md) describes each file. Regenerate a Word copy after you edit its source:

```bash
pandoc docs/NAME.md -o docs/docx/NAME.docx
```

## Tests

- `npm test` runs the unit and DOM tests.
- `npm run test:e2e` loads the extension in a visible Chromium browser and tests it on synthetic pages.
- `npm run test:e2e:live` and `npm run test:e2e:documents:live` test real CRM and portal pages without saving. They need credentials and an approved browser profile. See [e2e/README.md](e2e/README.md).

## Limits

- The tests use synthetic pages. Only one live run is recorded: Campora to Bangor, without saving. Run the live tests for the other portals before you rely on them.
- The Safari build has not been tested in an installed Safari.
- SAMS owns the Chrome Web Store account, the privacy policy, and Safari signing.
