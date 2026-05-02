---
phase: 223
plan: 01
subsystem: testing
tags: [tdd, wave-0, static-analysis, rebrand, metrics]
provides:
  - tests/remote-control-rebrand.test.js
  - tests/metrics-wireup.test.js
  - tests/dashboard-metrics-render.test.js
  - "package.json::scripts.test wiring for the three new tests"
requires:
  - tests/sync-tab-runtime.test.js (Phase 209/213 contract; preserved untouched)
affects:
  - npm test chain (3 new entries appended)
tech-stack:
  added: []
  patterns:
    - "Plain Node + fs static-analysis (no jest, no jsdom)"
    - "Local pass/fail counters mirroring tests/sync-tab-runtime.test.js"
key-files:
  created:
    - tests/remote-control-rebrand.test.js
    - tests/metrics-wireup.test.js
    - tests/dashboard-metrics-render.test.js
  modified:
    - package.json
decisions:
  - "Wave 0 TDD: tests authored to FAIL today; Plans 02 + 03 land implementation that turns them GREEN."
  - "Defense-in-depth: metrics-wireup.test.js re-asserts Phase 209 _broadcastRemoteControlState invariants alongside tests/sync-tab-runtime.test.js."
  - "Dual-write enforced for showcase: dashboard-metrics-render.test.js asserts BOTH Angular component and vanilla showcase/js/dashboard.js parity."
  - "XSS guard codified: renderMetrics body must not use .innerHTML on untrusted payload values."
metrics:
  duration_minutes: 5
  tasks_completed: 4
  files_created: 3
  files_modified: 1
  commits: 4
completed: 2026-05-02
requirements:
  - RBR-01
  - RBR-02
  - RBR-03
  - RBR-04
  - RBR-05
  - MET-01
  - MET-02
  - MET-03
  - MET-04
  - MET-05
  - MET-06
  - MET-07
---

# Phase 223 Plan 01: Wave 0 Static-Analysis Tests Summary

Three failing static-grep tests authored and wired into `npm test` to lock the Phase 223 contract before implementation lands in Plans 02 and 03.

## What Shipped

- `tests/remote-control-rebrand.test.js` — 14 assertions covering RBR-01..05 (nav label, Beta badge reuse, section header, options page consistency, showcase mirror copy) plus an emoji guard mirroring `agent-sunset-showcase.test.js`. Currently 6 PASS / 8 FAIL by design.
- `tests/metrics-wireup.test.js` — 26 assertions covering MET-01..05 (push on connect, payload shape, analytics sourcing, active-tab gating) plus MET-08 Phase 209 preservation (defense in depth). Currently 9 PASS / 17 FAIL by design (the 9 PASS are exactly the Phase 209 invariants and the negative `setInterval` polling guard).
- `tests/dashboard-metrics-render.test.js` — 16 assertions covering MET-06/07 across the Angular component AND the vanilla `showcase/js/dashboard.js` mirror, including an XSS guard (no `.innerHTML =` inside `renderMetrics` body) and the disconnect → `clearMetrics()` contract. Currently 7 PASS / 9 FAIL by design.
- `package.json::scripts.test` extended with the three new tests appended after `tests/sync-tab-runtime.test.js`. JSON validates. Phase 209 contract test still runs first and stays GREEN (verified: `node tests/sync-tab-runtime.test.js` exits 0 with 14 PASS / 0 FAIL).

## Tasks & Commits

| Task | Name                                                    | Commit  | Files                                  |
| ---- | ------------------------------------------------------- | ------- | -------------------------------------- |
| 1    | Create tests/remote-control-rebrand.test.js (RBR-01..05) | 6f3eed3 | tests/remote-control-rebrand.test.js   |
| 2    | Create tests/metrics-wireup.test.js (MET-01..05, MET-08) | 1305a1b | tests/metrics-wireup.test.js           |
| 3    | Create tests/dashboard-metrics-render.test.js (MET-06,07) | 5cb5fc7 | tests/dashboard-metrics-render.test.js |
| 4    | Wire three new tests into package.json test chain        | 635e7ba | package.json                           |

## Verification

| Gate                                                               | Expected | Actual                          |
| ------------------------------------------------------------------ | -------- | ------------------------------- |
| `node tests/remote-control-rebrand.test.js` exits non-zero          | YES      | EXIT=1, 6 PASS / 8 FAIL         |
| `node tests/metrics-wireup.test.js` exits non-zero                  | YES      | EXIT=1, 9 PASS / 17 FAIL        |
| `node tests/dashboard-metrics-render.test.js` exits non-zero        | YES      | EXIT=1, 7 PASS / 9 FAIL         |
| `node tests/sync-tab-runtime.test.js` exits 0 (Phase 209 untouched) | YES      | EXIT=0, 14 PASS / 0 FAIL        |
| `package.json` parses; chain contains all three new tests           | YES      | JSON.parse OK; all 3 referenced |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

No new runtime surface introduced. Tests are static-grep on already-trusted in-repo files. Threat register T-223-01-01..04 dispositions hold (mitigate / accept / accept / mitigate).

## Known Stubs

None. The "stubs" here are deliberate failing assertions (Wave 0 TDD contract); they are not user-visible code paths but contract specifications for Plans 02 and 03 to satisfy.

## Self-Check: PASSED

- `tests/remote-control-rebrand.test.js` — FOUND
- `tests/metrics-wireup.test.js` — FOUND
- `tests/dashboard-metrics-render.test.js` — FOUND
- `package.json` chain references all three — VERIFIED via `node -e "JSON.parse..."`
- Commits 6f3eed3, 1305a1b, 5cb5fc7, 635e7ba — FOUND in `git log`
