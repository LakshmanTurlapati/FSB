/**
 * Phase 273 / INGEST-04 -- daily-rotated salt invariants.
 *
 * Asserts:
 *   1. Two calls within the same UTC day return the SAME salt_hex.
 *   2. After advancing nowMs by ~25 hours, the next call mints a NEW salt
 *      (different hex) and assigns it to the new day's row.
 *   3. After rotation, pre-yesterday rows are DELETED but yesterday's row
 *      is RETAINED (cross-midnight grace).
 *
 * Zero-dep: pure Node + assert + in-memory better-sqlite3.
 *
 * Run: node tests/server-telemetry-salt-rotation.test.js
 */

'use strict';

const path = require('path');
const assert = require('assert');

// Resolve better-sqlite3 from showcase/server/node_modules where it lives.
const Database = require(require.resolve('better-sqlite3', {
  paths: [path.join(__dirname, '..', 'showcase', 'server', 'node_modules')],
}));

const { initializeDatabase } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'db', 'schema'));
const { getOrMintTodaySalt } = require(path.join(__dirname, '..', 'showcase', 'server', 'src', 'utils', 'telemetry-salt'));

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  PASS: ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL: ${label} -- ${detail}`);
  }
}

const db = new Database(':memory:');
initializeDatabase(db);

// Day T0: 2026-05-14 06:00 UTC.
const T0 = Date.UTC(2026, 4, 14, 6, 0, 0);

console.log('--- Same-day salt is stable ---');
const r1 = getOrMintTodaySalt(db, T0);
const r2 = getOrMintTodaySalt(db, T0 + 60 * 60 * 1000); // +1h, still 2026-05-14
check('r1 returns 64-char hex', /^[0-9a-f]{64}$/.test(r1.salt_hex), `salt_hex=${r1.salt_hex}`);
check('r1.day_utc === 2026-05-14', r1.day_utc === '2026-05-14', `got ${r1.day_utc}`);
check('r2 returns same salt (no re-mint)', r1.salt_hex === r2.salt_hex, `r1=${r1.salt_hex} vs r2=${r2.salt_hex}`);
check('r2.day_utc === 2026-05-14', r2.day_utc === '2026-05-14', `got ${r2.day_utc}`);

// Verify exactly one row exists.
const rowsAfterDay1 = db.prepare('SELECT day_utc, salt_hex FROM telemetry_daily_salt ORDER BY day_utc').all();
check('exactly 1 salt row after same-day calls', rowsAfterDay1.length === 1, `got ${rowsAfterDay1.length} rows: ${JSON.stringify(rowsAfterDay1)}`);

// Seed a pre-yesterday salt row (3 days ago) manually.
console.log('\n--- Pre-yesterday salt is deleted on next rotation ---');
const threeDaysAgoUtc = new Date(T0 - 3 * 86400000).toISOString().slice(0, 10);  // 2026-05-11
db.prepare('INSERT INTO telemetry_daily_salt (day_utc, salt_hex, minted_at) VALUES (?, ?, ?)').run(
  threeDaysAgoUtc, 'a'.repeat(64), T0 - 3 * 86400000
);
// Confirm seeded.
const rowsAfterSeed = db.prepare('SELECT day_utc FROM telemetry_daily_salt ORDER BY day_utc').all().map(r => r.day_utc);
check('seeded 3-days-ago row present', rowsAfterSeed.includes(threeDaysAgoUtc), `rows: ${JSON.stringify(rowsAfterSeed)}`);

// Now advance to the next UTC day: 2026-05-15 06:00 UTC. This is +25h from T0.
console.log('\n--- Day boundary mints fresh salt ---');
const T1 = T0 + 25 * 60 * 60 * 1000; // +25h crosses 2026-05-15 boundary
const r3 = getOrMintTodaySalt(db, T1);
check('r3 returns 64-char hex', /^[0-9a-f]{64}$/.test(r3.salt_hex), `salt_hex=${r3.salt_hex}`);
check('r3.day_utc === 2026-05-15 (new day)', r3.day_utc === '2026-05-15', `got ${r3.day_utc}`);
check('r3.salt_hex !== r1.salt_hex (newly minted)', r3.salt_hex !== r1.salt_hex, `r3=${r3.salt_hex} vs r1=${r1.salt_hex}`);

// After rotation: yesterday (2026-05-14) RETAINED; 3-days-ago (2026-05-11) DELETED.
const rowsAfterDay2 = db.prepare('SELECT day_utc FROM telemetry_daily_salt ORDER BY day_utc').all().map(r => r.day_utc);
check("today's row exists after rotation", rowsAfterDay2.includes('2026-05-15'), `rows: ${JSON.stringify(rowsAfterDay2)}`);
check("yesterday's row RETAINED after rotation (cross-midnight grace)", rowsAfterDay2.includes('2026-05-14'), `rows: ${JSON.stringify(rowsAfterDay2)}`);
check('3-days-ago row DELETED after rotation', !rowsAfterDay2.includes(threeDaysAgoUtc), `rows: ${JSON.stringify(rowsAfterDay2)}`);
check('exactly 2 rows after rotation (today + yesterday only)', rowsAfterDay2.length === 2, `got ${rowsAfterDay2.length} rows: ${JSON.stringify(rowsAfterDay2)}`);

console.log('\n--- Same-new-day stability ---');
const r4 = getOrMintTodaySalt(db, T1 + 60 * 60 * 1000);
check('r4 returns same salt as r3 within day', r4.salt_hex === r3.salt_hex, `r3=${r3.salt_hex} vs r4=${r4.salt_hex}`);

db.close();

console.log(`\n=== server-telemetry-salt-rotation results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
