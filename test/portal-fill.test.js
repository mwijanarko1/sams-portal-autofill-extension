const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const EXTENSION_ID = "sams-extension";
const POPUP = { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/popup.html` };
const FORM = "https://apply.example-university.test";
const PAGE_CHANGED = { error: "This page changed. Open the extension again on the form." };
const prepare = { action: "prepare", origin: FORM };
const autofill = { action: "autofill", fieldMap: { givenName: "Aisha" } };

// Loads the real handler in a document with these origins. topOrigin "cross-origin" makes reading it throw.
function loadHandler({ origin = FORM, selfOrigin = origin, topOrigin = origin } = {}) {
  let onConnect;
  const chrome = {
    runtime: {
      id: EXTENSION_ID,
      getURL: (file) => `chrome-extension://${EXTENSION_ID}/${file}`,
      onConnect: { addListener: (fn) => { onConnect = fn; } },
    },
  };
  const top = topOrigin === "cross-origin"
    ? { get location() { throw new Error("Blocked a frame from accessing a cross-origin frame."); } }
    : { location: { origin: topOrigin } };
  const context = vm.createContext({
    chrome, URL, location: { origin }, self: { origin: selfOrigin }, window: { top },
    SAMS_ENGINE: {
      scanFormFields: () => [],
      autofillPage: async (fieldMap) => ({ mapping: null, filled: Object.keys(fieldMap) }),
    },
  });
  context.globalThis = context;
  for (const file of ["config/build-mode.js", "config/allowlist.js", "src/portal-fill.js"]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }
  return async (sender, messages) => {
    const replies = [];
    const listeners = [];
    let disconnected = false;
    onConnect({
      name: "sams-autofill",
      sender,
      postMessage: (message) => replies.push(structuredClone(message)),
      disconnect: () => { disconnected = true; },
      onMessage: { addListener: (fn) => listeners.push(fn) },
    });
    for (const message of messages) for (const listener of listeners) await listener(message);
    return { replies, disconnected };
  };
}

test("the selected page fills only after the popup prepares its own origin", async () => {
  const connect = loadHandler();
  assert.deepEqual(await connect(POPUP, [prepare, autofill]), {
    replies: [{ ready: true }, { mapping: null, filled: ["givenName"] }],
    disconnected: false,
  });
  assert.deepEqual(await connect(POPUP, [autofill]), { replies: [PAGE_CHANGED], disconnected: false });
});

test("only the extension popup may open a fill port", async () => {
  const connect = loadHandler();
  for (const sender of [
    { id: "another-extension", url: "chrome-extension://another-extension/popup.html" },
    { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/src/background.js` },
    { id: EXTENSION_ID, url: `${FORM}/apply/personal` },
  ]) {
    assert.deepEqual(await connect(sender, [prepare, autofill]), { replies: [], disconnected: true }, sender.url);
  }
});

test("a sandboxed, cross-origin-framed, different, or CRM document never receives student values", async () => {
  const sandboxed = { error: "This part of the page is sandboxed, so it was not filled. Complete it manually." };
  assert.deepEqual(await loadHandler({ selfOrigin: "null" })(POPUP, [prepare, autofill]), { replies: [sandboxed, sandboxed], disconnected: false });
  const cases = [
    { topOrigin: "cross-origin" },
    { topOrigin: "https://apps.bangor.ac.uk" },
    { origin: "https://other.example-university.test" },
  ];
  for (const page of cases) {
    const connect = loadHandler(page);
    assert.deepEqual(await connect(POPUP, [prepare, autofill]), { replies: [PAGE_CHANGED, PAGE_CHANGED], disconnected: false }, JSON.stringify(page));
  }
  const crm = loadHandler({ origin: "https://app.samscrm.co.uk" });
  assert.deepEqual(await crm(POPUP, [{ action: "prepare", origin: "https://app.samscrm.co.uk" }, autofill]),
    { replies: [PAGE_CHANGED, PAGE_CHANGED], disconnected: false });
});
