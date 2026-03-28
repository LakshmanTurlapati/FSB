# Integration Check: Phases 30–35
**Date:** 2026-03-17
**Scope:** v0.9.2 (Phase 30), v0.9.3 (Phases 31–34), v0.9.4 (Phase 35)
**Method:** Source-level cross-phase wiring verification

---

## Integration Check Complete

### Wiring Summary

**Connected:** 14 key exports/hooks properly wired
**Orphaned:** 1 export/feature created but unused at runtime
**Missing:** 1 internal write-path never assigned (dead code path)

### API Coverage

Not applicable (Chrome extension, no HTTP API routes)

### Auth Protection

Not applicable (single-user Chrome extension)

### E2E Flows

**Complete:** 5 flows work end-to-end
**Broken:** 1 flow has a dead code path (non-blocking)

---

## Detailed Findings

### Connected Exports (Verified Working)

1. **Phase 31 → Phase 32: `createTaskMemory` / `validateMemory`**
   - `lib/memory/memory-schemas.js` exports `createTaskMemory` and `validateMemory` via `self.X` pattern
   - `lib/memory/memory-extractor.js` calls both at lines 275 and 281 respectively
   - Background.js loads schemas before extractor (`importScripts` lines 148, 151)
   - STATUS: WIRED

2. **Phase 32 → storage: `memoryManager.add()` triggers extraction**
   - `background.js:extractAndStoreMemories()` (line 285) calls `memoryManager.add(session, { domain })`
   - `memory-manager.js:add()` calls `this._extractor.extract(session, context)` (line 30)
   - Consolidator wired via `memoryConsolidator` self-registering with `memoryManager.setConsolidator()` at load time (memory-consolidator.js line 382)
   - STATUS: WIRED

3. **Phase 32 → Phase 31: `MEMORY_TYPES.TASK` used in enrichment gate**
   - `memory-manager.js` line 74: `if (memory.type === 'task')` triggers always-enrich path
   - TYPE constant comes from `memory-schemas.js` via global scope
   - STATUS: WIRED

4. **Phase 33 → Phase 31/32: Task Memory `typeData` rendered in UI**
   - `ui/options.js:renderTaskDetail()` (line 4732) reads `memory.typeData.session`, `.learned`, `.procedures`
   - These fields are populated by `createTaskMemory()` factory per Phase 31 schema
   - `renderCollapsibleSection()` at line 4722 properly reused for all three sections
   - STATUS: WIRED

5. **Phase 33 → visualization: `SiteGraph.transformTaskData` and `KnowledgeGraph.setTaskMemories`**
   - `lib/visualization/site-graph.js` exports `transformTaskData` (line 1470)
   - `lib/visualization/knowledge-graph.js` exports `setTaskMemories` (line 940)
   - `ui/options.js` calls `SiteGraph.transformTaskData(memory)` at line 4386
   - `ui/site-guides-viewer.js` calls `KnowledgeGraph.setTaskMemories(taskMemories)` at line 35
   - `control_panel.html` loads both visualization libs (lines 1220–1221) before `options.js` and `site-guides-viewer.js`
   - STATUS: WIRED

6. **Phase 34 → Phase 33: CSS variable aliases consumed by Phase 33 components**
   - `options.css` defines `--surface-color`, `--card-bg`, `--hover-bg`, `--danger` in both `:root` and `[data-theme="dark"]` blocks (lines 72–77, 112–116)
   - Phase 33 selectors `.outcome-badge-failure`, `.task-graph-container`, `.recon-section-toggle:hover` all reference these variables (lines 3207, 3213, 3240)
   - STATUS: WIRED

7. **Phase 34 → Phase 31: export/import round-trip preserves Task Memory schema**
   - `ui/options.js:handleMemoryImport()` (line 5148) calls `validateMemory(memory)` (line 5189) before `memoryStorage.add(memory)` (line 5206)
   - `validateMemory` accepts type `'task'` as a valid type via `MEMORY_TYPES` constant
   - `control_panel.html` loads `memory-schemas.js` (line 1207) before `options.js` (line 1285) — global `validateMemory` is available
   - STATUS: WIRED

8. **Phase 35 → Phase 30: fsbElements injection pipeline wired to productivity site guides**
   - `background.js` line 8715: `iterationGuideSelectors = { ...guide.selectors, fsbElements: guide.fsbElements, _siteName: guide.site }`
   - `content/dom-analysis.js` line 1836: `const fsbElements = guideSelectors?.fsbElements` — generic, fires for any guide
   - Notion, Jira, Airtable, Todoist, Trello, Google Calendar, Google Keep all define `fsbElements` objects
   - STATUS: WIRED

9. **Phase 35 → Phase 30: CONT-01..04 hybrid continuation prompt injects site guide tool hints**
   - `ai/ai-integration.js` HYBRID_CONTINUATION_PROMPT (line 420) contains `{TOOL_HINTS}` and `{SITE_SCENARIOS}` placeholders
   - Lines 2582–2599: `siteGuide.toolPreferences` → `{TOOL_HINTS}`, `siteGuide.guidance` → `{SITE_SCENARIOS}`
   - All 9 productivity site guides define `toolPreferences` and `guidance` fields
   - STATUS: WIRED

10. **Phase 35 → diagnostics: `diagnoseElementFailure` → `buildFailureReport` → `parallelDebugFallback`**
    - `content/actions.js` calls `diagnoseElementFailure()` on every failure path (click, type, pressEnter, selectOption, toggleCheckbox, check, uncheck)
    - `buildFailureReport()` wraps failure with `diagnostic` field set
    - `background.js` line 9991: `if (actionResult.diagnostic)` gates the `parallelDebugFallback()` call
    - STATUS: WIRED

11. **Phase 35 → heuristic fix message bridge**
    - `background.js:parallelDebugFallback()` sends `HEURISTIC_FIX` message to tab (line 2766)
    - `content/messaging.js` case `'HEURISTIC_FIX'` (line 1279) calls `FSB.runHeuristicFix()`
    - `content/actions.js` assigns `FSB.runHeuristicFix = runHeuristicFix` at line 5052
    - STATUS: WIRED

12. **Phase 35 → selectors: `reResolveElement` and `makeUnique` exported to FSB global**
    - `content/selectors.js` assigns `FSB.reResolveElement = reResolveElement` and `FSB.makeUnique = makeUnique` at lines 1082–1083
    - `content/dom-analysis.js` checks `FSB.reResolveElement` before calling (line 1780)
    - STATUS: WIRED (but see broken flow below)

13. **Phase 35 → stability: `STABILITY_PROFILES` and `waitForStability` defined and used**
    - Defined in `content/actions.js` at lines 1427 and 1442 (added as bugfix in 35-04)
    - Used throughout `content/actions.js` for scroll, click, type_keystroke, type_complete, select, light profiles
    - STATUS: WIRED

14. **Phase 32 enrichment prompt → Phase 31 schema fields**
    - `memory-extractor.js:_buildEnrichmentPrompt()` line 411: reads `memory.typeData.session`, `.learned`, `.procedures` — exactly matching Phase 31 schema
    - STATUS: WIRED

---

### Orphaned Exports / Unused Features

1. **`uiReadySelector` option in `waitForPageStability`** (Phase 35)
   - Defined and implemented in `content/actions.js` line 1143
   - No site guide, background.js caller, or actions.js handler ever passes `uiReadySelector` to `waitForPageStability()`
   - The feature is complete but has zero callers; the early-proceed path for infinite-fetching sites is not activated
   - Impact: Low severity. The feature degrades gracefully (null check guards it). Productivity sites like Notion that have infinite-scroll panels would benefit once a caller is wired.

---

### Missing Connections (Broken Wiring)

1. **`fsbElementDef._lastContext` is never assigned — re-resolution fallback is dead code** (Phase 35)
   - Location: `content/dom-analysis.js:findElementByStrategies()` line 1780
   - The code reads `fsbElementDef._lastContext` to feed `FSB.reResolveElement()` when all selectors fail
   - `_lastContext` is never written anywhere in the codebase (verified via repo-wide grep — zero assignments)
   - The successful-match path stores `context` on `element._fsbResolveContext` (line 1774, the DOM element), but never writes it back to `fsbElementDef._lastContext`
   - Result: The re-resolution fallback in `findElementByStrategies` can never trigger. When all selectors for an fsbElement fail (e.g., after a Notion deploy that changes ARIA attributes), the function returns `null` immediately without attempting re-resolution.
   - Fix required: After a successful find, add `fsbElementDef._lastContext = context;` before the `return` at line 1775.
   - Impact: Medium severity. Affects Phase 35 SEL-01/SEL-02 requirement (context-aware re-resolution). The `FSB.reResolveElement` function itself in `selectors.js` is correct — only the write-back is missing.

---

### Partial/Cosmetic Wiring Issues

1. **`siteGuide.name` vs `siteGuide.site` in hybrid continuation prompt** (Phase 35 CONT-01)
   - Location: `ai/ai-integration.js` lines 2583, 2593
   - All productivity site guides (and most others) define `site: 'Notion'` not `name:`
   - The `siteGuide.name || 'this site'` fallback evaluates to `'this site'` for all productivity guides
   - The tool hints and site context inject correctly (the guidance text is right) — only the label string is wrong
   - Examples: `"PREFERRED TOOLS for this site: ..."` instead of `"PREFERRED TOOLS for Notion: ..."`
   - Impact: Low severity — cosmetic label only. Functional content (tool list, guidance text) is correctly injected. Logging at line 2390 (`siteGuide?.name || 'none'`) also says `'none'` for all productivity guides, making debug logs misleading.
   - Fix: Use `siteGuide.site || siteGuide.name || 'this site'` consistently, matching the pattern at line 2384 and 4265.

---

### Broken Flows

1. **Context-aware selector re-resolution flow** (Phase 35 SEL-01)
   - Name: fsbElement re-resolution after selector failure
   - Expected: When all CSS/ARIA selectors fail for an fsbElement, `findElementByStrategies` uses `_lastContext` (stored from last successful find) to call `FSB.reResolveElement()` and recover the element
   - Broken at: `fsbElementDef._lastContext` write-back — context is captured but stored on the DOM element object, not on the definition object
   - Steps complete: [selector cascade attempt, FSB.reResolveElement function exists, messaging bridge works]
   - Steps missing: [`fsbElementDef._lastContext = context` write after successful find at dom-analysis.js line 1775]

---

### E2E Flows Verified Complete

1. **Session → Memory extraction → Storage → Display flow** (Phases 31–33)
   - `extractAndStoreMemories()` in background.js → `memoryManager.add()` → `memoryExtractor.extract()` → `createTaskMemory()` + `validateMemory()` → `memoryStorage.add()` → `options.js:renderTaskDetail()` with collapsible sections
   - All links verified present

2. **Session → Memory export → re-import round-trip** (Phases 31, 34)
   - Export: existing options.js export path serializes full memory object including typeData
   - Import: `handleMemoryImport()` → `validateMemory()` → `memoryStorage.add()` — preserves task type, typeData.session/learned/procedures structure

3. **Site guide fsbElements injection pipeline** (Phases 30, 35)
   - `getGuideForTask()` in background.js iteration loop → `iterationGuideSelectors` with `fsbElements` + `_siteName` → content script `buildMarkdownSnapshot()` → `getFilteredElements` Stage 1c injects fsbElements → health check and snapshot summary log site name
   - Verified for Notion, Jira, Airtable, Todoist, Trello (all define `fsbElements`)

4. **Action failure → diagnostics → parallel debug fallback** (Phase 35)
   - `diagnoseElementFailure()` → `buildFailureReport()` sets `actionResult.diagnostic` → background.js iteration loop gates on `actionResult.diagnostic` → `parallelDebugFallback()` fires `HEURISTIC_FIX` message + `runAIDebugger()` concurrently → `messaging.js` dispatches to `FSB.runHeuristicFix()`

5. **Hybrid continuation prompt with site-aware hints** (Phases 30, 35)
   - `ai-integration.js` detects continuation iteration → reads `siteGuide.toolPreferences` and `siteGuide.guidance` → replaces `{TOOL_HINTS}` / `{SITE_SCENARIOS}` in `HYBRID_CONTINUATION_PROMPT` — functional even though site name label is wrong (see cosmetic issues)

---

## Requirements Integration Map

| Requirement | Integration Path | Status | Issue |
|-------------|-----------------|--------|-------|
| INFRA-01 | Phase 30: fsbElements pipeline → dom-analysis.js generic injection → all guides | WIRED | — |
| INFRA-02 | Phase 30: keyword routing in site-guides/index.js → `getGuideForTask()` | WIRED | — |
| INFRA-03 | Phase 30: `_siteName` propagation → `background.js:8715` → dom-analysis.js health check | WIRED | — |
| MEM-01 | Phase 31: `createTaskMemory()` in memory-schemas.js → called by memory-extractor.js | WIRED | — |
| STOR-01 | Phase 31: inverted index outcome/stepCount buckets in memory-storage.js → query() filter | WIRED | — |
| MEM-02 | Phase 32: recon report prompt in `_buildExtractionPrompt` → AI response → `createTaskMemory()` | WIRED | — |
| MEM-03 | Phase 32: always-enrich in memory-manager.js line 74 → `_enrichAsync` for task type | WIRED | — |
| CONS-01 | Phase 32: memory-consolidator.js domain+task similarity → UPDATE with mergedData → memory-manager.js:add | WIRED | — |
| DISP-01 | Phase 33: `renderTaskDetail()` in options.js reads typeData.session/learned/procedures | WIRED | — |
| DISP-02 | Phase 33: `renderCollapsibleSection()` helper used for Timeline/Discoveries/Procedures | WIRED | — |
| DISP-03 | Phase 33: `SiteGraph.transformTaskData()` → inline SVG graph in detail view; `KnowledgeGraph.setTaskMemories()` fed by site-guides-viewer.js | WIRED | — |
| THEME-01 | Phase 34: `--surface-color`, `--card-bg`, `--hover-bg`, `--danger` defined in both :root and dark theme | WIRED | — |
| EXPORT-01 | Phase 34: `handleMemoryImport()` → `validateMemory()` → `memoryStorage.add()` with Task Memory typeData preserved | WIRED | — |
| SNAP-01 | Phase 35: scroll metadata in `buildMarkdownSnapshot` header — `hasMoreAbove/Below`, `contentAbove/Below%` always included | WIRED | — |
| SNAP-02 | Phase 35: `viewportComplete: true` hardcoded in `buildMarkdownSnapshot()` — all viewport elements, no arbitrary cap | WIRED | — |
| DIAG-01 | Phase 35: `diagnoseElementFailure()` 8-point check called from click/type/pressEnter failure paths | WIRED | — |
| DIAG-02 | Phase 35: `buildFailureReport()` wraps all action failures with diagnostic + elementSnapshot | WIRED | — |
| VRFY-01 | Phase 35: enhanced `verifyActionEffect()` returns `localChanges`, `confidence`, `whatChanged` | WIRED | — |
| VRFY-02 | Phase 35: `confidence` levels (high/medium/low) in verification result — self-contained in actions.js | WIRED | — |
| VRFY-03 | Phase 35: `whatChanged` summary in verification result — self-contained in actions.js | WIRED | — |
| BIN-01 | Phase 35: `checkBinaryState()` pre-check before toggle actions — self-contained in actions.js | WIRED | — |
| BIN-02 | Phase 35: `tools.check` / `tools.uncheck` auto-discovered via FSB.tools | WIRED | — |
| CONT-01 | Phase 35: `HYBRID_CONTINUATION_PROMPT` replaces minimal prompt on iteration 2+ | WIRED | — |
| CONT-02 | Phase 35: `{TOOL_HINTS}` filled from `siteGuide.toolPreferences` — functional, site name label wrong | PARTIAL | `siteGuide.name` undefined for productivity guides; label falls back to 'this site'. Content correct, display label wrong. |
| CONT-03 | Phase 35: `{SITE_SCENARIOS}` filled from `siteGuide.guidance` — functional, site name label wrong | PARTIAL | Same as CONT-02. guidance text itself is injected correctly. |
| CONT-04 | Phase 35: Domain change alert prepended to user message when `isDomainChanged` | WIRED | — |
| WAIT-01 | Phase 35: `STABILITY_PROFILES` + `waitForStability()` defined and replace all hardcoded delays | WIRED | — |
| WAIT-02 | Phase 35: `uiReadySelector` option in `waitForPageStability` — implemented but no callers | PARTIAL | Feature exists, zero call sites provide `uiReadySelector`. Dead at runtime. |
| SEL-01 | Phase 35: `reResolveElement()` exported to FSB global, checked before use | PARTIAL | `fsbElementDef._lastContext` never written — re-resolution fallback path is dead code. Function exists but is unreachable. |
| SEL-02 | Phase 35: `makeUnique()` + tightened generateSelector thresholds — self-contained in selectors.js | WIRED | — |
| ERR-01 | Phase 35: `buildFailureReport` structures all failures with reason, diagnostic, elementSnapshot, suggestions | WIRED | — |
| ERR-02 | Phase 35: `parallelDebugFallback` fires heuristic + AI debugger concurrently on `actionResult.diagnostic` present | WIRED | — |
| ERR-03 | Phase 35: `runAIDebugger` reuses `UniversalProvider` pattern; result injected as `actionResult.aiDiagnosis` | WIRED | — |
| NOTN-01 | Phase 30: notion.js fsbElements + guidance + toolPreferences (incl. togglecheck) | WIRED | — |
| NOTN-02 | Phase 30: notion.js slash command reference and todo-list workflow guidance | WIRED | — |
| JIRA-01 | Phase 30: jira.js fsbElements with data-testid-first selectors | WIRED | — |
| JIRA-02 | Phase 30: jira.js create-issue form field documentation | WIRED | — |
| ATBL-01 | Phase 30: airtable.js fsbElements with aria/role-first selectors | WIRED | — |
| ATBL-02 | Phase 30: airtable.js per-field-type interaction documentation | WIRED | — |

**Requirements with no cross-phase wiring (self-contained):**
- VRFY-02, VRFY-03, BIN-01, BIN-02 — entirely within `content/actions.js`, no other phase consumes their output directly
- SEL-02 — `makeUnique` used only within `content/selectors.js` generateSelector strategies

---

## Summary of Issues Requiring Action

| Severity | Issue | File | Fix |
|----------|-------|------|-----|
| Medium | `fsbElementDef._lastContext` never written — re-resolution fallback dead code | `content/dom-analysis.js:1775` | Add `fsbElementDef._lastContext = context;` after storing context |
| Low | `siteGuide.name` undefined for all `site:`-format guides — hybrid prompt label wrong | `ai/ai-integration.js:2583,2593` | Change to `siteGuide.site \|\| siteGuide.name \|\| 'this site'` |
| Low | `uiReadySelector` implemented but no caller provides it | `content/actions.js:1143` | Wire from site guide definition (e.g. `guide.uiReadySelector`) when guides for infinite-load sites are created |

