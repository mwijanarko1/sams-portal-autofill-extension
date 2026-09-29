const btnCopy = document.getElementById("btnCopy");
const btnAutofill = document.getElementById("btnAutofill");
const btnClear = document.getElementById("btnClear");
const studentCard = document.getElementById("studentCard");
const studentName = document.getElementById("studentName");
const studentMeta = document.getElementById("studentMeta");
const statusArea = document.getElementById("statusArea");
let cache = null;
let expiryTimer = null;

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

function renderCache() {
  clearInterval(expiryTimer);
  studentCard.hidden = !cache;
  btnAutofill.disabled = !cache;
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
  await chrome.scripting.executeScript({ target: { tabId, frameIds }, files });
}

async function copyFromCrm() {
  btnCopy.disabled = true;
  setStatus("info", "Reading visible student fields from this CRM page...");
  try {
    const tab = await activeTab();
    if (!SAMS_ALLOWLIST.isCrmOrigin(originOf(tab.url))) {
      throw new Error("Open an approved SAMS CRM or Campora student profile first.");
    }
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
    setStatus("success", `${Object.keys(cache.fields).length} visible CRM fields copied. Student data expires after 30 minutes of inactivity.`);
  } catch (error) {
    setStatus("error", error.message || String(error));
  } finally {
    btnCopy.disabled = false;
  }
}

async function allowedPortalFrames(tab) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
  return (frames || [])
    .filter((frame) => SAMS_ALLOWLIST.isPortalOrigin(originOf(frame.url)))
    .map((frame) => frame.frameId);
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
  setStatus("info", "Filling empty fields on this portal page...");
  try {
    const tab = await activeTab();
    if (!SAMS_ALLOWLIST.isPortalOrigin(originOf(tab.url))) {
      throw new Error("Open an approved university portal form first.");
    }
    const frameIds = await allowedPortalFrames(tab);
    if (!frameIds.length) throw new Error("No approved portal frames were found on this page.");
    await inject(tab.id, frameIds, [
      "config/build-mode.js",
      "config/allowlist.js",
      "config/synonyms.js",
      "config/portals/greenwich.js",
      "config/portals/manchester.js",
      "config/portals/bangor.js",
      "src/engine/engine.js",
      "src/portal-fill.js",
    ]);
    const responses = await Promise.all(frameIds.map((frameId) =>
      chrome.tabs.sendMessage(tab.id, { action: "autofill", fieldMap: cache.fields }, { frameId })
    ));
    const errors = responses.filter((response) => response && response.error);
    if (errors.length === responses.length) throw new Error(errors[0].error);
    const result = mergeResults(responses.filter((response) => response && !response.error));
    const touched = await runtimeMessage({ action: "touchStudentCache" });
    cache = touched.cache || cache;
    renderCache();
    setStatus("success", `${result.filled.length} fields filled. Draft only: review the form and submit it yourself.`);
    addList("Filled", result.filled);
    addList("Skipped, already had a value", result.skippedExisting);
    addList("No CRM value", result.noCrmValue);
    addList("CRM fields not matched on this page", result.unmatched);
    addList("Portal fields left empty, manual review", result.manualReview);
  } catch (error) {
    setStatus("error", error.message || String(error));
  } finally {
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
refreshCache().catch((error) => setStatus("error", error.message || String(error)));
