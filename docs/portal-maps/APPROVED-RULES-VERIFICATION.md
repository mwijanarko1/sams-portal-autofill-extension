# Approved-rule implementation and verification

Date: 2026-10-28. Contract: [APPROVED-RULES.md](APPROVED-RULES.md).

## Result

Implemented the approved mappings, reviewed them locally, rebuilt Chrome and Safari production packages, and refreshed the affected Markdown guides and nine existing Word copies. Build and verification did not publish a release, install the extension or submit an application. Commits and pushes are separate delivery steps. Version remains `0.2.0`.

Claude Sonnet 5.5 implemented production changes in an isolated T3 worktree. The Pi GPT 6.1 Sol lead authored the browser regressions, reviewed the implementation and made bounded corrections. This was lead review, not an independent review.

No extension UI layout or styling changed. The browser evidence checks portal form interactions; it is not an independent visual verdict or a live-portal acceptance result.

## Reproduction and review findings

The same real extension Copy/Autofill flow failed before the implementation:

- Manchester Home Address line 1 received the present address (`12 Present Road`) instead of the explicit permanent address (`34 Permanent Road`).
- Greenwich Full Legal Name stayed blank instead of `Aisha Samira Rahman`.

Both now pass. The before log is [approved-rules-before.log](../../tmp/approved-rules-before.log). These local logs and screenshots are ignored artifacts and are not included in a fresh clone.

Review of Sonnet's proposed patch found and corrected:

1. Greenwich's form-negative blocks did not cover controls without a form. They could receive applicant data. The corrected scopes reject unexpected forms and no-form controls, including the mailing-same radios.
2. Address comparison used unordered unique words, so reordered street numbers counted as the same address. Ordered component comparison now distinguishes them and does not infer an answer from incomplete addresses.
3. Existing Campora Home Address and reference contacts were still discarded despite the new consumers. The reader now copies those explicitly labelled values and refusal-country evidence from a recognised visible table. It does not invent structured address parts or replace the current visa type with a prior visa.
4. The completion parser used zero as a month-only sentinel. It now distinguishes month-only input from invalid day zero.

The proposed-patch check is [approved-sonnet.log](../../tmp/approved-sonnet.log). Its two whitespace/empty-source failures were test-helper issues and were corrected separately; its street-order and no-form failures were production issues. No new unit-test coverage was added. Existing supporting expectations were updated for the approved mapping changes.

## Executed checks

| Check | Observed result | Local log |
|---|---|---|
| `npm run test:e2e` | 86 passed, 0 failed; includes 36 approved-rule browser cases and all 50 existing cases | [e2e-accepted.log](../../tmp/e2e-accepted.log) |
| `npm test` | 135 passed, 0 failed; supporting checks | [supporting-accepted.log](../../tmp/supporting-accepted.log) |
| `node --test --test-concurrency=1 e2e/safari-api-compat.e2e.mjs` | 4 passed, 0 failed; Chromium with selected Safari APIs absent | [safari-compat-final.log](../../tmp/safari-compat-final.log) |
| `npm run build:prod` | Built unpacked Chrome and production ZIP | Output paths below |
| `npm run build:safari:app -- prod` | Built production Safari resources and unsigned macOS app; all 20 embedded resources match | [safari-production-build.log](../../tmp/safari-production-build.log) |
| Bundle/source comparison and archive integrity | Both browser bundles match 12 current shared source files; exact five production hosts; ZIP and nine DOCX archives valid | [approved-bundle-verification.log](../../tmp/approved-bundle-verification.log) |
| Syntax, documentation and diff checks | Changed JavaScript parses; all local links in 18 changed Markdown files resolve; Unicode-dash check and `git diff --check` pass | Checked locally |

The browser cases assert existing-value preservation, no Save/Submit clicks, repeat-fill idempotence and unchanged cached CRM fields. They cover known/unknown/ambiguous nationality, UK versus EU, missing/current/future completion dates, distinct and equal addresses, missing address parts, the conditional correspondence reveal, referee isolation and UK/non-UK refusal evidence. Campora refusal-table cases use synthetic records with the supported table shape; no live refusal record was inspected.

## Screenshots of passing states

- [Manchester addresses and completion](../../tmp/approved-rules-evidence/manchester-addresses-and-completion.png)
- [Greenwich legal name](../../tmp/approved-rules-evidence/greenwich-legal-name.png)
- [Greenwich referee contacts](../../tmp/approved-rules-evidence/greenwich-referee.png)
- [Bangor passport nation and UK refusal](../../tmp/approved-rules-evidence/bangor-passport-and-uk-refusal.png)

Screenshots show the synthetic form state. The E2E assertions, not screenshots alone, establish interaction behaviour.

## Rebuilt artifacts

- Chrome unpacked extension: `dist/chrome/`.
- Chrome production ZIP: `dist/sams-portal-autofill-prod.zip`.
- Safari production resources: `dist/safari-webextension/`.
- Unsigned macOS app: `dist/safari-app/DerivedData/Build/Products/Debug/SAMS Portal Autofill.app`.
- Chrome ZIP SHA256: `71e788d73849accfa14248793a830463cce0d1f655d9afb1664fe89942136e13`.

The app retains the existing development bundle identifiers and build number. It is not a signed distribution release. Reloading an unpacked extension clears its student cache; reload the portal and Copy again.

## Remaining acceptance boundaries

- No new authenticated live portal run. Manchester's real British-passport select has four inventoried options, but its exact option text was not rechecked. Unsupported labels stay unanswered.
- The Greenwich mailing form action follows the inventoried display-route naming, but its exact live action needs confirmation. An unknown action stays manual instead of receiving permanent data.
- No native Safari runtime verification. The app build and missing-API Chromium checks do not prove WebKit form behaviour or Safari permission/toolbar behaviour.
- Campora Home/Present Address summaries are free text. Missing city/postcode/country components remain manual; full address comparison is unavailable without them.
- Agency city/email, unverified agent identifiers, sensitive declarations and the unselected conditional workflows remain manual by approval.

Next acceptance action: reload the unpacked Chrome extension and supervise a Manchester draft check of Passport and Visa plus Contact Details, without saving or submitting.
