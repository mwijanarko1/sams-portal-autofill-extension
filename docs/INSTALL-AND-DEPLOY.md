# Install and controlled deployment

## Development

Run `npm test && npm run build`, then load `dist/chrome` as an unpacked extension from `chrome://extensions`.

## Production package

1. Add the confirmed exact origins to `config/allowlist.js`.
2. Complete and verify all three portal configs and fixtures.
3. Set the release version in `manifest.json` and `package.json`.
4. Run `npm test && npm run build:prod`.
5. Inspect `dist/chrome/manifest.json` and the generated `dist/sams-portal-autofill-prod.zip`.
6. Upload the zip to SAMS's Chrome Web Store developer account as an unlisted item, or deploy the extension ID through Chrome enterprise force-install policy.

The production build rejects an incomplete Campora or portal allowlist. It never includes localhost or `<all_urls>`.

Chrome Web Store submission also needs a SAMS-owned privacy policy URL, data-use disclosures, and host-permission justification. Store and device-management fees are SAMS costs.

## Updates

Change config or code, increment the version, rerun checks, generate a production package, and publish it through the same controlled channel. End users cannot edit approved origins.

## Safari after Chrome acceptance

Convert the verified Chrome package with `xcrun safari-web-extension-converter dist/chrome`. Before distribution, verify `storage.session`, `alarms`, and `scripting` on the supported Safari versions and agree the controlled signing/distribution route with SAMS.
