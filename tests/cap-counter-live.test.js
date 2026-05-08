'use strict';

/**
 * Phase 243 Plan 04 - UI-03 Cap counter + validation tests.
 *
 * Validates:
 *   - Pure helpers in extension/ui/cap-counter-helpers.js:
 *       computeActiveAgentCount(envelope)
 *       formatCounterText(active, cap)
 *       isCapInputInvalid(rawValue)
 *   - control_panel.html contains the new DOM ids
 *       fsbAgentCapValidation, fsbAgentCapCurrentActive
 *     and loads cap-counter-helpers.js BEFORE options.js
 *   - options.js wires:
 *       chrome.storage.onChanged listener (session/fsbAgentRegistry +
 *         local/fsbAgentCap)
 *       refreshActiveAgentCount method
 *       isCapInputInvalid validation toggle on the cap input
 *
 * Run: node --test tests/cap-counter-live.test.js
 *
 * NOTE: This test does not load options.js as a module (it depends on
 * browser globals: analytics, chrome.storage, document). Source-pattern
 * grep + direct helper invocation prove the contract is wired.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const HELPERS_PATH = path.resolve(__dirname, '..', 'extension', 'ui', 'cap-counter-helpers.js');
const CONTROL_PANEL_HTML_PATH = path.resolve(__dirname, '..', 'extension', 'ui', 'control_panel.html');
const OPTIONS_JS_PATH = path.resolve(__dirname, '..', 'extension', 'ui', 'options.js');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// ---------------------------------------------------------------------------
// Helper-level tests
// ---------------------------------------------------------------------------

test('computeActiveAgentCount filters legacy:* and counts only agent_<uuid> records', () => {
  const helpers = require(HELPERS_PATH);
  const envelope = {
    records: {
      'agent_aaa': { tabIds: [1] },
      'agent_bbb': { tabIds: [2] },
      'legacy:popup': { tabIds: [] },
      'legacy:autopilot': { tabIds: [] }
    }
  };
  assert.strictEqual(helpers.computeActiveAgentCount(envelope), 2);
});

test('computeActiveAgentCount returns 0 for undefined/null/empty envelope', () => {
  const helpers = require(HELPERS_PATH);
  assert.strictEqual(helpers.computeActiveAgentCount(undefined), 0);
  assert.strictEqual(helpers.computeActiveAgentCount(null), 0);
  assert.strictEqual(helpers.computeActiveAgentCount({}), 0);
  assert.strictEqual(helpers.computeActiveAgentCount({ records: {} }), 0);
});

test('computeActiveAgentCount returns 0 when only legacy:* records present', () => {
  const helpers = require(HELPERS_PATH);
  const envelope = {
    records: {
      'legacy:popup': { tabIds: [] },
      'legacy:sidepanel': { tabIds: [] },
      'legacy:autopilot': { tabIds: [] }
    }
  };
  assert.strictEqual(helpers.computeActiveAgentCount(envelope), 0);
});

test('formatCounterText returns "N of M active"', () => {
  const helpers = require(HELPERS_PATH);
  assert.strictEqual(helpers.formatCounterText(3, 8), '3 of 8 active');
  assert.strictEqual(helpers.formatCounterText(0, 8), '0 of 8 active');
  assert.strictEqual(helpers.formatCounterText(64, 64), '64 of 64 active');
});

test('formatCounterText defaults non-finite inputs', () => {
  const helpers = require(HELPERS_PATH);
  assert.strictEqual(helpers.formatCounterText(NaN, 8), '0 of 8 active');
  assert.strictEqual(helpers.formatCounterText(2, NaN), '2 of 8 active');
});

test('isCapInputInvalid is true for out-of-range, non-finite, non-integer', () => {
  const helpers = require(HELPERS_PATH);
  assert.strictEqual(helpers.isCapInputInvalid('0'), true);
  assert.strictEqual(helpers.isCapInputInvalid('65'), true);
  assert.strictEqual(helpers.isCapInputInvalid('abc'), true);
  assert.strictEqual(helpers.isCapInputInvalid(''), true);
  assert.strictEqual(helpers.isCapInputInvalid('1.5'), true);
  assert.strictEqual(helpers.isCapInputInvalid(NaN), true);
  assert.strictEqual(helpers.isCapInputInvalid(undefined), true);
  assert.strictEqual(helpers.isCapInputInvalid(null), true);
  assert.strictEqual(helpers.isCapInputInvalid('-1'), true);
});

test('isCapInputInvalid is false for valid integer in [1, 64]', () => {
  const helpers = require(HELPERS_PATH);
  assert.strictEqual(helpers.isCapInputInvalid('1'), false);
  assert.strictEqual(helpers.isCapInputInvalid('8'), false);
  assert.strictEqual(helpers.isCapInputInvalid('64'), false);
  assert.strictEqual(helpers.isCapInputInvalid(8), false);
});

// ---------------------------------------------------------------------------
// control_panel.html DOM tests
// ---------------------------------------------------------------------------

test('control_panel.html contains fsbAgentCapValidation and fsbAgentCapCurrentActive ids', () => {
  const html = readFile(CONTROL_PANEL_HTML_PATH);
  assert.ok(
    html.indexOf('id="fsbAgentCapValidation"') !== -1,
    'has id="fsbAgentCapValidation"'
  );
  assert.ok(
    html.indexOf('id="fsbAgentCapCurrentActive"') !== -1,
    'has id="fsbAgentCapCurrentActive"'
  );
});

test('control_panel.html validation div carries the "Must be between 1 and 64" copy', () => {
  const html = readFile(CONTROL_PANEL_HTML_PATH);
  assert.ok(
    /Must be between 1 and 64/.test(html),
    'validation copy "Must be between 1 and 64" present'
  );
});

test('control_panel.html loads cap-counter-helpers.js BEFORE options.js', () => {
  const html = readFile(CONTROL_PANEL_HTML_PATH);
  // Match script tag occurrences only (ignore stray mentions in HTML comments).
  const helperTag = '<script src="cap-counter-helpers.js"></script>';
  const optionsTag = '<script src="options.js"></script>';
  const helperIdx = html.indexOf(helperTag);
  const optionsIdx = html.indexOf(optionsTag);
  assert.ok(helperIdx !== -1, 'control_panel.html includes <script src="cap-counter-helpers.js">');
  assert.ok(optionsIdx !== -1, 'control_panel.html includes <script src="options.js">');
  assert.ok(
    helperIdx < optionsIdx,
    'cap-counter-helpers.js script tag comes before options.js script tag'
  );
});

// ---------------------------------------------------------------------------
// options.js wiring tests (source-pattern)
// ---------------------------------------------------------------------------

test('options.js caches new elements fsbAgentCapValidation and fsbAgentCapCurrentActive', () => {
  const src = readFile(OPTIONS_JS_PATH);
  assert.ok(
    src.indexOf("getElementById('fsbAgentCapValidation')") !== -1,
    'caches fsbAgentCapValidation element'
  );
  assert.ok(
    src.indexOf("getElementById('fsbAgentCapCurrentActive')") !== -1,
    'caches fsbAgentCapCurrentActive element'
  );
});

test('options.js defines refreshActiveAgentCount and uses computeActiveAgentCount', () => {
  const src = readFile(OPTIONS_JS_PATH);
  assert.ok(
    /function\s+refreshActiveAgentCount|refreshActiveAgentCount\s*\(/.test(src),
    'refreshActiveAgentCount referenced'
  );
  assert.ok(
    src.indexOf('computeActiveAgentCount') !== -1,
    'computeActiveAgentCount used by options.js'
  );
  assert.ok(
    src.indexOf('formatCounterText') !== -1,
    'formatCounterText used by options.js'
  );
});

test('options.js subscribes chrome.storage.onChanged for session/fsbAgentRegistry and local/fsbAgentCap', () => {
  const src = readFile(OPTIONS_JS_PATH);
  assert.ok(
    src.indexOf('chrome.storage.onChanged.addListener') !== -1,
    'registers chrome.storage.onChanged listener'
  );
  assert.ok(
    src.indexOf('fsbAgentRegistry') !== -1,
    'options.js references fsbAgentRegistry storage key'
  );
  assert.ok(
    /area\s*===\s*['"]session['"]/.test(src),
    'options.js filters by area === "session"'
  );
  assert.ok(
    /area\s*===\s*['"]local['"]/.test(src),
    'options.js filters by area === "local"'
  );
});

test('options.js uses isCapInputInvalid to toggle validation div on the cap input', () => {
  const src = readFile(OPTIONS_JS_PATH);
  assert.ok(
    src.indexOf('isCapInputInvalid') !== -1,
    'isCapInputInvalid used in cap input handler'
  );
  assert.ok(
    src.indexOf('fsbAgentCapValidation') !== -1,
    'options.js references fsbAgentCapValidation element'
  );
});

test('options.js excludes legacy:* records from the active counter (filter present)', () => {
  // The filter lives in cap-counter-helpers.js; options.js consumes it.
  // We assert the helper file applies the legacy:* filter literally.
  const helpersSrc = readFile(HELPERS_PATH);
  assert.ok(
    helpersSrc.indexOf("'legacy:'") !== -1 || helpersSrc.indexOf('"legacy:"') !== -1,
    'cap-counter-helpers.js applies legacy:* prefix filter'
  );
});

test('options.js debounces refreshActiveAgentCount', () => {
  const src = readFile(OPTIONS_JS_PATH);
  // Either an explicit timeout-based debounce, or a clearly named scheduler.
  assert.ok(
    /_capCounterDebounce|scheduleRefreshCounter|setTimeout\s*\(\s*[^,]*refreshActiveAgentCount/.test(src),
    'options.js debounces refreshActiveAgentCount'
  );
});
