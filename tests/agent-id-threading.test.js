'use strict';

// Phase 238 Plan 03 D-13.4: integration test asserting that agent:register
// fires exactly ONCE across N parallel tool invocations from the same
// MCP process, and that all N execute-action payloads share the same
// agentId (the lazy-mint singleton property is observable on the wire).
//
// This is the load-bearing check on the cached-promise race control
// (CONTEXT.md D-03). A regression that double-mints would surface here
// before it could ship to production.
//
// Phase 246 Plan 03 Task 3: 2 additional cases extend coverage to the
// read-only.ts overturn (Phase 238 D-06 -> Phase 246 D-02). read-only.ts
// previously void-cast agentScope; it now threads agentId into every read
// tool bridge payload AND forwards optional tab_id when the caller
// supplies it.

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

async function testManualNavigateAgentIdThreading() {
  const manualModule = await loadBuildModule('tools/manual.js');
  const agentScope = await loadAgentScope();

  const harness = createToolHarness({
    bridgeResponses: {
      'mcp:execute-action': ({ payload }) => ({ success: true, executed: payload.tool }),
    },
  });

  manualModule.registerManualTools(harness.server, harness.bridge, harness.queue, agentScope);

  const navigate = harness.getHandler('navigate');
  assert(typeof navigate === 'function', 'navigate handler is registered on the harness');
  if (typeof navigate !== 'function') {
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(1);
  }

  const N = 5;
  const promises = [];
  for (let i = 0; i < N; i++) {
    promises.push(navigate({ url: 'https://example.test/page' + i }, harness.createExtra()));
  }
  const results = await Promise.all(promises);
  assert(results.length === N, 'all ' + N + ' parallel navigate invocations resolved');

  // Lazy-mint property: exactly ONE agent:register on the wire across N invocations.
  const registerCalls = harness.bridgeCalls.filter(
    (c) => c && c.message && c.message.type === 'agent:register',
  );
  assert(
    registerCalls.length === 1,
    'agent:register fires exactly ONCE across ' + N + ' parallel invocations; observed ' + registerCalls.length,
  );

  // Every navigate invocation lands on the bridge as mcp:execute-action.
  const execCalls = harness.bridgeCalls.filter(
    (c) => c && c.message && c.message.type === 'mcp:execute-action',
  );
  assert(
    execCalls.length === N,
    'expected ' + N + ' mcp:execute-action calls, got ' + execCalls.length,
  );

  // All N execute-action payloads carry the SAME agentId (singleton property).
  const observedIds = new Set(
    execCalls.map((c) => c && c.message && c.message.payload && c.message.payload.agentId),
  );
  assert(
    observedIds.size === 1,
    'all ' + N + ' execute-action payloads share one agentId; got ' + observedIds.size + ' distinct value(s)',
  );
  assert(
    observedIds.has('agent_test_smoke'),
    'observed agentId equals the harness-minted deterministic value (agent_test_smoke)',
  );

  console.log(
    '\nagent-id-threading.test.js manual.ts: ' +
      (failed === 0 ? 'PASS' : 'FAIL') +
      ' (N=' +
      N +
      ' parallel invocations -> ' +
      registerCalls.length +
      ' register + ' +
      execCalls.length +
      ' execute-actions, ' +
      observedIds.size +
      ' distinct agentId)',
  );
}

// Phase 246 Plan 03 Task 3 -- Case A: read-only.ts threads agentId per the
// Phase 238 D-06 -> Phase 246 D-02 overturn. read_page with NO tab_id MUST
// send agentId in the bridge payload.
async function testReadOnlyAgentIdThreading() {
  const readOnlyModule = await loadBuildModule('tools/read-only.js');
  const agentScope = await loadAgentScope();

  const harness = createToolHarness({
    bridgeResponses: {
      'mcp:read-page': () => ({ success: true, content: 'OK' }),
      'mcp:get-dom': () => ({ success: true, elements: [] }),
      'mcp:execute-action': () => ({ success: true }),
    },
  });

  readOnlyModule.registerReadOnlyTools(harness.server, harness.bridge, harness.queue, agentScope);

  const readPage = harness.getHandler('read_page');
  assert(typeof readPage === 'function', 'read_page handler is registered');
  if (typeof readPage !== 'function') return;

  await readPage({});

  const readPageCalls = harness.bridgeCalls.filter(
    (c) => c && c.message && c.message.type === 'mcp:read-page',
  );
  assert(readPageCalls.length === 1, 'read_page sent exactly 1 mcp:read-page bridge message');
  if (readPageCalls.length !== 1) return;
  const payload = readPageCalls[0].message.payload;
  assert(typeof payload.agentId === 'string', 'mcp:read-page payload contains agentId (Phase 246 D-02 overturn)');
  assert(payload.agentId === 'agent_test_smoke', 'agentId is the harness-minted deterministic value');
}

// Phase 246 Plan 03 Task 3 -- Case B: read_page with explicit tab_id forwards
// it AND threads agentId. The MESSAGE_TYPE_MAP entry for read_page in
// read-only.ts spreads p.tab_id when defined; the wrapper also adds agentId
// at the top of the payload.
async function testReadOnlyTabIdForwarded() {
  const readOnlyModule = await loadBuildModule('tools/read-only.js');
  const agentScope = await loadAgentScope();

  const harness = createToolHarness({
    bridgeResponses: {
      'mcp:read-page': () => ({ success: true, content: 'OK' }),
    },
  });

  readOnlyModule.registerReadOnlyTools(harness.server, harness.bridge, harness.queue, agentScope);

  const readPage = harness.getHandler('read_page');
  assert(typeof readPage === 'function', 'read_page handler is registered (Case B)');
  if (typeof readPage !== 'function') return;

  await readPage({ tab_id: 42 });

  const readPageCalls = harness.bridgeCalls.filter(
    (c) => c && c.message && c.message.type === 'mcp:read-page',
  );
  assert(readPageCalls.length === 1, 'exactly 1 read_page call (Case B)');
  if (readPageCalls.length !== 1) return;
  const payload = readPageCalls[0].message.payload;
  assert(payload.tab_id === 42, 'tab_id forwarded into bridge payload (Phase 246 D-02 messageBuilder)');
  assert(typeof payload.agentId === 'string', 'agentId still threaded alongside tab_id');
}

async function run() {
  await testManualNavigateAgentIdThreading();
  await testReadOnlyAgentIdThreading();
  await testReadOnlyTabIdForwarded();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: integration test crashed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
