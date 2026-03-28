# Phase 42: Remote Task Control - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can type a natural language task on the dashboard and FSB executes it in the paired browser. Dashboard shows real-time progress (percentage, phase, ETA), AI-generated action summaries, and completion status. Text-based monitoring only — live DOM streaming is Phase 44.

</domain>

<decisions>
## Implementation Decisions

### Task input & submission
- Task input bar lives at the **top of the dashboard content area**, always visible when paired
- Prominent text input with placeholder: "What should FSB do?"
- Submit button (e.g., "Go" or arrow icon) to the right of the input
- **One task at a time** — input is disabled/grayed while a task is actively running
- Matches FSB's single-tab execution model — no task queue

### Submit → progress transition
- **Inline transition** — when user submits, the input area smoothly transforms into the progress view
- The input text becomes the task title displayed above the progress bar
- No page change, no separate panel — the input area IS the active task area
- When task completes, input reappears below the result summary for the next task

### Progress display
- **Thin horizontal progress bar** below the task title, fills left-to-right with accent color (#ff6b35)
- Percentage text on the right side of the bar
- Metadata shown below the bar:
  - **Phase label** — "Navigating", "Reading page", "Filling form", "Clicking" (extension already detects these via `detectTaskPhase()`)
  - **ETA countdown** — "~30s", "~2m" (extension already calculates via `estimateProgress()`)
  - **Elapsed time** — "Running for 45s"

### Action summaries
- **Single updating line** below the progress metadata, prefixed with ">"
- Updates in place as FSB works: "> Clicking 'Search flights' button" → "> Reading search results"
- Not a scrolling log — just the latest action description
- **Data flow:** Extension sends `ext:task-progress` WS messages containing action description, progress %, phase, ETA. Dashboard renders what it receives

### Completion state — success
- Progress bar fills to 100%, turns **green**
- Status changes to "✓ Complete"
- Shows elapsed time: "Completed in 2m 15s"
- Brief result summary line (from extension's final message)
- Task input reappears below for the next task

### Completion state — failure
- Progress bar turns **red**
- Status changes to "✗ Failed"
- Error description below (e.g., "Could not find the booking button")
- **Retry button** to re-run the same task
- Input field also reappears to try something different

### Task history
- **No history panel** — only the current/last completed task is visible
- Agent run history already exists in the dashboard for historical data
- Keep it simple, focused on the active task

### WS message protocol for tasks
- Dashboard sends `dash:task-submit` with task text to extension via WS relay
- Extension sends `ext:task-progress` with: `{ progress, phase, eta, elapsed, action, status }`
- Extension sends `ext:task-complete` with: `{ success, summary, elapsed }` or `{ success: false, error, elapsed }`
- All messages flow through the existing blind WS relay — no server changes needed for message types

### Claude's Discretion
- Exact input field styling and submit button icon
- Transition animation between input and progress states
- How the extension generates action summary text (from its existing automation logger or AI provider)
- Progress estimation accuracy improvements
- Exact error message wording for various failure scenarios
- Whether "Retry" re-sends the same text or lets user edit first

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Extension automation engine
- `background.js` lines 625-640 — `sendSessionStatus()` sends phase, iteration, progress to content script
- `background.js` lines 698-735 — `detectTaskPhase()` determines current phase from action history
- `background.js` lines 740-800 — `estimateProgress()` calculates progress % and ETA
- `background.js` lines 916-930 — `summarizeTask()` generates short task labels via AI
- `utils/automation-logger.js` — Logging utility used throughout automation

### Dashboard (progress receiver)
- `showcase/js/dashboard.js` lines 706-736 — `handleWSMessage()` processes WS events (add new task message types here)
- `showcase/dashboard.html` lines 91-106 — Dashboard header area (task input goes above agent grid)
- `showcase/css/dashboard.css` — Existing styles for dashboard layout, badges, stats

### WebSocket relay
- `server/src/ws/handler.js` — Blind relay server, relays any typed message to opposite side of room
- `ws/ws-client.js` — Extension WS client with `send()` method for outbound messages

### Phase 40/41 context (inherited patterns)
- `.planning/phases/40-websocket-infrastructure/40-CONTEXT.md` — WS protocol decisions, message format
- `.planning/phases/41-qr-pairing-showcase-site/41-CONTEXT.md` — Dashboard auth, paired state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `background.js` `detectTaskPhase()`: Already returns phase strings like 'navigation', 'form_filling', 'reading', 'clicking' — can be sent to dashboard as-is
- `background.js` `estimateProgress()`: Returns `{ progressPercent, estimatedTimeRemaining }` — ready to broadcast
- `background.js` `sendSessionStatus()`: Currently sends to content script only — extend to also send via WS
- `ws/ws-client.js` `FSBWebSocket.send()`: Can send any JSON message — use for task progress broadcasts
- `showcase/js/dashboard.js` `handleWSMessage()`: Already dispatches on `msg.type` — add new task message handlers

### Established Patterns
- WS messages use typed JSON: `{ type: 'ext:*', payload: {...}, ts: Date.now() }`
- Dashboard state toggling via CSS class changes (connected/disconnected/reconnecting pattern)
- Inline transitions (login → dashboard fade) already implemented
- Accent color #ff6b35 for primary actions and progress indicators

### Integration Points
- `showcase/dashboard.html` — Add task input section above the agent grid (after dash-header, before dash-stats-bar)
- `showcase/js/dashboard.js` `handleWSMessage()` — Add handlers for `ext:task-progress` and `ext:task-complete`
- `background.js` — Add listener for `dash:task-submit` WS messages to trigger automation
- `background.js` `sendSessionStatus()` — Extend to broadcast progress via WS in addition to content script

</code_context>

<specifics>
## Specific Ideas

- The task input → progress → completion transition should feel seamless, like one continuous component changing state
- Progress display is text-based monitoring only — live DOM visual streaming comes in Phase 44
- Extension already has all the progress data internally — this phase is about getting that data to the dashboard via WS

</specifics>

<deferred>
## Deferred Ideas

- Live DOM streaming (watching FSB's browser in real time) — Phase 44
- Task queue / multiple concurrent tasks — future consideration if needed
- Task templates / quick-launch presets — TMPL-01 in future requirements

</deferred>

---

*Phase: 42-remote-task-control*
*Context gathered: 2026-03-17*
