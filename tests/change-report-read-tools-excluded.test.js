'use strict';

/**
 * Phase 245 plan 02 -- CHANGE-03 read-tool exclusion smoke.
 *
 * Verifies wrapWithChangeReport short-circuits to the bare execute callback
 * (no chrome.scripting.executeScript injection, no change_report attachment)
 * for tools whose _emitChangeReport flag is false or absent.
 *
 * Maps to CHANGE-03: calling read-only tools must not include change_report
 * in the response.
 *
 * Tested tools:
 *   - read_page (D-05 EXCLUDE list, _emitChangeReport: false)
 *   - get_text  (D-05 EXCLUDE list, _emitChangeReport: false)
 *   - get_dom_snapshot (D-05 EXCLUDE list, _emitChangeReport: false)
 *   - list_tabs (D-05 EXCLUDE list, _emitChangeReport: false)
 *   - hover     (D-06 opt-out, _emitChangeReport: false)
 *   - scroll    (D-06 opt-out, _emitChangeReport: false)
 *
 * Run: node tests/change-report-read-tools-excluded.test.js
 */

const assert = require('assert');

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

let scriptingCalls = 0;

function _stubChrome() {
  scriptingCalls = 0;
  global.chrome = {
    tabs: { get: async () => ({ id: 1, url: 'https://example.com/' }) },
    scripting: {
      executeScript: async () => {
        scriptingCalls++;
        return [{ result: { ok: true } }];
      }
    },
    storage: {
      local: { get: (key, cb) => cb({}) },
      onChanged: { addListener: () => {} }
    }
  };
}

(async () => {
  console.log('--- Test: read tools and D-06 opt-outs do not emit change_report (CHANGE-03) ---');

  _stubChrome();
  delete require.cache[require.resolve('../extension/ws/mcp-tool-dispatcher.js')];
  delete require.cache[require.resolve('../extension/utils/action-verification.js')];
  delete require.cache[require.resolve('../extension/ai/tool-definitions.js')];

  const dispatcher = require('../extension/ws/mcp-tool-dispatcher.js');
  if (typeof dispatcher._setChangeReportsEnabledForTest === 'function') {
    dispatcher._setChangeReportsEnabledForTest(true);
  }

  // Verify the registry has the expected flags.
  const defs = require('../extension/ai/tool-definitions.js');
  const readPage = defs.getToolByName('read_page');
  const getText = defs.getToolByName('get_text');
  const getDom = defs.getToolByName('get_dom_snapshot');
  const listTabs = defs.getToolByName('list_tabs');
  const hover = defs.getToolByName('hover');
  const scroll = defs.getToolByName('scroll');
  ok(readPage && readPage._emitChangeReport === false, 'read_page _emitChangeReport=false');
  ok(getText && getText._emitChangeReport === false, 'get_text _emitChangeReport=false');
  ok(getDom && getDom._emitChangeReport === false, 'get_dom_snapshot _emitChangeReport=false');
  ok(listTabs && listTabs._emitChangeReport === false, 'list_tabs _emitChangeReport=false');
  ok(hover && hover._emitChangeReport === false, 'hover _emitChangeReport=false (D-06 opt-out)');
  ok(scroll && scroll._emitChangeReport === false, 'scroll _emitChangeReport=false (D-06 opt-out)');

  const toolsToTest = ['read_page', 'get_text', 'get_dom_snapshot', 'list_tabs', 'hover', 'scroll'];
  for (const toolName of toolsToTest) {
    scriptingCalls = 0;
    const base = { success: true, tool: toolName, result: 'sample' };
    const resp = await dispatcher.wrapWithChangeReport({
      toolName,
      tabId: 1,
      params: {},
      execute: async () => base
    });
    ok(resp && resp.success === true, `${toolName}: response.success preserved`);
    ok(!resp.change_report, `${toolName}: change_report NOT attached`);
    ok(!resp.change_report_hint, `${toolName}: change_report_hint NOT attached`);
    ok(scriptingCalls === 0, `${toolName}: zero chrome.scripting.executeScript calls (zero overhead)`);
  }

  console.log(`\nPASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
