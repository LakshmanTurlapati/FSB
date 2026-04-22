# Phase 199: MCP Tool Routing Contract - Context

**Gathered:** 2026-04-22T22:44:08Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 199 replaces fragile MCP tool loopback behavior with explicit, verified route handling for existing browser, autopilot, observability, and restricted-page recovery tools.

This phase does not add new MCP capabilities, reopen Phase 198 bridge lifecycle/topology work, change public MCP tool names, or expand sensitive vault/payment data exposure. It clarifies how existing tools reach their intended extension handlers and how tests prove that contract.

</domain>

<decisions>
## Implementation Decisions

### Direct Dispatcher Shape
- **D-01:** Use a strict allowlist for Phase 199 MCP routes. Every supported MCP route must be declared; unknown or missing routes fail loudly.
- **D-02:** Implement the dispatcher as a small shared module loaded by `background.js` and used by `ws/mcp-bridge-client.js`, rather than burying the route table only in one large file.
- **D-03:** Remove `chrome.runtime.sendMessage` self-dispatch for Phase 199-owned MCP routes only. Leave unrelated extension messages and broadcasts alone.
- **D-04:** Missing direct handlers return a structured MCP route error that includes tool name, route family, and a recovery hint. Do not silently fall back to content-script routing.

### Browser And Tab Tool Semantics
- **D-05:** `navigate` navigates the active tab by default. It may accept an explicit `tabId` only when provided by the MCP caller.
- **D-06:** `go_back`, `go_forward`, and `refresh` return structured failures such as `errorCode: "navigation_unavailable"` when Chrome cannot perform the requested action.
- **D-07:** `open_tab` opens active by default and returns a small sanitized payload including `tabId` plus URL, domain, and title when available.
- **D-08:** `switch_tab` requires an explicit tab ID from `list_tabs`. No fuzzy title/domain matching or task-intent auto-switching belongs in Phase 199.
- **D-09:** Browser/tab route responses should be small structured payloads: `success`, `tool`, `tabId`, URL/domain, and `previousTabId` where applicable. Do not return raw Chrome tab objects.

### Autopilot And Observability Routes
- **D-10:** `run_task` uses the same internal `handleStartAutomation` path as the UI, through the direct dispatcher with `source: "mcp"`.
- **D-11:** Preserve current MCP progress notification behavior and payload shape. Phase 199 must not simplify `run_task` into final-result-only behavior.
- **D-12:** Observability and read-only routes remain read-only and bypass mutation serialization where they already do.
- **D-13:** Keep public MCP tool names stable. Map aliases internally where needed, such as `get_session_detail` to the existing `mcp:get-session` bridge message.
- **D-14:** Preserve existing redaction and security boundaries for logs, memory, sessions, credentials, and payments. Phase 199 changes route mechanics only.

### Restricted-Tab Recovery
- **D-15:** Restricted-page recovery is navigation-first. Blank/new-tab pages should advertise `navigate`, `open_tab`, `switch_tab`, and `list_tabs`, not `run_task`.
- **D-16:** Blocked browser-internal pages such as settings, extensions, history, downloads, and similar pages should also advertise only navigation/tab recovery tools, not `run_task`.
- **D-17:** Replace source-string assertions in restricted-tab tests with executable VM/module tests that call the actual dispatcher and restricted-response builder.
- **D-18:** Route coverage tests must fail if a public MCP tool is registered but missing a direct route or handler.
- **D-19:** Phase 199 owns structured error codes and valid recovery tool lists. Phase 200 owns final polished diagnostic wording.

### the agent's Discretion
- Exact file/module name for the new shared dispatcher.
- Exact helper names and payload field ordering.
- Whether test harnesses use `vm.runInNewContext`, direct module imports, or both, as long as they execute real route code.
- Exact route-family labels in structured errors, as long as they are stable and useful to Phase 200 diagnostics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Requirements
- `.planning/ROADMAP.md` - Phase 199 goal, dependency on Phase 198, and success criteria.
- `.planning/REQUIREMENTS.md` - ROUTE-01 through ROUTE-04 requirements and milestone boundaries.
- `.planning/STATE.md` - Current focus, prior decisions, and active concern that `tests/mcp-restricted-tab.test.js` currently fails 9 assertions.

### Prior Phase Constraints
- `.planning/phases/198-mcp-bridge-lifecycle-reconnect-state/198-VERIFICATION.md` - Confirms bridge lifecycle/topology is complete and should not be reopened.
- `.planning/phases/198-mcp-bridge-lifecycle-reconnect-state/198-SECURITY.md` - Security boundary for Phase 198 bridge changes, including accepted localhost trust model and non-secret lifecycle state.
- `.planning/phases/198-mcp-bridge-lifecycle-reconnect-state/198-01-PLAN.md` - Explicitly defers route-contract assertions to Phase 199.
- `.planning/phases/198-mcp-bridge-lifecycle-reconnect-state/198-02-PLAN.md` - Explicitly says not to change MCP tool routing in Phase 198 because Phase 199 owns it.
- `.planning/phases/198-mcp-bridge-lifecycle-reconnect-state/198-03-PLAN.md` - Requires preserving Phase 199 route behavior while implementing topology.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp-server/src/tools/schema-bridge.ts` exposes the canonical `TOOL_REGISTRY`, route metadata, read-only markers, and parameter transforms that can drive route coverage tests.
- `mcp-server/src/tools/manual.ts` already funnels manual tools through `mcp:execute-action` and `TaskQueue`; Phase 199 should preserve public tool registration while changing extension-side route mechanics.
- `mcp-server/src/tools/autopilot.ts` already preserves MCP progress notifications for `run_task`; the direct dispatcher must keep that bridge message shape intact.
- `mcp-server/src/tools/observability.ts` and `mcp-server/src/tools/read-only.ts` already define read-only/observability server-side behavior that should remain behavior-compatible.
- `mcp-server/src/errors.ts` already maps restricted-page errors and recovery hints; Phase 199 should feed it structured route errors and valid recovery tools, while Phase 200 can refine copy.
- `tests/mcp-restricted-tab.test.js` is the current route-regression target. It currently uses source-string assertions and fails 9 assertions, so it should be converted into executable contract coverage.

### Established Patterns
- Plain Node assertion scripts are the current focused-test pattern (`tests/mcp-bridge-client-lifecycle.test.js`, `tests/mcp-bridge-topology.test.js`, `tests/mcp-restricted-tab.test.js`).
- The MCP bridge client currently routes by message type in `ws/mcp-bridge-client.js`, with background routes still using `_dispatchToBackground()` and `chrome.runtime.sendMessage` loopback.
- Public MCP tool names are snake_case and must remain stable; internal extension verbs are mixed camelCase and older names, so direct mapping is expected.
- Phase 198 established strict separation between bridge lifecycle/topology and tool routing. Planning should keep Phase 199 scoped to route contracts.

### Integration Points
- `ws/mcp-bridge-client.js` `_routeMessage()`, `_handleExecuteAction()`, `_handleExecuteBackground()`, `_handleStartAutomation()`, `_handleStopAutomation()`, `_handleGetStatus()`, and observability handlers.
- `background.js` message handlers and internal functions such as `handleStartAutomation`, `handleStopAutomation`, status/session/log/memory handlers, tab handlers, and restricted URL helpers.
- `mcp-server/src/tools/manual.ts`, `autopilot.ts`, `observability.ts`, `read-only.ts`, and `queue.ts` for server-side route expectations and read-only queue behavior.
- `mcp-server/ai/tool-definitions.cjs` and source registry generation for route metadata; avoid committing generated drift unless the source-of-truth requires it.
- `tests/mcp-restricted-tab.test.js` and likely new route-contract tests for executable route coverage.

</code_context>

<specifics>
## Specific Ideas

- The user specifically clarified that blank/new-tab recovery should fall back to navigating to a relevant site first. Do not advertise `run_task` as the blank-page recovery fallback in Phase 199.
- The user accepted recommended defaults for strict route declaration, shared dispatcher, structured route errors, explicit tab IDs, and preserving public MCP names/security boundaries.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 199 scope.

</deferred>

---

*Phase: 199-mcp-tool-routing-contract*
*Context gathered: 2026-04-22*
