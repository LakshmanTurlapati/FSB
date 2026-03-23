# Roadmap: FSB (Full Self-Browsing)

## Milestones

- v0.9 Reliability Improvements (shipped 2026-02-14)
- v9.0.2 AI Situational Awareness (shipped 2026-02-18)
- v9.3 Tech Debt Cleanup (shipped 2026-02-23)
- v9.4 Career Search Automation (shipped 2026-02-28)
- v10.0 CLI Architecture (shipped 2026-03-15)
- v0.9.2-v0.9.4 Productivity, Memory & AI Quality (shipped 2026-03-17)
- v0.9.5 Progress Overlay Intelligence (shipped 2026-03-17)
- v0.9.6 Agents & Remote Control (shipped 2026-03-19)
- v0.9.7 MCP Edge Case Validation (shipped 2026-03-22) -- [archive](milestones/v0.9.7-ROADMAP.md)

## Current: v0.9.8 Autopilot Refinement

**Milestone Goal:** Make the autopilot mode perform as flawlessly as MCP manual mode -- bridge the tool gap, refine prompting, and validate against the same edge cases.

## Phases

- [x] **Phase 97: Tool Parity** - Register all 7 new CDP tools in autopilot's CLI command table, parser registry, and validation layer (completed 2026-03-22)
- [x] **Phase 98: Prompt Architecture** - Restructure system prompt with tool grouping by interaction type and task-type conditional sections (completed 2026-03-22)
- [x] **Phase 99: Diagnostic-to-Guide Pipeline** - Wire 500+ v0.9.7 diagnostic recommendations into site guide files as autopilot strategy hints (completed 2026-03-22)
- [x] **Phase 100: Procedural Memory** - Extract successful action sequences from Task memories and inject as recommended approaches for matching tasks (completed 2026-03-23)
- [x] **Phase 101: Memory Intelligence** - Auto-consolidation triggers, cross-domain strategy transfer, domain-change refresh, and dead code cleanup (completed 2026-03-23)
- [x] **Phase 102: Robustness Hardening** - Coordinate validation, bidirectional stuck recovery, progressive prompt trimming, and CLI parse retry (completed 2026-03-23)
- [x] **Phase 103: Validation** - Test autopilot against v0.9.7 edge cases and measure CLI parse failure rate and completion accuracy (completed 2026-03-23)
- [ ] **Phase 104: Verification Mechanics Fix** - Fix action verification for CDP tools, completion detection on dynamic pages, and session lifecycle cleanup

## Phase Details

### Phase 97: Tool Parity
**Goal**: Autopilot has identical tool access to MCP manual mode -- all 7 new CDP tools are documented, parseable, and validated
**Depends on**: Nothing (first phase of v0.9.8)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):
  1. User issues a canvas task and autopilot emits clickat/scrollat/drag commands that the CLI parser recognizes and routes to correct FSB.tools functions
  2. User issues a drag-drop task and autopilot emits dragdrop with optional steps/holdMs/stepDelayMs parameters that execute successfully
  3. User issues a text selection task and autopilot emits selecttextrange that the parser routes to the correct content script function
  4. isValidTool returns true for all 7 new tool names (cdpClickAt, cdpClickAndHold, cdpDrag, cdpDragVariableSpeed, cdpScrollAt, selectTextRange, dropfile)
**Plans:** 2/2 plans complete
Plans:
- [x] 97-01-PLAN.md -- Add 7 tools to CLI_COMMAND_TABLE and isValidTool in ai-integration.js
- [x] 97-02-PLAN.md -- Add 7 verbs to COMMAND_REGISTRY and enhance dragdrop params in cli-parser.js

### Phase 98: Prompt Architecture
**Goal**: Autopilot AI receives tool-aware system prompts that guide it to choose the right interaction method for each task type
**Depends on**: Phase 97
**Requirements**: PROMPT-01, PROMPT-02
**Success Criteria** (what must be TRUE):
  1. System prompt presents tools grouped by interaction type (DOM element, CDP coordinate, text range, file upload) with explicit "when to use which" guidance
  2. Canvas/map tasks trigger CDP-prioritized prompt sections, form tasks trigger DOM-prioritized sections, and text tasks trigger selection-tool sections
  3. Autopilot selects CDP coordinate tools for canvas interactions and DOM tools for standard form interactions without human prompt intervention
**Plans:** 1/1 plans complete
Plans:
- [x] 98-01-PLAN.md -- Add TOOL SELECTION GUIDE, canvas task type detection, PRIORITY TOOLS injection, and sub-pattern hints

### Phase 99: Diagnostic-to-Guide Pipeline
**Goal**: The 500+ recommendations from v0.9.7 diagnostic reports are embedded in site guide files so autopilot can leverage real-world edge case intelligence
**Depends on**: Phase 98
**Requirements**: PROMPT-03
**Success Criteria** (what must be TRUE):
  1. Site guide files for sites tested in v0.9.7 contain strategy hints derived from diagnostic report recommendations
  2. When autopilot operates on a site with diagnostic-enriched guides, the strategy hints appear in the continuation prompt context
  3. Diagnostic recommendations are categorized by interaction type (canvas, drag, scroll, dark pattern) in the guide files
**Plans:** 3/3 plans complete
Plans:
- [x] 99-01-PLAN.md -- Enrich CANVAS + MICRO site guides (phases 47-66, 20 guides)
- [x] 99-02-PLAN.md -- Enrich SCROLL + CONTEXT site guides (phases 67-86, 19 guides)
- [x] 99-03-PLAN.md -- Enrich DARK pattern site guides (phases 87-96, 10 guides)

### Phase 100: Procedural Memory
**Goal**: Autopilot learns from past successes -- completed Task memories become replayable playbooks that inform future identical tasks
**Depends on**: Phase 97
**Requirements**: MEM-01, MEM-02
**Success Criteria** (what must be TRUE):
  1. After a successful automation session, the system extracts a procedural memory containing site, task type, and ordered action steps from the completed Task memory
  2. When autopilot starts a task matching a stored procedural memory (same site + similar task type), the known-good action sequence appears in the prompt as a recommended approach
  3. Procedural memories are stored persistently and survive browser restarts
**Plans:** 1/1 plans complete
Plans:
- [x] 100-01-PLAN.md -- Extract procedural memories from successful sessions and inject as RECOMMENDED APPROACH in autopilot prompts

### Phase 101: Memory Intelligence
**Goal**: Memory system operates autonomously -- consolidates itself, transfers strategies across domains, refreshes on navigation, and carries no dead weight
**Depends on**: Phase 100
**Requirements**: MEM-03, MEM-04, MEM-05, MEM-06
**Success Criteria** (what must be TRUE):
  1. Memory auto-consolidation fires after every 10 sessions or when count hits 80% capacity, with no manual user trigger required
  2. When autopilot encounters a site with no stored memories, it finds and injects relevant strategies from other domains with matching task type patterns
  3. When autopilot navigates across domain boundaries during a multi-site task, memory context refreshes to include memories relevant to the new domain
  4. No dead episodic memory schemas, consolidator references, or unused code paths remain in the codebase
**Plans:** 2/2 plans complete
Plans:
- [x] 101-01-PLAN.md -- Auto-consolidation triggers in background.js and dead episodic code cleanup (MEM-03, MEM-06)
- [x] 101-02-PLAN.md -- Cross-domain strategy transfer and domain-change memory refresh in ai-integration.js (MEM-04, MEM-05)

### Phase 102: Robustness Hardening
**Goal**: Autopilot handles edge cases gracefully -- bad coordinates rejected before execution, stuck detection adapts to tool type, heavy pages don't timeout, and CLI parse failures self-correct
**Depends on**: Phase 97
**Requirements**: ROBUST-01, ROBUST-02, ROBUST-03, ROBUST-04
**Success Criteria** (what must be TRUE):
  1. CDP tool calls with out-of-viewport coordinates are rejected before execution with a descriptive error message including viewport dimensions
  2. When autopilot gets stuck using coordinate-based tools, stuck recovery suggests DOM fallback (and vice versa for DOM failures suggesting coordinate approach)
  3. On heavy DOM pages that would exceed context limits, prompt trimming reduces context in stages (examples first, then element count, then memory) without aborting
  4. When CLI parser fails to parse AI output, the system automatically retries with a simplified prompt hint instead of aborting the action batch
**Plans:** 2/2 plans complete
Plans:
- [x] 102-01-PLAN.md -- Viewport bounds validation for CDP tools and bidirectional stuck recovery (ROBUST-01, ROBUST-02)
- [x] 102-02-PLAN.md -- Progressive prompt trimming and CLI parse failure retry with simplified hint (ROBUST-03, ROBUST-04)

### Phase 103: Validation
**Goal**: Autopilot performs at or near MCP manual mode quality on the same edge cases, with measurable parse reliability and completion accuracy
**Depends on**: Phase 98, Phase 99, Phase 100, Phase 101, Phase 102
**Requirements**: VALID-01, VALID-02, VALID-03, VALID-04
**Success Criteria** (what must be TRUE):
  1. All 50 v0.9.7 edge case prompts (CANVAS-01 through DARK-10) executed through autopilot mode with documented pass/fail outcomes
  2. 90%+ pass rate achieved (45/50 minimum) -- this is the milestone gate
  3. CLI parse failure rate below 5% across all 50 test runs
  4. Completion validation correctly identifies task done/not-done with 90%+ accuracy across all 50 runs
**Plans:** 1/1 plans complete
Plans:
- [x] 103-01-PLAN.md -- Build test harness: extract 50 prompts from diagnostics, adapt for autopilot, generate VALIDATION-RUNNER.md with tracking and metrics

## Progress

**Execution Order:** 97 -> 98 -> 99 -> 100 -> 101 -> 102 -> 103 -> 104

Note: Phases 100-101 (Memory) and Phases 98-99 (Prompt) can proceed in parallel after Phase 97.
Phase 102 (Robustness) can proceed after Phase 97.
Phase 103 (Validation) requires all other phases complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 97. Tool Parity | 2/2 | Complete    | 2026-03-22 |
| 98. Prompt Architecture | 1/1 | Complete    | 2026-03-22 |
| 99. Diagnostic-to-Guide Pipeline | 3/3 | Complete    | 2026-03-22 |
| 100. Procedural Memory | 1/1 | Complete    | 2026-03-23 |
| 101. Memory Intelligence | 2/2 | Complete    | 2026-03-23 |
| 102. Robustness Hardening | 2/2 | Complete    | 2026-03-23 |
| 103. Validation | 1/1 | Complete    | 2026-03-23 |
| 104. Verification Mechanics Fix | 1/2 | In Progress|  |

### Phase 104: Verification Mechanics Fix
**Goal**: Autopilot action verification and completion detection work correctly for CDP coordinate tools, canvas interactions, and dynamic pages -- enabling 90%+ pass rate on the 50 edge case validation tests
**Depends on**: Phase 103
**Requirements**: VMFIX-01, VMFIX-02, VMFIX-03
**Success Criteria** (what must be TRUE):
  1. CDP coordinate tool calls (cdpClickAt, cdpDrag, cdpScrollAt) report success=true when the CDP dispatch completes without error, regardless of DOM mutation detection
  2. Completion validator declares "done" within 2 iterations of the AI emitting a done/fail command, even on pages with continuous DOM changes
  3. Stale autopilot sessions auto-expire after 5 minutes of no AI iteration, freeing the tab for new tasks
**Plans:** 1/2 plans executed
Plans:
- [ ] 104-01-PLAN.md -- Route CDP tools directly in background automation loop, bypassing broken content-to-background message round-trip (VMFIX-01)
- [x] 104-02-PLAN.md -- Dynamic-page completion fast-path and running-session inactivity timeout (VMFIX-02, VMFIX-03)
