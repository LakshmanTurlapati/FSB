# Phase 139: Dead Code Removal & Polish - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase -- pure deletion)

<domain>
## Phase Boundary

Remove ~3,100 lines of legacy autopilot infrastructure now that the new agent loop is proven stable. cli-parser.js, CLI_COMMAND_TABLE, TASK_PROMPTS, buildPrompt templates, multi-signal completion validator, and per-iteration DOM fetching.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure deletion phase. Remove dead code, verify no remaining references, ensure the new agent loop path still works after removal.

Key constraints:
- cli-parser.js and CLI_COMMAND_TABLE must be fully deleted (CLN-01)
- Old TASK_PROMPTS and buildPrompt templates must be deleted (CLN-02)
- Multi-signal completion validator must be deleted (CLN-03)
- Per-iteration automatic DOM fetching must be removed (CLN-04)
- The new agent loop (ai/agent-loop.js) is the ONLY autopilot path after this phase

</decisions>

<canonical_refs>
## Canonical References

### Code to remove
- `ai/cli-parser.js` -- entire file (950+ lines)
- `ai/ai-integration.js` -- CLI_COMMAND_TABLE, TASK_PROMPTS, buildPrompt, buildMinimalUpdate, conversation history management
- `background.js` -- startAutomationLoop function (~2400 lines), stuck detection, DOM prefetch, completion validator

### Code to keep
- `ai/agent-loop.js` -- new agent loop (1061 lines)
- `ai/tool-definitions.js` -- tool registry (867 lines)
- `ai/tool-use-adapter.js` -- provider adapter (314 lines)
- `ai/tool-executor.js` -- unified executor (375 lines)

</canonical_refs>

<code_context>
## Existing Code Insights

### What to delete
- cli-parser.js: entire file, all COMMAND_REGISTRY references
- ai-integration.js: CLI_COMMAND_TABLE constant, TASK_PROMPTS object, buildPrompt/buildMinimalUpdate functions, conversation history arrays
- background.js: startAutomationLoop and all its helpers (DOM prefetch, stuck detection, completion validator, action sequence analysis)

### What to verify after deletion
- importScripts in background.js no longer references cli-parser.js
- No remaining code calls parseCliResponse or any CLI parser function
- No remaining code references CLI_COMMAND_TABLE or TASK_PROMPTS
- agent-loop.js runAgentLoop is the sole autopilot entry point

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- pure deletion phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 139-dead-code-removal-polish*
*Context gathered: 2026-04-01*
