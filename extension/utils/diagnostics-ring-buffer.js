// utils/diagnostics-ring-buffer.js -- FSB Phase 211-03 diagnostic ring buffer.
// FIFO 100 entries persisted to chrome.storage.local.fsb_diagnostics_ring.
// Entry shape (D-09):
//   { ts, level, prefix, category, message, redactedContext: { origin?, lengths?, statusCode?, kind? } }
//
// Phase 211 ships back-end only (D-08). Phase 213 wires the Sync tab "Export
// diagnostics" button to chrome.runtime.sendMessage({ action: 'exportDiagnostics' })
// which background.js handles by calling getDiagnosticEntries({ clear?: true }).

(function() {
  'use strict';

  var STORAGE_KEY = 'fsb_diagnostics_ring';
  var MAX_ENTRIES = 100;

  // In-memory shadow for synchronous appends; reconciled with chrome.storage on every write.
  var _inMemoryRing = [];

  function _hasChromeStorage() {
    return typeof chrome !== 'undefined'
      && chrome.storage
      && chrome.storage.local
      && typeof chrome.storage.local.get === 'function'
      && typeof chrome.storage.local.set === 'function';
  }

  function appendDiagnosticEntry(entry) {
    if (!entry || typeof entry !== 'object') return Promise.resolve();
    // Defensive copy with explicit field whitelist to prevent accidental disclosure.
    var safe = {
      ts: typeof entry.ts === 'number' ? entry.ts : Date.now(),
      level: String(entry.level || 'warn'),
      prefix: String(entry.prefix || ''),
      category: String(entry.category || ''),
      message: String(entry.message || ''),
      redactedContext: (entry.redactedContext && typeof entry.redactedContext === 'object')
        ? entry.redactedContext : {}
    };
    _inMemoryRing.push(safe);
    if (_inMemoryRing.length > MAX_ENTRIES) {
      _inMemoryRing.splice(0, _inMemoryRing.length - MAX_ENTRIES); // FIFO trim
    }
    if (!_hasChromeStorage()) {
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      try {
        chrome.storage.local.get([STORAGE_KEY], function(stored) {
          var ring = (stored && Array.isArray(stored[STORAGE_KEY])) ? stored[STORAGE_KEY] : [];
          ring.push(safe);
          if (ring.length > MAX_ENTRIES) {
            ring = ring.slice(ring.length - MAX_ENTRIES);
          }
          var update = {};
          update[STORAGE_KEY] = ring;
          chrome.storage.local.set(update, function() {
            // chrome.runtime.lastError is best-effort; no throw, no log spam.
            resolve();
          });
        });
      } catch (e) {
        resolve();
      }
    });
  }

  function getDiagnosticEntries(opts) {
    var shouldClear = !!(opts && opts.clear === true);
    if (!_hasChromeStorage()) {
      var snap = _inMemoryRing.slice();
      if (shouldClear) {
        _inMemoryRing = [];
        return Promise.resolve({ entries: snap, clearedAt: Date.now() });
      }
      return Promise.resolve({ entries: snap });
    }
    return new Promise(function(resolve) {
      try {
        chrome.storage.local.get([STORAGE_KEY], function(stored) {
          var ring = (stored && Array.isArray(stored[STORAGE_KEY])) ? stored[STORAGE_KEY] : [];
          if (!shouldClear) {
            resolve({ entries: ring });
            return;
          }
          var update = {};
          update[STORAGE_KEY] = [];
          chrome.storage.local.set(update, function() {
            _inMemoryRing = [];
            resolve({ entries: ring, clearedAt: Date.now() });
          });
        });
      } catch (e) {
        resolve({ entries: _inMemoryRing.slice() });
      }
    });
  }

  // Test hook: reset the in-memory ring (used by tests/diagnostics-ring-buffer.test.js).
  function _resetRing() {
    _inMemoryRing = [];
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.fsbDiagnostics = {
      append: appendDiagnosticEntry,
      get: getDiagnosticEntries,
      _reset: _resetRing,
      STORAGE_KEY: STORAGE_KEY,
      MAX_ENTRIES: MAX_ENTRIES
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      appendDiagnosticEntry: appendDiagnosticEntry,
      getDiagnosticEntries: getDiagnosticEntries,
      _resetRing: _resetRing,
      STORAGE_KEY: STORAGE_KEY,
      MAX_ENTRIES: MAX_ENTRIES
    };
  }
})();
