# Model Context Protocol (MCP)

## What is MCP?

The Model Context Protocol (MCP) is an open-source standard developed by Anthropic for connecting AI applications to external data sources and tools. It provides a universal way for AI systems to interact with databases, APIs, file systems, and other services.

Think of MCP as a "USB-C for AI" - a standardized connection that works across different AI applications and service providers.

## Why MCP Matters

### The Problem MCP Solves

Before MCP, every AI application needed custom integrations:
- Each AI app had its own way to connect to tools
- Developers rebuilt similar integrations repeatedly
- No standard for capability negotiation
- Security and permissions handled ad-hoc

### MCP's Solution

- **Universal Standard**: One protocol works across all AI applications
- **Reusable Servers**: Build once, use everywhere
- **Capability Discovery**: Automatic negotiation of features
- **Security Built-in**: Standardized permission model

## Core Architecture

```
+------------------+       +------------------+       +------------------+
|                  |       |                  |       |                  |
|  AI Application  | <---> |   MCP Client     | <---> |   MCP Server     |
|  (Host)          |       |                  |       |                  |
+------------------+       +------------------+       +------------------+
        |                          |                          |
        v                          v                          v
    User Interface            Protocol Layer             External Services
    (Claude, IDE)             (JSON-RPC 2.0)            (APIs, DBs, Files)
```

### Terminology

- **Host**: The AI application (Claude Desktop, VS Code, etc.)
- **Client**: Protocol handler within the host
- **Server**: External service providing capabilities

## Protocol Fundamentals

### JSON-RPC 2.0 Base

MCP uses JSON-RPC 2.0 as its message format:

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_database",
    "arguments": {
      "query": "active users"
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 1,234 active users..."
      }
    ]
  }
}
```

### Lifecycle

1. **Initialization**: Client sends `initialize` with capabilities
2. **Capability Negotiation**: Server responds with its capabilities
3. **Ready**: Client sends `initialized` notification
4. **Operation**: Normal request/response flow
5. **Shutdown**: Clean termination with `shutdown` request

```
Client                                Server
  |                                     |
  |  initialize (capabilities)  ----->  |
  |  <-----  result (capabilities)      |
  |  initialized (notification) ----->  |
  |                                     |
  |  tools/list  ----->                 |
  |  <-----  result (tools)             |
  |                                     |
  |  tools/call  ----->                 |
  |  <-----  result (output)            |
  |                                     |
  |  shutdown  ----->                   |
  |  <-----  result                     |
```

## Core Primitives

MCP defines three core primitives that servers can expose:

### 1. Tools

Functions that the AI can call to perform actions:

```json
{
  "name": "search_files",
  "description": "Search for files matching a pattern",
  "inputSchema": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "description": "Glob pattern to match"
      },
      "directory": {
        "type": "string",
        "description": "Directory to search in"
      }
    },
    "required": ["pattern"]
  }
}
```

**Tool Lifecycle:**
1. Client calls `tools/list` to discover available tools
2. AI decides to use a tool based on the task
3. Client calls `tools/call` with arguments
4. Server executes and returns result

### 2. Resources

Data sources the AI can read from:

```json
{
  "uri": "file:///project/README.md",
  "name": "Project README",
  "description": "Main project documentation",
  "mimeType": "text/markdown"
}
```

**Resource Types:**
- Files and directories
- Database tables/queries
- API responses
- Live data streams

**Resource Methods:**
- `resources/list` - List available resources
- `resources/read` - Read resource content
- `resources/subscribe` - Subscribe to changes

### 3. Prompts

Reusable prompt templates:

```json
{
  "name": "code_review",
  "description": "Review code for best practices",
  "arguments": [
    {
      "name": "language",
      "description": "Programming language",
      "required": true
    },
    {
      "name": "code",
      "description": "Code to review",
      "required": true
    }
  ]
}
```

**Prompt Methods:**
- `prompts/list` - List available prompts
- `prompts/get` - Get prompt with arguments filled

## Client Primitives

Capabilities that clients can expose to servers:

### 1. Sampling

Allow servers to request AI completions:

```json
// Server requests sampling
{
  "method": "sampling/createMessage",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Summarize this data..."
        }
      }
    ],
    "maxTokens": 1000
  }
}
```

### 2. Elicitation

Request structured input from users:

```json
// Server requests user input
{
  "method": "elicitation/create",
  "params": {
    "message": "Select the database to query",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "database": {
          "type": "string",
          "enum": ["production", "staging", "development"]
        }
      }
    }
  }
}
```

### 3. Logging

Structured logging from servers:

```json
{
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "database-server",
    "data": {
      "query": "SELECT * FROM users",
      "duration_ms": 45
    }
  }
}
```

## Capability Negotiation

During initialization, both parties declare their capabilities:

```json
// Client capabilities
{
  "experimental": {},
  "sampling": {
    "supportedModels": ["claude-sonnet-4-20250514"]
  },
  "elicitation": {},
  "roots": {
    "listChanged": true
  }
}

// Server capabilities
{
  "experimental": {},
  "logging": {},
  "prompts": {
    "listChanged": true
  },
  "resources": {
    "subscribe": true,
    "listChanged": true
  },
  "tools": {
    "listChanged": true
  }
}
```

## Error Handling

MCP defines standard error codes:

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | Not valid JSON-RPC |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Server internal error |

## Notifications

Servers can send notifications for state changes:

```json
// Tool list changed
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}

// Resource updated
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "uri": "file:///data/users.json"
  }
}

// Progress update
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "task_123",
    "progress": 50,
    "total": 100
  }
}
```

## Security Considerations

### Permission Model

1. **Capability-based**: Only enabled features are accessible
2. **User Consent**: Sensitive operations require approval
3. **Sandboxing**: Servers run in isolated environments
4. **Audit Logging**: All operations can be logged

### Best Practices

- Validate all input from servers
- Require user confirmation for destructive actions
- Implement rate limiting
- Use TLS for HTTP transport
- Rotate credentials regularly

## MCP vs REST APIs

| Aspect | MCP | REST API |
|--------|-----|----------|
| Discovery | Built-in | External documentation |
| Bidirectional | Yes | Webhooks needed |
| Streaming | Native | Requires SSE/WebSocket |
| Schema | JSON Schema | OpenAPI |
| AI-Optimized | Yes | No |
| State | Session-based | Stateless |

## Implementation Status

### Official SDKs

| Language | Status | Package |
|----------|--------|---------|
| Python | Stable | `mcp` |
| TypeScript | Stable | `@modelcontextprotocol/sdk` |
| Java | Stable | `io.modelcontextprotocol:sdk` |
| Kotlin | Stable | `io.modelcontextprotocol:kotlin-sdk` |
| C# | Stable | `ModelContextProtocol` |
| Go | Community | `github.com/mark3labs/mcp-go` |
| Rust | Community | `mcp-rust-sdk` |

### Compatible Hosts

- Claude Desktop
- Claude Code (CLI)
- VS Code (via extensions)
- JetBrains IDEs
- Cursor
- Zed
- Custom applications

---

*References:*
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [MCP GitHub](https://github.com/modelcontextprotocol)
- [Introduction to MCP](https://modelcontextprotocol.io/introduction)
