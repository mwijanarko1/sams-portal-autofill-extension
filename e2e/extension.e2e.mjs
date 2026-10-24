import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { constants } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(root, "e2e/fixtures");
const executablePath = process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium";
const crmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/e2e-synthetic/";
const greenwichCrmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/e2e-greenwich-synthetic/";
const statisticalAfterSaveUrl = "https://nelson.gre.ac.uk/pls/prod/bwskaadr.P_ProcAppAddr1";
const statisticalUrl = "https://nelson.gre.ac.uk/pls/prod/bwskaper.P_DispAppPersonal";
const employmentUrl = "https://nelson.gre.ac.uk/pls/prod/bwskaess.P_DispAppEssay";
const employmentAfterSaveUrl = "https://nelson.gre.ac.uk/pls/prod/bwskanam.P_ProcAppName";
const documentCrmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/424242/";
const documentsPortalUrl = "https://apps.bangor.ac.uk/apply/documents/";
const documentsFrameUrl = "https://apps.bangor.ac.uk/apply/documents-frame/";
const noDocumentsUrl = "https://apps.bangor.ac.uk/apply/no-documents/";
const syntheticToken = "0123456789abcdef".repeat(4);
const syntheticCookie = "sams_e2e_session=synthetic-crm-session-only";
const mediaOrigin = "https://app.samscrm.co.uk";
const documentFixtures = [
  { endpoint: "fp_cv_docs", dataKey: "cv_docs", group: "cv", groupLabel: "Curriculum Vitae (CV)",
    id: 101, documentType: null, name: "cv-profile", extension: "pdf" },
  { endpoint: "fp_edu_docs", dataKey: "edu_docs", group: "edu", groupLabel: "Education History",
    id: 102, documentType: "Transcript", name: "academic-record", extension: "pdf" },
  { endpoint: "fp_work_history_docs", dataKey: "work_history_docs", group: "work_history", groupLabel: "Work Experience",
    id: 103, documentType: "Certificate", name: "employment-letter", extension: "pdf" },
  { endpoint: "fp_get_eng_test_docs", dataKey: "eng_test_docs", group: "eng_test", groupLabel: "Test Score",
    id: 104, documentType: "Certificate", name: "english-score", extension: "jpg" },
  { endpoint: "fp_get_reference_docs", dataKey: "reference_docs", group: "reference", groupLabel: "References",
    id: 105, documentType: null, name: "referee-letter", extension: "pdf" },
  { endpoint: "fp_get_visa_history_docs", dataKey: "visa_history_docs", group: "visa_history", groupLabel: "Visa History",
    id: 106, documentType: null, name: "previous-visa", extension: "jpg" },
  { endpoint: "fp_get_visa_refusal_docs", dataKey: "visa_refusal_docs", group: "visa_refusal", groupLabel: "Visa Refusal",
    id: 107, documentType: null, name: "refusal-letter", extension: "pdf" },
  { endpoint: "fp_get_passport_docs", dataKey: "passport_docs", group: "passport", groupLabel: "Passport",
    id: 108, documentType: null, name: "identity-page", extension: "pdf" },
  { endpoint: "fp_get_additional_docs", dataKey: "additional_docs", group: "additional", groupLabel: "Additional Documentations",
    id: 109, documentType: null, name: "portrait", extension: "jpg" },
];
const mediaFixtures = [...documentFixtures, {
  ...documentFixtures.find((document) => document.group === "passport"),
  id: 110, name: "passport-portrait", extension: "jpg",
}];
const documentEndpoints = new Map(documentFixtures.map((document) => [`/api/v2/agent/ajax/${document.endpoint}`, document]));
const documentRequests = [];
const fileRequests = [];
let listingMode = "ok";
let fileMode = "ok";
let jpegBytes;

// An actual, tiny PDF with correct object offsets. No applicant files are read.
function syntheticPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  return Buffer.from(`${body}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
const pdfBytes = syntheticPdf();

function listingRows(document) {
  const row = {
    id: document.id, lead_id: 424242, document_type: document.documentType,
    name: document.name, file_extension: document.extension,
    file_url: `${mediaOrigin}/tmp_aws_media/${document.name}.${document.extension}`,
    file_download_url: `${mediaOrigin}/download-media/forbidden-token-download?token=${syntheticToken}`,
    added_by_data: { email: "must-not-cache@example.test" }, comment: "DO_NOT_CACHE_ROW_COMMENT",
    [`document_${document.group}`]: { internal_note: "DO_NOT_CACHE_NESTED_DOCUMENT" },
  };
  if (document.group === "passport") return [row, {
    ...row, id: 110, name: "passport-portrait", file_extension: "jpg",
    file_url: `${mediaOrigin}/tmp_aws_media/passport-portrait.jpg`,
  }];
  if (document.group !== "additional") return [row];
  return [row,
    { ...row, id: 201, name: "empty-file", file_url: "", file_extension: null },
    { ...row, id: 202, name: "foreign-lead", lead_id: 999999, file_url: `${mediaOrigin}/tmp_aws_media/foreign-lead.pdf` },
    { ...row, id: 203, name: "off-origin", file_url: "https://files.example.test/tmp_aws_media/off-origin.pdf" },
    { ...row, id: 204, name: "download-route", file_url: `${mediaOrigin}/download-media/download-route.pdf` },
    { ...row, id: 205, name: "query-url", file_url: `${mediaOrigin}/tmp_aws_media/query-url.pdf?token=forbidden` },
    { ...row, id: 206, name: "hash-url", file_url: `${mediaOrigin}/tmp_aws_media/hash-url.pdf#fragment` },
    { ...row, id: 207, name: "insecure-url", file_url: "http://app.samscrm.co.uk/tmp_aws_media/insecure-url.pdf" },
  ];
}
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
  await context.addCookies([{
    name: "sams_e2e_session", value: "synthetic-crm-session-only", domain: "app.samscrm.co.uk",
    path: "/", sameSite: "Lax", secure: true, httpOnly: true,
  }]);
  const fixtures = new Map([
    [crmUrl, "crm.html"], [documentCrmUrl, "crm-documents.html"],
    [greenwichCrmUrl, "crm-greenwich-regression.html"],
    [statisticalAfterSaveUrl, "greenwich-personal.html"], [statisticalUrl, "greenwich-personal.html"],
    [employmentUrl, "greenwich-employment.html"], [employmentAfterSaveUrl, "greenwich-employment.html"],
    [documentsPortalUrl, "portal-documents.html"], [documentsFrameUrl, "portal-documents-frame.html"],
    [noDocumentsUrl, "portal-no-documents.html"],
    ...portalCases.map((portal) => [portal.url, portal.fixture]),
  ]);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const document = url.origin === mediaOrigin && documentEndpoints.get(url.pathname);
    if (document && request.method() === "GET") {
      const headers = await request.allHeaders();
      documentRequests.push({
        path: url.pathname, query: url.search, method: request.method(),
        authorization: headers.authorization || "", requestedWith: headers["x-requested-with"] || "",
      });
      if (listingMode === "network") return route.abort("connectionfailed");
      if (listingMode === "unauthorized" || headers.authorization !== `Bearer ${syntheticToken}` ||
          headers["x-requested-with"] !== "XMLHttpRequest") {
        return route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"Unauthorized"}' });
      }
      if (url.search !== "?lead_id=424242") {
        return route.fulfill({ status: 400, contentType: "application/json", body: '{"msg":"Wrong lead"}' });
      }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        msg: "Synthetic documents only", data: { [document.dataKey]: listingRows(document) },
      }) });
    }
    const media = mediaFixtures.find((item) => url.href === `${mediaOrigin}/tmp_aws_media/${item.name}.${item.extension}`);
    if (media && request.method() === "GET") {
      const headers = await request.allHeaders();
      const cookiePresent = (headers.cookie || "").split("; ").includes(syntheticCookie);
      fileRequests.push({
        url: url.href, cookiePresent, authorizationPresent: !!headers.authorization,
        requestedWithPresent: !!headers["x-requested-with"],
      });
      if (!cookiePresent) return route.fulfill({ status: 401, contentType: "text/plain", body: "Login required" });
      if (fileMode === "html") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Login</title>Sign in" });
      if (fileMode === "redirect") return route.fulfill({ status: 302, headers: { location: `${mediaOrigin}/e2e-document-login` } });
      if (fileMode === "non-ok") return route.fulfill({ status: 403, contentType: "application/pdf", body: "Forbidden" });
      if (fileMode === "oversized") return route.fulfill({ contentType: "application/pdf", body: Buffer.alloc(10 * 1024 * 1024 + 1, 65) });
      return route.fulfill({ contentType: media.extension === "jpg" ? "image/jpeg" : "application/pdf",
        body: media.extension === "jpg" ? jpegBytes : pdfBytes });
    }
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
  const jpeg = await popup.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const drawing = canvas.getContext("2d");
    drawing.fillStyle = "#aabbcc";
    drawing.fillRect(0, 0, 1, 1);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  });
  jpegBytes = Buffer.from(jpeg, "base64");
}, { timeout: 30000 });

beforeEach(() => {
  listingMode = "ok";
  fileMode = "ok";
  documentRequests.length = 0;
  fileRequests.length = 0;
});

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
  assert.deepEqual(unexpectedRequests, [], "No request may escape the synthetic fixtures");
  assert.deepEqual(popupErrors, [], "The real popup must not throw");
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
async function copiedProfile() {
  // Autofill refreshes the session timer, but must not change the copied profile.
  const { expiresAt, lastActivityAt, ...profile } = await cache();
  return profile;
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

async function copyStudent(url = crmUrl) {
  const crm = await openPage(url);
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

test("Greenwich regression: Statistical Information fills DOB at the previous address-save URL", { timeout: 20000 }, async () => {
  const page = await openPage(statisticalAfterSaveUrl);
  await copyStudent(greenwichCrmUrl);
  const beforeCache = await copiedProfile();
  assert.equal(beforeCache.fields.dateOfBirth, "2001-04-15");
  assert.equal(beforeCache.fields.cvWorkStartDate, "2019-06-02");
  assert.equal(page.url(), statisticalAfterSaveUrl);
  assert.equal(await page.locator("form").getAttribute("action"), "/pls/prod/bwskaper.P_ProcAppPersonal");
  await activate(page);
  await popup.locator("#btnAutofill").click();
  await popup.locator("#statusArea .success").waitFor();
  assert.deepEqual(await page.locator("#bday_dd, #bday_mm, #bday_yyyy").evaluateAll((selects) => selects.map((select) => select.value)),
    ["15", "04", "2001"], "The form action identifies DOB even when the URL still names the previous save");
  const firstActivity = await page.evaluate(() => activity);
  assert.equal(firstActivity.submissions, 0);
  assert.equal(firstActivity.clicks, 0);
  assert.deepEqual([...firstActivity.changes].sort(), ["bday_dd", "bday_mm", "bday_yyyy", "ud60"]);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, "greenwich-statistical-after-save.png") });
  await popup.screenshot({ path: join(evidenceDir, "greenwich-statistical-popup.png") });
  await popup.locator("#btnAutofill").click();
  await popup.locator("#statusArea .success").waitFor();
  assert.deepEqual(await page.evaluate(() => activity), firstActivity, "Repeat Autofill preserves filled split dates");
  assert.deepEqual(await copiedProfile(), beforeCache, "DOB and nationality fallback must not rewrite the copied student");
});

for (const [screen, url] of [["display URL", employmentUrl], ["previous save URL", employmentAfterSaveUrl]]) {
  test(`Greenwich regression: Employment at ${screen} fills work dates, not DOB`, { timeout: 20000 }, async () => {
    const page = await openPage(url);
    await copyStudent(greenwichCrmUrl);
    assert.equal((await cache()).fields.cvWorkEndDate, "2023-07-03");
    await activate(page);
    await popup.locator("#btnAutofill").click();
    await popup.locator("#statusArea .success").waitFor();
    assert.deepEqual(await controlValues(page), {
      bday_dd: "02", bday_mm: "06", bday_yyyy: "2019",
      bday_dd2: "03", bday_mm2: "07", bday_yyyy2: "2023",
    });
    const firstActivity = await page.evaluate(() => activity);
    assert.equal(firstActivity.clicks, 0);
    assert.equal(firstActivity.submissions, 0);
    assert.deepEqual([...firstActivity.changes].sort(), ["bday_dd", "bday_dd2", "bday_mm", "bday_mm2", "bday_yyyy", "bday_yyyy2"]);
    await popup.locator("#btnAutofill").click();
    await popup.locator("#statusArea .success").waitFor();
    assert.deepEqual(await page.evaluate(() => activity), firstActivity);
  });
}

for (const existing of ["", "GB"]) {
  test(`Greenwich regression: nationality fills country of birth and preserves ${existing ? "an existing country" : "the copied student"}`, { timeout: 20000 }, async () => {
    const page = await openPage(statisticalUrl);
    if (existing) await page.locator("#ud60").selectOption(existing);
    await copyStudent(greenwichCrmUrl);
    const beforeCache = await copiedProfile();
    assert.equal(beforeCache.fields.nationality, "Angola");
    assert.equal(Object.hasOwn(beforeCache.fields, "countryOfBirth"), false, "The CRM supplies nationality only");
    const beforeChanges = (await page.evaluate(() => activity)).changes.length;
    await activate(page);
    await popup.locator("#btnAutofill").click();
    await popup.locator("#statusArea .success").waitFor();
    assert.equal(await page.locator("#ud60").inputValue(), existing || "AO");
    assert.equal(await page.locator("#ud60 option:checked").textContent(), existing ? "United Kingdom" : "Angola");
    const firstActivity = await page.evaluate(() => activity);
    assert.deepEqual(firstActivity.changes.slice(beforeChanges).sort(), existing
      ? ["bday_dd", "bday_mm", "bday_yyyy"] : ["bday_dd", "bday_mm", "bday_yyyy", "ud60"]);
    assert.equal(firstActivity.clicks, 0);
    assert.equal(firstActivity.submissions, 0);
    assert.deepEqual(await copiedProfile(), beforeCache, "Country-of-birth fallback is portal-only, never cached");
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: join(evidenceDir, `greenwich-country-${existing || "empty"}.png`) });
    await popup.locator("#btnAutofill").click();
    await popup.locator("#statusArea .success").waitFor();
    assert.deepEqual(await page.evaluate(() => activity), firstActivity);
    assert.deepEqual(await copiedProfile(), beforeCache);
  });
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
  await popup.locator("#copiedFields").evaluate((element) => { element.scrollTop = 0; });
  await emailRow.scrollIntoViewIfNeeded();
  await emailRow.getByRole("button", { name: "Copy Email" }).click();
  await emailRow.locator("button.copy[data-copied]").waitFor();
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
  await popup.locator("#btnAutofill").waitFor({ state: "visible" });
  assert.equal(await popup.locator("#btnAutofill").isEnabled(), true, "Autofill must be enabled after Copy");
  await worker.evaluate(async () => {
    const { studentCache } = await chrome.storage.session.get("studentCache");
    await chrome.storage.session.set({ studentCache: { ...studentCache, expiresAt: Date.now() - 1 } });
  });
  await popup.reload();
  await popup.locator("#btnAutofill:disabled").waitFor({ state: "attached" });
  assert.equal(await popup.locator("#btnAutofill").isDisabled(), true, "Autofill must be disabled after expiry");
  assert.equal(await popup.locator("#btnAutofill").isVisible(), false, "Autofill must be hidden after expiry");
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
      const bytes = Buffer.from(data, "base64");
      const path = join(evidenceDir, name);
      await writeFile(path, bytes);
      const css = await evaluate(`({width: innerWidth, height: innerHeight, dpr: devicePixelRatio})`);
      await writeFile(`${path}.json`, JSON.stringify({
        path, sha256: createHash("sha256").update(bytes).digest("hex"), captured_at: new Date().toISOString(),
        width_px: bytes.readUInt32BE(16), height_px: bytes.readUInt32BE(20), css,
        capture_id: path, source: "Helium real toolbar popup through CDP Page.captureScreenshot",
      }, null, 2));
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

for (const decision of ["denied", "granted", "error"]) {
  test(`On-demand website access: ${decision} requests only the selected HTTPS site without filling`, { timeout: 20000 }, async () => {
    const manifest = await popup.evaluate(() => chrome.runtime.getManifest());
    assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"], "New university hosts must be optional, never globally granted");
    assert.ok(!manifest.host_permissions.some((host) => host === "<all_urls>" || host === "https://*/*"));
    const page = await openPage(`${genericOrigin}/apply/personal`);
    await page.waitForLoadState("load");
    const before = await controlValues(page);
    const toolbar = await openToolbarPopup(page);
    try {
      await toolbar.waitFor(`document.getElementById("btnSiteAccess") && !document.getElementById("btnSiteAccess").hidden`);
      const hint = await toolbar.evaluate(`document.getElementById("siteAccessHint").textContent`);
      assert.ok(hint.includes(new URL(genericOrigin).hostname));
      await toolbar.waitFor(`innerWidth === 390 && innerHeight > 0 && innerHeight <= 600`);
      assert.equal(await toolbar.evaluate(`(() => {
        const button = document.getElementById("btnSiteAccess");
        const rect = button.getBoundingClientRect();
        return !button.hidden && !button.disabled && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
      })()`), true, "Website access must be reachable without expanding details or scrolling");
      await toolbar.screenshot(`site-access-${decision}-before.png`);
      // Only the native browser's permission decision is controlled; all extension code is real.
      await toolbar.evaluate(`(() => {
        const contains = chrome.permissions.contains.bind(chrome.permissions);
        let granted = false;
        globalThis.sitePermissionRequests = [];
        chrome.permissions.contains = (request) => granted && request.origins?.[0] === ${JSON.stringify(`${genericOrigin}/*`)}
          ? Promise.resolve(true) : contains(request);
        chrome.permissions.request = async (request) => {
          sitePermissionRequests.push({ request, userActivation: navigator.userActivation.isActive });
          if (${JSON.stringify(decision)} === "error") throw new Error("Synthetic browser permission failure");
          granted = ${JSON.stringify(decision)} === "granted";
          return granted;
        };
        document.getElementById("btnSiteAccess").click();
      })()`);
      await toolbar.waitFor(`document.querySelector("#statusArea .${decision === "granted" ? "success" : "error"}")`);
      assert.deepEqual(await toolbar.evaluate(`sitePermissionRequests`), [{
        request: { origins: [`${genericOrigin}/*`] }, userActivation: true,
      }]);
      if (decision === "granted") {
        await toolbar.waitFor(`document.getElementById("btnSiteAccess").hidden`);
      } else {
        await toolbar.waitFor(`!document.getElementById("btnSiteAccess").disabled`);
        assert.equal(await toolbar.evaluate(`document.getElementById("btnSiteAccess").hidden`), false);
      }
      assert.deepEqual(await controlValues(page), before, "A permission decision must not fill any field");
      assert.deepEqual((await page.evaluate(() => activity)).changes, []);
      assert.equal((await page.evaluate(() => activity)).submissions, 0);
      assert.equal(await cache(), null, "Site permission must never copy a student");
      assert.deepEqual(await toolbar.evaluate(`chrome.permissions.contains({origins:["https://unselected-university.test/*"]})`), false);
      assert.deepEqual(toolbar.errors, []);
      await toolbar.evaluate(`document.getElementById("statusArea").scrollIntoView({block:"end"})`);
      await toolbar.screenshot(`site-access-${decision}-after.png`);
    } finally {
      await toolbar.close();
    }
  });
}

test("On-demand website access is hidden on CRM and browser pages", { timeout: 10000 }, async () => {
  const crm = await openPage(crmUrl);
  await activate(crm);
  await popup.reload();
  assert.equal(await popup.locator("#btnSiteAccess").count(), 1);
  assert.equal(await popup.locator("#btnSiteAccess").isVisible(), false);
  const browserPage = await context.newPage();
  await browserPage.goto("about:blank");
  await activate(browserPage);
  await popup.reload();
  assert.equal(await popup.locator("#btnSiteAccess").isVisible(), false);
});

test("On-demand website access discards stale checks after the selected portal changes", { timeout: 10000 }, async () => {
  const bangor = await openPage(portalCases[0].url);
  await activate(bangor);
  await popup.evaluate(() => {
    globalThis.originalPermissionsContains = chrome.permissions.contains;
    globalThis.originalPermissionsRequest = chrome.permissions.request;
    globalThis.permissionLookups = {};
    globalThis.permissionRequests = [];
    chrome.permissions.contains = ({ origins }) => new Promise((resolve) => {
      (permissionLookups[origins[0]] ||= []).push(resolve);
    });
    chrome.permissions.request = async (request) => { permissionRequests.push(request); return false; };
    window.dispatchEvent(new Event("focus"));
  });
  try {
    await popup.waitForFunction(() => permissionLookups["https://apps.bangor.ac.uk/*"]?.length);
    const greenwich = await openPage(portalCases[1].url);
    await activate(greenwich);
    await popup.evaluate(() => window.dispatchEvent(new Event("focus")));
    await popup.waitForFunction(() => permissionLookups["https://nelson.gre.ac.uk/*"]?.length);
    await popup.evaluate(() => permissionLookups["https://nelson.gre.ac.uk/*"].forEach((resolve) => resolve(false)));
    await popup.locator("#btnSiteAccess:visible").waitFor();
    await popup.evaluate(() => permissionLookups["https://apps.bangor.ac.uk/*"].forEach((resolve) => resolve(false)));
    assert.match(await popup.locator("#siteAccessHint").innerText(), /nelson\.gre\.ac\.uk/);
    assert.doesNotMatch(await popup.locator("#siteAccessHint").innerText(), /apps\.bangor\.ac\.uk/);
    await popup.locator("#btnSiteAccess").click();
    await popup.locator("#statusArea .error").waitFor();
    assert.deepEqual(await popup.evaluate(() => permissionRequests), [{ origins: ["https://nelson.gre.ac.uk/*"] }]);
    assert.deepEqual((await bangor.evaluate(() => activity)).changes, []);
    assert.deepEqual((await greenwich.evaluate(() => activity)).changes, []);
  } finally {
    await popup.evaluate(() => {
      chrome.permissions.contains = originalPermissionsContains;
      chrome.permissions.request = originalPermissionsRequest;
      Object.values(permissionLookups).flat().forEach((resolve) => resolve(false));
    });
  }
});

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
    const failedFrames = await toolbar.evaluate(`(() => {
      const details = document.querySelector("#statusArea details");
      return {
        title: details.querySelector(".summary-title").textContent,
        count: details.querySelector(".summary-count").textContent,
        rows: [...details.querySelectorAll("li")].map((row) => row.textContent),
      };
    })()`);
    assert.equal(failedFrames.title, "Frames not filled");
    assert.equal(failedFrames.count, "1");
    assert.equal(failedFrames.rows.length, 1);
    assert.match(failedFrames.rows[0],
      /^Frame \d+: Could not access this page\. Allow SAMS Portal Autofill to access this website, reload the page, and try again\.$/);
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

async function copyDocumentStudent({ missingToken = false } = {}) {
  await clear();
  const crm = await openPage(documentCrmUrl);
  if (missingToken) await crm.locator('meta[name="api-token"]').evaluate((meta) => meta.remove());
  await activate(crm);
  await popup.locator("#btnCopy").click();
  await popup.locator("#statusArea .success").waitFor();
  assert.equal(await popup.locator("#studentName").textContent(), "Aisha Rahman");
  const student = await cache();
  assert.equal(student.sourceOrigin, "https://app.samscrm.co.uk");
  assert.equal(student.fields.email, "aisha.rahman@example.com", "Listing documents must not replace normal field Copy");
  return crm;
}

async function storageSnapshot() {
  return worker.evaluate(async () => ({
    local: await chrome.storage.local.get(null),
    sync: await chrome.storage.sync.get(null),
    session: await chrome.storage.session.get(null),
  }));
}

async function assertDocumentStorage(documents) {
  const storage = await storageSnapshot();
  assert.deepEqual(storage.local, {});
  assert.deepEqual(storage.sync, {});
  assert.deepEqual(Object.keys(storage.session), ["studentCache"]);
  assert.deepEqual(storage.session.studentCache.documents, documents);
  const serialized = JSON.stringify(storage.session);
  for (const forbidden of [syntheticToken, "Bearer ", "file_download_url", "download-media", "added_by_data",
    "DO_NOT_CACHE_ROW_COMMENT", "DO_NOT_CACHE_NESTED_DOCUMENT", "must-not-cache@example.test",
    "%PDF-1.4", pdfBytes.toString("base64"), jpegBytes.toString("base64"), '"bytes"', '"base64"']) {
    assert.equal(serialized.includes(forbidden), false, `Session storage must not contain ${forbidden.slice(0, 48)}`);
  }
}

function uploadRow(label) {
  return popup.locator("#documentsCard .upload-row").filter({
    has: popup.locator(".upload-label", { hasText: new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) }),
  });
}

// The attach control is a shadcn-style listbox (button + [role=option] panel), not a native select.
async function chooseDocument(row, document) {
  await row.locator("button.upload-choice").click();
  await row.locator(`[role='option'][data-value="${document.key.replace(/["\\]/g, "\\$&")}"]`).click();
}

async function scanDocuments(page) {
  await page.waitForLoadState("load");
  await activate(page);
  assert.equal(await popup.locator("#btnDocuments").count(), 1, "The popup must expose the Attach CRM documents action");
  await popup.locator("#btnDocuments:visible").waitFor();
  assert.equal((await popup.locator("#btnDocuments").innerText()).trim(), "Attach CRM documents");
  await popup.locator("#btnDocuments").click();
  await popup.locator("#documentsCard:visible").waitFor();
  await uploadRow("Frame evidence").waitFor();
}

async function fileState(frame) {
  return frame.evaluate(async () => Promise.all([...document.querySelectorAll('input[type="file"]')].map(async (input) => ({
    id: input.id,
    files: await Promise.all([...input.files].map(async (file) => ({
      name: file.name, type: file.type, size: file.size,
      sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
        .map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    }))),
  }))));
}

function expectedFile(name, type, bytes) {
  return { name, type, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

const emptyTopFiles = [
  { id: "passport-upload", files: [] }, { id: "transcript-upload", files: [] },
  { id: "cv-upload", files: [] }, { id: "other-upload", files: [] },
];
const emptyFrameFiles = [{ id: "frame-upload", files: [] }];
const noDocumentActivity = { clicks: 0, submissions: 0, inputs: [], changes: [] };
const documentFrame = (page) => page.frames().find((frame) => frame.url() === documentsFrameUrl);

async function assertNoAttachment(page) {
  assert.deepEqual(await fileState(page), emptyTopFiles);
  assert.deepEqual(await fileState(documentFrame(page)), emptyFrameFiles);
  assert.deepEqual(await page.evaluate(() => activity), noDocumentActivity);
  assert.deepEqual(await documentFrame(page).evaluate(() => activity), noDocumentActivity);
}

test("CRM documents: Copy caches only valid metadata from all nine authenticated listings", { timeout: 20000 }, async () => {
  await copyDocumentStudent();
  const student = await cache();
  assert.ok(Array.isArray(student.documents), "Copy must cache documents as an array of metadata");
  assert.equal(student.documents.length, 10, "All valid rows must be kept; empty, foreign-lead, off-origin, download, query, hash, and insecure rows must be excluded");
  const expected = mediaFixtures.map(({ group, groupLabel, documentType, name, extension }) => ({
    group, groupLabel, documentType, name, extension, url: `${mediaOrigin}/tmp_aws_media/${name}.${extension}`,
  }));
  const byName = (a, b) => a.name.localeCompare(b.name);
  assert.deepEqual(student.documents.map(({ key, ...metadata }) => metadata).sort(byName), expected.sort(byName));
  for (const document of student.documents) {
    assert.deepEqual(Object.keys(document).sort(), ["documentType", "extension", "group", "groupLabel", "key", "name", "url"]);
    assert.equal(typeof document.key, "string");
    assert.notEqual(document.key.trim(), "");
  }
  assert.equal(new Set(student.documents.map((document) => document.key)).size, 10, "Selection keys must identify distinct documents, including two from one group");
  assert.equal(documentRequests.length, 9);
  assert.deepEqual(documentRequests.map((request) => request.path).sort(), [...documentEndpoints.keys()].sort());
  for (const request of documentRequests) {
    assert.deepEqual(request, {
      path: request.path, query: "?lead_id=424242", method: "GET",
      authorization: `Bearer ${syntheticToken}`, requestedWith: "XMLHttpRequest",
    });
  }
  assert.doesNotMatch(JSON.stringify(student.fields), /tmp_aws_media|file_url|document_type|DO_NOT_CACHE|download-media/);
  for (const document of student.documents) assert.equal(JSON.stringify(student.fields).includes(document.name), false);
  await assertDocumentStorage(student.documents);
  assert.deepEqual(fileRequests, [], "Copy lists metadata only; it must not download file bytes");
  await popup.locator("#btnDocuments:visible").waitFor();
  assert.equal((await popup.locator("#copiedDocumentsSummary").innerText()).trim(), "Copied documents (10)");
  assert.deepEqual((await popup.locator("#copiedDocumentsList .document-name").allTextContents()).sort(),
    student.documents.map((document) => `${document.name}.${document.extension}`).sort(),
    "Every copied document must be listed by file name so staff can check it before attaching");
  assert.equal(await popup.locator("#copiedDocumentsList button.view").count(), 10,
    "Each copied document must offer a View action");
  await clear();
  assert.equal(await popup.locator("#btnDocuments").isVisible(), false);
  assert.deepEqual(await storageSnapshot(), { local: {}, sync: {}, session: {} });
});

for (const failure of ["missing-token", "unauthorized", "network"]) {
  test(`CRM documents: ${failure} leaves field Copy working and attachment unavailable`, { timeout: 20000 }, async () => {
    listingMode = failure;
    await copyDocumentStudent({ missingToken: failure === "missing-token" });
    const student = await cache();
    assert.deepEqual(student.documents, [], "A failed listing must produce an explicit empty documents array");
    assert.equal(student.fields.email, "aisha.rahman@example.com");
    assert.equal(await popup.locator("#btnAutofill").isEnabled(), true);
    assert.equal(await popup.locator("#btnDocuments").isVisible(), false);
    assert.deepEqual(fileRequests, []);
    await assertDocumentStorage([]);
  });
}

test("CRM documents: accept-filtered choices attach exact PDF and JPEG bytes to only the chosen frame input", { timeout: 30000 }, async () => {
  const page = await openPage(documentsPortalUrl);
  await copyDocumentStudent();
  const { documents } = await cache();
  await scanDocuments(page);
  assert.deepEqual((await popup.locator("#documentsCard .upload-label").allTextContents()).map((text) => text.trim()).sort(),
    ["Passport", "Education transcript", "Curriculum Vitae (CV)", "Other evidence", "Frame evidence"].sort());
  assert.equal(await popup.locator("#documentsCard .upload-row").count(), 5);
  const accepts = [
    ["Passport", ["cv-profile", "academic-record", "employment-letter", "english-score", "referee-letter", "previous-visa", "refusal-letter", "identity-page", "portrait", "passport-portrait"]],
    ["Education transcript", ["cv-profile", "academic-record", "employment-letter", "referee-letter", "refusal-letter", "identity-page"]],
    ["Curriculum Vitae (CV)", []],
    ["Other evidence", ["cv-profile", "academic-record", "employment-letter", "english-score", "referee-letter", "previous-visa", "refusal-letter", "identity-page", "portrait", "passport-portrait"]],
    ["Frame evidence", ["english-score", "previous-visa", "portrait", "passport-portrait"]],
  ];
  for (const [label, names] of accepts) {
    const row = uploadRow(label);
    const trigger = row.locator("button.upload-choice");
    assert.equal(await trigger.getAttribute("data-value"), null, `${label}: nothing may be preselected`);
    assert.match(await trigger.innerText(), /Choose a CRM document/, `${label}: placeholder must show until staff choose`);
    const options = await row.locator("[role='option']").evaluateAll((nodes) => nodes.map((node) => ({ value: node.getAttribute("data-value"), text: node.textContent })));
    assert.deepEqual(options.map((option) => option.value).sort(),
      documents.filter((document) => names.includes(document.name)).map((document) => document.key).sort(), `${label}: accept filtering`);
    for (const document of documents.filter((document) => names.includes(document.name))) {
      const option = options.find((item) => item.value === document.key);
      assert.ok(option.text.includes(document.groupLabel), `${label}: group label must be visible`);
      assert.ok(option.text.includes(`${document.name}.${document.extension}`), `${label}: filename must be visible`);
    }
    assert.equal(await trigger.isDisabled(), names.length === 0);
    if (!names.length) assert.equal(await row.locator("button.attach").isDisabled(), true);
  }
  assert.match(await uploadRow("Curriculum Vitae (CV)").locator(".upload-status").innerText(), /No CRM document matches/i);
  const passport = documents.find((document) => document.name === "identity-page");
  const transcript = documents.find((document) => document.name === "academic-record");
  assert.match(await uploadRow("Passport").locator("[role='option']").filter({ hasText: "identity-page.pdf" }).innerText(), /\(suggested\)/);
  assert.match(await uploadRow("Education transcript").locator("[role='option']").filter({ hasText: "academic-record.pdf" }).innerText(), /\(suggested\)/);
  assert.notEqual(passport.key, transcript.key);
  await assertNoAttachment(page);
  assert.deepEqual(fileRequests, [], "Scanning and choosing must not eagerly download documents");

  const passportRow = uploadRow("Passport");
  await chooseDocument(passportRow, passport);
  assert.deepEqual(fileRequests, [], "Selection alone must not fetch bytes");
  await passportRow.getByRole("button", { name: "Attach", exact: true }).click();
  await passportRow.locator(".upload-status").filter({ hasText: /Attached/ }).waitFor();
  const passportFiles = [{ id: "passport-upload", files: [expectedFile("identity-page.pdf", "application/pdf", pdfBytes)] }, ...emptyTopFiles.slice(1)];
  assert.deepEqual(await fileState(page), passportFiles, "The page must receive the exact served PDF as one real File");
  assert.deepEqual(await fileState(documentFrame(page)), emptyFrameFiles);
  assert.deepEqual(await page.evaluate(() => activity), { clicks: 0, submissions: 0, inputs: ["passport-upload"], changes: ["passport-upload"] });
  assert.deepEqual(await documentFrame(page).evaluate(() => activity), noDocumentActivity);
  assert.equal(fileRequests.length, 1);
  assert.equal(fileRequests[0].url, `${mediaOrigin}/tmp_aws_media/identity-page.pdf`);
  assert.equal(fileRequests[0].cookiePresent, true, "A credentials-bearing fetch must work behind CRM session login");

  const frameRow = uploadRow("Frame evidence");
  await chooseDocument(frameRow, documents.find((document) => document.name === "portrait"));
  await frameRow.getByRole("button", { name: "Attach", exact: true }).click();
  await frameRow.locator(".upload-status").filter({ hasText: /Attached/ }).waitFor();
  assert.deepEqual(await fileState(documentFrame(page)), [{ id: "frame-upload", files: [expectedFile("portrait.jpg", "image/jpeg", jpegBytes)] }]);
  assert.deepEqual(await fileState(page), passportFiles, "Attaching inside a frame must not change any top-level input");
  assert.deepEqual(await documentFrame(page).evaluate(() => activity), { clicks: 0, submissions: 0, inputs: ["frame-upload"], changes: ["frame-upload"] });
  assert.deepEqual(await page.evaluate(() => activity), { clicks: 0, submissions: 0, inputs: ["passport-upload"], changes: ["passport-upload"] });
  assert.equal(fileRequests.length, 2);
  assert.equal(fileRequests[1].url, `${mediaOrigin}/tmp_aws_media/portrait.jpg`);
  assert.equal(fileRequests[1].cookiePresent, true);
  await assertDocumentStorage(documents);
});

test("CRM documents: occupied file input is disabled without fetching or replacing its file", { timeout: 20000 }, async () => {
  const page = await openPage(documentsPortalUrl);
  await page.locator("#passport-upload").evaluate((input) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["existing synthetic upload"], "existing.pdf", { type: "application/pdf" }));
    input.files = transfer.files;
  });
  const beforeFiles = await fileState(page);
  await copyDocumentStudent();
  await scanDocuments(page);
  const row = uploadRow("Passport");
  assert.equal(await row.locator("button.upload-choice").isDisabled(), true);
  assert.equal(await row.locator("button.attach").isDisabled(), true);
  assert.match(await row.locator(".upload-status").innerText(), /already has a file/i);
  assert.equal(await uploadRow("Education transcript").locator("button.upload-choice").isEnabled(), true);
  assert.deepEqual(await fileState(page), beforeFiles);
  assert.deepEqual(await fileState(documentFrame(page)), emptyFrameFiles);
  assert.deepEqual(await page.evaluate(() => activity), noDocumentActivity);
  assert.deepEqual(fileRequests, []);
});

for (const failure of ["html", "redirect", "non-ok", "oversized"]) {
  test(`CRM documents: ${failure} file response fails without attaching or submitting`, { timeout: 20000 }, async () => {
    const page = await openPage(documentsPortalUrl);
    await copyDocumentStudent();
    await scanDocuments(page);
    const { documents } = await cache();
    const row = uploadRow("Passport");
    await chooseDocument(row, documents.find((document) => document.name === "identity-page"));
    fileMode = failure;
    await row.getByRole("button", { name: "Attach", exact: true }).click();
    await row.locator(".upload-status").filter({ hasText: /error|failed|could not|cannot|unable|reject|too large|10\s*Mi?B|sign.?in|log.?in|html|redirect|403/i }).waitFor();
    assert.doesNotMatch(await row.locator(".upload-status").innerText(), /Attached/);
    assert.equal(fileRequests.length, 1, "Only the selected cached media URL may be requested");
    assert.equal(fileRequests[0].cookiePresent, true, "The tested failure must not be an accidental missing-session 401");
    assert.equal(fileRequests[0].url, `${mediaOrigin}/tmp_aws_media/identity-page.pdf`);
    assert.deepEqual(unexpectedRequests, [], "A redirect must not be followed, even to the CRM origin");
    await assertNoAttachment(page);
    await assertDocumentStorage(documents);
  });
}

test("CRM documents: Clear in another popup wins over a scanned selection", { timeout: 20000 }, async () => {
  const page = await openPage(documentsPortalUrl);
  await copyDocumentStudent();
  await scanDocuments(page);
  const { documents } = await cache();
  const row = uploadRow("Passport");
  await chooseDocument(row, documents.find((document) => document.name === "identity-page"));
  const other = await context.newPage();
  await other.goto(`chrome-extension://${extensionId}/popup.html`);
  await other.locator("#studentCard").waitFor();
  await other.locator("#btnClear").click();
  await other.locator("#studentCard").waitFor({ state: "hidden" });
  await other.close();
  assert.equal(await cache(), null);
  await activate(page);
  await row.getByRole("button", { name: "Attach", exact: true }).click();
  // A stale-cache error may be shown at action level if refreshing also removes the rows.
  await popup.locator("#statusArea .error, #documentsCard .upload-status").filter({
    hasText: /no copied student|no.*document|clear|expired|copy.*again|unavailable/i,
  }).first().waitFor();
  assert.deepEqual(fileRequests, [], "The worker cache must be re-read before any file request");
  await assertNoAttachment(page);
  assert.equal(await popup.locator("#btnDocuments").isVisible(), false);
  assert.deepEqual(await storageSnapshot(), { local: {}, sync: {}, session: {} });
});

test("CRM documents: ordinary Autofill fills a normal field but never file inputs", { timeout: 20000 }, async () => {
  const page = await openPage(documentsPortalUrl);
  await copyDocumentStudent();
  await page.waitForLoadState("load");
  await activate(page);
  await popup.locator("#btnAutofill").click();
  await popup.locator("#statusArea .success").waitFor();
  assert.equal(await page.locator("#id_forename").inputValue(), "Aisha");
  assert.deepEqual(await fileState(page), emptyTopFiles);
  assert.deepEqual(await fileState(documentFrame(page)), emptyFrameFiles);
  assert.deepEqual(await page.evaluate(() => activity), { clicks: 0, submissions: 0, inputs: ["id_forename"], changes: ["id_forename"] });
  assert.deepEqual(await documentFrame(page).evaluate(() => activity), noDocumentActivity);
  assert.deepEqual(fileRequests, []);
});

test("CRM documents: scanning a page without uploads reports no file upload fields", { timeout: 20000 }, async () => {
  const page = await openPage(noDocumentsUrl);
  await copyDocumentStudent();
  await activate(page);
  assert.equal(await popup.locator("#btnDocuments").count(), 1, "The popup must expose the Attach CRM documents action");
  await popup.locator("#btnDocuments:visible").waitFor();
  await popup.locator("#btnDocuments").click();
  await popup.locator("#statusArea").filter({ hasText: /No file upload fields/ }).waitFor();
  assert.equal(await page.locator("#id_forename").inputValue(), "", "Scanning must not Autofill normal fields");
  assert.deepEqual(fileRequests, []);
});

test("CRM documents: session expiry removes document metadata and hides the attach action", { timeout: 15000 }, async () => {
  await copyDocumentStudent();
  assert.equal(await popup.locator("#btnDocuments").count(), 1, "The popup must expose the Attach CRM documents action");
  await popup.locator("#btnDocuments:visible").waitFor();
  await worker.evaluate(async () => {
    const { studentCache } = await chrome.storage.session.get("studentCache");
    await chrome.storage.session.set({ studentCache: { ...studentCache, expiresAt: Date.now() - 1 } });
  });
  await popup.reload();
  await popup.locator("#studentCard").waitFor({ state: "hidden" });
  assert.equal(await cache(), null);
  assert.equal(await popup.locator("#btnDocuments").isVisible(), false);
  assert.deepEqual(await storageSnapshot(), { local: {}, sync: {}, session: {} });
});
