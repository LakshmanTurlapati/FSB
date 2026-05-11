'use strict';

/**
 * Phase 256 Plan 04 -- lifecycle unit tests for the v0.9.62 implicit
 * visual-session contract.
 *
 * Source-of-truth: .planning/v0.9.62-CONTRACT.md (Field Bundle section,
 * Badge Allowlist citation) and .planning/phases/256-.../256-CONTEXT.md
 * (Persistence + Timer + Ordering at the chokepoint sections).
 *
 * What this test locks:
 *   A. recordVisualSessionTick on a fresh tab writes the documented shape
 *      and creates the death alarm (TIMEOUT-01 implicit start).
 *   B. recordVisualSessionTick on the same tab+agent re-arms the window
 *      (TIMEOUT-02 sliding 60s).
 *   C. recordVisualSessionTick from a different agentId rejects
 *      (TIMEOUT-05 ownership-gating defense-in-depth).
 *   D. handleVisualSessionLifecycleAlarm at-or-after deadline clears
 *      (TIMEOUT-03 auto-clear).
 *   E. handleVisualSessionLifecycleAlarm before deadline reschedules.
 *   F. restoreVisualSessionLifecyclesFromStorage replays live entries +
 *      immediate-clears elapsed ones (TIMEOUT-04 SW-eviction replay).
 *   G. handleVisualSessionLifecycleTabRemoved cleans up storage + alarm.
 *   H. recordVisualSessionTick with non-allowlisted client rejects
 *      (defense-in-depth dual of Phase 255 BADGE_NOT_ALLOWED).
 *   I. Module structurally exposes no read-only API surface (read-tool
 *      no-op is contract-shape, not behaviour).
 *
 * Run: node tests/mcp-visual-tick-lifecycle.test.js
 */

const path = require('path');

let passed = 0;
let failed = 0;

function check(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

// ------------------------------------------------------------------
// In-memory chrome.storage.session + chrome.alarms fakes.
// Pattern copied verbatim from tests/mcp-bridge-client-lifecycle.test.js
// lines 118-146 (createStorageArea + createChromeMock), augmented with
// _keys() on the storage area so tests can assert key namespacing.
// ------------------------------------------------------------------

function createStorageArea(initial) {
  const store = Object.assign({}, initial || {});
  return {
    async get(keys) {
      if (keys == null) return Object.assign({}, store);
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) out[key] = store[key];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
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
      Object.assign(store, values);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => { delete store[key]; });
    },
    _dump() { return Object.assign({}, store); },
    _keys() { return Object.keys(store); }
  };
}

function createChromeMock() {
  const session = createStorageArea();
  const alarms = new Map();
  const cleared = [];
  return {
    storage: { session },
    alarms: {
      async create(name, options) {
        alarms.set(name, Object.assign({ name }, options || {}));
      },
      async clear(name) {
        cleared.push(name);
        alarms.delete(name);
        return true;
      },
      async getAll() {
        return Array.from(alarms.values());
      },
      _created() { return Array.from(alarms.values()); },
      _cleared() { return cleared.slice(); }
    }
  };
}

// ------------------------------------------------------------------
// Harness: load the v0.9.36 utils, install the chrome mock + a fake
// sendSessionStatus on the Node global, then re-require the lifecycle
// module with a clean require.cache slot so the IIFE rebinds against
// the fresh global state.
// ------------------------------------------------------------------

const LIFECYCLE_MODULE_PATH = require.resolve('../extension/utils/mcp-visual-session-lifecycle.js');
const VISUAL_SESSION_UTILS_PATH = require.resolve('../extension/utils/mcp-visual-session.js');

function setupHarness() {
  const chromeMock = createChromeMock();
  const capturedStatusBroadcasts = [];

  global.chrome = chromeMock;
  global.MCPVisualSessionUtils = require(VISUAL_SESSION_UTILS_PATH);
  global.sendSessionStatus = async (tabId, statusData) => {
    capturedStatusBroadcasts.push({ tabId, statusData });
  };

  delete require.cache[LIFECYCLE_MODULE_PATH];
  const lc = require(LIFECYCLE_MODULE_PATH);

  return {
    chromeMock,
    lc,
    capturedStatusBroadcasts,
    resetBroadcasts() { capturedStatusBroadcasts.length = 0; }
  };
}

// ------------------------------------------------------------------
// Cases A through I
// ------------------------------------------------------------------

async function caseA() {
  console.log('\n--- Case A: implicit start on fresh tab (TIMEOUT-01) ---');
  const { chromeMock, lc, capturedStatusBroadcasts } = setupHarness();

  const before = Date.now();
  const result = await lc.recordVisualSessionTick(42, 'agent_abc', {
    visualReason: 'Logging in',
    client: 'Claude',
    isFinal: false
  });
  const after = Date.now();

  check(result && result.ok === true && result.action === 'created', 'A.1 recordVisualSessionTick returned ok=true action=created');
  const stored = await chromeMock.storage.session.get(['mcpVisualSession:42']);
  const entry = stored['mcpVisualSession:42'];
  check(entry && entry.tabId === 42, 'A.2 entry persisted under mcpVisualSession:42');
  check(entry && entry.agentId === 'agent_abc', 'A.3 entry.agentId matches caller');
  check(entry && entry.client === 'Claude', 'A.4 entry.client normalised to canonical label');
  check(entry && entry.visualReason === 'Logging in', 'A.5 entry.visualReason trimmed');
  check(entry && entry.startedAt >= before && entry.startedAt <= after, 'A.6 entry.startedAt within now()-window');
  check(entry && entry.deadlineAt === entry.lastTickAt + 60000, 'A.7 deadlineAt = lastTickAt + 60000 (TIMEOUT-01)');
  check(entry && entry.isFinal === false, 'A.8 entry.isFinal mirrors caller');

  const alarms = chromeMock.alarms._created();
  const deathAlarm = alarms.find((a) => a.name === 'mcpVisualDeath:42');
  check(!!deathAlarm, 'A.9 chrome.alarms entry mcpVisualDeath:42 created');
  check(deathAlarm && deathAlarm.when === entry.deadlineAt, 'A.10 alarm when=entry.deadlineAt');

  check(capturedStatusBroadcasts.length === 1, 'A.11 sendSessionStatus broadcast fired once');
  check(capturedStatusBroadcasts[0] && capturedStatusBroadcasts[0].tabId === 42, 'A.12 broadcast went to tabId 42');
  check(capturedStatusBroadcasts[0] && capturedStatusBroadcasts[0].statusData && capturedStatusBroadcasts[0].statusData.clientLabel === 'Claude', 'A.13 broadcast carries clientLabel=Claude');
}

async function caseB() {
  console.log('\n--- Case B: sliding re-arm on same tab+agent (TIMEOUT-02) ---');
  const { chromeMock, lc } = setupHarness();

  await lc.recordVisualSessionTick(99, 'agent_xyz', { visualReason: 'Step 1', client: 'Codex' });
  const first = (await chromeMock.storage.session.get(['mcpVisualSession:99']))['mcpVisualSession:99'];
  const firstAlarmList = chromeMock.alarms._created().filter((a) => a.name === 'mcpVisualDeath:99');
  check(firstAlarmList.length === 1, 'B.0 first tick created exactly one alarm');

  // Ensure the second tick lands on a strictly-later millisecond reading.
  await new Promise((resolve) => setTimeout(resolve, 10));

  await lc.recordVisualSessionTick(99, 'agent_xyz', { visualReason: 'Step 2', client: 'Codex' });
  const second = (await chromeMock.storage.session.get(['mcpVisualSession:99']))['mcpVisualSession:99'];
  const secondAlarms = chromeMock.alarms._created().filter((a) => a.name === 'mcpVisualDeath:99');

  check(second.startedAt === first.startedAt, 'B.1 startedAt preserved across ticks');
  check(second.lastTickAt > first.lastTickAt, 'B.2 lastTickAt advanced (TIMEOUT-02)');
  check(second.deadlineAt === second.lastTickAt + 60000, 'B.3 deadlineAt = new lastTickAt + 60000');
  check(second.visualReason === 'Step 2', 'B.4 visualReason refreshed');
  check(secondAlarms.length === 1 && secondAlarms[0].when === second.deadlineAt, 'B.5 alarm replaced with new when');
  check(chromeMock.alarms._cleared().filter((name) => name === 'mcpVisualDeath:99').length >= 1, 'B.6 previous alarm cleared before re-create');
}

async function caseC() {
  console.log('\n--- Case C: cross-agent tick rejected (TIMEOUT-05 defense-in-depth) ---');
  const { chromeMock, lc } = setupHarness();

  await lc.recordVisualSessionTick(7, 'agent_owner', { visualReason: 'reason', client: 'Claude' });
  const before = (await chromeMock.storage.session.get(['mcpVisualSession:7']))['mcpVisualSession:7'];

  const result = await lc.recordVisualSessionTick(7, 'agent_intruder', { visualReason: 'intruder reason', client: 'Claude' });
  const after = (await chromeMock.storage.session.get(['mcpVisualSession:7']))['mcpVisualSession:7'];

  check(result && result.ok === false && result.reason === 'agent_mismatch', 'C.1 cross-agent tick returns ok=false reason=agent_mismatch (TIMEOUT-05 defense-in-depth)');
  check(before.lastTickAt === after.lastTickAt, 'C.2 storage entry not mutated by cross-agent tick');
  check(before.visualReason === after.visualReason, 'C.3 visualReason unchanged on rejection');
  check(before.agentId === after.agentId, 'C.4 agentId unchanged on rejection');
}

async function caseD() {
  console.log('\n--- Case D: alarm fires at-or-after deadline -> auto-clear (TIMEOUT-03) ---');
  const { chromeMock, lc, capturedStatusBroadcasts } = setupHarness();

  await lc.recordVisualSessionTick(11, 'agent_a', { visualReason: 'r', client: 'Gemini' });
  const key = 'mcpVisualSession:11';

  // Force the deadline into the past by mutating storage directly so the
  // alarm handler takes the auto-clear branch deterministically.
  const entry = (await chromeMock.storage.session.get([key]))[key];
  entry.deadlineAt = Date.now() - 1000;
  await chromeMock.storage.session.set({ [key]: entry });
  capturedStatusBroadcasts.length = 0;

  const r = await lc.handleVisualSessionLifecycleAlarm({ name: 'mcpVisualDeath:11' });
  check(r && r.ok === true && r.action === 'cleared', 'D.1 handler returned action=cleared (TIMEOUT-03)');

  const post = (await chromeMock.storage.session.get([key]))[key];
  check(post === undefined, 'D.2 storage entry removed');
  check(capturedStatusBroadcasts.length === 1, 'D.3 one clear-broadcast fired');
  check(capturedStatusBroadcasts[0] && capturedStatusBroadcasts[0].statusData && capturedStatusBroadcasts[0].statusData.phase === 'ended', 'D.4 clear broadcast carries phase=ended');
  check(chromeMock.alarms._cleared().includes('mcpVisualDeath:11'), 'D.5 alarm cleared');
}

async function caseE() {
  console.log('\n--- Case E: alarm fires BEFORE deadline -> reschedule, no clear ---');
  const { chromeMock, lc, capturedStatusBroadcasts } = setupHarness();

  await lc.recordVisualSessionTick(22, 'agent_b', { visualReason: 'r2', client: 'Cursor' });
  const key = 'mcpVisualSession:22';
  const entry = (await chromeMock.storage.session.get([key]))[key];
  const futureDeadline = Date.now() + 30000;
  entry.deadlineAt = futureDeadline;
  await chromeMock.storage.session.set({ [key]: entry });
  capturedStatusBroadcasts.length = 0;

  const r = await lc.handleVisualSessionLifecycleAlarm({ name: 'mcpVisualDeath:22' });
  check(r && r.ok === true && r.action === 'rescheduled', 'E.1 early-fire returned action=rescheduled');

  const post = (await chromeMock.storage.session.get([key]))[key];
  check(post && post.deadlineAt === futureDeadline, 'E.2 storage entry NOT removed on early fire');

  const reAlarms = chromeMock.alarms._created().filter((a) => a.name === 'mcpVisualDeath:22');
  check(reAlarms.length >= 1 && reAlarms[reAlarms.length - 1].when === futureDeadline, 'E.3 alarm rescheduled at the original deadlineAt');
  check(capturedStatusBroadcasts.length === 0, 'E.4 no clear-broadcast on early fire');
}

async function caseF() {
  console.log('\n--- Case F: SW-eviction restore replays live + clears elapsed (TIMEOUT-04) ---');
  const { chromeMock, lc, capturedStatusBroadcasts } = setupHarness();
  const now = Date.now();

  await chromeMock.storage.session.set({
    'mcpVisualSession:101': {
      tabId: 101,
      agentId: 'agent_live',
      client: 'Claude',
      visualReason: 'live',
      startedAt: now - 10000,
      lastTickAt: now - 10000,
      deadlineAt: now + 50000,
      isFinal: false
    },
    'mcpVisualSession:102': {
      tabId: 102,
      agentId: 'agent_dead',
      client: 'Codex',
      visualReason: 'dead',
      startedAt: now - 120000,
      lastTickAt: now - 120000,
      deadlineAt: now - 60000,
      isFinal: false
    },
    'mcpVisualSession:103': {
      // Malformed: missing agentId. Should be dropped.
      tabId: 103,
      client: 'Claude',
      visualReason: 'malformed',
      startedAt: now,
      lastTickAt: now,
      deadlineAt: now + 30000,
      isFinal: false
    }
  });

  const r = await lc.restoreVisualSessionLifecyclesFromStorage();
  check(r && r.ok === true, 'F.1 restore returned ok=true');
  check(r.restored === 1, 'F.2 one live entry restored');
  check(r.cleared === 1, 'F.3 one elapsed entry cleared');
  check(r.dropped === 1, 'F.4 one malformed entry dropped');

  const liveStored = (await chromeMock.storage.session.get(['mcpVisualSession:101']))['mcpVisualSession:101'];
  check(liveStored && liveStored.deadlineAt === now + 50000, 'F.5 live entry deadline preserved (TIMEOUT-04 -- deadline arithmetic does NOT silently reset)');

  const deadStored = (await chromeMock.storage.session.get(['mcpVisualSession:102']))['mcpVisualSession:102'];
  check(deadStored === undefined, 'F.6 elapsed entry removed');

  const malformedStored = (await chromeMock.storage.session.get(['mcpVisualSession:103']))['mcpVisualSession:103'];
  check(malformedStored === undefined, 'F.7 malformed entry removed');

  const liveAlarm = chromeMock.alarms._created().find((a) => a.name === 'mcpVisualDeath:101');
  check(liveAlarm && liveAlarm.when === now + 50000, 'F.8 alarm re-armed for live entry with original when');

  const elapsedAlarm = chromeMock.alarms._created().find((a) => a.name === 'mcpVisualDeath:102');
  check(!elapsedAlarm, 'F.9 no alarm created for elapsed entry (it was auto-cleared, not rearmed)');
}

async function caseG() {
  console.log('\n--- Case G: tab-removed cleanup (no broadcast; tab is gone) ---');
  const { chromeMock, lc, capturedStatusBroadcasts } = setupHarness();

  await lc.recordVisualSessionTick(55, 'agent_c', { visualReason: 'r', client: 'Windsurf' });
  capturedStatusBroadcasts.length = 0;

  await lc.handleVisualSessionLifecycleTabRemoved(55);

  const post = (await chromeMock.storage.session.get(['mcpVisualSession:55']))['mcpVisualSession:55'];
  check(post === undefined, 'G.1 storage entry removed on tab close');
  check(chromeMock.alarms._cleared().includes('mcpVisualDeath:55'), 'G.2 alarm cleared on tab close');
  // Tab-removed MUST NOT broadcast (the tab is gone; no consumer).
  check(capturedStatusBroadcasts.length === 0, 'G.3 no overlay broadcast on tab close');
}

async function caseH() {
  console.log('\n--- Case H: client allowlist defense-in-depth ---');
  const { chromeMock, lc } = setupHarness();

  const r = await lc.recordVisualSessionTick(77, 'agent_d', { visualReason: 'r', client: 'NotARealClient' });
  check(r && r.ok === false && r.reason === 'client_not_allowed', 'H.1 non-allowlisted client rejected at lifecycle layer (defense-in-depth dual of Phase 255 BADGE_NOT_ALLOWED)');

  const stored = (await chromeMock.storage.session.get(['mcpVisualSession:77']))['mcpVisualSession:77'];
  check(stored === undefined, 'H.2 no storage write on allowlist rejection');

  const alarms = chromeMock.alarms._created().filter((a) => a.name === 'mcpVisualDeath:77');
  check(alarms.length === 0, 'H.3 no alarm create on allowlist rejection');
}

function caseI() {
  console.log('\n--- Case I: module surface shape (read-tool no-op is structural) ---');
  const { lc } = setupHarness();
  const exportedNames = Object.keys(lc).sort();
  const expected = [
    'MCP_VISUAL_LIFECYCLE_ALARM_PREFIX',
    'MCP_VISUAL_LIFECYCLE_DEATH_MS',
    'MCP_VISUAL_LIFECYCLE_STORAGE_KEY_PREFIX',
    'clearVisualSession',
    'handleVisualSessionLifecycleAlarm',
    'handleVisualSessionLifecycleTabRemoved',
    'recordVisualSessionTick',
    'restoreVisualSessionLifecyclesFromStorage'
  ];

  for (const name of expected) {
    check(exportedNames.includes(name), 'I.1 module exports ' + name);
  }

  // Read-only-tool no-op is STRUCTURAL: the lifecycle module exposes NO
  // read-tool surface. Read tools route through different methods in
  // mcp-bridge-client.js (_handleGetDOM, _handleReadPage, etc.) and never
  // reach _handleExecuteAction where recordVisualSessionTick is wired
  // (Plan 03). The lifecycle module's contract is "action-tool-only by
  // construction" -- read tools are structurally precluded.
  const forbidden = ['recordReadOnlyTick', 'handleReadOnlyTool', 'readToolNoOp'];
  for (const name of forbidden) {
    check(!exportedNames.includes(name), 'I.2 module does NOT export read-tool surface ' + name + ' (read tools structurally precluded)');
  }

  // Constant sanity: the published prefixes / TTL match the contract.
  check(lc.MCP_VISUAL_LIFECYCLE_STORAGE_KEY_PREFIX === 'mcpVisualSession:', 'I.3 storage prefix exported as mcpVisualSession:');
  check(lc.MCP_VISUAL_LIFECYCLE_ALARM_PREFIX === 'mcpVisualDeath:', 'I.4 alarm prefix exported as mcpVisualDeath:');
  check(lc.MCP_VISUAL_LIFECYCLE_DEATH_MS === 60000, 'I.5 death TTL exported as 60000 ms');
}

// ------------------------------------------------------------------
// Driver
// ------------------------------------------------------------------

(async () => {
  await caseA();
  await caseB();
  await caseC();
  await caseD();
  await caseE();
  await caseF();
  await caseG();
  await caseH();
  caseI();

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('FATAL:', err && err.stack ? err.stack : err);
  process.exit(1);
});
