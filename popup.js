const btnCopy = document.getElementById("btnCopy");
const btnAutofill = document.getElementById("btnAutofill");
const btnClear = document.getElementById("btnClear");
const btnSiteAccess = document.getElementById("btnSiteAccess");
const siteAccessHint = document.getElementById("siteAccessHint");
const studentCard = document.getElementById("studentCard");
const studentName = document.getElementById("studentName");
const studentMeta = document.getElementById("studentMeta");
const statusArea = document.getElementById("statusArea");
const copiedDetails = document.getElementById("copiedDetails");
const copiedDetailsSummary = document.getElementById("copiedDetailsSummary");
const copiedFields = document.getElementById("copiedFields");
const copiedSearch = document.getElementById("copiedSearch");
const copiedEmpty = document.getElementById("copiedEmpty");
const copiedDocuments = document.getElementById("copiedDocuments");
const copiedDocumentsSummary = document.getElementById("copiedDocumentsSummary");
const copiedDocumentsList = document.getElementById("copiedDocumentsList");
const btnDocuments = document.getElementById("btnDocuments");
const documentsCard = document.getElementById("documentsCard");
const uploadFields = document.getElementById("uploadFields");
let cache = null;
let expiryTimer = null;
let siteAccessTarget = null;
let siteAccessRevision = 0;
// Ports to the scanned portal page stay open while staff choose documents, so each upload
// key keeps pointing at the exact input that was scanned.
let uploadFrames = [];
let uploadPickers = [];
let scannedCopiedAt = 0;
const MIME_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
// Suggestions only label an option; staff always choose the document themselves.
const GROUP_HINTS = {
  cv: /\b(cv|resume|curriculum)\b/,
  edu: /\b(education|academic|degree|qualifications?|transcripts?|diploma)\b/,
  work_history: /\b(work|employment|employer|experience)\b/,
  eng_test: /\b(english|ielts|toefl|pte|language)\b/,
  reference: /\b(references?|referees?|recommendation)\b/,
  visa_history: /\bvisas?\b/,
  visa_refusal: /\b(visas?|refusals?)\b/,
  passport: /\b(passports?|identity)\b/,
};
const TYPE_HINTS = { Transcript: /\btranscripts?\b/, Certificate: /\bcertificates?\b/ };
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

async function refreshSiteAccess() {
  const revision = ++siteAccessRevision;
  siteAccessTarget = null;
  btnSiteAccess.hidden = true;
  siteAccessHint.hidden = true;
  if (typeof chrome.permissions?.contains !== "function" || typeof chrome.permissions?.request !== "function") return;
  try {
    const tab = await activeTab();
    const origin = originOf(tab.url);
    if (!origin.startsWith("https://") || !SAMS_ALLOWLIST.isFillTarget(origin)) return;
    const granted = await chrome.permissions.contains({ origins: [`${origin}/*`] });
    if (revision !== siteAccessRevision || granted) return;
    siteAccessTarget = { tabId: tab.id, origin };
    siteAccessHint.textContent = `Allow access to ${new URL(origin).hostname} only. Other websites stay unchanged. You can revoke access in browser settings.`;
    siteAccessHint.hidden = false;
    btnSiteAccess.hidden = false;
  } catch {
    // Without a readable current origin, never guess which website to request.
  }
}

async function requestSiteAccess() {
  const target = siteAccessTarget;
  if (!target || btnSiteAccess.disabled) return;
  btnSiteAccess.disabled = true;
  siteAccessTarget = null;
  try {
    // Request before any await so Safari and Chrome retain the button's user gesture.
    const granted = await chrome.permissions.request({ origins: [`${target.origin}/*`] });
    if (!granted) {
      setStatus("error", "Website access was not granted. Nothing was filled. You can allow this website and try again.");
      return;
    }
    setStatus("success", `Access allowed for ${new URL(target.origin).hostname}. Nothing was filled. Select Autofill on the application page when you are ready.`);
  } catch {
    setStatus("error", "Could not request website access. Allow this website in your browser's extension settings, then reopen the extension.");
  } finally {
    btnSiteAccess.disabled = false;
    await refreshSiteAccess();
  }
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
  const name = document.createElement("span");
  name.className = "summary-title";
  name.textContent = title;
  const count = document.createElement("span");
  count.className = "summary-count";
  count.textContent = items.length;
  summary.append(name, count);
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

function copyIcon(done) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const shapes = done
    ? [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]]
    : [["rect", { x: 9, y: 9, width: 11, height: 11, rx: 2.5 }], ["path", { d: "M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" }]];
  for (const [tag, attributes] of shapes) {
    const shape = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value);
    svg.appendChild(shape);
  }
  return svg;
}

async function copyValue(button, value) {
  try {
    await navigator.clipboard.writeText(value);
    button.dataset.copied = "true";
    button.title = "Copied";
    button.replaceChildren(copyIcon(true));
    setTimeout(() => {
      delete button.dataset.copied;
      button.title = "Copy";
      button.replaceChildren(copyIcon(false));
    }, 1500);
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
    button.title = "Copy";
    button.append(copyIcon(false));
    button.setAttribute("aria-label", `Copy ${fieldLabel(key)}`);
    button.addEventListener("click", () => copyValue(button, value));
    row.append(text, button);
    return row;
  }));
}

// Staff open this to confirm exactly which CRM files were copied before they attach one.
function renderDocuments(documents) {
  const items = documents || [];
  copiedDocuments.hidden = !items.length;
  if (!items.length) copiedDocuments.open = false;
  copiedDocumentsSummary.textContent = `Copied documents (${items.length})`;
  copiedDocumentsList.replaceChildren(...items.map((crmDocument) => {
    const row = document.createElement("div");
    row.className = "document-row";
    const text = document.createElement("div");
    text.className = "document-text";
    const name = document.createElement("div");
    name.className = "document-name";
    name.textContent = documentFileName(crmDocument);
    const group = document.createElement("div");
    group.className = "document-group";
    group.textContent = crmDocument.groupLabel;
    text.append(name, group);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "view";
    button.textContent = "View";
    button.setAttribute("aria-label", `View ${documentFileName(crmDocument)}`);
    button.addEventListener("click", () => viewDocument(crmDocument));
    row.append(text, button);
    return row;
  }));
}

// Opens the copied CRM file in a new tab so staff can confirm it is the right one. Only the plain
// media URL on the copied CRM origin is opened; token-bearing download links are still never used.
async function viewDocument(crmDocument) {
  if (!cache || !SAMS_ALLOWLIST.isCrmFileUrl(crmDocument.url, cache.sourceOrigin)) {
    setStatus("error", "This document link is not an approved CRM file. Open it in SAMS CRM instead.");
    return;
  }
  try {
    await chrome.tabs.create({ url: crmDocument.url });
  } catch {
    setStatus("error", "Could not open this document. Open it in SAMS CRM instead.");
  }
}

function renderCache() {
  clearInterval(expiryTimer);
  studentCard.hidden = !cache;
  btnCopy.textContent = cache ? "Copy again" : "Copy from CRM";
  btnAutofill.disabled = !cache;
  btnDocuments.hidden = !(cache && cache.documents && cache.documents.length);
  renderFields(cache && cache.fields);
  renderDocuments(cache && cache.documents);
  if (!cache) {
    closeUploads();
    studentName.textContent = "";
    studentMeta.textContent = "";
    return;
  }
  studentName.textContent = cache.studentName;
  const update = () => {
    const remaining = Math.max(0, Math.ceil((cache.expiresAt - Date.now()) / 60000));
    const copied = new Date(cache.copiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    studentMeta.textContent = `Copied ${copied} · expires in ${remaining} min`;
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

// A failed document listing never blocks the field Copy staff asked for.
async function copyDocuments(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: "copyCrmDocuments" }, { frameId: 0 });
    if (response && Array.isArray(response.documents)) return { documents: response.documents, failed: false };
  } catch { /* reported below */ }
  return { documents: [], failed: true };
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
      "src/crm-documents.js",
    ]);
    const response = await chrome.tabs.sendMessage(tab.id, { action: "copyCrmProfile" }, { frameId: 0 });
    if (response.error) throw new Error(response.error);
    const listing = await copyDocuments(tab.id);
    const stored = await runtimeMessage({ action: "cacheStudent", profile: { ...response.profile, documents: listing.documents } });
    if (stored.error) throw new Error(stored.error);
    cache = stored.cache;
    renderCache();
    const documentsNote = listing.failed ? " CRM documents could not be read, so attach them manually."
      : cache.documents.length ? ` ${cache.documents.length} CRM documents available to attach.` : "";
    setStatus("success", `${Object.keys(cache.fields).length} CRM fields copied.${documentsNote} Student data expires after 30 minutes of inactivity.`);
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

// Injects the page handler into each selected frame document and opens its port. `frames` holds
// every opened port for cleanup; `checked` holds the frames that answered prepare, or their errors.
async function preparePageFrames(tab) {
  const origin = originOf(tab.url);
  const selected = await selectedPageFrames(tab, origin);
  const injected = await Promise.all(selected.map((frame) =>
    injectDocument(tab.id, frame.documentId, PORTAL_FILES).then(
      () => frame,
      (error) => ({ frameId: frame.frameId, documentId: frame.documentId, error: error.message }),
    )
  ));
  const frames = injected.map((frame) => frame.error ? frame : connectFrame(tab.id, frame));
  const checked = await Promise.all(frames.map(async (frame) => {
    if (frame.error) return frame;
    const response = await frame.request({ action: "prepare", origin });
    return response && response.ready ? frame : { frameId: frame.frameId, documentId: frame.documentId, error: (response && response.error) || FRAME_NO_RESPONSE };
  }));
  return { frames, checked };
}

async function autofill() {
  btnAutofill.disabled = true;
  setStatus("info", "Filling empty fields on this page...");
  let frames = [];
  try {
    const tab = await approvedTab(SAMS_ALLOWLIST.isFillTarget,
      "Open the university application form first. Autofill does not run on SAMS CRM, Campora, or browser pages.");
    const prepared = await preparePageFrames(tab);
    frames = prepared.frames;
    const checked = prepared.checked;
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
    addList("CRM fields not matched on this page", result.unmatched.map((item) => (typeof item === "string" ? fieldLabel(item) : item)));
    addList("Portal fields left empty, manual review", result.manualReview);
  } catch (error) {
    setStatus("error", error.message || String(error));
  } finally {
    frames.forEach((frame) => frame.close && frame.close());
    btnAutofill.disabled = !cache;
  }
}

function closeUploads() {
  uploadFrames.forEach((frame) => frame.close && frame.close());
  uploadPickers.forEach((picker) => picker.destroy && picker.destroy());
  uploadFrames = [];
  uploadPickers = [];
  uploadFields.replaceChildren();
  documentsCard.hidden = true;
}

function documentFileName(crmDocument) {
  const suffix = `.${crmDocument.extension}`;
  return crmDocument.name.toLowerCase().endsWith(suffix) ? crmDocument.name : `${crmDocument.name}${suffix}`;
}

// Mirrors the browser's own `accept` rules: extensions, exact MIME types, and type/* wildcards.
function acceptsDocument(accept, crmDocument) {
  const tokens = accept.toLowerCase().split(",").map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) return true;
  const mime = MIME_TYPES[crmDocument.extension];
  const extensions = ["jpg", "jpeg"].includes(crmDocument.extension) ? ["jpg", "jpeg"] : [crmDocument.extension];
  return tokens.some((token) => {
    if (token.startsWith(".")) return extensions.includes(token.slice(1));
    if (token.endsWith("/*")) return mime.startsWith(token.slice(0, -1));
    return token === mime;
  });
}

function suggestedFor(label, crmDocument) {
  const text = label.toLowerCase();
  return Boolean(GROUP_HINTS[crmDocument.group]?.test(text) || TYPE_HINTS[crmDocument.documentType]?.test(text));
}

// Bytes are fetched only when staff attach, inside an open CRM tab: the CRM session cookie is
// not sent on requests from the extension's own pages.
async function fetchDocument(crmDocument) {
  if (!SAMS_ALLOWLIST.isCrmFileUrl(crmDocument.url, cache.sourceOrigin)) {
    throw new Error("This document link is not an approved CRM file. Attach it manually.");
  }
  const [crmTab] = await chrome.tabs.query({ url: `${cache.sourceOrigin}/*` });
  if (!crmTab) throw new Error("Keep SAMS CRM open in a tab while attaching documents, then try again.");
  await inject(crmTab.id, [0], ["config/build-mode.js", "config/allowlist.js", "src/crm-documents.js"]);
  let response;
  try {
    response = await chrome.tabs.sendMessage(crmTab.id, { action: "readCrmDocument", url: crmDocument.url }, { frameId: 0 });
  } catch {
    throw new Error("The CRM tab did not respond. Reload SAMS CRM, then try again.");
  }
  if (!response || response.error || typeof response.base64 !== "string") {
    throw new Error((response && response.error) || "The CRM tab did not respond. Reload SAMS CRM, then try again.");
  }
  return { name: documentFileName(crmDocument), type: MIME_TYPES[crmDocument.extension], base64: response.base64 };
}

function setUploadStatus(status, type, text) {
  status.className = `upload-status ${type}`;
  status.textContent = text;
}

async function attachToUpload(frame, upload, picker, button, status) {
  picker.setDisabled(true);
  button.disabled = true;
  setUploadStatus(status, "", "Attaching...");
  try {
    // The worker cache is authoritative: Clear, expiry, or a new Copy must win over this popup's rows.
    await refreshCache();
    if (!cache) throw new Error("No copied student is available. Copy from CRM again before attaching documents.");
    if (cache.copiedAt !== scannedCopiedAt) throw new Error("A different student was copied. Scan the page again.");
    const crmDocument = cache.documents.find((item) => item.key === picker.value);
    if (!crmDocument) throw new Error("This document is no longer available. Copy from CRM again.");
    const file = await fetchDocument(crmDocument);
    const response = await frame.request({ action: "attachDocument", key: upload.key, file });
    if (!response || response.error) throw new Error((response && response.error) || FRAME_NO_RESPONSE);
    const touched = await runtimeMessage({ action: "touchStudentCache" });
    cache = touched.cache || null;
    renderCache();
    setUploadStatus(status, "done", `Attached ${response.name}. Review the portal: it may upload the file straight away.`);
  } catch (error) {
    const message = error.message || String(error);
    if (!cache) {
      setStatus("error", message);
      return;
    }
    setUploadStatus(status, "failed", message);
    picker.setDisabled(false);
    button.disabled = !picker.value;
  }
}

// shadcn-style listbox: a button that opens a panel of options, with keyboard support. It replaces
// the native select so the popup matches the design system while keeping the same data flow.
function createPicker({ label, options, placeholder }) {
  const root = document.createElement("div");
  root.className = "upload-choice-wrap";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "upload-choice";
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", `CRM document for ${label}`);
  const valueText = document.createElement("span");
  valueText.className = "upload-choice-value placeholder";
  valueText.textContent = placeholder;
  const chevron = document.createElement("span");
  chevron.className = "upload-choice-chevron";
  chevron.setAttribute("aria-hidden", "true");
  trigger.append(valueText, chevron);
  const menu = document.createElement("div");
  menu.className = "upload-choice-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", `CRM document for ${label}`);
  menu.hidden = true;
  const optionNodes = options.map((option, index) => {
    const node = document.createElement("div");
    node.className = "upload-choice-option";
    node.setAttribute("role", "option");
    node.setAttribute("data-value", option.value);
    node.setAttribute("aria-selected", "false");
    node.textContent = option.text;
    node.addEventListener("click", () => selectOption(index, true));
    return node;
  });
  menu.append(...optionNodes);
  root.append(trigger, menu);
  let selected = "";
  let highlighted = -1;
  let notify = () => {};

  function setHighlight(index) {
    highlighted = index;
    optionNodes.forEach((node, position) => node.setAttribute("data-highlighted", String(position === index)));
  }
  function open() {
    if (trigger.disabled || !menu.hidden) return;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    setHighlight(options.findIndex((option) => option.value === selected));
  }
  function close() {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    setHighlight(-1);
  }
  function selectOption(index, fromPointer) {
    const option = options[index];
    if (!option) return;
    selected = option.value;
    optionNodes.forEach((node, position) => node.setAttribute("aria-selected", String(position === index)));
    valueText.className = "upload-choice-value";
    valueText.textContent = option.text;
    trigger.setAttribute("data-value", option.value);
    close();
    if (fromPointer && trigger.focus) trigger.focus();
    notify();
  }
  function move(step) {
    if (menu.hidden) return open();
    const next = Math.min(optionNodes.length - 1, Math.max(0, highlighted + step));
    setHighlight(next);
    if (optionNodes[next].scrollIntoView) optionNodes[next].scrollIntoView({ block: "nearest" });
  }
  function onKey(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || event.key === " ") {
      if (menu.hidden) { event.preventDefault(); open(); } else if (highlighted >= 0) { event.preventDefault(); selectOption(highlighted, true); }
    } else if (event.key === "Home" || event.key === "End") {
      if (!menu.hidden) { event.preventDefault(); setHighlight(event.key === "Home" ? 0 : optionNodes.length - 1); }
    } else if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      close();
      if (trigger.focus) trigger.focus();
    }
  }
  // Any click outside this picker closes it, so only one menu is open at a time.
  const onDocumentClick = (event) => { if (!root.contains || !root.contains(event.target)) close(); };
  trigger.addEventListener("click", () => { if (menu.hidden) open(); else close(); });
  trigger.addEventListener("keydown", onKey);
  document.addEventListener("click", onDocumentClick);

  return {
    root,
    get value() { return selected; },
    setDisabled(disabled) {
      trigger.disabled = disabled;
      if (disabled) close();
    },
    onChange(handler) { notify = handler; },
    destroy() { document.removeEventListener("click", onDocumentClick); },
  };
}

function renderUploadRow({ frame, upload }) {
  const row = document.createElement("div");
  row.className = "upload-row";
  const label = document.createElement("div");
  label.className = "upload-label";
  label.textContent = upload.label;
  const controls = document.createElement("div");
  controls.className = "upload-controls";
  const compatible = cache.documents.filter((item) => acceptsDocument(upload.accept, item));
  const picker = createPicker({
    label: upload.label,
    placeholder: "Choose a CRM document",
    options: compatible.map((item) => ({
      value: item.key,
      text: `${item.groupLabel} · ${documentFileName(item)}${suggestedFor(upload.label, item) ? " (suggested)" : ""}`,
    })),
  });
  uploadPickers.push(picker);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "attach";
  button.textContent = "Attach";
  button.disabled = true;
  const status = document.createElement("div");
  status.className = "upload-status";
  if (upload.hasFile) {
    picker.setDisabled(true);
    status.textContent = "This field already has a file. Remove it in the portal first, then scan again.";
  } else if (!compatible.length) {
    picker.setDisabled(true);
    status.textContent = "No CRM document matches this field's accepted file types.";
  }
  picker.onChange(() => { button.disabled = !picker.value; });
  button.addEventListener("click", () => attachToUpload(frame, upload, picker, button, status));
  controls.append(picker.root, button);
  row.append(label, controls, status);
  return row;
}

async function scanUploads() {
  btnDocuments.disabled = true;
  closeUploads();
  setStatus("info", "Looking for file upload fields on this page...");
  try {
    const tab = await approvedTab(SAMS_ALLOWLIST.isFillTarget,
      "Open the university application form first. Documents are attached on the portal page, not on SAMS CRM or browser pages.");
    const prepared = await preparePageFrames(tab);
    uploadFrames = prepared.frames;
    const listed = await Promise.all(prepared.checked.map(async (frame) => {
      if (frame.error) return { failure: `Frame ${frame.frameId}: ${frame.error}` };
      const response = await frame.request({ action: "listUploads" });
      if (!response || !Array.isArray(response.uploads)) {
        return { failure: `Frame ${frame.frameId}: ${(response && response.error) || FRAME_NO_RESPONSE}` };
      }
      return { entries: response.uploads.map((upload) => ({ frame, upload })) };
    }));
    await refreshCache();
    if (!cache || !cache.documents.length) throw new Error("No copied CRM documents are available. Copy from CRM again.");
    const entries = listed.flatMap((item) => item.entries || []);
    const failures = listed.filter((item) => item.failure).map((item) => item.failure);
    if (!entries.length) {
      closeUploads();
      if (failures.length) {
        setStatus("error", "No file upload fields could be read on this page.");
        addList("Frames not scanned", failures);
      } else {
        setStatus("info", "No file upload fields found on this page.");
      }
      return;
    }
    scannedCopiedAt = cache.copiedAt;
    uploadFields.replaceChildren(...entries.map(renderUploadRow));
    documentsCard.hidden = false;
    setStatus(failures.length ? "warning" : "info",
      `${entries.length} upload fields found. Choose a document for each field you want to attach, then review the portal.`);
    addList("Frames not scanned", failures);
  } catch (error) {
    closeUploads();
    setStatus("error", error.message || String(error));
  } finally {
    btnDocuments.disabled = false;
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
btnSiteAccess.addEventListener("click", requestSiteAccess);
btnDocuments.addEventListener("click", scanUploads);
copiedSearch.addEventListener("input", () => renderFields(cache && cache.fields));
refreshCache().catch((error) => setStatus("error", error.message || String(error)));
window.addEventListener("focus", refreshSiteAccess);
chrome.tabs.onActivated.addListener(refreshSiteAccess);
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if ((!siteAccessTarget || siteAccessTarget.tabId === tabId) && (change.url || change.status === "complete")) refreshSiteAccess();
});
chrome.permissions?.onAdded?.addListener(refreshSiteAccess);
chrome.permissions?.onRemoved?.addListener(refreshSiteAccess);
refreshSiteAccess();
