/**
 * Phase 278.2 STREAM-07 attempt 2.2 -- regression guard for the content-script
 * injection bundle completeness.
 *
 * Catches the bug found in the content-script-readiness-stall debug session
 * (.planning/debug/content-script-readiness-stall.md): `content/dom-stream.js`
 * was dropped from `CONTENT_SCRIPT_FILES` in extension/background.js, which
 * meant the dom-stream module was NEVER injected into any tab, and the
 * readiness handshake (pingDomStream / domStreamReady) stalled forever on
 * any tab that had never been targeted by an FSB tool action.
 *
 * This test reads extension/background.js, locates the CONTENT_SCRIPT_FILES
 * array, parses its entries, and asserts every required content/* module is
 * present. If you drop dom-stream.js (or any of the others) from the array,
 * this test fails before it can reach production.
 *
 * Run: node tests/extension-content-script-files-completeness.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKGROUND_PATH = path.join(__dirname, '..', 'extension', 'background.js');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail || ''}`); }
}

console.log('--- extension-content-script-files-completeness ---');

const src = fs.readFileSync(BACKGROUND_PATH, 'utf8');

// Locate the CONTENT_SCRIPT_FILES array. It lives at the top of background.js
// as `const CONTENT_SCRIPT_FILES = [ ... ];`. We do a tight regex extract of
// the bracketed body so the test does not depend on which lines the array
// straddles.
const match = src.match(/CONTENT_SCRIPT_FILES\s*=\s*\[([\s\S]*?)\]/);
check('CONTENT_SCRIPT_FILES const exists in extension/background.js', !!match, 'array not found');

if (!match) {
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}

const body = match[1];
// Strip JavaScript line comments (`// ...` to end of line) AND block comments
// before splitting on commas, otherwise leading comments get glued onto the
// first entry of each line group.
const stripped = body
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');
const entries = stripped
  .split(',')
  .map((s) => s.trim().replace(/^['"]/, '').replace(/['"]$/, ''))
  .filter((s) => s.length > 0);

check('CONTENT_SCRIPT_FILES has at least 10 entries', entries.length >= 10, `got ${entries.length}`);

// Every entry must be a relative path inside extension/ (no `..`, no absolute).
for (const e of entries) {
  check(`entry "${e}" is a safe relative path`,
    !e.startsWith('/') && !e.includes('..') && !e.includes('\\'),
    'unsafe path shape');
}

// The full set of content/* and utils/* modules that the readiness handshake
// + dom-stream pipeline depend on. Each MUST be present.
const required = [
  'utils/diagnostics-ring-buffer.js',
  'utils/redactForLog.js',
  'content/init.js',
  'content/utils.js',
  'content/dom-state.js',
  'content/selectors.js',
  'content/badge-combine.js',
  'content/visual-feedback.js',
  'content/accessibility.js',
  'content/actions.js',
  'content/dom-analysis.js',
  // CRITICAL: dom-stream.js -- without this entry the readiness handshake
  // (pingDomStream / domStreamReady) cannot complete on freshly-targeted tabs.
  // Phase 278.2 debug session: .planning/debug/content-script-readiness-stall.md
  'content/dom-stream.js',
  'content/messaging.js',
  'content/lifecycle.js',
];

for (const r of required) {
  check(`required module present: ${r}`, entries.includes(r), `missing from CONTENT_SCRIPT_FILES`);
}

// Belt-and-suspenders: the dom-stream.js file itself must exist on disk and
// must export the pingDomStream handler (otherwise the injection is a no-op).
const domStreamPath = path.join(__dirname, '..', 'extension', 'content', 'dom-stream.js');
check('extension/content/dom-stream.js exists on disk', fs.existsSync(domStreamPath), 'file missing');
if (fs.existsSync(domStreamPath)) {
  const domStreamSrc = fs.readFileSync(domStreamPath, 'utf8');
  check('dom-stream.js registers pingDomStream message handler',
    /pingDomStream/.test(domStreamSrc),
    'pingDomStream handler not found in dom-stream.js source');
  check('dom-stream.js emits domStreamReady at boot',
    /domStreamReady/.test(domStreamSrc),
    'domStreamReady emission not found in dom-stream.js source');
}

console.log(`\n=== extension-content-script-files-completeness: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
