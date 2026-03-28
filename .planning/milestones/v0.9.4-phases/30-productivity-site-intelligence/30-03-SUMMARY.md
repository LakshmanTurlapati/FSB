---
phase: 30-productivity-site-intelligence
plan: 03
subsystem: site-intelligence
tags: [trello, google-calendar, drag-and-drop, site-guides, fsbElements, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 30-01
    provides: Generalized fsbElements injection pipeline and registerSiteGuide infrastructure
provides:
  - Trello site guide with data-testid-first selectors, card CRUD workflows, Move button alternative
  - Google Calendar site guide with shortcut opt-in prerequisite, event CRUD, view switching
  - dragdrop mechanical tool with 3-method fallback (HTML5, PointerEvent, MouseEvent)
affects: [30-04, 30-05, 30-06, 30-07]

# Tech tracking
tech-stack:
  added: [DragEvent API, PointerEvent API, DataTransfer API]
  patterns: [multi-method fallback with DOM change detection, data-testid-first selector strategy for Atlassian apps, shortcut opt-in prerequisite workflow pattern]

key-files:
  created:
    - site-guides/productivity/trello.js
    - site-guides/productivity/google-calendar.js
  modified:
    - content/actions.js
    - ai/cli-parser.js

key-decisions:
  - "Trello uses data-testid as primary selector strategy (Atlassian pattern) over aria/role"
  - "Calendar guide enableShortcuts is first workflow since shortcuts are off by default"
  - "dragdrop tool tries 3 methods sequentially with DOM snapshot diffing to detect success"
  - "dragdrop registered as CLI command with simple sourceRef/targetRef args"

patterns-established:
  - "data-testid-first selectors: Atlassian apps (Trello, Jira) use data-testid as most stable selector"
  - "Shortcut opt-in prerequisite: apps with disabled-by-default shortcuts get enableShortcuts as first workflow"
  - "Multi-method mechanical tool: try multiple event dispatch strategies with DOM change verification"

requirements-completed: [TREL-01, TREL-02, GCAL-01, GCAL-02]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 30 Plan 03: Trello + Calendar Guides + Drag-and-Drop Tool Summary

**Trello and Google Calendar site guides with 18 fsbElements each, plus a 3-method dragdrop mechanical tool in actions.js**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T08:58:33Z
- **Completed:** 2026-03-16T09:03:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Trello site guide (396 lines) with data-testid-first selectors, 18 fsbElements, 8 workflows including Move button as keyboard-first drag alternative
- Google Calendar site guide (399 lines) with enableShortcuts as first prerequisite workflow, 18 fsbElements, 8 workflows covering event CRUD, navigation, view switching, RSVP
- dragdrop mechanical tool implementing HTML5 DragEvent, PointerEvent sequence, and MouseEvent sequence with DOM snapshot-based change detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Trello and Google Calendar site guides** - `f5511b8` (feat)
2. **Task 2: Build drag-and-drop mechanical tool in actions.js** - `b53e75d` (feat)

## Files Created/Modified
- `site-guides/productivity/trello.js` - Full Trello site guide: board/card/list management with keyboard-first workflows
- `site-guides/productivity/google-calendar.js` - Full Google Calendar site guide: event CRUD, date nav, view switching with shortcut opt-in
- `content/actions.js` - Added dragdrop tool with 3-method fallback chain and DOM change verification
- `ai/cli-parser.js` - Registered dragdrop CLI command with sourceRef/targetRef args

## Decisions Made
- Trello uses data-testid as primary selector strategy following Atlassian convention
- Calendar guide's enableShortcuts is first workflow since shortcuts are disabled by default
- dragdrop tool uses DOM snapshot diffing (parent child counts, element index, DOM presence) to detect whether a drag actually moved an element
- dragdrop registered as simple `dragdrop e5 e12` CLI command matching fillsheet/readsheet pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Trello and Calendar guides ready for service worker importScripts and options.html registration (handled in a later plan)
- dragdrop tool available for any site guide to reference in workflows
- Pattern established for remaining medium/complex app guides (Notion, Airtable, Jira)

---
*Phase: 30-productivity-site-intelligence*
*Completed: 2026-03-16*
