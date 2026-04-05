# Phase 100: Procedural Memory - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire procedural memory creation from completed Task memories and injection into autopilot prompts. After a successful automation session, the system extracts a compact playbook (site, task type, ordered action steps). When a matching task is encountered later, the playbook appears in the prompt as a recommended approach.

</domain>

<decisions>
## Implementation Decisions

### Extraction Trigger and Source
- Extract after successful session completion (outcome='success') in background.js session handler -- zero user action needed
- Source data: session.timeline array (action, target, url, result) + session.task + session.domain from the Task memory
- Quality threshold: only extract from sessions with outcome='success' AND iterationCount <= 10 (efficient sessions represent good playbooks)

### Task Matching Strategy
- Match via domain + keyword overlap on task string (e.g. "search Amazon for wireless mouse" matches stored "search Amazon for headphones") -- no AI needed
- Site matching at domain level using existing memory domain field (amazon.com matches amazon.com)
- Cap at 5 procedural memories per domain, newest replaces oldest when full -- prevents unbounded growth

### Prompt Injection Format
- Inject in `_buildTaskGuidance()` after site guide text -- same injection point as other task-type guidance
- Compact numbered action list format with tool + target (e.g. "1. click e5 (search box) 2. type e5 'wireless mouse' 3. enter") -- token-efficient
- Header: "RECOMMENDED APPROACH (from prior success on this site):" with note "Adapt steps to current page state -- elements may differ"

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createProceduralMemory()` in lib/memory/memory-schemas.js:111 -- existing schema with steps, selectors, timings, successRate, totalRuns, targetUrl fields
- `createTaskMemory()` in lib/memory/memory-schemas.js:139 -- Task memory schema with session.timeline (action, target, url, result, timestamp)
- `MEMORY_TYPES.PROCEDURAL` in lib/memory/memory-schemas.js:17 -- type constant already defined
- `memory-retriever.js` -- existing retrieval with scoring that already handles PROCEDURAL type (line 121)
- `memory-storage.js` -- persistent storage layer using chrome.storage.local
- `memory-manager.js` -- orchestrator for memory operations (store, retrieve, consolidate)
- `_buildTaskGuidance()` in ai/ai-integration.js:4260 -- injection point for task-type-specific prompt text

### Established Patterns
- Memory creation: schemas define structure, extractor populates from session data, manager orchestrates storage
- Memory retrieval: retriever scores memories by relevance (domain, keywords, recency), returns top N
- Prompt injection: `_buildTaskGuidance()` appends text to system prompt based on task type and site guide
- Task memory extraction already happens after session completion in memory-extractor.js

### Integration Points
- Session completion handler in background.js triggers memory extraction
- `_buildTaskGuidance()` is the prompt injection point (called during system prompt assembly at line 2589)
- `memory-retriever.js` provides `retrieveRelevant()` for fetching matching memories
- `memory-storage.js` provides `store()` and `getByType()` for persistence

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond decisions above

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
