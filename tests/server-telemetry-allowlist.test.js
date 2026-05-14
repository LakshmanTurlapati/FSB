/**
 * Phase 273 / INGEST-09 + D-12 -- 9-field strict allowlist.
 *
 * A 10th field (any name) -> 400 unknown_field, with the offending field
 * name returned in the response. Order of checking is preserved: the first
 * unknown key encountered is reported.
 *
 * Run: node tests/server-telemetry-allowlist.test.js
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

function baseEvent() {
  return {
    event_id: uuidv4(),
    install_uuid: uuidv4(),
    ts_minute: Date.now(),
    mcp_client: 'Claude',
    model: 'm',
    tokens_in: 0,
    tokens_out: 0,
    active_agent_count: 0,
    event_type: 'periodic',
  };
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
  console.log('--- server-telemetry-allowlist (INGEST-09 + D-12) ---');

  // 10th field "prompt" -> 400 unknown_field.
  const ev1 = baseEvent();
  ev1.prompt = 'hi';
  const r1 = await post([ev1]);
  check('10th field "prompt" -> 400', r1.statusCode === 400, `got ${r1.statusCode}, body=${r1.body}`);
  let parsed1 = null;
  try { parsed1 = JSON.parse(r1.body); } catch {}
  check('error === unknown_field for "prompt"', parsed1 && parsed1.error === 'unknown_field', `body=${r1.body}`);
  check('field === "prompt"', parsed1 && parsed1.field === 'prompt', `body=${r1.body}`);

  // 10th field "href" -> 400 unknown_field; field returned.
  const ev2 = baseEvent();
  ev2.href = 'https://example.com';
  const r2 = await post([ev2]);
  check('10th field "href" -> 400', r2.statusCode === 400, `got ${r2.statusCode}, body=${r2.body}`);
  let parsed2 = null;
  try { parsed2 = JSON.parse(r2.body); } catch {}
  check('error === unknown_field for "href"', parsed2 && parsed2.error === 'unknown_field', `body=${r2.body}`);
  check('field === "href"', parsed2 && parsed2.field === 'href', `body=${r2.body}`);

  // 10th field with a benign-sounding name (innerHTML) -> still 400.
  const ev3 = baseEvent();
  ev3.innerHTML = '<x>';
  const r3 = await post([ev3]);
  check('10th field "innerHTML" -> 400 unknown_field', r3.statusCode === 400, `got ${r3.statusCode}, body=${r3.body}`);
  let parsed3 = null; try { parsed3 = JSON.parse(r3.body); } catch {}
  check('field === "innerHTML"', parsed3 && parsed3.field === 'innerHTML', `body=${r3.body}`);

  // The 9-field exact event still passes (sanity).
  const ev4 = baseEvent();
  const r4 = await post([ev4]);
  check('exact 9 fields -> 200 (sanity)', r4.statusCode === 200, `got ${r4.statusCode}, body=${r4.body}`);

  // Sanity: bad UUIDv4 shape is a separate error.
  const ev5 = baseEvent();
  ev5.event_id = 'not-a-uuid';
  const r5 = await post([ev5]);
  check('bad event_id shape -> 400 invalid_event_id', r5.statusCode === 400, `got ${r5.statusCode}, body=${r5.body}`);
  let parsed5 = null; try { parsed5 = JSON.parse(r5.body); } catch {}
  check('error === invalid_event_id for bad uuid', parsed5 && parsed5.error === 'invalid_event_id', `body=${r5.body}`);

  // Sanity: bad mcp_client (not in 13+unknown allowlist).
  const ev6 = baseEvent();
  ev6.mcp_client = 'Other';
  const r6 = await post([ev6]);
  check('bad mcp_client -> 400 invalid_mcp_client', r6.statusCode === 400, `got ${r6.statusCode}, body=${r6.body}`);

  // Sanity: bad event_type.
  const ev7 = baseEvent();
  ev7.event_type = 'unknown_type';
  const r7 = await post([ev7]);
  check('bad event_type -> 400 invalid_event_type', r7.statusCode === 400, `got ${r7.statusCode}, body=${r7.body}`);

  // mcp_client 'unknown' is allowed (14th value in the allowlist).
  const ev8 = baseEvent();
  ev8.mcp_client = 'unknown';
  const r8 = await post([ev8]);
  check('mcp_client === "unknown" -> 200 (14th allowed value)', r8.statusCode === 200, `got ${r8.statusCode}, body=${r8.body}`);

  // The emoji-bearing allowlist label is accepted.
  const ev9 = baseEvent();
  ev9.mcp_client = 'OpenClaw 🦀';
  const r9 = await post([ev9]);
  check('mcp_client === "OpenClaw 🦀" -> 200 (emoji label survives JSON encoding)', r9.statusCode === 200, `got ${r9.statusCode}, body=${r9.body}`);

  server.close();
  db.close();

  console.log(`\n=== server-telemetry-allowlist results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
