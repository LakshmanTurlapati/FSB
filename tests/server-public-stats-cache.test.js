/**
 * Phase 274 / AGG-09 -- public-stats cache invariants.
 *
 * Validates the 30-second in-process memo + If-None-Match round-trip:
 *  - GET /global -> 200 with ETag header.
 *  - GET /global with If-None-Match: <etag> -> 304 with empty body.
 *  - GET /global within 30s memo TTL returns BYTE-IDENTICAL body even when
 *    underlying SQLite rows change.
 *  - After memo reset (via _resetMemoForTest), GET /global reflects the new
 *    SQLite state.
 *
 * Run: node tests/server-public-stats-cache.test.js
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

// Capture the router so we can _resetMemoForTest mid-test (verifies that
// without a reset the body is byte-stable, then with a reset it changes).
const publicRouter = createPublicStatsRouter(db, queries);
const app = express();
app.use('/api/public-stats', publicRouter);
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
  console.log('--- server-public-stats-cache (AGG-09 memo + ETag) ---');

  // Seed minimum data so headline is not all zeros.
  const today = new Date().toISOString().slice(0, 10);
  queries.upsertGlobalAggregateRow(today, 5, 100, 50, 7, '[]', '[]');
  queries.upsertRollupDailyRow('11111111-1111-4111-8111-111111111111', today, 50, 25, 2, 1);

  // --- Round 1: cold fetch. ---
  const r1 = await rawGet('/api/public-stats/global');
  check('cold GET /global -> 200', r1.statusCode === 200, `got ${r1.statusCode}`);
  const etag1 = r1.headers.etag;
  check('cold GET has ETag header', typeof etag1 === 'string' && etag1.startsWith('"'), `got ${etag1}`);
  const body1 = r1.body;

  // --- Round 2: If-None-Match matches -> 304 with empty body. ---
  const r2 = await rawGet('/api/public-stats/global', { 'If-None-Match': etag1 });
  check('GET /global If-None-Match=etag1 -> 304', r2.statusCode === 304, `got ${r2.statusCode}`);
  check('304 response body is empty', r2.body.length === 0, `got body length ${r2.body.length}`);
  check('304 response echoes same ETag', r2.headers.etag === etag1, `got ${r2.headers.etag}`);
  check('304 response still sets Cache-Control', /max-age=60/.test(r2.headers['cache-control'] || ''),
    `got ${r2.headers['cache-control']}`);

  // --- Round 3: change underlying SQLite mid-cache. ---
  // Force the global aggregate to have totally different numbers; without a memo
  // reset, the next GET MUST still return the original body1.
  queries.upsertGlobalAggregateRow(today, 999, 99999, 99999, 999, '[]', '[]');
  const r3 = await rawGet('/api/public-stats/global');
  check('GET /global within memo TTL -> 200', r3.statusCode === 200, `got ${r3.statusCode}`);
  check('GET /global within memo TTL returns byte-identical body (memo hit)',
    r3.body === body1, `body diff: cached len ${body1.length}, fresh len ${r3.body.length}`);
  check('GET /global within memo TTL returns same ETag',
    r3.headers.etag === etag1, `got ${r3.headers.etag}`);

  // --- Round 4: reset memo, expect a new body reflecting the SQL change. ---
  publicRouter._resetMemoForTest();
  const r4 = await rawGet('/api/public-stats/global');
  check('After memo reset, GET /global -> 200', r4.statusCode === 200, `got ${r4.statusCode}`);
  check('After memo reset, body differs (now reflects new SQLite state)',
    r4.body !== body1, 'body identical -- memo not reset');
  check('After memo reset, ETag differs', r4.headers.etag !== etag1,
    `got same etag ${r4.headers.etag}`);

  // Parse the new body and check it has the new total_users from the bumped aggregate.
  let body4 = null;
  try { body4 = JSON.parse(r4.body); } catch {}
  // total_users counts DISTINCT install_uuid from telemetry_rollups_daily; we only inserted one.
  // tokens_total_lifetime reflects the new global aggregate row: 99999 + 99999 = 199998.
  check('After memo reset, tokens_total_lifetime reflects new global aggregate',
    body4 && body4.tokens_total_lifetime === 199998, `got ${body4 && body4.tokens_total_lifetime}`);

  // --- Round 5: If-None-Match with stale etag (etag1) after reset -> NOT 304, 200 with new body. ---
  const r5 = await rawGet('/api/public-stats/global', { 'If-None-Match': etag1 });
  check('Stale If-None-Match after memo reset -> 200 (not 304)',
    r5.statusCode === 200, `got ${r5.statusCode}`);
  check('Stale If-None-Match response has the new body',
    r5.body === r4.body, `body diff`);

  // --- Round 6: same etag but for the series endpoint (separate memo key). ---
  const seriesR1 = await rawGet('/api/public-stats/global/series');
  check('GET /global/series -> 200 (independent memo key)', seriesR1.statusCode === 200, `got ${seriesR1.statusCode}`);
  check('series etag differs from headline etag',
    seriesR1.headers.etag !== r4.headers.etag,
    `headline=${r4.headers.etag} series=${seriesR1.headers.etag}`);

  server.close();
  db.close();

  console.log(`\n=== server-public-stats-cache results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
