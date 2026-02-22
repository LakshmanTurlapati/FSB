# Roadmap: FSB

## Milestones

- [x] **v0.9 Reliability Improvements** - Phases 1-11 (shipped 2026-02-14)
- [x] **v9.0.2 AI Situational Awareness** - Phases 1-10 (shipped 2026-02-18)
- [x] **v9.1 Site Intelligence** - Phases 2-3 (shipped 2026-02-18)
- [ ] **v9.3 Tech Debt Cleanup** - Phases 4-8 (in progress)

---

## v9.3 Tech Debt Cleanup

**Milestone Goal:** Eliminate accumulated tech debt -- modularize the 13K-line content.js into logical modules, remove dead code, make hardcoded values configurable, and fix constructor bugs. No new features, no architecture changes -- extract existing code into files and clean up.

### Phases

- [ ] **Phase 4: Content Script Modularization** - Split content.js into logical modules with shared namespace
- [ ] **Phase 5: Dead Code Removal and Configuration** - Remove waitForActionable dead code and make ElementCache maxCacheSize configurable
- [ ] **Phase 6: Memory Extractor Bug Fix** - Fix UniversalProvider constructor arguments so AI extraction runs when available
- [x] **Phase 7: Memory Intelligence Overhaul** - AI-analyze everything entering memory, read-only viewers, Memory tab redesign, cost tracking, auto-refresh (completed 2026-02-21)
- [x] **Phase 8: Site Guides Viewer** - Expose built-in site guides as read-only browsable content in the Memory tab (completed 2026-02-21)

---

## Phase Details

### Phase 4: Content Script Modularization
**Goal**: content.js (13K lines) is decomposed into separate module files that load in dependency order, with all existing functionality preserved identically
**Depends on**: Nothing (first phase of v9.3)
**Requirements**: MOD-01, MOD-02, MOD-03
**Success Criteria** (what must be TRUE):
  1. content.js no longer exists as a monolith -- code lives in separate files under a content/ directory (or equivalent module structure)
  2. Loading the extension on any page produces zero console errors from content script files
  3. Running a full automation task (search, click, type, navigate) works identically to before the split -- same actions, same results, same visual feedback
  4. Re-injecting content scripts on the same tab (via navigation or background script) does not create duplicate message handlers, observers, or overlays
  5. All injection points in background.js use a single shared file list constant -- no hardcoded file arrays remain
**Plans:** 5 plans
Plans:
- [ ] 04-01-PLAN.md -- Extract foundation modules (init.js, utils.js, dom-state.js, selectors.js)
- [ ] 04-02-PLAN.md -- Extract visual-feedback.js and accessibility.js
- [ ] 04-03-PLAN.md -- Extract actions.js (tools object, 25+ browser actions)
- [ ] 04-04-PLAN.md -- Extract dom-analysis.js, messaging.js, lifecycle.js
- [ ] 04-05-PLAN.md -- Wire background.js injection points, remove old content.js, verify

### Phase 5: Dead Code Removal and Configuration
**Goal**: Dead code paths are eliminated and the ElementCache size becomes a configurable value instead of a hardcoded magic number
**Depends on**: Phase 4 (dead code is easier to identify and remove after module boundaries are clear; cache configuration modifies the newly extracted module)
**Requirements**: DEAD-01, DEAD-02, CFG-01, CFG-02
**Success Criteria** (what must be TRUE):
  1. Searching the entire codebase for "waitForActionable" returns zero results -- the function and all references are gone
  2. No new test failures or behavioral changes after removal -- the existing smartEnsureReady and ensureElementReady functions cover all use cases that waitForActionable addressed
  3. ElementCache maxCacheSize is set via a named constant or constructor parameter instead of a hardcoded literal, and can be changed from config.js or the options page
  4. ElementCache still defaults to 100 when no custom value is provided -- backward compatibility preserved
**Plans**: TBD

### Phase 6: Memory Extractor Bug Fix
**Goal**: memory-extractor.js correctly instantiates UniversalProvider so AI-powered memory extraction runs when an AI provider is configured, with local fallback still functioning when AI extraction genuinely fails
**Depends on**: Nothing (independent of Phases 4-5, but sequenced last since it is lowest risk and smallest scope)
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. When an AI provider is configured (API key set, model selected), memory extraction uses the AI provider instead of always falling back to local extraction
  2. When no AI provider is configured or the AI provider fails (network error, invalid key, rate limit), memory extraction falls back to local extraction and still produces useful memories
**Plans**: TBD

### Phase 7: Memory Intelligence Overhaul
**Goal**: Transform the memory system from passive storage into an AI-powered intelligence layer -- every piece of data entering memory gets AI analysis, sitemaps are broken down by website with cross-site patterns, memories are viewable in rich read-only detail panels, the Memory tab is redesigned with inline controls and live updates, and cost tracking covers both the overall dashboard and per-memory operations
**Depends on**: Phase 6 (memory extractor bug fix must land first so AI extraction actually works; without it, AI-analyze-everything would silently fall back to local for all memories)
**Requirements**: MEM-AI-01 through MEM-AI-07
**Success Criteria** (what must be TRUE):
  1. Every memory type (episodic, semantic, procedural) gets AI analysis on creation -- not just sitemaps. Failed actions, successful workflows, selector discoveries all pass through AI enrichment before storage
  2. Sitemaps are organized by domain with a cross-site "common patterns" summary that learns recurring UI patterns across different websites
  3. Clicking any memory in the list opens a read-only detail panel showing full structured data (episodic: timeline + steps; semantic: site graph + selectors; procedural: step sequence + success rate)
  4. The auto-analyze toggle lives inside the Memory tab header (not buried in Advanced Settings) with a clear on/off indicator
  5. The Memory tab auto-refreshes when background processes add/modify/refine memories -- no manual refresh button needed to see current state
  6. The main Dashboard section shows an overall cost panel, and the Memory section shows a dedicated memory-operations cost panel tracking AI analysis spend separately
  7. Unused or redundant UI elements in the Memory tab are removed, and the layout is clean and purposeful
**Plans:** 7 plans

Plans:
- [ ] 07-01-PLAN.md -- AI analysis pipeline for all memory types (extend memory-extractor.js to enrich every episodic/semantic/procedural memory with AI before storage, not just sitemaps)
- [ ] 07-02-PLAN.md -- Website-level sitemap organization and cross-site pattern learning (group sitemaps by domain, generate a "common patterns" semantic memory that aggregates recurring UI patterns across sites)
- [ ] 07-03-PLAN.md -- Read-only memory detail viewer (expandable panels for each memory type: episodic shows action timeline, semantic shows site graph or selector table, procedural shows step sequence with success metrics)
- [ ] 07-04-PLAN.md -- Memory tab UI redesign (relocate auto-analyze toggle to Memory tab header, remove redundant elements, clean layout, add inline status indicators for AI enrichment state)
- [ ] 07-05-PLAN.md -- Auto-refresh memory section (chrome.storage.onChanged listener for fsb_memories key, debounced re-render of memory list and stats when data changes in background)
- [ ] 07-06-PLAN.md -- Memory cost tracking panel (track AI token usage per memory operation separately in analytics, add dedicated cost card in Memory tab, add overall cost summary panel to Dashboard hero section)
- [ ] 07-07-PLAN.md -- Integration testing and cleanup (verify end-to-end: automation session completes -> AI extracts memories -> memories appear in tab with detail viewers -> costs tracked -> no manual refresh needed)

### Phase 8: Site Guides Viewer
**Goal**: The 9 built-in site guides (ecommerce, social, finance, travel, email, coding, career, gaming, productivity) are browsable as read-only content in the Memory tab, so users can see what selectors, workflows, warnings, and guidance the extension ships with for each website category
**Depends on**: Phase 7 (Memory tab redesign and detail panels must be in place)
**Plans:** 5 plans

Plans:
- [x] 08-01-PLAN.md -- Registry enhancement + _shared.js files + ecommerce and social per-site files
- [x] 08-02-PLAN.md -- Per-site files for finance, travel, email, and coding categories
- [x] 08-03-PLAN.md -- Per-site files for career, gaming, productivity + update background.js importScripts + delete old category files
- [x] 08-04-PLAN.md -- Update ai-integration.js _buildTaskGuidance for new per-site format
- [x] 08-05-PLAN.md -- Viewer UI (HTML section, CSS styles, site-guides-viewer.js, search integration)

---

## Progress

**Execution Order:** Phase 4 -> Phase 5 -> Phase 6 -> Phase 7 -> Phase 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Content Script Modularization | 0/5 | Planned | - |
| 5. Dead Code Removal and Configuration | 0/TBD | Not started | - |
| 6. Memory Extractor Bug Fix | 0/TBD | Not started | - |
| 7. Memory Intelligence Overhaul | 7/7 | Complete | 2026-02-21 |
| 8. Site Guides Viewer | 5/5 | Complete | 2026-02-21 |
