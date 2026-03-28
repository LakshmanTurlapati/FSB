# Phase 116: MCP Agent Tools - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose FSB's background agent management as MCP tools so external clients (Claude Code, Cursor, etc.) can create, list, run, stop, and delete agents without touching the extension UI. This bridges the existing agent CRUD in background.js to the MCP server's tool registration pattern.

</domain>

<decisions>
## Implementation Decisions

### Tool Granularity & Naming
- New `agents.ts` file in mcp-server/src/tools/ — matches existing pattern (autopilot.ts, manual.ts, read-only.ts, observability.ts)
- Snake_case naming: `create_agent`, `list_agents`, `run_agent`, `stop_agent`, `delete_agent` — matches existing convention (run_task, stop_task)
- Separate `toggle_agent` tool for enable/disable — simpler for MCP clients, matches background.js pattern
- Expose `get_agent_stats` and `get_agent_history` as read-only tools for monitoring

### Request/Response Shape
- `create_agent` uses simplified flat params: `name`, `task`, `target_url`, `schedule_type`, `interval_minutes`, `daily_time`, `days_of_week`, `max_iterations` — no nested schedule object
- `run_agent` supports progress streaming via MCP progress tokens — matches existing `run_task` pattern with `onProgress` listener
- `list_agents` returns summaries (name, id, enabled, schedule description, lastRunAt, lastRunStatus, replayEnabled) — not full objects with runHistory
- 300s timeout for `run_agent` — same as `run_task`

### Extension-Side Wiring
- Add cases to existing `handleMCPMessage` switch in background.js — keeps all MCP routing in one place
- Read-only agent tools (list, stats, history) bypass the queue — pure reads like other read-only tools
- `run_agent` reuses existing `startAgentRunNow()` — already handles loading, executing, broadcasting, recording
- Missing/invalid agentId returns MCP error with descriptive message via `mapFSBError`

### Claude's Discretion
- Exact Zod schema field types and validation constraints
- MCP tool description wording
- Order of cases in handleMCPMessage switch

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp-server/src/tools/autopilot.ts` — pattern for run_task/stop_task with progress streaming, 300s timeout, queue.enqueue
- `mcp-server/src/tools/read-only.ts` — pattern for read-only tools that bypass queue
- `mcp-server/src/errors.ts` — `mapFSBError()` for normalizing extension responses to MCP format
- `mcp-server/src/types.ts` — `MCPMessageType` union where new mcp:* types must be added
- `agents/agent-manager.js` — full agent CRUD: createAgent, updateAgent, deleteAgent, listAgents, toggleAgent, getStats, getRunHistory
- `background.js` lines ~5547 — existing chrome.runtime.onMessage handlers for createAgent, updateAgent, deleteAgent, listAgents, toggleAgent, runAgentNow, getAgentStats, getAgentRunHistory
- `background.js` line ~6556 — `startAgentRunNow(agentId)` function with execute + broadcast pattern

### Established Patterns
- MCP tools register via `server.tool(name, description, zodSchema, handler)` in a `register*Tools(server, bridge, queue)` function
- Mutation tools use `queue.enqueue()`, read-only tools call `bridge.sendAndWait()` directly
- Extension handles `mcp:*` messages in `handleMCPMessage()`, responds via `sendMCPResponse(id, payload)`
- Progress streaming: register `onProgress` listener, forward `mcp:progress` events as MCP `notifications/progress` + `sendLoggingMessage`

### Integration Points
- `mcp-server/src/index.ts` — import and call `registerAgentTools(server, bridge, queue)`
- `mcp-server/src/types.ts` — add new MCPMessageType values
- `background.js` handleMCPMessage switch — add mcp:create-agent, mcp:list-agents, mcp:run-agent, mcp:stop-agent, mcp:delete-agent, mcp:toggle-agent, mcp:get-agent-stats, mcp:get-agent-history cases

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing MCP tool patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
