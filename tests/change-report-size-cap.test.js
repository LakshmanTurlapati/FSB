'use strict';

/**
 * Phase 245 Plan 01 -- change_report size cap (CHANGE-04 / D-04).
 *
 * Builds a synthetic noisy SPA fixture with 50 nodes_added, 30 nodes_removed,
 * 40 attrs_changed and proves that applyChangeReportSizeCap:
 *   - Truncates each array to its per-bucket limit (5 / 5 / 8 / 3).
 *   - Sets truncated:true.
 *   - Brings the serialized payload below 2500 bytes.
 *
 * Pre-cap report should NOT have truncated:true.
 *
 * Run: node tests/change-report-size-cap.test.js
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
const { buildChangeReport, applyChangeReportSizeCap } = require(MODULE_PATH);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log('  PASS:', label); }
  catch (e) { failed++; console.error('  FAIL:', label, '\n    ', e.message); }
}

function stubEl(opts) {
  const attrs = (opts && opts.attrs) || {};
  return {
    tagName: (opts && opts.tag) || 'DIV',
    textContent: (opts && opts.text) || '',
    className: (opts && opts.className) || '',
    offsetWidth: 100,
    getAttribute(name) { return attrs[name] != null ? attrs[name] : null; },
  };
}

// Build a noisy mutations fixture: 50 adds, 30 removes, 40 attr changes.
function buildNoisyMutations() {
  const mutations = [];
  for (let i = 0; i < 50; i++) {
    mutations.push({
      type: 'childList',
      target: stubEl({}),
      addedNodes: [stubEl({ tag: 'DIV', text: `Added node ${i} with some descriptive text content`, attrs: { id: `add-${i}` } })],
      removedNodes: [],
    });
  }
  for (let i = 0; i < 30; i++) {
    mutations.push({
      type: 'childList',
      target: stubEl({}),
      addedNodes: [],
      removedNodes: [stubEl({ tag: 'SPAN', text: `Removed item ${i}`, attrs: { id: `rm-${i}` } })],
    });
  }
  // 40 disabled attribute flips (real, non-noise).
  for (let i = 0; i < 40; i++) {
    mutations.push({
      type: 'attributes',
      attributeName: 'disabled',
      oldValue: i % 2 === 0 ? 'true' : null,
      target: stubEl({ attrs: { id: `btn-${i}`, disabled: i % 2 === 0 ? null : 'true' } }),
    });
  }
  return mutations;
}

// --- 1. Pre-cap report shape ---
check('pre-cap report has full arrays and truncated:false', () => {
  const r = buildChangeReport(
    { url: 'u', inputValues: {} },
    { url: 'u', inputValues: {} },
    buildNoisyMutations(),
    {}
  );
  assert.equal(r.truncated, false);
  assert.equal(r.nodes_added.length, 50);
  assert.equal(r.nodes_removed.length, 30);
  assert.equal(r.attrs_changed.length, 40);
});

// --- 2. Post-cap report respects per-bucket limits ---
check('post-cap report enforces D-04 array limits and truncated:true', () => {
  const r = buildChangeReport(
    { url: 'u', inputValues: {} },
    { url: 'u', inputValues: {} },
    buildNoisyMutations(),
    {}
  );
  // Sanity: pre-cap is over the byte budget.
  const preSize = JSON.stringify(r).length;
  assert.ok(preSize > 2400, `pre-cap size should exceed 2400 bytes, got ${preSize}`);

  const { report, truncated } = applyChangeReportSizeCap(r);
  assert.equal(truncated, true);
  assert.equal(report.truncated, true);
  assert.equal(report.nodes_added.length, 5);
  assert.equal(report.nodes_removed.length, 5);
  assert.equal(report.attrs_changed.length, 8);
  assert.ok(report.dialogs_opened.length <= 3);

  const postSize = JSON.stringify(report).length;
  assert.ok(postSize < 2500, `post-cap size should be < 2500, got ${postSize}`);
});

// --- 3. Small report passes through unchanged ---
check('small report below cap passes through with truncated:false', () => {
  const r = buildChangeReport(
    { url: 'u', inputValues: {} },
    { url: 'u', inputValues: { email: 'a@b' } },
    [], {}
  );
  const sizeBefore = JSON.stringify(r).length;
  assert.ok(sizeBefore < 2400);
  const { report, truncated } = applyChangeReportSizeCap(r);
  assert.equal(truncated, false);
  assert.equal(report.truncated, false);
});

// --- 4. Performance budget D-09: builder under 50ms on 100-mutation fixture ---
check('builder completes in <50ms on 100-mutation fixture (D-09 informal)', () => {
  const big = buildNoisyMutations(); // 120 entries
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) {
    buildChangeReport({ url: 'u', inputValues: {} }, { url: 'u', inputValues: {} }, big, {});
  }
  const avg = (Date.now() - t0) / 5;
  assert.ok(avg < 50, `builder avg ${avg}ms exceeds 50ms budget`);
});

console.log(`\n[change-report-size-cap] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
