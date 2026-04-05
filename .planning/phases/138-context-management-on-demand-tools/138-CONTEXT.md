# Phase 138: Context Management & On-Demand Tools - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Smart discuss (defaults accepted)

<domain>
## Phase Boundary

The AI fetches page context and site intelligence only when needed (on-demand tools), conversation history stays within token budget (sliding window compression), and the user sees live progress and cost.

</domain>

<decisions>
## Implementation Decisions

### On-demand DOM tool
- **D-01:** get_page_snapshot tool registered in tool-definitions.js, returns the same markdown DOM snapshot currently built by getMarkdownSnapshot()
- **D-02:** Tool executed locally in the agent loop (no content script round-trip needed for snapshot generation -- reuses existing snapshot pipeline)
- **D-03:** AI calls this tool when it needs page context -- system no longer auto-injects snapshot every iteration

### On-demand site guide tool
- **D-04:** get_site_guide tool registered in tool-definitions.js, takes domain parameter, returns the site guide text
- **D-05:** Loads guide from existing site-guides/*.js files via the existing getGuideForTask/loadSiteGuide mechanism
- **D-06:** Returns empty string with hint "No site guide available for this domain" if no guide exists

### History compression
- **D-07:** Sliding window: when conversation history reaches 80% of estimated token budget, compact oldest tool_results to summaries
- **D-08:** Keep the most recent 5 tool_result messages intact, compress older ones to "{tool_name} returned {success/error}" one-liners
- **D-09:** System prompt and current iteration messages are never compressed
- **D-10:** Token estimation: rough char/4 heuristic (same approach as existing analytics)

### Progress overlay integration
- **D-11:** Progress overlay shows: current tool being executed, AI reasoning (from report_progress tool), estimated session cost
- **D-12:** report_progress tool registered in tool-definitions.js, AI can call it to update overlay text
- **D-13:** Cost display uses estimateCost() from agent-loop.js, updates after each tool execution

### Prompt caching
- **D-14:** For Anthropic provider: set cache_control on system prompt and tool definitions (they support prompt caching)
- **D-15:** For other providers: no-op (they handle caching internally or don't support it)

### Claude's Discretion
- Exact compression ratio and when to trigger re-compression
- Whether to add a complete_task / fail_task tool or rely on end_turn + text
- Error handling for site guide loading failures
- Format of compressed history entries

</decisions>

<canonical_refs>
## Canonical References

### Dependencies
- `ai/agent-loop.js` -- Agent loop from Phase 137 (845 lines)
- `ai/tool-definitions.js` -- Tool registry from Phase 135 (42 tools, adding 3 more)
- `ai/tool-use-adapter.js` -- Provider adapter from Phase 135
- `ai/tool-executor.js` -- Unified executor from Phase 136

### Existing snapshot/guide code
- `content/dom-analyzer.js` -- DOM snapshot generation (getMarkdownSnapshot)
- `site-guides/` -- 50+ site guide files
- `ai/ai-integration.js` -- getGuideForTask, loadSiteGuide functions

### Research
- `.planning/research/SUMMARY.md` -- Phase 4 recommendations: on-demand tools, sliding window
- `.planning/research/PITFALLS.md` -- P3 (token explosion), P10 (stale DOM)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- getMarkdownSnapshot() in content scripts -- reuse for get_page_snapshot tool
- loadSiteGuide() in ai-integration.js -- reuse for get_site_guide tool
- sendProgressUpdate() in background.js -- reuse for progress overlay updates
- estimateCost() in agent-loop.js -- reuse for cost display

### Integration Points
- tool-definitions.js: add get_page_snapshot, get_site_guide, report_progress tools
- agent-loop.js: add history compression before API call, progress reporting after tool execution
- background.js: route new tool executions (get_page_snapshot triggers content script, get_site_guide loads from storage)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- defaults accepted.

</specifics>

<deferred>
## Deferred Ideas

- Procedural memory as queryable tool -- deferred beyond v0.9.20
- Dynamic tool subsetting -- deferred beyond v0.9.20

</deferred>

---

*Phase: 138-context-management-on-demand-tools*
*Context gathered: 2026-04-01*
