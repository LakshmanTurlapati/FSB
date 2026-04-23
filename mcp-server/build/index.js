#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRuntime } from './runtime.js';
import { collectBridgeDiagnostics, formatDiagnosticLayerLabel, getLocalHttpEndpoint, waitForExtensionConnection, watchBridgeDiagnostics, } from './diagnostics.js';
import { startHttpServer } from './http.js';
import { WebSocketBridge } from './bridge.js';
import { TaskQueue } from './queue.js';
import { DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT, FSB_EXTENSION_BRIDGE_URL, FSB_MCP_VERSION, } from './version.js';
import { runInstall, runUninstall } from './install.js';
function parseArgs(argv) {
    const flags = {};
    let command = 'stdio';
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg.startsWith('--')) {
            const trimmed = arg.slice(2);
            const [key, inlineValue] = trimmed.split('=', 2);
            if (inlineValue !== undefined) {
                flags[key] = inlineValue;
            }
            else if (argv[index + 1] && !argv[index + 1].startsWith('-')) {
                flags[key] = argv[index + 1];
                index += 1;
            }
            else {
                flags[key] = true;
            }
            continue;
        }
        if (arg.startsWith('-')) {
            if (arg === '-h')
                flags.help = true;
            if (arg === '-j')
                flags.json = true;
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
function readStringFlag(flags, name, fallback) {
    const value = flags[name];
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}
function readNumberFlag(flags, name, fallback) {
    const value = flags[name];
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return fallback;
}
function isJson(flags) {
    return flags.json === true;
}
function printHelp() {
    console.log(`FSB MCP Server ${FSB_MCP_VERSION}

Usage:
  fsb-mcp-server                     Start the stdio MCP server
  fsb-mcp-server stdio              Start the stdio MCP server
  fsb-mcp-server serve              Start a local Streamable HTTP MCP server
  fsb-mcp-server status             Show bridge and extension status
  fsb-mcp-server doctor             Diagnose the primary MCP failure layer
  fsb-mcp-server setup              Print install snippets for common MCP clients
  fsb-mcp-server wait-for-extension Wait until the extension connects
  fsb-mcp-server install             Install FSB to an MCP client config
  fsb-mcp-server uninstall           Remove FSB from an MCP client config

Options:
  --host <host>       HTTP listen host for \`serve\` (default: ${DEFAULT_HTTP_HOST})
  --port <port>       HTTP listen port for \`serve\` (default: ${DEFAULT_HTTP_PORT})
  --timeout <ms>      Wait timeout for diagnostics / wait-for-extension
  --watch             Continuously refresh \`status\`
  --interval <ms>     Poll interval for \`status --watch\` (default: 1000)
  --json              Emit machine-readable JSON for status or doctor
`);
}
export function formatHeartbeat(lastHeartbeatAt, nowMs = Date.now()) {
    if (lastHeartbeatAt === null)
        return 'none';
    const ageMs = Math.max(0, nowMs - lastHeartbeatAt);
    if (ageMs > 10_000)
        return 'stale';
    return `${(ageMs / 1000).toFixed(ageMs >= 5_000 ? 0 : 1)}s`;
}
export function buildCompactStatusFields(diagnostics, nowMs = Date.now()) {
    return [
        ['Mode', diagnostics.bridgeMode],
        ['Ext', diagnostics.extensionConnected ? 'yes' : 'no'],
        ['Heartbeat', formatHeartbeat(diagnostics.lastExtensionHeartbeatAt, nowMs)],
        ['Hub', diagnostics.hubConnected ? 'yes' : 'no'],
        ['Relays', String(diagnostics.relayCount)],
        ['Disconnect', diagnostics.lastDisconnectReason ?? 'none'],
        ['Layer', diagnostics.diagnosticLayer],
    ];
}
function formatFieldLines(fields) {
    return fields.map(([label, value]) => `${label}: ${value}`);
}
function formatFieldRow(fields) {
    return fields.map(([label, value]) => `${label}: ${value}`).join(' | ');
}
export function formatStatus(diagnostics) {
    const lines = [
        `FSB MCP status @ ${diagnostics.checkedAt}`,
        `Bridge endpoint: ${diagnostics.bridgeUrl}`,
        ...formatFieldLines(buildCompactStatusFields(diagnostics)),
        `Detected: ${formatDiagnosticLayerLabel(diagnostics.diagnosticLayer)}`,
        `Why: ${diagnostics.diagnosticWhy}`,
        `Next action: ${diagnostics.nextAction}`,
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
    if (diagnostics.activeTab.url) {
        lines.push(`Active page: ${diagnostics.activeTab.pageType} (${diagnostics.activeTab.url})`);
    }
    lines.push(`Content script: ${diagnostics.contentScript.ready ? 'ready' : 'not ready'} (${diagnostics.contentScript.readinessSource ?? 'none'})`);
    for (const note of diagnostics.probeNotes ?? []) {
        lines.push(`Note: [${note.scope}] ${note.message}`);
    }
    return `${lines.join('\n')}\n`;
}
export function formatWatchSnapshot(diagnostics) {
    const lines = [
        `FSB MCP status watch @ ${diagnostics.checkedAt}`,
        formatFieldRow(buildCompactStatusFields(diagnostics)),
    ];
    if (diagnostics.activeTab.url) {
        lines.push(`Active page: ${diagnostics.activeTab.pageType} (${diagnostics.activeTab.url})`);
    }
    if (diagnostics.probeNotes && diagnostics.probeNotes.length > 0) {
        lines.push(`Note: ${diagnostics.probeNotes[0].message}`);
    }
    return `${lines.join('\n')}\n`;
}
export function formatDoctor(diagnostics) {
    const lines = [
        `FSB MCP doctor @ ${diagnostics.checkedAt}`,
        `Detected: ${formatDiagnosticLayerLabel(diagnostics.diagnosticLayer)}`,
        `Why: ${diagnostics.diagnosticWhy}`,
        `Next action: ${diagnostics.nextAction}`,
        ...formatFieldLines(buildCompactStatusFields(diagnostics)),
    ];
    if (diagnostics.activeTab.url) {
        lines.push(`Active page: ${diagnostics.activeTab.pageType} (${diagnostics.activeTab.url})`);
    }
    for (const note of diagnostics.probeNotes ?? []) {
        lines.push(`Note: [${note.scope}] ${note.message}`);
    }
    lines.push('');
    lines.push('Install paths:');
    lines.push('- Stdio: npx -y fsb-mcp-server');
    lines.push(`- Streamable HTTP: ${getLocalHttpEndpoint()}`);
    return `${lines.join('\n')}\n`;
}
function buildCursorDeeplink() {
    const config = {
        fsb: {
            command: 'npx',
            args: ['-y', 'fsb-mcp-server'],
        },
    };
    return `cursor://anysphere.cursor-deeplink/mcp/install?name=fsb&config=${encodeURIComponent(JSON.stringify(config))}`;
}
function printSetup() {
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
async function runStdioServer() {
    const runtime = createRuntime();
    const transport = new StdioServerTransport();
    await runtime.server.connect(transport);
    try {
        await runtime.bridge.connect();
    }
    catch (err) {
        console.error('[FSB MCP] WebSocket bridge failed to start (running in disconnected mode):', err);
    }
    console.error(`[FSB MCP] Server started (stdio + WebSocket bridge in ${runtime.bridge.currentMode} mode)`);
    const shutdown = () => {
        console.error('[FSB MCP] Shutting down...');
        runtime.bridge.disconnect();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
async function runHttpMode(flags) {
    const host = readStringFlag(flags, 'host', DEFAULT_HTTP_HOST);
    const port = readNumberFlag(flags, 'port', DEFAULT_HTTP_PORT);
    const bridge = new WebSocketBridge();
    const queue = new TaskQueue();
    try {
        await bridge.connect();
    }
    catch (err) {
        console.error('[FSB MCP] WebSocket bridge failed to start (running in disconnected mode):', err);
    }
    const httpServer = await startHttpServer({ host, port, bridge, queue });
    console.error(`[FSB MCP] Streamable HTTP server started at ${httpServer.endpoint}`);
    console.error(`[FSB MCP] Health endpoint: ${httpServer.healthEndpoint}`);
    console.error(`[FSB MCP] Extension bridge mode: ${bridge.currentMode}`);
    const shutdown = () => {
        console.error('[FSB MCP] Shutting down...');
        void httpServer.close().finally(() => {
            bridge.disconnect();
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
async function runStatus(flags) {
    const waitForExtensionMs = readNumberFlag(flags, 'timeout', 1500);
    const intervalMs = readNumberFlag(flags, 'interval', 1000);
    if (flags.watch === true) {
        await watchBridgeDiagnostics({
            intervalMs,
            waitForExtensionMs,
            includeConfig: true,
            includeTabs: true,
            onUpdate: (diagnostics) => {
                if (isJson(flags)) {
                    process.stdout.write(`${JSON.stringify(diagnostics)}\n`);
                    return;
                }
                if (process.stdout.isTTY) {
                    process.stdout.write('\x1Bc');
                }
                process.stdout.write(formatWatchSnapshot(diagnostics));
            },
        });
        return;
    }
    const diagnostics = await collectBridgeDiagnostics({
        waitForExtensionMs,
        includeConfig: true,
        includeTabs: true,
    });
    if (isJson(flags)) {
        console.log(JSON.stringify(diagnostics, null, 2));
        return;
    }
    process.stdout.write(formatStatus(diagnostics));
}
async function runDoctor(flags) {
    const diagnostics = await collectBridgeDiagnostics({
        waitForExtensionMs: readNumberFlag(flags, 'timeout', 2500),
        includeConfig: true,
        includeTabs: true,
    });
    if (isJson(flags)) {
        console.log(JSON.stringify(diagnostics, null, 2));
    }
    else {
        process.stdout.write(formatDoctor(diagnostics));
    }
    process.exitCode = diagnostics.diagnosticLayer === 'healthy' ? 0 : 1;
}
async function runWaitForExtension(flags) {
    const bridge = new WebSocketBridge();
    const timeoutMs = readNumberFlag(flags, 'timeout', 15_000);
    try {
        await bridge.connect();
    }
    catch (err) {
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
async function main() {
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
        case 'install':
            await runInstall(flags);
            return;
        case 'uninstall':
            await runUninstall(flags);
            return;
        default:
            throw new Error(`Unknown command: ${command}`);
    }
}
function isExecutedDirectly() {
    const entry = process.argv[1];
    return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}
if (isExecutedDirectly()) {
    main().catch((err) => {
        console.error('[FSB MCP] Fatal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map