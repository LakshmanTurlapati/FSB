# Requirements: FSB v0.9.20 Autopilot Agent Architecture Rewrite

**Defined:** 2026-03-31
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.20 Requirements

Requirements for autopilot architecture rewrite. Each maps to roadmap phases.

### Provider Adapters

- [ ] **PROV-01**: User can run autopilot with xAI Grok using native tool_use (not CLI text)
- [ ] **PROV-02**: User can run autopilot with OpenAI GPT-4o using native tool_use
- [ ] **PROV-03**: User can run autopilot with Anthropic Claude using native tool_use
- [ ] **PROV-04**: User can run autopilot with Google Gemini using native tool_use
- [ ] **PROV-05**: User can run autopilot with OpenRouter models using native tool_use
- [ ] **PROV-06**: User can run autopilot with custom OpenAI-compatible endpoints using native tool_use

### Tool Registry

- [x] **TOOL-01**: All 35+ browser tools defined once in JSON Schema, shared between autopilot and MCP
- [x] **TOOL-02**: Tool definitions include routing metadata (content script, CDP, background, data)
- [ ] **TOOL-03**: MCP server imports tool schemas from shared registry (not inline Zod)

### Execution

- [ ] **EXEC-01**: Single executeTool() function dispatches to correct handler for both autopilot and MCP
- [ ] **EXEC-02**: Tool results include structured feedback (success, hadEffect, error, navigationTriggered)
- [ ] **EXEC-03**: Read-only tools (get_dom_snapshot, read_page, get_text) bypass mutation queue

### Agent Loop

- [ ] **LOOP-01**: Agent loop sends messages with tool definitions, receives tool_use blocks, executes, feeds tool_result back
- [ ] **LOOP-02**: Loop uses setTimeout-chaining (not while-loop) for Chrome MV3 service worker compatibility
- [ ] **LOOP-03**: AI controls iteration -- no fixed iteration cap, completion via stop_reason/end_turn
- [ ] **LOOP-04**: System prompt is minimal (~1-2KB task description + page URL)
- [ ] **LOOP-05**: User can stop running autopilot session via sidepanel stop button

### Safety

- [ ] **SAFE-01**: Cost-based circuit breaker stops session when estimated cost exceeds threshold (default $2)
- [ ] **SAFE-02**: Session time limit stops automation after configurable duration (default 10 min)
- [ ] **SAFE-03**: External stuck detection injects recovery hints when 3+ consecutive tool calls produce no DOM change
- [ ] **SAFE-04**: Session state persisted after every iteration for service worker resurrection

### Context Management

- [ ] **CTX-01**: DOM snapshot is an on-demand tool -- AI calls get_page_snapshot when needed
- [ ] **CTX-02**: Site guides are a queryable tool -- AI calls get_site_guide(domain) when needed
- [ ] **CTX-03**: Sliding window history management compacts old tool_results at 80% token budget
- [ ] **CTX-04**: Prompt caching enabled for system prompt + tool definitions (Anthropic, others where supported)

### Progress

- [ ] **PROG-01**: Progress overlay shows current tool being executed and AI reasoning
- [ ] **PROG-02**: AI can update progress text via report_progress tool
- [ ] **PROG-03**: Cost tracking displays estimated session cost in real-time

### Cleanup

- [ ] **CLN-01**: cli-parser.js and CLI_COMMAND_TABLE removed
- [ ] **CLN-02**: Old TASK_PROMPTS and buildPrompt templates removed
- [ ] **CLN-03**: Multi-signal completion validator removed (replaced by stop_reason)
- [ ] **CLN-04**: Per-iteration automatic DOM fetching removed (replaced by on-demand tool)

## Future Requirements

### Deferred from v0.9.20

- **DEFER-01**: Procedural memory as queryable tool (add after basic loop is stable)
- **DEFER-02**: Parallel tool execution (multiple tool_use blocks executed concurrently)
- **DEFER-03**: Context window budget tracking with proactive compaction
- **DEFER-04**: Streaming tool_use responses for real-time thinking display
- **DEFER-05**: Dynamic tool subsetting (only send relevant tools per context)

## Out of Scope

| Feature | Reason |
|---------|--------|
| CLI text parsing fallback | Entire point of migration is to eliminate this |
| Built-in AI-controlled stuck detection | Keep as external system, not AI self-reporting |
| Task-type classification for prompt selection | AI has full tool catalog, decides itself |
| Per-iteration automatic DOM fetching | Replaced by on-demand tool |
| Fixed iteration cap | Replaced by cost + time circuit breakers |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 135 | Pending |
| PROV-02 | Phase 135 | Pending |
| PROV-03 | Phase 135 | Pending |
| PROV-04 | Phase 135 | Pending |
| PROV-05 | Phase 135 | Pending |
| PROV-06 | Phase 135 | Pending |
| TOOL-01 | Phase 135 | Complete |
| TOOL-02 | Phase 135 | Complete |
| TOOL-03 | Phase 136 | Pending |
| EXEC-01 | Phase 136 | Pending |
| EXEC-02 | Phase 136 | Pending |
| EXEC-03 | Phase 136 | Pending |
| LOOP-01 | Phase 137 | Pending |
| LOOP-02 | Phase 137 | Pending |
| LOOP-03 | Phase 137 | Pending |
| LOOP-04 | Phase 137 | Pending |
| LOOP-05 | Phase 137 | Pending |
| SAFE-01 | Phase 137 | Pending |
| SAFE-02 | Phase 137 | Pending |
| SAFE-03 | Phase 137 | Pending |
| SAFE-04 | Phase 137 | Pending |
| CTX-01 | Phase 138 | Pending |
| CTX-02 | Phase 138 | Pending |
| CTX-03 | Phase 138 | Pending |
| CTX-04 | Phase 138 | Pending |
| PROG-01 | Phase 138 | Pending |
| PROG-02 | Phase 138 | Pending |
| PROG-03 | Phase 138 | Pending |
| CLN-01 | Phase 139 | Pending |
| CLN-02 | Phase 139 | Pending |
| CLN-03 | Phase 139 | Pending |
| CLN-04 | Phase 139 | Pending |

**Coverage:**
- v0.9.20 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
