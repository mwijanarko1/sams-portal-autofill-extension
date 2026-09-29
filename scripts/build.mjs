import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "dev";
if (!["dev", "prod"].includes(mode)) throw new Error("Build mode must be dev or prod.");

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
const out = join(root, "dist/chrome");
rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const path of [
  "config", "src", "popup.html", "popup.js", "sams-logo.svg",
  "icon16.png", "icon48.png", "icon128.png",
]) cpSync(join(root, path), join(out, path), { recursive: true });

writeFileSync(join(out, "config/build-mode.js"), `globalThis.SAMS_BUILD_MODE = "${mode}";\n`);
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
manifest.host_permissions = [...new Set(origins)].map((origin) => `${origin}/*`);
writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const zipPath = join(root, `dist/sams-portal-autofill-${mode}.zip`);
const zipped = spawnSync("zip", ["-qr", zipPath, "."], { cwd: out, stdio: "inherit" });
if (zipped.status !== 0) throw new Error("Could not create the Chrome Web Store zip.");
console.log(`Built ${out}`);
console.log(`Created ${zipPath}`);
