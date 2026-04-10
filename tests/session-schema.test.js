/**
 * Unit tests for ai/session-schema.js
 *
 * Inspired by archive/remote-main tests/test-session-schema.js but rewritten
 * from scratch against local's richer schema. Local defines ~57 fields with
 * hot/warm tier annotations, mode routing, and deep-clone semantics on
 * createSession(); the archive's flat field-list approach had a different
 * shape entirely. These tests validate local's actual exported surface:
 * createSession / SESSION_FIELDS / SESSION_STATUSES / getWarmFields /
 * getHotFieldNames, plus the isolation, messages-trim, and deep-clone
 * invariants.
 *
 * Run: node tests/session-schema.test.js
 */

'use strict';

const {
  createSession,
  SESSION_FIELDS,
  SESSION_STATUSES,
  getWarmFields,
  getHotFieldNames
} = require('../ai/session-schema.js');

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
  assert(actual === expected, msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
}

// --- SESSION_STATUSES contains all canonical values ----------------------

console.log('\n--- SESSION_STATUSES contains all canonical values ---');
assert(Array.isArray(SESSION_STATUSES), 'SESSION_STATUSES is an array');
assert(SESSION_STATUSES.indexOf('idle') !== -1, 'has idle');
assert(SESSION_STATUSES.indexOf('running') !== -1, 'has running');
assert(SESSION_STATUSES.indexOf('paused') !== -1, 'has paused');
assert(SESSION_STATUSES.indexOf('completed') !== -1, 'has completed');
assert(SESSION_STATUSES.indexOf('partial') !== -1, 'has partial');
assert(SESSION_STATUSES.indexOf('failed') !== -1, 'has failed');
assert(SESSION_STATUSES.indexOf('stopped') !== -1, 'has stopped');
assert(SESSION_STATUSES.indexOf('error') !== -1, 'has error');
assert(SESSION_STATUSES.indexOf('expired') !== -1, 'has expired');
assert(SESSION_STATUSES.indexOf('replaying') !== -1, 'has replaying');
assert(SESSION_STATUSES.indexOf('replay_completed') !== -1, 'has replay_completed');
assert(SESSION_STATUSES.indexOf('replay_failed') !== -1, 'has replay_failed');

// --- SESSION_FIELDS registry has expected shape --------------------------

console.log('\n--- SESSION_FIELDS registry has expected shape ---');
assert(typeof SESSION_FIELDS === 'object' && SESSION_FIELDS !== null, 'SESSION_FIELDS is an object');
const fieldNames = Object.keys(SESSION_FIELDS);
assert(fieldNames.length >= 50, 'SESSION_FIELDS has 50+ fields (got ' + fieldNames.length + ')');
for (let i = 0; i < fieldNames.length; i++) {
  const k = fieldNames[i];
  const spec = SESSION_FIELDS[k];
  if (!(spec && typeof spec === 'object' && ('default' in spec) && spec.tier && spec.type)) {
    assert(false, 'field ' + k + ' missing required shape {default,tier,type}');
    break;
  }
  if (spec.tier !== 'hot' && spec.tier !== 'warm') {
    assert(false, 'field ' + k + ' has invalid tier: ' + spec.tier);
    break;
  }
}
assert(true, 'all fields have {default, tier, type} with valid tier');

// --- createSession() produces all fields with defaults -------------------

console.log('\n--- createSession() populates all fields with defaults ---');
{
  const session = createSession();
  for (let i = 0; i < fieldNames.length; i++) {
    if (!(fieldNames[i] in session)) {
      assert(false, 'session missing field ' + fieldNames[i]);
      break;
    }
  }
  assert(true, 'session has every field declared in SESSION_FIELDS');
  // Spot-check a few critical defaults
  assertEqual(session.sessionId, '', 'sessionId default empty');
  assertEqual(session.status, 'idle', 'status defaults to idle');
  assertEqual(session.mode, 'autopilot', 'mode defaults to autopilot');
  assertEqual(session.maxIterations, 20, 'maxIterations default is 20');
  assertEqual(session.iterationCount, 0, 'iterationCount default is 0');
  assertEqual(session.totalCost, 0, 'totalCost default is 0');
  assertEqual(session.totalInputTokens, 0, 'totalInputTokens default is 0');
  assertEqual(session.totalOutputTokens, 0, 'totalOutputTokens default is 0');
  assertEqual(session.tabId, null, 'tabId default null');
  assertEqual(session.isRestored, false, 'isRestored default false');
  assertEqual(session.animatedActionHighlights, true, 'animatedActionHighlights default true');
  assert(Array.isArray(session.actionHistory), 'actionHistory is array');
  assert(Array.isArray(session.urlHistory), 'urlHistory is array');
  assert(Array.isArray(session.commands), 'commands is array');
  assert(session.safetyConfig && typeof session.safetyConfig === 'object', 'safetyConfig is object');
  assertEqual(session.safetyConfig.costLimit, 2.00, 'safetyConfig.costLimit is 2.00');
  assertEqual(session.safetyConfig.timeLimit, 600000, 'safetyConfig.timeLimit is 600000ms');
  assert(session.domSettings && session.domSettings.domOptimization === true, 'domSettings.domOptimization is true');
  assertEqual(session.domSettings.maxDOMElements, 2000, 'domSettings.maxDOMElements is 2000');
}

// --- createSession(overrides) applies overrides on top of defaults ------

console.log('\n--- createSession(overrides) applies overrides on top of defaults ---');
{
  const session = createSession({
    sessionId: 'sess-42',
    task: 'find dog images',
    tabId: 7,
    mode: 'mcp-manual',
    maxIterations: 50
  });
  assertEqual(session.sessionId, 'sess-42', 'override sessionId');
  assertEqual(session.task, 'find dog images', 'override task');
  assertEqual(session.tabId, 7, 'override tabId');
  assertEqual(session.mode, 'mcp-manual', 'override mode');
  assertEqual(session.maxIterations, 50, 'override maxIterations');
  assertEqual(session.status, 'idle', 'non-overridden field keeps default');
}

// --- createSession deep-clones array defaults (no shared references) ----

console.log('\n--- createSession deep-clones array defaults ---');
{
  const s1 = createSession();
  const s2 = createSession();
  s1.actionHistory.push({ tool: 'click' });
  s1.urlHistory.push('https://example.com');
  s1.commands.push('cmd1');
  assertEqual(s2.actionHistory.length, 0, 's2.actionHistory unaffected by s1 mutation');
  assertEqual(s2.urlHistory.length, 0, 's2.urlHistory unaffected by s1 mutation');
  assertEqual(s2.commands.length, 0, 's2.commands unaffected by s1 mutation');
}

// --- createSession deep-clones object defaults ---------------------------

console.log('\n--- createSession deep-clones object defaults ---');
{
  const s1 = createSession();
  const s2 = createSession();
  s1.safetyConfig.costLimit = 99;
  s1.domSettings.maxDOMElements = 1;
  s1.failedAttempts.click = 3;
  assertEqual(s2.safetyConfig.costLimit, 2.00, 's2.safetyConfig unaffected');
  assertEqual(s2.domSettings.maxDOMElements, 2000, 's2.domSettings unaffected');
  assertEqual(s2.failedAttempts.click, undefined, 's2.failedAttempts unaffected');
}

// --- getWarmFields returns only warm-tier fields -------------------------

console.log('\n--- getWarmFields returns only warm-tier fields ---');
{
  const session = createSession({ sessionId: 'x', task: 't', tabId: 3 });
  const warm = getWarmFields(session);
  const hotNames = getHotFieldNames();
  for (let i = 0; i < hotNames.length; i++) {
    if (hotNames[i] in warm) {
      assert(false, 'hot field ' + hotNames[i] + ' leaked into warm output');
      break;
    }
  }
  assert(true, 'no hot fields leaked into warm output');
  // Warm fields that were set should appear
  assertEqual(warm.sessionId, 'x', 'warm contains sessionId');
  assertEqual(warm.task, 't', 'warm contains task');
  assertEqual(warm.tabId, 3, 'warm contains tabId');
  assertEqual(warm.status, 'idle', 'warm contains status');
  assertEqual(warm.mode, 'autopilot', 'warm contains mode');
}

// --- getWarmFields skips undefined values --------------------------------

console.log('\n--- getWarmFields skips undefined values ---');
{
  const session = createSession();
  delete session.tabId;
  const warm = getWarmFields(session);
  assert(!('tabId' in warm), 'undefined warm field is omitted');
}

// --- getWarmFields deep-clones object values (no shared refs) -----------

console.log('\n--- getWarmFields deep-clones object values ---');
{
  const session = createSession();
  session.failedAttempts.click = 5;
  const warm = getWarmFields(session);
  warm.failedAttempts.click = 99;
  assertEqual(session.failedAttempts.click, 5, 'mutating warm copy does not affect session');
}

// --- getWarmFields trims messages to the last 20 entries ----------------

console.log('\n--- getWarmFields trims messages to the last 20 entries ---');
{
  const session = createSession();
  session.messages = [];
  for (let i = 0; i < 35; i++) {
    session.messages.push({ role: 'user', content: 'm' + i });
  }
  const warm = getWarmFields(session);
  assertEqual(warm.messages.length, 20, 'messages trimmed to 20');
  assertEqual(warm.messages[0].content, 'm15', 'first kept message is m15 (35 - 20)');
  assertEqual(warm.messages[19].content, 'm34', 'last kept message is m34');
}

// --- getWarmFields does not trim messages when under limit --------------

console.log('\n--- getWarmFields keeps all messages when under limit ---');
{
  const session = createSession();
  session.messages = [{ role: 'user', content: 'only' }];
  const warm = getWarmFields(session);
  assertEqual(warm.messages.length, 1, 'single message preserved');
  assertEqual(warm.messages[0].content, 'only', 'message content preserved');
}

// --- getHotFieldNames lists transient fields ----------------------------

console.log('\n--- getHotFieldNames lists transient fields ---');
{
  const hot = getHotFieldNames();
  assert(Array.isArray(hot), 'getHotFieldNames returns array');
  assert(hot.length >= 1, 'at least one hot field declared');
  assert(hot.indexOf('providerConfig') !== -1, 'providerConfig is hot');
  assert(hot.indexOf('followUpContext') !== -1, 'followUpContext is hot');
  assert(hot.indexOf('_nextIterationTimer') !== -1, '_nextIterationTimer is hot');
  assert(hot.indexOf('_lastRetryIteration') !== -1, '_lastRetryIteration is hot');
  // Warm fields should NOT appear
  assert(hot.indexOf('sessionId') === -1, 'sessionId is NOT hot');
  assert(hot.indexOf('task') === -1, 'task is NOT hot');
  assert(hot.indexOf('messages') === -1, 'messages is NOT hot');
}

// --- hot and warm tiers partition all fields -----------------------------

console.log('\n--- hot and warm tiers partition all fields ---');
{
  let hotCount = 0;
  let warmCount = 0;
  for (const k in SESSION_FIELDS) {
    if (SESSION_FIELDS[k].tier === 'hot') hotCount++;
    else if (SESSION_FIELDS[k].tier === 'warm') warmCount++;
  }
  assertEqual(hotCount + warmCount, fieldNames.length, 'every field is hot or warm');
  assert(hotCount >= 1, 'at least 1 hot field');
  assert(warmCount >= 40, 'at least 40 warm fields');
}

// --- mode value must be one of the 4 canonical execution modes ---------

console.log('\n--- mode field has canonical default ---');
{
  const session = createSession();
  assert(
    ['autopilot', 'mcp-manual', 'mcp-agent', 'dashboard-remote'].indexOf(session.mode) !== -1,
    'default mode is one of {autopilot, mcp-manual, mcp-agent, dashboard-remote}'
  );
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
