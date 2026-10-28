# SAMS Portal Autofill: how to use it

This guide is for staff who already have the extension installed. It shows how to copy one student from SAMS CRM or Campora and fill a university application draft. For Chrome install from a GitHub release, see [INSTALLATION.md](INSTALLATION.md).

**What the extension does.** It copies visible student details and a list of CRM documents into temporary browser memory. Then it fills empty fields on a university form page. You save, continue, pay, declare, and submit yourself.

**What the extension does not do.** It does not submit forms. It does not overwrite existing values. It does not choose documents for you. It does not read the contents of files. The temporary copy expires after about 30 minutes without a successful Copy, Autofill, or Attach. **Clear** removes the copy. It does not remove values, files, or clipboard text that you already sent somewhere else.

**A portal may save immediately.** When the extension fills a field or attaches a file, the university's own page may save or upload it. The extension does not need to click Save or Submit for this to happen. Use only approved university pages. Check the student and the destination first.

Greenwich, Bangor, and Greater Manchester have saved mappings. Other universities get careful matching for common personal and contact fields only. Expect more manual work there.

---

## Before you start

1. Sign in to SAMS CRM or Campora the normal way.
2. Work with one student at a time. A new successful **Copy from CRM** replaces the previous student.
3. Keep the CRM student profile tab open if you plan to attach documents.
4. Use your organisation's approved device and browser profile. Do not share an unlocked session. Do not use a personal browser profile unless your organisation approves it.

---

## Step 1. Open one student

1. In SAMS CRM or Campora, open the profile of the student.
2. Expand any closed sections that hold the details you need (for example personal, contact, or education).
3. Stay on that profile page. Do not use a list, dashboard, or settings page.

---

## Step 2. Copy from CRM

1. Select the extension icon in the browser toolbar.
2. Select **Copy from CRM**. If a student is already shown, the button says **Copy again**.
3. Wait until the popup shows the student name and the number of copied fields.
4. Check that the name on the card is correct.
5. Optional: open **Copied details**. You can search the fields and values. Select the small **Copy** control next to a value to paste it by hand later.
6. Optional: open **Copied documents** to see the available CRM files. Select **View** to open a file in a new tab.

If a section was closed, open it in the CRM. Then select **Copy again**. If course or intake details are still missing, reload the lead page in the CRM. Then select **Copy again**. Opening the Profile tab removes the Applications stage data until you reload the page.

---

## Step 3. Open the university form

1. Sign in to the university application portal yourself.
2. Open the form step that you want to prepare (for example personal details).
3. Leave that page as the active tab.

The extension fills only the current page. Repeat Autofill on each form page.

Before you use Autofill or Attach, check the address. It must be an approved university portal. It must start with `https://`. The extension can run on a website, but this does not mean that you may send student data there.

---

## Step 4. Allow this website (when asked)

On some university sites, the popup shows **Allow this website**.

1. Check the website address in the message.
2. Select **Allow this website** if you want the extension to work on that site.
3. The popup confirms the access. Nothing is filled yet.
4. Select **Autofill this page** when you are ready.

If Autofill fails with an access message, allow the site, reload the form page, and try again.

---

## Step 5. Autofill this page

1. Open the extension popup on the form page.
2. Check that the student name is correct.
3. Select **Autofill this page**.
4. Read the summary in the popup. It lists filled fields, skipped fields, and fields that you must complete.
5. Check every important value in the form.

**No overwrite.** Autofill does not change a field that already has a value. If a value is wrong, clear or correct it in the portal. Then run **Autofill this page** again. It fills the empty fields only.

**Manual fields.** Complete every field that the summary lists for manual review. These fields often stay manual: account, payment, declaration, referee, emergency contact, agent, and many education or employment questions. This is most common on universities without a saved mapping.

---

## Step 6. Attach CRM documents

Do this only when the page has file upload fields and you copied documents.

1. Keep a signed-in SAMS CRM tab open.
2. On the portal form page, open the extension. Select **Attach CRM documents**.
3. Read the warning on the card. Some portals upload the file as soon as it is attached.
4. For each upload field, open the document list. Choose the correct CRM file yourself. The extension may mark suggested files. It never selects one for you.
5. Select **Show on page** to scroll to the field and outline it. This does not change the field. If the portal hides its file input behind its own upload widget, the popup tells you. Then attach the file in the portal yourself.
6. Select **Attach** only when you are sure that the choice is correct.
7. Check the portal page. The portal may already be uploading or saving the file.

Keep the popup open while you choose and attach files. If you close it or change form pages, select **Attach CRM documents** again.

The extension supports these file types: pdf, jpg, jpeg, png, doc, and docx. It refuses files larger than 10 MB (10 × 1024 × 1024 bytes). Attach those files in the portal yourself.

The extension lists documents from SAMS CRM only. For a student that you copied from Campora, attach files in the portal yourself.

**View** opens the CRM file in a normal browser tab so that you can check it. **Attach** is separate. It fetches the file only when you select it.

**Where the file goes.** Copy keeps a temporary list of document names and links. It does not keep the files. Scanning upload fields or choosing a document does not download it. Attach reads the chosen file from the CRM into browser memory. Then it gives the file to that one upload field. It does not save a copy in Downloads. The university may upload and keep the file immediately. **Clear** cannot remove that copy.

The extension moves the file as it is. It does not read the text of PDF or Word files. It does not fill fields from a document. It does not hide sensitive pages. It does not check for malware. Check the document yourself. If you download a file with **View** or save a file by hand, your device's own storage rules apply. The extension timer does not.

If an upload field already has a file, remove it or replace it in the portal. Then scan again. An "Attached" message means that the extension put the file in the field. It does not mean that the university accepted the file.

---

## Step 7. Finish the application yourself

1. Use the portal's own **Save**, **Next**, **Continue**, **Submit**, payment, and declaration controls.
2. Autofill never selects these controls.
3. Check every page before you pay or submit.

---

## Step 8. Clear when you finish

1. Open the extension popup.
2. Select **Clear**.
3. The student card disappears. You can now copy another student.

The extension also removes the copied student in these cases:

- About 30 minutes pass without a new **Copy from CRM** or a successful Autofill or Attach.
- You restart the browser.
- The extension reloads or updates.

The timer restarts after each successful Copy, Autofill, or Attach. During continued work, a student can stay copied for more than 30 minutes. These actions do not restart the timer: opening the popup, copying one detail to the clipboard, viewing a document, or scanning uploads. Closing the popup does not clear the student. Closing one browser window may leave the browser running.

Signing out of the CRM does not clear an existing copy. Select **Clear** before you sign out or leave your desk. Wait for running operations to finish. Check that the card disappears. Close other extension windows. **Clear** cannot stop a transfer or a portal save that has already started.

---

## Copy and paste one detail

Use **Copied details** when Autofill cannot fill a field, or when you prefer to paste by hand.

1. Open **Copied details**.
2. Type in the search box to filter fields or values.
3. Select the small **Copy** control next to a value. The text goes to your system clipboard.
4. Paste it into the portal field yourself.

This **Copy** control is separate from **Copy from CRM**. **Clear** does not erase your system clipboard.

---

## One-student rule

- The extension holds one student at a time.
- A new successful **Copy from CRM** replaces the previous student.
- Always check the name on the student card before Autofill or Attach.
- Select **Clear** before you leave your desk.

---

## What Clear does and does not do

**Clear removes** the temporary student copy in the extension. This includes the student details and the list of document names and links.

**Clear does not remove:**

- text already written into portal fields,
- files already attached or uploaded to a university portal,
- values on your system clipboard,
- records in SAMS CRM or in the university system.

Your computer may keep a clipboard history. **Clear** does not remove it. The university decides how long it keeps your application and uploaded files.

---

## Leaving the role, changing devices, or losing a device

Tell your manager or IT team when you leave, change work devices, or lose a device. The extension cannot detect that your employment ended. It cannot wipe your browser remotely.

On a device that you still have, stop student work. Select **Clear**. Sign out of the CRM and the university portals. Close student forms and document viewers. Follow IT's instructions for browser profiles, downloads, clipboard history, and returning the device. Do not delete university records or incident evidence yourself.

IT must revoke accounts and active sessions separately. Disabling an account does not recall a copied student or a file that was already uploaded. If a device is missing, report it immediately. Do not wait for the timer. The IT duties are in the [technical offboarding checklist](TECHNICAL-HANDOVER.md#employee-offboarding-and-device-loss).

If you filled the wrong student's form or attached the wrong document, stop work. Tell your manager or IT team. Clear the extension copy. Do not assume that this undoes a portal save or upload.

---

## Supported universities

| Situation | What to expect |
|---|---|
| University of Greenwich | Saved mapping for many fields on known pages. Check everything. |
| Bangor University | Saved mapping for many fields on known pages. Check everything. |
| University of Greater Manchester | Saved mapping for many fields on known pages. Check everything. |
| Other universities | Common personal and contact details only, such as name, email, phone, and address. The extension leaves a field empty when it cannot find a safe match. Complete the other fields yourself. |

A saved mapping does not cover every field. Check each page and complete missing details yourself.

### Values that need extra care

- **Country of birth.** On Greenwich, Greater Manchester, and Bangor, the extension can fill country of birth from nationality. This happens when the CRM has no separate birth country. The two are not always the same. Check the real country of birth and correct the form.
- **Residence.** The extension can fill residence from the CRM address country. Check that it answers the portal's residence question. A separate CRM value takes precedence.
- **Greenwich intake.** The intake month and year can come from the CRM start month and year. A copied intake takes precedence. Check the selected intake before you choose or confirm the course.
- **Greenwich fee payer.** The extension fills this only for self-funded CRM values. It uses the private-finance option. Scholarship, loan, sponsorship, other, and unknown funding types stay manual. Choose the correct fee payer yourself. Do not change CRM data to force a match.
- **Greenwich job description.** It can receive the copied job title. Full-time or Part-time is your answer. Referee fields must not receive the applicant's contact details.

The extension calculates these fallback values for the mapped page. They do not add entries to **Copied details**. They do not change the CRM record.

### Greater Manchester tabs and conditional fields

Open one application tab. Wait until its controls appear. Then run Autofill. When you switch tabs, the visible form changes. Repeat Autofill on each page that you want to prepare.

Some qualification name, subject, and grade boxes appear only after you choose a category such as Other. Make those choices yourself, when they are accurate. Then run Autofill again. The typed personal statement appears after you choose not to upload a statement. The correspondence email appears only after you answer the correspondence-address question. Do not change an application answer just to show an Autofill target. Hidden or unanswered fields can stay manual.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| The popup says to open a CRM profile first | Open one student profile in SAMS CRM or Campora. Select **Copy from CRM** again. |
| The popup shows the wrong student | Select **Clear**. Open the correct profile. Select **Copy from CRM**. |
| Few fields copied | Expand the closed CRM sections. Select **Copy again**. |
| Autofill does nothing, or shows an access error | Select **Allow this website** if it shows. Reload the form page. Open the popup on that page. Try again. |
| A field has a wrong value | Clear or correct it in the portal. Run Autofill again. Autofill does not overwrite it. |
| A message about the exact page document | Fill that page by hand. Or use Chrome or Edge, if your organisation supports them. Not every browser can bind Autofill in the same way. |
| Attach asks you to keep the CRM open | Keep a signed-in SAMS CRM tab open. Try **Attach** again. |
| The document is larger than 10 MB, or has the wrong type | Attach it in the portal yourself. |
| Document names show, but Attach fails after CRM sign-out | Sign in again on the normal CRM page. Copy again. Try again. If access is still refused, ask IT. |
| Greenwich funding stays empty | Only self-funded values have an automatic fee-payer match. Select other funding types yourself. |
| The birth or residence country looks wrong | Correct it in the portal. Nationality and address country are fallbacks. They are not proof. |
| Manchester fields are missing | Wait for the tab to load. Answer the conditional questions accurately. Run Autofill again for the newly visible empty fields. |
| The student card disappeared | Copy again. The data expires after inactivity, a browser restart, or an extension reload or update. |
| Safari or another browser behaves differently | Ask your technical team which browser to use. Autofill and document attach may not work in every browser. |

---

## Privacy note

The extension keeps copied details in temporary browser memory. This memory is separate from the normal browser cache. The extension does not send the copy to its own cloud service. It does not sync the copy between browser profiles. Anyone who can use your unlocked browser profile may be able to use an unexpired copy. The extension has no separate staff login.

Document names and links can identify a student. When you select **Attach**, the extension reads the chosen file from the CRM and gives it to the university page. The CRM, the university, the browser, clipboard tools, and the operating system have their own storage rules. Select **Clear** when you finish a student. IT controls access removal and device cleanup.

If a problem continues, ask your technical team for help. Give them the error message and the page name. Do not send student details or documents unless your organisation has approved a safe way to share them.
