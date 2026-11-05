// Tells staff when a newer GitHub release exists. Unpacked extensions cannot update themselves,
// so this only reports: staff still download and load the new folder by hand.
{
const RELEASES_API = "https://api.github.com/repos/mwijanarko1/sams-portal-autofill-extension/releases?per_page=20";
const RELEASE_PAGE_PREFIX = "https://github.com/mwijanarko1/sams-portal-autofill-extension/releases/";
const STORAGE_KEY = "latestRelease";

// Only plain Chrome tags such as v0.4.0. The Safari releases carry a -safari suffix.
function parseVersion(tag) {
  const match = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/.exec(typeof tag === "string" ? tag : "");
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function newestRelease(releases) {
  if (!Array.isArray(releases)) return null;
  const candidates = releases
    .filter((release) => release && !release.draft && !release.prerelease
      && typeof release.html_url === "string" && release.html_url.startsWith(RELEASE_PAGE_PREFIX)
      && parseVersion(release.tag_name))
    .map((release) => ({ parsed: parseVersion(release.tag_name), url: release.html_url }));
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (compareVersions(b.parsed, a.parsed) > 0 ? b : a));
  return { version: best.parsed.join("."), url: best.url };
}

async function check() {
  const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`Release check returned ${response.status}.`);
  const latest = newestRelease(await response.json());
  if (latest) await chrome.storage.local.set({ [STORAGE_KEY]: latest });
}

// The stored release is compared on every read, so installing the new version clears it
// without any cleanup step.
async function available() {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  const latest = stored && parseVersion(stored.version);
  const current = parseVersion(chrome.runtime.getManifest().version);
  const url = stored && typeof stored.url === "string" && stored.url.startsWith(RELEASE_PAGE_PREFIX);
  return latest && current && url && compareVersions(latest, current) > 0 ? stored : null;
}

globalThis.SAMS_UPDATE = { available, check };
}
