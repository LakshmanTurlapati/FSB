'use strict';

/**
 * Phase 245 plan 02 -- CHANGE-05 global toggle smoke.
 *
 * Verifies that the fsbChangeReportsEnabled global toggle short-circuits
 * the harvest wrap-around to zero overhead when false. When true, the
 * wrap-around runs normally for action tools.
 *
 * Maps to CHANGE-05: toggling fsbChangeReportsEnabled = false in storage
 * causes all action tool responses to return without change_report.
 *
 * Run: node tests/change-report-toggle.test.js
 */

const assert = require('assert');

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

let scriptingCalls = 0;
let _resultsQueue = [];

function _stubChrome() {
  scriptingCalls = 0;
  _resultsQueue = [];
  global.chrome = {
    tabs: { get: async () => ({ id: 1, url: 'https://example.com/' }) },
    scripting: {
      executeScript: async () => {
        scriptingCalls++;
        const next = _resultsQueue.shift();
        return [{ result: next === undefined ? { ok: true } : next }];
      }
    },
    storage: {
      local: { get: (key, cb) => cb({}) },
      onChanged: { addListener: () => {} }
    }
  };
}

(async () => {
  console.log('--- Test: fsbChangeReportsEnabled toggle (CHANGE-05) ---');

  _stubChrome();
  delete require.cache[require.resolve('../extension/ws/mcp-tool-dispatcher.js')];
  delete require.cache[require.resolve('../extension/utils/action-verification.js')];
  delete require.cache[require.resolve('../extension/ai/tool-definitions.js')];

  const dispatcher = require('../extension/ws/mcp-tool-dispatcher.js');
  ok(typeof dispatcher._setChangeReportsEnabledForTest === 'function', '_setChangeReportsEnabledForTest exported');
  ok(typeof dispatcher._getChangeReportsEnabled === 'function', '_getChangeReportsEnabled exported');

  // ---- Phase A: toggle OFF -> no harvest, no change_report ----
  dispatcher._setChangeReportsEnabledForTest(false);
  ok(dispatcher._getChangeReportsEnabled() === false, 'toggle reads false after set');

  scriptingCalls = 0;
  let resp = await dispatcher.wrapWithChangeReport({
    toolName: 'click',
    tabId: 1,
    params: { selector: '#submit' },
    execute: async () => ({ success: true, message: 'Clicked', tool: 'click' })
  });
  ok(resp && resp.success === true, 'OFF: response.success preserved');
  ok(!resp.change_report, 'OFF: change_report NOT attached');
  ok(scriptingCalls === 0, 'OFF: zero chrome.scripting calls (zero overhead)');

  // ---- Phase B: toggle ON -> harvest runs, change_report attached ----
  dispatcher._setChangeReportsEnabledForTest(true);
  ok(dispatcher._getChangeReportsEnabled() === true, 'toggle reads true after set');

  // Queue results for the 3 scripting calls (start, waitStable, stop)
  _resultsQueue.push({ ok: true, beforeState: { url: 'https://example.com/', title: 't', inputValues: {} } });
  _resultsQueue.push(true);
  _resultsQueue.push({ ok: true, mutations: [], afterState: { url: 'https://example.com/', title: 't', inputValues: {} }, settle_ms: 50 });

  scriptingCalls = 0;
  resp = await dispatcher.wrapWithChangeReport({
    toolName: 'click',
    tabId: 1,
    params: { selector: '#submit' },
    execute: async () => ({ success: true, message: 'Clicked', tool: 'click' })
  });
  ok(resp && resp.success === true, 'ON: response.success preserved');
  ok(resp && resp.change_report, 'ON: change_report attached');
  ok(scriptingCalls > 0, 'ON: chrome.scripting invoked at least once');

  console.log(`\nPASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
