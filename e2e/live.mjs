import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile, realpath } from "node:fs/promises";
import { join, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomInt } from "node:crypto";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const leadsFile = process.env.SAMS_E2E_LEADS_FILE;
// The one approved save: Bangor Personal on the existing draft, which unlocks Programme. Never submit.
const saveBangorPersonal = args.includes("--save-bangor-personal-once");
let personalSaveArmed = false;
if (!args.includes("--no-save") || !(args.includes("--random-leads") || leadsFile) || !process.env.SAMS_E2E_PROFILE) {
  console.error("Live testing requires --no-save, --random-leads or SAMS_E2E_LEADS_FILE, and SAMS_E2E_PROFILE pointing to an approved, stopped PinchTab automation profile.");
  process.exit(2);
}
process.loadEnvFile(join(root, ".env.local"));
const profile = await realpath(process.env.SAMS_E2E_PROFILE);
const profileRoot = await realpath(join(process.env.HOME, ".pinchtab/profiles"));
assert.ok(profile.startsWith(profileRoot + sep), "Use an approved PinchTab automation profile, not a normal browser profile");
const sampleCount = Number(process.env.SAMS_E2E_SAMPLE_COUNT || 3);
assert.ok(Number.isInteger(sampleCount) && sampleCount >= 1 && sampleCount <= 3, "Sample count must be 1 to 3");
const require = createRequire(import.meta.url);
const crmSource = require(join(root, "config/crm-source.js"));
require(join(root, "config/portals/bangor.js"));
require(join(root, "config/portals/greenwich.js"));
require(join(root, "config/portals/manchester.js"));
const crmMode = process.env.SAMS_E2E_CRM || "sams";
assert.ok(["sams", "campora"].includes(crmMode), "SAMS_E2E_CRM must be sams or campora");
const crmConfig = crmMode === "campora" ? {
  id: "campora",
  origin: "https://v-sams-backend.samsapply.co.uk",
  loginUrl: "https://v-sams-backend.samsapply.co.uk/",
  username: "CAMPORA_USERNAME",
  password: "CAMPORA_PASSWORD",
  submit: "Sign in",
  markers: crmSource.camporaProfileMarkers,
  pathPatterns: crmSource.camporaProfilePathPatterns,
  sourceOrigin: "https://v-sams-backend.samsapply.co.uk",
} : {
  id: "sams",
  origin: "https://app.samscrm.co.uk",
  loginUrl: "https://app.samscrm.co.uk/",
  username: "SAMS_CRM_USERNAME",
  password: "SAMS_CRM_PASSWORD",
  submit: "Sign in",
  markers: crmSource.profileMarkers,
  pathPatterns: crmSource.profilePathPatterns,
  sourceOrigin: "https://app.samscrm.co.uk",
};
const portals = [
  { id: "bangor", origin: "https://apps.bangor.ac.uk", login: "https://apps.bangor.ac.uk/apply/account/login/?next=/apply/personal/",
    forms: [
      { name: "personal", url: "https://apps.bangor.ac.uk/apply/personal/" },
      { name: "additional-information", url: "https://apps.bangor.ac.uk/apply/additionalinfo/" },
      { name: "contact-details", url: "https://apps.bangor.ac.uk/apply/contacts/" },
      { name: "education", url: "https://apps.bangor.ac.uk/apply/education/form/" },
      { name: "employment", url: "https://apps.bangor.ac.uk/apply/employment/" },
      { name: "language", url: "https://apps.bangor.ac.uk/apply/language/form/" },
      { name: "finance", url: "https://apps.bangor.ac.uk/apply/finance/" },
    ], username: "BANGOR_USERNAME", password: "BANGOR_PASSWORD", submit: "Log In" },
  { id: "greenwich", origin: "https://nelson.gre.ac.uk", login: "https://nelson.gre.ac.uk/pls/prod/bwskalog.P_DispLoginNon",
    forms: [
      ["name", "bwskanam.P_DispAppName?appno=1&wsct=NAME"],
      ["employment-supporting-info", "bwskaess.P_DispAppEssay?appno=1&wsct=ESSAY"],
      ["permanent-address", "bwskaadr.P_DispAppAddr1?appno=1&wsct=ADDR1"],
      ["referee-details", "bwskaudf.P_DispAppUserDef?appno=1&wsct=ADDITIONAL"],
      ["mailing-address", "bwskaadr.P_DispAppAddr2?appno=1&wsct=ADDR2"],
      ["qualifications", "bwskapcl.P_DispQuals?appno=1&wsct=QUALS"],
      ["statistical-information", "bwskaper.P_DispAppPersonal?appno=1&wsct=PERSONAL"],
      ["previous-education", "bwskapcl.P_DispAppPrvCollege?appno=1&wsct=PRVCOLLEGE"],
      ["programme-information", "bwskapln.P_DispAppPlan?appno=1&wsct=PLAN"],
    ].map(([name, path]) => ({ name, url: `https://nelson.gre.ac.uk/pls/prod/${path}` })), username: "GREENWICH_LOGINID", password: "GREENWICH_PIN", submit: "Login" },
  { id: "greater-manchester", origin: "https://evision.bolton.ac.uk",
    login: "https://evision.bolton.ac.uk/urd/sits.urd/run/siw_ipp_lgn.login?process=siw_ipp_app&code1=0994-D&code2=0010",
    forms: [
      { name: "personal-details", kind: "tab", tab: "PD", control: "#IPR_FNM1" },
      { name: "contact-details", kind: "tab", tab: "CD", control: "#IPR_CODC" },
      { name: "qualifications", kind: "tab", tab: "QU", control: "#IPQ_OA_QUINS1" },
      { name: "experience", kind: "tab", tab: "EX", control: "#IPQ_OA_CREMP" },
    ], username: "GREATER_MANCHESTER_USERNAME", password: "GREATER_MANCHESTER_PASSWORD", submit: /^log\s*in$/i },
];
const report = { mode: "live-no-save", requestedSamples: sampleCount, crm: {},
  portals: portals.filter((portal) => !process.env[portal.username] || !process.env[portal.password])
    .map((portal) => ({ portal: portal.id, status: "blocked", reason: "credential-keys-missing" })),
  blockedWriteAttempts: 0, blockedWriteStages: [], loginDiagnostics: [] };
await mkdir(join(root, "tmp"), { recursive: true });
await mkdir(join(root, "tmp/extension-e2e"), { recursive: true, mode: 0o700 });
const run = await mkdtemp(join(root, "tmp/live-e2e-"));
const extension = join(run, "extension");
await mkdir(extension);
for (const path of ["config", "src", "popup.html", "popup.js", "sams-logo.svg", "icon16.png", "icon48.png", "icon128.png"]) {
  await cp(join(root, path), join(extension, path), { recursive: true });
}
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
manifest.host_permissions = [`${crmConfig.origin}/*`, ...portals.map((portal) => `${portal.origin}/*`)];
await writeFile(join(extension, "manifest.json"), JSON.stringify(manifest));
await writeFile(join(extension, "config/build-mode.js"), 'globalThis.SAMS_BUILD_MODE = "prod";\n');
let context;
let stage = "launch";
let loginOrigin = null;
let loginPath = null;
let tabLoad = null;
let deadline;
function armDeadline() {
  clearTimeout(deadline);
  deadline = setTimeout(() => {
    report.failure = { stage, type: "TimeoutError", message: "Live test exceeded its 10-minute deadline" };
    process.exitCode = 1;
    if (context) context.close().catch(() => {});
  }, 600000);
  deadline.unref();
}
armDeadline();
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.SAMS_E2E_BROWSER || "/Applications/Helium.app/Contents/MacOS/Helium",
    channel: "chromium", headless: false, ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`], timeout: 15000,
  });
  context.setDefaultTimeout(10000);
  // Live CRM and portal pages measured 2 to 6.4 seconds to load, so 10 seconds flaked.
  context.setDefaultNavigationTimeout(30000);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const authPost = request.method() === "POST" && url.origin === loginOrigin && url.pathname === loginPath;
    const captchaPost = request.method() === "POST" && stage.endsWith("-login") &&
      ["https://www.google.com", "https://www.recaptcha.net"].includes(url.origin) && url.pathname.startsWith("/recaptcha/");
    const personalSave = personalSaveArmed && request.method() === "POST" && url.origin === "https://apps.bangor.ac.uk" && url.pathname === "/apply/personal/";
    if (personalSave) {
      personalSaveArmed = false;
      report.personalSavePosted = true;
    }
    if (["GET", "HEAD"].includes(request.method()) || authPost || captchaPost || personalSave) await route.continue();
    else {
      report.blockedWriteAttempts++;
      const blockedTabLoad = tabLoad && url.origin === tabLoad.origin;
      // Keep only the SITS routine path, never query parameters or record-specific suffixes.
      const sitsPath = blockedTabLoad && url.pathname.match(/^(\/urd\/sits\.urd\/run\/siw_[a-z_.]+)(\/.*)?$/i);
      report.blockedWriteStages.push({ stage, method: request.method(),
        path: stage.endsWith("-login") ? url.pathname : sitsPath ? sitsPath[1] + (sitsPath[2] ? "/[redacted]" : "") : "[redacted]",
        ...(blockedTabLoad ? { tabLoadBlocked: true, tab: tabLoad.tab } : {}) });
      await route.abort();
    }
  });
  const worker = context.serviceWorkers().find((candidate) => candidate.url().endsWith("/src/background.js")) ||
    await context.waitForEvent("serviceworker", { predicate: (candidate) => candidate.url().endsWith("/src/background.js"), timeout: 10000 });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);

  async function login(page, origin, userKey, passwordKey, submit) {
    assert.equal(new URL(page.url()).origin, origin);
    if (!(await page.locator("input[type='password']").count())) return;
    assert.ok(process.env[userKey] && process.env[passwordKey], "Credential keys are missing");
    const username = page.locator("input[type='email'], input[name='in_id'], #login_id, #floatingInput, input[placeholder='name@example.com'], #MUA_CODE, input[name='MUA_CODE.DUMMY.MENSYS.1']").first();
    const password = page.locator("input[type='password']").first();
    const formAction = await username.evaluate((element) => element.form?.action);
    assert.ok(formAction, "The login form must declare an action");
    assert.equal(new URL(formAction).origin, origin, "Unexpected login form action origin");
    loginOrigin = origin;
    loginPath = new URL(formAction).pathname;
    try {
      await username.fill(process.env[userKey]);
      await password.fill(process.env[passwordKey]);
      const loginUrl = page.url();
      const submitted = (timeout) => page.waitForURL((url) => url.origin === origin && url.href !== loginUrl, { waitUntil: "commit", timeout });
      const captcha = page.locator("iframe[src*='recaptcha'], .g-recaptcha");
      if (await captcha.count()) {
        clearTimeout(deadline);
        await page.bringToFront();
        report.humanVerification = { stage, status: "waiting" };
        console.error(`${stage}: complete the CAPTCHA and press ${submit} in the open browser window within 5 minutes.`);
        await submitted(300000);
        report.humanVerification.status = "submitted";
        armDeadline();
      } else {
        await Promise.all([submitted(15000), page.getByRole("button", { name: submit, exact: true }).click()]);
      }
      await password.waitFor({ state: "hidden" });
      assert.equal(await captcha.count(), 0, "Human verification is still required; do not retry credentials");
    } catch (error) {
      const invalidControls = await page.locator("input:invalid").evaluateAll((inputs) => inputs.map((input) => ({
        type: input.type, name: input.name, valueMissing: input.validity.valueMissing,
        typeMismatch: input.validity.typeMismatch, tooShort: input.validity.tooShort,
      })));
      const pageState = await page.evaluate(() => ({ visibility: document.visibilityState,
        captchaSolved: !!document.querySelector("textarea[name='g-recaptcha-response']")?.value })).catch(() => ({}));
      report.loginDiagnostics.push({ stage, path: new URL(page.url()).pathname, passwordFormPresent: !!(await password.count()), invalidControls, ...pageState });
      throw error;
    } finally { loginOrigin = null; loginPath = null; }
    assert.equal(await page.locator("input[type='password']").count(), 0, "Login did not succeed; do not retry credentials");
  }

  async function activate(page) {
    await page.bringToFront();
    const url = await popup.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url);
    assert.equal(url, page.url(), "Wrong active tab");
  }

  async function copy(page) {
    await activate(page);
    await popup.locator("#btnCopy").click();
    try { await expectSuccess(); }
    catch (error) {
      report.crm.profileDiagnostics = await profileDiagnostics(page);
      throw error;
    }
    return popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getStudentCache" })).cache);
  }

  async function profileDiagnostics(page) {
    return page.evaluate(({ markers, labels }) => {
      const normalize = (text) => text.toLowerCase().replace(/[\s_*:]+/g, " ").trim();
      const body = document.body;
      const text = normalize(body ? body.innerText : "");
      const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map((heading) => normalize(heading.innerText));
      const knownHeadings = ["profile", "lead profile", "student profile", "profile details", "personal details",
        "personal information", "basic information", "contact information", "academic information",
        "educational background", "general information", "lead information", "student information",
        "academic details", "education", "documents", "applications", "profile at a glance"];
      const labelText = Array.from(document.querySelectorAll("label, dt, th, div, span")).map((label) => normalize(label.innerText));
      const knownLabels = [...Object.keys(labels), "full name", "name", "student name", "first name", "last name"];
      return { fullTextMarkers: markers.filter((marker) => text.includes(marker)),
        knownHeadings: knownHeadings.filter((heading) => headings.includes(heading)),
        mappedLabels: knownLabels.filter((label) => labelText.includes(label)),
        mainPresent: !!document.querySelector("main, [role='main']"),
        passwordFormPresent: !!document.querySelector("input[type='password']") };
    }, { markers: crmConfig.markers, labels: crmSource.labels });
  }

  async function openProfile(page, selectedUrl) {
    // Campora reuses the same profile URL during a run. Clear the old document
    // first so the marker wait cannot match the previous profile's DOM while the
    // fresh navigation is still committing.
    if (crmConfig.id === "campora") await page.goto("about:blank");
    await page.goto(selectedUrl, {
      waitUntil: crmConfig.id === "campora" ? "commit" : "domcontentloaded",
      timeout: crmConfig.id === "campora" ? 60000 : 30000,
    });
    const expected = new URL(selectedUrl);
    const destination = new URL(page.url());
    const sameRecordPath = destination.pathname.replace(/\/$/, "") === expected.pathname.replace(/\/$/, "");
    if (page.url() !== selectedUrl) {
      report.crm.redirect = {
        sameOrigin: destination.origin === expected.origin,
        sameRecordPath,
        sameQuery: destination.search === expected.search,
        fragmentChanged: destination.hash !== expected.hash,
        path: crmConfig.pathPatterns.some((pattern) => pattern.test(destination.pathname))
          ? destination.pathname
            .replace(/(\/full-profile\/)[^/]+/, "$1[record]")
            .replace(/(\/show\/)[^/]+\/profile/, "$1[record]/profile")
          : ["/", "/error", "/agent/dashboard", "/agent/new-direct-leads", "/applyuser/dashboard", "/applyuser/applicationfrom/list"].includes(destination.pathname)
            ? destination.pathname : "[unrecognized-path]",
      };
    }
    assert.ok(destination.origin === expected.origin && sameRecordPath && destination.search === expected.search,
      "Unexpected profile redirect; see redacted CRM redirect diagnostics");
    try {
      await page.waitForFunction((markers) => {
        const body = document.body;
        if (!body) return false;
        const text = body.innerText.slice(0, 12000).toLowerCase().replace(/[\s_*:]+/g, " ").trim();
        return markers.some((marker) => text.includes(marker));
      }, crmConfig.markers, { timeout: 30000 });
    } catch (error) {
      report.crm.profileDiagnostics = await profileDiagnostics(page);
      throw error;
    }
  }

  async function expectSuccess() {
    await popup.locator("#statusArea .success, #statusArea .error").waitFor({ timeout: 30000 });
    if (await popup.locator("#statusArea .error").count()) {
      throw new Error(await popup.locator("#statusArea .error").innerText());
    }
  }

  async function snapshot(page, selectors, splitDateSelectors = []) {
    return page.locator("input, select, textarea").evaluateAll((elements, [blocked, allowed]) => elements.map((element, index) => ({
      index, value: element.value, checked: element.checked, field: element.id || element.name || element.type,
      control: element.id || element.name || null,
      choice: ["radio", "checkbox"].includes(element.type),
      firstOption: element.tagName === "SELECT" && element.selectedIndex === 0 &&
        /^(month|year|day|select\b.*|choose\b.*|-+|)$/i.test(element.options[0]?.textContent.trim() || ""),
      protected: ["password", "file", "hidden", "submit", "button"].includes(element.type) ||
        (blocked.some((selector) => element.matches(selector)) && !allowed.some((selector) => element.matches(selector))),
    })), [selectors, splitDateSelectors]);
  }

  stage = "crm-login";
  const crm = await context.newPage();
  await crm.goto(crmConfig.loginUrl, { waitUntil: "domcontentloaded" });
  await login(crm, crmConfig.origin, crmConfig.username, crmConfig.password, crmConfig.submit);
  assert.ok(crm.url().startsWith(crmConfig.origin + "/"), "CRM did not reach an authenticated page");
  stage = "lead-sampling";
  const isProfileUrl = (url) => {
    const parsed = new URL(url);
    return parsed.origin === crmConfig.origin && crmConfig.pathPatterns.some((pattern) => pattern.test(parsed.pathname));
  };
  const selected = [];
  if (leadsFile) {
    const fixed = JSON.parse(await readFile(leadsFile, "utf8"));
    assert.ok(Array.isArray(fixed) && fixed.length && fixed.every(isProfileUrl), "SAMS_E2E_LEADS_FILE must list CRM profile URLs");
    selected.push(...fixed.slice(0, sampleCount));
  } else {
    if (crmConfig.id === "campora") {
      throw new Error("Campora live testing requires SAMS_E2E_LEADS_FILE with applyuser/show/<id>/profile URLs; random selection is not implemented");
    }
    await crm.goto("https://app.samscrm.co.uk/agent/new-direct-leads", { waitUntil: "domcontentloaded" });
    assert.equal(new URL(crm.url()).pathname, "/agent/new-direct-leads", "CRM lead list redirected away from the authenticated route");
    await crm.locator("a[href*='/agent/leads/full-profile/']").first().waitFor({ state: "attached", timeout: 15000 });
    const candidateLinks = await crm.locator("a[href*='/agent/leads/full-profile/']").evaluateAll((links) => links.map((link) => link.href));
    const candidates = [...new Set(candidateLinks.filter(isProfileUrl))];
    assert.ok(candidates.length, "No visible individual student links found; do not create a lead");
    while (candidates.length && selected.length < sampleCount) selected.push(candidates.splice(randomInt(candidates.length), 1)[0]);
  }
  report.crm = { source: crmConfig.id, status: "authenticated", selectedSamples: selected.length, copiedSamples: [] };

  for (let index = 0; index < selected.length; index++) {
    stage = `crm-copy-sample-${index + 1}`;
    await openProfile(crm, selected[index]);
    const copiedAfter = Date.now();
    const student = await copy(crm);
    assert.ok(student.copiedAt >= copiedAfter, "Stale student cache");
    report.crm.copiedSamples.push({ sample: index + 1, fieldCount: Object.keys(student.fields).length, fieldKeys: Object.keys(student.fields).sort() });
    await popup.locator("#btnClear").click();
    await popup.locator("#studentCard").waitFor({ state: "hidden" });
    assert.equal(await popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getStudentCache" })).cache), null);
  }
  report.crm.status = "copy-passed";

  const portalFilter = process.env.SAMS_E2E_PORTALS?.split(",");
  for (const portal of portals) {
    if (portalFilter && !portalFilter.includes(portal.id)) continue;
    if (!process.env[portal.username] || !process.env[portal.password]) {
      continue;
    }
    stage = `${portal.id}-login`;
    const page = await context.newPage();
    await page.goto(portal.login, { waitUntil: "domcontentloaded" });
    await login(page, portal.origin, portal.username, portal.password, portal.submit);
    const portalConfig = globalThis.SAMS_PORTALS.find((candidate) => candidate.id === portal.id);
    const blocked = portalConfig.blockedControls;
    const result = { portal: portal.id, status: "testing", samples: [],
      loginLanding: { title: await page.title(), path: new URL(page.url()).pathname } };
    report.portals.push(result);
    for (let index = 0; index < selected.length; index++) {
      stage = `${portal.id}-sample-${index + 1}-crm-profile`;
      await openProfile(crm, selected[index]);
      const copiedAfter = Date.now();
      const cache = await copy(crm);
      assert.equal(cache.sourceOrigin, crmConfig.sourceOrigin);
      assert.ok(cache.copiedAt >= copiedAfter, "Stale student cache");
      // Discard the previous sample's unsaved tab values before testing a fresh sample.
      if (portal.forms.some((form) => form.kind === "tab")) await page.reload({ waitUntil: "domcontentloaded" });
      const forms = [];
      for (const form of portal.forms) {
        stage = `${portal.id}-sample-${index + 1}-${form.name}`;
        try {
          assert.equal(report.blockedWriteAttempts, 0, "A request attempted a write; no further filling is allowed");
          if (form.kind === "tab") {
            assert.equal(new URL(page.url()).origin, portal.origin, "Unexpected application hub origin");
            assert.ok(["PD", "CD", "QU", "EX"].includes(form.tab), "Only approved data-entry tabs may be opened");
            tabLoad = { origin: portal.origin, tab: form.tab };
            const tabCall = `ul_click_tab('${form.tab}')`;
            await page.locator(`a[onclick*="${tabCall}"], a[href*="${tabCall}"]`).first().click();
            await page.locator(`#TAB-MAIN-${form.tab}`).locator(form.control).waitFor({ state: "visible", timeout: 30000 });
            assert.equal(report.blockedWriteAttempts, 0, "A tab-load request was blocked; no Autofill is allowed");
          } else {
            await page.goto(form.url, { waitUntil: "domcontentloaded" });
            await page.locator("form input:not([type='hidden']):not([type='submit']), form select, form textarea").first().waitFor({ state: "visible" });
          }
        } catch (error) {
          if (report.blockedWriteStages.some((attempt) => attempt.stage === stage && attempt.tabLoadBlocked)) {
            result.status = "blocked";
            result.blockedTabLoad = { form: form.name, tab: form.tab, reason: "non-get-tab-load-request-blocked" };
          }
          result.formDiagnostics = { form: form.name, title: await page.title(), path: new URL(page.url()).pathname,
            passwordFormPresent: !!(await page.locator("input[type='password']").count()) };
          throw error;
        } finally {
          tabLoad = null;
        }
        assert.equal(report.blockedWriteAttempts, 0, "A request attempted a write; no further filling is allowed");
        assert.ok(await page.locator("input:not([type='hidden']):not([type='password']):not([type='submit']), select, textarea").count(), "Existing portal form unavailable; no new application will be created");
        const here = new URL(page.url());
        const splitDates = (portalConfig.splitDates || []).filter((spec) => new RegExp(spec.page).test(here.pathname + here.search))
          .flatMap((spec) => [spec.day, spec.month, spec.year].filter(Boolean));
        const before = await snapshot(page, blocked, splitDates);
        await activate(page);
        await popup.locator("#btnAutofill").click();
        await expectSuccess();
        const after = await snapshot(page, blocked, splitDates);
        assert.equal(after.length, before.length, "Unexpected form structure change");
        let changed = 0;
        const filledControls = [];
        for (let field = 0; field < before.length; field++) {
          const previous = before[field];
          const current = after[field];
          if (current.value !== previous.value || current.checked !== previous.checked) {
            assert.equal(previous.protected, false, "A blocked control changed");
            assert.ok(previous.value === "" || previous.firstOption, `An existing field was overwritten: ${previous.field}`);
            assert.ok(previous.control, "A changed control has no id or name for the redacted report");
            filledControls.push(previous.control);
            changed++;
          }
        }
        await popup.locator("#btnAutofill").click();
        await expectSuccess();
        const repeated = await snapshot(page, blocked, splitDates);
        const repeatChanged = repeated.filter((field, position) => field.value !== after[position]?.value || field.checked !== after[position]?.checked).map((field) => field.field);
        assert.deepEqual(repeatChanged, [], "Repeat Autofill changed the form");
        const filled = Number((await popup.locator("#statusArea .success").innerText()).match(/^\d+/)?.[0]);
        assert.equal(filled, 0, "Repeat Autofill must fill zero fields");
        assert.equal(report.blockedWriteAttempts, 0, "A portal attempted a write; it was blocked and no further filling is allowed");
        const emptyAfter = after.filter((field) => !field.protected && !field.choice && field.value === "").map((field) => field.field);
        forms.push({ form: form.name, emptyBefore: before.filter((field) => !field.protected && !field.choice && field.value === "").length, changedFields: changed, filledControls, repeatFilled: filled, emptyAfter });
        if (saveBangorPersonal && portal.id === "bangor" && form.name === "personal" && !result.personalSave) {
          stage = `${portal.id}-sample-${index + 1}-personal-save`;
          const save = page.locator("form button[type='submit'], form input[type='submit']").filter({ hasText: /save/i })
            .or(page.locator("form input[type='submit'][value*='Save' i]")).first();
          personalSaveArmed = true;
          await Promise.all([page.waitForLoadState("domcontentloaded"), save.click()]);
          await page.waitForTimeout(2000);
          personalSaveArmed = false;
          result.personalSave = { posted: !!report.personalSavePosted, landedOn: new URL(page.url()).pathname,
            invalidControls: await page.locator("input:invalid, select:invalid, textarea:invalid").evaluateAll((elements) => elements.map((element) => element.id || element.name)),
            errors: (await page.locator(".errorlist, .invalid-feedback, .alert-danger, .error, .help-block, [class*='error' i]").allInnerTexts()).map((text) => text.trim()).filter(Boolean).slice(0, 10) };
          if (!portal.forms.some((candidate) => candidate.name === "programme")) portal.forms.push({ name: "programme", url: "https://apps.bangor.ac.uk/apply/course/" });
        }
      }
      await popup.locator("#btnClear").click();
      await popup.locator("#studentCard").waitFor({ state: "hidden" });
      assert.equal(await popup.evaluate(async () => (await chrome.runtime.sendMessage({ action: "getStudentCache" })).cache), null);
      assert.equal(report.blockedWriteAttempts, 0, "A portal attempted a write; it was blocked and no further filling is allowed");
      result.samples.push({ sample: index + 1, crmFieldCount: Object.keys(cache.fields).length, forms, existingValuesPreserved: true, blockedControlsPreserved: true, cacheCleared: true });
    }
    result.status = "passed";
    if (portal.forms[0].kind === "tab") await page.reload({ waitUntil: "domcontentloaded" });
    else await page.goto(portal.forms[0].url, { waitUntil: "domcontentloaded" });
  }
} catch (error) {
  let message = error.message;
  for (const [key, value] of Object.entries(process.env)) {
    if ((/(USER|PASS|TOKEN|KEY)/i.test(key) || portals.some((portal) => key === portal.username || key === portal.password)) && value) message = message.split(value).join("[redacted]");
  }
  message = message.replace(/https?:\/\/[^\s"'<>]+/g, "[url redacted]");
  report.failure = { stage, type: error.name, message: message.slice(0, 600) };
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  if (context) {
    for (const worker of context.serviceWorkers()) {
      if (worker.url().endsWith("/src/background.js")) await worker.evaluate(async () => { await chrome.storage.session.clear(); });
    }
    await context.close();
  }
  await writeFile(join(root, "tmp/extension-e2e/live-report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}
