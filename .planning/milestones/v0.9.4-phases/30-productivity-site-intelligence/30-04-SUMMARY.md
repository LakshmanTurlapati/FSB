---
phase: 30-productivity-site-intelligence
plan: 04
subsystem: site-guides
tags: [notion, jira, airtable, fsbElements, slash-commands, data-testid, aria-selectors, contenteditable]

# Dependency graph
requires:
  - phase: 30-01
    provides: Generic fsbElements injection pipeline, keyword routing, file registration
provides:
  - Notion site guide with slash command documentation, aria/role-first selectors, block editor workflows
  - Jira site guide with full create-issue form coverage, data-testid-first selectors, JQL reference
  - Airtable site guide with per-field-type interaction, aria/role-first selectors, view switching
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "aria/role-first selector strategy for React CSS Module apps (Notion, Airtable)"
    - "data-testid-first selector strategy for Atlassian apps (Jira)"
    - "Per-field-type interaction documentation for heterogeneous grid apps"
    - "Slash command reference as primary creation method for block editors"

key-files:
  created:
    - site-guides/productivity/notion.js
    - site-guides/productivity/jira.js
    - site-guides/productivity/airtable.js
  modified: []

key-decisions:
  - "Notion: aria/role-first selectors because CSS Modules hash class names on every deploy"
  - "Jira: data-testid-first selectors following Atlassian Design System patterns"
  - "Airtable: documented all field types including read-only computed fields to prevent edit attempts"
  - "All three guides: 5-strategy selectors per fsbElement matching Google Sheets depth"

patterns-established:
  - "Slash command reference block: exhaustive list of /commands with descriptions as primary guidance"
  - "Full form field-by-field documentation: every field in a modal documented with interaction steps"
  - "Per-field-type interaction table: different edit patterns per data type (text, select, date, checkbox, linked record)"
  - "VERIFY/STUCK pattern in every workflow step list"

requirements-completed: [NOTN-01, NOTN-02, JIRA-01, JIRA-02, ATBL-01, ATBL-02]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 30 Plan 04: Complex Productivity Guides Summary

**Notion slash-command guide, Jira full-form guide, and Airtable per-field-type guide with 54 combined fsbElements and app-specific selector strategies**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T08:57:57Z
- **Completed:** 2026-03-16T09:04:09Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Created Notion guide (410 lines) with slash commands as primary creation method, 19 fsbElements with aria/role-first selectors, contenteditable block interaction patterns, 8 workflows, 15 warnings
- Created Jira guide (396 lines) with full create-issue form coverage documenting all 10 form fields, 20 fsbElements with data-testid-first selectors, JQL syntax reference, 8 workflows, 14 warnings
- Created Airtable guide (445 lines) with per-field-type interaction for all editable and read-only field types, 19 fsbElements with aria/role-first selectors, 8 workflows, 15 warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Notion site guide** - `3bfd170` (feat)
2. **Task 2: Create Jira and Airtable site guides** - `d019731` (feat)

## Files Created/Modified
- `site-guides/productivity/notion.js` - Notion guide with slash commands, block editor workflows, database navigation, aria/role-first selectors
- `site-guides/productivity/jira.js` - Jira guide with full create-issue form, status transitions, JQL, data-testid-first selectors
- `site-guides/productivity/airtable.js` - Airtable guide with per-field-type editing, grid navigation, view switching, aria/role-first selectors

## Decisions Made
- Notion: aria/role-first selector strategy because CSS Modules hash all class names on every deploy -- class selectors would break constantly
- Jira: data-testid-first selector strategy because Atlassian Design System uses stable data-testid attributes across releases
- Airtable: explicitly documented all read-only field types (formula, rollup, lookup, count, auto-number, system fields) to prevent the AI from attempting to edit computed fields
- All three guides match Google Sheets depth with 15+ fsbElements, 8 workflows with VERIFY/STUCK patterns, and 14-15 warnings each

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three complex productivity app guides are complete and registered
- fsbElements injection pipeline (from 30-01) will automatically inject these elements on matching URLs
- Remaining productivity apps (Google Calendar, Google Keep, Todoist, Trello) handled by other plans in this phase

---
*Phase: 30-productivity-site-intelligence*
*Completed: 2026-03-16*
