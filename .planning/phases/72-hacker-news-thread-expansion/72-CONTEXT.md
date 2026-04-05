# Phase 72: Hacker News Thread Expansion - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute HN post nested comment thread full expansion with 1000+ comments via MCP manual tools; fix blockers.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Hacker News (news.ycombinator.com) -- free, no auth needed for reading
- Find a popular post with 1000+ comments
- HN is server-rendered HTML -- simple DOM structure

### Test Workflow
- Navigate to a popular HN post with many comments
- Click "more" links to expand collapsed comment threads
- Scroll and expand until all nested comments are visible
- Count total expanded comments to verify 1000+ threshold

### Pass/Fail & Diagnostics
- PASS = thread fully expanded with 1000+ comments visible
- PARTIAL = some expansion worked but couldn't reach 1000+ or some threads stayed collapsed
- FAIL = couldn't expand any comment threads
- Use click for "more" links, scroll for navigation, read_page for counting
- Same diagnostic report template

### Claude's Discretion
- Which HN post to target
- How to systematically find and click all "more" links
- Comment counting strategy
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- click, scroll, read_page, get_dom_snapshot

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- SCROLL-06 requirement
- `.planning/ROADMAP.md` -- Phase 72 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click` for expanding "more" links
- `scroll` for page navigation
- `read_page` for comment extraction and counting
- HN uses simple table-based HTML -- very automation-friendly

### Integration Points
- Site guide in `site-guides/social/` or `site-guides/news/hackernews.js`

</code_context>

<specifics>
## Specific Ideas

- HN uses simple HTML tables for comments -- no JavaScript frameworks
- "More" links load additional comments via page navigation
- Comments are in tr.athing elements with class comtr
- Thread depth indicated by td.ind width attribute

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 72-hacker-news-thread-expansion*
*Context gathered: 2026-03-21*
