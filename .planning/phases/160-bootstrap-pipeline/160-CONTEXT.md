# Phase 160: Bootstrap Pipeline - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Structure service worker startup into 4 explicit ordered phases with deferred initialization for non-essential I/O-bound subsystems. Consolidate the currently scattered init logic (top-level restoreSessionsFromStorage, onInstalled, onStartup) into a single `swBootstrap()` entry point. Defer WebSocket connect and analytics initialization until first user interaction. No new user-facing capabilities -- this is internal architecture reorganization.

</domain>

<decisions>
## Implementation Decisions

### Bootstrap phase structure
- **D-01:** 4-Phase Sequential bootstrap. A single `swBootstrap()` async function replaces the scattered init across top-level code, `onInstalled`, and `onStartup`. Four named phases run in order:
  1. **SETTINGS** -- `chrome.storage.local.get` for debug mode, UI mode, model prefs
  2. **ENVIRONMENT** -- Capability detection, `chrome.sidePanel.setPanelBehavior`, content script file list
  3. **TOOLS** -- Hook pipeline factory registration (`createSessionHooks`), agent scheduler setup
  4. **SESSIONS** -- `restoreSessionsFromStorage()` with auto-resumption (Phase 159 D-03)

  Dependencies flow in order: settings before environment (side panel reads UI mode), environment before tools (hook pipeline needs engine config), tools before sessions (auto-resumption calls `runAgentLoop` which needs the hook factory). A `_bootstrapDone` boolean guard prevents double-init when both `onStartup` and bare-wake fire.

### Deferred init boundary
- **D-02:** Defer only the two modules that perform I/O at startup:
  1. **`fsbWebSocket.connect()`** -- HTTP fetch + WebSocket TCP connection on every SW wake
  2. **`BackgroundAnalytics` constructor** -- immediate `chrome.storage.local.get` in constructor

  Everything else stays eager:
  - Site guides (~130 importScripts) -- cheap synchronous registry pushes, no I/O
  - Memory modules (8 files) -- synchronous constructors, lazy storage reads on first method call
  - Tool definitions, AI integration, session schema, hook pipeline -- needed on hot path
  - Agent scheduler `rescheduleAllAgents()` -- stays in TOOLS phase (needs to fire on every wake for scheduled agents)

  Analytics becomes lazy-instantiated via `getAnalytics()` guard pattern. WebSocket connect moves behind `ensureWsConnected()` guard.

### First interaction trigger
- **D-03:** Deferred init triggered by first `chrome.runtime.onMessage` from a UI surface. Both popup.js and sidepanel.js send `getStatus` on DOMContentLoaded -- fires before user types, giving several seconds of warm-up before first task. Implementation: idempotent `_deferredInitDone` boolean guard called at the top of the onMessage handler for UI-originating messages. Secondary trigger inside `handleStartAutomation` covers MCP-initiated sessions. Non-UI wakes (alarms, content-stt broadcasts, MCP bridge traffic) do not trigger deferred init.

### Startup debuggability
- **D-04:** Use existing `automationLogger.logInit(phase, status, { durationMs })` for each of the 4 bootstrap phases. Each phase logs `'start'` and `'complete'` (or `'failed'` on error). `Date.now()` deltas provide wall-clock timing. Explicit `automationLogger.flush()` call at the end of `swBootstrap()` ensures the last phase log is persisted before any potential SW kill. No new infrastructure needed -- `logInit` already routes `'failed'` to `console.error` and persists to `chrome.storage.local`.

### Claude's Discretion
- Exact refactoring of `onInstalled` vs `onStartup` handlers (what stays in each vs moves into `swBootstrap`)
- Whether `swBootstrap()` is called from both handlers or replaces them
- How `getAnalytics()` lazy guard integrates with the 4 existing `initializeAnalytics()` call sites
- Whether `ensureWsConnected()` is called inside the deferred init function or at each WS-needing call site
- Internal structure of the `_deferredInitDone` guard (whether it's a bare boolean or a small module)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Claude Code reference source
- `Research/claude-code/src/bootstrap_graph.py` -- Bootstrap stage ordering pattern (7 stages, sequential)
- `Research/claude-code/src/deferred_init.py` -- Deferred init pattern: trust-gated lazy loading with DeferredInitResult

### Research artifacts
- `.planning/research/SUMMARY.md` -- Synthesized architecture recommendations
- `.planning/research/PITFALLS.md` -- Pitfall 6 (deferred init can stall first command -- keep eager loading for tool defs and core modules)

### Phase 156-159 outputs (dependencies already wired)
- `ai/session-schema.js` -- createSession(), getWarmFields(), SESSION_STATUSES
- `ai/hook-pipeline.js` -- HookPipeline with register/emit, LIFECYCLE_EVENTS
- `ai/hooks/safety-hooks.js` -- createSafetyBreakerHook, createStuckDetectionHook
- `ai/hooks/permission-hook.js` -- createPermissionHook
- `ai/hooks/progress-hook.js` -- createToolProgressHook, createIterationProgressHook, createCompletionProgressHook, createErrorProgressHook
- `ai/engine-config.js` -- SESSION_DEFAULTS, EXECUTION_MODES, loadSessionConfig

### FSB source (primary modification target)
- `background.js` -- 10,923 lines, 184 importScripts, scattered init across lines 2950, 10103-10132, 10135-10147
- `utils/automation-logger.js` -- logInit method used for bootstrap phase debugging

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `automationLogger.logInit(component, status, details)` -- already supports the exact contract needed for bootstrap phase logging
- `createSessionHooks()` at background.js:250 -- hook pipeline factory, belongs in TOOLS phase
- `restoreSessionsFromStorage()` at background.js:2848 -- session restoration with auto-resumption, belongs in SESSIONS phase

### Established Patterns
- `importScripts()` with `typeof` guards for dual Chrome/Node compatibility (must stay synchronous top-level)
- `var` declarations for shared-scope globals (importScripts context)
- Idempotent guard pattern already used elsewhere (e.g., `_sttActiveTabId` null checks)

### Integration Points
- `chrome.runtime.onInstalled` (line 10103) -- currently does analytics, debug mode, UI mode, sidePanel, agents, WS
- `chrome.runtime.onStartup` (line 10135) -- currently does analytics, debug mode, session restore, agents, WS
- Top-level `restoreSessionsFromStorage()` (line 2950) -- bare-wake session restoration
- `chrome.runtime.onMessage` handler -- entry point for deferred init trigger

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 160-bootstrap-pipeline*
*Context gathered: 2026-04-02*
