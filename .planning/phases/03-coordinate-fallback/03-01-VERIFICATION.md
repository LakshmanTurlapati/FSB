---
phase: 03-coordinate-fallback
verified: 2026-02-03T15:30:00Z
status: gaps_found
score: 3/7 must-haves verified
gaps:
  - truth: "When all selectors fail and coordinates are provided, the system clicks at x,y coordinates"
    status: failed
    reason: "Coordinate fallback code exists but is in unreachable dead code section"
    artifacts:
      - path: "content.js:2826-2836"
        issue: "Code never executes - all paths return before reaching it"
    missing:
      - "Move coordinate fallback integration to BEFORE early return at line 2513"
      - "Integrate into the if(!element) block so it runs when selector fails"
      - "Ensure clickAtCoordinates is called when params.coordinates exists and element not found"
  - truth: "When coordinate fallback is used, logs clearly indicate selector-based approach failed"
    status: failed
    reason: "Logging exists but in unreachable code - never executes"
    artifacts:
      - path: "content.js:2409"
        issue: "automationLogger.warn call in clickAtCoordinates, but clickAtCoordinates never called"
    missing:
      - "Make coordinate fallback reachable so logging can execute"
---

# Phase 3: Coordinate Fallback Verification Report

**Phase Goal:** When all selectors fail, the system falls back to coordinate-based clicking
**Verified:** 2026-02-03T15:30:00Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When all selectors fail and coordinates are provided, the system clicks at x,y coordinates | **FAILED** | clickAtCoordinates exists (line 2405) but is called from unreachable dead code (line 2828). Early return at line 2513 prevents fallback path from executing. |
| 2 | Coordinate-based clicks hit the center of the element's stored bounding box | **VERIFIED** | `centerX = x + width / 2` and `centerY = y + height / 2` at lines 2417-2418. Logic is correct when/if executed. |
| 3 | When coordinate fallback is used, logs clearly indicate selector-based approach failed | **FAILED** | `automationLogger.warn('Using coordinate fallback', ...)` exists at line 2409, but never executes because clickAtCoordinates is never called. |
| 4 | Coordinates outside viewport are scrolled into view before clicking | **VERIFIED** | ensureCoordinatesVisible function (line 2367) checks visibility and scrolls if needed. Called at line 2421. Logic is correct when/if executed. |

**Score:** 2/4 truths verified (2 verified in isolation, 2 failed due to unreachable code)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `content.js:validateCoordinates` | Pre-click validation function | **VERIFIED** | Function exists at line 2335 with correct signature `validateCoordinates(x, y)`. Returns `{valid, element?, reason?}`. Checks bounds, elementFromPoint, pointer-events, visibility. |
| `content.js:ensureCoordinatesVisible` | Scroll handling function | **VERIFIED** | Function exists at line 2367 with correct signature. Converts document to viewport coords, checks visibility, scrolls if needed with 300ms wait. Returns `{x, y, scrolled}`. |
| `content.js:clickAtCoordinates` | Coordinate-based clicking function | **PARTIAL** | Function exists at line 2405 with full implementation: center calculation, scroll handling, validation, mouse events, logging. BUT never called due to integration issue. |
| `content.js:tools.click` integration | Fallback in click tool failure path | **ORPHANED** | Integration code exists at lines 2826-2836 BUT is in unreachable dead code. Early return at line 2513 prevents execution. Alternative selector loop (lines 2778-2824) also unreachable. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|--|----|--------|---------|
| tools.click (line 2509) | clickAtCoordinates | params.coordinates check at line 2827 | **NOT_WIRED** | Check exists but in dead code section after line 2772. Early return at line 2513 when `!element` prevents reaching this code. |
| clickAtCoordinates | ensureCoordinatesVisible | Function call at line 2421 | **WIRED** | Correctly calls ensureCoordinatesVisible with x, y, width, height params |
| clickAtCoordinates | validateCoordinates | Function call at line 2428 | **WIRED** | Correctly calls validateCoordinates with viewport coords |
| clickAtCoordinates | automationLogger | warn call at line 2409 | **WIRED** | Correctly logs with sessionId, reason, originalSelector, targetCoordinates |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| TARG-02: Coordinate-based clicking fallback | **BLOCKED** | Coordinate fallback code is unreachable - never executes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| content.js | 2774-2848 | Dead code - alternative selector loop and coordinate fallback | **BLOCKER** | Entire fallback mechanism never executes. Early return at line 2513 prevents execution. |
| content.js | 2513-2517 | Early return without fallback check | **BLOCKER** | When `!element`, returns immediately without checking params.coordinates for fallback |
| content.js | 2547 | Redundant `if (element)` check | **WARNING** | Element is always truthy here (would have returned if falsy at line 2512) |

### Human Verification Required

None - automated checks sufficient to identify the dead code issue.

### Gaps Summary

**CRITICAL INTEGRATION ISSUE: Coordinate fallback is unreachable dead code**

The three utility functions (validateCoordinates, ensureCoordinatesVisible, clickAtCoordinates) are implemented correctly with proper logic. However, the integration into tools.click is fundamentally broken:

**Current flow (BROKEN):**
```javascript
click: async (params) => {
  let element = querySelectorWithShadow(params.selector);
  if (!element) {
    return { success: false, error: 'Element not found' };  // Line 2513: IMMEDIATE RETURN
  }
  // ... readiness checks ...
  if (element) {
    // ... perform click ...
    return { success: true };  // Line 2751 or 2726: ALWAYS RETURNS
  }
  // Line 2774+: UNREACHABLE - alternative selectors and coordinate fallback
  const alternatives = findAlternativeSelectors(...);
  if (params.coordinates ...) {
    return await clickAtCoordinates(...);  // NEVER EXECUTES
  }
}
```

**Required fix:**
Move coordinate fallback check into the `if (!element)` block at line 2512-2517, BEFORE the early return:

```javascript
if (!element) {
  // Try coordinate fallback BEFORE returning failure
  if (params.coordinates && typeof params.coordinates.x === 'number' ...) {
    return await clickAtCoordinates({...});
  }
  return { success: false, error: 'Element not found and no coordinates available' };
}
```

**Artifacts that need fixing:**
1. **content.js:2512-2517** - Modify if(!element) block to check params.coordinates before returning
2. **content.js:2774-2848** - Delete dead code (alternative selector loop and fallback integration)
3. **Alternative selector logic** - Move to a more appropriate location if needed (or integrate differently)

**Impact:** Phase goal NOT achieved. The system cannot fall back to coordinate-based clicking when selectors fail because the fallback code never executes.

---

_Verified: 2026-02-03T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
