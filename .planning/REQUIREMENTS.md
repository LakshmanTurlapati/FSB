# Requirements: FSB v0.9.8 Autopilot Refinement

**Defined:** 2026-03-22
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.8 Requirements

Make the autopilot mode perform as flawlessly as MCP manual mode. The AI (Grok 4.1) is capable -- the gap is tooling, prompting, and memory. Bridge it.

### Tool Parity

- [x] **TOOL-01**: Autopilot CLI_COMMAND_TABLE documents all 33 browser action tools including 7 new ones (clickat, clickandhold, drag, dragvariablespeed, scrollat, selecttextrange, dropfile) with usage examples
- [x] **TOOL-02**: CLI parser COMMAND_REGISTRY maps all 7 new verbs to correct FSB.tools functions with full parameter specs and aliases
- [x] **TOOL-03**: isValidTool() validator accepts all 7 new tool names (cdpClickAt, cdpClickAndHold, cdpDrag, cdpDragVariableSpeed, cdpScrollAt, selectTextRange, dropfile)
- [x] **TOOL-04**: dragdrop registry entry includes optional steps, holdMs, stepDelayMs parameters matching MCP manual mode capabilities

### Prompt Engineering

- [x] **PROMPT-01**: System prompt groups tools by interaction type (DOM element, CDP coordinate, text range, file upload) with "when to use which" decision guidance
- [x] **PROMPT-02**: Task-type detection triggers tool-specific prompt sections -- canvas/map tasks prioritize CDP tools, form tasks prioritize DOM tools, text tasks prioritize selection tools
- [x] **PROMPT-03**: v0.9.7 autopilot diagnostic recommendations (500+) wired into site guide files as strategy hints for autopilot mode

### Memory

- [ ] **MEM-01**: Procedural memory creation -- extract successful action sequences from completed Task memories, store as replayable playbooks with site, task type, and action steps
- [ ] **MEM-02**: Procedural memory injection -- when autopilot encounters matching site + task type, inject known-good action sequence into prompt as recommended approach
- [ ] **MEM-03**: Auto-consolidation triggers after every 10 sessions or when memory count exceeds 80% of capacity limit, without requiring manual user action
- [ ] **MEM-04**: Cross-domain memory search -- when no memories exist for current domain, search by task type pattern across all domains to transfer learned strategies
- [ ] **MEM-05**: Memory refresh on domain change mid-session -- refetch relevant memories when navigation crosses domain boundaries during multi-site tasks
- [ ] **MEM-06**: Remove dead episodic memory code paths (schemas, consolidator references) that are defined but never created, replaced entirely by Task memory

### Robustness

- [ ] **ROBUST-01**: Coordinate validation rejects out-of-viewport CDP tool parameters before execution, returning descriptive error with viewport dimensions
- [ ] **ROBUST-02**: Stuck detection distinguishes coordinate-based failures from DOM interaction failures, with bidirectional recovery (coordinate stuck suggests DOM fallback, DOM stuck suggests coordinate approach)
- [ ] **ROBUST-03**: Progressive prompt trimming on heavy DOM pages reduces context in stages (trim examples, then trim element count, then memory) instead of timing out
- [ ] **ROBUST-04**: CLI parse failure triggers automatic retry with simplified prompt hint ("respond with exactly one CLI command per line") instead of aborting the action batch

### Validation

- [ ] **VALID-01**: Run all 50 v0.9.7 edge case prompts (CANVAS-01 through DARK-10) through autopilot mode with documented pass/fail outcomes
- [ ] **VALID-02**: Achieve 90%+ pass rate (45/50 minimum) across all 50 edge case autopilot runs
- [ ] **VALID-03**: Autopilot CLI parse failure rate measured below 5% across all 50 test runs
- [ ] **VALID-04**: Autopilot completion validation correctly identifies task done/not-done with 90%+ accuracy across all 50 test cases

## Future Requirements (v0.9.9+)

- **EMBED-01**: Semantic vector embeddings for memory search (replace keyword matching with cosine similarity)
- **REPLAY-01**: Full procedural memory replay without AI -- execute stored action sequences directly, re-engage AI only on failure
- **BRIDGE-01**: WebSocket bridge health check and auto-reconnect for MCP server stability

## Out of Scope

| Feature | Reason |
|---------|--------|
| Semantic vector embeddings | Infrastructure cost vs marginal gain over improved keyword + cross-domain search |
| Autopilot pass rate below 90% acceptable | 45/50 minimum -- this is the milestone gate |
| New MCP tool creation | v0.9.7 tools are sufficient -- this milestone wires them to autopilot |
| WebSocket bridge auto-reconnect | Infrastructure concern separate from autopilot logic |
| Vision/screenshot interaction | DOM-only per project constraint |
| Episodic memory resurrection | Task memory fully replaced it -- clean up, don't rebuild |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOL-01 | Phase 97 | Complete |
| TOOL-02 | Phase 97 | Complete |
| TOOL-03 | Phase 97 | Complete |
| TOOL-04 | Phase 97 | Complete |
| PROMPT-01 | Phase 98 | Complete |
| PROMPT-02 | Phase 98 | Complete |
| PROMPT-03 | Phase 99 | Complete |
| MEM-01 | Phase 100 | Pending |
| MEM-02 | Phase 100 | Pending |
| MEM-03 | Phase 101 | Pending |
| MEM-04 | Phase 101 | Pending |
| MEM-05 | Phase 101 | Pending |
| MEM-06 | Phase 101 | Pending |
| ROBUST-01 | Phase 102 | Pending |
| ROBUST-02 | Phase 102 | Pending |
| ROBUST-03 | Phase 102 | Pending |
| ROBUST-04 | Phase 102 | Pending |
| VALID-01 | Phase 103 | Pending |
| VALID-02 | Phase 103 | Pending |
| VALID-03 | Phase 103 | Pending |
| VALID-04 | Phase 103 | Pending |

**Coverage:**
- v0.9.8 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation (traceability populated)*
