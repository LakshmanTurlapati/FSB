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

- [x] **MEM-01**: Procedural memory creation -- extract successful action sequences from completed Task memories, store as replayable playbooks with site, task type, and action steps
- [x] **MEM-02**: Procedural memory injection -- when autopilot encounters matching site + task type, inject known-good action sequence into prompt as recommended approach
- [x] **MEM-03**: Auto-consolidation triggers after every 10 sessions or when memory count exceeds 80% of capacity limit, without requiring manual user action
- [x] **MEM-04**: Cross-domain memory search -- when no memories exist for current domain, search by task type pattern across all domains to transfer learned strategies
- [x] **MEM-05**: Memory refresh on domain change mid-session -- refetch relevant memories when navigation crosses domain boundaries during multi-site tasks
- [x] **MEM-06**: Remove dead episodic memory code paths (schemas, consolidator references) that are defined but never created, replaced entirely by Task memory

### Robustness

- [x] **ROBUST-01**: Coordinate validation rejects out-of-viewport CDP tool parameters before execution, returning descriptive error with viewport dimensions
- [x] **ROBUST-02**: Stuck detection distinguishes coordinate-based failures from DOM interaction failures, with bidirectional recovery (coordinate stuck suggests DOM fallback, DOM stuck suggests coordinate approach)
- [x] **ROBUST-03**: Progressive prompt trimming on heavy DOM pages reduces context in stages (trim examples, then trim element count, then memory) instead of timing out
- [x] **ROBUST-04**: CLI parse failure triggers automatic retry with simplified prompt hint ("respond with exactly one CLI command per line") instead of aborting the action batch

### Validation

- [x] **VALID-01**: Run all 50 v0.9.7 edge case prompts (CANVAS-01 through DARK-10) through autopilot mode with documented pass/fail outcomes
- [x] **VALID-02**: Achieve 90%+ pass rate (45/50 minimum) across all 50 edge case autopilot runs
- [x] **VALID-03**: Autopilot CLI parse failure rate measured below 5% across all 50 test runs
- [x] **VALID-04**: Autopilot completion validation correctly identifies task done/not-done with 90%+ accuracy across all 50 test cases

### Verification Mechanics Fix

- [x] **VMFIX-01**: CDP coordinate tool calls (cdpClickAt, cdpDrag, cdpScrollAt, cdpClickAndHold, cdpDragVariableSpeed) report success=true when CDP dispatch completes without error, bypassing DOM mutation verification that is irrelevant for coordinate-based interactions
- [x] **VMFIX-02**: Completion validator honors AI done/fail commands within 2 iterations even on pages with continuous DOM changes (real-time charts, animations, live data feeds) by prioritizing explicit AI completion signals over DOM stability signals
- [x] **VMFIX-03**: Stale autopilot sessions auto-expire after 5 minutes of no AI iteration progress, cleaning up session state and freeing the tab for new task launches

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
| MEM-01 | Phase 100 | Complete |
| MEM-02 | Phase 100 | Complete |
| MEM-03 | Phase 101 | Complete |
| MEM-04 | Phase 101 | Complete |
| MEM-05 | Phase 101 | Complete |
| MEM-06 | Phase 101 | Complete |
| ROBUST-01 | Phase 102 | Complete |
| ROBUST-02 | Phase 102 | Complete |
| ROBUST-03 | Phase 102 | Complete |
| ROBUST-04 | Phase 102 | Complete |
| VALID-01 | Phase 103 | Complete |
| VALID-02 | Phase 103 | Complete |
| VALID-03 | Phase 103 | Complete |
| VALID-04 | Phase 103 | Complete |
| VMFIX-01 | Phase 104 | Complete |
| VMFIX-02 | Phase 104 | Complete |
| VMFIX-03 | Phase 104 | Complete |

**Coverage:**
- v0.9.8 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation (traceability populated)*
