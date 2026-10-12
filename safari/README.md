# Safari for macOS (development scaffold)

This folder holds only the native macOS containing app and the Safari Web Extension
target. The extension's JavaScript, popup, configuration and icons stay in the
repository root, `src/` and `config/`, shared with Chrome. Nothing here is a release
artifact, and nothing here has been tested in a running Safari yet. Full repo map:
[docs/CODEBASE_MAP.md](../docs/CODEBASE_MAP.md).

## Layout

```text
safari/SAMS Portal Autofill/
  SAMS Portal Autofill.xcodeproj      app and extension targets, scheme "SAMS Portal Autofill"
  SAMS Portal Autofill/               containing app: Safari enablement help only
  SAMS Portal Autofill Extension/     Safari extension registration and handler stub
```

The project was generated once with Xcode 27.0 (`27A266a`):

```sh
npm run build:safari
xcrun safari-web-extension-packager dist/safari-webextension \
  --project-location safari --app-name 'SAMS Portal Autofill' \
  --bundle-identifier com.example.dev.SAMSPortalAutofill \
  --swift --macos-only --no-open --no-prompt
```

Then it was edited by hand. Do not regenerate it with `--force` or `--copy-resources`.
The hand edits were:

- Bundle identifiers: app `com.example.dev.SAMSPortalAutofill`, extension
  `com.example.dev.SAMSPortalAutofill.Extension`. The packager had produced an app
  identifier that the extension identifier was not nested under. Both are
  development-only placeholders under the reserved `example.com` domain. They are not
  registered anywhere and are not SAMS release identifiers.
- `MARKETING_VERSION` is `0.1.0`, matching `package.json` and `manifest.json`.
- Removed the generated App Groups registration, outgoing-network and user-selected-file
  entitlements. The app and extension keep only App Sandbox and Hardened Runtime.
- `SafariWebExtensionHandler.swift` refuses every native request without reading,
  logging or echoing it. The manifest does not request `nativeMessaging`.
- The app's help page explains enablement and website access, and states that the app
  never receives student data.

Deployment targets are the packager defaults (app inherits macOS 27.0, extension 12.0).
They are not an approved support floor. `storage.session` needs Safari 16.4 or later.

## Resource ownership

```text
shared source --scripts/build.mjs--> dist/safari-webextension --Xcode references--> .appex Resources
```

- The extension target references `dist/safari-webextension` through
  `../../../dist/safari-webextension/...`. `config` and `src` are folder references, so
  new files inside them are picked up. A new top-level file needs a project update;
  `test/safari-build.test.js` fails until the project references it.
- Never edit files under `dist/`. Each build target cleans only its own output:
  `npm run build` owns `dist/chrome` and its ZIPs, `npm run build:safari` owns
  `dist/safari-webextension`, and `npm run build:safari:app` owns `dist/safari-app`.
- Xcode cannot build until `dist/safari-webextension` exists.

## Build

```sh
npm run build:safari          # dist/safari-webextension, development hosts included
npm run build:safari:app      # unsigned Debug app in dist/safari-app, resource check
npm run build:safari:prod     # refused until the production allowlist is complete
```

`build:safari:app` runs the Safari development build, then:

```sh
xcodebuild -project 'safari/SAMS Portal Autofill/SAMS Portal Autofill.xcodeproj' \
  -scheme 'SAMS Portal Autofill' -configuration Debug \
  -destination 'generic/platform=macOS' \
  -derivedDataPath dist/safari-app/DerivedData CODE_SIGNING_ALLOWED=NO build
```

It then hashes every file in the built extension's `Contents/Resources` and fails unless
they match `dist/safari-webextension` exactly. It also checks the nested bundle
identifier, app version and Safari extension point. The full log is
`dist/safari-app/xcodebuild.log`.

This proves the app compiles and embeds the current generated code. It does not prove the
extension loads or behaves correctly in Safari. Xcode records each built app with
LaunchServices as a normal part of `xcodebuild`.

## Enable in Safari (operator steps)

These steps change Safari settings, so the operator must choose to do them in a dedicated
test profile or user account. The built app has only the linker's ad hoc signature, so
Safari is expected to require its developer option for unsigned extensions. Apple's
current steps are in
[Running your Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension).

1. In Safari Settings, enable the developer features, then the developer option that
   allows unsigned extensions. Safari can turn this option off again when it quits.
2. Open `dist/safari-app/DerivedData/Build/Products/Debug/SAMS Portal Autofill.app` once,
   so Safari can discover the extension, or run the scheme from Xcode.
3. In Safari Settings, Extensions, turn on SAMS Portal Autofill.
4. Allow website access only for the fixture or approved SAMS websites being tested.
5. Follow [the Safari acceptance checklist](../e2e/safari/README.md).

Alternatively, recent Safari versions can load `dist/safari-webextension` directly as a
temporary extension from the developer settings. Safari removes it after 24 hours or on
quit. That route does not test the containing app.

## Shared behavior kept from Chrome

Retention follows the existing Chrome policy. A completed Autofill with at least one
successful approved frame counts as activity and extends the 30 minute expiry, even when
another frame failed and is listed as not filled. When every frame fails, expiry is not
extended. This is compatibility behavior, not a new scope decision.

## Not in scope here

No iOS target, signing team, provisioning, notarization, App Store or Developer ID
distribution, production allowlist change, or private-browsing policy. Those need SAMS
decisions listed in
[the architecture document](../docs/SAFARI-ARCHITECTURE-AND-PARITY.md#decisions-still-owned-by-sams).

## Verification snapshot (2026-10-12)

- Independent lead checks: `npm test` passed 61/61; `npm run test:e2e` passed 5/5 Chromium extension journeys.
- Unsigned Xcode app build succeeded. All 18 embedded extension resources match the generated Safari output; native help CSS matches its source.
- Help-page scrolling was tested at 425x325 and 150% text in Chromium. Neither the containing app UI nor extension behavior was exercised in a running Safari.
- Real Safari acceptance remains blocked on operator-approved unsigned-extension enablement and fixture ports 3000/3001, currently owned by unrelated development servers. Leave those services running until their owners approve a change.
- Localhost fixture matching is generic, not a substitute for production-origin Bangor/Greenwich configuration acceptance. Portal-specific Safari parity remains unverified.
- A student replacement can still race between the popup's fresh cache read and field dispatch. No operation token was added. Portal page guards and fill-report redaction are also deferred; these are release hardening items, not verified Safari fixes.
- Deployment targets and bundle identifiers remain development defaults. Production packaging still rejects the incomplete Campora/third-portal allowlist; signing and distribution are not implemented.

Full implementation and review evidence remains in local project task records, which are not included in the repository or distribution package.
