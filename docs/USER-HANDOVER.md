# SAMS Portal Autofill: how to use it

This guide is for staff who already have the extension installed. It explains how to copy one student from SAMS CRM and fill a university application draft. It does not cover installation.

**What this extension does.** It copies visible student details (and a list of CRM documents) into temporary browser memory, then helps you fill empty fields on a university form page. You still save, continue, pay, declare, and submit yourself.

**What it does not do.** It does not submit forms. It does not overwrite a field that already has a value. It does not choose documents for you. It does not keep student data after you clear it, after about 30 minutes of inactivity, after you restart the browser, or after the extension is reloaded or updated.

Mapped universities today are University of Greenwich, Bangor University, and University of Greater Manchester. Other universities use careful matching for common personal and contact fields only. Expect more manual work outside those three.

---

## Before you start

1. Sign into SAMS CRM the normal way (your usual browser sign-in).
2. Work with **one student at a time**. A new successful **Copy from CRM** replaces the previous student in the extension.
3. Keep the CRM student profile tab open if you plan to attach documents later.

---

## Step 1. Open one student in the CRM

1. In SAMS CRM, open the individual student profile you need.
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
4. For each upload field, open the document list and choose the correct CRM file yourself. Suggested options may be marked. The extension never selects one for you.
5. Select **Attach** only after you are sure the choice is correct.
6. Check the portal page. The file may already be uploading or saved by the portal's own behaviour.

Keep the popup open while you choose and attach files. If you close it or change form pages, select **Attach CRM documents** again to refresh the upload list.

Supported attach types are pdf, jpg, jpeg, png, doc, and docx. Files larger than 10 MB are refused. Attach those manually in the portal.

**View** opens the CRM file URL in a normal browser tab so you can inspect it. That is separate from **Attach**, which fetches the file only when you attach it.

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

## Supported universities and matching

| Situation | What to expect |
|---|---|
| University of Greenwich | Saved mapping for many fields on known pages. Still review everything. |
| Bangor University | Saved mapping for many fields on known pages. Still review everything. |
| University of Greater Manchester | Saved mapping for many fields on known pages. Still review everything. |
| Other universities | Common personal and contact details only, such as name, email, phone, and address. The extension leaves a field empty if it cannot find a safe match. Complete the remaining fields yourself. |

A saved mapping does not cover every field. Check each page and complete any missing details yourself.

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
| Student card disappeared | Copy again. Data expires after inactivity, browser restart, or extension reload. |
| Safari or another browser behaves differently | Ask your technical team which browser to use. Autofill and document attachment are not confirmed to work in every browser. |

---

## Privacy note (simple)

The extension keeps copied details in temporary browser memory. This is separate from the normal browser cache. The extension does not send this copy to its own cloud service or share it between browser profiles. It keeps document names and links, not the actual files. When you select **Attach**, it reads the chosen file from CRM and gives it to the university page. Select **Clear** when you finish a student.

If a problem continues, ask your technical team for help. Share the error message and the page name. Do not send student details or documents unless your organisation has approved a safe way to share them.
