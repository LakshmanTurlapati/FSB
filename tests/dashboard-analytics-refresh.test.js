/**
 * Tests for dashboard analytics refresh source contracts.
 * Run: node tests/dashboard-analytics-refresh.test.js
 */

const fs = require('fs');
const path = require('path');

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

console.log('\n--- dashboard analytics refresh contracts ---');

const optionsSource = fs.readFileSync(path.join(__dirname, '../extension/ui/options.js'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(__dirname, '../extension/utils/analytics.js'), 'utf8');

assert(
  optionsSource.includes('analyticsNeedsRefresh: false'),
  'dashboardState tracks deferred analytics refresh state'
);

assert(
  /async function refreshAnalyticsDashboard\(\)/.test(optionsSource),
  'refreshAnalyticsDashboard is async'
);

assert(
  optionsSource.includes('await analytics.initPromise'),
  'refreshAnalyticsDashboard awaits analytics initialization'
);

assert(
  /if \(dashboardState\.currentSection !== 'dashboard'\)\s*\{\s*dashboardState\.analyticsNeedsRefresh = true;\s*return;\s*\}/.test(optionsSource),
  'storage listener marks analytics refresh dirty when dashboard is off-screen'
);

assert(
  /if \(message\.type === 'ANALYTICS_UPDATE'\)\s*\{\s*if \(dashboardState\.currentSection === 'dashboard'\)\s*\{\s*refreshAnalyticsDashboard\(\);\s*\} else \{\s*dashboardState\.analyticsNeedsRefresh = true;\s*\}\s*\}/s.test(optionsSource),
  'runtime message listener defers off-screen ANALYTICS_UPDATE refreshes'
);

assert(
  /if \(sectionId === 'dashboard' && dashboardState\.analyticsNeedsRefresh\)\s*\{\s*dashboardState\.analyticsNeedsRefresh = false;\s*refreshAnalyticsDashboard\(\);/s.test(optionsSource),
  'dashboard section switch consumes and clears the analytics dirty flag'
);

assert(
  analyticsSource.includes("document.querySelector('#totalTokensToday')?.nextElementSibling"),
  'analytics labels guard missing total tokens element'
);

assert(
  analyticsSource.includes("document.querySelector('#totalCostToday')?.nextElementSibling"),
  'analytics labels guard missing total cost element'
);

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
