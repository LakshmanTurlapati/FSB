# Phase 8: Session Replay - Research

**Researched:** 2026-02-15
**Domain:** Chrome Extension session replay / deterministic action re-execution
**Confidence:** HIGH

## Summary

Session replay for FSB means taking a previously stored automation session (with its enriched action history) and re-executing the same sequence of successful actions on the current or similar page. This is NOT video/DOM recording replay (like rrweb); it is **action-level replay** -- re-dispatching the same tool calls (click, type, navigate, etc.) that succeeded in the original session.

The existing codebase already has almost everything needed. Session data is stored in `chrome.storage.local` under `fsbSessionLogs` (full session with logs) and `fsbSessionIndex` (lightweight index). Each session's `actionHistory` array contains enriched entries with `{tool, params, result: {success, hadEffect, selectorUsed, elementText, ...}, iteration, timestamp}`. The `getReplayData()` method in automation-logger.js already structures session data into a replay-friendly format with steps, targeting info, and results -- though it reads from in-memory `actionRecords` (which are lost on service worker restart) rather than from persisted storage. The existing action execution path via `sendMessageWithRetry -> content.js executeAction` is the same path replay should use.

**Primary recommendation:** Build a lightweight replay engine in background.js that loads a session's action history from `fsbSessionLogs` in `chrome.storage.local`, filters to successful actions only, and re-executes them sequentially through the existing `sendMessageWithRetry` path. Add a "Replay" button to each session history item in the sidepanel. No AI involvement during replay -- pure deterministic re-execution with selector fallback and step-by-step UI feedback.

## Standard Stack

### Core (all existing -- no new dependencies)

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `chrome.storage.local` | Built-in | Session data persistence (fsbSessionLogs, fsbSessionIndex) | Already stores all session data |
| `sendMessageWithRetry()` | background.js ~line 1628 | Action execution with retry and fallback | Existing reliable action dispatch path |
| `content.js executeAction` | content.js ~line 11470 | DOM action execution (click, type, etc.) | Full 25+ tool library already working |
| `automationLogger` | utils/automation-logger.js | Session storage and retrieval | Already has saveSession, loadSession, getReplayData methods |
| `sidepanel.js` | ui/sidepanel.js | History view with session items | Already renders session list with event delegation |

### Supporting

| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| `slimActionResult()` | background.js ~line 1600 | Slim action results for storage | When recording replay action results |
| `getActionStatus()` | background.js ~line 117 | Human-readable status from tool+params | For replay progress UI messages |
| `checkContentScriptHealth()` | background.js | Verify content script is alive | Before starting replay |
| `sendSessionStatus()` | background.js | Visual feedback to content script | For progress overlay during replay |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom replay engine | Re-feed actions to AI for re-planning | Wastes AI tokens, slower, non-deterministic -- defeats the purpose of replay |
| Stored selectors only | Re-analyze DOM to find elements | Unnecessary complexity; stored selectors + existing fallback chain already handle this |
| New storage format | Existing fsbSessionLogs | Adding another storage format adds complexity; existing data has everything needed |

## Architecture Patterns

### Recommended Approach

```
User clicks "Replay" on session item
  |
  v
sidepanel.js sends { action: 'replaySession', sessionId } to background.js
  |
  v
background.js handleReplaySession():
  1. Load session from chrome.storage.local (fsbSessionLogs)
  2. Extract successful actions from actionHistory (filter success===true)
  3. Create a replay session in activeSessions with status: 'replaying'
  4. Execute actions sequentially via sendMessageWithRetry
  5. Send statusUpdate messages to UI after each step
  6. On completion/failure, send automationComplete/automationError
  |
  v
Content.js receives executeAction messages (same path as normal automation)
```

### Data Flow

```
chrome.storage.local
  fsbSessionLogs[sessionId]
    -> session.logs (logger entries -- NOT useful for replay)
    -> Need to also store actionHistory in fsbSessionLogs

background.js activeSessions Map
  -> session.actionHistory[] (in-memory during active session)
    -> {timestamp, tool, params, result: slimActionResult, iteration}

Replay reads from: fsbSessionLogs[sessionId].actionHistory  (MUST be added to saveSession)
Replay executes via: sendMessageWithRetry(tabId, {action: 'executeAction', tool, params})
```

### Critical Gap: actionHistory Not Persisted in fsbSessionLogs

**This is the most important finding.** The current `saveSession()` in automation-logger.js stores:
- `id`, `task`, `startTime`, `endTime`, `status`, `tabId`, `actionCount`, `iterationCount`, `commandCount`, `logs`

It does NOT store `actionHistory`. The `actionHistory` array lives only in the in-memory `activeSessions` Map entry. When a session is cleaned up (10-min idle timeout or explicit cleanup), the actionHistory is lost.

The `getReplayData()` method in automation-logger reads from `this.actionRecords`, which is also in-memory only (populated by `logActionRecord()` calls). This data is likewise lost on service worker restart.

**Fix:** Pass `actionHistory` to `saveSession()` and persist it in `fsbSessionLogs[sessionId].actionHistory`. This is the single most critical change needed.

### Recommended Project Structure (changes only)

```
background.js:
  + handleReplaySession()       # New message handler
  + executeReplaySequence()     # Sequential action executor
  ~ saveSession calls           # Pass actionHistory in sessionData

utils/automation-logger.js:
  ~ saveSession()               # Store actionHistory array alongside logs

ui/sidepanel.js:
  + replaySession()             # Trigger replay from history item click
  ~ loadHistoryList()           # Add replay button to session items
  ~ message listener            # Handle replay-specific status updates

ui/sidepanel.html:
  (no changes -- history view already exists)

ui/sidepanel.css:
  + replay button styles
  + replay status indicator styles
```

### Pattern 1: Replay Session Creation

**What:** Create a lightweight session object for tracking replay state
**When to use:** When user initiates a replay

```javascript
// In background.js handleReplaySession()
const replaySessionData = {
  task: `Replay: ${originalSession.task}`,
  tabId: targetTabId,
  status: 'replaying',
  startTime: Date.now(),
  maxIterations: 0,  // Not AI-driven, no iteration limit
  actionHistory: [],  // Track replay action results
  stateHistory: [],
  failedAttempts: {},
  failedActionDetails: {},
  stuckCounter: 0,
  consecutiveNoProgressCount: 0,
  iterationCount: 0,
  urlHistory: [],
  lastUrl: null,
  actionSequences: [],
  sequenceRepeatCount: {},
  allowedTabs: [targetTabId],
  tabHistory: [],
  isReplay: true,  // Flag to distinguish from AI sessions
  originalSessionId: sessionId,
  replaySteps: successfulActions,  // The actions to replay
  currentStep: 0,
  totalSteps: successfulActions.length,
  animatedActionHighlights: true
};
```

### Pattern 2: Sequential Action Execution (No AI)

**What:** Execute stored actions one at a time, skipping AI roundtrips
**When to use:** Core replay execution loop

```javascript
// In background.js executeReplaySequence()
async function executeReplaySequence(replaySessionId) {
  const session = activeSessions.get(replaySessionId);
  if (!session || session.status !== 'replaying') return;

  for (let i = session.currentStep; i < session.replaySteps.length; i++) {
    if (isSessionTerminating(replaySessionId)) return;

    const step = session.replaySteps[i];
    session.currentStep = i;

    // Send status update
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      sessionId: replaySessionId,
      message: getActionStatus(step.tool, step.params),
      iteration: i + 1,
      maxIterations: session.totalSteps,
      progressPercent: Math.round(((i + 1) / session.totalSteps) * 100)
    }).catch(() => {});

    // Execute action through existing path
    const actionResult = await sendMessageWithRetry(session.tabId, {
      action: 'executeAction',
      tool: step.tool,
      params: step.params,
      visualContext: {
        taskName: session.task,
        stepNumber: i + 1,
        totalSteps: session.totalSteps,
        iterationCount: 1,
        isReplay: true,
        animatedHighlights: session.animatedActionHighlights
      }
    });

    // Record result
    session.actionHistory.push({
      timestamp: Date.now(),
      tool: step.tool,
      params: step.params,
      result: slimActionResult(actionResult),
      replayStep: i + 1
    });

    if (!actionResult?.success) {
      // Step failed -- decide whether to continue or abort
      // Strategy: skip failed step and continue (non-critical actions)
      // or abort (navigation/critical actions)
      const criticalTools = ['navigate', 'searchGoogle'];
      if (criticalTools.includes(step.tool)) {
        // Critical step failed -- abort replay
        session.status = 'replay_failed';
        break;
      }
      // Non-critical: log warning, continue to next step
    }

    // Inter-action delay (shorter than AI-driven since no DOM analysis needed)
    if (i < session.replaySteps.length - 1) {
      const delay = getReplayDelay(step.tool);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Pattern 3: Replay Button in History View

**What:** Add a replay trigger to each history item
**When to use:** History view UI

```javascript
// In sidepanel.js loadHistoryList() -- modify the history item template
// Add replay button next to delete button for completed/stuck sessions
'<button class="history-replay-btn" data-session-id="' + escapeHtml(session.id) + '" title="Replay session">' +
  '<i class="fa fa-play"></i>' +
'</button>'

// Event delegation on historyList (same pattern as delete buttons)
historyListEl.addEventListener('click', async (e) => {
  const replayBtn = e.target.closest('.history-replay-btn');
  if (replayBtn) {
    e.stopPropagation();
    const sessionId = replayBtn.dataset.sessionId;
    await startReplay(sessionId);
    return;
  }
  // ... existing delete handler
});
```

### Anti-Patterns to Avoid

- **Do NOT involve the AI during replay.** The entire point of replay is deterministic, fast re-execution without AI token costs. If selectors fail, use the existing coordinate fallback in content.js, not AI re-planning.
- **Do NOT create a separate replay data format.** Use the existing `actionHistory` entries directly. They already contain `{tool, params, result}` which is exactly what `executeAction` needs.
- **Do NOT replay failed actions.** Filter to `success === true` before building the replay sequence. Replaying failed actions wastes time and guarantees failures.
- **Do NOT replay `getText`, `getAttribute`, or other read-only actions.** These gather information for AI decision-making and have no effect during replay. Only replay actions that modify state (click, type, navigate, etc.).
- **Do NOT allow replay while another automation is running.** Check `isRunning` state before starting replay.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Action execution | Custom replay executor | `sendMessageWithRetry` + content.js `executeAction` | Already handles retries, BFCache, tab recovery, visual feedback |
| Element targeting | Custom selector resolution | Content.js selector chain (CSS -> Shadow DOM -> XPath -> coordinate) | Existing fallback chain handles stale selectors |
| Session storage | Custom replay data store | `fsbSessionLogs` in chrome.storage.local | Just add actionHistory to existing saveSession data |
| Progress UI | Custom replay UI | Existing `statusUpdate` + `automationComplete` message flow | Sidepanel already handles these messages |
| Visual feedback | Custom highlight system | Existing `actionGlowOverlay` + `progressOverlay` via visualContext | Already integrated into executeAction path |
| Status generation | Custom step descriptions | `getActionStatus(tool, params)` in background.js | Already maps every tool to human-readable status |

## Common Pitfalls

### Pitfall 1: actionHistory Not Persisted

**What goes wrong:** Replay fails because actionHistory data is not available -- it lived only in memory and was lost when the session was cleaned up.
**Why it happens:** `automationLogger.saveSession()` stores logs but not actionHistory. The `actionHistory` array lives only in `activeSessions` Map entries.
**How to avoid:** Modify all `saveSession()` call sites to pass `actionHistory` in the sessionData parameter. Modify `saveSession()` to persist it alongside logs.
**Warning signs:** Session loads from storage but has no actionHistory or empty actionHistory.

### Pitfall 2: Stale Selectors on Different Page

**What goes wrong:** User replays a session but is on a different page/state than the original, so selectors don't match any elements.
**Why it happens:** Replay assumes the page is in a similar state to when the original session ran.
**How to avoid:** (1) Check if the current URL broadly matches the original session's first URL. If not, warn the user. (2) Rely on content.js's existing selector fallback chain which includes coordinate fallback. (3) Allow non-critical action failures to be skipped rather than aborting the entire replay.
**Warning signs:** Multiple consecutive "Element not found" failures in the first few replay steps.

### Pitfall 3: Navigation Actions Change the Page Mid-Replay

**What goes wrong:** A `navigate` or `searchGoogle` action changes the page, but the post-navigation DOM differs from the original session, causing subsequent selectors to fail.
**Why it happens:** Pages are dynamic; content varies between sessions.
**How to avoid:** After navigation actions, add a `pageLoadWatcher.waitForPageReady()` call (already exists in the normal flow). Accept that some post-navigation steps may need to be skipped.
**Warning signs:** Actions immediately after navigate/searchGoogle/goBack fail.

### Pitfall 4: Replay Session Leaks into Normal Automation State

**What goes wrong:** A replay session interferes with the conversation session map, AI instances, or other normal automation state.
**Why it happens:** Replay session uses the same activeSessions Map without proper isolation.
**How to avoid:** Mark replay sessions with `isReplay: true`. Don't create AI instances for replay sessions. Don't register replay sessions in `conversationSessions`. Use a separate replay-specific cleanup path.
**Warning signs:** Follow-up commands after replay get confused about session state.

### Pitfall 5: Replaying Type Actions Without Clearing Input First

**What goes wrong:** Type actions append text to fields that already have content, resulting in doubled/garbled input.
**Why it happens:** The original session may have typed into empty fields, but on replay the fields might have prior content.
**How to avoid:** Before each `type` action in replay, prepend a `clearInput` action targeting the same selector. This is a replay-only preprocessing step.
**Warning signs:** Input fields contain concatenated text (original + replayed).

### Pitfall 6: Storage Quota Exceeded with actionHistory

**What goes wrong:** Adding actionHistory to fsbSessionLogs pushes storage usage too high, causing write failures.
**Why it happens:** Each action entry is ~120 bytes (per MEM-02-01). A session with 50 actions adds ~6KB. With 50 sessions, that's ~300KB. Combined with logs, this could approach limits.
**How to avoid:** (1) Cap actionHistory to last 100 actions per session (matching the existing `actionRecords` cap at 250). (2) Only store successful actions in the replay-ready format. (3) The existing 50-session cap in saveSession provides natural bounds.
**Warning signs:** chrome.storage.local.set() throws QUOTA_EXCEEDED errors.

### Pitfall 7: Service Worker Dies During Replay

**What goes wrong:** Chrome kills the service worker mid-replay (5-min timeout), losing replay state.
**Why it happens:** Chrome MV3 service workers have a strict 5-minute inactivity timeout.
**How to avoid:** The existing `startKeepAlive()` mechanism keeps the service worker alive during active sessions. Replay sessions should trigger the same keep-alive. Since replay adds to `activeSessions`, the existing `activeSessions.size > 0` check in `cleanupSession` will maintain keep-alive.
**Warning signs:** Replay stops partway through with no error message.

## Code Examples

### Loading Session Data for Replay

```javascript
// In background.js
async function loadReplayableSession(sessionId) {
  try {
    const stored = await chrome.storage.local.get(['fsbSessionLogs']);
    const session = (stored.fsbSessionLogs || {})[sessionId];
    if (!session) return null;

    const actionHistory = session.actionHistory || [];
    if (actionHistory.length === 0) return null;

    // Filter to successful state-changing actions only
    const replayableTools = new Set([
      'click', 'rightClick', 'doubleClick', 'type', 'clearInput',
      'pressEnter', 'keyPress', 'selectOption', 'toggleCheckbox',
      'navigate', 'searchGoogle', 'scroll', 'goBack', 'goForward',
      'refresh', 'hover', 'focus', 'moveMouse', 'waitForElement'
    ]);

    const replayableActions = actionHistory.filter(entry =>
      entry.result?.success === true &&
      replayableTools.has(entry.tool)
    );

    return {
      session,
      replayableActions,
      originalTask: session.task,
      originalUrl: session.logs?.[0]?.data?.url || null
    };
  } catch (error) {
    automationLogger.error('Failed to load replayable session', { sessionId, error: error.message });
    return null;
  }
}
```

### Saving actionHistory in saveSession

```javascript
// In automation-logger.js saveSession() -- modify the NEW MODE block
const session = {
  id: sessionId,
  task: sessionData.task || 'Unknown task',
  startTime: sessionData.startTime || Date.now(),
  endTime: Date.now(),
  status: sessionData.status || 'completed',
  tabId: sessionData.tabId || null,
  actionCount: sessionData.actionHistory?.length || 0,
  iterationCount: sessionData.iterationCount || 0,
  commandCount: sessionData.commandCount || 1,
  logs: sessionLogs,
  // NEW: Persist actionHistory for replay (only successful actions, capped)
  actionHistory: (sessionData.actionHistory || [])
    .filter(a => a.result?.success)
    .slice(-100)
    .map(a => ({ tool: a.tool, params: a.params, result: a.result }))
};
```

### Inter-Action Delay for Replay

```javascript
// In background.js -- replay-specific delays (faster than AI-driven)
function getReplayDelay(tool) {
  // Navigation actions need page load time
  if (['navigate', 'searchGoogle', 'goBack', 'goForward'].includes(tool)) return 1500;
  // Click may trigger navigation or modals
  if (tool === 'click' || tool === 'doubleClick' || tool === 'rightClick') return 500;
  // Type needs brief delay for input processing
  if (tool === 'type' || tool === 'keyPress' || tool === 'pressEnter') return 300;
  // Everything else
  return 200;
}
```

### Replay Message Handler

```javascript
// In background.js message listener (switch statement)
case 'replaySession':
  handleReplaySession(request, sender, sendResponse);
  return true; // async

case 'stopReplay':
  // Reuse existing stopAutomation path since replay uses activeSessions
  handleStopAutomation(request, sender, sendResponse);
  return true;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getReplayData()` reads in-memory `actionRecords` | Should read from persisted `fsbSessionLogs.actionHistory` | Phase 8 | Replay works across service worker restarts |
| `saveSession()` stores logs only | Should also store actionHistory | Phase 8 | Data actually available for replay |
| History items are view-only | Add replay button | Phase 8 | Users can re-run successful automations |

**Existing but unused:**
- `automationLogger.getReplayData()` -- exists but reads from in-memory `actionRecords` which are lost on service worker restart. Useful as reference for the data shape, but not directly usable for the replay feature.
- `automationLogger.exportHumanReadable()` -- exists for debugging export but could be adapted for replay preview.

## Open Questions

1. **Should replay work cross-domain?**
   - What we know: Original session may have navigated across domains. Replay could start from the same URL.
   - What's unclear: Should replay enforce starting on the same domain, or allow starting from any page?
   - Recommendation: Show a warning if current URL domain differs from original session's starting URL, but allow the user to proceed. If the first action is `navigate`, the replay will get to the right page anyway.

2. **Should failed replay steps retry or skip?**
   - What we know: The existing `sendMessageWithRetry` already retries 3 times with content script re-injection.
   - What's unclear: If a step fails after all retries, should replay abort, skip, or offer user choice?
   - Recommendation: Skip non-critical failures (read actions, hover), abort on critical failures (navigate to wrong page). Show a summary at the end with skipped steps.

3. **Should replay speed be configurable?**
   - What we know: Fixed delays are simple. Users may want faster or slower replay.
   - What's unclear: Is this needed for v1?
   - Recommendation: Defer to future. Start with sensible fixed delays. Can add a speed slider later.

4. **What about params with dynamic data (timestamps, session tokens)?**
   - What we know: Some action params may contain dynamic values that won't work on replay.
   - What's unclear: How common this is in practice.
   - Recommendation: Don't try to solve this generically. URL params in `navigate` actions are the main concern -- they usually work fine. If specific cases arise, handle them incrementally.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of background.js (~8000+ lines) -- session management, action execution, saveSession flow
- Direct code analysis of automation-logger.js (558 lines) -- saveSession, loadSession, getReplayData, actionRecords
- Direct code analysis of sidepanel.js (1240 lines) -- history view, event delegation, message handling
- Direct code analysis of content.js executeAction handler (~line 11470) -- action dispatch, visual feedback, selector resolution

### Secondary (MEDIUM confidence)
- STATE.md decisions (MEM-02-01, SES-01 through SES-08, HIST-01 through HIST-03) -- validated against actual code
- ROADMAP.md Phase 8 description -- provides goals and dependency context

### Tertiary (LOW confidence)
- None -- all findings based on direct code analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components are existing code, directly verified
- Architecture: HIGH -- replay pattern follows existing action execution path exactly
- Pitfalls: HIGH -- identified through direct code analysis of data flow gaps
- Data persistence gap: HIGH -- verified that saveSession does NOT store actionHistory

**Research date:** 2026-02-15
**Valid until:** No expiration (internal codebase analysis, not external library)
