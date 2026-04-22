# Phase 199: mcp-tool-routing-contract - Pattern Map

**Mapped:** 2026-04-22T22:47:52Z
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ws/mcp-tool-dispatcher.js` (new, exact name discretionary) | utility/service | request-response | `ai/tool-executor.js` | exact |
| `background.js` | route/controller | event-driven, request-response | `background.js` message handlers and tab handlers | exact |
| `ws/mcp-bridge-client.js` | service/bridge client | request-response, streaming | `ws/mcp-bridge-client.js` route handlers | exact |
| `tests/mcp-restricted-tab.test.js` | test | request-response | `tests/mcp-bridge-client-lifecycle.test.js` | role-match |
| `tests/mcp-tool-routing-contract.test.js` (new, likely) | test | transform, request-response | `tests/mcp-bridge-client-lifecycle.test.js` | role-match |
| `mcp-server/src/errors.ts` | utility | transform | `mcp-server/src/errors.ts` | exact |
| `mcp-server/src/types.ts` | model/type | request-response | `mcp-server/src/types.ts` | exact |
| `mcp-server/src/tools/schema-bridge.ts` | utility/config bridge | transform | `mcp-server/src/tools/schema-bridge.ts` | exact |
| `mcp-server/src/tools/manual.ts` | service/tool registration | CRUD/request-response | `mcp-server/src/tools/manual.ts` | exact |
| `mcp-server/src/tools/read-only.ts` | service/tool registration | request-response | `mcp-server/src/tools/read-only.ts` | exact |
| `mcp-server/src/tools/autopilot.ts` | service/tool registration | streaming, request-response | `mcp-server/src/tools/autopilot.ts` | exact |
| `mcp-server/ai/tool-definitions.cjs` / `ai/tool-definitions.js` | config/registry | transform | `ai/tool-definitions.js` | exact |

## Pattern Assignments

### `ws/mcp-tool-dispatcher.js` (utility/service, request-response)

**Analog:** `ai/tool-executor.js`

Use this file as the model for a small shared dispatcher loaded by `background.js` before `ws/mcp-bridge-client.js`. Keep it plain script-compatible JavaScript with optional CommonJS export for Node tests.

**Import/global fallback pattern** (`ai/tool-executor.js` lines 20-28):
```javascript
// In Chrome extension importScripts context, TOOL_REGISTRY and getToolByName
// are already globals from tool-definitions.js loaded before this file.
// In Node.js/test context, fall back to require().
// Prefix with _te_ to avoid collisions with agent-loop.js in shared global scope.
var _te_defs = (typeof TOOL_REGISTRY !== 'undefined')
  ? { TOOL_REGISTRY, getToolByName }
  : require('./tool-definitions.js');
var _te_getToolByName = _te_defs.getToolByName;
```

**Structured result pattern** (`ai/tool-executor.js` lines 45-52):
```javascript
function makeResult({ success, hadEffect = false, error = null, navigationTriggered = false, result = null }) {
  return {
    success: Boolean(success),
    hadEffect: Boolean(hadEffect),
    error: error || null,
    navigationTriggered: Boolean(navigationTriggered),
    result: result || null
  };
}
```

**Strict route switch pattern** (`ai/tool-executor.js` lines 560-589):
```javascript
async function executeTool(name, params, tabId, options = {}) {
  const tool = _te_getToolByName(name);

  if (!tool) {
    return makeResult({
      success: false,
      error: `Unknown tool: ${name}`
    });
  }

  const transform = AUTOPILOT_PARAM_TRANSFORMS[name];
  const finalParams = transform ? transform(params) : params;

  switch (tool._route) {
    case 'content':
      return executeContentTool(tool, finalParams, tabId);
    case 'cdp':
      return executeCdpTool(tool, finalParams, tabId, options.cdpHandler);
    case 'background':
      return executeBackgroundTool(tool, finalParams, tabId, options.dataHandler);
    default:
      return makeResult({
        success: false,
        error: `Tool ${name} has unsupported route: ${tool._route}`
      });
  }
}
```

**Export pattern** (`ai/tool-executor.js` lines 605-611):
```javascript
// CommonJS for Chrome extension context and Node.js require()
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { executeTool, isReadOnly };
}
```

---

### `background.js` (route/controller, event-driven request-response)

**Analog:** `background.js`

Add `importScripts()` for the new dispatcher after `ai/tool-definitions.js` and before the bridge client. Phase 199 routes should expose direct handler functions or a handler table instead of requiring `chrome.runtime.sendMessage` loopback.

**Import order pattern** (`background.js` lines 3-20):
```javascript
importScripts('config/config.js');
importScripts('config/init-config.js');
importScripts('config/secure-config.js');
importScripts('ai/cli-parser.js');
importScripts('ai/ai-integration.js');
importScripts('ai/tool-definitions.js');
importScripts('utils/automation-logger.js');

// MCP bridge client for local MCP server connection
try { importScripts('ws/mcp-bridge-client.js'); } catch (e) { console.error('[FSB] Failed to load mcp-bridge-client.js:', e.message); }
```

**Runtime message guard pattern** (`background.js` lines 4095-4115):
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Security: Only accept messages from our own extension contexts
  if (sender.id !== chrome.runtime.id) {
    console.warn('[FSB] Rejected message from unknown sender:', sender.id);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return;
  }

  armMcpBridge('runtime.onMessage');

  switch (request.action) {
    case 'startAutomation':
      handleStartAutomation(request, sender, sendResponse);
      return true;
```

**Tab create/sanitized response pattern** (`background.js` lines 10147-10188):
```javascript
async function handleOpenNewTab(request, sender, sendResponse) {
  try {
    const { url, active } = request;
    automationLogger.debug('Opening new tab', { url, active });
    
    const tab = await chrome.tabs.create({
      url: url || 'about:blank',
      active: active !== false // Default to true
    });

    sendResponse({
      success: true,
      tabId: tab.id,
      url: tab.url,
      active: tab.active
    });
```

**Switch tab explicit ID pattern** (`background.js` lines 10205-10224):
```javascript
async function handleSwitchToTab(request, sender, sendResponse) {
  try {
    const { tabId } = request;
    automationLogger.debug('Switching to tab', { tabId });
    
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    
    sendResponse({
      success: true,
      tabId: tabId,
      previousTab: currentTab ? currentTab.id : null
    });
```

**List tabs sanitized shape** (`background.js` lines 11270-11315):
```javascript
async function handleListTabs(request, sender, sendResponse) {
  try {
    const { currentWindowOnly } = request;
    let queryOptions = {};
    if (currentWindowOnly !== false) {
      queryOptions.currentWindow = true;
    }
    
    const tabs = await chrome.tabs.query(queryOptions);
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const formattedTabs = tabs.map(tab => {
      let domain;
      if (tab.url) {
        try { domain = new URL(tab.url).hostname; } catch { /* skip */ }
      }
      return {
        id: tab.id,
        title: tab.title || 'Untitled Tab',
        isActive: tab.active,
        ...(domain ? { domain } : {}),
      };
    });
```

**Restricted URL helper pattern** (`background.js` lines 1702-1738):
```javascript
function isRestrictedURL(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://'
  ];
  
  const restrictedPages = [
    'chrome://extensions/',
    'chrome://settings/',
    'chrome://newtab/',
    'chrome://history/',
    'chrome://downloads/',
    'about:blank',
    'about:newtab'
  ];
  
  if (restrictedPages.some(page => url.startsWith(page))) {
    return true;
  }
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}
```

---

### `ws/mcp-bridge-client.js` (service/bridge client, request-response + streaming)

**Analog:** `ws/mcp-bridge-client.js`

Replace Phase 199-owned `_dispatchToBackground()` loopback calls with the shared direct dispatcher. Preserve `_handleMessage()`, `_sendResult()`, `_sendError()`, and progress behavior.

**Incoming message pattern** (`ws/mcp-bridge-client.js` lines 285-293):
```javascript
const { id, type, payload } = msg;
if (!id || !type) return;

try {
  const result = await this._routeMessage(type, payload || {}, id);
  this._sendResult(id, { success: true, ...result });
} catch (err) {
  this._sendError(id, err.message || 'Unknown error');
}
```

**Current route table to replace/drive through dispatcher** (`ws/mcp-bridge-client.js` lines 300-383):
```javascript
async _routeMessage(type, payload, id) {
  switch (type) {
    case 'mcp:get-tabs':
      return this._handleGetTabs();
    case 'mcp:get-dom':
      return this._handleGetDOM(payload);
    case 'mcp:execute-action':
      return this._handleExecuteAction(payload);
    case 'mcp:start-automation':
      return this._handleStartAutomation(payload, id);
    default:
      throw new Error('Unknown MCP message type: ' + type);
  }
}
```

**Content-script dispatch pattern to preserve for content-routed tools** (`ws/mcp-bridge-client.js` lines 396-418):
```javascript
async _sendToContentScript(tabId, message) {
  if (typeof sendMessageWithRetry === 'function') {
    return await sendMessageWithRetry(tabId, message);
  }
  if (typeof ensureContentScriptInjected === 'function') {
    await ensureContentScriptInjected(tabId);
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || {});
    });
  });
}
```

**Self-dispatch anti-pattern to remove for Phase 199 routes** (`ws/mcp-bridge-client.js` lines 564-588):
```javascript
_dispatchToBackground(request) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || {});
    });
  });
}
```

**Autopilot progress pattern to preserve** (`ws/mcp-bridge-client.js` lines 590-647):
```javascript
async _handleStartAutomation(payload, mcpMsgId) {
  const tab = await this._getActiveTab();
  if (!tab || !tab.id) throw new Error('No active tab');

  const response = await this._dispatchToBackground({
    action: 'startAutomation',
    task: payload.task,
    tabId: tab.id,
    source: 'mcp',
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to start automation');
  }

  const sessionId = response.sessionId;
  return new Promise((resolve) => {
    const listener = (message) => {
      if (message.type === 'automationProgress' && message.sessionId === sessionId) {
        this._sendProgress(mcpMsgId, {
          taskId: sessionId,
          progress: message.progress || 0,
          phase: message.phase || 'executing',
          eta: message.eta || null,
          action: message.action || null,
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });
}
```

---

### `tests/mcp-restricted-tab.test.js` (test, request-response)

**Analog:** `tests/mcp-bridge-client-lifecycle.test.js`

Convert current source-string assertions into executable VM/module tests. Keep plain Node assertion counters and no external test runner.

**Plain Node harness pattern** (`tests/mcp-bridge-client-lifecycle.test.js` lines 1-21):
```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
```

**VM execution pattern for service-worker scripts** (`tests/mcp-bridge-client-lifecycle.test.js` lines 161-185):
```javascript
const context = {
  chrome,
  WebSocket: FakeWebSocket,
  console,
  Math: deterministicMath,
  Date,
  setTimeout: timers.setTimeout,
  clearTimeout: timers.clearTimeout,
  setInterval: timers.setInterval,
  clearInterval: timers.clearInterval,
  globalThis: {}
};
context.globalThis = context;

const source = fs.readFileSync(path.join(__dirname, '..', 'ws', 'mcp-bridge-client.js'), 'utf8');
const footer = `
this.__phase198 = {
  MCPBridgeClient,
  mcpBridgeClient
};
`;
vm.runInNewContext(`${source}\n${footer}`, context, { filename: 'ws/mcp-bridge-client.js' });
```

**Current assertions to replace** (`tests/mcp-restricted-tab.test.js` lines 26-64):
```javascript
console.log('\n--- background route coverage ---');

const requiredBgTools = [
  'navigate',
  'open_tab',
  'switch_tab',
  'list_tabs',
  'go_back',
  'go_forward',
  'refresh'
];

for (const tool of requiredBgTools) {
  assert(backgroundSource.includes(`'${tool}'`), `background.js mentions ${tool} in MCP routing`);
}
```

**ESM import pattern for built MCP server modules** (`tests/mcp-restricted-tab.test.js` lines 68-86):
```javascript
async function run() {
  const errorsModuleUrl = pathToFileURL(path.join(repoRoot, 'mcp-server', 'build', 'errors.js')).href;
  const { mapFSBError } = await import(errorsModuleUrl);

  const routed = mapFSBError({
    success: false,
    errorCode: 'restricted_active_tab',
    pageType: 'Chrome internal page',
    currentUrl: 'chrome://newtab/',
    autoRouteAvailable: true,
  });
```

---

### `tests/mcp-tool-routing-contract.test.js` (test, transform + request-response)

**Analog:** `tests/tool-executor-readonly.test.js` and `tests/mcp-bridge-client-lifecycle.test.js`

Use a new focused Node script if route coverage becomes too large for `mcp-restricted-tab.test.js`. It should load the actual dispatcher plus registry and fail when a public registered MCP tool is missing a direct route or handler.

**Registry-based contract test pattern** (`tests/tool-executor-readonly.test.js` lines 21-32):
```javascript
// Stub the chrome global BEFORE loading tool-executor, which will reference
// it via chrome.tabs.sendMessage in executeContentTool.
let sendMessageStub = null;
global.chrome = {
  tabs: {
    sendMessage: (...args) => sendMessageStub(...args),
    get: async () => ({ url: 'https://example.com' })
  }
};

const { executeTool } = require('../ai/tool-executor.js');
```

**Async case runner pattern** (`tests/mcp-bridge-topology.test.js` lines 152-160):
```javascript
async function runCase(name, fn) {
  console.log(`\n--- ${name} ---`);
  try {
    await fn();
  } catch (error) {
    failed++;
    console.error(`  FAIL: ${name}: ${error.message}`);
  }
}
```

**Exit summary pattern** (`tests/mcp-bridge-client-lifecycle.test.js` lines 295-310):
```javascript
async function run() {
  await runBrowserFirstReconnectCase();
  await runServiceWorkerWakeCase();
  await runConnectedTransitionCase();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  failed++;
  console.error('  FAIL: Test harness failed:', error);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
});
```

---

### `mcp-server/src/errors.ts` (utility, transform)

**Analog:** `mcp-server/src/errors.ts`

Extend structured route errors here, not in each server tool. Phase 199 should feed structured fields such as `errorCode`, `tool`, `routeFamily`, and valid recovery tools into this mapper; Phase 200 owns wording polish.

**Error message registry pattern** (`mcp-server/src/errors.ts` lines 3-26):
```typescript
export const FSB_ERROR_MESSAGES: Record<string, string> = {
  'extension_not_connected':
    `Extension WebSocket not connected. The FSB Chrome extension must be running with a WebSocket connection to ${FSB_EXTENSION_BRIDGE_URL}. Verify the extension is installed, enabled, and the browser is open.`,
  'no_active_tab':
    'No active browser tab found. Open a browser tab or use the navigate tool to go to a URL first.',
  'restricted_active_tab':
    'The active tab is a restricted/browser-internal page ({pageType}: {currentUrl}). Page-reading and interaction tools cannot run there because Chrome blocks content script injection. {restrictedRecovery}',
};
```

**Structured success/error mapping pattern** (`mcp-server/src/errors.ts` lines 86-99):
```typescript
export function mapFSBError(
  fsbResult: Record<string, unknown> | null | undefined,
  context?: Record<string, string>,
): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  if (fsbResult && fsbResult.success) {
    return { content: [{ type: 'text', text: JSON.stringify(fsbResult, null, 2) }] };
  }

  const errorMsg = String(fsbResult?.error ?? '');
  const errorCode = typeof fsbResult?.errorCode === 'string' ? fsbResult.errorCode : '';
  let errorKey = errorCode || 'action_rejected';
```

**Recovery placeholder pattern to replace with valid tool list support** (`mcp-server/src/errors.ts` lines 116-124):
```typescript
const autoRouteAvailable = Boolean(fsbResult?.autoRouteAvailable);

const mergedContext: Record<string, string> = {
  currentUrl: typeof fsbResult?.currentUrl === 'string' ? fsbResult.currentUrl : '',
  pageType: typeof fsbResult?.pageType === 'string' ? fsbResult.pageType : 'Restricted page',
  restrictedRecovery: autoRouteAvailable
    ? 'Use navigate, open_tab, switch_tab, or list_tabs to move to a normal webpage first. If you want sidepanel-style smart start routing from this blank/new-tab page, use run_task.'
    : 'Use navigate, open_tab, switch_tab, or list_tabs to move to a normal webpage first.',
```

**Logging pattern** (`mcp-server/src/errors.ts` lines 142-151):
```typescript
const hint = getRecoveryHint(text, { errorKey, autoRouteAvailable });
if (hint) {
  text += hint;
}

console.error(`[FSB MCP] Tool error: key=${errorKey} raw="${errorMsg}"`);

return { content: [{ type: 'text', text }], isError: true };
```

---

### `mcp-server/src/types.ts` (model/type, request-response)

**Analog:** `mcp-server/src/types.ts`

If the public bridge message set changes, update the union here. For Phase 199, prefer preserving public message/tool names and mapping aliases internally.

**Message type union pattern** (`mcp-server/src/types.ts` lines 8-34):
```typescript
export type MCPMessageType =
  | 'mcp:start-automation'
  | 'mcp:stop-automation'
  | 'mcp:get-status'
  | 'mcp:execute-action'
  | 'mcp:get-dom'
  | 'mcp:get-tabs'
  | 'mcp:get-site-guides'
  | 'mcp:get-memory'
  | 'mcp:get-config'
  | 'mcp:read-page'
  | 'mcp:list-sessions'
  | 'mcp:get-session'
  | 'mcp:get-logs'
  | 'mcp:search-memory'
  | 'mcp:list-credentials'
  | 'mcp:fill-credential'
  | 'mcp:list-payments'
  | 'mcp:use-payment-method';
```

**Response shape pattern** (`mcp-server/src/types.ts` lines 36-41):
```typescript
export interface MCPResponse {
  id: string;          // Matches the request MCPMessage.id
  type: 'mcp:result' | 'mcp:progress' | 'mcp:error';
  payload: Record<string, unknown>;
}
```

---

### `mcp-server/src/tools/schema-bridge.ts` (utility/config bridge, transform)

**Analog:** `mcp-server/src/tools/schema-bridge.ts`

Use this as the source for route coverage tests. Do not duplicate tool metadata manually in tests.

**CJS registry bridge pattern** (`mcp-server/src/tools/schema-bridge.ts` lines 14-27):
```typescript
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { z } from 'zod';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolDefs = require(path.resolve(__dirname, '../../ai/tool-definitions.cjs'));
```

**Typed registry metadata pattern** (`mcp-server/src/tools/schema-bridge.ts` lines 39-60):
```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, ToolPropertySchema>;
    required: string[];
  };
  _route: 'content' | 'cdp' | 'background';
  _readOnly: boolean;
  _contentVerb: string | null;
  _cdpVerb: string | null;
}

export const TOOL_REGISTRY: ToolDefinition[] = toolDefs.TOOL_REGISTRY;
export const getToolByName: (name: string) => ToolDefinition | null = toolDefs.getToolByName;
export const getReadOnlyTools: () => ToolDefinition[] = toolDefs.getReadOnlyTools;
export const getToolsByRoute: (route: string) => ToolDefinition[] = toolDefs.getToolsByRoute;
```

**Parameter transform pattern** (`mcp-server/src/tools/schema-bridge.ts` lines 128-163):
```typescript
export const PARAM_TRANSFORMS: Record<
  string,
  (params: Record<string, unknown>) => Record<string, unknown>
> = {
  press_key: (p) => ({
    key: p.key,
    ctrlKey: p.ctrl ?? false,
    shiftKey: p.shift ?? false,
    altKey: p.alt ?? false,
    useDebuggerAPI: true,
  }),
  drag_drop: (p) => ({
    sourceRef: p.sourceSelector,
    targetRef: p.targetSelector,
    steps: p.steps,
    holdMs: p.holdMs,
    stepDelayMs: p.stepDelayMs,
  }),
};
```

---

### `mcp-server/src/tools/manual.ts` (service/tool registration, CRUD request-response)

**Analog:** `mcp-server/src/tools/manual.ts`

Route contract tests should treat this as the public MCP manual-tool registration path. Preserve mutation serialization unless a tool is already read-only elsewhere.

**Imports pattern** (`mcp-server/src/tools/manual.ts` lines 1-10):
```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { mapFSBError } from '../errors.js';
import {
  TOOL_REGISTRY,
  jsonSchemaToZod,
  PARAM_TRANSFORMS,
  type ToolDefinition,
} from './schema-bridge.js';
```

**Queue + bridge send pattern** (`mcp-server/src/tools/manual.ts` lines 26-51):
```typescript
if (!bridge.isConnected) {
  console.error(`[FSB Manual] ${toolName}: bridge not connected`);
  return mapFSBError({ success: false, error: 'extension_not_connected' });
}

return queue.enqueue(toolName, async () => {
  try {
    const result = await bridge.sendAndWait(
      { type: 'mcp:execute-action', payload: { tool: fsbVerb, params } },
      { timeout },
    );
    return mapFSBError(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return mapFSBError({ success: false, error: errMsg });
  }
});
```

**Registry registration pattern** (`mcp-server/src/tools/manual.ts` lines 65-82):
```typescript
const manualTools = TOOL_REGISTRY.filter((t: ToolDefinition) => !t._readOnly);

for (const tool of manualTools) {
  const zodShape = jsonSchemaToZod(tool.inputSchema);
  const fsbVerb = tool._contentVerb || tool._cdpVerb || tool.name;
  const transform = PARAM_TRANSFORMS[tool.name];

  server.tool(
    tool.name,
    tool.description,
    zodShape,
    async (params: Record<string, unknown>) => {
      const finalParams = transform ? transform(params) : params;
      return execAction(bridge, queue, tool.name, fsbVerb, finalParams);
    },
  );
}
```

---

### `mcp-server/src/tools/read-only.ts` (service/tool registration, request-response)

**Analog:** `mcp-server/src/tools/read-only.ts`

Use this file to derive read-only route expectations. If tests assert route coverage, ensure read-only tools that map to special message types are included.

**Message map pattern** (`mcp-server/src/tools/read-only.ts` lines 12-47):
```typescript
type BridgeMessage = { type: MCPMessageType; payload: Record<string, unknown> };

const MESSAGE_TYPE_MAP: Record<
  string,
  (params: Record<string, unknown>) => BridgeMessage
> = {
  read_page: (p) => ({
    type: 'mcp:read-page',
    payload: { full: p.full },
  }),
  get_dom_snapshot: (p) => ({
    type: 'mcp:get-dom',
    payload: { maxElements: p.maxElements },
  }),
  list_tabs: () => ({
    type: 'mcp:get-tabs',
    payload: {},
  }),
};
```

**Read-only registration pattern** (`mcp-server/src/tools/read-only.ts` lines 76-100):
```typescript
const readOnlyTools = TOOL_REGISTRY.filter(t => t._readOnly);

for (const tool of readOnlyTools) {
  const zodShape = jsonSchemaToZod(tool.inputSchema);
  const messageBuilder = MESSAGE_TYPE_MAP[tool.name];

  if (!messageBuilder) {
    continue;
  }

  const timeout = TIMEOUT_OVERRIDES[tool.name] ?? 30_000;

  server.tool(
    tool.name,
    tool.description,
    zodShape,
    async (params: Record<string, unknown>) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue(tool.name, async () => {
        const msg = messageBuilder(params);
        const result = await bridge.sendAndWait(msg, { timeout });
        return mapFSBError(result);
```

---

### `mcp-server/src/tools/autopilot.ts` (service/tool registration, streaming request-response)

**Analog:** `mcp-server/src/tools/autopilot.ts`

Preserve progress notification behavior exactly while routing `run_task` through the direct dispatcher to `handleStartAutomation` with `source: "mcp"`.

**Progress callback pattern** (`mcp-server/src/tools/autopilot.ts` lines 27-60):
```typescript
return queue.enqueue('run_task', async () => {
  const onProgress = (p: MCPResponse) => {
    const { progress, phase, eta, action, taskId } = p.payload as {
      taskId?: string; progress?: number; phase?: string; eta?: string; action?: string;
    };
    const message = [phase && `[${phase}]`, action, eta && `(ETA: ${eta})`]
      .filter(Boolean).join(' ');

    if (extra._meta?.progressToken !== undefined) {
      extra.sendNotification({
        method: 'notifications/progress',
        params: {
          progressToken: extra._meta.progressToken,
          progress: progress ?? 0,
          total: 100,
          message,
        },
      }).catch(() => {});
    }

    server.sendLoggingMessage({
      level: 'info',
      logger: 'fsb-autopilot',
      data: { taskId, progress, phase, eta, action },
    });
  };

  const result = await bridge.sendAndWait(
    { type: 'mcp:start-automation', payload: { task } },
    { timeout: 300_000, onProgress },
  );
  return mapFSBError(result);
});
```

---

### `mcp-server/ai/tool-definitions.cjs` / `ai/tool-definitions.js` (config/registry, transform)

**Analog:** `ai/tool-definitions.js`

`ai/tool-definitions.js` is the canonical source; `mcp-server/ai/tool-definitions.cjs` is copied during `npm --prefix mcp-server run build`. Avoid committing generated drift unless the source registry changes.

**Tool metadata pattern** (`ai/tool-definitions.js` lines 18-27):
```javascript
/**
 * @typedef {Object} ToolDefinition
 * @property {string} name - snake_case tool name (per D-01)
 * @property {string} description - When to use, what it does, related tools
 * @property {Object} inputSchema - JSON Schema object with type, properties, required
 * @property {'content'|'cdp'|'background'} _route - Execution route
 * @property {boolean} _readOnly - True for read-only tools that bypass mutation queue
 * @property {string|null} _contentVerb - FSB.tools key for content-routed tools
 * @property {string|null} _cdpVerb - executeCDPToolDirect switch case for CDP tools
 */
```

**Navigation background route pattern** (`ai/tool-definitions.js` lines 40-112):
```javascript
{
  name: 'navigate',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' }
    },
    required: ['url']
  },
  _route: 'background',
  _readOnly: false,
  _contentVerb: null,
  _cdpVerb: null
},
{
  name: 'go_back',
  inputSchema: { type: 'object', properties: {}, required: [] },
  _route: 'background',
  _readOnly: false,
  _contentVerb: null,
  _cdpVerb: null
}
```

**Registry helper pattern** (`ai/tool-definitions.js` lines 955-981):
```javascript
function getToolByName(name) {
  return TOOL_REGISTRY.find(t => t.name === name) || null;
}

function getReadOnlyTools() {
  return TOOL_REGISTRY.filter(t => t._readOnly);
}

function getToolsByRoute(route) {
  return TOOL_REGISTRY.filter(t => t._route === route);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOOL_REGISTRY, getToolByName, getReadOnlyTools, getToolsByRoute };
}
```

## Shared Patterns

### Route Source Of Truth

**Source:** `ai/tool-definitions.js` and `mcp-server/src/tools/schema-bridge.ts`
**Apply to:** Dispatcher and route coverage tests.

Public MCP tool names are snake_case; extension actions are camelCase/legacy. Use registry metadata and explicit internal alias maps rather than fuzzy matching.

```javascript
function getToolsByRoute(route) {
  return TOOL_REGISTRY.filter(t => t._route === route);
}
```

### Background Request Handling

**Source:** `background.js`
**Apply to:** Direct dispatcher background handlers.

Handlers use `try/catch`, `automationLogger`, and structured `{ success, ... }` responses. For direct functions, return the same payloads instead of sending them through `sendResponse`.

```javascript
try {
  const tab = await chrome.tabs.create({ url: url || 'about:blank', active: active !== false });
  sendResponse({ success: true, tabId: tab.id, url: tab.url, active: tab.active });
} catch (error) {
  automationLogger.error('Error opening new tab', { error: error.message });
  sendResponse({ success: false, error: error.message });
}
```

### Restricted Recovery

**Source:** `background.js` restricted URL helpers and `mcp-server/src/errors.ts`
**Apply to:** Restricted response builder and error mapping.

Blank/new-tab and blocked internal pages should advertise navigation/tab tools only for Phase 199: `navigate`, `open_tab`, `switch_tab`, `list_tabs`. Do not include `run_task` in restricted-page recovery lists for this phase.

### Progress Streaming

**Source:** `ws/mcp-bridge-client.js` and `mcp-server/src/tools/autopilot.ts`
**Apply to:** `run_task`, `run_agent`, and any route-dispatch refactor touching automation.

Keep `mcp:progress` payload shape: `taskId`, `progress`, `phase`, `eta`, `action`. Keep MCP server notification conversion in `autopilot.ts`.

### Security Boundaries

**Source:** `mcp-server/src/tools/vault.ts` and `ws/mcp-bridge-client.js`
**Apply to:** Vault/payment routes and tests.

Secrets stay extension-local. MCP responses return masked metadata only, and fill operations send raw secrets only from background to content script.

```typescript
// SECURITY: These tools are registered directly (not via TOOL_REGISTRY)
// to maintain an explicit security boundary. Raw secrets never traverse
// the WebSocket bridge -- only opaque IDs and masked metadata.
```

### Queue Semantics

**Source:** `mcp-server/src/queue.ts`
**Apply to:** Server-side tool route expectations.

Read-only tools bypass queue only if already in the registry/non-registry read-only set; mutation tools remain serialized.

```typescript
async enqueue<T>(toolName: string, fn: () => Promise<T>): Promise<T> {
  if (this.readOnlyTools.has(toolName)) {
    return fn();
  }

  return new Promise<T>((resolve, reject) => {
    this.queue.push({
      execute: fn as () => Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    this.process();
  });
}
```

## No Analog Found

None. The new shared dispatcher should copy the existing dispatcher/export style from `ai/tool-executor.js`; route tests should copy the VM harness from `tests/mcp-bridge-client-lifecycle.test.js`.

## Metadata

**Analog search scope:** `ws/`, `background.js`, `tests/`, `ai/`, `mcp-server/src/`, `mcp-server/ai/`
**Files scanned:** 443
**Pattern extraction date:** 2026-04-22T22:47:52Z
