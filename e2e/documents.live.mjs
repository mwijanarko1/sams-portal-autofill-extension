import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert.ok(process.argv.includes("--no-save"), "Explicit --no-save is required");
process.loadEnvFile(join(root, ".env.local"));
const out = resolve(root, process.env.SAMS_DOCUMENT_EVIDENCE || "tmp/generic-upload-evidence");
assert.ok(out.startsWith(join(root, "tmp") + "/"), "Evidence must stay in ignored tmp");
await mkdir(out, { recursive: true, mode: 0o700 });
const run = await mkdtemp(join(root, "tmp/document-live-"));
const extension = join(run, "extension");
await mkdir(extension);
for (const item of ["config", "src", "popup.html", "popup.js", "sams-logo.svg", "icon16.png", "icon48.png", "icon128.png"]) {
  await cp(join(root, item), join(extension, item), { recursive: true });
}
if (process.env.SAMS_DOCUMENT_BASELINE === "1") {
  for (const item of ["src/portal-fill.js", "popup.js", "popup.html"]) {
    await writeFile(join(extension, item), execFileSync("git", ["show", `HEAD:${item}`], { cwd: root }));
  }
}
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
// A popup tab has no toolbar activeTab gesture. Grant only the three requested origins.
manifest.host_permissions = ["https://app.samscrm.co.uk/*", "https://apps.bangor.ac.uk/*", "https://nelson.gre.ac.uk/*", "https://evision.bolton.ac.uk/*"];
await writeFile(join(extension, "manifest.json"), JSON.stringify(manifest));
await writeFile(join(extension, "config/build-mode.js"), 'globalThis.SAMS_BUILD_MODE = "prod";\n');

const report = { mode: "live-document-attachment-no-save", source: process.env.SAMS_DOCUMENT_BASELINE === "1" ? "HEAD-baseline" : "working-tree", syntheticResponses: 0,
  temporaryRun: run,
  transmittedPortalWrites: 0, blockedWrites: [], crm: { status: "pending" }, portals: [] };
const portals = [
  { id: "bangor", origin: "https://apps.bangor.ac.uk", login: "https://apps.bangor.ac.uk/apply/account/login/?next=/apply/personal/",
    username: "BANGOR_USERNAME", password: "BANGOR_PASSWORD", submit: /^Log In$/i,
    routes: ["/apply/education/form/", "/apply/additionalinfo/", "/apply/finance/"] },
  { id: "greenwich", origin: "https://nelson.gre.ac.uk", login: "https://nelson.gre.ac.uk/pls/prod/bwskalog.P_DispLoginNon",
    username: "GREENWICH_LOGINID", password: "GREENWICH_PIN", submit: /^Login$/i },
  { id: "greater-manchester", origin: "https://evision.bolton.ac.uk",
    login: "https://evision.bolton.ac.uk/urd/sits.urd/run/siw_ipp_lgn.login?process=siw_ipp_app&code1=0994-D&code2=0010",
    username: "GREATER_MANCHESTER_USERNAME", password: "GREATER_MANCHESTER_PASSWORD", submit: /^log\s*in$/i },
];
const crmOrigin = "https://app.samscrm.co.uk";
let auth = null;
let stage = "launch";
let context;
let popup;
let worker;
let chosenDocument;
let crm;
function diagnostic(error) {
  let message = error.message.split("\n")[0];
  for (const key of ["SAMS_CRM_USERNAME", "SAMS_CRM_PASSWORD", "BANGOR_USERNAME", "BANGOR_PASSWORD", "GREENWICH_LOGINID", "GREENWICH_PIN", "GREATER_MANCHESTER_USERNAME", "GREATER_MANCHESTER_PASSWORD"]) {
    if (process.env[key]) message = message.replaceAll(process.env[key], "[redacted]");
  }
  return message.slice(0, 350);
}
const deadline = setTimeout(() => { report.deadlineExceeded = true; context?.close().catch(() => {}); }, process.env.SAMS_DOCUMENT_WAIT_CAPTCHA === "1" ? 1200000 : 480000);
deadline.unref();

async function authenticate(page, config) {
  await page.goto(config.login, { waitUntil: "domcontentloaded" });
  if (!await page.locator("input[type=password]").count()) return;
  assert.ok(process.env[config.username] && process.env[config.password], "Credential keys missing");
  const humanVerification = await page.locator("iframe[src*='recaptcha'], .g-recaptcha, iframe[src*='challenges.cloudflare']").count();
  if (humanVerification && process.env.SAMS_DOCUMENT_WAIT_CAPTCHA !== "1") throw new Error("Human verification required; credentials not submitted");
  const username = page.locator("input[type=email], input[name=in_id], #login_id, #floatingInput, #MUA_CODE, input[name='MUA_CODE.DUMMY.MENSYS.1']").first();
  const action = await username.evaluate((element) => element.form?.action);
  assert.equal(new URL(action).origin, config.origin, "Unexpected login action origin");
  auth = new URL(action);
  try {
    await username.fill(process.env[config.username]);
    await page.locator("input[type=password]").first().fill(process.env[config.password]);
    if (humanVerification) {
      await page.bringToFront();
      const loginUrl = page.url();
      await writeFile(join(out, "progress.json"), JSON.stringify({ stage, needsHuman: "Complete CAPTCHA and click Login in the open Greenwich window", deadline: "15 minutes" }));
      await page.waitForURL((url) => url.origin === config.origin && url.href !== loginUrl, { waitUntil: "domcontentloaded", timeout: 900000 });
    } else {
      await page.getByRole("button", { name: config.submit }).first().click();
    }
    await page.locator("input[type=password]").waitFor({ state: "hidden", timeout: 20000 });
    assert.equal(new URL(page.url()).origin, config.origin);
  } finally { auth = null; }
}

async function activate(page) {
  await page.bringToFront();
  assert.equal(await popup.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url), page.url());
}

async function findCrmDocuments() {
  crm = await context.newPage();
  await authenticate(crm, { origin: crmOrigin, login: crmOrigin + "/", username: "SAMS_CRM_USERNAME", password: "SAMS_CRM_PASSWORD", submit: /sign in/i });
  await crm.goto(crmOrigin + "/agent/new-direct-leads", { waitUntil: "domcontentloaded" });
  await crm.locator("a[href*='/agent/leads/full-profile/']").first().waitFor();
  const links = [...new Set(await crm.locator("a[href*='/agent/leads/full-profile/']").evaluateAll((nodes) => nodes.map((node) => node.href)))].slice(0, 40);
  let scanned = 0;
  let firstCopyError = "";
  report.crm.candidates = links.length;
  for (const link of links) {
    scanned++;
    const parsed = new URL(link);
    if (parsed.origin !== crmOrigin || !/^\/agent\/leads\/full-profile\/\d{1,12}\/?$/.test(parsed.pathname)) continue;
    report.crm.scanned = scanned;
    await crm.goto(link, { waitUntil: "domcontentloaded" });
    await crm.locator("meta[name=api-token]").waitFor({ state: "attached" });
    await crm.waitForFunction(() => ["student profile", "personal information", "profile at a glance", "given name"].some((marker) => document.body.innerText.toLowerCase().replace(/[\s_*:]+/g, " ").includes(marker)), null, { timeout: 30000 });
    await activate(crm);
    await popup.locator("#btnCopy").click();
    await popup.locator("#statusArea .success, #statusArea .error").waitFor({ timeout: 45000 });
    const cached = await popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getStudentCache" })).cache);
    if (!cached?.documents?.length) {
      report.crm.emptyCopies = (report.crm.emptyCopies || 0) + 1;
      report.crm.copyError = await popup.locator("#statusArea .error").count() ? diagnostic(new Error(await popup.locator("#statusArea .error").innerText())) : null;
      if (report.crm.copyError && report.crm.copyError === firstCopyError && report.crm.emptyCopies >= 3) {
        throw new Error("Three CRM Copy rejections: " + report.crm.copyError);
      }
      firstCopyError ||= report.crm.copyError;
      continue;
    }
    chosenDocument = cached.documents.find((document) => document.extension === "pdf") || cached.documents[0];
    report.crm = { status: "copy-passed", scanned, fields: Object.keys(cached.fields).length, documents: cached.documents.length };
    return;
  }
  throw new Error("No copied CRM documents among first 40 visible profiles");
}

async function scan(page, result) {
  await activate(page);
  await popup.locator("#btnDocuments").click();
  await popup.waitForFunction(() => !document.querySelector("#documentsCard").hidden || /No file upload|No upload|could not|Could not/.test(document.querySelector("#statusArea").textContent));
  const count = await popup.locator(".upload-row").count();
  result.scans.push({ inputs: await page.locator("input[type=file]:not(:disabled)").count(), rows: count });
  return count;
}

async function capture(result, state) {
  await popup.setViewportSize({ width: 390, height: 600 });
  await popup.locator("#documentsCard").scrollIntoViewIfNeeded();
  const path = join(out, `${result.portal}-${state}.png`);
  await popup.screenshot({ path, maskColor: "#cbd5e1", mask: [popup.locator("#studentName:visible, #studentMeta:visible, #copiedFields:visible, #copiedDocumentsList:visible, .upload-choice-value:not(.placeholder):visible, .upload-status.done:visible")] });
  result.screenshots ||= [];
  result.screenshots.push({ state, path, width: 390, height: 600, capturedAt: new Date().toISOString() });
}

async function locateUploadPage(page, portal, result) {
  await page.locator("body").waitFor({ state: "attached", timeout: 20000 });
  if (portal.id === "greenwich") {
    await page.locator("a[href*='bwsk'], input:not([type=hidden]), select, textarea").first().waitFor({ state: "visible", timeout: 20000 });
  }
  if (await page.locator("input[type=file]:not(:disabled)").count()) return true;
  if (portal.routes) {
    for (const route of portal.routes) {
      await page.goto(portal.origin + route, { waitUntil: "domcontentloaded" });
      if (await page.locator("input[type=file]:not(:disabled)").count()) return true;
    }
  }
  if (portal.id === "greater-manchester") {
    const tab = page.locator("a[onclick*=\"ul_click_tab('QU')\"], a[href*=\"ul_click_tab('QU')\"]").first();
    await tab.waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
    if (await tab.count()) {
      await tab.click();
      await page.locator("#TAB-MAIN-QU input[type=file]").first().waitFor({ state: "attached", timeout: 15000 });
      return true;
    }
  }
  const destinations = await page.locator("a[href]").evaluateAll((nodes) => nodes.filter((node) => /upload|document|attachment|supporting|qualification/i.test(node.innerText))
    .map((node) => node.href));
  for (const destination of [...new Set(destinations)].slice(0, 6)) {
    const url = new URL(destination);
    if (url.origin !== portal.origin || !/^https:/.test(url.href) || /logout|delete|submit|save|procapp|confirm/i.test(url.pathname)) continue;
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    if (await page.locator("input[type=file]:not(:disabled)").count()) return true;
  }
  result.reason = "No existing accessible upload form; no new application or saved step created";
  result.discovery = await page.evaluate(() => ({
    path: location.pathname,
    tabCount: document.querySelectorAll("a[onclick*=ul_click_tab], a[href*=ul_click_tab]").length,
    inputCount: document.querySelectorAll("input[type=file]").length,
    documentLinks: [...document.querySelectorAll("a[href]")].filter((node) => /upload|document|attachment|supporting|qualification/i.test(node.innerText)).length,
    navigation: [...document.querySelectorAll("a[href], button, input[type=submit]")].filter((node) => /continue|return|application|qualifications|re.enter|next|upload|document/i.test(node.innerText || node.value)).map((node) => ({
      tag: node.tagName,
      label: (node.innerText || node.value).replace(/\s+/g, " ").trim().slice(0, 100),
      path: node.href && !node.href.startsWith("javascript:") ? new URL(node.href).pathname : null,
      script: node.getAttribute("onclick")?.match(/^[\w.]+/)?.[0] || null,
    })).slice(0, 12),
    state: ["session expired", "no applications", "not permitted", "invalid", "error", "please wait", "application form", "qualifications", "currently unavailable"].filter((phrase) => (document.body?.innerText || "").toLowerCase().includes(phrase)),
    frames: document.querySelectorAll("iframe, frame").length,
  }));
  return false;
}

async function checkAttachment(page, result) {
  assert.ok(await scan(page, result), "Real upload inputs were not discovered by the extension");
  await capture(result, "scanned");
  const rows = popup.locator(".upload-row");
  const show = rows.first().getByRole("button", { name: "Show on page", exact: true });
  assert.equal(await show.count(), 1, "Show on page is missing");
  const beforeFiles = await page.locator("input[type=file]").evaluateAll((nodes) => nodes.map((node) => node.files.length));
  await show.click();
  await rows.first().locator(".upload-status").filter({ hasText: /highlight|manual|cannot|could not|changed/i }).waitFor();
  assert.deepEqual(await page.locator("input[type=file]").evaluateAll((nodes) => nodes.map((node) => node.files.length)), beforeFiles, "Show must not attach files");
  result.showOnPage = "passed";
  let selectedRow;
  let selectedIndex;
  for (let i = 0; i < await rows.count(); i++) {
    const row = rows.nth(i);
    const picker = row.getByRole("combobox");
    if (await picker.isDisabled()) continue;
    await picker.click();
    const option = row.locator(`[role=option][data-value="${chosenDocument.key}"]`);
    if (!await option.count()) { await picker.press("Escape"); continue; }
    await option.click();
    selectedRow = row;
    selectedIndex = i;
    break;
  }
  assert.ok(selectedRow, "No empty upload accepts the copied document");
  assert.deepEqual(await page.locator("input[type=file]").evaluateAll((nodes) => nodes.map((node) => node.files.length)), beforeFiles, "Choosing must not attach");
  const initial = report.blockedWrites.length;
  const crmResponse = crm.waitForResponse((response) => response.url() === chosenDocument.url, { timeout: 45000 });
  await selectedRow.getByRole("button", { name: "Attach", exact: true }).click();
  const response = await crmResponse;
  assert.equal(response.status(), 200, "Real CRM document fetch must succeed");
  assert.ok(!/text\/html/i.test(response.headers()["content-type"] || ""), "CRM returned HTML instead of a file");
  const expectedDigest = createHash("sha256").update(await response.body()).digest("hex");
  await selectedRow.locator(".upload-status.done, .upload-status.failed").waitFor({ timeout: 45000 });
  assert.equal(await selectedRow.locator(".upload-status.failed").count(), 0, "Extension reported attachment failure");
  const fileEvidence = await page.locator("input[type=file]").evaluateAll(async (nodes) => Promise.all(nodes.map(async (node) => {
    const file = node.files[0];
    if (!file) return { count: 0 };
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return { count: node.files.length, size: file.size, type: file.type, magic: Array.from(bytes), digest };
  })));
  assert.ok(fileEvidence.some((file, index) => beforeFiles[index] === 0 && file.count === 1 && file.size > 0), "Widget did not retain the selected file");
  assert.ok(fileEvidence.some((file, index) => beforeFiles[index] === 0 && file.digest === expectedDigest), "Assigned file bytes differ from real CRM response");
  result.exactBytesMatch = true;
  result.fileAssignment = "passed";
  result.files = fileEvidence.filter((file) => file.count).map(({ digest, ...file }) => file);
  result.autoUploadBlocked = report.blockedWrites.length - initial;
  result.serverAcceptance = "not-tested-no-save";
  result.status = "attachment-passed-server-unverified";
  await capture(result, "assigned");
  await scan(page, result);
  assert.ok(await popup.locator(".upload-row").nth(selectedIndex).getByRole("combobox").isDisabled(), "Rescan must not offer to replace the assigned file");
  assert.ok(await popup.locator(".upload-row").nth(selectedIndex).getByRole("button", { name: "Attach", exact: true }).isDisabled(), "Occupied input must not be attachable");
  result.occupiedGuard = "passed";
}

try {
  context = await chromium.launchPersistentContext(join(run, "profile"), {
    executablePath: process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium",
    channel: "chromium", headless: false, ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--no-first-run"], timeout: 20000,
  });
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(30000);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const login = auth && request.method() === "POST" && url.origin === auth.origin && url.pathname === auth.pathname;
    const captchaAuthentication = auth?.origin === "https://nelson.gre.ac.uk" && request.method() === "POST" &&
      ["https://www.google.com", "https://www.recaptcha.net"].includes(url.origin) && url.pathname.startsWith("/recaptcha/");
    if (["GET", "HEAD", "OPTIONS"].includes(request.method()) || login || captchaAuthentication) return route.continue();
    report.blockedWrites.push({ stage, method: request.method(), portal: portals.find((portal) => portal.origin === url.origin)?.id || "crm-or-other", origin: url.origin });
    await route.abort();
  });
  worker = context.serviceWorkers().find((candidate) => candidate.url().endsWith("/src/background.js")) ||
    await context.waitForEvent("serviceworker", { predicate: (candidate) => candidate.url().endsWith("/src/background.js") });
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  stage = "crm-copy";
  try { await findCrmDocuments(); }
  catch (error) { Object.assign(report.crm, { status: "blocked", error: error.name, reason: diagnostic(error) }); }
  for (const portal of portals) {
    const result = { portal: portal.id, status: "blocked", scans: [] };
    report.portals.push(result);
    const page = await context.newPage();
    try {
      stage = portal.id + "-login";
      await authenticate(page, portal);
      result.authenticated = true;
      stage = portal.id + "-discovery";
      if (!await locateUploadPage(page, portal, result)) continue;
      result.realUploadInputs = await page.locator("input[type=file]").count();
      if (!chosenDocument) { result.reason = "CRM Copy supplied no documents"; continue; }
      stage = portal.id + "-attachment";
      await checkAttachment(page, result);
    } catch (error) {
      result.status = error.name === "AssertionError" ? "failed" : "blocked";
      result.error = error.name;
      result.reason = diagnostic(error);
    } finally { await page.close(); }
  }
} catch (error) { report.failure = { stage, type: error.name }; }
finally {
  clearTimeout(deadline);
  if (popup && !popup.isClosed()) {
    try {
      await popup.locator("#btnClear").click();
      report.cacheCleared = await popup.evaluate(async () => !(await chrome.runtime.sendMessage({ action: "getStudentCache" })).cache);
    } catch { report.cacheCleared = false; }
  }
  await context?.close();
  await rm(join(run, "profile"), { recursive: true, force: true });
  report.temporaryProfileRemoved = true;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.portals.length === 3 && report.portals.every((portal) => portal.status === "attachment-passed-server-unverified") ? 0 : 1;
}
