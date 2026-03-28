# Phase 27: Site Explorer Markdown Snapshot Integration - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add markdown snapshot capture to the Site Explorer crawler so crawl results show the exact AI-visible page view. Two deliverables: (1) site-explorer.js fetches getMarkdownSnapshot per page with guide selector threading, (2) options.js research detail view renders per-page markdown snapshots in collapsible pre blocks with stats. Goal is diagnostic: see what the AI actually sees when automating any site, especially Google Sheets.

</domain>

<decisions>
## Implementation Decisions

### Snapshot display
- Collapsible pre block per crawled page (details/summary pattern matching existing pages-crawled list)
- Show stats line above the pre block: character count and element count (e.g., "Markdown: 4,231 chars, 42 elements")
- Pages without a snapshot show a "Snapshot unavailable" warning instead of being hidden — makes failures visible

### Guide selector threading
- Resolve site guide per crawled URL using URL-based matching only (getGuideForTask(url, '') with empty task text)
- Pass guideSelectors through getMarkdownSnapshot message options — same path as the automation loop (messaging.js handler already accepts this)
- Show matched guide name next to each page in research results (e.g., "Guide: Google Sheets") — confirms detection is working
- Runs in background script context where getGuideForTask() is already available

### Per-page view
- Individual collapsible per page (not one big block for all pages) — manageable for 25-page crawls
- Per-page only, no cross-page summary or diff view — keep scope tight

### Snapshot scope
- Always capture — every crawl automatically fetches markdown snapshot per page, no toggle needed
- No readpage/extractPageText capture — just the markdown snapshot (interactive elements + regions)
- Downloaded research JSON includes full markdown snapshot text per page for offline analysis
- No storage concern — 100-300KB per crawl is fine within chrome.storage.local 10MB limit, existing 100-result cap handles cleanup

### Claude's Discretion
- Pre block styling (dark bg, color hints for refs — whatever looks clean with minimal effort)
- Whether to add a copy-to-clipboard button on the snapshot pre block
- Whether to include a per-page element summary table in the cross-page view

</decisions>

<specifics>
## Specific Ideas

- The main use case is crawling a Google Sheets URL and seeing if the formula bar, name box, and toolbar elements appear in the snapshot with their values
- This is a diagnostic/debugging tool — it should show exactly what the AI sees, unmodified
- The markdown snapshot format is already defined by buildMarkdownSnapshot() — just capture and display it as-is

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `site-explorer.js:collectPageData()` — main per-page data collection, already calls getDOM, needs getMarkdownSnapshot added after
- `site-explorer.js:sendTabMessage()` — message passing helper with timeout, reuse for getMarkdownSnapshot call
- `options.js:viewResearchDetail()` — research detail rendering with existing details/summary pattern for pages list
- `messaging.js` handler for `getMarkdownSnapshot` — already accepts `options.guideSelectors`, no changes needed
- `getGuideForTask()` — available in background script context for URL-based guide resolution

### Established Patterns
- `collectPageData()` stores everything on `pageData` object, saved to `pagesCollected[]`, then to chrome.storage.local via `saveResearch()`
- Research detail view uses inline HTML template strings with `escapeHtml()` for safe rendering
- Guide selector resolution: `getGuideForTask(url, taskText)` returns guide object with `fsbElements` property
- Existing per-page display: `<li>${escapeHtml(p.url)} (${p.interactiveElements?.length || 0} elements)</li>`

### Integration Points
- `site-explorer.js:260-266` — after getDOM call, add getMarkdownSnapshot call
- `site-explorer.js:287-299` — pageData object definition, add markdownSnapshot field
- `options.js:3181-3188` — pages crawled details section, add snapshot collapsible per page
- `options.js:3156-3190` — research detail HTML template, add snapshot stats to summary grid
- `background.js` — getGuideForTask already available globally, site-explorer.js runs in same context

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-site-explorer-markdown-snapshot-integration*
*Context gathered: 2026-03-11*
