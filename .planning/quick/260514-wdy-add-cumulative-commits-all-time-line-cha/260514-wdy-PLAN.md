---
phase: quick-260514-wdy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - showcase/angular/src/app/core/stats/github-stats.types.ts
  - showcase/angular/src/app/core/stats/github-stats.service.ts
  - showcase/angular/src/app/pages/stats/stats-page.component.ts
  - tests/cumulative-commits-aggregator.test.js
  - package.json
autonomous: true
requirements:
  - QUICK-260514-wdy-A-types-union
  - QUICK-260514-wdy-B-service-max-pages-and-aggregator
  - QUICK-260514-wdy-C-component-view-and-switch
  - QUICK-260514-wdy-D-test-and-package-wiring

must_haves:
  truths:
    - "MAX_PAGES is 30 in github-stats.service.ts so /commits pagination covers ~3000 commits (currently 23 pages, ~30% headroom)"
    - "The /stats page exposes a 'Cumulative commits' view between 'Pull requests' and 'Commits'"
    - "Selecting 'Cumulative commits' renders a filled line chart mirroring 'Cumulative stars' (tokens.primary border, tokens.primarySoft fill, fill=true, tension=0.2) with a running cumulative-by-day series"
    - "A new exported pure function cumulativeCommitsSeries(commits) returns [] for empty input, [{t,y:1}] for one commit, and is monotonically non-decreasing for valid input"
    - "tests/cumulative-commits-aggregator.test.js is wired into the root npm test chain and passes"
    - "Other endpoints (stars, forks, issues, pulls, releases) still cost only 1 request per cycle because fetchPaginated early-exits when body.length < PER_PAGE (line 279)"
  artifacts:
    - path: "showcase/angular/src/app/core/stats/github-stats.types.ts"
      provides: "StatsViewId union extended with 'commits-cumulative'"
      contains: "'commits-cumulative'"
    - path: "showcase/angular/src/app/core/stats/github-stats.service.ts"
      provides: "MAX_PAGES=30 + cumulativeCommitsSeries pure function + class method delegating to it"
      contains: "MAX_PAGES = 30"
    - path: "showcase/angular/src/app/pages/stats/stats-page.component.ts"
      provides: "'commits-cumulative' view entry + buildChartConfig switch case"
      contains: "commits-cumulative"
    - path: "tests/cumulative-commits-aggregator.test.js"
      provides: "Node-only regression test for MAX_PAGES bump + cumulativeCommitsSeries correctness"
      min_lines: 60
    - path: "package.json"
      provides: "scripts.test chain includes the new test invocation"
      contains: "tests/cumulative-commits-aggregator.test.js"
  key_links:
    - from: "showcase/angular/src/app/pages/stats/stats-page.component.ts"
      to: "showcase/angular/src/app/core/stats/github-stats.service.ts#cumulativeCommitsSeries"
      via: "this.statsService.cumulativeCommitsSeries(this.latestCommits) in the 'commits-cumulative' switch case"
      pattern: "cumulativeCommitsSeries\\(this\\.latestCommits\\)"
    - from: "showcase/angular/src/app/core/stats/github-stats.service.ts#cumulativeCommitsSeries"
      to: "GitHub /repos/{owner}/{repo}/commits commit shape"
      via: "c.commit.author.date access path (NOT c.created_at)"
      pattern: "c.*commit.*author.*date"
    - from: "package.json#scripts.test"
      to: "tests/cumulative-commits-aggregator.test.js"
      via: "&& node tests/cumulative-commits-aggregator.test.js after verify-store-listing.test.js"
      pattern: "node tests/cumulative-commits-aggregator\\.test\\.js"
---

<objective>
Add a cumulative-commits all-time line chart to the /stats Easter-egg page on the showcase Angular site, mirroring the existing "Cumulative stars" view. Bump `MAX_PAGES` from 2 to 30 so /commits pagination covers the repo's full ~2300-commit history (currently truncated to the most-recent 200). Ship as a single commit on the existing branch `feat/stats-cumulative-commits-chart`.

Purpose: The current /stats commits view (`commits-over-time`) is a 12-week bar chart only — there's no all-time growth view for commits even though we have one for stars and forks. The blocker until now was MAX_PAGES=2 which capped the dataset at 200 commits and made an all-time chart visually misleading. With 23 pages of commit history (verified), MAX_PAGES=30 covers everything with ~30% headroom, and the other endpoints (stars=66, forks=4, issues=50, pulls=47, releases=17) all sit under PER_PAGE=100 so they early-exit at page 1 and are not affected by the bump.

Output:
  - StatsViewId union with 'commits-cumulative' added
  - cumulativeCommitsSeries pure function + class method on GitHubStatsService
  - New view entry + Chart.js config case in stats-page.component.ts
  - Node-only regression test wired into npm test
  - MAX_PAGES bumped with explanatory comment block
  - One commit: `feat(stats): add cumulative-commits all-time line chart + bump MAX_PAGES to 30 for full commit history`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@showcase/angular/src/app/core/stats/github-stats.types.ts
@showcase/angular/src/app/core/stats/github-stats.service.ts
@showcase/angular/src/app/pages/stats/stats-page.component.ts
@tests/showcase-csp-allows-github-api.test.js
@tests/showcase-build-smoke.test.js
@package.json

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from the codebase. -->
<!-- Use these directly; no exploration required. -->

From showcase/angular/src/app/core/stats/github-stats.types.ts (current shape — to be extended):
```typescript
export type StatsViewId =
  | 'stars-cumulative'
  | 'stars-weekly'
  | 'issues-open-vs-closed'
  | 'forks-growth'
  | 'prs-opened-vs-merged'
  | 'commits-over-time'
  | 'maintenance';

export interface CommitEvent {
  sha: string;
  commit: { author: { date: string } };
}

export interface TimeSeriesPoint {
  t: string;  // ISO date 'YYYY-MM-DD'
  y: number;
}
```

From showcase/angular/src/app/core/stats/github-stats.service.ts (the EXACT template to mirror, lines 406-423):
```typescript
export function cumulativeStarsSeries(stars: StarEvent[]): TimeSeriesPoint[] {
  const valid = stars.filter((s) => isValidIsoString(s?.starred_at));
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => Date.parse(a.starred_at) - Date.parse(b.starred_at));
  const buckets = new Map<string, number>();
  for (const s of sorted) {
    const dayKey = isoDate(startOfUtcDay(new Date(s.starred_at)));
    buckets.set(dayKey, (buckets.get(dayKey) ?? 0) + 1);
  }
  const out: TimeSeriesPoint[] = [];
  let running = 0;
  for (const [dayKey, count] of [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    running += count;
    out.push({ t: dayKey, y: running });
  }
  return out;
}
```

The file-local helpers (NOT exported) used by the template, lines 382-404:
```typescript
function isValidIsoString(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && !Number.isNaN(Date.parse(s));
}
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

From showcase/angular/src/app/pages/stats/stats-page.component.ts (the EXACT switch-case template to mirror, lines 360-379):
```typescript
case 'stars-cumulative': {
  const series = this.statsService.cumulativeStarsSeries(this.latestStars);
  return {
    type: 'line',
    data: {
      labels: series.map((p) => p.t),
      datasets: [
        {
          label: 'Cumulative stars',
          data: series.map((p) => p.y),
          borderColor: tokens.primary,
          backgroundColor: tokens.primarySoft,
          fill: true,
          tension: 0.2,
        },
      ],
    },
    options: baseOpts,
  };
}
```

Existing `commitsOverTime` at lines 512-528 (DO NOT modify — only confirms the commit-date access path):
```typescript
export function commitsOverTime(commits: CommitEvent[]): TimeSeriesPoint[] {
  const buckets = new Map<string, number>();
  for (const c of commits) {
    const d = c?.commit?.author?.date;  // <-- this is the access path
    if (!isValidIsoString(d)) continue;
    ...
  }
  ...
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend StatsViewId union + bump MAX_PAGES + add cumulativeCommitsSeries</name>
  <files>showcase/angular/src/app/core/stats/github-stats.types.ts, showcase/angular/src/app/core/stats/github-stats.service.ts</files>
  <behavior>
    - StatsViewId union accepts the literal 'commits-cumulative' (placed adjacent to 'commits-over-time')
    - MAX_PAGES constant equals 30
    - A 4-6 line comment block above MAX_PAGES explains: (1) why 30 (covers ~3000 commits = 14 mo headroom over the current 23-page state); (2) other endpoints unaffected because fetchPaginated early-exits at body.length < PER_PAGE; (3) ETag 304 caching softens steady-state cost; (4) graceful degradation if the repo outgrows the cap (chart truncates to most-recent 3000 commits)
    - Exported function `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]` exists, placed in the pure-aggregator section immediately after `cumulativeStarsSeries` (around line 423)
    - The new function: filters via `isValidIsoString(c?.commit?.author?.date)`, sorts ascending by Date.parse of that date, buckets by ISO day via `isoDate(startOfUtcDay(new Date(c.commit.author.date)))`, emits running cumulative `{t, y}` points
    - Empty input → []
    - Single valid commit → [{ t: 'YYYY-MM-DD', y: 1 }]
    - Out-of-order input → output is ascending and cumulative (monotonically non-decreasing y)
    - Invalid date strings → filtered out (counted as 0)
    - A class method `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]` exists on `GitHubStatsService`, placed adjacent to `commitsOverTime` (around line 371), delegating to the exported function
  </behavior>
  <action>
In `showcase/angular/src/app/core/stats/github-stats.types.ts`: extend the `StatsViewId` union by adding the literal `'commits-cumulative'` on the line immediately before `'commits-over-time'`. No other edits to this file — do not add new interfaces, do not reorder existing members.

In `showcase/angular/src/app/core/stats/github-stats.service.ts`:

1. Replace the existing `const MAX_PAGES = 2;` on line 60 with `const MAX_PAGES = 30;` AND immediately above it (between line 59 and the new constant) insert a comment block that documents: (a) the value of 30 covers ~3000 commits with ~30% headroom over the repo's current 23 pages of /commits history; (b) other endpoints are not affected because `fetchPaginated` early-exits when `body.length < PER_PAGE` (see ~line 279) — stars/forks/issues/pulls/releases all sit well under 100 results and exit at page 1; (c) the per-URL ETag cache returns 304 on steady-state polling so the rate-limit budget is preserved; (d) if the repo grows past 3000 commits the cumulative chart will truncate to the most-recent 3000 (graceful degradation, not a crash). Keep the comment in the same `//` line-comment style used throughout the file header (lines 1-39).

2. Add an exported pure function `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]` immediately after `cumulativeStarsSeries` ends (after line 423). Mirror the body of `cumulativeStarsSeries` exactly, swapping:
   - `stars` parameter → `commits`
   - `s?.starred_at` predicate → `c?.commit?.author?.date` (use the same access path as `commitsOverTime` at line 516 — do NOT use a top-level `created_at` field; the commit-date lives at `commit.author.date`)
   - `Date.parse(a.starred_at)` / `Date.parse(b.starred_at)` → `Date.parse(a.commit.author.date)` / `Date.parse(b.commit.author.date)`
   - `s.starred_at` (inside the bucket loop) → `c.commit.author.date`
   The rest of the structure (filter → sort → bucket-by-day → emit running cumulative) is identical to the stars template.

3. Add a class method on `GitHubStatsService` immediately after `commitsOverTime` (around line 373) with the signature `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[] { return cumulativeCommitsSeries(commits); }`. This matches the existing delegation pattern used by every other public aggregator on the class.

Do NOT modify `commitsOverTime`, `PER_PAGE`, the polling cadence, the visibility-aware logic, the rate-limit handling, or any other endpoint fetcher. Do NOT add new types, interfaces, or rename existing exports.
  </action>
  <verify>
    <automated>cd /Users/lakshman/Documents/Misc/FSB && grep -n "commits-cumulative" showcase/angular/src/app/core/stats/github-stats.types.ts && grep -n "MAX_PAGES = 30" showcase/angular/src/app/core/stats/github-stats.service.ts && grep -n "export function cumulativeCommitsSeries" showcase/angular/src/app/core/stats/github-stats.service.ts && grep -n "cumulativeCommitsSeries(commits: CommitEvent\[\]): TimeSeriesPoint\[\]" showcase/angular/src/app/core/stats/github-stats.service.ts</automated>
  </verify>
  <done>
    - `grep "commits-cumulative" showcase/angular/src/app/core/stats/github-stats.types.ts` returns one hit in the StatsViewId union.
    - `grep "MAX_PAGES = 30" showcase/angular/src/app/core/stats/github-stats.service.ts` returns exactly one hit; `grep "MAX_PAGES = 2"` returns zero hits.
    - `grep "export function cumulativeCommitsSeries" showcase/angular/src/app/core/stats/github-stats.service.ts` returns one hit.
    - `grep "cumulativeCommitsSeries(commits: CommitEvent\[\]): TimeSeriesPoint\[\]" showcase/angular/src/app/core/stats/github-stats.service.ts` returns at least two hits (class method declaration + exported function declaration).
    - The new exported function references `commit.author.date` (not `created_at`).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire 'commits-cumulative' view into stats-page.component.ts</name>
  <files>showcase/angular/src/app/pages/stats/stats-page.component.ts</files>
  <behavior>
    - The `views` array contains an entry `{ id: 'commits-cumulative', label: 'Cumulative commits' }` placed immediately BEFORE the existing `'commits-over-time'` entry
    - `buildChartConfig`'s switch has a new `case 'commits-cumulative':` block placed immediately BEFORE the existing `'commits-over-time'` case
    - The new case returns a Chart.js line config with: type 'line', single dataset labelled `'Cumulative commits'`, borderColor `tokens.primary`, backgroundColor `tokens.primarySoft`, fill `true`, tension `0.2`, data sourced from `this.statsService.cumulativeCommitsSeries(this.latestCommits)`, labels mapped from `p.t`, data mapped from `p.y`, options `baseOpts`
    - No other view entries reorder; `'commits-over-time'` and `'maintenance'` remain after the new view; FSB-prefixed view ids are untouched
    - selectedView default and existing setView/redrawChart paths are not modified
  </behavior>
  <action>
In `showcase/angular/src/app/pages/stats/stats-page.component.ts`:

1. In the `views` array (currently lines 86-104), add a new view-option literal `{ id: 'commits-cumulative', label: 'Cumulative commits' },` placed on the line IMMEDIATELY BEFORE `{ id: 'commits-over-time', label: 'Commits' },` (which is at line 92 today). Use the same plain (non-`$localize`-marked) string label pattern that the pre-FSB legacy GitHub views use — the trailing inline comment at lines 94-97 explicitly notes that only FSB-prefixed labels are i18n-marked.

2. In `buildChartConfig` (the switch starting around line 359), add a new case `case 'commits-cumulative': { ... }` placed IMMEDIATELY BEFORE the existing `case 'commits-over-time': { ... }` block (currently lines 475-493). Mirror the `'stars-cumulative'` case body (lines 360-379) verbatim, swapping:
   - `this.statsService.cumulativeStarsSeries(this.latestStars)` → `this.statsService.cumulativeCommitsSeries(this.latestCommits)`
   - dataset `label` value `'Cumulative stars'` → `'Cumulative commits'`
   All other fields (`type: 'line'`, `borderColor: tokens.primary`, `backgroundColor: tokens.primarySoft`, `fill: true`, `tension: 0.2`, `options: baseOpts`, the `labels` / `data` mapping shape) are identical.

Do NOT modify the `'commits-over-time'` case, the `'maintenance'` case, the `selectedView` default, the `setView` method, the `redrawChart` method, the FSB-prefixed views (`fsb-*`), or the chart bootstrap lifecycle.
  </action>
  <verify>
    <automated>cd /Users/lakshman/Documents/Misc/FSB && grep -n "commits-cumulative" showcase/angular/src/app/pages/stats/stats-page.component.ts && grep -n "cumulativeCommitsSeries(this.latestCommits)" showcase/angular/src/app/pages/stats/stats-page.component.ts && grep -n "'Cumulative commits'" showcase/angular/src/app/pages/stats/stats-page.component.ts && grep -c "'commits-over-time'" showcase/angular/src/app/pages/stats/stats-page.component.ts</automated>
  </verify>
  <done>
    - `grep "commits-cumulative" showcase/angular/src/app/pages/stats/stats-page.component.ts` returns at least two hits (views array entry + switch case label).
    - `grep "cumulativeCommitsSeries(this.latestCommits)" showcase/angular/src/app/pages/stats/stats-page.component.ts` returns one hit, inside the new switch case.
    - `grep "'Cumulative commits'" showcase/angular/src/app/pages/stats/stats-page.component.ts` returns one hit (the dataset label).
    - `grep -c "'commits-over-time'" showcase/angular/src/app/pages/stats/stats-page.component.ts` is unchanged from before (the existing 'commits-over-time' entry + case must still be present).
    - The new switch case appears earlier in the file than the `'commits-over-time'` case: confirm via `grep -n "case 'commits-cumulative'" ...` line number is less than `grep -n "case 'commits-over-time'" ...` line number.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add Node-only regression test + wire into root npm test chain</name>
  <files>tests/cumulative-commits-aggregator.test.js, package.json</files>
  <behavior>
    - `tests/cumulative-commits-aggregator.test.js` exists, runs standalone via `node tests/cumulative-commits-aggregator.test.js`, exits 0 on all-pass / 1 with diagnostic on any-fail
    - The test asserts (static source-parse over `showcase/angular/src/app/core/stats/github-stats.service.ts`):
      1. Source contains the substring `MAX_PAGES = 30`
      2. Source contains the substring `export function cumulativeCommitsSeries`
      3. Source contains `c.commit.author.date` (or equivalent regex match for the access path) inside the new function body
      4. Source contains a class method declaration `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]`
      5. Source does NOT still contain `MAX_PAGES = 2`
    - The test asserts (pure-logic, via regex-extracted function body wrapped in a `Function()` constructor with inlined helpers, OR — if extraction is brittle — via hand-computed fixture oracle marked "implementation-coupled" in the header):
      6. Empty input → []
      7. Single commit → [{ t: 'YYYY-MM-DD', y: 1 }] with correct day key
      8. Three commits across two days → two cumulative points with running totals matching hand-calculated expectations
      9. Out-of-order commits → output is sorted ascending and cumulative (y is monotonically non-decreasing)
      10. Invalid date strings → filtered out (do not contribute to cumulative count)
    - `package.json` `scripts.test` chain includes `&& node tests/cumulative-commits-aggregator.test.js`, inserted IMMEDIATELY AFTER `node tests/verify-store-listing.test.js` (and before `node tests/dashboard-stream-readiness-ping.test.js`)
    - Running `node tests/cumulative-commits-aggregator.test.js` from the repo root exits with code 0 after Tasks 1+2 are complete
  </behavior>
  <action>
Create `tests/cumulative-commits-aggregator.test.js` mirroring the structure of `tests/showcase-csp-allows-github-api.test.js`:

- `'use strict';` at the top, `const fs = require('fs')`, `const path = require('path')`.
- A top-of-file header comment explaining: this is a Node-only regression guard for quick task 260514-wdy; covers (a) MAX_PAGES bump to 30 in github-stats.service.ts; (b) presence + correctness of `cumulativeCommitsSeries`. Note the "Run: node tests/cumulative-commits-aggregator.test.js" tail line in the same style as the CSP test.
- Resolve `SERVICE_PATH = path.join(__dirname, '..', 'showcase/angular/src/app/core/stats/github-stats.service.ts')`. Read it as utf-8.
- `let passed = 0; let failed = 0; function check(label, cond, detail) { ... }` matching the CSP test's helper exactly.

Static assertions (assertions 1-5 in `<behavior>`):
- `check('MAX_PAGES bumped to 30', /MAX_PAGES\s*=\s*30\b/.test(src), 'MAX_PAGES = 30 not found in github-stats.service.ts')`
- `check('MAX_PAGES = 2 no longer present', !/MAX_PAGES\s*=\s*2\b/.test(src), 'old MAX_PAGES = 2 still present — bump was reverted or never applied')`
- `check('cumulativeCommitsSeries exported function exists', /export\s+function\s+cumulativeCommitsSeries\s*\(/.test(src), 'export function cumulativeCommitsSeries(...) not found')`
- `check('cumulativeCommitsSeries method declaration on class', /cumulativeCommitsSeries\s*\(\s*commits\s*:\s*CommitEvent\[\]\s*\)\s*:\s*TimeSeriesPoint\[\]/.test(src), 'class method declaration not found')`
- Extract the body of the exported function (regex: `/export\s+function\s+cumulativeCommitsSeries\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/`). `check('cumulativeCommitsSeries body reads commit.author.date', /commit\s*\.?\s*author\s*\.?\s*date|commit\.author\.date|\[\s*['"]commit['"]\s*\][\s\S]*\[\s*['"]author['"]\s*\][\s\S]*\[\s*['"]date['"]\s*\]/.test(body), 'commit.author.date access path not found in function body')`.

Pure-logic assertions (assertions 6-10):
- Extract the function body via the same regex. Strip TS-only annotations (`: TimeSeriesPoint[]`, `: string`, `: number`, `: Date`, `: Map<...>`, `: unknown`, type-cast `as ...` clauses) with simple `.replace(/...regex.../g, '')` calls so the body becomes valid JS.
- Build a runtime function: `const fn = new Function('commits', 'isValidIsoString', 'startOfUtcDay', 'isoDate', strippedBody + '\nreturn out;')` — note the body itself constructs and pushes to `out`, so appending an explicit `return out;` is safe even if the body already returned it (an early-return on empty just exits via the first `return []`). Alternative if the early `return []` is hit: detect that path by re-wrapping the body, OR simply duplicate the logic as a small reference oracle inside the test if the regex+strip approach proves brittle.
- Inline the helper functions inside the test file (copy verbatim from `github-stats.service.ts` lines 382-404): `isValidIsoString`, `startOfUtcDay`, `isoDate`. Pass them into the constructed function.
- If the function-extraction approach fails to produce a runnable function on the first sanity run, fall back to a hand-written reference oracle inside the test file that re-implements `cumulativeCommitsSeries` from the same template, and assert the SOURCE function body's structural shape (regex matches for `filter`, `sort`, bucket `Map`, `running += `, `out.push({ t:`) instead of executing it. In that fallback, add a header comment block: `// IMPLEMENTATION-COUPLED: this test re-implements cumulativeCommitsSeries as a reference oracle. If the source aggregator is refactored, update the oracle accordingly.`

Test fixtures (use whichever execution strategy succeeded above):
- Empty: `fn([])` → `[]`. Assert `JSON.stringify(result) === '[]'`.
- Single: `fn([{ commit: { author: { date: '2024-06-01T12:00:00Z' } } }])` → `[{ t: '2024-06-01', y: 1 }]`.
- Two days: `fn([{commit:{author:{date:'2024-06-01T10:00:00Z'}}}, {commit:{author:{date:'2024-06-01T22:00:00Z'}}}, {commit:{author:{date:'2024-06-02T05:00:00Z'}}}])` → `[{t:'2024-06-01', y:2}, {t:'2024-06-02', y:3}]`.
- Out-of-order: `fn([{commit:{author:{date:'2024-06-03T00:00:00Z'}}}, {commit:{author:{date:'2024-06-01T00:00:00Z'}}}])` → `[{t:'2024-06-01', y:1}, {t:'2024-06-03', y:2}]`. Assert ascending `t` and monotonically non-decreasing `y`.
- Invalid filtered: `fn([{commit:{author:{date:'2024-06-01T00:00:00Z'}}}, {commit:{author:{date:'not-a-date'}}}, {commit:{author:{date:''}}}])` → `[{t:'2024-06-01', y:1}]`.

Footer: print `=== cumulative-commits-aggregator results: N passed, M failed ===` and `process.exit(failed > 0 ? 1 : 0)` — same shape as the CSP test.

Then in `package.json`, locate the `scripts.test` value (one long `&&`-chained string). Insert ` && node tests/cumulative-commits-aggregator.test.js` IMMEDIATELY AFTER the existing token `node tests/verify-store-listing.test.js` and BEFORE the next token `&& node tests/dashboard-stream-readiness-ping.test.js`. Do not reorder any other test entries. Do not touch any other `scripts.*` key. Preserve the exact JSON formatting (no trailing commas, no quote-style changes).
  </action>
  <verify>
    <automated>cd /Users/lakshman/Documents/Misc/FSB && node tests/cumulative-commits-aggregator.test.js && node -e "const p = require('./package.json'); if (!p.scripts.test.includes('node tests/cumulative-commits-aggregator.test.js')) { console.error('FAIL: new test not wired into scripts.test'); process.exit(1); } const idx_new = p.scripts.test.indexOf('node tests/cumulative-commits-aggregator.test.js'); const idx_vsl = p.scripts.test.indexOf('node tests/verify-store-listing.test.js'); const idx_dsr = p.scripts.test.indexOf('node tests/dashboard-stream-readiness-ping.test.js'); if (!(idx_vsl < idx_new && idx_new < idx_dsr)) { console.error('FAIL: insertion order wrong; expected verify-store-listing.test.js < cumulative-commits-aggregator.test.js < dashboard-stream-readiness-ping.test.js'); process.exit(1); } console.log('OK: insertion order correct');"</automated>
  </verify>
  <done>
    - `node tests/cumulative-commits-aggregator.test.js` exits with code 0; output ends with `=== cumulative-commits-aggregator results: N passed, 0 failed ===`.
    - `node -e "console.log(require('./package.json').scripts.test.includes('node tests/cumulative-commits-aggregator.test.js'))"` prints `true`.
    - The new test invocation appears after `verify-store-listing.test.js` and before `dashboard-stream-readiness-ping.test.js` in the `scripts.test` chain.
    - The test file's name (`cumulative-commits-aggregator.test.js`) follows the project's `*.test.js` naming convention used by every other invocation in the chain.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → api.github.com | Unauthenticated public REST traffic; only `/repos/LakshmanTurlapati/FSB/commits` (and the other 6 endpoints already in use) crosses this boundary. The bump to MAX_PAGES=30 increases the per-cycle request count for `/commits` only — from a hard-cap of 2 to a hard-cap of 30, with an early-exit when `body.length < PER_PAGE`. |
| build pipeline → tests/ | Node-only test runner is invoked from `npm test`. The new test reads `github-stats.service.ts` from disk and (in the regex-extraction path) constructs a `Function` from a regex-extracted body. Source is repo-local; no network. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wdy-01 | D (Denial of Service via rate-limit exhaustion) | GitHubStatsService.fetchCommits + MAX_PAGES=30 | mitigate | MAX_PAGES=30 caps the worst-case request count for `/commits` at 30 per cycle. Even worst-case (all endpoints maxed), one cycle = 30 + 6 = 36 requests. With POLL_INTERVAL_MS=5min and the 60-req/hr unauth GitHub limit, two visible cycles fit (~72 max → mostly fine because the other 6 endpoints early-exit at 1 request each, real worst case is 30 + 6 = 36 per cycle = 432/hr if continuously visible). However ETag 304 short-circuits steady-state to mostly-cached responses, which GitHub counts at 0 toward the limit per their docs (referenced in the existing service header comment, lines 23-27). The visibility-aware polling pause (lines 116-138) prevents background tabs from contributing. Acceptable for an Easter-egg page. |
| T-wdy-02 | I (Information disclosure via injected JS in test runner) | tests/cumulative-commits-aggregator.test.js (Function constructor path) | accept | The `Function()` constructor is fed strictly from a regex-extracted slice of a repo-local source file. The source file is in the same repo as the test and is reviewed by the same humans. There is no path from external input to the constructed function body. Fallback path (reference oracle) avoids the Function constructor entirely. |
| T-wdy-03 | T (Tampering / silent regression of MAX_PAGES) | github-stats.service.ts MAX_PAGES constant | mitigate | The new test asserts both presence (`MAX_PAGES = 30`) and absence (`MAX_PAGES = 2`) of the bump. A future refactor that reverts the value will fail CI loudly, mirroring the same pattern used by `tests/showcase-csp-allows-github-api.test.js` for the CSP fix. |
| T-wdy-04 | T (Tampering / silent regression of commit-date access path) | cumulativeCommitsSeries source | mitigate | The test asserts the regex match for `commit.author.date` inside the extracted function body. A future refactor that switches to a wrong access path (e.g. `c.created_at`, which would silently produce empty output because the field doesn't exist on the commit shape) fails CI. |
| T-wdy-05 | E (Elevation via accidental CSP widening) | showcase/server/server.js connect-src | accept | Already covered by `tests/showcase-csp-allows-github-api.test.js` (260514-r6i). This plan does NOT modify CSP — `api.github.com` is already in the connect-src allowlist for the existing 6-endpoint GitHubStatsService. No new origin needed. |
</threat_model>

<verification>
All three task <verify> blocks must pass. Beyond that, the full `npm test` chain must still pass — the new test is wired into the chain so a failure would surface there. Two ad-hoc smoke checks:

```
# 1. Static-source assertions for the entire diff in one shot:
grep -n "commits-cumulative" showcase/angular/src/app/core/stats/github-stats.types.ts
grep -n "MAX_PAGES = 30" showcase/angular/src/app/core/stats/github-stats.service.ts
grep -n "export function cumulativeCommitsSeries" showcase/angular/src/app/core/stats/github-stats.service.ts
grep -n "commits-cumulative" showcase/angular/src/app/pages/stats/stats-page.component.ts
grep -n "cumulativeCommitsSeries(this.latestCommits)" showcase/angular/src/app/pages/stats/stats-page.component.ts

# 2. The new test runs green standalone:
node tests/cumulative-commits-aggregator.test.js
```

If any grep returns zero hits, the corresponding task is incomplete. If the test exits non-zero, the test or its target source needs fixing.
</verification>

<success_criteria>
- [ ] `StatsViewId` union in `showcase/angular/src/app/core/stats/github-stats.types.ts` includes `'commits-cumulative'` adjacent to `'commits-over-time'`
- [ ] `MAX_PAGES = 30` in `showcase/angular/src/app/core/stats/github-stats.service.ts`, with the 4-6 line explanatory comment block above it
- [ ] No remaining instances of `MAX_PAGES = 2` in the service file
- [ ] `export function cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]` exists in the service file, placed after `cumulativeStarsSeries`, uses `c.commit.author.date` access path, mirrors the cumulative-stars filter→sort→bucket→running-total pattern
- [ ] Public class method `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]` exists on `GitHubStatsService`, delegates to the exported function
- [ ] `views` array in `stats-page.component.ts` contains `{ id: 'commits-cumulative', label: 'Cumulative commits' }` immediately before `{ id: 'commits-over-time', label: 'Commits' }`
- [ ] `buildChartConfig` switch has a `case 'commits-cumulative':` block immediately before the `'commits-over-time'` case, mirroring the `'stars-cumulative'` chart config (line type, `tokens.primary` border, `tokens.primarySoft` fill, `fill: true`, `tension: 0.2`, dataset label `'Cumulative commits'`, data from `this.statsService.cumulativeCommitsSeries(this.latestCommits)`)
- [ ] `tests/cumulative-commits-aggregator.test.js` exists and exits 0 when run via `node tests/cumulative-commits-aggregator.test.js` after Tasks 1+2 are complete
- [ ] `package.json` `scripts.test` chain includes `&& node tests/cumulative-commits-aggregator.test.js` inserted between `verify-store-listing.test.js` and `dashboard-stream-readiness-ping.test.js`
- [ ] Out of scope confirmed untouched: sitemap.xml, llms.txt, llms-full.txt, prerender-routes.txt, hreflang verifier, FSB telemetry views (`fsb-*`), polling cadence, visibility logic, CSP, `commitsOverTime`, `PER_PAGE`
- [ ] Single commit on `feat/stats-cumulative-commits-chart` with exact message: `feat(stats): add cumulative-commits all-time line chart + bump MAX_PAGES to 30 for full commit history` — no Co-Authored-By trailer (per user's global CLAUDE.md rules)
</success_criteria>

<output>
After completion, create `.planning/quick/260514-wdy-add-cumulative-commits-all-time-line-cha/260514-wdy-SUMMARY.md` documenting:
- The exact diff lines for each of the five files modified
- Confirmation that `npm test` passes
- The single commit SHA on `feat/stats-cumulative-commits-chart`
- Any deviations from the plan (there should be none)
</output>
