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

assert(!backgroundSource.includes('emitter: sessionHooks.emitter'), 'background no longer passes sessionHooks.emitter into runAgentLoop');
assert(backgroundSource.includes('var emitter = new SessionStateEmitter();'), 'createSessionHooks still instantiates SessionStateEmitter');
assert(backgroundSource.includes('createToolProgressHook(emitter)'), 'tool progress hook still uses SessionStateEmitter');
assert(backgroundSource.includes('createIterationProgressHook(emitter)'), 'iteration progress hook still uses SessionStateEmitter');
assert(backgroundSource.includes('createCompletionProgressHook(emitter)'), 'completion progress hook still uses SessionStateEmitter');
assert(backgroundSource.includes('createErrorProgressHook(emitter)'), 'error progress hook still uses SessionStateEmitter');
assert(backgroundSource.includes('@returns {{ hooks: HookPipeline }}'), 'createSessionHooks JSDoc matches the narrowed return contract');

console.log('\n--- direct consumer boundary tests ---');

assert(popupSource.includes("case 'sessionStateEvent':"), 'popup still consumes sessionStateEvent');
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
