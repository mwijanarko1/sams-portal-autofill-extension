# Privacy policy extension addendum (DRAFT, not published, not approved, legal review required)

Status: drafted on 2026-10-22 for SAMS Portal Autofill version `0.1.0`.

- This is proposed insertion text for the existing public SAMS privacy policy at https://samscrm.co.uk/privacy-policy/. The existing policy is live and has not been changed by this work.
- The text below is **not published**, **not approved by SAMS** and **not legally reviewed**. Do not treat it as the current policy, as evidence of compliance, or as legal advice.
- Do not create a separate standalone policy URL as the primary route. The preferred route is a clearly marked extension section inside the existing policy, so staff and applicants have one authoritative privacy notice.
- Every bracketed item must be decided by SAMS before publication. None of the unresolved points in the internal notes may be asserted as fact in the live policy.

## Suggested insertion point

Insert one new section after the existing "How we use this data" content, including its sharing subsections 1.1 to 1.6, and before the paragraph "You may request access to your personal information". If the page keeps its list numbering, number the new section 1.7 and title it "SAMS Portal Autofill browser extension". Leave the existing clauses unchanged.

The page says an amended policy is effective when posted. This draft deliberately does not choose a legal effective date.

## Insertion text (copy-ready draft)

> **SAMS Portal Autofill browser extension**
>
> **Effective date:** [to be completed by SAMS before publication]
>
> SAMS Portal Autofill is a browser extension used by authorised SAMS staff. It copies details of one student from the SAMS CRM profile that the staff member has open and fills empty fields on a university application form that the staff member chooses. It uses that data only to provide that transfer. This section explains the personal data the extension handles. It supplements the rest of this policy, which continues to apply to the SAMS website and CRM service.
>
> **Data the extension handles**
>
> When staff select Copy from CRM, the extension reads the visible details of the open student profile. These can include the student's identifiers, name, contact details, postal address, date of birth, nationality, passport details, education history and test results, work and visa history, emergency contact, funding status, and course, intake and route fields. It also lists the student's CRM documents, including document names, types and links, and fetches a chosen document file only when staff choose to attach it. A selected document may contain additional sensitive information beyond the profile fields listed here.
>
> The extension also reads the field labels and values on the CRM profile and on the application page it fills, and the current tab and frame addresses needed to target the chosen page. It does not ask staff to create a separate extension password, and it does not read passwords, payment-card details or device location as profile fields.
>
> **Where copied data is kept**
>
> Copied profile data and document metadata are held in the browser's session storage on the staff member's device. This storage is configured to expire after 30 minutes of inactivity and is removed when staff select Clear. A browser restart or extension reload may also clear it, depending on the browser. The extension does not use local or synced storage for copied student data.
>
> Document files fetched for attachment are not written to the extension's session, local or synced storage. They are handled temporarily for transfer to the chosen page. The page, browser or receiving portal may retain or upload them under its own processing.
>
>
> Clearing the local copy removes it from the extension's session storage only. It cannot retract data already written into a page or sent to a remote portal.
>
> **Where data goes**
>
> The extension makes read-only, same-origin requests to SAMS CRM to list a student's documents and to fetch a file that staff choose to attach. Document-listing requests use the CRM page's API token and the staff member's existing session; file requests use that existing session. The token is handled transiently, is not kept in the copied-student cache and is not sent to university pages.
>
> Staff-directed actions place data into the application page the staff member has selected. The destination site's operator controls that page under its own privacy notice, including any autosave, upload or onward processing that follows. Filling a field does not prevent the site from saving or transmitting it. Staff must verify that it is the intended university application site before transferring data.
>
> The extension has no separate developer-operated server, analytics, advertising, AI or remote human-review service. Authorised SAMS staff, the CRM provider and receiving universities can read data in their own systems.
>
> **Website access and choices**
>
> The extension acts on SAMS CRM and on the university application origins configured for it. On another site chosen for a university application, staff can either use one-time access to the tab they are viewing when they open the extension there, or select Allow this website to grant access to that exact origin. The extension does not verify that a staff-selected site belongs to a university; staff must check the destination before transferring data. Staff can remove website access, or remove the extension, through browser settings. The optional broad HTTPS permission exists so staff can choose an exact site; it is not used to track general browsing. The extension reads current tab and frame addresses to target the chosen page It does not keep a general browsing-history log.
>
> **Questions and requests**
>
> Questions about this extension, or requests to access, correct or delete personal data, can be sent to contact@samsglobal.co.uk or by letter to SAMS GLOBAL, The Workstation, 15 Paternoster Row, Sheffield S1 2BX. Requests about records held in SAMS CRM or in a university portal must be handled by the relevant controller or system operator. Selecting Clear in the extension does not delete CRM or university records.

## Internal drafting notes (remove before publication)

### What this draft does and does not claim

- It describes the extension as implemented in this repository. It does not certify that the existing policy, as a whole, already covers the extension.
- It does not assert a lawful basis, a controller or processor allocation, a data protection officer, an ICO registration, a fixed remote retention period, international-transfer safeguards, customer approval or store compliance.
- The rest of the public policy contains organisation-wide marketing, partner-sharing and research clauses that were written for the website and CRM service. This insertion does not recertify those clauses for the extension. Whether they need qualification for the extension is a SAMS publisher and legal decision.

### Public source provenance

Fetched on 2026-10-22 with an ordinary public HTTP GET:

- https://samscrm.co.uk/privacy-policy/ returned HTTP 200, `text/html; charset=UTF-8`.
- Canonical link: `https://samscrm.co.uk/privacy-policy/`.
- Page title: `Privacy Policy - SAMS CRM`.
- Operator named on the page: SAMS GLOBAL SOLUTIONS LIMITED.
- Public postal address: SAMS GLOBAL, The Workstation, 15 Paternoster Row, Sheffield S1 2BX.
- Public privacy contact: contact@samsglobal.co.uk. The readable text extractor masks Cloudflare-protected addresses; the address was decoded from the page's own `data-cfemail` values in the raw HTML.
- Public legal links: `/terms-and-conditions/`, `/data-processing-agreement/`, `/data-security/`.
- The page states that it may be updated and that an amended policy is effective upon posting. No explicit effective date was observed.
- The page states that application information is shared with the schools applied to, and that SAMS does not control those schools' subsequent use. That supports the recipient wording above but does not establish an extension-specific controller relationship.

These are public website facts. They are not proof of the final extension controller, the browser-store publisher account or the extension support contact.

### Technical provenance (repository)

- `manifest.json`: Manifest V3; permissions `storage`, `activeTab`, `scripting`, `alarms`, `webNavigation`; the built manifest receives the SAMS CRM and Campora APPLY host permissions plus development localhost entries from `config/allowlist.js` (the root template does not list them); optional host permission `https://*/*`; no remote code.
- `src/background.js`: the student cache is written to `chrome.storage.session`, with `expiresAt` from `sessionMinutes` and an expiry alarm; Clear removes the cache and alarm.
- `config/allowlist.js`: `sessionMinutes: 30`; CRM origins `https://app.samscrm.co.uk` and `https://v-sams-backend.samsapply.co.uk`; configured portal origins; document file URLs restricted to the plain `/tmp_aws_media/` path on the SAMS CRM origin.
- `src/crm-documents.js`: read-only document-listing requests send the page's `api-token` as a Bearer header with `credentials: "same-origin"`; file fetches use the same-origin session.
- `popup.js`: optional exact-site access is requested with `chrome.permissions.request` for the selected origin.
- A source search for `storage.local`, `storage.sync`, `localStorage` and `indexedDB` in the extension source and popup found none.
- No analytics, advertising, AI, remote-review or separate developer backend is present in the extension source.

### SAMS review checklist (unresolved)

1. Confirm the legal entity that controls the extension data and whether it is the same entity named on the website policy.
2. Confirm the lawful basis for each purpose, and whether the existing policy's wording is adequate for staff-directed transfers to universities.
3. Decide how the extension section relates to the existing organisation-wide marketing, partner, research and legal-request clauses, which were not written for this extension.
4. Confirm the data protection officer, any ICO registration details, and the internal owner of access, correction and deletion requests.
5. Confirm retention for records held in SAMS CRM and in university portals, and the international-transfer position for those systems.
6. Confirm the final browser-store publisher identity and the extension support contact, which may differ from the public website privacy contact.
7. Decide the effective date and version history, and whether the existing page's "effective upon posting" wording is sufficient.
8. Decide the Chrome in-product disclosure and consent step. This is an unresolved submission requirement and is not implemented here.
9. Decide the App Store privacy label for the Safari containing app and extension.
10. Obtain publisher and legal review before any live page edit. The live page has not been changed by this repository.
