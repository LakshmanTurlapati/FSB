# Phase 126: Content Extraction Reliability - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

read_page returns meaningful, well-structured content from any website on the first call -- no separate wait_for_stable call needed, no 30K walls of text, no empty results from JS-heavy sites. Merges wait_for_stable into read_page with smart retry, adds main-content-first extraction priority, and caps output at ~8K chars for MCP callers.

</domain>

<decisions>
## Implementation Decisions

### Stability Strategy
- **D-01:** Quick-extract-then-retry pattern: extract immediately, if <200 chars wait up to 3s for DOM stability and re-extract. Fast on stable pages, self-healing on SPA pages.
- **D-02:** Sparse threshold is <200 chars -- matches audit data (Airbnb=0, Booking=173, Kayak=233, all below 200). Pages with genuinely sparse content (TikTok=612) won't trigger unnecessary waits.
- **D-03:** Max stability wait is 3 seconds -- long enough for React/Angular/Vue hydration, short enough to not frustrate MCP callers.
- **D-04:** readPage in content/actions.js becomes async to await waitForPageStability. The messaging layer already handles async responses.

### Content Truncation
- **D-05:** Default char cap for MCP read_page is 8K chars. Research found this balances usability vs sidebar/nav noise.
- **D-06:** Main content detection via DOM heuristic: find `<main>`, `[role=main]`, `<article>`, `#content`, `.content` and extract these first. Fill remaining budget with other visible content.
- **D-07:** Autopilot path keeps existing 50K cap -- autopilot needs full context for multi-step tasks. Only the MCP read_page code path gets the 8K default.
- **D-08:** `full: true` parameter bypasses the 8K cap and uses the original 50K limit, since it already means "read entire page".

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `waitForPageStability()` at content/actions.js:1138 -- already handles DOM + network quiescence with configurable maxWait and stableTime
- `extractPageText()` at content/dom-analysis.js:2698 -- current markdown-lite text extraction with viewport filtering, 50K cap
- `isVisibleForSnapshot()` at content/dom-analysis.js:2084 -- visibility check for elements
- `isBlockElement()` at content/dom-analysis.js:2074 -- block element detection for formatting

### Established Patterns
- readPage at content/actions.js:4254 is currently sync, calls FSB.extractPageText() directly
- Background mcp:read-page handler at background.js:13800 sends readPage message to content script via chrome.tabs.sendMessage
- MCP tool at mcp-server/src/tools/read-only.ts:18 enqueues via bridge.sendAndWait with 30s timeout
- Table extraction already caps at 8 columns and 40 chars per cell (dom-analysis.js:2819-2826)

### Integration Points
- content/actions.js readPage function -- make async, add stability wait + truncation
- content/dom-analysis.js extractPageText -- add main-content-first priority and configurable maxChars
- background.js mcp:read-page handler -- pass maxChars parameter through
- mcp-server/src/tools/read-only.ts -- no changes needed (full param already passed through)

</code_context>

<specifics>
## Specific Ideas

- The quick-extract-then-retry pattern should NOT change the extractPageText function signature -- just wrap the call in readPage
- Main content detection should be a lightweight findMainContentRoot() function, not a full Readability.js port
- The 8K cap should apply after extraction (truncate the result), not during (don't change the walker)
- Consider: if main content root is found, extract from that root; if not, extract from body as today

</specifics>

<deferred>
## Deferred Ideas

- CONT-06: Configurable maxChars MCP parameter (v2 -- fixed default is fine for now)
- CONT-07: Canvas/chart data extraction (separate scope entirely)

</deferred>
