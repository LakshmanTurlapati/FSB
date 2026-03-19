---
phase: 45-mcp-server-interface
plan: 01
subsystem: infra
tags: [mcp, typescript, native-messaging, chrome-extension, ipc]

# Dependency graph
requires:
  - phase: 42-remote-task-control
    provides: background.js message handlers (handleStartAutomation, handleStopAutomation, broadcastDashboardProgress)
provides:
  - MCP server TypeScript package with SDK integration
  - Native Messaging two-process bridge (bridge.ts + native-host-shim.ts)
  - Extension-side MCP message handler in background.js
  - Shared message protocol types (MCPMessage, MCPResponse, BridgeMessage)
  - Task queue with serial mutation / concurrent read-only bypass
  - FSB error to MCP error mapping
affects: [45-02-tool-registration, 45-03-resources-prompts, 45-04-integration]

# Tech tracking
tech-stack:
  added: ["@modelcontextprotocol/sdk ^1.27.1", "zod ^3.24.0", "typescript ^5.9.3", "tsx ^4.19.0"]
  patterns: [two-process-native-messaging, ipc-bridge-relay, length-prefixed-json-protocol, serial-mutation-queue]

key-files:
  created:
    - mcp-server/package.json
    - mcp-server/tsconfig.json
    - mcp-server/src/types.ts
    - mcp-server/src/queue.ts
    - mcp-server/src/errors.ts
    - mcp-server/src/server.ts
    - mcp-server/src/index.ts
    - mcp-server/src/bridge.ts
    - mcp-server/src/native-host-shim.ts
  modified:
    - manifest.json
    - background.js

key-decisions:
  - "Used zod v3.25.76 (not v4) for MCP SDK v1.27.1 compatibility"
  - "Used child_process.fork() IPC for bridge-to-shim communication"

patterns-established:
  - "Two-process bridge: MCP server forks native-host-shim, communicates via Node IPC"
  - "Length-prefixed JSON: 4-byte LE header + UTF-8 body for Chrome Native Messaging"
  - "TaskQueue: read-only tools bypass queue, mutation tools serialize"
  - "Error mapping: FSB result objects mapped to MCP content responses with placeholders"

requirements-completed: [MCP-01, MCP-02, MCP-03]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 45 Plan 01: MCP Server Foundation Summary

**TypeScript MCP server package with two-process Native Messaging bridge, extension message handler, shared types, task queue, and error mapping**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Scaffolded mcp-server/ TypeScript package with MCP SDK, Zod, and TypeScript dependencies
- Implemented two-process Native Messaging bridge: bridge.ts manages IPC with forked native-host-shim.ts which relays length-prefixed JSON to Chrome
- Added full MCP message handler in background.js supporting all 10 MCPMessageType values
- Created shared infrastructure: types, serial task queue with read-only bypass, and FSB-to-MCP error mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MCP server TypeScript package with shared types, queue, and error mapping** - `5fb428a` (feat)
2. **Task 2: Create Native Messaging bridge and host shim with extension-side handler** - `c41eb20` (feat)

## Files Created/Modified
- `mcp-server/package.json` - NPM package with MCP SDK, Zod, TypeScript deps
- `mcp-server/tsconfig.json` - TypeScript config targeting ES2022/ESNext for Node18+
- `mcp-server/src/types.ts` - Shared message protocol types (MCPMessage, MCPResponse, MCPProgress, BridgeMessage, ToolResult)
- `mcp-server/src/queue.ts` - TaskQueue with serial mutation execution and concurrent read-only bypass
- `mcp-server/src/errors.ts` - FSB error to MCP error mapping with contextual placeholders
- `mcp-server/src/server.ts` - McpServer factory (fsb-browser-automation v1.0.0)
- `mcp-server/src/index.ts` - Entry point: creates server, connects stdio transport and bridge, registers tools/resources/prompts
- `mcp-server/src/bridge.ts` - NativeMessagingBridge class managing IPC with forked shim process
- `mcp-server/src/native-host-shim.ts` - Thin relay: Chrome Native Messaging stdin/stdout <-> Node IPC
- `manifest.json` - Added nativeMessaging permission
- `background.js` - Added MCP Native Messaging handler (connectToMCPBridge, handleMCPMessage, sendMCPResponse, broadcastMCPProgress)

## Decisions Made
- Used zod v3 (not v4) for MCP SDK v1.27.1 compatibility -- SDK internally depends on zod v3.x
- Used child_process.fork() IPC for bridge-to-shim communication rather than stdio pipes, enabling clean bidirectional message passing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MCP server foundation complete with all shared infrastructure modules
- Ready for Plan 02 (tool registration) and Plan 03 (resources/prompts)
- Bridge and extension handler wired for all 10 message types

## Self-Check: PASSED

All 9 created files verified present. Both task commits (5fb428a, c41eb20) verified in git history.

---
*Phase: 45-mcp-server-interface*
*Completed: 2026-03-18*
