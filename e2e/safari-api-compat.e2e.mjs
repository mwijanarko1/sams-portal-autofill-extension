import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const portalOrigin = "https://apps.bangor.ac.uk";
const variants = ["onHistoryStateUpdated", "onCommitted", "onCompleted", "webNavigation"];

// The real browser supplies every API except the explicitly missing Safari capability.
// This verifies extension startup and popup messaging, not actual Safari acceptance.
for (const missing of variants) {
  test(`Background, cache and popup survive missing ${missing} without mutating the portal`, { timeout: 25000 }, async () => {
    await mkdir(join(root, "tmp"), { recursive: true });
    const run = await mkdtemp(join(root, "tmp/safari-api-compat-"));
    const extension = join(run, "extension");
    await mkdir(extension);
    for (const path of ["config", "src", "popup.html", "popup.js", "sams-logo.svg", "icon16.png", "icon48.png", "icon128.png"]) {
      await cp(join(root, path), join(extension, path), { recursive: true });
    }
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
    manifest.host_permissions = ["https://app.samscrm.co.uk/*", `${portalOrigin}/*`];
    manifest.background.service_worker = "src/compat-background.js";
    await writeFile(join(extension, "manifest.json"), JSON.stringify(manifest));
    await writeFile(join(extension, "config/build-mode.js"), 'globalThis.SAMS_BUILD_MODE = "prod";\n');
    const target = missing === "webNavigation" ? "chrome" : "chrome.webNavigation";
    await writeFile(join(extension, "src/compat-background.js"),
      `Object.defineProperty(${target}, ${JSON.stringify(missing)}, { value: undefined });\n` +
      'let startupError = null;\n' +
      'try { importScripts("background.js"); } catch (error) { startupError = error.message; }\n' +
      'chrome.runtime.onMessage.addListener((message, sender, reply) => {\n' +
      '  if (message.action === "compatStartupProbe") reply({ booted: startupError === null, error: startupError });\n' +
      '});\n');

    const context = await chromium.launchPersistentContext(join(run, "profile"), {
      executablePath: process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium",
      channel: "chromium", headless: false, ignoreDefaultArgs: ["--disable-extensions"],
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--host-resolver-rules=MAP * ~NOTFOUND", "--disable-background-networking"],
      timeout: 15000,
    });
    try {
      context.setDefaultTimeout(5000);
      const requests = [];
      await context.route(/^https?:\/\//, async (route) => {
        const request = route.request();
        if (request.url() === `${portalOrigin}/apply/personal/` && request.method() === "GET") {
          return route.fulfill({ contentType: "text/html", body: '<h1>Personal Details</h1><form method="post"><label>Given name<input id="id_forename" name="forename"></label><button type="submit">Save and continue</button></form>' });
        }
        requests.push({ url: request.url(), method: request.method() });
        return route.abort();
      });
      const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
      const extensionId = new URL(worker.url()).host;
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      const boot = await popup.evaluate(() => Promise.race([
        chrome.runtime.sendMessage({ action: "compatStartupProbe" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Background startup probe did not respond within 5 seconds")), 5000)),
      ]));
      assert.deepEqual(boot, { booted: true, error: null }, "The complete background script must finish loading");

      const profile = {
        studentId: "safari-compat-synthetic", studentName: "Synthetic Safari Student",
        sourceOrigin: "https://app.samscrm.co.uk", copiedAt: Date.now(),
        fields: { firstName: "Synthetic", lastName: "Safari" }, documents: [],
      };
      const cached = await popup.evaluate((profile) => chrome.runtime.sendMessage({ action: "cacheStudent", profile }), profile);
      assert.equal(cached.cache.studentId, "safari-compat-synthetic");
      const stored = await popup.evaluate(() => chrome.runtime.sendMessage({ action: "getStudentCache" }));
      assert.deepEqual(stored.cache.fields, { firstName: "Synthetic", lastName: "Safari" });
      const portal = await context.newPage();
      await portal.goto(`${portalOrigin}/apply/personal/`);
      await popup.reload();
      await popup.locator("#studentCard").waitFor({ state: "visible" });
      assert.equal(await popup.locator("#studentName").textContent(), "Synthetic Safari Student");
      assert.equal(await popup.locator("#btnAutofill").isEnabled(), true, "Popup stays functional with a cached student");
      const reread = await popup.evaluate(() => chrome.runtime.sendMessage({ action: "getStudentCache" }));
      assert.deepEqual(reread, stored, "Opening the popup preserves the cached student");
      assert.equal(await portal.locator("#id_forename").inputValue(), "", "Opening the popup must not mutate the form");
      assert.deepEqual(requests, [], "Opening the popup must not save or contact external sites");
      const cleared = await popup.evaluate(() => chrome.runtime.sendMessage({ action: "clearStudentCache" }));
      assert.deepEqual(cleared, { cleared: true });
      const empty = await popup.evaluate(() => chrome.runtime.sendMessage({ action: "getStudentCache" }));
      assert.deepEqual(empty, { cache: null }, "Clear remains functional without optional browser APIs");
      await popup.reload();
      await popup.locator("#studentCard").waitFor({ state: "hidden" });
      assert.equal(await popup.locator("#btnAutofill").isDisabled(), true);
      await writeFile(join(run, "result.json"), JSON.stringify({ missing, boot, cachePreserved: true, cleared, requests }, null, 2));
    } finally {
      await context.close();
    }
  });
}
