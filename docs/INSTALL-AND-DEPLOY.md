# Install and controlled deployment

## Development

Run `npm test && npm run build`, then load `dist/chrome` as an unpacked extension from `chrome://extensions`.

Safari development uses the same shared source:

```sh
npm run build:safari        # dist/safari-webextension
npm run build:safari:app    # unsigned macOS app in dist/safari-app
```

Enablement steps and resource ownership are in [safari/README.md](../safari/README.md). Manual Safari acceptance is in [e2e/safari/README.md](../e2e/safari/README.md). Repository layout is in [CODEBASE_MAP.md](CODEBASE_MAP.md).

## Production package (Chrome)

1. Confirm the Campora origin in `config/allowlist.js` (`camporaOrigins`) is still the intended production host. It is configured together with the Greenwich, Bangor and Greater Manchester origins, so the production allowlist gate passes today; a first Campora-to-Bangor no-save sample passed, but full live Campora acceptance is still required.
2. Complete and verify all three portal configs and fixtures.
3. Set the release version in `manifest.json`, `package.json`, and the Safari Xcode `MARKETING_VERSION`.
4. Run `npm test && npm run build:prod`.
5. Inspect `dist/chrome/manifest.json` and the generated `dist/sams-portal-autofill-prod.zip`.
6. Upload the zip to SAMS's Chrome Web Store developer account as an unlisted item, or deploy the extension ID through Chrome enterprise force-install policy.

The production build rejects an incomplete Campora or portal allowlist. It never includes localhost or `<all_urls>`. Each build target cleans only its own `dist` paths, so a Chrome build does not delete Safari output.

Chrome Web Store submission also needs a SAMS-owned privacy policy URL, data-use disclosures, and host-permission justification. Store and device-management fees are SAMS costs. Local drafts of the policy text, permission justifications, listing, reviewer instructions and image inventory are in [publication/STORE-SUBMISSION-PACK.md](publication/STORE-SUBMISSION-PACK.md); they are not hosted, reviewed or submitted. Current blockers: [publication/PREPARATION-REPORT.md](publication/PREPARATION-REPORT.md).

## Updates

Change config or code, increment the version, rerun checks, generate a production package, and publish it through the same controlled channel. End users cannot edit approved origins.

## Safari packaging

The checked-in Xcode project under `safari/` embeds resources from `dist/safari-webextension` (built by `scripts/build.mjs`). Do not regenerate the project with `--force` or `--copy-resources`.

```sh
npm run build:safari:prod   # refused until the production allowlist is complete
npm run build:safari:app    # local unsigned Debug app + embedded-resource hash check
```

Before distribution: verify `storage.session`, `alarms`, and `scripting` on the supported Safari versions; complete the Safari acceptance checklist; replace development bundle identifiers; and agree the controlled signing/distribution route with SAMS (Developer ID notarized app or App Store). See [SAFARI-ARCHITECTURE-AND-PARITY.md](SAFARI-ARCHITECTURE-AND-PARITY.md).
