importScripts("../config/build-mode.js", "../config/allowlist.js");

const CACHE_KEY = "studentCache";
const ALARM_NAME = "expire-student-cache";

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!["cacheStudent", "getStudentCache", "touchStudentCache", "clearStudentCache"].includes(message.action)) {
    return false;
  }
  (async () => {
    if (message.action === "cacheStudent") sendResponse({ cache: await storeCache(message.profile) });
    else if (message.action === "getStudentCache") sendResponse({ cache: await readCache() });
    else if (message.action === "touchStudentCache") sendResponse({ cache: await touchCache() });
    else if (message.action === "clearStudentCache") {
      await clearCache();
      sendResponse({ cleared: true });
    }
  })().catch((error) => sendResponse({ error: error.message || String(error) }));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) clearCache();
});
