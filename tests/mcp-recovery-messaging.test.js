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

const repoRoot = path.resolve(__dirname, '..');
const expectedRecoveryTools = ['navigate', 'open_tab', 'switch_tab', 'list_tabs'];

function assertBlock(text, label) {
  assert(text.includes('Detected:'), `${label} includes Detected:`);
  assert(text.includes('Why:'), `${label} includes Why:`);
  assert(text.includes('Next action:'), `${label} includes Next action:`);
}

async function run() {
  const errorsModuleUrl = pathToFileURL(path.join(repoRoot, 'mcp', 'build', 'errors.js')).href;
  const { mapFSBError } = await import(errorsModuleUrl);

  console.log('\n--- layer-aware recovery messaging ---');

  const fixtures = [
    {
      label: 'extension_not_connected',
      input: { success: false, errorCode: 'extension_not_connected' },
      checks(text) {
        assert(text.includes('Extension attachment') || text.includes('Bridge ownership'), 'extension fixture names attachment or bridge layer');
        assert(!text.includes('restart everything'), 'extension fixture avoids restart everything');
      },
    },
    {
      label: 'content_script_failed',
      input: { success: false, errorCode: 'content_script_failed', currentUrl: 'https://example.com' },
      checks(text) {
        assert(text.includes('Content script availability'), 'content-script fixture names content script layer');
        assert(!text.includes('restart everything'), 'content-script fixture avoids restart everything');
      },
    },
    {
      label: 'restricted_active_tab',
      input: {
        success: false,
        errorCode: 'restricted_active_tab',
        pageType: 'Chrome internal page',
        currentUrl: 'chrome://newtab/',
        validRecoveryTools: expectedRecoveryTools,
      },
      checks(text) {
        assert(text.includes('Restricted page'), 'restricted fixture names restricted page layer');
        for (const tool of expectedRecoveryTools) {
          assert(text.includes(tool), `restricted fixture mentions ${tool}`);
        }
        assert(!text.includes('run_task'), 'restricted fixture omits run_task');
      },
    },
    {
      label: 'mcp_route_unavailable',
      input: {
        success: false,
        errorCode: 'mcp_route_unavailable',
        tool: 'read_page',
        routeFamily: 'message',
        recoveryHint: 'Update the server/extension pair.',
      },
      checks(text) {
        assert(text.includes('Tool routing'), 'tool-routing fixture names tool routing layer');
        assert(text.includes('read_page'), 'tool-routing fixture mentions tool name');
        assert(text.includes('message'), 'tool-routing fixture mentions routeFamily');
      },
    },
    {
      label: 'navigation_failed',
      input: {
        success: false,
        errorCode: 'navigation_failed',
        url: 'https://example.com',
      },
      checks(text) {
        assert(text.includes('Page navigation'), 'navigation fixture names page navigation layer');
        assert(text.includes('https://example.com'), 'navigation fixture mentions URL');
      },
    },
    {
      // Phase 225-01: replace the misleading "Page navigation / Refresh page state"
      // fallback with an accurate Session lookup diagnostic when get_session_detail
      // or stop_task cannot resolve the session id in either active or historical
      // stores.
      label: 'session_not_found',
      input: {
        success: false,
        errorCode: 'session_not_found',
        tool: 'get_session_detail',
        routeFamily: 'observability',
        error: 'Session session_xyz not found in active or historical sessions',
        recoveryHint: 'Use list_sessions to see historical sessions, or get_task_status to check for an active session.',
      },
      checks(text) {
        assert(text.includes('Session lookup'), 'session_not_found fixture names Session lookup layer');
        assert(text.includes('list_sessions'), 'session_not_found fixture suggests list_sessions');
        assert(text.includes('get_task_status'), 'session_not_found fixture suggests get_task_status');
        assert(!text.includes('Page navigation'), 'session_not_found fixture does NOT use the misleading Page navigation label');
        assert(!text.includes('Refresh page state'), 'session_not_found fixture does NOT use the misleading Refresh page state hint');
      },
    },
  ];

  for (const fixture of fixtures) {
    const mapped = mapFSBError(fixture.input);
    const text = mapped.content[0].text;
    assertBlock(text, fixture.label);
    fixture.checks(text);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
