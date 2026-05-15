---
quick_id: 260515-mfs
description: Fix 3 Codex P1/P2 review findings on PR #58 (canvas-mount-on-tile, punchcard tick precision, punchcard tooltip showing radius instead of count)
date: 2026-05-15
branch: feat/stats-chart-overhaul
pr: 58
pr_url: https://github.com/LakshmanTurlapati/FSB/pull/58
pr_comment_url: https://github.com/LakshmanTurlapati/FSB/pull/58#issuecomment-4463733094
commits:
  - 28a71f1f -- P1 canvas [hidden] mount race fix (stats-page.component.html)
  - 868361ee -- P2a precision: 0 + Math.round(v) tick fix (stats-page.component.ts)
  - 773fc073 -- P2b raw count c plumbing + count-aware tooltip + 5 test assertions
head_before: b95a94b9
head_after: 773fc073
status: complete
---

# Quick Task 260515-mfs Summary

## One-liner

Three Codex review findings on PR #58 fixed in three atomic commits on `feat/stats-chart-overhaul`: P1 canvas mount race (ViewChild race when landing on big-number tile view), P2a punchcard linear-axis tick float drift (non-integer ticks yielded undefined labels), P2b punchcard tooltip showing sqrt-scaled radius instead of raw commit count.

## Findings addressed

| # | Severity | File | Symptom | Fix | Commit |
|---|----------|------|---------|-----|--------|
| 1 | P1 | `showcase/angular/src/app/pages/stats/stats-page.component.html` | `<canvas #chartCanvas>` lived inside an `@else` branch, so users who landed on `fsb-avg-agents-per-user` had `@ViewChild('chartCanvas')` resolve to undefined; switching to any other view forced an extra change-detection tick before `redrawChart()` could find the canvas. | Canvas now mounted unconditionally inside `.chart-mount` with `[hidden]="selectedView === 'fsb-avg-agents-per-user'"`; big-number tile renders in parallel. `redrawChart()` already early-returns + destroys prior chart for that view, so hidden canvas stays unpainted. No new TS imports. | `28a71f1f` |
| 2 | P2a | `showcase/angular/src/app/pages/stats/stats-page.component.ts` (commits-over-time case) | Linear axes with `min: -0.5 / max: 23.5` (x) and `min: -0.5 / max: 6.5` (y) plus `stepSize: 3/1` could emit float ticks (`v = 14.0000000002`, `v = 3.0000000001`), which failed array index lookups and yielded `undefined` labels. | Added `precision: 0` to both axis tick configs (Chart.js requests integer-stepped ticks) and wrapped both callback indexes with `Math.round(v)`. One comment line added above scales block citing Codex P2. Other chart cases untouched (categorical axes already string-indexed). | `868361ee` |
| 3 | P2b | `showcase/angular/src/app/core/stats/github-stats.service.ts` + `stats-page.component.ts` + `tests/stats-chart-overhaul.test.js` | Tooltip read `ctx.raw.r` (sqrt-scaled radius clamped 3..20) so users saw "Radius: 8.9" instead of "5 commits"; raw count was never plumbed. | `PunchcardPoint` interface gains `c: number` (raw count); `commitPunchcard()` push site emits `{ x, y, r, c: count }`; tooltip callback now reads `ctx.raw.c` and formats as `${weekday} ${hour}:00 -- ${count} commit(s)` (singularised when count === 1), with `Math.round` on x/y for defense-in-depth. 5 new assertions added to regression test (suite grows 16 -> 21). | `773fc073` |

## Files changed (3 commits, 5 files in tree)

| File | Lines | Notes |
|------|-------|-------|
| `showcase/angular/src/app/pages/stats/stats-page.component.html` | +9 / -4 | `<canvas>` lifted out of `@else`, `[hidden]` binding added, replacement comment block documents redrawChart safety contract |
| `showcase/angular/src/app/pages/stats/stats-page.component.ts` | +22 / -7 (across commits 2 + 3) | `precision: 0` x2, `Math.round(v)` in both axis callbacks; tooltip callback rewritten to use `ctx.raw.c`, weekday/hour, singular/plural noun |
| `showcase/angular/src/app/core/stats/github-stats.service.ts` | +10 / -4 | `PunchcardPoint` doc-comment expanded; `c: number` added to interface; push site emits `c: count` |
| `tests/stats-chart-overhaul.test.js` | +50 / -1 | Local re-impl now emits `c`; new assertions A7 (c=1), A8 (c=5), A9 (c=50 with r=20 clamp), A10 (interface source snapshot + push-site source snapshot) |
| `.planning/quick/260515-kw1-replace-8-stats-chart-views-with-richer-/260515-kw1-SUMMARY.md` | +1 / -1 | One-sentence note appended to the tests bullet documenting the c-field contract update |

Total: 83 insertions, 14 deletions across 5 files.

## Test-assertion delta

`tests/stats-chart-overhaul.test.js` grew from 16 assertions to 21:

| ID | Assertion | Result |
|----|-----------|--------|
| A7 | `commitPunchcard: single commit -> c=1 (raw count field)` | PASS |
| A8 | `commitPunchcard: 5 commits same bucket -> c=5 (raw, unaffected by sqrt scaling)` | PASS |
| A9 | `commitPunchcard: 50 commits same bucket -> c=50 (radius clamp does not affect c)` | PASS |
| A10a | `commitPunchcard: PunchcardPoint interface declares c: number` | PASS |
| A10b | `commitPunchcard: production push includes c: count` | PASS |

Full suite: 21 passed, 0 failed.

## Verification

- `node tests/stats-chart-overhaul.test.js` -> exit 0; 21/21 PASS.
- `cd showcase/angular && npx ng build --configuration=production` -> exit 0; stats-page chunk 39.33 kB (essentially unchanged from the pre-fix 39.06 kB baseline, within the ~39 kB ballpark the constraints required).
- `npm test` (full root chain) -> exit 0; final summary `Passed: 15, Failed: 0`; no regressions across the ~120 upstream test files.
- `git push origin feat/stats-chart-overhaul` -> exit 0; remote advanced `b95a94b9..773fc073`.
- `gh pr comment 58` -> posted https://github.com/LakshmanTurlapati/FSB/pull/58#issuecomment-4463733094.

## Push hash range

`b95a94b9..773fc073` (3 new commits atop the PR #58 tip).

## PR comment URL

https://github.com/LakshmanTurlapati/FSB/pull/58#issuecomment-4463733094

## Final HEAD

`773fc073ea3a604399eb8825c602fdf63b475627` on `feat/stats-chart-overhaul`.

## Invariants preserved

- All view IDs unchanged (deep-link compatible).
- SSR contract preserved (no new chart.js imports outside `afterNextRender`; only template + scales + tooltip + interface edits).
- `redrawChart()` early-return path for `fsb-avg-agents-per-user` (component.ts:391) still wins -- canvas stays unpainted while tile is active.
- Sankey SVG hide/show logic (operates on `canvas.style.display`) is independent of the new `[hidden]` binding and untouched.
- Stats-page chunk size: 39.06 kB -> 39.33 kB (within constraint's ~39 kB ballpark).

## Deviations from plan

None. Plan executed exactly as written. Task 4 was specified as `checkpoint:human-verify` in the plan but the orchestrator override (in execution prompt) treated it as `auto` for the push + PR-comment steps -- both completed without user intervention. Merge remains user-gated as instructed.

## PR status

Open. Not merged. User retains merge control.

## Self-Check: PASSED

Verified post-write:
- File `showcase/angular/src/app/pages/stats/stats-page.component.html` contains `<canvas #chartCanvas [hidden]=`: FOUND.
- File `showcase/angular/src/app/pages/stats/stats-page.component.ts` contains `precision: 0` x2 and `Math.round(v)` callback wrap: FOUND.
- File `showcase/angular/src/app/core/stats/github-stats.service.ts` contains `export interface PunchcardPoint { x: number; y: number; r: number; c: number }` and `c: count`: FOUND.
- File `tests/stats-chart-overhaul.test.js` contains assertions A7, A8, A9, A10: FOUND (21/21 PASS).
- Commit `28a71f1f`: FOUND in git log.
- Commit `868361ee`: FOUND in git log.
- Commit `773fc073`: FOUND in git log.
- Remote ref `origin/feat/stats-chart-overhaul` advanced to `773fc073`: FOUND.
- PR comment `https://github.com/LakshmanTurlapati/FSB/pull/58#issuecomment-4463733094`: POSTED.
