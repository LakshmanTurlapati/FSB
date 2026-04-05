---
status: resolved
trigger: "Comprehensive audit of ALL 24 Phase 02 (Site Map Intelligence) requirements after 3 bugs already found"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Multiple integration bugs found and fixed
test: Complete code audit of all 24 SM requirements
expecting: n/a -- audit complete
next_action: None -- all bugs fixed

## Symptoms

expected: All 24 SM requirements (SM-01 through SM-24) work correctly end-to-end
actual: 3 bugs already found post-completion -- audit found 4 more issues
errors: (1) Site Explorer results in wrong UI section, (2) Recon suggestion listens for wrong event, (3) SyntaxError await in non-async callback
reproduction: Systematic code review of each requirement
started: After Phase 02 was marked complete

## Eliminated

- hypothesis: AI refinement (Tier 2) broken in background context because UniversalProvider not loaded
  evidence: Traced import chain: background.js -> ai-integration.js -> ai-providers.js -> universal-provider.js. UniversalProvider IS available.
  timestamp: 2026-02-18

- hypothesis: parseResponse returns string not object for refiner
  evidence: UniversalProvider.parseResponse JSON.parses content at line 594 before returning. parsed.content is a JS object, not string.
  timestamp: 2026-02-18

## Evidence

- timestamp: 2026-02-18
  checked: site-explorer.js line 711 - memoryManager.add(memory)
  found: memoryManager.add() expects a SESSION object (passes to extractor.extract()), not a pre-built memory object. This crashes the auto-save flow.
  implication: CRITICAL BUG - SM-20/SM-21 auto-save from sidepanel recon is broken

- timestamp: 2026-02-18
  checked: background.js automationComplete messages for partial completions
  found: max_iterations, timeout, and no_progress cases omit task field. Only stuck case includes it.
  implication: Recon retry button sends status text as task instead of original user task (SM-17 regression)

- timestamp: 2026-02-18
  checked: sidepanel.js duplicate initConversationId function
  found: Lines 11-24 and 27-40 define identical function. Second silently overrides first.
  implication: Not a bug (both identical) but code smell that should be cleaned

- timestamp: 2026-02-18
  checked: options.css for .refine-btn styles
  found: No CSS rules for the "Refine with AI" button
  implication: SM-16 button renders with generic .control-btn.small styling but no visual refinement treatment

- timestamp: 2026-02-18
  checked: site-maps/ directory contents
  found: Only _template.json exists. No actual pre-bundled maps for LinkedIn, Google, Amazon etc.
  implication: SM-01 requirement to "ship curated site map JSON files for common sites" is not fulfilled. Template-only. Not a code bug per se.

## Requirement-by-Requirement Audit Results

### SM-01: Pre-bundled site map JSON files -- PARTIAL
- site-maps/ directory exists with only _template.json
- Code infrastructure works (manifest.json web_accessible_resources includes site-maps/*.json)
- Missing: actual curated JSON files for common sites

### SM-02: Load pre-bundled maps on demand -- PASS
- loadBundledSiteMap() in background.js correctly uses chrome.runtime.getURL()
- In-memory cache via bundledSiteMapCache Map
- Handles www. prefix stripping

### SM-03: Pre-bundled maps take priority -- PASS
- getSiteMap handler checks bundled FIRST (line 3967), then memory (line 3974)
- hasSiteMapForDomain checks bundled first too

### SM-04: sitemap-converter.js transforms recon JSON -- PASS
- convertToSiteMap() correctly processes research.pages
- Extracts pages, navigation, forms, keySelectors
- Sets category to site_map via sitePattern usage

### SM-05: Extracts page tree, forms, nav, selectors, link counts -- PASS
- Pages have elementCount, formCount, linkCount
- Navigation deduplicated by path via Map
- Forms extracted with fields and action
- keySelectors per page, capped at 20

### SM-06: Save to Memory button on research results -- PASS
- Button exists in loadResearchList() HTML with data-action="saveMemory"
- Event delegation handles click, calls saveResearchToMemory()

### SM-07: Memory schema extended with site_map category -- PASS
- createSemanticMemory supports category in typeData
- createSiteMapMemory helper creates site_map memories
- memory-schemas.js exports createSiteMapMemory

### SM-08: sitemap-refiner.js sends to user's configured AI model -- PASS
- Uses loadProviderSettings() to get user config
- Creates UniversalProvider instance with settings

### SM-09: AI produces workflows, nav strategies, selector prefs, tips -- PASS
- buildRefinerPrompt correctly requests these in system prompt
- refineSiteMapWithAI merges workflows, tips, pagePurposes, selectorPreferences, navigationStrategy

### SM-10: Single API call per site -- PASS
- Only one buildRequest/sendRequest call per refineSiteMapWithAI invocation

### SM-11: Graceful fallback if AI fails -- PASS
- try/catch in refineSiteMapWithAI returns original sitePattern on error
- Checks for UniversalProvider availability first

### SM-12: AI Enhanced vs Basic badge -- PASS
- renderMemoryList checks sitePattern.refined === true
- CSS exists for .memory-badge.ai-enhanced and .memory-badge.basic

### SM-13: autoRefineSiteMaps toggle in Advanced Settings -- PASS
- Toggle exists in options.html with id="autoRefineSiteMaps"
- In Performance Optimizations grid
- Cached in elements.autoRefineSiteMaps

### SM-14: Toggle ON by default -- PASS
- defaultSettings.autoRefineSiteMaps = true
- loadSettings uses ?? true fallback

### SM-15: When OFF, only Tier 1 runs -- PASS
- saveResearchToMemory checks settings.autoRefineSiteMaps !== false
- autoConvertToMemory checks the same

### SM-16: Manual Refine with AI button -- PASS (CSS fix applied)
- renderMemoryList generates refineBtn HTML for unrefined site_map memories
- Event listener calls refineMemoryWithAI
- refineMemoryWithAI correctly loads memory, calls refineSiteMapWithAI, updates storage
- CSS for .refine-btn was MISSING -- now added

### SM-17: Recon suggestion on task failure -- PASS (task field fix applied)
- automationComplete handler checks isPartial
- Checks domain for site map via checkSiteMap message
- Shows "Run Reconnaissance" button
- BUG FIXED: partial completions now include task field for proper retry

### SM-18: Recon only when no existing site map -- PASS
- Calls chrome.runtime.sendMessage({action: 'checkSiteMap', domain})
- Only shows recon if !siteMapCheck.exists

### SM-19: Side panel triggers Site Explorer -- PASS
- startReconFromSidepanel sends startExplorer with autoSaveToMemory: true
- handleReconProgress shows compact progress in chat

### SM-20: On recon completion, auto-runs Tier 1 + Tier 2, saves to memory -- FIXED
- autoConvertToMemory in site-explorer.js runs Tier 1 (convertToSiteMap) + Tier 2 (refineSiteMapWithAI)
- BUG FIXED: was calling memoryManager.add() (wrong API), now calls memoryStorage.add()
- handleReconComplete in sidepanel offers retry

### SM-21: Background startExplorer accepts autoSaveToMemory flag -- PASS (after fix)
- start() method accepts autoSaveToMemory option
- Stored as this.autoSaveToMemory
- Checked after crawl completion

### SM-22: buildPrompt checks for site map at task start -- PASS
- _fetchSiteMap() called on new session and domain change
- Caches result in _cachedSiteMap for synchronous injection in buildPrompt
- getSiteMap handler checks bundled first, then memory

### SM-23: Inject site map as SITE KNOWLEDGE section -- PASS
- buildPrompt checks isFirstIteration || isDomainChanged
- Calls formatSiteKnowledge() to format the map
- Wraps in === SITE KNOWLEDGE === markers

### SM-24: Prompt format includes pages, navigation, workflows, tips, selectors -- PASS
- formatSiteKnowledge includes: Pages, Navigation, Workflows, Tips, Nav strategy, Key selectors
- Capped at 800 chars

## Resolution

root_cause: Multiple integration bugs from incomplete wiring between components:
  1. site-explorer.js called memoryManager.add() instead of memoryStorage.add() (wrong API for pre-built memory objects)
  2. Partial automationComplete messages (max_iterations, timeout, no_progress) missing task field, breaking recon retry flow
  3. Duplicate initConversationId function in sidepanel.js
  4. Missing CSS for .refine-btn in options.css

fix: Applied 4 fixes across 4 files

verification: Code review confirms each fix addresses the root cause:
  1. memoryStorage.add() correctly takes a validated memory object and stores it directly
  2. All partial automationComplete messages now include task: session.task consistently
  3. Duplicate function removed, single definition remains
  4. .refine-btn CSS added with proper light/dark theme support

files_changed:
  - utils/site-explorer.js (memoryManager.add -> memoryStorage.add, existence check updated)
  - background.js (added task field to 3 partial automationComplete messages)
  - ui/sidepanel.js (removed duplicate initConversationId function)
  - ui/options.css (added .refine-btn styles)
