---
phase: 86-session-expiry-re-auth
plan: 01
subsystem: site-guides
tags: [session-expiry, re-auth, context-bloat, mcp, herokuapp]

# Dependency graph
requires:
  - phase: 83-2fa-multi-tab-auth-flow
    provides: "Utilities site guide category structure and two-factor-auth.js pattern"
provides:
  - "session-expiry.js site guide with handleSessionExpiry workflow for detecting session expiry, re-authenticating, and resuming tasks"
  - "CONTEXT-10 context bloat mitigation guidance for session re-auth interruptions"
  - "4 session expiry detection patterns: modal/dialog, login redirect, inline banner, HTTP 401/403"
affects: [86-02-live-mcp-test]

# Tech tracking
tech-stack:
  added: []
  patterns: ["compact task state snapshot under 500 chars for session re-auth interruptions", "simulate session expiry via logout for testing re-auth flow"]

key-files:
  created: [site-guides/utilities/session-expiry.js]
  modified: [background.js]

key-decisions:
  - "the-internet.herokuapp.com as primary target with simulated session expiry via /logout path"
  - "4 detection patterns documented: modal/dialog overlay, login page redirect, inline banner/toast, HTTP 401/403 response"
  - "Compact task state snapshot under 500 chars: taskGoal, lastUrl, lastAction, lastResult (truncated to 100 chars)"

patterns-established:
  - "Session expiry simulation: login -> task -> logout -> detect redirect -> re-auth -> resume and verify"
  - "Context bloat mitigation: discard all DOM snapshots before re-auth, retain only 4-field compact state"

requirements-completed: [CONTEXT-10]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 86 Plan 01: Session Expiry Re-Auth Site Guide Summary

**Session expiry site guide with 14-step handleSessionExpiry workflow, 4 detection patterns, and CONTEXT-10 context bloat mitigation via compact task state under 500 chars**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T08:08:56Z
- **Completed:** 2026-03-22T08:11:24Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created session-expiry.js with registerSiteGuide call including patterns, guidance, selectors, workflows, warnings, and toolPreferences
- Documented 14-step handleSessionExpiry workflow covering full detect-reauth-resume cycle with the-internet.herokuapp.com
- Documented 4 session expiry detection patterns: modal/dialog overlay, login page redirect, inline banner/toast, HTTP 401/403 response
- CONTEXT-10 context bloat mitigation: compact task state snapshot under 500 characters preserving only taskGoal, lastUrl, lastAction, lastResult
- 5 demo targets with selectors: herokuapp (primary + secondary), practiceautomation, uitestingplayground, demoqa (fallbacks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create session-expiry.js site guide with handleSessionExpiry workflow and CONTEXT-10 guidance** - `8797dec` (feat)

## Files Created/Modified
- `site-guides/utilities/session-expiry.js` - Session expiry re-auth site guide with handleSessionExpiry workflow, 4 detection patterns, compact state preservation, 5 demo targets with selectors
- `background.js` - Added importScripts entry for session-expiry.js in Utilities section after two-factor-auth.js

## Decisions Made
- the-internet.herokuapp.com selected as primary target: free, stable, known test credentials (tomsmith/SuperSecretPassword!), session can be simulated via /logout
- 4 session expiry detection patterns documented in priority order: URL check first (fastest), then DOM for modal/dialog, then flash/alert messages, then page content for auth error text
- Compact task state snapshot (under 500 chars) retains only 4 fields: taskGoal, lastUrl, lastAction, lastResult truncated to 100 chars -- all DOM snapshots discarded before re-auth

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- session-expiry.js site guide is ready for Plan 02 live MCP test
- handleSessionExpiry workflow documents all 14 steps for the test to follow
- Selectors documented for herokuapp login form: #username, #password, button[type="submit"], #flash, .example

## Self-Check: PASSED
- site-guides/utilities/session-expiry.js: FOUND
- .planning/phases/86-session-expiry-re-auth/86-01-SUMMARY.md: FOUND
- Commit 8797dec: FOUND

---
*Phase: 86-session-expiry-re-auth*
*Completed: 2026-03-22*
