# Phase 45: MCP Server Interface - Research

**Researched:** 2026-03-17
**Domain:** MCP Protocol / Chrome Native Messaging / TypeScript Server Development
**Confidence:** HIGH

## Summary

Phase 45 exposes FSB's browser automation capabilities as a Model Context Protocol (MCP) server, enabling any MCP-compatible AI agent (Claude Code, Claude Desktop, Cursor, etc.) to use FSB's full tool surface. The architecture is a standalone TypeScript Node.js process using `@modelcontextprotocol/sdk` with stdio transport on the MCP side, bridged to the Chrome extension via Chrome Native Messaging on the other side. The MCP server acts as a translator: MCP JSON-RPC on one end, Chrome's length-prefixed JSON Native Messaging protocol on the other.

The `@modelcontextprotocol/sdk` v1.27.1 is stable and well-documented. The high-level `McpServer` class provides `registerTool`, `registerResource`, and `registerPrompt` methods with Zod schema validation. The `StdioServerTransport` handles the MCP stdio protocol out of the box. Chrome Native Messaging requires a JSON host manifest registered per-OS, the `nativeMessaging` permission in the extension manifest, and a persistent port via `chrome.runtime.connectNative()`. Messages are length-prefixed JSON (32-bit LE header + UTF-8 JSON body) with a 1MB host-to-extension limit.

**Primary recommendation:** Build the MCP server as a `mcp-server/` TypeScript package at the repo root with its own `package.json`, `tsconfig.json`, and build step. Use the high-level `McpServer` class from `@modelcontextprotocol/sdk` for tool/resource/prompt registration. Bridge to the extension via a `NativeMessagingBridge` class that handles the length-prefixed protocol on stdin/stdout of a Native Messaging port. Include an install script that registers the native host manifest on macOS, Linux, and Windows.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Tool surface -- full parity:** Expose every capability FSB's internal AI has as MCP tools. Autopilot mode (`run_task`) + all 25+ manual primitives
- **Transport -- local stdio via Native Messaging:** MCP server is a local Node.js process using stdio transport. Communicates with Chrome extension via Chrome Native Messaging. No fly.io dependency
- **Runtime -- TypeScript + official SDK:** Built with `@modelcontextprotocol/sdk`. Separate Node.js process from extension. Requires `npm build` step
- **Auth -- implicit local trust:** No additional auth beyond Native Messaging's OS-level trust
- **Concurrency -- queue with single execution:** One automation at a time. Queue additional calls. Non-blocking reads can execute concurrently
- **Tab scope -- active tab:** MCP tools operate on the currently active browser tab
- **Resources -- full exposure:** DOM snapshot, open tabs, site guides, memory, extension config (keys redacted)
- **Prompts -- common workflow templates:** Pre-built prompts for search_and_extract, fill_form, monitor_page, navigate_and_read

### Claude's Discretion
- Exact Native Messaging manifest structure and installation script
- Internal message format between MCP server and extension
- How to map FSB's 25+ tools to MCP tool schemas (naming, parameter design)
- MCP notification format for progress streaming
- Queue implementation details
- Error mapping from FSB errors to MCP error codes
- Which specific prompt templates to include

### Deferred Ideas (OUT OF SCOPE)
- Remote MCP access via fly.io HTTP+SSE transport
- Multi-tab targeting (agent specifies tabId)
- MCP resource subscriptions (real-time DOM change notifications)
- Agent-to-agent orchestration (multiple MCP clients sharing one FSB instance)
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | 1.27.1 | MCP server SDK (tools, resources, prompts, stdio transport) | Official Anthropic SDK, stable v1.x, used by all MCP servers |
| typescript | 5.9.3 | TypeScript compiler for the MCP server | Extension is vanilla JS; MCP server is separate TS package |
| zod | 4.3.6 | Runtime schema validation for tool inputSchema | SDK's McpServer.registerTool uses Zod for schema definition |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | latest | Dev-time TypeScript execution without pre-compile | Development/testing only, not production |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| High-level McpServer class | Low-level Server + setRequestHandler | McpServer is simpler for tool registration with Zod; low-level Server gives more control over raw JSON-RPC but more boilerplate |
| chrome-native-messaging (npm) | Hand-rolled Buffer reader/writer | The npm package is v0.2.0 and very thin; hand-rolling 30 lines of Buffer code is fine and avoids a dependency |
| Separate mcp-server/ package | Inline in extension JS | Must be separate -- MCP server is Node.js, extension is Chrome service worker context |

**Installation:**
```bash
cd mcp-server && npm install @modelcontextprotocol/sdk@^1.27.1 zod@^4.3.6 && npm install -D typescript@^5.9.3
```

## Architecture Patterns

### Recommended Project Structure
```
mcp-server/
  package.json           # Separate npm package
  tsconfig.json          # TypeScript config (ESM, Node18+ target)
  src/
    index.ts             # Entry point: create server, connect transport
    server.ts            # McpServer registration (tools, resources, prompts)
    bridge.ts            # NativeMessagingBridge: Chrome Native Messaging I/O
    tools/
      autopilot.ts       # run_task tool (delegates to FSB AI loop)
      manual.ts          # All 25+ manual browser action tools
      read-only.ts       # Non-blocking read tools (DOM, tabs, config)
    resources/
      index.ts           # Resource registrations (DOM, tabs, guides, memory, config)
    prompts/
      index.ts           # Prompt template registrations
    queue.ts             # Task queue: serial execution, concurrent reads
    types.ts             # Shared types for messages, tool params, responses
    errors.ts            # Error code mapping (FSB errors -> MCP error codes)
  scripts/
    install-host.sh      # macOS/Linux native host manifest installer
    install-host.ps1     # Windows native host manifest installer
    install-host.js      # Cross-platform Node.js installer (recommended)
  build/                 # Compiled JS output
  native-host-manifest/
    com.fsb.mcp.json     # Template manifest (path placeholder)
```

### Pattern 1: Two-Transport Bridge
**What:** The MCP server sits between two transports -- MCP stdio on one side, Chrome Native Messaging on the other. It translates between the two protocols.
**When to use:** Always. This is the core architecture.
**Example:**
```typescript
// Source: MCP SDK docs + Chrome Native Messaging docs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NativeMessagingBridge } from "./bridge.js";

const server = new McpServer({
  name: "fsb-browser-automation",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
    logging: {},
  },
});

// Register tools, resources, prompts...
registerTools(server, bridge);
registerResources(server, bridge);
registerPrompts(server);

// Connect MCP stdio transport (AI host <-> MCP server)
const transport = new StdioServerTransport();
await server.connect(transport);

// Connect Native Messaging bridge (MCP server <-> Chrome extension)
const bridge = new NativeMessagingBridge("com.fsb.mcp");
await bridge.connect();
```

### Pattern 2: Native Messaging Bridge Class
**What:** Encapsulates Chrome Native Messaging length-prefixed JSON protocol over a persistent port.
**When to use:** All communication between MCP server and Chrome extension.
**Example:**
```typescript
// The bridge manages a Native Messaging connection to the extension.
// Extension side uses chrome.runtime.connectNative('com.fsb.mcp').
// Node.js side reads/writes length-prefixed JSON on stdin/stdout of the
// child process Chrome spawns. BUT -- the MCP server is the process Chrome
// spawns for Native Messaging AND the AI host spawns for MCP stdio.
//
// KEY INSIGHT: These are TWO DIFFERENT processes.
// Process 1: AI host spawns mcp-server (stdio transport for MCP)
// Process 2: Extension connects to a native host (Chrome spawns it)
//
// Since one process can't serve both stdin/stdout to two parents,
// the MCP server (Process 1) must communicate with the extension
// through a DIFFERENT IPC channel. Options:
//   A) MCP server spawns a child native-host process and talks via IPC
//   B) Use a local TCP/Unix socket between the two processes
//   C) Use Chrome's externally_connectable + localhost HTTP
//
// Recommended: Option A -- MCP server spawns a thin native-host shim
// that Chrome connects to. The shim relays messages to/from MCP server
// over Node.js child_process IPC (process.send/process.on('message')).

// native-host-shim.js (Chrome spawns this)
import { spawn, ChildProcess } from "child_process";

// Read length-prefixed message from stdin (Chrome sends these)
function readNativeMessage(): Promise<object> {
  return new Promise((resolve, reject) => {
    const headerBuf = Buffer.alloc(4);
    let bytesRead = 0;
    process.stdin.on("readable", function onReadable() {
      while (bytesRead < 4) {
        const chunk = process.stdin.read(4 - bytesRead);
        if (!chunk) return;
        chunk.copy(headerBuf, bytesRead);
        bytesRead += chunk.length;
      }
      const len = headerBuf.readUInt32LE(0);
      const body = process.stdin.read(len);
      if (!body) return;
      process.stdin.removeListener("readable", onReadable);
      resolve(JSON.parse(body.toString("utf8")));
    });
  });
}

// Write length-prefixed message to stdout (Chrome reads these)
function writeNativeMessage(msg: object): void {
  const json = JSON.stringify(msg);
  const buf = Buffer.from(json, "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}
```

### Pattern 3: Task Queue with Concurrent Reads
**What:** Serial execution queue for mutation tools, bypass queue for read-only tools.
**When to use:** Every tool call goes through the queue.
**Example:**
```typescript
type QueueItem = {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
};

class TaskQueue {
  private queue: QueueItem[] = [];
  private running = false;
  private readonly readOnlyTools = new Set([
    "get_dom_snapshot", "list_tabs", "get_current_tab",
    "read_page", "get_site_guides", "get_memory",
    "get_extension_config", "get_status"
  ]);

  async enqueue(toolName: string, fn: () => Promise<any>): Promise<any> {
    // Read-only tools bypass the queue entirely
    if (this.readOnlyTools.has(toolName)) {
      return fn();
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ execute: fn, resolve, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    const item = this.queue.shift()!;
    try {
      const result = await item.execute();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.running = false;
      this.process();
    }
  }
}
```

### Pattern 4: Tool Registration from CLI_COMMAND_TABLE
**What:** Map FSB's existing CLI command definitions to MCP tool schemas.
**When to use:** Defining manual mode tools.
**Example:**
```typescript
// Each FSB CLI command becomes an MCP tool.
// Naming convention: snake_case matching FSB verb names.
server.registerTool(
  "click",
  {
    title: "Click Element",
    description: "Click an element on the page by CSS selector or element reference",
    inputSchema: z.object({
      selector: z.string().describe("CSS selector or element reference (e.g., 'e5', '#submit-btn')"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  async ({ selector }, ctx) => {
    const result = await bridge.sendAndWait({
      type: "mcp:execute-action",
      payload: { tool: "click", params: { selector } },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);
```

### Anti-Patterns to Avoid
- **Sharing stdin/stdout between MCP and Native Messaging:** The MCP server uses stdin/stdout for MCP JSON-RPC. It CANNOT also use stdin/stdout for Native Messaging. These are two separate I/O channels that must use different transports. Use IPC, TCP, or a shim process.
- **Blocking the MCP event loop during automation:** Autopilot tasks can run for 30+ seconds. Use async patterns and progress notifications; never block the server.
- **Exposing raw API keys in resources:** The extension config resource must redact all API keys and sensitive data before returning.
- **Tight coupling to extension internals:** The MCP server should only know about the message protocol, not extension implementation details. The bridge is the boundary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol handling | Custom JSON-RPC parser | `@modelcontextprotocol/sdk` StdioServerTransport | Handles framing, lifecycle, capability negotiation, error codes |
| Schema validation | Manual param checking | Zod via McpServer.registerTool | SDK integrates Zod natively for inputSchema |
| Native Messaging protocol | Nothing -- this IS hand-rolled | 30 lines of Buffer read/write | The npm package (chrome-native-messaging v0.2.0) is Node streams-based and adds unnecessary complexity for a simple protocol. Better to write the ~30 lines directly |
| Progress notifications | Custom notification system | SDK's built-in `notifications/progress` support | Standard MCP protocol, clients already handle it |
| Cross-platform install | Detect OS manually | Node.js `os.platform()` + `os.homedir()` in install script | Standard Node.js APIs handle all three OSes |

**Key insight:** The only truly custom code is the Native Messaging bridge (length-prefixed Buffer I/O) and the message routing logic between MCP tools and extension actions. Everything else has a standard solution.

## Common Pitfalls

### Pitfall 1: stdin/stdout Collision
**What goes wrong:** The MCP server needs stdin/stdout for the MCP stdio transport. If you also try to use the same process as a Chrome Native Messaging host, Chrome and the AI host both write to the same stdin -- messages corrupt each other.
**Why it happens:** Both MCP stdio and Chrome Native Messaging are stdin/stdout protocols. One process can only serve one.
**How to avoid:** Use a two-process architecture. The MCP server process owns stdin/stdout for MCP. It communicates with the extension via either: (a) a thin native-host shim process that Chrome spawns, connected via Node IPC, or (b) a local socket/pipe.
**Warning signs:** Garbled JSON errors, "unexpected token" parse failures, connection drops.

### Pitfall 2: Native Messaging Message Size Limit
**What goes wrong:** Chrome limits Native Messaging host-to-extension messages to 1 MB. Full DOM snapshots or large page reads can exceed this.
**Why it happens:** FSB's `getStructuredDOM` on complex pages can produce 500KB+ of JSON. Add serialization overhead and you approach the limit.
**How to avoid:** Truncate large responses (cap DOM elements, paginate page content). Add a `maxElements` parameter to DOM snapshot requests. Monitor response sizes.
**Warning signs:** Silent message drops, "native messaging host not responding" errors.

### Pitfall 3: Service Worker Lifecycle
**What goes wrong:** Chrome MV3 service workers can go dormant after 30 seconds of inactivity. If the MCP server sends a message while the extension is dormant, it gets lost.
**Why it happens:** Chrome aggressively suspends service workers to save resources.
**How to avoid:** The extension already has keepalive mechanisms (alarms, WebSocket). Native Messaging ports also keep the service worker alive while connected. Ensure `chrome.runtime.connectNative()` maintains a persistent port (not `sendNativeMessage`).
**Warning signs:** Intermittent timeouts, tools that work initially then fail after idle periods.

### Pitfall 4: Error Code Mapping
**What goes wrong:** FSB returns error objects like `{ success: false, error: "Element not found" }`. MCP expects JSON-RPC error codes (-32600 series). Unmapped errors produce confusing results for AI agents.
**Why it happens:** Two different error conventions across the bridge.
**How to avoid:** Create an explicit error mapping layer:
```typescript
function mapFSBError(fsbResult: any): McpToolResult {
  if (fsbResult.success) {
    return { content: [{ type: "text", text: JSON.stringify(fsbResult) }] };
  }
  // Map to MCP isError content response (not JSON-RPC error)
  return {
    content: [{ type: "text", text: fsbResult.error || "Unknown error" }],
    isError: true,
  };
}
```
**Warning signs:** AI agents unable to interpret tool failures, retrying failed actions without understanding why.

### Pitfall 5: Windows Path Handling in Native Host Manifest
**What goes wrong:** The native host manifest `path` field must be an absolute path to the executable. On Windows, backslashes in JSON need escaping, and `npx` doesn't work directly -- you need `cmd /c npx` or a `.bat` wrapper.
**Why it happens:** Windows uses backslashes in paths and doesn't have a Unix-like shebang system.
**How to avoid:** The install script should generate a `.bat` wrapper on Windows that invokes `node build/index.js`. Use forward slashes or double backslashes in the manifest JSON.
**Warning signs:** "Failed to start native messaging host" errors on Windows only.

### Pitfall 6: Process Cleanup on Disconnect
**What goes wrong:** If the AI host kills the MCP server process (e.g., user closes Claude Code), the native messaging shim and extension port may not clean up, leaving orphan processes or stale connections.
**Why it happens:** No graceful shutdown signal propagation.
**How to avoid:** Handle `SIGTERM`, `SIGINT`, and `process.on('exit')` in the MCP server to close the native messaging bridge. The bridge should close the shim process. The extension should handle port disconnect events.
**Warning signs:** Zombie Node.js processes, extension showing stale "connected" status.

## Code Examples

### MCP Server Entry Point
```typescript
// Source: @modelcontextprotocol/sdk docs (server.md)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer(
  { name: "fsb-browser-automation", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {}, logging: {} } }
);

// ... register tools, resources, prompts ...

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[FSB MCP] Server started on stdio"); // stderr for debug, stdout reserved for MCP
}

main().catch((err) => {
  console.error("[FSB MCP] Fatal:", err);
  process.exit(1);
});
```

### Autopilot Tool (run_task)
```typescript
// Delegates to FSB's existing AI loop -- the agent becomes a "user" giving a task
import { z } from "zod";

server.registerTool(
  "run_task",
  {
    title: "Run Automation Task",
    description: "Execute a browser automation task using FSB's AI. Describe what you want done in natural language. FSB's AI will decide the steps and execute them.",
    inputSchema: z.object({
      task: z.string().describe("Natural language description of the task to perform"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  async ({ task }, ctx) => {
    // Send progress notifications if client requested them
    const progressToken = ctx.mcpReq?._meta?.progressToken;

    const result = await bridge.sendAndWait(
      { type: "mcp:start-automation", payload: { task } },
      {
        timeout: 120_000, // 2 minute timeout for autopilot tasks
        onProgress: progressToken
          ? (progress) => {
              ctx.mcpReq.log("info", `Progress: ${progress.percent}% - ${progress.action}`);
            }
          : undefined,
      }
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);
```

### Resource Registration (DOM Snapshot)
```typescript
// Source: @modelcontextprotocol/sdk docs (server.md)
server.registerResource(
  "current-page-dom",
  "browser://dom/snapshot",
  {
    title: "Current Page DOM",
    description: "Structured DOM snapshot of the currently active browser tab, including elements, selectors, forms, and page structure",
    mimeType: "application/json",
  },
  async (uri) => {
    const dom = await bridge.sendAndWait({
      type: "mcp:get-dom",
      payload: { maxElements: 2000, prioritizeViewport: true },
    });
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(dom, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);
```

### Prompt Registration
```typescript
server.registerPrompt(
  "search-and-extract",
  {
    title: "Search and Extract Data",
    description: "Navigate to a site, search for information, and extract structured data",
    argsSchema: z.object({
      site: z.string().describe("Website URL or name to search on"),
      query: z.string().describe("What to search for"),
      fields: z.string().describe("Comma-separated list of data fields to extract"),
    }),
  },
  ({ site, query, fields }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Use FSB's browser automation to:\n1. Navigate to ${site}\n2. Search for: ${query}\n3. Extract these fields: ${fields}\n\nUse the navigate tool to go to the site, then readpage or get_dom_snapshot to find search functionality, then interact with it using click/type tools. Extract the requested data and return it as structured JSON.`,
        },
      },
    ],
  })
);
```

### Extension-Side Native Messaging Handler
```javascript
// Added to background.js -- handles messages from MCP server via Native Messaging
let mcpNativePort = null;

chrome.runtime.onConnectExternal.addListener((port) => {
  // Native Messaging connections come through onConnect, not onConnectExternal
  // This handler is for the native messaging port
});

// Native Messaging: extension connects to host application
// The native host is spawned by Chrome when connectNative is called
// BUT: In this architecture, the MCP server spawns the native host shim,
// and the EXTENSION initiates the connection to the shim.
// Alternative: The native host shim is registered, and the extension
// connects via chrome.runtime.connectNative('com.fsb.mcp')

function connectToMCPBridge() {
  mcpNativePort = chrome.runtime.connectNative('com.fsb.mcp');

  mcpNativePort.onMessage.addListener((msg) => {
    handleMCPMessage(msg);
  });

  mcpNativePort.onDisconnect.addListener(() => {
    console.log('[FSB MCP] Native messaging disconnected');
    mcpNativePort = null;
  });
}

async function handleMCPMessage(msg) {
  switch (msg.type) {
    case 'mcp:start-automation': {
      // Delegate to existing handleStartAutomation
      const result = await new Promise((resolve) => {
        handleStartAutomation(
          { action: 'startAutomation', task: msg.payload.task, tabId: null },
          { id: chrome.runtime.id },
          resolve
        );
      });
      mcpNativePort.postMessage({ id: msg.id, type: 'mcp:result', payload: result });
      break;
    }
    case 'mcp:execute-action': {
      // Send action to content script in active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        mcpNativePort.postMessage({ id: msg.id, type: 'mcp:result', payload: { success: false, error: 'No active tab' } });
        return;
      }
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'executeAction',
        tool: msg.payload.tool,
        params: msg.payload.params,
      });
      mcpNativePort.postMessage({ id: msg.id, type: 'mcp:result', payload: result });
      break;
    }
    case 'mcp:get-dom': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const dom = await chrome.tabs.sendMessage(tab.id, {
        action: 'getStructuredDOM',
        ...msg.payload,
      });
      mcpNativePort.postMessage({ id: msg.id, type: 'mcp:result', payload: dom });
      break;
    }
    // ... more message types
  }
}
```

### Native Host Manifest
```json
{
  "name": "com.fsb.mcp",
  "description": "FSB Browser Automation MCP Bridge",
  "path": "/absolute/path/to/mcp-server/build/native-host-shim.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID_HERE/"
  ]
}
```

### Client Configuration (Claude Desktop / Claude Code)
```json
{
  "mcpServers": {
    "fsb-browser": {
      "command": "node",
      "args": ["/path/to/fsb/mcp-server/build/index.js"],
      "env": {}
    }
  }
}
```

Or via Claude Code CLI:
```bash
claude mcp add --transport stdio fsb-browser -- node /path/to/fsb/mcp-server/build/index.js
```

Or via project-scoped `.mcp.json` at repo root:
```json
{
  "mcpServers": {
    "fsb-browser": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT:-./mcp-server}/build/index.js"]
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Low-level Server class + setRequestHandler | McpServer class with registerTool/registerResource/registerPrompt | SDK v1.x (2025) | Much less boilerplate, native Zod integration |
| HTTP+SSE transport | Streamable HTTP transport (SSE deprecated) | MCP spec 2025-06-18 | For remote servers; stdio remains standard for local |
| Manual JSON Schema | Zod schemas auto-converted to JSON Schema | SDK v1.x | Type-safe input validation with less code |
| No progress support | notifications/progress with progressToken | MCP spec 2025-03-26 | Enables real-time task progress updates |

**Deprecated/outdated:**
- SSE transport: Deprecated in favor of Streamable HTTP for remote servers (not relevant for this phase -- using stdio)
- SDK v2 is in pre-alpha on main branch. v1.x (1.27.1) is the recommended production version with 6+ months of support after v2 ships

## Critical Architecture Decision: Two-Process Bridge

The most important architectural decision is how the MCP server communicates with the Chrome extension. Both MCP stdio and Chrome Native Messaging are stdin/stdout protocols, so a single process cannot serve both.

**Recommended: Spawned Native Host Shim**

```
AI Host (Claude Code)          Chrome Extension
     |                              |
     | stdin/stdout (MCP JSON-RPC)  | connectNative('com.fsb.mcp')
     v                              v
+-------------------+    +--------------------+
| MCP Server        |    | Native Host Shim   |
| (Node.js)         |<-->| (Node.js)          |
| - MCP stdio       |IPC | - Native Messaging |
| - Tool handlers   |    | - Length-prefixed   |
| - Queue           |    |   JSON on stdio    |
+-------------------+    +--------------------+
        ^                         ^
        |   child_process.fork()  |
        |   or local TCP socket   |
        +-------------------------+
```

The MCP server spawns the native host shim as a child process. They communicate via Node.js IPC (`child.send()`/`process.on('message')`). Chrome spawns its own instance of the shim via the native host manifest. The shim is a thin relay -- it reads length-prefixed JSON from Chrome's stdin, unwraps it, and forwards via IPC. Responses go back the same way.

**Alternative: Local TCP Socket**

Instead of child process IPC, both processes connect to a local TCP socket (e.g., `127.0.0.1:9222` or a Unix domain socket). This decouples process lifecycles but adds socket management complexity.

**Recommendation:** Start with the child process IPC approach for simplicity. The shim is ~50 lines. If lifecycle issues arise, refactor to socket-based.

## Tool Mapping: FSB CLI Commands -> MCP Tools

### Autopilot Mode
| MCP Tool | Description | Maps to Extension |
|----------|-------------|-------------------|
| `run_task` | Execute task via FSB's AI (natural language) | `handleStartAutomation()` |
| `stop_task` | Cancel running automation | `handleStopAutomation()` |
| `get_task_status` | Check current task progress | `getStatus` message |

### Manual Mode - Navigation
| MCP Tool | FSB Verb | Params |
|----------|----------|--------|
| `navigate` | navigate | `{ url: string }` |
| `search` | search | `{ query: string }` |
| `go_back` | back | `{}` |
| `go_forward` | forward | `{}` |
| `refresh` | refresh | `{}` |

### Manual Mode - Interaction
| MCP Tool | FSB Verb | Params |
|----------|----------|--------|
| `click` | click | `{ selector: string }` |
| `type_text` | type | `{ selector: string, text: string }` |
| `press_enter` | enter | `{ selector?: string }` |
| `press_key` | key | `{ key: string, ctrl?: bool, shift?: bool, alt?: bool }` |
| `select_option` | select | `{ selector: string, value: string }` |
| `check_box` | check | `{ selector: string }` |
| `hover` | hover | `{ selector: string }` |
| `right_click` | rightclick | `{ selector: string }` |
| `double_click` | doubleclick | `{ selector: string }` |
| `focus` | focus | `{ selector: string }` |
| `clear_input` | clear | `{ selector: string }` |

### Manual Mode - Scrolling
| MCP Tool | FSB Verb | Params |
|----------|----------|--------|
| `scroll` | scroll | `{ direction: "up"\|"down", amount?: number }` |
| `scroll_to_top` | scrolltotop | `{}` |
| `scroll_to_bottom` | scrolltobottom | `{}` |

### Manual Mode - Information
| MCP Tool | FSB Verb | Params |
|----------|----------|--------|
| `read_page` | readpage | `{ full?: bool }` |
| `get_text` | gettext | `{ selector: string }` |
| `get_attribute` | getattr | `{ selector: string, attribute: string }` |
| `get_dom_snapshot` | getStructuredDOM | `{ maxElements?: number }` |

### Manual Mode - Waiting
| MCP Tool | FSB Verb | Params |
|----------|----------|--------|
| `wait_for_element` | wait | `{ selector: string }` |
| `wait_for_stable` | waitstable | `{}` |

### Manual Mode - Tabs
| MCP Tool | FSB Verb | Params |
|----------|----------|--------|
| `open_tab` | opentab | `{ url: string }` |
| `switch_tab` | switchtab | `{ tabId: number }` |
| `list_tabs` | tabs | `{}` |

### Manual Mode - Data
| MCP Tool | FSB Verb | Params |
|----------|----------|--------|
| `fill_sheet` | fillsheet | `{ startCell: string, csvData: string, sheetName?: string }` |
| `read_sheet` | readsheet | `{ range: string }` |

## Native Messaging Host Installation

### Manifest Locations by OS

| OS | User-level Path |
|----|-----------------|
| macOS | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.fsb.mcp.json` |
| Linux | `~/.config/google-chrome/NativeMessagingHosts/com.fsb.mcp.json` |
| Windows | Registry: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.fsb.mcp` pointing to manifest path |

### Install Script Requirements
1. Determine OS via `process.platform`
2. Generate manifest JSON with absolute path to the native host shim
3. Copy manifest to correct OS-specific location
4. On Windows: create registry key pointing to manifest
5. Generate a launcher script (`.sh` or `.bat`) that runs `node /path/to/native-host-shim.js`
6. Make launcher executable on macOS/Linux
7. Print the extension ID placeholder -- user fills in after installing extension

## Open Questions

1. **Extension ID discovery**
   - What we know: The native host manifest requires the exact extension ID in `allowed_origins`. Unpacked extensions get a different ID per installation.
   - What's unclear: How to get the ID without manual user input.
   - Recommendation: Install script prompts for the extension ID. Print instructions for finding it in `chrome://extensions`. Could also add a button in the extension popup that copies the ID.

2. **Process lifecycle management**
   - What we know: Chrome spawns the native host when `connectNative` is called. The AI host spawns the MCP server independently.
   - What's unclear: The exact startup sequence -- does the extension connect first, or does the MCP server wait for the extension?
   - Recommendation: MCP server starts and listens. Extension connects when user triggers it (or on startup if configured). Tools return "extension not connected" errors until the bridge is established.

3. **Two-process vs single-process architecture**
   - What we know: MCP stdio and Native Messaging both need stdin/stdout. Two separate processes are needed.
   - What's unclear: Whether Node IPC, TCP socket, or named pipe is most reliable for the inter-process bridge.
   - Recommendation: Start with `child_process.fork()` IPC. It is the simplest and most reliable for parent-child Node.js processes. Refactor to socket if needed.

## Sources

### Primary (HIGH confidence)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - v1.27.1, verified via `npm view`
- [MCP TypeScript SDK docs (server.md)](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) - McpServer class, registerTool, registerResource, registerPrompt, Zod integration
- [MCP Specification - Progress](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress) - notifications/progress format, progressToken rules
- [Chrome Native Messaging docs](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) - Host manifest format, OS registration paths, message protocol, size limits
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) - .mcp.json format, scope levels, `claude mcp add` CLI

### Secondary (MEDIUM confidence)
- [MCP Architecture research doc](Research/mcp-architecture.md) - Transport layer details, TypeScript examples
- [FSB Implementation comparison](Research/implementation-comparison.md) - Claude for Chrome native messaging reference architecture
- [MCP Protocol research doc](Research/mcp-protocol.md) - Protocol fundamentals, lifecycle, capability negotiation

### Tertiary (LOW confidence)
- [chrome-native-messaging npm](https://www.npmjs.com/package/chrome-native-messaging) - v0.2.0, Stream-based Node.js utilities (not recommended -- hand-roll instead)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SDK v1.27.1 verified on npm, TypeScript/Zod versions verified, all stable
- Architecture: HIGH - Two-transport bridge is the only viable architecture given stdio constraints. Well documented in MCP spec and Chrome docs
- Tool mapping: HIGH - FSB's CLI_COMMAND_TABLE in ai-integration.js and tools object in content/actions.js provide complete tool inventory
- Native Messaging: HIGH - Chrome docs are authoritative, protocol is simple and stable
- Pitfalls: HIGH - stdin/stdout collision is the #1 risk, well-understood and documented
- Progress notifications: MEDIUM - MCP spec defines the protocol clearly, but SDK high-level API for sending progress from tool handlers is less documented

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days -- MCP SDK v1.x is stable, unlikely to break)
