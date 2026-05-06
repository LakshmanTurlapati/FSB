(function(global) {
  'use strict';

  /**
   * Phase 239 plan 02 -- chrome.storage.session task-store helper.
   *
   * Owns the persisted lifecycle snapshot of in-flight `run_task` MCP calls.
   * Mirror of extension/utils/agent-registry.js storage-helper portion: same
   * lazy globalThis.chrome reference, same versioned envelope shape, same
   * "empty records map removes the storage key" discipline. Only the constants
   * and the public surface change.
   *
   * Storage shape (under chrome.storage.session, key `fsbRunTaskRegistry`):
   *
   *   {
   *     v: 1,
   *     records: {
   *       [task_id]: {
   *         task_id,
   *         status: 'in_progress' | 'complete' | 'error' | 'stopped' | 'partial',
   *         started_at,
   *         last_heartbeat_at,
   *         originating_mcp_call_id,
   *         target_tab_id,
   *         current_step,
   *         ai_cycle_count,
   *         last_dom_hash,
   *         final_result?  // populated only on terminal events
   *       }
   *     }
   *   }
   *
   * Per CONTEXT.md D-03 the snapshot shape mirrors v0.9.36 visual-session.
   * Per CONTEXT.md D-04 the write cadence is "every 30s heartbeat tick AND
   * every state transition" -- this module owns the storage primitive; the
   * cadence discipline lives in mcp-bridge-client.js:_handleStartAutomation
   * (Task 2 of this plan).
   *
   * Per RESEARCH.md "Pattern 3: chrome.storage.session envelope" + "Code
   * Examples -> Task-store helper module (sketch)".
   *
   * Best-effort posture (mirrors agent-registry.js:75): every storage call is
   * wrapped in try/catch; failure to persist must NEVER crash the SW or block
   * the run_task resolve path. Plan 03's SW-wake reconciliation tolerates a
   * missing snapshot by resolving with `partial_outcome: 'timeout'` rather
   * than `sw_evicted: true`.
   */

  // ---- Constants ----------------------------------------------------------

  var FSB_RUN_TASK_REGISTRY_STORAGE_KEY = 'fsbRunTaskRegistry';
  var FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION = 1;

  // ---- Storage helpers (mirror agent-registry.js:53-95) -------------------
  //
  // Lazy globalThis.chrome reference so the module loads cleanly under Node
  // test harnesses where chrome is mocked AFTER module load.

  function _getChrome() {
    return (typeof globalThis !== 'undefined' && globalThis.chrome) ? globalThis.chrome : null;
  }

  /**
   * Read the persisted envelope. Returns the canonical empty envelope
   * `{ v: 1, records: {} }` when the storage key is missing, the version
   * does not match, or any error occurs. Differs from agent-registry's
   * pattern (which returns null on the same conditions) so callers can
   * skip null-checks before reading `envelope.records`.
   */
  async function _readEnvelope() {
    var c = _getChrome();
    if (!c || !c.storage || !c.storage.session || typeof c.storage.session.get !== 'function') {
      return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
    }
    try {
      var stored = await c.storage.session.get([FSB_RUN_TASK_REGISTRY_STORAGE_KEY]);
      var payload = stored ? stored[FSB_RUN_TASK_REGISTRY_STORAGE_KEY] : null;
      if (!payload || typeof payload !== 'object') {
        return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
      }
      if (payload.v !== FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION) {
        return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
      }
      if (!payload.records || typeof payload.records !== 'object') {
        return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
      }
      return payload;
    } catch (_e) {
      return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
    }
  }

  /**
   * Write the envelope. When the records map is empty, the storage key is
   * removed entirely (no stale envelope sitting in storage forever).
   */
  async function _writeEnvelope(envelope) {
    var c = _getChrome();
    if (!c || !c.storage || !c.storage.session) return;
    try {
      var nextRecords = (envelope && envelope.records && typeof envelope.records === 'object')
        ? envelope.records : {};
      if (Object.keys(nextRecords).length === 0) {
        if (typeof c.storage.session.remove === 'function') {
          await c.storage.session.remove(FSB_RUN_TASK_REGISTRY_STORAGE_KEY);
        }
        return;
      }
      var toWrite = {};
      toWrite[FSB_RUN_TASK_REGISTRY_STORAGE_KEY] = {
        v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION,
        records: nextRecords
      };
      if (typeof c.storage.session.set === 'function') {
        await c.storage.session.set(toWrite);
      }
    } catch (_e) {
      // best-effort; do not throw
    }
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Write a snapshot under the given task_id. V5 input validation per ASVS:
   * silently no-op on bad inputs rather than throw.
   */
  async function writeSnapshot(taskId, snapshot) {
    if (!taskId || typeof taskId !== 'string') return;
    if (!snapshot || typeof snapshot !== 'object') return;
    var envelope = await _readEnvelope();
    envelope.records[taskId] = snapshot;
    await _writeEnvelope(envelope);
  }

  /**
   * Read a snapshot by task_id. Returns null when unknown.
   */
  async function readSnapshot(taskId) {
    if (!taskId || typeof taskId !== 'string') return null;
    var envelope = await _readEnvelope();
    return envelope.records[taskId] || null;
  }

  /**
   * Delete a snapshot. Idempotent. When the records map becomes empty,
   * _writeEnvelope removes the storage key entirely.
   */
  async function deleteSnapshot(taskId) {
    if (!taskId || typeof taskId !== 'string') return;
    var envelope = await _readEnvelope();
    if (!envelope.records[taskId]) return;
    delete envelope.records[taskId];
    await _writeEnvelope(envelope);
  }

  /**
   * Return all snapshots whose status is currently 'in_progress'. Used by
   * Plan 03's SW-wake reconciliation to enumerate tasks that need to be
   * resolved with `sw_evicted: true`.
   */
  async function listInFlightSnapshots() {
    var envelope = await _readEnvelope();
    return Object.keys(envelope.records)
      .map(function(k) { return envelope.records[k]; })
      .filter(function(s) { return s && s.status === 'in_progress'; });
  }

  /**
   * Return the canonical envelope shape so callers can enumerate records
   * without a second round-trip. Always returns `{ v: 1, records: {...} }`.
   */
  async function hydrate() {
    return await _readEnvelope();
  }

  // ---- Export shape (mirror agent-registry.js:512-535) --------------------

  var exportsObj = {
    writeSnapshot: writeSnapshot,
    readSnapshot: readSnapshot,
    deleteSnapshot: deleteSnapshot,
    listInFlightSnapshots: listInFlightSnapshots,
    hydrate: hydrate,
    FSB_RUN_TASK_REGISTRY_STORAGE_KEY: FSB_RUN_TASK_REGISTRY_STORAGE_KEY,
    FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION
  };

  global.FsbMcpTaskStore = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
