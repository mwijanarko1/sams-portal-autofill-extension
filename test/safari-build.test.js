const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const sharedResources = ["config", "src", "popup.html", "popup.js", "sams-logo.svg", "icon16.png", "icon48.png", "icon128.png"];
const productionGuard = "Production allowlist is incomplete. Add the confirmed Campora and three portal origins in config/allowlist.js.";
const xcodeRoot = path.join(root, "safari/SAMS Portal Autofill");
const pbxproj = fs.readFileSync(path.join(xcodeRoot, "SAMS Portal Autofill.xcodeproj/project.pbxproj"), "utf8");
const stagedDirs = [];

test.after(() => {
  for (const dir of stagedDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// Builds run in a staged copy so tests never replace a developer's dist output.
function stage() {
  fs.mkdirSync(path.join(root, "tmp"), { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "tmp/build-test-"));
  stagedDirs.push(dir);
  for (const source of [...sharedResources, "scripts", "manifest.json", "package.json"]) {
    fs.cpSync(path.join(root, source), path.join(dir, source), { recursive: true });
  }
  return dir;
}

function build(dir, ...args) {
  return spawnSync(process.execPath, [path.join(dir, "scripts/build.mjs"), ...args], { cwd: dir, encoding: "utf8" });
}

function files(dir) {
  return fs.readdirSync(dir, { recursive: true })
    .filter((file) => fs.statSync(path.join(dir, file)).isFile())
    .sort();
}

test("Safari dev build generates exact hosts and byte-identical shared resources", () => {
  const dir = stage();
  const result = build(dir, "dev", "safari");
  assert.equal(result.status, 0, result.stderr);
  const out = path.join(dir, "dist/safari-webextension");
  assert.deepEqual(fs.readdirSync(path.join(dir, "dist")), ["safari-webextension"]);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.host_permissions, [
    "https://app.samscrm.co.uk/*",
    "https://v-sams-backend.samsapply.co.uk/*",
    "https://nelson.gre.ac.uk/*",
    "https://apps.bangor.ac.uk/*",
    "https://evision.bolton.ac.uk/*",
    "http://localhost:3000/*",
    "http://localhost:3001/*",
    "http://127.0.0.1:3001/*",
  ]);
  assert.deepEqual(manifest.permissions, ["storage", "activeTab", "scripting", "alarms", "webNavigation"]);
  assert.deepEqual(manifest.background, { service_worker: "src/background.js" });
  assert.equal(manifest.version, require("../package.json").version);

  const expected = sharedResources.flatMap((source) => {
    const full = path.join(dir, source);
    return fs.statSync(full).isDirectory() ? files(full).map((file) => path.join(source, file)) : [source];
  });
  assert.deepEqual(files(out), [...expected, "manifest.json"].sort());
  for (const file of expected) {
    if (file === "config/build-mode.js") continue;
    assert.ok(fs.readFileSync(path.join(out, file)).equals(fs.readFileSync(path.join(dir, file))), file);
  }
  assert.equal(fs.readFileSync(path.join(out, "config/build-mode.js"), "utf8"), 'globalThis.SAMS_BUILD_MODE = "dev";\n');
});

test("Chrome and Safari builds each replace only their own output", () => {
  const dir = stage();
  assert.equal(build(dir, "dev", "safari").status, 0);
  assert.equal(build(dir, "dev").status, 0);
  assert.deepEqual(fs.readdirSync(path.join(dir, "dist")).sort(), ["chrome", "safari-webextension", "sams-portal-autofill-dev.zip"]);
  fs.writeFileSync(path.join(dir, "dist/safari-webextension/stale.js"), "");
  fs.writeFileSync(path.join(dir, "dist/chrome/stale.js"), "");
  assert.equal(build(dir, "dev", "safari").status, 0);
  assert.equal(fs.existsSync(path.join(dir, "dist/safari-webextension/stale.js")), false);
  assert.equal(fs.existsSync(path.join(dir, "dist/chrome/stale.js")), true);
  assert.equal(fs.existsSync(path.join(dir, "dist/sams-portal-autofill-dev.zip")), true);
});

test("production builds for both targets keep the incomplete-allowlist guard and leave outputs untouched", () => {
  const dir = stage();
  assert.equal(build(dir, "dev", "safari").status, 0);
  assert.equal(build(dir, "dev").status, 0);
  const allowlist = path.join(dir, "config/allowlist.js");
  // The real Campora origin is configured; stage an empty list so the guard itself stays covered.
  fs.writeFileSync(
    allowlist,
    fs.readFileSync(allowlist, "utf8").replace(
      'camporaOrigins: ["https://v-sams-backend.samsapply.co.uk"],',
      "camporaOrigins: [],",
    ),
  );
  const before = files(path.join(dir, "dist"));
  for (const args of [["prod"], ["prod", "safari"]]) {
    const result = build(dir, ...args);
    assert.notEqual(result.status, 0, args.join(" "));
    assert.ok(result.stderr.includes(productionGuard), result.stderr);
  }
  assert.deepEqual(files(path.join(dir, "dist")), before);
});

test("a production Safari build excludes development hosts once the allowlist is complete", () => {
  const dir = stage();
  const allowlist = path.join(dir, "config/allowlist.js");
  // Synthetic Campora origin exists only in this staged copy; three portal origins are already real.
  fs.writeFileSync(
    allowlist,
    fs.readFileSync(allowlist, "utf8").replace(
      'camporaOrigins: ["https://v-sams-backend.samsapply.co.uk"],',
      'camporaOrigins: ["https://campora.example"],'
    )
  );
  const result = build(dir, "prod", "safari");
  assert.equal(result.status, 0, result.stderr);
  const out = path.join(dir, "dist/safari-webextension");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8")).host_permissions, [
    "https://app.samscrm.co.uk/*",
    "https://campora.example/*",
    "https://nelson.gre.ac.uk/*",
    "https://apps.bangor.ac.uk/*",
    "https://evision.bolton.ac.uk/*",
  ]);
  assert.equal(fs.readFileSync(path.join(out, "config/build-mode.js"), "utf8"), 'globalThis.SAMS_BUILD_MODE = "prod";\n');
});

test("build rejects an unknown target and output missing a referenced script", () => {
  const dir = stage();
  const unknown = build(dir, "dev", "firefox");
  assert.notEqual(unknown.status, 0);
  assert.ok(unknown.stderr.includes("Build target must be one of: chrome, safari."), unknown.stderr);
  fs.rmSync(path.join(dir, "src/portal-fill.js"));
  const missing = build(dir, "dev", "safari");
  assert.notEqual(missing.status, 0);
  assert.ok(missing.stderr.includes("Build output is missing referenced resources: src/portal-fill.js"), missing.stderr);
});

test("Xcode extension target references every generated top-level resource and nothing else", () => {
  const dir = stage();
  assert.equal(build(dir, "dev", "safari").status, 0);
  const generated = fs.readdirSync(path.join(dir, "dist/safari-webextension")).sort();
  const referenced = [...pbxproj.matchAll(/path = "\.\.\/\.\.\/\.\.\/dist\/safari-webextension\/([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(referenced, generated);
  assert.equal((pbxproj.match(/\/\* (?:config|src|manifest\.json|popup\.html|popup\.js|sams-logo\.svg|icon\d+\.png) in Resources \*\/ = \{isa = PBXBuildFile/g) || []).length, generated.length);
});

test("native project stays macOS-only, versioned with the extension, and holds no extension JavaScript copy", () => {
  const version = require("../package.json").version;
  assert.equal(require("../manifest.json").version, version);
  const versions = [...pbxproj.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(versions)], [version]);
  const builds = [...pbxproj.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(builds)], ["1"], "App and extension share one integer build number");
  const ids = [...new Set([...pbxproj.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((match) => match[1]))].sort();
  assert.deepEqual(ids, ["com.example.dev.SAMSPortalAutofill", "com.example.dev.SAMSPortalAutofill.Extension"]);
  const viewController = fs.readFileSync(path.join(xcodeRoot, "SAMS Portal Autofill/ViewController.swift"), "utf8");
  assert.match(viewController, /let extensionBundleIdentifier = "com\.example\.dev\.SAMSPortalAutofill\.Extension"/);
  assert.deepEqual([...new Set([...pbxproj.matchAll(/SDKROOT = ([^;]+);/g)].map((match) => match[1]))], ["macosx"]);
  const nativeScripts = files(path.join(root, "safari")).filter((file) => file.endsWith(".js"));
  assert.deepEqual(nativeScripts, ["SAMS Portal Autofill/SAMS Portal Autofill/Resources/Script.js"]);
});

test("native app and extension have no student-data channel", () => {
  assert.equal(require("../manifest.json").permissions.includes("nativeMessaging"), false);
  for (const setting of ["REGISTER_APP_GROUPS", "ENABLE_OUTGOING_NETWORK_CONNECTIONS", "ENABLE_INCOMING_NETWORK_CONNECTIONS", "ENABLE_USER_SELECTED_FILES", "CODE_SIGN_ENTITLEMENTS"]) {
    assert.equal(pbxproj.includes(setting), false, setting);
  }
  assert.deepEqual(files(path.join(root, "safari")).filter((file) => file.endsWith(".entitlements")), []);
  const handler = fs.readFileSync(path.join(xcodeRoot, "SAMS Portal Autofill Extension/SafariWebExtensionHandler.swift"), "utf8");
  assert.match(handler, /context\.cancelRequest\(withError: error\)/);
  assert.doesNotMatch(handler, /SFExtensionMessageKey|os_log|Logger|UserDefaults|Keychain|FileManager/);
});

test("native onboarding shows a visible error for each Safari failure and stays open when Settings cannot open", () => {
  const appRoot = path.join(xcodeRoot, "SAMS Portal Autofill");
  const viewController = fs.readFileSync(path.join(appRoot, "ViewController.swift"), "utf8");
  const mainHtml = fs.readFileSync(path.join(appRoot, "Resources/Base.lproj/Main.html"), "utf8");
  assert.match(mainHtml, /<p class="error" role="alert" hidden><\/p>/);
  assert.deepEqual([...viewController.matchAll(/showError\('([^']+)'\)/g)].map((match) => match[1]), ["state", "open-settings"]);
  assert.match(viewController, /guard error == nil else \{\s*self\?\.webView\.evaluateJavaScript\("showError\('open-settings'\)"\)\s*return\s*\}\s*NSApplication\.shared\.terminate/);

  const error = { hidden: true, textContent: "" };
  const context = vm.createContext({
    document: { querySelector: (selector) => (selector === ".error" ? error : { addEventListener() {} }) },
  });
  vm.runInContext(fs.readFileSync(path.join(appRoot, "Resources/Script.js"), "utf8"), context);
  context.showError("open-settings");
  assert.equal(error.hidden, false);
  assert.equal(error.textContent, "Could not open Safari Settings. Open Safari, choose Safari > Settings, then Extensions, and turn on SAMS Portal Autofill.");
  context.showError("state");
  assert.equal(error.textContent, "Could not check whether the SAMS Portal Autofill extension is on. Open Safari, choose Safari > Settings, then Extensions, to check it.");
});
