/**
 * Unit tests for extension/utils/install-identity.js
 *
 * Phase 269 / v0.9.69 telemetry pipeline foundation. Validates IDENT-01..05,
 * CONS-01, CONS-02 requirements + the camelCase storage-key locks from
 * CONTEXT.md D-decision.
 *
 * Test sections (in order):
 *   1. Mint-once on first call (IDENT-01)
 *   2. Reuse-on-restart (IDENT-02)
 *   3. Null on storage unavailable (IDENT-03)
 *   4. Opt-out round-trip (CONS-01, CONS-02)
 *   5. Defensive re-mint on UUID corruption
 *   6. IDENT-04 grep gate -- no chrome.storage.sync in module source
 *   7. Storage-key string locks (camelCase per CONTEXT D-decision)
 *
 * Run: node tests/install-identity.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MODULE_PATH = require.resolve('../extension/utils/install-identity.js');

// ---------------------------------------------------------------------------
// Counters + assertion helpers (mirrors tests/cost-tracker.test.js style)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function passAssert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

function passAssertEqual(actual, expected, msg) {
  passAssert(
    actual === expected,
    msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')'
  );
}

// ---------------------------------------------------------------------------
// chrome.storage.local mock (mirrors tests/agent-cap-storage.test.js helpers,
// adapted to track call counts so we can assert "set was called once" /
// "set was NOT called").
// ---------------------------------------------------------------------------

function createStorageArea(initial) {
  const store = Object.assign({}, initial || {});
  const callCounts = { get: 0, set: 0, remove: 0 };
  return {
    async get(keys) {
      callCounts.get++;
      if (keys == null) return Object.assign({}, store);
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) out[key] = store[key];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys)
          ? { [keys]: store[keys] }
          : {};
      }
      if (typeof keys === 'object') {
        const out = {};
        Object.keys(keys).forEach((key) => {
          out[key] = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : keys[key];
        });
        return out;
      }
      return Object.assign({}, store);
    },
    async set(values) {
      callCounts.set++;
      Object.assign(store, values);
    },
    async remove(keys) {
      callCounts.remove++;
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => { delete store[key]; });
    },
    _dump() {
      return Object.assign({}, store);
    },
    _callCounts: callCounts
  };
}

function setupChromeMock(opts) {
  opts = opts || {};
  const local = createStorageArea(opts.local || {});
  globalThis.chrome = {
    runtime: { id: 'phase-269-test', lastError: null },
    storage: {
      local: local,
      onChanged: { addListener: function () {} }
    }
  };
  return { local: local };
}

function setupBrokenStorage() {
  // .get and .set throw synchronously so the outer try/catch in
  // getOrCreateInstallUuid()/isTelemetryOptedOut() is the only thing
  // standing between the caller and an exception.
  globalThis.chrome = {
    runtime: { id: 'phase-269-test', lastError: null },
    storage: {
      local: {
        get() { throw new Error('Storage area unavailable'); },
        set() { throw new Error('Storage area unavailable'); }
      },
      onChanged: { addListener: function () {} }
    }
  };
}

function teardownChromeMock() {
  delete globalThis.chrome;
}

function captureWarn() {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = function (...args) {
    warnings.push(args.map((a) => String(a)).join(' '));
  };
  return {
    warnings: warnings,
    restore: function () { console.warn = originalWarn; }
  };
}

function freshRequire() {
  // Reset the install-identity module cache so each test runs against a
  // pristine module-level state (specifically, the globalThis.fsbInstallIdentity
  // assignment is re-applied per test).
  delete require.cache[MODULE_PATH];
  return require(MODULE_PATH);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

(async () => {
  // --- Test 1: mint-once on first call (IDENT-01) -------------------------
  console.log('\n--- Test: mint-once on first call (IDENT-01) ---');
  {
    const mock = setupChromeMock();
    try {
      const m = freshRequire();
      const uuid1 = await m.getOrCreateInstallUuid();
      passAssert(typeof uuid1 === 'string', 'first call returns a string');
      passAssert(
        m.UUID_V4_REGEX.test(uuid1),
        'first call returns a v4 UUID matching the canonical regex (got: ' + uuid1 + ')'
      );

      const stored = mock.local._dump();
      passAssertEqual(stored.fsbInstallUuid, uuid1, 'fsbInstallUuid persisted to chrome.storage.local');
      passAssertEqual(mock.local._callCounts.set, 1, 'chrome.storage.local.set was called exactly once');

      const setsBefore = mock.local._callCounts.set;
      const uuid2 = await m.getOrCreateInstallUuid();
      passAssertEqual(uuid2, uuid1, 'second call returns the SAME UUID');
      passAssertEqual(
        mock.local._callCounts.set,
        setsBefore,
        'chrome.storage.local.set NOT called again on second call'
      );
    } finally {
      teardownChromeMock();
    }
  }

  // --- Test 2: reuse-on-restart (IDENT-02) --------------------------------
  console.log('\n--- Test: reuse-on-restart (IDENT-02) ---');
  {
    const preSeeded = '550e8400-e29b-41d4-a716-446655440000'; // canonical v4
    const mock = setupChromeMock({ local: { fsbInstallUuid: preSeeded } });
    try {
      const m = freshRequire();
      const uuid = await m.getOrCreateInstallUuid();
      passAssertEqual(uuid, preSeeded, 'pre-seeded UUID returned unchanged');
      passAssertEqual(
        mock.local._callCounts.set,
        0,
        'chrome.storage.local.set NOT called when valid UUID already present'
      );
    } finally {
      teardownChromeMock();
    }
  }

  // --- Test 3: null on storage unavailable (IDENT-03) ---------------------
  console.log('\n--- Test: null on storage unavailable (IDENT-03) ---');
  {
    setupBrokenStorage();
    try {
      const m = freshRequire();
      let result;
      let threw = false;
      try {
        result = await m.getOrCreateInstallUuid();
      } catch (_e) {
        threw = true;
      }
      passAssertEqual(threw, false, 'getOrCreateInstallUuid does NOT throw on storage error');
      passAssertEqual(result, null, 'getOrCreateInstallUuid returns null on storage error');
    } finally {
      teardownChromeMock();
    }
  }

  // --- Test 4: opt-out round-trip (CONS-01, CONS-02) ----------------------
  console.log('\n--- Test: opt-out round-trip (CONS-01, CONS-02) ---');
  {
    const mock = setupChromeMock();
    try {
      const m = freshRequire();
      // Default: missing key -> not opted out.
      const initial = await m.isTelemetryOptedOut();
      passAssertEqual(initial, false, 'missing fsbTelemetryOptOut key -> isTelemetryOptedOut returns false');

      await m.setTelemetryOptOut(true);
      const optedOut = await m.isTelemetryOptedOut();
      passAssertEqual(optedOut, true, 'after setTelemetryOptOut(true), isTelemetryOptedOut returns true');
      passAssertEqual(
        mock.local._dump().fsbTelemetryOptOut,
        true,
        'storage key is exactly fsbTelemetryOptOut with value true'
      );

      await m.setTelemetryOptOut(false);
      const optedIn = await m.isTelemetryOptedOut();
      passAssertEqual(optedIn, false, 'after setTelemetryOptOut(false), isTelemetryOptedOut returns false');
      passAssertEqual(
        mock.local._dump().fsbTelemetryOptOut,
        false,
        'storage key value is false (telemetry ON)'
      );

      // Truthy coercion: passing a non-boolean truthy value writes Boolean(value).
      await m.setTelemetryOptOut('yes');
      passAssertEqual(
        mock.local._dump().fsbTelemetryOptOut,
        true,
        'setTelemetryOptOut coerces truthy non-boolean to true'
      );
    } finally {
      teardownChromeMock();
    }
  }

  // --- Test 5: defensive re-mint on corruption ----------------------------
  console.log('\n--- Test: defensive re-mint on corruption ---');
  {
    const mock = setupChromeMock({ local: { fsbInstallUuid: 'not-a-uuid' } });
    const warnCapture = captureWarn();
    try {
      const m = freshRequire();
      const uuid = await m.getOrCreateInstallUuid();
      passAssert(
        typeof uuid === 'string' && m.UUID_V4_REGEX.test(uuid),
        'corruption path returns a FRESH valid v4 UUID (got: ' + uuid + ')'
      );
      passAssert(uuid !== 'not-a-uuid', 'returned UUID is NOT the corrupt input');
      passAssertEqual(
        mock.local._dump().fsbInstallUuid,
        uuid,
        'storage was overwritten with the fresh UUID'
      );

      // Exactly one warn line with the expected prefix.
      const matching = warnCapture.warnings.filter((w) =>
        w.indexOf('[FSB Telemetry] Stored install UUID failed validation; minting fresh') !== -1
      );
      passAssertEqual(matching.length, 1, 'exactly one console.warn line emitted with the expected prefix');
    } finally {
      warnCapture.restore();
      teardownChromeMock();
    }
  }

  // --- Test 6: IDENT-04 grep gate -- no chrome.storage.sync in module source -
  console.log('\n--- Test: IDENT-04 grep gate -- no chrome.storage.sync in module source ---');
  {
    const src = fs.readFileSync(MODULE_PATH, 'utf8');
    // Strip line comments ( // ... ) and block comments ( /* ... */ ) before grep.
    let stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');
    stripped = stripped.split('\n').map((line) => {
      // Remove everything after // but only outside string literals -- for our
      // module we don't have inline // inside strings so a simple split is safe.
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    }).join('\n');
    const idx = stripped.indexOf('chrome.storage.sync');
    passAssertEqual(idx, -1, 'module source contains ZERO chrome.storage.sync references outside comments');
  }

  // --- Test 7: storage-key string locks (camelCase per CONTEXT D-decision) -
  console.log('\n--- Test: storage-key string locks (camelCase per CONTEXT D-decision) ---');
  {
    const m = freshRequire();
    passAssertEqual(m.FSB_INSTALL_UUID_KEY, 'fsbInstallUuid', 'FSB_INSTALL_UUID_KEY is camelCase fsbInstallUuid (NOT snake_case)');
    passAssertEqual(m.FSB_TELEMETRY_OPT_OUT_KEY, 'fsbTelemetryOptOut', 'FSB_TELEMETRY_OPT_OUT_KEY is camelCase fsbTelemetryOptOut');
  }

  // --- Summary -----------------------------------------------------------
  console.log('\n--- Summary ---');
  console.log('passed:', passed);
  console.log('failed:', failed);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('FAIL install-identity (uncaught):', err && err.stack || err);
  process.exit(1);
});
