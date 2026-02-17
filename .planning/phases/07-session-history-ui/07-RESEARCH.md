# Phase 7: Session History UI - Research

**Researched:** 2026-02-15
**Domain:** Chrome Extension sidepanel UI, chrome.storage.local session data, vanilla JS/CSS
**Confidence:** HIGH

## Summary

Phase 7 adds a conversation history panel to the existing sidepanel UI. The sidepanel currently has a simple header with two icon buttons (New Chat, Settings), a chat messages area, an input area, and a footer. The goal is to add a history icon button that toggles between the current chat view and a session history list view, with the ability to delete individual sessions or clear all sessions.

All the backend infrastructure already exists. The `AutomationLogger` class in `utils/automation-logger.js` provides `listSessions()`, `loadSession()`, `deleteSession()`, and `clearAllSessions()` methods that work with `chrome.storage.local` keys `fsbSessionIndex` (lightweight index array) and `fsbSessionLogs` (full session data keyed by session ID). The options page (`ui/options.js`) already has a complete session list rendering pattern with session items, status badges, date formatting, and delete functionality that can be directly adapted.

**Primary recommendation:** Add a `fa-clock-rotate-left` (or `fa-history`) icon button to the sidepanel header, toggle between chat view and history view by showing/hiding containers, and read session data directly from `chrome.storage.local` in the sidepanel JS (no message passing to background needed for reads).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Font Awesome | 6.6.0 | Icons (already loaded via CDN in sidepanel.html) | Already in use, provides clock-rotate-left and trash icons |
| chrome.storage.local | MV3 | Session data storage (read, delete) | Already used for fsbSessionIndex / fsbSessionLogs |
| Vanilla JS | ES2021+ | DOM manipulation, event handling | Project convention - no frameworks |
| Vanilla CSS | - | Styling with CSS variables | Project convention - dark/light theme via data-theme attribute |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrome.storage.local.remove | MV3 | Clear all sessions | For "Delete All" functionality |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct chrome.storage.local reads | Message passing to background.js | Direct reads are simpler; background already handles writes, reads don't need routing |
| Full slide-out panel / modal | Simple view toggle (show/hide containers) | View toggle is simpler, matches sidepanel's narrow width, avoids z-index complexity |
| New HTML page | Inline in existing sidepanel.html | Inline keeps it as a single page, avoids navigation complexity |

## Architecture Patterns

### Recommended UI Approach: View Toggle

Toggle between two views within the existing sidepanel container:

```
sidepanel-container
  +-- header (always visible, history btn added to header-actions)
  +-- chat-view (existing chat-messages-area + chat-input-area) [shown by default]
  +-- history-view (new, hidden by default)
  |     +-- history-header (title + "Delete All" button)
  |     +-- history-list (scrollable list of session items)
  |     +-- history-empty-state (when no sessions)
  +-- author-footer (always visible)
```

**Why this approach:** The sidepanel is narrow (typically 350-450px). A modal or slide-out panel would be cramped. A simple show/hide toggle is clean and familiar (like how messaging apps toggle between conversations and chat).

### Pattern 1: View Toggle with State Management

**What:** Show/hide entire view containers based on active view
**When to use:** Always - this is the core interaction pattern

```javascript
// Toggle between chat and history views
function showHistoryView() {
  document.querySelector('.chat-messages-area').classList.add('hidden');
  document.querySelector('.chat-input-area').classList.add('hidden');
  document.getElementById('historyView').classList.remove('hidden');
  // Update header button active state
  document.getElementById('historyBtn').classList.add('active');
  loadHistoryList();
}

function showChatView() {
  document.querySelector('.chat-messages-area').classList.remove('hidden');
  document.querySelector('.chat-input-area').classList.remove('hidden');
  document.getElementById('historyView').classList.add('hidden');
  document.getElementById('historyBtn').classList.remove('active');
}
```

### Pattern 2: Direct Storage Access (No Message Passing)

**What:** Read session data directly from chrome.storage.local in the sidepanel
**When to use:** For listing and displaying sessions - reads don't need to go through background.js

```javascript
// Read session index directly - no background message needed
async function loadHistoryList() {
  const stored = await chrome.storage.local.get(['fsbSessionIndex']);
  const sessions = stored.fsbSessionIndex || [];
  renderHistoryList(sessions);
}

// Delete uses same pattern as options.js
async function deleteHistorySession(sessionId) {
  const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
  const sessionStorage = stored.fsbSessionLogs || {};
  const sessionIndex = stored.fsbSessionIndex || [];
  delete sessionStorage[sessionId];
  const updatedIndex = sessionIndex.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({
    fsbSessionLogs: sessionStorage,
    fsbSessionIndex: updatedIndex
  });
  loadHistoryList(); // Refresh the list
}

// Clear all sessions
async function clearAllHistorySessions() {
  await chrome.storage.local.remove(['fsbSessionLogs', 'fsbSessionIndex']);
  loadHistoryList();
}
```

### Pattern 3: Session Item Rendering (Adapted from options.js)

**What:** Render session list items with task name, time, status, and actions
**When to use:** For the history list display

The options.js already has a proven pattern at line 1202:
```javascript
// From options.js - adapt this for sidepanel (simplified, no view/download buttons)
sessions.map(session => `
  <div class="history-item" data-session-id="${session.id}">
    <div class="history-item-info">
      <div class="history-item-task">${escapeHtml(session.task || 'Unknown task')}</div>
      <div class="history-item-meta">
        <span>${formatSessionDate(session.startTime)}</span>
        <span class="history-status ${session.status}">${session.status}</span>
      </div>
    </div>
    <button class="history-delete-btn" data-session-id="${session.id}" title="Delete">
      <i class="fa fa-trash"></i>
    </button>
  </div>
`).join('')
```

### Anti-Patterns to Avoid
- **Do NOT route reads through background.js:** chrome.storage.local is accessible directly from the sidepanel. Adding message passing for reads would be unnecessary overhead.
- **Do NOT use inline onclick handlers:** The project uses addEventListener and event delegation (see options.js pattern).
- **Do NOT create a separate HTML page:** Keep everything in sidepanel.html to avoid navigation complexity.
- **Do NOT display full session logs in the sidepanel:** The sidepanel is too narrow. Only show task name, time, status. Detailed log viewing belongs in options page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session CRUD operations | Custom storage logic | AutomationLogger methods (deleteSession, clearAllSessions, listSessions) OR direct chrome.storage.local access matching options.js pattern | Already proven and battle-tested |
| Date formatting | New date formatter | Copy formatSessionDate() and formatSessionDuration() from options.js | Exact same format needed, already written |
| HTML escaping | Manual string escaping | Copy escapeHtml() from options.js | Already handles XSS prevention |
| Dark theme support | New color scheme | Use existing CSS variables (--bg-primary, --text-primary, --border-color, etc.) | Automatic theme support |
| Icon styling | Custom button styles | Use existing .icon-btn class from sidepanel.css | Matches New Chat and Settings buttons exactly |

## Common Pitfalls

### Pitfall 1: Not Handling Empty State
**What goes wrong:** History view shows blank white space when no sessions exist
**Why it happens:** Forgetting to check for empty session list
**How to avoid:** Always render an empty state with icon and message (like options.js does with fa-inbox icon)
**Warning signs:** history-list container with no children

### Pitfall 2: Stale History After Automation Completes
**What goes wrong:** User runs automation, opens history, but new session not visible
**Why it happens:** History list was loaded before session was saved to storage
**How to avoid:** Reload history list every time history view is shown (in showHistoryView function). Optionally listen for chrome.storage.onChanged events.
**Warning signs:** Session appears after manual refresh but not automatically

### Pitfall 3: Delete Confirmation Blocking
**What goes wrong:** Using window.confirm() which looks jarring in a sidepanel context
**Why it happens:** Options.js uses confirm() which is acceptable in a full page but feels heavy in a compact panel
**How to avoid:** For individual deletes, skip confirmation (single action, recoverable by re-running). For "Delete All", use confirm() since it is destructive and irreversible.
**Warning signs:** User feedback about excessive popups

### Pitfall 4: Chat Input State Lost When Toggling Views
**What goes wrong:** User types something in chat input, opens history, goes back, and text is gone
**Why it happens:** If toggle implementation removes/recreates DOM instead of show/hide
**How to avoid:** Use CSS display:none/display:flex toggle, not innerHTML replacement. The chat DOM stays intact while hidden.
**Warning signs:** Chat messages or input content disappearing after view toggle

### Pitfall 5: Running Automation Conflict
**What goes wrong:** User switches to history view while automation is running, loses track of progress
**Why it happens:** Status updates target the chat view which is now hidden
**How to avoid:** Either (a) disable history button while automation is running, or (b) auto-switch back to chat view when status updates arrive, or (c) show a small indicator in history view that automation is running.
**Warning signs:** User confused about automation state

### Pitfall 6: Dark Theme Inconsistency
**What goes wrong:** History panel looks fine in light theme but broken in dark
**Why it happens:** Using hardcoded colors instead of CSS variables
**How to avoid:** Use ONLY CSS variables for all colors (--bg-primary, --bg-secondary, --text-primary, --text-secondary, --text-muted, --border-color, --primary-color)
**Warning signs:** White backgrounds or black text in dark mode

## Code Examples

### Header Button Addition (sidepanel.html)

```html
<!-- Add history button to existing header-actions div -->
<div class="header-actions">
  <button id="historyBtn" class="icon-btn" title="Session History">
    <i class="fa fa-clock-rotate-left"></i>
  </button>
  <button id="newChatBtn" class="icon-btn" title="Start New Chat">
    <i class="fa fa-plus"></i>
  </button>
  <button id="settingsBtn" class="icon-btn" title="Settings">
    <i class="fa fa-cog"></i>
  </button>
</div>
```

The `fa-clock-rotate-left` icon (Font Awesome 6.x) is a clock with a counter-clockwise arrow, universally recognized as "history". Alternative: `fa-history` (same icon, older alias).

### History View Container (sidepanel.html)

```html
<!-- New history view - hidden by default, inserted between header and chat-messages-area -->
<div id="historyView" class="history-view hidden">
  <div class="history-header">
    <h3>Session History</h3>
    <button id="clearAllHistoryBtn" class="history-clear-all-btn" title="Delete All Sessions">
      <i class="fa fa-trash"></i>
      <span>Clear All</span>
    </button>
  </div>
  <div class="history-list" id="historyList">
    <!-- Session items rendered dynamically -->
  </div>
</div>
```

### CSS Patterns (sidepanel.css additions)

```css
/* History View */
.history-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-view.hidden {
  display: none;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
}

.history-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 10px;
  margin-bottom: 6px;
  background: var(--bg-secondary);
  border: 1px solid transparent;
  cursor: default;
  transition: all 0.2s ease;
}

.history-item:hover {
  border-color: var(--border-color);
}

.history-item-task {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.history-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* Active icon button state */
.icon-btn.active {
  background: var(--primary-color);
  color: white;
}

.icon-btn.active:hover {
  background: var(--primary-hover);
}
```

### Helper Functions (duplicated from options.js, needed in sidepanel.js)

```javascript
function formatSessionDate(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return mins + 'm ago';
  } else if (diffHours < 24) {
    return Math.floor(diffHours) + 'h ago';
  } else if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString();
}

function formatSessionDuration(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const durationMs = endTime - startTime;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) return minutes + 'm ' + remainingSeconds + 's';
  return seconds + 's';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

## Existing Infrastructure Summary

### Session Storage Structure (chrome.storage.local)

**Key: `fsbSessionIndex`** - Lightweight array of session summaries (max 50 entries):
```javascript
[
  {
    id: "session_1707123456_abc123",
    task: "Search for flights to NYC",  // or "[1] task1 | [2] task2" for multi-command
    startTime: 1707123456000,   // Unix timestamp ms
    endTime: 1707123556000,     // Unix timestamp ms
    status: "completed",         // "completed" | "stopped" | "stuck" | "error"
    actionCount: 12
  },
  // ... more sessions, newest first
]
```

**Key: `fsbSessionLogs`** - Full session data object keyed by session ID:
```javascript
{
  "session_1707123456_abc123": {
    id: "session_1707123456_abc123",
    task: "Search for flights to NYC",
    startTime: 1707123456000,
    endTime: 1707123556000,
    status: "completed",
    tabId: 123,
    actionCount: 12,
    iterationCount: 5,
    commandCount: 1,
    logs: [ /* array of log entries */ ]
  }
}
```

### Available AutomationLogger Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `listSessions()` | `Promise<Array>` | Returns fsbSessionIndex array |
| `loadSession(sessionId)` | `Promise<Object\|null>` | Returns full session with logs |
| `deleteSession(sessionId)` | `Promise<boolean>` | Deletes session from both storage keys |
| `clearAllSessions()` | `Promise<boolean>` | Removes both fsbSessionLogs and fsbSessionIndex |
| `saveSession(sessionId, data)` | `Promise<boolean>` | Creates/updates session entry |

**Important:** These methods are on the `automationLogger` singleton. However, `automationLogger` is only loaded in the background service worker and the options page. The sidepanel does NOT currently load `automation-logger.js`. Options:
1. Add `<script src="../utils/automation-logger.js"></script>` to sidepanel.html (simple, but loads the entire logger)
2. Access chrome.storage.local directly (simpler for read/delete operations, which is all we need)

**Recommendation:** Access chrome.storage.local directly. The sidepanel only needs to READ the session index and DELETE sessions. Loading the full AutomationLogger class for just these operations is unnecessary overhead.

### Existing Message Passing Patterns (sidepanel.js)

The sidepanel communicates with background.js via `chrome.runtime.sendMessage`:
- `{ action: 'startAutomation', task, tabId, conversationId }` - Start automation
- `{ action: 'stopAutomation', sessionId }` - Stop automation
- `{ action: 'getStatus' }` - Check current status
- `{ action: 'listAgents' }` - List background agents
- `{ action: 'toggleAgent', agentId }` - Toggle agent on/off

The sidepanel listens for messages via `chrome.runtime.onMessage.addListener`:
- `automationComplete` - Session finished
- `statusUpdate` - Progress update during automation
- `automationError` - Error occurred
- `loginDetected` - Login page detected
- `ANALYTICS_UPDATE` - Analytics data refreshed

### Files to Modify

| File | Changes |
|------|---------|
| `ui/sidepanel.html` | Add history button to header, add history-view container |
| `ui/sidepanel.js` | Add history view logic, session loading, delete functions, view toggling |
| `ui/sidepanel.css` | Add history view styles, active button state, history item styles, empty state |

No new files needed. No changes to background.js. No changes to automation-logger.js.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session viewing only in options page | Add session viewing to sidepanel | This phase | Users can quickly browse past sessions without leaving sidepanel context |

**Deprecated/outdated:**
- None. All patterns are current.

## Open Questions

1. **Should clicking a history item do anything?**
   - What we know: Options page expands to show detailed logs when clicking a session item
   - What's unclear: In the narrow sidepanel, detailed logs would be cramped. Should clicking open the options page at that session? Or just show basic info?
   - Recommendation: Clicking a session item does nothing special (no expansion). The history list is for reference and deletion only. For detailed logs, users should go to the options page.

2. **Should the history list auto-refresh when a session completes?**
   - What we know: The sidepanel already receives `automationComplete` messages
   - What's unclear: If the user is on the history view when automation completes, should it refresh?
   - Recommendation: Yes, refresh the history list when `automationComplete` fires AND the history view is currently visible. This is a simple addition to the existing message listener.

3. **Should there be a visual indicator on the history button when new sessions are available?**
   - What we know: The user asked for a simple history panel
   - What's unclear: Whether a notification badge is needed
   - Recommendation: Skip for now. Keep it simple. A notification badge adds complexity for minimal benefit.

## Sources

### Primary (HIGH confidence)
- `ui/sidepanel.html` (lines 1-75) - Current sidepanel structure with 2-button header
- `ui/sidepanel.js` (lines 1-1076) - Full sidepanel JS with message passing patterns
- `ui/sidepanel.css` (lines 1-766) - Complete sidepanel styling with dark theme support
- `utils/automation-logger.js` (lines 415-548) - Session CRUD: saveSession, loadSession, listSessions, deleteSession, clearAllSessions
- `ui/options.js` (lines 1128-1240) - Session list rendering pattern (loadSessionList, initializeSessionHistory)
- `ui/options.js` (lines 2133-2183) - Helper functions: formatSessionDate, formatSessionDuration, escapeHtml
- `ui/options.css` (lines 1452-1650) - Session item styling patterns

### Secondary (MEDIUM confidence)
- Font Awesome 6.6.0 docs - fa-clock-rotate-left icon availability (confirmed by CDN link in sidepanel.html)
- chrome.storage.local API - Direct access from extension pages (standard MV3 capability)

### Tertiary (LOW confidence)
- None. All findings verified from codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in the project, no new dependencies
- Architecture: HIGH - View toggle pattern is simple and proven; all storage infrastructure exists
- Pitfalls: HIGH - Identified from direct codebase analysis of existing patterns and potential interaction conflicts

**Research date:** 2026-02-15
**Valid until:** No expiration (internal codebase research, not external library versions)
