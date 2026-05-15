---
quick_id: 260515-mfs
description: Fix 3 Codex P1/P2 review findings on PR #58 (canvas-mount-on-tile, punchcard tick precision, punchcard tooltip showing radius instead of count)
date: 2026-05-15
branch: feat/stats-chart-overhaul
status: in-progress
---

<objective>
Address three Codex review findings on PR #58 (stats chart overhaul):

  1. **P1 -- canvas mount race (stats-page.component.html):** Template currently swaps `<canvas #chartCanvas>` for the big-number tile inside `@if (selectedView === 'fsb-avg-agents-per-user')`. When the user lands on the page with `fsb-avg-agents-per-user` selected the canvas is never in the DOM, so `@ViewChild('chartCanvas')` resolves to undefined; switching to any other view then needs an extra change-detection tick before `redrawChart()` can find the canvas. Fix by keeping BOTH the canvas and the tile in the DOM with `[hidden]` bindings so the canvas always exists for `redrawChart()`.

  2. **P2 -- punchcard tick precision (stats-page.component.ts, commits-over-time case):** Linear axes with `stepSize: 3` / `stepSize: 1` and floating-point `min/max` can produce non-integer `v` values (e.g. 14.0000000002) which fail array index lookup, yielding `undefined` ticks. Add `precision: 0` and wrap callback indexes with `Math.round(v)` for both x and y axes.

  3. **P2 -- punchcard tooltip wrong value (stats-page.component.ts + github-stats.service.ts + tests/stats-chart-overhaul.test.js):** Tooltip currently shows the sqrt-scaled radius (`ctx.raw.r`) instead of the raw commit count. Augment `PunchcardPoint` with a new `c` (count) field, plumb it through `commitPunchcard()`, update the tooltip callback to format `${weekday} ${hour}:00 -- ${count} commit(s)`, and update the regression test to assert `c` is the raw bucket count.

Purpose: Codex flagged real correctness bugs in PR #58. P1 is a DOM mount-order race; the two P2s are user-visible regressions (axis labels go missing, tooltip is meaningless). All three fix in a single PR-update commit (or up to 3 atomic commits) without re-architecting anything.

Output: 3 source edits + 1 test edit + 1 SUMMARY tweak + push to origin + a single acknowledgement reply comment on PR #58.
</objective>

<context>
@.planning/STATE.md
@.planning/quick/260515-kw1-replace-8-stats-chart-views-with-richer-/260515-kw1-SUMMARY.md
@showcase/angular/src/app/pages/stats/stats-page.component.html
@showcase/angular/src/app/pages/stats/stats-page.component.ts
@showcase/angular/src/app/core/stats/github-stats.service.ts
@tests/stats-chart-overhaul.test.js

<interfaces>
<!-- Pinned contracts the executor needs. Extracted from the codebase so no scavenger-hunt is required. -->

From showcase/angular/src/app/core/stats/github-stats.service.ts (current):
```typescript
export interface PunchcardPoint { x: number; y: number; r: number }

export function commitPunchcard(commits: CommitEvent[]): PunchcardPoint[] {
  // Buckets commits by UTC weekday + hour; emits { x: hour, y: weekday, r: sqrt-scaled }.
  // r = Math.max(3, Math.min(20, Math.sqrt(count) * 4))
}
```

New shape AFTER this plan:
```typescript
export interface PunchcardPoint { x: number; y: number; r: number; c: number }
// r remains the sqrt-scaled bubble radius (3..20 px clamp); c is the raw bucket count
// (integer >= 1) used by the tooltip.
```

From showcase/angular/src/app/pages/stats/stats-page.component.ts (current commits-over-time case, ~line 786):
```typescript
case 'commits-over-time': {
  const points = this.statsService.commitPunchcard(this.latestCommits);
  return {
    type: 'bubble',
    data: { datasets: [{ label: 'Commits', data: points, ... }] },
    options: {
      ...baseOpts,
      plugins: {
        ...baseOpts.plugins,
        tooltip: {
          enabled: true,
          callbacks: {
            label: (ctx: any) => {
              const r = ctx?.raw?.r ?? 0;
              return `Radius: ${r.toFixed?.(1) ?? r}`;   // <-- BUG: shows radius, not count
            },
          },
        },
      },
      scales: {
        x: { type: 'linear', min: -0.5, max: 23.5,
          ticks: { color: tokens.muted, stepSize: 3,
            callback: (v: number) => `${v}:00` },        // <-- BUG: non-int v
          grid: { color: tokens.border },
        },
        y: { type: 'linear', min: -0.5, max: 6.5,
          ticks: { color: tokens.muted, stepSize: 1,
            callback: (v: number) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][v] ?? '' },
                                                          // <-- BUG: non-int v
          grid: { color: tokens.border },
        },
      },
    },
  };
}
```

From showcase/angular/src/app/pages/stats/stats-page.component.html (current chart-mount block, lines 57-75):
```html
<div class="chart-mount">
  @if (selectedView === 'fsb-avg-agents-per-user') {
    <div class="big-number-tile" role="status" aria-live="polite">
      ... big number ...
    </div>
  } @else {
    <canvas #chartCanvas></canvas>
  }
</div>
```

Target shape AFTER this plan (both nodes always in DOM, `[hidden]` toggles visibility -- canvas stays mounted so `@ViewChild('chartCanvas')` always resolves):
```html
<div class="chart-mount">
  <canvas #chartCanvas [hidden]="selectedView === 'fsb-avg-agents-per-user'"></canvas>
  <div class="big-number-tile" role="status" aria-live="polite"
       [hidden]="selectedView !== 'fsb-avg-agents-per-user'">
    ... big number ...
  </div>
</div>
```

Note: `redrawChart()` already early-returns for `fsb-avg-agents-per-user` (component.ts:391) and already destroys any prior chart instance, so leaving the canvas in the DOM under `[hidden]` is safe -- no chart will render onto it while the tile is active.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: P1 -- restructure chart-mount so canvas stays in DOM under [hidden]</name>
  <files>showcase/angular/src/app/pages/stats/stats-page.component.html</files>
  <action>
In stats-page.component.html, replace the conditional `@if (selectedView === 'fsb-avg-agents-per-user') { ... } @else { <canvas #chartCanvas> }` block (lines ~57-75, inside `<div class="chart-mount">`) with a structure where BOTH the canvas and the big-number tile are always rendered, and `[hidden]` controls visibility:

```html
<div class="chart-mount">
  <canvas #chartCanvas [hidden]="selectedView === 'fsb-avg-agents-per-user'"></canvas>
  @if (selectedView === 'fsb-avg-agents-per-user') {
    <!-- Quick task 260515-mfs (P1) -- canvas stays mounted under [hidden] above so
         @ViewChild('chartCanvas') always resolves and redrawChart() can find the
         canvas without an extra change-detection tick. -->
    <div class="big-number-tile" role="status" aria-live="polite">
      <div class="big-number-label" i18n="@@SHOWCASE_STATS_FSB_TILE_AVG_AGENTS_LABEL">Avg agents per active user</div>
      <div class="big-number-value">{{ fsbHeadline?.avg_agents_per_user ?? 0 | number:'1.1-2' }}</div>
      @if (avgAgentsDelta !== null) {
        <div class="big-number-delta" [class.up]="avgAgentsDelta > 0" [class.down]="avgAgentsDelta < 0">
          <span class="delta-arrow" aria-hidden="true">{{ avgAgentsDelta > 0 ? '\u25B2' : (avgAgentsDelta < 0 ? '\u25BC' : '\u00B7') }}</span>
          {{ avgAgentsDelta > 0 ? '+' : '' }}{{ avgAgentsDelta | number:'1.1-2' }}
        </div>
      }
    </div>
  }
</div>
```

Why this works (preserve the existing comment block from line 59-61 paraphrased into the new comment): redrawChart() already early-returns for `fsb-avg-agents-per-user` at component.ts:391 (destroys prior chart, clears Sankey SVG, then returns). Nothing renders onto the canvas while the tile is active, so leaving `<canvas>` in the DOM under `[hidden]` is safe. The big-number tile is kept inside `@if` (not also under `[hidden]`) so the i18n block doesn't get evaluated when not the active view.

Do NOT touch:
  - The `viewState === 'ready'` outer `@if` (the canvas should still only mount once GitHub data is ready, mirroring the prior behaviour).
  - Any other view selector logic, the headline row, or any i18n strings.
  - The Sankey SVG hide/show logic in redrawChart() -- it operates on `canvas.style.display` and is independent of `[hidden]`.

SSR contract preserved: the template change is structural only; no new TS imports, no chart.js touch.
  </action>
  <verify>
    <automated>cd /Users/lakshmanturlapati/Desktop/FSB/main/showcase/angular && npx ng build --configuration=production 2>&1 | tail -40</automated>
  </verify>
  <done>
    Production Angular build exits 0. `<canvas #chartCanvas>` appears unconditionally inside `.chart-mount` (gated only by `[hidden]` on view id and the outer `viewState === 'ready'`). Big-number tile remains rendered when `selectedView === 'fsb-avg-agents-per-user'`. No new TS imports introduced.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: P2a -- punchcard tick precision (Math.round in callbacks, precision: 0)</name>
  <files>showcase/angular/src/app/pages/stats/stats-page.component.ts</files>
  <behavior>
    - Floating-point tick value `v = 14.0000000002` must yield `"14:00"` (x-axis) and `"Wed"` (y-axis at v = 3.0000000001), not `undefined` / `""`.
    - `precision: 0` is present on both x and y axis ticks configs of the commits-over-time case so Chart.js requests integer-stepped ticks.
    - Existing integer behaviour preserved: `v = 14` -> `"14:00"`; `v = 3` -> `"Wed"`.
  </behavior>
  <action>
In stats-page.component.ts, locate the `case 'commits-over-time':` block in `buildChartConfig()` (~line 786-844). Modify the `scales` object as follows:

```typescript
scales: {
  x: {
    type: 'linear',
    min: -0.5,
    max: 23.5,
    ticks: {
      color: tokens.muted,
      stepSize: 3,
      precision: 0,                                       // <-- NEW (P2 fix)
      callback: (v: number) => `${Math.round(v)}:00`,     // <-- Math.round wrap
    },
    grid: { color: tokens.border },
  },
  y: {
    type: 'linear',
    min: -0.5,
    max: 6.5,
    ticks: {
      color: tokens.muted,
      stepSize: 1,
      precision: 0,                                       // <-- NEW (P2 fix)
      callback: (v: number) =>
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Math.round(v)] ?? '',
                                                          // <-- Math.round wrap
    },
    grid: { color: tokens.border },
  },
},
```

Add a one-line comment above the scales block: `// Quick task 260515-mfs (P2) -- precision:0 + Math.round(v) guards against float drift on linear axes with non-integer min/max (Codex P2 on PR #58).`

Do NOT modify the `min: -0.5` / `max: 6.5` extents (those produce the visual padding around the punchcard grid; bumping them would re-introduce the same float-drift risk on tick centers).

Do NOT touch any other case in the switch (`stars-cumulative`, `stars-weekly`, `forks-growth`, etc.) -- their axes are categorical labels indexed by string, not continuous linear scales.
  </action>
  <verify>
    <automated>cd /Users/lakshmanturlapati/Desktop/FSB/main/showcase/angular && npx ng build --configuration=production 2>&1 | tail -10 && grep -n "precision: 0" /Users/lakshmanturlapati/Desktop/FSB/main/showcase/angular/src/app/pages/stats/stats-page.component.ts | head -5 && grep -n "Math.round(v)" /Users/lakshmanturlapati/Desktop/FSB/main/showcase/angular/src/app/pages/stats/stats-page.component.ts | head -5</automated>
  </verify>
  <done>
    Production Angular build exits 0. Source contains `precision: 0` exactly 2 times (once per axis in commits-over-time). Source contains `Math.round(v)` at least 2 times in the commits-over-time case (one per axis callback). No other case mutated.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: P2b -- plumb raw count `c` through PunchcardPoint, fix tooltip, update test</name>
  <files>showcase/angular/src/app/core/stats/github-stats.service.ts, showcase/angular/src/app/pages/stats/stats-page.component.ts, tests/stats-chart-overhaul.test.js, .planning/quick/260515-kw1-replace-8-stats-chart-views-with-richer-/260515-kw1-SUMMARY.md</files>
  <behavior>
    - `PunchcardPoint` interface gains a `c: number` field (raw bucket count, integer >= 1).
    - `commitPunchcard(commits)` returns objects of shape `{ x, y, r, c }` where `c` is the un-scaled commit count for that (weekday, hour) bucket and `r` is unchanged (still `Math.max(3, Math.min(20, Math.sqrt(count) * 4))`).
    - Single commit at 2024-06-05T14:30:00Z -> one point with `c === 1` AND `r === 4` (sqrt(1)*4 = 4).
    - 5 commits in same bucket -> one point with `c === 5` AND `r === Math.sqrt(5)*4` (~8.944).
    - 50 commits in same bucket -> one point with `c === 50` AND `r === 20` (radius clamp does NOT affect c).
    - Tooltip for a (weekday=Wed, hour=14, count=5) bubble reads `"Wed 14:00 -- 5 commits"`; for count=1 reads `"Wed 14:00 -- 1 commit"` (singularised).
    - Regression test asserts every returned point has a numeric `c` field independent of `r`.
  </behavior>
  <action>
**Step 3a -- github-stats.service.ts:**

1. Update the `PunchcardPoint` interface declaration (line 413):

```typescript
/**
 * Punchcard cell -- one bubble in the GitHub-style "commits by hour of day +
 * weekday" view. `x` is the UTC hour (0-23), `y` is the UTC weekday
 * (0=Sun..6=Sat), `r` is the sqrt-scaled commit count clamped to 3..20 px
 * so a busy bucket does not dominate the canvas, and `c` is the raw
 * un-scaled commit count for that bucket -- used by the tooltip so users
 * see "5 commits" instead of the meaningless radius value (Codex P2 on PR #58).
 */
export interface PunchcardPoint { x: number; y: number; r: number; c: number }
```

2. Update the `commitPunchcard` function body (~line 627-648) -- inside the `for (const [key, count] of buckets.entries())` loop, change the push to include `c: count`:

```typescript
out.push({ x: hour, y: weekday, r, c: count });
```

(That is the only line change in the function; `r` calculation is unchanged.)

**Step 3b -- stats-page.component.ts:**

In the `case 'commits-over-time':` block (~line 786-844), replace the tooltip callbacks with a count-aware formatter:

```typescript
plugins: {
  ...baseOpts.plugins,
  tooltip: {
    enabled: true,
    callbacks: {
      label: (ctx: any) => {
        // Quick task 260515-mfs (P2) -- show raw commit count from `c`, not
        // the sqrt-scaled `r` (which is just a bubble-size hint). Codex P2 on PR #58.
        const raw = ctx?.raw ?? {};
        const count = typeof raw.c === 'number' ? raw.c : 0;
        const x = typeof raw.x === 'number' ? Math.round(raw.x) : 0;
        const y = typeof raw.y === 'number' ? Math.round(raw.y) : 0;
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][y] ?? '';
        const hour = String(x).padStart(2, '0');
        const noun = count === 1 ? 'commit' : 'commits';
        return `${weekday} ${hour}:00 -- ${count} ${noun}`;
      },
    },
  },
},
```

Do NOT change the surrounding `scales` block (Task 2 already touched it).

**Step 3c -- tests/stats-chart-overhaul.test.js:**

In Suite A, do TWO things:

(a) Update the local re-implementation `commitPunchcardLocal()` (lines ~51-70) to mirror the new shape -- inside the for-loop, change the push:

```javascript
out.push({ x: Number(hrStr), y: Number(wdStr), r, c: count });
```

(b) Add new assertions A7, A8, A9 AFTER the existing A6 source-snapshot block (around line 147). Increment `passed`/`failed` accounting via the existing `check()` helper:

```javascript
// A7. Single commit -> c === 1 (raw count, independent of sqrt-scaled r).
{
  const result = commitPunchcardLocal([
    { commit: { author: { date: '2024-06-05T14:30:00Z' } } },
  ]);
  check('commitPunchcard: single commit -> c=1 (raw count field)',
    result.length === 1 && result[0].c === 1,
    `expected c:1, got ${JSON.stringify(result)}`);
}

// A8. 5 commits same bucket -> c === 5 even though r is sqrt-scaled.
{
  const same = [];
  for (let i = 0; i < 5; i++) {
    same.push({ commit: { author: { date: '2024-06-05T14:00:00Z' } } });
  }
  const result = commitPunchcardLocal(same);
  check('commitPunchcard: 5 commits same bucket -> c=5 (raw, unaffected by sqrt scaling)',
    result.length === 1 && result[0].c === 5,
    `expected c:5, got ${JSON.stringify(result)}`);
}

// A9. 50 commits same bucket -> c === 50 (radius clamp at 20 does NOT touch c).
{
  const many = [];
  for (let i = 0; i < 50; i++) {
    many.push({ commit: { author: { date: '2024-06-05T14:00:00Z' } } });
  }
  const result = commitPunchcardLocal(many);
  check('commitPunchcard: 50 commits same bucket -> c=50 (radius clamp does not affect c)',
    result.length === 1 && result[0].c === 50 && result[0].r === 20,
    `expected c:50 r:20, got ${JSON.stringify(result)}`);
}

// A10. Source snapshot -- production helper still emits the `c` field.
{
  let src = '';
  try { src = fs.readFileSync(SERVICE_PATH, 'utf8'); } catch { /* swallow */ }
  check('commitPunchcard: PunchcardPoint interface declares c: number',
    /export\s+interface\s+PunchcardPoint\s*\{[^}]*\bc\s*:\s*number\b/.test(src),
    'PunchcardPoint c: number field not found in interface declaration');
  check('commitPunchcard: production push includes c: count',
    /out\.push\(\s*\{[^}]*\bc\s*:\s*count\b/.test(src),
    'commitPunchcard push site does not include c: count -- did someone drop the raw count field?');
}
```

**Step 3d -- 260515-kw1-SUMMARY.md (minimal tweak):**

Locate the "Tests" bullet in `.planning/quick/260515-kw1-replace-8-stats-chart-views-with-richer-/260515-kw1-SUMMARY.md` (likely under a `## What changed` or `## Tests` heading). Append a single sentence: `Test contract updated by quick task 260515-mfs: PunchcardPoint now includes a c (raw count) field; tests assert c is independent of the sqrt-scaled r.` Do NOT restructure the SUMMARY -- one trailing sentence on the existing tests bullet is sufficient. If the SUMMARY has no "Tests" bullet at all, append a one-line `**Tests:**` note instead.
  </action>
  <verify>
    <automated>cd /Users/lakshmanturlapati/Desktop/FSB/main && node tests/stats-chart-overhaul.test.js && cd showcase/angular && npx ng build --configuration=production 2>&1 | tail -10</automated>
  </verify>
  <done>
    `node tests/stats-chart-overhaul.test.js` exits 0 with all assertions passing (suite count grows by at least 5: the 3 new c-field assertions A7-A9 + 2 new source-snapshot assertions A10). Production Angular build exits 0. `commitPunchcard()` returns `{ x, y, r, c }` objects. Tooltip in commits-over-time case reads `ctx.raw.c`, never `ctx.raw.r`. SUMMARY.md has the one-sentence test-contract note.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Push to origin + post acknowledgement reply on PR #58</name>
  <files>(git operations only; no source edits)</files>
  <what-built>
    Three Codex review findings fixed in 3 atomic commits on `feat/stats-chart-overhaul`:
      - P1 canvas mount race -> `[hidden]` binding (Task 1)
      - P2a punchcard tick precision -> `precision: 0` + `Math.round(v)` (Task 2)
      - P2b punchcard tooltip + `c` field plumbing + test/SUMMARY update (Task 3)
  </what-built>
  <how-to-verify>
    Run BEFORE the push:

    ```bash
    cd /Users/lakshmanturlapati/Desktop/FSB/main
    git status --short
    git log --oneline -5
    node tests/stats-chart-overhaul.test.js
    (cd showcase/angular && npx ng build --configuration=production 2>&1 | tail -5)
    ```

    Expect: 3 new commits atop the PR #58 tip on `feat/stats-chart-overhaul`, all assertions PASS, production build exits 0, working tree clean.

    Then push and reply (do NOT merge):

    ```bash
    git push origin feat/stats-chart-overhaul
    gh pr comment 58 --body "Thanks for the careful review. All three findings addressed in the latest commits on \`feat/stats-chart-overhaul\`:

    - **P1 (canvas mount race):** \`stats-page.component.html\` now keeps \`<canvas #chartCanvas>\` mounted unconditionally inside \`.chart-mount\`, toggling visibility via \`[hidden]=\"selectedView === 'fsb-avg-agents-per-user'\"\`. The big-number tile renders in parallel under the same parent. \`@ViewChild('chartCanvas')\` resolves on first paint regardless of which view is selected, so \`redrawChart()\` never has to wait for a change-detection tick.
    - **P2a (punchcard tick precision):** Both x and y axes of the commits-over-time case now set \`precision: 0\` and wrap the callback's \`v\` with \`Math.round(v)\` before indexing. Floating-point drift on linear axes with non-integer \`min/max\` no longer yields \`undefined\` ticks.
    - **P2b (punchcard tooltip):** \`PunchcardPoint\` gained a \`c: number\` field carrying the raw bucket count, plumbed through \`commitPunchcard()\` in \`github-stats.service.ts\`. The tooltip callback now reads \`ctx.raw.c\` and formats as \`{weekday} {hour}:00 -- {count} commit(s)\` (singularised when count === 1). \`tests/stats-chart-overhaul.test.js\` extended with 5 new assertions pinning the \`c\` field independent of the sqrt-scaled \`r\`.

    Full \`npm test\` chain remains green; production \`ng build\` exits 0. Not merging from this side -- leaving that to you."
    ```

    Confirm:
      1. \`git push origin feat/stats-chart-overhaul\` exits 0 and the new commits appear at https://github.com/LakshmanTurlapati/FSB/pull/58/commits
      2. The PR #58 conversation now has a new reply comment under your name acknowledging the three findings
      3. The PR is NOT merged
  </how-to-verify>
  <resume-signal>Type "approved" once the push lands and the reply comment is visible on PR #58. Describe any push/auth/gh-cli issues otherwise.</resume-signal>
</task>

</tasks>

<verification>
- `node tests/stats-chart-overhaul.test.js` exits 0 with all assertions PASS (16 prior + 5 new = 21+).
- `cd showcase/angular && npx ng build --configuration=production` exits 0.
- `<canvas #chartCanvas>` appears in `.chart-mount` regardless of `selectedView`.
- `precision: 0` appears exactly twice in the `commits-over-time` case (one per axis).
- `commitPunchcard()` return objects have a `c` field equal to the raw count, with `r` unchanged.
- Tooltip in commits-over-time reads count, not radius.
- Branch `feat/stats-chart-overhaul` pushed to origin with 3 new commits atop the PR #58 tip.
- Single acknowledgement reply comment posted on PR #58 (no merge).
</verification>

<success_criteria>
- All 3 Codex findings (P1 + P2a + P2b) addressed with minimal, targeted edits.
- SSR contract preserved (no new chart.js imports outside `afterNextRender`).
- View IDs unchanged.
- Existing test suite passes; new assertions added for the new contract.
- 260515-kw1-SUMMARY.md has a one-sentence note about the test-contract update (PunchcardPoint now has `c`).
- PR #58 updated on origin; user acknowledged the fixes in a single reply comment; PR not merged.
</success_criteria>

<output>
After completion, create `.planning/quick/260515-mfs-fix-3-codex-p1-p2-findings-on-pr-58-canv/260515-mfs-SUMMARY.md` summarising: which 3 findings were fixed, file diff stats, test assertion delta, push hash range, PR comment URL.
</output>
