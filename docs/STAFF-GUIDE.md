# Staff guide

Supported browsers for staff use are decided by SAMS release policy. Development builds exist for Chrome and Safari for macOS; only a SAMS-approved package should be installed on staff machines.

1. Sign into SAMS CRM or Campora normally and open one individual student profile.
2. Open the extension and select **Copy from CRM**. If a section is collapsed or not loaded, open it and copy again.
3. Confirm the student name shown in the extension.
4. Sign into the university's application portal yourself and open the form step you want to prepare.
5. Open the extension from the browser toolbar on that page and select **Autofill this page**. Repeat on each wizard step. Only the page you opened it on is filled.
6. To attach documents from the CRM, keep SAMS CRM open in a tab and select **Attach CRM documents** on the portal page. Choose a document for each upload field (suggested matches are marked, never chosen for you) and select **Attach**. Some portals upload the file as soon as it is attached, so pick carefully.
7. Review the summary and every portal field. Complete all fields listed for manual review.
8. Save, continue, pay, confirm, declare, and submit yourself. Autofill never performs these actions. Only the optional Fill all mode below saves drafts.
9. Select **Clear** when finished. A copied student is also cleared after 30 minutes of inactivity, a browser restart, or an extension reload/update.

Greenwich, Bangor, and Greater Manchester have saved mappings. Other universities use shared matching, which fills only common personal and contact fields that clearly ask for one value (name, date of birth, gender, nationality, email, phone, address, postcode, country, passport number). Expect more fields to complete yourself there: account, payment, declaration, referee, emergency contact, agent, education, and employment fields always stay manual.

Autofill does not overwrite a field that already contains a value. Clear an incorrect portal value manually before running Autofill again.

## Experimental: Autofill all & save (saves drafts)

The default **Autofill this page** never saves, continues, or submits. **Autofill all & save** is a separate, experimental mode that does save. It has been tried only against synthetic test pages: live saving on Bangor, Greenwich, Greater Manchester and other sites, and Safari, are unverified, so watch the first runs.

- It stays disabled until a student is copied.
- Where it works: Bangor (Personal Details, Contact Details, Finance); Greenwich, from the application checklist (it opens the data-entry sections it recognises for that application, fills and saves each, and returns to the checklist; Signature and **Application is Complete** are never opened or pressed; Referee Details stays manual); Greater Manchester (opens each data-entry tab in turn, waits for it to load, fills it and saves it; the Submission tab is never entered); and any other university site, but only after you open the extension from the toolbar on that application page (the browser then lets it act on that one tab). On another site it needs a form with exactly one explicit **Save and continue** button that posts to another page of the same application. Bare Next, Continue or Submit buttons, forms that post anywhere else, and anything that looks like a declaration, payment, sign-in or final submission stop the run. There is no promise that an unfamiliar site will work.
- Greenwich and Greater Manchester use the portal's own Save and continue (or Save on the last tab). A Greater Manchester save counts only when the page shows it worked: a fresh "saved" acknowledgement appears after the click and, when continuing, the expected next tab is active. A stale success message or a tab switch alone is not enough. If it cannot tell, it stops and says so rather than guessing.
- On each supported screen it fills empty fields, checks the form's required fields, then clicks the portal's own **Save and continue** (**Save** on the last Greater Manchester tab) once. That saves a draft in the portal and cannot be undone from the extension.
- It stops, and tells you why, when a required field needs a manual answer, the page shows validation messages or a submit, payment, declaration, or confirmation control, the Save and continue button posts anywhere unexpected, the portal returns to the same screen, the next page is not a supported screen (or belongs to a different application), you or the portal navigate the tab by any route other than the save itself, you click or type in the portal page during a run, the tab closes, the copied student is cleared or replaced, you select Stop, or 10 minutes pass. It never retries a save.
- It never submits, pays, declares, or confirms, and it does not touch review, declaration, or submission pages. When it finishes, supported steps are saved as drafts: the application is not complete, so review every screen in the portal and submit it yourself.
- **Stop** (and Clear or Copy) prevent the next fill or save but cannot recall one already started: a field fill or save in progress may still finish. If a run ends while a save was in progress, the message says a save may already have completed: check the portal.
- It keeps running if you close the extension window. Reopen the extension to see progress or select **Stop**. If the browser restarts the extension mid-run, the run is marked stopped and is not resumed.
- Autofill and document attaching are paused while a run is active.
