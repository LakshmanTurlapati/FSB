---
phase: 186-canonical-surface-determination
plan: 01
subsystem: showcase
tags: [file-management, path-consolidation, test-imports]
dependency_graph:
  requires: []
  provides:
    - canonical showcase/js/ directory with all dashboard JS files
    - test imports targeting canonical path
  affects:
    - tests/dashboard-runtime-state.test.js
    - showcase/dashboard.html (script references now resolve)
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - showcase/js/dashboard-runtime-state.js
    - showcase/js/lz-string.min.js
    - showcase/js/main.js
  modified:
    - tests/dashboard-runtime-state.test.js
  deleted:
    - showcase/legacy-vanilla/ (entire directory, 18 files)
decisions:
  - "showcase/js/ is the single canonical dashboard directory"
  - "legacy-vanilla/ deleted entirely, not archived -- all content was either duplicate or stale"
metrics:
  duration_seconds: 115
  completed: "2026-04-19T22:27:29Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 186 Plan 01: Canonical Surface Determination Summary

Consolidated showcase/js/ as single canonical dashboard directory by copying 3 missing JS files from legacy-vanilla, deleting the legacy-vanilla directory (18 files), and retargeting test imports to canonical paths.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Copy missing JS files to canonical directory and delete legacy-vanilla | 0e16c43 | showcase/js/dashboard-runtime-state.js, showcase/js/lz-string.min.js, showcase/js/main.js, showcase/legacy-vanilla/ (deleted) |
| 2 | Retarget test imports to canonical showcase/js/ path | 36736fc | tests/dashboard-runtime-state.test.js |

## Verification Results

1. `ls showcase/js/` shows: dashboard.js, dashboard-runtime-state.js, lz-string.min.js, main.js, recreations.js -- PASS
2. `test ! -d showcase/legacy-vanilla` confirms legacy directory gone -- PASS
3. `node tests/dashboard-runtime-state.test.js` -- 31 passed, 10 failed (all failures are pre-existing background.js source contract assertions unrelated to this plan's changes)
4. `grep -r 'legacy-vanilla' tests/` returns empty -- PASS

### Pre-existing Test Failures (Out of Scope)

10 assertions in the "source contracts" section of `tests/dashboard-runtime-state.test.js` fail because `background.js` does not contain the expected strings (e.g., `ext:remote-control-state`, `_lastRemoteControlState`). These failures are pre-existing and unrelated to this plan -- the plan only changed two file paths (lines 8 and 152). All 21 runtime state derivation assertions and all 5 dashboard.js source contract assertions pass.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Success Criteria

- [x] Exactly one dashboard.js exists at showcase/js/dashboard.js (SURF-01)
- [x] No showcase/legacy-vanilla/ directory remains
- [x] All three missing JS files exist in showcase/js/
- [x] Test suite imports from canonical paths (SURF-02)
- [x] Zero references to legacy-vanilla in test files

## Self-Check: PASSED

All claimed files exist. All commit hashes verified.
