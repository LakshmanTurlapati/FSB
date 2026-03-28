# Phase 22: Page Text Extraction for Reading Tasks - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the YAML DOM snapshot format with a unified markdown representation. The AI receives page context as a markdown document where page text content and interactive element refs are interwoven -- the AI sees the page as a human would read it, with clickable/typeable elements labeled inline. Additionally, a `readpage` CLI command provides full untruncated page text for reading/summarization tasks. This retires the Phase 16 YAML snapshot format.

</domain>

<decisions>
## Implementation Decisions

### Snapshot Format: Unified Markdown
- The entire AI page context is a single markdown document replacing YAML
- Page regions map to markdown heading hierarchy: `## Header`, `## Main Content`, `## Sidebar`, `## Footer`
- Interactive elements appear inline in backtick notation: `` `e5: button "Submit"` ``
- Surrounding page text (headings, paragraphs, lists, tables) flows naturally around elements
- The AI sees the page as a person would read it, with actionable elements labeled in context

### Element Ref Notation
- Backtick-wrapped inline notation: `` `e5: button "Submit"` ``
- Attributes as bracket flags: `` `e5: button "Submit" [disabled]` ``
- Site guide hints appended: `` `e2: input "Search" [hint:searchBox]` ``
- Form values with equals: `` `e3: input "Username" = "john_doe"` ``
- Checked/selected state: `` `e7: checkbox "Remember me" [checked]` ``

### Page Metadata
- Markdown header block (not YAML frontmatter)
- Page title as H1, URL and scroll/viewport as blockquote below it
- Example: `# Amazon - Product Page` then `> URL: https://... | Scroll: 0% | Viewport: 1920x1080`

### Content Formatting (Markdown-Lite)
- Preserve: headings (#), lists (nested + flat), links [text](url), tables (markdown), blockquotes (>), code blocks (```)
- Images become `[Image: alt text]` placeholders
- Bold/italic preserved
- Visible content only -- hidden/collapsed elements (display:none, accordions) are skipped
- Aggressive whitespace normalization: collapse multiple blank lines, trim per-line spacing
- No deduplication -- if text appears twice in viewport, it appears twice in output

### Token Budget & Truncation
- Snapshot character limit: ~12K chars (~3K tokens)
- Hard truncation with scroll hint: `[...content continues below -- scroll down and observe]`
- Full markdown snapshot on every iteration (no minimal/delta continuation format)
- Increased element limit vs current 50 -- Claude determines optimal count given richer format

### `readpage` CLI Command
- Dedicated command for full untruncated page text (no element refs, just content)
- Default: viewport text only
- `readpage --full` flag: entire `<body>` text (no smart filtering, full dump)
- Returns inline as action result (same turn), not in next iteration's snapshot
- Markdown-lite formatting (same as snapshot: headings, lists, links, tables, images as alt text)
- AI decides when to use it based on task needs (documented in CLI command table, no forced prompting)
- Optional CSS selector argument: Claude's discretion on whether to implement

### Claude's Discretion
- Exact element budget increase (from current 50)
- Whether `readpage` supports optional CSS selector argument
- HTML-to-markdown conversion approach (DOM walker vs regex vs library)
- How to handle edge cases: iframes, shadow DOM content, canvas-only pages (Google Sheets)
- Region detection heuristics (landmark roles, semantic HTML, fallback for non-semantic pages)

</decisions>

<specifics>
## Specific Ideas

- Gmail inbox preview: elements interwoven with email previews so AI sees context around each interactive element
- Amazon product page: product title, price, rating as text with "Add to Cart" button ref inline
- The format should work for EVERY page type -- articles, dashboards, forms, email clients, search results
- Google Sheets will need special handling since canvas grid has no readable DOM text (existing site guide patterns still apply)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/dom-analysis.js`: DOM traversal, element filtering, region detection -- foundation for markdown generation
- `content/actions.js:3631` getText: single-element text extraction -- `readpage` extends this concept
- Phase 16 YAML snapshot engine: region grouping, element ref assignment, metadata header, duplicate collapse, interactive filtering -- much of this logic carries over
- Site guide annotation matching from Phase 16: hint injection based on URL + CSS selector matching

### Established Patterns
- Element ref assignment (e1, e2, e3) -- same ref numbering system, just different output format
- 15K prompt budget with 40/50/10 split (system/context/memory) -- 12K char snapshot fits in context tier
- CLI command registry in `ai/cli-parser.js` -- `readpage` needs a new entry
- Content script message passing for snapshot requests (`getYAMLSnapshot` handler becomes `getMarkdownSnapshot`)

### Integration Points
- `ai/ai-integration.js`: snapshot insertion into prompts (~L871-902 currently builds YAML) -- replace with markdown builder
- `background.js`: message handler for snapshot requests from AI integration layer
- `content/messaging.js`: content script handler that gathers DOM data and returns snapshot
- `ai/cli-parser.js:170`: command registry -- add `readpage` entry
- `content/actions.js`: add `readPage` action handler for full text extraction
- System prompt CLI command table: document `readpage` command

</code_context>

<deferred>
## Deferred Ideas

- Smart content extraction mode (Reader Mode heuristics for article detection) -- could be a future `readpage --smart` flag
- Progressive snapshot depth (full/focused/delta) for token reduction on continuation iterations (FUT-01 in REQUIREMENTS.md)
- TOON-style tabular formatting for list data in snapshots (FUT-02 in REQUIREMENTS.md)

</deferred>

---

*Phase: 22-page-text-extraction-for-reading-tasks*
*Context gathered: 2026-03-06*
