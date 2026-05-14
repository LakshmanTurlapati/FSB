/**
 * Unit tests for extension/utils/telemetry-collector.js.
 *
 * Phase 272 / v0.9.69. Validates the 10 behaviour sections per CONTEXT.md
 * decisions/Tests + BEAT-01..10.
 *
 * Test sections (in order):
 *   1. Beat aggregation: 5 fsbUsageData rows in window with 2 distinct
 *      (client, model) tuples -> 2 events emitted, tokens summed per group.
 *   2. Watermark advancement: 3 sequential flushes don't re-process rows
 *      older than fsbTelemetryLastBeatTs; watermark advances each time.
 *   3. Queue FIFO cap: enqueueing 250 events -> queue contains 200
 *      (oldest 50 dropped).
 *   4. Stale drop on load: events with ts_minute < Date.now()-24h removed
 *      on flush start.
 *   5. Opt-out short-circuit: fsbTelemetryOptOut=true -> next flush clears
 *      queue, fetch shim is NOT called.
 *   6. Install announce timing: explicit enqueue({event_type:'install_announce'})
 *      -> queue gains exactly 1 event with event_type='install_announce'
 *      and 9 fields present, defaults applied.
 *   7. Retry cap: 5 server-failure POSTs -> 5th attempt's events dropped on
 *      the 6th flush.
 *   8. Active agent count: fsbActiveAgentsCount=3 -> emitted event has
 *      active_agent_count=3; missing/non-numeric/negative -> 0.
 *   9. Allowlist gate (RUNTIME): emitted event has EXACTLY 9 keys.
 *  10. SW eviction race: two concurrent flush() calls do not double-POST
 *      (flushLock serialization).
 *
 * Run: node tests/telemetry-collector.test.js
 *
 * Test harness pattern matches tests/mcp-metrics-recorder.test.js: plain Node
 * script, no external framework, in-memory chrome.storage.local shim, fetch
 * shim that records calls and returns canned responses.
 */

'use strict';

const path = require('path');

const COLLECTOR_PATH = require.resolve('../extension/utils/telemetry-collector.js');

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

function passAssertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  passAssert(a === e, msg + ' (expected: ' + e + ', got: ' + a + ')');
}

function freshRequire() {
  delete require.cache[COLLECTOR_PATH];
  // Reset module-level global from any previous require so each test
  // starts with a clean fsbTelemetryCollector.
  delete globalThis.fsbTelemetryCollector;
  return require(COLLECTOR_PATH);
}

// In-memory chrome.storage.local shim. Each test resets _store. Mirror of
// tests/mcp-metrics-recorder.test.js makeShim().
function makeShim() {
  return {
    _store: {},
    async get(keys) {
      const ks = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of ks) {
        if (Object.prototype.hasOwnProperty.call(this._store, k)) {
          out[k] = this._store[k];
        }
      }
      return out;
    },
    async set(o) {
      Object.assign(this._store, o);
    }
  };
}

// Fetch shim records every call. Each test pushes canned responses to
// _responses (FIFO); empty queue defaults to a 200 OK so basic tests don't
// have to enumerate every call.
function makeFetchShim() {
  const shim = {
    _calls: [],
    _responses: [],
    fetch: null
  };
  shim.fetch = async function (url, init) {
    let body;
    try { body = init && typeof init.body === 'string' ? JSON.parse(init.body) : init && init.body; }
    catch (_e) { body = init && init.body; }
    shim._calls.push({
      url: url,
      init: {
        method: init && init.method,
        keepalive: init && init.keepalive,
        headers: init && init.headers,
        body: body
      }
    });
    if (shim._responses.length === 0) return { ok: true, status: 200 };
    return shim._responses.shift();
  };
  return shim;
}

// Identity shim. Returns a fixed UUID + configurable opt-out.
function makeIdentityShim(optOut) {
  return {
    _optOut: !!optOut,
    async getOrCreateInstallUuid() { return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; },
    async isTelemetryOptedOut() { return this._optOut; }
  };
}

// Wire all shims into the freshly-required module.
function wireShims(mod, storage, fetchShim, identity) {
  mod._setStorageShim(storage);
  mod._setFetchShim(fetchShim.fetch);
  mod._setIdentityShim(identity);
}

(async function runTests() {

  // -------------------------------------------------------------------------
  // Section 1: Beat aggregation (5 rows, 2 distinct (client, model) tuples)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 1: Beat aggregation (5 rows -> 2 groups) ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    // Seed 5 fsbUsageData rows: 3 with (claude-code, claude-opus-4-7), 2 with
    // (codex, gpt-5). All within the watermark window (watermark = 0 default).
    const now = Date.now();
    storage._store.fsbUsageData = [
      { source: 'mcp', client: 'claude-code', model: 'claude-opus-4-7', tokens_in: 100, tokens_out: 50, ts: now - 10 },
      { source: 'mcp', client: 'claude-code', model: 'claude-opus-4-7', tokens_in: 200, tokens_out: 80, ts: now - 9 },
      { source: 'mcp', client: 'claude-code', model: 'claude-opus-4-7', tokens_in: 50,  tokens_out: 20, ts: now - 8 },
      { source: 'mcp', client: 'codex',       model: 'gpt-5',           tokens_in: 300, tokens_out: 150, ts: now - 7 },
      { source: 'mcp', client: 'codex',       model: 'gpt-5',           tokens_in: 150, tokens_out: 75,  ts: now - 6 },
      // Non-MCP row -- must be ignored
      { source: 'ai-provider', model: 'gpt-5', inputTokens: 999, outputTokens: 999, timestamp: now }
    ];
    storage._store.fsbActiveAgentsCount = 0;

    await m.flush();

    // After flush: POSTed snapshot, queue should be empty. Inspect the
    // POST body.
    passAssertEqual(fetchShim._calls.length, 1, 'exactly one POST issued');
    const body = fetchShim._calls[0].init.body;
    passAssert(body && Array.isArray(body.events), 'POST body has events array');
    passAssertEqual(body.events.length, 2, '2 events (one per (client, model) group)');

    // Find groups by mcp_client (insertion order in object iteration is
    // generally deterministic for string keys in V8, but we sort to be
    // robust).
    const events = body.events.slice().sort((a, b) => a.mcp_client.localeCompare(b.mcp_client));
    const claudeEv = events.find(e => e.mcp_client === 'claude-code');
    const codexEv = events.find(e => e.mcp_client === 'codex');

    passAssert(claudeEv && codexEv, 'both groups emitted');
    passAssertEqual(claudeEv.mcp_client, 'claude-code', 'claude group client');
    passAssertEqual(claudeEv.model, 'claude-opus-4-7', 'claude group model');
    passAssertEqual(claudeEv.tokens_in, 350, 'claude tokens_in summed: 100+200+50 = 350');
    passAssertEqual(claudeEv.tokens_out, 150, 'claude tokens_out summed: 50+80+20 = 150');
    passAssertEqual(codexEv.mcp_client, 'codex', 'codex group client');
    passAssertEqual(codexEv.model, 'gpt-5', 'codex group model');
    passAssertEqual(codexEv.tokens_in, 450, 'codex tokens_in summed: 300+150 = 450');
    passAssertEqual(codexEv.tokens_out, 225, 'codex tokens_out summed: 150+75 = 225');
    passAssertEqual(claudeEv.event_type, 'periodic', 'event_type is "periodic"');

    // Non-MCP row was ignored
    passAssert(!events.some(e => e.tokens_in === 999), 'AI-provider row not included');
  }

  // -------------------------------------------------------------------------
  // Section 2: Watermark advancement (3 sequential flushes)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: Watermark advancement ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    const t0 = Date.now();
    // Seed initial rows older than the first flush's "now".
    storage._store.fsbUsageData = [
      { source: 'mcp', client: 'claude-code', model: 'claude-opus-4-7', tokens_in: 10, tokens_out: 5, ts: t0 - 1000 },
      { source: 'mcp', client: 'claude-code', model: 'claude-opus-4-7', tokens_in: 20, tokens_out: 10, ts: t0 - 500 }
    ];

    // Flush #1: both rows aggregated -> one event POSTed.
    await m.flush();
    passAssertEqual(fetchShim._calls.length, 1, 'flush #1 issued a POST');
    const wm1 = storage._store.fsbTelemetryLastBeatTs;
    passAssert(typeof wm1 === 'number' && wm1 >= t0,
      'watermark advanced past initial seed time (got ' + wm1 + ', t0=' + t0 + ')');

    // Flush #2 with NO new rows: should not POST anything (no events to send).
    await m.flush();
    passAssertEqual(fetchShim._calls.length, 1, 'flush #2 issued NO new POST (no rows)');
    const wm2 = storage._store.fsbTelemetryLastBeatTs;
    passAssert(typeof wm2 === 'number' && wm2 >= wm1, 'watermark advanced again on flush #2');

    // Flush #3 after adding a NEW row beyond watermark: should aggregate
    // only the new row.
    storage._store.fsbUsageData.push({
      source: 'mcp', client: 'claude-code', model: 'claude-opus-4-7', tokens_in: 999, tokens_out: 111, ts: Date.now() + 100
    });
    await m.flush();
    passAssertEqual(fetchShim._calls.length, 2, 'flush #3 issued a POST for the new row');
    const body3 = fetchShim._calls[1].init.body;
    passAssertEqual(body3.events.length, 1, 'flush #3 emitted exactly one event');
    passAssertEqual(body3.events[0].tokens_in, 999, 'flush #3 picked up only the new row (tokens_in=999)');
    passAssertEqual(body3.events[0].tokens_out, 111, 'flush #3 picked up only the new row (tokens_out=111)');
  }

  // -------------------------------------------------------------------------
  // Section 3: Queue FIFO cap (250 enqueues -> 200 retained)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: Queue FIFO cap (250 -> 200, drop oldest 50) ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    storage._store.fsbActiveAgentsCount = 0;

    // Enqueue 250 install_announce events (won't POST until flush). We tag
    // each with a synthetic mcp_client we can identify post-cap.
    for (let i = 0; i < 250; i++) {
      await m.enqueue({
        event_type: 'install_announce',
        mcp_client: 'tag-' + i,
        model: 'unknown',
        tokens_in: i,
        tokens_out: 0
      });
    }

    const pending = await m.getPendingCount();
    passAssertEqual(pending, 200, 'after 250 enqueues, queue has 200 entries');

    // The 50 OLDEST should have been dropped -> the surviving 200 should be
    // tag-50 ... tag-249.
    const queue = storage._store.fsbTelemetryQueue;
    passAssert(Array.isArray(queue) && queue.length === 200, 'persisted queue has 200 entries');
    passAssertEqual(queue[0].mcp_client, 'tag-50', 'oldest surviving is tag-50 (tag-0..tag-49 dropped)');
    passAssertEqual(queue[queue.length - 1].mcp_client, 'tag-249', 'newest is tag-249');
  }

  // -------------------------------------------------------------------------
  // Section 4: Stale drop on load (events older than 24h removed)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: Stale drop (24h boundary) ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    const now = Date.now();
    const TWENTY_FIVE_HOURS_AGO = now - (25 * 60 * 60 * 1000);
    const ONE_HOUR_AGO = now - (60 * 60 * 1000);

    // Pre-seed queue: 3 stale events + 2 fresh events. After flush start,
    // stale events should be filtered out BEFORE aggregation runs.
    storage._store.fsbTelemetryQueue = [
      { event_id: 's1', install_uuid: 'x', ts_minute: TWENTY_FIVE_HOURS_AGO, mcp_client: 'old', model: 'old', tokens_in: 0, tokens_out: 0, active_agent_count: 0, event_type: 'periodic' },
      { event_id: 's2', install_uuid: 'x', ts_minute: TWENTY_FIVE_HOURS_AGO, mcp_client: 'old', model: 'old', tokens_in: 0, tokens_out: 0, active_agent_count: 0, event_type: 'periodic' },
      { event_id: 's3', install_uuid: 'x', ts_minute: TWENTY_FIVE_HOURS_AGO, mcp_client: 'old', model: 'old', tokens_in: 0, tokens_out: 0, active_agent_count: 0, event_type: 'periodic' },
      { event_id: 'f1', install_uuid: 'x', ts_minute: ONE_HOUR_AGO, mcp_client: 'fresh1', model: 'fresh1', tokens_in: 11, tokens_out: 22, active_agent_count: 0, event_type: 'periodic' },
      { event_id: 'f2', install_uuid: 'x', ts_minute: ONE_HOUR_AGO, mcp_client: 'fresh2', model: 'fresh2', tokens_in: 33, tokens_out: 44, active_agent_count: 0, event_type: 'periodic' }
    ];
    // No new fsbUsageData rows; only queue flush.
    storage._store.fsbUsageData = [];

    await m.flush();

    // The POST should contain only the 2 fresh events (stale dropped).
    passAssertEqual(fetchShim._calls.length, 1, 'one POST issued');
    const body = fetchShim._calls[0].init.body;
    passAssertEqual(body.events.length, 2, '2 fresh events in POST body');
    const ids = body.events.map(e => e.event_id).sort();
    passAssertDeepEqual(ids, ['f1', 'f2'], 'fresh event_ids preserved; stale removed');
    // Queue should be empty after successful POST.
    const after = await m.getPendingCount();
    passAssertEqual(after, 0, 'queue empty after successful POST');
  }

  // -------------------------------------------------------------------------
  // Section 5: Opt-out short-circuit
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: Opt-out short-circuit ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(true); // opted OUT
    wireShims(m, storage, fetchShim, identity);

    // Pre-seed queue with a real event AND fsbUsageData with new rows -- both
    // must be discarded.
    const now = Date.now();
    storage._store.fsbTelemetryQueue = [
      { event_id: 'q1', install_uuid: 'x', ts_minute: now, mcp_client: 'claude-code', model: 'm', tokens_in: 1, tokens_out: 2, active_agent_count: 0, event_type: 'periodic' }
    ];
    storage._store.fsbUsageData = [
      { source: 'mcp', client: 'claude-code', model: 'm', tokens_in: 99, tokens_out: 99, ts: now }
    ];

    let didThrow = false;
    try { await m.flush(); } catch (_e) { didThrow = true; }
    passAssertEqual(didThrow, false, 'opted-out flush did NOT throw');

    passAssertEqual(fetchShim._calls.length, 0, 'no POST issued when opted out');

    // Queue should be cleared.
    const after = await m.getPendingCount();
    passAssertEqual(after, 0, 'queue cleared by opt-out flush');
    const queue = storage._store.fsbTelemetryQueue;
    passAssert(Array.isArray(queue) && queue.length === 0, 'persisted queue is empty array');
  }

  // -------------------------------------------------------------------------
  // Section 6: install_announce event shape
  // -------------------------------------------------------------------------
  console.log('\n--- Section 6: install_announce event shape ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    storage._store.fsbActiveAgentsCount = 0;

    await m.enqueue({ event_type: 'install_announce' });

    const queue = storage._store.fsbTelemetryQueue;
    passAssert(Array.isArray(queue) && queue.length === 1, 'queue has exactly 1 event');
    const ev = queue[0];

    passAssertEqual(ev.event_type, 'install_announce', 'event_type is install_announce');
    passAssertEqual(ev.mcp_client, 'unknown', 'default mcp_client = unknown');
    passAssertEqual(ev.model, 'unknown', 'default model = unknown');
    passAssertEqual(ev.tokens_in, 0, 'default tokens_in = 0');
    passAssertEqual(ev.tokens_out, 0, 'default tokens_out = 0');
    passAssertEqual(ev.active_agent_count, 0, 'default active_agent_count = 0');
    passAssertEqual(ev.install_uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'install_uuid resolved from identity shim');
    passAssert(typeof ev.event_id === 'string' && ev.event_id.length > 0, 'event_id minted at enqueue time');
    passAssert(typeof ev.ts_minute === 'number' && ev.ts_minute > 0, 'ts_minute computed');
    passAssertEqual(ev.ts_minute % 60000, 0, 'ts_minute floors to one-minute resolution');

    // Allowlist check: the event has EXACTLY 9 keys.
    const keys = Object.keys(ev).sort();
    passAssertDeepEqual(keys, [
      'active_agent_count',
      'event_id',
      'event_type',
      'install_uuid',
      'mcp_client',
      'model',
      'tokens_in',
      'tokens_out',
      'ts_minute'
    ], 'event has EXACTLY the 9 allowlisted keys');
  }

  // -------------------------------------------------------------------------
  // Section 7: Retry cap (5 failed POSTs -> drop on 6th flush)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 7: Retry cap (5 failed POSTs drop on 6th flush) ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    storage._store.fsbActiveAgentsCount = 0;

    // Pre-seed one event via enqueue, then run 5 flushes each returning 500.
    await m.enqueue({ event_type: 'install_announce' });
    passAssertEqual(await m.getPendingCount(), 1, 'queue has 1 event pre-retry');

    // Queue 5 server-failure responses, then a 6th (which shouldn't be hit
    // because the event will be dropped on flush #6's attempts-cap pass).
    fetchShim._responses.push({ ok: false, status: 500 });
    fetchShim._responses.push({ ok: false, status: 500 });
    fetchShim._responses.push({ ok: false, status: 500 });
    fetchShim._responses.push({ ok: false, status: 500 });
    fetchShim._responses.push({ ok: false, status: 500 });

    // Flush 5 times. Each bumps attempts; after 5 attempts the event is at
    // cap and dropped on flush #6.
    for (let i = 1; i <= 5; i++) {
      await m.flush();
    }
    passAssertEqual(fetchShim._calls.length, 5, '5 POST attempts made');
    // Event should still be in queue at this point with attempts=5.
    const queueBefore6 = storage._store.fsbTelemetryQueue || [];
    passAssertEqual(queueBefore6.length, 1, 'event still in queue (attempts=5)');
    passAssertEqual(queueBefore6[0].attempts, 5, 'event attempts counter at cap (5)');

    // Flush #6: attempts cap drops the event BEFORE any POST is attempted.
    await m.flush();
    const after6 = await m.getPendingCount();
    passAssertEqual(after6, 0, 'event dropped on 6th flush (attempts >= MAX)');
    passAssertEqual(fetchShim._calls.length, 5, 'no 6th POST attempted (event dropped pre-POST)');
  }

  // -------------------------------------------------------------------------
  // Section 8: Active agent count default/coercion
  // -------------------------------------------------------------------------
  console.log('\n--- Section 8: Active agent count default/coercion ---');
  {
    // 8a: explicit value 3
    {
      const m = freshRequire();
      const storage = makeShim();
      const fetchShim = makeFetchShim();
      const identity = makeIdentityShim(false);
      wireShims(m, storage, fetchShim, identity);
      storage._store.fsbActiveAgentsCount = 3;
      await m.enqueue({ event_type: 'install_announce' });
      const ev = storage._store.fsbTelemetryQueue[0];
      passAssertEqual(ev.active_agent_count, 3, 'fsbActiveAgentsCount=3 -> event.active_agent_count=3');
    }
    // 8b: missing key -> 0
    {
      const m = freshRequire();
      const storage = makeShim();
      const fetchShim = makeFetchShim();
      const identity = makeIdentityShim(false);
      wireShims(m, storage, fetchShim, identity);
      // Do NOT set fsbActiveAgentsCount.
      await m.enqueue({ event_type: 'install_announce' });
      const ev = storage._store.fsbTelemetryQueue[0];
      passAssertEqual(ev.active_agent_count, 0, 'missing key -> active_agent_count=0');
    }
    // 8c: non-numeric -> 0
    {
      const m = freshRequire();
      const storage = makeShim();
      const fetchShim = makeFetchShim();
      const identity = makeIdentityShim(false);
      wireShims(m, storage, fetchShim, identity);
      storage._store.fsbActiveAgentsCount = 'not-a-number';
      await m.enqueue({ event_type: 'install_announce' });
      const ev = storage._store.fsbTelemetryQueue[0];
      passAssertEqual(ev.active_agent_count, 0, 'non-numeric -> active_agent_count=0');
    }
    // 8d: negative -> 0
    {
      const m = freshRequire();
      const storage = makeShim();
      const fetchShim = makeFetchShim();
      const identity = makeIdentityShim(false);
      wireShims(m, storage, fetchShim, identity);
      storage._store.fsbActiveAgentsCount = -7;
      await m.enqueue({ event_type: 'install_announce' });
      const ev = storage._store.fsbTelemetryQueue[0];
      passAssertEqual(ev.active_agent_count, 0, 'negative -> active_agent_count=0');
    }
    // 8e: float -> floor
    {
      const m = freshRequire();
      const storage = makeShim();
      const fetchShim = makeFetchShim();
      const identity = makeIdentityShim(false);
      wireShims(m, storage, fetchShim, identity);
      storage._store.fsbActiveAgentsCount = 4.7;
      await m.enqueue({ event_type: 'install_announce' });
      const ev = storage._store.fsbTelemetryQueue[0];
      passAssertEqual(ev.active_agent_count, 4, 'float 4.7 -> active_agent_count=4 (floor)');
    }
  }

  // -------------------------------------------------------------------------
  // Section 9: Runtime allowlist gate (every emitted event has 9 keys exactly)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 9: Runtime allowlist gate (9 keys exactly) ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    const now = Date.now();
    // Inject rows with PII-shaped fields that the collector MUST NOT copy.
    storage._store.fsbUsageData = [
      {
        source: 'mcp',
        client: 'claude-code',
        model: 'claude-opus-4-7',
        tokens_in: 10,
        tokens_out: 5,
        ts: now,
        // These three fields are present on Phase 271 rows but MUST NOT
        // appear in the beat payload.
        tool: 'click',
        cost_usd: 0.001,
        pricing_confidence: 'fallback',
        token_source: 'estimate'
      }
    ];
    storage._store.fsbActiveAgentsCount = 1;

    await m.flush();
    passAssertEqual(fetchShim._calls.length, 1, 'one POST issued');
    const body = fetchShim._calls[0].init.body;
    passAssertEqual(body.events.length, 1, 'one event emitted');
    const ev = body.events[0];

    const keys = Object.keys(ev).sort();
    const expected = [
      'active_agent_count',
      'event_id',
      'event_type',
      'install_uuid',
      'mcp_client',
      'model',
      'tokens_in',
      'tokens_out',
      'ts_minute'
    ];
    passAssertDeepEqual(keys, expected, 'event has EXACTLY 9 allowlisted keys');

    // Explicit negation: NONE of the banned row-derived fields appear.
    const banned = ['tool', 'cost_usd', 'pricing_confidence', 'token_source', 'ts', 'source', 'client'];
    for (const b of banned) {
      passAssert(!(b in ev), 'event does NOT include banned field "' + b + '"');
    }
  }

  // -------------------------------------------------------------------------
  // Section 10: SW eviction race (two concurrent flush calls -> one POST)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 10: SW eviction race (concurrent flush serialization) ---');
  {
    const m = freshRequire();
    const storage = makeShim();
    const fetchShim = makeFetchShim();
    const identity = makeIdentityShim(false);
    wireShims(m, storage, fetchShim, identity);

    const now = Date.now();
    // One MCP row -> one event will be enqueued by aggregation.
    storage._store.fsbUsageData = [
      { source: 'mcp', client: 'claude-code', model: 'claude-opus-4-7', tokens_in: 100, tokens_out: 50, ts: now }
    ];
    storage._store.fsbActiveAgentsCount = 0;

    // Fire two flush() invocations close together. _flushLock serializes
    // them so the SECOND flush sees: watermark already advanced, queue
    // already cleared after the FIRST flush's successful POST. Therefore
    // the second flush has nothing to POST.
    await Promise.all([m.flush(), m.flush()]);

    passAssertEqual(fetchShim._calls.length, 1,
      'two concurrent flush() calls produce EXACTLY ONE POST (flushLock serialization)');
    const body = fetchShim._calls[0].init.body;
    passAssertEqual(body.events.length, 1, 'single event in the single POST');
    passAssertEqual(body.events[0].tokens_in, 100, 'event carries the single row tokens_in=100');

    // Queue should be empty after the successful POST.
    const queueAfter = await m.getPendingCount();
    passAssertEqual(queueAfter, 0, 'queue empty after race resolved');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n--- Summary ---');
  console.log('Total: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
  console.log('All telemetry-collector tests passed.');
  process.exit(0);
})().catch((e) => {
  console.error('FATAL: test harness threw:', e && e.stack ? e.stack : e);
  process.exit(2);
});
