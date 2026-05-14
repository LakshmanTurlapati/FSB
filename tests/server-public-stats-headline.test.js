/**
 * Phase 274 / AGG-01..09 + STATS-04 -- public-stats /global endpoint shape.
 *
 * Mounts the public-stats router plus the telemetry router (so we can POST
 * events into active-tracker), seeds telemetry_rollups_daily +
 * telemetry_global_aggregates, then asserts the FSBTelemetryHeadline shape
 * + ETag + Cache-Control + no-PII invariants.
 *
 * Run: node tests/server-public-stats-headline.test.js
 */

'use strict';

const path = require('path');
const http = require('http');
const crypto = require('crypto');

// Disable per-IP rate-limit pressure for tests that POST many events fast.
delete process.env.TELEMETRY_RATE_MAX;

const SERVER_NM = path.join(__dirname, '..', 'showcase', 'server', 'node_modules');
const Database = require(require.resolve('better-sqlite3', { paths: [SERVER_NM] }));
const express = require(require.resolve('express', { paths: [SERVER_NM] }));

const { initializeDatabase } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'schema'));
const Queries = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'queries'));
const { hashIp } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'utils', 'telemetry-hash'));
const createTelemetryRouter = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'routes', 'telemetry'));
const createPublicStatsRouter = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'routes', 'public-stats'));
const activeTracker = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'telemetry', 'active-tracker'));
const { resetPerUuidBudget } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'middleware', 'telemetry-rate-limit'));

resetPerUuidBudget();
activeTracker._resetForTest();
const db = new Database(':memory:');
initializeDatabase(db);
const queries = new Queries(db);

const app = express();
app.set('trust proxy', 1);
app.use('/api/telemetry', createTelemetryRouter(db, queries, hashIp));
app.use('/api/public-stats', createPublicStatsRouter(db, queries));
const server = http.createServer(app).listen(0);
const port = server.address().port;

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail}`); }
}

function uuidv4() {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function postJson(path_, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      method: 'POST', host: '127.0.0.1', port, path: path_,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: chunks }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function getJson(path_, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'GET', host: '127.0.0.1', port, path: path_,
      headers: extraHeaders,
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: chunks }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async function main() {
  console.log('--- server-public-stats-headline (AGG-01..09 + STATS-04) ---');

  // --- Seed telemetry_rollups_daily: 3 UUIDs across 2 days. ---
  const UUID_A = '11111111-1111-4111-8111-111111111111';
  const UUID_B = '22222222-2222-4222-8222-222222222222';
  const UUID_C = '33333333-3333-4333-8333-333333333333';
  const TODAY = new Date().toISOString().slice(0, 10);
  // Yesterday in UTC (used only for the rollup seed -- 1 row per UUID per day).
  const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  queries.upsertRollupDailyRow(UUID_A, TODAY, 100, 50, 2, 3);
  queries.upsertRollupDailyRow(UUID_B, TODAY, 200, 100, 1, 2);
  queries.upsertRollupDailyRow(UUID_C, TODAY, 50, 25, 3, 1);
  queries.upsertRollupDailyRow(UUID_A, YESTERDAY, 30, 20, 1, 1);

  // --- Seed telemetry_global_aggregates: 2 rows (today + yesterday). ---
  // popular_mcp_json has a >=k=5 label "Claude" plus an Other bucket (housekeeper
  // would have written this already). We seed it directly here.
  const popularMcpToday = JSON.stringify([
    { label: 'Claude', uniq: 6 },
    { label: 'Other (N=12)', uniq: 12 },
  ]);
  const popularAgentToday = JSON.stringify([
    { label: 'agent-x', uniq: 8 },
  ]);
  queries.upsertGlobalAggregateRow(TODAY, 3, 350, 175, 6, popularMcpToday, popularAgentToday);
  queries.upsertGlobalAggregateRow(YESTERDAY, 1, 30, 20, 1, '[]', '[]');

  // --- POST 3 telemetry events so active-tracker has 3 distinct UUIDs. ---
  // Use the active-tracker's _resetForTest to keep state hermetic.
  activeTracker._resetForTest();
  for (const uuid of [UUID_A, UUID_B, UUID_C]) {
    const ev = {
      event_id: uuidv4(),
      install_uuid: uuid,
      ts_minute: Date.now(),
      mcp_client: 'Claude',
      model: 'm',
      tokens_in: 10,
      tokens_out: 5,
      active_agent_count: uuid === UUID_A ? 2 : uuid === UUID_B ? 1 : 3,
      event_type: 'periodic',
    };
    const r = await postJson('/api/telemetry/events', { events: [ev] });
    if (r.statusCode !== 200) {
      console.error(`  WARN: seed POST failed -- status ${r.statusCode} body=${r.body}`);
    }
  }
  check('active-tracker has 3 UUIDs after seed', activeTracker.countActiveUsers(5 * 60 * 1000) === 3,
    `got ${activeTracker.countActiveUsers(5 * 60 * 1000)}`);
  check('active-tracker agent-sum is 6 (2+1+3)', activeTracker.getActiveAgentSum(10 * 60 * 1000) === 6,
    `got ${activeTracker.getActiveAgentSum(10 * 60 * 1000)}`);

  // --- GET /api/public-stats/global. ---
  const r = await getJson('/api/public-stats/global');
  check('GET /global -> 200', r.statusCode === 200, `got ${r.statusCode} body=${r.body.slice(0, 200)}`);
  check('Content-Type is JSON', /application\/json/.test(r.headers['content-type'] || ''),
    `got ${r.headers['content-type']}`);
  check('ETag header present and looks like "<16hex>"', typeof r.headers.etag === 'string' && /^"[a-f0-9]{16}"$/.test(r.headers.etag),
    `got ${r.headers.etag}`);
  check('Cache-Control: max-age=60 header present',
    typeof r.headers['cache-control'] === 'string' && /max-age=60/.test(r.headers['cache-control']),
    `got ${r.headers['cache-control']}`);
  check('No Set-Cookie header (STATS-04 + no-cookie invariant)',
    r.headers['set-cookie'] === undefined,
    `got ${JSON.stringify(r.headers['set-cookie'])}`);

  // --- Parse + validate the body shape. ---
  let body = null;
  try { body = JSON.parse(r.body); } catch {}
  check('body parses as JSON', body !== null, `body=${r.body.slice(0, 200)}`);
  if (body) {
    const expectedFields = [
      'active_users_now', 'active_agents_now', 'active_agents_bucket',
      'total_users', 'total_agents_lifetime', 'tokens_total_lifetime',
      'tokens_24h', 'popular_mcp_clients', 'popular_agents', 'avg_agents_per_user',
    ];
    for (const f of expectedFields) {
      check(`body has field '${f}'`, f in body, `body keys=${Object.keys(body)}`);
    }
    check('active_users_now === 3', body.active_users_now === 3, `got ${body.active_users_now}`);
    check('active_agents_now === 6', body.active_agents_now === 6, `got ${body.active_agents_now}`);
    check('active_agents_bucket === "5-8"', body.active_agents_bucket === '5-8', `got ${body.active_agents_bucket}`);
    check('total_users === 3 (DISTINCT UUIDs in rollups: A,B,C)', body.total_users === 3, `got ${body.total_users}`);
    // total_agents_lifetime: SUM(max_active_agents) = 2 + 1 + 3 + 1 = 7
    check('total_agents_lifetime === 7 (sum of max_active_agents across 4 rollup rows)',
      body.total_agents_lifetime === 7, `got ${body.total_agents_lifetime}`);
    // tokens lifetime: today (350+175) + yesterday (30+20) = 575
    check('tokens_total_lifetime === 575',
      body.tokens_total_lifetime === 575, `got ${body.tokens_total_lifetime}`);
    check('tokens_24h is a number >= 0', typeof body.tokens_24h === 'number' && body.tokens_24h >= 0,
      `got ${body.tokens_24h}`);
    check('popular_mcp_clients is array of {label,uniq}',
      Array.isArray(body.popular_mcp_clients) && body.popular_mcp_clients.every(
        (x) => typeof x.label === 'string' && Number.isInteger(x.uniq)),
      `got ${JSON.stringify(body.popular_mcp_clients)}`);
    check('popular_mcp_clients includes Claude with uniq=6',
      body.popular_mcp_clients.some((x) => x.label === 'Claude' && x.uniq === 6),
      `got ${JSON.stringify(body.popular_mcp_clients)}`);
    check('popular_agents is array of {label,uniq}',
      Array.isArray(body.popular_agents) && body.popular_agents.every(
        (x) => typeof x.label === 'string' && Number.isInteger(x.uniq)),
      `got ${JSON.stringify(body.popular_agents)}`);
    check('avg_agents_per_user === 2.0 (6/3)',
      body.avg_agents_per_user === 2 || body.avg_agents_per_user === 2.0,
      `got ${body.avg_agents_per_user}`);
  }

  // --- T-274-01 privacy: no PII in body. ---
  const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  check('body contains NO UUIDv4-shaped string (privacy)', !UUID_REGEX.test(r.body),
    `body=${r.body.slice(0, 200)}`);
  check('body contains NO literal "ip_hash"', !r.body.includes('ip_hash'), 'leaked ip_hash');
  check('body contains NO literal "event_id"', !r.body.includes('event_id'), 'leaked event_id');
  check('body contains NO literal "install_uuid"', !r.body.includes('install_uuid'), 'leaked install_uuid');

  server.close();
  db.close();

  console.log(`\n=== server-public-stats-headline results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
