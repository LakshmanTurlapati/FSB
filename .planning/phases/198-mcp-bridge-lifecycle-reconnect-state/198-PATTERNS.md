# Phase 198: MCP Bridge Lifecycle & Reconnect State - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ws/mcp-bridge-client.js` | service / client | event-driven, request-response, streaming keepalive | `ws/mcp-bridge-client.js` | exact |
| `background.js` | service-worker controller | event-driven, request-response, storage, alarms | `background.js` | exact |
| `mcp-server/src/bridge.ts` | service | event-driven, request-response, hub/relay routing | `mcp-server/src/bridge.ts` | exact |
| `mcp-server/src/diagnostics.ts` | utility / service | request-response, status probing | `mcp-server/src/diagnostics.ts` | exact |
| `mcp-server/src/http.ts` | service / transport | request-response, HTTP health/status shape | `mcp-server/src/http.ts` | exact |
| `mcp-server/src/index.ts` | CLI controller | command dispatch, human/status output | `mcp-server/src/index.ts` | exact |
| `mcp-server/src/types.ts` | model / contract | request-response, event-driven contracts | `mcp-server/src/types.ts` | exact |
| `tests/mcp-bridge-client-lifecycle.test.js` | test | event-driven, mock file/browser I/O | `tests/secure-config-credential-vault.test.js` + `tests/test-agent-scheduler-cron.js` | role-match |
| `tests/mcp-bridge-topology.test.js` | test | event-driven, request-response, network I/O | `tests/mcp-restricted-tab.test.js` + `mcp-server/src/bridge.ts` | role-match |
| `package.json` | config | batch test command | `package.json` + `mcp-server/package.json` | exact |

## Pattern Assignments

### `ws/mcp-bridge-client.js` (service/client, event-driven request-response)

**Analog:** `ws/mcp-bridge-client.js`

**Constants and singleton pattern** (lines 12-25, 764-765):

```javascript
const MCP_BRIDGE_URL = 'ws://localhost:7225';
const MCP_RECONNECT_BASE_MS = 2000;
const MCP_RECONNECT_MAX_MS = 30000;
const MCP_PING_INTERVAL_MS = 25000;

class MCPBridgeClient {
  constructor() {
    this._ws = null;
    this._reconnectDelay = MCP_RECONNECT_BASE_MS;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._intentionalClose = false;
    this._connected = false;
  }
}

// Global instance
const mcpBridgeClient = new MCPBridgeClient();
```

**Idempotent connect and reconnect pattern** (lines 27-68, 95-107):

```javascript
/**
 * Start the connection. Safe to call multiple times.
 */
connect() {
  if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  this._intentionalClose = false;

  try {
    this._ws = new WebSocket(MCP_BRIDGE_URL);
  } catch (err) {
    console.log('[FSB MCP Bridge] WebSocket construction failed:', err.message);
    this._scheduleReconnect();
    return;
  }

  this._ws.onopen = () => {
    console.log('[FSB MCP Bridge] Connected to local MCP bridge');
    this._connected = true;
    this._reconnectDelay = MCP_RECONNECT_BASE_MS;
    this._startPing();
  };

  this._ws.onclose = () => {
    console.log('[FSB MCP Bridge] Disconnected from local MCP bridge');
    this._connected = false;
    this._stopPing();
    if (!this._intentionalClose) {
      this._scheduleReconnect();
    }
  };
}

_scheduleReconnect() {
  if (this._intentionalClose) return;
  if (this._reconnectTimer) return;

  const jitter = Math.random() * 500;
  const delay = Math.min(this._reconnectDelay + jitter, MCP_RECONNECT_MAX_MS);

  this._reconnectTimer = setTimeout(() => {
    this._reconnectTimer = null;
    this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, MCP_RECONNECT_MAX_MS);
    this.connect();
  }, delay);
}
```

**Keepalive and send/result pattern** (lines 113-149):

```javascript
_startPing() {
  this._stopPing();
  this._pingTimer = setInterval(() => {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'mcp:ping', ts: Date.now() }));
    }
  }, MCP_PING_INTERVAL_MS);
}

_send(data) {
  if (this._ws && this._ws.readyState === WebSocket.OPEN) {
    this._ws.send(typeof data === 'string' ? data : JSON.stringify(data));
  }
}

_sendResult(id, payload) {
  this._send({ id, type: 'mcp:result', payload });
}

_sendError(id, error) {
  this._send({ id, type: 'mcp:error', payload: { success: false, error } });
}
```

**Message routing and error handling pattern** (lines 151-171, 177-260):

```javascript
async _handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  // Ignore pong responses
  if (msg.type === 'mcp:pong') return;

  const { id, type, payload } = msg;
  if (!id || !type) return;

  try {
    const result = await this._routeMessage(type, payload || {}, id);
    this._sendResult(id, { success: true, ...result });
  } catch (err) {
    this._sendError(id, err.message || 'Unknown error');
  }
}

async _routeMessage(type, payload, id) {
  switch (type) {
    case 'mcp:get-tabs':
      return this._handleGetTabs();
    case 'mcp:get-dom':
      return this._handleGetDOM(payload);
    case 'mcp:execute-action':
      return this._handleExecuteAction(payload);
    default:
      throw new Error('Unknown MCP message type: ' + type);
  }
}
```

**Planner notes:**
- Keep `connect()` safe to call repeatedly; new `armMcpBridge(reason)` should delegate to it and preserve the idempotence guard.
- Persist only concise lifecycle state. Avoid storing sockets, timers, or pending handler closures.
- Add alarm-backed scheduling beside the existing short in-memory timer; do not replace the immediate retry behavior while the service worker is alive.

---

### `background.js` (service-worker controller, wake/storage/alarm)

**Analog:** `background.js`

**Import pattern for service-worker modules** (lines 3-24):

```javascript
// Import configuration and AI integration modules
importScripts('config/config.js');
importScripts('config/init-config.js');
importScripts('config/secure-config.js');
importScripts('ai/cli-parser.js');
importScripts('ai/ai-integration.js');
importScripts('ai/tool-definitions.js');
importScripts('utils/automation-logger.js');
importScripts('utils/analytics.js');

// MCP bridge client for local MCP server connection
try { importScripts('ws/mcp-bridge-client.js'); } catch (e) { console.error('[FSB] Failed to load mcp-bridge-client.js:', e.message); }
```

**Storage helper pattern** (lines 505-528):

```javascript
/**
 * Wrapper for chrome.storage.local.get() with timeout to prevent indefinite hanging
 * @param {Array|Object|string} keys - Storage keys to retrieve
 * @param {number} timeout - Timeout in milliseconds (default 3000)
 * @param {Object} defaults - Default values if storage read fails or times out
 * @returns {Promise<Object>} Storage data or defaults
 */
async function getStorageWithTimeout(keys, timeout = 3000, defaults = {}) {
  try {
    const storagePromise = chrome.storage.local.get(keys);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Storage read timeout')), timeout)
    );

    const result = await Promise.race([storagePromise, timeoutPromise]);
    return result;
  } catch (error) {
    automationLogger.warn('Storage read failed or timed out, using defaults', {
      error: error.message,
      keys
    });
    return defaults;
  }
}
```

**Session storage survival pattern** (lines 1182-1216):

```javascript
/**
 * Persist conversationSessions Map to chrome.storage.session for service worker restart survival.
 */
async function persistConversationSessions() {
  try {
    await chrome.storage.session.set({
      fsbConversationSessions: Object.fromEntries(conversationSessions)
    });
    automationLogger.debug('Conversation sessions persisted', { count: conversationSessions.size });
  } catch (error) {
    automationLogger.warn('Failed to persist conversation sessions', { error: error.message });
  }
}

/**
 * Restore conversationSessions Map from chrome.storage.session after service worker restart.
 * Validates that referenced sessions still exist in activeSessions.
 */
async function restoreConversationSessions() {
  try {
    const stored = await chrome.storage.session.get('fsbConversationSessions');
    const data = stored?.fsbConversationSessions;
    if (data && typeof data === 'object') {
      for (const [convId, entry] of Object.entries(data)) {
        if (entry?.sessionId && activeSessions.has(entry.sessionId)) {
          conversationSessions.set(convId, entry);
        }
      }
      automationLogger.debug('Conversation sessions restored', { count: conversationSessions.size });
    }
  } catch (error) {
    automationLogger.warn('Failed to restore conversation sessions', { error: error.message });
  }
}
```

**Wake handlers that should call `armMcpBridge(reason)`** (lines 1457-1515, 4081-4094, 11566-11568, 11632-11681):

```javascript
chrome.runtime.onConnect.addListener((port) => {
  debugLog('[FSB Background] onConnect received, port name:', port.name);
  if (port.name === 'content-script') {
    const tabId = port.sender?.tab?.id;
    const frameId = port.sender?.frameId;
    // ...
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // Main frame only
  // ...
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Security: Only accept messages from our own extension contexts
  if (sender.id !== chrome.runtime.id) {
    console.warn('[FSB] Rejected message from unknown sender:', sender.id);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return;
  }

  automationLogger.logComm(null, 'receive', request.action || 'unknown', true, { tabId: sender.tab?.id });

  switch (request.action) {
    case 'startAutomation':
      handleStartAutomation(request, sender, sendResponse);
      return true; // Will respond asynchronously
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const agentId = agentScheduler.getAgentIdFromAlarm(alarm.name);
  if (!agentId) return; // Not an FSB agent alarm
});

chrome.runtime.onInstalled.addListener(async () => {
  // Connect to local MCP bridge (auto-reconnects if server not running yet)
  mcpBridgeClient.connect();
});

chrome.runtime.onStartup.addListener(async () => {
  // Connect to local MCP bridge (auto-reconnects if server not running yet)
  mcpBridgeClient.connect();
});
```

**Planner notes:**
- Add one top-level `armMcpBridge(reason)` function after the bridge import is available.
- Call it from service-worker evaluation, `onInstalled`, `onStartup`, `onMessage`, `onConnect`, `webNavigation.onCommitted`, and `chrome.alarms.onAlarm`.
- Preserve existing `onMessage` auth behavior and async `return true` cases.
- In `onAlarm`, branch on the MCP reconnect alarm before the agent-scheduler early return, or the MCP alarm will be ignored as "not an FSB agent alarm."

---

### `mcp-server/src/bridge.ts` (service, hub/relay request routing)

**Analog:** `mcp-server/src/bridge.ts`

**Imports and state pattern** (lines 1-45):

```typescript
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { WebSocketServer, type WebSocket as WsWebSocket } from 'ws';
import type { MCPMessage, MCPResponse, RelayHello, RelayWelcome } from './types.js';
import { FSB_ERROR_MESSAGES } from './errors.js';

const PORT = 7225;
const HANDSHAKE_TIMEOUT_MS = 2_000;
const PROMOTION_JITTER_MS = 500; // max random delay before attempting promotion

interface PendingRequest {
  resolve: (value: MCPResponse) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

type BridgeMode = 'hub' | 'relay' | 'disconnected';

export class WebSocketBridge {
  // Identity
  private instanceId: string;
  private mode: BridgeMode = 'disconnected';

  // Hub mode state
  private wss: WebSocketServer | null = null;
  private extensionClient: WsWebSocket | null = null;
  private relayClients = new Map<string, WsWebSocket>();
  private messageOrigin = new Map<string, string>(); // msgId -> instanceId | "local"
  private handshakeTimers = new Map<WsWebSocket, ReturnType<typeof setTimeout>>();

  // Relay mode state
  private hubConnection: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 0;
  private maxReconnectDelay = 30_000;
  private intentionalClose = false;

  // Shared state
  private pendingRequests = new Map<string, PendingRequest>();
  private progressListeners = new Map<string, (progress: MCPResponse) => void>();
  private msgIdCounter = 0;
  private connected = false;

  constructor() {
    this.instanceId = randomBytes(4).toString('hex');
  }
}
```

**Hub-or-relay startup pattern** (lines 52-67, 194-211, 463-499):

```typescript
async connect(): Promise<void> {
  try {
    await this._startAsHub();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(`[FSB Bridge ${this.instanceId}] Port ${PORT} in use, connecting as relay client`);
      await this._startAsRelay();
    } else {
      throw err;
    }
  }
}

private _startAsHub(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    this.wss = new WebSocketServer({ port: PORT });

    this.wss.on('listening', () => {
      this.mode = 'hub';
      console.error(`[FSB Bridge ${this.instanceId}] Hub mode: WebSocket server listening on port ${PORT}`);
      resolve();
    });

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    this.wss.on('connection', (ws: WsWebSocket) => {
      this._handleNewConnection(ws);
    });
  });
}

private _startAsRelay(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    this.intentionalClose = false;
    this.mode = 'relay';

    try {
      this.hubConnection = new WebSocket(`ws://localhost:${PORT}`);
    } catch (err) {
      reject(err);
      return;
    }

    this.hubConnection.on('open', () => {
      const hello: RelayHello = { type: 'relay:hello', instanceId: this.instanceId };
      this.hubConnection!.send(JSON.stringify(hello));
      console.error(`[FSB Bridge ${this.instanceId}] Relay mode: connected to hub, sent hello`);
    });

    this.hubConnection.on('message', (data: Buffer | string) => {
      const raw = typeof data === 'string' ? data : data.toString();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error(`[FSB Bridge ${this.instanceId}] Failed to parse hub message`);
        return;
      }

      if (parsed.type === 'relay:welcome') {
        this.connected = true;
        this.reconnectDelay = 0;
        console.error(`[FSB Bridge ${this.instanceId}] Relay mode: handshake complete, ready`);
        resolve();
        return;
      }
    });
  });
}
```

**Connection classification pattern** (lines 214-273, 284-343):

```typescript
/**
 * When a new WebSocket connection arrives, wait for a relay:hello handshake.
 * If it arrives, this is a relay client. If not within HANDSHAKE_TIMEOUT_MS,
 * treat it as the Chrome extension.
 */
private _handleNewConnection(ws: WsWebSocket): void {
  let identified = false;
  const buffered: string[] = [];

  const onMessage = (data: Buffer | string): void => {
    const raw = typeof data === 'string' ? data : data.toString();

    if (!identified) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'relay:hello' && parsed.instanceId) {
          identified = true;
          clearTimeout(handshakeTimer);
          this.handshakeTimers.delete(ws);
          this._registerRelayClient(ws, parsed as RelayHello);
          return;
        }
      } catch {
        // Not valid JSON or not a relay hello -- treat as extension
      }

      identified = true;
      clearTimeout(handshakeTimer);
      this.handshakeTimers.delete(ws);
      this._registerExtensionClient(ws);
      this._handleExtensionMessage(raw);
      return;
    }

    buffered.push(raw);
  };

  ws.on('message', onMessage);

  const handshakeTimer = setTimeout(() => {
    if (!identified) {
      identified = true;
      this.handshakeTimers.delete(ws);
      this._registerExtensionClient(ws);
      for (const raw of buffered) {
        this._handleExtensionMessage(raw);
      }
    }
  }, HANDSHAKE_TIMEOUT_MS);

  this.handshakeTimers.set(ws, handshakeTimer);
}

private _registerExtensionClient(ws: WsWebSocket): void {
  if (this.extensionClient) {
    console.error(`[FSB Bridge ${this.instanceId}] New extension connected, closing previous`);
    this.extensionClient.close();
  }

  this.extensionClient = ws;
  this.connected = true;
  console.error(`[FSB Bridge ${this.instanceId}] Extension connected`);
}

private _registerRelayClient(ws: WsWebSocket, hello: RelayHello): void {
  const clientId = hello.instanceId;
  this.relayClients.set(clientId, ws);
  console.error(`[FSB Bridge ${this.instanceId}] Relay client ${clientId} registered (total: ${this.relayClients.size})`);

  const welcome: RelayWelcome = { type: 'relay:welcome', instanceId: clientId };
  ws.send(JSON.stringify(welcome));
}
```

**Request routing and response origin pattern** (lines 125-173, 372-457):

```typescript
async sendAndWait(
  msg: Omit<MCPMessage, 'id'>,
  options?: { timeout?: number; onProgress?: (p: MCPResponse) => void },
): Promise<Record<string, unknown>> {
  if (!this.connected) {
    console.error(`[FSB Bridge ${this.instanceId}] sendAndWait: NOT CONNECTED (mode=${this.mode})`);
    throw new Error(FSB_ERROR_MESSAGES['extension_not_connected']);
  }

  const id = this.generateId();
  const fullMsg: MCPMessage = { id, ...msg };
  const timeoutMs = options?.timeout ?? 30_000;

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => {
      this.pendingRequests.delete(id);
      this.progressListeners.delete(id);
      if (this.mode === 'hub') this.messageOrigin.delete(id);
      reject(new Error(`Request ${id} (${msg.type}) timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    this.pendingRequests.set(id, {
      resolve: (resp: MCPResponse) => {
        resolve(resp.payload);
      },
      reject,
      timeout: timer,
    });

    if (this.mode === 'hub') {
      this.messageOrigin.set(id, 'local');
      this.extensionClient!.send(JSON.stringify(fullMsg));
    } else if (this.mode === 'relay') {
      this.hubConnection!.send(JSON.stringify(fullMsg));
    }
  });
}

private _handleExtensionMessage(raw: string): void {
  let resp: MCPResponse;
  try {
    resp = JSON.parse(raw) as MCPResponse;
  } catch {
    console.error(`[FSB Bridge ${this.instanceId}] Failed to parse extension message`);
    return;
  }

  const origin = this.messageOrigin.get(resp.id);

  if (origin === 'local' || !origin) {
    const pending = this.pendingRequests.get(resp.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(resp.id);
      this.progressListeners.delete(resp.id);
      this.messageOrigin.delete(resp.id);
      pending.resolve(resp);
    }
  } else {
    const relayWs = this.relayClients.get(origin);
    if (relayWs) {
      relayWs.send(raw);
    }
    this.messageOrigin.delete(resp.id);
  }
}

private _handleRelayClientMessage(clientId: string, raw: string): void {
  let msg: MCPMessage;
  try {
    msg = JSON.parse(raw) as MCPMessage;
  } catch {
    console.error(`[FSB Bridge ${this.instanceId}] Failed to parse relay client message`);
    return;
  }

  if (!this.extensionClient) {
    const errorResp: MCPResponse = {
      id: msg.id,
      type: 'mcp:error',
      payload: { success: false, error: 'extension_not_connected' },
    };
    const relayWs = this.relayClients.get(clientId);
    if (relayWs) relayWs.send(JSON.stringify(errorResp));
    return;
  }

  this.messageOrigin.set(msg.id, clientId);
  this.extensionClient.send(raw);
}
```

**Promotion/reconnect pattern** (lines 505-607):

```typescript
this.hubConnection.on('close', () => {
  const wasConnected = this.connected;
  this.connected = false;
  console.error(`[FSB Bridge ${this.instanceId}] Relay mode: disconnected from hub`);

  for (const [id, pending] of this.pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Lost connection to hub'));
    this.pendingRequests.delete(id);
  }
  this.progressListeners.clear();

  if (!this.intentionalClose) {
    this._attemptPromotion();
  }
});

private async _attemptPromotion(): Promise<void> {
  if (this.intentionalClose) return;

  const jitter = Math.floor(Math.random() * PROMOTION_JITTER_MS);
  console.error(`[FSB Bridge ${this.instanceId}] Attempting promotion in ${jitter}ms`);

  await new Promise(r => setTimeout(r, jitter));

  if (this.intentionalClose) return;

  try {
    await this._startAsHub();
    console.error(`[FSB Bridge ${this.instanceId}] Promoted to hub mode`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(`[FSB Bridge ${this.instanceId}] Promotion failed (port taken), reconnecting as relay`);
      this._scheduleRelayReconnect();
    } else {
      console.error(`[FSB Bridge ${this.instanceId}] Promotion failed:`, err);
      this._scheduleRelayReconnect();
    }
  }
}
```

**Planner notes:**
- Split "connected to hub" from "extension reachable." Today relay `connected` becomes true at `relay:welcome`; Phase 198 should expose explicit topology state and keep `isConnected` aligned with extension reachability.
- Prefer constructor options over hard-coded test timing/port changes. Preserve defaults for CLI/runtime callers.
- Broadcast topology changes from hub to relays so relay diagnostics and `sendAndWait` decisions do not infer extension reachability from socket readyState.

---

### `mcp-server/src/diagnostics.ts` (utility/service, status probing)

**Analog:** `mcp-server/src/diagnostics.ts`

**Imports and diagnostics type pattern** (lines 1-17):

```typescript
import type { WebSocketBridge } from './bridge.js';
import { WebSocketBridge as Bridge } from './bridge.js';
import {
  DEFAULT_HTTP_HOST,
  DEFAULT_HTTP_PORT,
  FSB_EXTENSION_BRIDGE_URL,
} from './version.js';

export type BridgeDiagnostics = {
  checkedAt: string;
  bridgeUrl: string;
  bridgeMode: 'hub' | 'relay' | 'disconnected';
  extensionConnected: boolean;
  extensionConfig?: Record<string, unknown> | null;
  tabsSummary?: { totalTabs: number; activeTabId: number | null };
  error?: string;
};
```

**Poll/wait pattern** (lines 19-34):

```typescript
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForExtensionConnection(
  bridge: WebSocketBridge,
  timeoutMs: number,
  pollMs = 100,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (bridge.isConnected) return true;
    await sleep(pollMs);
  }
  return bridge.isConnected;
}
```

**Probe and cleanup pattern** (lines 36-101):

```typescript
export async function collectBridgeDiagnostics(options: {
  waitForExtensionMs?: number;
  includeConfig?: boolean;
  includeTabs?: boolean;
} = {}): Promise<BridgeDiagnostics> {
  const bridge = new Bridge();
  const waitForExtensionMs = options.waitForExtensionMs ?? 1500;

  try {
    await bridge.connect();
    if (!bridge.isConnected && waitForExtensionMs > 0) {
      await waitForExtensionConnection(bridge, waitForExtensionMs);
    }

    const diagnostics: BridgeDiagnostics = {
      checkedAt: new Date().toISOString(),
      bridgeUrl: FSB_EXTENSION_BRIDGE_URL,
      bridgeMode: bridge.currentMode,
      extensionConnected: bridge.isConnected,
    };

    if (bridge.isConnected && options.includeConfig) {
      try {
        const config = await bridge.sendAndWait(
          { type: 'mcp:get-config', payload: {} },
          { timeout: 5_000 },
        );
        diagnostics.extensionConfig = (config.config as Record<string, unknown>) ?? config;
      } catch (err) {
        diagnostics.error = `Connected to extension, but config probe failed: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }
    }

    return diagnostics;
  } catch (err) {
    return {
      checkedAt: new Date().toISOString(),
      bridgeUrl: FSB_EXTENSION_BRIDGE_URL,
      bridgeMode: bridge.currentMode,
      extensionConnected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    bridge.disconnect();
  }
}
```

**CLI consumer pattern** (`mcp-server/src/index.ts` lines 98-147, 264-291):

```typescript
function formatStatus(diagnostics: Awaited<ReturnType<typeof collectBridgeDiagnostics>>): string {
  const lines = [
    `FSB MCP status @ ${diagnostics.checkedAt}`,
    `Bridge endpoint: ${diagnostics.bridgeUrl}`,
    `Bridge mode: ${diagnostics.bridgeMode}`,
    `Extension connected: ${diagnostics.extensionConnected ? 'yes' : 'no'}`,
  ];

  if (diagnostics.error) {
    lines.push(`Note: ${diagnostics.error}`);
  }

  return `${lines.join('\n')}\n`;
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
```

**Planner notes:**
- Extend `BridgeDiagnostics` with explicit topology fields instead of overloading `bridgeMode` and `extensionConnected`.
- Keep probes best-effort: one failed config/tab probe should set `diagnostics.error`, not throw away the entire status object.
- Keep `finally { bridge.disconnect(); }` for one-shot diagnostics.

---

### `mcp-server/src/http.ts` (service/transport, HTTP health response shape)

**Analog:** `mcp-server/src/http.ts`

**Health endpoint response shape** (lines 74-84):

```typescript
if (url.pathname === '/health') {
  sendJson(res, 200, {
    ok: true,
    transport: 'streamable-http',
    bridgeMode: options.bridge.currentMode,
    extensionConnected: options.bridge.isConnected,
    queuedMutationTools: options.queue.isRunning,
    sessions: sessions.size,
  });
  return;
}
```

**Planner notes:**
- Preserve the existing `/health` top-level JSON shape and add topology fields alongside `bridgeMode` and `extensionConnected`.
- Use `options.bridge.topology` as the exact source of truth for `bridgeTopology`, `hubConnected`, `relayCount`, and `activeHubInstanceId`.
- Do not change `/mcp` Streamable HTTP session handling while adding health diagnostics.

---

### `mcp-server/src/index.ts` (CLI controller, status and doctor output wiring)

**Analog:** `mcp-server/src/index.ts`

**Status formatter pattern** (lines 98-121):

```typescript
function formatStatus(diagnostics: Awaited<ReturnType<typeof collectBridgeDiagnostics>>): string {
  const lines = [
    `FSB MCP status @ ${diagnostics.checkedAt}`,
    `Bridge endpoint: ${diagnostics.bridgeUrl}`,
    `Bridge mode: ${diagnostics.bridgeMode}`,
    `Extension connected: ${diagnostics.extensionConnected ? 'yes' : 'no'}`,
  ];

  if (diagnostics.error) {
    lines.push(`Note: ${diagnostics.error}`);
  }

  return `${lines.join('\n')}\n`;
}
```

**Doctor branch pattern** (lines 123-147):

```typescript
function formatDoctor(diagnostics: Awaited<ReturnType<typeof collectBridgeDiagnostics>>): string {
  const lines = [formatStatus(diagnostics).trimEnd(), '', 'Remediation:'];

  if (diagnostics.extensionConnected) {
    lines.push('- The extension bridge is healthy. Your MCP host should be able to use FSB now.');
  } else if (diagnostics.bridgeMode === 'hub') {
    lines.push('- The MCP bridge is listening, but the extension has not attached yet.');
  } else if (diagnostics.bridgeMode === 'relay') {
    lines.push('- Another fsb-mcp-server instance already owns the local bridge port.');
  }

  return `${lines.join('\n')}\n`;
}
```

**Planner notes:**
- Keep `formatStatus(diagnostics)` as the single human-readable status formatter and append topology-derived lines there.
- Use diagnostics fields populated from `bridge.topology`; do not compute topology again in the CLI layer.
- Keep `formatDoctor()` remediation concise and update the relay branch so hub reachability is not described as extension readiness.

---

### `mcp-server/src/types.ts` (model/contracts, request-response)

**Analog:** `mcp-server/src/types.ts`

**MCP message contract pattern** (lines 1-41):

```typescript
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
  | 'mcp:get-config'          // Read extension config (keys redacted)
  | 'mcp:read-page';          // Read page text content

// Messages FROM extension TO MCP server (responses)
export interface MCPResponse {
  id: string;          // Matches the request MCPMessage.id
  type: 'mcp:result' | 'mcp:progress' | 'mcp:error';
  payload: Record<string, unknown>;
}
```

**Relay protocol pattern** (lines 56-68):

```typescript
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
```

**Planner notes:**
- Add topology/status message contracts here if they cross the hub/relay wire.
- Use discriminated unions with literal `type` fields, matching the existing `RelayHello` / `RelayWelcome` style.
- Avoid adding `any`; existing bridge contracts use `Record<string, unknown>`.

---

### `tests/mcp-bridge-client-lifecycle.test.js` (test, event-driven mock browser I/O)

**Analogs:** `tests/secure-config-credential-vault.test.js`, `tests/test-agent-scheduler-cron.js`, `tests/agent-manager-start-mode.test.js`

**Plain Node assertion harness** (`tests/secure-config-credential-vault.test.js` lines 1-23, 282-289):

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg} (expected: ${expected}, got: ${actual})`);
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
```

**VM browser-context loading pattern** (`tests/secure-config-credential-vault.test.js` lines 25-94):

```javascript
function createStorageArea(initial = {}) {
  const store = { ...initial };
  return {
    async get(keys) {
      if (keys == null) return { ...store };
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) out[key] = store[key];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
      }
      return { ...store };
    },
    async set(values) {
      Object.assign(store, values);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => {
        delete store[key];
      });
    },
    _dump() {
      return { ...store };
    }
  };
}

function loadSecureConfig(localSeed = {}, sessionSeed = {}) {
  const local = createStorageArea(localSeed);
  const session = createStorageArea(sessionSeed);
  const context = {
    chrome: {
      runtime: { id: 'test-extension-id' },
      storage: { local, session }
    },
    console,
    self: {},
    window: undefined,
    module: undefined,
    exports: undefined,
    require: undefined,
    setTimeout,
    clearTimeout
  };

  const source = fs.readFileSync(path.join(__dirname, '..', 'config', 'secure-config.js'), 'utf8');
  vm.runInNewContext(`${source}\nthis.__secureConfig = secureConfig;`, context, { filename: 'secure-config.js' });

  return {
    secureConfig: context.__secureConfig,
    storageLocal: local,
    storageSession: session
  };
}
```

**Chrome alarms mock pattern** (`tests/test-agent-scheduler-cron.js` lines 6-23, 96-108):

```javascript
// Minimal chrome.alarms mock
const alarms = {};
globalThis.chrome = {
  alarms: {
    create: async (name, opts) => { alarms[name] = opts; },
    clear: async (name) => { delete alarms[name]; },
    getAll: async () => Object.entries(alarms).map(([name, opts]) => ({ name, ...opts }))
  }
};

// Load the scheduler
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('agents/agent-scheduler.js', 'utf8');
vm.runInThisContext(src);

const result = await agentScheduler.scheduleAgent(cronAgent);
assert(result === true, 'scheduleAgent with cron returns true');
const alarmName = agentScheduler.getAlarmName('test_cron_1');
assert(alarms[alarmName] && alarms[alarmName].when > Date.now(), 'cron alarm has future "when" timestamp');
```

**Planner notes:**
- Load `ws/mcp-bridge-client.js` in a VM context and export `mcpBridgeClient` or `MCPBridgeClient` with an appended assignment, matching the secure-config pattern.
- Provide fake `WebSocket`, fake `chrome.storage.session/local`, fake `chrome.alarms`, and controllable timer functions.
- Assert idempotent `connect()`, persisted state writes, alarm creation after disconnect/failure, and wake-reason recording.
- Keep the test executable with `node tests/mcp-bridge-client-lifecycle.test.js`.

---

### `tests/mcp-bridge-topology.test.js` (test, hub/relay WebSocket topology)

**Analogs:** `tests/mcp-restricted-tab.test.js`, `mcp-server/src/bridge.ts`, `mcp-server/package.json`

**MCP built-ESM import pattern** (`tests/mcp-restricted-tab.test.js` lines 6-9, 23-25, 68-70, 101-108):

```javascript
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const repoRoot = path.resolve(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'background.js'), 'utf8');

async function run() {
  const errorsModuleUrl = pathToFileURL(path.join(repoRoot, 'mcp-server', 'build', 'errors.js')).href;
  const { mapFSBError } = await import(errorsModuleUrl);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error('Test harness failed:', error);
  process.exit(1);
});
```

**Bridge WebSocket topology under test** (`mcp-server/src/bridge.ts` lines 194-211, 330-343, 440-449):

```typescript
private _startAsHub(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    this.wss = new WebSocketServer({ port: PORT });

    this.wss.on('listening', () => {
      this.mode = 'hub';
      console.error(`[FSB Bridge ${this.instanceId}] Hub mode: WebSocket server listening on port ${PORT}`);
      resolve();
    });

    this.wss.on('connection', (ws: WsWebSocket) => {
      this._handleNewConnection(ws);
    });
  });
}

private _registerRelayClient(ws: WsWebSocket, hello: RelayHello): void {
  const clientId = hello.instanceId;
  this.relayClients.set(clientId, ws);
  console.error(`[FSB Bridge ${this.instanceId}] Relay client ${clientId} registered (total: ${this.relayClients.size})`);

  const welcome: RelayWelcome = { type: 'relay:welcome', instanceId: clientId };
  ws.send(JSON.stringify(welcome));
}

if (!this.extensionClient) {
  const errorResp: MCPResponse = {
    id: msg.id,
    type: 'mcp:error',
    payload: { success: false, error: 'extension_not_connected' },
  };
  const relayWs = this.relayClients.get(clientId);
  if (relayWs) relayWs.send(JSON.stringify(errorResp));
  return;
}
```

**MCP build convention** (`mcp-server/package.json` lines 36-45):

```json
"scripts": {
  "clean": "node -e \"try{require('fs').unlinkSync('build/test-config-engine.js')}catch{}\"",
  "build": "npm run clean && tsc && cp ../ai/tool-definitions.js ai/tool-definitions.cjs",
  "dev": "tsx src/index.ts",
  "doctor": "node build/index.js doctor",
  "serve": "node build/index.js serve",
  "setup": "node build/index.js setup",
  "status": "node build/index.js status",
  "wait-for-extension": "node build/index.js wait-for-extension",
  "prepublishOnly": "npm run build"
}
```

**Planner notes:**
- Require `npm --prefix mcp-server run build` before importing `mcp-server/build/bridge.js`.
- Add bridge constructor options first so tests can use an ephemeral port and short handshake/promotion delays.
- Use real `ws` clients for extension and relay behavior; use plain assertions and explicit cleanup via `bridge.disconnect()` and socket close.
- Cover hub-first, relay-first, extension disconnect, hub loss, and relay promotion/reconnect state.

---

### `package.json` (config, batch test command)

**Analog:** `package.json`

**Root test-script pattern** (lines 14-22):

```json
"scripts": {
  "build": "echo \"Chrome extension - no build required\"",
  "test": "node tests/test-agent-scheduler-cron.js && node tests/test-overlay-state.js && node tests/cost-tracker-ordering.test.js && node tests/runtime-contracts.test.js && node tests/ai-integration-analytics.test.js && node tests/dashboard-runtime-state.test.js && node tests/task-router.test.js && node tests/agent-manager-start-mode.test.js && npm --prefix mcp-server run build && node tests/mcp-restricted-tab.test.js && node tests/turn-result.test.js && node tests/action-history.test.js && node tests/universal-provider-lmstudio.test.js && node tests/config-lmstudio.test.js && node tests/cost-tracker.test.js && node tests/transcript-store.test.js && node tests/hook-pipeline.test.js && node tests/session-schema.test.js && node tests/state-emitter.test.js && node tests/secure-config-credential-vault.test.js",
  "lint": "echo \"Linting not configured yet\"",
  "clean": "rm -f config/dev-settings.json",
  "package": "zip -r fsb-v0.9.31.zip . -x '*.git*' 'node_modules/*' 'config/dev-*'",
  "showcase:install": "npm --prefix showcase/angular install",
  "showcase:build": "npm --prefix showcase/angular run build",
  "showcase:serve": "npm --prefix showcase/angular run start"
}
```

**Planner notes:**
- If new tests are wired into `npm test`, place `npm --prefix mcp-server run build` before tests that import from `mcp-server/build`.
- Keep the project convention of single-file Node test scripts chained with `&&`.

## Shared Patterns

### MV3 Wake Re-Arm

**Source:** `background.js` lines 4081-4094, 11566-11681
**Apply to:** `background.js`, `ws/mcp-bridge-client.js`

Pattern to copy: register listeners at top level and route through a small idempotent function. Preserve existing listener logic and add the bridge arming call near the top of each wake handler.

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    console.warn('[FSB] Rejected message from unknown sender:', sender.id);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return;
  }

  switch (request.action) {
    case 'startAutomation':
      handleStartAutomation(request, sender, sendResponse);
      return true; // Will respond asynchronously
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await restoreSessionsFromStorage();
  agentScheduler.rescheduleAllAgents();
  mcpBridgeClient.connect();
  fsbWebSocket.connect();
});
```

### Storage Across Service-Worker Restart

**Source:** `background.js` lines 1182-1216
**Apply to:** `ws/mcp-bridge-client.js`, `background.js`

Pattern to copy: wrap `chrome.storage.session` reads/writes in async helpers, catch and log failures, and validate restored values before updating in-memory state.

```javascript
async function persistConversationSessions() {
  try {
    await chrome.storage.session.set({
      fsbConversationSessions: Object.fromEntries(conversationSessions)
    });
    automationLogger.debug('Conversation sessions persisted', { count: conversationSessions.size });
  } catch (error) {
    automationLogger.warn('Failed to persist conversation sessions', { error: error.message });
  }
}
```

### Alarm Handling

**Source:** `background.js` lines 11565-11629; `tests/test-agent-scheduler-cron.js` lines 6-13
**Apply to:** `background.js`, `ws/mcp-bridge-client.js`, `tests/mcp-bridge-client-lifecycle.test.js`

Pattern to copy: named alarms, early branch by alarm name, async handler, test with an in-memory `alarms` object.

```javascript
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const agentId = agentScheduler.getAgentIdFromAlarm(alarm.name);
  if (!agentId) return; // Not an FSB agent alarm

  console.log('[FSB] Agent alarm fired:', alarm.name);

  try {
    const agent = await agentManager.getAgent(agentId);
    if (!agent) {
      console.warn('[FSB] Agent not found for alarm, clearing:', agentId);
      await agentScheduler.clearAlarm(agentId);
      return;
    }
  } catch (error) {
    console.error('[FSB] Agent alarm handler error:', error.message);
  }
});
```

### Hub/Relay Topology

**Source:** `mcp-server/src/bridge.ts` lines 24-43, 330-343, 440-449, 492-499
**Apply to:** `mcp-server/src/bridge.ts`, `mcp-server/src/types.ts`, `mcp-server/src/diagnostics.ts`

Pattern to copy: keep hub ownership, relay registration, extension reachability, and pending request origin as separate state concepts.

```typescript
private extensionClient: WsWebSocket | null = null;
private relayClients = new Map<string, WsWebSocket>();
private messageOrigin = new Map<string, string>(); // msgId -> instanceId | "local"

private _registerRelayClient(ws: WsWebSocket, hello: RelayHello): void {
  const clientId = hello.instanceId;
  this.relayClients.set(clientId, ws);

  const welcome: RelayWelcome = { type: 'relay:welcome', instanceId: clientId };
  ws.send(JSON.stringify(welcome));
}

if (!this.extensionClient) {
  const errorResp: MCPResponse = {
    id: msg.id,
    type: 'mcp:error',
    payload: { success: false, error: 'extension_not_connected' },
  };
  const relayWs = this.relayClients.get(clientId);
  if (relayWs) relayWs.send(JSON.stringify(errorResp));
  return;
}
```

### Diagnostics Probing

**Source:** `mcp-server/src/diagnostics.ts` lines 36-101
**Apply to:** `mcp-server/src/diagnostics.ts`, `mcp-server/src/bridge.ts`

Pattern to copy: create a temporary bridge, connect, optionally wait, probe only when extension is reachable, return structured status, always disconnect.

```typescript
try {
  await bridge.connect();
  if (!bridge.isConnected && waitForExtensionMs > 0) {
    await waitForExtensionConnection(bridge, waitForExtensionMs);
  }

  const diagnostics: BridgeDiagnostics = {
    checkedAt: new Date().toISOString(),
    bridgeUrl: FSB_EXTENSION_BRIDGE_URL,
    bridgeMode: bridge.currentMode,
    extensionConnected: bridge.isConnected,
  };

  return diagnostics;
} catch (err) {
  return {
    checkedAt: new Date().toISOString(),
    bridgeUrl: FSB_EXTENSION_BRIDGE_URL,
    bridgeMode: bridge.currentMode,
    extensionConnected: false,
    error: err instanceof Error ? err.message : String(err),
  };
} finally {
  bridge.disconnect();
}
```

### Plain Node Test Harness

**Source:** `tests/runtime-contracts.test.js` lines 6-24, 59-60; `tests/mcp-restricted-tab.test.js` lines 68-108
**Apply to:** both new test files

Pattern to copy: no test framework, count passes/failures manually, print section headers, exit non-zero on failures, use dynamic ESM import for built MCP modules.

```javascript
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

function readRepoFile() {
  return fs.readFileSync(path.join(__dirname, '..', ...arguments), 'utf8');
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
```

## No Analog Found

All planned files have usable analogs in the current codebase.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| _None_ | - | - | - |

## Metadata

**Analog search scope:** `ws/`, `background.js`, `mcp-server/src/`, `tests/`, `package.json`, `mcp-server/package.json`
**Files scanned:** 441
**Project instructions:** No project-root `CLAUDE.md` found. `.claude/skills/` and `.agents/skills/` were not present.
**Pattern extraction date:** 2026-04-22
