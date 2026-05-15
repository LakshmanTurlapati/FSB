/**
 * Phase 274 / STATS-04 + T-274-09 -- public-stats no-auth + no-cookie + no-PII.
 *
 * Mounts BOTH the auth-gated /api/stats handler AND the public /api/public-stats
 * router in the same Express app, then asserts:
 *  - GET /api/public-stats/global with NO auth headers returns 200.
 *  - No Set-Cookie or WWW-Authenticate header on the public response.
 *  - GET /api/stats with NO auth header returns 401 (proves path-shadow safety:
 *    /api/public-stats and /api/stats are distinct namespaces).
 *  - Both endpoints' bodies (where applicable) carry no PII signatures.
 *
 * Run: node tests/server-public-stats-no-auth.test.js
 */

'use strict';

const path = require('path');
const http = require('http');

const SERVER_NM = path.join(__dirname, '..', 'showcase', 'server', 'node_modules');
const Database = require(require.resolve('better-sqlite3', { paths: [SERVER_NM] }));
const express = require(require.resolve('express', { paths: [SERVER_NM] }));
const cors = require(require.resolve('cors', { paths: [SERVER_NM] }));

const { initializeDatabase } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'schema'));
const Queries = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'queries'));
const authMiddleware = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'middleware', 'auth'));
const createAuthRouter = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'routes', 'auth'));
const createPublicStatsRouter = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'routes', 'public-stats'));
const activeTracker = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'telemetry', 'active-tracker'));
const { resetPerUuidBudget } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'middleware', 'telemetry-rate-limit'));

resetPerUuidBudget();
activeTracker._resetForTest();
const db = new Database(':memory:');
initializeDatabase(db);
const queries = new Queries(db);

const app = express();
// Reproduce the server.js cors layer so we surface any Set-Cookie injection paths.
app.use(cors({ origin: true, credentials: true, exposedHeaders: ['X-FSB-Hash-Key'] }));
app.use(express.json());

// Mount /api/auth + auth-gated /api/stats + public /api/public-stats in the same
// app so we can verify they don't shadow each other.
app.use('/api/auth', createAuthRouter(queries));
const auth = authMiddleware(queries);
app.use('/api/stats', auth, (req, res) => {
  res.json(queries.getAgentStats(req.hashKey));
});
app.use('/api/public-stats', createPublicStatsRouter(db, queries));

const server = http.createServer(app).listen(0);
const port = server.address().port;

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail}`); }
}

function rawGet(path_, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ method: 'GET', host: '127.0.0.1', port, path: path_, headers: extraHeaders }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: chunks }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async function main() {
  console.log('--- server-public-stats-no-auth (STATS-04 + T-274-09) ---');

  // Seed a tiny global aggregate so the headline isn't entirely zero.
  const today = new Date().toISOString().slice(0, 10);
  queries.upsertGlobalAggregateRow(today, 1, 10, 5, 1, '[]', '[]');
  queries.upsertRollupDailyRow('11111111-1111-4111-8111-111111111111', today, 5, 5, 1, 1);

  // --- 1. PUBLIC endpoint with NO auth headers -> 200. ---
  const pub = await rawGet('/api/public-stats/global');
  check('GET /api/public-stats/global (no auth) -> 200', pub.statusCode === 200,
    `got ${pub.statusCode} body=${pub.body.slice(0, 200)}`);
  check('Public response has NO Set-Cookie header',
    pub.headers['set-cookie'] === undefined, `got ${JSON.stringify(pub.headers['set-cookie'])}`);
  check('Public response has NO WWW-Authenticate header',
    pub.headers['www-authenticate'] === undefined, `got ${pub.headers['www-authenticate']}`);

  // --- 2. AUTH-GATED endpoint with NO auth header -> 401. ---
  const auth401 = await rawGet('/api/stats');
  check('GET /api/stats (no auth) -> 401 (path-shadow safety)', auth401.statusCode === 401,
    `got ${auth401.statusCode} body=${auth401.body}`);

  // --- 3. Confirm /api/public-stats does NOT accidentally satisfy the auth gate either.
  //        Path shape: /api/public-stats/global vs /api/stats. Exact-prefix routing
  //        means /api/stats does NOT match /api/public-stats/global. Repeat the
  //        public GET with the same headers a typical browser would carry to ensure
  //        no quirk pops up. ---
  const pub2 = await rawGet('/api/public-stats/global', {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (test)',
  });
  check('GET /api/public-stats/global (browser-like headers) -> 200',
    pub2.statusCode === 200, `got ${pub2.statusCode}`);
  check('Public response (browser-like) still has NO Set-Cookie',
    pub2.headers['set-cookie'] === undefined, `got ${JSON.stringify(pub2.headers['set-cookie'])}`);

  // --- 4. Confirm /global/series same posture. ---
  const series = await rawGet('/api/public-stats/global/series');
  check('GET /api/public-stats/global/series (no auth) -> 200', series.statusCode === 200,
    `got ${series.statusCode}`);
  check('Series response has NO Set-Cookie',
    series.headers['set-cookie'] === undefined, `got ${JSON.stringify(series.headers['set-cookie'])}`);

  // --- 5. PII regex over both public bodies. ---
  const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  for (const [name, body] of [['headline', pub.body], ['series', series.body]]) {
    check(`${name} body has no UUIDv4`, !UUID_REGEX.test(body), `body=${body.slice(0, 200)}`);
    check(`${name} body has no "ip_hash"`, !body.includes('ip_hash'), 'leak');
    check(`${name} body has no "event_id"`, !body.includes('event_id'), 'leak');
    check(`${name} body has no "install_uuid"`, !body.includes('install_uuid'), 'leak');
    check(`${name} body has no "received_at"`, !body.includes('received_at'), 'leak');
  }

  // --- 6. With an UNTRUSTED Authorization header on the public route -> still 200, still no cookies. ---
  // (Adversary cannot promote themselves; the path has no auth middleware to check.)
  const pubAdvers = await rawGet('/api/public-stats/global', {
    'Authorization': 'Bearer adversarial-token',
    'X-FSB-Hash-Key': 'forged-key',
  });
  check('Public route ignores unsolicited Authorization header (still 200)',
    pubAdvers.statusCode === 200, `got ${pubAdvers.statusCode}`);
  check('Public route does NOT leak Authorization back as Set-Cookie',
    pubAdvers.headers['set-cookie'] === undefined, `got ${JSON.stringify(pubAdvers.headers['set-cookie'])}`);

  // --- 7. Verify request path /api/public-stats does NOT cross-match /api/stats. ---
  // Try a deliberate prefix-walk: ensure /api/public-stats does NOT match the auth-gated handler.
  const crossPrefix = await rawGet('/api/public-stats');
  // The router has no root handler so Express returns 404. Anything other than
  // 401 means the auth gate didn't fire on /api/public-stats.
  check('GET /api/public-stats (no auth, no inner route) -> NOT 401',
    crossPrefix.statusCode !== 401, `got ${crossPrefix.statusCode}`);

  server.close();
  db.close();

  console.log(`\n=== server-public-stats-no-auth results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
