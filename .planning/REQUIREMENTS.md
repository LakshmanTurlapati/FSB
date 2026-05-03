# Requirements: v0.9.50 Autopilot Refinement (MCP-Parity)

**Goal:** Lift FSB autopilot's hit rate to match the precision external agents (Claude Desktop, OpenClaw, Codex) achieve via MCP, without regressing any existing functionality.

**Premise:** MCP tool annotations are well-tuned; external agents drive FSB with near-100% accuracy. FSB's own autopilot lags. Close the gap by auditing the autopilot tool layer against MCP's contracts and refining the prompting/context that drives tool selection.

**Constraints:**
- Branch-locked to `Refinements`
- No git push, no PRs until explicit user command
- Verification is operator-driven via MCP `run_task` + log inspection (not autonomous test harness)

---

## v0.9.50 Requirements

### AUDIT — Establish baseline gap

- [ ] **AUDIT-01**: Inventory of current autopilot tool surface (names, params, annotations, routing) vs MCP tool surface, with side-by-side comparison and gap list
- [ ] **AUDIT-02**: Captured baseline log run from MCP `run_task` against representative prompt set, with failure categorization (element, tool-choice, completion, other)

### TOOLS — Align autopilot tools with MCP contracts

- [ ] **TOOLS-01**: Autopilot tool definitions adopt MCP-style annotations (purpose, when-to-use, examples, parameter descriptions) where currently weaker
- [ ] **TOOLS-02**: Parameter shapes and defaults reconciled between autopilot and MCP for any tool present in both
- [x] **TOOLS-03**: Routing parity — autopilot can reach the same effective execution paths MCP exposes (CDP click_at, click_and_hold, drag, scroll_at, etc.) via its own tool layer
- [ ] **TOOLS-04**: Any autopilot-only tools justified or sunset; any MCP-only capabilities surfaced to autopilot if they close known gaps

### PROMPT — Tool selection and element targeting guidance

- [ ] **PROMPT-01**: Tool-selection guide in system prompt updated with explicit decision rules for click vs CDP click_at, type vs press_enter, scroll vs scroll_at, and other ambiguous pairs
- [ ] **PROMPT-02**: Element-targeting guidance strengthened to reduce wrong-element selection (parent/nested confusion, label/control disambiguation)
- [ ] **PROMPT-03**: Context formatting (DOM snapshot, element refs) audited for clarity that matches what MCP-driving agents see

### TARGET — Element precision

- [ ] **TARGET-01**: Selector/element-ref disambiguation pass — when multiple candidates match, autopilot picks the most specific interactive descendant
- [x] **TARGET-02**: Logged misclick patterns from baseline (AUDIT-02) addressed with targeted rule or context fix

### VERIFY — Operator verification loop

- [ ] **VERIFY-01**: Reproducible verification recipe documented — operator runs MCP `run_task` against fixed prompt set, inspects logs, scores outcome
- [ ] **VERIFY-02**: Logging surface sufficient to attribute every autopilot failure to a category (element, tool-choice, completion, infra) without code instrumentation per run

### GUARD — Zero regression (cross-cutting)

GUARD requirements are not assigned to a single phase — they are embedded as standing success criteria on every implementation phase (224, 225, 226, 227).

- [x] **GUARD-01**: Every existing autopilot capability listed in PROJECT.md "Validated" remains operational after refinement (smoke verification per phase)
- [x] **GUARD-02**: Existing tests (`npm test`) green at every commit
- [x] **GUARD-03**: No removal of autopilot tools without explicit deprecation note and operator confirmation

---

## Future Requirements

- Autonomous test-harness re-introduction (deferred — operator-driven this milestone)
- MCP visual-session auto-wrap for autopilot flows (carry-over from v0.9.36 deferred set)
- Loop / completion-detection refinement (secondary failure modes — defer unless surfaced by AUDIT-02)

## Out of Scope

- New AI provider integrations
- Site-guide content authoring (intelligence layer untouched)
- Dashboard / showcase / Sync surface changes
- MCP server capability changes (MCP is the reference, not the target)
- Branch merges, releases, or version bump beyond `v0.9.50` label

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 224 | Pending |
| AUDIT-02 | Phase 224 | Pending |
| VERIFY-01 | Phase 224 | Pending |
| VERIFY-02 | Phase 224 | Pending |
| TOOLS-01 | Phase 225 | Pending |
| TOOLS-02 | Phase 225 | Pending |
| TOOLS-03 | Phase 225 | Complete |
| TOOLS-04 | Phase 225 | Pending |
| PROMPT-01 | Phase 226 | Pending |
| PROMPT-02 | Phase 226 | Pending |
| PROMPT-03 | Phase 226 | Pending |
| TARGET-01 | Phase 227 | Pending |
| TARGET-02 | Phase 227 | Complete |
| GUARD-01 | Phases 224, 225, 226, 227 (cross-cutting success criterion) | Complete |
| GUARD-02 | Phases 224, 225, 226, 227 (cross-cutting success criterion) | Complete |
| GUARD-03 | Phases 224, 225, 226, 227 (cross-cutting success criterion) | Complete |

**Coverage:** 13/13 non-GUARD requirements mapped to exactly one phase. GUARD-01/02/03 embedded as standing success criteria on every implementation phase.
