# Safari for macOS (development scaffold)

This folder holds the native macOS containing app and the Safari Web Extension target. The extension JavaScript, popup, configuration, and icons stay in the repository root, `src/`, and `config/`. Chrome shares them. Nothing here is a release artifact. Nobody has tested it in a running Safari. For the file layout, see [docs/CODEBASE_MAP.md](../docs/CODEBASE_MAP.md).

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

After that, the project was edited by hand. Do not regenerate it with `--force` or `--copy-resources`. The hand edits are:

- **Bundle identifiers.** The app is `com.example.dev.SAMSPortalAutofill`. The extension is `com.example.dev.SAMSPortalAutofill.Extension`. The packager had made an app identifier that the extension identifier was not nested under. Both are development placeholders under the reserved `example.com` domain. Nobody registered them. They are not SAMS release identifiers.
- **Version.** `MARKETING_VERSION` is `0.2.0`. It matches `package.json` and `manifest.json`.
- **Entitlements.** The generated App Groups registration and the outgoing-network and user-selected-file entitlements are removed. The app and the extension keep only App Sandbox and Hardened Runtime.
- **Native handler.** `SafariWebExtensionHandler.swift` refuses every native request. It does not read, log, or echo the request. The manifest does not request `nativeMessaging`.
- **Help page.** The help page of the app explains enablement and website access. It states that the app never receives student data.

The deployment targets are the packager defaults (the app inherits macOS 27.0, the extension uses 12.0). They are not an approved support floor. `storage.session` needs Safari 16.4 or later.

## Resource ownership

The [approved portal rules](../docs/portal-maps/APPROVED-RULES.md) are shared with Chrome. Rebuild after mapping updates; do not copy an old app over fresh resources. For a production-host-only unsigned local package, use `npm run build:safari:app -- prod`. Packaging parity and Chromium compatibility do not prove native Safari behaviour; see the [verification record](../docs/portal-maps/APPROVED-RULES-VERIFICATION.md).

```text
shared source --scripts/build.mjs--> dist/safari-webextension --Xcode references--> .appex Resources
```

- The extension target references `dist/safari-webextension` through `../../../dist/safari-webextension/...`. `config` and `src` are folder references, so Xcode picks up new files inside them. A new top-level file needs a project update. `test/safari-build.test.js` fails until the project references it.
- Never edit files under `dist/`. Each build target cleans only its own output. `npm run build` owns `dist/chrome` and its zip files. `npm run build:safari` owns `dist/safari-webextension`. `npm run build:safari:app` owns `dist/safari-app`.
- Xcode cannot build until `dist/safari-webextension` exists.

## Build

```sh
npm run build:safari          # dist/safari-webextension, development hosts included
npm run build:safari:app      # unsigned Debug app in dist/safari-app, resource check
npm run build:safari:prod     # stops if the production allowlist is incomplete
```

`build:safari:app` runs the Safari development build. Then it runs:

```sh
xcodebuild -project 'safari/SAMS Portal Autofill/SAMS Portal Autofill.xcodeproj' \
  -scheme 'SAMS Portal Autofill' -configuration Debug \
  -destination 'generic/platform=macOS' \
  -derivedDataPath dist/safari-app/DerivedData CODE_SIGNING_ALLOWED=NO build
```

Then it hashes every file in `Contents/Resources` of the built extension. It fails unless they match `dist/safari-webextension` exactly. It also checks the nested bundle identifier, the app version, and the Safari extension point. The full log is `dist/safari-app/xcodebuild.log`.

This proves that the app compiles and embeds the current generated code. It does not prove that the extension loads or works in Safari. As part of `xcodebuild`, Xcode records each built app with LaunchServices.

## Enable in Safari (operator steps)

These steps change Safari settings. Do them in a dedicated test profile or user account. The built app has only the ad hoc signature of the linker. So Safari probably needs its developer option for unsigned extensions. Apple's current steps are in [Running your Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension).

1. In Safari Settings, turn on the developer features. Then turn on the developer option that allows unsigned extensions. Safari can turn this option off again when it quits.
2. Open `dist/safari-app/DerivedData/Build/Products/Debug/SAMS Portal Autofill.app` once, so that Safari finds the extension. Or run the scheme from Xcode.
3. In Safari Settings, open Extensions. Turn on SAMS Portal Autofill.
4. Allow website access only for the fixture websites or the approved SAMS websites that you test.
5. Follow the [Safari checklist](../e2e/safari/README.md).

Recent Safari versions can also load `dist/safari-webextension` directly as a temporary extension from the developer settings. Safari removes it after 24 hours or when it quits. This method does not test the containing app.

## Behaviour shared with Chrome

Retention follows the Chrome policy. A completed Autofill with at least one successful approved frame counts as activity. It extends the 30 minute expiry, even if another frame failed and is listed as not filled. When every frame fails, the expiry does not extend.

## Out of scope

This scaffold has no iOS target, no signing team, no provisioning, no notarization, and no App Store or Developer ID distribution. It makes no production allowlist change and sets no private-browsing policy. SAMS must decide these points. See [the decisions in the architecture document](../docs/SAFARI-ARCHITECTURE-AND-PARITY.md#decisions-still-owned-by-sams).

## Known limits

- The unsigned Xcode app builds. Its embedded extension resources match the generated `dist/safari-webextension`.
- Nobody has run the containing app UI or the extension in a running Safari. A person must enable the unsigned extension and free the local ports 3000 and 3001 for the fixture server.
- Localhost fixture matching is generic. It does not replace production-origin tests for Bangor, Greenwich, and Greater Manchester. Portal-specific Safari behaviour is unverified.
- A student replacement can still race between the fresh cache read of the popup and the field dispatch. There is no operation token. Page guards for portals and redaction of fill reports are also deferred. These are release hardening items.
- The deployment targets and bundle identifiers are development defaults. Signing and distribution are not implemented.
