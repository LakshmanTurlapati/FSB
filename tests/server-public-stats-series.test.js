/**
 * Phase 274 / AGG-09 -- public-stats /global/series endpoint shape.
 *
 * Seeds telemetry_global_aggregates across ~100 days, then asserts:
 *  - three keys present (d30, d90, d365)
 *  - each is an array of points {day_utc, unique_installs, tokens, agents_active}
 *  - arrays sorted ascending by day_utc
 *  - d30.length <= d90.length <= d365.length (window invariant)
 *
 * Run: node tests/server-public-stats-series.test.js
 */

'use strict';

const path = require('path');
const http = require('http');

const SERVER_NM = path.join(__dirname, '..', 'showcase', 'server', 'node_modules');
const Database = require(require.resolve('better-sqlite3', { paths: [SERVER_NM] }));
const express = require(require.resolve('express', { paths: [SERVER_NM] }));

const { initializeDatabase } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'schema'));
const Queries = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'queries'));
const createPublicStatsRouter = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'routes', 'public-stats'));
const activeTracker = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'telemetry', 'active-tracker'));
const { resetPerUuidBudget } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'middleware', 'telemetry-rate-limit'));

resetPerUuidBudget();
activeTracker._resetForTest();
const db = new Database(':memory:');
initializeDatabase(db);
const queries = new Queries(db);

const app = express();
app.use('/api/public-stats', createPublicStatsRouter(db, queries));
const server = http.createServer(app).listen(0);
const port = server.address().port;

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail}`); }
}

function getJson(path_) {
  return new Promise((resolve, reject) => {
    const req = http.request({ method: 'GET', host: '127.0.0.1', port, path: path_ }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: chunks }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async function main() {
  console.log('--- server-public-stats-series (AGG-09) ---');

  // Seed 100 days of telemetry_global_aggregates. d30 should contain ~30 rows,
  // d90 ~90, d365 100 (since we only seeded 100 of the 365-day window).
  const ONE_DAY_MS = 86400000;
  const today = Date.now();
  const seededDays = 100;
  for (let i = 0; i < seededDays; i++) {
    const dayMs = today - i * ONE_DAY_MS;
    const day_utc = new Date(dayMs).toISOString().slice(0, 10);
    queries.upsertGlobalAggregateRow(day_utc, 5 + i, 100 * (i + 1), 50 * (i + 1), 7, '[]', '[]');
  }

  const r = await getJson('/api/public-stats/global/series');
  check('GET /global/series -> 200', r.statusCode === 200, `got ${r.statusCode} body=${r.body.slice(0, 200)}`);
  check('Content-Type is JSON', /application\/json/.test(r.headers['content-type'] || ''),
    `got ${r.headers['content-type']}`);
  check('ETag header present', typeof r.headers.etag === 'string' && r.headers.etag.startsWith('"'),
    `got ${r.headers.etag}`);
  check('Cache-Control: max-age=60 present',
    /max-age=60/.test(r.headers['cache-control'] || ''),
    `got ${r.headers['cache-control']}`);

  let body = null;
  try { body = JSON.parse(r.body); } catch {}
  check('body parses as JSON', body !== null, `body=${r.body.slice(0, 200)}`);
  if (body) {
    check('body has d30 key', Array.isArray(body.d30), `got ${typeof body.d30}`);
    check('body has d90 key', Array.isArray(body.d90), `got ${typeof body.d90}`);
    check('body has d365 key', Array.isArray(body.d365), `got ${typeof body.d365}`);

    // SQLite's `date('now', '-30 days')` is exclusive on the lower bound (day),
    // so for 100 seeded consecutive days the windows should contain ~30/~90/100.
    // We assert lower bounds + the monotonic inclusion invariant.
    check('d30.length is >= 25 and <= 31', body.d30.length >= 25 && body.d30.length <= 31, `got ${body.d30.length}`);
    check('d90.length is >= 85 and <= 91', body.d90.length >= 85 && body.d90.length <= 91, `got ${body.d90.length}`);
    check('d365.length === 100 (all seeded rows visible to 365d window)',
      body.d365.length === 100, `got ${body.d365.length}`);

    check('d30.length <= d90.length', body.d30.length <= body.d90.length,
      `${body.d30.length} > ${body.d90.length}`);
    check('d90.length <= d365.length', body.d90.length <= body.d365.length,
      `${body.d90.length} > ${body.d365.length}`);

    // Sort + shape check on one window.
    if (body.d30.length > 1) {
      let isAscending = true;
      for (let i = 1; i < body.d30.length; i++) {
        if (body.d30[i].day_utc < body.d30[i - 1].day_utc) {
          isAscending = false; break;
        }
      }
      check('d30 is sorted ascending by day_utc', isAscending,
        `got ${body.d30.map((p) => p.day_utc).join(',')}`);
    }

    // Per-point shape.
    if (body.d30.length > 0) {
      const p = body.d30[0];
      check('d30[0].day_utc is YYYY-MM-DD string',
        typeof p.day_utc === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.day_utc),
        `got ${p.day_utc}`);
      check('d30[0].unique_installs is integer', Number.isInteger(p.unique_installs),
        `got ${p.unique_installs} (${typeof p.unique_installs})`);
      check('d30[0].tokens is integer (sum of in + out)', Number.isInteger(p.tokens),
        `got ${p.tokens} (${typeof p.tokens})`);
      check('d30[0].agents_active is integer', Number.isInteger(p.agents_active),
        `got ${p.agents_active} (${typeof p.agents_active})`);
    }

    // Privacy: series body must not leak install_uuid or ip_hash or event_id.
    check('body contains NO "install_uuid"', !r.body.includes('install_uuid'), 'leak');
    check('body contains NO "ip_hash"', !r.body.includes('ip_hash'), 'leak');
    check('body contains NO "event_id"', !r.body.includes('event_id'), 'leak');
  }

  server.close();
  db.close();

  console.log(`\n=== server-public-stats-series results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
