# Phase 7: Memory Intelligence Overhaul - Research

**Researched:** 2026-02-21
**Domain:** Chrome Extension memory system, AI-powered data enrichment, reactive UI patterns
**Confidence:** HIGH (based on direct codebase analysis -- no external libraries involved)

## Summary

Phase 7 transforms FSB's memory system from passive storage into an AI-powered intelligence layer. The current architecture already has all the foundational pieces: a `MemoryExtractor` that does AI-powered extraction from sessions, a `MemoryManager` that orchestrates CRUD, a `MemoryConsolidator` for deduplication, `MemoryStorage` with Chrome storage and inverted indices, and a `MemoryRetriever` for hybrid search. The options page has a Memory tab with stats bar, search, type filters, a session list renderer, and site graph expansion for sitemap memories.

The primary gaps between the current state and Phase 7's success criteria are: (1) AI analysis only runs on session completion for sitemaps, not on every memory type at creation time; (2) sitemaps are stored as flat semantic memories with no domain grouping or cross-site pattern aggregation; (3) the memory list only shows a single-line summary with a delete button -- no detail panels; (4) the auto-analyze toggle is buried in Advanced Settings; (5) the Memory tab requires manual refresh; (6) there is no per-memory-operation cost tracking separate from overall analytics; (7) the Memory tab has a manual "Refresh" button and some redundant controls.

**Primary recommendation:** Extend the existing `MemoryExtractor` to become a universal AI enrichment pipeline that all memory types pass through before storage, add a `chrome.storage.onChanged` listener for `fsb_memories` to auto-refresh the Memory tab, build expandable read-only detail panels per memory type, relocate the auto-analyze toggle, and add a dedicated memory cost tracking channel in the analytics system.

## Standard Stack

This phase requires no new external libraries. All work uses existing project infrastructure:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | Manifest V3 | Storage, messaging, runtime | Already used throughout FSB |
| chrome.storage.local | N/A | Memory persistence | Already used by MemoryStorage |
| chrome.storage.onChanged | N/A | Reactive storage updates | Already used in MemoryStorage and options.js for analytics |
| UniversalProvider | Internal | AI API calls | Already used by memory-extractor.js and sitemap-refiner.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FSBAnalytics | Internal (utils/analytics.js) | Token/cost tracking | Extend for memory-specific cost tracking |
| SiteGraph | Internal (lib/visualization/site-graph.js) | Site map visualization | Already used for sitemap memory expansion |
| D3 Force (minified) | Internal | Graph layout engine | Already bundled, used by SiteGraph |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chrome.storage.onChanged for auto-refresh | Polling interval | Polling wastes resources and is less responsive; onChanged is event-driven and already used |
| Inline detail panels (accordion) | Modal/dialog overlay | Modals break context; inline panels keep position in the list |
| Extending existing FSBAnalytics | Separate MemoryAnalytics class | Separate class adds complexity; extending FSBAnalytics with a `source` field per entry is simpler |

## Architecture Patterns

### Recommended Module Changes
```
lib/memory/
  memory-schemas.js        -- Add AI enrichment fields to base schema (unchanged count: 3 types)
  memory-extractor.js      -- Extend to enrich ALL memory types, not just extract from sessions
  memory-storage.js         -- No changes needed (already has onChanged listener)
  memory-retriever.js       -- No changes needed
  memory-consolidator.js    -- No changes needed
  memory-manager.js         -- Add AI enrichment step in add() before storage
  sitemap-converter.js      -- No changes needed
  sitemap-refiner.js        -- No changes needed
  cross-site-patterns.js    -- NEW: Aggregates patterns across domain-grouped sitemaps

ui/
  options.js               -- Major changes: detail panels, auto-refresh, toggle relocation, cost panel
  options.html             -- Memory section restructure, detail panel templates, cost card
  options.css              -- Detail panel styles, toggle styles, cost card styles

utils/
  analytics.js             -- Add `source` field to usage entries ('automation' | 'memory' | 'sitemap')

background.js              -- Minor: ensure extractAndStoreMemories passes AI provider context
```

### Pattern 1: AI Enrichment Pipeline
**What:** Every memory passes through an AI enrichment step before storage. The enrichment adds structured insights: for episodic memories, it adds a timeline summary and lessons learned; for semantic memories, it adds categorization and pattern connections; for procedural memories, it adds optimization suggestions and reliability assessment.
**When to use:** On every call to `memoryManager.add()` when `autoAnalyze` is enabled.
**Example:**
```javascript
// In memory-manager.js add() method
async add(session, context = {}) {
  const extracted = await this._extractor.extract(session, context);

  for (const memory of extracted) {
    // NEW: AI enrichment step (if auto-analyze enabled)
    if (this._autoAnalyzeEnabled) {
      const enriched = await this._extractor.enrich(memory, context);
      if (enriched) {
        memory.aiAnalysis = enriched;
        memory.metadata.aiEnriched = true;
        memory.metadata.enrichedAt = Date.now();
      }
    }

    // Existing consolidation + storage logic
    const success = await this._storage.add(memory);
    if (success) stored.push(memory);
  }
}
```

### Pattern 2: chrome.storage.onChanged Auto-Refresh
**What:** The Memory tab listens for changes to `fsb_memories` key in chrome.storage.local and debounced-re-renders the memory list and stats.
**When to use:** When the Memory section is the active section in the options page.
**Example:**
```javascript
// In options.js, inside setupEventListeners()
let _memoryRefreshTimer = null;
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes[MEMORY_STORAGE_KEY]) {
    // Only refresh if memory section is currently visible
    if (dashboardState.currentSection !== 'memory') return;

    clearTimeout(_memoryRefreshTimer);
    _memoryRefreshTimer = setTimeout(() => {
      loadMemoryDashboard();
    }, 1000); // 1s debounce to batch rapid updates
  }
});
```
**Source:** This pattern is already used in the same file for analytics refresh (lines 370-392 of options.js).

### Pattern 3: Expandable Detail Panel (Accordion)
**What:** Clicking a memory item toggles a detail panel that slides open below the item, showing the full structured data for that memory type.
**When to use:** For all memory types in the Memory tab list.
**Example:**
```javascript
// Render detail panel based on memory type
function renderMemoryDetailPanel(memory) {
  switch (memory.type) {
    case 'episodic':
      return renderEpisodicDetail(memory);  // Timeline, steps, outcome, duration
    case 'semantic':
      return renderSemanticDetail(memory);  // Site graph OR selector table OR pattern info
    case 'procedural':
      return renderProceduralDetail(memory); // Step sequence, success rate, selectors
  }
}
```
**Source:** This extends the existing `toggleMemoryGraph()` pattern (options.js lines 3895-3911) which already does accordion-style expansion for sitemap memories.

### Pattern 4: Domain-Grouped Sitemaps with Cross-Site Patterns
**What:** Sitemaps are grouped by domain in the Memory tab display, and a periodic background job generates "common patterns" semantic memories that capture recurring UI patterns across different websites.
**When to use:** On sitemap creation/update and during consolidation.
**Example:**
```javascript
// Cross-site pattern analysis (new module)
async function analyzeCrossSitePatterns(allSitemaps) {
  // Group sitemaps by domain
  const byDomain = {};
  for (const sitemap of allSitemaps) {
    const domain = sitemap.metadata?.domain;
    if (domain) {
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(sitemap);
    }
  }

  // Find common patterns across domains
  const patterns = {
    commonFormTypes: [],      // Login forms, search bars, etc.
    sharedSelectors: [],       // data-testid, aria-label patterns
    commonNavPatterns: [],     // Header nav, sidebar, footer
    sharedWorkflows: []        // Search -> results -> detail
  };

  // Store as a semantic memory with category 'cross_site_pattern'
  return createSemanticMemory(
    `Cross-site patterns: ${Object.keys(byDomain).length} domains analyzed`,
    { domain: null, tags: ['cross-site', 'patterns'], confidence: 0.7 },
    { category: 'cross_site_pattern', sitePattern: patterns }
  );
}
```

### Anti-Patterns to Avoid
- **AI call on every storage.add():** Do NOT call AI enrichment synchronously inside the hot path. Use a fire-and-forget pattern with error handling so that storage succeeds even if enrichment fails.
- **Re-rendering the entire memory list on every storage change:** Use the debounce pattern (1 second minimum) to batch rapid updates, and only re-render when the Memory section is visible.
- **Tracking memory costs by modifying the existing usage entry schema:** Instead, add a `source` field to the existing entry schema. Do NOT create a separate storage key or analytics instance.
- **Blocking memory storage on AI enrichment failure:** AI enrichment is additive. If it fails, store the memory without enrichment. Never lose a memory because enrichment timed out.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI API calls for enrichment | Custom fetch wrapper | `UniversalProvider` from `ai/universal-provider.js` | Handles all providers, retries, parameter caching, response parsing |
| Token/cost tracking | Custom tracking system | `FSBAnalytics.trackUsage()` with added `source` field | Already handles model normalization, pricing, storage, 30-day cleanup |
| Storage change detection | Custom polling | `chrome.storage.onChanged` listener | Event-driven, already used in codebase, zero overhead when no changes |
| Sitemap graph visualization | Custom SVG rendering | `SiteGraph.render()` from `lib/visualization/site-graph.js` | Already handles radial layout, tooltips, pan/zoom, detail levels |
| Memory deduplication | Custom similarity check | `MemoryConsolidator.resolve()` | Already handles NOOP/ADD/UPDATE/DELETE decisions with Jaccard similarity |
| Debounced function calls | Custom timer management | Standard `clearTimeout/setTimeout` pattern | Already used throughout options.js for search and analytics refresh |

**Key insight:** Every infrastructure component needed for Phase 7 already exists in the codebase. The work is wiring existing pieces together in new ways, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Phase 6 Dependency Not Landed
**What goes wrong:** Phase 7 assumes AI extraction works. If Phase 6 (UniversalProvider constructor bug fix) hasn't landed, all AI enrichment silently falls back to local extraction.
**Why it happens:** `memory-extractor.js` currently calls `new UniversalProvider(provider, model, keys)` with 3 positional args, but `UniversalProvider` expects a single `settings` object: `new UniversalProvider({ modelProvider, modelName, apiKey, ... })`.
**How to avoid:** Phase 6 MUST be completed before Phase 7 begins. Verify by checking that `memory-extractor.js` creates `UniversalProvider` with a settings object.
**Warning signs:** All memories show `metadata.aiEnriched: false` or only local fallback extraction runs.

### Pitfall 2: Auto-Refresh Causing Infinite Loop
**What goes wrong:** Updating a memory triggers `chrome.storage.onChanged`, which triggers a re-render, which might trigger another storage write (e.g., recording access), causing an infinite loop.
**Why it happens:** `MemoryStorage.recordAccess()` writes to `chrome.storage.local`, which fires `onChanged`.
**How to avoid:** The auto-refresh listener should ONLY respond to changes in the `fsb_memories` key AND should check if the change was user-initiated vs. background. Use a flag or compare old/new values. Also, do NOT call `recordAccess()` during the render cycle.
**Warning signs:** Memory tab flickers, high CPU usage, console shows rapid repeated renders.

### Pitfall 3: AI Enrichment Blocking Memory Storage
**What goes wrong:** If AI enrichment takes too long or fails, the memory never gets stored.
**Why it happens:** Placing AI enrichment in the critical path between extraction and storage.
**How to avoid:** Store the memory FIRST with `aiEnriched: false`, then update it asynchronously with enrichment data. This way the memory is always persisted.
**Warning signs:** Memories disappear or are delayed by several seconds after session completion.

### Pitfall 4: Cost Tracking Double-Counting
**What goes wrong:** Memory AI enrichment costs get counted both in the memory cost panel AND the overall dashboard, leading to inflated totals.
**Why it happens:** Not clearly separating cost sources.
**How to avoid:** Add a `source` field to usage entries: `'automation'` for normal AI calls, `'memory'` for memory enrichment, `'sitemap'` for sitemap refinement. The Dashboard shows ALL sources combined. The Memory cost panel filters to `source === 'memory' || source === 'sitemap'`.
**Warning signs:** Dashboard "Total Cost" exceeds sum of per-category costs, or memory cost panel shows zero while dashboard shows memory-related costs.

### Pitfall 5: Detail Panel Re-Rendering Loses Scroll Position
**What goes wrong:** When auto-refresh triggers and the memory list re-renders, any expanded detail panel collapses and the user loses their scroll position.
**Why it happens:** `renderMemoryList()` replaces all `innerHTML`, destroying expanded panels.
**How to avoid:** Before re-rendering, save the currently expanded memory ID and scroll position. After render, re-expand that memory and restore scroll position. Alternatively, do a "smart diff" that only updates changed items.
**Warning signs:** Detail panels collapse every second when background processes are adding memories.

### Pitfall 6: Cross-Site Pattern Analysis Running Too Often
**What goes wrong:** Analyzing patterns across all sitemaps on every memory add becomes expensive (multiple AI calls per session completion).
**Why it happens:** No throttling on when cross-site analysis runs.
**How to avoid:** Run cross-site analysis only during consolidation (manual or scheduled), not on every memory add. Or, run it at most once per hour.
**Warning signs:** High AI costs from memory enrichment, slow session completion.

## Code Examples

Verified patterns from existing codebase:

### chrome.storage.onChanged Listener (Already in options.js)
```javascript
// Source: options.js lines 370-392
let _analyticsRefreshTimer = null;
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.fsbUsageData || changes.fsbCurrentModel) {
      if (dashboardState.currentSection !== 'analytics') return;
      clearTimeout(_analyticsRefreshTimer);
      _analyticsRefreshTimer = setTimeout(() => {
        if (analytics && analytics.initialized) {
          analytics.loadStoredData().then(() => {
            analytics.updateDashboard();
          });
        }
      }, 2000);
    }
  }
});
```

### Memory Item Rendering (Already in options.js)
```javascript
// Source: options.js lines 3809-3857
container.innerHTML = sorted.map(memory => {
  const typeIcon = {
    episodic: 'fa-clock',
    semantic: 'fa-lightbulb',
    procedural: 'fa-list-ol'
  }[memory.type] || 'fa-circle';
  const typeLabel = memory.type.charAt(0).toUpperCase() + memory.type.slice(1);
  // ... render memory item row
}).join('');
```

### Graph Expand/Collapse Pattern (Already in options.js)
```javascript
// Source: options.js lines 3895-3911
function toggleMemoryGraph(memoryItem) {
  const memoryId = memoryItem.dataset.memoryId;
  if (memoryItem.classList.contains('graph-expanded')) {
    collapseMemoryGraph(memoryItem);
    return;
  }
  const existingExpanded = document.querySelector('.memory-item.graph-expanded');
  if (existingExpanded) {
    collapseMemoryGraph(existingExpanded);
  }
  expandMemoryGraph(memoryItem, memoryId);
}
```

### AI Provider Creation (Pattern from sitemap-refiner.js)
```javascript
// Source: sitemap-refiner.js lines 75-93
async function loadProviderSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'modelProvider', 'modelName', 'apiKey',
      'geminiApiKey', 'openaiApiKey', 'anthropicApiKey',
      'customApiKey', 'customEndpoint'
    ], (result) => {
      resolve({
        modelProvider: result.modelProvider || 'xai',
        modelName: result.modelName || 'grok-4-1-fast',
        apiKey: result.apiKey || '',
        // ... other keys
      });
    });
  });
}
// Usage: const provider = new UniversalProvider(settings);
```

### Analytics Cost Tracking (Already in analytics.js)
```javascript
// Source: utils/analytics.js lines 147-175
async trackUsage(model, inputTokens, outputTokens, success = true) {
  const entry = {
    timestamp: Date.now(),
    model: model,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    success: success,
    cost: this.calculateCost(model, inputTokens, outputTokens)
    // NEW: add source: 'memory' | 'automation' | 'sitemap'
  };
  this.usageData.push(entry);
  await this.saveData();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI analysis only for sitemaps (sitemap-refiner.js) | AI analysis for all memory types | Phase 7 | Every memory gets AI insights |
| Manual refresh button | chrome.storage.onChanged auto-refresh | Phase 7 | Live updates without user action |
| Auto-analyze toggle in Advanced Settings | Toggle in Memory tab header | Phase 7 | Discoverable, contextual control |
| Single line memory display | Expandable detail panels | Phase 7 | Rich inspection without leaving context |
| Flat memory list | Domain-grouped sitemaps | Phase 7 | Organized by website |
| No memory cost tracking | Dedicated memory cost panel | Phase 7 | Transparent AI spend for memory operations |

## Codebase Analysis: What Currently Exists vs. What's Needed

### Success Criterion 1: AI Analysis for All Memory Types
**Current state:** `MemoryExtractor.extract()` calls AI once per session to extract memories. The AI extracts and returns typed memories (episodic, semantic, procedural). The raw memories are stored directly. `SitemapRefiner` separately enriches sitemap memories with AI.
**Gap:** No AI "enrichment" step for non-sitemap memories after extraction. The AI extraction is the only intelligence -- there's no second-pass analysis that adds insights, categorization, or pattern connections to episodic/procedural memories.
**What to build:** An `enrich()` method on `MemoryExtractor` that takes a single memory and returns AI-generated analysis (lessons learned, patterns detected, optimization suggestions). This runs after extraction but before storage.

### Success Criterion 2: Domain-Grouped Sitemaps + Cross-Site Patterns
**Current state:** Sitemaps are stored as semantic memories with `category: 'site_map'` and `metadata.domain` set. They're displayed in a flat list. No cross-domain analysis exists.
**Gap:** No UI grouping by domain. No background process that looks across all sitemaps to find common patterns.
**What to build:** (a) In the Memory tab renderer, group sitemap memories by domain with collapsible sections. (b) A `cross-site-patterns.js` module that analyzes all sitemap memories and creates a "common patterns" semantic memory.

### Success Criterion 3: Read-Only Detail Panels
**Current state:** Clicking a sitemap memory expands a site graph visualization below it. Non-sitemap memories only show a single-line summary with delete button.
**Gap:** No detail panels for episodic memories (timeline, steps), semantic memories (selector tables, pattern info), or procedural memories (step sequence, success rate).
**What to build:** Extend the existing `toggleMemoryGraph` accordion pattern to support all memory types. Each type gets a different detail panel layout.

### Success Criterion 4: Auto-Analyze Toggle in Memory Tab Header
**Current state:** `autoRefineSiteMaps` toggle is in Advanced Settings (options.html line 363). There's no general "auto-analyze" toggle -- only auto-refine for sitemaps.
**Gap:** Need a new toggle concept: "Auto-Analyze" that controls whether AI enrichment runs on all new memories. Should live in the Memory tab header, not Advanced Settings.
**What to build:** Add a toggle to the Memory section header. Store the preference as `autoAnalyzeMemories` in chrome.storage.local. Reference this setting in `MemoryManager.add()` to decide whether to run AI enrichment.

### Success Criterion 5: Auto-Refresh Memory Tab
**Current state:** The Memory tab loads data once on init and has a manual "Refresh" button. The `chrome.storage.onChanged` listener in `MemoryStorage` only invalidates the internal cache -- it doesn't trigger UI updates.
**Gap:** No listener in options.js that re-renders the Memory tab when `fsb_memories` changes in storage.
**What to build:** Add a `chrome.storage.onChanged` listener in options.js (pattern already exists for analytics) that calls `loadMemoryDashboard()` with debouncing when `fsb_memories` changes and the Memory section is active.

### Success Criterion 6: Memory Cost Tracking Panel
**Current state:** `FSBAnalytics` tracks all AI usage in a flat array. Each entry has `{ timestamp, model, inputTokens, outputTokens, success, cost }`. No `source` field to distinguish automation vs. memory operations. The Dashboard shows aggregate totals.
**Gap:** No way to filter costs by source. No dedicated cost card in the Memory tab.
**What to build:** (a) Add `source` field to analytics entries. (b) Add `getStats(timeRange, source)` filter method. (c) Add a cost card in the Memory tab HTML. (d) Add a summary panel to Dashboard hero section.

### Success Criterion 7: Clean Up Redundant Elements
**Current state:** Memory tab has: stats bar, search input, type filter, Refresh button, Consolidate button, Export button, Clear All button, memory list, Site Explorer section.
**Gap:** The manual "Refresh" button becomes redundant with auto-refresh. The layout could be tightened.
**What to build:** Remove the Refresh button (replaced by auto-refresh). Consider consolidating less-used actions (Consolidate, Export, Clear All) into a dropdown or overflow menu.

## Storage Key Reference

| Key | Current Use | Phase 7 Changes |
|-----|-------------|-----------------|
| `fsb_memories` | All memories array | No schema change, but auto-refresh listens for changes |
| `fsb_memory_index` | Inverted index (domain, taskType, tags) | No change |
| `fsb_memory_meta` | Reserved (unused) | Could store cross-site patterns metadata |
| `fsbUsageData` | Analytics usage entries | Add `source` field to entries |
| `autoRefineSiteMaps` | Toggle for sitemap AI refinement | Keep, but secondary to new `autoAnalyzeMemories` |
| `autoAnalyzeMemories` | NEW: Toggle for all-memory AI enrichment | Controls whether `MemoryManager.add()` runs AI enrichment |

## Open Questions

1. **Enrichment Prompt Design**
   - What we know: The extraction prompt (in `MemoryExtractor._buildExtractionPrompt()`) asks the AI to extract memories from sessions. Enrichment is different -- it takes an already-extracted memory and adds insights.
   - What's unclear: The optimal prompt structure for enriching each memory type. Should enrichment be type-specific (3 different prompts) or a single generic prompt?
   - Recommendation: Use type-specific prompts for better quality. Keep them short (~50 tokens each) to minimize cost. Start with a single generic prompt and split if quality is insufficient.

2. **Cross-Site Pattern Analysis Trigger**
   - What we know: This is an expensive operation (reads all sitemaps, potentially calls AI).
   - What's unclear: When should it run? On every sitemap add? On consolidation? On a schedule?
   - Recommendation: Run during manual consolidation only (user clicks "Consolidate"). Add a note in the UI that consolidation includes cross-site analysis.

3. **Cost Attribution for Existing Entries**
   - What we know: Existing analytics entries don't have a `source` field.
   - What's unclear: Should we backfill existing entries as `source: 'automation'`?
   - Recommendation: Treat missing `source` field as `'automation'` in the filtering logic. No migration needed.

4. **Auto-Analyze Toggle Default Value**
   - What we know: `autoRefineSiteMaps` defaults to `true`.
   - What's unclear: Should `autoAnalyzeMemories` default to `true` or `false`? Auto-analyze has per-memory AI cost.
   - Recommendation: Default to `true` to maximize value, but show cost estimate in the toggle description.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files in `lib/memory/` directory
- Direct codebase analysis of `ui/options.js`, `ui/options.html`, `ui/options.css`
- Direct codebase analysis of `utils/analytics.js`
- Direct codebase analysis of `ai/universal-provider.js`
- Direct codebase analysis of `background.js` (extractAndStoreMemories function)
- Chrome Extension API documentation for `chrome.storage.onChanged`

### Secondary (MEDIUM confidence)
- Existing patterns in codebase (analytics refresh, graph expansion) serve as validated templates for Phase 7 features

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external libraries; all components already exist in codebase
- Architecture: HIGH - Extending existing patterns (onChanged listener, accordion expansion, analytics tracking)
- Pitfalls: HIGH - Identified from direct analysis of code paths and data flow
- Code examples: HIGH - All examples are from actual codebase files with line numbers

**Research date:** 2026-02-21
**Valid until:** 2026-04-21 (stable -- no external dependencies that could change)
