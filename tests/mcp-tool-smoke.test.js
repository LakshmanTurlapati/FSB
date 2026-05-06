'use strict';

const util = require('util');
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

function assertDeepEqual(actual, expected, msg) {
  assert(util.isDeepStrictEqual(actual, expected), `${msg} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

const requiredSmokeTools = [
  'list_tabs',
  'navigate',
  'read_page',
  'get_dom_snapshot',
  'get_page_snapshot',
  'get_site_guide',
  'click',
  'start_visual_session',
  'end_visual_session',
  'run_task',
  'stop_task',
  'get_logs',
  'back',
];

async function invokeTool(harness, toolName, params = {}, extra = null) {
  const handler = harness.getHandler(toolName);
  assert(typeof handler === 'function', `${toolName} registers a callable MCP handler`);
  if (typeof handler !== 'function') return null;

  const before = harness.bridgeCalls.length;
  const result = await handler(params, extra || harness.createExtra());
  // Phase 238: a manual/visual-session/autopilot tool's first invocation
  // also triggers an 'agent:register' lazy mint via AgentScope.ensure().
  // The smoke test asserts on the TOOL's own bridge message, so skip past
  // any agent:register entries inserted into bridgeCalls during this call.
  let call = null;
  for (let i = before; i < harness.bridgeCalls.length; i++) {
    const entry = harness.bridgeCalls[i];
    if (entry && entry.message && entry.message.type === 'agent:register') continue;
    call = entry;
    break;
  }

  assert(result && Array.isArray(result.content), `${toolName} smoke returns MCP content output`);
  return call;
}

async function run() {
  const runtimeModule = await loadBuildModule('runtime.js');
  const readOnlyModule = await loadBuildModule(pathJoin('tools', 'read-only.js'));
  const manualModule = await loadBuildModule(pathJoin('tools', 'manual.js'));
  const visualSessionModule = await loadBuildModule(pathJoin('tools', 'visual-session.js'));
  const autopilotModule = await loadBuildModule(pathJoin('tools', 'autopilot.js'));
  const observabilityModule = await loadBuildModule(pathJoin('tools', 'observability.js'));
  // Phase 242 plan 02: agents.ts now exposes the 'back' tool (Plan 01 D-01).
  // Loading the module here lets the smoke test register the back handler
  // alongside the other surfaces; without this, 'back' stays in
  // requiredSmokeTools but its handler never lands in harness.handlers.
  const agentsModule = await loadBuildModule(pathJoin('tools', 'agents.js'));

  console.log('\n--- packaged runtime surface ---');
  assert(typeof runtimeModule.createRuntime === 'function', 'build/runtime.js exports createRuntime');
  assert(typeof readOnlyModule.registerReadOnlyTools === 'function', 'build/tools/read-only.js exports registerReadOnlyTools');
  assert(typeof manualModule.registerManualTools === 'function', 'build/tools/manual.js exports registerManualTools');
  assert(typeof visualSessionModule.registerVisualSessionTools === 'function', 'build/tools/visual-session.js exports registerVisualSessionTools');
  assert(typeof autopilotModule.registerAutopilotTools === 'function', 'build/tools/autopilot.js exports registerAutopilotTools');
  assert(typeof observabilityModule.registerObservabilityTools === 'function', 'build/tools/observability.js exports registerObservabilityTools');
  assert(typeof agentsModule.registerAgentTools === 'function', 'build/tools/agents.js exports registerAgentTools');

  const harness = createToolHarness({
    bridgeResponses: {
      'mcp:get-tabs': { success: true, tabs: [{ id: 7, active: true, url: 'https://example.com' }] },
      'mcp:execute-action': ({ payload }) => ({ success: true, executed: payload.tool }),
      'mcp:read-page': { success: true, content: 'Example page' },
      'mcp:get-dom': { success: true, elements: [{ ref: 'e5' }] },
      'mcp:get-page-snapshot': { success: true, snapshot: '# Example\n- e1: button "Submit"', elementCount: 1 },
      'mcp:get-site-guides': { success: true, guide: { site: 'example.com', selectors: {} } },
      'mcp:start-visual-session': ({ payload }) => ({
        success: true,
        sessionToken: 'visual_token_123',
        clientLabel: payload.clientLabel,
        tabId: 7,
      }),
      'mcp:end-visual-session': ({ payload }) => ({
        success: true,
        sessionToken: payload.sessionToken,
        cleared: true,
      }),
      'mcp:start-automation': { success: true, sessionId: 'smoke-session', status: 'started' },
      'mcp:stop-automation': { success: true, stopped: true },
      'mcp:get-logs': { success: true, logs: [] },
    },
  });

  // Phase 238 D-11: register*Tools accepts AgentScope as the 4th arg.
  // The harness's bridge.sendAndWait responds to type 'agent:register'
  // with a deterministic { agentId: 'agent_test_smoke', ... } payload.
  const agentScope = await loadAgentScope();
  readOnlyModule.registerReadOnlyTools(harness.server, harness.bridge, harness.queue, agentScope);
  manualModule.registerManualTools(harness.server, harness.bridge, harness.queue, agentScope);
  visualSessionModule.registerVisualSessionTools(harness.server, harness.bridge, harness.queue, agentScope);
  autopilotModule.registerAutopilotTools(harness.server, harness.bridge, harness.queue, agentScope);
  observabilityModule.registerObservabilityTools(harness.server, harness.bridge, harness.queue, agentScope);
  // Phase 242 D-01: registerAgentTools registers the 'back' MCP tool. Loaded
  // last so the smoke test's registered-handlers assertion (line 118) sees it.
  agentsModule.registerAgentTools(harness.server, harness.bridge, harness.queue, agentScope);

  console.log('\n--- registered smoke tools ---');
  for (const toolName of requiredSmokeTools) {
    assert(harness.handlers.has(toolName), `registered handlers include ${toolName}`);
  }

  console.log('\n--- bridge message families ---');
  const listTabsCall = await invokeTool(harness, 'list_tabs');
  assertDeepEqual(
    listTabsCall && listTabsCall.message,
    { type: 'mcp:get-tabs', payload: {} },
    'list_tabs routes through mcp:get-tabs with empty payload',
  );

  const navigateCall = await invokeTool(harness, 'navigate', { url: 'https://example.com' });
  assertDeepEqual(
    navigateCall && navigateCall.message,
    { type: 'mcp:execute-action', payload: { tool: 'navigate', params: { url: 'https://example.com' }, agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' } },
    'navigate routes through mcp:execute-action with navigate payload (Phase 238 includes agentId; Phase 240 strengthens with ownershipToken)',
  );

  const readPageCall = await invokeTool(harness, 'read_page', { full: true });
  assertDeepEqual(
    readPageCall && readPageCall.message,
    { type: 'mcp:read-page', payload: { full: true } },
    'read_page routes through mcp:read-page with full flag',
  );

  const domSnapshotCall = await invokeTool(harness, 'get_dom_snapshot', { maxElements: 5 });
  assertDeepEqual(
    domSnapshotCall && domSnapshotCall.message,
    { type: 'mcp:get-dom', payload: { maxElements: 5 } },
    'get_dom_snapshot routes through mcp:get-dom with maxElements payload',
  );

  const pageSnapshotCall = await invokeTool(harness, 'get_page_snapshot');
  assertDeepEqual(
    pageSnapshotCall && pageSnapshotCall.message,
    { type: 'mcp:get-page-snapshot', payload: {} },
    'get_page_snapshot routes through mcp:get-page-snapshot with empty payload',
  );

  const siteGuideCall = await invokeTool(harness, 'get_site_guide', { domain: 'example.com' });
  assertDeepEqual(
    siteGuideCall && siteGuideCall.message,
    { type: 'mcp:get-site-guides', payload: { domain: 'example.com', url: 'example.com' } },
    'get_site_guide routes through mcp:get-site-guides with domain payload',
  );

  const clickCall = await invokeTool(harness, 'click', { selector: 'e5' });
  assertDeepEqual(
    clickCall && clickCall.message,
    { type: 'mcp:execute-action', payload: { tool: 'click', params: { selector: 'e5' }, agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' } },
    'click routes through mcp:execute-action with click payload (Phase 238 includes agentId; Phase 240 strengthens with ownershipToken)',
  );

  const startVisualSessionCall = await invokeTool(harness, 'start_visual_session', {
    client: ' codex ',
    task: 'Smoke test the visual lifecycle',
    detail: 'Preparing overlay',
  });
  assertDeepEqual(
    startVisualSessionCall && startVisualSessionCall.message,
    {
      type: 'mcp:start-visual-session',
      payload: {
        clientLabel: 'Codex',
        task: 'Smoke test the visual lifecycle',
        detail: 'Preparing overlay',
        agentId: 'agent_test_smoke',
        ownershipToken: 'token_test_smoke',
      },
    },
    'start_visual_session routes through mcp:start-visual-session with canonical client label (Phase 238 includes agentId; Phase 240 strengthens with ownershipToken)',
  );

  const endVisualSessionCall = await invokeTool(harness, 'end_visual_session', {
    session_token: 'visual_token_123',
    reason: 'ended',
  });
  assertDeepEqual(
    endVisualSessionCall && endVisualSessionCall.message,
    {
      type: 'mcp:end-visual-session',
      payload: { sessionToken: 'visual_token_123', reason: 'ended', agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' },
    },
    'end_visual_session routes through mcp:end-visual-session with token payload (Phase 238 includes agentId; Phase 240 strengthens with ownershipToken)',
  );

  const runTaskCall = await invokeTool(harness, 'run_task', { task: 'Smoke test the browser bridge' }, harness.createExtra({ progressToken: 'smoke-progress' }));
  assertDeepEqual(
    runTaskCall && runTaskCall.message,
    { type: 'mcp:start-automation', payload: { task: 'Smoke test the browser bridge', agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' } },
    'run_task routes through mcp:start-automation with task payload (Phase 238 includes agentId; Phase 240 strengthens with ownershipToken)',
  );

  const stopTaskCall = await invokeTool(harness, 'stop_task');
  assertDeepEqual(
    stopTaskCall && stopTaskCall.message,
    { type: 'mcp:stop-automation', payload: { agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' } },
    'stop_task routes through mcp:stop-automation with agentId payload (Phase 238 includes agentId; Phase 240 strengthens with ownershipToken)',
  );

  const getLogsCall = await invokeTool(harness, 'get_logs', { sessionId: 'smoke-session', count: 10 });
  assertDeepEqual(
    getLogsCall && getLogsCall.message,
    { type: 'mcp:get-logs', payload: { sessionId: 'smoke-session', count: 10 } },
    'get_logs routes through mcp:get-logs with observability payload',
  );

  // Phase 242 plan 02: 'back' routes through mcp:go-back. Bridge response
  // surfaces the canonical 5-status envelope; agentScope captures the
  // (optional) ownershipToken via captureOwnershipToken on success.
  const backCall = await invokeTool(harness, 'back');
  assertDeepEqual(
    backCall && backCall.message,
    { type: 'mcp:go-back', payload: { agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' } },
    'back routes through mcp:go-back with agentId + ownershipToken (Phase 242 D-01)',
  );

  console.log('\n--- agent:register lazy-mint invariant (Phase 238 D-13.4) ---');
  const registerCalls = harness.bridgeCalls.filter((c) => c.message && c.message.type === 'agent:register');
  assert(registerCalls.length === 1, 'agent:register must fire exactly once across all tool invocations; saw ' + registerCalls.length);

  console.log('\n--- queue coverage ---');
  for (const toolName of requiredSmokeTools.filter((name) => name !== 'stop_task')) {
    assert(harness.queueCalls.includes(toolName), `${toolName} passes through the shared queue surface`);
  }
  assert(!harness.queueCalls.includes('stop_task'), 'stop_task stays direct so cancellation does not wait behind queued work');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

function pathJoin(...parts) {
  return parts.join('/');
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
