/**
 * Phase 273 / INGEST-04 -- Daily-rotated HMAC-SHA256 salt for IP hashing.
 *
 * The salt is stored in the telemetry_daily_salt SQLite table (one row per UTC
 * day; today + yesterday only). Rotation happens LAZILY on the next hashIp()
 * call after the UTC day rolls over -- no cron, no background thread.
 *
 * Cross-midnight grace: yesterday's salt row is retained for ~25 hours so
 * late-arriving batches with ts_minute near midnight still hash correctly.
 *
 * This module deliberately does NOT depend on src/db/queries.js. The Queries
 * class is constructed AT BOOT with a single db handle, but the salt module
 * is a SHARED PRIMITIVE used by hashIp (which both routes/middleware and the
 * housekeeper call). Importing Queries here would force a circular import
 * (Queries -> salt -> Queries). Direct db.prepare(...) keeps the dependency
 * graph a DAG. Prepared statements are cached per-db handle on a module-level
 * WeakMap so repeated calls reuse the same prepared statements.
 */

'use strict';

const crypto = require('crypto');

// WeakMap<Database, { selectToday, insertToday, deleteOld }>
const stmtCache = new WeakMap();

function getStmts(db) {
  let s = stmtCache.get(db);
  if (s) return s;
  s = {
    selectToday: db.prepare('SELECT salt_hex, minted_at FROM telemetry_daily_salt WHERE day_utc = ?'),
    insertToday: db.prepare('INSERT INTO telemetry_daily_salt (day_utc, salt_hex, minted_at) VALUES (?, ?, ?)'),
    deleteOld: db.prepare('DELETE FROM telemetry_daily_salt WHERE day_utc < ?'),
  };
  stmtCache.set(db, s);
  return s;
}

function utcDayString(nowMs) {
  // YYYY-MM-DD in UTC.
  return new Date(nowMs).toISOString().slice(0, 10);
}

function yesterdayDayString(nowMs) {
  return new Date(nowMs - 86400000).toISOString().slice(0, 10);
}

/**
 * Get today's HMAC-SHA256 salt, minting it (and pruning pre-yesterday) if missing.
 *
 * @param {Database} db better-sqlite3 instance
 * @param {number} [nowMs] override Date.now() (test injection only)
 * @returns {{salt_hex: string, day_utc: string}}
 */
function getOrMintTodaySalt(db, nowMs = Date.now()) {
  const day_utc = utcDayString(nowMs);
  const stmts = getStmts(db);

  // Hot path: already exists.
  const row = stmts.selectToday.get(day_utc);
  if (row) {
    return { salt_hex: row.salt_hex, day_utc };
  }

  // Mint inside an IMMEDIATE transaction so concurrent boot races settle on a single row.
  const tx = db.transaction(() => {
    // Re-check inside the tx.
    const row2 = stmts.selectToday.get(day_utc);
    if (row2) {
      return row2.salt_hex;
    }
    const salt_hex = crypto.randomBytes(32).toString('hex');
    stmts.insertToday.run(day_utc, salt_hex, nowMs);
    // Retain today + yesterday; delete everything older.
    const yesterday = yesterdayDayString(nowMs);
    stmts.deleteOld.run(yesterday);
    return salt_hex;
  });

  const salt_hex = tx.immediate();
  return { salt_hex, day_utc };
}

module.exports = { getOrMintTodaySalt };
