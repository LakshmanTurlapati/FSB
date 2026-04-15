---
gsd_state_version: 1.0
milestone: v0.9.29
milestone_name: Showcase Angular Migration
status: idle
stopped_at: Milestone v0.9.29 archived (Phase 173 delivered; 174-177 deferred)
last_updated: "2026-04-15T14:01:42Z"
last_activity: 2026-04-15
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 7
  completed_plans: 7
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-15)

**Core value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely
**Current focus:** Milestone closeout complete; awaiting next milestone planning

## Current Position

Milestone: none active (v0.9.29 archived with accepted gaps)
Phase: -
Plan: -
Status: Ready for next milestone definition
Last activity: 2026-04-15

Progress: Milestone closed with partial scope acceptance (1/5 planned phases delivered).

## Performance Metrics

**Recent Trend (from v0.9.27):**

- Last 5 plans: stable execution, mostly sub-10min with occasional deeper verification runs
- Trend: Stable

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 171 | P01 | 1h 33m | 2 tasks | 4 files |
| 172 | P01 | 0 min | 1 task | 1 file |
| Phase 173 P01 | 4 min | 2 tasks | 26 files |
| Phase 173 P06 | 3 min | 2 tasks | 4 files |
| Phase 173 P02 | 4 min | 2 tasks | 11 files |
| Phase 173-showcase-shell-routes-theme-parity P03 | 4 min | 2 tasks | 5 files |
| Phase 173 P07 | 4 min | 2 tasks | 3 files |
| Phase 173 P04 | 10 min | 2 tasks | 15 files |
| Phase 173 P05 | 2 min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.9.29]: Do not reset numbering; roadmap continues from Phase 172 and starts this milestone at Phase 173.
- [v0.9.29]: Roadmap scope is only current milestone requirements (`SHOW-01` through `MIGR-03`).
- [v0.9.29]: Contract parity and migration regression confidence are explicit final-phase outcomes, not assumed side effects.
- [Phase 173]: Use Angular CLI standalone scaffold with routing/SCSS defaults to establish deterministic workspace contracts.
- [Phase 173]: Fix build output to showcase/dist/showcase-angular/browser and enforce root npm --prefix showcase/angular script delegation.
- [Phase 173]: Kept privacy/support Angular route scaffolds minimal and compile-safe to preserve downstream full-content migration flexibility.
- [Phase 173]: Keep clean canonical routes (/ /about /dashboard /privacy /support) with wildcard fallback to home.
- [Phase 173]: Preserve theme parity with pre-bootstrap fsb-showcase-theme read and runtime light-only storage semantics.
- [Phase 173-showcase-shell-routes-theme-parity]: Port route body sections directly from legacy HTML to preserve parity anchors without legacy scripts.
- [Phase 173-showcase-shell-routes-theme-parity]: Normalize home provider/logo references to absolute /assets/... paths for canonical route asset parity.
- [Phase 173-showcase-shell-routes-theme-parity]: Preserve dashboard dash-* DOM IDs exactly for downstream runtime wiring compatibility.
- [Phase 173]: Extracted legacy privacy/support route-body blocks directly to preserve anchor parity while avoiding script carryover.
- [Phase 173]: Consolidated five-route parity assertions into one Node source-contract test to reduce split-plan regression gaps.
- [Phase 173]: Locked dashboard parity checks to runtime-critical dash-* IDs and /assets provider paths.
- [Phase 173]: Kept styles.scss limited to shared tokens/foundation utilities while moving page visuals into route component styles.
- [Phase 173]: Migrated recreations.css into about-page.component.scss because about route parity depends on replay-frame styling.
- [Phase 173]: Raised Angular anyComponentStyle budget to unblock compile-safe migration of legacy route CSS into component scope.
- [Phase 173]: Resolved showcase static root via explicit allowlist priority with fs.existsSync
- [Phase 173]: Locked legacy html compatibility to fixed 301 redirect map toward canonical clean routes
- [Phase 173]: Aggregated foundation, content, and server contracts under test:showcase-shell and appended to root test chain

### Pending Todos

- Define next milestone scope and promote deferred Angular migration requirements (`DASH-08` through `MIGR-03`) as needed.

### Blockers/Concerns

- Final local rerun of the off-screen dashboard refresh smoke (accepted debt from v0.9.27) remains a pre-release reminder for dashboard analytics dependent releases.
- No active blockers for next-milestone planning.

## Session Continuity

Last session: 2026-04-15T14:01:42Z
Stopped at: Milestone v0.9.29 closeout and legacy vanilla archive
Resume file: .planning/ROADMAP.md
