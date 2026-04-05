---
phase: 140-shared-surface-audit-design-corrections
plan: 02
subsystem: ui/shared-primitives
tags: [ui, retouch, sidepanel, popup, control-panel, dashboard]
dependency_graph:
  requires: [plan-140-01]
  provides: [aligned-ui-primitives, shared-token-consumption, cross-surface-polish-baseline]
  affects: [ui/sidepanel.css, ui/popup.css, ui/options.css, showcase/css/main.css, showcase/css/dashboard.css]
tech_stack:
  added: []
  patterns: [token-adoption, primitive-normalization, showcase-extension-style-parity]
key_files:
  created: []
  modified:
    - ui/sidepanel.css
    - ui/popup.css
    - ui/options.css
    - showcase/css/main.css
    - showcase/css/dashboard.css
decisions:
  - Popup and sidepanel should share one primitive language for headers, composer chrome, and message/status states
  - The control panel remains the strongest source surface, but showcase keeps its dark presentation while adopting the same token language
  - Phase 140 stops at primitive alignment and avoids larger layout redesign work reserved for later phases
metrics:
  completed: "2026-04-02T06:31:58Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 140 Plan 02: Shared Primitive Alignment Summary

**One-liner:** Applied the new FSB baseline to the popup, sidepanel, control panel, and showcase dashboard so shared controls, cards, badges, and state treatments now use one visual system.

## What Was Done

### Task 1: Align popup and sidepanel primitives
- Repointed local popup and sidepanel tokens to the shared `--fsb-*` baseline
- Normalized header action buttons and icon sizing in both chat surfaces
- Unified message, status, completed, and typing-state treatments so both surfaces present the same chat language
- Retouched composer controls, send/stop/mic buttons, and history row states to remove obvious styling drift

### Task 2: Align control panel and showcase dashboard primitives
- Repointed `ui/options.css` tokens to the shared baseline while preserving the established control panel structure
- Retouched form inputs, selects, cards, nav items, analytics blocks, and utility sections in the control panel
- Updated `showcase/css/main.css` so the showcase keeps its darker site presentation but uses the same accent, radius, border, and shadow language
- Updated `showcase/css/dashboard.css` cards, badges, inputs, toggles, detail surfaces, and preview chrome to the shared baseline

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 95f781b | feat(140-02): align popup and sidepanel primitives |
| 2 | 7d7a97d | feat(140-02): align control panel and dashboard baseline |

## Verification Results

- `ui/popup.css` and `ui/sidepanel.css` now consume shared `--fsb-*` tokens -- PASS
- Popup and sidepanel both define aligned `.icon-btn` and status-message treatments -- PASS
- `ui/options.css` now consumes the shared baseline for primary color, surfaces, and form primitives -- PASS
- Showcase root and dashboard files adopt the shared accent and primitive language without losing the dark showcase look -- PASS

## Deviations from Plan

None. The work stayed at the primitive and chrome layer and did not spill into larger layout redesign.

## Known Stubs

None. All touched surfaces now consume real shared tokens and real primitive styling rules.

## Self-Check: PASSED

- `ui/sidepanel.css`: FOUND
- `ui/popup.css`: FOUND
- `ui/options.css`: FOUND
- `showcase/css/main.css`: FOUND
- `showcase/css/dashboard.css`: FOUND
- Commit `95f781b`: FOUND
- Commit `7d7a97d`: FOUND
