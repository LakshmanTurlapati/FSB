---
phase: 261-i18n-scaffold
plan: 04
subsystem: showcase-ci-invariants
tags: [i18n, ci, bundle-budget, locale-sync, github-actions]
requirements_addressed: [CI-05, ROUTE-02]
dependency_graph:
  requires:
    - 261-01 (verify-locale-sync.mjs script + locale-constants modules)
    - 261-02 (Angular per-locale build producing dist/showcase-angular/browser/{,es,de,ja,zh-CN,zh-TW}/)
  provides:
    - per-locale gzipped main-bundle budget enforcement (CI-05)
    - locale-registry parity CI invariant wired pre-build (ROUTE-02 CI side)
  affects:
    - .github/workflows/ci.yml (website job extended; other jobs unchanged)
tech-stack:
  added: []
  patterns:
    - Node built-in zlib.gzipSync for bundle-size checks (no npm dep)
    - Hardcoded 6-locale list in the verify script (intentional duplication so the script runs without ts-node)
    - Two-step CI activation for the i18n template lint (261 ships configurable script; 262 promotes to CI hard-fail)
key-files:
  created:
    - showcase/angular/scripts/verify-bundle-budgets.mjs
  modified:
    - .github/workflows/ci.yml
decisions:
  - Reworded the post-step explanatory comment to avoid the literal substring `lint:i18n`, because the plan's own structural verification (line 353 of 261-04-PLAN.md and the milestone success criterion `grep -c 'lint:i18n' .github/workflows/ci.yml` must return 0) forbids that substring. Intent preserved -- comment now references "Plan 03's i18n template-lint npm script" with identical semantic meaning.
metrics:
  duration_minutes: 5
  tasks_completed: 3
  files_created: 1
  files_modified: 1
  commits: 4
  completed_date: 2026-05-12T13:14:54Z
---

# Phase 261 Plan 04: Bundle-Budget Script + CI Wiring Summary

CI-05 enforced via a 37-line Node script using `zlib.gzipSync` and wired into `.github/workflows/ci.yml`'s `website` job alongside Plan 01's locale-sync invariant.

## Objective Recap

Ship the per-locale gzipped bundle-budget enforcement script (`verify-bundle-budgets.mjs`) and wire BOTH that script AND Plan 01's `verify-locale-sync.mjs` into `.github/workflows/ci.yml`'s `website` job. The locale-sync step runs BEFORE the Angular build (gates the build on registry parity); the bundle-budget step runs AFTER the build (gates merge on per-locale main bundle <= 1 MB gzipped). The `lint:i18n` script from Plan 03 is intentionally NOT added to CI in Phase 261 (two-step activation locked).

## Tasks Completed

| Task | Name                                                                       | Commit    |
| ---- | -------------------------------------------------------------------------- | --------- |
| 1    | Create verify-bundle-budgets.mjs script                                    | `dd0e1aa` |
| 2    | Run bundle-budget script against Plan 02 dist (empirical verification)     | `f8508a3` |
| 3    | Wire verify-locale-sync.mjs (pre-build) + verify-bundle-budgets.mjs (post-build) into ci.yml | `0e873fb` |

Note on commit ordering: Plan 04 ran in parallel with Plan 03 (Wave 2). The empirical verification commit for Task 2 (an empty commit, since Task 2 modifies no source files) was recorded after Task 3's CI-wiring commit for workflow convenience, but Task 2 was logically and physically verified between Tasks 1 and 3 (the script must exist for Task 2 to run, and Task 3 wires the verified script). Plan 03's commits `e2f78cf` and `9728c41` also interleave in `git log` due to parallel execution.

## Per-Locale Gzipped Bundle Baseline (v0.9.63)

```
  (source/en)  main-47IUUEHY.js  raw=12294 gz=3351  OK
  es           main-47IUUEHY.js  raw=12294 gz=3351  OK
  de           main-47IUUEHY.js  raw=12294 gz=3351  OK
  ja           main-47IUUEHY.js  raw=12294 gz=3351  OK
  zh-CN        main-47IUUEHY.js  raw=12294 gz=3351  OK
  zh-TW        main-47IUUEHY.js  raw=12294 gz=3351  OK
```

Every locale: ~3.3 KB gzipped, ~12 KB raw, well under the locked 1 MB gzipped budget (CI-05). The Plan 02 build emits an identical `main-47IUUEHY.js` for every locale in the current pre-string-marking state (no `$localize` substitutions yet means template emit produces byte-identical main bundles; Phase 262 will introduce real per-locale divergence). This is the Phase 261 baseline; future regressions will be caught by the script.

## Files Created

- `showcase/angular/scripts/verify-bundle-budgets.mjs` (37 lines, ESM, Node-only)
  - Imports: `node:fs`, `node:zlib`, `node:path` (zero npm deps)
  - `LIMIT_BYTES = 1024 * 1024` (1 MB, hardcoded -- no env-var override)
  - `LOCALES = ['', 'es', 'de', 'ja', 'zh-CN', 'zh-TW']` (empty string = source locale at dist root, per Plan 02 `sourceLocale.subPath: ""`)
  - Regex `/^main-[\w-]+\.js$/` matches Angular's `outputHashing: "all"` convention
  - Exits 0 on all-pass; exits 1 with stderr diagnostic on any per-locale FAIL

## Files Modified

- `.github/workflows/ci.yml`
  - Added two steps to the `website` job:
    1. `Verify locale registry parity (Angular vs Express)` -- invokes `node showcase/angular/scripts/verify-locale-sync.mjs` BEFORE `Build Angular showcase`
    2. `Verify per-locale gzipped bundle budget (CI-05)` -- invokes `node showcase/angular/scripts/verify-bundle-budgets.mjs` AFTER `Build Angular showcase`
  - Added an explanatory comment block documenting the deliberate omission of Plan 03's i18n template-lint npm script (two-step activation; Phase 262 promotes)
  - `extension`, `mcp-smoke`, `all-green` jobs UNCHANGED
  - Step versions (`actions/checkout@v4`, `actions/setup-node@v4`) UNCHANGED

## Verification

- `node --check showcase/angular/scripts/verify-bundle-budgets.mjs` -- exits 0 (valid ESM syntax)
- `node showcase/angular/scripts/verify-bundle-budgets.mjs` against the current dist -- exits 0; prints 6 OK lines + `All locales within gzipped budget.`
- `node showcase/angular/scripts/verify-locale-sync.mjs` -- exits 0; prints `Locale registry parity verified: ["en","es","de","ja","zh-CN","zh-TW"]`
- `grep -c 'lint:i18n' .github/workflows/ci.yml` returns `0` (substring confirmed absent)
- Structural ci.yml check (from PLAN Task 3 `<verify>`) passes:
  - locale-sync step present
  - locale-sync invocation present
  - bundle-budget step present
  - bundle-budget invocation present
  - `lint:i18n` substring NOT present
  - step order: locale-sync < build < bundle-budget (indices 1879 < 2096 < 2237 per `node -e` script)

## Two-Step Activation Confirmation

`lint:i18n` (Plan 03's npm script invoking the `@angular-eslint/template/i18n` rule) is NOT in `.github/workflows/ci.yml`. The rule is installed and runnable locally via `npm --prefix showcase/angular run lint:i18n`, but it is NOT a CI hard-block in Phase 261 (locked Decision D-09).

**Forward reference:** Phase 262 promotes the lint step to a mandatory CI gate in this same `website` job, after every visible string in the showcase shell + 5 marketing pages has been marked with `i18n="@@id"`. The explanatory comment block added to ci.yml documents this for the Phase 262 planner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded explanatory comment to avoid literal `lint:i18n` substring**

- **Found during:** Task 3 verification step
- **Issue:** The plan's `<action>` (lines 313-318 of 261-04-PLAN.md) mandates a comment block that includes the literal `npm --prefix showcase/angular run lint:i18n`. The plan's own `<verify><automated>` (line 353) and the milestone success criterion `grep -c 'lint:i18n' .github/workflows/ci.yml` must return 0 BOTH forbid that substring. The two are self-contradictory; the structural verification automation enforces the no-substring rule.
- **Fix:** Wrote the comment block with semantically identical wording -- replaced the literal `npm --prefix showcase/angular run lint:i18n` with `Plan 03's i18n template-lint npm script`. Intent (document the deliberate omission, point readers at the locked two-step activation, hand off to Phase 262 planner) is fully preserved.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `0e873fb`

No other deviations. Plan executed as written.

## Plan 04's Contribution to Phase 261 Closure

With Plans 01/02/03/04 merged, all 8 Phase 261 REQ-IDs are addressed:

- I18N-01..05: addressed by Plans 01 + 02 (`@angular/localize@^20.3.19` install, polyfill, six-locale build, per-locale dist with `<html lang>` substitution)
- ROUTE-02: addressed by Plan 01 (locale-constants module + verify-locale-sync.mjs) and the CI side by Plan 04 (locale-sync wired pre-build in ci.yml)
- CI-03: addressed by Plan 03 (eslint flat config + lint:i18n npm script, runnable but not yet CI-gated per the locked two-step activation)
- CI-05: addressed by Plan 04 (verify-bundle-budgets.mjs script + CI post-build step)

Phase 261's SC#1..#4 are empirically verified:
- SC#1 (per-locale prerendered HTML for 6 locales): Plan 02 task evidence + this plan's empirical Task 2 confirms the dist layout exists
- SC#2 (bundle budgets hold per locale): this plan's empirical Task 2 confirms green on all 6 locales
- SC#3 (lint rule blocks unmarked strings when invoked): Plan 03 evidence
- SC#4 (locale-constants mirrored + CI invariant asserts sync): Plan 01 + this plan's CI-wiring evidence

## Self-Check: PASSED

- FOUND: `showcase/angular/scripts/verify-bundle-budgets.mjs`
- FOUND: `.github/workflows/ci.yml` (modified -- verified by diff against pre-Plan-04 state)
- FOUND commit dd0e1aa (Task 1)
- FOUND commit f8508a3 (Task 2 empirical evidence)
- FOUND commit 0e873fb (Task 3)
- FOUND: `grep -c 'lint:i18n' .github/workflows/ci.yml` returns 0
- FOUND: `node showcase/angular/scripts/verify-bundle-budgets.mjs` exits 0
- FOUND: `node showcase/angular/scripts/verify-locale-sync.mjs` exits 0
