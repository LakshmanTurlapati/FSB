/**
 * Restricted-tab MCP parity regression tests.
 * Run: npm test
 */

const fs = require('fs');
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
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'background.js'), 'utf8');

console.log('\n--- background route coverage ---');

const requiredBgTools = [
  'navigate',
  'open_tab',
  'switch_tab',
  'list_tabs',
  'go_back',
  'go_forward',
  'refresh'
];

for (const tool of requiredBgTools) {
  assert(backgroundSource.includes(`'${tool}'`), `background.js mentions ${tool} in MCP routing`);
}

assert(
  backgroundSource.includes('chrome.tabs.goBack(tab.id)'),
  'background.js routes go_back through chrome.tabs.goBack(tab.id)',
);
assert(
  backgroundSource.includes('chrome.tabs.goForward(tab.id)'),
  'background.js routes go_forward through chrome.tabs.goForward(tab.id)',
);
assert(
  backgroundSource.includes('chrome.tabs.reload(tab.id)'),
  'background.js routes refresh through chrome.tabs.reload(tab.id)',
);

console.log('\n--- restricted response contract ---');

assert(
  backgroundSource.includes("if (autoRouteAvailable) {\n    allowedRecovery.push('run_task');\n  }"),
  'buildRestrictedMCPResponse only adds run_task when autoRouteAvailable is true',
);
assert(
  backgroundSource.includes('const allowedRecovery = [\'navigate\', \'open_tab\', \'switch_tab\', \'list_tabs\'];'),
  'restricted recovery starts from the shared non-task recovery tool set',
);

console.log('\n--- mapped MCP error messaging ---');

async function run() {
  const errorsModuleUrl = pathToFileURL(path.join(repoRoot, 'mcp-server', 'build', 'errors.js')).href;
  const { mapFSBError } = await import(errorsModuleUrl);

  const routed = mapFSBError({
    success: false,
    errorCode: 'restricted_active_tab',
    pageType: 'Chrome internal page',
    currentUrl: 'chrome://newtab/',
    autoRouteAvailable: true,
  });

  const blocked = mapFSBError({
    success: false,
    errorCode: 'restricted_active_tab',
    pageType: 'Chrome internal page',
    currentUrl: 'chrome://settings/',
    autoRouteAvailable: false,
  });

  assert(
    routed.content[0].text.includes('run_task'),
    'mapFSBError includes run_task guidance for blank/new-tab restricted pages',
  );
  assert(
    !blocked.content[0].text.includes('run_task'),
    'mapFSBError omits run_task guidance for non-routable restricted pages',
  );
  assert(
    blocked.content[0].text.includes('switch_tab') && blocked.content[0].text.includes('list_tabs'),
    'mapFSBError keeps navigation recovery guidance for restricted pages',
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error('Test harness failed:', error);
  process.exit(1);
});
