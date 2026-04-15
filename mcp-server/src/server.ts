import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FSB_MCP_VERSION, FSB_SERVER_NAME } from './version.js';

/**
 * Create and return the FSB MCP server instance.
 * Tool, resource, and prompt registration is handled separately
 * by the modules imported in index.ts.
 */
export function createServer(): McpServer {
  return new McpServer(
    { name: FSB_SERVER_NAME, version: FSB_MCP_VERSION },
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
