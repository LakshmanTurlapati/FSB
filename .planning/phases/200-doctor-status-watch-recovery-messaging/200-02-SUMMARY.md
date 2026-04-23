---
phase: 200-doctor-status-watch-recovery-messaging
plan: "02"
subsystem: diagnostics
tags: [mcp, errors, recovery, diagnostics, restricted-tabs]

requires:
  - phase: 200-doctor-status-watch-recovery-messaging
    provides: Layered diagnostics vocabulary, status watch, and version parity from Plans 200-01 and 200-03
provides:
  - Layer-aware MCP tool error copy with a single concrete next action
  - Recovery regression coverage for extension, content-script, restricted-page, tool-routing, and navigation failures
  - Root MCP suite ordering that runs recovery messaging before parity and later unrelated tests
affects: [phase-200, mcp-errors, recovery-copy, restricted-recovery, npm-test]

tech-stack:
  added: []
  patterns:
    - Human-facing MCP tool errors mirror the doctor/status vocabulary instead of inventing a second diagnostic language
    - Restricted-page recovery keeps the navigation-only tool list contract all the way through the server error mapper

key-files:
  created:
    - tests/mcp-recovery-messaging.test.js
  modified:
    - mcp-server/src/errors.ts
    - package.json

key-decisions:
  - "Tool failures now always lead with `Detected`, `Why`, and `Next action`."
  - "Restricted-page recovery remains navigation-only and continues to exclude `run_task`."
  - "The root MCP suite now runs recovery messaging before parity and later unrelated tests."

patterns-established:
  - "Tool-routing why-lines include both the tool name and route family for faster debugging."
  - "Generic shotgun advice like `restart everything` is treated as a regression."

requirements-completed: [DIAG-01, DIAG-03]

duration: 4min
completed: 2026-04-23
---

# Phase 200 Plan 02: Layer-Aware Recovery Messaging Summary

**MCP tool failures now name the broken layer, explain why, and point to one concrete next action instead of generic restart advice.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-23T18:16:52Z
- **Completed:** 2026-04-23T18:20:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Reworked `mapFSBError()` so every failed MCP tool call starts with `Detected:`, `Why:`, and `Next action:`.
- Mapped extension, bridge, content-script, restricted-page, tool-routing, configuration, package-version, and page-navigation failures into distinct recovery copy.
- Added `tests/mcp-recovery-messaging.test.js` and wired it into the root MCP test ordering immediately after restricted-tab coverage.

## Task Commits

Implementation work for this plan shipped in one atomic commit:

1. **Add layer-aware MCP recovery messaging and regression coverage** - `6a4df94` (feat)

## Files Created/Modified

- `mcp-server/src/errors.ts` - Replaces generic MCP failure text with layer-aware `Detected / Why / Next action` blocks while keeping raw error appendix support.
- `tests/mcp-recovery-messaging.test.js` - Verifies all required recovery fixtures and the navigation-only restricted-page tool list.
- `package.json` - Runs recovery messaging, version parity, and diagnostics tests together in the root MCP suite.

## Decisions Made

- Bridge ownership and extension attachment stay distinct even when both surface through `extension_not_connected`.
- Unknown tool-call failures fall back to page-state guidance instead of broad restart instructions.
- Recovery text now treats CLI diagnostics and direct tool failures as one shared vocabulary surface.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- None. The restricted-tab and parity regressions stayed green after the error-copy rewrite.

## Verification

- `npm --prefix mcp-server run build`
- `node tests/mcp-recovery-messaging.test.js`
- `node tests/mcp-restricted-tab.test.js`
- `node tests/mcp-version-parity.test.js`
- `node tests/mcp-diagnostics-status.test.js`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 200 is now fully implemented. The next milestone step is Phase 201, which can build on the completed diagnostics, recovery messaging, and parity surface.

---
*Phase: 200-doctor-status-watch-recovery-messaging*
*Completed: 2026-04-23*
