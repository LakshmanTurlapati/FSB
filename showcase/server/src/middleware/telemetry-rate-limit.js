/**
 * Phase 273 / INGEST-02 + INGEST-07(c)(d) -- two rate-limit layers.
 *
 * LAYER 1: createTelemetryRateLimiter(db) wraps express-rate-limit@^8.3.0
 * (CVE-2026-30827 IPv4-mapped-IPv6 collision fix) with a CUSTOM keyGenerator
 * that returns hashIp(req.ip, db). The rate-limit bucket and the storage
 * identifier are therefore the same value -- an attacker cannot rotate one
 * without also rotating the other (BLOCKER #2 alignment).
 *
 *   - windowMs:           60 * 1000 (1 minute)
 *   - max:                30 batches/min (env-overridable for tests)
 *   - standardHeaders:    'draft-7' -> RFC 9239 RateLimit-* headers
 *   - legacyHeaders:      false (no X-RateLimit-*)
 *
 * LAYER 2: checkPerUuidBudget(installUuid, nowMs?) tracks events-per-UUID-per-day
 * in an in-memory Map. Hot-path SQLite writes for budget would dwarf the cost
 * of the actual telemetry inserts; the in-memory Map is the right primitive.
 * Reset happens automatically when the UTC day rolls over for that UUID.
 *
 * Budget exceed: route returns 429 with the custom header
 * `X-FSB-Reason: per-uuid-budget`. The header is the routes module's responsibility
 * (the express-rate-limit handler fires for per-IP bucket exceed only).
 */

'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { hashIp } = require('../utils/telemetry-hash');

/**
 * @param {Database} db better-sqlite3 instance
 */
function createTelemetryRateLimiter(db) {
  // Env-override for tests that need to inject 1000+ events/UUID without tripping
  // the per-IP bucket first (see tests/server-telemetry-daily-budget.test.js).
  // Default 30 batches/min per CONTEXT decision.
  const max = parseInt(process.env.TELEMETRY_RATE_MAX, 10) || 30;

  return rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: 'draft-7',     // RFC 9239 RateLimit-* headers
    legacyHeaders: false,
    // BLOCKER #2 alignment: bucket key = HMAC-SHA256(canonicalised_ip, todays_salt).
    // The canonicalisation runs through express-rate-limit's ipKeyGenerator helper
    // which collapses IPv6 to a /56 subnet and resolves IPv4-mapped-IPv6 forms
    // (CVE-2026-30827 fix; req.ip alone would let dual-stack users escape buckets).
    // The hashIp() output becomes the same identifier we store as ip_hash in
    // telemetry_events, so an attacker cannot rotate the rate-limit identity
    // without also rotating the storage identity.
    // PRIVACY: req.ip is referenced exactly here, immediately canonicalised then
    // hashed; the canonical form is discarded after the digest.
    keyGenerator: (req) => hashIp(ipKeyGenerator(req.ip), db),
    handler: (req, res) => {
      res.status(429).json({ error: 'rate_limited' });
    },
    skip: () => false,
  });
}

// Per-UUID daily budget tracking. Module-level Map; reset by day rollover or
// by resetPerUuidBudget() for test isolation.
const budgets = new Map();
const PER_UUID_DAILY_BUDGET = 1000;

function utcDayString(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function msUntilNextUtcMidnight(nowMs) {
  const startOfTodayUtc = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate(),
  );
  return startOfTodayUtc + 86400000 - nowMs;
}

/**
 * Increment + check the per-UUID daily counter.
 *
 * On UTC day rollover the counter for that UUID resets to 1.
 * Returns { ok: false, retryAfter, currentCount } once count >= 1000 for the day.
 *
 * @param {string} installUuid
 * @param {number} [nowMs]
 * @returns {{ ok: boolean, retryAfter?: number, currentCount?: number }}
 */
function checkPerUuidBudget(installUuid, nowMs = Date.now()) {
  const day_utc = utcDayString(nowMs);
  const entry = budgets.get(installUuid);
  if (!entry || entry.day_utc !== day_utc) {
    budgets.set(installUuid, { count: 1, day_utc });
    return { ok: true, currentCount: 1 };
  }
  if (entry.count >= PER_UUID_DAILY_BUDGET) {
    return {
      ok: false,
      retryAfter: msUntilNextUtcMidnight(nowMs),
      currentCount: entry.count,
    };
  }
  entry.count += 1;
  return { ok: true, currentCount: entry.count };
}

/** Test-only helper. Clears the per-UUID Map. */
function resetPerUuidBudget() {
  budgets.clear();
}

module.exports = {
  createTelemetryRateLimiter,
  checkPerUuidBudget,
  resetPerUuidBudget,
  PER_UUID_DAILY_BUDGET,
};
