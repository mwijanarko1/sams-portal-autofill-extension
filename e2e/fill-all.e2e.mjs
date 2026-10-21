import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://apps.bangor.ac.uk";
const crmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/e2e-synthetic/";
const evidence = join(root, "tmp/fill-all-evidence");
let context, popup, extensionId, portalPage;
let mode = "normal";
const saves = [];
const escaped = [];
let releaseSave = null;
let startedRunId = null;
const terminalRuns = [];

function form(path) {
  const personal = path === "/apply/personal/";
  const fields = personal
    ? '<label>Given name<input id="id_forename" name="forename" required></label><label>Family name<input id="id_surname" name="surname" required></label>'
    : '<label>Postal town / city<input id="id_city" name="city" value="Existing city" required></label><label>Postcode<input id="id_postcode" name="postcode" required></label>';
  const invalid = mode === "invalid" ? '<label>Manual answer<input name="manual_answer" required></label>' : "";
  const busy = mode === "waiting" ? ' aria-busy="true"' : "";
  const base = mode === "foreignBase" ? '<base href="https://external.example.test/">' : "";
  return `<!doctype html>${base}<title>Application ${personal ? "Personal Details" : "Contact Details"}</title>
    <h1>${personal ? "Personal Details" : "Contact Details"}</h1>
    <form method="post" action="${path}"${busy}>${fields}${invalid}<button type="submit">Save and continue</button></form>
    <form hidden id="unrelated_dates"><select id="id_dob_day"><option value="">Day</option><option value="15">15</option></select><select id="id_dob_month"><option value="">Month</option><option value="2">February</option></select><select id="id_dob_year"><option value="">Year</option><option value="2000">2000</option></select></form>`;
}

const summary = '<!doctype html><h1>Declaration and submission</h1><form method="post" action="/apply/submit/"><label><input type="checkbox" name="agree">I agree</label><button type="submit">Submit application</button></form>';

before(async () => {
  await mkdir(evidence, { recursive: true });
  const run = await mkdtemp(join(root, "tmp/fill-all-e2e-"));
  const extensionPath = join(run, "extension");
  await mkdir(extensionPath);
  for (const path of ["config", "src", "popup.html", "popup.js", "sams-logo.svg", "icon16.png", "icon48.png", "icon128.png"]) {
    await cp(join(root, path), join(extensionPath, path), { recursive: true });
  }
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  manifest.host_permissions = ["https://app.samscrm.co.uk/*", `${origin}/*`];
  await writeFile(join(extensionPath, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(extensionPath, "config/build-mode.js"), 'globalThis.SAMS_BUILD_MODE = "prod";\n');
  context = await chromium.launchPersistentContext(join(run, "profile"), {
    executablePath: process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium",
    channel: "chromium", headless: false, ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, "--host-resolver-rules=MAP * ~NOTFOUND", "--disable-background-networking"],
    timeout: 15000,
  });
  context.setDefaultTimeout(5000);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.href === crmUrl) return route.fulfill({ contentType: "text/html", body: await readFile(join(root, "e2e/fixtures/crm.html"), "utf8") });
    if (url.origin === origin && ["/apply/personal/", "/apply/contacts/"].includes(url.pathname)) {
      if (request.method() === "POST") {
        saves.push({ path: url.pathname, fields: Object.fromEntries(new URLSearchParams(request.postData() || "")) });
        if (mode === "holdSave") {
          await new Promise((resolve) => { releaseSave = resolve; });
          return route.abort().catch(() => {});
        }
        const next = mode === "loop" ? url.pathname : url.pathname === "/apply/personal/" ? "/apply/contacts/" : "/apply/summary/";
        // Serve a new document for the real POST. A mocked HTTP redirect can bypass routing.
        // The fixture's response updates its URL without touching the live portal network.
        const body = next === "/apply/summary/" ? summary : form(next);
        return route.fulfill({ contentType: "text/html", body: `${body}<script>history.replaceState(null, "", ${JSON.stringify(next)})</script>` });
      }
      return route.fulfill({ contentType: "text/html", body: form(url.pathname) });
    }
    if (url.origin === origin && url.pathname === "/apply/summary/") {
      return route.fulfill({ contentType: "text/html", body: summary });
    }
    if (url.origin === "https://unknown.example.test") return route.fulfill({ contentType: "text/html", body: form("/apply/personal/") });
    escaped.push({ method: request.method(), url: request.url() });
    return route.abort();
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  extensionId = new URL(worker.url()).host;
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
}, { timeout: 30000 });

after(async () => { if (context) await context.close(); });

async function setup(scenario = "normal", url = `${origin}/apply/personal/`) {
  mode = scenario;
  saves.length = 0;
  escaped.length = 0;
  if (popup.isClosed()) {
    popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  }
  for (const page of context.pages()) if (page !== popup) await page.close();
  await popup.reload();
  await popup.evaluate(() => chrome.runtime.sendMessage({ action: "clearStudentCache" }));
  const crm = await context.newPage();
  await crm.goto(crmUrl);
  await crm.bringToFront();
  await popup.locator("#btnCopy").click();
  await popup.locator("#statusArea .success").waitFor();
  const portal = await context.newPage();
  portalPage = portal;
  await portal.goto(url);
  await portal.bringToFront();
  // Opening the popup on the selected portal resolves its tab before the one-click start.
  await popup.reload();
  return portal;
}

async function start() {
  const previous = await popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getFillAllStatus" })).run?.id);
  startedRunId = null;
  await popup.locator("#btnFillAll").click();
  // Unsupported sites do not create a run. A supported start must not observe the previous run.
  if (new URL(portalPage.url()).origin !== origin) return;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const run = await popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getFillAllStatus" })).run);
    if (run && run.id !== previous) { startedRunId = run.id; return; }
    await pause(50);
  }
  throw new Error(`Start did not create a new run: ${await popup.locator("#fillAllStatus").innerText()}`);
}

async function stopped() {
  const deadline = Date.now() + 15000;
  let run;
  while (Date.now() < deadline) {
    run = await popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getFillAllStatus" })).run);
    if (run?.id === startedRunId && ["stopped", "completed", "failed"].includes(run.status)) {
      terminalRuns.push(run);
      await writeFile(join(evidence, "terminal-runs.json"), JSON.stringify(terminalRuns, null, 2));
      return run;
    }
    await pause(100);
  }
  throw new Error(`Run did not stop: ${JSON.stringify({ run, unexpectedRequests: escaped })}`);
}

test("Fill-all enables after Copy; draft saves persist both screens even after popup closes; final submission stays untouched", { timeout: 30000 }, async () => {
  await popup.locator("#studentCard").waitFor({ state: "hidden" });
  assert.equal(await popup.locator("#btnFillAll").isDisabled(), true, "Fill all requires a copied student");
  const portal = await setup();
  await popup.locator("#btnFillAll:enabled").waitFor();
  assert.equal(await popup.locator("#btnFillAll").isEnabled(), true, "Copy enables Fill all without another confirmation");
  await popup.setViewportSize({ width: 390, height: 780 });
  await popup.screenshot({ path: join(evidence, "popup-ready.png"), fullPage: true });
  await start();
  await popup.close();
  await portal.waitForURL(`${origin}/apply/summary/`, { timeout: 15000 });
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const run = await stopped();
  assert.ok(["stopped", "completed"].includes(run.status));
  assert.equal(saves.length, 2);
  assert.equal(saves[0].fields.forename, "Aisha");
  assert.equal(saves[0].fields.surname, "Rahman");
  assert.equal(saves[1].fields.city, "Existing city", "Existing values must not be overwritten");
  assert.equal(saves[1].fields.postcode, "1205");
  assert.equal(await portal.locator("input[name=agree]").isChecked(), false);
  assert.deepEqual(escaped, [], "No final submission or external request");
  await popup.locator("#fillAllStatus .success, #fillAllStatus .warning").waitFor();
  await popup.setViewportSize({ width: 390, height: 780 });
  await popup.screenshot({ path: join(evidence, "popup-stopped.png"), fullPage: true });
  await portal.screenshot({ path: join(evidence, "declaration-untouched.png") });
});

test("Missing required manual information stops before the first save", { timeout: 25000 }, async () => {
  const portal = await setup("invalid");
  await start();
  const run = await stopped();
  assert.equal(run.status, "stopped");
  assert.equal(await portal.locator("#id_forename").inputValue(), "Aisha");
  assert.deepEqual(await portal.locator("#unrelated_dates select").evaluateAll((controls) => controls.map((control) => control.value)), ["", "", ""], "Native split-date filling must stay inside the draft-save form");
  assert.deepEqual(saves, []);
  assert.deepEqual(escaped, []);
  await popup.locator("#fillAllStatus .warning").waitFor();
  await popup.screenshot({ path: join(evidence, "popup-validation.png"), fullPage: true });
});

test("A same-page save response is not retried in a save loop", { timeout: 25000 }, async () => {
  await setup("loop");
  await start();
  await stopped();
  assert.equal(saves.length, 1);
  assert.deepEqual(escaped, []);
});

test("An unmapped portal without site access is refused without navigation or saving", { timeout: 20000 }, async () => {
  const portal = await setup("normal", "https://unknown.example.test/apply/personal/");
  await start();
  await popup.waitForFunction(() => /not supported|not mapped|unsupported|mapped portal|site access|access this website|permission/i.test(document.querySelector("#fillAllStatus").innerText));
  assert.equal(await portal.locator("#id_forename").inputValue(), "");
  assert.deepEqual(saves, []);
  assert.deepEqual(escaped, []);
});

test("Stop during page readiness prevents any fill or save", { timeout: 20000 }, async () => {
  const portal = await setup("waiting");
  await start();
  await popup.locator("#btnStopFillAll").waitFor();
  assert.equal(await popup.locator("#btnFillAll").isDisabled(), true, "An active run disables starting another run");
  await popup.screenshot({ path: join(evidence, "popup-running.png"), fullPage: true });
  await popup.locator("#btnStopFillAll").click();
  const run = await stopped();
  assert.equal(run.status, "stopped");
  assert.equal(await portal.locator("#id_forename").inputValue(), "");
  assert.deepEqual(saves, []);
});

test("Clear during readiness invalidates the run and prevents saves", { timeout: 20000 }, async () => {
  const portal = await setup("waiting");
  await start();
  await popup.locator("#btnStopFillAll").waitFor();
  await popup.locator("#btnClear").click();
  const run = await stopped();
  assert.equal(run.status, "stopped");
  assert.equal(await portal.locator("#id_forename").inputValue(), "");
  assert.deepEqual(saves, []);
});

test("Worker rejects a start without explicit draft-save consent", { timeout: 20000 }, async () => {
  const portal = await setup();
  const response = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.runtime.sendMessage({ action: "startFillAll", tabId: tab.id, consent: false });
  });
  assert.match(response.error, /allow|consent/i);
  assert.equal(await portal.locator("#id_forename").inputValue(), "");
  assert.deepEqual(saves, []);
});

test("Manual navigation during a pending save must not fill a different application screen", { timeout: 25000 }, async () => {
  const portal = await setup("holdSave");
  const post = portal.waitForRequest((request) => request.method() === "POST");
  await start();
  await post;
  try {
    await portal.goto(`${origin}/apply/contacts/`);
    const run = await stopped();
    assert.equal(run.status, "stopped");
    assert.equal(await portal.locator("#id_postcode").inputValue(), "", "A manually opened screen is not a confirmed save transition");
    assert.equal(saves.length, 1, "No second save after staff navigation");
  } finally {
    releaseSave?.();
    releaseSave = null;
  }
});

test("A foreign base URL cannot turn a permitted relative form action into an external POST", { timeout: 20000 }, async () => {
  await setup("foreignBase");
  await start();
  const run = await stopped();
  assert.equal(run.status, "stopped");
  assert.deepEqual(saves, []);
  assert.deepEqual(escaped, [], "Reject the browser's effective cross-origin form action before clicking");
});
