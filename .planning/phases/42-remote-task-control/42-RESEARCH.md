# Phase 42: Remote Task Control - Research

**Researched:** 2026-03-17
**Domain:** WebSocket-based remote task submission, real-time progress relay, dashboard UI state machine
**Confidence:** HIGH

## Summary

Phase 42 connects the dashboard to the extension's automation engine via the existing blind WS relay. The extension already has all the progress data internally (detectTaskPhase, calculateProgress, generateActionSummary). The dashboard already has a WS connection with message dispatching (handleWSMessage). The relay server already forwards any typed JSON between paired extension/dashboard clients. No server changes are needed.

The work decomposes into three integration layers: (1) Extension-side -- add a handler in `ws-client.js` for `dash:task-submit` messages that triggers automation via `handleStartAutomation`'s session creation logic, and broadcast progress/completion events via `fsbWebSocket.send()` alongside existing `sendSessionStatus` calls. (2) Dashboard-side -- add a task input component in `dashboard.html`, a state machine in `dashboard.js` that transitions between idle/running/complete/failed states, and CSS for the progress bar and transitions. (3) Protocol glue -- define three WS message types (`dash:task-submit`, `ext:task-progress`, `ext:task-complete`) that flow through the existing relay unchanged.

**Primary recommendation:** Wire the extension's existing progress pipeline (sendSessionStatus + calculateProgress + generateActionSummary) to also broadcast via fsbWebSocket.send(), add a dash:task-submit handler in ws-client.js that creates sessions programmatically, and build a simple state-machine UI component on the dashboard.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Task input bar at **top of dashboard content area**, always visible when paired
- Prominent text input with placeholder "What should FSB do?" and submit button to the right
- **One task at a time** -- input disabled/grayed while running (matches single-tab model)
- **Inline transition** -- input area transforms into progress view, no page change
- Input text becomes task title above progress bar
- When task completes, input reappears below result summary
- **Thin horizontal progress bar** below task title, fills left-to-right with #ff6b35
- Percentage text on right side of bar
- Metadata below bar: phase label, ETA countdown, elapsed time
- **Single updating line** for action summaries, prefixed with ">", updates in place (not scrolling log)
- Data flow: Extension sends `ext:task-progress` WS messages, dashboard renders what it receives
- Success: bar fills 100%, turns green, shows elapsed time and result summary
- Failure: bar turns red, shows error description, retry button
- **No task history panel** -- only current/last task visible
- WS protocol: `dash:task-submit`, `ext:task-progress`, `ext:task-complete` through blind relay
- All messages flow through existing blind WS relay -- no server changes needed

### Claude's Discretion
- Exact input field styling and submit button icon
- Transition animation between input and progress states
- How extension generates action summary text (from existing automation logger or AI provider)
- Progress estimation accuracy improvements
- Exact error message wording for failure scenarios
- Whether "Retry" re-sends same text or lets user edit first

### Deferred Ideas (OUT OF SCOPE)
- Live DOM streaming (watching FSB's browser in real time) -- Phase 44
- Task queue / multiple concurrent tasks -- future consideration
- Task templates / quick-launch presets -- TMPL-01

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TASK-01 | User can type a task on dashboard and FSB executes it in the user's browser | Dashboard sends `dash:task-submit` via WS, extension receives it in `_handleMessage`, creates session via `executeAutomationTask`-like flow, triggers `startAutomationLoop` |
| TASK-02 | Dashboard shows real-time progress (%, phase, ETA) during task execution | Extension broadcasts `ext:task-progress` with data from `calculateProgress()` + `detectTaskPhase()` alongside each `sendSessionStatus` call |
| TASK-03 | Dashboard displays AI-generated action summaries as task executes | Extension includes `generateActionSummary()` output in `ext:task-progress` messages; dashboard renders as single updating line |
| TASK-04 | User can see task completion status and results on dashboard | Extension sends `ext:task-complete` with `{success, summary, elapsed}` or `{success: false, error, elapsed}` when session ends |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2020 | Dashboard + extension code | Project convention -- no build system, no frameworks |
| Chrome Extension MV3 | Manifest V3 | Extension service worker | Existing extension platform |
| WebSocket (native) | Browser API | Dashboard <-> server communication | Already established in Phase 40/41 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FSBWebSocket class | Custom (ws-client.js) | Extension WS client | Send/receive typed messages to/from relay server |
| ws (server) | ^8.19 | Server-side WebSocket | Already installed, blind relay -- no changes needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom state machine | State management library | Overkill for 4 states (idle/running/success/failed) |
| CSS animations | Animation library | Unnecessary -- CSS transitions handle progress bar and state changes |

**Installation:**
No new dependencies required. All code is vanilla JS using existing patterns.

## Architecture Patterns

### Data Flow
```
Dashboard                    WS Relay Server              Extension
   |                              |                          |
   |-- dash:task-submit --------->|-- relay to extension --->|
   |                              |                          |-- creates session
   |                              |                          |-- startAutomationLoop()
   |                              |                          |
   |<-- ext:task-progress --------|<-- relay to dashboard ---|-- on each iteration
   |<-- ext:task-progress --------|<-- relay to dashboard ---|-- on each action
   |<-- ext:task-progress --------|<-- relay to dashboard ---|-- on AI summary ready
   |                              |                          |
   |<-- ext:task-complete --------|<-- relay to dashboard ---|-- session ends
```

### WS Message Protocol (Exact Shapes)

```javascript
// Dashboard -> Extension: Submit task
{
  type: 'dash:task-submit',
  payload: { task: 'Search for flights to Tokyo' },
  ts: 1710700000000
}

// Extension -> Dashboard: Progress update (sent frequently during execution)
{
  type: 'ext:task-progress',
  payload: {
    progress: 45,              // 0-100 from calculateProgress()
    phase: 'extraction',       // from detectTaskPhase(): 'navigation'|'extraction'|'writing'
    eta: '~30s',               // from calculateProgress().estimatedTimeRemaining
    elapsed: 15000,            // ms since session.startTime
    action: 'Reading search results',  // AI summary or static getActionStatus() label
    status: 'running'          // always 'running' during progress
  },
  ts: 1710700015000
}

// Extension -> Dashboard: Task complete (success)
{
  type: 'ext:task-complete',
  payload: {
    success: true,
    summary: 'Found 3 flights from SFO to Tokyo, cheapest $450 on ANA',
    elapsed: 45000              // total duration ms
  },
  ts: 1710700045000
}

// Extension -> Dashboard: Task complete (failure)
{
  type: 'ext:task-complete',
  payload: {
    success: false,
    error: 'Could not find the booking button',
    elapsed: 30000
  },
  ts: 1710700030000
}
```

### Pattern 1: Extension-Side Progress Broadcasting
**What:** Alongside every existing `sendSessionStatus()` call, also broadcast via `fsbWebSocket.send()`.
**When to use:** Every time `sendSessionStatus` is called during a dashboard-initiated task.
**Example:**
```javascript
// In background.js -- add a helper function
function broadcastTaskProgress(session) {
  if (!session._isDashboardTask) return; // Only broadcast for dashboard-initiated tasks
  const progress = calculateProgress(session);
  const phase = detectTaskPhase(session);
  fsbWebSocket.send('ext:task-progress', {
    progress: progress.progressPercent,
    phase: phase,
    eta: progress.estimatedTimeRemaining,
    elapsed: Date.now() - session.startTime,
    action: session.lastActionStatusText || 'Working...',
    status: 'running'
  });
}
```

### Pattern 2: Dashboard UI State Machine
**What:** A single component that transitions between 4 states: idle, running, success, failed.
**When to use:** Task control area in dashboard.
**Example:**
```javascript
// State machine for task control UI
var taskState = 'idle'; // 'idle' | 'running' | 'success' | 'failed'
var taskText = '';

function setTaskState(newState, data) {
  taskState = newState;
  // Toggle CSS classes on the container
  var container = document.getElementById('dash-task-area');
  container.className = 'dash-task-area dash-task-' + newState;
  // Update content based on state
  switch (newState) {
    case 'idle':     renderTaskInput(); break;
    case 'running':  renderTaskProgress(data); break;
    case 'success':  renderTaskSuccess(data); break;
    case 'failed':   renderTaskFailed(data); break;
  }
}
```

### Pattern 3: Extension-Side Task Submission Handler
**What:** Handle `dash:task-submit` in ws-client.js `_handleMessage`, create a session and start automation.
**When to use:** When dashboard user submits a task.
**Example:**
```javascript
// In ws-client.js _handleMessage
case 'dash:task-submit': {
  const task = msg.payload?.task;
  if (!task) break;
  // Get active tab to run automation on
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    this.send('ext:task-complete', { success: false, error: 'No active tab available', elapsed: 0 });
    break;
  }
  // Mark as dashboard-initiated for progress broadcasting
  // Trigger automation via the programmatic API
  this._startDashboardTask(activeTab.id, task);
  break;
}
```

### Anti-Patterns to Avoid
- **Modifying the WS relay server:** The server is a blind relay by design. All message types flow through unchanged. Do NOT add server-side routing for task messages.
- **Building a scrolling action log:** CONTEXT.md specifies a single updating line for action summaries, not a log. Previous actions are not displayed.
- **Separate page/panel for task control:** The task UI is inline -- the input area transforms into the progress view. No new pages, modals, or panels.
- **Polling for progress:** Progress arrives via WS push. Do not poll the extension or server for task status.
- **Creating multiple session types:** Use the existing session model. A dashboard-initiated task is just a regular automation session with an extra `_isDashboardTask` flag.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress calculation | Custom progress algorithm | `calculateProgress()` (background.js:745) | Already handles phase-weighted progress, ETA blending with complexity estimates, never-backward logic |
| Task phase detection | Custom phase classifier | `detectTaskPhase()` (background.js:704) | Already classifies actions into navigation/extraction/writing with tool-set analysis |
| Action descriptions | Custom action labeler | `getActionStatus()` (background.js:518) + `generateActionSummary()` (background.js:986) | Static labels as fallback, AI-generated contextual descriptions as enhancement |
| Task summarization | Custom task title shortener | `summarizeTask()` (background.js:922) | AI-powered task label summarization already exists |
| WS message sending | Raw WebSocket.send() | `fsbWebSocket.send(type, payload)` (ws-client.js:108) | Handles JSON envelope with `{type, payload, ts}` format automatically |
| Reconnection logic | Custom reconnect handler | Existing exponential backoff in both ws-client.js and dashboard.js | Already handles immediate retry + 1s/2s/4s/.../30s cap |
| Time formatting | Custom duration formatter | `formatDuration()` (background.js:687) and dashboard.js equivalent | Already exists in both contexts |

**Key insight:** The extension already computes every data point the dashboard needs. This phase is purely about piping existing data through WS and rendering it.

## Common Pitfalls

### Pitfall 1: Tab ID Unavailability for Remote Tasks
**What goes wrong:** Dashboard sends a task, but the extension can't determine which tab to run it on because there's no `sender.tab` in a WS message (unlike chrome.runtime.onMessage).
**Why it happens:** WS messages don't carry tab context. The `handleStartAutomation` function expects `tabId` from `request.tabId` or `sender.tab?.id`.
**How to avoid:** Use `chrome.tabs.query({ active: true, currentWindow: true })` in the extension to get the user's current active tab when receiving a dashboard task. This mirrors what the user would see if they typed the task locally.
**Warning signs:** Error "Cannot access tab undefined" or automation running on wrong tab.

### Pitfall 2: Race Condition Between Task Submission and Active Session
**What goes wrong:** User submits a task from dashboard while another task is already running (from the sidepanel or another source).
**Why it happens:** The dashboard doesn't know about locally-started sessions unless explicitly told.
**How to avoid:** Before starting a dashboard-initiated task, check `activeSessions.size > 0` for running sessions. If busy, send back an `ext:task-complete` with `{success: false, error: 'Another task is already running'}`. Also send `ext:task-progress` with `status: 'busy'` so the dashboard disables the input.
**Warning signs:** Two concurrent sessions causing tab conflicts or overlapping overlays.

### Pitfall 3: WS Disconnection During Task Execution
**What goes wrong:** Dashboard disconnects mid-task. When it reconnects, it has no idea a task is running.
**Why it happens:** WS relay doesn't persist messages. Real-time events are fire-and-forget.
**How to avoid:** On WS reconnection, the extension already sends an `ext:snapshot` message. Extend this snapshot to include current task state if a dashboard-initiated task is active: `{taskRunning: true, task, progress, phase, elapsed}`. Dashboard handles `ext:snapshot` to restore task UI state.
**Warning signs:** Dashboard shows idle state while extension is actively running a task.

### Pitfall 4: Session Completion Notification Not Reaching Dashboard
**What goes wrong:** The automation completes (via `chrome.runtime.sendMessage({action: 'automationComplete'})`) but the dashboard never gets notified because completion is sent via internal Chrome messaging, not WS.
**Why it happens:** The existing completion flow uses `chrome.runtime.sendMessage` which only reaches other extension pages (popup, sidepanel), not the dashboard over WS.
**How to avoid:** Hook into the completion paths. Every place that sends `automationComplete` (roughly 10 locations in background.js) needs to also send `ext:task-complete` via `fsbWebSocket.send()` if the session was dashboard-initiated. Use a single helper function.
**Warning signs:** Dashboard progress bar stuck at <100%, never transitions to success/failure.

### Pitfall 5: Progress Flooding on Dashboard
**What goes wrong:** Extension sends progress updates on every action (could be 20+ per task), causing excessive DOM updates on the dashboard.
**Why it happens:** `sendSessionStatus` is called for every action, AI summary, and iteration.
**How to avoid:** Throttle WS broadcasts to at most once per second. The dashboard should also use requestAnimationFrame for progress bar updates. Progress data is incremental (never goes backward per calculateProgress logic), so skipping intermediate updates is safe.
**Warning signs:** Dashboard becomes sluggish during fast automation, especially on mobile.

### Pitfall 6: Extension WS Not Connected When Task Arrives
**What goes wrong:** Dashboard sends `dash:task-submit` but the extension's WS is disconnected or reconnecting.
**Why it happens:** Chrome MV3 service worker may have been suspended, killing the WS connection.
**How to avoid:** The relay server silently drops messages when the target side has no connected clients. Dashboard should handle this by checking `extensionOnline` state before enabling the submit button. If extension goes offline during a task, show a warning.
**Warning signs:** Task appears to be submitted but nothing happens on the extension side.

## Code Examples

### Integration Point 1: Extension _handleMessage for task submission
```javascript
// ws/ws-client.js -- extend _handleMessage
_handleMessage(msg) {
  switch (msg.type) {
    case 'pong':
      break;
    case 'dash:task-submit':
      this._handleDashboardTask(msg.payload);
      break;
    default:
      console.log('[FSB WS] Received: ' + msg.type);
      break;
  }
}

async _handleDashboardTask(payload) {
  const task = payload?.task;
  if (!task) {
    this.send('ext:task-complete', { success: false, error: 'No task provided', elapsed: 0 });
    return;
  }
  // Check if already running
  // (activeSessions is global in background.js scope)
  if (typeof activeSessions !== 'undefined') {
    const hasRunning = [...activeSessions.values()].some(s => s.status === 'running');
    if (hasRunning) {
      this.send('ext:task-complete', { success: false, error: 'Another task is already running', elapsed: 0 });
      return;
    }
  }
  // Get active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      this.send('ext:task-complete', { success: false, error: 'No active browser tab', elapsed: 0 });
      return;
    }
    // Trigger automation -- dispatch to background.js handleStartAutomation equivalent
    // The background.js will need a function that accepts (tabId, task) without chrome.runtime.sendMessage context
    this._triggerAutomation(tab.id, task);
  } catch (err) {
    this.send('ext:task-complete', { success: false, error: err.message, elapsed: 0 });
  }
}
```

### Integration Point 2: Dashboard WS message handlers
```javascript
// showcase/js/dashboard.js -- add to handleWSMessage
function handleWSMessage(msg) {
  if (msg.type === 'pong') return;

  if (msg.type === 'ext:task-progress') {
    updateTaskProgress(msg.payload);
    return;
  }
  if (msg.type === 'ext:task-complete') {
    handleTaskComplete(msg.payload);
    return;
  }
  // ... existing handlers
}
```

### Integration Point 3: Dashboard task submission via WS
```javascript
// showcase/js/dashboard.js -- send task via WS
function submitTask(taskText) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!extensionOnline) return;
  ws.send(JSON.stringify({
    type: 'dash:task-submit',
    payload: { task: taskText },
    ts: Date.now()
  }));
  setTaskState('running', { task: taskText, startTime: Date.now() });
}
```

### Integration Point 4: Progress broadcasting helper
```javascript
// background.js -- add helper to broadcast progress via WS
function broadcastDashboardProgress(session) {
  if (!session._isDashboardTask) return;
  const progress = calculateProgress(session);
  fsbWebSocket.send('ext:task-progress', {
    progress: progress.progressPercent,
    phase: detectTaskPhase(session),
    eta: progress.estimatedTimeRemaining,
    elapsed: Date.now() - session.startTime,
    action: session.lastActionStatusText || getActionStatus(
      session.actionHistory?.length > 0 ? session.actionHistory[session.actionHistory.length - 1].tool : null,
      session.actionHistory?.length > 0 ? session.actionHistory[session.actionHistory.length - 1].params : null
    ) || 'Working...',
    status: 'running'
  });
}
```

### Integration Point 5: Completion broadcasting helper
```javascript
// background.js -- add helper to broadcast completion via WS
function broadcastDashboardComplete(session, success, resultOrError) {
  if (!session._isDashboardTask) return;
  const elapsed = Date.now() - session.startTime;
  if (success) {
    fsbWebSocket.send('ext:task-complete', {
      success: true,
      summary: resultOrError || 'Task completed',
      elapsed: elapsed
    });
  } else {
    fsbWebSocket.send('ext:task-complete', {
      success: false,
      error: resultOrError || 'Task failed',
      elapsed: elapsed
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE for real-time | WebSocket relay | Phase 40 (current milestone) | Bidirectional messaging enables remote task commands |
| Popup-only task input | Sidepanel + popup | Phase ~35 | Task input already works locally, this adds remote |
| No progress broadcasting | Content script overlay only | Current | Progress data exists but only goes to in-browser overlay |

**Existing progress pipeline:**
- `sendSessionStatus()` -> content script overlay (local only)
- `chrome.runtime.sendMessage({action: 'statusUpdate'})` -> sidepanel UI (local only)
- **New:** `fsbWebSocket.send('ext:task-progress', ...)` -> dashboard via WS relay

## Open Questions

1. **Tab selection for remote tasks**
   - What we know: Dashboard task needs a tab to run on. Active tab is the obvious default.
   - What's unclear: What if user's active tab is chrome://newtab or about:blank? The existing smart navigation in handleStartAutomation handles this for local tasks.
   - Recommendation: Reuse the existing smart navigation logic. When receiving a dashboard task, use the same `isRestrictedURL` + `shouldUseSmartNavigation` + `analyzeTaskAndGetTargetUrl` pipeline that handles local tasks.

2. **Progress throttling granularity**
   - What we know: sendSessionStatus fires on every action (could be rapid during batch execution). WS messages are cheap but dashboard DOM updates are not.
   - What's unclear: Exact optimal throttle interval.
   - Recommendation: Throttle WS broadcasts to max 1/second using a simple timestamp check. Dashboard can update the progress bar smoothly with CSS transition.

## Sources

### Primary (HIGH confidence)
- `background.js` lines 624-646 -- sendSessionStatus implementation
- `background.js` lines 698-737 -- detectTaskPhase implementation
- `background.js` lines 740-812 -- calculateProgress implementation
- `background.js` lines 986-1055 -- generateActionSummary implementation
- `background.js` lines 5616-5991 -- handleStartAutomation full flow
- `background.js` lines 5994-6145 -- executeAutomationTask programmatic API
- `ws/ws-client.js` lines 1-199 -- FSBWebSocket class, send(), _handleMessage()
- `server/src/ws/handler.js` lines 1-120 -- blind relay implementation
- `showcase/js/dashboard.js` lines 637-664 -- connectWS, ws.onmessage -> handleWSMessage
- `showcase/js/dashboard.js` lines 706-736 -- handleWSMessage dispatch
- `showcase/dashboard.html` lines 91-106 -- dashboard content area structure
- `showcase/css/dashboard.css` -- CSS variable patterns (--primary, --bg-card, etc.)

### Secondary (MEDIUM confidence)
- Phase 40 CONTEXT.md -- WS protocol decisions, blind relay pattern
- Phase 42 CONTEXT.md -- All locked implementation decisions and code_context section

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all code is vanilla JS using existing patterns, no new dependencies
- Architecture: HIGH -- data flow is straightforward WS relay, all integration points identified and code-verified
- Pitfalls: HIGH -- identified from actual code analysis of session lifecycle, WS reconnection, and completion paths

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- codebase patterns are well-established)
