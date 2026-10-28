const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadGreenwich(pathname) {
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
    location: { origin: "https://nelson.gre.ac.uk", pathname },
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
  vm.runInContext(fs.readFileSync("config/portals/greenwich.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/engine/engine.js", "utf8"), context);
  return context;
}

function fakeEl({
  id,
  name = "",
  label = "",
  type = "text",
  formAction = "",
} = {}) {
  const el = {
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
      if (selector.includes(":not(")) {
        const target = selector.split(":not(")[0];
        if (target !== `#${id}` && target !== `input[name='${name}']`) return false;
        const scopes = [...selector.matchAll(/form\[action\*='([^']+)'\]/g)];
        return !scopes.some((match) => formAction.includes(match[1]));
      }
      if (selector === `#${id}`) return true;
      if (selector === `input[name='${name}']` || selector === `input[name="${name}"]`) {
        return true;
      }
      // Compound form-scoped blocks, e.g. form[action*='P_ProcAppPrvCollege'] #city
      if (
        formAction &&
        selector.includes("form[action*='") &&
        selector.includes(`#${id}`)
      ) {
        const actionMatch = selector.match(/form\[action\*='([^']+)'\]/);
        if (actionMatch && formAction.includes(actionMatch[1])) return true;
      }
      return false;
    },
    closest: (selector) => {
      if (!formAction) return null;
      if (selector.startsWith("form") && formAction.includes("P_ProcAppPrvCollege")) {
        return { tagName: "FORM", getAttribute: () => formAction };
      }
      return null;
    },
    parentElement: null,
    dispatchEvent: () => true,
    focus: () => {},
    blur: () => {},
  };
  return el;
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

test("greenwich keeps split DOB and scopes applicant address overrides", () => {
  const cfg = loadGreenwich("/pls/prod/bwskaper.P_DispAppPersonal").SAMS_PORTALS.find(
    (p) => p.id === "greenwich"
  );
  assert.equal(cfg.selectorOverrides.dateOfBirth, undefined);
  sameJson(cfg.selectorOverrides.location, ["form[action*='bwskaadr.P_ProcAppAddr2'] #addr1"]);
  sameJson(cfg.selectorOverrides.city, ["form[action*='bwskaadr.P_ProcAppAddr2'] #city"]);
  sameJson(cfg.selectorOverrides.postcode, ["form[action*='bwskaadr.P_ProcAppAddr2'] #zip"]);
  sameJson(cfg.selectorOverrides.countryName, ["form[action*='bwskaadr.P_ProcAppAddr2'] #natn"]);
  sameJson(cfg.selectorOverrides.currentDomicile, ["#ud70"]);
  const flat = Object.values(cfg.selectorOverrides).flat();
  assert.equal(flat.includes("#bday_dd"), false);
});

test("greenwich split dates cover qualification and education attendance", () => {
  const cfg = loadGreenwich("/pls/prod/bwskapcl.P_DispQuals").SAMS_PORTALS.find(
    (p) => p.id === "greenwich"
  );
  const spec = (key, page) => cfg.splitDates.find((entry) => entry.key === key && entry.page.includes(page));
  sameJson(spec("endDate", "P_DispQuals"), {
    key: "endDate",
    page: "bwskapcl\\.P_DispQuals",
    form: "bwskapcl\\.P_ProcQuals",
    month: "#ud91month",
    year: "#ud91year",
  });
  sameJson(spec("startDate", "P_DispAppPrvCollege"), {
    key: "startDate",
    page: "bwskapcl\\.P_DispAppPrvCollege",
    form: "bwskapcl\\.P_ProcAppPrvCollege",
    day: "#beg_date_dd",
    month: "#beg_date_mm",
    year: "#beg_date_yyyy",
  });
  sameJson(spec("endDate", "P_DispAppPrvCollege"), {
    key: "endDate",
    page: "bwskapcl\\.P_DispAppPrvCollege",
    form: "bwskapcl\\.P_ProcAppPrvCollege",
    day: "#end_date_dd",
    month: "#end_date_mm",
    year: "#end_date_yyyy",
  });
  sameJson(spec("preferredIntake", "P_DispAppPlan"), {
    key: "preferredIntake",
    page: "bwskapln\\.P_DispAppPlan",
    form: "bwskapln\\.P_ProcAppPlan",
    month: "#p_month",
    year: "#p_year",
  });
});

test("greenwich blocks agent id, interview dates, and teacher-training subject mis-matches", () => {
  const ctx = loadGreenwich("/pls/prod/bwskanam.P_DispAppName");
  for (const id of ["ud3", "ud8", "ud138", "addr2", "addr3", "ud91month", "ud91year", "p_month", "p_year"]) {
    assert.equal(ctx.SAMS_ENGINE.isFillable(fakeEl({ id, label: id })), false, `${id} should be blocked`);
  }
  assert.equal(
    ctx.SAMS_ENGINE.isFillable(fakeEl({ id: "addrflag", name: "addrflag", type: "radio" })),
    false,
    "unscoped mailing-address radio should be blocked"
  );
  assert.equal(
    ctx.SAMS_ENGINE.isFillable(fakeEl({ id: "", name: "ud204", type: "checkbox" })),
    false,
    "name-only ud204 checkbox should be blocked"
  );
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

test("greenwich blocks institution city/postcode on Previous Education form", () => {
  const ctx = loadGreenwich("/pls/prod/bwskapcl.P_DispAppPrvCollege");
  const cfg = ctx.SAMS_PORTALS.find((p) => p.id === "greenwich");
  assert.ok(
    cfg.blockedControls.some((s) => s.includes("P_ProcAppPrvCollege") && s.includes("#city"))
  );
  assert.ok(
    cfg.blockedControls.some((s) => s.includes("P_ProcAppPrvCollege") && s.includes("#zip"))
  );
  assert.ok(
    cfg.blockedControls.some((s) => s.includes("P_ProcAppPrvCollege") && s.includes("#natn"))
  );
  assert.ok(
    cfg.blockedControls.some((s) => s.includes(":not(") && s.includes("#addr1"))
  );

  const institutionCity = fakeEl({
    id: "city",
    name: "city",
    label: "City",
    formAction: "bwskapcl.P_ProcAppPrvCollege",
  });
  const institutionZip = fakeEl({
    id: "zip",
    name: "zip",
    label: "Postcode",
    formAction: "bwskapcl.P_ProcAppPrvCollege",
  });
  const applicantCity = fakeEl({
    id: "city",
    name: "city",
    label: "City",
    formAction: "bwskaadr.P_ProcAppAddr1",
  });

  assert.equal(ctx.SAMS_ENGINE.isFillable(institutionCity), false);
  assert.equal(ctx.SAMS_ENGINE.isFillable(institutionZip), false);
  assert.equal(ctx.SAMS_ENGINE.isFillable(applicantCity), true);
});

test("greenwich autofill skips institution city and can still fill applicant city", async () => {
  const ctx = loadGreenwich("/pls/prod/bwskapcl.P_DispAppPrvCollege");
  const institutionCity = fakeEl({
    id: "city",
    name: "city",
    label: "City",
    formAction: "bwskapcl.P_ProcAppPrvCollege",
  });
  const applicantCity = fakeEl({
    id: "city",
    name: "city",
    label: "City",
    formAction: "bwskaadr.P_ProcAppAddr1",
  });

  // Scan-time gate: institution address fields never enter the fillable set.
  assert.equal(ctx.SAMS_ENGINE.isFillable(institutionCity), false);
  assert.equal(ctx.SAMS_ENGINE.isFillable(applicantCity), true);

  const fields = [
    {
      element: applicantCity,
      name: "city",
      id: "city",
      label: "City",
      type: "text",
      tagName: "input",
      autocomplete: "",
      currentValue: "",
      hasValue: false,
      nominatedContext: false,
      overrideCrmKey: "permanentCity",
      visible: true,
      enabled: true,
    },
  ];
  const result = await ctx.SAMS_ENGINE.autofillPage({ permanentCity: "Leeds" }, fields);
  assert.equal(applicantCity.value, "Leeds");
  assert.equal(institutionCity.value, "");
  assert.ok(result.filled.some((row) => row.name === "permanentCity"));
});

// Scanned-field shape for autofillPage, with the override key the config assigns.
function scanned(ctx, el, label) {
  const cfg = ctx.SAMS_PORTALS.find((p) => p.id === "greenwich");
  const overrideCrmKey =
    Object.keys(cfg.selectorOverrides).find((key) =>
      cfg.selectorOverrides[key].includes(`#${el.id}`)
    ) || "";
  return {
    element: el,
    name: el.name,
    id: el.id,
    label,
    type: "text",
    tagName: "input",
    autocomplete: "",
    currentValue: el.value,
    hasValue: !!el.value,
    nominatedContext: false,
    overrideCrmKey,
    visible: true,
    enabled: true,
  };
}

test("greenwich fills qualification row 1 only, including Level from CRM degree", async () => {
  const ctx = loadGreenwich("/pls/prod/bwskaess.P_DispAppQual");
  const crm = { degree: "Bachelors", major: "Computer Science", grade: "First" };
  const row = (n) => ({
    level: fakeEl({ id: `ud${n}qualtype`, name: `ud${n}qualtype`, label: "Level" }),
    subject: fakeEl({ id: `ud${n}subject`, name: `ud${n}subject`, label: "Subject including Modules or Units" }),
    grade: fakeEl({ id: `ud${n}grade`, name: `ud${n}grade`, label: "Grade leave blank if pending" }),
  });

  // Rows 2-20 never enter the fillable set, so a repeat click cannot spill into them.
  for (let n = 92; n <= 110; n++) {
    for (const field of ["qualtype", "subject", "grade", "month", "year"]) {
      const id = `ud${n}${field}`;
      assert.equal(ctx.SAMS_ENGINE.isFillable(fakeEl({ id, name: id })), false, `${id} should be blocked`);
    }
  }

  const row1 = row(91);
  const fields = () =>
    [row1.level, row1.subject, row1.grade]
      .filter((el) => ctx.SAMS_ENGINE.isFillable(el))
      .map((el) => scanned(ctx, el, el.getAttribute("aria-label")));
  await ctx.SAMS_ENGINE.autofillPage(crm, fields());
  assert.equal(row1.level.value, "Bachelors");
  assert.equal(row1.subject.value, "Computer Science");
  assert.equal(row1.grade.value, "First");

  const again = await ctx.SAMS_ENGINE.autofillPage(crm, fields());
  assert.equal(again.filled.length, 0);
});

test("greenwich phone fields keep the dialling prefix", async () => {
  const ctx = loadGreenwich("/pls/prod/bwskaadr.P_DispAppAddr");
  const fill = async (phone) => {
    const mobile = fakeEl({ id: "mobiletelno", name: "mobiletelno", label: "Mobile Telephone No." });
    const home = fakeEl({ id: "hometelno", name: "hometelno", label: "Home Telephone No." });
    await ctx.SAMS_ENGINE.autofillPage({ phone }, [
      scanned(ctx, mobile, "Mobile Telephone No."),
      scanned(ctx, home, "Home Telephone No."),
    ]);
    return [mobile.value, home.value];
  };
  sameJson(await fill("+44 7700 900123"), ["07700900123", "07700900123"]);
  sameJson(await fill("+44 (0) 7700 900123"), ["07700900123", "07700900123"]);
  sameJson(await fill("0044 7700 900123"), ["07700900123", "07700900123"]);
  sameJson(await fill("+880 1712-345678"), ["+8801712345678", "+8801712345678"]);
});
