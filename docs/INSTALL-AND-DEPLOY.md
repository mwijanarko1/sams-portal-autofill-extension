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

1. Confirm the origins in `config/allowlist.js` (SAMS CRM, Campora in `camporaOrigins`, and the Greenwich, Bangor and Greater Manchester portals) are the intended production hosts. The production build refuses to run if the Campora list is empty or fewer than three portal origins are set.
2. Run the no-save live checks in [e2e/README.md](../e2e/README.md) for the portals SAMS relies on.
3. Set the release version in `manifest.json`, `package.json`, and the Safari Xcode `MARKETING_VERSION`.
4. Run `npm test && npm run build:prod`.
5. Inspect `dist/chrome/manifest.json` and the generated `dist/sams-portal-autofill-prod.zip`.
6. Upload the zip to SAMS's Chrome Web Store developer account as an unlisted item, or deploy the extension ID through Chrome enterprise force-install policy.

The production build rejects an incomplete Campora or portal allowlist (`scripts/build.mjs`). It never includes localhost or `<all_urls>`. Each build target cleans only its own `dist` paths, so a Chrome build does not delete Safari output.

Chrome Web Store submission also needs a SAMS-owned privacy policy URL, data-use disclosures, and host-permission justification. Store and device-management fees are SAMS costs. Local drafts of the policy text, permission justifications, listing, reviewer instructions and image inventory are in [store-submission/STORE-SUBMISSION-PACK.md](store-submission/STORE-SUBMISSION-PACK.md); they are not hosted, reviewed or submitted.

## Updates

Change config or code, increment the version, rerun checks, generate a production package, and publish it through the same controlled channel. End users cannot edit approved origins.

## Safari packaging

The checked-in Xcode project under `safari/` embeds resources from `dist/safari-webextension` (built by `scripts/build.mjs`). Do not regenerate the project with `--force` or `--copy-resources`.

```sh
npm run build:safari:prod   # refused until the production allowlist is complete
npm run build:safari:app    # local unsigned Debug app + embedded-resource hash check
```

Before distribution: verify `storage.session`, `alarms`, and `scripting` on the supported Safari versions; complete the Safari acceptance checklist; replace development bundle identifiers; and agree the controlled signing/distribution route with SAMS (Developer ID notarized app or App Store). See [SAFARI-ARCHITECTURE-AND-PARITY.md](SAFARI-ARCHITECTURE-AND-PARITY.md).
