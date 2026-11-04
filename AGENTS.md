# Project instructions: SAMS Portal Autofill extension

## Testing policy: no synthetic tests

Mikhail decided that synthetic tests are not useful here. This overrides the global test-shape preference for E2E on fixtures.

- Do not run `npm test`, `npm run test:e2e` or any suite that uses fixtures in `test/` or `e2e/fixtures/`. The files stay in the repository for reference. Do not delete them unless asked.
- Do not write new synthetic tests, fixtures or mock-based checks.
- Verify behavior by having a child agent test the real thing in a real browser through PinchTab, on live CRM and portal pages. Use the approved profile `sams-inventory` only.
- The live-portal rules still apply: no-save, never submit or click Continue, never bypass CAPTCHA, never print credentials or applicant data.
- Do not run headed Playwright or Helium suites on Mikhail's laptop. They steal window focus and make the machine unusable.
- Brief the child with the user-visible behavior to confirm and the exact build to load (`dist/chrome` from `npm run build`). The child reports what it saw on the page, with counts and control ids only.
