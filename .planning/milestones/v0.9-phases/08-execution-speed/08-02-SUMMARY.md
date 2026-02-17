---
phase: 08
plan: 02
subsystem: execution-speed
tags: [delays, outcome-detection, dynamic-waiting, automation-loop]

dependency_graph:
  requires: [08-01]
  provides: [outcome-based-delays, dynamic-wait-strategies]
  affects: [08-03, action-execution, automation-performance]

tech_stack:
  added: []
  patterns: [outcome-based-delay, priority-detection, fallback-strategy]

key_files:
  created: []
  modified: [content.js, background.js]

decisions:
  - Outcome detection priority order: navigation > network > majorDOMChange > minorDOMChange > elementStateChange > noChange
  - OUTCOME_DELAYS maps outcomes to wait strategies with configurable thresholds
  - calculateActionDelay preserved as fallback for edge cases
  - Message handlers added for detectActionOutcome and capturePageState

metrics:
  duration: 4 min
  completed: 2026-02-04
---

# Phase 8 Plan 02: Outcome-Based Delays Summary

Replaced static category-based delays with dynamic outcome-based delays that respond to actual action effects.

## What Was Built

### 1. detectActionOutcome function (content.js)
Classifies action outcomes into six categories with priority-based detection:

```javascript
function detectActionOutcome(preState, postState, actionResult = {}) {
  // Priority 1: Navigation (URL changed)
  // Priority 2: Network activity
  // Priority 3: Major DOM change (>10 elements or >500 chars)
  // Priority 4: Minor DOM change (any element/text change)
  // Priority 5: Element state change (class, aria-expanded, etc.)
  // Default: No detectable change
}
```

Returns: `{ type, confidence, details }`

### 2. OUTCOME_DELAYS constant (background.js)
Maps outcome types to wait strategies:

```javascript
const OUTCOME_DELAYS = {
  navigation: { waitFor: 'pageLoad', maxWait: 5000 },
  network: { waitFor: 'networkQuiet', maxWait: 2000, quietTime: 200 },
  majorDOMChange: { waitFor: 'domStable', maxWait: 1000, stableTime: 300 },
  minorDOMChange: { waitFor: 'domStable', maxWait: 500, stableTime: 100 },
  elementStateChange: { waitFor: 'minimal', delayMs: 50 },
  noChange: { waitFor: 'none', delayMs: 0 }
};
```

### 3. outcomeBasedDelay function (background.js)
Applies appropriate wait strategy based on detected outcome:
- Uses pageLoadWatcher for navigation
- Uses waitForPageStability for network activity
- Uses waitForDOMStable for DOM changes
- Minimal delay (50ms) for state changes
- No delay for no-change outcomes
- Includes error handling with fallback delays

### 4. Automation Loop Integration
Replaced the old delay logic in background.js with outcome-based approach:
- Checks if actionResult has pre/post state from verification
- Sends detectActionOutcome message to classify outcome
- Calls outcomeBasedDelay with detected outcome type
- Falls back to calculateActionDelay on detection errors

### 5. Message Handlers (content.js)
Added two new message handlers:
- `case 'detectActionOutcome'`: Routes to detectActionOutcome function
- `case 'capturePageState'`: Captures current page state for comparison

## Technical Decisions

1. **Outcome Detection Priority**: Navigation takes highest priority since URL changes require full page load wait, while no-change allows immediate continuation.

2. **Fallback Strategy**: calculateActionDelay preserved for edge cases where outcome detection fails or returns errors.

3. **Wait Strategy Mapping**: Each outcome type maps to a specific wait mechanism that matches its expected behavior (page load for navigation, network quiet for AJAX, etc.).

4. **Confidence Levels**: Detection returns HIGH or MEDIUM confidence to allow future optimization of wait times based on certainty.

## Commits

| Hash | Description |
|------|-------------|
| 818110d | Add detectActionOutcome function in content.js |
| deaf36b | Add OUTCOME_DELAYS and outcomeBasedDelay in background.js |
| 1b6ebcf | Integrate outcomeBasedDelay into automation loop |

## Files Modified

- **content.js**: Added detectActionOutcome function (+90 lines), added message handlers (+30 lines)
- **background.js**: Added OUTCOME_DELAYS constant and outcomeBasedDelay function (+154 lines), replaced delay logic (+100/-63 lines)

## Performance Impact

Expected improvements:
- Navigation outcomes: Wait until page ready (not fixed 3s)
- Network outcomes: Wait for network quiet (not fixed 2s)
- Major DOM: Wait up to 1s for stability (not fixed 3s)
- Minor DOM: Wait up to 500ms (not fixed 1s)
- No-change: Proceed immediately (was 300-500ms)
- Element state: 50ms delay (was 200-500ms)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 08-03 (Batch Action Optimization). The outcome-based delay system provides the foundation for:
- Batching read-only actions with minimal delays
- Optimizing wait times based on action batches
- Reducing total execution time for multi-step tasks
