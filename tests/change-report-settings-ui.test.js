'use strict';

/**
 * Phase 245 plan 02 -- settings UI persistence smoke.
 *
 * Verifies the Action Change Reports toggle UI persists correctly:
 *   - defaultSettings.fsbChangeReportsEnabled === true (default ON)
 *   - control_panel.html contains the toggle markup with id
 *     'fsbChangeReportsEnabled' inside an Advanced Settings card
 *   - options.js extends the cap-toggle pattern with the new key in:
 *       defaultSettings, cacheElements, setupEventListeners, loadSettings,
 *       saveSettings
 *
 * Plain Node + assert. No DOM stub harness required: this test reads the
 * source files as text and asserts the surface shape, mirroring the spirit
 * of the Phase 241 cap-counter UI tests.
 *
 * Run: node tests/change-report-settings-ui.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.error('  FAIL:', msg); }
}

(async () => {
  console.log('--- Test: Action Change Reports settings UI persistence ---');

  const optsPath = path.resolve(__dirname, '..', 'extension', 'ui', 'options.js');
  const htmlPath = path.resolve(__dirname, '..', 'extension', 'ui', 'control_panel.html');
  const opts = fs.readFileSync(optsPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // ---- defaultSettings ----
  ok(/fsbChangeReportsEnabled\s*:\s*true/.test(opts), 'defaultSettings.fsbChangeReportsEnabled = true');

  // ---- cacheElements: getElementById('fsbChangeReportsEnabled') ----
  ok(/elements\.fsbChangeReportsEnabled\s*=\s*document\.getElementById\(['"]fsbChangeReportsEnabled['"]\)/.test(opts),
    'cacheElements wires elements.fsbChangeReportsEnabled');

  // ---- setupEventListeners: change handler on the toggle ----
  ok(/elements\.fsbChangeReportsEnabled[\s\S]{0,200}addEventListener\(['"]change['"]/.test(opts),
    'setupEventListeners attaches change handler to fsbChangeReportsEnabled');

  // ---- loadSettings: reads settings.fsbChangeReportsEnabled into checked ----
  ok(/elements\.fsbChangeReportsEnabled\.checked\s*=\s*settings\.fsbChangeReportsEnabled/.test(opts),
    'loadSettings populates checkbox.checked from settings');

  // ---- saveSettings: writes elements.fsbChangeReportsEnabled.checked ----
  ok(/fsbChangeReportsEnabled\s*:\s*elements\.fsbChangeReportsEnabled\?\.checked/.test(opts),
    'saveSettings writes checkbox.checked into chrome.storage.local');

  // ---- control_panel.html: card with checkbox ----
  ok(/id=["']fsbChangeReportsEnabled["']/.test(html),
    'control_panel.html contains <input id="fsbChangeReportsEnabled">');
  ok(/Action Change Reports/.test(html),
    'control_panel.html shows "Action Change Reports" card heading');
  ok(/<input[^>]*type=["']checkbox["'][^>]*id=["']fsbChangeReportsEnabled["'][^>]*checked/.test(html)
    || /<input[^>]*id=["']fsbChangeReportsEnabled["'][^>]*type=["']checkbox["'][^>]*checked/.test(html),
    'checkbox is type=checkbox and defaulted checked');

  // ---- Helper text matches D-07 wording ----
  ok(/compact diff/i.test(html) && /re-read the page/i.test(html),
    'helper text describes compact diff + no re-read (D-07)');

  // ---- Default behavior: ?? true fallback in load and save ----
  ok(/fsbChangeReportsEnabled\s*\?\?\s*true/.test(opts),
    'load/save uses ?? true fallback for older builds without the key');

  console.log(`\nPASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
