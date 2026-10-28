# Release status

Extension version `0.1.0`, status date 2026-10-28. This page says what has been verified, what has not, and who owns each open item. Nothing here is a release approval or a legal opinion.

## Packaging

| Item | State |
|---|---|
| Chrome production build | `npm run build:prod` succeeds and writes `dist/chrome` and `dist/sams-portal-autofill-prod.zip`. The production manifest lists only the SAMS CRM origin, the Campora origin and the Greenwich, Bangor and Greater Manchester origins as `host_permissions`. No localhost entry and no `<all_urls>`. `optional_host_permissions` stays `https://*/*` so staff can grant one site at a time. |
| Production allowlist gate | `scripts/build.mjs` refuses a production build unless `camporaOrigins` is non-empty and `portalOrigins` has at least three entries. It proves only that the allowlist is complete, not that integrations work live. |
| Safari resources | `npm run build:safari:prod` writes `dist/safari-webextension`. `npm run build:safari:app` builds an unsigned macOS app for development. |
| Signing and store upload | Not done. Both need SAMS-owned accounts (see "SAMS-owned steps"). |

## Automated verification (2026-10-28)

| Command | Result |
|---|---|
| `npm test` | 135 of 135 passed (Node unit tests and Chromium DOM fixtures). |
| `npm run test:e2e` | 50 of 50 passed in a visible Chromium (Helium) with the extension loaded, against synthetic pages. |

These suites use synthetic pages. They are not live-portal or Safari acceptance.

## Live portal acceptance

| Portal | Origin | Field map | Live CRM-to-portal acceptance |
|---|---|---|---|
| University of Greenwich | `nelson.gre.ac.uk` | Mapped, all ten checklist sections inventoried | Not complete. Login needs a human CAPTCHA, which must not be automated. |
| Bangor University | `apps.bangor.ac.uk` | Mapped, all sections inventoried | One supervised Campora-to-Bangor no-save sample passed (2026-10-25): Copy returned 30 fields, eight Bangor controls filled, zero blocked writes. One application and one portal, not full acceptance. |
| University of Greater Manchester | `evision.bolton.ac.uk` | Mapped, PD, CD, PI, QU, EX, PS, PA and SU inventoried | Not run live. |

The no-save live runners are `npm run test:e2e:live` and `npm run test:e2e:documents:live`. Setup and safeguards are in [e2e/README.md](../e2e/README.md). Portal detail is in [PORTALS.md](../PORTALS.md) and [portal-maps/](portal-maps/).

Needed from SAMS to close this: supervised test applications at each portal, a CRM or Campora test lead with the needed fields, a person to complete the Greenwich CAPTCHA, and a decision on whether portal drafts may be saved during a test (portals can autosave on input; the extension does not block that).

## Safari

The unsigned development app builds and embeds the current resources. The manual acceptance checklist in [e2e/safari/README.md](../e2e/safari/README.md) (cases S2 to S16: Copy, Autofill, repeat fill, Clear, expiry, frames, private window) has not been run in installed Safari. Chromium or WebKit are not used as a Safari substitute. A person must enable the unsigned extension in a dedicated Safari profile, grant access to the fixture hosts, and run the checklist.

Signed distribution also needs a SAMS Apple developer team, production bundle identifiers to replace `com.example.dev.*`, a chosen route (Developer ID plus notarisation, or App Store Connect), and a privacy policy URL that covers the extension. See [SAFARI-ARCHITECTURE-AND-PARITY.md](SAFARI-ARCHITECTURE-AND-PARITY.md).

## SAMS-owned steps

- **Privacy policy.** SAMS already publishes https://samscrm.co.uk/privacy-policy/ (checked 2026-10-22). It does not yet describe the extension. Proposed insertion text is in [store-submission/PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md](store-submission/PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md). It is a draft that needs SAMS publisher and legal review.
- **Chrome Web Store.** A SAMS developer account, a support contact, the distribution choice (unlisted item or enterprise force-install) and approval of the draft listing, reviewer instructions and store images. Drafts: [store-submission/STORE-SUBMISSION-PACK.md](store-submission/STORE-SUBMISSION-PACK.md). An unlisted link is not an access-control boundary.
- **Operational controls.** CRM media-server authorisation after logout, account and token revocation, endpoint cleanup and downstream retention need verification by the system owners. See "Employee offboarding and device loss" in [TECHNICAL-HANDOVER.md](TECHNICAL-HANDOVER.md).

## Known product gaps

1. **In-product disclosure.** Chrome's user data policy expects prominent disclosure and consent inside the product for user-data handling, and no private-staff-tool exemption was established. The popup has no consent step before **Copy from CRM** (it shows the 30 minute expiry after a copy). Adding one is a UI change that needs its own approval and verification.
2. **Attach CRM documents** assigns the file in the browser. It is not proof the portal accepted or uploaded it. Some portals upload as soon as a file is attached; portals that hide the file input behind their own widget need manual attachment. The live document runner reports inaccessible forms as blocked, not passed.
3. **Campora** documents are not listed or fetched; staff attach them manually.
4. **Non-UK Home Telephone** values over Greenwich's 11-character limit need manual correction.
5. **CRM Copy keeps one value per field**, so a second education, passport, visa, work or reference entry is not stored.
6. **Student replacement race.** A popup cache read can race an in-flight fill; there is no operation token yet.

The remaining risks and limits are listed in [CODEBASE_MAP.md](CODEBASE_MAP.md#known-risks).
