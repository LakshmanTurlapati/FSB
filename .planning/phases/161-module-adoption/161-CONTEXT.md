# Phase 161: Module Adoption - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all consumers to use the extracted class instances from Phases 156-157 instead of ad-hoc patterns. Wire `createSession()` into background.js session construction, instantiate `CostTracker` per session, produce `createTurnResult()` objects per iteration, instantiate `ActionHistory` class per session, and set `session.mode` on every new session. No new modules created -- this is pure consumer migration.

</domain>

<decisions>
## Implementation Decisions

### Migration strategy
- **D-01:** Claude's Discretion. Single clean cut preferred (consistent with Phase 159 D-01), but incremental is acceptable if the migration surface is too large for one coordinated change. The modules already exist and the interfaces are defined -- this is wiring, not design.

### createSession adoption (ADOPT-01)
- **D-02:** Claude's Discretion. Replace the inline object literal in `handleStartAutomation` (background.js ~line 6120) and any other session construction sites with `createSession(overrides)`. The factory already defines all 57+ fields with defaults. Pass only the overrides that differ per call site. Preserve all existing session properties -- `createSession` must produce a superset of the current inline fields.

### CostTracker integration (ADOPT-02)
- **D-03:** Claude's Discretion. Instantiate `CostTracker` per session (store on session object or in agent-loop scope). Wire `CostTracker.record()` to replace the ad-hoc `session.agentState.totalCost += estimateCost(...)` pattern. Wire `CostTracker.checkBudget()` into the safety breaker hook to replace direct `totalCost` reads. The `estimateCost` standalone function can remain as the CostTracker's internal implementation.

### createTurnResult adoption (ADOPT-03)
- **D-04:** Claude's Discretion. At the end of each `runAgentIteration`, construct a `createTurnResult()` object from the iteration's metadata (prompt tokens, output tokens, matched tools, permission denials, stop reason). Store on the session or return from the iteration function. The existing ad-hoc `session.agentState.*` writes can remain as the source data -- `createTurnResult` wraps them into a structured object.

### ActionHistory class adoption (ADOPT-04)
- **D-05:** Claude's Discretion. Instantiate `ActionHistory` per session instead of using a raw `session.actionHistory` array. Replace direct array pushes with `ActionHistory.push(createActionEvent(...))`. The query methods (`getByIteration`, `getToolCounts`, `getFailures`, `diff`) become available but don't need to be consumed yet -- just wired.

### session.mode routing (ADOPT-05)
- **D-06:** Claude's Discretion. Set `session.mode` at each session creation point in background.js based on the entry path:
  - `handleStartAutomation` from popup/sidepanel -> `'autopilot'`
  - MCP `run-task` -> `'mcp-manual'`
  - MCP agent execution -> `'mcp-agent'`
  - Dashboard remote task -> `'dashboard-remote'`
  The mode string must match the keys in `EXECUTION_MODES` from `ai/engine-config.js`. `loadSessionConfig(session.mode)` in agent-loop.js already handles applying per-mode limits.

### Claude's Discretion
- All implementation decisions above are at Claude's discretion
- Exact session construction sites to modify in background.js
- Whether CostTracker instance lives on session object or in agent-loop closure
- Whether TurnResult is stored on session or returned from iteration
- How to detect entry path for session.mode (message action field, caller context, explicit parameter)
- Order of migrations within the plan

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 156 outputs (modules being adopted)
- `ai/session-schema.js` -- createSession(), getWarmFields(), SESSION_FIELDS (target for ADOPT-01)
- `ai/turn-result.js` -- createTurnResult(), STOP_REASONS (target for ADOPT-03)
- `ai/action-history.js` -- ActionHistory class with push/query/diff (target for ADOPT-04)

### Phase 157 outputs (modules being adopted)
- `ai/cost-tracker.js` -- CostTracker with record/checkBudget (target for ADOPT-02)
- `ai/engine-config.js` -- EXECUTION_MODES, loadSessionConfig (target for ADOPT-05)

### Integration audit (gap definitions)
- `.planning/v0.9.24-MILESTONE-AUDIT.md` -- Detailed gap descriptions with line numbers and evidence

### FSB source (primary modification targets)
- `background.js` -- Session construction sites, mode routing, CostTracker wiring
- `ai/agent-loop.js` -- TurnResult construction, ActionHistory instantiation, CostTracker.record calls

### Prior phase context (patterns to follow)
- `.planning/phases/159-agent-loop-refactor/159-CONTEXT.md` -- D-01 single clean cut pattern, D-04/D-05 what stays/goes in agent-loop.js

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createSession(overrides)` in ai/session-schema.js -- factory with all field defaults, ready to call
- `CostTracker` class in ai/cost-tracker.js -- record(), checkBudget(), toJSON() methods
- `createTurnResult()` in ai/turn-result.js -- factory for structured iteration metadata
- `ActionHistory` class in ai/action-history.js -- push(), getByIteration(), getToolCounts(), getFailures(), diff()
- `EXECUTION_MODES` constant in ai/engine-config.js -- 4 named mode objects with per-mode config

### Established Patterns
- `var` declarations for shared-scope globals (importScripts context)
- `typeof` guards for module availability checks
- Modules already loaded via importScripts in background.js lines 13-24
- All module references resolved in agent-loop.js lines 95-108 with `_al_` prefix

### Integration Points
- background.js `handleStartAutomation` (~line 6120) -- primary session construction site
- background.js MCP/dashboard task handlers -- additional session construction sites
- agent-loop.js `runAgentIteration` -- iteration metadata accumulation, action event creation
- ai/hooks/safety-hooks.js -- reads session.agentState.totalCost for budget check

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- all decisions at Claude's discretion. Follow patterns established in Phases 156-159.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 161-module-adoption*
*Context gathered: 2026-04-02*
