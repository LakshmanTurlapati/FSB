---
phase: 199-mcp-tool-routing-contract
verified: 2026-04-23T00:11:03Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 199: MCP Tool Routing Contract Verification Report

**Phase Goal:** Every MCP tool reaches the intended extension handler through explicit route mapping instead of accidental message-loop behavior.
**Verified:** 2026-04-23T00:11:03Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `navigate`, `go_back`, `go_forward`, `refresh`, `open_tab`, and `switch_tab` execute in background context with correct verb names. | VERIFIED | `MCP_PHASE199_TOOL_ROUTES` maps these public names to browser handlers in `ws/mcp-tool-dispatcher.js:14`; handlers call `chrome.tabs.update`, `goBack`, `goForward`, `reload`, `create`, and `windows.update` at `ws/mcp-tool-dispatcher.js:265`. Spot-check confirmed `navigate` calls `chrome.tabs.update` and returns sanitized metadata. |
| 2 | `run_task`, `stop_task`, `get_task_status`, `get_logs`, `list_sessions`, and memory/session reads return through stable internal handlers. | VERIFIED | Public aliases in `ws/mcp-tool-dispatcher.js:23` route to message handlers in `ws/mcp-tool-dispatcher.js:45`; bridge handlers call `dispatchMcpMessageRoute()` at `ws/mcp-bridge-client.js:595`, `658`, `667`, `693`, `702`, `711`, `720`, and `729`. Negative grep found no Phase 199 autopilot/observability `_dispatchToBackground` calls. |
| 3 | Public MCP names remain stable through explicit aliases. | VERIFIED | `getMcpRouteContracts()` reports stable tool aliases for `run_task`, `stop_task`, `get_task_status`, `get_session_detail`, `get_memory_stats`, `read_page`, and `get_dom_snapshot`; `node tests/mcp-tool-routing-contract.test.js` passed 130/130. |
| 4 | `run_task` uses the existing automation start path with `source: 'mcp'` and preserves MCP progress payload shape. | VERIFIED | `handleStartAutomationRoute()` invokes `handleStartAutomation` with `action: 'startAutomation'`, active `tabId`, and `source: 'mcp'` at `ws/mcp-tool-dispatcher.js:536`; `_sendProgress()` sends `{ taskId, progress, phase, eta, action }` at `ws/mcp-bridge-client.js:624`; lifecycle regression passed. |
| 5 | Restricted-tab responses distinguish blank/new-tab routing from non-routable browser pages and advertise only valid recovery tools. | VERIFIED | `MCP_NAVIGATION_RECOVERY_TOOLS` is `['navigate', 'open_tab', 'switch_tab', 'list_tabs']`; `isRestrictedMcpUrl()` covers `about:blank`, `about:newtab`, `chrome://newtab/`, settings, extensions, history, downloads, and restricted protocols at `ws/mcp-tool-dispatcher.js:207`. Restricted test passed 74/74 and asserts no `run_task`. |
| 6 | Restricted `mcp:read-page` and `mcp:get-dom` return before content-script dispatch. | VERIFIED | `dispatchMcpMessageRoute()` calls `buildRestrictedResponseIfReadRoute()` before route handlers or helper dispatch at `ws/mcp-tool-dispatcher.js:120`; the restricted test installs failing content-dispatch stubs and passes for both route types across six restricted URLs. |
| 7 | MCP route tests execute actual dispatcher code rather than checking source strings. | VERIFIED | `tests/mcp-tool-routing-contract.test.js` requires `ws/mcp-tool-dispatcher.js` and calls `getMcpRouteContracts`, `hasMcpToolRoute`, and `hasMcpMessageRoute`; `tests/mcp-restricted-tab.test.js` calls `dispatchMcpMessageRoute()` for real read/content routes. No `backgroundSource.includes` assertions remain. |
| 8 | MCP route tests fail if a route is missing even when source strings happen to exist. | VERIFIED | Route-contract test iterates required public routes, required message routes, and `TOOL_REGISTRY.filter(tool => tool._route === 'background')`, excluding only vault fill tools per phase scope. Missing dispatcher load or missing route causes assertion failure. |
| 9 | The shared dispatcher is strict and returns structured route errors for unsupported routes. | VERIFIED | Unknown tool/message routes return `mcp_route_unavailable` with `tool`, `routeFamily`, `recoveryHint`, and `error` from `createMcpRouteError()` at `ws/mcp-tool-dispatcher.js:55`. Spot-check for `missing_tool` returned the expected structured error; `mapFSBError()` maps `mcp_route_unavailable` in `mcp-server/src/errors.ts:10`. |
| 10 | Browser/tab, log, session, and memory responses are sanitized, bounded, and read-only. | VERIFIED | Browser tab responses use `sanitizeTab()` / `sanitizeSingleTab()`; logs filter `prompt` and `rawResponse`, cap to 200, and sanitize values; session detail removes raw logs/action history and rebuilds bounded action metadata; memory text is capped to 500 chars. Redaction regression passed in `tests/mcp-tool-routing-contract.test.js`. |
| 11 | Phase 199-owned bridge-client routes no longer self-dispatch through `chrome.runtime.sendMessage`, while out-of-scope vault/agent routes are left alone. | VERIFIED | `_handleExecuteBackground()` calls `dispatchMcpToolRoute()` for allowlisted Phase 199 tools at `ws/mcp-bridge-client.js:480`; remaining `_dispatchToBackground()` calls are for agent and vault/payment handlers outside Phase 199. `background.js` imports `ws/mcp-tool-dispatcher.js` before `ws/mcp-bridge-client.js` at `background.js:10`. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/mcp-tool-routing-contract.test.js` | Executable route-contract coverage for ROUTE-01, ROUTE-02, and ROUTE-04 | VERIFIED | Exists, substantive, wired into `package.json`, and passed 130/130. It imports dispatcher and registry code and asserts actual route contracts. |
| `tests/mcp-restricted-tab.test.js` | Executable restricted recovery coverage for ROUTE-03 | VERIFIED | Exists, substantive, calls `dispatchMcpMessageRoute()` for `mcp:read-page` and `mcp:get-dom`, asserts navigation-only recovery and no `run_task`, and passed 74/74. |
| `package.json` | Focused route-contract test included in root `npm test` | VERIFIED | Test script includes lifecycle, topology, route-contract, and restricted-tab tests after MCP build. |
| `ws/mcp-tool-dispatcher.js` | Shared direct dispatcher allowlist and handlers | VERIFIED | Exists, 779 lines, exports route contracts, strict dispatch functions, browser/tab handlers, autopilot handlers, observability handlers, restricted recovery builder, and CommonJS/global exports. |
| `background.js` | Dispatcher import before bridge client | VERIFIED | Imports `ws/mcp-tool-dispatcher.js` at line 10 before `ws/mcp-bridge-client.js` at line 21; Phase 198 `armMcpBridge(reason)` remains intact. |
| `ws/mcp-bridge-client.js` | Bridge direct route usage and progress preservation | VERIFIED | Read routes, background tools, autopilot, site guide, memory, sessions, logs, and memory search route through dispatcher calls; progress notification payload is preserved. |
| `mcp-server/src/errors.ts` | Structured route and restricted recovery error mapping | VERIFIED | Defines `mcp_route_unavailable`, consumes `validRecoveryTools`, filters `run_task`, and maps restricted recovery to navigation/tab tools. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/mcp-tool-routing-contract.test.js` | `ws/mcp-tool-dispatcher.js` | CommonJS import and route contract calls | VERIFIED | `dispatcherRelativePath = 'ws/mcp-tool-dispatcher.js'`; calls exported contract functions and dispatcher. |
| `tests/mcp-tool-routing-contract.test.js` | `ai/tool-definitions.js` | Registry-driven public background route coverage | VERIFIED | Loads `TOOL_REGISTRY`, checks all public background tools except explicit vault exclusions. |
| `tests/mcp-restricted-tab.test.js` | `ws/mcp-tool-dispatcher.js` | Real restricted read/content route calls | VERIFIED | Calls `dispatchMcpMessageRoute()` for `mcp:read-page` and `mcp:get-dom` under restricted active tabs. |
| `tests/mcp-restricted-tab.test.js` | `mcp-server/build/errors.js` | Built server error mapper import | VERIFIED | Dynamically imports `mapFSBError` after MCP build and verifies valid recovery tool text. |
| `background.js` | `ws/mcp-tool-dispatcher.js` | `importScripts` before bridge client | VERIFIED | Manual grep confirms import order; gsd key-link regex had false negatives because of escaping, but source evidence is direct. |
| `ws/mcp-bridge-client.js` | `ws/mcp-tool-dispatcher.js` | `dispatchMcpToolRoute` and `dispatchMcpMessageRoute` | VERIFIED | `_handleExecuteBackground`, `_routeMessage`, `_handleGetTabs`, and Phase 199 message handlers call dispatcher functions. |
| `ws/mcp-tool-dispatcher.js` | Chrome tab/window APIs | Direct browser/tab handlers | VERIFIED | Handlers call `chrome.tabs.update`, `goBack`, `goForward`, `reload`, `create`, `query`, `get`, and `chrome.windows.update`. |
| `ws/mcp-tool-dispatcher.js` | `background.js` automation handlers | Callback-style direct handler invocation | VERIFIED | `callCallbackHandler()` resolves `handleStartAutomation` / `handleStopAutomation`; `run_task` supplies `source: 'mcp'`. |
| `mcp-server/src/errors.ts` | Restricted-tab tests | `validRecoveryTools`-driven mapping | VERIFIED | Error mapper uses `validRecoveryTools`, filters `run_task`, and restricted test confirms output. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ws/mcp-tool-dispatcher.js` | Browser/tab results | Live `chrome.tabs` and `chrome.windows` APIs | Yes - route handlers call Chrome APIs and return sanitized fields, not static payloads. | VERIFIED |
| `ws/mcp-tool-dispatcher.js` | Autopilot start/stop/status | `handleStartAutomation`, `handleStopAutomation`, and `activeSessions` | Yes - existing background automation callbacks and session map feed responses. | VERIFIED |
| `ws/mcp-bridge-client.js` | MCP progress payload | Runtime automation progress/completion messages | Yes - listener normalizes `message.type || message.action`; lifecycle test proves progress and completion flow. | VERIFIED |
| `ws/mcp-tool-dispatcher.js` | Sessions/logs | `automationLogger.listSessions`, `loadSession`, `getSessionLogs`, `getRecentLogs` | Yes - live logger methods feed capped/sanitized response data. | VERIFIED |
| `ws/mcp-tool-dispatcher.js` | Memory search/stats | `memoryManager.search` and `memoryManager.getAll` | Yes - live memory manager APIs feed capped results and stats. | VERIFIED |
| `ws/mcp-tool-dispatcher.js` | Restricted active-tab response | Active tab URL from client or `chrome.tabs.query` | Yes - route guard inspects actual active tab URL before helper/content dispatch. | VERIFIED |
| `mcp-server/src/errors.ts` | Recovery text | Extension result fields: `errorCode`, `validRecoveryTools`, `tool`, `routeFamily`, `recoveryHint` | Yes - `mapFSBError()` maps structured route/restricted errors into MCP text. | VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MCP server source builds | `npm --prefix mcp-server run build` | Exit 0 | PASS |
| Dispatcher syntax is valid | `node --check ws/mcp-tool-dispatcher.js` | Exit 0 | PASS |
| Bridge client syntax is valid | `node --check ws/mcp-bridge-client.js` | Exit 0 | PASS |
| Background syntax is valid | `node --check background.js` | Exit 0 | PASS |
| Full Phase 199 route contract passes | `node tests/mcp-tool-routing-contract.test.js` | 130 passed, 0 failed | PASS |
| Restricted recovery contract passes | `node tests/mcp-restricted-tab.test.js` | 74 passed, 0 failed | PASS |
| MCP progress event shape remains stable | `node tests/mcp-bridge-client-lifecycle.test.js` | 35 passed, 0 failed | PASS |
| Phase 198 topology still passes | `node tests/mcp-bridge-topology.test.js` | 18 passed, 0 failed | PASS |
| Missing tool route returns structured error | Node spot-check of `dispatchMcpToolRoute({ tool: 'missing_tool' })` | `mcp_route_unavailable`, `tool`, `routeFamily` present | PASS |
| `mcp_route_unavailable` maps through MCP error mapper | Node spot-check of `mapFSBError()` | Output includes tool, family, and recovery hint | PASS |
| Direct navigation route executes Chrome tab verb | Node Chrome mock spot-check of `navigate` | Calls `chrome.tabs.update`; returns sanitized `tabId`/domain | PASS |

Root `npm test` was not rerun as a pass/fail gate because `.planning/phases/199-mcp-tool-routing-contract/deferred-items.md` documents a pre-existing unrelated `tests/runtime-contracts.test.js` failure around `SessionStateEmitter` / `sessionStateEvent`. The focused Phase 199 gate passed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ROUTE-01 | 199-01, 199-02 | MCP background-routed browser tools execute through a direct internal dispatcher with verified verb mapping. | SATISFIED | Browser/tab tools are declared in `MCP_PHASE199_TOOL_ROUTES`, implemented with Chrome tab/window APIs, wired through `_handleExecuteBackground()`, and covered by route-contract tests. |
| ROUTE-02 | 199-01, 199-02, 199-03 | MCP autopilot and observability tools do not depend on fragile `chrome.runtime.sendMessage` self-dispatch. | SATISFIED | Autopilot, status, site guide, logs, sessions, and memory bridge handlers call `dispatchMcpMessageRoute()`; negative grep found no Phase 199 `_dispatchToBackground` self-dispatch for those route names. |
| ROUTE-03 | 199-01, 199-03 | Restricted-tab MCP recovery returns accurate next actions for blank/new-tab pages versus non-routable browser-internal pages. | SATISFIED | Dispatcher detects restricted active tabs before content dispatch and returns `validRecoveryTools` of navigation/tab tools only; server mapper also omits `run_task`; restricted test passed. |
| ROUTE-04 | 199-01, 199-02, 199-03 | MCP routing regression tests assert executable route contracts rather than only checking string mentions. | SATISFIED | Tests import/call dispatcher exports and route functions; missing routes fail contract assertions even if source strings exist. |

All requirement IDs declared in Phase 199 plan frontmatter are present in `.planning/REQUIREMENTS.md` and mapped to Phase 199. No orphaned Phase 199 requirements were found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None blocking | - | - | - | Stub scan found only benign test logging, nullable/default state, and unrelated pre-existing background comments/placeholders. No Phase 199 hollow data path, missing handler, or orphaned dispatcher artifact was found. |
| `ws/mcp-bridge-client.js` | 466 | Stale comment says background tools dispatch via `chrome.runtime.sendMessage` | INFO | Code below the comment routes allowlisted Phase 199 tools through `dispatchMcpToolRoute()` and leaves only out-of-scope vault/agent paths on `_dispatchToBackground`; no goal impact. |

### Human Verification Required

None for Phase 199. The route contract, restricted recovery behavior, progress payload shape, and focused bridge/topology regressions are covered by automated executable checks. Broader live cross-host smoke/UAT is explicitly owned by later Phase 202.

### Gaps Summary

No Phase 199 gaps found. The implementation satisfies the roadmap success criteria and all ROUTE-01 through ROUTE-04 requirements with substantive, wired, data-flowing code and focused automated verification. The documented root `npm test` runtime-contract failure remains unrelated deferred work and does not block this phase goal.

---

_Verified: 2026-04-23T00:11:03Z_
_Verifier: Claude (gsd-verifier)_
