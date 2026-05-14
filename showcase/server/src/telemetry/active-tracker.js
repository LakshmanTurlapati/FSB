/**
 * Phase 274 / AGG-02 + AGG-03 -- in-memory "active right now" tracker.
 *
 * Powers two FSBTelemetryHeadline fields that cannot be answered from SQLite
 * within a privacy-respecting <=10 min window:
 *
 *   - active_users_now  := countActiveUsers(5*60*1000)
 *   - active_agents_now := getActiveAgentSum(10*60*1000)
 *
 * Backed by a module-scoped Map<install_uuid, {ts, agent_count}>. Eviction is
 * LAZY -- every read API drops entries older than EVICTION_MS (10 min) before
 * answering. There is NO timer / NO setInterval / NO persistence:
 *   - "no timer" keeps the module hot-path-cheap;
 *   - "no persistence" is intentional per CONTEXT D-05 -- a server restart
 *     empties the Map and the next 5 minutes of /api/telemetry/events beats
 *     rebuild it. The trade-off is acceptable for an Easter-egg dashboard.
 *
 * PRIVACY INVARIANT: this module NEVER logs install_uuid values; only
 *   counts / sums leave the module surface. Per CONTEXT decisions §Public
 *   endpoint mount + auth, the consumer (`routes/public-stats.js`) further
 *   bucketises agent counts before emitting them to the public response body.
 *
 * Test isolation: `_resetForTest()` clears the Map between tests so the
 * module-scoped state does not bleed across `tests/server-public-stats-*.test.js`.
 */

'use strict';

// 10-minute ceiling per CONTEXT D-06 + AGG-03. The wider window covers
// active_agents (10 min) so the shared eviction is correct for the smaller
// 5-min active_users window as well (older entries can never matter to either).
const EVICTION_MS = 10 * 60 * 1000;

// Map<install_uuid, { ts: number, agent_count: number }>
const seen = new Map();

/**
 * Drop every entry older than (now - EVICTION_MS). Called on every read.
 * @param {number} nowMs
 */
function _evict(nowMs) {
  const cutoff = nowMs - EVICTION_MS;
  // Iterating the Map and deleting in the same loop is safe per the
  // ECMAScript Map.prototype.forEach contract -- iteration order is insertion
  // order, and `delete` does not invalidate the iterator.
  for (const [uuid, entry] of seen) {
    if (entry.ts < cutoff) {
      seen.delete(uuid);
    }
  }
}

/**
 * Record the latest seen-at for an install_uuid plus its current agent count.
 * Upsert semantics: overwrites the previous entry, so the freshest beat wins.
 *
 * @param {string} install_uuid -- caller (telemetry route) guarantees UUIDv4 shape.
 * @param {number} active_agent_count -- non-negative integer. Defensive coerce to 0
 *                 when not an integer in [0, Number.MAX_SAFE_INTEGER].
 * @param {number} ts_ms -- wall-clock receive time (Date.now()), NOT ev.ts_minute.
 *                 Using receive time defends against clients with drifted clocks
 *                 pinning themselves as "active" indefinitely.
 */
function recordSeen(install_uuid, active_agent_count, ts_ms) {
  if (typeof install_uuid !== 'string' || install_uuid.length === 0) return;
  if (typeof ts_ms !== 'number' || !Number.isFinite(ts_ms)) return;
  const agentCount =
    Number.isInteger(active_agent_count) && active_agent_count >= 0
      ? active_agent_count
      : 0;
  seen.set(install_uuid, { ts: ts_ms, agent_count: agentCount });
}

/**
 * Count distinct install_uuids seen within the last `windowMs`.
 * Lazy-evicts entries older than EVICTION_MS first.
 *
 * @param {number} windowMs
 * @returns {number}
 */
function countActiveUsers(windowMs) {
  const now = Date.now();
  _evict(now);
  if (typeof windowMs !== 'number' || windowMs <= 0) return 0;
  const cutoff = now - windowMs;
  let n = 0;
  for (const entry of seen.values()) {
    if (entry.ts > cutoff) n += 1;
  }
  return n;
}

/**
 * Sum of latest agent_count values across install_uuids seen within
 * the last `windowMs`. Same eviction as countActiveUsers.
 *
 * @param {number} windowMs
 * @returns {number}
 */
function getActiveAgentSum(windowMs) {
  const now = Date.now();
  _evict(now);
  if (typeof windowMs !== 'number' || windowMs <= 0) return 0;
  const cutoff = now - windowMs;
  let total = 0;
  for (const entry of seen.values()) {
    if (entry.ts > cutoff) total += entry.agent_count;
  }
  return total;
}

/**
 * Map a raw active-agent integer to one of the seven canonical k-anonymity
 * bucket labels per AGG-03 (matches Phase 273 housekeeper bucket scheme).
 *
 * @param {number} n
 * @returns {'0'|'1'|'2-4'|'5-8'|'9-16'|'17-32'|'33+'}
 */
function bucketAgents(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '0';
  if (n === 1) return '1';
  if (n <= 4) return '2-4';
  if (n <= 8) return '5-8';
  if (n <= 16) return '9-16';
  if (n <= 32) return '17-32';
  return '33+';
}

/** Test-only helper. Clears the Map. */
function _resetForTest() {
  seen.clear();
}

module.exports = {
  recordSeen,
  countActiveUsers,
  getActiveAgentSum,
  bucketAgents,
  _resetForTest,
  EVICTION_MS,
};
