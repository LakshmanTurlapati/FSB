# Phase 6: Unified Session Continuity - Research

**Researched:** 2026-02-15
**Domain:** Chrome Extension session management, service worker state, multi-turn automation
**Confidence:** HIGH

## Summary

This phase addresses the user-reported issue that each new command in the same conversation creates a brand new session with separate logs, separate AI conversation history, and separate analytics entries. The goal is to unify follow-up commands within the same conversation so they share a single session identity, continuous logs, and preserved AI context.

The current architecture creates a fresh session (`session_${Date.now()}`) on every `startAutomation` message. The session cleanup on completion clears the AI instance and its conversation history, deletes the session from `activeSessions`, and saves a separate log entry. The UI (popup.js / sidepanel.js) tracks `currentSessionId` but nulls it on completion, so the next command has no reference to the prior session.

The fix is straightforward: introduce a "conversation session" concept that persists across multiple automation runs. When the UI sends a follow-up command, it should include the prior session's ID. The background should detect this and either reuse the existing session state (AI instance, logs, action history) or create a continuation session that references the parent. The logger should append to the existing session entry rather than creating a new one.

**Primary recommendation:** Keep the AI instance alive after task completion (do not call `clearConversationHistory()`) and reuse the same sessionId for follow-up commands from the same UI conversation, gated by a `conversationId` sent from the UI.

## Standard Stack

This phase requires NO new libraries or dependencies. All changes are internal refactoring of existing session management logic.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | Manifest V3 | `chrome.runtime.sendMessage`, `chrome.storage.local` | Already used throughout the codebase |

### Supporting
None needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing sessionId | Creating linked sessionIds (parent-child) | Parent-child is more complex but preserves individual run boundaries for debugging. Reusing sessionId is simpler and matches user expectation of "one conversation = one session". |
| Conversation ID from UI | Implicit detection (same tab + recent completion) | Explicit conversationId is deterministic and avoids race conditions. Implicit detection is fragile (what if user switches tabs between commands?). |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Current Flow (What Breaks Session Continuity)

```
User sends command 1
  -> UI: handleSendMessage() sends { action: 'startAutomation', task, tabId }
  -> BG: handleStartAutomation() creates sessionId = session_${Date.now()}
  -> BG: creates new AIIntegration instance
  -> BG: starts automation loop
  -> BG: on completion, calls cleanupSession():
       - activeSessions.delete(sessionId)
       - ai.clearConversationHistory()
       - sessionAIInstances.delete(sessionId)
  -> UI: receives automationComplete, nulls currentSessionId

User sends command 2 (follow-up)
  -> UI: handleSendMessage() sends { action: 'startAutomation', task, tabId }
     (NO reference to previous session)
  -> BG: creates BRAND NEW sessionId, new AI instance, fresh logs
  -> All prior context is lost
```

### Target Flow (Unified Session Continuity)

```
User sends command 1
  -> UI: generates conversationId = conv_${Date.now()} (once per UI lifecycle)
  -> UI: handleSendMessage() sends { action: 'startAutomation', task, tabId, conversationId }
  -> BG: handleStartAutomation() creates sessionId, stores conversationId
  -> BG: creates AIIntegration instance
  -> BG: starts automation loop
  -> BG: on completion:
       - saves session data BUT does NOT delete AI instance
       - marks session as "idle" (not "completed")
       - retains in conversationSessions Map keyed by conversationId
  -> UI: receives automationComplete, keeps currentSessionId AND conversationId

User sends command 2 (follow-up in same conversation)
  -> UI: handleSendMessage() sends { action: 'startAutomation', task, tabId, conversationId }
  -> BG: detects conversationId has an existing idle session
  -> BG: reuses same sessionId, reactivates session:
       - increments session.commandCount
       - appends to existing actionHistory
       - preserves AI conversation history
       - appends "[FOLLOW-UP] task" to session log
  -> BG: restarts automation loop with existing session
  -> Logger: appends to existing session log entry

User clicks "New Chat" (sidepanel) or closes/reopens popup
  -> UI: generates NEW conversationId
  -> BG: previous conversation's session stays in completed state
  -> Fully new session on next command
```

### Recommended Data Structure Changes

```javascript
// NEW: conversationSessions Map (background.js)
// Maps conversationId -> { sessionId, aiInstance, lastActiveTime }
let conversationSessions = new Map();

// MODIFIED: sessionData (background.js line ~3679)
const sessionData = {
  ...existingFields,
  conversationId: request.conversationId || null,  // NEW
  commandCount: 1,                                  // NEW: how many commands in this conversation
  commands: [task],                                 // NEW: ordered list of commands in this conversation
};

// NEW: UI-side conversationId (popup.js / sidepanel.js)
let conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
```

### Pattern 1: Conversation-Scoped Session Reuse
**What:** When a follow-up command arrives with the same conversationId, reuse the session and AI instance instead of creating new ones.
**When to use:** Every follow-up command in the same conversation.
**Key logic location:** `handleStartAutomation()` in background.js (~line 3584)
```javascript
// Pseudocode for the session continuation check
async function handleStartAutomation(request, sender, sendResponse) {
  const { task, tabId, conversationId } = request;

  // Check for existing conversation session
  if (conversationId && conversationSessions.has(conversationId)) {
    const convSession = conversationSessions.get(conversationId);
    const existingSession = activeSessions.get(convSession.sessionId);

    // Session must be idle (completed, not running/stuck/error)
    if (existingSession && existingSession.status === 'idle') {
      // Reactivate the session
      existingSession.status = 'running';
      existingSession.task = task;
      existingSession.commandCount++;
      existingSession.commands.push(task);
      existingSession.iterationCount = 0;  // Reset for new command
      existingSession.stuckCounter = 0;
      existingSession.consecutiveNoProgressCount = 0;
      // Keep: actionHistory, stateHistory, conversationHistory (AI), tabId

      const sessionId = convSession.sessionId;
      automationLogger.logFollowUpCommand(sessionId, task, existingSession.commandCount);

      sendResponse({ success: true, sessionId, message: 'Continuing session' });
      startAutomationLoop(sessionId);
      return;
    }
  }

  // ... existing new session creation logic ...
}
```

### Pattern 2: Deferred Session Cleanup
**What:** On task completion, do NOT fully clean up the session. Instead, mark it "idle" and retain the AI instance for potential follow-up. Clean up after a timeout or explicit "New Chat".
**When to use:** Every successful/partial/timeout completion.
**Key logic location:** All completion paths in background.js
```javascript
// MODIFIED completion handler (pseudocode)
if (aiResponse.taskComplete) {
  session.status = 'idle';  // Was: 'completed'
  // ... save session, send automationComplete ...

  // DO NOT call cleanupSession() immediately
  // Instead, schedule deferred cleanup
  session.idleTimeout = setTimeout(() => {
    if (session.status === 'idle') {
      cleanupSession(sessionId);
      conversationSessions.delete(session.conversationId);
    }
  }, IDLE_SESSION_TIMEOUT);  // e.g., 10 minutes
}
```

### Pattern 3: Logger Session Append
**What:** When logging follow-up commands, append to the existing session log entry instead of creating a new one.
**When to use:** Every logSessionStart / saveSession call for a reused session.
```javascript
// MODIFIED saveSession (pseudocode)
async saveSession(sessionId, sessionData = {}) {
  const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
  const sessionStorage = stored.fsbSessionLogs || {};

  if (sessionStorage[sessionId]) {
    // APPEND mode: merge new logs into existing session
    const existing = sessionStorage[sessionId];
    existing.logs = existing.logs.concat(this.getSessionLogs(sessionId).filter(
      log => log.timestamp > existing.endTime
    ));
    existing.endTime = Date.now();
    existing.actionCount = sessionData.actionHistory?.length || existing.actionCount;
    existing.commandCount = sessionData.commandCount || 1;
    sessionStorage[sessionId] = existing;
  } else {
    // NEW mode: create session as before
    // ... existing logic ...
  }
}
```

### Anti-Patterns to Avoid
- **Clearing AI conversation history on completion:** This destroys the context that makes follow-up commands effective. Only clear on explicit "New Chat" or timeout.
- **Resetting actionHistory on follow-up:** The user wants a unified log. Keep all actions from all commands in a single actionHistory array.
- **Implicit conversation detection:** Do not try to guess if a command is a follow-up based on timing or tab ID. Use explicit conversationId from the UI.
- **Keeping sessions alive forever:** Idle sessions consume memory. Use a timeout (5-10 min) to auto-cleanup after last activity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique conversation IDs | Custom UUID generator | `conv_${Date.now()}_${Math.random().toString(36).slice(2,6)}` | Timestamp + random suffix is unique enough for a single browser extension instance |
| Session persistence across service worker restarts | Complex persistence layer | Existing `persistSession()` / `chrome.storage.session` | Already implemented and working |
| Timer cleanup | Manual tracking | `setTimeout` + `clearTimeout` stored on session object | Already pattern used for `pendingTimeout` |

**Key insight:** This phase is about changing control flow, not building new infrastructure. The existing session, logging, and AI systems are fully capable -- they just need to be orchestrated differently.

## Common Pitfalls

### Pitfall 1: Service Worker Restart Destroys Idle Sessions
**What goes wrong:** Chrome can terminate the service worker at any time. An idle session waiting for follow-up would be lost.
**Why it happens:** Manifest V3 service workers are ephemeral. The 5-minute inactivity limit applies when no active ports/alarms exist.
**How to avoid:** Persist the `conversationSessions` mapping to `chrome.storage.session` (session-scoped storage that survives service worker restarts but clears on browser close). On service worker activation, restore from storage.
**Warning signs:** User sends follow-up but gets a brand new session instead of continuation.

### Pitfall 2: Memory Leak from Retained AI Instances
**What goes wrong:** If the idle timeout never fires (e.g., cleared by mistake) or conversations pile up, AI instances with full conversation history remain in memory indefinitely.
**Why it happens:** Each AI instance holds `conversationHistory`, `sessionMemory`, `compactedSummary`, `hardFacts`, etc.
**How to avoid:**
- Hard cap on `conversationSessions.size` (e.g., 5 max)
- FIFO eviction when cap is exceeded
- Idle timeout (5-10 minutes) for automatic cleanup
- `enforceMapLimit()` already exists in background.js (~line 648)
**Warning signs:** Service worker memory usage growing over time in chrome://extensions.

### Pitfall 3: Session State Corruption on Reactivation
**What goes wrong:** Follow-up command reactivates a session but stale state from the previous run causes incorrect behavior (wrong stuckCounter, stale DOM hash, etc.).
**Why it happens:** Not all session fields are reset when transitioning from idle to running.
**How to avoid:** Define an explicit `reactivateSession()` function that:
- Resets: `status`, `stuckCounter`, `consecutiveNoProgressCount`, `iterationCount`, `lastDOMHash`, `lastDOMSignals`, `urlHistory` (or append), `actionSequences`, `sequenceRepeatCount`
- Preserves: `actionHistory` (append), `tabId`, `allowedTabs`, `domSettings`, `conversationId`, AI instance
- Updates: `task`, `startTime` (for new command's timing), `commandCount`
**Warning signs:** Follow-up command immediately triggers stuck detection because stuckCounter was carried over.

### Pitfall 4: Logger Index Corruption
**What goes wrong:** The session index (`fsbSessionIndex`) expects unique session IDs and one entry per session. Updating an existing entry while appending logs could cause index corruption.
**Why it happens:** `saveSession()` uses `findIndex` to update existing index entries, but the timing of saves from the old run and the new run could interleave.
**How to avoid:** Use a single `saveSession()` call at the end of each command run, not during. The debounced `persistLogs()` handles intermediate state.
**Warning signs:** Session list in options page shows duplicate or garbled entries.

### Pitfall 5: UI Desync After Popup Close/Reopen
**What goes wrong:** User closes popup, opens it again. The popup gets a NEW `conversationId` and starts a fresh session, even though the user expects continuity.
**Why it happens:** Popup is destroyed on close. Its `conversationId` variable is lost.
**How to avoid:** For popup.js, store `conversationId` in `chrome.storage.session` and restore on DOMContentLoaded. This way, reopening the popup within the same browser session continues the conversation. The sidepanel persists naturally since it stays open.
**Warning signs:** User closes popup between commands and loses session context.

### Pitfall 6: Race Condition Between Completion and Follow-Up
**What goes wrong:** User sends follow-up command before the previous run has fully completed cleanup. The session is in a transitional state.
**Why it happens:** `automationComplete` message reaches UI before `cleanupSession()` finishes in background.
**How to avoid:** The new flow does NOT call `cleanupSession()` on completion. Instead, the session transitions to `idle` status synchronously. Follow-up commands check for `idle` status. The race condition is eliminated because the session is always in a valid state.
**Warning signs:** Follow-up command gets "session not found" error.

### Pitfall 7: Stale AI Context for Different Tasks
**What goes wrong:** User's follow-up command is about a completely different topic/site, but the AI still has conversation history from the previous task, leading to confusion.
**Why it happens:** Preserving conversation history is a double-edged sword.
**How to avoid:** When reactivating a session, inject a clear separator in the AI conversation:
- Add a system message: "Previous task completed. New follow-up task: [task]"
- The AI's existing compaction mechanism will naturally summarize old context
- The `_currentTask` field on the AI instance is already updated per-command
**Warning signs:** AI references elements or actions from the previous command that are no longer relevant.

## Code Examples

### Example 1: UI ConversationId Generation and Persistence (popup.js)
```javascript
// Source: Direct codebase analysis
// At top of popup.js, alongside existing state variables
let conversationId = null;

// In DOMContentLoaded handler, after existing chrome.storage.local.get
async function initConversationId() {
  const stored = await chrome.storage.session.get(['fsbConversationId']);
  if (stored.fsbConversationId) {
    conversationId = stored.fsbConversationId;
  } else {
    conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await chrome.storage.session.set({ fsbConversationId: conversationId });
  }
}

// In handleSendMessage, modify the startAutomation message:
chrome.runtime.sendMessage({
  action: 'startAutomation',
  task: message,
  tabId: tab.id,
  conversationId: conversationId  // NEW
}, (response) => { /* ... existing handler ... */ });
```

### Example 2: Session Reactivation (background.js)
```javascript
// Source: Direct codebase analysis
function reactivateSession(session, newTask) {
  // Reset per-command fields
  session.status = 'running';
  session.task = newTask;
  session.commandCount = (session.commandCount || 1) + 1;
  session.commands = session.commands || [];
  session.commands.push(newTask);
  session.iterationCount = 0;
  session.stuckCounter = 0;
  session.consecutiveNoProgressCount = 0;
  session.lastDOMHash = null;
  session.lastDOMSignals = null;
  session.actionSequences = [];
  session.sequenceRepeatCount = {};
  session.startTime = Date.now();  // Reset timing for new command

  // Clear idle timeout
  if (session.idleTimeout) {
    clearTimeout(session.idleTimeout);
    session.idleTimeout = null;
  }

  // Preserve: actionHistory, stateHistory, tabId, allowedTabs,
  //           domSettings, conversationId, AI instance
}
```

### Example 3: Deferred Cleanup on Completion (background.js)
```javascript
// Source: Direct codebase analysis
// Replace cleanupSession(sessionId) calls in completion paths with:
const IDLE_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function idleSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.status = 'idle';

  // Do NOT delete from activeSessions
  // Do NOT delete AI instance
  // Do NOT clear conversation history

  // Schedule deferred cleanup
  session.idleTimeout = setTimeout(() => {
    if (session.status === 'idle') {
      automationLogger.debug('Idle session timeout, cleaning up', { sessionId });
      cleanupSession(sessionId);
      if (session.conversationId) {
        conversationSessions.delete(session.conversationId);
      }
    }
  }, IDLE_SESSION_TIMEOUT);
}
```

### Example 4: AI Context Separator for Follow-Up Commands (ai-integration.js)
```javascript
// Source: Direct codebase analysis
// When reactivating for a follow-up, inject separator into conversation
injectFollowUpContext(newTask) {
  // Add a clear break in conversation history
  this.conversationHistory.push({
    role: 'user',
    content: `[FOLLOW-UP COMMAND] My previous task is done. New follow-up request: ${newTask}`
  });

  // Update the current task reference
  this._currentTask = newTask;

  // Update hard facts with new task goal (but preserve working selectors and critical actions)
  if (this.hardFacts) {
    this.hardFacts.taskGoal = newTask;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| New session per command | Conversation-scoped session reuse | This phase | Follow-up commands share context, logs, and AI history |
| Immediate cleanup on completion | Deferred cleanup with idle timeout | This phase | AI retains conversation for follow-ups |
| UI sends only task + tabId | UI sends task + tabId + conversationId | This phase | Background can correlate follow-up commands |

**Deprecated/outdated:**
- None (this is net-new functionality)

## Files That Need Changes

Based on codebase analysis, these files require modifications:

| File | What Changes | Scope |
|------|-------------|-------|
| `background.js` | `handleStartAutomation()`: conversation session lookup/reuse. All completion paths: `idleSession()` instead of `cleanupSession()`. New `reactivateSession()` and `conversationSessions` Map. | Major |
| `ai/ai-integration.js` | New `injectFollowUpContext()` method. `clearConversationHistory()` should not be called on idle transition. | Minor |
| `ui/popup.js` | Generate/persist `conversationId`. Send it with `startAutomation`. Do NOT null `currentSessionId` on completion. | Minor |
| `ui/sidepanel.js` | Same as popup.js. `startNewChat()` generates new `conversationId`. | Minor |
| `utils/automation-logger.js` | `saveSession()`: append mode for existing session entries. New `logFollowUpCommand()` method. | Minor |
| `content.js` | No changes needed | None |

**Note on 3-file constraint:** The STATE.md constraint "All changes modify existing functions in 3 files (background.js, content.js, ai/ai-integration.js)" was established for phases 1-5. Phase 6 was added later with a different scope. This phase necessarily touches UI files (popup.js, sidepanel.js) and the logger (automation-logger.js) because the session identity flows from UI -> background -> logger. content.js does NOT need changes.

## Open Questions

1. **Should failed/stuck sessions be continuable?**
   - What we know: Currently, stuck/error sessions are cleaned up. The user might want to retry after an error.
   - What's unclear: Should the AI retain memory of what failed and why?
   - Recommendation: Yes, allow continuation for `stuck`, `max_iterations`, `timeout`, and `no_progress` outcomes. Only fully clean up on explicit "New Chat" or user-initiated stop. The AI context from a failed attempt is valuable for retry.

2. **What about the `executeAutomationTask()` (background agent) path?**
   - What we know: Background agents use `executeAutomationTask()` which also creates fresh sessions.
   - What's unclear: Should background agents have session continuity too?
   - Recommendation: No. Background agents are scheduled, autonomous tasks. They should continue creating fresh sessions. Only the interactive UI path (popup/sidepanel) needs continuity.

3. **Idle timeout duration?**
   - What we know: Too short = loses context prematurely. Too long = wastes memory.
   - What's unclear: What is a typical gap between user commands?
   - Recommendation: Start with 10 minutes. This covers the common case of reviewing results before sending a follow-up. Can be adjusted based on user feedback.

4. **Should the keep-alive timer run during idle?**
   - What we know: `startKeepAlive()` pings every 25 seconds to prevent service worker termination. Currently stopped when no active sessions.
   - What's unclear: Should idle sessions keep the service worker alive?
   - Recommendation: Yes, keep-alive should run while any session is idle. The service worker needs to stay alive to serve the idle session's state. The idle timeout (10 min) is the upper bound.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `background.js` (7079 lines), `ai/ai-integration.js`, `utils/automation-logger.js`, `ui/popup.js`, `ui/sidepanel.js`
- Chrome Extension Manifest V3 service worker lifecycle (official docs)
- `chrome.storage.session` API (session-scoped storage that survives service worker restarts)

### Secondary (MEDIUM confidence)
- None needed -- this is entirely internal refactoring with no external dependencies

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure internal refactoring
- Architecture: HIGH - patterns derived directly from existing codebase analysis
- Pitfalls: HIGH - identified from known Chrome Extension service worker behavior and actual code paths

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable -- no external dependencies to change)
