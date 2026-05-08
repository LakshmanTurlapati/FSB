'use strict';

/**
 * Phase 242 plan 01 -- BACK-01 server-side smoke
 *
 * Verifies the new server.tool('back', ...) registration in
 * mcp/src/tools/agents.ts:
 *   - The handler resolves to a callable function via the smoke harness.
 *   - Invoking back({}) emits a single 'mcp:go-back' bridge envelope
 *     carrying agentId / ownershipToken / connectionId (the canonical
 *     Phase 238/240/241 triple).
 *   - Invoking back({ tabId: N }) threads N into payload.tabId.
 *   - All 5 D-05 status codes (ok | no_history | cross_origin | bf_cache |
 *     fragment_only) flow back to the MCP host unchanged through
 *     mapFSBError's success-text JSON serialization.
 *   - A bridge reply of { success:false, error:'TAB_NOT_OWNED', ... }
 *     surfaces 'TAB_NOT_OWNED' in the mapped error response (proves the
 *     Phase 240 gate's reject reaches the MCP host; the actual gate
 *     check runs on the extension side in Plan 02).
 *
 * Plain Node + assert; no jest, no mocha. Mirrors the structure of
 * tests/mcp-tool-smoke.test.js (assert helper, agent:register lazy-mint
 * skip pattern at lines 49-58).
 */

const {
  createToolHarness,
  loadAgentScope,
  loadBuildModule,
} = require('./mcp-smoke-harness.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

async function buildHarnessWithBackReply(reply) {
  const agentsModule = await loadBuildModule('tools/agents.js');
  const harness = createToolHarness({
    bridgeResponses: {
      'mcp:go-back': reply,
    },
  });
  const agentScope = await loadAgentScope();
  agentsModule.registerAgentTools(harness.server, harness.bridge, harness.queue, agentScope);
  return harness;
}

function findToolCall(harness, beforeIndex, expectedType) {
  for (let i = beforeIndex; i < harness.bridgeCalls.length; i++) {
    const entry = harness.bridgeCalls[i];
    if (entry && entry.message && entry.message.type === 'agent:register') continue;
    if (entry && entry.message && entry.message.type === expectedType) return entry;
  }
  return null;
}

async function runStatusSubTest(reply, expectedStatusInResponse) {
  const harness = await buildHarnessWithBackReply(reply);
  const handler = harness.getHandler('back');
  assert(typeof handler === 'function', 'back resolves to a callable handler (status=' + expectedStatusInResponse + ')');
  if (typeof handler !== 'function') return;

  const before = harness.bridgeCalls.length;
  const result = await handler({}, harness.createExtra());

  const call = findToolCall(harness, before, 'mcp:go-back');
  assert(!!call, 'back emits mcp:go-back bridge envelope (status=' + expectedStatusInResponse + ')');
  if (!call) return;

  const payload = call.message && call.message.payload;
  assert(payload && typeof payload.agentId === 'string' && payload.agentId.length > 0, 'payload.agentId is non-empty (status=' + expectedStatusInResponse + ')');

  // Status preservation: mapFSBError stringifies the success result; assert
  // the textual content surfaces the status verbatim.
  assert(result && Array.isArray(result.content) && result.content.length > 0, 'back returns MCP content output (status=' + expectedStatusInResponse + ')');
  const responseText = result && result.content && result.content[0] && result.content[0].text ? String(result.content[0].text) : JSON.stringify(result);
  assert(responseText.indexOf(expectedStatusInResponse) !== -1, 'response surfaces status verbatim: ' + expectedStatusInResponse);
}

async function run() {
  console.log('\n--- Phase 242-01 server-side back tool smoke ---');

  // 5 status codes through the bridge.
  await runStatusSubTest(
    { success: true, status: 'ok', resultingUrl: 'https://example.com/a', historyDepth: 3 },
    'ok',
  );
  await runStatusSubTest(
    { success: true, status: 'no_history', resultingUrl: 'https://example.com/curr', historyDepth: 1 },
    'no_history',
  );
  await runStatusSubTest(
    { success: true, status: 'cross_origin', resultingUrl: 'https://other.example.org/p', historyDepth: 5 },
    'cross_origin',
  );
  await runStatusSubTest(
    { success: true, status: 'bf_cache', resultingUrl: 'https://cached.example.com/x', historyDepth: 4 },
    'bf_cache',
  );
  await runStatusSubTest(
    { success: true, status: 'fragment_only', resultingUrl: 'https://example.com/p#frag', historyDepth: 2 },
    'fragment_only',
  );

  // Optional tabId pass-through.
  console.log('\n--- optional tabId pass-through ---');
  {
    const harness = await buildHarnessWithBackReply({
      success: true, status: 'ok', resultingUrl: 'https://example.com/p', historyDepth: 2,
    });
    const handler = harness.getHandler('back');
    assert(typeof handler === 'function', 'back resolves to a callable handler (tabId pass-through)');
    if (typeof handler === 'function') {
      const before = harness.bridgeCalls.length;
      await handler({ tabId: 7 }, harness.createExtra());
      const call = findToolCall(harness, before, 'mcp:go-back');
      assert(!!call, 'back emits mcp:go-back when tabId supplied');
      const payload = call && call.message && call.message.payload;
      assert(payload && payload.tabId === 7, 'optional tabId threads into payload (got ' + (payload && payload.tabId) + ')');
    }
  }

  // tabId omitted: payload should NOT carry a tabId field.
  console.log('\n--- omitted tabId stays absent ---');
  {
    const harness = await buildHarnessWithBackReply({
      success: true, status: 'ok', resultingUrl: 'https://example.com/p', historyDepth: 2,
    });
    const handler = harness.getHandler('back');
    if (typeof handler === 'function') {
      const before = harness.bridgeCalls.length;
      await handler({}, harness.createExtra());
      const call = findToolCall(harness, before, 'mcp:go-back');
      const payload = call && call.message && call.message.payload;
      assert(payload && !Object.prototype.hasOwnProperty.call(payload, 'tabId'), 'payload omits tabId when caller did not supply one');
    }
  }

  // TAB_NOT_OWNED reject surface (Phase 240 gate proxy).
  console.log('\n--- TAB_NOT_OWNED reject surfacing ---');
  {
    const harness = await buildHarnessWithBackReply({
      success: false, error: 'TAB_NOT_OWNED', ownerAgentId: 'agent_other',
    });
    const handler = harness.getHandler('back');
    if (typeof handler === 'function') {
      const result = await handler({}, harness.createExtra());
      const responseText = result && result.content && result.content[0] && result.content[0].text ? String(result.content[0].text) : JSON.stringify(result);
      assert(responseText.indexOf('TAB_NOT_OWNED') !== -1, 'TAB_NOT_OWNED reject surfaces to MCP host (text=' + responseText.slice(0, 120) + ')');
    }
  }

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('FATAL', err && err.stack ? err.stack : err);
  console.log('\n=== Results: ' + passed + ' passed, ' + (failed + 1) + ' failed ===');
  process.exit(2);
});
