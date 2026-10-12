const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fakeSelect(id, options) {
  const select = {
    id,
    name: id,
    tagName: "SELECT",
    disabled: false,
    selectedIndex: 0,
    options: options.map(([value, text], index) => ({ value, textContent: text, index, selected: index === 0 })),
    dispatchEvent: () => true,
    getRootNode: () => null,
  };
  Object.defineProperty(select, "value", {
    get: () => select.options[select.selectedIndex].value,
    set: (value) => { select.selectedIndex = Math.max(0, select.options.findIndex((option) => option.value === value)); },
  });
  return select;
}

const days = [["", ""], ...Array.from({ length: 31 }, (_, i) => [String(i + 1).padStart(2, "0"), String(i + 1).padStart(2, "0")])];
const numericMonths = [["", ""], ...Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, "0"), String(i + 1).padStart(2, "0")])];
const namedMonths = [["", "Month"], ...["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((name, i) => [String(i + 1), name])];
const years = [["", "Year"], ...Array.from({ length: 40 }, (_, i) => [String(2030 - i), String(2030 - i)])];

function load(portal, origin, pathname, selects) {
  function FakeEvent(type) { this.type = type; }
  const byId = Object.fromEntries(selects.map((select) => [`#${select.id}`, select]));
  const context = vm.createContext({
    console, setTimeout, clearTimeout, URL, Event: FakeEvent, CustomEvent: FakeEvent, KeyboardEvent: FakeEvent,
    location: { origin, pathname, search: "" },
  });
  context.globalThis = context;
  context.window = { getComputedStyle: () => ({ display: "block", visibility: "visible" }), HTMLSelectElement: { prototype: {} } };
  context.document = { querySelector: (selector) => byId[selector] || null };
  vm.runInContext(fs.readFileSync("config/synonyms.js", "utf8"), context);
  vm.runInContext(fs.readFileSync(`config/portals/${portal}.js`, "utf8"), context);
  vm.runInContext(fs.readFileSync("src/engine/engine.js", "utf8"), context);
  return context;
}

const crm = { dateOfBirth: "2001-04-15", cvWorkStartDate: "2023-07-01", cvWorkEndDate: "2024-06-30", startDate: "September 2019", endDate: "June 2023", graduationYear: "2023" };
const chosen = (select) => select.options[select.selectedIndex].textContent;

test("greenwich split date of birth fills only on Statistical Information", async () => {
  const selects = [fakeSelect("bday_dd", days), fakeSelect("bday_mm", numericMonths), fakeSelect("bday_yyyy", years)];
  const ctx = load("greenwich", "https://nelson.gre.ac.uk", "/pls/prod/bwskaper.P_DispAppPersonal", selects);
  const result = await ctx.SAMS_ENGINE.autofillPage(crm, []);
  assert.deepEqual(selects.map(chosen), ["15", "04", "2001"]);
  assert.equal(result.filled.length, 3);
  assert.equal((await ctx.SAMS_ENGINE.autofillPage(crm, [])).filled.length, 0);
});

test("greenwich reused #bday ids take the work dates on Employment", async () => {
  const selects = ["", "2"].flatMap((suffix) => [fakeSelect(`bday_dd${suffix}`, days), fakeSelect(`bday_mm${suffix}`, numericMonths), fakeSelect(`bday_yyyy${suffix}`, years)]);
  const ctx = load("greenwich", "https://nelson.gre.ac.uk", "/pls/prod/bwskaess.P_DispAppEssay", selects);
  await ctx.SAMS_ENGINE.autofillPage(crm, []);
  assert.deepEqual(selects.map(chosen), ["01", "07", "2023", "30", "06", "2024"]);
});

test("bangor education month-year dates fill named month selects", async () => {
  const selects = [fakeSelect("id_course_start_date", namedMonths), fakeSelect("id_course_start_date_year", years),
    fakeSelect("id_course_end_date", namedMonths), fakeSelect("id_course_end_date_year", years), fakeSelect("id_qualification_date_year", years)];
  const ctx = load("bangor", "https://apps.bangor.ac.uk", "/apply/education/form/", selects);
  await ctx.SAMS_ENGINE.autofillPage(crm, []);
  assert.deepEqual(selects.map(chosen), ["September", "2019", "June", "2023", "2023"]);
});

test("split dates keep a value the applicant already chose", async () => {
  const day = fakeSelect("id_dob_day", days);
  day.selectedIndex = 3;
  const ctx = load("bangor", "https://apps.bangor.ac.uk", "/apply/personal/", [day, fakeSelect("id_dob_month", namedMonths), fakeSelect("id_dob_year", years)]);
  await ctx.SAMS_ENGINE.autofillPage(crm, []);
  assert.equal(chosen(day), "03");
});
