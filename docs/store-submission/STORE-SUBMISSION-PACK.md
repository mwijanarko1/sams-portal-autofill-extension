# Store submission pack (draft)

Status date: 2026-10-22, extension version `0.1.0`. Everything here is draft text prepared locally from the current source. It is not submitted, not legally reviewed and not approved by SAMS. See [RELEASE-STATUS.md](../RELEASE-STATUS.md) for what is still open.

Not provided or invented here: the final app-store publisher identity, an extension support contact, a store account, and legal approval. They appear below as `TBD`. The public website privacy policy URL is known (section 1), but the page does not explicitly describe the extension and the draft addendum is not published or approved.

Sources used for store requirements (fetched 2026-10-22): Chrome Web Store [privacy tab](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [program policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [image sizes](https://developer.chrome.com/docs/webstore/images) and [publish guide](https://developer.chrome.com/docs/webstore/publish), and Apple's App Store Connect [app privacy page](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/). Apple's [Safari distribution guide](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension) using its [DocC JSON](https://developer.apple.com/tutorials/data/documentation/safariservices/distributing-your-safari-web-extension.json) after the ordinary pages returned no useful text.

## 1. Chrome Web Store: Privacy tab

### Single purpose

Transfer one student's details and staff-selected CRM documents from the signed-in SAMS CRM or Campora APPLY profile to university application forms chosen by authorised staff. Campora is configured as a second Copy source; live acceptance remains pending.

### Remote code

"No, I am not using remote code." The package is Manifest V3. All scripts ship in the package. The extension does not load, evaluate or fetch executable code. (Checked: source has no `eval`-style loading, no remote script URLs, and only the CRM requests listed below.)

### Permission justifications

| Permission | Used for | Source |
|---|---|---|
| `storage` | `chrome.storage.session` only: holds the copied student for at most 30 minutes of inactivity. Never `storage.local` or `storage.sync`. | `src/background.js` |
| `alarms` | One alarm that removes the copied student when the 30 minute inactivity period ends. | `src/background.js` |
| `activeTab` | Lets staff grant access to the university page they are looking at, only when they open the extension from the toolbar there. | `popup.js` |
| `scripting` | Injects the CRM page reader into the CRM profile tab, and the fill engine into the tab and frames staff chose. | `popup.js` |
| `webNavigation` | Lists the frames of the selected tab so that only the top frame and same-origin frames are filled. URLs are read transiently and not stored. | `popup.js` |
| Host `https://app.samscrm.co.uk/*` | Reads the open student profile and the profile's document list, and fetches a document when staff attach it. | `config/allowlist.js` |
| Host `https://v-sams-backend.samsapply.co.uk/*` | Reads the open Campora APPLY student profile and application header when staff select Copy. Campora documents are not listed or fetched; staff attach them manually. | `config/allowlist.js` |
| Hosts `https://nelson.gre.ac.uk/*`, `https://apps.bangor.ac.uk/*`, `https://evision.bolton.ac.uk/*` | Greenwich, Bangor and Greater Manchester application forms, which have saved field mappings. | `config/allowlist.js` |
| Optional hosts `https://*/*` | Declared so staff can choose to allow one other university site. The extension requests only that exact origin through `permissions.request` after staff select **Allow this website**. It does not request all sites, and staff can revoke each grant in browser settings. | `manifest.json`, `popup.js` |

The development build also lists `http://localhost:3000`, `http://localhost:3001` and `http://127.0.0.1:3001`. The production build removes them. Confirm this against the generated `dist/chrome/manifest.json`; the Campora allowlist gate now passes.

### Data usage disclosures (proposed, for legal review)

The extension handles these categories, all taken from a CRM profile page that staff have open and used only to fill the application forms staff choose:

- **Personally identifiable information:** name, date of birth, gender, nationality, marital status, email, phone, postal address, passport number and dates, emergency contact details.
- **Other personal data copied from the profile:** education history, English test scores, work and visa history fields, funding status, and the course, intake and route fields that the profile shows (see `config/crm-source.js` for the full label list).
- **Website content:** the field labels and values on the CRM page and the application page.
- **Documents:** metadata of the student's CRM documents is cached; the file itself is fetched only when staff attach it.
- **Authentication information handled transiently:** the CRM page's `api-token` value is read and sent as a Bearer header on read-only requests to the same CRM origin. CRM file requests use the existing same-origin session. These credentials are not retained in the student cache or sent to university pages. This handling must be considered when completing the dashboard's authentication-information category, even though staff do not enter credentials into the extension.
- **Not read as profile fields:** passwords, payment-card details or device geolocation. Postal addresses are copied as personal information. Tab and frame URLs are read transiently to decide where filling is allowed; the extension does not keep a browsing-history log. Selected documents may contain additional sensitive information beyond their metadata, so do not certify that health, financial or other sensitive data can never be processed.

Proposed certifications, subject to legal sign-off: data is used only for the single purpose above; it is not sold or used for advertising, credit or lending. The extension provides no developer-operated upload or human-review service. Authorised staff and receiving universities can read data in their own systems; do not certify that no human reads it. CRM requests include the student's identifier, and staff-directed filling, attachment and draft saving place data into the selected university page. Complete the dashboard from these actual flows, not from an assumption that local processing means no user data is handled.

### Privacy policy URL

Candidate location: https://samscrm.co.uk/privacy-policy/

The page is live and directly fetched on 2026-10-22: HTTP 200, `text/html`, canonical same URL, title "Privacy Policy - SAMS CRM". It is published by the operator named below. It does not currently mention this extension, session storage, draft saving or staff-granted website access.

A draft insertion is prepared in [PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md](PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md). It is not published, not approved by SAMS and not legally reviewed. The URL is therefore a candidate, not a completed dashboard value. The existing page must stay live and unchanged until SAMS approves and publishes an amendment that explicitly covers the extension.

Verified public website operator and privacy contact, from the page above:

- Operator named: SAMS GLOBAL SOLUTIONS LIMITED
- Postal address: The Workstation, 15 Paternoster Row, Sheffield S1 2BX
- Privacy contact: contact@samsglobal.co.uk

These are public website facts. They do not establish the final Chrome Web Store or Apple publisher identity, the extension controller, or the extension support contact. Those remain `TBD` and must be confirmed by SAMS. Do not enter a dashboard URL until the extension section is actually published at that URL, and do not describe the extension as compliant in the meantime.

### In-product disclosure (open)

Chrome's Disclosure Requirements apply to products handling user data, and its user data FAQ says prominent disclosure and affirmative consent must occur inside the product, not only in the privacy policy or store listing. Neither source establishes a private-staff-tool exemption. The popup currently has no standing data-handling disclosure or agreement step before **Copy from CRM**. It does show "Student data expires after 30 minutes of inactivity" after a copy. Treat this as an unresolved submission requirement. A product change needs separate approval and E2E/UI verification; this pack does not implement one.

## 2. Chrome Web Store: Store listing (draft)

- **Name:** SAMS Portal Autofill
- **Short description (under 132 characters):** Copy a student's details from SAMS CRM and fill empty fields on approved university application forms. Staff only.
- **Detailed description:**

  SAMS Portal Autofill is a tool intended for authorised SAMS staff. Open a student's profile in SAMS CRM and select Copy. Open a university application form, open the extension and select Autofill. It fills matching empty fields. Staff must review every field and complete any declaration, payment or final submission themselves. The receiving website may autosave data as fields are filled.

  Saved field mappings exist for the University of Greenwich, Bangor University and the University of Greater Manchester. On other university sites, staff can allow that one website and the extension fills only common personal and contact fields. Account, payment, declaration, referee and similar fields are always left for the staff member.

  Optional features, off until staff choose them: attaching a student's CRM documents to portal upload fields one file at a time.

  The copied student is kept in the browser's session storage, configured to expire after 30 minutes of inactivity and removed on Clear. A browser restart or extension reload may also clear it, depending on the browser. Clear does not delete CRM or university records. This extension has no separate login, licence server, analytics, advertising or AI service.

  Requires a SAMS CRM account. It does nothing useful without one.

- **Category:** Productivity (suggested, to confirm).
- **Language:** English.
- **Support contact and website:** `TBD` by SAMS. The public website privacy contact is `contact@samsglobal.co.uk`, but it is not confirmed as the extension support contact.

## 3. Reviewer instructions (draft for the Test instructions tab)

A reviewer cannot sign in to SAMS CRM or to the university portals. Provide a reviewer account only if SAMS creates one. This pack does not invent credentials.

Suggested text:

> This extension is for SAMS staff and only works on a signed-in SAMS CRM student profile (`https://app.samscrm.co.uk/agent/leads/full-profile/<id>/`) and on university application forms. Without a SAMS account the popup can be opened, but Copy reports that it needs an approved CRM profile and Autofill stays disabled. A reviewer account and a synthetic test student: `TBD by SAMS`.
> To test: open the test student profile, open the extension and select Copy from CRM. Open an application form, open the extension and select Autofill this page. Existing values are not overwritten and nothing is submitted. Select Clear to remove the student.
> Behaviours to confirm: the copied student disappears after Clear and after 30 minutes of inactivity; Autofill is disabled when no student is copied; the extension does not fill the CRM page itself.

Offline evidence the publisher can offer in place of a live account: the loaded-extension tests against synthetic pages (`npm run test:e2e`).

## 4. Screenshot and image inventory

Chrome requirements (fetched 2026-10-22): store icon 128x128 PNG with 96x96 artwork and 16 px transparent padding; small promotional image 440x280; at least one screenshot at 1280x800 or 640x400, up to five recommended; marquee 1400x560 optional.

| Asset | Present | Notes |
|---|---|---|
| Source icons | `icon16.png`, `icon48.png`, `icon128.png` | Measured: `icon128.png` is opaque with no padding (artwork fills 128x128), so it does not meet the store padding rule as is. Runtime icons are unchanged. |
| Store icon 128x128 (draft) | Yes, local draft | [store-icon-128-draft.png](assets/store-icon-128-draft.png), RGBA. `icon128.png` scaled to 96x96 inside 16 px transparent padding (alpha bounding box 16,16 to 112,112). |
| Small promotional image 440x280 (draft) | Yes, local draft | [store-promo-small-440x280-draft.png](assets/store-promo-small-440x280-draft.png), RGB. Existing icon, the colours of the popup, and the two lines "SAMS Portal Autofill" and "For authorised SAMS staff". No other claims. |
| Store screenshots 1280x800 (draft) | Yes, 2 local drafts | [store-screenshot-1-1280x800-draft.png](assets/store-screenshot-1-1280x800-draft.png) shows the full popup after a copy and a shared-matching Autofill; [store-screenshot-2-1280x800-draft.png](assets/store-screenshot-2-1280x800-draft.png) shows the popup asking to allow one website. Each is an authentic capture scaled uniformly (no crop, no redraw) beside a caption that repeats the popup's own wording. Synthetic data only (Aisha Rahman, `apply.example-university.test`). Marquee 1400x560 not made. |
| Asset provenance | Yes | [assets/MANIFEST.json](assets/MANIFEST.json) lists each output with its size, mode and SHA-256, and each source with its origin. Rebuild from the repository root with `python3 docs/store-submission/assets/build-store-assets.py` (Pillow and the macOS Helvetica Neue font, no network). Sources are kept in [assets/source/](assets/source/). Review status: local draft, pending publisher review. None was reviewed by SAMS, and no Safari image exists. |
| Popup captures from the loaded-extension tests | Yes, local only | `tmp/general-portal-evidence/popup-*.png` and `site-access-*.png` (about 780x1200 px, 390x600 CSS, real toolbar popup in Helium, synthetic data). Re-created and overwritten on each `npm run test:e2e`. `tmp/` is git-ignored. Only `popup-generic-success.png`, `site-access-granted-before.png` and the scrolled frames captures were viewed and used or rejected (the two sources of the draft screenshots are copied into `assets/source/`). Others were not used: `site-access-denied-after.png` was captured mid-animation, and the older 2026-10-15 captures were not reviewed. Check any other capture before public use. |
| Safari app screenshots | Local only | `tmp/safari-runtime-evidence/s1-containing-app-ui.png`, full-screen capture of the containing app on 2026-10-20. Not store-ready and not reviewed for personal content. |
| Live portal captures | Do not use | `tmp/*.png` live portal and CRM captures predate this work and may hold applicant-like data. Keep them out of any listing. |

## 5. Safari and App Store (draft, distribution routes source-checked)

Apple's Safari distribution guide was verified through its DocC JSON on 2026-10-22. This confirms the following routes, not local signing readiness or every account-specific certificate setting.

- A macOS Safari web extension ships inside a containing app. Both the extension and app need signing for App Store distribution, with Apple Developer Program membership and an archive uploaded through App Store Connect.
- Outside the Mac App Store, Apple supports Developer ID signing and notarisation of the containing app. Confirm certificate, provisioning and notarisation access with the approved team before preparing that route.
- The App Store Connect app privacy page (fetched) says a privacy policy URL is required for all apps, and that the privacy nutrition label answers must describe data collected by the app and its partners. The containing app itself never receives student data and its native handler refuses all requests. Whether the label should be "no data collected" is a question for the publisher, because the extension processes student data inside Safari.

Prerequisites: a SAMS Apple developer team, production bundle identifiers (current `com.example.dev.*` values are placeholders), a chosen route, a public privacy policy URL that explicitly covers the extension, and a completed actual-Safari acceptance run.

## 6. Controlled distribution preparation

Baseline already documented in [INSTALL-AND-DEPLOY.md](../INSTALL-AND-DEPLOY.md): upload to SAMS's Chrome Web Store developer account as an unlisted item, or deploy by Chrome enterprise force-install policy. This was not changed.

Choices that belong to SAMS:

- Which route: unlisted store item, enterprise force-install, or both. The Chrome dashboard's Distribution tab sets who can see the item; its exact options should be read in the dashboard.
- An unlisted link is not an access-control boundary. Anyone with the link may be able to install; confirm whether managed/private distribution is needed for staff-only installation. No route was selected or changed here.
- The developer account owner and who maintains the privacy policy.
- Safari distribution route and Apple team (section 5).
- Who approves each update, since end users cannot edit the approved origins.

Local packaging prerequisite: a successful `npm run build:prod` (the allowlist gate now passes). Publisher-owned prerequisites that cannot be met locally: published extension coverage in the public privacy policy (the URL is known), publisher review of the draft store images, and the account.

## 7. Facts the pack depends on

- No network calls other than: read-only GETs to the nine CRM document-listing endpoints (`/api/v2/agent/ajax/fp_*_docs`) and GETs of `/tmp_aws_media/` files on the CRM origin (`src/crm-documents.js`); `https://*` requests are otherwise made by the portal page itself, not the extension.
- No `nativeMessaging`; the Safari native handler cancels every request (`SafariWebExtensionHandler.swift`).
- The student cache (`studentCache`) is in `storage.session`.
- The extension has not been verified in actual Safari, and has not run end to end against any live portal save.
