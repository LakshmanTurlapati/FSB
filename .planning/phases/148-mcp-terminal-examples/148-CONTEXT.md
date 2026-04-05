# Phase 148: MCP Terminal Examples - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Net-new Claude Code terminal mockups in the showcase "See It in Action" section showing FSB MCP tools in action. Two terminal blocks: autopilot mode (run_task) and manual mode (multi-tool orchestration). Dark-themed, animated on scroll, using semantic CSS classes.

</domain>

<decisions>
## Implementation Decisions

### Terminal Content
- Autopilot example: "Search Amazon for wireless mouse under $30 and add the best-rated one to cart" -- concrete and relatable
- Manual mode sequence: read_page -> click (search button) -> type_text (query) -> click (result) -- shows multi-step orchestration
- Show abbreviated tool_result blocks (3-4 lines each) with success status
- Include progress/cost output line: "Progress: 75%... Cost: $0.003"

### Terminal Styling
- Dark theme always (stays dark in both showcase light/dark modes) -- convention for terminal displays
- Reuse .browser-frame with 3 macOS dots -- consistent with other recreations
- Line-by-line reveal animation with 150ms stagger per line on scroll via IntersectionObserver

### Claude's Discretion
- Exact tool output text content
- CSS class naming within rec-mcp-* namespace
- Whether to add a section header/description above the terminal blocks
- Exact monospace font stack

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- showcase/css/recreations.css -- .browser-frame container pattern
- showcase/js/recreations.js -- IntersectionObserver cascade pattern
- showcase/about.html -- existing "See It in Action" section structure
- mcp-server/src/tools/autopilot.ts -- real run_task tool signature
- mcp-server/src/tools/manual.ts -- real read_page, click, type_text tool signatures

### Established Patterns
- .browser-frame > .browser-header > .browser-content
- --rec-* CSS variable namespace
- IntersectionObserver with threshold 0.3
- Sequential element reveal with stagger

### Integration Points
- Add new section in about.html after existing recreations (or replace if appropriate)
- Add rec-mcp-* CSS in recreations.css
- Add initTerminalAnimation() in recreations.js

</code_context>

<specifics>
## Specific Ideas

Terminal blocks should look like a realistic Claude Code session:
- $ prompt with claude command
- Tool use blocks with indented parameters
- Result blocks with status indicators
- Use semantic classes: .term-prompt, .term-command, .term-tool-block, .term-result-block, .term-cursor

</specifics>

<deferred>
## Deferred Ideas

- MCP agent creation example (create_agent with scheduling) -- deferred per requirements
- Interactive terminal (actual typing) -- static animated replica only

</deferred>
