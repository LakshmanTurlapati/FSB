# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.9.7 -- MCP Edge Case Validation

**Shipped:** 2026-03-22
**Phases:** 50 | **Plans:** 100 | **Tasks:** 183

### What Was Built
- 50 edge case prompts tested via MCP manual mode across 5 categories (canvas, micro-interaction, scroll, context bloat, dark patterns)
- 6 new CDP tools: scroll_at, click_and_hold, drag_drop, select_text_range, drop_file, drag_variable_speed
- 30+ site guides with real-world selectors, workflows, and automation intelligence
- 50 autopilot diagnostic reports with 500+ recommendations catalogued
- 2 PASS, 46 PARTIAL, 2 SKIP-AUTH outcomes

### What Worked
- Autonomous execution: 50 phases completed in ~3 days with minimal human intervention
- Two-plan-per-phase pattern (01: tooling/site guide, 02: test/diagnostic) kept phases focused and parallelizable
- Smart discuss with --auto flag eliminated interactive questioning overhead for 50 repetitive phases
- Site guide creation captured real-world DOM knowledge that will feed autopilot refinement
- Diagnostic report format (what worked, what failed, tool gaps, autopilot recommendations) created a clear evidence base for v0.9.8

### What Was Inefficient
- WebSocket bridge disconnect persisted from Phase 55 onward, causing 46/50 PARTIAL outcomes -- should have been diagnosed and fixed early
- Verifier agent was skipped for 43 phases to maintain execution speed -- created tech debt of missing VERIFICATION.md files
- HTTP-only validation insufficient for client-rendered SPAs (TikTok, X/Twitter, Observable) -- resulted in "selectors untestable" findings
- Each diagnostic report followed the same template with mostly identical boilerplate (WebSocket blocker section) -- could have been templatized

### Patterns Established
- Edge case validation pattern: site guide + diagnostic report per prompt
- CDP tool creation pattern: manual.ts (MCP) + actions.js (content) + background.js (relay)
- Elimination-based heuristics for dark patterns (ad detection, button classification, checkbox scanning)
- Text/semantic-based identification over positional/visual for randomized UI elements

### Key Lessons
1. MCP tools and autopilot tools diverged -- new tools added to MCP but not to autopilot's CLI_COMMAND_TABLE. Must keep both in sync.
2. WebSocket bridge is a single point of failure for live testing. Needs health check and auto-reconnect.
3. PARTIAL outcomes provide value (tooling validated, strategies documented) even without full live execution.
4. Site guides are the bridge between MCP intelligence and autopilot capability -- they encode what the AI learned.
5. 50 phases in 3 days is sustainable with autonomous execution, but quality gates (verification) shouldn't be skipped.

### Cost Observations
- Model mix: quality profile (opus-heavy for planning, sonnet for execution)
- Sessions: ~331 commits across 3 days
- Notable: Two-plan structure kept individual plan execution fast despite 100 total plans

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.9 | 11 | 24 | Foundation -- reliability engineering |
| v9.0.2 | 10 | 21 | AI perception + context quality |
| v9.3 | 5 | 17 | Modularization + tech debt |
| v9.4 | 9 | 18 | Career search workflows |
| v10.0 | 15 | 37 | CLI architecture rewrite |
| v0.9.2-4 | 6 | 17 | Productivity + memory + AI quality |
| v0.9.5 | 4 | 8 | Progress overlay intelligence |
| v0.9.6 | 7 | - | Agents + remote control |
| v0.9.7 | 50 | 100 | Autonomous edge case validation at scale |

### Top Lessons (Verified Across Milestones)

1. Keep autopilot and MCP tool registries in sync -- divergence causes capability gaps (v0.9.7)
2. Site guides encode automation intelligence that survives across sessions and modes (v9.3, v9.4, v0.9.7)
3. Two-plan phase structure scales well from 4 phases to 50 phases (v0.9.5, v0.9.7)
4. Autonomous execution at scale works but needs quality gates that don't get skipped (v0.9.7)
5. DOM-based identification beats position/visual for resilient automation (v0.9, v10.0, v0.9.7)
