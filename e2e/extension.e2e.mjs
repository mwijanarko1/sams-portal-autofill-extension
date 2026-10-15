import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { constants } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, test } from "node:test";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(root, "e2e/fixtures");
const executablePath = process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium";
const crmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/e2e-synthetic/";
// No allowlist entry, portal mapping, or host permission names this origin.
const genericOrigin = "https://apply.example-university.test";
const genericFixtures = new Map([
  ["/apply/personal", "generic-university.html"],
  ["/apply/child", "generic-child.html"],
  ["/apply/sandboxed", "generic-child.html"],
  ["/apply/heading-frames", "generic-heading-frames.html"],
  ["/apply/heading-ref", "generic-heading-child.html"],
  ["/apply/heading-app", "generic-heading-child.html"],
]);
const evidenceDir = join(root, "tmp/general-portal-evidence");
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
    // Test-only: lets the browser CDP session trigger the toolbar action, which grants activeTab like a click.
    args: ["--disable-component-extensions-with-background-pages", "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    timeout: 15000,
  });
  context.setDefaultTimeout(5000);
  const fixtures = new Map([[crmUrl, "crm.html"], ...portalCases.map((portal) => [portal.url, portal.fixture])]);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const fixture = fixtures.get(request.url()) || (url.origin === genericOrigin && genericFixtures.get(url.pathname));
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
  assert.match(await popup.locator("#statusArea").innerText(), /Open the university application form first.*allow SAMS Portal Autofill to access this website/);
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

// Opens the real toolbar popup. The browser's action trigger grants activeTab exactly like a toolbar click,
// and Playwright cannot see this popup, so it is driven through its own CDP target session.
async function openToolbarPopup(page) {
  await page.bringToFront();
  const browser = await context.browser().newBrowserCDPSession();
  // Tab targets are hidden unless the filter asks for them.
  const targets = async () => (await browser.send("Target.getTargets", { filter: [{ type: "browser", exclude: true }, {}] })).targetInfos;
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const existing = new Set((await targets()).filter((target) => target.url === popupUrl).map((target) => target.targetId));
  const tab = (await targets()).find((target) => target.type === "tab" && target.url === page.url());
  assert.ok(tab, "The form must be a browser tab");
  await browser.send("Extensions.triggerAction", { id: extensionId, targetId: tab.targetId });
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    target = (await targets()).find((candidate) => candidate.url === popupUrl && !existing.has(candidate.targetId));
    if (!target) await sleep(100);
  }
  assert.ok(target, "The toolbar popup must open");
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: false });
  const pending = new Map();
  const errors = [];
  let nextId = 0;
  browser.on("Target.receivedMessageFromTarget", (event) => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    browser.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
  });
  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const value = await evaluate(expression);
      if (value) return value;
      await sleep(100);
    }
    throw new Error(`Toolbar popup timed out waiting for ${expression}`);
  };
  const status = () => evaluate(`[...document.querySelectorAll("#statusArea .status")].map((node) => ({ className: node.className, text: node.textContent }))`);
  return {
    errors,
    evaluate,
    waitFor,
    status,
    async autofill() {
      await waitFor(`!document.getElementById("btnAutofill").disabled`);
      await evaluate(`document.getElementById("btnAutofill").click()`);
      await waitFor(`document.querySelector("#statusArea .status:not(.info)")`);
      return status();
    },
    async screenshot(name) {
      await mkdir(evidenceDir, { recursive: true });
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(join(evidenceDir, name), Buffer.from(data, "base64"));
    },
    async close() {
      await browser.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
      await browser.detach().catch(() => {});
    },
  };
}

const frameByPath = (page, path) => page.frames().find((frame) => frame.url() === `${genericOrigin}${path}`);
const controlValues = (frame) => frame.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll("input, select, textarea")].map((control) => [control.id, control.value])
));

test("Unmapped university: real toolbar popup fills shared fields in the selected origin only", { timeout: 30000 }, async () => {
  await clear();
  const page = await openPage(`${genericOrigin}/apply/personal`);
  await page.waitForLoadState("load");
  const greenwichChild = page.frames().find((frame) => frame.url().startsWith("https://nelson.gre.ac.uk/"));
  await greenwichChild.locator("#fname").waitFor();
  const crm = await copyStudent();

  // Without the toolbar grant the extension cannot read this origin, and it says so instead of bypassing it.
  await activate(page);
  await popup.locator("#btnAutofill").click();
  await popup.locator("#statusArea .error").waitFor();
  assert.match(await popup.locator("#statusArea").innerText(), /allow SAMS Portal Autofill to access this website/);
  assert.deepEqual((await page.evaluate(() => activity)).changes, [], "No field may change without site access");

  const toolbar = await openToolbarPopup(page);
  try {
    const status = await toolbar.autofill();
    await toolbar.evaluate(`document.querySelectorAll("#statusArea details").forEach((node) => { node.open = true; })`);
    const lowerResults = await toolbar.evaluate(`(() => {
      const area = document.getElementById("statusArea");
      if (!area) return null;
      const manual = [...area.querySelectorAll("details")].find((node) =>
        /manual review/i.test(node.querySelector("summary")?.textContent || ""));
      if (manual) manual.open = true;
      const rows = [...area.querySelectorAll("li")];
      const target = rows[rows.length - 1];
      if (!target) return null;
      target.scrollIntoView({ block: "end" });
      const rect = target.getBoundingClientRect();
      const top = Math.round(rect.top);
      const bottom = Math.round(rect.bottom);
      const viewHeight = window.innerHeight;
      return {
        text: target.textContent.slice(0, 120),
        top,
        bottom,
        viewHeight,
        // Last result list row, not the whole details section. Rounded pixels absorb subpixel scroll ends.
        fullyInView: top >= 0 && bottom <= viewHeight && rect.height > 0,
        isManualReview: !!manual,
      };
    })()`);
    assert.ok(lowerResults, "Final Autofill result list row must exist");
    assert.ok(
      lowerResults.fullyInView,
      `Final Autofill result row must be fully visible after scroll: ${JSON.stringify(lowerResults)}`
    );
    assert.ok(lowerResults.isManualReview, "Manual review section must be present for scroll reachability");
    assert.match(lowerResults.text, /\S/);
    await toolbar.screenshot("popup-generic-frames.png");
    await toolbar.screenshot("popup-generic-frames-scrolled.png");
    // The sandboxed same-URL frame has an opaque origin, so the one-time grant does not reach it and
    // the popup names it as not filled. With persistent site access, the handler refuses it instead.
    assert.deepEqual(status[0], {
      className: "status warning",
      text: "10 fields filled in 2 of 3 page frames. Some frames were not filled: review the whole page before continuing.",
    });
    assert.match(await toolbar.evaluate(`document.querySelector("#statusArea details").textContent`),
      /^Frames not filled \(1\)Frame \d+: Could not access this page\. Allow SAMS Portal Autofill to access this website, reload the page, and try again\.$/);
    assert.deepEqual(await controlValues(page.mainFrame()), {
      login_email: "", login_password: "",
      title: "Ms", first_name: "Aisha", middle_names: "", surname: "Rahman",
      full_name: "", preferred_name: "", known_as: "", dob: "15/02/2000",
      dob_day: "", dob_month: "", dob_year: "",
      gender: "F", nationality: "Bangladeshi", passport: "", hidden_city: "", inert_email: "",
      email: "aisha.rahman@example.com", phone_cc: "", mobile: "07700900123", phone_ext: "",
      addr1: "", addr2: "", town: "Dhaka", postcode: "EXISTING", country: "",
      billing_postcode: "",
      ec_name: "", ec_email: "", ec_phone: "",
      ref_first: "", ref_email: "", agent_email: "",
      qual_institution: "", qual_country: "", qual2_institution: "",
      card_name: "", card_first: "", signature: "", declare_first: "",
    });
    assert.deepEqual(await controlValues(frameByPath(page, "/apply/child")), { child_first_name: "Aisha" });
    assert.deepEqual(await controlValues(frameByPath(page, "/apply/sandboxed")), { child_first_name: "" });
    const srcdoc = page.frames().find((frame) => frame.url() === "about:srcdoc");
    assert.deepEqual(await controlValues(srcdoc), { srcdoc_first: "" });
    assert.deepEqual((await greenwichChild.evaluate(() => activity)).changes, [], "A mapped portal embedded from another origin must not be filled");
    const first = await page.evaluate(() => activity);
    assert.deepEqual([first.clicks, first.submissions], [0, 0]);

    const repeat = await toolbar.autofill();
    assert.equal(repeat[0].text, "0 fields filled in 2 of 3 page frames. Some frames were not filled: review the whole page before continuing.");
    assert.deepEqual(await page.evaluate(() => activity), first, "Repeat Autofill must not change any field");
    assert.deepEqual(toolbar.errors, [], "The toolbar popup must not throw");
  } finally {
    await toolbar.close();
  }
  await clear();
  assert.deepEqual(unexpectedRequests, [], "No request may escape the synthetic fixtures");
  assert.deepEqual(popupErrors, []);
  await page.close();
  await crm.close();
});

test("Unmapped university: a single-frame page reports shared matching", { timeout: 20000 }, async () => {
  await clear();
  const page = await openPage(`${genericOrigin}/apply/child?single`);
  await page.locator("#child_first_name").waitFor();
  const crm = await copyStudent();
  const toolbar = await openToolbarPopup(page);
  try {
    const status = await toolbar.autofill();
    await toolbar.screenshot("popup-generic-success.png");
    assert.deepEqual(status, [{
      className: "status success",
      text: "1 fields filled using shared matching for this website. Draft only: review every field, complete the rest, and submit it yourself.",
    }]);
    assert.equal(await page.locator("#child_first_name").inputValue(), "Aisha");
    assert.deepEqual(toolbar.errors, []);
  } finally {
    await toolbar.close();
  }
  await clear();
  assert.deepEqual(unexpectedRequests, []);
  await page.close();
  await crm.close();
});

test("Unmapped university: outer Referee/Applicant headings gate neutral same-origin iframes", { timeout: 20000 }, async () => {
  await clear();
  const page = await openPage(`${genericOrigin}/apply/heading-frames`);
  await page.waitForLoadState("load");
  const refFrame = frameByPath(page, "/apply/heading-ref");
  const appFrame = frameByPath(page, "/apply/heading-app");
  assert.ok(refFrame && appFrame);
  await refFrame.locator("#child_first_name").waitFor();
  await appFrame.locator("#child_first_name").waitFor();
  const crm = await copyStudent();
  const toolbar = await openToolbarPopup(page);
  try {
    const status = await toolbar.autofill();
    assert.match(status[0].text, /1 fields filled/);
    assert.equal(await refFrame.locator("#child_first_name").inputValue(), "");
    assert.equal(await appFrame.locator("#child_first_name").inputValue(), "Aisha");
    assert.deepEqual(toolbar.errors, []);
  } finally {
    await toolbar.close();
  }
  await clear();
  assert.deepEqual(unexpectedRequests, []);
  await page.close();
  await crm.close();
});
