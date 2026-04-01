---
phase: 137-agent-loop-core-safety-mechanisms
plan: 01
subsystem: ai-engine
tags: [tool-use, agent-loop, setTimeout-chaining, chrome-mv3, service-worker]

# Dependency graph
requires:
  - phase: 135-provider-format-adapters-tool-registry
    provides: TOOL_REGISTRY, getToolByName, formatToolsForProvider, parseToolCalls, formatToolResult, isToolCallResponse, formatAssistantMessage, extractUsage
  - phase: 136-unified-tool-executor-mcp-migration
    provides: executeTool unified dispatch with content/cdp/background routing
provides:
  - runAgentLoop entry point for tool_use protocol automation
  - runAgentIteration setTimeout-chained iteration with sequential tool execution
  - buildSystemPrompt minimal ~572 char agent system prompt
  - callProviderWithTools provider-specific request building for tool_use API calls
  - estimateCost model pricing table for cost tracking
  - getPublicTools metadata-stripped tool definitions for API calls
  - background.js wiring routing new/follow-up sessions through agent loop
affects: [137-02 (safety mechanisms), 138 (prompt architecture), 139 (legacy cleanup)]

# Tech tracking
tech-stack:
  added: []
  patterns: [setTimeout-chaining for MV3 SW survival, callback injection for loose coupling, provider-specific request building]

key-files:
  created: [ai/agent-loop.js]
  modified: [background.js]

key-decisions:
  - "getPublicTools created in agent-loop.js (not tool-definitions.js) to strip _route/_readOnly/_contentVerb/_cdpVerb routing metadata"
  - "UniversalProvider instantiated via settings object (matching existing constructor signature) rather than separate args"
  - "Gemini message format converter handles OpenAI tool_calls, Anthropic content arrays, and native Gemini parts"
  - "Network error retry tracked per-iteration via session._lastRetryIteration to limit to one retry per iteration"

patterns-established:
  - "setTimeout-chaining: each iteration ends with setTimeout(() => runAgentIteration(...), 100) to survive Chrome 5-min SW kill"
  - "Callback injection: runAgentLoop receives all background.js functions as options object, avoiding tight coupling"
  - "Sequential tool execution: for-of loop over parsed tool calls, never parallel, since browser actions must be serial"

requirements-completed: [LOOP-01, LOOP-02, LOOP-03, LOOP-04, SAFE-04]

# Metrics
duration: 4min
completed: 2026-04-01
---

# Phase 137 Plan 01: Agent Loop Core Summary

**setTimeout-chained tool_use protocol loop with sequential tool execution, per-iteration persistence, and stop_reason-based completion detection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T09:41:10Z
- **Completed:** 2026-04-01T09:45:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created ai/agent-loop.js (714 lines) implementing the full tool_use agent loop with 6 exported functions
- Wired handleStartAutomation to route both new and follow-up sessions through runAgentLoop
- Session persistence includes agent iteration count, cost, tokens, and last 5 messages for SW resurrection
- All 42 tools sent with every API call via getPublicTools (routing metadata stripped)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ai/agent-loop.js with setTimeout-chained agent loop** - `205be48` (feat)
2. **Task 2: Wire agent loop into background.js handleStartAutomation** - `b2ec49f` (feat)

## Files Created/Modified
- `ai/agent-loop.js` - Core agent loop engine: buildSystemPrompt, callProviderWithTools, runAgentLoop, runAgentIteration, estimateCost, getPublicTools
- `background.js` - Added importScripts for Phase 135-137 modules, replaced startAutomationLoop calls with runAgentLoop, added agent state fields to session creation and persistence

## Decisions Made
- Created getPublicTools in agent-loop.js rather than modifying tool-definitions.js, since stripping routing metadata is specific to the agent loop's API call needs
- Used settings object pattern for UniversalProvider instantiation to match existing constructor signature in universal-provider.js
- Built Gemini message format converter that handles cross-format translation (OpenAI tool_calls, Anthropic content arrays)
- Network retry limited to one attempt per iteration number (tracked via session._lastRetryIteration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added getPublicTools function**
- **Found during:** Task 1 (agent-loop.js creation)
- **Issue:** Plan references getPublicTools() from tool-definitions.js but that function does not exist in the module. tool-definitions.js exports TOOL_REGISTRY, getToolByName, getReadOnlyTools, getToolsByRoute only.
- **Fix:** Created getPublicTools() inside agent-loop.js that maps TOOL_REGISTRY to strip _route, _readOnly, _contentVerb, _cdpVerb internal metadata
- **Files modified:** ai/agent-loop.js
- **Verification:** node -e test confirms 42 tools returned with only name/description/inputSchema keys
- **Committed in:** 205be48 (Task 1 commit)

**2. [Rule 3 - Blocking] Added Phase 135/136 module imports to background.js**
- **Found during:** Task 2 (background.js wiring)
- **Issue:** agent-loop.js depends on tool-definitions.js, tool-use-adapter.js, tool-executor.js globals being available. Background.js did not import these modules.
- **Fix:** Added importScripts for tool-definitions.js, tool-use-adapter.js, tool-executor.js alongside agent-loop.js
- **Files modified:** background.js
- **Verification:** grep confirms all 4 importScripts lines present
- **Committed in:** b2ec49f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for module to function. No scope creep.

## Issues Encountered
- Phase 135/136 files (tool-definitions.js, tool-use-adapter.js, tool-executor.js) not present in worktree initially. Resolved by merging main branch to bring in the merged Phase 135/136 outputs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent loop core is complete and wired into handleStartAutomation
- Ready for Phase 137 Plan 02: safety mechanisms (max iterations, session timeout, stuck detection)
- startAutomationLoop preserved as dead code for Phase 139 legacy cleanup

## Self-Check: PASSED

- ai/agent-loop.js: FOUND
- 137-01-SUMMARY.md: FOUND
- Commit 205be48: FOUND
- Commit b2ec49f: FOUND
- All 6 function exports verified: PASSED

---
*Phase: 137-agent-loop-core-safety-mechanisms*
*Completed: 2026-04-01*
