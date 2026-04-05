# Phase 162: Event Bus Wiring - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `sessionStateEvent` message handlers to popup and sidepanel so the SessionStateEmitter events from Phase 156 reach UI consumers. At least one UI surface must visually reflect an emitter event. No new event types, no new emitter functionality -- pure consumer wiring.

</domain>

<decisions>
## Implementation Decisions

### Event handling scope
- **D-01:** Claude's Discretion. Handle all 4 event types (tool_executed, iteration_complete, session_ended, error_occurred) in both popup and sidepanel. The handler can be a shared function or inline switch. Events that don't have a clear visual representation can be logged to console in debug mode.

### Visual representation
- **D-02:** Claude's Discretion. At minimum, `iteration_complete` should update the iteration count display and `session_ended` should update session status. Other events (tool_executed, error_occurred) can update existing UI elements (action summary, error display) or be logged only. Keep changes minimal -- use existing UI elements, don't create new components.

### Handler architecture
- **D-03:** Claude's Discretion. Add a `case 'sessionStateEvent':` in the existing `chrome.runtime.onMessage` listener in popup.js and sidepanel.js. Extract event type from `request.event` and route to existing UI update functions where possible.

### Claude's Discretion
- All decisions above are at Claude's discretion
- Which existing UI elements receive event data
- Whether to add the handler to options.js as well (optional -- options is a settings page, not an operator surface)
- How to handle events when no active session is displayed
- Whether to batch rapid events (tool_executed fires frequently) or process individually

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 156 outputs (event source)
- `ai/state-emitter.js` -- SessionStateEmitter with emit/on/off, STATE_EVENTS constant
- `ai/hooks/progress-hook.js` -- createToolProgressHook, createIterationProgressHook, createCompletionProgressHook, createErrorProgressHook

### Integration audit (gap definition)
- `.planning/v0.9.24-MILESTONE-AUDIT.md` -- STATE-05, HOOK-04 gap descriptions, degraded flow evidence

### FSB source (primary modification targets)
- `ui/popup.js` -- Popup chat interface message handler
- `ui/popup.html` -- Popup markup (for identifying existing UI elements)
- `sidepanel/sidepanel.js` -- Side panel message handler
- `sidepanel/sidepanel.html` -- Side panel markup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `STATE_EVENTS` constant in ai/state-emitter.js -- defines event type strings
- Existing `chrome.runtime.onMessage` listeners in popup.js and sidepanel.js
- Existing UI update functions for status, iteration count, cost display

### Established Patterns
- Both popup.js and sidepanel.js use `chrome.runtime.onMessage.addListener` with a switch on `message.action`
- Status updates already flow via `sendSessionStatus` messages -- the new events supplement these

### Integration Points
- popup.js onMessage handler -- add case for sessionStateEvent
- sidepanel.js onMessage handler -- add case for sessionStateEvent

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 162-event-bus-wiring*
*Context gathered: 2026-04-03*
