'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

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

function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg} (expected: ${expected}, got: ${actual})`);
}

const repoRoot = path.resolve(__dirname, '..');

function makeSnapshot(overrides = {}) {
  return {
    checkedAt: '2026-04-23T12:00:00.000Z',
    bridgeUrl: 'ws://localhost:7225',
    bridgeMode: 'hub',
    extensionConnected: true,
    bridgeTopology: {
      instanceId: 'diag-test',
      mode: 'hub',
      hubConnected: true,
      extensionConnected: true,
      relayCount: 0,
      pendingRequestCount: 0,
      activeHubInstanceId: 'diag-test',
      lastExtensionHeartbeatAt: Date.now() - 1500,
      lastDisconnectReason: null,
    },
    hubConnected: true,
    relayCount: 0,
    activeHubInstanceId: 'diag-test',
    lastExtensionHeartbeatAt: Date.now() - 1500,
    lastDisconnectReason: null,
    packageVersion: '0.6.0',
    serverJsonVersion: '0.6.0',
    versionParityOk: true,
    activeTab: {
      id: 42,
      url: 'https://example.com',
      title: 'Example',
      windowId: 1,
      restricted: false,
      pageType: 'Web page',
    },
    contentScript: {
      ready: true,
      portConnected: true,
      lastHeartbeatAgeMs: 1000,
      lastReadyAt: Date.now() - 1000,
      lastReadyUrl: 'https://example.com',
      readinessSource: 'port',
    },
    extensionConfig: {
      modelProvider: 'openai',
      modelName: 'gpt-5.4',
    },
    tabsSummary: {
      totalTabs: 4,
      activeTabId: 42,
    },
    bridgeClient: {
      status: 'connected',
    },
    probeNotes: [],
    diagnosticLayer: 'healthy',
    diagnosticWhy: 'Bridge topology, extension attach, config, and content-script probes all look healthy.',
    nextAction: 'Retry the MCP command.',
    error: undefined,
    ...overrides,
  };
}

function assertOrdered(text, labels, msg) {
  let lastIndex = -1;
  for (const label of labels) {
    const index = text.indexOf(label);
    assert(index >= 0, `${msg}: includes ${label}`);
    assert(index > lastIndex, `${msg}: ${label} appears in order`);
    lastIndex = index;
  }
}

async function run() {
  const diagnosticsUrl = pathToFileURL(path.join(repoRoot, 'mcp', 'build', 'diagnostics.js')).href;
  const indexUrl = pathToFileURL(path.join(repoRoot, 'mcp', 'build', 'index.js')).href;
  const diagnostics = await import(diagnosticsUrl);
  const indexModule = await import(indexUrl);

  const cases = [
    ['package', makeSnapshot({ versionParityOk: false, packageVersion: '0.5.2', serverJsonVersion: '0.5.2' }), 'package'],
    ['config', makeSnapshot({ probeNotes: [{ scope: 'config', status: 'error', message: 'config probe failed' }] }), 'config'],
    ['bridge', makeSnapshot({
      bridgeMode: 'relay',
      hubConnected: false,
      bridgeTopology: { ...makeSnapshot().bridgeTopology, mode: 'relay', hubConnected: false },
    }), 'bridge'],
    ['extension', makeSnapshot({
      extensionConnected: false,
      bridgeTopology: { ...makeSnapshot().bridgeTopology, extensionConnected: false },
    }), 'extension'],
    ['content_script', makeSnapshot({
      contentScript: {
        ready: false,
        portConnected: false,
        lastHeartbeatAgeMs: null,
        lastReadyAt: null,
        lastReadyUrl: null,
        readinessSource: null,
      },
    }), 'content_script'],
    ['tool_routing', makeSnapshot({
      probeNotes: [{ scope: 'diagnostics', status: 'error', message: 'Missing direct MCP route', errorCode: 'mcp_route_unavailable' }],
      contentScript: {
        ready: true,
        portConnected: true,
        lastHeartbeatAgeMs: 1000,
        lastReadyAt: Date.now() - 1000,
        lastReadyUrl: 'https://example.com',
        readinessSource: 'port',
      },
    }), 'tool_routing'],
    ['healthy', makeSnapshot(), 'healthy'],
  ];

  console.log('\n--- doctor classification ---');
  for (const [label, snapshot, expected] of cases) {
    const actual = diagnostics.classifyDoctorLayer(snapshot);
    assertEqual(actual, expected, `doctor classification selects ${expected} for ${label} fixture`);
  }

  console.log('\n--- watch formatting ---');
  const watchText = indexModule.formatWatchSnapshot(makeSnapshot());
  assertOrdered(
    watchText,
    ['Mode', 'Ext', 'Heartbeat', 'Hub', 'Relays', 'Disconnect', 'Layer'],
    'watch formatter field order',
  );

  console.log('\n--- doctor formatting ---');
  const packageDoctor = indexModule.formatDoctor(diagnostics.applyDiagnosticClassification(cases[0][1]));
  assert(packageDoctor.includes('Detected:'), 'doctor output includes Detected:');
  assert(packageDoctor.includes('Why:'), 'doctor output includes Why:');
  assert(packageDoctor.includes('Next action:'), 'doctor output includes Next action:');
  assert(packageDoctor.includes('Package / version parity'), 'doctor output includes package label');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
