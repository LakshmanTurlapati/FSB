# Phase 71: Virtualized PDF Reader - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute multi-page virtualized PDF viewer reading with unloading pages via MCP manual tools; fix blockers.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Find a web-based PDF viewer that virtualizes pages (loads/unloads pages as you scroll)
- Options: pdf.js demo viewer, Google Drive PDF viewer, or a document viewer site
- No auth required for public PDFs

### Test Workflow
- Navigate to a multi-page PDF in a web viewer
- Scroll through multiple pages to trigger virtualized loading/unloading
- Read text from pages that were previously unloaded (scroll back)
- Verify text extraction works across virtualized page boundaries

### Pass/Fail & Diagnostics
- PASS = scrolled through virtualized PDF, read text from pages that were loaded/unloaded/reloaded
- PARTIAL = scrolling worked but couldn't read from previously unloaded pages
- FAIL = couldn't interact with PDF viewer
- Use scroll for page navigation, read_page for text extraction
- Same diagnostic report template

### Claude's Discretion
- Which PDF viewer and document to use
- How to detect virtualized page loading/unloading
- Text extraction approach
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- scroll, scroll_at, read_page, get_dom_snapshot

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- SCROLL-05 requirement
- `.planning/ROADMAP.md` -- Phase 71 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scroll` for page navigation within PDF viewer
- `read_page` for text extraction
- `get_dom_snapshot` for page element inspection
- pdf.js renders pages as canvas elements with text layers

### Integration Points
- Site guide in `site-guides/productivity/pdf-viewer.js` or similar

</code_context>

<specifics>
## Specific Ideas

- pdf.js uses canvas for rendering + div.textLayer for selectable text
- Pages outside viewport get their canvas cleared (virtualized)
- Scrolling back triggers re-render of previously cleared pages

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 71-virtualized-pdf-reader*
*Context gathered: 2026-03-21*
