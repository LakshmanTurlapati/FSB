# Requirements: v9.1 Site Intelligence

**Status:** Active
**Created:** 2026-02-18

## Site Map Intelligence (Phase 2)

### Pre-bundled Site Maps

- [x] **SM-01**: Ship curated site map JSON files in `site-maps/` directory for common sites (LinkedIn, Google, Amazon, etc.)
- [x] **SM-02**: Load pre-bundled maps on demand via `chrome.runtime.getURL()` with in-memory caching
- [x] **SM-03**: Pre-bundled maps take priority over recon-derived maps (curated > auto-generated)

### Local Site Map Converter (Tier 1)

- [x] **SM-04**: `sitemap-converter.js` transforms raw recon JSON into semantic memory with `category: 'site_map'`
- [x] **SM-05**: Extracts page tree, forms, navigation structure, key selectors, link counts -- pure data transformation, no AI
- [x] **SM-06**: "Save to Memory" button on each research result in options page (alongside View/Download/Delete)
- [x] **SM-07**: Memory schema extended with `site_map` category in semantic memory typeData

### AI Refinement Pipeline (Tier 2)

- [x] **SM-08**: `sitemap-refiner.js` sends Tier 1 output + raw page data to user's configured AI model
- [x] **SM-09**: AI produces workflow detection, navigation strategies, selector preferences, page purpose, site-specific tips
- [x] **SM-10**: Single API call per site (not per page), merges AI insights into existing memory entry
- [x] **SM-11**: Graceful fallback -- if AI refinement fails, Tier 1 result is kept
- [x] **SM-12**: Memory tab shows "AI Enhanced" vs "Basic" badge on site map memories

### Settings Toggle

- [x] **SM-13**: `autoRefineSiteMaps` toggle in Advanced Settings Performance Optimizations grid
- [x] **SM-14**: Toggle is ON by default -- Tier 1 + Tier 2 run automatically on every save-to-memory
- [x] **SM-15**: When OFF, only Tier 1 (local) runs
- [x] **SM-16**: Manual "Refine with AI" button on unrefined site map memories in Memory tab

### Side Panel Reconnaissance Integration

- [x] **SM-17**: On task failure (stuck type), side panel shows "Run Reconnaissance" button alongside existing Retry
- [x] **SM-18**: Recon suggestion only when no existing site map memory exists for current domain
- [x] **SM-19**: Side panel triggers Site Explorer on current domain, shows compact progress in chat
- [x] **SM-20**: On recon completion, auto-runs Tier 1 + Tier 2 (if toggle ON), saves to memory, offers retry
- [x] **SM-21**: Background `startExplorer` accepts `autoSaveToMemory: true` flag for side panel flow

### AI Context Injection

- [x] **SM-22**: At task start, `buildPrompt` checks for site map (pre-bundled first, then memory) matching current domain
- [x] **SM-23**: Inject site map as "SITE KNOWLEDGE" section in AI prompt, carved from memory budget
- [x] **SM-24**: Prompt format includes: pages, navigation, workflows, tips, key selectors

### Out of Scope

- Visual tree/graph rendering of site maps (defer to future)
- Automatic recon trigger without user consent
- Cross-domain site map merging
