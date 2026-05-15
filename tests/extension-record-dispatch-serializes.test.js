/**
 * Concurrency regression test for extension/utils/mcp-metrics-recorder.js.
 *
 * Codex flagged a P1 race on PR #50: two concurrent recordDispatch() calls
 * interleave their `get -> push -> set` cycle and silently lose the second
 * writer's row. This test fails the legacy code path (no module-level lock)
 * by deliberately slowing chrome.storage.local.{get,set} one tick each so
 * the race window is GUARANTEED to open, and asserts the new
 * `_withRecordLock` wrapper closes it.
 *
 * Authoritative behaviour:
 *   - 20 calls to recordDispatch fired concurrently via Promise.all against
 *     a deliberately racy storage shim -> exactly 20 rows appear in
 *     fsbUsageData (no row loss).
 *   - Every row carries source='mcp' and a numeric ts.
 *   - chrome.runtime.sendMessage was called 20 times -- one broadcast per
 *     row -- and each broadcast fires AFTER its matching set() resolves
 *     (verified by recording the storage length at broadcast time;
 *     broadcast #i must see length >= i).
 *
 * Run: node tests/extension-record-dispatch-serializes.test.js
 *
 * Test harness pattern mirrors tests/mcp-metrics-recorder.test.js: plain
 * Node script, no external framework, passed/failed counters,
 * process.exit(0|1).
 */

'use strict';

const PRICING_PATH = require.resolve('../extension/utils/mcp-pricing.js');
const RECORDER_PATH = require.resolve('../extension/utils/mcp-metrics-recorder.js');
const PRICING_DATA_PATH = require.resolve('../extension/utils/mcp-pricing-data.json');

let passed = 0;
let failed = 0;

function passAssert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

function passAssertEqual(actual, expected, msg) {
  passAssert(actual === expected,
    msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
}

function freshRequire() {
  delete require.cache[PRICING_PATH];
  delete require.cache[RECORDER_PATH];
  delete require.cache[PRICING_DATA_PATH];
  delete globalThis.fsbMcpPricing;
  delete globalThis.fsbMcpMetricsRecorder;
  // Pricing must be required first -- the recorder calls into it.
  require(PRICING_PATH);
  return require(RECORDER_PATH);
}

// Deliberately racy in-memory chrome.storage.local shim. Both get() and
// set() defer their resolution one microtask via setImmediate so a
// concurrent caller's get() can fire BEFORE this one's set() has settled.
//
// CRITICAL: get() must return a DEEP COPY of the stored value, NOT the
// underlying array reference. Real chrome.storage.local serialises the
// value to its internal IDB store and returns a fresh copy on each
// `get()` -- so two concurrent callers reading the same key receive
// INDEPENDENT arrays. The legacy recordDispatch code path then pushes
// onto its own local copy and writes back via set(), and the second
// writer's write overwrites the first writer's row.
//
// If we returned a shared reference instead, both callers would push
// onto the same array and the race would silently "self-heal" -- which
// would let the legacy code path pass this test (false negative). The
// JSON round-trip below is the simplest correct deep-clone that matches
// chrome.storage.local serialisation semantics.
//
// `_store` is intentionally a plain object so Object.assign in set()
// matches the production chrome.storage.local semantics. Methods are
// regular functions (not arrows) so `this._store` resolves -- mirrors
// makeShim() in tests/mcp-metrics-recorder.test.js.
function makeRacyShim() {
  return {
    _store: { fsbUsageData: [] },
    _broadcasts: [],
    _broadcastStoreLengthAtFire: [],
    async get(keys) {
      // Defer one tick so concurrent get() calls all see the same
      // pre-write snapshot under the legacy code path.
      await new Promise(function (r) { setImmediate(r); });
      const ks = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of ks) {
        if (Object.prototype.hasOwnProperty.call(this._store, k)) {
          // Deep-clone to mirror chrome.storage.local serialisation.
          out[k] = JSON.parse(JSON.stringify(this._store[k]));
        }
      }
      return out;
    },
    async set(o) {
      // Defer one tick to widen the race window.
      await new Promise(function (r) { setImmediate(r); });
      // Deep-clone the incoming value so subsequent get() calls see a
      // value disconnected from the caller's reference (chrome.storage
      // semantics).
      const cloned = JSON.parse(JSON.stringify(o));
      Object.assign(this._store, cloned);
    }
  };
}

// Mount global.chrome with storage.local + runtime.sendMessage. The
// broadcast handler records the fsbUsageData length AT the moment the
// broadcast fires, so we can later assert broadcast order matches
// storage-write order.
function installChromeStub(shim) {
  global.chrome = {
    storage: { local: shim },
    runtime: {
      sendMessage(msg) {
        shim._broadcasts.push(msg);
        const arr = shim._store.fsbUsageData;
        shim._broadcastStoreLengthAtFire.push(Array.isArray(arr) ? arr.length : 0);
        return Promise.resolve();
      }
    }
  };
}

(async function runTests() {

  console.log('\n--- Section 1: 20 concurrent recordDispatch -> 20 rows (no row loss) ---');
  {
    const m = freshRequire();
    const shim = makeRacyShim();
    installChromeStub(shim);
    m._setStorageShim(shim);

    // Fire 20 dispatches CONCURRENTLY. Each dispatch resolves to undefined.
    // Promise.all waits for all 20 -- after which fsbUsageData MUST hold 20
    // rows. On the legacy code path (no _withRecordLock), the racy shim
    // guarantees row loss -- this test would FAIL there.
    const N = 20;
    const dispatches = [];
    for (let i = 0; i < N; i++) {
      dispatches.push(m.recordDispatch({
        client: 'Claude',
        tool: 'click',
        requestPayload: { selector: '#row-' + i },
        response: { success: true },
        success: true,
        dispatcher_route: 'tool'
      }));
    }
    await Promise.all(dispatches);

    const rows = shim._store.fsbUsageData;
    passAssert(Array.isArray(rows), 'fsbUsageData is an array');
    passAssertEqual(rows.length, N, '20 concurrent recordDispatch calls append exactly 20 rows');

    // Every row carries source='mcp' and a numeric ts.
    let allMcp = true;
    let allNumericTs = true;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].source !== 'mcp') allMcp = false;
      if (typeof rows[i].ts !== 'number' || !isFinite(rows[i].ts)) allNumericTs = false;
    }
    passAssert(allMcp, 'every row has source = "mcp"');
    passAssert(allNumericTs, 'every row has a finite numeric ts');

    // One broadcast per row.
    passAssertEqual(shim._broadcasts.length, N,
      '20 ANALYTICS_UPDATE broadcasts fired (one per row)');

    // Every broadcast must carry the canonical message type.
    let allCanonicalType = true;
    for (let i = 0; i < shim._broadcasts.length; i++) {
      if (!shim._broadcasts[i] || shim._broadcasts[i].type !== 'ANALYTICS_UPDATE') {
        allCanonicalType = false;
      }
    }
    passAssert(allCanonicalType, 'every broadcast carries type="ANALYTICS_UPDATE"');

    // Broadcast ORDER must match storage-write order: at the moment
    // broadcast #i fires (1-indexed), the store must already hold at least
    // i rows. This proves the broadcast is sequenced AFTER its matching
    // set() resolved -- not before. (On the legacy code path with no lock,
    // the broadcast might fire while only j < i rows have actually
    // settled to storage.)
    let allBroadcastOrdered = true;
    let firstMisorder = -1;
    for (let i = 0; i < shim._broadcastStoreLengthAtFire.length; i++) {
      // Broadcast #i (0-indexed) must see at least (i+1) rows because the
      // row was set() immediately before this broadcast inside the locked
      // region. set() Object.assigns _store BEFORE returning -- so the
      // length is observable synchronously when the broadcast fires.
      if (shim._broadcastStoreLengthAtFire[i] < (i + 1)) {
        allBroadcastOrdered = false;
        if (firstMisorder === -1) firstMisorder = i;
      }
    }
    passAssert(allBroadcastOrdered,
      'every broadcast #i fires AFTER its matching set() resolved' +
      (firstMisorder === -1 ? '' : ' (first misorder at broadcast index ' + firstMisorder + ')'));
  }

  // --- Summary ------------------------------------------------------------
  console.log('\n--- Summary ---');
  console.log('Total: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
  console.log('All extension-record-dispatch-serializes tests passed.');
  process.exit(0);
})().catch((e) => {
  console.error('FATAL: test harness threw:', e && e.stack ? e.stack : e);
  process.exit(2);
});
