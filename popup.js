const btnCopy = document.getElementById("btnCopy");
const btnAutofill = document.getElementById("btnAutofill");
const btnClear = document.getElementById("btnClear");
const studentCard = document.getElementById("studentCard");
const studentName = document.getElementById("studentName");
const studentMeta = document.getElementById("studentMeta");
const statusArea = document.getElementById("statusArea");
const copiedDetails = document.getElementById("copiedDetails");
const copiedDetailsSummary = document.getElementById("copiedDetailsSummary");
const copiedFields = document.getElementById("copiedFields");
const copiedSearch = document.getElementById("copiedSearch");
const copiedEmpty = document.getElementById("copiedEmpty");
let cache = null;
let expiryTimer = null;
const SITE_ACCESS_HINT = "If it is already open, allow SAMS Portal Autofill to access this website, then try again.";
const PAGE_ACCESS_ERROR = "Could not access this page. Allow SAMS Portal Autofill to access this website, reload the page, and try again.";
const FRAME_NO_RESPONSE = "The page frame did not respond.";
const DOCUMENT_IDENTITY_ERROR = "This browser cannot bind Autofill to the exact page document. Fill the form manually, or use Chrome or Edge.";
const PORTAL_FILES = [
  "config/build-mode.js",
  "config/allowlist.js",
  "config/synonyms.js",
  "config/portals/greenwich.js",
  "config/portals/manchester.js",
  "config/portals/bangor.js",
  "src/engine/engine.js",
  "src/portal-fill.js",
];

function runtimeMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found.");
  return tab;
}

function originOf(url) {
  try { return new URL(url).origin; } catch { return ""; }
}

// A missing tab URL can mean the browser withholds site access, so it never counts as approved.
async function approvedTab(isApproved, wrongSiteMessage) {
  const tab = await activeTab();
  if (!tab.url) throw new Error(`${wrongSiteMessage} ${SITE_ACCESS_HINT}`);
  if (!isApproved(originOf(tab.url))) throw new Error(wrongSiteMessage);
  return tab;
}

function setStatus(type, text) {
  statusArea.replaceChildren();
  const item = document.createElement("div");
  item.className = `status ${type}`;
  item.textContent = text;
  statusArea.appendChild(item);
}

function addList(title, items) {
  if (!items || !items.length) return;
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = `${title} (${items.length})`;
  const list = document.createElement("ul");
  for (const item of items) {
    const row = document.createElement("li");
    row.textContent = typeof item === "string"
      ? item
      : item.fieldLabel || item.fieldName || item.name || item.reason || "Field";
    list.appendChild(row);
  }
  details.append(summary, list);
  statusArea.appendChild(details);
}

function fieldLabel(key) {
  const words = key.replace(/(?<=[a-z0-9])(?=[A-Z])|(?<=[a-z])(?=[0-9])/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function copyValue(button, value) {
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = "Copy"; }, 1500);
  } catch {
    setStatus("error", "Could not copy to the clipboard. Select the value and copy it manually.");
  }
}

function renderFields(fields) {
  const entries = Object.entries(fields || {});
  copiedDetails.hidden = !entries.length;
  if (!entries.length) {
    copiedDetails.open = false;
    copiedSearch.value = "";
  }
  copiedDetailsSummary.textContent = `Copied details (${entries.length})`;
  const query = copiedSearch.value.trim().toLowerCase();
  const matches = ([key, value]) => `${fieldLabel(key)} ${value}`.toLowerCase().includes(query);
  copiedEmpty.hidden = !entries.length || entries.some(matches);
  copiedFields.replaceChildren(...entries.map(([key, value]) => {
    const row = document.createElement("div");
    row.className = "field-row";
    row.hidden = !matches([key, value]);
    const text = document.createElement("div");
    text.className = "field-text";
    const label = document.createElement("div");
    label.className = "field-label";
    label.textContent = fieldLabel(key);
    const shown = document.createElement("div");
    shown.className = "field-value";
    shown.textContent = value;
    text.append(label, shown);
    const button = document.createElement("button");
    button.className = "copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", `Copy ${fieldLabel(key)}`);
    button.addEventListener("click", () => copyValue(button, value));
    row.append(text, button);
    return row;
  }));
}

function renderCache() {
  clearInterval(expiryTimer);
  studentCard.hidden = !cache;
  btnAutofill.disabled = !cache;
  renderFields(cache && cache.fields);
  if (!cache) {
    studentName.textContent = "";
    studentMeta.textContent = "";
    return;
  }
  studentName.textContent = cache.studentName;
  const update = () => {
    const remaining = Math.max(0, Math.ceil((cache.expiresAt - Date.now()) / 60000));
    studentMeta.textContent = `Copied ${new Date(cache.copiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · expires in ${remaining} min`;
    if (!remaining) refreshCache();
  };
  update();
  expiryTimer = setInterval(update, 30000);
}

async function refreshCache() {
  const response = await runtimeMessage({ action: "getStudentCache" });
  cache = response.cache || null;
  renderCache();
}

async function inject(tabId, frameIds, files) {
  try {
    await chrome.scripting.executeScript({ target: { tabId, frameIds }, files });
  } catch {
    throw new Error(PAGE_ACCESS_ERROR);
  }
}

async function injectDocument(tabId, documentId, files) {
  try {
    await chrome.scripting.executeScript({ target: { tabId, documentIds: [documentId] }, files });
  } catch {
    throw new Error(PAGE_ACCESS_ERROR);
  }
}

async function copyFromCrm() {
  btnCopy.disabled = true;
  setStatus("info", "Opening CRM sections and reading student fields...");
  try {
    const tab = await approvedTab(SAMS_ALLOWLIST.isCrmOrigin, "Open an approved SAMS CRM or Campora student profile first.");
    await inject(tab.id, [0], [
      "config/build-mode.js",
      "config/allowlist.js",
      "config/crm-source.js",
      "src/crm-reader.js",
    ]);
    const response = await chrome.tabs.sendMessage(tab.id, { action: "copyCrmProfile" }, { frameId: 0 });
    if (response.error) throw new Error(response.error);
    const stored = await runtimeMessage({ action: "cacheStudent", profile: response.profile });
    if (stored.error) throw new Error(stored.error);
    cache = stored.cache;
    renderCache();
    setStatus("success", `${Object.keys(cache.fields).length} CRM fields copied. Student data expires after 30 minutes of inactivity.`);
  } catch (error) {
    setStatus("error", error.message || String(error));
  } finally {
    btnCopy.disabled = false;
  }
}

// Student values go only to documents of the page staff selected: the top frame and frames with
// exactly its origin. Other origins, including mapped portals embedded here, are never sent data.
// Each target keeps Chrome documentId from enumeration through injection and connect so a
// same-frameId replacement document cannot receive values.
async function selectedPageFrames(tab, origin) {
  const frames = (await chrome.webNavigation.getAllFrames({ tabId: tab.id })) || [];
  if (!frames.some((frame) => frame.frameId === 0 && originOf(frame.url) === origin)) {
    throw new Error("The page changed before Autofill started. Try again on the form.");
  }
  const selected = frames.filter((frame) => originOf(frame.url) === origin);
  if (selected.some((frame) => !frame.documentId)) {
    throw new Error(DOCUMENT_IDENTITY_ERROR);
  }
  return selected.map((frame) => ({
    frameId: frame.frameId,
    documentId: frame.documentId,
    url: frame.url,
  }));
}

// One port per frame document. If that document navigates or closes, its port closes and any
// pending request fails; the popup never reconnects, so values cannot reach a replacement page.
function connectFrame(tabId, frame) {
  let port;
  try {
    port = chrome.tabs.connect(tabId, { documentId: frame.documentId, name: "sams-autofill" });
  } catch {
    return { frameId: frame.frameId, documentId: frame.documentId, error: FRAME_NO_RESPONSE };
  }
  let pending = null;
  let open = true;
  port.onMessage.addListener((response) => {
    const request = pending;
    pending = null;
    if (request) request.resolve(response);
  });
  port.onDisconnect.addListener(() => {
    open = false;
    void chrome.runtime.lastError;
    const request = pending;
    pending = null;
    if (request) request.resolve({ error: FRAME_NO_RESPONSE });
  });
  return {
    frameId: frame.frameId,
    documentId: frame.documentId,
    request(message) {
      return new Promise((resolve) => {
        if (!open) return resolve({ error: FRAME_NO_RESPONSE });
        pending = { resolve };
        try {
          port.postMessage(message);
        } catch {
          pending = null;
          resolve({ error: FRAME_NO_RESPONSE });
        }
      });
    },
    close() {
      if (open) port.disconnect();
      open = false;
    },
  };
}

function mergeResults(results) {
  const merged = { filled: [], skippedExisting: [], noCrmValue: [], manualReview: [], unmatched: [] };
  const filledKeys = new Set();
  for (const result of results) {
    for (const key of Object.keys(merged)) {
      if (Array.isArray(result[key])) merged[key].push(...result[key]);
    }
    for (const item of result.filled || []) if (item.name) filledKeys.add(item.name);
  }
  merged.unmatched = [...new Set(merged.unmatched)].filter((key) => !filledKeys.has(key));
  return merged;
}

async function autofill() {
  btnAutofill.disabled = true;
  setStatus("info", "Filling empty fields on this page...");
  let frames = [];
  try {
    const tab = await approvedTab(SAMS_ALLOWLIST.isFillTarget,
      "Open the university application form first. Autofill does not run on SAMS CRM, Campora, or browser pages.");
    const origin = originOf(tab.url);
    const selected = await selectedPageFrames(tab, origin);
    const injected = await Promise.all(selected.map((frame) =>
      injectDocument(tab.id, frame.documentId, PORTAL_FILES).then(
        () => frame,
        (error) => ({ frameId: frame.frameId, documentId: frame.documentId, error: error.message }),
      )
    ));
    frames = injected.map((frame) => frame.error ? frame : connectFrame(tab.id, frame));
    const checked = await Promise.all(frames.map(async (frame) => {
      if (frame.error) return frame;
      const response = await frame.request({ action: "prepare", origin });
      return response && response.ready ? frame : { frameId: frame.frameId, documentId: frame.documentId, error: (response && response.error) || FRAME_NO_RESPONSE };
    }));
    // The worker cache is authoritative: Clear, expiry, or a new Copy elsewhere must win over this popup's memory.
    await refreshCache();
    if (!cache) throw new Error("No copied student is available. Copy from CRM again before Autofill.");
    const fieldMap = cache.fields;
    const outcomes = await Promise.all(checked.map(async (frame) => {
      if (frame.error) return frame;
      const response = await frame.request({ action: "autofill", fieldMap });
      return response && !response.error
        ? { frameId: frame.frameId, documentId: frame.documentId, report: response }
        : { frameId: frame.frameId, documentId: frame.documentId, error: (response && response.error) || FRAME_NO_RESPONSE };
    }));
    const reports = outcomes.filter((outcome) => outcome.report).map((outcome) => outcome.report);
    const failures = outcomes.filter((outcome) => outcome.error);
    if (!reports.length) throw new Error(failures[0].error);
    const result = mergeResults(reports);
    // Kept from Chrome: one successful frame counts as activity. All-frame failure threw above.
    const touched = await runtimeMessage({ action: "touchStudentCache" });
    cache = touched.cache || null;
    renderCache();
    if (failures.length) {
      setStatus("warning", `${result.filled.length} fields filled in ${reports.length} of ${outcomes.length} page frames. Some frames were not filled: review the whole page before continuing.`);
      addList("Frames not filled", failures.map((failure) => `Frame ${failure.frameId}: ${failure.error}`));
    } else if (reports.some((report) => !report.mapping)) {
      setStatus("success", `${result.filled.length} fields filled using shared matching for this website. Draft only: review every field, complete the rest, and submit it yourself.`);
    } else {
      setStatus("success", `${result.filled.length} fields filled. Draft only: review the form and submit it yourself.`);
    }
    addList("Filled", result.filled);
    addList("Skipped, already had a value", result.skippedExisting);
    addList("No CRM value", result.noCrmValue);
    addList("CRM fields not matched on this page", result.unmatched);
    addList("Portal fields left empty, manual review", result.manualReview);
  } catch (error) {
    setStatus("error", error.message || String(error));
  } finally {
    frames.forEach((frame) => frame.close && frame.close());
    btnAutofill.disabled = !cache;
  }
}

async function clearStudent() {
  await runtimeMessage({ action: "clearStudentCache" });
  cache = null;
  renderCache();
  setStatus("info", "Student data cleared.");
}

btnCopy.addEventListener("click", copyFromCrm);
btnAutofill.addEventListener("click", autofill);
btnClear.addEventListener("click", clearStudent);
copiedSearch.addEventListener("input", () => renderFields(cache && cache.fields));
refreshCache().catch((error) => setStatus("error", error.message || String(error)));
