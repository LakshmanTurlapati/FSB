'use strict';

/**
 * Phase 245 plan 02 -- CHANGE-01 dispatcher integration smoke.
 *
 * Verifies wrapWithChangeReport (extension/ws/mcp-tool-dispatcher.js) attaches
 * a properly-shaped change_report to the response envelope when:
 *   - The tool's _emitChangeReport flag is true (e.g., 'click')
 *   - fsbChangeReportsEnabled is true
 *
 * The test stubs chrome.tabs / chrome.scripting / chrome.storage and feeds
 * synthetic before/after states + a mutation list that simulates a dialog
 * opening. Asserts:
 *   - response.change_report.dialogs_opened populated when added node is a
 *     <dialog>-tagged element (CHANGE-01)
 *   - response.change_report has all 11 D-04 keys
 *   - response.change_report.url.{before,after,changed} reflects the mutation
 *   - Original response fields (success, message) are preserved verbatim
 *
 * Plain Node + assert; no jest/mocha.
 *
 * Run: node tests/change-report-dispatcher.test.js
 */

const assert = require('assert');

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

// Stub chrome.* APIs before requiring the dispatcher.
const _scriptingCalls = [];
let _scriptingResults = []; // FIFO of results to return

function _resetChrome(beforeUrl, afterUrl) {
  _scriptingCalls.length = 0;
  _scriptingResults.length = 0;
  global.chrome = {
    tabs: {
      get: async (tabId) => {
        // First call returns before, subsequent returns after
        const callIndex = _scriptingCalls.filter(c => c.kind === 'tabs.get').length;
        _scriptingCalls.push({ kind: 'tabs.get', tabId });
        return { id: tabId, url: callIndex === 0 ? beforeUrl : afterUrl };
      }
    },
    scripting: {
      executeScript: async (opts) => {
        _scriptingCalls.push({ kind: 'scripting.executeScript', target: opts.target, args: opts.args });
        const next = _scriptingResults.shift();
        return [{ result: next }];
      }
    },
    storage: {
      local: { get: (key, cb) => cb({}) },
      onChanged: { addListener: () => {} }
    }
  };
}

(async () => {
  console.log('--- Test: change_report dispatcher integration (CHANGE-01) ---');

  _resetChrome('https://example.com/page-before', 'https://example.com/page-after');
  // Clear require cache so the dispatcher re-hydrates with our stubs.
  delete require.cache[require.resolve('../extension/ws/mcp-tool-dispatcher.js')];
  delete require.cache[require.resolve('../extension/utils/action-verification.js')];
  delete require.cache[require.resolve('../extension/ai/tool-definitions.js')];

  const dispatcher = require('../extension/ws/mcp-tool-dispatcher.js');
  ok(typeof dispatcher.wrapWithChangeReport === 'function', 'wrapWithChangeReport exported');

  // Force the toggle on for this test (storage stub returns empty -> default true).
  if (typeof dispatcher._setChangeReportsEnabledForTest === 'function') {
    dispatcher._setChangeReportsEnabledForTest(true);
  }

  // Queue stubbed results from chrome.scripting.executeScript:
  //   1st invoke: harvest start -> { ok:true, beforeState }
  //   2nd invoke: wait stable    -> true
  //   3rd invoke: harvest stop   -> { ok:true, mutations:[dialog open], afterState, settle_ms }
  const beforeState = {
    url: 'https://example.com/page-before',
    title: 'Before',
    inputValues: {},
    activeElementSelector: null
  };
  const afterState = {
    url: 'https://example.com/page-after',
    title: 'After',
    inputValues: {},
    activeElementSelector: 'button#submit'
  };
  const dialogNodeSerialized = {
    tagName: 'DIALOG',
    _id: 'confirm-modal',
    _className: '',
    _selector: '#confirm-modal',
    _text: 'Are you sure?',
    _isDialog: true,
    offsetWidth: 400,
    getAttribute(name) { return name === 'id' ? 'confirm-modal' : null; },
    get className() { return ''; }
  };
  const dialogMutation = {
    type: 'childList',
    attributeName: null,
    oldValue: null,
    target: dialogNodeSerialized,
    addedNodes: [dialogNodeSerialized],
    removedNodes: []
  };

  _scriptingResults.push({ ok: true, beforeState });
  _scriptingResults.push(true);
  _scriptingResults.push({ ok: true, mutations: [dialogMutation], afterState, settle_ms: 120 });

  let executeFnCalled = false;
  const baseResponse = { success: true, message: 'Clicked', tool: 'click' };
  const resp = await dispatcher.wrapWithChangeReport({
    toolName: 'click',
    tabId: 42,
    params: { selector: '#submit' },
    execute: async () => { executeFnCalled = true; return baseResponse; }
  });

  ok(executeFnCalled, 'execute callback invoked');
  ok(resp && resp.success === true, 'response.success preserved');
  ok(resp && resp.message === 'Clicked', 'response.message preserved');
  ok(resp && resp.change_report, 'change_report attached');
  if (resp && resp.change_report) {
    const cr = resp.change_report;
    ok(cr.url && typeof cr.url === 'object', 'change_report.url object');
    ok(cr.url.before === 'https://example.com/page-before', 'url.before set');
    ok(cr.url.after === 'https://example.com/page-after', 'url.after set');
    ok(cr.url.changed === true, 'url.changed=true on URL delta');
    ok(Array.isArray(cr.dialogs_opened), 'dialogs_opened is array');
    ok(cr.dialogs_opened.length >= 1, 'dialogs_opened populated for <dialog> node (CHANGE-01)');
    if (cr.dialogs_opened.length >= 1) {
      ok(cr.dialogs_opened[0].selector === '#confirm-modal', 'dialog selector populated');
      ok(typeof cr.dialogs_opened[0].text === 'string', 'dialog text populated');
    }
    ok(Array.isArray(cr.nodes_added), 'nodes_added is array');
    ok(Array.isArray(cr.nodes_removed), 'nodes_removed is array');
    ok(Array.isArray(cr.attrs_changed), 'attrs_changed is array');
    ok(typeof cr.inputs_changed === 'object', 'inputs_changed is object');
    ok('focus_shift' in cr, 'focus_shift key present');
    ok(typeof cr.mutation_count === 'number', 'mutation_count present');
    ok(typeof cr.settle_ms === 'number', 'settle_ms present');
    ok(cr.truncated === false || cr.truncated === true, 'truncated boolean');
    ok(cr.title_changed === true, 'title_changed=true reflects After vs Before');
  }

  console.log(`\nPASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
