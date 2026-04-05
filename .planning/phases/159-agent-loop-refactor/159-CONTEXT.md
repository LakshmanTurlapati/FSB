# Phase 159: Agent Loop Refactor - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the 8 extracted modules from Phases 156-158 into agent-loop.js: replace inline code with module calls, enable automatic session resumption from warm state after service worker kills, and replace scattered sendStatus/safety conditionals with hook pipeline emissions. Target: reduce agent-loop.js from ~1429 to ~700 lines. Preserve setTimeout-chaining for MV3 compatibility.

</domain>

<decisions>
## Implementation Decisions

### Wiring strategy
- **D-01:** Single clean cut. Replace all inline code with module calls in one coordinated refactor. No transitional state where some code is wired and some isn't.

### Session resumption
- **D-02:** Resume from warm state. On SW resurrection, read warm state from chrome.storage.session. Rebuild messages from TranscriptStore, restore iteration count and cost from SessionSchema warm fields. Continue with next iteration. At most one tool call is lost (per Phase 156 D-08).
- **D-03:** Automatic resumption. When background.js detects a warm session in chrome.storage.session on startup, it automatically calls runAgentLoop to continue. No user prompt. Seamless experience.

### What stays in agent-loop.js
- **D-04:** Keep: `runAgentLoop()` (session init + first iteration kick), `runAgentIteration()` (the iteration callback with hook emissions), `buildSystemPrompt()`, `callProviderWithTools()`, tool execution loop (lines 1158-1350 equivalent), `buildTurnMessages()`.
- **D-05:** Remove from agent-loop.js: `MODEL_PRICING` table, `estimateCost()`, `checkSafetyBreakers()`, `detectStuck()`, `compactHistory()`, `estimateTokens()`. These now live in extracted modules. Replace all `sendStatus()` calls with hook emissions.

### Hook emission points
- **D-06:** Await hooks inline. Each `hook.emit()` is awaited inside the async `runAgentIteration()` function. Hooks complete before the iteration continues. The setTimeout-chaining happens between iterations (the `setTimeout(() => runAgentIteration(...), delay)` at the end), not within. This works because runAgentIteration is already async.
- **D-07:** Hook emission locations in runAgentIteration:
  - `beforeIteration`: after session guard (line 1022), before safety check
  - `afterApiResponse`: after API call returns and usage is extracted (line 1085)
  - `beforeToolExecution`: before each tool in the for-loop (line 1160)
  - `afterToolExecution`: after each tool result (line 1250)
  - `afterIteration`: after all tools executed, before scheduling next iteration
  - `onCompletion`: when AI signals end_turn (line 1117)
  - `onError`: in the catch block (line 1372)

### Claude's Discretion
- Exact import/loading pattern for the 8 new modules (importScripts ordering, typeof guards)
- How to restructure the imports section (lines 22-59) to include new modules
- Whether buildTurnMessages stays inline or moves (it's small enough to stay)
- How background.js detects and triggers automatic resumption on SW wake
- Exact hook context objects passed to each emission point
- Whether the ~700 line target is met exactly or approximately (quality over line count)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Claude Code reference source
- `Research/claude-code/src/runtime.py` -- RuntimeSession pattern: typed session fields, turn loop lifecycle, structured turn results
- `Research/claude-code/src/context.py` -- Context management patterns

### Phase 156 outputs (wire into agent-loop.js)
- `ai/session-schema.js` -- createSession(), getWarmFields(), SESSION_STATUSES, SESSION_FIELDS
- `ai/transcript-store.js` -- TranscriptStore with append/compact/replay/flush
- `ai/turn-result.js` -- createTurnResult(), STOP_REASONS, summarizeTurnResult
- `ai/action-history.js` -- ActionHistory with push/query/diff
- `ai/state-emitter.js` -- SessionStateEmitter with emit/on/off

### Phase 157 outputs (wire into agent-loop.js)
- `ai/cost-tracker.js` -- CostTracker with record/checkBudget, MODEL_PRICING, estimateCost
- `ai/engine-config.js` -- SESSION_DEFAULTS, EXECUTION_MODES, loadSessionConfig, getMode
- `ai/permission-context.js` -- PermissionContext with isAllowed/createDenial

### Phase 158 outputs (wire into agent-loop.js)
- `ai/hook-pipeline.js` -- HookPipeline with register/emit, LIFECYCLE_EVENTS
- `ai/hooks/safety-hooks.js` -- createSafetyBreakerHook, createStuckDetectionHook
- `ai/hooks/permission-hook.js` -- createPermissionHook
- `ai/hooks/progress-hook.js` -- createToolProgressHook, createIterationProgressHook, createCompletionProgressHook, createErrorProgressHook

### FSB source (primary modification target)
- `ai/agent-loop.js` -- 1429 lines, the file being refactored
- `background.js` -- Session creation, SW lifecycle, auto-resumption logic

</canonical_refs>

<code_context>
## Existing Code Insights

### What gets removed from agent-loop.js
- Lines 70-131: MODEL_PRICING + estimateCost() -- replaced by ai/cost-tracker.js
- Lines 145-165: checkSafetyBreakers() -- replaced by hook wrapper in ai/hooks/safety-hooks.js
- Lines 184-219: detectStuck() -- replaced by hook wrapper in ai/hooks/safety-hooks.js
- Lines 222-290: compactHistory() + estimateTokens() -- replaced by ai/transcript-store.js
- 10+ sendStatus() calls -- replaced by hook emissions via HookPipeline

### What stays in agent-loop.js
- runAgentLoop() (session init, provider setup, first iteration kick)
- runAgentIteration() (iteration callback with hook emissions replacing inline checks)
- buildSystemPrompt() (prompt construction)
- callProviderWithTools() (API call wrapper)
- buildTurnMessages() (message array assembly)
- Tool execution for-loop (lines 1158-1350 equivalent)
- getPublicTools() (stays inline per Phase 157 D-01)

### Established Patterns
- `importScripts()` loading with `typeof` guards (lines 22-46)
- `var` declarations for shared-scope globals (lines 36-58)
- setTimeout-chaining: `session._nextIterationTimer = setTimeout(() => runAgentIteration(...), delay)`
- camelCase functions, PascalCase classes, SCREAMING_SNAKE_CASE constants

### Integration Points
- background.js creates sessions and calls runAgentLoop -- needs to pass HookPipeline instance
- background.js handles SW lifecycle -- needs auto-resumption from chrome.storage.session
- Sidepanel/popup currently receive status via sendStatus callback -- will now receive via SessionStateEmitter (triggered by progress hooks)

</code_context>

<specifics>
## Specific Ideas

- The refactor is a "single clean cut" -- one coordinated change, not incremental
- Preserve setTimeout-chaining exactly as-is. The pattern `setTimeout(() => runAgentIteration(...), delay)` at the end of each iteration is critical for MV3 SW survival
- Auto-resumption on SW wake means background.js needs a startup check for warm sessions
- The ~700 line target is approximate -- quality of the refactor matters more than hitting an exact number

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 159-agent-loop-refactor*
*Context gathered: 2026-04-02*
