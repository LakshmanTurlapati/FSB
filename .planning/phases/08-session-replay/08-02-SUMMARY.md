---
phase: 08-session-replay
plan: 02
subsystem: ui
tags: [replay, sidepanel, history, css]
depends_on: ["08-01"]
provides: ["replay-ui-trigger", "replay-button-styles"]
affects: []
tech-stack:
  added: []
  patterns: ["event-delegation", "promise-wrapped-chrome-messaging"]
key-files:
  created: []
  modified:
    - ui/sidepanel.js
    - ui/sidepanel.css
decisions:
  - id: RPL-UI-01
    decision: "Replay button only shown for sessions with actionCount > 0"
    reason: "Sessions with zero actions have nothing to replay"
  - id: RPL-UI-02
    decision: "Replay button uses green color (#4CAF50) to distinguish from red delete button"
    reason: "Visual differentiation between destructive and constructive actions"
  - id: RPL-UI-03
    decision: "Existing statusUpdate/automationComplete/stop handlers reused for replay without modification"
    reason: "Replay sessions use the same sessionId pattern so existing message routing works"
metrics:
  duration: "1.4 min"
  completed: "2026-02-16"
---

# Phase 8 Plan 2: Replay UI Trigger Summary

Replay button added to session history items in sidepanel with event delegation, startReplay function with concurrent-automation guard, and CSS styles matching the existing delete-button visibility pattern.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add replay button to history items and wire replay trigger | 090a5d3 | ui/sidepanel.js |
| 2 | Add replay button CSS styles | 4855e96 | ui/sidepanel.css |

## What Was Done

### Task 1: Replay Button and Trigger Function

**Part A** - Added replay button to `loadHistoryList()` HTML template, gated on `session.actionCount > 0`. The button appears before the delete button in each history item.

**Part B** - Added replay click handler to existing event delegation on `historyList`. The replay handler fires before the delete handler, using `e.target.closest('.history-replay-btn')`.

**Part C** - Created `startReplay(sessionId)` async function that:
- Guards against concurrent automation (`isRunning` check)
- Switches to chat view if history view is active
- Adds system message and status indicator
- Sends `replaySession` message to background via promise-wrapped `chrome.runtime.sendMessage`
- Sets running state and updates status with step count on success
- Shows error messages on failure

**Part D** - Verified existing message handlers cover replay:
- `statusUpdate` routes by `request.sessionId === currentSessionId` -- works for replay
- `automationComplete` -- works for replay completion
- `automationError` -- works for replay failure
- `stopAutomation` -- works because replay sessions are in `activeSessions`

### Task 2: Replay Button CSS

Added `.history-replay-btn` styles:
- Hidden by default (`opacity: 0`), visible on history-item hover (`opacity: 0.7`)
- Green color scheme (#4CAF50 base) for visual distinction from red delete button
- Dark theme variant with adjusted green tones (#66BB6A / #81C784)
- Smooth transitions on opacity, background, and color

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| RPL-UI-01 | Replay button only for sessions with actionCount > 0 | No actions to replay on zero-action sessions |
| RPL-UI-02 | Green color (#4CAF50) for replay vs red for delete | Clear visual distinction between actions |
| RPL-UI-03 | Reuse existing message handlers for replay | Same sessionId routing pattern already works |

## Deviations from Plan

None - plan executed exactly as written.

## Key Links Verified

| From | To | Via | Verified |
|------|----|-----|----------|
| sidepanel.js startReplay | background.js handleReplaySession | chrome.runtime.sendMessage replaySession | Yes |
| sidepanel.js loadHistoryList | history-replay-btn | HTML template includes replay button | Yes |
| sidepanel.js message listener | automationComplete handler | existing statusUpdate and automationComplete handling | Yes |

## Next Phase Readiness

Phase 8 (Session Replay) is now complete:
- 08-01: Backend replay engine with action history persistence
- 08-02: Frontend replay trigger with button UI and progress display

The replay feature is fully wired end-to-end. Users can view session history, click replay on sessions that had actions, see progress in the chat view, and stop replay mid-execution.

## Self-Check: PASSED
