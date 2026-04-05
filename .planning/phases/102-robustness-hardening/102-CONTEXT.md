# Phase 102: Robustness Hardening - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add defensive edge-case handling: coordinate validation for CDP tools, bidirectional stuck recovery (coordinate-to-DOM and DOM-to-coordinate suggestions), progressive prompt trimming for heavy pages, and CLI parse failure retry with simplified hint.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- robustness/infrastructure phase. Key context:

- ROBUST-01 (coordinate validation): CDP tool calls in content/actions.js already check `typeof x !== 'number'` but don't validate against viewport. Viewport info available in DOM snapshot data.
- ROBUST-02 (bidirectional stuck recovery): stuckCounter exists in background.js session state. Need to track which tool type was used (coordinate vs DOM) and suggest the opposite on stuck.
- ROBUST-03 (progressive prompt trimming): System prompt assembly in ai/ai-integration.js builds prompt from CLI_COMMAND_TABLE + task guidance + elements + memory. Trimming should reduce in stages.
- ROBUST-04 (CLI parse retry): parseCliResponse in ai/cli-parser.js handles parsing. On failure, need to retry with simplified prompt hint instead of aborting.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- CDP tools in content/actions.js (cdpClickAt:5244, cdpScrollAt:5311, cdpDrag:5276) -- already validate x/y as numbers
- stuckCounter in background.js session state -- tracks consecutive stuck iterations
- System prompt assembly in ai/ai-integration.js:2580-2589 -- builds prompt from multiple components
- parseCliResponse in ai/cli-parser.js -- CLI output parser
- getAutomationActions in ai/ai-integration.js -- main iteration handler that calls AI and processes response

### Established Patterns
- Error handling: try-catch with descriptive error messages including context
- Stuck recovery: stuckCounter increments on same DOM hash, resets on URL/DOM change
- Prompt assembly: template literal with interpolated sections
- Parse failure: currently returns empty actions array or throws

### Integration Points
- content/actions.js CDP tools (ROBUST-01 coordinate validation)
- background.js stuck detection block (ROBUST-02 bidirectional recovery)
- ai/ai-integration.js prompt assembly (ROBUST-03 progressive trimming)
- ai/cli-parser.js or ai/ai-integration.js (ROBUST-04 parse retry)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- infrastructure phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
