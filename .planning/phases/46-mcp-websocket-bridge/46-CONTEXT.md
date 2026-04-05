# Phase 46: MCP WebSocket Bridge - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the native messaging transport in the MCP server with a direct local WebSocket connection between the MCP server process and the Chrome extension. The MCP server embeds a WebSocket server on localhost:7225; the extension connects to it as a client. This eliminates native host installation, extension ID requirements, and the install-host script entirely. All 33+ existing MCP tools must work identically over the new transport.

</domain>

<decisions>
## Implementation Decisions

### Transport
- WebSocket only -- remove native messaging completely (bridge.ts, native-host-shim.ts, install-host script)
- No fly.io relay involvement -- MCP server and extension communicate directly on localhost
- Fixed port 7225 (FSB on phone keypad), no configurability needed
- MCP server embeds the WebSocket server inside its own process -- no separate middleware or service

### Connection Architecture
- Extension maintains two independent WebSocket connections:
  1. Existing `FSBWebSocket` to fly.io relay (for dashboard) -- unchanged
  2. New `MCPWebSocket` to `ws://localhost:7225` (for MCP server)
- Each connection has its own lifecycle, reconnection, and keepalive
- MCP WebSocket auto-retries connection -- only active when MCP server is running
- No authentication/pairing needed -- localhost binding is sufficient security

### Message Routing
- Reuse existing `handleMCPMessage` handler in the extension as-is
- Extension checks incoming WS message type prefix:
  - `mcp:*` messages route to existing `handleMCPMessage`
  - `dash:*` messages continue through existing dashboard handler
- MCP request/response ID correlation stays the same
- MCP progress notifications (`mcp:progress`) work the same way

### Cleanup
- Remove native-host-shim.ts
- Remove install-host.cjs script
- Remove nativeMessaging permission from manifest (if no longer needed)
- Remove com.fsb.mcp native host manifest template
- Update .mcp.json if args change
- bridge.ts rewritten from NativeMessagingBridge to WebSocketBridge (same interface: connect, disconnect, sendAndWait, isConnected)

### Claude's Discretion
- WebSocket server library choice (ws, built-in, etc.)
- Reconnection backoff strategy for extension's MCP WebSocket client
- Exact cleanup of native messaging code (what to delete vs preserve for reference)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP Server (current implementation to modify)
- `mcp-server/src/bridge.ts` -- Current NativeMessagingBridge class, interface to preserve (connect, disconnect, sendAndWait, isConnected)
- `mcp-server/src/native-host-shim.ts` -- To be removed, understand what it does for replacement
- `mcp-server/src/index.ts` -- Server entry point, where bridge is instantiated
- `mcp-server/src/types.ts` -- MCPMessage, MCPResponse, BridgeMessage type definitions
- `mcp-server/src/queue.ts` -- TaskQueue that uses bridge.sendAndWait
- `mcp-server/scripts/install-host.cjs` -- To be removed

### Extension (handlers to wire up)
- `background.js` lines 12302-12445 -- handleMCPMessage, connectToMCPBridge, MCP message types
- `ws/ws-client.js` -- Existing FSBWebSocket singleton, pattern reference for new MCPWebSocket

### Ecosystem Reference
- Browser-Tools MCP (AgentDesk) uses port 3025 with similar architecture: extension connects to local WS server embedded in MCP process
- Playwright MCP bridge extension uses WebSocket relay pattern
- Common ports in ecosystem: 3025, 8080, 8012, 9222

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NativeMessagingBridge` class in bridge.ts: same interface (connect, disconnect, sendAndWait, isConnected) to be reimplemented with WebSocket transport
- `FSBWebSocket` in ws/ws-client.js: pattern for WebSocket client with reconnection and keepalive -- model for the extension's new MCPWebSocket client
- `handleMCPMessage` in background.js: complete message handler for all 10 MCP message types -- reuse without changes

### Established Patterns
- ID-based request/response correlation: `mcp_${++counter}_${timestamp}` -- keep this pattern
- Progress callbacks via `mcp:progress` messages with same ID as request
- Pending request map with timeout rejection

### Integration Points
- bridge.ts is the only file MCP tools interact with -- swapping transport is invisible to tools
- Extension's background.js needs a new WebSocket client class for localhost:7225
- Extension manifest may need nativeMessaging permission removed

</code_context>

<specifics>
## Specific Ideas

- Port 7225 chosen because FSB maps to 3-7-2-2-5 on phone keypad -- memorable and unique
- The goal is zero-friction: user installs extension, Claude Code auto-starts MCP server, extension auto-connects. Nothing else needed.
- Browser-Tools by AgentDesk validates this architecture pattern in the ecosystem

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 46-mcp-websocket-bridge*
*Context gathered: 2026-03-19*
