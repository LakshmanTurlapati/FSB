/**
 * Regression test for the mcp_client telemetry leak fixed in quick task 260515-i1j.
 *
 * Before this fix, extension/ws/mcp-tool-dispatcher.js forwarded the
 * MCPBridgeClient INSTANCE OBJECT (`this`) into recordDispatch() as the
 * `client` field. The recorder's `typeof input.client === 'string'` gate failed
 * on the object and stamped every telemetry_events row with
 * mcp_client='unknown'. Live production DB showed 61/61 events with
 * mcp_client='unknown' (and the propagated model='unknown') across 2 install_uuids
 * before this fix landed.
 *
 * Fix: dispatcher exports `extractMcpClientLabel(payload)` which pulls the
 * canonical normalised label from `payload.visualSession.client` (set by the
 * MCP server at mcp/src/tools/manual.ts buildVisualSessionSidecar after the
 * 13-label allowlist gate in mcp/src/tools/visual-session.ts).
 *
 * Coverage:
 *   1. Allowlist labels resolve verbatim (Claude / Codex / OpenCode / Cursor)
 *   2. Whitespace gets trimmed
 *   3. Missing payload / missing visualSession sidecar -> 'unknown'
 *   4. Non-string client field (object, number) -> 'unknown'
 *   5. Empty string -> 'unknown' (defence against upstream contract drift)
 *   6. Source-string regression guard -- both recordDispatch call sites in
 *      mcp-tool-dispatcher.js MUST call extractMcpClientLabel(payload).
 *      Catches a future refactor that drops the helper at one site.
 *
 * Run: node tests/mcp-dispatcher-client-label.test.js
 *
 * Test harness pattern mirrors tests/mcp-metrics-recorder.test.js: plain
 * Node script, no framework, passed/failed counters, process.exit(0|1).
 */

'use strict';

const path = require('path');
const fs = require('fs');

const DISPATCHER_PATH = path.resolve(__dirname, '..', 'extension', 'ws', 'mcp-tool-dispatcher.js');
const dispatcher = require(DISPATCHER_PATH);
const { extractMcpClientLabel } = dispatcher;

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

console.log('--- Test 1: allowlist labels pass through verbatim ---');
for (const label of ['Claude', 'Codex', 'OpenCode', 'Cursor', 'ChatGPT', 'Gemini']) {
  passAssertEqual(
    extractMcpClientLabel({ visualSession: { client: label } }),
    label,
    'allowlist label ' + JSON.stringify(label) + ' -> ' + JSON.stringify(label)
  );
}

console.log('--- Test 2: whitespace is trimmed ---');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: '  Claude  ' } }), 'Claude',
  'leading + trailing whitespace trimmed');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: 'Codex\n' } }), 'Codex',
  'trailing newline trimmed');

console.log('--- Test 3: missing payload / missing sidecar -> unknown ---');
passAssertEqual(extractMcpClientLabel(null), 'unknown', 'payload=null -> unknown');
passAssertEqual(extractMcpClientLabel(undefined), 'unknown', 'payload=undefined -> unknown');
passAssertEqual(extractMcpClientLabel({}), 'unknown', 'payload={} -> unknown');
passAssertEqual(extractMcpClientLabel({ visualSession: null }), 'unknown',
  'payload.visualSession=null -> unknown');
passAssertEqual(extractMcpClientLabel({ visualSession: {} }), 'unknown',
  'payload.visualSession={} -> unknown');

console.log('--- Test 4: non-string client -> unknown ---');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: 123 } }), 'unknown',
  'numeric client -> unknown');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: { instance: true } } }), 'unknown',
  'object client (the original bridge-instance leak shape) -> unknown');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: null } }), 'unknown',
  'null client -> unknown');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: undefined } }), 'unknown',
  'undefined client -> unknown');

console.log('--- Test 5: empty / whitespace-only string -> unknown ---');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: '' } }), 'unknown',
  'empty string -> unknown');
passAssertEqual(extractMcpClientLabel({ visualSession: { client: '   ' } }), 'unknown',
  'whitespace-only -> unknown');

console.log('--- Test 6: regression guard -- both recordDispatch sites use the helper ---');
const dispatcherSrc = fs.readFileSync(DISPATCHER_PATH, 'utf8');

// Find every block from `globalThis.fsbMcpMetricsRecorder.recordDispatch({`
// up to the matching `});` and assert each one contains
// `client: extractMcpClientLabel(payload)`. Regex stays loose enough to
// survive whitespace / argument-order tweaks but tight enough to catch a
// regression that re-introduces the bridge-object leak.
const callSitePattern = /globalThis\.fsbMcpMetricsRecorder\.recordDispatch\(\{[\s\S]*?\}\);/g;
const callSites = dispatcherSrc.match(callSitePattern) || [];

passAssert(callSites.length === 2,
  'expected exactly 2 recordDispatch call sites in mcp-tool-dispatcher.js (got ' + callSites.length + ')');

for (let i = 0; i < callSites.length; i++) {
  passAssert(callSites[i].includes('extractMcpClientLabel(payload)'),
    'recordDispatch site #' + (i + 1) + ' calls extractMcpClientLabel(payload)');
  // Bare `client,` (no extraction) is the legacy bug shape. Catch a partial
  // revert that drops the helper while keeping the rest of the call intact.
  passAssert(!/[\s,]client,\s/.test(callSites[i]),
    'recordDispatch site #' + (i + 1) + ' does NOT pass bare bridge-object `client` arg');
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
