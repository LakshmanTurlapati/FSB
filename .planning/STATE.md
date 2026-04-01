---
gsd_state_version: 1.0
milestone: v0.9.20
milestone_name: Autopilot Agent Architecture Rewrite
status: executing
stopped_at: Completed 138-01-PLAN.md
last_updated: "2026-04-01T10:16:03Z"
last_activity: 2026-04-01
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 7
  completed_plans: 4
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely
**Current focus:** v0.9.20 Autopilot Agent Architecture Rewrite -- Phase 138 Plan 01 complete

## Current Position

Phase: 138 (Context Management & On-Demand Tools)
Plan: 1 of 2 complete
Status: Executing
Last activity: 2026-04-01

Progress: [####------] 40%

## Performance Metrics

**Recent Trend (from v0.9.20):**

- Last 5 plans: 2min, 2min, 2min, 2min, 3min
- Trend: Stable

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 138 | 01 | 3min | 2 | 2 |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.9.11]: 8K default MCP char cap, 50K for autopilot; main content extracted first via 11 semantic selectors
- [v0.9.11]: Port-only reconnection on BF cache restore
- [v0.9.12]: Documentation-only milestone -- no functional changes to tools, only description/prompt/error text updates
- [v0.9.12]: 3 phases: tool descriptions (132), MCP prompts (133), error recovery hints (134)
- [136-01]: Routing layer only for tool executor -- CDP/data handlers injected via callbacks
- [136-01]: BF cache detection on content tool failures returns navigationTriggered=true
- [136-01]: get_dom_snapshot special-cased with mcp:get-dom message type (no _contentVerb)
- [Phase 137]: setTimeout-chaining pattern: each iteration ends with setTimeout(100ms) for Chrome MV3 SW survival
- [Phase 137]: Callback injection: runAgentLoop receives background.js functions as options to avoid tight coupling
- [138-01]: On-demand DOM snapshot replaces per-iteration auto-injection (D-01/D-03)
- [138-01]: 80% token budget threshold triggers sliding-window history compaction (D-07)
- [138-01]: Anthropic cache_control on system prompt and last tool definition (D-14)

### Roadmap Evolution

- v0.9.11 MCP Tool Quality shipped 2026-03-31
- v0.9.12 MCP Developer Experience milestone started 2026-03-31
- v0.9.20 Autopilot Agent Architecture Rewrite in progress (Phase 138)
- v0.9.9.1 Phantom Stream continues in parallel
- v0.9.8.1 npm Publishing continues in parallel

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-01T10:16:03Z
Stopped at: Completed 138-01-PLAN.md
Resume file: None
