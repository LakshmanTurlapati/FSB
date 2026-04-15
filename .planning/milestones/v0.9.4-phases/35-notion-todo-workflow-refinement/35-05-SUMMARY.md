---
phase: 35-notion-todo-workflow-refinement
plan: 05
subsystem: automation
tags: [error-handling, diagnostics, parallel-execution, heuristic-fix, ai-debugger]

requires:
  - phase: 35-02
    provides: diagnoseElementFailure 8-point diagnostic and checkBinaryState
  - phase: 35-03
    provides: stuck detection counters and recovery strategies
provides:
  - buildFailureReport structured error responses with element snapshots
  - parallelDebugFallback concurrent heuristic + AI debugging on failure
  - runHeuristicFix pattern-based DOM fixes (overlay, scroll, collapsed)
  - runAIDebugger AI-powered failure diagnosis with natural language output
affects: [action-handlers, iteration-loop, error-recovery]

tech-stack:
  added: []
  patterns: [parallel-debug-fallback, structured-failure-report, heuristic-fix-engine]

key-files:
  created: []
  modified:
    - content/actions.js
    - content/messaging.js
    - background.js

key-decisions:
  - "runHeuristicFix in content script (DOM access) with HEURISTIC_FIX message bridge to background"
  - "buildFailureReport wraps all action failures with diagnostic + element snapshot + suggestions"
  - "AI debugger reuses UniversalProvider pattern from summarizeTask/estimateTaskComplexity"

patterns-established:
  - "buildFailureReport: standard structured error response for all action failures"
  - "parallelDebugFallback: Promise.allSettled for concurrent recovery strategies"

requirements-completed: [ERR-01, ERR-02, ERR-03]

duration: 12min
completed: 2026-03-17
---

# Phase 35 Plan 05: Structured Error Reporting and Parallel Debug Fallback Summary

**buildFailureReport for structured action failures with element snapshots, plus parallelDebugFallback firing heuristic fixes and AI debugger concurrently via Promise.allSettled**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-17T01:53:17Z
- **Completed:** 2026-03-17T02:05:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Every action failure now returns structured report with reason, 8-point diagnostic, element state snapshot (ARIA, visibility, rect), and natural language suggestions
- Parallel debug fallback fires heuristic engine (content script, DOM access) and AI debugger (background, API access) concurrently on failure
- Heuristic engine resolves common patterns: overlay dismiss via Escape, scroll-into-view, collapsed container expansion
- AI debugger diagnosis available with zero extra latency when heuristic fails

## Task Commits

Each task was committed atomically:

1. **Task 1: Add structured failure reporting to all action handlers** - `224c198` (feat)
2. **Task 2: Implement parallel debug fallback in background.js** - `96e5536` (feat)

## Files Created/Modified
- `content/actions.js` - buildFailureReport, runHeuristicFix, wired into click/type/pressEnter/selectOption/toggleCheckbox/check/uncheck handlers
- `content/messaging.js` - HEURISTIC_FIX message handler for background-to-content communication
- `background.js` - parallelDebugFallback, runAIDebugger, wired into iteration loop failure path

## Decisions Made
- runHeuristicFix placed in content script (actions.js) since it needs DOM access; background.js communicates via HEURISTIC_FIX message through messaging.js
- buildFailureReport wraps all failure returns consistently -- success responses unchanged
- AI debugger reuses the existing UniversalProvider + config.getAll() pattern established by summarizeTask and estimateTaskComplexity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added HEURISTIC_FIX handler in messaging.js**
- **Found during:** Task 1
- **Issue:** Plan mentioned adding handler in actions.js message listener section, but actions.js has no message listener -- messaging.js handles all chrome.runtime.onMessage
- **Fix:** Added HEURISTIC_FIX case to handleBackgroundMessage switch in content/messaging.js
- **Files modified:** content/messaging.js
- **Verification:** grep confirms HEURISTIC_FIX handler present
- **Committed in:** 224c198 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Correct file for message handler. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All error reporting requirements (ERR-01, ERR-02, ERR-03) complete
- Structured failures flow through to AI via action history
- Parallel debug fallback integrates with existing alternative action retry

---
*Phase: 35-notion-todo-workflow-refinement*
*Completed: 2026-03-17*
