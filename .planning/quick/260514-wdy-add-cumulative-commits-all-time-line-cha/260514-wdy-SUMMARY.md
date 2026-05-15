---
phase: quick-260514-wdy
plan: 01
subsystem: showcase-angular-stats
tags: [stats, github-api, charts, easter-egg, regression-test]
type: execute
status: complete
completed: "2026-05-15T04:32:00Z"
duration_min: 12
commit: 5ac9aaf
branch: worktree-agent-a43403578ceef8630
files_created:
  - tests/cumulative-commits-aggregator.test.js
files_modified:
  - showcase/angular/src/app/core/stats/github-stats.types.ts
  - showcase/angular/src/app/core/stats/github-stats.service.ts
  - showcase/angular/src/app/pages/stats/stats-page.component.ts
  - package.json
requirements_satisfied:
  - QUICK-260514-wdy-A-types-union
  - QUICK-260514-wdy-B-service-max-pages-and-aggregator
  - QUICK-260514-wdy-C-component-view-and-switch
  - QUICK-260514-wdy-D-test-and-package-wiring
deviations: minor-docstring-update-for-MAX_PAGES-comment
verification:
  npm_test_chain: pass (full root chain, ~140 invocations, all green)
  standalone_test: pass (13/13 assertions exit 0)
  showcase_csp_test: pass (6/6)
  showcase_build_smoke: pass (130/130, /stats Easter-egg crawler invariants preserved)
  ng_build: pass (12.3s, 30 prerendered routes, exit 0)
  tsc_no_emit: pass (zero output, exit 0)
---

# Quick Task 260514-wdy: Cumulative-Commits All-Time Line Chart Summary

One-liner: Added a fourth GitHub-derived chart view (Cumulative commits, line+fill) to the /stats Easter-egg page mirroring "Cumulative stars" exactly, plus a MAX_PAGES bump from 2 to 30 so /commits pagination covers the repo's full ~2300-commit history (chart was previously truncated to the most-recent 200 commits, making any all-time view visually misleading).

## Diff Summary (per file)

### `showcase/angular/src/app/core/stats/github-stats.types.ts` (+1 line)

Extended the `StatsViewId` discriminated union with a new literal `'commits-cumulative'`, placed immediately before `'commits-over-time'`:

```diff
   | 'prs-opened-vs-merged'
+  | 'commits-cumulative'
   | 'commits-over-time'
   | 'maintenance';
```

No other edits to this file.

### `showcase/angular/src/app/core/stats/github-stats.service.ts` (+46 / -5 lines)

Three diff hunks:

1. **File-header docblock update (Rule 1 inline-fix).** The doc-block at the top of the file claimed "We hard-cap pagination at MAX_PAGES = 2 ..." which would have been silently false after the new constant lands. Updated it to reflect MAX_PAGES = 30 + the early-exit semantics for the 5 small endpoints. Without this, the `!/MAX_PAGES\s*=\s*2\b/.test(src)` guard in the new test would have caught the stale comment and failed — a documentation/code coherence fix flagged as a minor deviation below.

2. **Constant bump + 9-line explanatory comment block** (replaces the old `const MAX_PAGES = 2;`):
   ```
   // MAX_PAGES = 30 covers ~3000 commits with ~30% headroom over the repo's
   // current 23-page /commits history -- needed by the all-time cumulative-commits
   // view (quick task 260514-wdy). Other endpoints are NOT affected because
   // `fetchPaginated` early-exits when `body.length < PER_PAGE` (see ~line 279):
   // stars (66), forks (4), issues (50), pulls (47), releases (17) all sit well
   // under PER_PAGE = 100 and exit at page 1, so they still cost 1 request/cycle.
   // The per-URL ETag cache returns 304 on steady-state polling (counted as 0
   // toward the unauth 60-req/hr limit per GitHub docs) so the rate-limit
   // budget stays preserved. If the repo grows past 3000 commits the cumulative
   // chart truncates to the most-recent 3000 -- graceful degradation, not a crash.
   const MAX_PAGES = 30;
   ```

3. **New exported pure function** `cumulativeCommitsSeries`, placed immediately after `cumulativeStarsSeries` (around line 439). Body is a verbatim mirror of the stars template swapping `s.starred_at` → `c.commit.author.date`:
   ```typescript
   export function cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[] {
     const valid = commits.filter((c) => isValidIsoString(c?.commit?.author?.date));
     if (valid.length === 0) return [];
     const sorted = [...valid].sort((a, b) => Date.parse(a.commit.author.date) - Date.parse(b.commit.author.date));
     const buckets = new Map<string, number>();
     for (const c of sorted) {
       const dayKey = isoDate(startOfUtcDay(new Date(c.commit.author.date)));
       buckets.set(dayKey, (buckets.get(dayKey) ?? 0) + 1);
     }
     // Emit running cumulative.
     const out: TimeSeriesPoint[] = [];
     let running = 0;
     for (const [dayKey, count] of [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
       running += count;
       out.push({ t: dayKey, y: running });
     }
     return out;
   }
   ```

4. **New class method** on `GitHubStatsService` (around line 385) delegating to the exported function, matching the existing aggregator delegation pattern:
   ```typescript
   cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[] {
     return cumulativeCommitsSeries(commits);
   }
   ```

Not modified: `commitsOverTime` (still the 12-week bar series — the new chart is additive), `PER_PAGE`, polling cadence, visibility logic, rate-limit handling, ETag cache, every other endpoint fetcher, and every other aggregator.

### `showcase/angular/src/app/pages/stats/stats-page.component.ts` (+21 lines)

Two surgical insertions:

1. **`views` array** — new entry inserted at the boundary between the GitHub views and the FSB-prefixed views, immediately before `commits-over-time`:
   ```diff
      { id: 'prs-opened-vs-merged', label: 'Pull requests' },
   +  { id: 'commits-cumulative', label: 'Cumulative commits' },
      { id: 'commits-over-time', label: 'Commits' },
   ```
   Label is plain English (not `$localize`-marked) per the existing convention: only the FSB-prefixed labels are i18n-marked; the legacy GitHub view labels remain English-only.

2. **`buildChartConfig` switch case** — new case inserted immediately before `case 'commits-over-time':`, mirroring the `'stars-cumulative'` chart config verbatim (line type, `tokens.primary` border, `tokens.primarySoft` fill, `fill: true`, `tension: 0.2`, `options: baseOpts`) with the dataset label/data swapped:
   ```typescript
   case 'commits-cumulative': {
     const series = this.statsService.cumulativeCommitsSeries(this.latestCommits);
     return {
       type: 'line',
       data: {
         labels: series.map((p) => p.t),
         datasets: [
           {
             label: 'Cumulative commits',
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

Not modified: existing `'commits-over-time'` case, `'maintenance'` case, all six `fsb-*` FSB telemetry cases, `selectedView` default (`stars-cumulative`), `setView`, `redrawChart`, bootstrap lifecycle, subscription wiring.

### `tests/cumulative-commits-aggregator.test.js` (new file, 215 lines)

Node-only regression test mirroring the style of `tests/showcase-csp-allows-github-api.test.js`. Two layers of assertions (13 total):

**Static-source layer (assertions 1-7):**
- 0. service file exists and is readable
- 1. `MAX_PAGES = 30` present
- 2. `MAX_PAGES = 2` absent (catches silent reverts AND stale doc comments)
- 3. `export function cumulativeCommitsSeries(...)` present
- 4. class method declaration `cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[]` present
- 5. function body extractable via regex
- 6. function body references `commit.author.date` (NOT a top-level `created_at` which would silently produce empty output)

**Pure-logic layer (assertions 8-13):** Test extracts the SOURCE function body, strips TS-only annotations (`: TimeSeriesPoint[]`, `: number`, `: string`, `: boolean`, `: unknown`, `: Date`, `: Map<...>`, `new Map<...>` generics, `as ...` casts), compiles via `new Function(...)`, and runs the result against 5 fixtures with inlined `isValidIsoString` / `startOfUtcDay` / `isoDate` helpers (verbatim copies from the source):

- empty input → `[]`
- single commit → `[{ t: '2024-06-01', y: 1 }]`
- three commits across two days → `[{t:'2024-06-01',y:2}, {t:'2024-06-02',y:3}]` (running cumulative)
- out-of-order commits → ascending `t` + monotonically non-decreasing `y`
- invalid date strings filtered out (counted as 0)

This means the test executes the SAME code the Angular app ships — not a reference oracle that could drift independently. A regression in the source aggregator's logic shape will fail one of these executable fixtures.

### `package.json` (+1 chain entry, in-place)

`scripts.test` chain extended with `&& node tests/cumulative-commits-aggregator.test.js`, inserted exactly between `verify-store-listing.test.js` and `dashboard-stream-readiness-ping.test.js`:

```diff
- ... && node tests/verify-store-listing.test.js && node tests/dashboard-stream-readiness-ping.test.js && ...
+ ... && node tests/verify-store-listing.test.js && node tests/cumulative-commits-aggregator.test.js && node tests/dashboard-stream-readiness-ping.test.js && ...
```

No other scripts touched; no version bump; no dependency changes.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Standalone (post-commit, inside worktree) | `node tests/cumulative-commits-aggregator.test.js` | 13/13 PASS, exit 0 |
| Full npm test chain (pre-commit) | `SKIP_BUILD=1 npm test --silent` | All ~140 invocations green, exit 0 |
| CSP regression | `node tests/showcase-csp-allows-github-api.test.js` | 6/6 PASS, exit 0 |
| Easter-egg crawler invariant | `SKIP_BUILD=1 node tests/showcase-build-smoke.test.js` | 130/130 PASS (no /stats in sitemap/llms.txt/llms-full.txt/prerender-routes.txt) |
| TypeScript no-emit | `npx tsc --project tsconfig.json --noEmit` (from `showcase/angular/`) | exit 0, zero output |
| Angular production build | `npm --prefix showcase/angular run build` | exit 0, 12.3s, 30 prerendered routes |

The two Easter-egg invariants explicitly listed as "DO NOT touch" by the constraints — `sitemap.xml` and `llms-full.txt` — were reverted to baseline before the commit (Angular's build had auto-bumped their `lastmod` dates from 2026-05-14 to 2026-05-15 as a cosmetic side-effect). No /stats route was added to any crawler artifact; the Easter-egg-invisible posture is preserved.

## Deviations from Plan

**1. [Rule 1 - Doc/code coherence] Updated the file-header docblock in `github-stats.service.ts` to reflect MAX_PAGES = 30 instead of 2.**

- **Found during:** Task 1 verification — the new test's assertion `!/MAX_PAGES\s*=\s*2\b/.test(src)` matched both the constant declaration (which the plan correctly addressed) AND a stale prose reference at line 7 of the file-header docblock: `"We hard-cap pagination at MAX_PAGES = 2 so initial load is ~7 requests"`.
- **Issue:** Without updating that line, the assertion would have failed even though the constant itself was correctly bumped — and more importantly, the documentation would have silently lied to future readers about a 15x change in pagination behavior.
- **Fix:** Replaced the 5-line stale paragraph with a 10-line paragraph documenting the new MAX_PAGES = 30 ceiling, the per-cycle request budget (1 summary + 5 early-exit endpoints + up to 30 commits = ~36 worst-case), the ETag-304 short-circuit posture, and the rate-limit-budget implications.
- **Files modified:** `showcase/angular/src/app/core/stats/github-stats.service.ts` (lines 5-14 of the file-header comment, included in the same commit)
- **Commit:** 5ac9aaf

No other deviations. All other plan instructions executed verbatim — switch-case ordering, view-array placement, function-name parity with the stars template, test fixture shape, package.json insertion order.

## Tooling Note (Internal)

The cwd-drift bug documented in the executor system prompt (#3097) fired silently during the first commit attempt: the orchestrator's spawn-time cwd was the worktree, but every Bash invocation in this conversation was prefixed with `cd /Users/lakshman/Documents/Misc/FSB && ...`, which redirected all `Edit`/`Write` operations to the main repo (whose `.git` is a directory, so the `[ -f .git ]` worktree probe correctly returned false but the worktree-only branch-namespace assertion was never triggered).

Recovery was clean: I copied the modified files from the main repo to the worktree (byte-identical SHA256 verified for all 5), reverted the main repo to baseline via file-specific `git checkout --` (explicitly permitted by `<destructive_git_prohibition>` policy — no `git clean`, no blanket reset), then re-ran all tests + Angular build from the main repo (where node_modules is installed) against the worktree-content copied in temporarily, then reverted main again before committing inside the worktree. Final result: the commit landed on the correct branch (`worktree-agent-a43403578ceef8630`) with the exact intended content, and the main repo's working tree is clean.

No content was lost. The commit SHA `5ac9aaf` and its file diff in this SUMMARY represent the canonical end state of this task.

## Self-Check: PASSED

- File `tests/cumulative-commits-aggregator.test.js` exists in worktree ✓
- Commit `5ac9aaf` exists on branch `worktree-agent-a43403578ceef8630` ✓
- All 5 listed files are touched by commit 5ac9aaf (verified via `git show --stat HEAD`) ✓
- New test exits 0 standalone post-commit ✓
- Easter-egg invariants preserved (no /stats in sitemap/llms.txt/llms-full.txt) ✓
- No Co-Authored-By trailer in commit message ✓
