'use strict';

/**
 * Phase 211-02 -- DOM streaming hardening test.
 * Validates STREAM-03 (TreeWalker + cached rect map) and STREAM-04 (node-level
 * truncation with missingDescendants sentinel) invariants in content/dom-stream.js.
 *
 * Static analysis confirms the truncation rewrite landed verbatim. A pure-JS
 * mock of the truncation control flow exercises the algorithm against a 50k-entry
 * Map<nid, top> and asserts < 200ms wall time -- this isolates algorithmic
 * complexity from real-browser layout cost (manual UAT path documented below
 * exercises the full DOM path with timing).
 *
 * Manual UAT (real browser timing -- documented but NOT run by this test):
 *   1. Load tests/fixtures/dom-stream-50k.html in a Chrome tab with the FSB
 *      extension installed and DOM streaming active.
 *   2. Open the page DevTools console; run:
 *        var t0 = performance.now();
 *        var snap = FSB.domStream.serializeDOM();
 *        console.log('snapshot ms:', performance.now() - t0,
 *                    'truncated:', snap.truncated,
 *                    'missingDescendants:', snap.missingDescendants);
 *   3. Assert: ms < 200, truncated === true, missingDescendants > 0.
 *
 * Run: node tests/dom-stream-perf.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dsSource = fs.readFileSync(
  path.join(__dirname, '..', 'content', 'dom-stream.js'),
  'utf8'
);

console.log('--- STREAM-03 / STREAM-04 truncation invariants ---');
assert(dsSource.includes('document.createTreeWalker'), 'TreeWalker pre-pass present');
assert(dsSource.includes('topByNid = new Map()'), 'Map<nid, top> cache present');
assert(dsSource.includes('RELAY_PER_MESSAGE_LIMIT_BYTES = 1048576'), 'RELAY_PER_MESSAGE_LIMIT_BYTES constant present');
assert(dsSource.includes('RELAY_PER_MESSAGE_LIMIT_BYTES * 0.8'), '80% cap (D-06) present');
assert(dsSource.includes('missingDescendants: missingDescendants'), 'missingDescendants snapshot field present');
assert(!dsSource.includes("document.querySelector('[data-fsb-nid=\"' + nidVal"),
  'old per-element querySelector hot path removed');
console.log('  PASS: truncation rewrite invariants present');

console.log('--- STREAM-01 / STREAM-02 watchdog + stale counter invariants ---');
assert(dsSource.includes('var watchdogTick = function()'), 'self-watchdog tick function present');
assert(dsSource.includes('(Date.now() - lastDrainTs) > 5000'), 'D-03 5000ms threshold present');
assert(dsSource.includes('setTimeout(watchdogTick, 500)'), 'D-03 500ms cadence present');
assert(dsSource.includes('staleFlushCount++'), 'staleFlushCount increment present');
assert(dsSource.includes('staleFlushCount = 0;'), 'staleFlushCount reset on flush present');
assert(dsSource.includes('cancelAnimationFrame(batchTimer);'), 'rAF cancel before forced flush (PITFALLS.md P5)');
assert(dsSource.includes('clearTimeout(watchdogTimer)'), 'watchdog cancel in stopMutationStream present');
assert(dsSource.includes('getStaleFlushCount: function()'), 'FSB.domStream.getStaleFlushCount accessor present');
assert(!/setInterval\([^)]*watchdog/i.test(dsSource), 'no setInterval-based watchdog (D-03 / P5)');
console.log('  PASS: watchdog + stale counter invariants present');

console.log('--- Background SW alarm branch invariants ---');
const bgSource = fs.readFileSync(
  path.join(__dirname, '..', 'background.js'),
  'utf8'
);
assert(bgSource.includes("alarm.name === 'fsb-domstream-watchdog'"), 'fsb-domstream-watchdog branch in onAlarm');
assert(bgSource.includes("'fsb-domstream-watchdog', { periodInMinutes: 1 }"), 'D-02 chrome.alarms.create call');
assert(bgSource.includes('if (isMcpReconnectAlarm) {'), 'D-15 MCP_RECONNECT_ALARM early-return preserved');
assert(bgSource.includes("armMcpBridge('alarm:' + MCP_RECONNECT_ALARM)"), 'D-15 MCP arm call preserved');
assert(bgSource.includes('agentScheduler.getAgentIdFromAlarm(alarm.name)'), 'agent branch (Phase 212 owns) preserved untouched');
assert(bgSource.includes('_lastDomStreamStaleFlushCount'), 'STREAM-02 SW-side cache var present');
console.log('  PASS: SW alarm branch invariants present');

console.log('--- ws-client _emitStreamState invariants ---');
const wsSource = fs.readFileSync(
  path.join(__dirname, '..', 'ws', 'ws-client.js'),
  'utf8'
);
assert(/this\.send\('ext:stream-state',[\s\S]*?staleFlushCount[\s\S]*?\}\)/.test(wsSource),
  'staleFlushCount field literally appears INSIDE the this.send(ext:stream-state, { ... }) block');
assert(wsSource.includes('_lastDomStreamStaleFlushCount'), 'ws-client reads SW-side cache');
console.log('  PASS: ws-client _emitStreamState invariants present');

console.log('--- Fixture sanity ---');
const fixturePath = path.join(__dirname, 'fixtures', 'dom-stream-50k.html');
const fixtureStat = fs.statSync(fixturePath);
const fixtureBytes = fixtureStat.size;
assert(fixtureBytes > 4 * 1024 * 1024, 'fixture > 4 MB on disk (target ~5MB)');
assert(fixtureBytes < 8.5 * 1024 * 1024, 'fixture < 8.5 MB (avoid runaway size)');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');
const annotationCount = (fixtureText.match(/data-fsb-nid="/g) || []).length;
assert(annotationCount >= 49000, 'fixture has at least 49k data-fsb-nid annotations (allow 2% slack from 50k)');
assert(annotationCount <= 51000, 'fixture has at most 51k data-fsb-nid annotations');
console.log('  PASS: fixture is ~' + Math.round(fixtureBytes / 1024 / 1024) + ' MB with ' + annotationCount + ' annotations');

console.log('--- Algorithmic perf proxy: 50k Map iteration < 200ms (pure JS) ---');
// Build a 50k-entry Map<string, number> mimicking topByNid.
// Then run the truncation pass-1 logic over a parallel array of "clone elements"
// and assert the loop completes < 200ms. This isolates algorithmic complexity
// from real-browser layout cost. Real-browser timing is documented in the
// manual UAT block at the top of this file.
const N = 50000;
const topByNid = new Map();
const cloneElsMock = new Array(N);
const viewportCutoff = 600;
for (let i = 1; i <= N; i++) {
  const nid = String(i);
  topByNid.set(nid, i * 0.5); // roughly half above cutoff, half below
  cloneElsMock[i - 1] = { nid: nid, removed: false };
}
const t0 = (typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? performance.now() : Date.now();
let missingDescendants = 0;
for (let t = cloneElsMock.length - 1; t >= 0; t--) {
  const top = topByNid.get(cloneElsMock[t].nid);
  if (typeof top === 'number' && top > viewportCutoff) {
    cloneElsMock[t].removed = true;
    missingDescendants++;
  }
}
const elapsedMs = ((typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? performance.now() : Date.now()) - t0;
console.log('  Map iteration over ' + N + ' entries took ' + elapsedMs.toFixed(2) + ' ms; missingDescendants=' + missingDescendants);
assert(elapsedMs < 200, 'pure-JS truncation pass over 50k entries completes in < 200ms (algorithmic budget for STREAM-03)');
assert(missingDescendants > 0, 'truncation pass actually removes elements (sanity check)');
console.log('  PASS: algorithmic budget within 200ms');

console.log('\nAll assertions passed.');
console.log('NOTE: The 200ms perf bound on a real Chrome tab requires manual UAT against tests/fixtures/dom-stream-50k.html (instructions at the top of this file).');
