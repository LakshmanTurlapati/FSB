# Changelog

All notable changes to `fsb-mcp-server` are documented in this file. Each entry corresponds to a published npm release; FSB extension milestones map to MCP package versions in the entry header.

## 0.8.0 (2026-05-06)

Milestone: FSB v0.9.60 -- multi-agent contract, run_task return-on-completion, back tool, heartbeat, persistence with sw_evicted recovery.

### Multi-Agent Tab Concurrency

- New per-session/task `agent_id` minted by FSB via `crypto.randomUUID()`. MCP callers cannot supply IDs; the server captures the ID via the `agent:register` bridge route on first tool dispatch (Phases 237, 238).
- Configurable concurrency cap, default 8, range 1-64, persisted in `chrome.storage.local` under key `fsbAgentCap`. The (N+1)th agent claim rejects with typed error `AGENT_CAP_REACHED { cap, active }` (Phases 241 plan 01, 241 plan 03).
- Tab-ownership enforcement on every MCP tool dispatch via the gate in `extension/ws/mcp-tool-dispatcher.js`. Cross-agent calls reject with `TAB_NOT_OWNED`. Incognito tabs reject with `TAB_INCOGNITO_NOT_SUPPORTED`. Cross-window tabs reject with `TAB_OUT_OF_SCOPE` (Phase 240).
- Per-bindTab `ownership_token` (fresh `crypto.randomUUID()` per binding) prevents tab-ID-reuse exploitation when Chrome recycles a tab ID after close (Phase 240, validated Phase 244 plan 01 case 6).
- Forced-new-tab pooling via `chrome.tabs.onCreated + openerTabId`: opening a forced-new tab does NOT count as a new agent against the cap; the pool releases when its last tab closes (Phase 241 plan 02).
- Lock release on: task or session ends, MCP client disconnects after a 10s `RECONNECT_GRACE_MS` keyed by `connection_id`, user closes the tab. There is no idle timeout (Phase 241 plan 02 + 241 plan 03 LOCK-04 negative-invariant test).
- Service-worker eviction recovery: agent registry mirrors to `chrome.storage.session` write-through. On SW wake, `hydrate()` reconciles persisted records against `chrome.tabs.query()` and reaps ghost records before servicing any request (Phase 237 plan 03, validated Phase 244 plan 01 case 4).
- The full multi-agent contract is exercised end-to-end by `tests/multi-agent-regression.test.js` (6 cases, currently 6/6 green).

### `back` MCP Tool (BACK-01..05)

- New ownership-gated `back` tool: single-step browser-history back on the agent's owned tab (Phase 242).
- Structured result: `{ status, resultingUrl, historyDepth }` where `status` is one of `ok`, `no_history`, `cross_origin`, `bf_cache`, `fragment_only`.
- `pageshow`-based settle verification with a 2s timeout; cross-origin transitions reuse the v0.9.11 BF-cache resilience path to re-inject the content script.
- Background-tab compatible: does not steal focus.

### `run_task` Return-on-Completion (Phase 236 reborn -- MCP-03..06)

- `run_task` now returns when the underlying automation actually completes via `fsbAutomationLifecycleBus.dispatch('automationComplete')`, rather than at an arbitrary timer ceiling (Phase 239 plan 01).
- The 300s ceiling has been raised to a 600s safety net at both `mcp/src/tools/autopilot.ts` (`timeout: 600_000`) and `extension/ws/mcp-bridge-client.js` (`RUN_TASK_SAFETY_NET_MS = 600_000`). The safety net stays provisional until UAT proves zero dropped lifecycle events (Phase 239 plan 03).
- 30s heartbeat ticks emitted via `_sendProgress` and `notifications/progress`, carrying rich fields under `params._meta`: `alive`, `step`, `elapsed_ms`, `current_url`, `ai_cycles`, `last_action`. MCP host clients (Claude Code, Cursor, Codex, OpenClaw) no longer hit per-tool timeouts on long automations (Phase 239 plan 02).
- Task lifecycle persisted in `chrome.storage.session` keyed by `task_id`. On SW eviction during a long task, the bridge reconciles in-flight tasks on reconnect and the server emits a `partial_outcome` with `disposition: 'sw_evicted'` if the bridge cannot recover (Phase 239 plan 03 D-05/D-06).
- Bounded DoS mitigation on the post-eviction snapshot lookup: 30s reconnect grace at 250ms poll cadence + 5s `sendAndWait` timeout (Phase 239 plan 03, T-239-12).

### Tool Description Updates (MCP-07)

- Every manual tool description now documents that `agent_id` is FSB-issued and required, `tab_id` is agent-scoped, the cap is configurable, ownership is enforced, and the typed error codes the tool can return are enumerated (Phase 244 plan 02).
- `run_task`, `start_visual_session`, `end_visual_session`, `back`, `stop_task`, and `get_task_status` carry the full multi-agent contract block in their MCP-side description.

### UI / Observability

- Background-tab badge (the v0.9.36 trusted-client overlay) extended with a short `agent_id` suffix, e.g. `Claude / agent_a3f1`, on the page overlay and dashboard mirror (Phase 243 plan 03 UI-01).
- Sidepanel and popup show a read-only "owned by Agent X" chip on owned tabs. Visibility only -- no enforcement decision is made in the UI; the gate lives in `mcp-tool-dispatcher.js` (Phase 243 plan 03 UI-02).
- `control_panel.html` (Advanced Settings) exposes an Agent Concurrency card: numeric input 1-64, default 8, current-active counter, helper text, and a Reset to default button. Three-layer numeric clamping is in place: HTML min/max + JS input handler + SW `setCap` (Phase 241 plan 03 UI-03).

### Background-Tab Execution

- Audited 25+ MCP and autopilot tools for `chrome.tabs.update({active: true})` and `chrome.windows.update({focused: true})` side effects. Tools that genuinely require focus opt in via a per-tool `_forceForeground` flag in `tool-definitions.js`. Default is `false`; only `switch_tab` opts in. All other tools execute on background tabs without focus-stealing (Phase 243 plan 01 BG-01).
- The dispatcher gate lives in both `extension/ws/mcp-tool-dispatcher.js` `handleSwitchTabRoute` and `extension/ai/tool-executor.js` `case 'switch_tab'`, looked up via `_mcp_getToolByName` / `_te_getToolByName`.
- `webNavigation.onCommitted` detects user-initiated navigation on agent-owned tabs and emits a pause signal so that an in-flight automation does not race a manual user action (Phase 243 plan 02 BG-04).

### Dependencies

- `@modelcontextprotocol/sdk` upgraded from `^1.27.1` to `^1.29.0`. Build is clean against the new SDK; no TypeScript breakage from the minor bump.
- `zod` stays on `^3.x`. `ws`, `strip-json-comments`, `smol-toml`, and `yaml` are unchanged.

### Migration Notes

- Existing single-agent surfaces (popup, sidepanel, autopilot) continue to work unchanged via synthesized `agent_id = 'legacy:<surface>'`. There is no v0.9.36 / v0.9.50 regression.
- MCP clients that currently send an `agent_id` field will have it ignored. The server captures the authoritative ID via `agent:register` and reflects it on the response so the client-side `AgentScope` can pin it for the lifetime of the connection.
- The default cap of 8 is sufficient for almost all multi-agent workflows. Raise it via the Agent Concurrency card in `control_panel.html` if needed (range 1-64).
- The `back` tool is additive. Clients that previously chained `execute_js("history.back()")` will keep working, but the typed `back` tool returns the structured status field and is the recommended path going forward.

### Tests

- New: `tests/multi-agent-regression.test.js` (6 cases) -- the v0.9.60 contract regression suite.
- Updated: every Phase 237-243 test passes UNCHANGED against this 0.8.0 build (per Phase 244 VALIDATION.md SC#1).

## 0.7.4 (prior release)

See the README "What's New In v0.7.4" section for details. Headline items:

- Bridge lifecycle reconnect across service worker wakes.
- Hub/relay coordination for multiple MCP server instances.
- Route-aware tool dispatch and centralized parameter mapping.
- Layered diagnostics through `doctor` and `status --watch`.
- Persistent visual session glow across content script reinjection.
- Secure vault tools that avoid sending raw secrets over the bridge.
- One-command installer coverage for 21 platforms.
