# Phase 2 Research: Site Map Intelligence

**Created:** 2026-02-18

## Problem Statement

Site Explorer collects rich reconnaissance data (pages, elements, forms, navigation, selectors) but it's stored as raw JSON in `chrome.storage.local` and only surfaced as stats in the options page. The AI has no access to this data at task start, so it navigates blind on every site. Pre-bundled site maps for common sites would give instant intelligence, and a processing pipeline for unknown sites would convert raw recon into actionable memories.

## Existing Infrastructure

### What Already Works

1. **Site Explorer** (`utils/site-explorer.js`):
   - BFS crawl with configurable depth (1-5) and pages (5-50)
   - Collects DOM elements, forms, navigation, headings, layout, internal links, key selectors
   - Saves to `chrome.storage.local` under `fsbResearchData` / `fsbResearchIndex`
   - `buildSiteMap()` creates flat pathname-to-metadata dictionary
   - Broadcasts status via `explorerStatusUpdate` messages

2. **Memory System** (`lib/memory/`):
   - Three types: episodic, semantic, procedural
   - Semantic memory has `typeData.category` supporting: selector, site_pattern, user_preference, general
   - `memory-storage.js` handles CRUD with 500 memory limit, 8MB storage cap
   - `memory-retriever.js` fetches relevant memories by domain/task at session start
   - Memory tab in options page with search, filter, display

3. **AI Prompt** (`ai/ai-integration.js`):
   - `buildPrompt()` assembles system prompt + page context + memory context
   - 15K HARD_PROMPT_CAP with 40/50/10 split (system/page/memory)
   - `buildMemoryContext()` retrieves and formats memories for the prompt
   - Memory retrieval at task start already exists (MEM-04 from v9.0.2)

4. **Side Panel** (`ui/sidepanel.js`):
   - Task failure handler at line ~837 with retry button
   - Stuck detection shows guidance messages
   - Listens for runtime messages from background
   - Header actions: history, new chat, settings buttons

5. **Options Page** (`ui/options.js`):
   - Site Explorer UI with start/stop, progress bar, research list
   - Research results: view/download/delete per item
   - Toggle grid in Advanced Settings for performance options
   - Default settings stored in `config.js`

6. **Site Guides** (`site-guides/`):
   - 10 guide files: ecommerce, social, coding, travel, finance, email, gaming, career, productivity + index
   - These are navigation hint modules, NOT site maps
   - Site maps would complement these with structural data

### Key Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Site Explorer class | utils/site-explorer.js | 1-670 |
| buildSiteMap() | utils/site-explorer.js | 483-498 |
| saveResearch() | utils/site-explorer.js | 417-477 |
| Explorer data collection | content.js | 12467-12700+ |
| Memory schemas | lib/memory/memory-schemas.js | 11-99 |
| createSemanticMemory() | lib/memory/memory-schemas.js | 72-82 |
| Memory retriever | lib/memory/memory-retriever.js | full file |
| buildPrompt() | ai/ai-integration.js | ~2400+ |
| buildMemoryContext() | ai/ai-integration.js | searches for domain memories |
| Side panel error handler | ui/sidepanel.js | 837-871 |
| Research list UI | ui/options.js | 2857-2909 |
| startExplorer handler | background.js | 3899-3913 |
| Toggle grid | ui/options.html | 338-362 |
| Default settings | ui/options.js | 17-21 |

## Design Decisions

### 1. Memory Format for Site Maps

Use `semantic` memory type with `category: 'site_map'` and structured `typeData.sitePattern`:

```javascript
createSemanticMemory(
  "Site map for linkedin.com: 15 pages, 8 forms, primary nav with 6 items",
  { domain: 'linkedin.com', tags: ['site_map'], confidence: 0.9 },
  {
    category: 'site_map',
    sitePattern: {
      domain: 'linkedin.com',
      pages: { '/feed': {...}, '/jobs': {...}, '/messaging': {...} },
      navigation: [ { label: 'Jobs', path: '/jobs' }, ... ],
      workflows: [ "Job search: /jobs -> search -> click result -> /jobs/view/ID" ],
      tips: [ "Uses AJAX loading, wait for elements after navigation" ],
      keySelectors: { 'search': '#global-nav-search', ... },
      source: 'recon',       // 'recon' | 'bundled'
      refined: false,         // true after AI Tier 2
      refinedAt: null,
      reconId: 'research_123',
      pageCount: 15,
      formCount: 8,
      crawledAt: 1708300000000
    }
  }
);
```

### 2. Pre-bundled Map Format

JSON files in `site-maps/` matching the `sitePattern` structure:

```json
{
  "domain": "linkedin.com",
  "source": "bundled",
  "refined": true,
  "pages": { ... },
  "navigation": [ ... ],
  "workflows": [ ... ],
  "tips": [ ... ],
  "keySelectors": { ... }
}
```

Loaded via `fetch(chrome.runtime.getURL('site-maps/linkedin.json'))`.

### 3. Two-Tier Processing

- **Tier 1 (local)**: Pure JS data transformation. Maps recon pages array into the sitePattern structure. Extracts navigation from page data, builds page tree, identifies forms. Instant, deterministic, free.
- **Tier 2 (AI)**: Single API call with Tier 1 output + selected raw data. AI identifies workflows, generates navigation strategies, recommends selector preferences. Result merged into sitePattern with `refined: true`.

### 4. AI Refinement Prompt Strategy

Send a focused prompt (not the full recon dump) to keep token cost low:
- Include: Tier 1 site map, page titles/URLs, form descriptions, navigation structure
- Exclude: raw element arrays, position data, individual selector lists
- Ask for: workflows, tips, navigation strategy, page purposes
- Estimated tokens: ~2-3K input, ~500-1K output per site

### 5. Side Panel Recon Flow

The side panel should NOT navigate away from the user's current page. The Site Explorer already creates its own tab for crawling. The side panel just sends the message and shows progress updates.

### 6. Conflict Resolution: Bundled vs Recon

Priority order for site map lookup:
1. Pre-bundled (highest -- curated, reliable)
2. AI-refined recon memory
3. Basic (Tier 1 only) recon memory

If a user runs recon on a site that has a pre-bundled map, the recon memory is stored but the bundled map still takes priority at prompt injection time. User can delete the bundled map file to prefer their recon data.

## Risks

1. **Token cost**: Tier 2 uses tokens per site. Mitigated by single call per site + toggle to disable.
2. **Storage pressure**: Site maps with many pages could be large. Mitigated by 500 memory limit + 8MB cap already in memory system.
3. **Stale maps**: Sites change over time. Mitigated by showing crawl date + user can re-run recon.
4. **AI hallucination in Tier 2**: AI might invent workflows that don't exist. Mitigated by merging into (not replacing) Tier 1 data.
