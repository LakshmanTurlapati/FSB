---
phase: 145-fresh-ui-audit-token-baseline
plan: 01
subsystem: ui
tags: [css, design-tokens, audit, recreations, showcase]

# Dependency graph
requires: []
provides:
  - "Complete token audit of fsb-ui-core.css, sidepanel.css, options.css"
  - "Corrected rec- CSS variables matching real extension values"
  - "Structural HTML gap analysis for sidepanel and dashboard recreations"
affects: [146-sidepanel-replica, 147-control-panel-replica]

# Tech tracking
tech-stack:
  added: []
  patterns: ["rec- CSS namespace token isolation for showcase replicas"]

key-files:
  created:
    - ".planning/phases/145-fresh-ui-audit-token-baseline/145-TOKENS.md"
  modified:
    - "showcase/css/recreations.css"

key-decisions:
  - "Light-mode --rec-msg-system-bg set to #faf7f4 (color-mix approximation of fsb-surface-muted 84% + white 16%)"
  - "Browser chrome variables (frame-bg, topbar-bg, address-bg) left unchanged -- no real extension counterpart"
  - "Dark-mode --rec-input-bg uses warm rgba(255, 241, 232, 0.04) matching fsb border-subtle base color"

patterns-established:
  - "Phase 145 audit comment marks synced variable blocks in recreations.css"

requirements-completed: [AUD-01]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 145 Plan 01: Token Audit & Stale Variable Fix Summary

**Comprehensive CSS token audit across 3 extension files, 48+ stale rec- variables corrected to match real extension palette, 12 structural HTML gaps documented for replica phases**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T08:12:21Z
- **Completed:** 2026-04-02T08:16:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Produced 145-TOKENS.md with 5 sections: base tokens, sidepanel tokens, dashboard tokens, rec- comparison table, structural gap analysis
- Identified and corrected 48+ stale rec- variables across both dark and light themes in recreations.css
- Documented 12 critical structural HTML gaps (missing sidebar items, icons, footer, mic button, cost-breakdown section) for Phases 146-147

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit real extension CSS and produce 145-TOKENS.md** - `fb672f5` (docs)
2. **Task 2: Fix stale rec- CSS variables in recreations.css** - `a090388` (fix)

## Files Created/Modified
- `.planning/phases/145-fresh-ui-audit-token-baseline/145-TOKENS.md` - Complete token reference with 5 sections covering all extension CSS tokens and structural gaps
- `showcase/css/recreations.css` - Dark and light theme variable blocks updated to match real extension values

## Decisions Made
- Approximated color-mix() formula outputs as flat hex values for rec- variables since showcase does not import fsb-ui-core.css
- Left --rec-frame-bg, --rec-topbar-bg, --rec-address-bg unchanged because they represent browser chrome, not extension UI
- Used warm-tint rgba base (255, 241, 232) for dark-mode border/input tokens to match fsb-ui-core warm palette

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 145-TOKENS.md serves as the single source of truth for Phase 146 (sidepanel replica) and Phase 147 (dashboard replica)
- All rec- variables now accurately reflect the current FSB UI for both dark and light themes
- Structural gap analysis provides exact list of elements to add/fix in recreation HTML

---
*Phase: 145-fresh-ui-audit-token-baseline*
*Completed: 2026-04-02*
