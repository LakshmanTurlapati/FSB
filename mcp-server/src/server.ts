import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Create and return the FSB MCP server instance.
 * Tool, resource, and prompt registration is handled separately
 * by the modules imported in index.ts.
 */
export function createServer(): McpServer {
  return new McpServer(
    { name: 'fsb-browser-automation', version: '1.0.0' },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
    },
  );
}
