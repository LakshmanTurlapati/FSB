---
phase: 07-debugging-infrastructure
plan: 03
subsystem: debugging
tags: [replay, export, ui, session-history]
requires: [07-01]
provides: [session-replay-ui, human-readable-export]
affects: [08-execution-speed]
tech-stack:
  added: []
  patterns: [step-navigation, message-passing]
key-files:
  created: []
  modified: [automation-logger.js, background.js, options.html, options.css, options.js]
decisions: [replay-controls-with-prev-next, collapsible-raw-logs, human-readable-format]
metrics:
  duration: 4min
  completed: 2026-02-04
---

# Phase 07 Plan 03: Session Replay and Export Summary

Step-by-step session replay UI with human-readable text export for debugging automation runs.

## What Was Built

### 1. getReplayData Method (automation-logger.js)
Transforms raw action records into structured replay format:
- `version`, `id`, `metadata` (task, times, status, URL)
- `steps[]` array with action, targeting, and result details
- `summary` with success/failure counts and total duration

### 2. exportHumanReadable Method (automation-logger.js)
Generates formatted text report:
- Header with session overview (ID, task, status, duration)
- Step-by-step execution with `[OK]`/`[FAILED]` markers
- Targeting details (selector tried/used, element found, coordinates)
- Diagnostic information for failed steps
- Failure summary section

### 3. Background Message Handlers (background.js)
Added two new message handlers:
- `getSessionReplayData`: Returns replay object for UI
- `exportSessionHumanReadable`: Returns formatted text for download

### 4. Session Replay UI (options.html)
New replay container with:
- Prev/Next navigation buttons
- Step indicator (Step X of Y)
- Step content area for detailed view
- Summary section showing success rate
- Collapsible raw logs section

### 5. Replay Styles (options.css)
Complete styling for:
- `.replay-controls` - Navigation bar
- `.replay-btn` - Prev/Next buttons
- `.step-status` - OK/FAILED badges
- `.step-section` - Content sections
- Dark theme support

### 6. Replay Functions (options.js)
- `renderSessionReplay(sessionId)` - Loads replay data, initializes controls
- `renderStep(index)` - Renders specific step with targeting and diagnostics
- `renderReplaySummary()` - Shows success/failure summary
- `exportSessionText(sessionId)` - Downloads human-readable report

## Integration Points

### Key Links Verified
1. `options.js renderSessionReplay` -> `background.js getSessionReplayData` via `chrome.runtime.sendMessage`
2. `background.js getSessionReplayData` -> `automationLogger.getReplayData(sessionId)`
3. `options.html exportSessionText button` -> `exportSessionHumanReadable` via message handler

### Data Flow
```
viewSession(sessionId)
  -> renderSessionReplay(sessionId)
    -> chrome.runtime.sendMessage({ action: 'getSessionReplayData' })
      -> automationLogger.getReplayData()
        -> loadSession() + getSessionActionRecords()
    -> renderStep(0) + renderReplaySummary()
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Prev/Next navigation | More intuitive than dropdown for step-by-step review |
| Collapsible raw logs | Keeps UI clean, raw logs available on demand |
| Human-readable format | Plain text is portable and easy to share |

## Commits

| Hash | Description |
|------|-------------|
| 8dc9cdf | feat(07-03): add getReplayData and exportHumanReadable to AutomationLogger |
| 0d7f202 | feat(07-03): add session replay UI and message handlers |

## Files Modified

| File | Changes |
|------|---------|
| automation-logger.js | +getReplayData(), +exportHumanReadable() |
| background.js | +getSessionReplayData handler, +exportSessionHumanReadable handler |
| options.html | +session-replay-container, +replay-controls, +raw-logs-toggle |
| options.css | +replay styles (controls, buttons, step content, badges) |
| options.js | +renderSessionReplay, +renderStep, +exportSessionText, +replay state |

## Verification Results

All verification commands passed:
- getReplayData returns structured replay object with steps array
- exportHumanReadable returns formatted text with step details
- Background.js has message handlers at lines 2192 and 2204
- Replay UI container and controls present in HTML
- renderSessionReplay and renderStep functions implemented

## Next Phase Readiness

Phase 07 (Debugging Infrastructure) is now complete:
- Plan 01: Action recording with diagnostics
- Plan 02: Element inspection mode
- Plan 03: Session replay and export (this plan)

Ready to proceed to Phase 08 (Execution Speed) if not already complete.
