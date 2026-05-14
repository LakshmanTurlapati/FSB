/**
 * Install Identity Module -- anonymous per-install UUID + telemetry kill-switch state.
 *
 * Phase 269 / v0.9.69 telemetry pipeline foundation. Lazily mints a UUIDv4 on first
 * boot, persists it in chrome.storage.local, and exposes a kill-switch boolean
 * (fsbTelemetryOptOut) that downstream collectors (Phase 271 MCPMetricsRecorder,
 * Phase 272 TelemetryCollector) read on every flush.
 *
 * Module surface (globalThis.fsbInstallIdentity):
 *   - getOrCreateInstallUuid() -> Promise<string|null>
 *       Lazy-mint or reuse the install UUID; null on storage error.
 *   - isTelemetryOptedOut() -> Promise<boolean>
 *       Returns true ONLY when the user has explicitly toggled OFF; default false.
 *   - setTelemetryOptOut(value) -> Promise<void>
 *       Writes Boolean(value) under fsbTelemetryOptOut.
 *   - FSB_INSTALL_UUID_KEY = 'fsbInstallUuid'
 *   - FSB_TELEMETRY_OPT_OUT_KEY = 'fsbTelemetryOptOut'
 *
 * Hard constraints (D-11 / IDENT-04):
 *   NEVER use chrome.storage.sync for telemetry-related keys. Cross-device
 *   linkability is FORBIDDEN. Storage namespace is exclusively chrome.storage.local.
 *
 * No outbound HTTP, no event collection, no server contract -- those land in Phases
 * 272 / 273. This module is identity + storage only.
 *
 * @module utils/install-identity
 */

'use strict';

// RFC 4122 v4 UUID shape: 8-4-4-4-12 hex with version nibble '4' and variant nibble
// in [8,9,a,b]. crypto.randomUUID() produces this shape; we re-validate on read to
// detect corruption (e.g., hand-edited via DevTools storage editor).
var UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// camelCase keys per CONTEXT D-decision. This intentionally deviates from
// REQUIREMENTS.md IDENT-01's verbatim snake_case `fsb_install_uuid` -- the project
// convention (fsbUsageData, fsbCurrentModel, fsbSessionLogs) wins.
var FSB_INSTALL_UUID_KEY = 'fsbInstallUuid';
var FSB_TELEMETRY_OPT_OUT_KEY = 'fsbTelemetryOptOut';

// Single-flight coalescer for concurrent getOrCreateInstallUuid() calls.
// chrome.runtime.onInstalled and chrome.runtime.onStartup can both fire close
// together on a cold-start first install, and Chrome runs async listener
// bodies in parallel. Without coalescing, two interleaved calls could each
// observe an empty store, mint two different UUIDs, and race to .set --
// the persisted value is whichever .set lands last while one of the call
// sites returns a UUID that no longer exists in storage.
//
// We memoize the in-flight Promise so concurrent callers await the same
// operation. The reference is cleared in the `finally` block so subsequent
// calls (e.g., a later SW wake) can re-attempt the mint -- otherwise a
// transient storage failure would permanently latch null for this SW session.
var _pendingMintPromise = null;

/**
 * Get or create the per-install anonymous UUID.
 *
 * Reads chrome.storage.local.fsbInstallUuid. If absent OR if the stored value
 * fails the v4 regex (corruption), mints a fresh crypto.randomUUID() and
 * persists it. Returns the UUID string on success.
 *
 * On ANY storage error (storage area undefined, throw, reject), returns null.
 * Does NOT throw. Does NOT mint a session-only fallback UUID (per IDENT-03,
 * a session-only UUID would have no aggregation value and would confuse the
 * downstream collector which uses null as the "no telemetry" signal).
 *
 * Concurrent callers (e.g., onInstalled + onStartup racing at first install)
 * are coalesced via `_pendingMintPromise` so the storage write happens
 * exactly once per in-flight window.
 *
 * @returns {Promise<string|null>} The install UUID, or null on storage error.
 */
function getOrCreateInstallUuid() {
  if (_pendingMintPromise) return _pendingMintPromise;
  _pendingMintPromise = (async () => {
    try {
      var data = await chrome.storage.local.get([FSB_INSTALL_UUID_KEY]);
      var existing = data && data[FSB_INSTALL_UUID_KEY];

      if (typeof existing === 'string' && UUID_V4_REGEX.test(existing)) {
        return existing;
      }

      if (typeof existing === 'string' && !UUID_V4_REGEX.test(existing)) {
        // Corruption path: stored value is a string but does not match v4 shape.
        // Re-mint defensively. One warn log only -- the failure mode is recoverable
        // and not worth spamming. The new UUID overwrites the corrupt value.
        console.warn('[FSB Telemetry] Stored install UUID failed validation; minting fresh');
      }

      var uuid = crypto.randomUUID();
      await chrome.storage.local.set({ [FSB_INSTALL_UUID_KEY]: uuid });
      return uuid;
    } catch (_e) {
      // Storage unavailable (incognito SW context, corrupted profile, enterprise
      // policy denying chrome.storage.local). Downstream collector treats null
      // as a hard no-op. NO session-only fallback (IDENT-03).
      return null;
    } finally {
      // Allow re-entry on the next call so a later SW wake (or a transient
      // failure followed by recovery) can retry the mint. Module state
      // persists across the entire SW lifetime; without this, one storage
      // hiccup would latch null for the whole session.
      _pendingMintPromise = null;
    }
  })();
  return _pendingMintPromise;
}

/**
 * Read the current telemetry opt-out state.
 *
 * Default is false (telemetry ON) -- per D-02 the consent model is OPT-OUT.
 * Returns true ONLY when chrome.storage.local.fsbTelemetryOptOut === true.
 *
 * On storage error: returns false (treat as ON; the downstream collector gates
 * on a null UUID separately, so a storage failure doesn't accidentally leak
 * data -- the UUID read in getOrCreateInstallUuid() returns null on the same
 * failure mode, which makes the collector no-op upstream of this check).
 *
 * @returns {Promise<boolean>} true if user has opted out; false otherwise.
 */
async function isTelemetryOptedOut() {
  try {
    var data = await chrome.storage.local.get([FSB_TELEMETRY_OPT_OUT_KEY]);
    return !!(data && data[FSB_TELEMETRY_OPT_OUT_KEY] === true);
  } catch (_e) {
    return false;
  }
}

/**
 * Write the telemetry opt-out state.
 *
 * Coerces the input to a Boolean so callers can pass !checkbox.checked directly.
 * Exceptions are NOT caught here -- the UI wiring in control_panel.html catches
 * write failures and degrades silently; the Node test harness asserts the
 * write succeeded against its mock.
 *
 * @param {boolean|*} value - Truthy = opt-out (telemetry OFF); falsy = telemetry ON.
 * @returns {Promise<void>}
 */
async function setTelemetryOptOut(value) {
  await chrome.storage.local.set({ [FSB_TELEMETRY_OPT_OUT_KEY]: Boolean(value) });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// Service-worker / importScripts surface. camelCase per CONTEXT D-decision
// (NOT PascalCase as the ARCHITECTURE.md sketch shows -- CONTEXT overrides).
globalThis.fsbInstallIdentity = {
  getOrCreateInstallUuid: getOrCreateInstallUuid,
  isTelemetryOptedOut: isTelemetryOptedOut,
  setTelemetryOptOut: setTelemetryOptOut,
  FSB_INSTALL_UUID_KEY: FSB_INSTALL_UUID_KEY,
  FSB_TELEMETRY_OPT_OUT_KEY: FSB_TELEMETRY_OPT_OUT_KEY
};

// Node CommonJS surface for the test harness at tests/install-identity.test.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getOrCreateInstallUuid: getOrCreateInstallUuid,
    isTelemetryOptedOut: isTelemetryOptedOut,
    setTelemetryOptOut: setTelemetryOptOut,
    FSB_INSTALL_UUID_KEY: FSB_INSTALL_UUID_KEY,
    FSB_TELEMETRY_OPT_OUT_KEY: FSB_TELEMETRY_OPT_OUT_KEY,
    UUID_V4_REGEX: UUID_V4_REGEX
  };
}
