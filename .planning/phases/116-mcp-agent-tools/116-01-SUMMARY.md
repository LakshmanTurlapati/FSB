---
phase: 116-mcp-agent-tools
plan: 01
subsystem: mcp
tags: [mcp, agents, websocket, typescript, zod]

requires:
  - phase: 45-mcp-server-interface
    provides: MCP server tool registration pattern, WebSocketBridge, TaskQueue
  - phase: 46-mcp-websocket-bridge
    provides: WebSocket bridge message passing to extension
provides:
  - 8 agent management MCP tools (create, list, run, stop, delete, toggle, stats, history)
  - MCPMessageType values for agent operations
  - Read-only queue bypass for agent read tools
affects: [116-02, background.js handleMCPMessage]

tech-stack:
  added: []
  patterns: [agent tool registration following autopilot.ts pattern, flat params with schedule object assembly]

key-files:
  created: [mcp-server/src/tools/agents.ts]
  modified: [mcp-server/src/types.ts, mcp-server/src/queue.ts, mcp-server/src/index.ts]

key-decisions:
  - "Flat schedule params (schedule_type, interval_minutes, daily_time, days_of_week) assembled into nested object in handler -- simpler for MCP clients"
  - "run_agent uses 300s timeout with progress streaming matching run_task pattern"
  - "3 read-only tools (list_agents, get_agent_stats, get_agent_history) bypass queue; 5 mutation tools go through queue"

patterns-established:
  - "Agent tool registration: registerAgentTools(server, bridge, queue) in dedicated agents.ts file"

requirements-completed: [MCP-AGENT-01, MCP-AGENT-02, MCP-AGENT-03, MCP-AGENT-04, MCP-AGENT-05]

duration: 2min
completed: 2026-03-28
---

# Phase 116 Plan 01: MCP Agent Tools Summary

**8 agent management MCP tools registered with Zod schemas, queue routing (3 read-only bypass, 5 mutation queued), and progress streaming on run_agent**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T09:23:51Z
- **Completed:** 2026-03-28T09:25:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Registered all 8 agent MCP tools: create_agent, list_agents, run_agent, stop_agent, delete_agent, toggle_agent, get_agent_stats, get_agent_history
- Added 8 MCPMessageType union values for agent WebSocket message routing
- Configured queue bypass for 3 read-only agent tools
- TypeScript compiles cleanly with all new code

## Task Commits

Each task was committed atomically:

1. **Task 1: Add agent MCPMessageType values and read-only queue entries** - `60b1e38` (feat)
2. **Task 2: Create agents.ts with all 8 MCP tools and wire into index.ts** - `18cec93` (feat)

## Files Created/Modified
- `mcp-server/src/tools/agents.ts` - New file with 8 agent tool registrations following autopilot.ts pattern
- `mcp-server/src/types.ts` - Added 8 mcp:*-agent message types to MCPMessageType union
- `mcp-server/src/queue.ts` - Added list_agents, get_agent_stats, get_agent_history to readOnlyTools bypass set
- `mcp-server/src/index.ts` - Import and call registerAgentTools(server, bridge, queue)

## Decisions Made
- Flat schedule params assembled into nested object in handler (simpler MCP client experience)
- run_agent follows exact run_task progress streaming pattern with 300s timeout
- Logger name 'fsb-agent' distinguishes agent progress from autopilot progress

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 MCP tools registered and compilable
- Plan 02 (background.js handleMCPMessage wiring) can proceed to route these message types to agent-manager.js functions

## Self-Check: PASSED

All 4 files verified on disk. Both commit hashes (60b1e38, 18cec93) found in git log.

---
*Phase: 116-mcp-agent-tools*
*Completed: 2026-03-28*
