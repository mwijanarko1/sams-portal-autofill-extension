/* ===================================================================
 * popup.js — SAMS Portal Autofill Extension
 *
 * Flow: search a student by name or ID → profile is fetched
 * automatically on selection → one button autofills the page.
 *
 * chrome.storage.local stores ONLY the selected student {id, name}.
 * Full CRM profiles are never persisted.
 * =================================================================== */

// ─── Config ──────────────────────────────────────────────────────────────

const BACKEND_URL = "http://localhost:3000";

// ─── State ──────────────────────────────────────────────────────────────

/** @type {Array<{id:number,name:string,nationality?:string,location?:string}>} */
let allStudents = [];
/** @type {{id:number,name:string}|null} */
let selectedStudent = null;
/** @type {Record<string,string>|null} */
let currentFieldMap = null;
/** @type {Array<object>|null} */
let currentDetectedFields = null;
/** @type {number} sequence to ignore stale fetch responses */
let fetchSequence = 0;

// ─── DOM refs ───────────────────────────────────────────────────────────

const searchInput = document.getElementById("studentSearch");
const searchResults = document.getElementById("searchResults");
const selectedEl = document.getElementById("selectedStudent");
const selAvatar = document.getElementById("selAvatar");
const selName = document.getElementById("selName");
const selMeta = document.getElementById("selMeta");
const btnClear = document.getElementById("btnClear");
const btnAutofill = document.getElementById("btnAutofill");
const statusArea = document.getElementById("statusArea");

// ─── Field-map builder (mirrors portal-autofill.ts buildFieldMap) ───────

function buildFieldMap(data) {
  const student = data.student ?? data.profile;
  const extraFields = data.extraFields;
  const contact = data.contact;
  const profileGlance = data.profileGlance;
  const primaryAdmission = data.primaryAdmission;
  const admissionRows = data.admissionRows;

  /** @type {Record<string,string>} */
  const map = {};

  if (student && typeof student === "object") {
    const keys = [
      "givenName", "familyName", "dateOfBirth", "gender",
      "maritalStatus", "nationality", "location",
    ];
    for (const k of keys) {
      const v = student[k];
      if (v && typeof v === "string") map[k] = v;
    }
  }

  if (extraFields && typeof extraFields === "object") {
    for (const [k, v] of Object.entries(extraFields)) {
      if (v && typeof v === "string" && v.trim()) map[k] = v.trim();
    }
  }

  const c = contact;
  if (c && typeof c === "object") {
    if (Array.isArray(c.phones) && c.phones.length > 0) map.phone = String(c.phones[0]);
    if (Array.isArray(c.emails) && c.emails.length > 0) map.email = String(c.emails[0]);
    const em = c.emergency;
    if (em && typeof em === "object") {
      if (em.name && typeof em.name === "string") map.emergencyName = em.name;
      if (em.phone && typeof em.phone === "string") map.emergencyPhone = em.phone;
    }
  }

  const pg = profileGlance;
  if (pg && typeof pg === "object") {
    if (!map.institutionName && pg.institution && typeof pg.institution === "string") {
      map.institutionName = pg.institution;
    }
    if (!map.studyDates && pg.studyRange && typeof pg.studyRange === "string") {
      map.studyDates = pg.studyRange;
    }
    if (!map.gpa && pg.gpa && typeof pg.gpa === "string") map.gpa = pg.gpa;
  }

  const prefRow =
    (primaryAdmission && typeof primaryAdmission === "object" && "university" in primaryAdmission
      ? primaryAdmission
      : undefined) ??
    (Array.isArray(admissionRows) && admissionRows.length > 0 ? admissionRows[0] : null) ??
    null;

  if (prefRow && typeof prefRow === "object") {
    if (prefRow.university && typeof prefRow.university === "string" && !map.preferredUniversity) {
      map.preferredUniversity = prefRow.university;
    }
    const course = prefRow.subject ?? prefRow.courseTitle;
    if (course && typeof course === "string" && !map.preferredCourse) map.preferredCourse = course;
    const intake = prefRow.intake ?? prefRow.startDate;
    if (intake && typeof intake === "string" && !map.preferredIntake) map.preferredIntake = intake;
    if (prefRow.route && typeof prefRow.route === "string" && !map.preferredRoute) {
      map.preferredRoute = prefRow.route;
    }
  }

  return map;
}

// ─── Status display ─────────────────────────────────────────────────────

function clearStatus() { statusArea.innerHTML = ""; }

function addStatus(type, message, meta) {
  const div = document.createElement("div");
  div.className = "status-entry " + type;
  div.textContent = message;
  if (meta) {
    const m = document.createElement("div");
    m.className = "status-meta";
    m.textContent = meta;
    div.appendChild(m);
  }
  statusArea.appendChild(div);
}

function showResultStats(filled, skipped, skippedExisting, unmatched, detected) {
  const grid = document.createElement("div");
  grid.className = "result-grid";
  const stats = [
    { num: detected ?? 0, lbl: "Detected" },
    { num: filled ?? 0, lbl: "Filled" },
    { num: skippedExisting ?? 0, lbl: "Skipped (has value)" },
    { num: (skipped ?? 0) - (skippedExisting ?? 0), lbl: "Skipped (other)" },
    { num: unmatched ?? 0, lbl: "Unmatched" },
  ];
  for (const s of stats) {
    const cell = document.createElement("div");
    cell.className = "result-stat";
    cell.innerHTML = `<div class="num">${s.num}</div><div class="lbl">${s.lbl}</div>`;
    grid.appendChild(cell);
  }
  statusArea.appendChild(grid);
}

function formatFieldItem(f) {
  if (typeof f === "string") return `<code>${escapeHtml(f)}</code>`;
  const parts = [];
  if (f.fieldName && f.value !== undefined) {
    parts.push(`<code>${escapeHtml(f.fieldName)}</code>`);
    if (f.fieldLabel) parts.push(` <span class="field-meta">“${escapeHtml(f.fieldLabel)}”</span>`);
    parts.push(` = <strong>${escapeHtml(f.value)}</strong>`);
    if (f.score !== undefined) parts.push(` <span class="field-score">(${f.score})</span>`);
    if (f.matchReason) parts.push(` <span class="field-meta">${escapeHtml(f.matchReason)}</span>`);
  } else if (f.fieldName && f.existingValue !== undefined) {
    parts.push(`<code>${escapeHtml(f.fieldName)}</code>`);
    if (f.fieldLabel) parts.push(` <span class="field-meta">“${escapeHtml(f.fieldLabel)}”</span>`);
    parts.push(` <span class="field-meta">(has: ${escapeHtml(f.existingValue)})</span>`);
    if (f.reason) parts.push(` <span class="field-meta">${escapeHtml(f.reason)}</span>`);
  } else if (f.name || f.label) {
    const displayLabel = f.label || f.name || f.id || "";
    parts.push(`<code>${escapeHtml(displayLabel)}</code>`);
    if (f.type) parts.push(`<span class="field-type">${escapeHtml(f.type)}</span>`);
    if (f.autocomplete) parts.push(`<span class="field-type">auto:${escapeHtml(f.autocomplete)}</span>`);
    if (f.required) parts.push(`<span class="field-badge req">R</span>`);
    if (f.hasValue) parts.push(`<span class="field-badge has-val">✓</span>`);
    if (f.suggestedCrmKey) {
      parts.push(`→ ${escapeHtml(f.suggestedCrmKey)}`);
      if (f.confidence !== undefined) parts.push(`(${f.confidence})`);
    }
  } else {
    parts.push(`<code>${escapeHtml(f.name || JSON.stringify(f))}</code>`);
  }
  return parts.join(" ");
}

function showFieldList(label, fields) {
  if (!fields || fields.length === 0) return;
  const div = document.createElement("div");
  div.className = "field-list";
  div.innerHTML = `<strong>${label}:</strong><br />${fields
    .map((f) => `<span class="field-entry">${formatFieldItem(f)}</span>`)
    .join("<br />")}`;
  statusArea.appendChild(div);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ─── Student search ─────────────────────────────────────────────────────

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

async function loadStudentList() {
  const res = await fetch(`${BACKEND_URL}/api/crm/leads`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  allStudents = (data.leads || []).filter((s) => s && s.id != null && s.name);
}

function filterStudents(query) {
  const q = query.trim().toLowerCase();
  if (!q) return allStudents.slice(0, 8);
  return allStudents
    .filter((s) => s.name.toLowerCase().includes(q) || String(s.id) === q || String(s.id).startsWith(q))
    .slice(0, 8);
}

function renderResults(query) {
  const matches = filterStudents(query);
  searchResults.innerHTML = "";
  if (allStudents.length === 0) {
    searchResults.innerHTML = `<div class="search-empty">Could not load students — is the CRM running at ${BACKEND_URL}?</div>`;
  } else if (matches.length === 0) {
    searchResults.innerHTML = `<div class="search-empty">No students match “${escapeHtml(query)}”</div>`;
  } else {
    for (const s of matches) {
      const row = document.createElement("div");
      row.className = "search-result";
      const meta = [`#${s.id}`, s.nationality, s.location].filter(Boolean).join(" · ");
      row.innerHTML =
        `<div class="avatar">${escapeHtml(initials(s.name))}</div>` +
        `<div><div class="sr-name">${escapeHtml(s.name)}</div><div class="sr-meta">${escapeHtml(meta)}</div></div>`;
      row.addEventListener("click", () => selectStudent(s));
      searchResults.appendChild(row);
    }
  }
  searchResults.classList.add("open");
}

function closeResults() { searchResults.classList.remove("open"); }

async function selectStudent(s) {
  selectedStudent = { id: s.id, name: s.name };
  chrome.storage.local.set({ selectedStudent });

  searchInput.value = "";
  closeResults();

  selAvatar.textContent = initials(s.name);
  selName.textContent = s.name;
  selMeta.textContent = [`Student #${s.id}`, s.nationality, s.location].filter(Boolean).join(" · ");
  selectedEl.classList.add("visible");

  await fetchProfile(s.id);
}

function clearSelection() {
  selectedStudent = null;
  currentFieldMap = null;
  btnAutofill.disabled = true;
  selectedEl.classList.remove("visible");
  chrome.storage.local.remove("selectedStudent");
  clearStatus();
  addStatus("info", "Search for a student to get started.");
  searchInput.focus();
}

// ─── Profile fetch ──────────────────────────────────────────────────────

async function fetchCrmData(studentId) {
  const routes = [
    `${BACKEND_URL}/api/extension/student-profile?studentId=${studentId}`,
    `${BACKEND_URL}/api/crm?studentId=${studentId}`,
  ];
  for (const url of routes) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404 && url.includes("extension")) continue;
        throw new Error(`HTTP ${res.status}: ${body.error || res.statusText}`);
      }
      const data = await res.json();
      return data.snapshot ?? data;
    } catch (err) {
      if (err.name === "AbortError") throw new Error("Request timed out after 8s");
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("Failed to fetch CRM data");
}

async function fetchProfile(studentId) {
  const sequence = ++fetchSequence;
  currentFieldMap = null;
  btnAutofill.disabled = true;
  clearStatus();
  addStatus("info", "Fetching profile from SAMS CRM…");

  try {
    const snapshot = await fetchCrmData(studentId);
    if (sequence !== fetchSequence) return;

    currentFieldMap = buildFieldMap(snapshot);
    const keys = Object.keys(currentFieldMap);

    clearStatus();
    addStatus("success", `Profile ready — ${keys.length} fields loaded from CRM.`);
    btnAutofill.disabled = false;
    autoScan(currentFieldMap);
  } catch (err) {
    if (sequence !== fetchSequence) return;
    clearStatus();
    addStatus("error", `Failed to fetch profile: ${err.message}`);
  }
}

// ─── Tab messaging helpers ──────────────────────────────────────────────

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (!tabs || !tabs[0]) return reject(new Error("No active tab found"));
      resolve(tabs[0]);
    });
  });
}

function sendMessageToFrame(tabId, frameId, message) {
  return new Promise((resolve, reject) => {
    const opts = frameId != null ? { frameId } : undefined;
    chrome.tabs.sendMessage(tabId, message, opts, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

/**
 * Discover accessible frame IDs (via a no-op inject).
 * @returns {Promise<number[]>}
 */
async function listInjectableFrameIds(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => true,
    });
    return (results || [])
      .map((r) => r.frameId)
      .filter((id) => typeof id === "number");
  } catch {
    return [0];
  }
}

/**
 * Inject content.js only into frames that do not already respond to ping.
 * Avoids re-parsing ~80KB of content.js on every Autofill when already loaded.
 */
async function ensureContentScript(tabId, tabUrl) {
  if (tabUrl && /^(chrome|about|edge|brave|view-source|chrome-extension|devtools):/i.test(tabUrl)) {
    throw new Error("Cannot inject content script into browser internal pages.");
  }

  const frameIds = await listInjectableFrameIds(tabId);
  const needInject = [];

  await Promise.all(
    frameIds.map(async (frameId) => {
      try {
        const res = await sendMessageToFrame(tabId, frameId, { action: "ping" });
        if (!res || !res.pong) needInject.push(frameId);
      } catch {
        needInject.push(frameId);
      }
    })
  );

  if (needInject.length === 0) return frameIds;

  try {
    // Prefer targeted inject when only some frames need it
    if (needInject.length < frameIds.length) {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: needInject },
        files: ["content.js"],
      });
    } else {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ["content.js"],
      });
    }
  } catch {
    // Restricted frames may fail batch inject — fall back to main frame only.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    } catch {
      /* ignore */
    }
  }
  await new Promise((r) => setTimeout(r, 30));
  return frameIds;
}

/**
 * Run a message against every injectable frame in parallel and aggregate.
 */
async function runAcrossFrames(tabId, message, knownFrameIds) {
  const frameIds =
    Array.isArray(knownFrameIds) && knownFrameIds.length
      ? knownFrameIds
      : await listInjectableFrameIds(tabId);

  const settled = await Promise.allSettled(
    frameIds.map(async (frameId) => {
      const response = await sendMessageToFrame(tabId, frameId, message);
      return { frameId, response };
    })
  );

  const responses = [];
  const errors = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value?.response) {
      responses.push(s.value);
    } else if (s.status === "rejected") {
      errors.push({ error: s.reason?.message || String(s.reason) });
    }
  }

  // Last resort: top frame without explicit frameId
  if (responses.length === 0) {
    try {
      const response = await sendMessageToFrame(tabId, undefined, message);
      if (response) responses.push({ frameId: 0, response });
    } catch (err) {
      throw new Error(
        errors[0]?.error || err.message || "No response from page frames."
      );
    }
  }

  return aggregateFrameResponses(message.action, responses);
}

/**
 * Merge scan / autofill results from multiple frames into one popup-facing payload.
 */
function aggregateFrameResponses(action, framed) {
  if (framed.length === 1) {
    const only = framed[0];
    if (action === "scan" && only.response?.fields) {
      return {
        fields: only.response.fields.map((f) =>
          Object.assign({}, f, { frameId: only.frameId })
        ),
        fieldCount: only.response.fieldCount ?? only.response.fields.length,
        framesContacted: 1,
      };
    }
    if (action === "autofill" && only.response) {
      return Object.assign({}, only.response, { framesContacted: 1 });
    }
    return only.response;
  }

  if (action === "scan") {
    const fields = [];
    let fieldCount = 0;
    for (const { frameId, response } of framed) {
      if (response?.error) continue;
      if (typeof response?.fieldCount === "number") fieldCount += response.fieldCount;
      if (Array.isArray(response?.fields)) {
        for (const f of response.fields) {
          fields.push(Object.assign({}, f, { frameId }));
        }
        if (typeof response.fieldCount !== "number") fieldCount += response.fields.length;
      }
    }
    return { fields, fieldCount, framesContacted: framed.length };
  }

  if (action === "autofill") {
    const filled = [];
    const skipped = [];
    const skippedEmpty = [];
    const skippedExisting = [];
    const skippedSelect = [];
    const filledKeys = new Set();
    const unmatchedCounts = new Map();

    for (const { frameId, response } of framed) {
      if (response?.error) continue;
      for (const f of response.filled || []) {
        filled.push(Object.assign({}, f, { frameId }));
        if (f.name) filledKeys.add(f.name);
      }
      for (const s of response.skipped || []) skipped.push(s);
      for (const s of response.skippedEmpty || []) skippedEmpty.push(s);
      for (const s of response.skippedExisting || []) skippedExisting.push(s);
      for (const s of response.skippedSelect || []) skippedSelect.push(s);
      for (const key of response.unmatched || []) {
        unmatchedCounts.set(key, (unmatchedCounts.get(key) || 0) + 1);
      }
    }

    // A CRM key is "unmatched" only if no frame filled it.
    const unmatched = [];
    for (const [key] of unmatchedCounts) {
      if (!filledKeys.has(key)) unmatched.push(key);
    }

    return {
      filled,
      skipped,
      skippedEmpty,
      skippedExisting,
      skippedSelect,
      unmatched,
      framesContacted: framed.length,
    };
  }

  // ping / unknown — return first successful response
  return framed[0]?.response || { error: "No frame responded" };
}

// ─── Scan & autofill ────────────────────────────────────────────────────

/** Lean field count only — no fieldMap enrichment (expensive O(D×K) unused by UI). */
async function autoScan(_fieldMap) {
  try {
    const tab = await getActiveTab();
    const frameIds = await ensureContentScript(tab.id, tab.url);

    const response = await runAcrossFrames(
      tab.id,
      { action: "scan", lean: true },
      frameIds
    );

    if (response?.error) return;

    const count =
      typeof response.fieldCount === "number"
        ? response.fieldCount
        : Array.isArray(response.fields)
          ? response.fields.length
          : 0;

    currentDetectedFields = Array.isArray(response.fields)
      ? response.fields
      : new Array(count).fill(null);

    if (count > 0) {
      addStatus(
        "info",
        `🔍 ${count} form fields detected on this page (incl. frames).`
      );
    } else {
      addStatus(
        "info",
        "💡 No fields found. Log into the portal, open an application form step, then try again."
      );
    }
  } catch {
    // Silent — page may be a browser-internal tab
  }
}

async function handleAutofill() {
  clearStatus();

  if (!currentFieldMap || Object.keys(currentFieldMap).length === 0) {
    addStatus("error", "No student profile loaded. Search and select a student first.");
    return;
  }

  btnAutofill.disabled = true;
  btnAutofill.innerHTML = `<span class="spinner"></span> Filling…`;

  try {
    const tab = await getActiveTab();
    const frameIds = await ensureContentScript(tab.id, tab.url);
    const response = await runAcrossFrames(
      tab.id,
      {
        action: "autofill",
        fieldMap: currentFieldMap,
      },
      frameIds
    );

    if (response?.error) {
      addStatus("error", `Content script error: ${response.error}`);
      return;
    }
    if (!response) {
      addStatus("error", "No response from page. Is the content script loaded?");
      return;
    }

    const filled = response.filled || [];
    const skipped = response.skipped || [];
    const skippedExisting = response.skippedExisting || [];
    const unmatched = response.unmatched || [];
    const framesNote =
      response.framesContacted && response.framesContacted > 1
        ? ` Across ${response.framesContacted} frames.`
        : "";

    addStatus(
      "success",
      `✨ Autofill complete — ${filled.length} fields filled.${framesNote}`,
      "Review the form before submitting. Re-run on the next wizard step if needed."
    );
    showResultStats(
      filled.length,
      skipped.length,
      skippedExisting.length,
      unmatched.length,
      currentDetectedFields ? currentDetectedFields.length : "—"
    );

    if (filled.length > 0) showFieldList("Filled", filled);
    if (skippedExisting.length > 0) showFieldList("Skipped (already has value)", skippedExisting);
    const otherSkipped = skipped.filter((s) => !s.existingValue);
    if (otherSkipped.length > 0) showFieldList("Skipped (other reasons)", otherSkipped);
    if (unmatched.length > 0) showFieldList("Unmatched CRM keys", unmatched);
  } catch (err) {
    addStatus("error", `Autofill failed: ${err.message}`);
  } finally {
    btnAutofill.disabled = false;
    btnAutofill.innerHTML = "✨ Autofill This Page";
  }
}

// ─── Init ───────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (!chrome.scripting) {
    addStatus("error", "Missing 'scripting' permission. Reload the extension.");
    return;
  }

  // Search interactions
  searchInput.addEventListener("input", () => renderResults(searchInput.value));
  searchInput.addEventListener("focus", () => renderResults(searchInput.value));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) closeResults();
  });
  btnClear.addEventListener("click", clearSelection);
  btnAutofill.addEventListener("click", handleAutofill);

  // Load student list
  try {
    await loadStudentList();
  } catch {
    addStatus("error", `Could not reach SAMS CRM at ${BACKEND_URL}. Is it running?`);
  }

  // Restore previously selected student
  chrome.storage.local.get(["selectedStudent"], (result) => {
    const saved = result.selectedStudent;
    if (saved && saved.id != null) {
      const fresh = allStudents.find((s) => s.id === saved.id);
      selectStudent(fresh || saved);
    } else {
      addStatus("info", "Search for a student to get started.");
    }
  });
});
