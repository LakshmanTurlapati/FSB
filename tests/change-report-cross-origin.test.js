'use strict';

/**
 * Phase 245 Plan 01 -- change_report cross-origin URL-only path (D-08).
 *
 * When buildChangeReport is invoked with options.crossOrigin === true the
 * builder must short-circuit DOM inspection and emit a URL-only report with:
 *   - cross_origin: true
 *   - mutation_count: 0
 *   - settle_ms: 0
 *   - all arrays empty
 *   - url.changed reflecting the before/after URL delta
 *
 * Run: node tests/change-report-cross-origin.test.js
 */

const assert = require('node:assert/strict');

global.window = global.window || { location: { href: 'https://example.com/' } };
global.document = global.document || {
  title: 'Example',
  body: { innerText: '' },
  activeElement: null,
  documentElement: { tagName: 'HTML' },
  querySelectorAll: () => [],
  querySelector: () => null,
};
global.MutationObserver = global.MutationObserver || function () {
  this.observe = () => {}; this.disconnect = () => {};
};

const MODULE_PATH = require.resolve('../extension/utils/action-verification.js');
delete require.cache[MODULE_PATH];
const { buildChangeReport } = require(MODULE_PATH);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log('  PASS:', label); }
  catch (e) { failed++; console.error('  FAIL:', label, '\n    ', e.message); }
}

// --- 1. crossOrigin=true: URL-only report ---
check('crossOrigin:true emits cross_origin:true with empty buckets', () => {
  const r = buildChangeReport(
    { url: 'https://a.example.com/', title: 'A', inputValues: { x: 'y' }, activeElementSelector: 'input#x' },
    { url: 'https://b.example.com/', title: 'B', inputValues: { x: 'z' }, activeElementSelector: 'input#y' },
    [
      // Even if mutations are passed, the builder must ignore them.
      { type: 'childList', target: { tagName: 'DIV', getAttribute: () => null }, addedNodes: [{ tagName: 'DIV', textContent: 'leaked', getAttribute: () => null }], removedNodes: [] },
    ],
    { crossOrigin: true }
  );
  assert.equal(r.cross_origin, true);
  assert.equal(r.mutation_count, 0);
  assert.equal(r.settle_ms, 0);
  assert.equal(r.truncated, false);
  assert.deepEqual(r.dialogs_opened, []);
  assert.deepEqual(r.nodes_added, []);
  assert.deepEqual(r.nodes_removed, []);
  assert.deepEqual(r.attrs_changed, []);
  assert.deepEqual(r.inputs_changed, {});
  assert.equal(r.focus_shift, null);
});

// --- 2. URL change still reflected on cross-origin path ---
check('url.changed reflects URL delta even on cross_origin path', () => {
  const r = buildChangeReport(
    { url: 'https://a.example.com/' },
    { url: 'https://b.example.com/' },
    [],
    { crossOrigin: true }
  );
  assert.equal(r.url.before, 'https://a.example.com/');
  assert.equal(r.url.after, 'https://b.example.com/');
  assert.equal(r.url.changed, true);
});

// --- 3. Same-URL cross-origin (theoretical: subdomain hop with same href) ---
check('url.changed=false when before/after URLs match on cross_origin path', () => {
  const r = buildChangeReport(
    { url: 'https://x.example.com/' },
    { url: 'https://x.example.com/' },
    [], { crossOrigin: true }
  );
  assert.equal(r.url.changed, false);
  assert.equal(r.cross_origin, true);
});

// --- 4. crossOrigin:false (or absent) takes the normal DOM path ---
check('crossOrigin omitted -> normal DOM path, no cross_origin field', () => {
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [], {});
  assert.equal(r.cross_origin, undefined, 'cross_origin must be absent on normal path');
});

// --- 5. T-245-04 mitigation: page DOM never leaks via cross_origin path ---
check('T-245-04: cross_origin path drops mutations array entirely', () => {
  const sneaky = [
    { type: 'attributes', attributeName: 'data-secret', oldValue: 'hidden', target: { tagName: 'META', getAttribute: () => 'leaked' } },
  ];
  const r = buildChangeReport(
    { url: 'a' }, { url: 'b' }, sneaky, { crossOrigin: true }
  );
  assert.equal(r.attrs_changed.length, 0);
  // Make sure no leaked string appears anywhere in the serialized report.
  const ser = JSON.stringify(r);
  assert.equal(ser.includes('leaked'), false);
  assert.equal(ser.includes('data-secret'), false);
});

console.log(`\n[change-report-cross-origin] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
