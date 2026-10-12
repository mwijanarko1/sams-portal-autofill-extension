import { createServer } from "node:http";
import { connect } from "node:net";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Serves synthetic fixtures on the development-build origins for manual Safari acceptance.
// Portal mappings match only production origins, so these pages exercise generic matching.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const allowlist = createRequire(import.meta.url)(join(root, "config/allowlist.js"));
const [crmOrigin] = allowlist.devCrmOrigins;
const portalOrigins = allowlist.devPortalOrigins;
export const unapprovedOrigin = "http://localhost:3002";
export const paths = {
  crmProfile: "/agent/leads/full-profile/e2e-synthetic/",
  crmDashboard: "/agent/dashboard",
  bangor: "/bangor/",
  greenwich: "/greenwich/",
  frames: "/frames/",
  unapprovedFrame: "/frame/",
};

const fixture = (name) => readFileSync(join(root, "e2e/fixtures", name), "utf8");

const snapshot = `
  <aside><h2>Fixture snapshot</h2><pre id="sams-fixture-snapshot"></pre></aside>
  <script>
    (() => {
      const out = document.getElementById("sams-fixture-snapshot");
      const render = () => {
        const values = {};
        for (const control of document.querySelectorAll("input, select, textarea")) {
          if (!control.id) continue;
          values[control.id] = ["checkbox", "radio"].includes(control.type) ? control.checked
            : control.type === "file" ? control.files.length : control.value;
        }
        out.textContent = JSON.stringify({ activity: window.activity || null, values }, null, 2);
      };
      document.addEventListener("input", render);
      document.addEventListener("change", render);
      setInterval(render, 1000);
      render();
    })();
  </script>
`;

const withSnapshot = (html) => html.replace("</body>", `${snapshot}</body>`);

const activityScript = `
  <script>
    window.activity = { submissions: 0, clicks: 0, changes: [] };
    document.addEventListener("submit", (event) => { event.preventDefault(); activity.submissions++; });
    document.addEventListener("click", (event) => { if (event.target.closest("button, a")) activity.clicks++; });
    document.addEventListener("change", (event) => { activity.changes.push(event.target.id); });
  </script>`;

const framesPage = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Synthetic frame targeting fixture</title></head>
<body>
  <main>
    <h1>Frame targeting fixture</h1>
    <form><label for="top_first_name">First name</label><input id="top_first_name"></form>
    <iframe title="Approved child frame" src="${portalOrigins[1]}${paths.bangor}" width="900" height="520"></iframe>
    <iframe title="Unapproved child frame" src="${unapprovedOrigin}${paths.unapprovedFrame}" width="900" height="320"></iframe>
  </main>
  ${activityScript}
</body>
</html>`;

const unapprovedFrame = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Synthetic unapproved frame</title></head>
<body>
  <form>
    <label for="first_name">First name</label><input id="first_name">
    <label for="email">Email</label><input id="email" type="email">
  </form>
  ${activityScript}
</body>
</html>`;

export function route(origin, pathname) {
  if (origin === crmOrigin && pathname === paths.crmProfile) return fixture("crm.html");
  if (origin === crmOrigin && pathname === paths.crmDashboard) {
    return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Dashboard</title></head><body><main><h1>Dashboard</h1></main></body></html>";
  }
  if (portalOrigins.includes(origin)) {
    if (pathname === paths.bangor) return withSnapshot(fixture("bangor.html"));
    if (pathname === paths.greenwich) return withSnapshot(fixture("greenwich.html"));
    if (pathname === paths.frames) return withSnapshot(framesPage);
  }
  if (origin === unapprovedOrigin && pathname === paths.unapprovedFrame) return withSnapshot(unapprovedFrame);
  return null;
}

export function handle(request, response) {
  const origin = `http://${request.headers.host}`;
  let pathname;
  try {
    pathname = new URL(request.url, origin).pathname;
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Bad request");
    return;
  }
  if (request.method !== "GET") {
    console.warn(`Refused unexpected ${request.method} ${pathname}`);
    response.writeHead(405).end();
    return;
  }
  const body = route(origin, pathname);
  response.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(body || "Not a fixture");
}

// macOS can let a specific-address bind shadow another app's wildcard listener, so probe first.
function answers(port, host) {
  return new Promise((resolveProbe) => {
    const socket = connect({ port, host, timeout: 500 });
    const done = (result) => { socket.destroy(); resolveProbe(result); };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function listen(port, host) {
  return new Promise((resolveListen, rejectListen) => {
    const server = createServer(handle);
    server.once("error", rejectListen);
    server.listen(port, host, () => resolveListen(server));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ports = [...new Set([crmOrigin, ...portalOrigins, unapprovedOrigin].map((origin) => Number(new URL(origin).port)))];
  for (const port of ports) {
    if (await answers(port, "127.0.0.1") || await answers(port, "::1")) {
      console.error(`Port ${port} is already in use by another process. Safari fixtures need ports ${ports.join(", ")}. Leave that service running unless its owner approves stopping it, and record the fixture cases as Blocked (port conflict).`);
      process.exit(1);
    }
  }
  const servers = [];
  try {
    for (const port of ports) {
      servers.push(await listen(port, "127.0.0.1"));
      // Safari may resolve localhost to IPv6 first.
      servers.push(await listen(port, "::1").catch((error) => {
        if (error.code === "EADDRNOTAVAIL") return null;
        throw error;
      }));
    }
  } catch (error) {
    for (const server of servers) server?.close();
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${error.port} is already in use by another process. Safari fixtures need ports ${ports.join(", ")}. Leave that service running unless its owner approves stopping it, and record the fixture cases as Blocked (port conflict).`);
      process.exit(1);
    }
    throw error;
  }
  console.log(`CRM profile: ${crmOrigin}${paths.crmProfile}`);
  console.log(`CRM non-profile: ${crmOrigin}${paths.crmDashboard}`);
  console.log(`Bangor fixture: ${portalOrigins[0]}${paths.bangor}`);
  console.log(`Greenwich fixture: ${portalOrigins[0]}${paths.greenwich}`);
  console.log(`Frames fixture: ${portalOrigins[0]}${paths.frames}`);
  console.log("Press Ctrl+C to stop.");
}
