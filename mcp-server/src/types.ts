// Messages FROM MCP server TO extension (via WebSocket bridge)
export interface MCPMessage {
  id: string;          // Unique message ID for request/response correlation
  type: MCPMessageType;
  payload: Record<string, unknown>;
}

export type MCPMessageType =
  | 'mcp:start-automation'    // Autopilot: run a task
  | 'mcp:stop-automation'     // Cancel running task
  | 'mcp:get-status'          // Query task status
  | 'mcp:execute-action'      // Manual: execute a single browser action
  | 'mcp:get-dom'             // Read DOM snapshot
  | 'mcp:get-tabs'            // List open tabs
  | 'mcp:get-site-guides'     // Read site guide data
  | 'mcp:get-memory'          // Read memory system
  | 'mcp:get-config'          // Read extension config (keys redacted)
  | 'mcp:read-page'           // Read page text content
  | 'mcp:list-sessions'       // List all past session summaries
  | 'mcp:get-session'         // Get full session detail by ID
  | 'mcp:get-logs'            // Get recent logs or session-specific logs
  | 'mcp:search-memory';      // Search memories with query and filters

// Messages FROM extension TO MCP server (responses)
export interface MCPResponse {
  id: string;          // Matches the request MCPMessage.id
  type: 'mcp:result' | 'mcp:progress' | 'mcp:error';
  payload: Record<string, unknown>;
}

// Progress notification during autopilot tasks
export interface MCPProgress {
  id: string;
  type: 'mcp:progress';
  payload: {
    taskId: string;
    progress: number;    // 0-100
    phase: string;
    eta?: string;
    action?: string;     // Current action summary
  };
}

// Relay protocol: MCP instance -> hub handshake
export interface RelayHello {
  type: 'relay:hello';
  instanceId: string;
}

// Relay protocol: hub -> MCP instance handshake ack
export interface RelayWelcome {
  type: 'relay:welcome';
  instanceId: string;
}

export type RelayMessage = RelayHello | RelayWelcome;

// Tool result wrapper
export interface ToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}
