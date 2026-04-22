# Phase 199: MCP Tool Routing Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `199-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-04-22T22:44:08Z
**Phase:** 199-mcp-tool-routing-contract
**Areas discussed:** Direct dispatcher shape, Browser/tab tool semantics, Autopilot and observability routes, Restricted-tab recovery tests

---

## Direct Dispatcher Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Strict allowlist | Every MCP route must be declared; unknown routes fail loudly. | yes |
| Flexible fallback | Unknown routes can still try legacy behavior. | |
| New small shared module | Loaded by `background.js` and used by `ws/mcp-bridge-client.js`. | yes |
| `ws/mcp-bridge-client.js` only | Keep dispatcher inside bridge client only. | |
| `background.js` only | Keep dispatcher inside background script only. | |
| Remove self-dispatch for Phase 199 routes | Leave unrelated extension messages alone. | yes |
| Remove all runtime sendMessage uses in MCP bridge paths | Broader cleanup. | |
| Keep self-dispatch fallback | Direct handler can fall back to legacy loopback. | |
| Structured MCP route error | Include tool name, route family, and recovery hint. | yes |
| Generic error | Throw less structured failures. | |
| Content-script fallback | Silently try content-script route if missing. | |

**User's choice:** all recommended
**Notes:** Locked strict route declaration, shared dispatcher module, Phase 199-scoped removal of self-dispatch, and structured missing-handler errors.

---

## Browser/tab Tool Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate active tab by default | Optional `tabId` only when explicitly provided. | yes |
| Always create a new tab | `navigate` creates a new tab by default. | |
| Smart routing pick/create/switch | Let task-intent heuristics pick destination behavior. | |
| Structured `navigation_unavailable` failure | History/reload failures return a clear error code and attempted verb. | yes |
| Treat no-op as success | Chrome doing nothing still counts as success. | |
| Raw Chrome error | Expose direct browser error. | |
| Open active by default | `open_tab` returns `tabId` and sanitized URL/domain/title. | yes |
| Open inactive by default | New tab does not become active. | |
| Return full raw tab object | Expose complete Chrome tab object. | |
| Explicit tab ID only | `switch_tab` requires a `tabId` from `list_tabs`. | yes |
| Title/domain matching | Allow fuzzy tab lookup. | |
| Auto-switch from task intent | Pick a tab based on current task context. | |
| Small structured payloads | Return `success`, `tool`, `tabId`, URL/domain, and `previousTabId` when applicable. | yes |
| Human-readable strings only | Return text instead of structured data. | |
| Full Chrome API objects | Return raw Chrome objects. | |

**User's choice:** all recommended
**Notes:** Browser route semantics should be predictable and explicit; fuzzy matching and smart tab management stay out of this phase.

---

## Autopilot And Observability Routes

| Option | Description | Selected |
|--------|-------------|----------|
| Use same internal `handleStartAutomation` path as UI | Direct dispatcher calls existing automation path with `source: "mcp"`. | yes |
| Separate MCP-only automation path | Build a new run path for MCP. | |
| Preserve progress notifications | Keep current MCP progress payload shape. | yes |
| Final result only | Remove progress streaming. | |
| Read-only handlers bypass mutation queue | Preserve current read-only/observability behavior. | yes |
| Queue all observability | Serialize read-only tools with mutation tools. | |
| Keep public MCP names stable | Map aliases internally where needed. | yes |
| Rename tools to extension internals | Change MCP names to match background functions. | |
| Preserve redaction/security boundaries | Route mechanics only. | yes |
| Expand diagnostic detail now | Return more logs/memory/session data in this phase. | |

**User's choice:** all recommended
**Notes:** Phase 199 should be behavior-compatible for `run_task`, status/progress, logs, sessions, and memory; the change is route mechanics.

---

## Restricted-tab Recovery Tests

| Option | Description | Selected |
|--------|-------------|----------|
| Blank/new-tab may advertise `run_task` | Smart start routing can choose a destination. | |
| Blank/new-tab recovery is navigation-first | Advertise navigation/tab recovery tools, not `run_task`. | yes |
| Blocked browser pages use only navigation/tab recovery tools | Settings/extensions/history/etc. omit `run_task`. | yes |
| Allow `run_task` everywhere | Even non-routable browser pages advertise it. | |
| Executable VM/module tests | Call actual dispatcher and restricted-response builder. | yes |
| Source string assertions | Keep current source-presence style. | |
| Public tool requires route/handler | Tests fail if registered tool lacks direct route. | yes |
| Test only currently broken routes | Narrower regression coverage. | |
| Structured errors and valid recovery tools only | Final wording deferred to Phase 200. | yes |
| Finalize all recovery copy now | Polish diagnostics in Phase 199. | |

**User's choice:** navigation-first for blank/new-tab; everything else recommended
**Notes:** User clarified: "if it's a blank page... then prolly navigating.. to a relevant site is the fallback." Confirmed that blank-page recovery should not advertise `run_task` in Phase 199.

---

## the agent's Discretion

- Exact shared dispatcher file name and function names.
- Exact test harness mechanics, as long as tests execute real route code.
- Exact structured error field names, provided they are stable and useful to Phase 200.

## Deferred Ideas

None.
