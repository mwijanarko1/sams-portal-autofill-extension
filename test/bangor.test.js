const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadBangor(pathname) {
  function FakeEvent(type, init) {
    this.type = type;
    this.bubbles = !!(init && init.bubbles);
  }
  function FakeKeyboardEvent(type, init) {
    FakeEvent.call(this, type, init);
    this.key = (init && init.key) || "";
  }
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    URL,
    Event: FakeEvent,
    KeyboardEvent: FakeKeyboardEvent,
    location: { origin: "https://apps.bangor.ac.uk", pathname },
  });
  context.globalThis = context;
  context.window = {
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    HTMLInputElement: { prototype: {} },
    HTMLTextAreaElement: { prototype: {} },
    HTMLSelectElement: { prototype: {} },
  };
  context.document = { querySelector: () => null };
  vm.runInContext(fs.readFileSync("config/synonyms.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("config/portals/bangor.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/engine/engine.js", "utf8"), context);
  return context;
}

function fakeEl({ id, name = "", label = "", type = "text" } = {}) {
  return {
    id,
    name,
    tagName: type === "select-one" || type === "select" ? "SELECT" : "INPUT",
    type,
    disabled: false,
    options: [],
    value: "",
    textContent: "",
    classList: { contains: () => false },
    getBoundingClientRect: () => ({ width: 20, height: 20, top: 0, left: 0 }),
    getAttribute: (attr) => {
      if (attr === "type") return type;
      if (attr === "id") return id;
      if (attr === "name") return name;
      if (attr === "aria-label") return label;
      return "";
    },
    matches: (selector) => {
      const isSelect = type === "select-one" || type === "select";
      if (selector === `#${id}`) return true;
      if (selector === `input#${id}`) return !isSelect;
      if (selector === `select#${id}`) return isSelect;
      if (selector === `input[name='${name}']` || selector === `input[name="${name}"]`) {
        return !isSelect;
      }
      if (selector === `select[name='${name}']` || selector === `select[name="${name}"]`) {
        return isSelect;
      }
      if (selector === "input[type='submit']" && type === "submit") return true;
      if (selector === "input[type='file']" && type === "file") return true;
      if (selector === "textarea[name='prompt_text']" && name === "prompt_text") return true;
      return false;
    },
    closest: () => null,
    parentElement: null,
    dispatchEvent: () => true,
    focus: () => {},
    blur: () => {},
  };
}

function sameJson(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test("bangor config loads once for apps.bangor.ac.uk personal path", () => {
  const ctx = loadBangor("/apply/personal/");
  const portals = ctx.SAMS_PORTALS.filter((p) => p.id === "bangor");
  assert.equal(portals.length, 1);
  sameJson(portals[0].origins, ["https://apps.bangor.ac.uk"]);
  assert.ok(ctx.SAMS_ENGINE);
});

test("bangor selector overrides target known personal and contact ids", () => {
  const cfg = loadBangor("/apply/personal/").SAMS_PORTALS.find((p) => p.id === "bangor");
  sameJson(cfg.selectorOverrides.givenName, ["#id_forename"]);
  sameJson(cfg.selectorOverrides.familyName, ["#id_surname"]);
  sameJson(cfg.selectorOverrides.phone, ["#id_phone_number"]);
  sameJson(cfg.selectorOverrides.funding, ["#id_choice"]);
  sameJson(cfg.selectorOverrides.institutionName, ["#id_institution"]);
});

test("bangor selector overrides cover programme, employment position, and passport", () => {
  const cfg = loadBangor("/apply/course/lookup/form/ug/").SAMS_PORTALS.find((p) => p.id === "bangor");
  sameJson(cfg.selectorOverrides.preferredCourse, ["#id_course"]);
  sameJson(cfg.selectorOverrides.cvCurrentJobTitle, ["#id_position"]);
  sameJson(cfg.selectorOverrides.passportNumber, ["#id_passport_number"]);
  sameJson(cfg.selectorOverrides.visaType, ["#id_visa_type"]);
});

test("bangor scopes salutation to the personal select and blocks the research title input", () => {
  const ctx = loadBangor("/apply/personal/");
  const cfg = ctx.SAMS_PORTALS.find((p) => p.id === "bangor");
  sameJson(cfg.selectorOverrides.title, ["select#id_title"]);
  assert.equal(
    ctx.SAMS_ENGINE.isFillable(fakeEl({ id: "id_title", name: "title", type: "text" })),
    false,
    "research free-text title input should be blocked"
  );
  assert.equal(
    ctx.SAMS_ENGINE.isFillable(fakeEl({ id: "id_title", name: "title", type: "select-one" })),
    true,
    "personal salutation select should remain fillable"
  );
});

test("bangor split dates cover passport expiry and visa validity", () => {
  const cfg = loadBangor("/apply/international/").SAMS_PORTALS.find((p) => p.id === "bangor");
  const spec = (key) => cfg.splitDates.find((entry) => entry.key === key);
  sameJson(spec("passportExpiryDate"), {
    key: "passportExpiryDate", page: "^/apply/international/",
    day: "#id_passport_expiry_date_day",
    month: "#id_passport_expiry_date_month",
    year: "#id_passport_expiry_date_year",
  });
  sameJson(spec("visaStartDate"), {
    key: "visaStartDate", page: "^/apply/international/",
    day: "#id_visa_start_day",
    month: "#id_visa_start_month",
    year: "#id_visa_start_year",
  });
  sameJson(spec("visaEndDate"), {
    key: "visaEndDate", page: "^/apply/international/",
    day: "#id_visa_end_day",
    month: "#id_visa_end_month",
    year: "#id_visa_end_year",
  });
});

test("bangor blocks DOB splits, chat widget, files, and finance name", () => {
  const ctx = loadBangor("/apply/personal/");
  assert.equal(typeof ctx.SAMS_ENGINE.isFillable, "function");
  const blocked = [
    { id: "id_dob_day", name: "dob_day", type: "select-one" },
    { id: "id_prompt_text", name: "prompt_text", type: "textarea" },
    { id: "id_transcript_file", name: "transcript_file", type: "file" },
    { id: "id_name", name: "name", type: "text" },
    { id: "id_country", name: "country", type: "select-one" },
    { id: "id_study_level", name: "study_level", type: "text" },
    { id: "id_visa_number", name: "visa_number", type: "text" },
    { id: "id_responsibilities", name: "responsibilities", type: "textarea" },
    { id: "id_scholarship_name", name: "scholarship_name", type: "select-one" },
    { id: "id_medi_code", name: "medi_code", type: "select-one" },
    { id: "id_european_settlement_0", name: "european_settlement", type: "radio" },
    { id: "id_address2", name: "address2", type: "text" },
    { id: "id_address3", name: "address3", type: "text" },
    { id: "id_state", name: "state", type: "select-one" },
    { id: "id_awarded_0", name: "awarded", type: "radio" },
    { id: "id_admission_offer_required_0", name: "admission_offer_required", type: "radio" },
    { id: "id_part_time", name: "part_time", type: "select-one" },
    { id: "id_term_month", name: "term_month", type: "select-one" },
    { id: "id_point_of_entry", name: "point_of_entry", type: "select-one" },
    { id: "id_academic_contact", name: "academic_contact", type: "text" },
  ];
  for (const spec of blocked) {
    assert.equal(
      ctx.SAMS_ENGINE.isFillable(fakeEl(spec)),
      false,
      `${spec.id} should be blocked from fill`
    );
  }
  assert.equal(
    ctx.SAMS_ENGINE.isFillable(fakeEl({ id: "id_forename", name: "forename", type: "text" })),
    true,
    "id_forename should remain fillable"
  );
});

test("bangor allowlist includes the confirmed origin", () => {
  const allowlist = require("../config/allowlist.js");
  assert.ok(allowlist.portalOrigins.includes("https://apps.bangor.ac.uk"));
  assert.ok(allowlist.portalOrigins.includes("https://nelson.gre.ac.uk"));
});

test("repeat autofill does not copy a filled address into another address line", async () => {
  const ctx = loadBangor("/apply/contacts/");
  const address1 = fakeEl({ id: "id_address1", name: "address1", label: "Address line 1" });
  const address2 = fakeEl({ id: "id_address2", name: "address2", label: "Address line 2" });
  const field = (element, label, overrideCrmKey) => ({
    element, name: element.name, id: element.id, label, type: "text", tagName: "input", autocomplete: "",
    currentValue: element.value, hasValue: !!element.value, nominatedContext: false, overrideCrmKey, visible: true, enabled: true,
  });
  await ctx.SAMS_ENGINE.autofillPage({ location: "1 Test Street" }, [field(address1, "Address line 1", "location"), field(address2, "Address line 2", "")]);
  assert.equal(address1.value, "1 Test Street");
  await ctx.SAMS_ENGINE.autofillPage({ location: "1 Test Street" }, [field(address1, "Address line 1", "location"), field(address2, "Address line 2", "")]);
  assert.equal(address2.value, "");
});
