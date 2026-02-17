---
phase: 06-unified-session-continuity
plan: 01
subsystem: session-management
tags: [session-continuity, conversation-reuse, idle-sessions, follow-up-commands]
dependency-graph:
  requires: [05-task-completion-verification]
  provides: [conversation-session-reuse, idle-session-lifecycle, follow-up-context-injection]
  affects: [06-02]
tech-stack:
  added: []
  patterns: [conversation-scoped-sessions, deferred-cleanup, session-reactivation]
key-files:
  created: []
  modified: [background.js, ai/ai-integration.js]
decisions:
  - id: SES-01
    decision: "Idle sessions stay in activeSessions Map with status 'idle' and 10-min deferred cleanup"
    rationale: "Keep-alive timer must continue running while idle sessions exist; simplifies reactivation"
  - id: SES-02
    decision: "reactivateSession resets per-command counters but preserves actionHistory and AI conversation history"
    rationale: "Follow-up commands benefit from accumulated context while starting fresh iteration tracking"
  - id: SES-03
    decision: "conversationSessions Map persisted to chrome.storage.session under fsbConversationSessions key"
    rationale: "Service worker restarts must not lose conversation-to-session mappings"
  - id: SES-04
    decision: "Error/stop paths keep cleanupSession; success/stuck/timeout/max_iterations/no_progress use idleSession"
    rationale: "API failures and user stops should fully tear down; recoverable endings allow follow-up"
  - id: SES-05
    decision: "injectFollowUpContext adds [FOLLOW-UP COMMAND] separator to conversation history"
    rationale: "Clear marker lets AI distinguish between original task context and new follow-up request"
metrics:
  duration: "9m 57s"
  completed: 2026-02-16
---

# Phase 6 Plan 1: Session Continuity Engine Summary

Conversation-scoped session reuse with idle lifecycle and follow-up context injection for multi-command continuity.

## What Was Done

### Task 1: Conversation Session Infrastructure and handleStartAutomation Reuse

Added the core session continuity machinery to background.js:

**New data structures:**
- `conversationSessions` Map -- maps conversationId to { sessionId, lastActiveTime }
- `IDLE_SESSION_TIMEOUT` constant (10 minutes)
- `MAX_CONVERSATION_SESSIONS` constant (5, FIFO eviction)

**New functions:**
- `reactivateSession(session, newTask)` -- resets per-command fields (iterationCount, stuckCounter, consecutiveNoProgressCount, actionSequences, etc.) while preserving cumulative state (actionHistory, stateHistory, tabId, domSettings, AI instance)
- `idleSession(sessionId)` -- transitions session to 'idle' status with deferred cleanup timer; keeps session in activeSessions and AI instance alive
- `persistConversationSessions()` / `restoreConversationSessions()` -- chrome.storage.session persistence for service worker restart survival

**Modified handleStartAutomation:**
- Destructures `conversationId` from request
- Before creating a new session, checks if `conversationId` has an existing idle session
- If found: reactivates session, injects follow-up context into AI, sends response with `continued: true`
- New sessions now carry `conversationId`, `commandCount`, and `commands` fields
- After creating new session, registers in conversationSessions Map

**Completion path changes (6 paths changed):**
- `idleSession()` replaces `cleanupSession()` in: taskComplete success, repeated success detection, stuck (8+ iterations), no_progress, max_iterations, timeout
- `cleanupSession()` preserved in: failedDueToError (API failure), content script not ready, content script health failure, stop handler, tab close handler

**cleanupSession modifications:**
- Now also cleans up conversationSessions entries that reference the deleted session
- Calls `persistConversationSessions()` after cleanup

**restoreSessionsFromStorage modifications:**
- Now restores idle sessions (status === 'idle') in addition to running sessions
- Calls `restoreConversationSessions()` after session restoration

**persistSession modifications:**
- Now includes `conversationId` and `commandCount` in persistable fields

### Task 2: Follow-Up Context Injection in AIIntegration

Added `injectFollowUpContext(newTask)` method to the AIIntegration class:
- Pushes `[FOLLOW-UP COMMAND]` message to conversation history as clear separator
- Updates `_currentTask` to the new task string
- Updates `hardFacts.taskGoal` to the new task (preserves working selectors and critical actions)
- Logs injection with conversation length, hard facts status, and working selector count
- Does NOT call `clearConversationHistory()` -- preserves all accumulated context

## Deviations from Plan

None -- plan executed exactly as written.

## Key Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| SES-01 | Idle sessions stay in activeSessions with 10-min deferred cleanup | Keep-alive timer continues; simplifies reactivation |
| SES-02 | Per-command counters reset, cumulative state preserved | Fresh iteration tracking with accumulated context |
| SES-03 | conversationSessions persisted to chrome.storage.session | Survives service worker restarts |
| SES-04 | Error/stop -> cleanupSession; success/recoverable -> idleSession | API failures tear down; recoverable endings allow follow-up |
| SES-05 | [FOLLOW-UP COMMAND] separator in conversation history | Clear marker for AI to distinguish task contexts |

## Verification Results

All checks passed:
- `conversationSessions` appears 15 times in background.js (declaration, usage in handleStartAutomation, idleSession, cleanupSession, persist/restore)
- `idleSession` appears 7 times (1 definition + 6 completion paths)
- `reactivateSession` appears 2 times (1 definition + 1 call in handleStartAutomation)
- `IDLE_SESSION_TIMEOUT` appears 3 times (constant, comment, usage in setTimeout)
- `injectFollowUpContext` appears 1 time in ai-integration.js (method definition)
- `injectFollowUpContext` appears 2 times in background.js (typeof check + call)
- `cleanupSession` count reduced from 13 to 9 (6 calls replaced with idleSession)
- No syntax errors in either file

## Next Phase Readiness

Plan 06-02 can proceed. It depends on:
- `conversationSessions` Map and `idleSession()` function in background.js
- `injectFollowUpContext()` method in ai-integration.js
- The UI layer (popup/sidepanel) will need to generate and pass `conversationId` in startAutomation messages
