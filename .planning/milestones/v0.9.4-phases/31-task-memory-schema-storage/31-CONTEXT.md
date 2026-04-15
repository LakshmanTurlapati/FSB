# Phase 31: Task Memory Schema & Storage - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Define a unified Task Memory schema that combines episodic/semantic/procedural data into one document per session, and update the storage layer to persist and retrieve it alongside old-format memories. No UI overhaul — just the data model, storage, validation, search index, and type filter dropdown.

</domain>

<decisions>
## Implementation Decisions

### Memory Structure
- Nested sections inside `typeData`: `{ session: {...}, learned: {...}, procedures: [...] }`
- `session` section (episodic): task, outcome, domain, duration, iterationCount, finalUrl, timeline (structured step objects with action/target/result/timestamp), failures
- `learned` section (semantic): Claude's discretion on sub-structure — selectors, site structure, and patterns are the key categories
- `procedures` section: array of reusable sequences `[{ name, steps[], successRate, targetUrl }]` — one task may discover multiple patterns
- New `type: "task"` value added to `MEMORY_TYPES`

### Backward Compatibility
- Dual reader: storage reads both old and new formats, routes to appropriate renderer
- Old memories blend in visually — no legacy badge or dimming
- Old-format memories are NOT created going forward — everything is Task Memory
- Old memories stay as-is in storage; migration is on-demand only (Phase 33)

### Summary & Identity
- `text` field contains task + outcome: e.g., "Searched Amazon for wireless mouse — success"
- Single task icon for all Task Memories (replaces type-based clock/lightbulb/list)
- Metadata line redesigned for Task Memories: Domain | Duration | Steps count | Outcome badge
- Sorted most recent first (same as current behavior)

### Search Integration
- Extend inverted index with new fields: outcome, stepCount, discoveredSelectors — enables filtering by "show me all failed tasks"
- Task Memories get a type boost in retriever scoring — AI prefers consolidated intel over old fragments
- Add 'Task' to the type filter dropdown in Memory tab now (minimal UI touch in this phase)

### Claude's Discretion
- Exact sub-structure of `learned` section (how to organize selectors vs site structure vs patterns)
- ID generation format (keep existing `mem_` prefix or new `task_` prefix)
- How to populate `tags` field from Task Memory data
- Exact boost factor for Task Memory type in retriever scoring

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createBaseMemory()` in memory-schemas.js: Already generates base structure with id, type, text, metadata, typeData, sourceSessionId — extend for `type: "task"`
- `validateMemory()`: Add "task" to valid types check
- `MEMORY_TYPES` constant: Add TASK entry
- Inverted index in memory-storage.js: Already supports domain/taskType/tags — extend with outcome/stepCount

### Established Patterns
- All memories share `createBaseMemory()` base — new schema should follow same pattern with `createTaskMemory()` factory
- `typeData` is the type-specific payload — nested sections go here
- Export pattern: `self.X = X` for service worker, conditional `window`/`module.exports` for other contexts
- `validateMemory()` uses errors array pattern — extend, don't rewrite

### Integration Points
- `memory-manager.js:add()` — must accept Task Memory objects, route to storage
- `memory-storage.js:add()` — must persist Task Memory with updated inverted index
- `memory-retriever.js:search()` — boost scoring for type="task", index new fields
- `memory-consolidator.js:resolve()` — similarity check must work with Task Memory text format
- options.js type filter dropdown (`#memoryTypeFilter`) — add "Task" option
- options.js `renderMemoryList()` — detect type="task" and render appropriately (basic card for now)

</code_context>

<specifics>
## Specific Ideas

- The user wants this to feel like a reconnaissance report — one consolidated view of everything FSB learned during a task
- Structured step objects (action/target/result/timestamp) are important because they feed into the graph visualization in Phase 33
- Multiple procedures per memory reflects that one task can teach multiple reusable patterns (e.g., "how to search on Amazon" AND "how to add to cart")

</specifics>

<deferred>
## Deferred Ideas

- Graph visualization per task — Phase 33
- Full detail view with timeline rendering — Phase 33
- Migration utility for old memories — Phase 33
- Session-based consolidation logic — Phase 32

</deferred>

---

*Phase: 31-task-memory-schema-storage*
*Context gathered: 2026-03-16*
