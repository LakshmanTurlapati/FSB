# Phase 156: State Foundation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract session state management from agent-loop.js into typed, structured modules with persistence guarantees for Chrome MV3 service worker lifecycle. Delivers: typed session schema with hot/warm tiering, transcript store with budget-aware compaction, structured turn results, structured action history events, and state change event emitter. No new user-facing capabilities -- this is internal architecture extraction.

</domain>

<decisions>
## Implementation Decisions

### Session schema design
- **D-01:** Full typed session schema -- define every session field upfront with defaults in a `createSession()` factory. No ad-hoc property addition on session objects. Mirrors Claude Code's RuntimeSession pattern.
- **D-02:** Hot/warm tier annotations live in the schema itself. Each field is tagged as hot (transient -- Promises, setTimeout handles, accepted as lost on SW kill) or warm (persisted to chrome.storage.session after every state change). The schema IS the persistence contract.

### Transcript store
- **D-03:** TranscriptStore is a class instantiated per session, not a stateless utility. Instance holds messages[], exposes append/compact/replay/flush methods. Mirrors Claude Code's TranscriptStore pattern.
- **D-04:** Preserve FSB's existing token-budget-aware compaction (80% trigger, keep recent 5 intact, replace old tool_result content with one-liner summaries). Do NOT adopt Claude Code's simpler turn-count compaction.

### Turn result
- **D-05:** Claude's Discretion -- Claude decides whether TurnResult is a separate class or embedded in the transcript store. Optimize for cleanest separation of concerns between iteration metadata and message history.

### State event model
- **D-06:** EventEmitter class in the background service worker. Components (sidepanel, dashboard) register listeners via chrome.runtime.onMessage. Emitter translates internal state events to chrome messages automatically.
- **D-07:** Delta events only -- events carry only what changed (e.g., `{type: 'iteration_complete', iteration: 5, cost: 0.003}`). Subscribers maintain their own view of state. Keeps WebSocket payload to dashboard small.

### Persistence strategy
- **D-08:** Persist warm state after every tool result completion. If the service worker is killed mid-session, at most one tool call is lost. Accept ~47ms serialization overhead per write.
- **D-09:** Use chrome.storage.session for active session warm state (fast, auto-cleared on browser close, 1MB limit sufficient for active session metadata). Completed session conversation history archived to chrome.storage.local only when the session ends.

### Claude's Discretion
- Exact field names and types in the session schema (count and names emerge from reading current session usage in agent-loop.js and background.js)
- Action history event object shape (what fields constitute a structured action event)
- Whether TranscriptStore.compact() is called from within the store on append or explicitly by the agent loop
- EventEmitter internal implementation details (Map-based handlers, event naming convention)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Claude Code reference source
- `Research/claude-code/src/transcript.py` -- TranscriptStore pattern: append, compact, replay, flush interface
- `Research/claude-code/src/session_store.py` -- Session persistence pattern: JSON serialization, session_id keying
- `Research/claude-code/src/runtime.py` -- RuntimeSession pattern: typed session fields, turn loop lifecycle, structured turn results

### Research artifacts
- `.planning/research/SUMMARY.md` -- Synthesized architecture recommendations, pitfall warnings
- `.planning/research/ARCHITECTURE.md` -- Subsystem mapping, 17 new module proposal, data flow diagrams
- `.planning/research/PITFALLS.md` -- Pitfall 1 (SW state loss), Pitfall 2 (compaction regression), Pitfall 3 (storage quota)

### FSB source (modify targets)
- `ai/agent-loop.js` -- Primary extraction target (1429 lines, 130 session.* references, compactHistory at line 262, runAgentIteration at line 935)
- `background.js` -- Session creation/management, sendStatus calls, storage persistence code

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `compactHistory()` at agent-loop.js:262 -- 90-line function with token-budget-aware compaction, direct extraction target for TranscriptStore
- `estimateCost()` at agent-loop.js:111 -- Cost estimation with MODEL_PRICING table, extraction target for cost tracker (Phase 157)
- `buildSystemPrompt()` at agent-loop.js:518 -- System prompt builder, stays in agent-loop.js but references will need updating

### Established Patterns
- `importScripts()` loading with `typeof` guards for dual Chrome/Node compatibility (lines 22-46)
- `var` declarations for shared-scope globals to avoid const/let redeclaration in importScripts context
- camelCase functions, PascalCase classes, SCREAMING_SNAKE_CASE constants
- 2-space indentation, single quotes, semicolons always

### Integration Points
- agent-loop.js `runAgentLoop()` at line 813 -- creates session state, manages iteration lifecycle
- agent-loop.js `runAgentIteration()` at line 935 -- reads/writes session properties per iteration
- background.js session management -- activeSessions Map, session persistence to chrome.storage
- Sidepanel/popup receive status via chrome.runtime message passing

</code_context>

<specifics>
## Specific Ideas

- "We are basically analyzing how Claude Code works and adapting the exact architecture 1:1 for browser automation" -- the implementation should mirror Claude Code's patterns closely where they translate to Chrome Extension context
- Research/claude-code/src/ is the primary reference -- each new module should be traceable to its Claude Code counterpart

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 156-state-foundation*
*Context gathered: 2026-04-02*
