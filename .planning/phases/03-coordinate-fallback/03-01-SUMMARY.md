# Phase 3 Plan 01: Coordinate Fallback Integration Summary

---
phase: 03-coordinate-fallback
plan: 01
subsystem: action-execution
tags: [coordinate-fallback, click-reliability, fallback-mechanism]

dependency_graph:
  requires: []
  provides:
    - "clickAtCoordinates function for coordinate-based clicking"
    - "validateCoordinates function for pre-click validation"
    - "ensureCoordinatesVisible function for scroll handling"
  affects:
    - "04-visual-feedback (may need coordinate-based highlighting)"
    - "Future AI prompt updates (to include coordinates in click params)"

tech_stack:
  added: []
  patterns:
    - "document.elementFromPoint() for coordinate-to-element resolution"
    - "Scroll-then-validate pattern for off-screen coordinates"
    - "Full mouse event sequence (mousedown/mouseup/click) at coordinates"

key_files:
  created: []
  modified:
    - "content.js"

decisions:
  - id: "03-01-d1"
    description: "Place coordinate utilities BEFORE tools object for logical organization"
    rationale: "Matches pattern from Phase 1 (validation utilities before generateSelectors)"
  - id: "03-01-d2"
    description: "Alternative selectors now actually click (not just return list)"
    rationale: "Increases success rate before falling back to coordinates"

metrics:
  duration: "3 minutes"
  completed: "2026-02-03"
---

Coordinate fallback provides last-resort clicking at stored x,y coordinates when all selectors fail. Uses elementFromPoint() validation, scroll-into-view handling, and full mouse event dispatch.

## Objective Achieved

Added coordinate-based clicking as a last-resort fallback when all CSS/XPath selectors fail to find an element. This increases click reliability by using stored element position data captured during DOM analysis.

## What Was Built

### Core Functions Added to content.js

1. **validateCoordinates(x, y)** - Line 2335
   - Validates viewport coordinates point to a clickable element
   - Checks bounds, element existence, pointer-events, visibility
   - Returns `{ valid: boolean, element?: Element, reason?: string }`

2. **ensureCoordinatesVisible(docX, docY, width, height)** - Line 2367
   - Scrolls off-screen coordinates into viewport
   - Uses smooth scrolling with 300ms wait
   - Returns `{ x, y, scrolled: boolean }` with current viewport coords

3. **clickAtCoordinates(params)** - Line 2405
   - Main fallback function called when selectors fail
   - Calculates center point: `x + width/2`, `y + height/2`
   - Dispatches full mouse event sequence (mousedown/mouseup/click)
   - Logs usage via `automationLogger.warn('Using coordinate fallback', ...)`

### Click Tool Integration (Lines 2809-2885)

Enhanced the `tools.click` failure path:
1. First tries alternative selectors (now actually clicks them)
2. If all fail AND `params.coordinates` provided, calls `clickAtCoordinates`
3. Returns clear error if no coordinates available

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Function placement | Before `const tools = {` | Matches Phase 1 pattern - utilities before consumers |
| Alternative selector behavior | Actually click them | Increases success rate before coordinate fallback |
| Coordinate validation | Use elementFromPoint() | Browser handles z-index, overlays, pointer-events correctly |
| Center point targeting | `x + width/2, y + height/2` | More reliable than edge/corner clicking |

## Verification Performed

| Check | Result | Evidence |
|-------|--------|----------|
| Functions before tools object | PASS | Lines 2335, 2367, 2405 < 2500 |
| Click tool integration | PASS | params.coordinates triggers clickAtCoordinates at line 2862-2870 |
| Logging integration | PASS | `automationLogger.warn('Using coordinate fallback'...)` at line 2409 |
| Center point calculation | PASS | `centerX = x + width / 2` at line 2421 |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| fe5e139 | feat | Add coordinate fallback utility functions |
| 7f05c4c | feat | Integrate coordinate fallback into click tool failure path |

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

1. **If all selectors fail to match, the system uses stored x,y coordinates**
   - Verified: `params.coordinates` triggers `clickAtCoordinates` call in tools.click (line 2862-2870)

2. **Coordinate-based clicks hit the center of where the element was observed**
   - Verified: `centerX = x + width/2`, `centerY = y + height/2` in clickAtCoordinates (line 2421-2422)

3. **The fallback is logged so users know a selector-based approach failed**
   - Verified: `automationLogger.warn('Using coordinate fallback', ...)` at line 2409

## Integration Points

**Upstream dependency:** None (self-contained fallback mechanism)

**Downstream consumers:**
- AI prompt system will need to include coordinates in click params
- Visual feedback phase may highlight coordinate-based click targets

**Key link established:**
- `from: "click tool (tools.click at line 2509)"`
- `to: "clickAtCoordinates"`
- `via: "fallback call when all selectors fail and params.coordinates exists"`

## Next Phase Readiness

Phase 3 is now complete. The coordinate fallback mechanism is integrated and ready for use. The next phase (04-visual-feedback) can proceed independently.

**Note for AI Prompt Updates:** To enable coordinate fallback, the AI system prompt should instruct the model to include position data in click parameters:
```json
{
  "tool": "click",
  "params": {
    "selector": "[data-testid='submit-button']",
    "coordinates": { "x": 450, "y": 320, "width": 120, "height": 40 }
  }
}
```
