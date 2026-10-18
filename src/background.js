importScripts("../config/build-mode.js", "../config/allowlist.js");

const CACHE_KEY = "studentCache";
const ALARM_NAME = "expire-student-cache";
const CACHE_ACTIONS = ["cacheStudent", "getStudentCache", "touchStudentCache", "clearStudentCache"];
const MAX_FIELDS = 200;
const MAX_TEXT_LENGTH = 4000;
const MAX_DOCUMENTS = 100;
const DOCUMENT_KEYS = ["documentType", "extension", "group", "groupLabel", "key", "name", "url"].join();
let queue = Promise.resolve();

// Cache operations run one at a time, so a slow touch or expiry cannot resurrect or remove
// a cache that a later Clear or Copy replaced.
function serialized(operation) {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
}

async function clearCache() {
  await chrome.storage.session.remove(CACHE_KEY);
  await chrome.alarms.clear(ALARM_NAME);
}

async function readCache() {
  const stored = await chrome.storage.session.get(CACHE_KEY);
  const cache = stored[CACHE_KEY] || null;
  if (cache && cache.expiresAt <= Date.now()) {
    await clearCache();
    return null;
  }
  return cache;
}

async function storeCache(profile) {
  const expiresAt = Date.now() + SAMS_ALLOWLIST.config.sessionMinutes * 60 * 1000;
  const cache = { ...profile, lastActivityAt: Date.now(), expiresAt };
  await chrome.storage.session.set({ [CACHE_KEY]: cache });
  await chrome.alarms.create(ALARM_NAME, { when: expiresAt });
  return cache;
}

async function touchCache() {
  const cache = await readCache();
  return cache ? storeCache(cache) : null;
}

function validProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const { studentId, studentName, sourceOrigin, copiedAt, fields } = profile;
  const text = (value) => typeof value === "string" && value.length <= MAX_TEXT_LENGTH;
  if (!text(studentId) || !studentId || !text(studentName) || !studentName.trim()) return null;
  if (sourceOrigin !== SAMS_ALLOWLIST.normalizeOrigin(sourceOrigin) || !SAMS_ALLOWLIST.isCrmOrigin(sourceOrigin)) return null;
  if (!Number.isFinite(copiedAt) || copiedAt <= 0) return null;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  const entries = Object.entries(fields);
  if (entries.length < 2 || entries.length > MAX_FIELDS) return null;
  if (!entries.every(([key, value]) => /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key) && text(value))) return null;
  const documents = validDocuments(profile.documents, sourceOrigin);
  if (!documents) return null;
  return { studentId, studentName, sourceOrigin, copiedAt, fields: Object.fromEntries(entries), documents };
}

// Document metadata only: file bytes are fetched when staff attach a file, never cached.
function validDocuments(documents, sourceOrigin) {
  if (documents === undefined) return [];
  if (!Array.isArray(documents) || documents.length > MAX_DOCUMENTS) return null;
  const short = (value) => typeof value === "string" && value.trim() && value.length <= 200;
  const valid = documents.every((document) => document && typeof document === "object"
    && Object.keys(document).sort().join() === DOCUMENT_KEYS
    && /^[a-z_]{1,32}:\d{1,12}$/.test(document.key) && short(document.group) && short(document.groupLabel) && short(document.name)
    && (document.documentType === null || short(document.documentType))
    && /^(pdf|jpe?g|png|docx?)$/.test(document.extension)
    && SAMS_ALLOWLIST.isCrmFileUrl(document.url, sourceOrigin));
  const unique = new Set(documents.map((document) => document.key)).size === documents.length;
  return valid && unique ? documents.map((document) => ({ ...document })) : null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !CACHE_ACTIONS.includes(message.action)) return false;
  if (!SAMS_ALLOWLIST.isPopupSender(sender)) {
    sendResponse({ error: "Student data actions are only available from the extension popup." });
    return false;
  }
  let operation;
  if (message.action === "cacheStudent") {
    const profile = validProfile(message.profile);
    if (!profile) {
      sendResponse({ error: "The copied student profile was not valid. Copy it again from an approved CRM profile." });
      return false;
    }
    operation = async () => ({ cache: await storeCache(profile) });
  } else if (message.action === "getStudentCache") operation = async () => ({ cache: await readCache() });
  else if (message.action === "touchStudentCache") operation = async () => ({ cache: await touchCache() });
  else operation = async () => {
    await clearCache();
    return { cleared: true };
  };
  serialized(operation).then(sendResponse, (error) => sendResponse({ error: error.message || String(error) }));
  return true;
});

// An alarm queued for an earlier deadline must not remove a cache that was since extended or
// replaced, so expiry is decided by the stored timestamp, not by the alarm event.
async function expireIfDue() {
  const cache = await readCache();
  if (cache) await chrome.alarms.create(ALARM_NAME, { when: cache.expiresAt });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  serialized(expireIfDue).catch(() => console.warn("Student cache expiry check failed."));
});
