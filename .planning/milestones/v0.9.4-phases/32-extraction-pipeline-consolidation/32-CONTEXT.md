# Phase 32: Extraction Pipeline & Consolidation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite the AI extraction pipeline so every completed automation session produces exactly one Task Memory (using `createTaskMemory()` from Phase 31) instead of 1-5 fragmented type-based memories. Update consolidation to use domain + task similarity matching. Update enrichment for the new unified type.

</domain>

<decisions>
## Implementation Decisions

### AI Prompt Design
- AI interprets everything — send session data to AI, let it produce the full structured JSON recon report
- AI returns one structured JSON object matching the typeData shape: `{ session: {...}, learned: {...}, procedures: [...] }` — maps directly to `createTaskMemory()`
- Quality over cost — use the user's main model for extraction if it produces better analysis
- AI generates the `text` summary field (natural language, not code-constructed)

### Session Data Mapping
- Send EVERYTHING available to the AI: full actionHistory, hardFacts (workingSelectors, criticalActions), sessionMemory (stepsCompleted, failedApproaches), compactedSummary
- ALL actions go into the prompt (not just last 15) — AI sees the complete picture
- Include full URLs per action so AI can map navigation paths and site structure
- Include element description/role from result data — "Clicked Submit button" not "click(#submit-btn)"

### Consolidation Behavior
- Consolidator runs at add time (check before storing, same as current pattern)
- Match by domain + task text similarity — catches "search Amazon for mouse" vs "search Amazon for keyboard"
- Claude's discretion on merge vs keep-separate strategy for repeat tasks

### Enrichment for Tasks
- Unified task analysis: key takeaways, risk factors, optimization tips, reusability assessment — replaces 3 type-specific enrichment prompts
- Task Memories ALWAYS get enriched — no "Refine with AI" button, autoAnalyzeMemories setting bypassed for task type
- No separate refine button in UI — Task Memories arrive fully enriched by default

### Claude's Discretion
- Exact AI prompt wording (system + user prompt content)
- How to handle token limits if full actionHistory is very long (truncation strategy)
- Merge vs keep-separate decision for repeat tasks on same domain
- Exact enrichment prompt for unified task analysis
- Whether to keep the old extraction path as dead code or remove it entirely

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MemoryExtractor._getProvider()`: Already handles provider loading, API key validation — reuse as-is
- `MemoryExtractor._isAuthError()` / `_isTransientError()`: Error classification — reuse
- Retry logic (MAX_RETRIES=2, RETRY_DELAYS): Retry pattern — reuse
- `extractAndStoreMemories()` in background.js: Snapshots AI data — enrichedData capture stays, just the downstream changes

### Established Patterns
- `_buildExtractionPrompt()` builds messages array with system + user prompt → same pattern, new content
- `_parseExtractedMemories()` validates with `validateMemory()` → same flow, new type
- `memoryManager.add()` delegates to extractor then storage → pipeline structure stays
- Fire-and-forget enrichment via `_enrichAsync()` → keep pattern but always run for tasks

### Integration Points
- `memory-extractor.js:_buildExtractionPrompt()` — REWRITE: new prompt asking for single Task Memory JSON
- `memory-extractor.js:_parseExtractedMemories()` — REWRITE: parse single JSON into `createTaskMemory()`
- `memory-extractor.js:_buildEnrichmentPrompt()` — UPDATE: add task type handling
- `memory-manager.js:add()` — UPDATE: handle single Task Memory from extraction (not array of fragments)
- `memory-consolidator.js:resolve()` — UPDATE: domain + task similarity for type="task"
- `background.js:extractAndStoreMemories()` — NO CHANGE: it already captures enrichedData and calls memoryManager.add()
- 13 call sites in background.js — NO CHANGE: they all call extractAndStoreMemories() fire-and-forget

</code_context>

<specifics>
## Specific Ideas

- The prompt should make the AI feel like it's writing a recon/intelligence report — "analyze this session and produce a consolidated intelligence report"
- Include full URLs per action so the AI can reconstruct navigation paths (critical for the graph in Phase 33)
- Element descriptions alongside selectors — "Clicked 'Add to Cart' button (#add-to-cart-btn)" not just the selector
- Task Memories should feel complete — no need for a second pass or "refine" button

</specifics>

<deferred>
## Deferred Ideas

- Graph visualization from timeline data — Phase 33
- Migration of old fragmented memories — Phase 33
- Full detail view rendering — Phase 33

</deferred>

---

*Phase: 32-extraction-pipeline-consolidation*
*Context gathered: 2026-03-16*
