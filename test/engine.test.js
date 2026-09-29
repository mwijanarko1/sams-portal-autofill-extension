const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  URL,
  location: { origin: "http://localhost:3001", pathname: "/" },
});
context.globalThis = context;
vm.runInContext(fs.readFileSync("config/synonyms.js", "utf8"), context);
vm.runInContext(fs.readFileSync("src/engine/engine.js", "utf8"), context);

function clickTarget(text, selector) {
  return {
    textContent: text,
    clicked: false,
    getAttribute: () => "",
    closest: () => null,
    matches: (query) => query.includes(selector),
    click() { this.clicked = true; },
  };
}

test("click guard blocks irreversible controls", () => {
  const submit = clickTarget("Confirm and submit", "radio");
  assert.equal(context.SAMS_ENGINE.safeClick(submit, "radio"), false);
  assert.equal(submit.clicked, false);
});

test("click guard allows a radio input", () => {
  const radio = clickTarget("Self Funding", "radio");
  assert.equal(context.SAMS_ENGINE.safeClick(radio, "radio"), true);
  assert.equal(radio.clicked, true);
});

test("date fields receive ISO values", () => {
  const input = {
    getAttribute: (name) => name === "type" ? "date" : "",
    closest: () => null,
    name: "dateOfBirth",
    parentElement: null,
  };
  assert.equal(
    context.SAMS_ENGINE.formatValueForField(input, "06/01/2003", { label: "Date of Birth" }),
    "2003-01-06"
  );
});

test("reinjection preserves portal synonyms and does not duplicate portal configs", () => {
  const reinjected = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    URL,
    location: { origin: "https://portal.example", pathname: "/apply" },
  });
  reinjected.globalThis = reinjected;
  vm.runInContext(fs.readFileSync("config/synonyms.js", "utf8"), reinjected);
  reinjected.SAMS_PORTALS = [{
    id: "test",
    origins: ["https://portal.example"],
    pageMatchers: [],
    selectorOverrides: {},
    extraSynonyms: { givenName: ["portal-only-name"] },
    blockedControls: [],
  }];
  vm.runInContext(fs.readFileSync("src/engine/engine.js", "utf8"), reinjected);
  vm.runInContext(fs.readFileSync("config/synonyms.js", "utf8"), reinjected);
  vm.runInContext(fs.readFileSync("src/engine/engine.js", "utf8"), reinjected);
  assert.ok(reinjected.SAMS_SYNONYMS.SYNONYM_MAP.givenName.includes("portal-only-name"));

  vm.runInContext(fs.readFileSync("config/portals/greenwich.js", "utf8"), reinjected);
  vm.runInContext(fs.readFileSync("config/portals/greenwich.js", "utf8"), reinjected);
  assert.equal(reinjected.SAMS_PORTALS.filter((portal) => portal.id === "greenwich").length, 1);
});
