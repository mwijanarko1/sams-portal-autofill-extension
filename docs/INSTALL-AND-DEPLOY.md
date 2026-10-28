# Install and deploy

## Development

1. Run `npm ci` once. You need Node.js and npm.
2. Run `npm test && npm run build`.
3. Open `chrome://extensions`, turn on Developer mode, and load `dist/chrome` as an unpacked extension.

Safari development uses the same source:

```sh
npm run build:safari        # dist/safari-webextension
npm run build:safari:app    # unsigned macOS app in dist/safari-app
```

For Safari enablement and resource ownership, see [safari/README.md](../safari/README.md). For the manual Safari checks, see [e2e/safari/README.md](../e2e/safari/README.md).

## Production package (Chrome)

After applying the [approved mapping rules](portal-maps/APPROVED-RULES.md), run the extension regressions before rebuilding. `npm run build:prod` refreshes the unpacked Chrome folder and production zip. `npm run build:safari:app -- prod` builds production Safari resources and an unsigned local app with an embedded-resource hash check. These commands do not publish, sign, install or approve a release. Reload an existing unpacked extension and portal page after rebuilding; reload clears the copied student, so Copy again. See [verification status](portal-maps/APPROVED-RULES-VERIFICATION.md).

1. Check the origins in `config/allowlist.js`: SAMS CRM, Campora (`camporaOrigins`), and the Greenwich, Bangor, and Greater Manchester portals. Confirm that each one is the correct production host. The production build stops if the Campora list is empty or if fewer than three portal origins are set.
2. Run the no-save live checks in [e2e/README.md](../e2e/README.md) for the portals that SAMS uses.
3. Set the release version in `manifest.json`, `package.json`, and the Safari Xcode `MARKETING_VERSION`.
4. Run `npm test && npm run build:prod`.
5. Check `dist/chrome/manifest.json` and `dist/sams-portal-autofill-prod.zip`.
6. Upload the zip to the SAMS Chrome Web Store developer account as an unlisted item. Or deploy the extension ID with a Chrome enterprise force-install policy.

The production build never includes localhost or `<all_urls>`. Each build target cleans only its own `dist` paths. A Chrome build does not delete the Safari output.

## Chrome Web Store

A store submission needs:

- A privacy policy URL that SAMS owns.
- Data-use disclosures.
- A justification for each host permission.

SAMS pays the store and device-management fees. The drafts are in [store-submission/STORE-SUBMISSION-PACK.md](store-submission/STORE-SUBMISSION-PACK.md). They cover the policy text, permission justifications, the store listing, reviewer instructions, and the image inventory. SAMS has not reviewed, hosted, or submitted them.

## Updates

1. Change the config or code.
2. Increase the version.
3. Run the checks.
4. Build the production package.
5. Publish it through the same channel.

Users cannot edit the approved origins.

## Safari packaging

The Xcode project in `safari/` embeds resources from `dist/safari-webextension`. `scripts/build.mjs` builds that folder. Do not regenerate the project with `--force` or `--copy-resources`.

```sh
npm run build:safari:prod   # stops if the production allowlist is incomplete
npm run build:safari:app    # unsigned Debug app and embedded-resource hash check
```

Before you distribute the Safari build:

1. Check `storage.session`, `alarms`, and `scripting` on the Safari versions that staff use.
2. Complete the Safari checklist.
3. Replace the development bundle identifiers.
4. Agree the signing and distribution route with SAMS: a notarized Developer ID app, or the App Store.

See [SAFARI-ARCHITECTURE-AND-PARITY.md](SAFARI-ARCHITECTURE-AND-PARITY.md).
