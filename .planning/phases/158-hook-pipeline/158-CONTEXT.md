# Phase 158: Hook Pipeline - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a composable hook pipeline with 7 named lifecycle events so cross-cutting concerns (safety checks, permission gates, progress updates) execute through registered handlers instead of inline conditionals in the agent loop. Delivers: HookPipeline class, safety breaker hook wrappers, permission pre-execution hook, and progress notification hook. Does NOT modify agent-loop.js -- Phase 159 wires the hooks in.

</domain>

<decisions>
## Implementation Decisions

### Hook registration pattern
- **D-01:** `HookPipeline` class in `ai/hook-pipeline.js`. Map<eventName, handler[]> internally. `register(event, handler)` adds to the array. `emit(event, context)` runs all handlers in registration order. No priority ordering.
- **D-02:** Separate class from `SessionStateEmitter` (Phase 156). Emitter broadcasts state changes to UI consumers; HookPipeline intercepts lifecycle events for pre/post processing. Different concerns, different classes.

### Safety breaker migration
- **D-03:** Keep `checkSafetyBreakers()` and `detectStuck()` as standalone functions. Create thin hook handler wrappers that call them and register these wrappers on `afterIteration`. The functions remain independently testable. Phase 159 removes the inline calls from agent-loop.js.

### Progress consolidation scope
- **D-04:** Phase 158 creates the progress hook handler and registers it. Phase 158 does NOT replace the 10+ scattered `sendStatus()` calls in agent-loop.js. Phase 159 (Agent Loop Refactor) replaces them with hook emissions. Clean separation: Phase 158 builds infrastructure, Phase 159 wires it in.

### Hook error isolation
- **D-05:** Each hook handler runs in a try/catch. Errors are logged (console.warn) but do not stop the pipeline or the iteration. Only safety hooks that explicitly return `{ shouldStop: true }` can halt execution. A buggy progress hook must never kill automation.

### Claude's Discretion
- Exact signature of hook handler functions (what the `context` parameter contains per event type)
- Whether `emit()` is sync or async (async allows hooks that do chrome.storage reads; sync is simpler)
- LIFECYCLE_EVENTS constant naming and shape
- Whether hook wrappers are separate functions or inline arrow functions during registration
- How the permission hook formats the denial result for the AI (tool_result error shape)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Claude Code reference source
- `Research/claude-code/src/costHook.py` -- Cost hook pattern: how cost checking integrates with lifecycle events
- `Research/claude-code/src/reference_data/subsystems/hooks.json` -- Hook subsystem definition, event names, registration patterns
- `Research/claude-code/src/hooks/` -- Hook implementation directory (if exists)

### Research artifacts
- `.planning/research/SUMMARY.md` -- Synthesized architecture recommendations
- `.planning/research/PITFALLS.md` -- Pitfall 4 (cross-process hooks -- all initial hooks background-only)

### Phase 156/157 outputs (dependencies)
- `ai/state-emitter.js` -- SessionStateEmitter (separate concern, not extended)
- `ai/cost-tracker.js` -- CostTracker.checkBudget() called by safety breaker hook wrapper
- `ai/engine-config.js` -- SESSION_DEFAULTS for safety limits
- `ai/permission-context.js` -- PermissionContext.isAllowed() called by permission hook

### FSB source (inline code to be wrapped)
- `ai/agent-loop.js` -- checkSafetyBreakers (line 145), detectStuck (line 184), 10+ sendStatus calls throughout runAgentIteration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `checkSafetyBreakers()` at agent-loop.js:145 -- Returns `{ shouldStop, reason }`. Direct wrapping target for afterIteration hook.
- `detectStuck()` at agent-loop.js:184 -- Returns `{ isStuck, hint }`. Direct wrapping target for afterIteration hook.
- `PermissionContext.isAllowed()` at permission-context.js -- Stub (always true). Called by beforeToolExecution hook.
- `PermissionContext.createDenial()` at permission-context.js -- Creates structured denial result for blocked tools.

### Established Patterns
- `importScripts()` loading with `typeof` guards for dual Chrome/Node compatibility
- `var` declarations for shared-scope globals
- camelCase functions, PascalCase classes, SCREAMING_SNAKE_CASE constants
- 2-space indentation, single quotes, semicolons always

### Integration Points
- agent-loop.js `runAgentIteration()` at line 935 -- Where hooks will be called (Phase 159 does the wiring)
- The 7 lifecycle events map to specific points in runAgentIteration:
  - beforeIteration: line 1027 (before safety check)
  - afterApiResponse: line 1085 (after provider call)
  - beforeToolExecution: line 1120 (before each tool)
  - afterToolExecution: line 1250 (after each tool)
  - afterIteration: line 1316 (after stuck detection)
  - onCompletion: line 1352 (task complete)
  - onError: line 1372 (error handler)

</code_context>

<specifics>
## Specific Ideas

- Mirror Claude Code's hook pattern where it translates to Chrome Extension context
- All initial hooks are background-only (Pitfall 4) -- no hooks that require content script execution
- The hook pipeline is infrastructure only in Phase 158 -- it does NOT modify agent-loop.js

</specifics>

<deferred>
## Deferred Ideas

- Content-script-requiring hooks (e.g., DOM mutation observers as hook triggers) -- Pitfall 4 warns against cross-process hooks
- Hook priority ordering -- kept simple with registration order for now
- Hook middleware pattern (hooks that modify context for downstream hooks) -- unnecessary complexity for current needs

</deferred>

---

*Phase: 158-hook-pipeline*
*Context gathered: 2026-04-02*
