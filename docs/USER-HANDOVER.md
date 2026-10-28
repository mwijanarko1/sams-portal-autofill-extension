# SAMS Portal Autofill: how to use it

This guide is for staff who already have the extension installed. It explains how to copy one student from SAMS CRM or Campora and fill a university application draft. It does not cover installation.

**What this extension does.** It copies visible student details (and a list of CRM documents) into temporary browser memory, then helps you fill empty fields on a university form page. You still save, continue, pay, declare, and submit yourself.

**What it does not do.** It does not submit forms, overwrite existing values, or choose documents for you. It does not read file contents to answer questions. Its temporary copy expires after about 30 minutes without a successful Copy, Autofill, or Attach. Clear removes that copy, not values, files, or clipboard text already sent elsewhere.

**A portal may save immediately.** Filling a field or attaching a file can trigger the university's own autosave or upload. The extension does not need to click Save or Submit for that to happen. Use only approved university pages and check the student and destination first.

Mapped universities today are University of Greenwich, Bangor University, and University of Greater Manchester. Other universities use careful matching for common personal and contact fields only. Expect more manual work outside those three.

---

## Before you start

1. Sign into SAMS CRM or Campora the normal way (your usual browser sign-in).
2. Work with **one student at a time**. A new successful **Copy from CRM** replaces the previous student in the extension.
3. Keep the CRM student profile tab open if you plan to attach documents later.
4. Use your organisation's approved device and browser profile. Do not share an unlocked session or use a personal browser profile without approval.

---

## Step 1. Open one student in the CRM

1. In SAMS CRM or Campora, open the individual student profile you need.
2. Expand any collapsed sections that hold the details you care about (personal, contact, education, and similar).
3. Stay on that profile page. Do not stay on a list, dashboard, or settings page.

---

## Step 2. Copy from CRM

1. Click the extension icon in the browser toolbar to open the popup.
2. Select **Copy from CRM**. If another student is already shown, the button says **Copy again**.
3. Wait until the popup shows the student name and a short note such as how many fields were copied.
4. Confirm that the name on the card is the correct student.
5. Optional: open **Copied details** to search fields or values, and use the small **Copy** control next to a value if you need to paste it by hand later.
6. Optional: open **Copied documents** to see which CRM files are available. Select **View** to open that file in a new tab and check it.

If a section was still closed, open it in the CRM and select **Copy again**. If course or intake details are still missing after a second Copy, reload the lead page in the CRM and select **Copy again**: opening the Profile tab removes the Applications stage data until the page reloads.

---

## Step 3. Open the university form page

1. Sign into the university application portal yourself.
2. Open the exact form step you want to prepare (for example personal details, then education on the next visit).
3. Leave that page as the active tab.

The extension fills only the current page and supported sections inside it. Repeat Autofill for each form page.

Check that the address is your approved university portal and starts with `https://` before Autofill or Attach. The extension's ability to run on a website is not approval to send student data there.

---

## Step 4. Allow this website when asked

On some university sites the popup shows **Allow this website**.

1. Check the website address shown in the message.
2. Select **Allow this website** if you want the extension to work on that site.
3. The popup confirms access. Nothing is filled yet.
4. Then select **Autofill this page** when you are ready.

If Autofill fails with an access message, allow the site, reload the form page, and try again.

---

## Step 5. Autofill this page

1. Open the extension popup on the form page.
2. Confirm the student name is still correct.
3. Select **Autofill this page**.
4. Read the summary in the popup (filled fields, skipped fields, and fields left for you).
5. Look at the form itself and check every important value.

**No overwrite.** Autofill does not change a field that already contains a value. If a wrong value is already there, clear or correct it yourself in the portal, then run **Autofill this page** again for empty fields only.

**Manual fields.** Complete anything the summary lists for manual review. Account, payment, declaration, referee, emergency contact, agent, and many education or employment questions often stay manual, especially on universities that are not fully mapped.

---

## Step 6. Attach CRM documents (when the form has file uploads)

Do this only when the page has file upload fields and you have copied documents.

1. Keep the signed-in SAMS CRM tab open.
2. On the portal form page, open the extension and select **Attach CRM documents**.
3. Read the warning on the card: some portals upload the file as soon as it is attached.
4. For each upload field, open the document list and choose the correct CRM file yourself. Suggested options may be marked. The extension never selects one for you. Select **Show on page** to scroll to and outline that field without changing it. If the portal hides its file input behind its own upload widget, the popup says so and you attach the file in the portal yourself.
5. Select **Attach** only after you are sure the choice is correct.
6. Check the portal page. The file may already be uploading or saved by the portal's own behaviour.

Keep the popup open while you choose and attach files. If you close it or change form pages, select **Attach CRM documents** again to refresh the upload list.

Supported attach types are pdf, jpg, jpeg, png, doc, and docx. Files larger than 10 MB (10 × 1024 × 1024 bytes) are refused. Attach those manually in the portal.

Documents are listed from SAMS CRM only. For a student copied from Campora, attach files manually in the portal.

**View** opens the CRM file URL in a normal browser tab so you can inspect it. That is separate from **Attach**, which fetches the file only when you attach it.

**Where the file goes.** Copy keeps a temporary list of document names and links, not the files. Scanning upload fields or choosing a document does not download it. Attach reads the chosen file from CRM into browser memory and gives it to that one portal upload field. It does not create a copy in Downloads. The university may immediately upload and retain the file. Clear cannot remove that university copy.

The extension transfers the file as-is. It does not extract PDF or Word text, fill fields from the document, redact sensitive pages, or check for malware. Check the document yourself. If you download a file through View or save one manually, that copy follows your device's storage and retention rules, not the extension's timer.

If an upload field already contains a file, remove or replace it through the portal yourself, then scan again. An Attached message means the file was put in the field, not that the university has finished accepting it.

---

## Step 7. Finish the application yourself

1. Use the portal's own **Save**, **Next**, **Continue**, **Submit**, payment, and declaration controls.
2. Autofill never clicks those for you.
3. Review every page before you pay or submit.

---

## Step 8. Clear when done

1. Open the extension popup.
2. Select **Clear**.
3. The student card disappears. You can copy another student when needed.

The copied student is also removed after about 30 minutes without a new **Copy from CRM** or a successful Autofill or Attach, after a browser restart, or after an extension reload or update.

The timer restarts after each successful Copy, Autofill, or Attach, so a student can remain copied longer than 30 minutes during continued work. Opening the popup, copying one detail to the clipboard, viewing a document, or scanning uploads does not restart it. Closing the popup does not clear the student. Closing one browser window may leave the browser running.

Signing out of CRM does not clear an existing copy. Select **Clear** before signing out or leaving your desk. Wait for active operations to finish, check the card disappears, and close other extension windows. Clear cannot stop a transfer or portal save that has already started.

---

## Copy and paste individual details

Use **Copied details** when Autofill cannot fill a field, or when you prefer to paste by hand.

1. Open **Copied details**.
2. Type in the search box to filter fields or values.
3. Select the small **Copy** control next to a value. That puts the text on your system clipboard.
4. Paste into the portal field yourself.

This per-field **Copy** is separate from **Copy from CRM**. **Clear** does not erase your system clipboard.

---

## One-student safety

- The extension holds at most one student at a time.
- A successful new **Copy from CRM** replaces the previous student.
- Always check the name on the student card before Autofill or Attach.
- Do not leave a copied student in the popup when you walk away from the desk. Select **Clear**.

---

## What Clear does and does not do

**Clear removes** the temporary student copy held by the extension. This includes student details and the list of document names and links.

**Clear does not remove:**

- text already written into portal fields
- files already attached or uploaded to a university portal
- values on your system clipboard
- records in SAMS CRM or in the university system

Your computer may keep a clipboard history. Clear does not remove that history. The university controls how long it keeps your application and uploaded files.

---

## Leaving the role, changing devices, or losing a device

Tell your manager or IT team when you leave, change work devices, or lose a device. The extension does not detect that your employment ended and cannot remotely wipe your browser.

On an available device, stop student work, select **Clear**, and sign out of CRM and the university portals. Close student forms and document viewers. Follow IT's instructions for browser profiles, downloads, clipboard history, and returning the device. Do not delete university records or incident evidence yourself.

IT must revoke accounts and active sessions separately. Disabling an account does not recall an existing copied student or a file already uploaded. If the device is missing, report it immediately instead of waiting for the timer. Detailed responsibilities are in the [technical offboarding checklist](TECHNICAL-HANDOVER.md#employee-offboarding-and-device-loss).

If you filled the wrong student's form or attached the wrong document, stop work and tell your manager or IT team. Clear the extension copy, but do not assume that this undoes a portal save or upload.

---

## Supported universities and matching

| Situation | What to expect |
|---|---|
| University of Greenwich | Saved mapping for many fields on known pages. Still review everything. |
| Bangor University | Saved mapping for many fields on known pages. Still review everything. |
| University of Greater Manchester | Saved mapping for many fields on known pages. Still review everything. |
| Other universities | Common personal and contact details only, such as name, email, phone, and address. The extension leaves a field empty if it cannot find a safe match. Complete the remaining fields yourself. |

A saved mapping does not cover every field. Check each page and complete any missing details yourself.

### Values that need particular care

- On Greenwich, Greater Manchester, and Bangor, country of birth can be filled from nationality when no separate birth country was copied. These are not always the same. Check the student's actual country of birth and correct the form when needed.
- Residence can be filled from the CRM address country. Confirm that it answers the portal's residence question. A separate explicit CRM value takes precedence.
- Greenwich intake month and year can come from the CRM start month and year. An explicit copied intake takes precedence. Review the selected intake before choosing or confirming the course.
- Greenwich fee payer fills automatically only for self-funded CRM values, using the private-finance option. Scholarship, loan, sponsorship, other, and unrecognised funding types stay manual. Choose the right fee payer yourself rather than changing CRM data to force a match.
- Greenwich job description can receive the copied job title. Full-time or Part-time remains your answer. Referee fields must not receive the applicant's contact details.

These fallback values are calculated for the mapped page. They do not add new entries to Copied details or rewrite the CRM record.

### Greater Manchester tabs and conditional fields

Open one application tab and wait for its controls to appear before Autofill. Switching tabs replaces the visible form. Repeat Autofill on each page you want to prepare.

Some qualification name, subject, and grade boxes appear only after you choose an appropriate category such as Other. Make those choices yourself when they are accurate, then run Autofill again. The typed personal statement appears after you choose not to upload a statement. Correspondence email is conditional on the correspondence-address question. Do not change an application answer only to reveal an Autofill target. Hidden or unanswered fields can remain manual.

---

## Troubleshooting

| Problem | What to try |
|---|---|
| Popup says open a CRM profile first | Open one student full profile in SAMS CRM, then select **Copy from CRM** again. |
| Wrong student name shown | Select **Clear**, open the correct profile, then **Copy from CRM**. |
| Few fields copied | Expand closed CRM sections and select **Copy again**. |
| Autofill does nothing or access error | Select **Allow this website** if shown, reload the form page, open the popup on that page, try again. |
| Field already has a wrong value | Clear or fix it in the portal yourself, then Autofill again. Autofill will not overwrite it. |
| Message about binding to the exact page document | Fill that page manually, or use Chrome or Edge if your organisation supports them. Not every browser can bind Autofill the same way. |
| Attach asks to keep CRM open | Leave a signed-in SAMS CRM tab open, then try **Attach** again. |
| Document larger than 10 MB or wrong type | Attach it manually in the portal. |
| Document names appear but Attach fails after CRM sign-out | Sign in again through the normal CRM page, Copy again, and retry. If access is still refused, ask IT. |
| Greenwich funding stays empty | Only self-funded values have an automatic fee-payer match. Select other funding types manually. |
| Birth or residence country looks wrong | Correct it in the portal. Nationality and address country are fallbacks, not proof of the answer. |
| Manchester fields are missing | Wait for the tab to load. Answer any conditional questions accurately, then Autofill again for newly visible empty fields. |
| Student card disappeared | Copy again. Data expires after inactivity, browser restart, or extension reload or update. |
| Safari or another browser behaves differently | Ask your technical team which browser to use. Autofill and document attachment are not confirmed to work in every browser. |

---

## Privacy note (simple)

The extension keeps copied details in temporary browser memory, separate from the normal browser cache. It does not send this copy to its own cloud service or sync it between browser profiles. Anyone with access to your unlocked browser profile may be able to use an unexpired copy. The extension has no separate staff login.

Document names and links can still identify a student. When you select **Attach**, the extension reads the chosen file from CRM and gives it to the university page. The CRM, university, browser, clipboard tools, and operating system have their own storage rules. Select **Clear** when you finish a student. IT controls access removal and device cleanup.

If a problem continues, ask your technical team for help. Share the error message and the page name. Do not send student details or documents unless your organisation has approved a safe way to share them.
