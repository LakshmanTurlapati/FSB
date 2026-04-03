# Phase 161: Module Adoption - Research

**Researched:** 2026-04-02
**Domain:** Consumer migration -- wiring extracted class instances into existing call sites
**Confidence:** HIGH

## Summary

Phase 161 is a pure wiring phase: five modules created in Phases 156-157 exist, are loaded via importScripts, and have their APIs resolved via `_al_` prefix references in agent-loop.js. The gap is that no consumer code calls `createSession()`, instantiates `CostTracker`, produces `createTurnResult()` objects, instantiates `ActionHistory`, or sets `session.mode`. Instead, background.js builds sessions as inline object literals (lines 6125-6192 and 6431-6471), agent-loop.js accumulates cost via direct property writes (lines 960-967), pushes to raw `session.actionHistory` arrays (lines 1074 and 1189), and `session.mode` is never set so `loadSessionConfig` always falls back to autopilot defaults.

The migration surface is well-bounded. There are exactly 2 session construction sites (handleStartAutomation + executeAutomationTask), 1 cost accumulation site (runAgentIteration lines 960-967), 2 actionHistory push sites (lines 1074 and 1189), and the mode routing maps cleanly to existing triggerSource/isDashboardTask/isBackgroundAgent flags. Session restoration in `restoreSessionsFromStorage` also needs attention since it creates sessions from persisted data using spread syntax rather than `createSession()`.

**Primary recommendation:** Single clean cut migration. All five adoptions in one coordinated change set. The modules are already loaded and their APIs stable -- this is wiring, not design.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all decisions are at Claude's discretion.

### Claude's Discretion
- D-01: Migration strategy -- single clean cut preferred
- D-02: createSession adoption at all session construction sites
- D-03: CostTracker instantiation with record/checkBudget wiring
- D-04: createTurnResult at end of each iteration
- D-05: ActionHistory class instantiation per session
- D-06: session.mode set based on entry path

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADOPT-01 | All new sessions created via `createSession(overrides)` -- no inline object literals | 2 construction sites identified in background.js + 1 restoration site; createSession factory accepts overrides and produces all 57 fields |
| ADOPT-02 | `CostTracker` instantiated per session with `checkBudget()` replacing direct `totalCost` reads | CostTracker API mapped; record() replaces lines 960-962; checkBudget() replaces checkSafetyBreakers cost check at line 135 |
| ADOPT-03 | Each agent iteration produces a `createTurnResult()` object | createTurnResult factory accepts all needed fields; data sources identified at iteration end |
| ADOPT-04 | `ActionHistory` class instantiated per session wrapping raw array | 2 push sites in agent-loop.js; ActionHistory.push() is drop-in compatible with createActionEvent objects |
| ADOPT-05 | `session.mode` set on every new session based on entry point | 4 entry paths mapped: handleStartAutomation=autopilot, MCP start-automation=autopilot (via handleStartAutomation), executeAutomationTask with isBackgroundAgent/isDashboardTask flags, restored sessions |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- ES2021+ JavaScript with proper error handling
- Chrome Extension best practices with Manifest V3
- Use `var` declarations for shared-scope globals in importScripts context
- `typeof` guards for module availability checks
- Manual testing across diverse websites (no formal test framework)
- No emojis in terminal logs, readme files, or anywhere
- Never run applications automatically

## Architecture Patterns

### Session Construction Sites (ADOPT-01 targets)

**Site 1: handleStartAutomation** (background.js lines 6125-6192)
- Builds a 40+ field inline object literal
- Reads storedSettings, computes initialAllowedTabs, generates sessionId
- Post-construction: sets conversationId, serializes continuity, handles multi-site
- **Migration:** Replace inline literal with `createSession({ sessionId, task, tabId, ... })`. Pass only overrides (roughly 20 fields). The remaining 37 fields get defaults from SESSION_FIELDS.

**Site 2: executeAutomationTask** (background.js lines 6431-6471)
- Builds a smaller inline literal (used by background agents, dashboard tasks)
- Has extra fields: isBackgroundAgent, agentId, _isDashboardTask, _dashboardTaskRunId, _completionCallback
- **Migration:** Same pattern -- `createSession({ ... overrides })`. Note: _completionCallback is a hot-tier field (not in SESSION_FIELDS) that must be added after construction or as an override.

**Site 3: restoreSessionsFromStorage** (background.js lines 2862-2926)
- Uses spread syntax: `{ ...persistedSession, isRestored: true, ... }`
- **Migration:** Use `createSession({ ...persistedSession, isRestored: true, ... })` to ensure all fields exist with proper defaults before applying persisted overrides.

### CostTracker Integration Pattern (ADOPT-02)

**Current flow (agent-loop.js lines 960-967):**
```javascript
session.agentState.totalInputTokens += inputTokens;
session.agentState.totalOutputTokens += outputTokens;
session.agentState.totalCost += _al_estimateCost(model, inputTokens, outputTokens);
session.totalInputTokens = session.agentState.totalInputTokens;
session.totalOutputTokens = session.agentState.totalOutputTokens;
session.totalCost = session.agentState.totalCost;
```

**Target flow:**
```javascript
var callCost = session._costTracker.record(model, inputTokens, outputTokens);
// Sync back to session fields for backward compatibility
session.agentState.totalInputTokens = session._costTracker.totalInputTokens;
session.agentState.totalOutputTokens = session._costTracker.totalOutputTokens;
session.agentState.totalCost = session._costTracker.totalCost;
session.totalInputTokens = session._costTracker.totalInputTokens;
session.totalOutputTokens = session._costTracker.totalOutputTokens;
session.totalCost = session._costTracker.totalCost;
```

**Where CostTracker lives:** On the session object as `session._costTracker` (hot-tier -- lost on SW kill, recreated from warm state on restore). Prefix with underscore to signal it is not a persisted field.

**Budget check migration (checkSafetyBreakers line 135):**
Current: `if ((state.totalCost || 0) >= costLimit)`
Target: `var budget = session._costTracker.checkBudget(); if (budget.exceeded) { return { shouldStop: true, reason: budget.reason }; }`

**Hydration on restore:** When restoring a session, create CostTracker from persisted totalCost: `var ct = new CostTracker(costLimit); ct.totalCost = session.totalCost; ct.totalInputTokens = session.totalInputTokens; ct.totalOutputTokens = session.totalOutputTokens;`

### TurnResult Construction Pattern (ADOPT-03)

**Data sources at iteration end:**
- `iterNum` -- iteration number
- `inputTokens`, `outputTokens` -- from _extractUsage
- `_al_estimateCost(model, inputTokens, outputTokens)` -- cost (or from CostTracker.record return value)
- `toolResults.map(tr => tr.name)` -- matched tools
- `toolResults` -- per-tool outcomes
- Stop reason: 'end_turn', 'tool_calls', 'complete_task', 'fail_task', 'error'

**Construction point:** After all tools execute but before scheduling next iteration (around line 1220). For end_turn/complete_task/fail_task, construct before finalization.

**Storage:** Store on session as `session.lastTurnResult` or accumulate in an array `session.turnResults`. Recommend `session.lastTurnResult` for now (Phase 162 can accumulate if needed).

### ActionHistory Adoption Pattern (ADOPT-04)

**Current pushes (2 sites):**
1. Permission denial (line 1074): `session.actionHistory.push(_al_createActionEvent({...}))`
2. Standard tool result (line 1189): `session.actionHistory.push(_al_createActionEvent({...}))`

**Migration:**
- Initialize in `hydrateAgentRunState`: `session._actionHistory = new ActionHistory(); if (session.actionHistory) session._actionHistory.hydrate(session.actionHistory);`
- Replace pushes: `session._actionHistory.push({...})` (ActionHistory.push normalizes via createActionEvent)
- Keep `session.actionHistory = session._actionHistory.events` synced for backward compatibility (persisted warm field)

**Read sites:** detectStuck reads `session.actionHistory` (line 185-186). After migration, this can read `session._actionHistory.getLastN(5)` or keep the sync so raw array access still works.

### Mode Routing Pattern (ADOPT-05)

**Entry path -> mode mapping:**

| Entry Path | Code Location | Mode String | How to Detect |
|------------|---------------|-------------|---------------|
| Popup/Sidepanel | handleStartAutomation (direct call from message handler) | `'autopilot'` | Default path -- no special flags |
| MCP start-automation | handleMCPMessage -> handleStartAutomation with `_triggerSource: 'mcp'` | `'autopilot'` | Delegates to handleStartAutomation, same session construction |
| Background agent / MCP agent | executeAutomationTask with `isBackgroundAgent: true` | `'mcp-agent'` | `options.isBackgroundAgent === true` |
| Dashboard remote | executeAutomationTask with `isDashboardTask: true` | `'dashboard-remote'` | `options.isDashboardTask === true` |
| MCP manual tool | Not a session -- single tool calls via MCP handler | `'mcp-manual'` | N/A for session construction (single tool execution, not agent loop) |

**Note:** `mcp-manual` mode applies to single MCP tool calls, not full sessions. The MCP `start-automation` path creates an autopilot session. This is correct per the EXECUTION_MODES definitions -- mcp-manual has maxIterations: 1 and is for single tool calls, not for `run-task` sessions.

**Implementation:** Set `session.mode` in the overrides passed to `createSession()`:
- `handleStartAutomation`: `mode: 'autopilot'`
- `executeAutomationTask`: `mode: isDashboardTask ? 'dashboard-remote' : (isBackgroundAgent ? 'mcp-agent' : 'autopilot')`
- Restored sessions: Preserve from persisted state (`persistedSession.mode || 'autopilot'`)

### Recommended Project Structure (no changes)
```
ai/
  session-schema.js     # createSession, SESSION_FIELDS (exists)
  cost-tracker.js       # CostTracker, estimateCost (exists)
  turn-result.js        # createTurnResult, STOP_REASONS (exists)
  action-history.js     # ActionHistory, createActionEvent (exists)
  engine-config.js      # EXECUTION_MODES, loadSessionConfig (exists)
  agent-loop.js         # MODIFIED: use instances instead of ad-hoc patterns
background.js           # MODIFIED: use createSession, set mode
```

### Anti-Patterns to Avoid
- **Adding new SESSION_FIELDS entries for hot-tier instances:** CostTracker and ActionHistory instances are hot-tier (lost on SW kill). Store them with underscore prefix on the session object directly, not in SESSION_FIELDS. SESSION_FIELDS is for typed defaults, not runtime instances.
- **Breaking backward compatibility:** Always sync instance state back to session-level properties (totalCost, totalInputTokens, etc.) so dashboard broadcasts, persist logic, and cleanup code that reads these fields continues to work.
- **Incomplete mode routing:** If `session.mode` is undefined, `loadSessionConfig` falls back to autopilot. This is the current behavior and it is safe, but the whole point of ADOPT-05 is to set it explicitly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session field defaults | Inline object literals with 40+ fields | `createSession(overrides)` | Single source of truth, deep-clones arrays/objects, prevents missing fields |
| Cost accumulation | Direct property arithmetic on session.agentState | `CostTracker.record()` | Encapsulates pricing lookup, tracks callCount, provides toJSON |
| Budget checking | Inline `totalCost >= costLimit` comparison | `CostTracker.checkBudget()` | Returns structured result with reason string, consistent format |
| Action event creation | Already using createActionEvent -- keep it | `ActionHistory.push()` which wraps createActionEvent | Adds query methods (getByIteration, diff, getFailures) |
| Mode-specific config | Hardcoded constants per entry path | `EXECUTION_MODES[session.mode]` + `loadSessionConfig(session.mode)` | Centralized config, chrome.storage.local user override support |

## Common Pitfalls

### Pitfall 1: Hot-tier instance loss on SW kill
**What goes wrong:** CostTracker and ActionHistory instances are class instances (hot-tier). When the service worker is killed and restored, these are null.
**Why it happens:** Chrome MV3 kills the service worker after 5 minutes of inactivity. Class instances cannot be serialized.
**How to avoid:** Always recreate instances from warm-tier fields on session restoration. In `hydrateAgentRunState` or at the start of `runAgentLoop`, check if `session._costTracker` exists; if not, create from `session.totalCost/totalInputTokens/totalOutputTokens`.
**Warning signs:** `TypeError: session._costTracker.record is not a function` after service worker restart.

### Pitfall 2: createSession overrides stomping defaults
**What goes wrong:** Passing an override like `actionHistory: []` to createSession is redundant (it is already the default). But passing an override that is a reference (not a fresh array) could cause shared-reference bugs.
**Why it happens:** createSession uses `Object.assign(session, overrides)` which is a shallow merge. If overrides contains a reference to an external array, that array is shared.
**How to avoid:** Only pass primitive overrides and newly-constructed arrays/objects. Do not pass references to existing state objects.
**Warning signs:** Mutations in one session affecting another session's data.

### Pitfall 3: Extra fields not in SESSION_FIELDS
**What goes wrong:** `executeAutomationTask` sets fields like `isBackgroundAgent`, `agentId`, `_isDashboardTask`, `_dashboardTaskRunId`, `_completionCallback`, `_safetyTimeout` that are NOT in SESSION_FIELDS.
**Why it happens:** These are hot-tier operational fields added ad-hoc. createSession only initializes fields in SESSION_FIELDS.
**How to avoid:** Pass these as overrides to createSession. Object.assign applies them after the defaults are set. They just will not have default values in SESSION_FIELDS -- which is fine, they are caller-specific.
**Warning signs:** Missing fields after createSession if not passed as overrides.

### Pitfall 4: Backward compatibility for totalCost reads
**What goes wrong:** Many places read `session.totalCost`, `session.agentState.totalCost`, and `session.totalInputTokens` directly. If CostTracker replaces these writes without syncing back, those reads return stale 0 values.
**Why it happens:** The migration introduces CostTracker as the source of truth but dozens of read sites still use the old property paths.
**How to avoid:** After every `session._costTracker.record()` call, sync: `session.totalCost = session._costTracker.totalCost; session.agentState.totalCost = session._costTracker.totalCost;` etc.
**Warning signs:** Dashboard showing $0.00 cost, safety breaker not triggering on budget exceed.

### Pitfall 5: mode field not persisted
**What goes wrong:** If `mode` is not in SESSION_FIELDS, it will not be persisted to chrome.storage.session via getWarmFields.
**Why it happens:** SESSION_FIELDS is the exhaustive list of fields for the session schema. If mode is not there, getWarmFields skips it.
**How to avoid:** The `mode` field IS NOT currently in SESSION_FIELDS. Either: (a) add it as a warm-tier field, or (b) set it from the entry path on every session start including restores. Option (a) is cleaner -- add `mode: { default: 'autopilot', tier: 'warm', type: 'string' }` to SESSION_FIELDS.
**Warning signs:** Restored sessions losing their mode and falling back to autopilot even when they were dashboard-remote sessions.

## Code Examples

### Example 1: createSession adoption in handleStartAutomation
```javascript
// Before (40+ field inline literal):
const sessionData = {
  sessionId,
  task,
  tabId: targetTabId,
  originalTabId: targetTabId,
  startUrl: tabInfo?.url || null,
  status: 'running',
  // ... 35 more fields ...
};

// After:
const sessionData = createSession({
  sessionId,
  task,
  tabId: targetTabId,
  originalTabId: targetTabId,
  startUrl: tabInfo?.url || null,
  status: 'running',
  startTime: Date.now(),
  maxIterations: userMaxIterations,
  allowedTabs: initialAllowedTabs,
  navigationMessage,
  animatedActionHighlights: storedSettings.animatedActionHighlights ?? true,
  conversationId: conversationId || null,
  selectedConversationId: selectedConversationId || null,
  uiSurface,
  historySessionId: resolvedHistorySessionId || sessionId,
  lastTask: task,
  lastCommandAt: Date.now(),
  commandCount: 1,
  commands: [task],
  domSettings: {
    domOptimization: storedSettings.domOptimization !== false,
    maxDOMElements: storedSettings.maxDOMElements || 2000,
    prioritizeViewport: storedSettings.prioritizeViewport !== false
  },
  userLocale: getUserLocale(),
  mode: 'autopilot'
});
```

### Example 2: CostTracker wiring in agent-loop.js
```javascript
// In hydrateAgentRunState or runAgentLoop initialization:
if (!session._costTracker) {
  var costLimit = (session.safetyConfig && session.safetyConfig.costLimit)
    || _al_SESSION_DEFAULTS.costLimit || 2.00;
  session._costTracker = new _al_CostTracker(costLimit);
  // Hydrate from warm state
  session._costTracker.totalCost = session.totalCost || 0;
  session._costTracker.totalInputTokens = session.totalInputTokens || 0;
  session._costTracker.totalOutputTokens = session.totalOutputTokens || 0;
}

// In runAgentIteration after API response (replacing lines 960-967):
var callCost = session._costTracker.record(model, inputTokens, outputTokens);
session.agentState.totalInputTokens = session._costTracker.totalInputTokens;
session.agentState.totalOutputTokens = session._costTracker.totalOutputTokens;
session.agentState.totalCost = session._costTracker.totalCost;
session.totalInputTokens = session._costTracker.totalInputTokens;
session.totalOutputTokens = session._costTracker.totalOutputTokens;
session.totalCost = session._costTracker.totalCost;
```

### Example 3: ActionHistory adoption
```javascript
// In hydrateAgentRunState:
if (_al_ActionHistory) {
  session._actionHistory = new _al_ActionHistory();
  if (Array.isArray(session.actionHistory) && session.actionHistory.length > 0) {
    session._actionHistory.hydrate(session.actionHistory);
  }
}

// Replace push sites (lines 1074, 1189):
if (session._actionHistory) {
  session._actionHistory.push({
    tool: call.name, params: call.args,
    result: { success: result.success, hadEffect: result.hadEffect, error: result.error || null },
    timestamp: Date.now(), iteration: iterNum
  });
  session.actionHistory = session._actionHistory.events; // backward compat sync
} else {
  // Fallback for missing ActionHistory class
  if (!session.actionHistory) session.actionHistory = [];
  session.actionHistory.push(_al_createActionEvent({ /* ... */ }));
}
```

### Example 4: Mode routing in executeAutomationTask
```javascript
var sessionMode = isDashboardTask ? 'dashboard-remote'
  : (isBackgroundAgent ? 'mcp-agent' : 'autopilot');

var sessionData = createSession({
  // ... existing overrides ...
  mode: sessionMode
});
```

### Example 5: checkSafetyBreakers with CostTracker
```javascript
function checkSafetyBreakers(session) {
  // Cost circuit breaker via CostTracker
  if (session._costTracker) {
    var budget = session._costTracker.checkBudget();
    if (budget.exceeded) {
      return { shouldStop: true, reason: budget.reason };
    }
  } else {
    // Fallback: direct read (backward compat)
    var state = session.agentState || {};
    var costLimit = (session.safetyConfig && session.safetyConfig.costLimit)
      || _al_SESSION_DEFAULTS.costLimit || 2.00;
    if ((state.totalCost || 0) >= costLimit) {
      return {
        shouldStop: true,
        reason: 'Session cost ($' + (state.totalCost || 0).toFixed(2) + ') exceeded limit ($' + costLimit.toFixed(2) + '). Stopping.'
      };
    }
  }

  // Time limit check (unchanged)
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline session object literals | createSession(overrides) factory | Phase 156 (2026-04-02) | Single source of truth for 57 fields |
| Direct property arithmetic for cost | CostTracker.record() | Phase 157 (2026-04-02) | Budget enforcement via checkBudget() |
| Raw array pushes for actions | ActionHistory.push() with query API | Phase 156 (2026-04-02) | Queryable event store for stuck detection |
| Implicit mode fallback to autopilot | Explicit EXECUTION_MODES routing | Phase 157 (2026-04-02) | Per-mode safety limits actually applied |
| Ad-hoc agentState property writes | createTurnResult() structured objects | Phase 156 (2026-04-02) | Typed iteration metadata contract |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (no formal test framework per CLAUDE.md) |
| Config file | None |
| Quick run command | Load extension in Chrome, trigger automation |
| Full suite command | Manual: test popup/sidepanel/MCP/dashboard entry paths |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADOPT-01 | Sessions created via createSession | manual | Chrome DevTools: verify session object shape after starting automation | N/A |
| ADOPT-02 | CostTracker.checkBudget replaces inline cost check | manual | Run automation, check console for CostTracker.record logs | N/A |
| ADOPT-03 | createTurnResult produced per iteration | manual | DevTools: inspect session.lastTurnResult after iteration | N/A |
| ADOPT-04 | ActionHistory class instantiated | manual | DevTools: verify session._actionHistory instanceof ActionHistory | N/A |
| ADOPT-05 | session.mode set on every session | manual | Start from popup (verify autopilot), dashboard (verify dashboard-remote) | N/A |

### Sampling Rate
- **Per task commit:** Load extension, start one automation from popup, verify in DevTools
- **Per wave merge:** Test all 4 entry paths (popup, sidepanel follow-up, dashboard task, MCP start-automation)
- **Phase gate:** All 4 entry paths produce sessions with correct mode, CostTracker instance, ActionHistory instance

### Wave 0 Gaps
None -- no formal test infrastructure to create. All validation is manual Chrome DevTools inspection.

## Open Questions

1. **Should `mode` be added to SESSION_FIELDS?**
   - What we know: `mode` is not currently in SESSION_FIELDS. getWarmFields will not persist it. loadSessionConfig already reads `session.mode || 'autopilot'` as fallback.
   - What is unclear: Whether restored sessions need their original mode or if autopilot fallback is acceptable.
   - Recommendation: Add `mode` to SESSION_FIELDS as warm-tier. Cost is negligible (one string field). Benefit is correct mode restoration after SW kill. This is a small schema addition, not a new module.

2. **Should CostTracker instance replace or supplement session.agentState cost fields?**
   - What we know: Many call sites read session.agentState.totalCost and session.totalCost. CostTracker is the single source of truth for cost.
   - What is unclear: How many read sites exist beyond the ones identified.
   - Recommendation: Supplement, not replace. CostTracker is the write path; sync its values back to session properties after every record() call. This preserves all existing read paths without a multi-file migration.

3. **Where does TurnResult get stored?**
   - What we know: createTurnResult produces an immutable data object. No storage location is prescribed.
   - What is unclear: Whether downstream consumers (Phase 162 event bus) need historical turn results.
   - Recommendation: Store as `session.lastTurnResult` (overwritten each iteration). If accumulation is needed, Phase 162 can add it. Keep it simple for now.

## Sources

### Primary (HIGH confidence)
- `ai/session-schema.js` -- Read in full. 57 SESSION_FIELDS, createSession factory, getWarmFields
- `ai/cost-tracker.js` -- Read in full. CostTracker class with record/checkBudget/toJSON
- `ai/turn-result.js` -- Read in full. createTurnResult factory, STOP_REASONS
- `ai/action-history.js` -- Read in full. ActionHistory class with push/hydrate/query/toJSON
- `ai/engine-config.js` -- Read in full. EXECUTION_MODES (4 modes), loadSessionConfig, SESSION_DEFAULTS
- `ai/agent-loop.js` -- Read in full (1338 lines). Identified all ad-hoc patterns to replace
- `background.js` -- Read relevant sections (11K lines). Identified all session construction sites, runAgentLoop call sites, mode entry paths

### Secondary (MEDIUM confidence)
- `.planning/v0.9.24-MILESTONE-AUDIT.md` -- Integration gap definitions with line numbers
- `.planning/phases/159-agent-loop-refactor/159-CONTEXT.md` -- D-01 single clean cut pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All modules read in full, APIs verified directly from source code
- Architecture: HIGH - All integration points identified with exact line numbers
- Pitfalls: HIGH - Derived from direct code analysis of hot/warm tier patterns and backward compatibility requirements

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- internal code, no external dependencies)
