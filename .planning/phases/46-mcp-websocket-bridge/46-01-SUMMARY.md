---
phase: 46-mcp-websocket-bridge
plan: 01
subsystem: infra
tags: [websocket, ws, mcp, bridge, ipc]

requires:
  - phase: 45-mcp-server-interface
    provides: MCP server with NativeMessagingBridge and tool/resource registrations
provides:
  - WebSocketBridge class on port 7225 replacing NativeMessagingBridge
  - Clean MCP server with no native messaging dependencies
affects: [46-02, extension-websocket-client]

tech-stack:
  added: [ws, "@types/ws"]
  patterns: [embedded-websocket-server, single-client-bridge]

key-files:
  created: []
  modified:
    - mcp-server/src/bridge.ts
    - mcp-server/src/types.ts
    - mcp-server/src/errors.ts
    - mcp-server/src/index.ts
    - mcp-server/package.json

key-decisions:
  - "Hardcoded port 7225 -- no configuration needed at this stage"
  - "Single-client model: new connections close the previous client"

patterns-established:
  - "WebSocket bridge pattern: server embeds WS, extension connects as client"
  - "Same sendAndWait interface preserved for zero-change tool compatibility"

requirements-completed: [WSBRIDGE-01, WSBRIDGE-02, WSBRIDGE-05]

duration: 3min
completed: 2026-03-19
---

# Phase 46 Plan 01: WebSocket Bridge Summary

**WebSocketBridge on ws://localhost:7225 replacing NativeMessagingBridge, with native messaging files and references fully purged**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T08:41:51Z
- **Completed:** 2026-03-19T08:44:39Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Rewrote bridge.ts from NativeMessagingBridge (child_process fork + IPC) to WebSocketBridge (ws library on port 7225)
- Preserved identical public interface (connect, disconnect, sendAndWait, isConnected, generateId) for zero-change compatibility with all tools/resources
- Deleted native-host-shim.ts and scripts/install-host.cjs, removed bin/script entries from package.json
- Updated all imports across tools, resources, and index.ts to reference WebSocketBridge

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite bridge.ts from NativeMessagingBridge to WebSocketBridge** - `505efb4` (feat)
2. **Task 2: Update index.ts, delete native files, clean up package.json** - `6bdc9d2` (feat)

## Files Created/Modified
- `mcp-server/src/bridge.ts` - WebSocketBridge class with ws server on port 7225
- `mcp-server/src/types.ts` - Removed BridgeMessage IPC interface
- `mcp-server/src/errors.ts` - Updated extension_not_connected message, removed native_messaging_error
- `mcp-server/src/index.ts` - Import/instantiate WebSocketBridge, updated log messages
- `mcp-server/package.json` - Added ws dep, removed native host bin/script entries
- `mcp-server/src/tools/autopilot.ts` - Import WebSocketBridge
- `mcp-server/src/tools/manual.ts` - Import WebSocketBridge
- `mcp-server/src/tools/read-only.ts` - Import WebSocketBridge
- `mcp-server/src/resources/index.ts` - Import WebSocketBridge

## Files Deleted
- `mcp-server/src/native-host-shim.ts` - Native messaging host shim (no longer needed)
- `mcp-server/scripts/install-host.cjs` - Native host installer script (no longer needed)

## Decisions Made
- Hardcoded port 7225 with no config -- simplicity over flexibility at this stage
- Single-client model: when a new extension connects, old connection is closed (MCP server talks to one extension)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated NativeMessagingBridge references in tool/resource files**
- **Found during:** Task 1 (TypeScript compilation verification)
- **Issue:** Tools (autopilot.ts, manual.ts, read-only.ts) and resources (index.ts) imported NativeMessagingBridge type -- compilation failed
- **Fix:** Changed all imports to WebSocketBridge across 4 files
- **Files modified:** mcp-server/src/tools/autopilot.ts, manual.ts, read-only.ts, mcp-server/src/resources/index.ts
- **Verification:** tsc --noEmit passes for all updated files
- **Committed in:** 505efb4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WebSocket bridge is ready for extension-side client implementation (46-02)
- Extension needs to create WebSocket client connecting to ws://localhost:7225
- Same MCPMessage/MCPResponse protocol, just over WebSocket instead of native messaging

---
*Phase: 46-mcp-websocket-bridge*
*Completed: 2026-03-19*
