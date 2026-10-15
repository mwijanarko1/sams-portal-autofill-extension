const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

// Real Chromium DOM, real engine, on an origin with no portal mapping.
// GENERIC_ENGINE_PATH / GENERIC_SYNONYMS_PATH load a preserved snapshot for fail-before proof only.
const browserPath = "/Applications/Helium.app/Contents/MacOS/Helium";
const formUrl = "https://apply.example-university.test/apply/personal";
const synonymsFile = process.env.GENERIC_SYNONYMS_PATH || "config/synonyms.js";
const engineFile = process.env.GENERIC_ENGINE_PATH || "src/engine/engine.js";
const engineFiles = [synonymsFile, engineFile].map((file) => fs.readFileSync(file, "utf8"));
const student = {
  title: "Ms",
  givenName: "Aisha",
  middleName: "Noor",
  familyName: "Rahman",
  dateOfBirth: "2000-02-15",
  gender: "Female",
  nationality: "Bangladeshi",
  email: "aisha.rahman@example.com",
  phone: "+880 1712 345678",
  location: "1 Test Street",
  city: "Dhaka",
  postcode: "1205",
  countryName: "Bangladesh",
  passportNumber: "X1234567",
  emergencyName: "Amina Rahman",
  emergencyEmail: "amina.rahman@example.com",
  emergencyPhone: "+880 1711 000000",
  institutionName: "Dhaka College",
  degree: "Bachelor",
};

let browser;
test.before(async () => {
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
});
test.after(() => browser && browser.close());

async function open(html) {
  const page = await browser.newPage();
  await page.route(/^https?:\/\//, (route) => route.request().url() === formUrl
    ? route.fulfill({ contentType: "text/html", body: html })
    : route.abort());
  await page.goto(formUrl);
  for (const content of engineFiles) await page.addScriptTag({ content });
  return page;
}

const autofill = (page, fieldMap = student) => page.evaluate((map) =>
  SAMS_ENGINE.autofillPage(map, SAMS_ENGINE.scanFormFields({ mode: "fill" })), fieldMap);

const values = (page) => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll("input, select, textarea")].map((control) => [control.id, control.value])
));

test("unmapped university form fills shared applicant fields and leaves unsafe fields empty", async () => {
  const page = await open(fs.readFileSync(path.resolve("e2e/fixtures/generic-university.html"), "utf8"));
  const report = await autofill(page);
  assert.deepEqual(await values(page), {
    login_email: "", login_password: "",
    title: "Ms", first_name: "Aisha", middle_names: "Noor", surname: "Rahman",
    full_name: "", preferred_name: "", known_as: "", dob: "15/02/2000",
    dob_day: "", dob_month: "", dob_year: "",
    gender: "F", nationality: "Bangladeshi", passport: "", hidden_city: "", inert_email: "",
    email: "aisha.rahman@example.com", phone_cc: "", mobile: "+8801712345678", phone_ext: "",
    addr1: "1 Test Street", addr2: "", town: "Dhaka", postcode: "EXISTING", country: "Bangladesh",
    billing_postcode: "",
    ec_name: "", ec_email: "", ec_phone: "",
    ref_first: "", ref_email: "", agent_email: "",
    qual_institution: "", qual_country: "", qual2_institution: "",
    card_name: "", card_first: "", signature: "", declare_first: "",
  });
  assert.equal(report.mapping, null);
  assert.deepEqual(report.skippedExisting.map((item) => item.name), ["postcode"]);
  assert.deepEqual(await page.evaluate(() => activity), {
    submissions: 0,
    clicks: 0,
    changes: ["title", "first_name", "middle_names", "surname", "dob", "gender", "nationality",
      "email", "mobile", "addr1", "town", "country"],
  });

  const repeat = await autofill(page);
  assert.deepEqual(repeat.filled, []);
  assert.equal((await page.evaluate(() => activity)).changes.length, 12, "Repeat Autofill must not write again");
  await page.close();
});

test("ambiguous, conflicting, unknown, and custom controls stay manual", async () => {
  const page = await open(`
    <form>
      <label for="phone">Phone</label><input id="phone" type="tel">
      <label for="mobile">Mobile number</label><input id="mobile" type="tel">
      <label for="conflict">First name</label><input id="conflict" autocomplete="family-name">
      <label for="job">Job title</label><input id="job" name="title">
      <label for="known">Known as</label><input id="known" autocomplete="given-name">
      <label for="surname">Surname</label><input id="surname" autocomplete="nope">
      <label for="nationality">Nationality</label><input id="nationality" role="combobox" aria-autocomplete="list">
      <label for="dob_day">Date of birth</label><select id="dob_day"><option value="">Day</option><option>15</option></select>
      <input id="email" name="email" type="email">
    </form>`);
  await autofill(page);
  assert.deepEqual(await values(page), {
    phone: "", mobile: "", conflict: "", job: "", known: "", surname: "Rahman",
    nationality: "", dob_day: "", email: "aisha.rahman@example.com",
  });
  await page.close();
});

test("a field the page makes read-only during Autofill is not written", async () => {
  const page = await open(`
    <form>
      <label for="first">First name</label><input id="first">
      <label for="last">Last name</label><input id="last">
    </form>
    <script>
      document.getElementById("first").addEventListener("change", () => { document.getElementById("last").readOnly = true; });
    </script>`);
  await autofill(page);
  assert.deepEqual(await values(page), { first: "Aisha", last: "" });
  await page.close();
});

test("nested emergency and referee section contexts stay empty while applicant email fills", async () => {
  const page = await open(`
    <form aria-label="Application">
      <h2>Emergency contact</h2>
      <h3>Contact details</h3>
      <label for="ec_email">Email</label><input id="ec_email" type="email">
      <fieldset>
        <legend>Referee</legend>
        <fieldset>
          <legend>Contact details</legend>
          <label for="ref_email">Email</label><input id="ref_email" type="email">
        </fieldset>
      </fieldset>
      <h2>Personal details</h2>
      <h3>Contact details</h3>
      <label for="email">Email</label><input id="email" type="email">
      <p>Other notes mention referees only as guidance for a later step.</p>
    </form>`);
  await autofill(page);
  assert.deepEqual(await values(page), {
    ec_email: "",
    ref_email: "",
    email: "aisha.rahman@example.com",
  });
  await page.close();
});

test("same-origin iframe titled as referee contact details stays empty", async () => {
  const page = await browser.newPage();
  const childUrl = "https://apply.example-university.test/apply/child";
  await page.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    if (url === formUrl) {
      return route.fulfill({
        contentType: "text/html",
        body: `
          <form aria-label="Application">
            <fieldset>
              <legend>Referee</legend>
              <iframe id="ref_frame" title="Referee contact details" src="/apply/child"></iframe>
            </fieldset>
            <label for="first">First name</label><input id="first">
          </form>`,
      });
    }
    if (url === childUrl) {
      return route.fulfill({
        contentType: "text/html",
        body: `<label for="child_first">First name</label><input id="child_first">`,
      });
    }
    return route.abort();
  });
  await page.goto(formUrl);
  const childFrame = page.frame({ url: childUrl });
  assert.ok(childFrame);
  for (const content of engineFiles) await childFrame.addScriptTag({ content });
  await childFrame.evaluate((map) =>
    SAMS_ENGINE.autofillPage(map, SAMS_ENGINE.scanFormFields({ mode: "fill" })), student);
  assert.equal(await childFrame.inputValue("#child_first"), "");
  for (const content of engineFiles) await page.addScriptTag({ content });
  await autofill(page);
  assert.equal(await page.locator("#first").inputValue(), "Aisha");
  await page.close();
});

test("live password mutation before write leaves the unique last-name field empty", async () => {
  const page = await open(`
    <form>
      <label for="first">First name</label><input id="first">
      <label for="last">Last name</label><input id="last">
    </form>
    <script>
      document.getElementById("first").addEventListener("change", () => {
        const last = document.getElementById("last");
        last.type = "password";
        last.autocomplete = "new-password";
      });
    </script>`);
  assert.equal(await page.locator("#last").getAttribute("type"), null);
  assert.equal(await page.locator("label[for='last']").textContent(), "Last name");
  await autofill(page);
  assert.deepEqual(await values(page), { first: "Aisha", last: "" });
  await page.close();
});

test("live referee label mutation before write leaves the unique last-name field empty", async () => {
  const page = await open(`
    <form>
      <label for="first">First name</label><input id="first">
      <label for="last" id="last_label">Last name</label><input id="last">
    </form>
    <script>
      document.getElementById("first").addEventListener("change", () => {
        document.getElementById("last_label").textContent = "Referee last name";
      });
    </script>`);
  assert.equal(await page.locator("#last_label").textContent(), "Last name");
  await autofill(page);
  assert.deepEqual(await values(page), { first: "Aisha", last: "" });
  await page.close();
});

test("a duplicate first name added during fill blocks the later first-name write", async () => {
  const page = await open(`
    <form id="app">
      <label for="email">Email</label><input id="email" type="email">
      <label for="first">First name</label><input id="first">
    </form>
    <script>
      document.getElementById("email").addEventListener("change", () => {
        const form = document.getElementById("app");
        const label = document.createElement("label");
        label.htmlFor = "first_copy";
        label.textContent = "First name";
        const input = document.createElement("input");
        input.id = "first_copy";
        form.append(label, input);
      });
    </script>`);
  await autofill(page);
  assert.equal(await page.locator("#email").inputValue(), "aisha.rahman@example.com");
  assert.equal(await page.locator("#first").inputValue(), "");
  assert.equal(await page.locator("#first_copy").inputValue(), "");
  await page.close();
});

test("password recovery form without a password control stays empty", async () => {
  const page = await open(`
    <form aria-label="Reset password" action="/password/reset" method="post">
      <p>Enter the email for your account to receive a recovery link.</p>
      <label for="email">Email</label><input id="email" type="email">
      <button type="submit">Send reset link</button>
    </form>
    <form aria-label="Application" action="/apply/save" method="post">
      <label for="app_email">Email</label><input id="app_email" type="email">
    </form>`);
  await autofill(page);
  assert.deepEqual(await values(page), {
    email: "",
    app_email: "aisha.rahman@example.com",
  });
  await page.close();
});

test("generic gender does not fuzzy-match Female onto Male", async () => {
  const page = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option value="M">Male</option></select>
    </form>`);
  await autofill(page, { ...student, gender: "Female" });
  assert.equal(await page.locator("#gender").inputValue(), "");
  await page.close();
});

test("generic country does not substring-match Republic of the Congo onto DRC", async () => {
  const page = await open(`
    <form>
      <label for="country">Country</label>
      <select id="country">
        <option value="">Select</option>
        <option>Democratic Republic of the Congo</option>
      </select>
    </form>`);
  await autofill(page, { ...student, countryName: "Republic of the Congo" });
  assert.equal(await page.locator("#country").inputValue(), "");
  await page.close();
});

test("generic selects accept exact values and explicit equivalences only", async () => {
  const page = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option value="F">Female</option><option value="M">Male</option></select>
      <label for="country">Country</label>
      <select id="country"><option value="">Select</option><option>Republic of the Congo</option></select>
    </form>`);
  await autofill(page, { ...student, gender: "Female", countryName: "Republic of the Congo" });
  assert.deepEqual(await values(page), {
    gender: "F",
    country: "Republic of the Congo",
  });
  await page.close();

  const uk = await open(`
    <form>
      <label for="country">Country</label>
      <select id="country"><option value="">Select</option><option>United Kingdom</option></select>
    </form>`);
  await autofill(uk, { ...student, countryName: "UK" });
  assert.equal(await uk.locator("#country").inputValue(), "United Kingdom");
  await uk.close();
});

async function openParentChild(parentHtml, childBodies) {
  const page = await browser.newPage();
  const routes = new Map([[formUrl, parentHtml]]);
  Object.entries(childBodies).forEach(([path, body]) => {
    routes.set(`https://apply.example-university.test${path}`, body);
  });
  await page.route(/^https?:\/\//, (route) => {
    const html = routes.get(route.request().url());
    return html
      ? route.fulfill({ contentType: "text/html", body: html })
      : route.abort();
  });
  await page.goto(formUrl);
  return page;
}

async function fillFrame(page, path, fieldMap = student) {
  const frame = page.frame({ url: `https://apply.example-university.test${path}` });
  assert.ok(frame, `missing frame ${path}`);
  for (const content of engineFiles) await frame.addScriptTag({ content });
  await frame.evaluate((map) =>
    SAMS_ENGINE.autofillPage(map, SAMS_ENGINE.scanFormFields({ mode: "fill" })), fieldMap);
  return frame;
}

test("neutral-titled sibling iframes inherit outer Referee vs Applicant headings", async () => {
  const page = await openParentChild(`
    <h2>Referee</h2>
    <iframe id="ref" src="/apply/ref"></iframe>
    <h2>Applicant</h2>
    <iframe id="app" src="/apply/app"></iframe>`, {
    "/apply/ref": `<label for="ref_first">First name</label><input id="ref_first">`,
    "/apply/app": `<label for="app_first">First name</label><input id="app_first">`,
  });
  const ref = await fillFrame(page, "/apply/ref");
  const app = await fillFrame(page, "/apply/app");
  assert.equal(await ref.inputValue("#ref_first"), "");
  assert.equal(await app.inputValue("#app_first"), "Aisha");
  await page.close();
});

test("neutral nested iframe under Referee heading stays empty while sibling applicant fills", async () => {
  const page = await openParentChild(`
    <h2>Referee</h2>
    <iframe id="mid" src="/apply/mid"></iframe>
    <h2>Applicant</h2>
    <iframe id="app" src="/apply/app"></iframe>`, {
    "/apply/mid": `<iframe id="inner" src="/apply/inner"></iframe>`,
    "/apply/inner": `<label for="inner_first">First name</label><input id="inner_first">`,
    "/apply/app": `<label for="app_first">First name</label><input id="app_first">`,
  });
  await page.frame({ url: "https://apply.example-university.test/apply/mid" })
    .waitForSelector("iframe#inner");
  const inner = await fillFrame(page, "/apply/inner");
  const app = await fillFrame(page, "/apply/app");
  assert.equal(await inner.inputValue("#inner_first"), "");
  assert.equal(await app.inputValue("#app_first"), "Aisha");
  await page.close();
});

test("Referee heading outside a form blocks that form's first name", async () => {
  const page = await open(`
    <h2>Referee</h2>
    <form>
      <label for="ref_first">First name</label><input id="ref_first">
    </form>
    <h2>Applicant</h2>
    <form>
      <label for="app_first">First name</label><input id="app_first">
    </form>`);
  await autofill(page);
  assert.deepEqual(await values(page), { ref_first: "", app_first: "Aisha" });
  await page.close();
});

test("explicit form aria-label third-party metadata blocks ordinary first name", async () => {
  const page = await open(`
    <form aria-label="Referee contact details">
      <label for="ref_first">First name</label><input id="ref_first">
    </form>
    <form aria-label="Emergency contact">
      <label for="ec_first">First name</label><input id="ec_first">
    </form>
    <form aria-label="Applicant personal details">
      <label for="app_first">First name</label><input id="app_first">
    </form>`);
  await autofill(page);
  assert.deepEqual(await values(page), {
    ref_first: "",
    ec_first: "",
    app_first: "Aisha",
  });
  await page.close();
});

test("same-origin iframe inside a Referee-labelled form stays empty", async () => {
  const page = await openParentChild(`
    <form aria-label="Referee contact details">
      <iframe id="ref" src="/apply/ref"></iframe>
    </form>
    <form aria-label="Applicant personal details">
      <label for="app_first">First name</label><input id="app_first">
    </form>`, {
    "/apply/ref": `<label for="ref_first">First name</label><input id="ref_first">`,
  });
  const ref = await fillFrame(page, "/apply/ref");
  for (const content of engineFiles) await page.addScriptTag({ content });
  await autofill(page);
  assert.equal(await ref.inputValue("#ref_first"), "");
  assert.equal(await page.locator("#app_first").inputValue(), "Aisha");
  await page.close();
});

test("Other, Non-binary, and X are not interchangeable gender options", async () => {
  const onlyNonBinary = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option>Non-binary</option></select>
    </form>`);
  await autofill(onlyNonBinary, { ...student, gender: "Other" });
  assert.equal(await onlyNonBinary.locator("#gender").inputValue(), "");
  await onlyNonBinary.close();

  const onlyOther = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option>Other</option></select>
    </form>`);
  await autofill(onlyOther, { ...student, gender: "Non-binary" });
  assert.equal(await onlyOther.locator("#gender").inputValue(), "");
  await onlyOther.close();

  const onlyX = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option value="X">X</option></select>
    </form>`);
  await autofill(onlyX, { ...student, gender: "Other" });
  assert.equal(await onlyX.locator("#gender").inputValue(), "");
  await autofill(onlyX, { ...student, gender: "Non-binary" });
  assert.equal(await onlyX.locator("#gender").inputValue(), "");
  await onlyX.close();

  const exactOther = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option>Other</option></select>
    </form>`);
  await autofill(exactOther, { ...student, gender: "Other" });
  assert.equal(await exactOther.locator("#gender").inputValue(), "Other");
  await exactOther.close();

  const lexicalNonBinary = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option>Nonbinary</option></select>
    </form>`);
  await autofill(lexicalNonBinary, { ...student, gender: "Non-binary" });
  assert.equal(await lexicalNonBinary.locator("#gender").inputValue(), "Nonbinary");
  await lexicalNonBinary.close();

  const exactX = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender"><option value="">Select</option><option value="X">X</option></select>
    </form>`);
  await autofill(exactX, { ...student, gender: "X" });
  assert.equal(await exactX.locator("#gender").inputValue(), "X");
  await exactX.close();
});

test("generic select rejects disabled options, duplicate values, and label/value conflicts", async () => {
  const disabledFemale = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender">
        <option value="">Select</option>
        <option value="F" disabled>Female</option>
        <option value="M">Male</option>
      </select>
    </form>`);
  await autofill(disabledFemale, { ...student, gender: "Female" });
  assert.equal(await disabledFemale.locator("#gender").inputValue(), "");
  await disabledFemale.close();

  const disabledGroup = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender">
        <option value="">Select</option>
        <optgroup label="Closed" disabled>
          <option value="F">Female</option>
        </optgroup>
        <option value="M">Male</option>
      </select>
    </form>`);
  await autofill(disabledGroup, { ...student, gender: "Female" });
  assert.equal(await disabledGroup.locator("#gender").inputValue(), "");
  await disabledGroup.close();

  const duplicateValues = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="1">British</option>
        <option value="1">Bangladeshi</option>
      </select>
    </form>`);
  await autofill(duplicateValues);
  assert.equal(await duplicateValues.locator("#nationality").inputValue(), "");
  const selectedText = await duplicateValues.locator("#nationality").evaluate(
    (el) => el.options[el.selectedIndex] && el.options[el.selectedIndex].text
  );
  assert.notEqual(selectedText, "Bangladeshi");
  assert.notEqual(selectedText, "British");
  await duplicateValues.close();

  const duplicateWithDisabled = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="1" disabled>British</option>
        <option value="1">Bangladeshi</option>
      </select>
    </form>`);
  await autofill(duplicateWithDisabled);
  assert.equal(await duplicateWithDisabled.locator("#nationality").inputValue(), "");
  await duplicateWithDisabled.close();

  const conflicting = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender">
        <option value="">Select</option>
        <option value="M">Female</option>
      </select>
    </form>`);
  await autofill(conflicting, { ...student, gender: "Female" });
  assert.equal(await conflicting.locator("#gender").inputValue(), "");
  await conflicting.close();

  const exactOk = await open(`
    <form>
      <label for="gender">Gender</label>
      <select id="gender">
        <option value="">Select</option>
        <option value="F">Female</option>
        <option value="M">Male</option>
      </select>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="Bangladeshi">Bangladeshi</option>
        <option value="British">British</option>
      </select>
    </form>`);
  await autofill(exactOk);
  assert.deepEqual(await values(exactOk), { gender: "F", nationality: "Bangladeshi" });
  const chosen = await exactOk.evaluate(() => ({
    genderText: document.getElementById("gender").options[document.getElementById("gender").selectedIndex].text,
    nationalityText: document.getElementById("nationality").options[document.getElementById("nationality").selectedIndex].text,
  }));
  assert.deepEqual(chosen, { genderText: "Female", nationalityText: "Bangladeshi" });
  await exactOk.close();
});

test("Applicant heading inside a fieldset does not fill sibling fieldset under outer Referee", async () => {
  const page = await open(`
    <h2>Referee</h2>
    <form>
      <fieldset>
        <h2>Applicant</h2>
        <label for="email">Email</label>
        <input id="email">
      </fieldset>
      <fieldset>
        <label for="first">First name</label>
        <input id="first">
      </fieldset>
    </form>`);
  await autofill(page);
  // Applicant-scoped email may fill; sibling first name must keep outer Referee and stay empty.
  assert.deepEqual(await values(page), {
    email: "aisha.rahman@example.com",
    first: "",
  });
  await page.close();
});

test("outer Referee and sibling Applicant form or iframe still fill the applicant side only", async () => {
  const page = await open(`
    <h2>Referee</h2>
    <form>
      <label for="ref_first">First name</label><input id="ref_first">
    </form>
    <h2>Applicant</h2>
    <form>
      <fieldset>
        <h3>Contact</h3>
        <label for="app_email">Email</label><input id="app_email" type="email">
      </fieldset>
      <fieldset>
        <label for="app_first">First name</label><input id="app_first">
      </fieldset>
    </form>`);
  await autofill(page);
  assert.deepEqual(await values(page), {
    ref_first: "",
    app_email: "aisha.rahman@example.com",
    app_first: "Aisha",
  });
  await page.close();
});

test("nationality and country reject contradictory human-readable label and value", async () => {
  const natValueOnly = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="Bangladeshi">British</option>
      </select>
    </form>`);
  await autofill(natValueOnly);
  assert.equal(await natValueOnly.locator("#nationality").inputValue(), "");
  assert.notEqual(await natValueOnly.locator("#nationality").evaluate(
    (el) => el.options[el.selectedIndex] && el.options[el.selectedIndex].text
  ), "British");
  await natValueOnly.close();

  const natLabelOnly = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="British">Bangladeshi</option>
      </select>
    </form>`);
  await autofill(natLabelOnly);
  assert.equal(await natLabelOnly.locator("#nationality").inputValue(), "");
  await natLabelOnly.close();

  const countryValueOnly = await open(`
    <form>
      <label for="country">Country</label>
      <select id="country">
        <option value="">Select</option>
        <option value="Bangladesh">India</option>
      </select>
    </form>`);
  await autofill(countryValueOnly);
  assert.equal(await countryValueOnly.locator("#country").inputValue(), "");
  await countryValueOnly.close();

  const countryLabelOnly = await open(`
    <form>
      <label for="country">Country</label>
      <select id="country">
        <option value="">Select</option>
        <option value="India">Bangladesh</option>
      </select>
    </form>`);
  await autofill(countryLabelOnly);
  assert.equal(await countryLabelOnly.locator("#country").inputValue(), "");
  await countryLabelOnly.close();

  const opaqueNumeric = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="42">Bangladeshi</option>
        <option value="99">British</option>
      </select>
    </form>`);
  await autofill(opaqueNumeric);
  assert.equal(await opaqueNumeric.locator("#nationality").inputValue(), "42");
  assert.equal(await opaqueNumeric.locator("#nationality").evaluate(
    (el) => el.options[el.selectedIndex].text
  ), "Bangladeshi");
  await opaqueNumeric.close();

  const equalLabelValue = await open(`
    <form>
      <label for="country">Country</label>
      <select id="country">
        <option value="">Select</option>
        <option value="Bangladesh">Bangladesh</option>
      </select>
    </form>`);
  await autofill(equalLabelValue);
  assert.equal(await equalLabelValue.locator("#country").inputValue(), "Bangladesh");
  await equalLabelValue.close();
});

test("attribute option.label mismatch stays empty despite matching text and value", async () => {
  const page = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="Bangladeshi" label="British">Bangladeshi</option>
      </select>
    </form>`);
  const report = await autofill(page);
  assert.equal(await page.locator("#nationality").inputValue(), "");
  assert.equal(await page.locator("#nationality").evaluate((el) => el.options[el.selectedIndex].label), "Select");
  assert.equal(report.filled.filter((item) => item.name === "nationality").length, 0);
  assert.ok(report.manualReview.some((item) => item.fieldName === "nationality" || item.fieldLabel === "Nationality"));
  await page.close();
});

test("unsupported Unicode and blank option.label stay manual even when value matches", async () => {
  const unicode = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="Bangladeshi">英国籍</option>
      </select>
    </form>`);
  const unicodeReport = await autofill(unicode);
  assert.equal(await unicode.locator("#nationality").inputValue(), "");
  assert.equal(unicodeReport.filled.filter((item) => item.name === "nationality").length, 0);
  assert.ok(unicodeReport.manualReview.some((item) => item.fieldName === "nationality" || item.fieldLabel === "Nationality"));
  await unicode.close();

  const blank = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="Bangladeshi" label="">Bangladeshi</option>
      </select>
    </form>`);
  const blankReport = await autofill(blank);
  assert.equal(await blank.locator("#nationality").inputValue(), "");
  assert.equal(blankReport.filled.filter((item) => item.name === "nationality").length, 0);
  assert.ok(blankReport.manualReview.some((item) => item.fieldName === "nationality" || item.fieldLabel === "Nationality"));
  await blank.close();

  const whitespace = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="Bangladeshi" label="  ">Bangladeshi</option>
      </select>
    </form>`);
  const whitespaceReport = await autofill(whitespace);
  assert.equal(await whitespace.locator("#nationality").inputValue(), "");
  assert.equal(whitespaceReport.filled.filter((item) => item.name === "nationality").length, 0);
  assert.ok(whitespaceReport.manualReview.some((item) => item.fieldName === "nationality" || item.fieldLabel === "Nationality"));
  await whitespace.close();
});

test("displayed option.label match fills with safe value despite conflicting option.text", async () => {
  const labelled = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="Bangladeshi" label="Bangladeshi">British</option>
      </select>
    </form>`);
  const labelledReport = await autofill(labelled);
  assert.equal(await labelled.locator("#nationality").inputValue(), "Bangladeshi");
  assert.equal(await labelled.locator("#nationality").evaluate((el) => el.options[el.selectedIndex].label), "Bangladeshi");
  assert.equal(await labelled.locator("#nationality").evaluate((el) => el.options[el.selectedIndex].text), "British");
  assert.ok(labelledReport.filled.some((item) => item.name === "nationality"));
  await labelled.close();

  const opaque = await open(`
    <form>
      <label for="nationality">Nationality</label>
      <select id="nationality">
        <option value="">Select</option>
        <option value="42" label="Bangladeshi">British</option>
      </select>
    </form>`);
  const opaqueReport = await autofill(opaque);
  assert.equal(await opaque.locator("#nationality").inputValue(), "42");
  assert.equal(await opaque.locator("#nationality").evaluate((el) => el.options[el.selectedIndex].label), "Bangladeshi");
  assert.ok(opaqueReport.filled.some((item) => item.name === "nationality"));
  await opaque.close();
});
