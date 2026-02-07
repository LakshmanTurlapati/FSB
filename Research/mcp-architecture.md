# MCP Architecture Deep Dive

## System Architecture

### Component Relationships

```
+-------------------------------------------------------------------------+
|                              HOST APPLICATION                            |
|  (Claude Desktop, IDE, Custom App)                                       |
|                                                                          |
|  +------------------+  +------------------+  +------------------+        |
|  |   MCP Client 1   |  |   MCP Client 2   |  |   MCP Client N   |        |
|  +--------+---------+  +--------+---------+  +--------+---------+        |
+-----------|-------------------|-------------------|------------------+
            |                   |                   |
            v                   v                   v
   +----------------+  +----------------+  +----------------+
   |  MCP Server A  |  |  MCP Server B  |  |  MCP Server C  |
   |  (Database)    |  |  (File System) |  |  (Web APIs)    |
   +----------------+  +----------------+  +----------------+
```

### Host Responsibilities

The host application:
- Creates and manages MCP client instances
- Routes messages between AI and servers
- Handles user interface and consent flows
- Manages server lifecycle (start/stop/restart)
- Aggregates capabilities from multiple servers

### Client Responsibilities

Each MCP client:
- Maintains connection to one MCP server
- Handles protocol-level communication
- Manages capability negotiation
- Processes requests and responses
- Handles reconnection on failure

### Server Responsibilities

Each MCP server:
- Exposes tools, resources, and/or prompts
- Handles incoming requests
- Manages connections to external services
- Reports capability changes
- Implements security controls

## Transport Layer

MCP supports two transport mechanisms:

### 1. STDIO Transport

Standard input/output for local processes:

```
+------------+                +------------+
|            |  stdin         |            |
|   Client   | -------------> |   Server   |
|            |                |  (Process) |
|            | <------------- |            |
|            |  stdout        |            |
+------------+                +------------+
```

**Characteristics:**
- Best for local server processes
- Simple to implement
- No network configuration needed
- One client per server process

**Message Format:**
```
Content-Length: 123\r\n
\r\n
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

**Example Configuration:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"],
      "env": {
        "DEBUG": "mcp:*"
      }
    }
  }
}
```

### 2. HTTP + SSE Transport

HTTP for requests, Server-Sent Events for streaming:

```
+------------+                +------------+
|            |  HTTP POST     |            |
|   Client   | -------------> |   Server   |
|            |                | (HTTP)     |
|            | <------------- |            |
|            |  SSE Stream    |            |
+------------+                +------------+
```

**Characteristics:**
- Works over network
- Multiple clients per server
- Supports load balancing
- More complex setup

**Endpoints:**
- `POST /message` - Send requests
- `GET /sse` - SSE stream for responses and notifications

**Example Configuration:**

```json
{
  "mcpServers": {
    "remote-api": {
      "url": "https://mcp-server.example.com",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

## Data Layer

### Message Types

#### Requests (bidirectional)
```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "method": "tools/call",
  "params": { ... }
}
```

#### Responses
```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "result": { ... }
}
```

#### Notifications (no response expected)
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": { ... }
}
```

### Content Types

MCP supports multiple content types in responses:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Plain text content"
    },
    {
      "type": "image",
      "data": "base64-encoded-data",
      "mimeType": "image/png"
    },
    {
      "type": "resource",
      "resource": {
        "uri": "file:///path/to/file",
        "text": "File contents"
      }
    }
  ]
}
```

## Building MCP Servers

### Python Implementation

```python
# server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Create server instance
server = Server("my-server")

# Define tools
@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="search_files",
            description="Search for files by pattern",
            inputSchema={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern"
                    }
                },
                "required": ["pattern"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "search_files":
        pattern = arguments["pattern"]
        # Perform search...
        results = search_files(pattern)
        return [TextContent(type="text", text=f"Found: {results}")]
    raise ValueError(f"Unknown tool: {name}")

# Define resources
@server.list_resources()
async def list_resources():
    return [
        {
            "uri": "config://app",
            "name": "Application Config",
            "mimeType": "application/json"
        }
    ]

@server.read_resource()
async def read_resource(uri: str):
    if uri == "config://app":
        return json.dumps(load_config())
    raise ValueError(f"Unknown resource: {uri}")

# Run server
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### TypeScript Implementation

```typescript
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "my-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_database",
        description: "Search the database for records",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SQL query to execute",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_database") {
    const results = await executeQuery(args.query);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### Package.json for TypeScript Server

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "my-mcp-server": "./build/server.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node build/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

## Client Integration

### Python Client Example

```python
from mcp import Client
from mcp.client.stdio import stdio_client

async def use_mcp_server():
    async with stdio_client(
        command="python",
        args=["server.py"]
    ) as (read, write):
        async with Client(read, write) as client:
            # Initialize
            await client.initialize()

            # List tools
            tools = await client.list_tools()
            print(f"Available tools: {[t.name for t in tools]}")

            # Call a tool
            result = await client.call_tool(
                "search_files",
                {"pattern": "*.py"}
            )
            print(f"Result: {result}")
```

### TypeScript Client Example

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function useMCPServer() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["server.js"],
  });

  const client = new Client({
    name: "my-client",
    version: "1.0.0",
  });

  await client.connect(transport);

  // List available tools
  const { tools } = await client.listTools();
  console.log("Tools:", tools.map((t) => t.name));

  // Call a tool
  const result = await client.callTool("search_database", {
    query: "SELECT * FROM users LIMIT 10",
  });
  console.log("Result:", result);

  await client.close();
}
```

## Configuration Examples

### Claude Desktop Configuration

Location: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/db"
      }
    }
  }
}
```

### Claude Code Configuration

Location: `~/.claude/settings.json`

```json
{
  "mcpServers": {
    "browser-tools": {
      "command": "node",
      "args": ["/path/to/browser-mcp-server.js"],
      "capabilities": ["tools"]
    }
  }
}
```

## Error Handling

### Server-Side Error Handling

```python
@server.call_tool()
async def call_tool(name: str, arguments: dict):
    try:
        if name == "risky_operation":
            result = await perform_risky_operation(arguments)
            return [TextContent(type="text", text=result)]
    except PermissionError as e:
        raise McpError(
            ErrorCode.InvalidRequest,
            f"Permission denied: {e}"
        )
    except ValueError as e:
        raise McpError(
            ErrorCode.InvalidParams,
            f"Invalid parameters: {e}"
        )
    except Exception as e:
        raise McpError(
            ErrorCode.InternalError,
            f"Internal error: {e}"
        )
```

### Client-Side Error Handling

```typescript
try {
  const result = await client.callTool("dangerous_tool", { param: "value" });
} catch (error) {
  if (error.code === -32602) {
    console.error("Invalid parameters:", error.message);
  } else if (error.code === -32603) {
    console.error("Server error:", error.message);
  } else {
    console.error("Unknown error:", error);
  }
}
```

## Performance Considerations

### Connection Pooling

For HTTP transport, implement connection pooling:

```typescript
const pool = new ConnectionPool({
  maxConnections: 10,
  idleTimeout: 30000,
});

async function callTool(name: string, args: object) {
  const connection = await pool.acquire();
  try {
    return await connection.callTool(name, args);
  } finally {
    pool.release(connection);
  }
}
```

### Caching

Cache tool results when appropriate:

```python
from functools import lru_cache
from datetime import datetime, timedelta

cache = {}
CACHE_TTL = timedelta(minutes=5)

async def cached_tool_call(name: str, arguments: dict):
    key = (name, json.dumps(arguments, sort_keys=True))

    if key in cache:
        result, timestamp = cache[key]
        if datetime.now() - timestamp < CACHE_TTL:
            return result

    result = await actual_tool_call(name, arguments)
    cache[key] = (result, datetime.now())
    return result
```

### Batching

Batch multiple operations when possible:

```typescript
// Instead of multiple calls
const results = await Promise.all([
  client.readResource("file:///a.txt"),
  client.readResource("file:///b.txt"),
  client.readResource("file:///c.txt"),
]);

// Use batch endpoint if available
const results = await client.batchReadResources([
  "file:///a.txt",
  "file:///b.txt",
  "file:///c.txt",
]);
```

## Testing MCP Servers

### Unit Testing

```python
import pytest
from my_server import server

@pytest.mark.asyncio
async def test_list_tools():
    tools = await server.list_tools()
    assert len(tools) > 0
    assert any(t.name == "search_files" for t in tools)

@pytest.mark.asyncio
async def test_call_tool():
    result = await server.call_tool("search_files", {"pattern": "*.py"})
    assert result is not None
    assert len(result) > 0
```

### Integration Testing

```typescript
import { spawn } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

describe("MCP Server Integration", () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["build/server.js"],
    });
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("should list tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should execute tool", async () => {
    const result = await client.callTool("search_files", { pattern: "*.ts" });
    expect(result.content).toBeDefined();
  });
});
```

---

*References:*
- [MCP Server Development](https://modelcontextprotocol.io/docs/concepts/servers)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
