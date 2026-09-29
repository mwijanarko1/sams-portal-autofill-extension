# SAMS Portal Autofill — Browser Extension

A **Chrome/Chromium Manifest V3** extension that fetches student CRM data from a local SAMS backend and autofills university portal forms using heuristic field matching.

> ⚠️ **Local/demo only.** This extension is designed for a development environment.  
> It does not authenticate, does not send data to any third party, and never auto-submits forms.

---

## Features

- **Fetch Profile** — Pulls the CRM snapshot for a given student ID from the backend.
- **Auto Scan** — Automatically detects all visible form fields (inputs, selects, textareas) on the current page whenever the popup opens or a profile is fetched, showing their labels/names.
- **Autofill Page** — Matches CRM fields to form fields using a synonym-based heuristic (e.g. `givenName` → "First name", `dateOfBirth` → "DOB") and fills them.
- **Safety-first** — Warns you to log into the portal manually first. Never clicks submit/save. Never stores CRM profile data beyond the current popup session.

---

## Loading the Extension in Chrome

1. **Clone or copy** this folder to your machine:
   ```
   /path/to/sams-portal-autofill-extension/
   ```

2. Open Chrome and navigate to `chrome://extensions`.

3. Enable **Developer mode** (toggle in the top-right corner).

4. Click **Load unpacked** and select the `sams-portal-autofill-extension` folder.

5. The extension icon should appear in the toolbar. Pin it for easy access.

---

## Usage

### Prerequisites

- The SAMS CRM backend must be running locally (e.g. at `http://localhost:3000`).
- The mock university portal (or any portal page with forms) should be open in a tab.
- You must **log into the portal manually** before using autofill.

### Workflow

1. Click the extension icon to open the popup.
2. The **Backend URL** is hardcoded to `http://localhost:3000` (not user-configurable).
3. Enter the **Student ID** (defaults to `1`).
4. Click **📡 Fetch Profile** to load CRM data. The number of extracted fields is shown.
5. Navigate to the portal page — form fields are scanned automatically when the popup opens or after fetching a profile.
6. Click **✏️ Autofill Page** to fill matching fields.
7. **Review the filled data** in the portal before submitting manually.

---

## Backend Configuration

The extension fetches CRM data from your local backend. Two API routes are supported:

1. **Preferred:** `GET /api/extension/student-profile?studentId=1` — A dedicated CORS-enabled route.  
   If the backend is the [sams-crm-ai-demo](https://github.com/your-org/sams-crm-ai-demo) repo, this route has been added.

2. **Fallback:** `GET /api/crm?studentId=1` — The generic CRM snapshot endpoint (may not have CORS headers).

The backend URL is pre-configured to `http://localhost:3000`. To change it, update `DEFAULT_BACKEND_URL` in `popup.js`.

### CORS Note

The extension attempts the dedicated route first. If it receives a 404, it falls back to the generic route.  
If your backend does not set CORS headers and you need to use an origin other than `localhost:3000`, add CORS middleware to your backend or use the dedicated route provided in this project.

---

## How Field Matching Works

1. The CRM snapshot is parsed into a flat key→value map (mirroring the backend's `buildFieldMap`).
2. The content script scans the page for visible, enabled form fields and derives a human-readable label for each (via `label[for]`, wrapping `<label>`, `aria-label`, `placeholder`, `name`, or `id`).
3. Each CRM key is matched against each form field's combined identifier (name + id + label) using a synonym-based scoring system:
   - **Exact match** → 100 points
   - **Prefix/suffix match** → 85 points
   - **Contains match** → 65 points
   - **Partial word overlap** → up to 50 points
4. Fields scoring ≥ **50** points are filled. Others are reported as "unmatched".

---

## Field Synonyms (built-in)

The extension includes a comprehensive synonym map covering:

| CRM Key | Matched Labels |
|---------|---------------|
| `givenName` | first name, forename, given name, first |
| `familyName` | last name, surname, family name, last |
| `dateOfBirth` | date of birth, DOB, birth date, bday |
| `gender` | gender, sex |
| `maritalStatus` | marital status |
| `nationality` | nationality, citizenship |
| `location` | address, street address, current address |
| `phone` | phone, telephone, mobile, tel |
| `email` | email, e-mail, email address |
| `emergencyName` | emergency contact, next of kin |
| `emergencyFirstName` / `emergencyLastName` | Ulster nominated modal first/last name |
| `emergencyRelationship` | relationship to you (Parent, Guardian, …) |
| `emergencyEmail` / `emergencyPhone` | nominated/emergency email & phone |
| `emergencyPhoneCountryCode` | phone country dialing code (modal) |
| `emergencyDateOfBirth` | nominated contact DOB |
| `occupation` | employment occupation (Ulster SOC picklist) |
| `cvJobDescription` | my job description |
| `mainResponsibilities` | my main responsibilities |
| `passportNumber` | passport number, passport, **document number** (Ulster) |
| `preferredCourse` | course, subject, program |
| `preferredIntake` | intake, semester, term, start date |
| … and 40+ more |

See `content.js` → `SYNONYM_MAP` for the complete list.

---

## Security & Privacy

- **No credential collection.** The extension does not read or transmit passwords, tokens, or login cookies.
- **No auto-submit.** The extension never clicks submit/save buttons.
- **No persistent CRM data.** The fetched CRM profile exists only in the popup's JavaScript memory. `chrome.storage.local` may store a small `{ id, name }` selection for convenience.
- **Local-only.** The extension is designed to work with a local development backend. It does not phone home.
- **Skip-if-filled.** The content script reads whether a field already has a value so it does not overwrite portal/account prefill (e.g. Nationality). It does not exfiltrate those values.
- **No auto-submit.** Combobox fills only click list options; never submit/save/navigation.

---

## University portals (meeting prep)

See **[PORTALS.md](./PORTALS.md)** for the test matrix covering Sunderland, University of Greater Manchester, Keele, and Ulster University QA.

**Per-portal field matrices:**

- [SUNDERLAND.md](./SUNDERLAND.md) — Sunderland Online Applications (live picklists)
- [ULSTER_QA.md](./ULSTER_QA.md) — Ulster University QA / apply.qahighereducation.com (**v2.3.10**)

### v2.2+ improvements for real portals

- **All-frame injection** — scans and fills fields inside iframes (common on e:Vision / Salesforce agent portals).
- **UK date formatting** — CRM ISO dates (`1998-01-01`) map to `DD/MM/YYYY` on text DOB fields and `YYYY-MM-DD` on `input[type=date]`.
- **Broader UK admissions synonyms** — forenames, country of nationality, correspondence address, programme title, entry point, etc.

### v2.3.10 Ulster QA — Nominated / Emergency Add New

- Full **NEW NOMINATED CONTACT** modal matrix (Relationship, First/Last, Dialing Code, Phone, Email, DOB).
- Exclusive locks so applicant name/phone/email/DOB never fill the modal (and vice versa).
- CRM seed + popup map `emergencyFirstName`, `emergencyLastName`, `emergencyRelationship`, `emergencyEmail`, `emergencyPhone`, `emergencyPhoneCountryCode`, `emergencyDateOfBirth`.

### v2.3.9 Ulster QA

- **Closed shadow pierce** via `chrome.dom.openOrClosedShadowRoot` (Salesforce Flow picklists).
- **Radio groups** — Fee Payment Method, Yes/No previous apply / previous name.
- **Ulster-exclusive labels** — Sex Identifier, Ethnicity, Dependants, Current Domicile, Phone Country Code (`United Kingdom (+44)`).
- **Title `Mr.`** and funding **Self Funding** (no hyphen) option aliases.

## Limitations

- **Heuristic matching is not perfect.** Some fields may not be matched if the form labels use unusual phrasing not covered by the synonym map.
- **No framework-specific optimizations.** The extension dispatches native `input` and `change` events, which works with most JS frameworks (React, Vue, Angular) but may not trigger every framework's reactivity system.
- **Select fields require exact or partial text matches.** If the option text in the form differs significantly from the CRM value, the field may be skipped.
- **Only one page at a time.** Multi-step wizards need Autofill re-run on each step. The popup uses the active tab (all accessible frames).
- **No login automation.** You must log into the portal manually before running autofill.

---

## Security Notes

### Content Script Injection

The extension no longer uses a broad `<all_urls>` content script declaration.
Instead, the content script is **injected on demand** via `chrome.scripting`
(activeTab + scripting permissions) only when you trigger a scan or
autofill from the popup. This follows the principle of least privilege.

### CORS Restriction

The backend route (`/api/extension/student-profile`) validates the `Origin` header
and only responds to:
- `chrome-extension://` origins (in dev)
- `http://localhost:*` and `http://127.0.0.1:*` (via proper hostname matching)
- The exact origin specified by `EXTENSION_ORIGIN` env var (if set)

To restrict the extension to a single chrome-extension:// origin in CI or
production-like environments, set:
```
EXTENSION_ORIGIN=chrome-extension://<your-extension-id>
```
on the backend. When this var is set, all other origins (including generic
chrome-extension:// origins) are rejected.

### Known Risks (Local Dev)

1. **chrome-extension:// origin allowance** — In dev mode (no `EXTENSION_ORIGIN`),
   *any* Chrome extension can call this endpoint if it knows the URL. This is
   acceptable for local dev but should not be deployed publicly.
2. **No authentication** — The endpoint returns the full CRM snapshot without
   auth. Do not expose this route on a public network.
3. **Field value overwrite** — The content script writes values to form fields.
   Always review filled data before manual submission.

---

## Development

### File structure

```
sams-portal-autofill-extension/
├── manifest.json      # Chrome Extension Manifest V3
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic (fetch, buildFieldMap, injection, messaging)
├── content.js         # Content script (scan, match, fill)
└── README.md          # This file
```

### Backend dedicated route (added to CRM repo)

```
sams-crm-ai-demo/src/app/api/extension/student-profile/route.ts
```

A lightweight CORS-enabled endpoint that returns the CRM snapshot for a given `studentId`.

### Testing

1. Start the CRM backend:
   ```
   cd sams-crm-ai-demo
   npm run dev
   ```

2. Start the mock portal:
   ```
   cd university-portal-demo
   npx serve . -p 3001
   ```

3. Load the extension as described above.

4. Open `http://localhost:3001` in a browser tab, log in with `demo-admissions` / `SAMS-demo-2026!`.

5. Open the extension popup and run the workflow.

---

## License

MIT — For local/demo use only. Not intended for production deployment.
