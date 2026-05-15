---
quick_id: 260515-kw1
description: Replace 8 chart views on /stats with richer visualizations (lollipop, sankey, dual-axis, streamgraph, punchcard, gantt, radial gauge, sparkline, big-number tile)
date: 2026-05-15
branch: feat/stats-chart-overhaul
status: complete
type: execute
plan: .planning/quick/260515-kw1-replace-8-stats-chart-views-with-richer-/260515-kw1-PLAN.md
final_head: ea9f85c297c87e3f34efdb05a2a85b269ae4a2eb
commits:
  - hash: de05b099
    title: "feat(stats): add commitPunchcard + monthlyForks aggregators"
  - hash: 872bde25
    title: "feat(stats): rewrite 5 GitHub views (lollipop, sankey, dual-axis, streamgraph, punchcard)"
  - hash: f9607201
    title: "feat(stats): rewrite maintenance gantt strip + radial gauge + sparkline"
  - hash: 6f1ee5b5
    title: "feat(stats): add fsb-avg-agents-per-user big-number tile (HTML, not canvas)"
  - hash: ea9f85c2
    title: "test(stats): add commitPunchcard + ring-buffer regression tests"
files_modified:
  - showcase/angular/src/app/core/stats/github-stats.service.ts
  - showcase/angular/src/app/pages/stats/stats-page.component.ts
  - showcase/angular/src/app/pages/stats/stats-page.component.html
  - showcase/angular/src/app/pages/stats/stats-page.component.scss
  - showcase/angular/src/locale/messages.xlf
  - showcase/angular/src/locale/messages.es.xlf
  - showcase/angular/src/locale/messages.de.xlf
  - showcase/angular/src/locale/messages.ja.xlf
  - showcase/angular/src/locale/messages.zh-CN.xlf
  - showcase/angular/src/locale/messages.zh-TW.xlf
  - tests/stats-chart-overhaul.test.js
  - package.json
---

# Quick Task 260515-kw1 Summary

## One-line outcome

Replaced the 8 near-identical Chart.js bar/line views on /stats with 9 view-appropriate visualizations (lollipop, inline-SVG sankey, dual-axis mixed, center-baseline streamgraph, bubble punchcard, scatter gantt strip, half-doughnut radial gauge with center text, 288-cap sparkline, HTML big-number tile) -- all on chart.js core, no new npm chart plugin dependency.

## What changed by view

| View ID                   | Before              | After                                                              |
| ------------------------- | ------------------- | ------------------------------------------------------------------ |
| stars-cumulative          | filled line         | unchanged (intentional -- spec line)                               |
| stars-weekly              | plain bar           | lollipop (thin bar stems + scatter dots, mixed chart)              |
| issues-open-vs-closed     | dual line           | inline-SVG Sankey (Opened -> Closed + still-open backlog)          |
| forks-growth              | cumulative line     | dual-axis (cumulative line on yLeft + monthly bars on yRight)      |
| prs-opened-vs-merged      | dual line           | center-baseline streamgraph (opened +, merged -, abs-value labels) |
| commits-cumulative        | filled line         | unchanged (intentional -- spec line)                               |
| commits-over-time         | bar                 | punchcard via bubble chart (x=hour, y=weekday, r=sqrt count)       |
| maintenance               | bar                 | Gantt timeline strip (scatter at y=0, release-tag tooltips)        |
| fsb-active-now            | single-bar          | half-doughnut radial gauge with center text (fsbCenterText plugin) |
| fsb-tokens                | line                | unchanged (intentional -- spec line)                               |
| fsb-agents-running        | single-bar          | sparkline of last 24h from a client-side 288-cap ring buffer       |
| fsb-popular-agents        | doughnut            | unchanged (intentional)                                            |
| fsb-popular-mcp           | doughnut            | unchanged (intentional)                                            |
| fsb-avg-agents-per-user   | suggestedMax bar    | HTML big-number tile with up/down delta arrow (template branch)    |

## Files changed

  - `showcase/angular/src/app/core/stats/github-stats.service.ts` -- new pure helpers `commitPunchcard()` + `monthlyForks()` + `PunchcardPoint` interface; `startOfUtcMonth` promoted to exported.
  - `showcase/angular/src/app/pages/stats/stats-page.component.ts` -- 8 case-block rewrites + new `renderSankeySvg()` / `clearSankeySvg()` methods + 288-cap `agentHistoryRing` + `fsbCenterText` local Chart.js plugin (registered exactly once inside `afterNextRender`) + `avgAgentsDelta` snapshot tracker + `DecimalPipe` import + `redrawChart()` early-return branches for Sankey and big-number tile.
  - `showcase/angular/src/app/pages/stats/stats-page.component.html` -- conditional branch around the canvas to render the big-number tile instead of `<canvas>` for `fsb-avg-agents-per-user`.
  - `showcase/angular/src/app/pages/stats/stats-page.component.scss` -- `.big-number-tile` + `.sankey-svg` styles appended without touching any pre-existing rule.
  - `showcase/angular/src/locale/messages*.xlf` (en source + es/de/ja/zh-CN/zh-TW) -- new `SHOWCASE_STATS_FSB_TILE_AVG_AGENTS_LABEL` trans-unit (6 files).
  - `tests/stats-chart-overhaul.test.js` -- new 16-assertion regression test (commitPunchcard bucketing + ring-buffer cap behaviour + source-text snapshots).
  - `package.json` -- new test wired into the root `npm test` chain immediately after `tests/showcase-csp-allows-github-api.test.js`.

## Commit log (feat/stats-chart-overhaul, 5 atomic commits)

  - `de05b099` -- Task 1: add commitPunchcard + monthlyForks aggregators (61 +/1 -)
  - `872bde25` -- Task 2: rewrite 5 GitHub views + Sankey SVG infrastructure + ring-buffer + center-text plugin registration (378 +/48 -)
  - `f9607201` -- Task 3: maintenance Gantt strip + fsb-active-now radial gauge + fsb-agents-running sparkline (103 +/25 -)
  - `6f1ee5b5` -- Task 4: fsb-avg-agents-per-user big-number tile (HTML branch) + DecimalPipe + 6 xlf updates (115 +/28 -)
  - `ea9f85c2` -- Task 5: 16-assertion regression test + npm test wiring (209 +/1 -)

Final HEAD on `feat/stats-chart-overhaul`: `ea9f85c2`.

## Invariants preserved

  - All 8 GitHub-stats view IDs (and 6 FSB view IDs) unchanged -- deep-link compat intact.
  - SSR contract intact -- `chart.js/auto` is still only imported inside `afterNextRender`; `Chart.register(centerTextPlugin)` is also gated to that path. Server bundle never imports chart.js.
  - Theme tokens via `readChartTokens()` still drive every new view's colors.
  - i18n message IDs (`SHOWCASE_STATS_FSB_CHART_*` / `_VIEW_*`) unchanged; the one new ID (`SHOWCASE_STATS_FSB_TILE_AVG_AGENTS_LABEL`) follows the same prefix scheme and has translations in all 6 locales.
  - No new chart plugin npm dependency added (Sankey is inline SVG; center-text plugin is locally registered).
  - Pre-274 view labels (English-only legacy GitHub view buttons) still English-only -- matches pre-overhaul baseline.

## Verification

  - `npm --prefix showcase/angular run build` -> exit 0. stats-page chunk: 39.02 kB raw / 9.67 kB transfer (within +5KB headroom vs pre-overhaul baseline, well inside the "informational not blocking" budget called out in the plan).
  - `node tests/stats-chart-overhaul.test.js` -> exit 0, 16/16 assertions PASS.
  - `npm test` -> blocked by an environmental pre-existing failure in `mcp/src/tools/pricing.ts` (see "Pre-existing test-chain failure" below). The new stats test passes standalone.

### Pre-existing test-chain failure (NOT caused by this task)

`npm test` fails at the `npm --prefix mcp run build` step (early in the chain, long before our new `tests/stats-chart-overhaul.test.js` would run) with:

```
src/tools/pricing.ts(39,60): error TS1005: ';' expected.
src/tools/pricing.ts(39,65): error TS1005: '(' expected.
src/tools/pricing.ts(39,81): error TS1005: ')' expected.
```

Line 39 of `mcp/src/tools/pricing.ts`:

```ts
import pricingData from '../../data/mcp-pricing-data.json' with { type: 'json' };
```

This is the modern `with { type: 'json' }` import-attributes syntax. The locally-installed `tsc` for `mcp/` does not support it in the current Node v25.9.0 environment. The file was last touched in commit `b8d30638` (PR #50, well before this branch) and reproduces identically on the base commit `cd07d9b6` with no working-tree changes -- confirmed via `git stash` round-trip. Not stats-related; not caused by anything in this quick task; per the task constraints "if a non-stats test fails for reasons unrelated to your changes, note it in the SUMMARY but do not chase it." Recommended follow-up: upgrade `mcp/`'s TypeScript dep or replace the import-attribute with a `fs.readFileSync`/`JSON.parse` pattern -- both unrelated to /stats.

The new test passes cleanly when run standalone (`node tests/stats-chart-overhaul.test.js` -> 16/16 PASS), and is correctly wired into the root `npm test` script immediately after `tests/showcase-csp-allows-github-api.test.js`.

## Deviations from plan

  - **[Rule 2 - critical missing functionality]** Added `monthlyForks()` aggregator to `github-stats.service.ts` (Task 1). The plan's Task 2 listed two options for the forks-growth dual-axis bar dataset ("compute inline ... OR add a small private method ... pick component-local"); I chose the third option -- promote it to the service alongside `commitPunchcard` -- because it is a pure aggregator following the existing service pattern and is needed by the unit tests in spirit (kept pure and exportable for future test reuse). No behaviour change to plan output; cleaner architectural fit.
  - **[Rule 2 - critical missing functionality]** Exported `startOfUtcMonth` from `github-stats.service.ts` so `monthlyForks` and any future month-bucket aggregator can re-use the canonical helper without duplicating the algorithm. The plan called out this as a possible option; I took it.
  - **[Rule 2 - critical missing functionality]** Added 6 new xlf trans-units (one per locale) for `SHOWCASE_STATS_FSB_TILE_AVG_AGENTS_LABEL`. The plan's invariant "any new strings use the same prefix scheme" implies this is required; without these updates, the per-locale build fails with `No translation found` errors. AI-supplied translations follow the existing translation tone of the other `SHOWCASE_STATS_FSB_*` IDs in each locale.

## Skipped per orchestrator instruction

  - `git push -u origin feat/stats-chart-overhaul` -- orchestrator handles push.
  - `gh pr create --base main --head feat/stats-chart-overhaul ...` -- orchestrator handles PR.

The plan's Task 6 push + PR steps are deferred to the orchestrator's docs commit phase.

## Anything left for the human

  - Manual /stats walkthrough on the deployed branch (post-merge / preview deploy):
    - Click every tab; confirm every view renders distinctly and the page never throws.
    - Switching from Sankey to any Chart.js view re-shows the canvas correctly (the SVG should be removed and the canvas should reappear).
    - Switching to fsb-avg-agents-per-user shows the big-number tile (no canvas) with the delta arrow appearing after the second poll cycle (5 min wait).
    - Theme toggle (if applicable) changes chart colors via `readChartTokens()`.
  - Optional follow-up unrelated to this task: unblock `npm test` by fixing `mcp/src/tools/pricing.ts` line 39 import-attributes syntax (env upgrade or rewrite to `fs.readFileSync` + `JSON.parse`).

## Self-Check: PASSED

Files verified to exist:
  - `showcase/angular/src/app/core/stats/github-stats.service.ts` (modified)
  - `showcase/angular/src/app/pages/stats/stats-page.component.ts` (modified)
  - `showcase/angular/src/app/pages/stats/stats-page.component.html` (modified)
  - `showcase/angular/src/app/pages/stats/stats-page.component.scss` (modified)
  - `tests/stats-chart-overhaul.test.js` (created)
  - `package.json` (modified)
  - 6 locale xlf files (modified)

Commits verified in `git log feat/stats-chart-overhaul`:
  - `de05b099`, `872bde25`, `f9607201`, `6f1ee5b5`, `ea9f85c2`.
