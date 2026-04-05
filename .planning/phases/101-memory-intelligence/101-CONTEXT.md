# Phase 101: Memory Intelligence - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the memory system operate autonomously: auto-consolidation triggers, cross-domain strategy transfer when no local memories exist, memory refresh on domain change during multi-site tasks, and removal of dead episodic memory code paths.

</domain>

<decisions>
## Implementation Decisions

### Auto-Consolidation Trigger (MEM-03)
- Increment a session counter in chrome.storage.local after every memoryManager.add() call in background.js
- Fire consolidateAll() at 10 sessions (reset counter after consolidation)
- Also fire when any memory type hits 80% of capacity (80 out of 100 per type, using existing memory-storage.js capacity)
- Fire-and-forget (no await) -- consolidation must never block automation

### Cross-Domain Strategy Transfer (MEM-04)
- Query memoryStorage for all procedural memories, filter by matching taskType (e.g. 'shopping' on newsite.com matches 'shopping' on amazon.com)
- Sort by successRate descending, return max 2 cross-domain playbooks
- Inject at same RECOMMENDED APPROACH point in _buildTaskGuidance() as fallback when no same-domain memories found
- Include "[from {domain}]" attribution in the injected text so AI knows the source

### Domain Change Refresh (MEM-05)
- Compare currentUrl domain before each iteration against stored lastDomain in session state
- If domain changed, clear _longTermMemories and re-fetch for new domain (replace, not merge)
- Implement in ai/ai-integration.js where _fetchLongTermMemories() is defined (line 1732) and called (line 1924) -- add domain-change check before the fetch

### Dead Code Cleanup (MEM-06)
- Claude's discretion for identifying and removing dead episodic memory schemas, consolidator references, and unused code paths
- Key targets: MEMORY_TYPES.EPISODIC, createEpisodicMemory(), episodic-specific branches in retriever/consolidator/extractor
- Must not break Task memory functionality (which replaced episodic)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `memoryManager.consolidate()` in lib/memory/memory-manager.js:157 -- existing consolidation orchestration
- `_consolidator.consolidateAll()` in lib/memory/memory-consolidator.js:205 -- full consolidation implementation
- `memoryStorage` capacity eviction in lib/memory/memory-storage.js:106 -- existing capacity mechanism (100 per type)
- `_fetchLongTermMemories()` in ai/ai-integration.js -- memory retrieval called per iteration
- `_buildTaskGuidance()` in ai/ai-integration.js:4260 -- procedural memory injection point (Phase 100)
- `MEMORY_TYPES.EPISODIC` and `createEpisodicMemory()` in memory-schemas.js -- dead code to remove

### Established Patterns
- Session counter: chrome.storage.local for persistent counters (already used for analytics)
- Fire-and-forget: same pattern as `generateActionSummary` (Phase 40) -- never awaited
- Memory refresh: `_fetchLongTermMemories()` already called at iteration start
- Dead code detection: grep for EPISODIC references across lib/memory/ files

### Integration Points
- background.js session completion handler (where Phase 100 procedural extraction runs)
- background.js iteration loop (where memory fetch and domain tracking happen)
- ai/ai-integration.js _buildTaskGuidance() (where procedural memory injection happens)
- lib/memory/ modules (schemas, storage, retriever, consolidator, extractor, manager)

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond decisions above

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
