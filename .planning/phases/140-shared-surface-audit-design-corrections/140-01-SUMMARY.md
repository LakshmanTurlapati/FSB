---
phase: 140-shared-surface-audit-design-corrections
plan: 01
subsystem: ui/shared-baseline
tags: [ui, retouch, shared-styles, tokens, entrypoints]
dependency_graph:
  requires: []
  provides: [shared-ui-baseline, shared-ui-tokens, cross-surface-style-import]
  affects: [shared/fsb-ui-core.css, ui/sidepanel.html, ui/popup.html, ui/control_panel.html, showcase/dashboard.html]
tech_stack:
  added: []
  patterns: [shared-css-tokens, cross-surface-baseline, extension-and-showcase-parity]
key_files:
  created:
    - shared/fsb-ui-core.css
  modified:
    - ui/sidepanel.html
    - ui/popup.html
    - ui/control_panel.html
    - showcase/dashboard.html
decisions:
  - Phase 140 establishes one shared FSB token layer instead of redesigning each surface independently
  - Control panel / options styling remains the visual source of truth for the retouch baseline
  - Audited entrypoints load the shared baseline directly so later phases can retouch locally without duplicating primitive rules
metrics:
  completed: "2026-04-02T06:31:58Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 140 Plan 01: Shared UI Baseline Summary

**One-liner:** Added a shared FSB UI baseline stylesheet and wired the sidepanel, popup, control panel, and showcase dashboard to consume it before any surface-specific retouching.

## What Was Done

### Task 1: Create the shared FSB baseline stylesheet
- Added `shared/fsb-ui-core.css` as the common token and primitive layer for the retouch milestone
- Defined shared `--fsb-*` tokens for accent color, surfaces, borders, shadows, typography, motion, and dark-mode equivalents
- Added baseline treatments for repeated primitives such as cards, icon buttons, status badges, tabs, dense rows, forms, and dashboard inputs
- Kept the existing FSB orange-forward aesthetic instead of introducing a new theme direction

### Task 2: Wire the baseline into audited UI entrypoints
- Added `../shared/fsb-ui-core.css` to `ui/sidepanel.html`
- Added `../shared/fsb-ui-core.css` to `ui/popup.html`
- Added `../shared/fsb-ui-core.css` to `ui/control_panel.html`
- Added `../shared/fsb-ui-core.css` to `showcase/dashboard.html`
- Established one shared dependency path for later phase work across extension and showcase surfaces

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 0378ed6 | feat(140-01): add shared UI baseline stylesheet |
| 2 | bc6096c | feat(140-01): wire shared UI baseline into audited surfaces |

## Verification Results

- `shared/fsb-ui-core.css` exists with shared FSB token definitions -- PASS
- Shared stylesheet imported by sidepanel, popup, control panel, and showcase dashboard entrypoints -- PASS
- Shared stylesheet contains repeated primitive rules for icon buttons, badges, and form inputs -- PASS
- Baseline preserves existing FSB accent direction via `--fsb-primary` instead of replacing the theme -- PASS

## Deviations from Plan

None. The plan landed exactly as intended: first the shared baseline, then the entrypoint wiring.

## Known Stubs

None. This plan introduced the real baseline stylesheet used by the milestone, not a temporary placeholder layer.

## Self-Check: PASSED

- `shared/fsb-ui-core.css`: FOUND
- `ui/sidepanel.html`: FOUND
- `ui/popup.html`: FOUND
- `ui/control_panel.html`: FOUND
- `showcase/dashboard.html`: FOUND
- Commit `0378ed6`: FOUND
- Commit `bc6096c`: FOUND
