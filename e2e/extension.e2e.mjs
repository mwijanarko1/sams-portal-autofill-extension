import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, test } from "node:test";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(root, "e2e/fixtures");
const executablePath = process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium";
const crmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/e2e-synthetic/";
const portalCases = [
  {
    name: "Bangor",
    url: "https://apps.bangor.ac.uk/apply/personal/",
    fixture: "bangor.html",
    values: {
      "#id_title": "MS", "#id_forename": "Aisha", "#id_surname": "Rahman", "#id_sex": "F",
      "#id_nationality": "BD", "#id_city": "Existing city", "#id_postcode": "1205",
      "#id_phone_number": "07700900123", "#id_dob_day": "15", "#id_dob_month": "2", "#id_dob_year": "2000",
    },
    blocked: ["#login_email", "#login_password",
      "#id_prefname", "#id_prompt_text", "#id_name", "#id_country", "#id_transcript_file"],
  },
  {
    name: "Greenwich",
    url: "https://nelson.gre.ac.uk/pls/prod/bwskaudf.P_DispAppUserDef?appno=1&wsct=ADDITIONAL",
    fixture: "greenwich.html",
    values: {
      "#pfx": "Ms", "#fname": "Aisha", "#lname": "Rahman", "#email": "aisha.rahman@example.com",
      "#mobiletelno": "07700900123", "#ud91qualtype": "B", "#ud91subject": "Computer Science",
      "#ud91grade": "Existing grade", "#ud91year": "2024",
    },
    blocked: ["#ud92qualtype", "#ud92subject", "#ud92grade", "#ud92year", "#ud17", "#ud18",
      "#bday_dd", "#bday_mm", "#bday_yyyy", "#ud130", "#transcript"],
  },
];

let context;
let popup;
let worker;
let extensionId;
const unexpectedRequests = [];
const popupErrors = [];

before(async () => {
  await access(executablePath, constants.X_OK);
  await mkdir(join(root, "tmp"), { recursive: true });
  const run = await mkdtemp(join(root, "tmp/e2e-"));
  const extensionPath = join(run, "extension");
  await mkdir(extensionPath);
  for (const path of ["config", "src", "popup.html", "popup.js", "sams-logo.svg", "icon16.png", "icon48.png", "icon128.png"]) {
    await cp(join(root, path), join(extensionPath, path), { recursive: true });
  }
  // Test staging is not a production package and never replaces dist or a login profile.
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  manifest.host_permissions = ["https://app.samscrm.co.uk/*", "https://apps.bangor.ac.uk/*", "https://nelson.gre.ac.uk/*"];
  await writeFile(join(extensionPath, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(extensionPath, "config/build-mode.js"), 'globalThis.SAMS_BUILD_MODE = "prod";\n');
  context = await chromium.launchPersistentContext(join(run, "profile"), {
    executablePath,
    channel: "chromium",
    headless: process.env.SAMS_E2E_HEADLESS === "1",
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--disable-component-extensions-with-background-pages",
      `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    timeout: 15000,
  });
  context.setDefaultTimeout(5000);
  const fixtures = new Map([[crmUrl, "crm.html"], ...portalCases.map((portal) => [portal.url, portal.fixture])]);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const fixture = fixtures.get(request.url());
    if (fixture && request.method() === "GET") {
      await route.fulfill({ contentType: "text/html", body: await readFile(join(fixtureRoot, fixture), "utf8") });
    } else if (request.url() === "https://example.com/e2e-not-approved" && request.method() === "GET") {
      await route.fulfill({ contentType: "text/html", body: "<main>Unapproved test origin</main>" });
    } else {
      unexpectedRequests.push({ url: request.url(), method: request.method() });
      await route.abort();
    }
  });
  worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 10000 });
  assert.ok(worker.url().endsWith("/src/background.js"), "The real SAMS MV3 service worker must load");
  extensionId = new URL(worker.url()).host;
  popup = await context.newPage();
  popup.on("pageerror", (error) => popupErrors.push(error.message));
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
}, { timeout: 30000 });

after(async () => {
  if (context) await context.close();
});

afterEach(async () => {
  if (!context || !popup) return;
  for (const page of context.pages()) {
    if (page !== popup) await page.close();
  }
  await popup.reload();
  await popup.locator("#btnCopy:enabled").waitFor();
  await clear();
});

async function activate(page) {
  await page.bringToFront();
  const active = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { id: tab?.id, url: tab?.url };
  });
  assert.ok(Number.isInteger(active.id), "A real browser tab must be active");
  // Chrome intentionally hides unapproved tab URLs without the tabs permission.
  if (active.url) assert.equal(active.url, page.url());
}

async function cache() {
  return popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getStudentCache" })).cache);
}

async function openPage(url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return page;
}

async function clear() {
  if (await popup.locator("#studentCard").isVisible()) await popup.locator("#btnClear").click();
  await popup.locator("#studentCard").waitFor({ state: "hidden" });
  assert.equal(await cache(), null);
  assert.equal(await popup.locator("#btnAutofill").isDisabled(), true);
}

async function copyStudent() {
  const crm = await openPage(crmUrl);
  await activate(crm);
  await popup.locator("#btnCopy").click();
  await popup.locator("#statusArea .success").waitFor();
  assert.equal(await popup.locator("#studentName").textContent(), "Aisha Rahman");
  const student = await cache();
  assert.equal(student.sourceOrigin, "https://app.samscrm.co.uk");
  assert.equal(student.fields.email, "aisha.rahman@example.com");
  assert.ok(student.expiresAt > Date.now());
  return crm;
}

for (const portal of portalCases) {
  test(`${portal.name}: real Copy, Autofill, repeat, safety, and Clear`, { timeout: 20000 }, async () => {
    await clear();
    const page = await openPage(portal.url);
    await page.locator(Object.keys(portal.values)[0]).waitFor();
    const crm = await copyStudent();
    await activate(page);
    await popup.locator("#btnAutofill").click();
    await popup.locator("#statusArea .success").waitFor();
    for (const [selector, expected] of Object.entries(portal.values)) {
      assert.equal(await page.locator(selector).inputValue(), expected, `${portal.name} ${selector}`);
    }
    for (const selector of portal.blocked) {
      assert.equal(await page.locator(selector).inputValue(), "", `Blocked field ${selector} must remain empty`);
    }
    const firstActivity = await page.evaluate(() => activity);
    assert.equal(firstActivity.clicks, 0);
    assert.equal(firstActivity.submissions, 0);
    assert.ok(firstActivity.changes.length > 0, "Actual change events must be emitted");
    await popup.locator("#btnAutofill").click();
    await popup.locator("#statusArea .success").waitFor();
    assert.deepEqual(await page.evaluate(() => activity), firstActivity, "Repeat Autofill must not change any filled or blocked fields");
    await clear();
    assert.equal(await popup.locator("#studentCard").isVisible(), false);
    const storage = await worker.evaluate(async () => ({
      local: await chrome.storage.local.get(null),
      sync: await chrome.storage.sync.get(null),
      session: await chrome.storage.session.get(null),
    }));
    assert.deepEqual(storage, { local: {}, sync: {}, session: {} });
    assert.deepEqual(unexpectedRequests, [], "No request may escape the synthetic fixtures");
    assert.deepEqual(popupErrors, [], "The real popup must not throw");
    await page.close();
    await crm.close();
  });
}

test("Copied details list every CRM field and copy one value", { timeout: 15000 }, async () => {
  await clear();
  assert.equal(await popup.locator("#copiedDetails").isVisible(), false);
  const crm = await copyStudent();
  const student = await cache();
  await popup.bringToFront();
  await popup.locator("#copiedDetailsSummary").click();
  assert.equal(await popup.locator("#copiedDetailsSummary").textContent(), `Copied details (${Object.keys(student.fields).length})`);
  assert.equal(await popup.locator("#copiedFields .field-row").count(), Object.keys(student.fields).length);
  const emailRow = popup.locator("#copiedFields .field-row", { hasText: "aisha.rahman@example.com" });
  assert.equal(await emailRow.locator(".field-label").textContent(), "Email");
  await emailRow.getByRole("button", { name: "Copy Email" }).click();
  await emailRow.getByRole("button", { name: "Copy Email" }).filter({ hasText: "Copied" }).waitFor();
  // Chrome refuses clipboard grants for extension origins, so an approved page reads the shared clipboard back.
  await context.grantPermissions(["clipboard-read"], { origin: new URL(crmUrl).origin });
  await crm.bringToFront();
  assert.equal(await crm.evaluate(() => navigator.clipboard.readText()), "aisha.rahman@example.com");
  await popup.bringToFront();
  await popup.locator("#copiedSearch").fill("RAHMAN@EXAMPLE");
  assert.deepEqual(await popup.locator("#copiedFields .field-row:visible .field-label").allTextContents(), ["Email", "Emergency email"]);
  assert.equal(await popup.locator("#copiedEmpty").isVisible(), false);
  await popup.locator("#copiedSearch").fill("no such field");
  assert.equal(await popup.locator("#copiedFields .field-row:visible").count(), 0);
  assert.equal(await popup.locator("#copiedEmpty").isVisible(), true);
  await clear();
  assert.equal(await popup.locator("#copiedDetails").isVisible(), false);
  assert.equal(await popup.locator("#copiedSearch").inputValue(), "");
  assert.deepEqual(popupErrors, []);
  await crm.close();
});

test("Origin guards reject Copy and Autofill outside the allowlist", { timeout: 15000 }, async () => {
  await clear();
  const page = await openPage("https://example.com/e2e-not-approved");
  const crm = await copyStudent();
  await activate(page);
  await popup.locator("#btnCopy").click();
  await popup.locator("#statusArea .error").waitFor();
  assert.match(await popup.locator("#statusArea").innerText(), /approved SAMS CRM/);
  assert.equal((await cache()).studentName, "Aisha Rahman");
  await popup.locator("#btnAutofill").click();
  await popup.locator("#statusArea .error").waitFor();
  assert.match(await popup.locator("#statusArea").innerText(), /approved university portal/);
  await clear();
  assert.deepEqual(unexpectedRequests, []);
  await page.close();
  await crm.close();
});

test("Clear in another popup stops a stale popup from filling", { timeout: 15000 }, async () => {
  await clear();
  const portal = portalCases[0];
  const page = await openPage(portal.url);
  await page.locator(Object.keys(portal.values)[0]).waitFor();
  const crm = await copyStudent();
  const other = await context.newPage();
  await other.goto(`chrome-extension://${extensionId}/popup.html`);
  await other.locator("#studentCard").waitFor();
  await other.locator("#btnClear").click();
  await other.locator("#studentCard").waitFor({ state: "hidden" });
  await other.close();
  await activate(page);
  assert.equal(await popup.locator("#studentCard").isVisible(), true, "The first popup still shows its earlier copy");
  await popup.locator("#btnAutofill").click();
  await popup.locator("#statusArea .error").waitFor();
  assert.match(await popup.locator("#statusArea").innerText(), /No copied student is available/);
  assert.equal(await popup.locator("#studentCard").isVisible(), false);
  assert.deepEqual((await page.evaluate(() => activity)).changes, [], "No field may change after Clear");
  assert.deepEqual(popupErrors, []);
  await page.close();
  await crm.close();
});

test("Session expiry disables Autofill and removes the student cache", { timeout: 10000 }, async () => {
  const crm = await copyStudent();
  await worker.evaluate(async () => {
    const { studentCache } = await chrome.storage.session.get("studentCache");
    await chrome.storage.session.set({ studentCache: { ...studentCache, expiresAt: Date.now() - 1 } });
  });
  await popup.reload();
  await popup.locator("#btnAutofill:disabled").waitFor();
  await popup.locator("#studentCard").waitFor({ state: "hidden" });
  assert.equal(await cache(), null);
  assert.equal(await popup.locator("#studentCard").isVisible(), false);
  assert.deepEqual(popupErrors, []);
  await crm.close();
});
