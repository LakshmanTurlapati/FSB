/**
 * Phase 273 / INGEST-07(f) + BEAT-04 -- INSERT OR IGNORE on UNIQUE event_id.
 *
 * Posting the same event_id twice -> only one row stored. The second response
 * indicates accepted=1 but inserted=0 (the .changes property of INSERT OR IGNORE
 * returns 0 when the row was a duplicate).
 *
 * Run: node tests/server-telemetry-event-id-dedup.test.js
 */

'use strict';

const path = require('path');
const http = require('http');
const crypto = require('crypto');

delete process.env.TELEMETRY_RATE_MAX;

const SERVER_NM = path.join(__dirname, '..', 'showcase', 'server', 'node_modules');
const Database = require(require.resolve('better-sqlite3', { paths: [SERVER_NM] }));
const express = require(require.resolve('express', { paths: [SERVER_NM] }));

const { initializeDatabase } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'schema'));
const Queries = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'queries'));
const { hashIp } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'utils', 'telemetry-hash'));
const createTelemetryRouter = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'routes', 'telemetry'));
const { resetPerUuidBudget } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'middleware', 'telemetry-rate-limit'));

resetPerUuidBudget();
const db = new Database(':memory:');
initializeDatabase(db);
const queries = new Queries(db);
const app = express();
app.set('trust proxy', 1);
app.use('/api/telemetry', createTelemetryRouter(db, queries, hashIp));
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

function post(events) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ events });
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/api/telemetry/events',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: chunks }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async function main() {
  console.log('--- server-telemetry-event-id-dedup (INGEST-07f + BEAT-04) ---');

  const eid = uuidv4();
  const ev = {
    event_id: eid,
    install_uuid: uuidv4(),
    ts_minute: Date.now(),
    mcp_client: 'Claude',
    model: 'm',
    tokens_in: 1,
    tokens_out: 1,
    active_agent_count: 0,
    event_type: 'periodic',
  };

  // First POST: 1 row inserted.
  const r1 = await post([ev]);
  let p1 = null; try { p1 = JSON.parse(r1.body); } catch {}
  check('first POST returns 200', r1.statusCode === 200, `got ${r1.statusCode}, body=${r1.body}`);
  check('first POST inserted === 1', p1 && p1.inserted === 1, `body=${r1.body}`);

  // Second POST with the same event_id (and a new install_uuid to avoid budget contamination,
  // but we keep install_uuid the same to truly exercise the event_id dedup contract).
  const r2 = await post([ev]);
  let p2 = null; try { p2 = JSON.parse(r2.body); } catch {}
  check('second POST (same event_id) returns 200', r2.statusCode === 200, `got ${r2.statusCode}, body=${r2.body}`);
  check('second POST accepted === 1', p2 && p2.accepted === 1, `body=${r2.body}`);
  check('second POST inserted === 0 (INSERT OR IGNORE swallowed duplicate)', p2 && p2.inserted === 0, `body=${r2.body}`);

  // SELECT COUNT to confirm exactly one row.
  const count = db.prepare('SELECT COUNT(*) AS c FROM telemetry_events WHERE event_id = ?').get(eid).c;
  check('exactly 1 row with this event_id (UNIQUE PRIMARY KEY)', count === 1, `got ${count}`);

  // Third POST with a DIFFERENT event_id but same install_uuid -> a new row.
  const ev2 = { ...ev, event_id: uuidv4() };
  const r3 = await post([ev2]);
  let p3 = null; try { p3 = JSON.parse(r3.body); } catch {}
  check('third POST (new event_id) inserted === 1', p3 && p3.inserted === 1, `body=${r3.body}`);

  server.close();
  db.close();

  console.log(`\n=== server-telemetry-event-id-dedup results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
