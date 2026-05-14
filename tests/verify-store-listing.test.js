/**
 * Phase 275 / Plan 04 -- verify-store-listing.mjs invocation contract.
 *
 * Asserts that running `node scripts/verify-store-listing.mjs` exits 0 (PASS)
 * once the in-repo CWS artifacts are in place. This is the test-chain version
 * of the gate; the script itself does the substantive checks.
 *
 * Run: node tests/verify-store-listing.test.js
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail}`); }
}

console.log('--- verify-store-listing.test (Phase 275 / Plan 04) ---');

const result = spawnSync('node', ['scripts/verify-store-listing.mjs'], {
  cwd: ROOT,
  stdio: 'pipe',
  env: process.env,
});

const stdout = result.stdout ? result.stdout.toString() : '';
const stderr = result.stderr ? result.stderr.toString() : '';

check('verify-store-listing.mjs exits 0',
  result.status === 0,
  `exit ${result.status}; stderr tail: ${stderr.slice(-500)}`);

check('verify-store-listing.mjs stdout contains PASS',
  /PASS/i.test(stdout),
  `stdout: ${stdout.slice(0, 500)}`);

check('verify-store-listing.mjs stderr does not contain FAIL',
  !/FAIL/i.test(stderr),
  `stderr: ${stderr.slice(0, 500)}`);

console.log(`\n=== verify-store-listing.test results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
