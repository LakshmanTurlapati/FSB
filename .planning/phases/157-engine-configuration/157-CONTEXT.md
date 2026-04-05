# Phase 157: Engine Configuration - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract cost tracking, session limits, permission gating, and execution mode definitions from inline agent-loop.js/background.js code into standalone modules. Delivers: cost tracker with MODEL_PRICING extraction, engine config with all session limits and execution mode objects, and permission context stub. Tool pool filtering is explicitly deferred -- getPublicTools() stays inline. No new user-facing capabilities -- this is internal architecture extraction.

</domain>

<decisions>
## Implementation Decisions

### Tool pool filtering
- **D-01:** Do NOT create a tool pool module. Keep `getPublicTools()` inline in agent-loop.js. Continue sending all 42 tools on every API call. Task-type-based filtering is deferred to a future milestone.

### Permission model
- **D-02:** Create `ai/permission-context.js` as a minimal stub. `PermissionContext` class with `isAllowed(toolName, origin)` interface that always returns true for now. The interface is ready for future deny-list rules using Chrome match patterns.
- **D-03:** When permission rules are eventually configured, they will be stored in `chrome.storage.local`. The Options page will manage them. Same storage pattern as costLimit/timeLimit.

### Cost tracker extraction
- **D-04:** Pure extraction only. Move `estimateCost()`, `MODEL_PRICING`, and cost accumulation logic from agent-loop.js into `ai/cost-tracker.js`. `CostTracker` class tracks session cost, exposes `checkBudget()`. No new capabilities (no budget warnings, no per-tool tracking).

### Session limits / Engine config
- **D-05:** Create `ai/engine-config.js` as a separate module for all session limits (costLimit, timeLimit, maxIterations, compactThreshold). Cost tracker reads limits from this module. Single source for all configurable constants currently hardcoded across agent-loop.js and background.js.

### Execution mode formalization
- **D-06:** Define `EXECUTION_MODES` constant with named mode objects inside `ai/engine-config.js`. Each mode has `{ name, safetyLimits, uiFeedbackChannel, description }`. Session creation reads mode and applies per-mode config. Mirrors Claude Code's direct_modes.py pattern.
- **D-07:** Execution modes live in engine-config.js alongside session limits (not a separate file). Keeps module count low.

### Claude's Discretion
- Exact fields on each EXECUTION_MODES mode object (what constitutes the per-mode config)
- CostTracker class internal design (whether it holds state or is stateless with external accumulation)
- How engine-config loads defaults vs chrome.storage.local overrides (eagerly at import vs lazily on session start)
- Whether checkSafetyBreakers() moves to cost-tracker or stays in agent-loop.js (it may belong in Phase 158's hook pipeline instead)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Claude Code reference source
- `Research/claude-code/src/tool_pool.py` -- Tool pool pattern (read for context even though tool pool module was deferred)
- `Research/claude-code/src/cost_tracker.py` -- CostTracker pattern: cost estimation, budget enforcement
- `Research/claude-code/src/direct_modes.py` -- Execution mode definitions and per-mode configuration

### Research artifacts
- `.planning/research/SUMMARY.md` -- Synthesized architecture recommendations, pitfall warnings
- `.planning/research/ARCHITECTURE.md` -- Subsystem mapping, 17 new module proposal
- `.planning/research/PITFALLS.md` -- Pitfall 5 (path-based permissions rejected), Pitfall 3 (storage quota)

### FSB source (extraction targets)
- `ai/agent-loop.js` -- estimateCost (line 111), MODEL_PRICING (line 70), checkSafetyBreakers (line 145), getPublicTools (line 497), safetyConfig init (lines 836-848)
- `background.js` -- Session creation with hardcoded defaults, mode-implicit code paths

### Phase 156 outputs (dependencies)
- `ai/session-schema.js` -- SESSION_FIELDS with safetyConfig, SESSION_STATUSES
- `ai/state-emitter.js` -- SessionStateEmitter for state change events
- `ai/transcript-store.js` -- TranscriptStore (compactThreshold will come from engine-config)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `estimateCost()` at agent-loop.js:111 -- 20-line function with MODEL_PRICING lookup, prefix matching fallback, direct extraction target
- `MODEL_PRICING` at agent-loop.js:70 -- 25-entry pricing table, direct extraction target
- `checkSafetyBreakers()` at agent-loop.js:145 -- Cost and time limit checking, may move to hook pipeline (Phase 158) rather than cost tracker
- `TOOL_REGISTRY` at tool-definitions.js:34 -- 42 tool definitions with routing metadata, stays as-is

### Established Patterns
- `importScripts()` loading with `typeof` guards for dual Chrome/Node compatibility
- `var` declarations for shared-scope globals
- camelCase functions, PascalCase classes, SCREAMING_SNAKE_CASE constants
- 2-space indentation, single quotes, semicolons always
- Chrome.storage.local for user-configurable settings (costLimit, timeLimit already use this)

### Integration Points
- agent-loop.js `runAgentLoop()` line 813 -- reads safetyConfig from chrome.storage.local with hardcoded defaults
- agent-loop.js `runAgentIteration()` line 1085 -- accumulates cost via estimateCost()
- background.js session creation -- currently no mode tagging, just different code paths per entry point

</code_context>

<specifics>
## Specific Ideas

- Mirror Claude Code patterns closely where they translate to Chrome Extension context (carry-forward from Phase 156)
- Research/claude-code/src/ is the primary reference -- each new module should be traceable to its Claude Code counterpart
- The 4 execution modes (autopilot, mcp-manual, mcp-agent, dashboard-remote) are currently just implicit in background.js code paths -- formalizing them means each session gets a `.mode` property from the EXECUTION_MODES constant

</specifics>

<deferred>
## Deferred Ideas

- Tool pool filtering by task type -- user explicitly chose to keep sending all 42 tools for now. Revisit when token cost becomes a concern or when task-type classification improves.
- Budget warning events (50%, 75%, 90% thresholds) -- can be added to cost tracker later without architectural changes.
- Per-tool cost tracking for analytics -- questionable value, deferred indefinitely.

</deferred>

---

*Phase: 157-engine-configuration*
*Context gathered: 2026-04-02*
