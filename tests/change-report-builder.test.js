'use strict';

/**
 * Phase 245 Plan 01 -- change_report builder shape + filter rules.
 *
 * Validates D-04 output shape and D-03 filter rules against synthetic
 * before/after states and synthetic MutationRecord-like objects. The builder
 * is exercised directly; no real MutationObserver is started, so this test
 * runs in plain Node with minimal browser globals stubbed.
 *
 * Maps to:
 *   - CHANGE-02 (input change shape)
 *   - D-03 (style-only / animation-class / aria-hidden / sub-3-char filters)
 *   - D-04 (URL change, title_changed, dialogs_opened, focus_shift, mutation_count)
 *
 * Run: node tests/change-report-builder.test.js
 */

const assert = require('node:assert/strict');

// --- Browser global stubs (action-verification.js uses these at module scope) ---
global.window = global.window || { location: { href: 'https://example.com/' } };
global.document = global.document || {
  title: 'Example',
  body: { innerText: '' },
  activeElement: null,
  documentElement: { tagName: 'HTML' },
  querySelectorAll: () => [],
  querySelector: () => null,
};
global.MutationObserver = global.MutationObserver || function StubObserver() {
  this.observe = () => {};
  this.disconnect = () => {};
};

const path = require('path');
const MODULE_PATH = require.resolve('../extension/utils/action-verification.js');
delete require.cache[MODULE_PATH];
const { buildChangeReport } = require(MODULE_PATH);

let passed = 0;
let failed = 0;

function check(label, fn) {
  try { fn(); passed++; console.log('  PASS:', label); }
  catch (e) { failed++; console.error('  FAIL:', label, '\n    ', e.message); }
}

// Helper: build an Element-like stub with tagName, getAttribute, className,
// offsetWidth so the builder treats it as a real Element.
function stubEl(opts) {
  const attrs = (opts && opts.attrs) || {};
  return {
    tagName: (opts && opts.tag) || 'DIV',
    textContent: (opts && opts.text) || '',
    className: (opts && opts.className) || '',
    offsetWidth: (opts && opts.offsetWidth != null) ? opts.offsetWidth : 100,
    getAttribute(name) { return attrs[name] != null ? attrs[name] : null; },
  };
}

// --- 1. URL change detection ---
check('URL change is reflected in url.changed', () => {
  const r = buildChangeReport(
    { url: 'https://example.com/a', title: 'A', inputValues: {}, activeElementSelector: null },
    { url: 'https://example.com/b', title: 'A', inputValues: {}, activeElementSelector: null },
    [],
    {}
  );
  assert.equal(r.url.before, 'https://example.com/a');
  assert.equal(r.url.after, 'https://example.com/b');
  assert.equal(r.url.changed, true);
  assert.equal(r.title_changed, false);
});

// --- 2. Title change ---
check('title_changed flips when titles differ', () => {
  const r = buildChangeReport(
    { url: 'u', title: 'A', inputValues: {}, activeElementSelector: null },
    { url: 'u', title: 'B', inputValues: {}, activeElementSelector: null },
    [], {}
  );
  assert.equal(r.title_changed, true);
});

// --- 3. nodes_added populated by childList mutation; CHANGE-02 input change ---
check('nodes_added captures childList add; inputs_changed captures email delta', () => {
  const addedDiv = stubEl({ tag: 'DIV', text: 'Item added', className: 'toast success', attrs: { id: 'toast-1' } });
  const mutations = [
    { type: 'childList', target: stubEl({}), addedNodes: [addedDiv], removedNodes: [] },
  ];
  const r = buildChangeReport(
    { url: 'u', title: 't', inputValues: { email: '' }, activeElementSelector: null },
    { url: 'u', title: 't', inputValues: { email: 'user@example.com' }, activeElementSelector: null },
    mutations,
    {}
  );
  assert.equal(r.nodes_added.length, 1);
  assert.equal(r.nodes_added[0].tag, 'div');
  assert.equal(r.nodes_added[0].text, 'Item added');
  assert.equal(r.nodes_added[0].selector, '#toast-1');
  assert.ok(r.inputs_changed.email, 'inputs_changed.email present');
  assert.equal(r.inputs_changed.email.before, '');
  assert.equal(r.inputs_changed.email.after, 'user@example.com');
});

// --- 4. settle_ms passes through from options ---
check('settle_ms reflects options.settleMs', () => {
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [], { settleMs: 320 });
  assert.equal(r.settle_ms, 320);
});

// --- 5. mutation_count is RAW count (pre-filter) ---
check('mutation_count reports raw mutations.length, not filtered', () => {
  const styleOnly = { type: 'attributes', attributeName: 'style', oldValue: '', target: stubEl({}) };
  const realAdd = { type: 'childList', target: stubEl({}), addedNodes: [stubEl({ tag: 'P', text: 'Visible content here' })], removedNodes: [] };
  const mutations = [styleOnly, styleOnly, realAdd];
  const r = buildChangeReport({ url: 'u', inputValues: {} }, { url: 'u', inputValues: {} }, mutations, {});
  assert.equal(r.mutation_count, 3, 'mutation_count is 3 (raw)');
  // Filter should have dropped the 2 style-only attrs but kept the 1 add.
  assert.equal(r.nodes_added.length, 1);
  assert.equal(r.attrs_changed.length, 0, 'style-only mutations filtered out (D-03)');
});

// --- 6. Style-only mutation filtered (D-03) ---
check('style-only attribute mutation does NOT appear in attrs_changed', () => {
  const m = { type: 'attributes', attributeName: 'style', oldValue: 'color:red', target: stubEl({ attrs: { style: 'color:blue' } }) };
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [m], {});
  assert.equal(r.attrs_changed.length, 0);
});

// --- 7. Animation-class flip filtered (D-03) ---
check('class flip into modal-enter-active is filtered', () => {
  const target = stubEl({ className: 'modal-enter-active', attrs: { class: 'modal-enter-active' } });
  const m = { type: 'attributes', attributeName: 'class', oldValue: '', target };
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [m], {});
  assert.equal(r.attrs_changed.length, 0, 'animation-class-only mutation filtered');
});

// --- 8. Real attribute change survives filter ---
check('disabled attribute change survives filter', () => {
  const target = stubEl({ attrs: { disabled: null, id: 'submit' } });
  const m = { type: 'attributes', attributeName: 'disabled', oldValue: 'true', target };
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [m], {});
  assert.equal(r.attrs_changed.length, 1);
  assert.equal(r.attrs_changed[0].attr, 'disabled');
  assert.equal(r.attrs_changed[0].before, 'true');
  assert.equal(r.attrs_changed[0].after, null);
});

// --- 9. aria-hidden=true that stayed hidden filtered (D-03) ---
check('aria-hidden=true that stayed true is filtered', () => {
  const target = stubEl({ attrs: { 'aria-hidden': 'true' } });
  const m = { type: 'attributes', attributeName: 'aria-hidden', oldValue: 'true', target };
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [m], {});
  assert.equal(r.attrs_changed.length, 0);
});

// --- 10. Sub-3-char characterData mutation filtered (D-03) ---
check('characterData mutation with new value < 3 chars is filtered', () => {
  const m = { type: 'characterData', target: { textContent: '12' }, oldValue: '11' };
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [m], {});
  // No dedicated bucket; just ensure mutation_count counts it but no spurious entry leaks.
  assert.equal(r.mutation_count, 1);
  assert.equal(r.nodes_added.length, 0);
  assert.equal(r.attrs_changed.length, 0);
});

// --- 11. dialogs_opened detected for tag DIALOG ---
check('added <dialog> populates dialogs_opened', () => {
  const dlg = stubEl({ tag: 'DIALOG', text: 'Are you sure?', attrs: { id: 'confirm-modal' } });
  const m = { type: 'childList', target: stubEl({}), addedNodes: [dlg], removedNodes: [] };
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [m], {});
  assert.equal(r.dialogs_opened.length, 1);
  assert.equal(r.dialogs_opened[0].selector, '#confirm-modal');
  assert.equal(r.dialogs_opened[0].text, 'Are you sure?');
});

// --- 12. dialogs_opened detected for role="dialog" ---
check('added node with role="dialog" populates dialogs_opened', () => {
  const dlg = stubEl({ tag: 'DIV', text: 'Hi', attrs: { role: 'dialog', id: 'm' } });
  const m = { type: 'childList', target: stubEl({}), addedNodes: [dlg], removedNodes: [] };
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [m], {});
  assert.equal(r.dialogs_opened.length, 1);
  assert.equal(r.dialogs_opened[0].selector, '#m');
});

// --- 13. focus_shift recorded when activeElementSelector changes ---
check('focus_shift reflects activeElementSelector delta', () => {
  const r = buildChangeReport(
    { url: 'u', activeElementSelector: 'input#email' },
    { url: 'u', activeElementSelector: 'input#password' },
    [], {}
  );
  assert.deepEqual(r.focus_shift, { from: 'input#email', to: 'input#password' });
});

// --- 14. focus_shift null when unchanged ---
check('focus_shift is null when activeElementSelector unchanged', () => {
  const r = buildChangeReport(
    { url: 'u', activeElementSelector: 'input#email' },
    { url: 'u', activeElementSelector: 'input#email' },
    [], {}
  );
  assert.equal(r.focus_shift, null);
});

// --- 15. Output shape matches D-04 keys ---
check('output has all D-04 keys', () => {
  const r = buildChangeReport({ url: 'u' }, { url: 'u' }, [], {});
  for (const key of [
    'url', 'title_changed', 'dialogs_opened', 'nodes_added', 'nodes_removed',
    'attrs_changed', 'inputs_changed', 'focus_shift', 'mutation_count',
    'settle_ms', 'truncated'
  ]) {
    assert.ok(key in r, `missing key: ${key}`);
  }
  assert.equal(r.truncated, false);
});

console.log(`\n[change-report-builder] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
