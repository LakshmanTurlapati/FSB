#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRuntime } from './runtime.js';
import { collectBridgeDiagnostics, getLocalHttpEndpoint, waitForExtensionConnection } from './diagnostics.js';
import { startHttpServer } from './http.js';
import { WebSocketBridge } from './bridge.js';
import { TaskQueue } from './queue.js';
import {
  DEFAULT_HTTP_HOST,
  DEFAULT_HTTP_PORT,
  FSB_EXTENSION_BRIDGE_URL,
  FSB_MCP_VERSION,
} from './version.js';

type FlagValue = boolean | string;

function parseArgs(argv: string[]): { command: string; flags: Record<string, FlagValue> } {
  const flags: Record<string, FlagValue> = {};
  let command = 'stdio';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith('--')) {
      const trimmed = arg.slice(2);
      const [key, inlineValue] = trimmed.split('=', 2);
      if (inlineValue !== undefined) {
        flags[key] = inlineValue;
      } else if (argv[index + 1] && !argv[index + 1].startsWith('-')) {
        flags[key] = argv[index + 1];
        index += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }

    if (arg.startsWith('-')) {
      if (arg === '-h') flags.help = true;
      if (arg === '-j') flags.json = true;
      continue;
    }

    if (command === 'stdio') {
      command = arg;
    }
  }

  if (flags.help === true) {
    command = 'help';
  }

  return { command, flags };
}

function readStringFlag(flags: Record<string, FlagValue>, name: string, fallback: string): string {
  const value = flags[name];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readNumberFlag(flags: Record<string, FlagValue>, name: string, fallback: number): number {
  const value = flags[name];
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function isJson(flags: Record<string, FlagValue>): boolean {
  return flags.json === true;
}

function printHelp(): void {
  console.log(`FSB MCP Server ${FSB_MCP_VERSION}

Usage:
  fsb-mcp-server                     Start the stdio MCP server
  fsb-mcp-server stdio              Start the stdio MCP server
  fsb-mcp-server serve              Start a local Streamable HTTP MCP server
  fsb-mcp-server status             Show bridge and extension status
  fsb-mcp-server doctor             Run install diagnostics with remediation
  fsb-mcp-server setup              Print install snippets for common MCP clients
  fsb-mcp-server wait-for-extension Wait until the extension connects

Options:
  --host <host>       HTTP listen host for \`serve\` (default: ${DEFAULT_HTTP_HOST})
  --port <port>       HTTP listen port for \`serve\` (default: ${DEFAULT_HTTP_PORT})
  --timeout <ms>      Wait timeout for diagnostics / wait-for-extension
  --json              Emit machine-readable JSON for status or doctor
`);
}

function formatStatus(diagnostics: Awaited<ReturnType<typeof collectBridgeDiagnostics>>): string {
  const lines = [
    `FSB MCP status @ ${diagnostics.checkedAt}`,
    `Bridge endpoint: ${diagnostics.bridgeUrl}`,
    `Bridge mode: ${diagnostics.bridgeMode}`,
    `Extension connected: ${diagnostics.extensionConnected ? 'yes' : 'no'}`,
  ];

  if (diagnostics.extensionConfig) {
    const provider = diagnostics.extensionConfig.modelProvider ?? 'unknown';
    const model = diagnostics.extensionConfig.modelName ?? 'unknown';
    lines.push(`Extension model: ${provider} / ${model}`);
  }

  if (diagnostics.tabsSummary) {
    lines.push(`Open tabs: ${diagnostics.tabsSummary.totalTabs}`);
    lines.push(`Active tab ID: ${diagnostics.tabsSummary.activeTabId ?? 'none'}`);
  }

  if (diagnostics.error) {
    lines.push(`Note: ${diagnostics.error}`);
  }

  return `${lines.join('\n')}\n`;
}

function formatDoctor(diagnostics: Awaited<ReturnType<typeof collectBridgeDiagnostics>>): string {
  const lines = [formatStatus(diagnostics).trimEnd(), '', 'Remediation:'];

  if (diagnostics.extensionConnected) {
    lines.push('- The extension bridge is healthy. Your MCP host should be able to use FSB now.');
    lines.push(`- If you prefer HTTP transport, start: npx -y fsb-mcp-server serve`);
  } else if (diagnostics.bridgeMode === 'hub') {
    lines.push('- The MCP bridge is listening, but the extension has not attached yet.');
    lines.push('- Open Chrome/Edge/Brave, ensure the FSB extension is installed and enabled, then retry.');
    lines.push(`- The extension must be able to reach ${FSB_EXTENSION_BRIDGE_URL}.`);
  } else if (diagnostics.bridgeMode === 'relay') {
    lines.push('- Another fsb-mcp-server instance already owns the local bridge port.');
    lines.push('- Keep the other instance running, or stop it if you want this process to become the primary bridge.');
  } else {
    lines.push('- The local bridge could not start.');
    lines.push('- Check for another process using port 7225 or retry once the MCP server package is fully installed.');
  }

  lines.push('');
  lines.push('Install paths:');
  lines.push('- Stdio: npx -y fsb-mcp-server');
  lines.push(`- Streamable HTTP: ${getLocalHttpEndpoint()}`);

  return `${lines.join('\n')}\n`;
}

function buildCursorDeeplink(): string {
  const config = {
    fsb: {
      command: 'npx',
      args: ['-y', 'fsb-mcp-server'],
    },
  };
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=fsb&config=${encodeURIComponent(JSON.stringify(config))}`;
}

function printSetup(): void {
  const windowsCommand = ['cmd', '/c', 'npx', '-y', 'fsb-mcp-server'];
  const stdioCommand = ['npx', '-y', 'fsb-mcp-server'];

  console.log(`FSB MCP install snippets

Stdio command
  macOS / Linux:
    ${stdioCommand.join(' ')}
  Windows:
    ${windowsCommand.join(' ')}

Local HTTP endpoint
  1. Start the server:
    npx -y fsb-mcp-server serve
  2. Use this endpoint in any Streamable HTTP-capable client:
    ${getLocalHttpEndpoint()}

Claude Code
  claude mcp add fsb -- ${stdioCommand.join(' ')}

Claude Desktop
  Add to claude_desktop_config.json:
  {
    "mcpServers": {
      "fsb": {
        "command": "npx",
        "args": ["-y", "fsb-mcp-server"]
      }
    }
  }

Cursor
  Add to .cursor/mcp.json:
  {
    "mcpServers": {
      "fsb": {
        "command": "npx",
        "args": ["-y", "fsb-mcp-server"]
      }
    }
  }
  Install deeplink:
    ${buildCursorDeeplink()}

Windsurf / other MCP hosts
  Use the stdio command above, or point the client to:
    ${getLocalHttpEndpoint()}
`);
}

async function runStdioServer(): Promise<void> {
  const runtime = createRuntime();
  const transport = new StdioServerTransport();
  await runtime.server.connect(transport);

  try {
    await runtime.bridge.connect();
  } catch (err: unknown) {
    console.error('[FSB MCP] WebSocket bridge failed to start (running in disconnected mode):', err);
  }

  console.error(`[FSB MCP] Server started (stdio + WebSocket bridge in ${runtime.bridge.currentMode} mode)`);

  const shutdown = (): void => {
    console.error('[FSB MCP] Shutting down...');
    runtime.bridge.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function runHttpMode(flags: Record<string, FlagValue>): Promise<void> {
  const host = readStringFlag(flags, 'host', DEFAULT_HTTP_HOST);
  const port = readNumberFlag(flags, 'port', DEFAULT_HTTP_PORT);
  const bridge = new WebSocketBridge();
  const queue = new TaskQueue();

  try {
    await bridge.connect();
  } catch (err: unknown) {
    console.error('[FSB MCP] WebSocket bridge failed to start (running in disconnected mode):', err);
  }

  const httpServer = await startHttpServer({ host, port, bridge, queue });

  console.error(`[FSB MCP] Streamable HTTP server started at ${httpServer.endpoint}`);
  console.error(`[FSB MCP] Health endpoint: ${httpServer.healthEndpoint}`);
  console.error(`[FSB MCP] Extension bridge mode: ${bridge.currentMode}`);

  const shutdown = (): void => {
    console.error('[FSB MCP] Shutting down...');
    void httpServer.close().finally(() => {
      bridge.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function runStatus(flags: Record<string, FlagValue>): Promise<void> {
  const diagnostics = await collectBridgeDiagnostics({
    waitForExtensionMs: readNumberFlag(flags, 'timeout', 1500),
    includeConfig: true,
    includeTabs: true,
  });

  if (isJson(flags)) {
    console.log(JSON.stringify(diagnostics, null, 2));
  } else {
    process.stdout.write(formatStatus(diagnostics));
  }
}

async function runDoctor(flags: Record<string, FlagValue>): Promise<void> {
  const diagnostics = await collectBridgeDiagnostics({
    waitForExtensionMs: readNumberFlag(flags, 'timeout', 2500),
    includeConfig: true,
    includeTabs: true,
  });

  if (isJson(flags)) {
    console.log(JSON.stringify(diagnostics, null, 2));
  } else {
    process.stdout.write(formatDoctor(diagnostics));
  }

  process.exitCode = diagnostics.extensionConnected ? 0 : 1;
}

async function runWaitForExtension(flags: Record<string, FlagValue>): Promise<void> {
  const bridge = new WebSocketBridge();
  const timeoutMs = readNumberFlag(flags, 'timeout', 15_000);

  try {
    await bridge.connect();
  } catch (err: unknown) {
    console.error('[FSB MCP] Failed to start bridge while waiting for extension:', err);
    process.exitCode = 1;
    return;
  }

  const connected = await waitForExtensionConnection(bridge, timeoutMs);
  bridge.disconnect();

  if (connected) {
    console.log('FSB extension connected.');
    return;
  }

  console.error(`Timed out waiting for the FSB extension to connect to ${FSB_EXTENSION_BRIDGE_URL}.`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'stdio':
      await runStdioServer();
      return;
    case 'serve':
    case 'http':
      await runHttpMode(flags);
      return;
    case 'status':
      await runStatus(flags);
      return;
    case 'doctor':
      await runDoctor(flags);
      return;
    case 'setup':
      printSetup();
      return;
    case 'wait-for-extension':
      await runWaitForExtension(flags);
      return;
    case 'help':
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err: unknown) => {
  console.error('[FSB MCP] Fatal:', err);
  process.exit(1);
});
