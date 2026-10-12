const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const allowlist = require("../config/allowlist.js");
const crmSource = require("../config/crm-source.js");

let fixtures;
let server;

test.before(async () => {
  fixtures = await import("../e2e/safari/serve-fixtures.mjs");
  server = http.createServer(fixtures.handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
});

test.after(() => server.close());

function get(host, path, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", port: server.address().port, path, method, headers: { host } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    request.on("error", reject);
    request.end();
  });
}

test("Safari fixtures use the development allowlist, and the unapproved frame stays outside it", () => {
  const profileGuard = (path) => crmSource.profilePathPatterns.some((pattern) => pattern.test(path));
  assert.equal(profileGuard(fixtures.paths.crmProfile), true);
  assert.equal(profileGuard(fixtures.paths.crmDashboard), false);
  assert.equal(fixtures.unapprovedOrigin, "http://localhost:3002");
  const approved = [...allowlist.crmOrigins, ...allowlist.portalOrigins, ...allowlist.devCrmOrigins, ...allowlist.devPortalOrigins];
  assert.equal(approved.includes(fixtures.unapprovedOrigin), false);
});

test("fixture server serves synthetic pages only on their development hosts and refuses writes", async () => {
  const crm = await get("localhost:3000", fixtures.paths.crmProfile);
  assert.equal(crm.status, 200);
  assert.match(crm.body, /<title>Synthetic SAMS CRM profile<\/title>/);
  for (const host of ["localhost:3001", "127.0.0.1:3001"]) {
    const bangor = await get(host, fixtures.paths.bangor);
    assert.equal(bangor.status, 200, host);
    assert.match(bangor.body, /id="id_forename"/);
    assert.match(bangor.body, /id="sams-fixture-snapshot"/);
  }
  const frames = await get("localhost:3001", fixtures.paths.frames);
  assert.match(frames.body, /src="http:\/\/127\.0\.0\.1:3001\/bangor\/"/);
  assert.match(frames.body, /src="http:\/\/localhost:3002\/frame\/"/);
  assert.equal((await get("localhost:3002", fixtures.paths.unapprovedFrame)).status, 200);
  assert.equal((await get("localhost:3002", fixtures.paths.bangor)).status, 404);
  assert.equal((await get("app.samscrm.co.uk", fixtures.paths.crmProfile)).status, 404);
  assert.equal((await get("localhost:3001", fixtures.paths.bangor, "POST")).status, 405);
});

test("fixture server answers a malformed host with 400 and keeps serving", async () => {
  assert.deepEqual(await get("bad host", "/bangor/"), { status: 400, body: "Bad request" });
  assert.equal((await get("localhost:3001", fixtures.paths.bangor)).status, 200);
});
