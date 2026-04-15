# Phase 33: Task Memory Display & Migration - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Full redesign of the Task Memory detail view as a proper recon report, add per-task 2D graph visualization (SiteGraph-style) that feeds into the FSB Intelligence knowledge graph, polish existing card styling, and remove the Refine button. Migration utility is descoped — old memories stay as-is.

</domain>

<decisions>
## Implementation Decisions

### Detail View Design
- Full redesign of `renderTaskDetail()` — proper recon report layout, not the basic grid from Phase 31
- Summary + outcome at the top: big outcome badge, task description, domain, duration, step count — glanceable overview
- All subsections (Timeline, Discoveries, Procedures, AI Analysis) are collapsible/expandable with click-to-toggle headers
- AI analysis (keyTakeaways, riskFactors, optimizationTips, reusabilityAssessment) integrated into relevant sections — not a separate section. Risk factors near failures, optimization tips near procedures, etc.

### Graph Visualization
- Per-task graph uses 2D SiteGraph style (SVG radial mind map), NOT the 3D canvas knowledge graph
- Graph data comes from Task Memory's timeline and learned data — pages visited as nodes, elements interacted with, navigation paths
- Graph renders inline in the expanded detail view (embedded in the card, same pattern as SiteGraph for sitemaps)
- Task Memory discoveries (pages, elements, navigation) get added into the FSB Intelligence knowledge graph as well
- Knowledge graph auto-updates when new Task Memories are created — data structure kept fresh, no manual refresh needed

### Migration Utility
- **DESCOPED** — no migration button, no migration utility
- Old memories stay as-is in storage, always visible alongside Task Memories, blend in visually (Phase 31 decision)
- STOR-02 requirement is no longer needed

### Card List Polish
- Polish existing Phase 31 cards: better outcome badge styling, domain indicator, cleaner layout — same structure
- Old-format memories always visible (no toggle to hide them)
- Remove "Refine" button entirely — Task Memories auto-enrich, no refine button for any memory type

### Claude's Discretion
- Exact collapsible section implementation (CSS transitions, chevron icons, default open/closed state)
- How to extract graph data from Task Memory timeline for SiteGraph input
- How to merge task discoveries into the knowledge graph data structure
- Outcome badge color scheme and styling details
- Whether to show graph section collapsed or expanded by default

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderTaskDetail()` in options.js (~line 4621): Basic version from Phase 31 — REWRITE with full recon report
- `SiteGraph` in lib/visualization/site-graph.js: 2D SVG radial mind map — reuse for per-task graphs, needs data transformer for timeline data instead of sitemap data
- `KnowledgeGraph` in lib/visualization/knowledge-graph.js: 3D canvas graph — needs integration point to accept Task Memory data alongside site guide data
- `renderAIAnalysisSection()` in options.js (~line 4738): Existing AI analysis renderer — can be adapted or replaced since AI insights are now integrated into sections
- `toggleMemoryGraph()`: Existing expand/collapse for sitemap graphs — similar pattern for task graphs
- CSS classes: `.detail-grid`, `.detail-section`, `.detail-label`, `.detail-value`, `.outcome-success/failure/partial` — all exist from Phase 31

### Established Patterns
- Accordion expand/collapse: existing memory detail panels use chevron toggle + CSS class toggle
- SiteGraph.transformData() + SiteGraph.render(): public API for data → SVG rendering
- options.js inline HTML generation via template literals
- escapeHtml() utility for safe rendering

### Integration Points
- `renderMemoryDetailPanel()` switch statement (~line 4322): routes to `renderTaskDetail()` — already wired
- `toggleMemoryGraph()`: triggers graph render for a memory — extend for task type
- Knowledge graph data loading: `loadKnowledgeGraph()` in options.js — needs to include Task Memory data
- Memory list card rendering (~line 4143): Phase 31's task card code — polish here

</code_context>

<specifics>
## Specific Ideas

- The detail view should feel like opening an intelligence brief — summary at top, then sections you drill into
- Per-task graph should look like the SiteGraph (NotebookLM-inspired radial mind map) but with data from the task's timeline instead of sitemap crawl data
- Task discoveries enriching the FSB Intelligence graph means FSB gets smarter with every automation — the knowledge graph grows organically from real usage, not just site guide files
- Removing the Refine button cleans up the UI — Task Memories are always complete

</specifics>

<deferred>
## Deferred Ideas

- Migration utility (STOR-02) — descoped, old memories stay as-is
- Cross-task pattern visualization — seeing patterns across multiple Task Memories could be its own feature
- Task Memory export as PDF/markdown report

</deferred>

---

*Phase: 33-task-memory-display-migration*
*Context gathered: 2026-03-16*
