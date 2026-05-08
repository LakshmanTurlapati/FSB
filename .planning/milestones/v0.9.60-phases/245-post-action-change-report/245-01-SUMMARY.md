---
phase: 245
plan: 01
subsystem: extension/utils
tags: [change-report, mutation-observer, action-verification, mcp]
requires: []
provides:
  - extension/utils/action-verification.js#startMutationHarvest
  - extension/utils/action-verification.js#stopMutationHarvest
  - extension/utils/action-verification.js#buildChangeReport
  - extension/utils/action-verification.js#applyChangeReportSizeCap
affects:
  - tests/change-report-builder.test.js
  - tests/change-report-size-cap.test.js
  - tests/change-report-cross-origin.test.js
  - package.json
tech-stack:
  added: []
  patterns:
    - Plain-Node assert tests (no jest/mocha)
    - Scoped MutationObserver per D-02
    - Synthetic MutationRecord stubs for unit testing
key-files:
  created:
    - tests/change-report-builder.test.js
    - tests/change-report-size-cap.test.js
    - tests/change-report-cross-origin.test.js
  modified:
    - extension/utils/action-verification.js
    - package.json
decisions:
  - D-02 implemented: scope walks up to 3 ancestors looking for form/dialog/main, falls back to documentElement
  - D-03 implemented: style-only, scroll attr, aria-hidden=true-stayed-true, sub-3-char text, animation-class noise filtered
  - D-04 implemented: full output shape with 11 fields, 2400-byte cap, per-bucket slice limits 3/5/5/8
  - D-08 implemented: crossOrigin option short-circuits to URL-only report with cross_origin:true
metrics:
  duration: under 30 minutes
  tasks: 3
  files: 5
  completed: 2026-05-06
---

# Phase 245 Plan 01: change_report builder + size cap + filter rules Summary

Landed the four new exports (`startMutationHarvest`, `stopMutationHarvest`, `buildChangeReport`, `applyChangeReportSizeCap`) in `extension/utils/action-verification.js` plus three plain-Node assert tests covering shape, size cap, and cross-origin path. Existing `capturePageState` / `comparePageStates` are byte-identical (still used by stuck detection per D-10). All 24 new test assertions pass.

## What was built

### `extension/utils/action-verification.js` additions

Added at module scope (lines 12-26):
- `ANIMATION_CLASS_RE` -- regex matching `animate-*`, `motion-*`, `*-enter*`, `*-leave*`, `*-active`, `*-show*`, `*-hide*` for D-03 filter
- `CHANGE_REPORT_SIZE_CAP_BYTES = 2400`
- `CAP_DIALOGS = 3`, `CAP_NODES_ADDED = 5`, `CAP_NODES_REMOVED = 5`, `CAP_ATTRS_CHANGED = 8`
- `TEXT_SNIPPET_MAX = 80` (T-245-01 mitigation)

Added between `verifyNavigationEffect` and the `module.exports` block (approximately lines 252-486):
- `buildNodeSelector(node)` -- selector heuristic `#id` -> `tag.first-class` -> `tag`
- `snippetText(raw)` -- 80-char trim
- `resolveScopeRoot(targetSelector)` -- D-02 walk: up to 3 parents, prefers `<form>` / `<dialog>` / `<main>`
- `startMutationHarvest(targetSelector)` -- returns `{ observer, mutations: [], startedAt, scopeRoot }`; observer config `{ subtree, childList, attributes, attributeOldValue, characterData, characterDataOldValue }`
- `stopMutationHarvest(handle)` -- disconnects, returns `{ mutations, settle_ms }`
- `isNoiseMutation(record)` -- D-03 filter implementation
- `isDialogNode(node)` -- detects `<dialog>`, `role=dialog|alertdialog`, or `.modal`/`.popup` with `offsetWidth > 0`
- `buildChangeReport(beforeState, afterState, mutations, options)` -- D-04 shape, with D-08 short-circuit when `options.crossOrigin === true`
- `applyChangeReportSizeCap(report)` -- measures `JSON.stringify(report).length`, slices to per-bucket limits when over budget, sets `truncated: true`

`module.exports` extended to export the four new symbols alongside the existing six.

### Tests created

`tests/change-report-builder.test.js` -- 15 assertions covering:
- URL change detection (`url.changed`)
- Title change (`title_changed`)
- `nodes_added` populated by childList add (CHANGE-02)
- `inputs_changed.email.after === 'user@example.com'` from before/after `inputValues` delta (CHANGE-02)
- `settle_ms` reflects `options.settleMs`
- `mutation_count` is RAW (pre-filter) count
- Style-only attribute filtered out
- Animation-class flip filtered out
- Real `disabled` attribute change survives filter
- `aria-hidden=true` that stayed true filtered
- Sub-3-char `characterData` filtered
- `<dialog>` triggers `dialogs_opened`
- `role="dialog"` triggers `dialogs_opened`
- `focus_shift` reflects `activeElementSelector` delta
- `focus_shift === null` when unchanged
- All 11 D-04 keys present

`tests/change-report-size-cap.test.js` -- 4 assertions covering:
- Pre-cap report has full arrays and `truncated:false`
- Noisy fixture (50 added / 30 removed / 40 attrs) post-cap returns `nodes_added.length === 5`, `nodes_removed.length === 5`, `attrs_changed.length === 8`, `truncated: true`, `JSON.stringify(report).length < 2500` (CHANGE-04)
- Small report under cap passes through with `truncated:false`
- D-09 informal performance: builder runs <50ms on 120-mutation fixture (averaged 5 runs)

`tests/change-report-cross-origin.test.js` -- 5 assertions covering:
- `crossOrigin:true` emits `cross_origin:true` with all empty arrays, `mutation_count:0`, `settle_ms:0`
- `url.changed` reflects URL delta even on cross-origin path
- Same-URL cross-origin works
- `crossOrigin` omitted -> normal DOM path, no `cross_origin` field
- T-245-04: cross-origin path drops mutations array entirely (no DOM data leaks into report)

### Filter rules implemented (D-03)

| Rule | Trigger | Filter logic |
|------|---------|--------------|
| Style-only | `attributes`, `attributeName === 'style'` | Always dropped |
| Animation class | `attributes`, `attributeName === 'class'`, only animation-pattern tokens diffed | Dropped via `ANIMATION_CLASS_RE` plus token-set diff |
| Scroll position | `attributes`, `attributeName in {scrollTop, scrollLeft}` | Always dropped |
| aria-hidden stayed | `attributes`, `attr === 'aria-hidden'`, oldValue=='true' && newValue=='true' | Dropped |
| Sub-3-char text | `characterData` with new+old both `< 3` chars OR delta `< 3` and new `< 3` | Dropped |

`mutation_count` reports the **raw** array length (not post-filter), so callers can compare it against `nodes_added + nodes_removed + attrs_changed.length` to see how aggressive filtering was on a given action.

### Decisions implemented

- D-02 (scope) -- ancestor-of-target via 3-level parent walk, fallback to `document.documentElement`
- D-03 (filters) -- 5 noise filters as table above
- D-04 (output shape) -- 11 fields exactly per CONTEXT.md, plus optional `cross_origin` when D-08 path taken
- D-08 (cross-origin) -- `options.crossOrigin: true` short-circuits before any DOM inspection; no leak path

## Test results

Running the three tests standalone:

```
node tests/change-report-builder.test.js     -> 15 passed, 0 failed
node tests/change-report-size-cap.test.js    -> 4 passed, 0 failed
node tests/change-report-cross-origin.test.js -> 5 passed, 0 failed
```

Total: **24/24 PASS**.

## Deviations from Plan

### `npm test` chain failure is pre-existing, not caused by this plan

`npm test` does not reach our three new tests because the chain short-circuits at `tests/mcp-version-parity.test.js` with 6 FAILs:

```
FAIL: mcp/package.json version stays on canonical version parity target (expected: 0.7.4, got: 0.8.0)
FAIL: FSB_MCP_VERSION matches canonical package version (expected: 0.7.4, got: 0.8.0)
FAIL: server.json top-level version matches canonical package version (expected: 0.7.4, got: 0.8.0)
FAIL: server.json package version matches canonical package version (expected: 0.7.4, got: 0.8.0)
FAIL: help output prints canonical MCP version
FAIL: install output prints canonical MCP version
```

**Pre-existing baseline confirmed** by `git stash` round-trip: the same 6 FAILs occur before our changes. The MCP package was bumped to 0.8.0 in the v0.9.60 milestone but `mcp-version-parity.test.js` still hard-codes `0.7.4` as the canonical target. Out of scope for Plan 245-01 -- needs a separate version-parity-test update plan.

Per scope-boundary rule: not auto-fixed. Logged here for follow-up. Our 3 new tests are correctly appended to the chain (verified with `grep -o` on `package.json` -- they appear after `agent-registry.test.js`). When the parity test is fixed, `npm test` will reach our new tests and they will pass (proven by standalone runs).

## Caveats / follow-ups for Plan 02

1. **Dispatcher wiring (Plan 02 task)**: `extension/ws/mcp-tool-dispatcher.js` needs to call `startMutationHarvest(targetSelector)` immediately before each non-read tool invocation, then `stopMutationHarvest(handle)` after `waitForDOMStable()` resolves (or 500ms safety net). The `settle_ms` from `stopMutationHarvest` should flow into `buildChangeReport({ settleMs })`.

2. **Cross-origin detection (D-08, Plan 02 task)**: Dispatcher needs to compare `chrome.tabs.get(tabId).url` origin before/after action and pass `options.crossOrigin: true` when origins differ. The builder is ready; the call-site is not yet wired.

3. **`partial:true` flag (D-09, Plan 02 task)**: When `settle_ms > 500` (safety-net hit), dispatcher should set `report.partial = true` post-build. The current builder leaves this to the caller.

4. **`_emitChangeReport` flag (D-05/D-06, Plan 02 task)**: Tool definitions in `extension/ai/tool-definitions.js` need the per-tool opt-in flag; dispatcher checks it before instrumenting.

5. **Global toggle (D-07, Plan 02 task)**: `fsbChangeReportsEnabled` storage flag + Advanced Settings UI in `options.html`.

6. **CHANGE-01 / CHANGE-03 / CHANGE-05 (Plan 02)**: Full integration / dispatcher tests close these acceptance criteria. Plan 01 closes CHANGE-04 outright and partially proves CHANGE-02 / CHANGE-03 at the unit level.

## Commit

```
b6d8797 feat(245-01): add change_report builder + size cap + filter rules to action-verification
```

5 files changed, 864 insertions(+), 2 deletions(-). Branch `Refinements`. No push, no PR (per branch lock).

## Self-Check: PASSED

- `extension/utils/action-verification.js` modified (verified via `git show --stat b6d8797`)
- `tests/change-report-builder.test.js` exists, 15 PASS standalone
- `tests/change-report-size-cap.test.js` exists, 4 PASS standalone
- `tests/change-report-cross-origin.test.js` exists, 5 PASS standalone
- `package.json` test script extended to include all three (verified via `grep -o` on `package.json`)
- Commit `b6d8797` exists on `Refinements`
- Subject matches `feat(245-01): add change_report builder + size cap + filter rules to action-verification`
