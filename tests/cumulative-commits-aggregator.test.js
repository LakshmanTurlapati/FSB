/**
 * cumulative-commits-aggregator -- regression guard for the /stats Easter-egg
 * page's all-time cumulative-commits chart (quick task 260514-wdy).
 *
 * Covers the cumulativeCommitsSeries pure aggregator in
 * showcase/angular/src/app/core/stats/github-stats.service.ts. The exported
 * function mirrors the existing `cumulativeStarsSeries` template, reading
 * `c.commit.author.date` (NOT a top-level `created_at` -- the latter does
 * not exist on the /commits response shape). A future refactor that switches
 * access paths or breaks the filter/sort/bucket/running-cumulative shape
 * would fail CI here.
 *
 * Historical note: this test originally guarded `MAX_PAGES = 30` (quick task
 * 260514-wdy) when the Angular client paginated `/commits` directly against
 * api.github.com. After 260516-7l5 the client reads pre-aggregated commits
 * from the same-origin /api/public-stats/github/commits endpoint and the
 * server-side poller owns the pagination walk. The `MAX_PAGES` assertions
 * moved to tests/server-github-poller.test.js where the invariant now lives.
 *
 * Test is Node-only: it text-parses github-stats.service.ts, extracts the
 * exported function body via regex, strips TypeScript-only annotations, and
 * compiles the result via `new Function(...)` so the executed code is the
 * SAME logic the Angular app ships (not a reference oracle that could drift).
 * Helpers (isValidIsoString / startOfUtcDay / isoDate) are inlined verbatim
 * from the source file's helper block and passed into the constructed function.
 *
 * Run: node tests/cumulative-commits-aggregator.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SERVICE_PATH = path.join(__dirname, '..', 'showcase/angular/src/app/core/stats/github-stats.service.ts');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log(`  PASS: ${label}`); }
  else { failed += 1; console.log(`  FAIL: ${label} -- ${detail}`); }
}

console.log('--- cumulative-commits-aggregator (quick task 260514-wdy) ---');

// -----------------------------------------------------------------------------
// 0. Read source.
// -----------------------------------------------------------------------------

let src = '';
let readErr = null;
try {
  src = fs.readFileSync(SERVICE_PATH, 'utf8');
} catch (e) {
  readErr = e;
}
check('github-stats.service.ts exists and is readable',
  readErr === null && src.length > 0,
  readErr ? readErr.message : 'empty file');

if (readErr || !src) {
  console.log(`\n=== cumulative-commits-aggregator results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 1-5. Static source assertions.
// -----------------------------------------------------------------------------

// MAX_PAGES assertions retired after 260516-7l5 -- pagination moved
// server-side; the invariant lives in tests/server-github-poller.test.js.

check('cumulativeCommitsSeries exported function exists',
  /export\s+function\s+cumulativeCommitsSeries\s*\(/.test(src),
  'export function cumulativeCommitsSeries(...) not found');

check('cumulativeCommitsSeries method declaration on class',
  /cumulativeCommitsSeries\s*\(\s*commits\s*:\s*CommitEvent\[\]\s*\)\s*:\s*TimeSeriesPoint\[\]/.test(src),
  'class method declaration `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]` not found');

// Extract the body of the exported function. The body must read
// `commit.author.date` (NOT `created_at`). Use a non-greedy match to the
// first `\n}` that closes the function.
const bodyRe = /export\s+function\s+cumulativeCommitsSeries\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/;
const bodyMatch = src.match(bodyRe);
check('cumulativeCommitsSeries function body extractable',
  bodyMatch !== null,
  'regex could not isolate the function body -- did the function get reformatted?');

const rawBody = bodyMatch ? bodyMatch[1] : '';
check('cumulativeCommitsSeries body reads commit.author.date',
  /commit\s*\.\s*author\s*\.\s*date/.test(rawBody),
  'commit.author.date access path not found in function body -- did someone switch to c.created_at?');

// -----------------------------------------------------------------------------
// 6-10. Pure-logic assertions (Function-constructor execution).
// -----------------------------------------------------------------------------

// Strip TS-only annotations so the body parses as plain JavaScript.
//
// Three classes of stripping are needed (mirrors the source body shape):
//   - Parameter/declaration type annotations:  `: TimeSeriesPoint[]`, `: number`, `: Map<string, number>`
//   - `<...>` generic type parameters on `new Map<...>` constructors
//   - `as ...` type assertions (none in this body, but kept for resilience)
let strippedBody = rawBody;
strippedBody = strippedBody.replace(/:\s*TimeSeriesPoint\[\]/g, '');
strippedBody = strippedBody.replace(/:\s*number\b/g, '');
strippedBody = strippedBody.replace(/:\s*string\b/g, '');
strippedBody = strippedBody.replace(/:\s*boolean\b/g, '');
strippedBody = strippedBody.replace(/:\s*unknown\b/g, '');
strippedBody = strippedBody.replace(/:\s*Date\b/g, '');
strippedBody = strippedBody.replace(/:\s*Map<[^>]+>/g, '');
strippedBody = strippedBody.replace(/new\s+Map<[^>]+>/g, 'new Map');
strippedBody = strippedBody.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\[\])?/g, '');

// Inlined helpers (verbatim copies from showcase/angular/src/app/core/stats/github-stats.service.ts).
function isValidIsoString(s) {
  return typeof s === 'string' && s.length > 0 && !Number.isNaN(Date.parse(s));
}
function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Build a runnable function from the stripped body. The source body has two
// `return` exits:
//   * `if (valid.length === 0) return [];` on the empty-input fast path
//   * `return out;` at the bottom
// Both are reached naturally; we do not need to append a fallback return.
let fn = null;
let fnErr = null;
try {
  fn = new Function('commits', 'isValidIsoString', 'startOfUtcDay', 'isoDate', strippedBody);
} catch (e) {
  fnErr = e;
}
check('cumulativeCommitsSeries body compiles after TS-stripping',
  fnErr === null,
  fnErr ? `Function constructor failed: ${fnErr.message}\n--- stripped body ---\n${strippedBody}` : '');

if (!fn) {
  console.log(`\n=== cumulative-commits-aggregator results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}

const run = (commits) => fn(commits, isValidIsoString, startOfUtcDay, isoDate);

// 6. Empty input -> [].
{
  const result = run([]);
  check('empty input -> []',
    Array.isArray(result) && result.length === 0,
    `expected [], got ${JSON.stringify(result)}`);
}

// 7. Single commit -> [{ t: 'YYYY-MM-DD', y: 1 }].
{
  const result = run([{ commit: { author: { date: '2024-06-01T12:00:00Z' } } }]);
  check('single commit -> [{ t: 2024-06-01, y: 1 }]',
    Array.isArray(result) && result.length === 1
      && result[0].t === '2024-06-01' && result[0].y === 1,
    `expected [{t:2024-06-01,y:1}], got ${JSON.stringify(result)}`);
}

// 8. Three commits across two days -> two cumulative points.
{
  const result = run([
    { commit: { author: { date: '2024-06-01T10:00:00Z' } } },
    { commit: { author: { date: '2024-06-01T22:00:00Z' } } },
    { commit: { author: { date: '2024-06-02T05:00:00Z' } } },
  ]);
  const expected = [{ t: '2024-06-01', y: 2 }, { t: '2024-06-02', y: 3 }];
  check('three commits / two days -> running cumulative [2, 3]',
    JSON.stringify(result) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`);
}

// 9. Out-of-order commits -> ascending sort + monotonic-non-decreasing y.
{
  const result = run([
    { commit: { author: { date: '2024-06-03T00:00:00Z' } } },
    { commit: { author: { date: '2024-06-01T00:00:00Z' } } },
  ]);
  const expected = [{ t: '2024-06-01', y: 1 }, { t: '2024-06-03', y: 2 }];
  let ascendingTs = true;
  let monotonicYs = true;
  for (let i = 1; i < result.length; i++) {
    if (!(result[i - 1].t < result[i].t)) ascendingTs = false;
    if (result[i].y < result[i - 1].y) monotonicYs = false;
  }
  check('out-of-order commits -> ascending t + monotonic y',
    JSON.stringify(result) === JSON.stringify(expected) && ascendingTs && monotonicYs,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)} (asc=${ascendingTs} mono=${monotonicYs})`);
}

// 10. Invalid date strings -> filtered out.
{
  const result = run([
    { commit: { author: { date: '2024-06-01T00:00:00Z' } } },
    { commit: { author: { date: 'not-a-date' } } },
    { commit: { author: { date: '' } } },
  ]);
  const expected = [{ t: '2024-06-01', y: 1 }];
  check('invalid date strings filtered out',
    JSON.stringify(result) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`);
}

console.log(`\n=== cumulative-commits-aggregator results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
