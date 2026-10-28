const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadManchester(pathname) {
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
    location: { origin: "https://evision.bolton.ac.uk", pathname },
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
  vm.runInContext(fs.readFileSync("config/portals/manchester.js", "utf8"), context);
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
      if (selector === `#${id}`) return true;
      if (selector === "input[type='password']" && type === "password") return true;
      if (selector === "input[type='button']" && type === "button") return true;
      if (selector === "input[type='submit']" && type === "submit") return true;
      if (selector === "input[type='file']" && type === "file") return true;
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

test("manchester config loads once for evision.bolton.ac.uk IPP path", () => {
  const ctx = loadManchester("/urd/sits.urd/run/SIW_IPP_USR.start_url");
  const portals = ctx.SAMS_PORTALS.filter((p) => p.id === "greater-manchester");
  assert.equal(portals.length, 1);
  sameJson(portals[0].origins, ["https://evision.bolton.ac.uk"]);
  assert.ok(ctx.SAMS_ENGINE);
});

test("manchester selector overrides target known personal and contact ids", () => {
  const cfg = loadManchester("/urd/sits.urd/run/SIW_IPP_USR.start_url").SAMS_PORTALS.find(
    (p) => p.id === "greater-manchester"
  );
  sameJson(cfg.selectorOverrides.givenName, ["#IPR_FNM1"]);
  sameJson(cfg.selectorOverrides.familyName, ["#IPR_SURN"]);
  sameJson(cfg.selectorOverrides.location, ["#IPR_CAD1"]);
  sameJson(cfg.selectorOverrides.state, ["#IPR_CAD4"]);
  sameJson(cfg.selectorOverrides.phone, ["#IPR_HAT3", "#IPR_HTEL"]);
  sameJson(cfg.selectorOverrides.email, ["#IPR_CAEM"]);
  sameJson(cfg.selectorOverrides.currentDomicile, ["#IPQ_OA_COD"]);
  sameJson(cfg.selectorOverrides.cvCurrentJobTitle, ["#IPQ_OA_CRJOB"]);
  sameJson(cfg.selectorOverrides.englishFirstLanguage, ["#IPQ_OA_ENGFIRST"]);
  sameJson(cfg.selectorOverrides.previouslyApplied, ["#IPQ_OA_ALUM"]);
  sameJson(cfg.selectorOverrides.institutionName, ["#IPQ_OA_QUINS1"]);
  sameJson(cfg.selectorOverrides.personalStatement, ["#IPQ_OA_PS"]);
  assert.ok(cfg.splitDates.some((spec) => spec.key === "dateOfBirth"));
  assert.ok(cfg.splitDates.some((spec) => spec.key === "graduationYear"));
});

test("manchester blocks auth, save, DOB splits, unsupported correspondence, and row 2 quals", () => {
  const ctx = loadManchester("/urd/sits.urd/run/SIW_IPP_USR.start_url");
  assert.equal(typeof ctx.SAMS_ENGINE.isFillable, "function");
  const blocked = [
    { id: "MUA_CODE", name: "", type: "text" },
    { id: "PASSWORD", name: "", type: "password" },
    { id: "but_save", name: "", type: "button" },
    { id: "but_save_and_cont", name: "", type: "button" },
    { id: "IPR_DOB_DAY", name: "", type: "select-one" },
    { id: "IPR_CAD2", name: "", type: "text" },
    { id: "IPQ_OA_QUINS2", name: "", type: "text" },
    { id: "IPQ_OA_AGREE", name: "", type: "checkbox" },
  ];
  for (const spec of blocked) {
    assert.equal(
      ctx.SAMS_ENGINE.isFillable(fakeEl(spec)),
      false,
      `${spec.id} should be blocked from fill`
    );
  }
  assert.equal(
    ctx.SAMS_ENGINE.isFillable(fakeEl({ id: "IPR_FNM1", name: "IPR_FNM1", type: "text" })),
    true,
    "IPR_FNM1 should remain fillable"
  );
  for (const id of ["IPQ_OA_COD", "IPQ_OA_CRJOB", "IPQ_OA_ENGFIRST", "IPQ_OA_ALUM", "IPR_CAD4"]) {
    assert.equal(
      ctx.SAMS_ENGINE.isFillable(fakeEl({ id, name: id, type: id.includes("CRJOB") ? "textarea" : "text" })),
      true,
      `${id} is a CRM-mapped control and must stay fillable`
    );
  }
});

test("manchester allowlist includes the confirmed origin", () => {
  const allowlist = require("../config/allowlist.js");
  assert.ok(allowlist.portalOrigins.includes("https://evision.bolton.ac.uk"));
});
