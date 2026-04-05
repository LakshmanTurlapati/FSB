# Phase 97: Tool Parity - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Register all 7 new CDP tools (cdpClickAt, cdpClickAndHold, cdpDrag, cdpDragVariableSpeed, cdpScrollAt, selectTextRange, dropfile) in the autopilot CLI layer so that the AI can emit these commands and the parser routes them to existing FSB.tools functions.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure phase. The tool implementations already exist in content/actions.js; this phase only wires them into the autopilot's CLI command table, parser registry, and validation layer.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CLI_COMMAND_TABLE` constant in ai/ai-integration.js:14-119 -- current verb reference table for AI prompt
- `isValidTool()` method in ai/ai-integration.js:4191-4225 -- tool name validation list
- `ai/cli-parser.js` -- CLI command parsing with COMMAND_REGISTRY mapping verbs to handlers
- Tool implementations in content/actions.js:
  - cdpClickAt (line 5244) -- CDP click at viewport coordinates
  - cdpClickAndHold (line 5260) -- CDP click and hold at coordinates
  - cdpDrag (line 5276) -- CDP drag from start to end coordinates
  - cdpDragVariableSpeed (line 5294) -- CDP drag with variable speed
  - cdpScrollAt (line 5311) -- CDP scroll at specific coordinates
  - selectTextRange (line 4007) -- Select text by character offsets within element
  - dropfile (line 4901) -- Simulate file drop onto dropzone element

### Established Patterns
- CLI verbs are lowercase single-word (click, scroll, navigate, fillsheet)
- CLI_COMMAND_TABLE uses markdown table format grouped by category
- isValidTool uses a flat array of camelCase function names
- CLI parser maps lowercase verbs to FSB.tools function calls

### Integration Points
- CLI_COMMAND_TABLE feeds into system prompt via `_buildCoreTools()` method
- Parser verb registry routes parsed commands to content script execution
- isValidTool gates action execution in the automation loop

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- infrastructure phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
