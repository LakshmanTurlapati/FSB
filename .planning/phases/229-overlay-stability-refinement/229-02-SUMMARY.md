---
phase: 229-overlay-stability-refinement
plan: 02
subsystem: extension/content (overlay) + extension/utils (state)
tags: [overlay, accessibility, reduced-motion, content-audit, OVERLAY-05, OVERLAY-06]
requires: [229-01]
provides:
  - isThinkingPhase helper on FSBOverlayStateUtils
  - firstSentence helper exported (was internal-only)
  - Thinking-suppression gate in ProgressOverlay.update() (<1s elapsed)
  - First-sentence regression guard on legacy state.stepText path
  - Strict reduced-motion CSS for ProgressOverlay text surfaces
affects: [Sync overlay, accessibility a11y, v0.9.5 first-sentence pipeline (preserved)]
tech-stack:
  added: []
  patterns: [vm-sandbox unit tests, additive CSS @media extension, defensive guard set]
key-files:
  created:
    - tests/overlay-content-audit.test.js
    - .planning/phases/229-overlay-stability-refinement/overlay-rerun-02.md
  modified:
    - extension/utils/overlay-state.js
    - extension/content/visual-feedback.js
    - package.json
decisions:
  - "'reasoning' phase omitted from THINKING_PHASES set: grep across extension/ returned zero matches for 'reasoning' as a phase identifier. Set is {'planning', 'thinking'}."
  - "ActionGlowOverlay reduced-motion block at line ~1548 was already complete (transition: none on .box-overlay/.text-highlight + animation: none on .active variants). Left unchanged; regression-guarded by tests."
  - "firstSentence promoted from internal-only to exported because the legacy state.stepText fallback in ProgressOverlay.update() needs it for the bypass guard."
metrics:
  completed: 2026-05-02
  tasks: 2
  tests_added: 33
  tests_total_after: 33 (in this file)
---

# Phase 229 Plan 02: Content Audit + Reduced-Motion Summary

Content-audit and accessibility hardening built on top of Plan 229-01's cadence/stability fixes: thinking-class phase labels are suppressed for the first 1000ms of a session, the legacy state.stepText fallback now routes through sanitizeActionText(firstSentence(...)) so raw multi-line strings cannot bypass overlay-state.js, and reduced-motion users get strict transition:none on all five ProgressOverlay text surfaces while the completion green-flash state change is preserved.

## What Changed

### extension/utils/overlay-state.js
- New `THINKING_PHASES = new Set(['planning', 'thinking'])` constant.
- New `isThinkingPhase(phase)` helper: case-insensitive membership check; rejects null/undefined/empty/non-string.
- `firstSentence` added to the exports object (was only used internally by buildOverlayDisplay).
- `isThinkingPhase` added to the exports object and therefore to `window.FSBOverlayStateUtils`.

### extension/content/visual-feedback.js
- ProgressOverlay.update() (~line 620): legacy non-display.* fallback for `state.stepText` now wraps the value in `legacyUtils.sanitizeActionText(legacyUtils.firstSentence(...))` so the bypass route gets the same sanitization as the upstream pipeline at overlay-state.js:201.
- ProgressOverlay.update() (~line 685): new pre-`_scheduleTextWrite` gate computes `suppressDetail = isThinking && detailIsGeneric && elapsedMs < 1000`. When true, the wantsText.detail field is set to `''` instead of the generic placeholder. `.fsb-task`, `.fsb-summary`, `.fsb-step-number` writes are unaffected.
- ProgressOverlay shadow CSS @media (prefers-reduced-motion: reduce) block (~line 547): additive rules for `.fsb-task, .fsb-summary, .fsb-step-text, .fsb-step-number, .fsb-eta { transition: none !important; animation: none !important; }`. Existing rules for `.fsb-overlay`, `.fsb-progress-fill`, `.fsb-progress-fill.complete`, and `.fsb-progress-bar.indeterminate` preserved unchanged.
- ActionGlowOverlay reduced-motion block at ~line 1548 left unchanged (audit confirmed it already covers transition + animation on box-overlay/text-highlight).

### tests/overlay-content-audit.test.js (new, 33 assertions)
Three describe blocks:
- `isThinkingPhase`: 10 assertions covering true/false matrix + case insensitivity + null/undefined/empty handling.
- `thinking suppression in ProgressOverlay.update()`: 4 scenarios (initial-suppression, post-1s-release, navigation-not-suppressed, real-detail-not-suppressed).
- `first-sentence regression guard`: 2 assertions on legacy stepText collapse + display.detail pass-through.
- `reduced-motion strict mode`: 11 assertions covering CSS source regex (text-surface selectors present in @media block), green-flash CSS preserved, matchMedia=true completion still applies green box-shadow + .complete class, ActionGlowOverlay block intact (regression guard on .box-overlay/.text-highlight/transition:none/animation:none).

### package.json
- `npm test` script extended to include `node tests/overlay-content-audit.test.js`.

### .planning/phases/229-overlay-stability-refinement/overlay-rerun-02.md
- Operator rerun scaffold with empty observation slots for normal-motion and reduced-motion procedures (operator-driven; gsd-executor cannot drive a real browser).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test regex captured incomplete @media blocks**
- Found during: Task 2 verification.
- Issue: Initial regex `/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g` greedy/permissiveness mismatch caused capture to stop after the first nested rule, so subsequent assertions for `.fsb-step-text`, `.fsb-eta`, `animation: none` failed even though the CSS was correct.
- Fix: Replaced with `/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{(?:[^{}]*\{[^{}]*\}){1,12}[^{}]*\}/g` which matches up to 12 nested rule blocks.
- Files modified: tests/overlay-content-audit.test.js
- Commit: 2f8ac23

**2. [Rule 2 - Critical functionality] firstSentence not exported**
- Found during: Task 1 implementation.
- Issue: Plan referenced `utils.firstSentence` for the legacy state.stepText guard, but firstSentence in overlay-state.js was defined as an internal helper only (not in the exports object). The bypass guard would have silently fallen through to `String(state.stepText)`.
- Fix: Added firstSentence to exportsObj alongside isThinkingPhase.
- Files modified: extension/utils/overlay-state.js
- Commit: 232d3df

**3. [Auto-applied] 'reasoning' phase omitted from THINKING_PHASES**
- Per plan instructions: grep extension/ returned zero matches for 'reasoning' as a phase identifier; set kept as {'planning', 'thinking'}.

## Self-Check: PASSED

Files verified:
- extension/utils/overlay-state.js (modified)
- extension/content/visual-feedback.js (modified)
- tests/overlay-content-audit.test.js (created)
- .planning/phases/229-overlay-stability-refinement/overlay-rerun-02.md (created)
- package.json (modified)

Commits verified:
- a961559 (RED tests)
- 232d3df (Task 1 GREEN)
- 2f8ac23 (Task 2 GREEN)

GUARD-02: `npm test` green end-to-end with overlay-content-audit (33/33) included.
GUARD-01: per-task commits (1 RED + 2 GREEN feat).
GUARD-03: v0.9.5 first-sentence pipeline at overlay-state.js:201 untouched; v0.9.26 reduced-motion contract preserved (additive only); v0.9.21 context-aware target feedback unchanged; Plan 229-01 dynamics fixes (debounce/monotonic/glow memo/counter batching) verified still passing in overlay-stability-cadence (31/31).
