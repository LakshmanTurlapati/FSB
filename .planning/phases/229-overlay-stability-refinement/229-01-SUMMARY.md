---
phase: 229-overlay-stability-refinement
plan: 01
subsystem: extension/content/visual-feedback
tags: [overlay, cadence, debounce, monotonic, memoization, jitter-fix]
requirements: [OVERLAY-01, OVERLAY-02, OVERLAY-03, OVERLAY-04]
dependency-graph:
  requires: [v0.9.26 overlay contract, v0.9.5 first-sentence extraction]
  provides: [debounced status text, memoized glow rect, monotonic progress, batched action counter]
  affects: [extension/content/visual-feedback.js, tests/overlay-stability-cadence.test.js, package.json (test wiring)]
tech-stack:
  added: [vm-sandbox jsdom-free DOM stub for overlay tests]
  patterns: [debounce coalesce-to-latest, dirty-flag rect cache, monotonic clamp, value-change-gated DOM write]
key-files:
  created:
    - tests/overlay-stability-cadence.test.js
    - .planning/phases/229-overlay-stability-refinement/overlay-rerun-01.md
  modified:
    - extension/content/visual-feedback.js
    - package.json
decisions:
  - Test approach: vm sandbox + hand-rolled DOM stub instead of installing jsdom (no new deps; matches project's existing vm-based test pattern)
  - Combined Tasks 1+2 code into one commit because both tasks edit the same file (visual-feedback.js); kept scaffold + npm-wiring as separate commits for hygiene
metrics:
  duration: ~25 min
  completed: 2026-05-02
  tasks: 2
  files-modified: 4
  tests-added: 31
---

# Phase 229 Plan 01: Update Cadence + Position Stability Summary

Stops the FSB overlay from "twitching like crazy" by gating four hot paths inside `extension/content/visual-feedback.js`: status-text writes are now 400 ms debounced, `ActionGlowOverlay` rect is recomputed only on resize/scroll/target-change, progress percent is monotonic per session, and the action counter writes to the DOM only when its numeric value actually changes. The v0.9.26 visual contract (scaleX bar, rAF M:SS timer, tabular-nums, completion green-flash, 3 s auto-hide, freeze-on-final) and v0.9.5 first-sentence extraction are preserved byte-identical.

## What Changed

### extension/content/visual-feedback.js

- **New module-scope constant** `PROGRESS_TEXT_DEBOUNCE_MS = 400` (above `class ProgressOverlay`).
- **ProgressOverlay constructor** gains five cadence/stability fields:
  - `_pendingDisplay`, `_textDebounceTimer`, `_lastTextWriteAt` (debounce machinery)
  - `_lastVisiblePercent` (monotonic clamp floor, init 0)
  - `_lastActionCount` (action-counter batching gate, init `null`)
- **New methods on `ProgressOverlay`:**
  - `_scheduleTextWrite(wantsText, isFinal)` — coalesces bursts; bypasses debounce when `isFinal === true`
  - `_flushPendingText()` — writes the latest `_pendingDisplay` payload to `.fsb-task / .fsb-summary / .fsb-step-text / .fsb-step-number` and updates `_lastTextWriteAt`
- **`update(state)` refactor:**
  - Replaced four direct `textContent` writes (lines ~610-613) with a single `_scheduleTextWrite(wantsText, isFinal)` call
  - Added `Math.max(_lastVisiblePercent, percent)` clamp inside the determinate-progress branch
  - Replaced unconditional `etaEl.textContent = 'Actions: ' + actionCount` with a value-change gate (`if (actionCount !== this._lastActionCount)`)
  - Reset `_lastVisiblePercent = 0` inside the existing timer-start block (new-session boundary)
- **`destroy()`** clears the new debounce timer, nulls `_pendingDisplay`, and resets the floor + last counter so a re-instantiated overlay starts clean.

- **ActionGlowOverlay constructor** gains three memoization fields: `_rectDirty` (init `true`), `_onWindowChange` (bound handler), `_listenersAttached`.
- **`show(element)`** now sets `_rectDirty = true` before the initial sync `_updatePosition()` and `_rectDirty = false` immediately after, so the first rAF tick does not redundantly recompute.
- **`_startTracking()` rewritten:**
  - Attaches `resize` and capture-phase passive `scroll` listeners exactly once per lifecycle (gate via `_listenersAttached`)
  - rAF loop now checks `targetElement.isConnected` cheaply (no layout flush) and only calls `_updatePosition()` when `_rectDirty === true`
- **`_stopTracking()`** removes both window listeners and clears the `_listenersAttached` flag — no leak across hide/destroy/show cycles.

- **Test export hook** at the end of the IIFE: `if (typeof module !== 'undefined' && module.exports) module.exports = { ProgressOverlay, ActionGlowOverlay, PROGRESS_TEXT_DEBOUNCE_MS };` — guarded so it never runs in the Chrome extension context.

### tests/overlay-stability-cadence.test.js (new, 31 PASS)

Loads `visual-feedback.js` inside a `vm` sandbox with a hand-rolled minimal DOM/window stub (no jsdom dependency). Covers:

- **OVERLAY-01:** debounce constant value, cold-path immediate write, 10-burst coalesce-to-latest, isFinal flush bypasses debounce
- **OVERLAY-03:** 40/25/50 → 0.40/0.40/0.50 clamp sequence, indeterminate-mode no-clamp, session-reset clamp on re-instantiation
- **OVERLAY-04:** 5 identical actionCount writes = 1 DOM write, 3→4→4→5 sequence = 3 DOM writes, null actionCount clears ETA
- **OVERLAY-02:** 10 idle rAF ticks with clean cache = zero `_updatePosition()` calls; window scroll → recompute on next tick; window resize → recompute on next tick; resize+scroll listeners attached exactly once and removed on `_stopTracking()`; disconnected target triggers `destroy()` during rAF

### .planning/phases/229-overlay-stability-refinement/overlay-rerun-01.md (new)

Operator-driven rerun scaffold with empty observation slots for each of the four fixes plus the v0.9.26 contract preservation check and an optional CLS measurement.

### package.json

`npm test` script extended with `&& node tests/overlay-stability-cadence.test.js` so GUARD-02 enforces the new test on every CI/local run.

## Test Coverage Summary

| Behavior | Test # | Status |
| -------- | ------ | ------ |
| Debounce constant exported as 400 | T1 | PASS |
| Cold path writes immediately | T2 | PASS |
| 10 rapid updates within 50ms coalesce to latest | T3 | PASS |
| `lifecycle === 'final'` flushes immediately | T4 | PASS |
| Monotonic clamp 40/25/50 → 0.40/0.40/0.50 | T5 | PASS |
| Indeterminate mode does not touch floor | T6 | PASS |
| New session resets floor to 0 | T7 | PASS |
| Action counter idempotent gate (5 same = 1 write) | T8 | PASS |
| Action counter delta detection (3→4→4→5 = 3 writes) | T9 | PASS |
| `null` actionCount clears ETA | T10 | PASS |
| Glow rect cache reused across 10 idle rAF ticks | T11 | PASS |
| Resize + scroll listeners attached exactly once | T11 | PASS |
| Scroll invalidates cache → next tick recomputes | T11 | PASS |
| Resize invalidates cache → next tick recomputes | T11 | PASS |
| Listeners removed on `_stopTracking()` | T11 | PASS |
| Disconnected target triggers destroy during rAF | T12 | PASS |
| `show()` leaves rect cache clean after initial compute | T13 | PASS |

**Totals:** 31 passing, 0 failing.

**Full `npm test` suite:** all suites green after wiring; no pre-existing tests regressed.

## Operator Handoff

`.planning/phases/229-overlay-stability-refinement/overlay-rerun-01.md` is ready for the orchestrator to dispatch to a human operator after they reload the unpacked extension. The scaffold has empty slots for status-text cadence, glow stability, monotonicity, counter cadence, v0.9.26 contract preservation, and optional CLS measurement.

## Deviations

- **None functionally.** All four fixes implemented per the plan's `<action>` blocks.
- **Sequencing nit:** Tasks 1 and 2 were combined into a single feat commit because both tasks edit the same file (`extension/content/visual-feedback.js`). Per-task commit hygiene is preserved at the docs/wiring level (separate commits for the operator scaffold and the package.json test-wiring). This is a pragmatic deviation, not a Rule 1-4 deviation.

## Self-Check: PASSED

- `extension/content/visual-feedback.js` — FOUND (modified)
- `tests/overlay-stability-cadence.test.js` — FOUND (created, 31 PASS)
- `.planning/phases/229-overlay-stability-refinement/overlay-rerun-01.md` — FOUND (created)
- `package.json` — FOUND (test script extended)
- Commit `b4ccb5f` (feat code) — FOUND
- Commit `492a103` (operator scaffold) — FOUND
- Commit `7ae5c1d` (npm test wiring) — FOUND
- `npm test` — GREEN (all suites pass, including new `overlay-stability-cadence`)
