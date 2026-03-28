# Phase 43: Agent Dashboard - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view, create, and control background polling agents and automation replay agents entirely from the dashboard. This includes agent creation (both AI-assisted post-task and manual), schedule configuration, detail views with run history and cost savings, and start/stop/delete controls. The agent execution engine already exists in the extension — this phase wires dashboard UI and WS messages to it.

</domain>

<decisions>
## Implementation Decisions

### Agent creation flow
- **Two paths to create agents:**
  1. **Post-task save** (primary): After a successful task run, an inline "Save as Agent" section expands below the result. AI auto-populates agent config (name, URL, schedule) from the task text and execution context. User reviews editable pre-filled fields, adjusts if needed, hits Save
  2. **Manual creation**: A "+ New Agent" button in the agent grid header opens a modal dialog with fields: name, task description, target URL, schedule type/config. Agent starts in AI-only mode until first successful run records a replay script
- AI extracts schedule intent from task text (e.g., "every 2 hours" → interval/120min, "every morning" → daily/8AM). Falls back to manual selection if no schedule words detected
- Post-task inline save uses the completed task's recorded script as the replay baseline

### Schedule configuration
- AI-parsed schedule pre-fills form fields, all editable by user
- Schedule types: interval, daily, once (matching existing extension model)
- **Interval**: Numeric input in minutes, 5-minute minimum enforced (field snaps to 5 if user enters less, with brief message)
- **Daily**: Time picker (HH:MM) + day-of-week pill toggles (M T W T F S S). All days selected by default. Click pills to toggle individual days
- **Once**: Date/time picker for one-time execution
- Falls back to dropdown selection when AI can't detect schedule from task text

### Agent cards (grid view)
- Compact status cards in the existing agent grid
- Each card shows: agent name, schedule summary ("Every 2h"), last run time ago ("45m ago"), success rate as fraction ("12/14"), cost saved ("$0.42")
- Success rate text color: green if >80%, orange if 50-80%, red if <50%
- Enabled/disabled toggle switch directly on each card — click toggles immediately via REST API, no confirmation needed (easily reversible)
- Disabled cards visually muted (reduced opacity or grayed)

### Agent detail panel
- Clicking an agent card opens a **side panel** on the right side of the dashboard
- Agent grid stays visible on the left for navigation between agents
- Detail panel shows:
  - Full agent config (name, task, URL, schedule)
  - Cost savings section: replay runs count, AI fallback count, tokens saved, cost saved
  - Run history table with columns: time, status (check/cross), execution mode badge, cost
  - Execution mode badges: green "Replay", blue "AI", orange "AI Fallback"
  - Collapsible "Recorded Script" section at bottom showing action steps when expanded
- Action buttons: [Run Now] [Edit] at top, [Delete Agent] (red) at bottom

### Agent controls
- **Enable/disable**: Toggle switch on card, immediate API call, no confirmation
- **Run Now**: Button in detail panel, sends `dash:agent-run-now` WS message to extension, extension runs agent immediately, progress shown in detail panel
- **Edit**: Opens same modal as "+ New Agent" but pre-filled with current config. Save updates via REST API
- **Delete**: Button in detail panel with confirmation dialog ("Delete [name]? This removes all run history."). Cancel/Delete buttons

### WS message protocol additions
- `dash:agent-run-now` — Dashboard requests immediate agent run (payload: agentId)
- `ext:agent-run-progress` — Extension sends run progress to dashboard
- `ext:agent-run-complete` — Extension sends run result to dashboard
- Existing `agent_updated`, `agent_deleted`, `run_completed` server broadcasts continue to work for real-time grid updates

### Claude's Discretion
- Exact modal styling and field layout
- Detail panel width and responsive behavior
- How AI extracts schedule intent from task text (regex vs lightweight AI call)
- Animation for inline save expansion after task completion
- Run history pagination in detail panel
- How "Run Now" progress integrates with the detail panel vs the main task area
- Exact toggle switch styling and disabled card appearance

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Extension agent system (execution engine)
- `agents/agent-manager.js` — Agent CRUD, run history, storage. Data model: agentId, name, task, targetUrl, schedule, enabled, replayEnabled, recordedScript, replayStats, runHistory
- `agents/agent-scheduler.js` — chrome.alarms scheduling: interval, daily, once types. Alarm names prefixed `fsb_agent_`
- `agents/agent-executor.js` — Replay vs AI execution: recorded script replay, AI fallback, cost tracking, MAX_CONCURRENT=3, EXECUTION_TIMEOUT=4min
- `agents/server-sync.js` — HTTP sync to server: run results, agent definitions, retry queue

### Background.js integration
- `background.js` lines 142-146 — Agent module imports
- `background.js` lines 12018-12081 — `chrome.alarms.onAlarm` handler: execute agent, record run, reschedule, sync to server

### Dashboard (current state)
- `showcase/js/dashboard.js` — Agent grid rendering, run history display, stats cards, WS message handling, polling fallback
- `showcase/dashboard.html` — Dashboard HTML: login, stats bar, agent grid, runs panel
- `showcase/css/dashboard.css` — Dashboard styles, card layout, badges

### Server API
- `server/src/routes/agents.js` — REST endpoints: GET/POST/DELETE agents, POST/GET runs, GET stats. Broadcasts via WS on mutations
- `server/src/db/schema.js` — SQLite tables: agents (hash_key, agent_id, name, task, target_url, schedule_type, schedule_config, enabled), agent_runs (execution_mode, cost_saved, etc.)
- `server/src/db/queries.js` — Parameterized DB queries

### WebSocket relay
- `server/src/ws/handler.js` — Blind relay with room-based routing (hashKey → extensions + dashboards). broadcastToRoom for server-initiated events
- `ws/ws-client.js` — Extension WS client: send(), reconnection, keepalive, dash:task-submit handler

### Phase 42 context (task control patterns)
- `.planning/phases/42-remote-task-control/42-CONTEXT.md` — Task input → progress → completion flow, WS message protocol for tasks, inline state transitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents/agent-manager.js` `createAgent()`: Full agent creation with schedule, replay config — dashboard calls this via REST API which syncs to extension
- `agents/agent-executor.js`: Handles replay vs AI decision, cost tracking, timeout management — no changes needed, dashboard just triggers it
- `showcase/js/dashboard.js` agent grid rendering: Already creates agent cards with name, task, status — extend with toggle, success rate, cost saved
- `showcase/js/dashboard.js` `handleWSMessage()`: Already dispatches on message type — add new agent-specific message handlers
- `server/src/routes/agents.js` POST /api/agents: Already handles agent upsert — use for both create and edit from dashboard

### Established Patterns
- WS messages: `{ type: 'ext:*' | 'dash:*', payload: {...}, ts: Date.now() }`
- Dashboard state via CSS class toggling (connected/disconnected pattern)
- Inline transitions (task input → progress, login → dashboard)
- Accent color #ff6b35 for primary actions
- REST for CRUD, WS for real-time events (hybrid protocol from Phase 40)
- Server broadcasts `agent_updated`/`agent_deleted`/`run_completed` after REST mutations

### Integration Points
- `showcase/dashboard.html` — Add "+ New Agent" button in agent grid header, add creation modal HTML, add detail side panel
- `showcase/js/dashboard.js` — Add modal logic, side panel rendering, toggle handlers, "Save as Agent" inline section after task completion
- `showcase/js/dashboard.js` `handleWSMessage()` — Add handlers for `ext:agent-run-progress`, `ext:agent-run-complete`
- `ws/ws-client.js` — Add handler for `dash:agent-run-now` to trigger agent execution
- `background.js` — Add WS listener for `dash:agent-run-now` to call agent-executor

</code_context>

<specifics>
## Specific Ideas

- Agent creation should feel AI-first — user describes what they want, AI figures out the config. The form is for review/tweaking, not data entry
- Post-task "Save as Agent" is the golden path: task succeeds → AI extracts config → user confirms → agent created with replay script ready
- The side panel for agent details follows the pattern of clicking to reveal more info without losing the grid context
- Cost savings ($X.XX saved) should be prominently visible — it's a key value prop of replay agents

</specifics>

<deferred>
## Deferred Ideas

- Task templates / quick-launch presets — TMPL-01 in future requirements
- Multi-user shared dashboards with agent access control — AADV-02
- CAPTCHA pause/resume notification on dashboard — AADV-01
- Agent chaining (output of one agent feeds into another) — future consideration

</deferred>

---

*Phase: 43-agent-dashboard*
*Context gathered: 2026-03-17*
