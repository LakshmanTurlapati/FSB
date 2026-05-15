/**
 * Phase 273 / INGEST-01 -- BLOCKER #1 invariant.
 *
 * `app.set('trust proxy', 1)` MUST be the very next non-blank/non-comment line
 * after `const app = express()` in showcase/server/server.js. Putting it after
 * any other statement (even app.disable('x-powered-by')) would still satisfy
 * "before any route mount", but the invariant we assert here is stricter: the
 * trust-proxy line must be in immediate proximity so a code-review eye picks
 * up regressions instantly.
 *
 * In addition, the trust-proxy line MUST come BEFORE the first app.use(...)
 * AND before any app.use('/api/...') route mount. If a future middleware is
 * mounted above this line, req.ip returns Fly.io's proxy IP instead of the
 * real client IP -- which collapses every install into one hash bucket and
 * silently breaks the entire telemetry pipeline (BLOCKER #1).
 *
 * Zero-dep: pure Node + assert. Mirrors tests/server-accept-language.test.js style.
 *
 * Run: node tests/server-trust-proxy.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SERVER_JS_PATH = path.join(__dirname, '..', 'showcase', 'server', 'server.js');
const src = fs.readFileSync(SERVER_JS_PATH, 'utf8');
const lines = src.split('\n');

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  PASS: ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL: ${label} -- ${detail}`);
  }
}

function findLineIndex(re) {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i;
  }
  return -1;
}

console.log('--- server-trust-proxy invariants (BLOCKER #1 / INGEST-01) ---');

const expressLine = findLineIndex(/^\s*const\s+app\s*=\s*express\s*\(\s*\)\s*;?\s*$/);
const trustProxyLine = findLineIndex(/^\s*app\.set\s*\(\s*['"]trust proxy['"]\s*,\s*1\s*\)\s*;?/);
const firstAppUseLine = findLineIndex(/^\s*app\.use\s*\(/);
const firstRouteMountLine = findLineIndex(/^\s*app\.use\s*\(\s*['"]\/api\//);

check(
  '`const app = express()` is present in server.js',
  expressLine >= 0,
  'no line matched /^\\s*const\\s+app\\s*=\\s*express\\(\\)\\s*;?\\s*$/'
);

check(
  "`app.set('trust proxy', 1)` is present in server.js",
  trustProxyLine >= 0,
  'no line matched the trust-proxy regex'
);

if (expressLine >= 0 && trustProxyLine >= 0) {
  check(
    "`app.set('trust proxy', 1)` is the IMMEDIATELY next line after `const app = express()`",
    trustProxyLine === expressLine + 1,
    `expressLine=${expressLine + 1}, trustProxyLine=${trustProxyLine + 1} -- they must differ by exactly 1`
  );
}

if (trustProxyLine >= 0 && firstAppUseLine >= 0) {
  check(
    "`app.set('trust proxy', 1)` is BEFORE the first `app.use(`",
    trustProxyLine < firstAppUseLine,
    `trustProxyLine=${trustProxyLine + 1}, firstAppUseLine=${firstAppUseLine + 1}`
  );
}

if (trustProxyLine >= 0 && firstRouteMountLine >= 0) {
  check(
    "`app.set('trust proxy', 1)` is BEFORE the first `app.use('/api/...')` mount",
    trustProxyLine < firstRouteMountLine,
    `trustProxyLine=${trustProxyLine + 1}, firstRouteMountLine=${firstRouteMountLine + 1}`
  );
}

// Belt-and-braces: actually require the schema + boot a fresh in-memory db and
// verify that the trust-proxy invariant is what server.js installs at runtime.
// (We don't boot the full server here -- that would bind a port; instead we eval
// just the express-app construction by requiring server.js carefully... but the
// file has side effects -- DB open, listen(). Skip runtime probe; the static
// grep above is sufficient and what the BLOCKER calls out.)

console.log(`\n=== server-trust-proxy results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
