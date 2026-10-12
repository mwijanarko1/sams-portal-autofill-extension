const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const EXTENSION_ID = "sams-extension";
const POPUP_SENDER = { id: EXTENSION_ID, url: `safari-web-extension://${EXTENSION_ID}/popup.html` };
const PORTAL_URL = "https://apps.bangor.ac.uk/apply/personal/";
const studentA = {
  studentId: "student-a",
  studentName: "Aisha Rahman",
  sourceOrigin: "https://app.samscrm.co.uk",
  copiedAt: 1700000000000,
  fields: { givenName: "Aisha", familyName: "Rahman", email: "aisha.rahman@example.com" },
};
const studentB = {
  studentId: "student-b",
  studentName: "Bilal Khan",
  sourceOrigin: "https://app.samscrm.co.uk",
  copiedAt: 1700000000000,
  fields: { givenName: "Bilal", familyName: "Khan" },
};

function runFile(context, file) {
  vm.runInContext(fs.readFileSync(path.resolve(file), "utf8"), context, { filename: file });
}

function loadWorker() {
  const session = {};
  const alarms = {};
  const heldReads = [];
  let holdingReads = false;
  let listener;
  let alarmListener;
  const chrome = {
    runtime: {
      id: EXTENSION_ID,
      getURL: (file) => `safari-web-extension://${EXTENSION_ID}/${file}`,
      onMessage: { addListener: (fn) => { listener = fn; } },
    },
    storage: {
      session: {
        // A held read returns the value stored when it was issued, like a slow storage round trip.
        get: async (key) => {
          const snapshot = key in session ? { [key]: structuredClone(session[key]) } : {};
          if (holdingReads) await new Promise((resolve) => heldReads.push(resolve));
          return snapshot;
        },
        set: async (items) => { Object.assign(session, structuredClone(items)); },
        remove: async (key) => { delete session[key]; },
      },
    },
    alarms: {
      create: async (name, info) => { alarms[name] = info.when; },
      clear: async (name) => delete alarms[name],
      onAlarm: { addListener: (fn) => { alarmListener = fn; } },
    },
  };
  const context = vm.createContext({ chrome, URL, console });
  context.globalThis = context;
  context.importScripts = (...files) => files.forEach((file) => runFile(context, path.join("src", file)));
  runFile(context, "src/background.js");
  const send = (message, sender = POPUP_SENDER) => new Promise((resolve) => {
    let responded = false;
    // Cloning mimics message serialization and returns objects from this realm.
    const keepOpen = listener(message, sender, (response) => { responded = true; resolve(structuredClone(response)); });
    if (!keepOpen && !responded) resolve(undefined);
  });
  const holdReads = () => { holdingReads = true; };
  const releaseReads = async () => {
    holdingReads = false;
    await settle();
    for (const resolve of heldReads.splice(0)) resolve();
  };
  const fireAlarm = (name = "expire-student-cache") => alarmListener({ name });
  return { send, session, alarms, holdReads, releaseReads, fireAlarm, heldReads };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function element(tag = "div") {
  const listeners = {};
  return {
    tag, hidden: false, disabled: false, textContent: "", className: "", children: [],
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    replaceChildren() { this.children = []; },
    addEventListener(type, fn) { listeners[type] = fn; },
    click() { return listeners.click(); },
  };
}

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].filter(Boolean).join("\n");
}

// Loads the real popup against the real worker with fake tab, frame and page APIs.
async function openPopup(worker, page) {
  const ids = ["btnCopy", "btnAutofill", "btnClear", "studentCard", "studentName", "studentMeta", "statusArea"];
  const elements = Object.fromEntries(ids.map((id) => [id, element()]));
  const calls = { injected: [], sent: [] };
  const workerActions = [];
  const chrome = {
    runtime: { sendMessage: (message) => { workerActions.push(message.action); return worker.send(message); } },
    tabs: {
      query: async () => [page.tab],
      sendMessage: async (tabId, message, options) => {
        calls.sent.push({ frameId: options.frameId, message: structuredClone(message) });
        return page.respond(options.frameId, message);
      },
    },
    webNavigation: { getAllFrames: async () => page.frames },
    scripting: {
      executeScript: async ({ target }) => {
        calls.injected.push([...target.frameIds]);
        if (target.frameIds.some((frameId) => (page.injectFails || []).includes(frameId))) {
          throw new Error(`Cannot access contents of url "${page.tab.url}?token=secret"`);
        }
      },
    },
  };
  const context = vm.createContext({
    chrome, URL, console, setInterval: () => 0, clearInterval: () => {},
    document: { getElementById: (id) => elements[id], createElement: (tag) => element(tag) },
  });
  context.globalThis = context;
  for (const file of ["config/build-mode.js", "config/allowlist.js", "popup.js"]) runFile(context, file);
  await new Promise((resolve) => setImmediate(resolve));
  const status = () => elements.statusArea.children.map((node) => ({ className: node.className, text: textOf(node) }));
  return { elements, calls, status, workerActions };
}

function portalPage(overrides = {}) {
  return {
    tab: { id: 7, url: PORTAL_URL },
    frames: [{ frameId: 0, url: PORTAL_URL }],
    respond: async () => ({ filled: [{ name: "givenName", fieldLabel: "Forename" }], skippedExisting: [], noCrmValue: [], manualReview: [], unmatched: [] }),
    ...overrides,
  };
}

const autofillMessages = (calls) => calls.sent.filter((call) => call.message.action === "autofill");

test("worker caches a valid popup profile and reports it on read", async () => {
  const worker = loadWorker();
  const before = Date.now();
  const { cache } = await worker.send({ action: "cacheStudent", profile: studentA });
  assert.deepEqual(cache.fields, studentA.fields);
  assert.equal(cache.studentName, "Aisha Rahman");
  assert.ok(cache.expiresAt >= before + 30 * 60 * 1000);
  assert.deepEqual((await worker.send({ action: "getStudentCache" })).cache, cache);
});

test("worker accepts the popup URL with a query string but rejects other senders without touching the cache", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const withQuery = { ...POPUP_SENDER, url: `${POPUP_SENDER.url}?view=1` };
  assert.equal((await worker.send({ action: "getStudentCache" }, withQuery)).cache.studentName, "Aisha Rahman");
  const rejected = [
    { id: EXTENSION_ID, url: "https://app.samscrm.co.uk/agent/leads/full-profile/student-a/", tab: { id: 1 } },
    { id: "another-extension", url: `safari-web-extension://another-extension/popup.html` },
    { id: EXTENSION_ID, url: `safari-web-extension://${EXTENSION_ID}/src/background.js` },
    { id: EXTENSION_ID },
  ];
  for (const sender of rejected) {
    for (const action of ["clearStudentCache", "getStudentCache", "touchStudentCache"]) {
      assert.deepEqual(await worker.send({ action }, sender),
        { error: "Student data actions are only available from the extension popup." }, `${action} ${sender.url}`);
    }
    assert.match((await worker.send({ action: "cacheStudent", profile: studentB }, sender)).error, /only available from the extension popup/);
  }
  assert.equal((await worker.send({ action: "getStudentCache" })).cache.studentName, "Aisha Rahman");
});

test("worker rejects malformed or unapproved profiles and keeps the valid cache", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const malformed = [
    undefined,
    { ...studentB, studentName: "" },
    { ...studentB, studentId: 42 },
    { ...studentB, sourceOrigin: "https://evil.example" },
    { ...studentB, sourceOrigin: "https://app.samscrm.co.uk/agent" },
    { ...studentB, copiedAt: "now" },
    { ...studentB, fields: [["givenName", "Bilal"], ["familyName", "Khan"]] },
    { ...studentB, fields: { givenName: "Bilal" } },
    { ...studentB, fields: { givenName: "Bilal", familyName: 7 } },
    { ...studentB, fields: { givenName: "Bilal", "family-name": "Khan" } },
    { ...studentB, fields: { givenName: "Bilal", familyName: "x".repeat(4001) } },
    { ...studentB, fields: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`field${i}`, "x"])) },
  ];
  for (const profile of malformed) {
    assert.deepEqual(await worker.send({ action: "cacheStudent", profile }),
      { error: "The copied student profile was not valid. Copy it again from an approved CRM profile." });
  }
  assert.deepEqual((await worker.send({ action: "getStudentCache" })).cache.fields, studentA.fields);
});

test("worker stores only the profile contract, so a caller cannot extend its own expiry", async () => {
  const worker = loadWorker();
  const { cache } = await worker.send({ action: "cacheStudent", profile: { ...studentA, expiresAt: 8640000000000000, extra: "x" } });
  assert.ok(cache.expiresAt < Date.now() + 31 * 60 * 1000);
  assert.equal("extra" in cache, false);
});

test("worker treats an expired cache as no student on read and touch", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  worker.session.studentCache.expiresAt = Date.now() - 1;
  assert.deepEqual(await worker.send({ action: "touchStudentCache" }), { cache: null });
  assert.deepEqual(await worker.send({ action: "getStudentCache" }), { cache: null });
  assert.deepEqual(worker.session, {});
});

test("Clear issued during a slow touch wins, so the touch cannot resurrect the student", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  worker.holdReads();
  const touched = worker.send({ action: "touchStudentCache" });
  await settle();
  const cleared = worker.send({ action: "clearStudentCache" });
  await worker.releaseReads();
  assert.equal((await touched).cache.studentName, "Aisha Rahman");
  assert.deepEqual(await cleared, { cleared: true });
  assert.deepEqual(worker.session, {});
  assert.deepEqual(worker.alarms, {});
  assert.deepEqual(await worker.send({ action: "getStudentCache" }), { cache: null });
});

test("Copy of another student during a slow touch is not overwritten by the earlier student", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  worker.holdReads();
  const touched = worker.send({ action: "touchStudentCache" });
  await settle();
  const copied = worker.send({ action: "cacheStudent", profile: studentB });
  await worker.releaseReads();
  assert.equal((await touched).cache.studentName, "Aisha Rahman");
  assert.equal((await copied).cache.studentName, "Bilal Khan");
  assert.equal(worker.session.studentCache.studentName, "Bilal Khan");
  assert.equal(worker.alarms["expire-student-cache"], worker.session.studentCache.expiresAt);
});

test("a stale expiry alarm keeps an extended cache and reschedules its own deadline", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  worker.session.studentCache.expiresAt = Date.now() + 1000;
  const { cache } = await worker.send({ action: "touchStudentCache" });
  delete worker.alarms["expire-student-cache"];
  worker.fireAlarm();
  assert.equal((await worker.send({ action: "getStudentCache" })).cache.studentName, "Aisha Rahman");
  assert.equal(worker.alarms["expire-student-cache"], cache.expiresAt);
});

test("a stale expiry alarm after a new Copy keeps the replacement student", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  await worker.send({ action: "cacheStudent", profile: studentB });
  worker.fireAlarm();
  assert.equal((await worker.send({ action: "getStudentCache" })).cache.studentName, "Bilal Khan");
});

// Without serialization, the alarm's earlier read of expired A would remove B once released.
test("an expiry alarm racing a new Copy removes only the expired student", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  worker.session.studentCache.expiresAt = Date.now() - 1;
  worker.holdReads();
  worker.fireAlarm();
  await settle();
  const copied = worker.send({ action: "cacheStudent", profile: studentB });
  await worker.releaseReads();
  assert.equal((await copied).cache.studentName, "Bilal Khan");
  assert.equal((await worker.send({ action: "getStudentCache" })).cache.studentName, "Bilal Khan");
  assert.equal(worker.alarms["expire-student-cache"], worker.session.studentCache.expiresAt);
});

test("a due expiry alarm removes the student and its alarm", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  worker.session.studentCache.expiresAt = Date.now() - 1;
  worker.fireAlarm();
  assert.deepEqual(await worker.send({ action: "getStudentCache" }), { cache: null });
  assert.deepEqual(worker.session, {});
  assert.deepEqual(worker.alarms, {});
});

test("Autofill sends nothing after Clear in another popup", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const popup = await openPopup(worker, portalPage());
  assert.equal(popup.elements.studentName.textContent, "Aisha Rahman");
  await worker.send({ action: "clearStudentCache" });
  await popup.elements.btnAutofill.click();
  assert.deepEqual(autofillMessages(popup.calls), []);
  assert.deepEqual(popup.status(), [{ className: "status error", text: "No copied student is available. Copy from CRM again before Autofill." }]);
  assert.equal(popup.elements.studentCard.hidden, true);
  assert.equal(popup.elements.btnAutofill.disabled, true);
});

test("Autofill sends nothing once the worker cache has expired", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const popup = await openPopup(worker, portalPage());
  worker.session.studentCache.expiresAt = Date.now() - 1;
  await popup.elements.btnAutofill.click();
  assert.deepEqual(autofillMessages(popup.calls), []);
  assert.equal(popup.elements.btnAutofill.disabled, true);
});

test("Autofill sends the worker's current student, not the popup's earlier copy", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const popup = await openPopup(worker, portalPage());
  await worker.send({ action: "cacheStudent", profile: studentB });
  await popup.elements.btnAutofill.click();
  assert.deepEqual(autofillMessages(popup.calls).map((call) => call.message.fieldMap), [{ givenName: "Bilal", familyName: "Khan" }]);
  assert.equal(popup.elements.studentName.textContent, "Bilal Khan");
  assert.equal(popup.status()[0].className, "status success");
});

test("a null cache after Autofill clears the popup instead of keeping the old student", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const page = portalPage();
  const respond = page.respond;
  page.respond = async (...args) => {
    await worker.send({ action: "clearStudentCache" });
    return respond(...args);
  };
  const popup = await openPopup(worker, page);
  await popup.elements.btnAutofill.click();
  assert.equal(popup.status()[0].text, "1 fields filled. Draft only: review the form and submit it yourself.");
  assert.equal(popup.elements.studentCard.hidden, true);
  assert.equal(popup.elements.btnAutofill.disabled, true);
});

test("mixed frame outcomes keep successful counts and name each failed frame", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const popup = await openPopup(worker, portalPage({
    frames: [
      { frameId: 0, url: PORTAL_URL },
      { frameId: 3, url: "https://apps.bangor.ac.uk/apply/frame" },
      { frameId: 5, url: "https://evil.example/frame" },
      { frameId: 9, url: "https://apps.bangor.ac.uk/apply/locked" },
    ],
    injectFails: [9],
    respond: async (frameId) => {
      if (frameId === 3) throw new Error("Could not establish connection. Receiving end does not exist.");
      return { filled: [{ name: "givenName", fieldLabel: "Forename" }, { name: "email", fieldLabel: "Email" }], skippedExisting: [], noCrmValue: [], manualReview: [], unmatched: [] };
    },
  }));
  await popup.elements.btnAutofill.click();
  assert.deepEqual(popup.calls.injected, [[0], [3], [9]]);
  assert.deepEqual(autofillMessages(popup.calls).map((call) => call.frameId), [0, 3]);
  const [summary, failures, filled] = popup.status();
  assert.deepEqual(summary, {
    className: "status warning",
    text: "2 fields filled in 1 of 3 page frames. Some frames were not filled: review the whole page before continuing.",
  });
  assert.equal(failures.text, [
    "Frames not filled (2)",
    "Frame 3: The page frame did not respond.",
    "Frame 9: Could not access this page. If it is an approved website, allow SAMS Portal Autofill to access it, reload the page, and try again.",
  ].join("\n"));
  assert.equal(filled.text, "Filled (2)\nForename\nEmail");
  assert.equal(popup.elements.studentCard.hidden, false);
  // Chrome compatibility: any successful approved frame counts as activity.
  assert.deepEqual(popup.workerActions, ["getStudentCache", "getStudentCache", "touchStudentCache"]);
});

test("Autofill reports an error when every approved frame fails", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const before = worker.session.studentCache.expiresAt;
  const popup = await openPopup(worker, portalPage({ respond: async () => ({ error: "Autofill engine is unavailable." }) }));
  await popup.elements.btnAutofill.click();
  assert.deepEqual(popup.status(), [{ className: "status error", text: "Autofill engine is unavailable." }]);
  assert.equal(popup.workerActions.includes("touchStudentCache"), false, "All-frame failure must not extend retention");
  assert.equal(worker.session.studentCache.expiresAt, before);
});

test("a withheld tab URL fails closed with website-access guidance", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const popup = await openPopup(worker, portalPage({ tab: { id: 7 } }));
  await popup.elements.btnAutofill.click();
  assert.deepEqual(popup.status(), [{
    className: "status error",
    text: "Open an approved university portal form first. If it is already open, allow SAMS Portal Autofill to access this website, then try again.",
  }]);
  await popup.elements.btnCopy.click();
  assert.equal(popup.status()[0].text,
    "Open an approved SAMS CRM or Campora student profile first. If it is already open, allow SAMS Portal Autofill to access this website, then try again.");
  assert.deepEqual(popup.calls, { injected: [], sent: [] });
});

test("a denied CRM injection reports website access without the page URL and keeps the cache", async () => {
  const worker = loadWorker();
  await worker.send({ action: "cacheStudent", profile: studentA });
  const crmUrl = "https://app.samscrm.co.uk/agent/leads/full-profile/student-b/";
  const popup = await openPopup(worker, portalPage({ tab: { id: 7, url: crmUrl }, injectFails: [0] }));
  await popup.elements.btnCopy.click();
  assert.deepEqual(popup.status(), [{
    className: "status error",
    text: "Could not access this page. If it is an approved website, allow SAMS Portal Autofill to access it, reload the page, and try again.",
  }]);
  assert.deepEqual(popup.calls.sent, []);
  assert.equal((await worker.send({ action: "getStudentCache" })).cache.studentName, "Aisha Rahman");
});
