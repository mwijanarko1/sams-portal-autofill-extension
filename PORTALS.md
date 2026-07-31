# SAMS Portal Autofill — University portal test matrix

Target for SAMS meeting prep. Extension: **SAMS Portal Autofill** v2.2+  
CRM backend: `http://localhost:3000` (must be running)

## Prerequisites

1. Load unpacked extension from this folder (`chrome://extensions` → Developer mode).
2. Start CRM:
   ```bash
   cd sams-crm-ai-demo && npm run dev
   ```
3. **Log into each portal manually** before autofill (extension never logs in).
4. Open a real application form step (personal details / contact), not just the login page.
5. Select a demo student in the extension popup → **Autofill This Page**.
6. Review every filled field. Never auto-submit.

## Portals to test

| # | University | Portal | Login URL | Notes |
|---|------------|--------|-----------|--------|
| 1 | **Sunderland University** | myApplication / e:Vision + online apply | https://evision.sunderland.ac.uk/ · https://apply.online.sunderland.ac.uk/ | Forms often in frames — v2.2 injects all frames |
| 2 | **University of Greater Manchester** (ex-Bolton) | International / agent applicant flow | https://greatermanchester.ac.uk/international/how-to-apply-and-admissions | Confirm agent-specific URL with SAMS if different |
| 3 | **Keele University** | Keele Agent Portal (+ KUIC StudyLink if used) | Register: https://www.keele.ac.uk/study/internationalstudents/agentportalregistration/ | Need approved agent login |
| 4 | **Ulster University QA** | QA Higher Education Agent Portal | https://agent.qahighereducation.com/s/login/ | Salesforce Experience Cloud; multi-step |

## Per-portal checklist

Copy for each university:

```
University: _______________
Date: _______________
Agent account: _______________
Student CRM id: _______________

[ ] CRM running; extension loaded (v2.2+)
[ ] Logged into portal
[ ] On application form step (not login)
[ ] Profile fetched — field count: ___
[ ] Fields detected (incl. frames): ___
[ ] Fields filled: ___
[ ] Skipped (existing value): ___
[ ] Unmatched CRM keys: ___

Personal details
[ ] Given / first name
[ ] Family / surname
[ ] Date of birth (expect DD/MM/YYYY on text; YYYY-MM-DD on type=date)
[ ] Nationality / citizenship dropdown
[ ] Gender (if present)

Contact
[ ] Email
[ ] Phone / mobile
[ ] Address / city / postcode / country

Education / English (if on this step)
[ ] Institution
[ ] Degree / qualification
[ ] IELTS / test scores

Issues / screenshots:
-

Next step: re-run Autofill on next wizard page? Y/N
```

## How to demo (2 minutes)

1. CRM open with a full student profile.
2. Portal open on **Personal details** (already logged in).
3. Click extension → search student → Autofill.
4. Point at filled fields + “never submits — counsellor reviews”.
5. Navigate to next step → Autofill again.

## Known limits (say this if asked)

- **Page-by-page only** — multi-step wizards need Autofill once per step.
- **No login / MFA / captcha** — human does that.
- **Select options** need CRM text to roughly match option labels.
- **Shadow DOM / canvas widgets** may not fill; fall back to manual.
- **Local demo CRM only** — not production auth.

## If 0 fields detected

1. Confirm you are past login and on a form step.
2. Click inside the form iframe (if any), then reopen the extension.
3. Reload the tab, re-inject (open popup again).
4. Check DevTools → Elements for `iframe` wrapping the form.
5. Note portal name for a follow-up synonym / selector fix.
