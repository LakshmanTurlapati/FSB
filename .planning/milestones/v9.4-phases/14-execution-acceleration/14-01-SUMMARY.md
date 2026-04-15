---
phase: 14-execution-acceleration
plan: 01
subsystem: ai
tags: [intl, timezone, locale, prompt-engineering, browser-apis]

# Dependency graph
requires:
  - phase: 13-google-sheets-formatting
    provides: stable automation engine and AI prompt system
provides:
  - TIMEZONE_TO_COUNTRY static map (85 IANA timezone entries) in background.js
  - getUserLocale() function returning timezone, country, localDateTime, promptString
  - USER LOCALE section in every AI system prompt
  - Career prompt location defaulting to user's detected country
affects: [14-02-PLAN, career-search, ai-prompts]

# Tech tracking
tech-stack:
  added: []
  patterns: [locale-context-injection, session-scoped-detection]

key-files:
  created: []
  modified:
    - background.js
    - ai/ai-integration.js

key-decisions:
  - "85-entry static TIMEZONE_TO_COUNTRY map covers all major IANA timezones -- no npm dependency needed"
  - "getUserLocale() called once at session start, cached on session object for all iterations"
  - "USER LOCALE section injected into ALL task types, not just career searches"
  - "Optional chaining (context?.userLocale?.promptString) ensures backward compatibility"

patterns-established:
  - "Session-scoped locale detection: detect once at session start, reuse for all AI calls"
  - "Graceful degradation: non-IANA timezone returns 'Unknown' country without breaking"

requirements-completed: [ACCEL-03, ACCEL-04]

# Metrics
duration: 3.5min
completed: 2026-02-24
---

# Phase 14 Plan 01: Locale Detection and AI Prompt Injection Summary

**Timezone/country detection via Intl.DateTimeFormat with 85-entry IANA lookup map, injected into every AI system prompt for location-aware decisions and career search country defaulting**

## Performance

- **Duration:** 3.5 min
- **Started:** 2026-02-24T21:47:28Z
- **Completed:** 2026-02-24T21:51:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added TIMEZONE_TO_COUNTRY static map with 85 entries covering Americas, Europe, Asia, Oceania, and Africa
- Implemented getUserLocale() with IANA format validation (macOS Sonoma bug mitigation) and graceful fallback
- Injected USER LOCALE section into every AI system prompt with timezone, country, and local datetime
- Career prompts now instruct the AI to default to the user's detected country when no location is specified

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TIMEZONE_TO_COUNTRY map and getUserLocale() to background.js** - `ed7e188` (feat)
2. **Task 2: Inject locale context into AI system prompt and add career location default** - `8a0c034` (feat)

## Files Created/Modified
- `background.js` - Added TIMEZONE_TO_COUNTRY map (85 entries), getUserLocale() function, session locale storage, context passing
- `ai/ai-integration.js` - Added USER LOCALE section in buildPrompt(), career location defaulting in Phase 2 prompt

## Decisions Made
- Static 85-entry lookup map (no npm package) -- IANA timezone names map deterministically to countries
- getUserLocale() called at session creation, stored on session object -- avoids repeated detection
- USER LOCALE section placed after task type and before AVAILABLE TOOLS in the full system prompt
- Optional chaining throughout for backward compatibility with code paths that don't pass locale
- Career prompt gets both universal locale context AND explicit Phase 2 location filtering instruction

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None -- no external service configuration required. Locale detection is fully automatic via browser APIs.

## Next Phase Readiness
- Locale context now available for all AI decisions across all task types
- Career searches will default to user's country when no location specified
- Ready for 14-02 (batch action execution engine with DOM-based completion detection)

## Self-Check: PASSED

- FOUND: 14-01-SUMMARY.md
- FOUND: ed7e188 (Task 1 commit)
- FOUND: 8a0c034 (Task 2 commit)

---
*Phase: 14-execution-acceleration*
*Completed: 2026-02-24*
