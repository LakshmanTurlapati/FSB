/**
 * Regression test for the mcp_client telemetry leak.
 *
 * Two layered fixes:
 *
 * 1. Quick task 260515-i1j -- dispatcher forwarded the MCPBridgeClient INSTANCE
 *    OBJECT (`this`) into recordDispatch() as `client`. The recorder's
 *    `typeof input.client === 'string'` gate failed on the object and stamped
 *    every telemetry_events row with mcp_client='unknown'. The dispatcher now
 *    exports `extractMcpClientLabel(payload)` which pulls the canonical
 *    normalised label from `payload.visualSession.client` (set by the MCP
 *    server at mcp/src/tools/manual.ts buildVisualSessionSidecar after the
 *    13-label allowlist gate in mcp/src/tools/visual-session.ts).
 *
 * 2. v0.9.69 telemetry follow-up -- non-action message routes
 *    (agent:register, mcp:get-tabs, mcp:get-dom, mcp:get-diagnostics,
 *    mcp:read-page) never carry a visualSession.client sidecar, so every
 *    recordDispatch row for those routes still landed on 'unknown' even
 *    after fix #1. The dispatcher now also exports `resolveMcpClientLabel`
 *    which falls back to a per-bridge-connect cache: any prior action-tool
 *    dispatch in the same connection seeds the cache with the canonical
 *    label, and subsequent non-action routes read from it before defaulting
 *    to 'unknown'. The cache resets via clearLastKnownMcpClientLabel(),
 *    which mcp-bridge-client.js calls from every fresh _ws.onopen so a
 *    different MCP client attaching on the same port cannot inherit the
 *    prior client's label.
 *
 * Coverage:
 *   1. Allowlist labels resolve verbatim (Claude / Codex / OpenCode / Cursor)
 *   2. Whitespace gets trimmed
 *   3. Missing payload / missing visualSession sidecar -> 'unknown'
 *   4. Non-string client field (object, number) -> 'unknown'
 *   5. Empty string -> 'unknown' (defence against upstream contract drift)
 *   6. resolveMcpClientLabel: seen-once label caches and survives a
 *      subsequent payload-less dispatch
 *   7. resolveMcpClientLabel: clearLastKnownMcpClientLabel() resets the
 *      cache so a fresh connection starts at 'unknown'
 *   8. resolveMcpClientLabel: real label on payload overwrites a stale
 *      cached label (e.g. legitimate client switch within the same
 *      connection -- shouldn't happen in production but the resolver
 *      must not stick on a stale label)
 *   9. Source-string regression guard -- both recordDispatch call sites
 *      in mcp-tool-dispatcher.js MUST call resolveMcpClientLabel(payload).
 *      Catches a future refactor that drops the helper at one site or
 *      reintroduces the bridge-object leak.
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
const {
  extractMcpClientLabel,
  resolveMcpClientLabel,
  clearLastKnownMcpClientLabel,
  _peekLastKnownMcpClientLabel,
} = dispatcher;

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

console.log('--- Test 6: resolveMcpClientLabel caches first real label and fills in payload-less follow-ups ---');
clearLastKnownMcpClientLabel();
passAssertEqual(_peekLastKnownMcpClientLabel(), null, 'cache empty after reset');
// Simulate an action-tool dispatch first -- payload carries visualSession.client.
passAssertEqual(
  resolveMcpClientLabel({ visualSession: { client: 'Claude' } }),
  'Claude',
  'first action dispatch surfaces real label'
);
passAssertEqual(_peekLastKnownMcpClientLabel(), 'Claude',
  'real label was cached for connection-scoped fallback');
// Simulate the non-action message routes that follow: agent:register, get-tabs,
// get-dom, get-diagnostics, read-page -- none of them carry visualSession.
passAssertEqual(resolveMcpClientLabel({}), 'Claude',
  'subsequent payload-less dispatch reads cached label (agent:register shape)');
passAssertEqual(resolveMcpClientLabel({ tool: 'mcp:get-tabs' }), 'Claude',
  'subsequent message-route payload reads cached label (mcp:get-tabs shape)');
passAssertEqual(resolveMcpClientLabel(null), 'Claude',
  'subsequent null-payload dispatch reads cached label');

console.log('--- Test 7: clearLastKnownMcpClientLabel resets cache (bridge reconnect path) ---');
clearLastKnownMcpClientLabel();
passAssertEqual(_peekLastKnownMcpClientLabel(), null,
  'cache empty after reset (mcp-bridge-client._ws.onopen path)');
passAssertEqual(resolveMcpClientLabel({}), 'unknown',
  'payload-less dispatch on fresh connection returns unknown (no cache)');

console.log('--- Test 8: real payload label overwrites a stale cached label ---');
clearLastKnownMcpClientLabel();
resolveMcpClientLabel({ visualSession: { client: 'Claude' } });
passAssertEqual(_peekLastKnownMcpClientLabel(), 'Claude', 'cached after first action dispatch');
passAssertEqual(
  resolveMcpClientLabel({ visualSession: { client: 'Codex' } }),
  'Codex',
  'second action dispatch with different client surfaces new label'
);
passAssertEqual(_peekLastKnownMcpClientLabel(), 'Codex',
  'cache updated to most recent real label (not pinned to first)');

console.log('--- Test 9: regression guard -- both recordDispatch sites use the resolver ---');
const dispatcherSrc = fs.readFileSync(DISPATCHER_PATH, 'utf8');

// Find every block from `globalThis.fsbMcpMetricsRecorder.recordDispatch({`
// up to the matching `});` and assert each one calls resolveMcpClientLabel
// rather than the legacy extractMcpClientLabel or the original bare bridge
// object. Regex stays loose enough to survive whitespace / argument-order
// tweaks but tight enough to catch a regression.
const callSitePattern = /globalThis\.fsbMcpMetricsRecorder\.recordDispatch\(\{[\s\S]*?\}\);/g;
const callSites = dispatcherSrc.match(callSitePattern) || [];

passAssert(callSites.length === 2,
  'expected exactly 2 recordDispatch call sites in mcp-tool-dispatcher.js (got ' + callSites.length + ')');

for (let i = 0; i < callSites.length; i++) {
  passAssert(callSites[i].includes('resolveMcpClientLabel(payload)'),
    'recordDispatch site #' + (i + 1) + ' calls resolveMcpClientLabel(payload)');
  // Bare `client,` (no extraction) is the legacy bug shape. Catch a partial
  // revert that drops the helper while keeping the rest of the call intact.
  passAssert(!/[\s,]client,\s/.test(callSites[i]),
    'recordDispatch site #' + (i + 1) + ' does NOT pass bare bridge-object `client` arg');
  // Catch a partial revert to the 260515-i1j helper that lacks the
  // non-action-route fallback.
  passAssert(!/client:\s*extractMcpClientLabel\(payload\)/.test(callSites[i]),
    'recordDispatch site #' + (i + 1) + ' does NOT regress to extractMcpClientLabel (missing non-action fallback)');
}

// Also assert mcp-bridge-client.js wires clearLastKnownMcpClientLabel on onopen.
const BRIDGE_CLIENT_PATH = path.resolve(__dirname, '..', 'extension', 'ws', 'mcp-bridge-client.js');
const bridgeSrc = fs.readFileSync(BRIDGE_CLIENT_PATH, 'utf8');
passAssert(/clearLastKnownMcpClientLabel\s*\(\s*\)/.test(bridgeSrc),
  'mcp-bridge-client.js invokes clearLastKnownMcpClientLabel() (cache reset on reconnect)');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
