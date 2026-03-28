# Phase 45: MCP Server Interface - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose FSB's full browser automation capabilities as an MCP (Model Context Protocol) server. Any MCP-compatible AI agent (Claude Code, Claude Desktop, etc.) can connect and use FSB exactly as its internal AI does — same tools, same resources, same intelligence. The MCP server runs locally as a standalone Node.js process communicating with the Chrome extension via Native Messaging. No fly.io dependency.

</domain>

<decisions>
## Implementation Decisions

### Tool surface — full parity
- Expose **every** capability FSB's internal AI has access to as MCP tools
- **Autopilot mode**: `run_task(task_text)` — agent describes what to do in natural language, FSB's AI drives the automation (same as popup/dashboard input)
- **Manual mode**: All 25+ browser action primitives as individual tools — `click(selector)`, `type(selector, text)`, `navigate(url)`, `scroll(direction)`, `readpage()`, `get_dom_snapshot()`, etc.
- Agent chooses per-call which mode to use
- Real-time streaming progress updates during autopilot via MCP notifications (progress %, phase, ETA, action summaries)
- Site guides, memory system, analytics — all accessible

### Transport — local stdio via Native Messaging
- MCP server is a **local Node.js process** using stdio transport
- AI hosts (Claude Code, Claude Desktop) spawn it as a child process
- Communication with Chrome extension via **Chrome Native Messaging** protocol
- Extension does NOT depend on fly.io for MCP — fully standalone
- Local-only for now; remote access via fly.io can be added in a future phase

### Runtime — TypeScript + official SDK
- MCP server built with `@modelcontextprotocol/sdk` (TypeScript)
- Separate Node.js process from the extension (extension stays vanilla JS)
- Requires `npm build` step for the MCP server component only
- Native Messaging host manifest installed on user's system

### Auth — implicit local trust
- No additional authentication beyond Native Messaging's OS-level trust
- Only the registered host application can connect to the extension
- No API keys, tokens, or pairing flow needed for MCP access

### Concurrency — queue with single execution
- One automation task at a time, matching FSB's existing single-tab model
- Additional tool calls queue and wait their turn
- Agent gets a 'busy' status response if a task is already running
- Non-blocking read operations (get_dom_snapshot, read resources) can execute even while a task runs

### Tab scope — active tab
- MCP tools operate on the currently active browser tab
- Same behavior as FSB's internal automation
- Agent uses `navigate(url)` to go where needed
- No multi-tab targeting in this phase

### Resources — full exposure
- **Current page DOM snapshot**: Structured DOM that FSB's AI sees (elements, selectors, forms, page structure)
- **Open tabs list**: All open tabs with title, URL, active status
- **Site guides & memory**: All 43+ site guides, episodic/semantic/procedural memory, task history
- **Extension config & status**: Current provider/model settings (API keys redacted), connection status, active session info
- Resources are on-demand (agent calls resources/read) — no real-time subscriptions

### Prompts — common workflow templates
- Pre-built MCP prompts for common patterns: `search_and_extract`, `fill_form`, `monitor_page`, `navigate_and_read`
- Prompts chain multiple tools into useful workflows
- Helps agents use FSB effectively without knowing the full tool surface

### Claude's Discretion
- Exact Native Messaging manifest structure and installation script
- Internal message format between MCP server and extension
- How to map FSB's 25+ tools to MCP tool schemas (naming, parameter design)
- MCP notification format for progress streaming
- Queue implementation details
- Error mapping from FSB errors to MCP error codes
- Which specific prompt templates to include

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP Protocol
- `Research/mcp-protocol.md` — Full MCP spec: JSON-RPC 2.0, lifecycle, tools/resources/prompts primitives, capability negotiation
- `Research/mcp-architecture.md` — Transport layers (stdio/HTTP+SSE), TypeScript SDK examples, server implementation patterns
- `Research/implementation-comparison.md` — FSB vs Claude for Chrome comparison, proposed MCP server integration sketch

### Extension automation engine
- `background.js` — Service worker: session management, `handleStartAutomation()`, `detectTaskPhase()`, `estimateProgress()`, `sendSessionStatus()`, message routing
- `ai-integration.js` — AI provider abstraction, prompt engineering, tool documentation (defines what tools the AI can use)
- `content.js` — Content script: DOM analysis, all action tools (click, type, scroll, etc.), `getStructuredDOM`, DOMStateManager

### Chrome Native Messaging
- Chrome docs: `chrome.runtime.connectNative()` — how extension connects to native host process
- Native messaging manifest format: `com.fsb.mcp.json` pointing to the MCP server binary

### Extension message types (from ARCHITECTURE.md)
- `startAutomation` — UI → Background (initiate task)
- `stopAutomation` — UI → Background (cancel task)
- `getStatus` — UI → Background (query session state)
- `getStructuredDOM` — Background → Content (request page state)
- `executeAction` — Background → Content (perform action)
- `statusUpdate` — Background → UI (progress notification)
- `sessionResult` — Background → UI (completion status)

### WebSocket protocol (Phase 40/42)
- `ws/ws-client.js` — Extension WS client, typed JSON envelope format
- `server/src/ws/handler.js` — Blind relay server (reference for message types)

### Site guides & memory
- `site-guides/` — 43+ site guide files with selectors and workflows
- Memory system in `background.js` — episodic/semantic/procedural storage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `background.js` `handleStartAutomation()`: Entry point for task execution — MCP `run_task` tool wraps this same flow
- `background.js` `sendSessionStatus()`: Already broadcasts progress data — extend for MCP notifications
- `background.js` `detectTaskPhase()` + `estimateProgress()`: Progress data generators — pipe to MCP progress notifications
- `content.js` tools object (~line 1755+): All 25+ browser action primitives — each becomes an MCP tool
- `content.js` `getStructuredDOM`: DOM snapshot generator — becomes an MCP resource
- `ai-integration.js` tool documentation: Defines tool names, params, descriptions — map to MCP inputSchema

### Established Patterns
- Chrome message passing: `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` — same pattern for Native Messaging
- Typed JSON messages: `{ type: 'ext:*', payload: {...} }` — adapt for MCP JSON-RPC envelope
- Single-tab execution model: one session at a time — maps to MCP queue
- chrome.storage.local for config — MCP server reads extension state through Native Messaging

### Integration Points
- `background.js` message listener: Add handlers for MCP-originated messages via Native Messaging port
- `manifest.json`: Add `nativeMessaging` permission and `native_messaging_hosts` entry
- New: `mcp-server/` directory for TypeScript MCP server code
- New: Native messaging host manifest (e.g., `com.fsb.mcp.json`) for OS registration
- New: Install script to register native messaging host on user's system

</code_context>

<specifics>
## Specific Ideas

- The MCP server should be a true mirror of FSB's capabilities — an external agent using it should have no fewer capabilities than FSB's built-in AI
- Autopilot mode delegates to FSB's existing AI loop (the agent is a "user" giving a task). Manual mode bypasses FSB's AI entirely — the agent IS the AI making action decisions
- Progress streaming in autopilot should match what the dashboard receives (ext:task-progress events translated to MCP notifications)
- The MCP server is the bridge/translator: MCP JSON-RPC on one side, Chrome Native Messaging on the other

</specifics>

<deferred>
## Deferred Ideas

- Remote MCP access via fly.io HTTP+SSE transport — future phase
- Multi-tab targeting (agent specifies tabId) — future consideration
- MCP resource subscriptions (real-time DOM change notifications) — future phase
- Agent-to-agent orchestration (multiple MCP clients sharing one FSB instance) — future consideration

</deferred>

---

*Phase: 45-mcp-server-interface*
*Context gathered: 2026-03-17*
