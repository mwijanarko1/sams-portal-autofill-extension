import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Builds the unsigned local macOS app and proves its extension embeds exactly the generated
// Safari resources. This is a packaging check, not Safari runtime or signing evidence.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "dev";
const project = join(root, "safari/SAMS Portal Autofill/SAMS Portal Autofill.xcodeproj");
const resources = join(root, "dist/safari-webextension");
const out = join(root, "dist/safari-app");
const derivedData = join(out, "DerivedData");
const log = join(out, "xcodebuild.log");
const XCODEBUILD_TIMEOUT_MS = 10 * 60 * 1000;

run(process.execPath, [join(root, "scripts/build.mjs"), mode, "safari"], { stdio: "inherit" });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const xcode = spawnSync("xcodebuild", [
  "-project", project,
  "-scheme", "SAMS Portal Autofill",
  "-configuration", "Debug",
  "-destination", "generic/platform=macOS",
  "-derivedDataPath", derivedData,
  "CODE_SIGNING_ALLOWED=NO",
  "build",
], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: XCODEBUILD_TIMEOUT_MS, killSignal: "SIGTERM" });
const output = `${xcode.stdout || ""}${xcode.stderr || ""}`;
writeFileSync(log, output);
if (xcode.error || xcode.status !== 0) {
  console.error(output.split("\n").slice(-40).join("\n"));
  if (xcode.error?.code === "ETIMEDOUT") {
    throw new Error(`xcodebuild timed out after ${XCODEBUILD_TIMEOUT_MS / 1000} seconds and was stopped. Partial log: ${log}`);
  }
  if (xcode.error) throw new Error(`Could not run xcodebuild: ${xcode.error.message}. Log: ${log}`);
  throw new Error(`xcodebuild failed with ${xcode.signal ? `signal ${xcode.signal}` : `exit code ${xcode.status}`}. Full log: ${log}`);
}

const app = join(derivedData, "Build/Products/Debug/SAMS Portal Autofill.app");
const appex = join(app, "Contents/PlugIns/SAMS Portal Autofill Extension.appex");
const embedded = join(appex, "Contents/Resources");
if (!existsSync(embedded)) throw new Error(`Built app has no embedded Safari extension resources at ${embedded}`);

const expected = hashTree(resources);
const actual = hashTree(embedded);
const missing = [...expected.keys()].filter((path) => !actual.has(path));
const extra = [...actual.keys()].filter((path) => !expected.has(path));
const changed = [...expected.keys()].filter((path) => actual.has(path) && actual.get(path) !== expected.get(path));
if (missing.length || extra.length || changed.length) {
  throw new Error(`Embedded extension resources differ from ${relative(root, resources)}: ${JSON.stringify({ missing, extra, changed })}`);
}

const appPlist = join(app, "Contents/Info.plist");
const appexPlist = join(appex, "Contents/Info.plist");
const appId = plistValue(appPlist, "CFBundleIdentifier");
const appexId = plistValue(appexPlist, "CFBundleIdentifier");
const appVersion = plistValue(appPlist, "CFBundleShortVersionString");
const appexVersion = plistValue(appexPlist, "CFBundleShortVersionString");
const appBuild = plistValue(appPlist, "CFBundleVersion");
const appexBuild = plistValue(appexPlist, "CFBundleVersion");
const extensionPoint = plistValue(appexPlist, "NSExtension.NSExtensionPointIdentifier");
const manifestVersion = JSON.parse(readFileSync(join(resources, "manifest.json"), "utf8")).version;
if (!appexId.startsWith(`${appId}.`)) throw new Error(`Extension identifier ${appexId} is not nested under ${appId}.`);
if (appVersion !== manifestVersion || appexVersion !== manifestVersion) {
  throw new Error(`App version ${appVersion} and extension version ${appexVersion} must both match manifest version ${manifestVersion}.`);
}
// Apple build numbers must increase between uploads and match between app and extension.
if (!/^[1-9]\d*$/.test(appBuild) || appexBuild !== appBuild) {
  throw new Error(`App build ${appBuild} and extension build ${appexBuild} must be the same positive integer.`);
}
if (extensionPoint !== "com.apple.Safari.web-extension") throw new Error(`Unexpected extension point ${extensionPoint}.`);

console.log(`Built unsigned ${relative(root, app)}`);
console.log(`Embedded ${expected.size} Safari extension resources identical to ${relative(root, resources)}`);
console.log(`App ${appId} ${appVersion} (${appBuild}); extension ${appexId} ${appexVersion} (${appexBuild})`);

function run(command, args, options) {
  const result = spawnSync(command, args, { cwd: root, timeout: 60 * 1000, ...options });
  if (result.error) throw new Error(`Could not run ${args[0]}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status || 1);
}

function hashTree(dir) {
  const files = new Map();
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(dir, path), createHash("sha256").update(readFileSync(path)).digest("hex"));
    }
  };
  walk(dir);
  return files;
}

function plistValue(path, key) {
  const result = spawnSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key.replaceAll(".", ":")}`, path], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not read ${key} from ${path}`);
  return result.stdout.trim();
}
