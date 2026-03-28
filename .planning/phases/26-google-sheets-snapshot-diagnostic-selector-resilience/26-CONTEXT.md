# Phase 26: Google Sheets Snapshot Diagnostic & Selector Resilience - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the Sheets snapshot pipeline against Google DOM changes and make it debuggable. Three deliverables: (1) multi-strategy selector lookup so Name Box and Formula Bar survive DOM reshuffles, (2) diagnostic logging that shows which selector matched and a one-time health check, (3) content reading improvements including cell ref validation, Name Box + Formula Bar pairing, and formula text display. Also includes a live DOM assertion self-test on first Sheets snapshot.

</domain>

<decisions>
## Implementation Decisions

### Selector resilience strategy
- Multi-strategy lookup: try selectors in priority order (ID -> class -> aria-label -> role+context), first match wins
- 4-5 well-researched selectors per element (Name Box, Formula Bar) -- enough depth that heuristic guessing is unnecessary
- Site guide (google-sheets.js) owns all selector definitions -- dom-analysis.js receives selector config, doesn't hardcode selectors
- When ALL selectors for an element fail: log a clear warning and skip the element (no heuristic scan fallback)
- Sheets-only scope -- no generic canvas-app pattern; extract a reusable pattern in a future phase if this works well

### Diagnostic visibility
- Console + debug log: use existing logger (FSB.sessionId-based) and also emit to console.debug when Debug Mode is enabled in options
- Log which selector in the priority chain matched for each fsbRole element (e.g., "name-box found via #t-name-box [1/5]")
- One-line summary by default, detailed multi-field objects when verbose/debug mode is active
- One-time health check on first Sheets snapshot: emit pass/fail summary per element (e.g., "[Sheets Health] name-box: OK, formula-bar: OK, post-inject: 0 needed")

### Content reading edge cases
- Empty formula bar: show element with (= "") so the AI knows it exists and can interact with it -- don't hide the element
- Name Box: validate cell reference format (A1, B2:C10, Sheet2!A1 patterns); if invalid, still show the value but flag in diagnostic log
- Pair Name Box value with Formula Bar content in the snapshot so the AI sees which cell is selected AND its content in one glance
- Show formula text (e.g., =SUM(A1:A10)) not computed values -- display what's actually in the formula bar DOM element

### Snapshot pipeline self-test
- Live DOM assertion on first Sheets snapshot when Debug Mode is enabled
- Verify both element presence in markdown output AND content format (Name Box has valid cell ref)
- On failure: console warning + diagnostic dump of all 5 pipeline stages with pass/fail status
- First snapshot only per Sheets session -- no per-iteration overhead

### Claude's Discretion
- Exact heuristic aggressiveness for the last-resort fallback scan (if implemented beyond multi-strategy)
- Specific aria-label and role+context selector patterns for Name Box and Formula Bar (research Google Sheets DOM)
- How to pair Name Box + Formula Bar values in the markdown output format
- Self-test implementation details (assertion structure, dump format)

</decisions>

<specifics>
## Specific Ideas

- The markdown snapshot already gives the AI a clear map of interactive elements -- selector resilience is about ensuring elements GET INTO the snapshot, not about the AI finding them afterward
- Phase 25 proved post-walk injection works for aria-hidden parents; Phase 26 hardens the SELECTORS that feed into that injection
- Existing 5 diagnostic log points (sheets_injection, sheets_visibility_filter, sheets_walker_postinject, sheets_formula_bar_capture, sheets_snapshot_summary) are the foundation -- enhance them, don't replace them
- Health check should be a quick pass/fail glance in the console, not a verbose wall of text

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Stage 1b injection at dom-analysis.js:1764-1803 -- injects Sheets elements with data-fsbRole, needs selector list refactored to come from site guide
- Post-walk injection at dom-analysis.js:2370-2397 -- Phase 25 fix guaranteeing fsbRole elements in snapshot, deduplicates via string matching
- formatInlineRef() at dom-analysis.js:2112-2156 -- formula bar content reading with 3 fallback sources, name box cell ref reading
- Google Sheets site guide at site-guides/productivity/google-sheets.js:126-145 -- current selector definitions (2 per element)
- Cell reference validation regex at content/actions.js:1674-1678 -- `/^[A-Z]{1,3}[0-9]{1,7}(:[A-Z]{1,3}[0-9]{1,7})?$/i`

### Established Patterns
- fsbRole elements bypass ALL visibility checks at dom-analysis.js:1809 (Stage 2) and :2020 (isVisibleForSnapshot)
- Site guide flows through: getGuideForTask() -> detectTaskType() -> _buildTaskGuidance() -> system prompt
- Logger uses `logger.logDOMOperation(FSB.sessionId, 'operation-name', {...})` pattern for all diagnostic logging
- isCanvasBasedEditor() at dom-analysis.js triggers Sheets-specific code paths

### Integration Points
- dom-analysis.js Stage 1b reads selector config -- needs to pull from site guide instead of hardcoding
- buildMarkdownSnapshot() at dom-analysis.js:2412-2472 orchestrates the full pipeline and emits final summary log
- Name Box detection in actions.js uses `element.id === 't-name-box'` -- must stay in sync with selector list
- Toolbar bypass in actions.js:1103-1107 uses hardcoded Sheets selectors -- consider sharing from site guide

</code_context>

<deferred>
## Deferred Ideas

- Generic canvas-app selector resilience pattern for Google Docs, Slides, Figma -- future phase if Sheets pattern works well
- Audit all 9 keyword categories for selector definitions -- only Sheets in scope
- Mock DOM unit test for snapshot pipeline (synthetic Sheets DOM fragment) -- consider if live assertion proves insufficient
- Parent chain diagnosis logging (which ancestor caused aria-hidden filtering) -- useful but lower priority than selector-matched logging

</deferred>

---

*Phase: 26-google-sheets-snapshot-diagnostic-selector-resilience*
*Context gathered: 2026-03-10*
