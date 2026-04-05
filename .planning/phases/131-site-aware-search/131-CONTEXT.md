# Phase 131: Site-Aware Search - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode)

<domain>
## Phase Boundary

The search tool finds and uses the site's own search input on any website, falling back to Google only when no site search exists. Detection uses a deterministic DOM heuristic cascade (no AI calls). After typing the query, the form is submitted via Enter or submit button click.

</domain>

<decisions>
## Implementation Decisions

### Search Input Detection
- **D-01:** 4-tier selector cascade: `input[type="search"]` -> `[role="search"] input` -> `input[name="q"]` -> `input[placeholder*="Search" i]`. Research says this covers 90%+ of sites.
- **D-02:** If multiple matches, prefer the one that's visible and in the viewport.
- **D-03:** No AI-powered detection -- deterministic heuristics only.

### Search Execution
- **D-04:** After finding the search input: click to focus, clear existing text, type the query, then submit via Enter key. If Enter has no effect (leveraging Phase 129's fallback), the submit button will be clicked automatically.
- **D-05:** After submission, wait for page stability before returning results status.

### Routing
- **D-06:** The current `search` MCP tool always calls `searchGoogle`. Replace this with: (1) try site search, (2) if no search input found, fall back to Google.
- **D-07:** The MCP tool handler should be modified in the mcp-server (manual.ts) to send a new message type (e.g., `mcp:site-search`) that tries site-first, or modify the existing search handler in background.js.

### Claude's Discretion
All implementation details not specified above are at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- content/actions.js searchGoogle tool -- current Google-only search implementation
- content/actions.js type tool -- for typing into the search input
- content/actions.js pressEnter tool -- for submitting (now with submit button fallback from Phase 129)
- content/actions.js click tool -- for focusing the search input
- mcp-server/src/tools/manual.ts search tool definition -- current MCP handler

### Key Code Paths
- MCP `search` tool at manual.ts calls `execAction(bridge, queue, 'search', 'searchGoogle', { query })`
- background.js handles `mcp:execute-action` which dispatches to content script
- content/actions.js `searchGoogle` navigates to google.com/search?q=...

### Integration Points
- content/actions.js -- add new `siteSearch` tool that implements the detection + type + submit flow
- background.js or mcp-server -- route `search` to try `siteSearch` first, fall back to `searchGoogle`
- The simplest approach: add siteSearch to content/actions.js, modify the MCP search handler to try siteSearch first

</code_context>

<specifics>
## Specific Ideas

- The siteSearch function should return { found: true/false, ... } so the caller knows whether to fall back
- Consider making it a content script action that the background.js handler calls first

</specifics>

<deferred>
## Deferred Ideas

- SRCH-05: Site-guide selector integration (v2)
- SRCH-06: Autocomplete handling (v2)

</deferred>
