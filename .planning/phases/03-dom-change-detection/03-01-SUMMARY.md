---
phase: 03-dom-change-detection
plan: 01
subsystem: dom-change-detection
tags: [fingerprinting, dom-hash, structural-path, multi-signal, stuck-detection]
requires:
  - "Phase 2 DOM serialization pipeline (element structure with attributes, context, formId)"
provides:
  - "Structural-path element fingerprinting (scroll-invariant, class-invariant)"
  - "Multi-channel DOM signal system (structural, content, interaction, pageState)"
  - "Channel-wise signal comparison (compareSignals)"
  - "quickHash utility for fast string hashing"
affects:
  - "03-02 (change descriptor generation uses createDOMSignals _raw data)"
  - "Phase 4+ (stuck detection now has fine-grained change channels)"
tech-stack:
  added: []
  patterns:
    - "Multi-channel signal decomposition for DOM change detection"
    - "Structural-path fingerprinting using DOM identity (type, id, data-testid, role, name, parent context, formId, text)"
key-files:
  created: []
  modified:
    - content.js
    - background.js
key-decisions:
  - id: CHG-01
    decision: "Element fingerprinting uses structural path (type, id, data-testid, role, name, parentTag:parentRole, formId, text) -- NO position, NO class"
    rationale: "Position is scroll-dependent (viewport-relative); class is framework-toggled (React, Tailwind state classes)"
  - id: CHG-02
    decision: "Interaction signal explicitly excludes focused state"
    rationale: "Focus changes every iteration from AI actions (click, type, etc.) causing false change detection"
  - id: CHG-03
    decision: "Content signal excludes purely numeric text values"
    rationale: "Timestamps and counters change every iteration, producing noise"
  - id: CHG-04
    decision: "createDOMHash preserved as backward-compatible wrapper"
    rationale: "automationLogger.logIteration() and stateHistory.domHash depend on string hash; breaking them would require cascading changes"
duration: "3.2 min"
completed: "2026-02-14"
---

# Phase 03 Plan 01: Structural Fingerprinting and Multi-Signal DOM Change Detection

Replaced viewport-position-based element fingerprints with scroll-invariant structural-path fingerprints in content.js, and replaced the single-value DOM hash in background.js with a 4-channel signal system that independently detects structural, content, interaction state, and page state changes.

## Performance

- **Execution time:** 3.2 minutes (2 tasks)
- **Lines changed:** content.js +28/-11, background.js +115/-18
- **No new files, no new dependencies**

## Accomplishments

1. **Structural-path fingerprinting (content.js):** Both `DOMStateManager.hashElement()` and standalone `hashElement()` now use identical field composition: `type|id|data-testid|role|name|parentTag:parentRole|formId|text(30chars)`. Removed position.x/y (scroll-dependent) and class (framework-toggled).

2. **Position-free hasElementChanged (content.js):** Removed the `Math.abs(position.x/y diff) > 10` check. Element change detection now relies on text, visibility, interactionState (shallow compare), and attributes (shallow compare) -- all meaningful DOM mutations.

3. **Multi-signal createDOMSignals (background.js):** Returns `{ structural, content, interaction, pageState, _raw }`:
   - `structural`: quickHash of top-5 element types by count
   - `content`: quickHash of text/value from first 15 interactive + alert/status/dialog elements, excluding numeric-only
   - `interaction`: quickHash of disabled/checked/readonly state from first 20 inputs/buttons, excluding focused
   - `pageState`: quickHash of urlPath + title + elementCount + hasModal + hasAlert + captchaPresent
   - `_raw`: preserved for Plan 02 change descriptor generation

4. **compareSignals (background.js):** Channel-wise comparison returning `{ changed, channels, summary }`. Handles null/undefined previous as initial snapshot.

5. **Backward compatibility:** `createDOMHash()` wrapper concatenates 4 signal hashes into a string. `lastDOMHash` property preserved alongside new `lastDOMSignals`.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Structural-path fingerprinting in content.js | d6fe655 | content.js |
| 2 | Multi-signal DOM change detection in background.js | c307fc1 | background.js |

## Files Modified

- **content.js:** `DOMStateManager.hashElement()` (~line 222), standalone `hashElement()` (~line 8455), `hasElementChanged()` (~line 270)
- **background.js:** Added `quickHash()` (~line 4493), `createDOMSignals()` (~line 4505), `compareSignals()` (~line 4597), `createDOMHash()` wrapper (~line 4617). Updated session init (~line 3321), session reset (~line 5538), automation loop (~line 5150, 5222).

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| CHG-01 | Structural path uses type, id, data-testid, role, name, parentTag:parentRole, formId, text | Position is scroll-dependent; class is framework-toggled |
| CHG-02 | Interaction signal excludes focused state | Focus changes every AI iteration (click/type actions) |
| CHG-03 | Content signal excludes purely numeric text | Timestamps/counters change every iteration |
| CHG-04 | createDOMHash preserved as wrapper | Backward compat for logger and stateHistory |

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- `createDOMSignals._raw` data is available for 03-02 change descriptor generation
- `compareSignals()` is available for 03-02 to use in the automation loop for channel-aware stuck detection
- `lastDOMSignals` session property is tracked and reset properly

## Self-Check: PASSED
