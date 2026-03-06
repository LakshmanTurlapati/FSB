---
phase: 22-page-text-extraction-for-reading-tasks
plan: 01
subsystem: content-scripts
tags: [dom-walker, markdown, snapshot, page-text, element-refs]

requires:
  - phase: 16-yaml-dom-snapshot
    provides: "getRegion, buildGuideAnnotations, refMap, getFilteredElements, buildYAMLSnapshot"
provides:
  - "buildMarkdownSnapshot() - unified markdown snapshot with interleaved text and element refs"
  - "extractPageText() - text-only markdown extraction for readpage"
  - "formatInlineRef() - backtick element ref formatter"
  - "getMarkdownSnapshot message handler in messaging.js"
  - "readPage message handler in messaging.js"
affects: [ai-integration-prompt-building, cli-parser-readpage-command, system-prompt-updates]

tech-stack:
  added: []
  patterns: [recursive-dom-visitor, region-tracked-markdown-emission, inline-backtick-refs]

key-files:
  created: []
  modified:
    - content/dom-analysis.js
    - content/messaging.js

key-decisions:
  - "Recursive visitor pattern over TreeWalker API for natural depth tracking and subtree skipping"
  - "Interactive elements skip children to prevent text duplication (Pitfall 1 avoidance)"
  - "Region tracking via getRegion() during walk for document-order region heading emission"
  - "80 element limit (up from 50) fitting within 12K char budget"

patterns-established:
  - "walkDOMToMarkdown: recursive visitor returning region-tagged lines array"
  - "formatInlineRef: backtick notation with role, name, attributes, hints, values, checked state"
  - "extractPageText: text-only variant reusing visibility/block-element helpers"

requirements-completed: [P22-01, P22-02, P22-03, P22-04, P22-05]

duration: 3min
completed: 2026-03-06
---

# Phase 22 Plan 01: Markdown Snapshot Engine Summary

**Recursive DOM walker producing unified markdown snapshots with interleaved page text and backtick element refs, plus text-only extractor for readpage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T13:14:05Z
- **Completed:** 2026-03-06T13:17:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- buildMarkdownSnapshot() produces H1 title, blockquote metadata, ## region headings, inline backtick element refs interwoven with page text
- extractPageText() provides text-only markdown with viewport filtering and 50K char cap for readpage
- getMarkdownSnapshot and readPage message handlers route through async handler with timing logs

## Task Commits

Each task was committed atomically:

1. **Task 1: Build markdown snapshot engine in dom-analysis.js** - `31fab5a` (feat)
2. **Task 2: Add getMarkdownSnapshot and readPage message handlers in messaging.js** - `cfabebf` (feat)

## Files Created/Modified
- `content/dom-analysis.js` - Added buildMarkdownSnapshot, walkDOMToMarkdown, extractPageText, formatInlineRef, isVisibleForSnapshot, isBlockElement, REGION_HEADING_MAP; exported buildMarkdownSnapshot and extractPageText on FSB namespace
- `content/messaging.js` - Added getMarkdownSnapshot and readPage cases in handleAsyncMessage switch; updated async routing check to include new message types

## Decisions Made
- Used recursive visitor pattern instead of TreeWalker API for natural nesting depth tracking and easy subtree skipping of interactive elements
- Interactive elements in walkDOMToMarkdown emit backtick ref and skip children entirely to prevent text duplication (research Pitfall 1)
- Region tracking happens during DOM walk by calling getRegion() on elements and emitting ## headings when region changes, preserving document order
- Table rendering caps at 8 columns with pipe-delimited markdown; complex tables (colspan/rowspan) not specially handled (fallback to cell text extraction)
- Non-interactive links rendered as standard markdown [text](url) format instead of backtick refs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Markdown snapshot engine ready for integration into ai-integration.js prompt building (Plan 02)
- readPage handler ready for CLI parser readpage command registration (Plan 02)
- Existing getYAMLSnapshot and buildYAMLSnapshot preserved for backward compat during transition

## Self-Check: PASSED

- All source files exist and syntax-check clean
- Both commits (31fab5a, cfabebf) verified in git log
- FSB.buildMarkdownSnapshot and FSB.extractPageText exports confirmed
- getMarkdownSnapshot and readPage message handlers confirmed in messaging.js async routing

---
*Phase: 22-page-text-extraction-for-reading-tasks*
*Completed: 2026-03-06*
