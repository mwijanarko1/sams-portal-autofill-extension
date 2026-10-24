import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "dev";
const targetName = process.argv[3] || "chrome";
if (!["dev", "prod"].includes(mode)) throw new Error("Build mode must be dev or prod.");

// Each target owns only these paths, so building one browser never deletes the other's output.
const targets = {
  chrome: {
    out: "dist/chrome",
    owned: ["dist/chrome", "dist/sams-portal-autofill-dev.zip", "dist/sams-portal-autofill-prod.zip"],
    zip: `dist/sams-portal-autofill-${mode}.zip`,
  },
  safari: {
    out: "dist/safari-webextension",
    owned: ["dist/safari-webextension"],
  },
};
const target = targets[targetName];
if (!target) throw new Error(`Build target must be one of: ${Object.keys(targets).join(", ")}.`);

const require = createRequire(import.meta.url);
const allowlist = require(join(root, "config/allowlist.js"));
const productionOrigins = [
  ...allowlist.crmOrigins,
  ...allowlist.camporaOrigins,
  ...allowlist.portalOrigins,
];
if (mode === "prod" && (!allowlist.camporaOrigins.length || allowlist.portalOrigins.length < 3)) {
  throw new Error("Production allowlist is incomplete. Add the confirmed Campora and three portal origins in config/allowlist.js.");
}

const origins = mode === "dev"
  ? productionOrigins.concat(allowlist.devCrmOrigins, allowlist.devPortalOrigins)
  : productionOrigins;
const out = join(root, target.out);
for (const path of target.owned) rmSync(join(root, path), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const path of [
  "config", "src", "popup.html", "popup.js", "sams-logo.svg",
  "icon16.png", "icon48.png", "icon128.png",
]) cpSync(join(root, path), join(out, path), { recursive: true });

writeFileSync(join(out, "config/build-mode.js"), `globalThis.SAMS_BUILD_MODE = "${mode}";\n`);
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
manifest.host_permissions = [...new Set(origins)].map((origin) => `${origin}/*`);
writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
validateResources(out, manifest);

if (target.zip) {
  const zipPath = join(root, target.zip);
  const zipped = spawnSync("zip", ["-qr", zipPath, "."], { cwd: out, stdio: "inherit" });
  if (zipped.status !== 0) throw new Error("Could not create the Chrome Web Store zip.");
  console.log(`Built ${out}`);
  console.log(`Created ${zipPath}`);
} else {
  console.log(`Built ${out}`);
}

function validateResources(dir, manifest) {
  const popupHtml = readFileSync(join(dir, manifest.action.default_popup), "utf8");
  const worker = readFileSync(join(dir, manifest.background.service_worker), "utf8");
  const workerDir = dirname(manifest.background.service_worker);
  const referenced = [
    manifest.action.default_popup,
    manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...[...popupHtml.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]),
    ...[...worker.matchAll(/importScripts\(([^)]*)\)/g)]
      .flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)])
      .map((match) => join(workerDir, match[1])),
    // Files the popup injects into CRM and portal documents.
    ...[...readFileSync(join(dir, "popup.js"), "utf8").matchAll(/"((?:config|src)\/[^"]+\.js)"/g)].map((match) => match[1]),
  ];
  const missing = [...new Set(referenced)].filter((path) => !existsSync(join(dir, path)));
  if (missing.length) throw new Error(`Build output is missing referenced resources: ${missing.join(", ")}`);
}
