---
phase: 243
plan: 04
subsystem: extension/ui
tags: [ui, agent-cap, polish, chrome-storage]
requires:
  - "extension/ui/control_panel.html (Phase 241 cap input lines 418-435)"
  - "extension/ui/options.js (Phase 241 cap handlers, loadSettings, saveSettings)"
  - "extension/utils/agent-registry.js (chrome.storage.session 'fsbAgentRegistry' envelope per Phase 237 D-03)"
provides:
  - "Live current-active agent counter ('N of M active') on the Agent Concurrency card"
  - "Inline red 'Must be between 1 and 64' validation hint that toggles on raw input"
  - "Pure helpers (computeActiveAgentCount / formatCounterText / isCapInputInvalid) usable in browser + Node"
  - "chrome.storage.onChanged subscription that refreshes the counter on registry + cap mutations"
affects:
  - "extension/ui/control_panel.html"
  - "extension/ui/options.js"
  - "extension/ui/cap-counter-helpers.js (new)"
  - "tests/cap-counter-live.test.js (new)"
tech-stack:
  added:
    - "extension/ui/cap-counter-helpers.js (no external deps; dual CommonJS + browser-global export)"
  patterns:
    - "chrome.storage.onChanged listener with 100ms debounce (Pitfall 4)"
    - "legacy:* prefix filter at the helper site (Pitfall 1)"
    - "Pure-helper extraction for Node-test parity with browser code"
key-files:
  created:
    - "extension/ui/cap-counter-helpers.js"
    - "tests/cap-counter-live.test.js"
    - ".planning/phases/243-background-tab-audit-ui-badge-integration/deferred-items.md"
  modified:
    - "extension/ui/control_panel.html"
    - "extension/ui/options.js"
decisions:
  - "Helpers extracted into a separate file with dual CommonJS + browser-global export so Node tests can require() the same logic the page consumes"
  - "Validation toggle reads the RAW typed value (pre-clamp) so user gets immediate feedback for 0 / 65 / non-numeric input even though saved value is clamped"
  - "Counter refresh debounced at 100ms (Pitfall 4): 24 storage writes during agent ramp-up collapse to one paint"
  - "legacy:* filter applied INSIDE computeActiveAgentCount (single chokepoint) rather than scattered across call sites"
  - "Reset button now also hides the validation div + refreshes the counter (UX consistency)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-05"
  tasks: "2/2"
  tests-added: "16"
  tests-passing: "16/16"
requirements-closed:
  - "UI-03"
---

# Phase 243 Plan 04: Concurrency Cap UI Polish Summary

UI-03 finishing touches on Phase 241's existing Agent Concurrency cap input: a live "N of M active" counter (filtered to exclude legacy:* synthesized agents) and an inline red validation hint for out-of-range input, both wired through chrome.storage.onChanged with 100 ms debounce.

## Files Modified

### Created

- **`extension/ui/cap-counter-helpers.js`** - Pure helper module exporting `computeActiveAgentCount(envelope)`, `formatCounterText(active, cap)`, and `isCapInputInvalid(rawValue)`. Dual export: CommonJS for Node tests + browser-global for the options page (loaded BEFORE options.js in control_panel.html script ordering).
- **`tests/cap-counter-live.test.js`** - 16 unit tests covering helper correctness (legacy:* filtering, formatter defaults, validation edge cases) + DOM presence in control_panel.html + options.js source-pattern wiring (cache, listener, refresh, debounce, isCapInputInvalid usage).
- **`.planning/phases/243-background-tab-audit-ui-badge-integration/deferred-items.md`** - Logs the pre-existing `tests/agent-cap-ui.test.js` Test 8 failure (saveSettings IIFE refactor mismatch) as out-of-scope.

### Modified

- **`extension/ui/control_panel.html`**:
  - Added two sibling elements after the existing setting-hint inside the Agent Concurrency card (lines 418-435 area):
    - `<div id="fsbAgentCapValidation">` - red hint, `display:none` by default, copy "Must be between 1 and 64".
    - `<div id="fsbAgentCapCurrentActive">` - default copy "0 of 8 active".
  - Refined existing setting-hint copy with the D-06 trade-off language: "Lower = predictable resource use; higher = more parallel agents."
  - Added `<script src="cap-counter-helpers.js">` BEFORE `<script src="options.js">` so the helpers are available as globals when options.js runs.

- **`extension/ui/options.js`**:
  - `cacheElements` picks up the two new elements: `elements.fsbAgentCapValidation` + `elements.fsbAgentCapCurrentActive`.
  - Existing `fsbAgentCap` input handler now ALSO toggles the validation div (`isCapInputInvalid(rawValue)` on the pre-clamp raw string) and refreshes the counter on every keystroke so the in-progress cap value drives the counter denominator immediately.
  - Reset button now hides the validation div and refreshes the counter on click (UX consistency).
  - New module-level functions `refreshActiveAgentCount` + `scheduleRefreshActiveAgentCount` (100 ms debounce). The refresh reads `chrome.storage.session.get('fsbAgentRegistry')`, applies `computeActiveAgentCount` (legacy:* filter), and writes `formatCounterText(active, cap)` into the counter span.
  - `chrome.storage.onChanged` subscription dispatches `scheduleRefreshActiveAgentCount` for both `session/fsbAgentRegistry` (registry mutations) and `local/fsbAgentCap` (cap value writes).
  - `loadSettings` calls `refreshActiveAgentCount()` once at the end of the cap-load branch for initial paint.

## DOM Additions Summary

| ID                          | Element type | Default state           | Purpose                                                           |
| --------------------------- | ------------ | ----------------------- | ----------------------------------------------------------------- |
| `fsbAgentCapValidation`     | `<div>`      | `display:none`, red text | Inline hint shown when raw input is < 1, > 64, NaN, or non-integer |
| `fsbAgentCapCurrentActive`  | `<div>`      | "0 of 8 active"          | Live counter; updates via chrome.storage.onChanged + debounce      |

## Helper Extraction Strategy

Helpers live in their own file (`extension/ui/cap-counter-helpers.js`) so the SAME function bodies are exercised by:

1. **Browser:** classic `<script>` tag in control_panel.html before options.js. Helpers attach to `globalThis` (`computeActiveAgentCount`, `formatCounterText`, `isCapInputInvalid`).
2. **Node tests:** CommonJS `module.exports`. `require('extension/ui/cap-counter-helpers.js')` returns the same three functions.

The dual-export pattern is gated by `typeof module !== 'undefined' && module.exports` (CommonJS) and `typeof globalThis !== 'undefined'` (browser); both branches are safe in either environment.

## Test Results

```
tests 16
suites 0
pass 16
fail 0
duration_ms ~30
```

Coverage breakdown:

- **Helper tests (7):** legacy:* filter (positive + only-legacy + empty), formatter defaults, isCapInputInvalid for in-range / out-of-range / NaN / non-integer / null / negative.
- **HTML tests (3):** both new IDs present, validation copy literal "Must be between 1 and 64", `<script src="cap-counter-helpers.js">` precedes `<script src="options.js">`.
- **options.js source-pattern tests (6):** elements cached, refreshActiveAgentCount defined + uses computeActiveAgentCount + formatCounterText, chrome.storage.onChanged listener filters area `'session'` AND `'local'` AND references `fsbAgentRegistry`, isCapInputInvalid used for validation toggle, helper file applies legacy:* filter literally, debounce present.

Regression on `tests/agent-cap.test.js` + `tests/agent-cap-storage.test.js` + `tests/agent-registry.test.js` GREEN (19/19).

## Pitfall Mitigations Honored

| Pitfall (per 243-RESEARCH.md)                              | Mitigation in this plan                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pitfall 1: legacy:* phantom-load inflating counter         | `computeActiveAgentCount` filters `id.indexOf('legacy:') === 0` at the single chokepoint. Unit-tested.       |
| Pitfall 4: counter listener thrashes on every registry write | `scheduleRefreshActiveAgentCount` debounces 100 ms. Bulk ramp-up collapses to one repaint.                   |

## Decisions Made

1. **Pure-helper extraction** over inlining helpers in options.js: enables Node-test parity (no DOM stubs needed for the math) and keeps options.js focused on DOM wiring.
2. **Pre-clamp validation feedback:** validation div toggles on the RAW typed string (`isCapInputInvalid(rawValue)`), not the post-clamp normalized value. The user sees red the moment they type "65" or "abc", even though the persisted value is still clamped to [1, 64].
3. **Debounce at the scheduler, not the listener:** the chrome.storage.onChanged listener fires `scheduleRefreshActiveAgentCount` directly; debouncing inside the scheduler keeps the listener free of timeout state.
4. **Reset button extended:** consistent UX — clicking reset clears any stuck validation message AND refreshes the counter so the denominator immediately reflects "of 8".
5. **D-07 honored:** no new `chrome.storage` key. The existing `fsbAgentCap` (local) and Phase 237's `fsbAgentRegistry` (session) are both reused as-is.

## Deviations from Plan

None - plan executed exactly as written. The Phase 241 `tests/agent-cap-ui.test.js` Test 8 failure was confirmed pre-existing (verified via `git stash` against the unmodified baseline) and is logged in `deferred-items.md` for a future Phase 241 follow-up.

## Deferred Issues

See `deferred-items.md` in this phase directory for the pre-existing `tests/agent-cap-ui.test.js` Test 8 IIFE-pattern mismatch.

## Threat Flags

None - this plan adds only display surfaces (counter + validation hint) over chrome.storage data the user already controls. No new network endpoints, auth paths, or trust-boundary mutations.

## UI-03 Closure

| Acceptance criterion                                                 | Status                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Helper text mentions trade-off (lower = predictable; higher = parallel) | DONE - existing setting-hint refined with D-06 copy.                                                          |
| Current-active counter "X of N active" live-updates                   | DONE - `chrome.storage.onChanged` subscribed for session/fsbAgentRegistry; refreshes 100 ms after each event. |
| Counter excludes legacy:*                                             | DONE - `computeActiveAgentCount` applies the filter; unit-tested with explicit legacy:popup + legacy:autopilot fixture. |
| Inline validation message for out-of-range input                     | DONE - `fsbAgentCapValidation` div toggles via `isCapInputInvalid(rawValue)` on every input event.            |
| No new chrome.storage key (D-07)                                     | DONE - existing fsbAgentCap (local) + fsbAgentRegistry (session) reused.                                      |

## Commits

| Task | Commit  | Subject                                                                                                |
| ---- | ------- | ------------------------------------------------------------------------------------------------------ |
| 1    | 79b1cd4 | feat(243-04): add validation div + current-active counter to control_panel.html + helpers              |
| 2    | ad096c0 | feat(243-04): UI-03 wire cap counter + validation toggle in options.js with chrome.storage.onChanged subscription |

## Self-Check: PASSED

- FOUND: `extension/ui/cap-counter-helpers.js`
- FOUND: `tests/cap-counter-live.test.js`
- FOUND: commit 79b1cd4
- FOUND: commit ad096c0
- FOUND: `extension/ui/control_panel.html` modifications (fsbAgentCapValidation + fsbAgentCapCurrentActive ids verified by grep)
- FOUND: `extension/ui/options.js` modifications (refreshActiveAgentCount + chrome.storage.onChanged + isCapInputInvalid all verified by grep)
- TESTS: 16/16 GREEN on `tests/cap-counter-live.test.js`
- REGRESSION: 19/19 GREEN across cap-counter-live + agent-cap + agent-cap-storage + agent-registry
