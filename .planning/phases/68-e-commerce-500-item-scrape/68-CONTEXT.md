# Phase 68: E-Commerce 500-Item Scrape - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute dynamic e-commerce search page full scrape of 500 product names via MCP manual tools; fix blockers.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use an e-commerce site with paginated or infinite-scroll product listings (Amazon, eBay, or similar)
- No auth required for product search
- Dismiss cookie/consent popups

### Test Workflow
- Navigate to product search results (e.g., "wireless mouse" on Amazon)
- Extract product names from the current page
- Navigate to next page or scroll for more results
- Repeat until 500 product names collected
- Verify count of extracted names

### Pass/Fail & Diagnostics
- PASS = 500 product names extracted from search results
- PARTIAL = some products extracted but fewer than 500
- FAIL = couldn't extract any product names
- Use read_page/get_dom_snapshot for extraction, scroll/click for pagination
- Same diagnostic report template

### Claude's Discretion
- Which e-commerce site and search query
- Pagination vs infinite scroll approach
- Data storage format for extracted names
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- scroll, click, read_page, get_dom_snapshot

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- SCROLL-02 requirement
- `.planning/ROADMAP.md` -- Phase 68 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `read_page` for text extraction per page
- `click` for next page button
- `scroll` for infinite scroll sites
- `get_dom_snapshot` for structured product element extraction

### Integration Points
- Site guide in `site-guides/ecommerce/` for product scraping patterns

</code_context>

<specifics>
## Specific Ideas

- Amazon shows ~20 products per page, need ~25 pages for 500 products
- Alternative: use a site with more products per page
- Product names are typically in h2 or specific data-attribute elements

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 68-e-commerce-500-item-scrape*
*Context gathered: 2026-03-21*
