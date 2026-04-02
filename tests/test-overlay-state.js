/**
 * Tests for overlay state normalization and stale-message handling.
 * Run: node tests/test-overlay-state.js
 */

const overlayStateUtils = require('../utils/overlay-state.js');

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

console.log('\n--- buildOverlayState generic automation ---');

const genericState = overlayStateUtils.buildOverlayState({
  phase: 'analyzing',
  taskName: 'Find the pricing page and summarize it',
  iteration: 3,
  maxIterations: 20
}, null);

assertEqual(genericState.lifecycle, 'running', 'generic lifecycle is running');
assertEqual(genericState.phase, 'analyzing', 'generic phase remains analyzing');
assertEqual(genericState.progress.mode, 'indeterminate', 'generic automation is indeterminate');

console.log('\n--- explicit progress wins ---');

const explicitState = overlayStateUtils.buildOverlayState({
  phase: 'acting',
  progressPercent: 42,
  statusText: 'Clicking submit'
}, null);

assertEqual(explicitState.progress.mode, 'determinate', 'explicit progress is determinate');
assertEqual(explicitState.progress.percent, 42, 'explicit progress percent is preserved');
assertEqual(explicitState.progress.label, '42%', 'explicit progress label is derived');

console.log('\n--- multi-site progress uses completed companies ---');

const multiSiteState = overlayStateUtils.buildOverlayState({
  phase: 'analyzing',
  taskSummary: 'Job search: 3/4 companies'
}, {
  multiSite: {
    companyList: ['A', 'B', 'C', 'D'],
    currentIndex: 2
  }
});

assertEqual(multiSiteState.progress.mode, 'determinate', 'multi-site progress is determinate');
assertEqual(multiSiteState.progress.percent, 50, 'multi-site percent uses completed companies only');
assertEqual(multiSiteState.progress.label, '3/4 companies', 'multi-site label shows current company');

console.log('\n--- sheets progress uses rows, formatting is indeterminate ---');

const sheetsDataEntryState = overlayStateUtils.buildOverlayState({
  phase: 'sheets-entry'
}, {
  sheetsData: {
    totalRows: 10,
    rowsWritten: 3
  }
});

assertEqual(sheetsDataEntryState.progress.mode, 'determinate', 'sheets data entry is determinate');
assertEqual(sheetsDataEntryState.progress.percent, 30, 'sheets data entry uses row ratio');
assertEqual(sheetsDataEntryState.progress.label, '3/10 rows', 'sheets data entry label shows row counts');

const sheetsFormattingState = overlayStateUtils.buildOverlayState({
  phase: 'sheets-formatting'
}, {
  sheetsData: {
    totalRows: 10,
    rowsWritten: 10,
    formattingPhase: true,
    formattingComplete: false
  }
});

assertEqual(sheetsFormattingState.phase, 'writing', 'sheets formatting normalizes to writing phase');
assertEqual(sheetsFormattingState.progress.mode, 'indeterminate', 'sheets formatting is indeterminate');
assertEqual(sheetsFormattingState.progress.label, 'Formatting', 'sheets formatting uses explicit label');

console.log('\n--- final state normalization ---');

const finalState = overlayStateUtils.buildOverlayState({
  phase: 'complete',
  statusText: 'Finished successfully'
}, null);

assertEqual(finalState.lifecycle, 'final', 'complete phase maps to final lifecycle');
assertEqual(finalState.result, 'success', 'complete phase maps to success result');
assertEqual(finalState.progress.percent, 100, 'final success shows 100 percent');

console.log('\n--- stale message handling ---');

assert(
  overlayStateUtils.shouldApplyOverlayState(
    { sessionToken: 'current', version: 4, lifecycle: 'running' },
    { sessionToken: 'older', version: 7, lifecycle: 'cleared' }
  ) === false,
  'clear for a different session token is ignored'
);

assert(
  overlayStateUtils.shouldApplyOverlayState(
    { sessionToken: 'same', version: 4, lifecycle: 'running' },
    { sessionToken: 'same', version: 3, lifecycle: 'running' }
  ) === false,
  'older version for same token is ignored'
);

assert(
  overlayStateUtils.shouldApplyOverlayState(
    { sessionToken: 'same', version: 4, lifecycle: 'running' },
    { sessionToken: 'same', version: 5, lifecycle: 'final' }
  ) === true,
  'newer version for same token is applied'
);

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
