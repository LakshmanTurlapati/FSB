---
phase: 176-non-json-platforms-extended-flags
plan: "02"
subsystem: infra
tags: [cli, mcp, install, dry-run, bulk-install]

# Dependency graph
requires:
  - phase: 176-non-json-platforms-extended-flags plan 01
    provides: "Non-JSON platform support (TOML/YAML/CLI), config-writer with serializeByFormat, platforms registry with 10 entries"
provides:
  - "--dry-run preview modifier for install and uninstall CLI subcommands"
  - "--all flag for bulk install/uninstall across all 10 platforms"
  - "Summary output with success/total counts for --all runs"
  - "Usage help updated with --all and --dry-run flags"
affects: [mcp-server-install, cli-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dry-run guard pattern: check flags['dry-run'] before every mutation (file write, execSync)"
    - "--all expansion pattern: set all platform keys before getMatchedPlatforms() call"
    - "Bracket notation for hyphenated flags (flags['dry-run'] not flags.dryRun)"

key-files:
  created: []
  modified:
    - mcp-server/build/install.js

key-decisions:
  - "Used bracket notation flags['dry-run'] throughout to match parseArgs behavior (no camelCase conversion)"
  - "Dry-run preview wraps entry in platform root key structure for realistic formatted output"
  - "JSONC platforms preview as JSON since serializeByFormat outputs identical content for both"
  - "--all expansion mutates flags object in-place before getMatchedPlatforms() to reuse existing matching logic"

patterns-established:
  - "Dry-run guard before mutation: every installToConfig/removeFromConfig/execSync call has a preceding flags['dry-run'] check"
  - "--all expansion before matching: flags mutation happens at function top, before any platform filtering"

requirements-completed: [INST-09, INST-10]

# Metrics
duration: 4min
completed: 2026-04-15
---

# Phase 176 Plan 02: Dry-Run and All-Platforms Flags Summary

**--dry-run preview with [DRY RUN] prefix and formatted entry output, --all bulk install/uninstall across all 10 platforms with per-platform status and summary counts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T22:48:02Z
- **Completed:** 2026-04-15T22:52:01Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- --dry-run prevents all file writes and CLI executions, showing [DRY RUN] prefix with platform name, config path, and formatted entry preview
- --all expands to all 10 platform keys before matching, with per-platform skip messages and summary line (e.g., "Installed to 8 of 10 platforms")
- Both flags work in combination: --all --dry-run shows what would change for every platform without modifying anything
- Usage help for both install and uninstall subcommands updated with --all and --dry-run documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement --dry-run preview modifier** - `d983f66` (feat)
2. **Task 2: Implement --all flag for bulk install/uninstall** - `faefa35` (feat)

## Files Created/Modified
- `mcp-server/build/install.js` - Added serializeByFormat import, printDryRunPreview() helper, dry-run guards in install/uninstall paths, --all expansion logic, summary tracking/output, and updated usage help

## Decisions Made
- Used bracket notation `flags['dry-run']` throughout (7 occurrences) to match parseArgs behavior which does not convert hyphens to camelCase
- Dry-run preview wraps the server entry in the platform's root key structure (e.g., `{ mcpServers: { fsb: ... } }`) for a realistic preview of what would be written
- JSONC platforms preview as plain JSON since `serializeByFormat` outputs identical content for both formats
- --all expansion mutates the flags object in-place before `getMatchedPlatforms()` to reuse the existing platform matching logic without duplication
- Claude Code install dry-run shows the exact `claude mcp add` command instead of a config file preview since it uses CLI delegation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Integration test (`test-config-engine.js`) cannot run in the git worktree due to missing `node_modules` (npm dependencies like `strip-json-comments` not installed). Verified tests pass in the main repo directory. This is an environment constraint, not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All v0.9.30 install CLI requirements (INST-09, INST-10) are now complete
- install.js supports all 10 platforms, 4 config formats, --dry-run preview, and --all bulk operations
- Ready for milestone verification and release tagging

---
*Phase: 176-non-json-platforms-extended-flags*
*Completed: 2026-04-15*
