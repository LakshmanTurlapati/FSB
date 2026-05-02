'use strict';

/**
 * Restricted-tab MCP parity regression tests.
 * Run: npm --prefix mcp run build && node tests/mcp-restricted-tab.test.js
 */

const path = require('path');
const util = require('util');
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

function assertDeepEqual(actual, expected, msg) {
  assert(util.isDeepStrictEqual(actual, expected), `${msg} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

const repoRoot = path.resolve(__dirname, '..');
const dispatcherRelativePath = 'extension/ws/mcp-tool-dispatcher.js';
const expectedRecoveryTools = ['navigate', 'open_tab', 'switch_tab', 'list_tabs'];
const restrictedUrls = [
  'chrome://newtab/',
  'about:blank',
  'chrome://settings/',
  'chrome://extensions/',
  'chrome://history/',
  'chrome://downloads/'
];

function createFailingContentDispatch(label) {
  return async () => {
    throw new Error(`${label} attempted content-script dispatch`);
  };
}

function createChromeMock(currentUrl) {
  const activeTab = {
    id: 19901,
    url: currentUrl,
    title: `Restricted ${currentUrl}`,
    active: true,
    windowId: 1
  };

  return {
    runtime: {
      id: 'phase-199-test-extension',
      lastError: null
    },
    tabs: {
      async query(queryInfo) {
        if (queryInfo && queryInfo.active && queryInfo.currentWindow) {
          return [activeTab];
        }
        return [activeTab];
      },
      sendMessage: () => {
        throw new Error('chrome.tabs.sendMessage attempted content-script dispatch');
      }
    }
  };
}

function installRestrictedTabGlobals(currentUrl) {
  const chrome = createChromeMock(currentUrl);
  global.chrome = chrome;
  global.sendMessageWithRetry = createFailingContentDispatch('sendMessageWithRetry');
  global.ensureContentScriptInjected = createFailingContentDispatch('ensureContentScriptInjected');

  return {
    chrome,
    tab: {
      id: 19901,
      url: currentUrl,
      title: `Restricted ${currentUrl}`,
      active: true,
      windowId: 1
    },
    client: {
      async _getActiveTab() {
        return {
          id: 19901,
          url: currentUrl,
          title: `Restricted ${currentUrl}`,
          active: true,
          windowId: 1
        };
      },
      _sendToContentScript: createFailingContentDispatch('client._sendToContentScript')
    }
  };
}

function loadDispatcher() {
  const dispatcherPath = path.join(repoRoot, dispatcherRelativePath);
  try {
    return require(dispatcherPath);
  } catch (error) {
    assert(false, `Missing executable dispatcher module ${dispatcherRelativePath}: ${error.code || error.message}`);
    return null;
  }
}

function assertRestrictedResponse(response, url, routeLabel) {
  assert(response && response.errorCode === 'restricted_active_tab', `${routeLabel} on ${url} returns errorCode restricted_active_tab`);
  assertDeepEqual(response?.validRecoveryTools, expectedRecoveryTools, `${routeLabel} on ${url} exposes navigation-only validRecoveryTools`);
  assert(!JSON.stringify(response || {}).includes('run_task'), `${routeLabel} on ${url} does not contain run_task`);
  assert(typeof response?.currentUrl === 'string' && response.currentUrl === url, `${routeLabel} on ${url} preserves currentUrl`);
  assert(typeof response?.pageType === 'string' && response.pageType.length > 0, `${routeLabel} on ${url} includes pageType`);
}

async function callRestrictedRoute(dispatcher, url, type, payload) {
  const harness = installRestrictedTabGlobals(url);
  return dispatcher.dispatchMcpMessageRoute({
    type,
    payload,
    client: harness.client,
    mcpMsgId: `phase199-${type}-${url}`
  });
}

async function runDispatcherRouteCases(dispatcher) {
  console.log('\n--- restricted dispatcher route contract ---');

  if (!dispatcher) return;

  const {
    dispatchMcpMessageRoute,
    buildRestrictedMcpResponse,
    MCP_NAVIGATION_RECOVERY_TOOLS
  } = dispatcher;

  assert(typeof dispatchMcpMessageRoute === 'function', 'dispatchMcpMessageRoute export exists');
  assert(typeof buildRestrictedMcpResponse === 'function', 'buildRestrictedMcpResponse export exists');
  assertDeepEqual(MCP_NAVIGATION_RECOVERY_TOOLS, expectedRecoveryTools, 'MCP_NAVIGATION_RECOVERY_TOOLS is navigation/tab-only');

  if (typeof dispatchMcpMessageRoute !== 'function') return;

  let firstRouteResponse = null;
  for (const currentUrl of restrictedUrls) {
    const readResponse = await callRestrictedRoute(dispatcher, currentUrl, 'mcp:read-page', { full: true });
    if (!firstRouteResponse) firstRouteResponse = readResponse;
    assertRestrictedResponse(readResponse, currentUrl, 'mcp:read-page');

    const domResponse = await callRestrictedRoute(dispatcher, currentUrl, 'mcp:get-dom', { maxElements: 50 });
    assertRestrictedResponse(domResponse, currentUrl, 'mcp:get-dom');
  }

  if (typeof buildRestrictedMcpResponse === 'function') {
    const direct = buildRestrictedMcpResponse({
      currentUrl: 'chrome://newtab/',
      pageType: 'Chrome internal page',
      tool: 'read_page',
      error: new Error('Content scripts are blocked on browser pages')
    });

    assertRestrictedResponse(direct, 'chrome://newtab/', 'buildRestrictedMcpResponse');

    if (firstRouteResponse) {
      assertDeepEqual(
        direct.validRecoveryTools,
        firstRouteResponse.validRecoveryTools,
        'buildRestrictedMcpResponse helper validRecoveryTools match dispatcher route response',
      );
    }
  }
}

async function runErrorMapperCase() {
  console.log('\n--- mapped MCP error messaging ---');

  const errorsModuleUrl = pathToFileURL(path.join(repoRoot, 'mcp', 'build', 'errors.js')).href;
  const { mapFSBError } = await import(errorsModuleUrl);

  const mapped = mapFSBError({
    success: false,
    errorCode: 'restricted_active_tab',
    pageType: 'Chrome internal page',
    currentUrl: 'chrome://newtab/',
    validRecoveryTools: expectedRecoveryTools
  });

  const text = mapped.content[0].text;
  for (const tool of expectedRecoveryTools) {
    assert(text.includes(tool), `mapFSBError includes ${tool} recovery guidance`);
  }
  assert(!text.includes('run_task'), 'mapFSBError omits run_task from restricted recovery guidance');
}

async function run() {
  const dispatcher = loadDispatcher();
  await runDispatcherRouteCases(dispatcher);
  await runErrorMapperCase();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
