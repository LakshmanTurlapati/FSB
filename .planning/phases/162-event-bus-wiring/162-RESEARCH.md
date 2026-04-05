# Phase 162: Event Bus Wiring - Research

**Researched:** 2026-04-03
**Domain:** Chrome Extension message handling, UI event consumption
**Confidence:** HIGH

## Summary

Phase 162 closes the last mile of the SessionStateEmitter pipeline built in Phase 156 and wired through Phases 158-159. The emitter already fires `chrome.runtime.sendMessage({ action: 'sessionStateEvent', eventType: ... })` from the background service worker through progress hooks -- but no UI surface has a handler for this message action. Both `ui/popup.js` and `ui/sidepanel.js` need a `case 'sessionStateEvent'` in their existing `chrome.runtime.onMessage` switch statements, and at least one event type must produce a visible UI change.

The implementation is straightforward: both UI files already have `chrome.runtime.onMessage.addListener` with switch-on-`request.action` patterns that handle `automationComplete`, `statusUpdate`, and `automationError`. Adding `sessionStateEvent` follows the identical pattern. The event payload shape is documented in `ai/state-emitter.js` lines 117-124: `{ action: 'sessionStateEvent', eventType: string, ...data }` where data varies by event type.

**Primary recommendation:** Add a `case 'sessionStateEvent'` to the existing switch in both popup.js (line 814) and sidepanel.js (line 1014). Route by `request.eventType` to existing UI update functions. Map `iteration_complete` to progress bar / status text updates, `session_ended` to idle state transition, `tool_executed` to action message append (sidepanel only when debug enabled), and `error_occurred` to console.warn (no visual change needed beyond existing error handling).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- all items are at Claude's discretion.

### Claude's Discretion
- D-01: Handle all 4 event types (tool_executed, iteration_complete, session_ended, error_occurred) in both popup and sidepanel. The handler can be a shared function or inline switch. Events that don't have a clear visual representation can be logged to console in debug mode.
- D-02: At minimum, iteration_complete should update the iteration count display and session_ended should update session status. Other events (tool_executed, error_occurred) can update existing UI elements (action summary, error display) or be logged only. Keep changes minimal -- use existing UI elements, don't create new components.
- D-03: Add a case 'sessionStateEvent': in the existing chrome.runtime.onMessage listener in popup.js and sidepanel.js. Extract event type from request.event and route to existing UI update functions where possible.
- Which existing UI elements receive event data
- Whether to add the handler to options.js as well (optional -- options is a settings page, not an operator surface)
- How to handle events when no active session is displayed
- Whether to batch rapid events (tool_executed fires frequently) or process individually

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIRE-01 | Popup and sidepanel message handlers include `case 'sessionStateEvent'` processing emitter events | Exact insertion points identified: popup.js line 814 switch, sidepanel.js line 1014 switch. Payload shape documented from state-emitter.js. All 4 event types mapped to handler logic. |
| WIRE-02 | At least one UI surface visually reflects a SessionStateEmitter event | `iteration_complete` maps to existing `updateStatusMessage()` in both surfaces. `session_ended` maps to `setIdleState()`. Both functions already exist and are tested. |
</phase_requirements>

## Architecture Patterns

### Message Flow (end-to-end)

```
agent-loop.js iteration
  -> HookPipeline.emit(AFTER_ITERATION, context)
    -> iterationProgressHook(context)
      -> emitter.emit('iteration_complete', { sessionId, iteration, cost, ... })
        -> chrome.runtime.sendMessage({ action: 'sessionStateEvent', eventType: 'iteration_complete', sessionId, iteration, cost, ... })
          -> popup.js onMessage handler -> case 'sessionStateEvent' -> updateStatusMessage()
          -> sidepanel.js onMessage handler -> case 'sessionStateEvent' -> updateStatusMessage()
```

### Payload Shapes (from ai/state-emitter.js + ai/hooks/progress-hook.js)

**tool_executed** (fires per tool, potentially 2-5 per iteration):
```javascript
{
  action: 'sessionStateEvent',
  eventType: 'tool_executed',
  sessionId: string,
  toolName: string,
  success: boolean,
  iteration: number,
  timestamp: number
}
```

**iteration_complete** (fires once per iteration):
```javascript
{
  action: 'sessionStateEvent',
  eventType: 'iteration_complete',
  sessionId: string,
  iteration: number,
  cost: number,        // cumulative totalCost
  inputTokens: number,
  outputTokens: number,
  timestamp: number
}
```

**session_ended** (fires once at completion):
```javascript
{
  action: 'sessionStateEvent',
  eventType: 'session_ended',
  sessionId: string,
  result: string,
  totalCost: number,
  iterations: number,
  timestamp: number
}
```

**error_occurred** (fires once on fatal error):
```javascript
{
  action: 'sessionStateEvent',
  eventType: 'error_occurred',
  sessionId: string,
  error: string,       // error.message or String(error)
  iteration: number,
  timestamp: number
}
```

### Existing Handler Pattern (popup.js)

The main message listener at popup.js line 813:
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'automationComplete': ...
    case 'statusUpdate': ...
    case 'automationError': ...
    // NEW: case 'sessionStateEvent': ...
  }
});
```

### Existing Handler Pattern (sidepanel.js)

The main message listener at sidepanel.js line 1013:
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'automationComplete': ...
    case 'statusUpdate': ...
    case 'automationError': ...
    case 'loginDetected': ...
    // NEW: case 'sessionStateEvent': ...
  }
});
```

### Existing UI Update Functions Available for Reuse

**popup.js:**
| Function | Purpose | Can consume |
|----------|---------|-------------|
| `updateStatusMessage(text, progressData)` | Update progress bar + status text | iteration_complete |
| `setIdleState()` | Reset UI to idle | session_ended |
| `setErrorState()` | Set error indicators | error_occurred |
| `addActionMessage(text)` | Append collapsed action | tool_executed |

**sidepanel.js:**
| Function | Purpose | Can consume |
|----------|---------|-------------|
| `updateStatusMessage(text, progressData)` | Update progress bar + status text | iteration_complete |
| `setIdleState()` | Reset UI to idle | session_ended |
| `setErrorState()` | Set error indicators | error_occurred |
| `addActionMessage(text)` | Append to debug panel (guarded by showSidepanelProgressEnabled) | tool_executed |

### Recommended Handler Implementation

```javascript
case 'sessionStateEvent':
  if (request.sessionId !== currentSessionId) break;
  switch (request.eventType) {
    case 'iteration_complete':
      // Update progress display with emitter data
      updateStatusMessage('Step ' + request.iteration + ' complete', {
        iteration: request.iteration,
        maxIterations: 20,  // default or from session config
        progressPercent: Math.min(100, Math.round((request.iteration / 20) * 100))
      });
      break;
    case 'session_ended':
      // No-op if automationComplete already handled it
      // Guard: only act if still running
      break;
    case 'tool_executed':
      // Console-only in popup, addActionMessage in sidepanel
      console.debug('[FSB] tool_executed:', request.toolName, request.success ? 'ok' : 'fail');
      break;
    case 'error_occurred':
      console.warn('[FSB] error_occurred:', request.error);
      break;
  }
  break;
```

### Anti-Patterns to Avoid

- **Do not duplicate automationComplete/automationError handling.** The existing `automationComplete` and `automationError` messages from background.js already handle session end and error display. The `session_ended` and `error_occurred` emitter events fire from the hook pipeline _in addition_ to those messages. The handler must not double-trigger `setIdleState()` or add duplicate completion messages. Guard with `if (!isRunning) break;` or skip visual action if the existing handler already ran.

- **Do not create new DOM elements for event display.** CONTEXT.md D-02 says "use existing UI elements, don't create new components." The `updateStatusMessage()`, `addActionMessage()`, `setIdleState()`, and `setErrorState()` functions already exist.

- **Do not treat tool_executed as high-priority visual.** This event fires 2-5 times per iteration. In popup (small window), logging to console is sufficient. In sidepanel, gating behind `showSidepanelProgressEnabled` (the existing debug toggle) prevents spam.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message routing | Custom dispatcher | Existing switch-on-action pattern | Both files already use this, consistency matters |
| Progress display | New progress component | Existing `updateStatusMessage()` with progressData | Already renders progress bar, step count |
| Action logging | New action list UI | Existing `addActionMessage()` | Already handles collapsing, grouping |
| Session ID filtering | Custom session manager | `request.sessionId !== currentSessionId` guard | Same pattern used by statusUpdate, automationComplete |

## Common Pitfalls

### Pitfall 1: Duplicate state transitions from parallel message paths
**What goes wrong:** Both `automationComplete` (from background.js direct send) and `session_ended` (from emitter hook) arrive at the UI. If both call `setIdleState()`, the second call may interfere with post-completion UI (e.g., removing the completion message or resetting state that was intentionally set).
**Why it happens:** The emitter events supplement, not replace, the existing message paths. Phase 162 adds a _new_ channel without removing the old one.
**How to avoid:** In the `session_ended` handler, check `if (!isRunning) break;` before taking any action. Since `automationComplete` already calls `setIdleState()` which sets `isRunning = false`, the emitter event becomes a no-op. This is intentional -- the emitter path is the future canonical path, but backward compatibility with existing messages must be preserved.
**Warning signs:** Completion message appearing twice, idle state flickering, status text briefly changing.

### Pitfall 2: tool_executed event flood overwhelming the UI
**What goes wrong:** `tool_executed` fires after every tool execution (click, type, navigate, etc.). In a fast automation, this can be 2-5 per second. Creating DOM elements for each one causes jank.
**Why it happens:** The emitter broadcasts every tool execution for analytics/debugging purposes. UI surfaces should be selective consumers.
**How to avoid:** In popup.js, handle tool_executed with `console.debug()` only -- no DOM updates. In sidepanel.js, gate behind `showSidepanelProgressEnabled` flag (existing user preference), and use the existing `addActionMessage()` which already has collapse/grouping logic.
**Warning signs:** Chat area filling with rapid action messages, scroll position jumping, UI becoming sluggish during automation.

### Pitfall 3: Event handler accessing DOM elements before DOMContentLoaded
**What goes wrong:** `chrome.runtime.onMessage` listeners registered at module scope receive messages before the DOM is ready, causing null reference errors on `currentStatusMessage` or `chatMessages`.
**Why it happens:** The onMessage listener at line 813/1013 is registered after DOMContentLoaded, so this is actually safe in the current code. But if the handler is refactored or extracted, this risk emerges.
**How to avoid:** Keep the sessionStateEvent handler inside the existing onMessage listener block that already fires post-DOMContentLoaded. Do not add a separate listener.
**Warning signs:** `Cannot read properties of null` errors in DevTools console during automation.

### Pitfall 4: Incorrect eventType field name
**What goes wrong:** CONTEXT.md D-03 says "Extract event type from `request.event`" but the actual payload uses `request.eventType` (set in state-emitter.js line 118).
**Why it happens:** Slight naming mismatch between CONTEXT.md description and actual implementation.
**How to avoid:** Use `request.eventType` (not `request.event`). Verified from state-emitter.js: `var payload = { action: 'sessionStateEvent', eventType: eventType };`
**Warning signs:** All events falling through to default/no handler, no visible effect from emitter events.

## Code Examples

### Pattern: sessionStateEvent handler in popup.js (verified payload from state-emitter.js)

```javascript
// Source: ai/state-emitter.js line 118, ai/hooks/progress-hook.js
case 'sessionStateEvent':
  // Guard: only process events for our active session
  if (request.sessionId !== currentSessionId) break;

  switch (request.eventType) {
    case 'iteration_complete':
      // Visual: update progress bar with emitter data
      if (currentStatusMessage && isRunning) {
        updateStatusMessage('Step ' + request.iteration, {
          iteration: request.iteration,
          maxIterations: 20,
          progressPercent: Math.min(100, Math.round((request.iteration / 20) * 100))
        });
      }
      break;

    case 'session_ended':
      // No-op if automationComplete already handled it
      if (!isRunning) break;
      setIdleState();
      break;

    case 'tool_executed':
      // Console-only in popup (too small for action log)
      console.debug('[FSB] tool:', request.toolName, request.success ? 'ok' : 'fail');
      break;

    case 'error_occurred':
      console.warn('[FSB] emitter error:', request.error);
      break;
  }
  break;
```

### Pattern: sessionStateEvent handler in sidepanel.js

```javascript
// Source: ai/state-emitter.js line 118, ai/hooks/progress-hook.js
case 'sessionStateEvent':
  // Guard: only process events for our active session
  if (request.sessionId !== currentSessionId) break;

  switch (request.eventType) {
    case 'iteration_complete':
      // Visual: update progress bar with emitter data
      if (currentStatusMessage && isRunning) {
        updateStatusMessage('Step ' + request.iteration, {
          iteration: request.iteration,
          maxIterations: 20,
          progressPercent: Math.min(100, Math.round((request.iteration / 20) * 100))
        });
      }
      break;

    case 'session_ended':
      // No-op if automationComplete already handled it
      if (!isRunning) break;
      setIdleState();
      if (isHistoryViewActive) {
        loadHistoryList();
      }
      break;

    case 'tool_executed':
      // Use existing addActionMessage (gated by showSidepanelProgressEnabled)
      if (showSidepanelProgressEnabled && isRunning) {
        addActionMessage(request.toolName + (request.success ? '' : ' [failed]'));
      }
      break;

    case 'error_occurred':
      console.warn('[FSB] emitter error:', request.error);
      break;
  }
  break;
```

## Overlap with Existing Messages

The emitter events overlap with existing message types. This is by design -- the emitter is the future canonical path, but existing messages must continue working until they are fully replaced (future milestone).

| Emitter Event | Overlapping Message | Difference |
|---------------|---------------------|------------|
| `iteration_complete` | `statusUpdate` | statusUpdate carries human-readable message text; iteration_complete carries structured data (cost, tokens) |
| `session_ended` | `automationComplete` | automationComplete carries result text for completion bubble; session_ended carries cost/iterations |
| `error_occurred` | `automationError` | automationError carries task text for retry button; error_occurred is simpler |
| `tool_executed` | (none) | New -- no existing equivalent. Only available via emitter. |

**Key insight:** The `statusUpdate` message carries `iteration` and `progressPercent` already, so `iteration_complete` will sometimes update the same progress display. This is harmless -- the emitter data is slightly more structured (includes cost, tokens) but produces the same visual result. The overlap resolves in a future milestone when `statusUpdate` calls are replaced entirely by emitter events.

## Modification Targets

| File | Location | Change |
|------|----------|--------|
| `ui/popup.js` | Line ~875 (after `automationError` case, before closing `}`) | Add `case 'sessionStateEvent':` block |
| `ui/sidepanel.js` | Line ~1146 (after `loginDetected` case, before closing `}`) | Add `case 'sessionStateEvent':` block |

No new files. No HTML changes. No CSS changes. No background.js changes.

## Project Constraints (from CLAUDE.md)

- ES2021+ JavaScript with proper error handling
- Chrome Extension Manifest V3 best practices
- No emojis in logging or documentation
- Function/prototype pattern for MV3 importScripts compatibility (background.js only -- not relevant for UI files which use modern syntax)
- Manual testing strategy (Chrome DevTools verification)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual Chrome DevTools verification (no automated test framework) |
| Config file | none |
| Quick run command | Load extension in chrome://extensions, open popup/sidepanel, run automation, verify DevTools console |
| Full suite command | N/A (manual testing) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIRE-01 | sessionStateEvent case exists in popup.js and sidepanel.js onMessage handlers | manual | Load extension, run automation, check DevTools console for `[FSB] tool:` and iteration_complete processing | N/A |
| WIRE-02 | At least one UI surface visually reflects emitter event | manual | Run automation in sidepanel, observe progress bar updating from iteration_complete events | N/A |

### Sampling Rate
- **Per task commit:** Load extension, trigger one automation, verify console logs
- **Per wave merge:** Full automation run on 2+ sites, verify progress display
- **Phase gate:** Confirm progress bar updates and no duplicate state transitions

### Wave 0 Gaps
None -- no automated test infrastructure needed. Consistent with project's manual testing strategy across all 161 prior phases.

## Sources

### Primary (HIGH confidence)
- `ai/state-emitter.js` -- SessionStateEmitter.emit() payload construction (lines 116-131)
- `ai/hooks/progress-hook.js` -- 4 hook factories defining exact data shapes for each event type
- `ui/popup.js` -- Existing onMessage handler pattern (line 813), UI update functions
- `ui/sidepanel.js` -- Existing onMessage handler pattern (line 1013), UI update functions
- `background.js` -- createSessionHooks() factory (line 250), hook registration

### Secondary (MEDIUM confidence)
- `.planning/v0.9.24-MILESTONE-AUDIT.md` -- STATE-05, HOOK-04 gap definitions confirming the problem statement
- `162-CONTEXT.md` -- User decisions and discretion areas

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, pure vanilla JS changes to existing files
- Architecture: HIGH - All integration points read and verified from source
- Pitfalls: HIGH - Duplicate message paths identified from direct code analysis

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (30 days -- stable domain, no external dependencies)
