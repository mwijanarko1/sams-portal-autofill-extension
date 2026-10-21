import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const crmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/e2e-synthetic/";
const genericOrigin = "https://admissions.new-university.test";
const greenwichOrigin = "https://nelson.gre.ac.uk";
const manchesterOrigin = "https://evision.bolton.ac.uk";
const evidence = join(root, "tmp/fill-all-expansion-evidence");
let context, popup, extensionId, worker, portal;
let scenario = "normal";
const posts = [];
const unexpected = [];
const terminalRuns = [];
let releaseGmSave = null;
const declaration = '<!doctype html><h1>Declaration and submission</h1><form method="post" action="/applications/fixture-1/submit"><label><input type="checkbox" name="declare">I declare</label><button type="submit">Submit application</button></form>';
const gwIndex = "/pls/prod/bwskalog.P_DispIndex";
const gwName = "/pls/prod/bwskanam.P_DispAppName";
const gwAddress = "/pls/prod/bwskaadr.P_DispAppAddr1";
const gmPath = "/urd/sits.urd/run/SIW_IPP_USR.start_url";

function greenwichChecklist() {
  const nameApp = scenario === "wrongApplication" ? "7002" : "7001";
  return `<!doctype html><h1>Application Checklist</h1><form method="post" action="/pls/prod/bwskalog.P_ProcIndex"><input type="hidden" name="appno" value="7001">
    <a class="submenulinktext2" href="${gwName}?appno=${nameApp}&wsct=S1">Name</a>
    <a class="submenulinktext2" href="${gwAddress}?appno=7001&wsct=S2">Permanent Address</a>
    <a class="submenulinktext2" href="/pls/prod/bwskanam.P_Signature?appno=7001&wsct=S9">Signature</a>
    <input type="submit" name="submit_btn" value="Application is Complete"><input type="submit" name="submit_btn" value="Finish Later"></form>`;
}

function greenwichSection(path) {
  const name = path === gwName;
  const action = name ? "/pls/prod/bwskanam.P_ProcAppName" : "/pls/prod/bwskaadr.P_ProcAppAddr1";
  const fields = name
    ? '<label>First name<input id="fname" name="fname" required></label><label>Last name<input id="lname" name="lname" required></label>'
    : '<label>Town<input id="city" name="city" value="Existing city" required></label><label>Postcode<input id="zip" name="zip" required></label>';
  const search = name ? "" : '<form name="myform1" action="javascript:void()"><input type="submit" id="search_btn" name="search_btn" value="Search Address"></form>';
  return `<!doctype html><h1>${name ? "Name" : "Permanent Address"}</h1>${search}<form name="myform2" method="post" action="${action}">
    <input type="hidden" name="appno" value="7001"><input type="hidden" name="wsct" value="${name ? "S1" : "S2"}">${fields}
    <input type="submit" id="submit_btn" name="submit_btn" value="Continue"><input type="submit" id="submit_btn" name="submit_btn" value="Finish Later"></form>
    <a href="${gwIndex}?appno=7001">Return to Checklist without saving changes</a>`;
}

function manchesterPage() {
  return `<!doctype html><h1>University of Greater Manchester application</h1><form id="app_form" name="app_form" method="post" action="${gmPath}">
    <ul role="tablist"><li role="tab" aria-selected="true" aria-controls="TAB-PD" class="ui-state-active"><a id="ui-id-2" class="ui-tabs-anchor" href="#TAB-PD">Personal Details</a></li>
    <li role="tab" aria-selected="false" aria-controls="TAB-CD"><a id="ui-id-3" class="ui-tabs-anchor" href="#TAB-CD">Contact Details</a></li>
    <li class="sv-hidden" hidden><a href="#TAB-QU">Qualifications</a></li>
    <li role="tab" aria-selected="false" aria-controls="TAB-SU"><a id="ui-id-13" class="ui-tabs-anchor" href="#TAB-SU">Submission</a></li></ul>
    <div id="TAB-PD" role="tabpanel" class="ui-tabs-panel" aria-hidden="false" aria-busy="true"><div id="TAB-MAIN-PD"></div></div>
    <div id="TAB-CD" role="tabpanel" class="ui-tabs-panel" aria-hidden="true" hidden><div id="TAB-MAIN-CD"></div></div>
    <div id="TAB-SU" role="tabpanel" class="ui-tabs-panel" aria-hidden="true" hidden><div id="TAB-MAIN-SU"><h2>Declaration</h2><label><input id="IPQ_OA_AGREE" name="agree" type="checkbox" required>I declare</label><input id="but_submit" type="submit" value="Submit application">
    <select id="IPR_DOB_DAY"><option value="">Day</option><option value="15">15</option></select><select id="IPR_DOB_MONTH"><option value="">Month</option><option value="2">February</option></select><select id="IPR_DOB_YEAR"><option value="">Year</option><option value="2000">2000</option></select></div></div>
    <input id="but_save" type="button" value="Save"><input id="but_save_and_cont" type="button" value="Save and Continue"><div role="status" id="save_status" aria-live="polite">${scenario === "unconfirmedAdvance" ? "Draft saved successfully" : ""}</div><div role="alert" id="save_error" hidden></div><button type="button" id="fix_error" hidden>Correct validation</button></form>
    <script>
    window.fixtureActivity = {entered: ["PD"]};
    let active = "PD";
    const earlyAdvance = ${JSON.stringify(scenario === "unconfirmedAdvance")};
    function load(tab) {
      const panel = document.getElementById("TAB-" + tab);
      panel.setAttribute("aria-busy", "true");
      setTimeout(() => {
        document.getElementById("TAB-MAIN-" + tab).innerHTML = tab === "PD"
          ? '<label>Forename<input id="IPR_FNM1" name="IPR_FNM1" required></label><label>Surname<input id="IPR_SURN" name="IPR_SURN" required></label>'
          : '<label>Correspondence email<input id="IPR_CAEM" name="IPR_CAEM" type="email" required></label>';
        panel.setAttribute("aria-busy", "false");
      }, 650);
    }
    function activate(tab) {
      active = tab; window.fixtureActivity.entered.push(tab);
      document.querySelectorAll('[role="tabpanel"]').forEach(panel => {panel.hidden = panel.id !== "TAB-" + tab; panel.setAttribute("aria-hidden", String(panel.hidden));});
      document.querySelectorAll('[role="tab"]').forEach(item => {const selected = item.getAttribute("aria-controls") === "TAB-" + tab; item.setAttribute("aria-selected", String(selected)); item.classList.toggle("ui-state-active", selected);});
      if (tab !== "SU") load(tab);
    }
    document.querySelectorAll('a[href^="#TAB-"]').forEach(link => link.addEventListener("click", event => {event.preventDefault(); activate(link.hash.slice(5));}));
    async function save(advance) {
      const status = document.getElementById("save_status"), error = document.getElementById("save_error");
      if (!earlyAdvance || active !== "PD") status.textContent = "Saving draft"; error.hidden = true;
      document.getElementById("but_save").disabled = document.getElementById("but_save_and_cont").disabled = true;
      const body = new URLSearchParams(new FormData(document.getElementById("app_form"))); body.set("fixture_step", active);
      const before = active;
      const saving = fetch(location.pathname, {method: "POST", body});
      if (earlyAdvance && before === "PD" && advance) {activate("CD"); document.getElementById("but_save").disabled = document.getElementById("but_save_and_cont").disabled = false;}
      const response = await saving;
      if (response.ok) {status.textContent = "Draft saved successfully"; if (advance && !(earlyAdvance && before === "PD")) activate(active === "PD" ? "CD" : "SU");}
      else {status.textContent = ""; error.textContent = "Draft could not be saved"; error.hidden = false; document.getElementById("fix_error").hidden = false;}
      document.getElementById("but_save").disabled = document.getElementById("but_save_and_cont").disabled = false;
    }
    document.getElementById("but_save").addEventListener("click", () => save(false));
    document.getElementById("but_save_and_cont").addEventListener("click", () => save(true));
    document.getElementById("fix_error").addEventListener("click", event => {event.target.hidden = true; document.getElementById("save_error").hidden = true; document.getElementById("save_status").textContent = "";});
    load("PD");
    </script>`;
}

function genericForm(path) {
  const personal = path.endsWith("personal");
  const fields = personal
    ? '<label>First name<input name="givenName" autocomplete="given-name" required></label><label>Last name<input name="familyName" autocomplete="family-name" required></label>'
    : '<label>Email<input name="email" type="email" autocomplete="email" required></label><label>City<input name="city" autocomplete="address-level2" value="Existing city" required></label>';
  const base = scenario === "foreignBase" ? '<base href="https://elsewhere.example.test/">' : "";
  const action = scenario === "finalTarget" ? "/applications/fixture-1/submit" : path;
  const manual = scenario === "missing" ? '<label>Manually required<input name="manual_answer" required></label>' : "";
  const label = scenario === "ambiguous" ? "Next" : "Save and continue";
  const busy = scenario === "busyGeneric" ? ' aria-busy="true"' : "";
  const edit = scenario === "busyGeneric" ? '<button type="button" id="manual_ready" onclick="document.querySelector(\'form\').setAttribute(\'aria-busy\', \'false\')">Edit this screen</button>' : "";
  return `<!doctype html>${base}<title>University application</title><h1>${personal ? "Personal details" : "Contact details"}</h1><form method="post" action="${action}"${busy}>${fields}${manual}<button type="submit">${label}</button></form>${edit}`;
}

before(async () => {
  await mkdir(evidence, { recursive: true });
  const run = await mkdtemp(join(root, "tmp/fill-all-portals-"));
  const extensionPath = join(run, "extension");
  await mkdir(extensionPath);
  for (const path of ["config", "src", "popup.html", "popup.js", "sams-logo.svg", "icon16.png", "icon48.png", "icon128.png"]) {
    await cp(join(root, path), join(extensionPath, path), { recursive: true });
  }
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  manifest.host_permissions = ["https://app.samscrm.co.uk/*", `${greenwichOrigin}/*`, `${manchesterOrigin}/*`];
  assert.equal(manifest.host_permissions.some((value) => value.includes(new URL(genericOrigin).hostname)), false);
  await writeFile(join(extensionPath, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(extensionPath, "config/build-mode.js"), 'globalThis.SAMS_BUILD_MODE = "prod";\n');
  context = await chromium.launchPersistentContext(join(run, "profile"), {
    executablePath: process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium",
    channel: "chromium", headless: false, ignoreDefaultArgs: ["--disable-extensions"], timeout: 15000,
    args: ["--disable-component-extensions-with-background-pages", "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`,
      "--host-resolver-rules=MAP * ~NOTFOUND", "--disable-background-networking"],
  });
  context.setDefaultTimeout(5000);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.href === crmUrl) return route.fulfill({ contentType: "text/html", body: await readFile(join(root, "e2e/fixtures/crm.html"), "utf8") });
    if (url.origin === genericOrigin && ["/applications/fixture-1/personal", "/applications/fixture-1/contact"].includes(url.pathname)) {
      if (request.method() === "POST") {
        posts.push({ path: url.pathname, fields: Object.fromEntries(new URLSearchParams(request.postData() || "")) });
        const next = url.pathname.endsWith("personal") ? "/applications/fixture-1/contact" : "/applications/fixture-1/declaration";
        const body = next.endsWith("declaration") ? declaration : genericForm(next);
        return route.fulfill({ contentType: "text/html", body: `${body}<script>history.replaceState(null, "", ${JSON.stringify(next)})</script>` });
      }
      return route.fulfill({ contentType: "text/html", body: genericForm(url.pathname) });
    }
    if (url.origin === genericOrigin && url.pathname.endsWith("/declaration")) return route.fulfill({ contentType: "text/html", body: declaration });
    if (url.origin === greenwichOrigin) {
      if (url.pathname === gwIndex) return route.fulfill({ contentType: "text/html", body: greenwichChecklist() });
      if ([gwName, gwAddress].includes(url.pathname)) return route.fulfill({ contentType: "text/html", body: greenwichSection(url.pathname) });
      if (request.method() === "POST" && ["/pls/prod/bwskanam.P_ProcAppName", "/pls/prod/bwskaadr.P_ProcAppAddr1"].includes(url.pathname)) {
        posts.push({ path: url.pathname, fields: Object.fromEntries(new URLSearchParams(request.postData() || "")) });
        return route.fulfill({ contentType: "text/html", body: `${greenwichChecklist()}<script>history.replaceState(null,"","${gwIndex}?appno=7001")</script>` });
      }
    }
    if (url.origin === manchesterOrigin && url.pathname === gmPath) {
      if (request.method() === "POST") {
        posts.push({ path: url.pathname, fields: Object.fromEntries(new URLSearchParams(request.postData() || "")) });
        if (scenario === "unconfirmedAdvance" && posts.length === 1) await new Promise((resolve) => { releaseGmSave = resolve; });
        return route.fulfill({ status: scenario === "saveFailure" ? 422 : 200, contentType: "text/plain", body: scenario === "saveFailure" ? "Validation failed" : "Saved" });
      }
      return route.fulfill({ contentType: "text/html", body: manchesterPage() });
    }
    unexpected.push({ method: request.method(), origin: url.origin, path: url.pathname });
    return route.abort();
  });
  worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  extensionId = new URL(worker.url()).host;
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
}, { timeout: 30000 });

after(async () => { await context?.close(); });

async function setup(mode = "normal", url = `${genericOrigin}/applications/fixture-1/personal`) {
  scenario = mode;
  posts.length = 0;
  unexpected.length = 0;
  for (const page of context.pages()) if (page !== popup) await page.close();
  await popup.reload();
  await popup.evaluate(() => chrome.runtime.sendMessage({ action: "clearStudentCache" }));
  const crm = await context.newPage();
  await crm.goto(crmUrl);
  await crm.bringToFront();
  await popup.locator("#btnCopy").click();
  await popup.locator("#statusArea .success").waitFor();
  portal = await context.newPage();
  await portal.goto(url);
  await portal.bringToFront();
  // Opening the popup on the selected portal resolves its tab before the one-click start.
  await popup.reload();
}

// Same installed-browser toolbar action as the per-page E2E: no artificial origin grant.
async function toolbarFor(page) {
  await page.bringToFront();
  const browser = await context.browser().newBrowserCDPSession();
  const targets = async () => (await browser.send("Target.getTargets", { filter: [{ type: "browser", exclude: true }, {}] })).targetInfos;
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const existing = new Set((await targets()).filter((target) => target.url === popupUrl).map((target) => target.targetId));
  const tab = (await targets()).find((target) => target.type === "tab" && target.url === page.url());
  assert.ok(tab);
  await browser.send("Extensions.triggerAction", { id: extensionId, targetId: tab.targetId });
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    target = (await targets()).find((candidate) => candidate.url === popupUrl && !existing.has(candidate.targetId));
    if (!target) await pause(100);
  }
  assert.ok(target, "Real toolbar popup must open");
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: false });
  const pending = new Map();
  let nextId = 0;
  browser.on("Target.receivedMessageFromTarget", (event) => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message);
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
  return {
    evaluate,
    async capture(name) {
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(join(evidence, name), Buffer.from(data, "base64"));
    },
    async close() {
      await browser.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
      await browser.detach().catch(() => {});
    },
  };
}

async function status() {
  return popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getFillAllStatus" })).run);
}

async function start({ toolbar = false, screenshot = "", runningScreenshot = "" } = {}) {
  const previous = (await status())?.id;
  let realPopup;
  try {
    if (toolbar) {
      realPopup = await toolbarFor(portal);
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !await realPopup.evaluate('document.getElementById("studentCard").hidden === false')) await pause(50);
      if (screenshot) await realPopup.capture(screenshot);
      await realPopup.evaluate('document.getElementById("btnFillAll").click();');
    } else {
      await popup.locator("#btnFillAll").click();
    }
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const run = await status();
      if (run && run.id !== previous) {
        if (realPopup && runningScreenshot) {
          const renderDeadline = Date.now() + 5000;
          while (Date.now() < renderDeadline && !await realPopup.evaluate('document.getElementById("btnStopFillAll").hidden === false')) await pause(50);
          assert.equal(await realPopup.evaluate('(() => {const button = document.getElementById("btnStopFillAll"); const rect = button.getBoundingClientRect(); return !button.hidden && rect.top >= 0 && rect.bottom <= window.innerHeight;})()'), true, "Stop must be reachable in the real toolbar viewport without scrolling");
          await realPopup.capture(runningScreenshot);
        }
        return run.id;
      }
      await pause(50);
    }
    throw new Error(`No new run: ${await popup.locator("#fillAllStatus").innerText()}`);
  } finally { await realPopup?.close(); }
}

async function stopped(id) {
  const deadline = Date.now() + 20000;
  let run;
  while (Date.now() < deadline) {
    run = await status();
    if (run?.id === id && ["stopped", "completed", "failed"].includes(run.status)) {
      terminalRuns.push(run);
      await writeFile(join(evidence, "terminal-runs.json"), JSON.stringify(terminalRuns, null, 2));
      return run;
    }
    await pause(100);
  }
  throw new Error(`Run did not stop: ${JSON.stringify({ run, unexpected })}`);
}

test("Unmapped portal requires real toolbar access, saves two screens, and leaves declaration untouched", { timeout: 35000 }, async () => {
  await setup();
  await popup.locator("#btnFillAll").click();
  await popup.locator("#fillAllStatus .error, #fillAllStatus .warning").waitFor();
  assert.equal(await portal.locator("input[name=givenName]").inputValue(), "");
  assert.deepEqual(posts, []);
  const run = await stopped(await start({ toolbar: true, screenshot: "generic-ready.png" }));
  assert.ok(["stopped", "completed"].includes(run.status), run.reason);
  assert.equal(posts.length, 2, run.reason);
  assert.equal(posts[0].fields.givenName, "Aisha");
  assert.equal(posts[0].fields.familyName, "Rahman");
  assert.equal(posts[1].fields.email, "aisha.rahman@example.com");
  assert.equal(posts[1].fields.city, "Existing city");
  assert.equal(await portal.locator("input[name=declare]").isChecked(), false);
  assert.deepEqual(unexpected, []);
  await popup.setViewportSize({ width: 390, height: 820 });
  await popup.locator("#fillAllStatus .warning, #fillAllStatus .success").waitFor();
  await popup.screenshot({ path: join(evidence, "generic-stopped.png"), fullPage: true });
});

for (const mode of ["ambiguous", "foreignBase", "missing", "finalTarget"]) {
  test(`Unmapped safety boundary: ${mode} does not save or contact an unsafe destination`, { timeout: 30000 }, async () => {
    await setup(mode);
    const run = await stopped(await start({ toolbar: true }));
    assert.equal(run.status, "stopped", run.reason);
    assert.deepEqual(posts, []);
    assert.deepEqual(unexpected, []);
  });
}

test("Greenwich saves sections through its bound checklist without clicking Signature or final submission", { timeout: 35000 }, async () => {
  await setup("greenwich", `${greenwichOrigin}${gwIndex}?appno=7001`);
  const run = await stopped(await start());
  assert.ok(["stopped", "completed"].includes(run.status), run.reason);
  assert.equal(posts.length, 2, run.reason);
  assert.equal(posts[0].fields.fname, "Aisha");
  assert.equal(posts[0].fields.lname, "Rahman");
  assert.equal(posts[1].fields.city, "Existing city");
  assert.equal(posts[1].fields.zip, "1205");
  assert.ok(posts.every((post) => post.fields.appno === "7001" && post.fields.submit_btn === "Continue"));
  assert.deepEqual(unexpected, [], "No final-submit or Signature request");
  assert.equal(new URL(portal.url()).pathname, gwIndex);
  await popup.locator("#fillAllStatus .warning, #fillAllStatus .success").waitFor();
  await popup.screenshot({ path: join(evidence, "greenwich-stopped.png"), fullPage: true });
  await portal.screenshot({ path: join(evidence, "greenwich-checklist-untouched.png") });
});

test("Greenwich refuses a checklist link to a different application", { timeout: 30000 }, async () => {
  await setup("wrongApplication", `${greenwichOrigin}${gwIndex}?appno=7001`);
  const run = await stopped(await start());
  assert.equal(run.status, "stopped", run.reason);
  assert.deepEqual(posts, []);
  assert.deepEqual(unexpected, []);
});

test("Manchester waits for lazy panels, saves two drafts, and never enters Submission", { timeout: 35000 }, async () => {
  await setup("manchester", `${manchesterOrigin}${gmPath}`);
  const run = await stopped(await start());
  assert.ok(["stopped", "completed"].includes(run.status), run.reason);
  assert.equal(posts.length, 2, run.reason);
  assert.equal(posts[0].fields.IPR_FNM1, "Aisha");
  assert.equal(posts[0].fields.IPR_SURN, "Rahman");
  assert.equal(posts[1].fields.IPR_CAEM, "aisha.rahman@example.com");
  assert.equal(run.counts.saved, 2);
  assert.deepEqual(await portal.evaluate(() => window.fixtureActivity.entered), ["PD", "CD"]);
  assert.equal(await portal.locator("#IPQ_OA_AGREE").isChecked(), false);
  assert.deepEqual(await portal.locator("#TAB-SU select").evaluateAll((controls) => controls.map((control) => control.value)), ["", "", ""], "Split-date filling must stay inside the active panel");
  assert.deepEqual(unexpected, []);
  await popup.locator("#fillAllStatus .warning, #fillAllStatus .success").waitFor();
  await popup.screenshot({ path: join(evidence, "manchester-stopped.png"), fullPage: true });
  await portal.screenshot({ path: join(evidence, "manchester-contact-saved.png") });
});

test("Manchester save failure stops before advancing or claiming a saved draft", { timeout: 30000 }, async () => {
  await setup("saveFailure", `${manchesterOrigin}${gmPath}`);
  const run = await stopped(await start());
  assert.equal(run.status, "stopped", run.reason);
  assert.equal(posts.length, 1);
  assert.equal(run.counts.saved, 0);
  assert.deepEqual(await portal.evaluate(() => window.fixtureActivity.entered), ["PD"]);
  assert.deepEqual(unexpected, []);
});

test("A new Manchester run works after staff corrects a validation error on the same document", { timeout: 35000 }, async () => {
  await setup("saveFailure", `${manchesterOrigin}${gmPath}`);
  const first = await stopped(await start());
  assert.equal(first.status, "stopped");
  assert.equal(first.counts.saved, 0);
  scenario = "manchester";
  await portal.locator("#fix_error").click();
  const retry = await stopped(await start());
  assert.equal(retry.counts.saved, 2, retry.reason);
  assert.equal(posts.length, 3);
  assert.deepEqual(unexpected, []);
});

test("Manchester does not treat an early tab switch and stale success text as a save acknowledgement", { timeout: 35000 }, async () => {
  await setup("unconfirmedAdvance", `${manchesterOrigin}${gmPath}`);
  const firstPost = portal.waitForRequest((request) => request.method() === "POST");
  const id = await start();
  await firstPost;
  try {
    await portal.locator("#IPR_CAEM").waitFor();
    await pause(900);
    assert.equal(await portal.locator("#IPR_CAEM").inputValue(), "", "Do not fill the next panel until the pending save is acknowledged");
    assert.equal((await status()).counts.saved, 0);
    releaseGmSave?.(); releaseGmSave = null;
    const run = await stopped(id);
    assert.equal(run.counts.saved, 2, run.reason);
    assert.equal(posts.length, 2);
    assert.deepEqual(unexpected, []);
  } finally { releaseGmSave?.(); releaseGmSave = null; }
});

test("Unmapped readiness waits on shared DOM state and staff interaction stops further filling", { timeout: 30000 }, async () => {
  await setup("busyGeneric");
  const id = await start({ toolbar: true, runningScreenshot: "generic-running.png" });
  await pause(900);
  assert.equal(await portal.locator("input[name=givenName]").inputValue(), "", "A busy form is not ready to fill");
  assert.deepEqual(posts, []);
  await portal.locator("#manual_ready").click();
  const run = await stopped(id);
  assert.equal(run.status, "stopped", run.reason);
  assert.equal(await portal.locator("input[name=givenName]").inputValue(), "");
  assert.deepEqual(posts, []);
});
