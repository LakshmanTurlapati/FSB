---
phase: 13-google-sheets-formatting
plan: 02
subsystem: ai-integration
tags: [google-sheets, formatting, prompt-engineering, directive-injection]

requires:
  - phase: 13-01
    provides: Formatting orchestrator, formattingPhase flag, site guide workflows

provides:
  - buildSheetsFormattingDirective function with 9-step formatting sequence
  - Conditional prompt injection branching on sd.formattingPhase
  - Adaptive formatting detection for non-fresh sheets
  - Fallback strategies for every formatting operation

affects: []

tech-stack:
  added: []
  patterns:
    - "Prompt directive branching: sd.formattingPhase switches between data entry and formatting directives within the same sheetsData injection block"
    - "Builder function pattern: buildSheetsFormattingDirective() encapsulates formatting prompt as standalone function for testability and separation"

key-files:
  created: []
  modified:
    - ai/ai-integration.js

key-decisions:
  - "Formatting directive replaces (not appends to) data entry directive when formattingPhase is true"
  - "buildSheetsFormattingDirective placed as module-level standalone function before the AIIntegration class"
  - "9 steps (0-8): escape, header styling, freeze, alternating colors, header text color, auto-size columns, link blue text, left-align data, verify"
  - "Adaptive formatting section only injected for non-new sheets (sd.sheetTarget.type !== 'new')"
  - "Apply Link column letter dynamically computed from sd.columns.indexOf rather than assuming last column"

patterns-established:
  - "Phase-aware directive injection: single sheetsData check branches by phase flag to inject phase-specific prompt"

duration: 3min
completed: 2026-02-23
---

# Phase 13 Plan 02: Sheets Formatting Prompt Directive Injection

**9-step formatting directive with keyboard shortcuts, menu paths, hex color codes, fallback strategies, and adaptive formatting detection injected into AI system prompt when formattingPhase is active**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T23:31:12Z
- **Completed:** 2026-02-23T23:33:55Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `buildSheetsFormattingDirective(sd)` standalone function at module level in ai-integration.js that generates a comprehensive formatting directive with 9 numbered steps
- Modified the `if (context?.sheetsData)` block to branch on `sd.formattingPhase` -- formatting directive replaces data entry directive when active
- Directive covers: escape edit mode (Step 0), header bold/center/border (Step 1), freeze row 1 via menu (Step 2), alternating colors with dark preset or custom hex (Step 3), header white text (Step 4), column auto-size via right-click fit-to-data (Step 5), Apply Link blue text (Step 6), left-align data rows (Step 7), visual verification (Step 8)
- Each step includes fallback strategies: tool finder for freeze, preset themes for alternating colors, double-click for column resize, skip for blue text
- Adaptive formatting section conditionally included for non-new sheets to detect and preserve existing formatting
- Dynamic Apply Link column letter computation from `sd.columns.indexOf('Apply Link')` with fallback to last column
- Color values locked: header #333333, text #FFFFFF, Color 1 #FFFFFF, Color 2 #F3F3F3, links #1155CC
- Existing data entry directive preserved unchanged in the `else` branch

## Task Commits

Each task was committed atomically:

1. **Task 1: Add formatting prompt directive injection in ai-integration.js** - `fac3d4f` (feat)

## Files Created/Modified

- `ai/ai-integration.js` - Added buildSheetsFormattingDirective() standalone function (~100 lines of directive text), modified sheetsData injection block to branch on formattingPhase with formatting in if-branch and data entry in else-branch

## Decisions Made

- Formatting directive replaces data entry directive (not appends) because data entry is complete when formatting starts
- buildSheetsFormattingDirective placed as module-level standalone function (same pattern as formatSiteKnowledge) for clean separation
- 9 steps ordered for maximum reliability: keyboard shortcuts first (Steps 0-1), then menu operations (Steps 2-3), then toolbar interactions (Steps 4-6), then alignment (Step 7), then verification (Step 8)
- Adaptive formatting section only appears for non-new sheets to avoid unnecessary overhead on fresh sheets
- Apply Link column letter dynamically computed rather than assumed to be last column, with fallback to lastCol

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 13 is now complete -- both the formatting orchestrator (Plan 01) and the AI prompt directive (Plan 02) are in place
- The full formatting pipeline: Phase 12 data entry completes -> completion handler calls startSheetsFormatting() -> automation loop restarts with formatting task -> AI receives formatting directive -> AI executes 9-step formatting sequence -> marks taskComplete -> formattingComplete set to true -> session ends
- The AI now has explicit step-by-step instructions for every formatting operation with primary approaches and fallback strategies

## Self-Check: PASSED

---
*Phase: 13-google-sheets-formatting*
*Completed: 2026-02-23*
