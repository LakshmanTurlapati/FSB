# Roadmap: v9.1 Site Intelligence

**Status:** Complete
**Created:** 2026-02-18

## Overview

This milestone gives FSB knowledge about website structure before it starts automating. Pre-bundled site maps provide instant navigation intelligence for common sites. For unknown sites, the Site Explorer reconnaissance system crawls and maps the site, then a two-tier processing pipeline (local formatting + optional AI refinement) converts raw recon data into structured memories the AI can consume at task start. The side panel surfaces reconnaissance as a recovery option when automation gets stuck on unfamiliar sites.

## Phases

### Phase 2: Site Map Intelligence -- COMPLETE (2026-02-18)
**Goal**: Convert reconnaissance data into actionable site map memories with two-tier processing, side panel integration, and AI context injection
**Plans**: 4/4 plans complete
**Dependency chain**: Plan 1 (foundation) -> Plan 2 (AI tier, parallel with Plan 4) -> Plan 3 (side panel, depends on 1+2)

#### Plan 2-01: Pre-bundled Site Maps + Local Converter (Tier 1)
- `site-maps/` directory with curated JSON files
- `lib/memory/sitemap-converter.js` -- local data transformer
- Memory schema extension (`site_map` category)
- "Save to Memory" button on research results
- **Files**: site-maps/*.json (NEW), lib/memory/sitemap-converter.js (NEW), lib/memory/memory-schemas.js, ui/options.js, ui/options.html

#### Plan 2-02: AI Refinement Pipeline (Tier 2) + Settings Toggle
- `lib/memory/sitemap-refiner.js` -- AI enrichment module
- `autoRefineSiteMaps` toggle in Advanced Settings (ON by default)
- Auto-trigger after Tier 1 when toggle is ON
- "Refine with AI" manual button on unrefined memories
- "AI Enhanced" / "Basic" badge on site map memories
- **Files**: lib/memory/sitemap-refiner.js (NEW), ui/options.html, ui/options.js, ui/options.css, config.js

#### Plan 2-03: Side Panel Reconnaissance Integration
- "Run Reconnaissance" button on task failure (stuck type, no existing map)
- Side panel triggers Site Explorer with compact progress in chat
- Auto Tier 1 + Tier 2 on completion, auto-save to memory
- Retry button after recon completes
- `autoSaveToMemory` flag on startExplorer
- **Files**: ui/sidepanel.js, ui/sidepanel.css, background.js, utils/site-explorer.js

#### Plan 2-04: AI Context Injection at Task Start
- Site map retrieval: pre-bundled first, then memory system
- "SITE KNOWLEDGE" section in AI prompt
- Budget carved from memory allocation
- Pre-bundled map loader with caching in background.js
- **Files**: ai/ai-integration.js, background.js

---

### Phase 3: Site Map Visualization -- COMPLETE (2026-02-18)
**Goal**: Interactive force-directed graph visualization of site map memories -- click a memory to expand an inline SVG graph showing page structure, navigation paths, forms, and workflows
**Plans**: 2/2 plans complete
**Depends on**: Phase 2
**Dependency chain**: Plan 1 (graph engine) -> Plan 2 (UI integration)

Plans:
- [x] 03-01-PLAN.md -- Bundle d3-force libraries + create site-graph.js data transformer and SVG renderer
- [x] 03-02-PLAN.md -- Wire graph into options page Memory tab with click-to-expand, CSS styling, script loading

#### Plan 3-01: d3-force Bundle + Site Graph Engine (Wave 1)
- Bundle d3-force v3.0.0 + 3 dependencies (~12KB total) in lib/visualization/
- `site-graph.js` -- data transformer (sitePattern -> {nodes, links}), SVG renderer, interaction handlers (drag, zoom, pan, tooltips)
- Simulation caching per memory ID for instant re-expand
- **Files**: lib/visualization/d3-*.min.js (NEW x4), lib/visualization/site-graph.js (NEW)

#### Plan 3-02: Options Page Integration (Wave 2)
- Script tags for d3 libs + site-graph.js in options.html
- Click-to-expand toggle on site_map memory items in options.js
- Graph container, node, edge, tooltip, legend CSS in options.css
- Dark theme support
- **Files**: ui/options.html, ui/options.js, ui/options.css

---

## Dependency Graph

```
Phase 2:
  Plan 2-01 (Tier 1 foundation)
    |
    +---> Plan 2-02 (AI Tier 2 + toggle)
    |       |
    |       +---> Plan 2-03 (side panel -- needs both tiers)
    |
    +---> Plan 2-04 (AI context injection -- needs memory format from 2-01)

Phase 3:
  Plan 3-01 (graph engine) --> Plan 3-02 (UI integration)
```

Plans 2-02 and 2-04 can execute in parallel after 2-01.
Plan 2-03 requires both 2-01 and 2-02.
Plan 3-01 is independent (Wave 1). Plan 3-02 depends on 3-01 (Wave 2).
