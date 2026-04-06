---
gsd_state_version: 1.0
milestone: v0.9.25
milestone_name: MCP & Dashboard Reliability Closure
status: active
stopped_at: Completed Phase 163 execution; Phase 164 ready to start
last_updated: "2026-04-06T00:54:42Z"
last_activity: 2026-04-06
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 2
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely
**Current focus:** v0.9.25 MCP & Dashboard Reliability Closure — Phase 163 complete, Phase 164 is next

## Current Position

Milestone: v0.9.25 (MCP & Dashboard Reliability Closure)
Phase: 164
Plan: 2 of 9 complete
Status: Phase 163 complete; ready to start Phase 164
Last activity: 2026-04-06

Progress: [##--------] 20%

## Performance Metrics

**Recent Trend (from v0.9.24 close-out):**

- Last 5 plans: 2min, 2min, 3min, 4min, 3min
- Trend: Stable

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 148 | P01 | 2min | 2 | 3 |
| 149 | P01 | 2min | 2 | 1 |
| 150 | P01 | 3min | 3 | 4 |
| 150 | P02 | 4min | 2 | 3 |
| Phase 156 P01 | 3min | 2 tasks | 2 files |
| Phase Phase 156 PP02 | 3min | 3 tasks tasks | 3 files files |
| Phase 157 P02 | 1min | 1 tasks | 1 files |
| Phase 157 P01 | 2min | 2 tasks | 2 files |
| Phase 158 PP01 | 2min | 2 tasks | 1 files |
| Phase 158 P02 | 1min | 2 tasks | 3 files |
| Phase 159 PP01 | 7min | 2 tasks | 1 files |
| Phase 159 PP02 | 3min | 2 tasks | 1 files |
| Phase 159 P03 | 1min | 2 tasks | 2 files |
| Phase 163 P01 | 8min | 2 tasks | 1 files |
| Phase 162.2 P01 | 3min | 2 tasks | 5 files |
| Phase 162.2 P02 | 1min | 2 tasks | 3 files |
| Phase 163 P02 | 2min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 163]: Restricted tabs now keep browser-safe MCP controls in the background, and only blank/new-tab pages advertise `run_task` as smart-start recovery.
- [v0.9.25]: Close operator-facing reliability gaps before broader feature work -- restricted-tab MCP parity, dashboard reliability closeout, and v0.9.24 carryover verification debt take priority.
- [v0.9.25]: Continue numbering from Phase 162.3 and re-scope deferred dashboard reliability goals under fresh phases 163-167 instead of reviving the 151-155 sequence.
- [v0.9.24]: Adopt 6 Claude Code patterns (Tool Pool, Permission Context, Transcript Store, Hook Pipeline, Session Store, Cost Tracker); reject 6 (Command Graph, Skill System, Query Engine, Coordinator, Bootstrap Graph formal stage, Route Matching)
- [v0.9.24]: 40% direct translation, 30% heavy adaptation for MV3, 30% explicitly rejected
- [v0.9.24]: Extract-don't-rewrite principle -- 17 new files, 3 modified files, 0 deleted files
- [v0.9.24]: Preserve setTimeout-chaining in agent loop -- do NOT convert to synchronous or async/await iteration
- [v0.9.24]: Origin-aware permission rules (Chrome match patterns) not path-based prefixes
- [Phase 156]: 57 session fields with 4 hot-tier (transient) and 53 warm-tier (persisted), messages trimmed to last 20 in getWarmFields()
- [Phase 156]: SessionStateEmitter uses prototype methods (not class syntax) for importScripts compatibility
- [Phase Phase 156]: TranscriptStore uses function/prototype pattern for importScripts compatibility, preserves FSB token-budget-aware compaction
- [Phase Phase 156]: TurnResult as factory function (not class) with 7 STOP_REASONS; ActionHistory with queryable event store
- [Phase 157]: D-01: No tool pool module -- getPublicTools() stays inline in agent-loop.js, all 42 tools sent every call
- [Phase 157]: D-02/D-03: PermissionContext stub with isAllowed always true; future deny-list via chrome.storage.local with Chrome match patterns
- [Phase 157]: Pure extraction of MODEL_PRICING/estimateCost into ai/cost-tracker.js; SESSION_DEFAULTS centralizes 9 constants; 4 EXECUTION_MODES formalized in ai/engine-config.js
- [Phase 158]: HookPipeline uses arrays (not Sets) for handler storage -- preserves registration order per D-01; async emit with try/catch error isolation per D-05; only shouldStop:true halts pipeline
- [Phase 158]: 4 separate progress hook factories (tool/iteration/completion/error) instead of 1 multi-event handler for cleaner Phase 159 registration
- [Phase 159]: Keep checkSafetyBreakers/detectStuck in agent-loop.js as local functions, hook factories receive via closure; TranscriptStore used per-iteration not persisted; onError hook emitted once at catch top; broadcastDashboardProgress kept for dashboard WS compat
- [Phase 159]: 6 runAgentLoop call sites wired with createSessionHooks factory; D-03 auto-resumption validates tab existence before calling runAgentLoop on SW restart
- [Phase 159]: Dual BEFORE_ITERATION + AFTER_ITERATION safety hook registration; null-hooks fallback for backward compatibility
- [Phase 162.3]: Canonical overlay state remains background-owned; reconnect recovery replays cached `sendSessionStatus` payloads instead of introducing a second UI-only overlay model
- [Phase 162.3]: Long-wait overlay reliability uses heartbeat refresh plus degraded waiting watchdog state while dashboard preview continues to consume `ext:dom-overlay`
- [Phase 162.1]: Partial completion must be a first-class terminal lifecycle distinct from error, and existing user-stop partial semantics must not be conflated with blocked useful completion
- [Phase 162.2]: Shared AUTH REQUIRED and SKIP-AUTH guide wording now implies preserved completed work, exact blocker, and manual next step rather than crash framing.
- [Phase 162.2]: Auth-wall blockers now terminate via partial_task with a stable blocker taxonomy once useful work is complete.
- [Phase 162.2]: Auth-flavored partial_task now triggers one inline background auth-resolution cycle before terminal partial handoff
- [Phase 162.2]: Same-session auth resume now appends an explicit resume boundary in the running loop while sidepanel no-ack cases fall straight to preserved partial outcome copy

### Roadmap Evolution

- v0.9.25 MCP & Dashboard Reliability Closure roadmap created 2026-04-05 (5 phases, 163-167, 11 requirements)
- Phase 163 Restricted-Tab MCP Parity completed on 2026-04-06 (2/2 plans complete)
- v0.9.23 deferred dashboard reliability goals re-scoped into v0.9.25 instead of reviving phases 151-155 directly
- v0.9.24 Claude Code Architecture Adaptation roadmap created 2026-04-02 (5 phases, 156-160, 19 requirements)
- v0.9.23 Phase 155 executed retroactively on 2026-04-02 (2/2 plans complete) while v0.9.24 remained the active milestone
- v0.9.23 Phases 151-155 deferred
- v0.9.22 Showcase High-Fidelity Replicas superseded after Phase 145
- Phase 162.1 inserted after Phase 162: Partial Completion Lifecycle for auth-blocked tasks (URGENT)
- Phase 162.2 inserted after Phase 162: Auth Wall Handoff with Result Preservation (URGENT)
- Phase 162.3 inserted after Phase 162: Overlay Lifecycle Reliability for mid-run glow/debugger overlay disappearance (URGENT)
- v0.9.24 archived and marked complete on 2026-04-05

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general)

### Blockers/Concerns

- No blockers recorded at milestone start.
- Phase 165 and Phase 167 require a real browser-backed extension and relay environment for live verification.
- Accepted debt carried forward from v0.9.24 now lives inside Phase 166 and Phase 167 instead of remaining as unowned follow-up.

## Session Continuity

Last session: 2026-04-06T00:54:42Z
Stopped at: Completed Phase 163 execution; Phase 164 ready to start
Resume file: None
Companion debug note: .planning/debug/overlay-lifecycle-rehydration-gap.md
