# Project instructions: SAMS Portal Autofill extension

## Live credentials and sign-in

- Project login credentials are in `.env.local` at the repository root. Check the relevant entries before reporting missing credentials or asking Mikhail to sign in manually. A signed-out browser profile alone is not a blocker.
- Use these credentials internally to sign into the relevant Campora, CRM and university portal accounts through PinchTab with the approved `sams-inventory` profile. Submitting a login form is allowed; submitting or saving application data is not.
- Never print `.env.local`, credential values, cookies or tokens. Load only the entries needed for the account being tested without exposing values in tool inputs, command arguments, logs, reports or child handoffs.
- Parse `.env.local` literally with a dotenv-compatible loader. Never use shell `source` or `eval`: shell expansion can corrupt passwords containing `$` and cause false login failures.
- Do not dump full Campora page text or HTML. Its debug bar can expose session cookies and CSRF tokens. Inspect only the specific form or control needed, with redacted outputs.
- Every live-browser child handoff must include the `.env.local` credential location and permission to use the relevant entries for sign-in. Do not forbid credential access and then treat expired sessions as an unavoidable blocker.
- If the relevant entry is missing, sign-in fails, or MFA/CAPTCHA requires human action, report that specific blocker without revealing secrets. Do not bypass authentication challenges. Signing in does not authorize selecting an unrelated real applicant.

## Testing policy: no synthetic tests

Mikhail decided that synthetic tests are not useful here. This overrides the global test-shape preference for E2E on fixtures.

- Do not run `npm test`, `npm run test:e2e` or any suite that uses fixtures in `test/` or `e2e/fixtures/`. The files stay in the repository for reference. Do not delete them unless asked.
- Do not write new synthetic tests, fixtures or mock-based checks.
- Verify behavior by having a child agent test the real thing in a real browser through PinchTab, on live CRM and portal pages. Use the approved profile `sams-inventory` only.
- The live-portal rules still apply: no-save, never submit an application or click Continue, never bypass CAPTCHA, never print credentials or applicant data.
- Do not run headed Playwright or Helium suites on Mikhail's laptop. They steal window focus and make the machine unusable.
- Brief the child with the user-visible behavior to confirm and the exact build to load (`dist/chrome` from `npm run build`). The child reports what it saw on the page, with counts and control ids only.
