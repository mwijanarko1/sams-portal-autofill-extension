const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadGreenwich(pathname) {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    URL,
    location: { origin: "https://nelson.gre.ac.uk", pathname },
  });
  context.globalThis = context;
  context.window = {
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
  };
  context.document = { querySelector: () => null };
  vm.runInContext(fs.readFileSync("config/synonyms.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("config/portals/greenwich.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/engine/engine.js", "utf8"), context);
  return context;
}

function fakeEl({ id, name = "", label = "", type = "text" }) {
  return {
    id,
    name,
    tagName: "INPUT",
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
      if (selector === `input[name='${name}']` || selector === `input[name="${name}"]`) {
        return true;
      }
      return false;
    },
    closest: () => null,
    parentElement: null,
  };
}

function sameJson(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test("greenwich config loads once for nelson origin", () => {
  const ctx = loadGreenwich("/pls/prod/bwskanam.P_DispAppName");
  const portals = ctx.SAMS_PORTALS.filter((p) => p.id === "greenwich");
  assert.equal(portals.length, 1);
  sameJson(portals[0].origins, ["https://nelson.gre.ac.uk"]);
});

test("greenwich does not override split DOB or shared address ids", () => {
  const cfg = loadGreenwich("/pls/prod/bwskaper.P_DispAppPersonal").SAMS_PORTALS.find(
    (p) => p.id === "greenwich"
  );
  assert.equal(cfg.selectorOverrides.dateOfBirth, undefined);
  assert.equal(cfg.selectorOverrides.location, undefined);
  assert.equal(cfg.selectorOverrides.city, undefined);
  assert.equal(cfg.selectorOverrides.postcode, undefined);
  const flat = Object.values(cfg.selectorOverrides).flat();
  assert.equal(flat.includes("#bday_dd"), false);
  assert.equal(flat.includes("#addr1"), false);
  assert.equal(flat.includes("#city"), false);
  assert.equal(flat.includes("#zip"), false);
});

test("greenwich blocks DOB selects, referee fields, and signature", () => {
  const ctx = loadGreenwich("/pls/prod/bwskaudf.P_DispAppUserDef");
  assert.equal(typeof ctx.SAMS_ENGINE.isFillable, "function");
  const blocked = [
    "bday_dd",
    "bday_mm",
    "bday_yyyy",
    "ud17",
    "ud18",
    "ud19",
    "ud22",
    "ud23",
    "ud25",
    "ud30",
    "ud130",
    "ud131",
  ];
  for (const id of blocked) {
    const el = fakeEl({ id, label: id });
    assert.equal(
      ctx.SAMS_ENGINE.isFillable(el),
      false,
      `${id} should be blocked from fill`
    );
  }
});

test("greenwich still allows applicant name and email overrides", () => {
  const ctx = loadGreenwich("/pls/prod/bwskanam.P_DispAppName");
  const cfg = ctx.SAMS_PORTALS.find((p) => p.id === "greenwich");
  sameJson(cfg.selectorOverrides.givenName, ["#fname"]);
  sameJson(cfg.selectorOverrides.email, ["#email", "#dup_email"]);
  sameJson(cfg.selectorOverrides.phone, ["#mobiletelno", "#hometelno"]);
  assert.equal(cfg.selectorOverrides.email.includes("#ud18"), false);
});
