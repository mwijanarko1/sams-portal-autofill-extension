# Privacy policy (DRAFT, historical standalone reference, not hosted, not legally reviewed)

This document is retained as a historical standalone privacy policy draft for SAMS Portal Autofill version 0.1.0, written from source on 2026-10-22. It is not the preferred publication route and it is not hosted, approved or legally reviewed.

SAMS already publishes a website privacy policy at https://samscrm.co.uk/privacy-policy/. The preferred approach is a clearly marked extension section inserted into that existing policy: see [the extension addendum draft](PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md). This standalone text is kept because it records source-derived data-handling detail that the insertion summarises. It does not establish a controller, a publisher or a store account. Recheck every statement against the source before reuse, because the extension can change.

---

## SAMS Portal Autofill privacy policy

**Public website operator (from https://samscrm.co.uk/privacy-policy/, fetched 2026-10-22):** SAMS GLOBAL SOLUTIONS LIMITED, The Workstation, 15 Paternoster Row, Sheffield S1 2BX. Public privacy contact on that page: contact@samsglobal.co.uk.

**Extension controller and browser-store publisher:** [TBD: confirm. The public website operator is not proof of the final extension controller or store account.]

**Effective date:** [TBD: to be set by SAMS if this text is ever published.]

### What the extension is for

SAMS Portal Autofill is a browser extension for authorised SAMS staff. It copies details of one student from the SAMS CRM (or Campora) profile the staff member has open, and fills empty fields on university application forms that the staff member chooses.

### Data the extension handles

When staff select **Copy from CRM**, the extension reads the visible details of the open student profile. These can include name, date of birth, gender, nationality, marital status, email, phone, address, passport number and dates, emergency contact, education history, English test results, work and visa history fields, funding status, and course, intake and route. It also lists the student's CRM documents (name, type and link) and can fetch a document file when staff choose to attach it.

The extension does not read passwords, payment-card details or device geolocation as profile fields. Postal addresses are included in copied personal information. It reads the current tab and frame addresses to target the chosen page without keeping a browsing-history log. Selected documents may contain additional sensitive information beyond the fields listed above.

### Where the data is kept

The copied student is held in the browser's session storage on the staff member's device. It is removed after 30 minutes of inactivity and when staff select **Clear**. A browser restart or extension reload may also clear it, depending on the browser. Document files are not stored: a file is fetched only when staff attach it and goes straight into the portal's upload field. The extension does not use local or synced storage for student data.


### Where the data goes

The extension has no separate server, account, analytics, advertising or AI service. It communicates with the signed-in SAMS CRM to retrieve the chosen student's documents and places student data into the university page chosen by staff. It does not send student data to a separate developer-operated service.

Staff-directed actions place data into the selected university page:

- **Autofill** writes values into the university application page the staff member has open. That page belongs to the university and is subject to its own privacy policy.
- **Attach CRM documents** places a chosen document into a file field on that page. Some portals upload it as soon as it is attached.

Once data is placed into that page, the university site controls any autosave, upload or onward processing under its own policies. The extension does not prevent or verify those site-side network transfers. Filling a field is not a guarantee that nothing has been saved remotely.

While copying, the extension makes read-only requests to the SAMS CRM site that staff are already signed in to. These use the page's own session and the CRM page's API token to list a student's documents and to fetch a chosen file. The token is handled transiently, is not retained in the copied-student cache and is not sent to university pages.

### Website access

The extension can act on SAMS CRM, the Greenwich, Bangor and Greater Manchester application sites, and Campora [TBD: confirm origin]. For any other university site, access is given only when staff open the extension on that page or select **Allow this website**, and covers that exact website only. Staff can remove it in the browser's extension settings.

### Limited use

The extension uses data only to provide the transfer features described here. It does not sell data or use it for advertising, credit or lending decisions, and provides no separate developer-operated human-review service. Authorised SAMS staff and receiving universities can read data in their own systems. [TBD: confirm the publisher's organisational data-use commitments before making certifications on its behalf.]

### Your choices

Staff can clear the copied student at any time with **Clear** and can remove website access or the extension through browser settings. Questions about students' personal data held in SAMS CRM or in a university portal are governed by those systems' policies. [TBD: legal text on data subject rights, controller and processor roles, and the lawful basis.]

### Changes

[TBD: how updates are announced.]

---

## Drafting notes (remove before publishing)

- The statements above match the source: session-only storage (`src/background.js`), no other storage (`grep` for `storage.local`, `storage.sync`, `localStorage`, `indexedDB` found none), no analytics or remote code, read-only CRM requests (`src/crm-documents.js`), a native handler that refuses every request (`safari/.../SafariWebExtensionHandler.swift`).
- Browser and store policies may need statements this draft does not make, such as a prominent in-product disclosure with agreement. That is an open decision, see [the preparation report](PREPARATION-REPORT.md).
- Expanded scope (document handling, staff-chosen sites) is described as it is. SAMS agreement to that scope is not claimed and is not part of this work.
