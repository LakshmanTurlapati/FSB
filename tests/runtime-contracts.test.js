/**
 * Regression checks for narrowed runtime/emitter contracts.
 * Run: node tests/runtime-contracts.test.js
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

function readRepoFile() {
  return fs.readFileSync(path.join(__dirname, '..', ...arguments), 'utf8');
}

const backgroundSource = readRepoFile('background.js');
const stateEmitterSource = readRepoFile('ai', 'state-emitter.js');
const popupSource = readRepoFile('ui', 'popup.js');
const sidepanelSource = readRepoFile('ui', 'sidepanel.js');
const dashboardSource = readRepoFile('showcase', 'js', 'dashboard.js');
const wsClientSource = readRepoFile('ws', 'ws-client.js');

console.log('\n--- background contract cleanup tests ---');

// Phase 166 narrowed createSessionHooks to drop the emitter passthrough; a
// later refactor moved progress hooks to a sendSessionStatus callback and
// removed SessionStateEmitter from background.js entirely. These regression
// asserts lock in the further-narrowed contract.
assert(!backgroundSource.includes('emitter: sessionHooks.emitter'), 'background no longer passes sessionHooks.emitter into runAgentLoop');
assert(!/new\s+SessionStateEmitter\s*\(/.test(backgroundSource), 'background no longer instantiates SessionStateEmitter');
assert(backgroundSource.includes('createToolProgressHook(function'), 'tool progress hook is wired to a sendSessionStatus callback');
assert(backgroundSource.includes('sendSessionStatus(tabId, statusData)'), 'progress hook callback delegates to sendSessionStatus');
assert(backgroundSource.includes('function createSessionHooks(sessionId)'), 'createSessionHooks signature preserved');

console.log('\n--- direct consumer boundary tests ---');

// popup migrated off sessionStateEvent to dedicated statusUpdate /
// automationComplete / automationError channels; sidepanel is still the only
// direct sessionStateEvent consumer.
assert(!popupSource.includes("case 'sessionStateEvent':"), 'popup no longer consumes sessionStateEvent directly');
assert(popupSource.includes("case 'statusUpdate':") || popupSource.includes("case 'automationComplete':"), 'popup consumes statusUpdate / automationComplete channels');
assert(sidepanelSource.includes("case 'sessionStateEvent':"), 'sidepanel still consumes sessionStateEvent');
assert(!dashboardSource.includes('sessionStateEvent'), 'dashboard does not consume sessionStateEvent directly');
assert(!wsClientSource.includes('sessionStateEvent'), 'ws client does not consume or relay sessionStateEvent directly');

console.log('\n--- state-emitter documentation tests ---');

assert(stateEmitterSource.includes('popup and sidepanel'), 'state-emitter docs name popup and sidepanel as direct consumers');
assert(
  stateEmitterSource.includes('Dashboard state') && stateEmitterSource.includes('uses separate status and relay channels.'),
  'state-emitter docs explain dashboard state uses separate channels'
);
assert(!stateEmitterSource.includes('sidepanel, popup, and\ndashboard listeners receive delta updates without polling'), 'state-emitter no longer claims dashboard receives sessionStateEvent directly');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
