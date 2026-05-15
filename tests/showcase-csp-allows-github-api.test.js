/**
 * showcase-csp-allows-github-api -- regression guard for the /stats Easter-egg
 * page's connect-src dependency on api.github.com.
 *
 * The /stats page renders GitHub-derived charts (cumulative stars, weekly stars,
 * issues, forks, PRs, commits-over-time, maintenance) by calling browser-side
 * fetch() against https://api.github.com/repos/LakshmanTurlapati/FSB/... from
 * showcase/angular/src/app/core/stats/github-stats.service.ts. The showcase
 * Express server (showcase/server/server.js) emits a strict Content-Security-Policy
 * header; its connect-src directive MUST include https://api.github.com or every
 * one of those fetches gets blocked at the browser layer and the charts surface
 * no data. Orchestrator-verified diagnosis (260514-r6i) confirmed the production
 * CSP was `connect-src 'self'` -- this test pins the fix in place so a future
 * security tightening fails CI loud, not silent.
 *
 * Test is Node-only: it text-parses showcase/server/server.js as a string and
 * inspects the SHOWCASE_CSP array literal. No Express boot, no HTTP request.
 *
 * Run: node tests/showcase-csp-allows-github-api.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', 'showcase/server/server.js');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail}`); }
}

console.log('--- showcase-csp-allows-github-api (quick task 260514-r6i) ---');

// 1. The server file exists and is readable.
let src = '';
let readErr = null;
try {
  src = fs.readFileSync(SERVER_PATH, 'utf8');
} catch (e) {
  readErr = e;
}
check('showcase/server/server.js exists and is readable',
  readErr === null && src.length > 0,
  readErr ? readErr.message : 'empty file');

// If we cannot read the source, the remaining assertions are meaningless.
if (readErr || !src) {
  console.log(`\n=== showcase-csp-allows-github-api results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}

// 2. Source contains a `const SHOWCASE_CSP = [ ... ].join(...)` declaration.
const arrayRe = /const\s+SHOWCASE_CSP\s*=\s*\[([\s\S]*?)\]\.join\(/;
const arrayMatch = src.match(arrayRe);
check('SHOWCASE_CSP array literal is present',
  arrayMatch !== null,
  'SHOWCASE_CSP array literal not found -- was the showcase server refactored?');

if (!arrayMatch) {
  console.log(`\n=== showcase-csp-allows-github-api results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}

const arrayBody = arrayMatch[1];

// 3. Extract every double-quoted directive literal and locate the one whose
//    first token (split on whitespace) is `connect-src`.
const directiveRe = /"([^"]+)"/g;
const directives = [];
let dm;
while ((dm = directiveRe.exec(arrayBody)) !== null) {
  directives.push(dm[1]);
}
const connectSrc = directives.find(d => d.trim().split(/\s+/)[0] === 'connect-src');
check('connect-src directive present in SHOWCASE_CSP',
  typeof connectSrc === 'string' && connectSrc.length > 0,
  'connect-src directive missing from SHOWCASE_CSP');

if (!connectSrc) {
  console.log(`\n=== showcase-csp-allows-github-api results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}

// 4. connect-src must include 'self' (quoted, four-character sequence).
check("connect-src directive contains 'self'",
  connectSrc.includes("'self'"),
  "connect-src must include 'self' to retain same-origin fetches");

// 5. connect-src must include https://api.github.com so GitHubStatsService can fetch.
check('connect-src directive contains https://api.github.com',
  connectSrc.includes('https://api.github.com'),
  'connect-src must include https://api.github.com so /stats GitHubStatsService can fetch; see showcase/angular/src/app/core/stats/github-stats.service.ts');

// 6. Defense-in-depth: connect-src must NOT permit a bare `*` wildcard or
//    a `data:` scheme. Accidentally widening to `*` would silently undo the
//    intent of the strict-CSP posture.
const tokens = connectSrc.trim().split(/\s+/).slice(1); // drop the leading 'connect-src'
const hasBareStar = tokens.includes('*');
const hasDataScheme = tokens.includes('data:');
check('connect-src does not permit bare `*` wildcard or data: scheme',
  !hasBareStar && !hasDataScheme,
  'connect-src should not permit `*` wildcard or data: scheme');

console.log(`\n=== showcase-csp-allows-github-api results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
