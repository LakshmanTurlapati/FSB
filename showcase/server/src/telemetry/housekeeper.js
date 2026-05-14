/**
 * Phase 273 / INGEST-11 -- hourly housekeeper.
 *
 * Every hour:
 *   1. DELETE telemetry_events older than 7 days (retention policy).
 *   2. Re-aggregate today + yesterday per install_uuid into telemetry_rollups_daily.
 *   3. Recompute telemetry_global_aggregates for today + yesterday, applying
 *      a k>=5 anonymity floor on the mcp_client popular list (below-k labels
 *      bucket as "Other (N=<count>)").
 *   4. Nudge salt rotation by calling hashIp('0.0.0.0', db) -- the result is
 *      discarded; '0.0.0.0' is a harmless throwaway literal; the side effect
 *      is the lazy getOrMintTodaySalt() inside hashIp.
 *
 * Errors are logged via console.error but NEVER thrown. The interval must
 * never crash. tests/server-telemetry-housekeeper.test.js exercises a single
 * tick on an in-memory DB.
 */

'use strict';

const Queries = require('../db/queries');
const { hashIp } = require('../utils/telemetry-hash');

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const K_ANONYMITY_FLOOR = 5;

function floorToUtcDayMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dayUtcKey(ms) {
  return new Date(floorToUtcDayMs(ms)).toISOString().slice(0, 10);
}

/**
 * Run a single housekeeper tick. Safe to invoke from anywhere; never throws.
 *
 * @param {Database} db better-sqlite3 instance
 * @param {Queries}  [queries] reuse a Queries instance to avoid re-preparing
 *                             statements; created fresh if absent.
 * @param {number}   [nowMs]   override Date.now() (test injection only).
 */
function runHousekeeperTick(db, queries, nowMs = Date.now()) {
  try {
    if (!queries) queries = new Queries(db);

    // Step 1: 7-day retention.
    queries.deleteOldEvents.run(nowMs - SEVEN_DAYS_MS);

    // Step 2 + 3: recompute rollups + globals for today and yesterday.
    for (const dayOffset of [0, 1]) {
      const dayStart = floorToUtcDayMs(nowMs - dayOffset * ONE_DAY_MS);
      const dayEnd = dayStart + ONE_DAY_MS;
      const dayKey = dayUtcKey(dayStart);

      const uuids = queries.selectUuidsForDayRange.all(dayStart, dayEnd);
      for (const u of uuids) {
        const row = queries.aggregateRollupForUuidDay.get(dayStart, dayEnd, u.install_uuid);
        if (!row) continue;
        queries.upsertRollupDaily.run(
          u.install_uuid,
          dayKey,
          row.tokens_in || 0,
          row.tokens_out || 0,
          row.max_active_agents || 0,
          row.event_count || 0
        );
      }

      const g = queries.selectGlobalForDayRange.get(dayStart, dayEnd) || {};
      const popularMcpRaw = queries.selectPopularMcpForDayRange.all(dayStart, dayEnd);

      // k>=5 anonymity floor per D-07. Labels with fewer than 5 distinct installs
      // bucket as "Other (N=<count>)" so single-user attribution is impossible.
      const above = popularMcpRaw.filter((r) => (r.uniq || 0) >= K_ANONYMITY_FLOOR);
      const belowCount = popularMcpRaw.filter((r) => (r.uniq || 0) < K_ANONYMITY_FLOOR).length;
      const popularMcp = belowCount > 0
        ? [...above, { mcp_client: `Other (N=${belowCount})`, uniq: belowCount }]
        : above;
      // Phase 274 will source per-agent popularity from the rolled-up rows; v0.9.69 leaves this empty.
      const popularAgent = [];

      queries.upsertGlobalAggregate.run(
        dayKey,
        g.unique_installs || 0,
        g.tokens_in_sum || 0,
        g.tokens_out_sum || 0,
        g.agents_active_sum || 0,
        JSON.stringify(popularMcp),
        JSON.stringify(popularAgent)
      );
    }

    // Step 4: nudge salt rotation. The '0.0.0.0' literal is a throwaway value
    // that never reaches storage; hashIp's side effect is the lazy
    // getOrMintTodaySalt() which we want to fire on every tick so the salt
    // table contains today's row even if no real traffic arrived.
    hashIp('0.0.0.0', db);
  } catch (err) {
    // Per CONTEXT "Errors logged but never crash the interval".
    console.error('[housekeeper] tick failed:', err && err.message ? err.message : err);
  }
}

/**
 * Start the hourly housekeeper. Runs once immediately (so the first aggregate
 * row exists before the next hour), then every hour. Returns the interval
 * handle so the caller can clearInterval() during shutdown.
 *
 * @param {Database} db better-sqlite3 instance
 * @returns {ReturnType<typeof setInterval>}
 */
function startHousekeeper(db) {
  const queries = new Queries(db);
  // Fire once on boot (next event-loop tick to avoid blocking startup).
  setImmediate(() => runHousekeeperTick(db, queries));
  return setInterval(() => runHousekeeperTick(db, queries), ONE_HOUR_MS);
}

module.exports = {
  startHousekeeper,
  runHousekeeperTick,
  floorToUtcDayMs,
  K_ANONYMITY_FLOOR,
  ONE_HOUR_MS,
};
