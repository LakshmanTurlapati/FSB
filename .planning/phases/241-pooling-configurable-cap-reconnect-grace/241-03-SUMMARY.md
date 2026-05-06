---
phase: 241-pooling-configurable-cap-reconnect-grace
plan: 03
subsystem: settings-ui
tags:
  - settings-ui
  - control-panel
  - cap-input
  - no-idle-timeout
  - POOL-05
  - POOL-06
  - LOCK-04
  - D-05
  - D-06
  - D-13
requires:
  - 241-01-SUMMARY.md
provides:
  - Agent Concurrency settings card in control_panel.html (D-05 surface)
  - chrome.storage.local fsbAgentCap key write path (consumer side of Plan 01 onChanged listener)
  - LOCK-04 negative invariant test (D-13)
affects:
  - extension/ui/control_panel.html
  - extension/ui/options.js
  - tests/agent-cap-ui.test.js (new)
  - tests/agent-no-idle.test.js (new)
tech-stack-added: []
tech-stack-patterns:
  - "Three-layer numeric clamping: HTML min/max + JS input handler + SW setCap (defense in depth)"
  - "Source-grep negative invariant tests with comment + string-literal stripping"
key-files-created:
  - tests/agent-cap-ui.test.js
  - tests/agent-no-idle.test.js
key-files-modified:
  - extension/ui/control_panel.html
  - extension/ui/options.js
decisions:
  - "Card placement: between DOM Analysis and Performance cards (mirrors Element Cache Size pattern parity)"
  - "Reset-to-default button is the only programmatic exit from a customized value (no inline error UI)"
  - "loadSettings re-clamps on read (T-241-11 mitigation: tampered storage normalizes on next load)"
  - "Plan-03 is a negative-invariant codification for LOCK-04, not a refactor: the registry already complies post-Plan-01"
metrics:
  tasks: 2
  commits: 3
  files_created: 2
  files_modified: 2
  duration_min: 18
completed: 2026-05-06
---

# Phase 241 Plan 03: Settings UI + LOCK-04 Negative Invariant Summary

Agent Concurrency cap is now user-configurable through the Advanced Settings dashboard, persisted to `chrome.storage.local.fsbAgentCap`, and consumed by the registry's onChanged listener wired in Plan 01. The LOCK-04 D-13 invariant (no idle timeout) is now codified as a source-grep + behavioral negative test that breaks the build if a future change re-introduces idle reaping.

## Outcome

- **POOL-05 closure:** Cap value is configurable through the options page Advanced Settings tab. Range 1 to 64. Default 8. Persisted to `chrome.storage.local`. Plan 01's `chrome.storage.onChanged` subscriber picks it up automatically.
- **POOL-06 closure:** Real-time clamping in three layers: HTML `min/max/step`, JS `input` handler clamp + integer floor, SW `setCap` clamp on storage propagation. Reset button restores the default 8.
- **LOCK-04 codification (D-13):** `tests/agent-no-idle.test.js` asserts no `setInterval`, no `chrome.alarms`, and no idle-keyword scheduling identifiers exist in the registry source. Test 4 proves an agent persists across a 200ms quiet period (no background reaper). Test 5 bounds setTimeout call sites to <= 4 (the three connection_id-keyed grace timers from Plan 01 plus refactor headroom).

## What Changed

### `extension/ui/control_panel.html`

New `<div class="settings-card">` inserted after the DOM Analysis card (around line 408). Card structure mirrors the existing Element Cache Size pattern:

```html
<!-- Phase 241 D-05 / POOL-05: Agent Concurrency cap (range 1-64, default 8) -->
<div class="settings-card">
  <div class="settings-card-header">
    <div class="settings-card-icon"><i class="fas fa-users"></i></div>
    <div class="settings-card-title">
      <h3>Agent Concurrency</h3>
      <p>Maximum simultaneous agents</p>
    </div>
  </div>
  <div class="settings-card-content">
    <div class="setting-item">
      <div class="setting-label">
        <span>Concurrency Cap</span>
        <span class="setting-value-display" id="fsbAgentCapDisplay">8</span>
      </div>
      <input type="number" id="fsbAgentCap" class="form-input" min="1" max="64" step="1" value="8">
      <button type="button" class="form-secondary-btn" id="fsbAgentCapReset" style="margin-top: 8px;">Reset to default (8)</button>
      <div class="setting-hint">
        Default 8. Range 1 to 64. Lowering this value while active agents are running does not evict them; new claims past the new cap are rejected (grandfather behavior).
      </div>
    </div>
  </div>
</div>
```

Three new IDs: `fsbAgentCap`, `fsbAgentCapDisplay`, `fsbAgentCapReset`. No emoji unicode anywhere.

### `extension/ui/options.js`

Five extension sites:

1. **`defaultSettings.fsbAgentCap = 8`** added to the defaults object.
2. **`cacheElements()`** maps the three new DOM IDs to the `elements` registry.
3. **`setupEventListeners()`** attaches:
   - `input` handler on `fsbAgentCap`: parseInt, then clamp `< 1 -> 1`, `> 64 -> 64`, non-finite -> 8, decimals floored implicitly by parseInt. Updates the display span and calls `markUnsavedChanges()`.
   - `click` handler on `fsbAgentCapReset`: sets input value to `'8'`, updates display, calls `markUnsavedChanges()`.
4. **`loadSettings()`** reads `settings.fsbAgentCap`, re-clamps (defense against tampered storage per T-241-11), reflects into the input + display.
5. **`saveSettings()`** writes `fsbAgentCap: parseInt(elements.fsbAgentCap?.value, 10) || 8` into the chrome.storage.local payload.

### `tests/agent-cap-ui.test.js` (new)

Nine tests:

1. HTML grep -- card markup, IDs, attributes, helper text mention range and grandfather behavior.
2. `defaultSettings.fsbAgentCap === 8` source grep.
3-7. DOM-stub clamp behavior (high/low/decimal/non-numeric/reset).
8. options.js wiring grep -- cacheElements / addEventListener input + click / saveSettings parseInt / loadSettings read.
9. No emoji unicode in the new card region.

The handler logic in tests 3-7 is mirrored in the test file (not loaded from options.js, which depends on browser globals). Test 8 grep-asserts the exact patterns are present in the production source so the mirrored handler must match the real one.

### `tests/agent-no-idle.test.js` (new)

Five tests with comment + string-literal stripping so grep negatives only fire on real code:

1. Zero `setInterval` call sites in registry source.
2. Zero `chrome.alarms` references in registry source (Pitfall 1: 30s floor blocks 10s grace).
3. No `idleTimeout` / `idleReaper` / `reapIdle` identifiers in registry source.
4. Behavioral: bind tab, await 200ms quiet period, assert agent + tab still owned.
5. setTimeout call sites bounded to <= 4 (the 3 grace-window scheduling sites plus headroom).

## Three-Layer Clamping (Defense in Depth)

| Layer | Where | Mechanism |
|-------|-------|-----------|
| 1 | HTML | `<input type="number" min="1" max="64" step="1">` -- browser-level enforcement |
| 2 | JS | `input` handler in options.js: parseInt -> floor -> clamp 1..64; `loadSettings()` re-clamps on read |
| 3 | SW | Plan 01's `setCap()` clamps on every `chrome.storage.onChanged` propagation |

Each layer can independently normalize a tampered value. Storage tampering (T-241-11), DevTools edit (T-241-12), or stale older-version values all converge to a valid 1..64 integer or default 8.

## Cross-Plan Wiring (Plan 01 <-> Plan 03)

- **Plan 01** subscribed to `chrome.storage.onChanged` in `'local'` area for the key `fsbAgentCap`. On change, `setCap()` re-clamps and updates `_cachedCap`.
- **Plan 03** writes to `chrome.storage.local` under exact key `fsbAgentCap` from `saveSettings()`. The reset button + input clamp both call `markUnsavedChanges()` -- the actual write happens when the user hits Save.
- **Contract:** key name is `fsbAgentCap`. Both sides clamp 1..64 integer (defense in depth).
- **Zero file overlap with Plan 02:** Plan 03 only modified `control_panel.html`, `options.js`, and the two new test files. Plan 02 (which landed concurrently) modified `background.js`, `mcp-bridge-client.js`, `mcp-tool-dispatcher.js`, and `agent-scope.ts`. Parallel-safe.

## Verification

```
node tests/agent-cap-ui.test.js     # 9 tests, all PASS
node tests/agent-no-idle.test.js    # 5 tests, all PASS
node tests/agent-cap.test.js        # PASS
node tests/agent-cap-storage.test.js # PASS
node tests/agent-pool-shrink.test.js # PASS
node tests/agent-grace.test.js      # PASS
node tests/agent-pooling.test.js    # PASS
node tests/agent-registry.test.js   # PASS (All assertions passed)
node tests/mcp-tool-smoke.test.js   # 67 passed, 0 failed
```

Grep gates (acceptance):

| Gate | Required | Actual |
|------|----------|--------|
| `grep -c "fsbAgentCap" extension/ui/control_panel.html` | >= 1 | 3 |
| `grep -c "fsbAgentCap" extension/ui/options.js` | >= 4 | 19 |
| `grep -c "fsbAgentCapReset" extension/ui/options.js` | >= 1 | 3 |
| `grep -c "Agent Concurrency" extension/ui/control_panel.html` | >= 1 | 2 |

## Deviations from Plan

### Test framing for negative invariant (Rule 3 - Test pragmatism)

- **Found during:** Task 2 design.
- **Issue:** Strict TDD RED-then-GREEN does not apply to a negative invariant. The post-Plan-01 registry already complies (no setInterval, no chrome.alarms, no idle keywords). Forcing a RED would require introducing a violation just to remove it -- counterproductive and not how negative-invariant tests are typically written.
- **Resolution:** Wrote the test directly as a passing safety net. Its job is to break the build if a future PR re-introduces idle reaping. The test verifies its own assertions are non-vacuous (test 5 also asserts `>= 1` setTimeout site so the regex isn't silently broken).
- **Files modified:** `tests/agent-no-idle.test.js`.
- **Commit:** 6795bd4.

### Test 5 setTimeout bound: <= 4 (not <= 2 as written in plan)

- **Found during:** Task 2 RED preflight grep.
- **Issue:** The plan specified `setTimeout count <= 2 (one for stage, one for hydrate-time recovery)`. Actual post-Plan-01 registry has 3 setTimeout call sites: stage (1) + hydrate-already-expired-zero-ms-fire (1) + hydrate-remaining-time-fire (1).
- **Resolution:** Test asserts `<= 4` to match reality with one slot of refactor headroom. Lower bound `>= 1` ensures the regex itself is healthy. Documented in the test file.
- **Files modified:** `tests/agent-no-idle.test.js`.
- **Commit:** 6795bd4.
- **Plan 01 alignment:** Plan 01 introduced the second hydrate-time setTimeout site for the `remaining = deadline - now` reschedule case; the plan author wrote the bound before knowing the precise hydrate implementation.

### Bullet ordering in defaultSettings

- **Found during:** Task 1 implementation.
- **Issue:** Plan said "Sort alphabetically or follow existing convention (likely simply appended)."
- **Resolution:** Appended after `autoRefineSiteMaps` (consistent with current convention -- additions go at the end). No alphabetical sort change.
- **Commit:** 4ec024e.

### loadSettings region (deviation from plan suggestion)

- **Found during:** Task 1 implementation.
- **Issue:** Plan suggested inserting the cap-load block in "the data-handler region" without a precise anchor.
- **Resolution:** Inserted between Element Cache Size load block and `prioritizeViewport` load block -- consistent locality with cacheElements ordering.
- **Commit:** 4ec024e.

## Auth Gates

None. Pure local-storage + DOM work; no network or credentials.

## Threat Surface Verification

All threats in the plan's `<threat_model>` are addressed:

- **T-241-05 (cap misconfig):** All three layers shipped (HTML min/max + JS clamp + Plan 01 setCap clamp).
- **T-241-11 (DevTools tamper):** `loadSettings()` re-clamps on read; SW setCap also re-clamps on storage.onChanged.
- **T-241-12 (XSS via display):** Display element uses `textContent`, never `innerHTML`. Numeric input enforces non-script content. Values pass through `parseInt`.
- **T-241-13 (future idle reaper drift):** `tests/agent-no-idle.test.js` asserts source-grep negatives across setInterval / chrome.alarms / idle identifiers.

No new threat surface introduced beyond the threat model.

## Hand-off

End-to-end Phase 241 contract is now complete with Plans 01 + 02 + 03 landed:

- **Plan 01:** Registry cap enforcement, configurable cap (SW side), pool shrink + reconnect grace.
- **Plan 02:** background.js onCreated forced-pool listener, dispatcher cap-rejection branch, agent-scope connectionId capture.
- **Plan 03:** Options-page UI surface for the cap, LOCK-04 negative invariant test.

Phase 244 hardening (per ROADMAP) will add 5x manual UAT runs across Chrome SW restart + flaky-network + window-close commutativity scenarios.

## Self-Check: PASSED

Files created:
- FOUND: tests/agent-cap-ui.test.js
- FOUND: tests/agent-no-idle.test.js
- FOUND: .planning/phases/241-pooling-configurable-cap-reconnect-grace/241-03-SUMMARY.md

Files modified:
- FOUND: extension/ui/control_panel.html (3 fsbAgentCap matches, 2 "Agent Concurrency" matches)
- FOUND: extension/ui/options.js (19 fsbAgentCap matches, 3 fsbAgentCapReset matches)

Commits (verified via git log):
- FOUND: 2ffceaf test(241-03): add failing UI test for Agent Concurrency cap card
- FOUND: 4ec024e feat(241-03): add Agent Concurrency settings card + options.js wiring
- FOUND: 6795bd4 test(241-03): add LOCK-04 negative invariant test (no idle timeout)

Regression suite: 9/9 tests PASS.
