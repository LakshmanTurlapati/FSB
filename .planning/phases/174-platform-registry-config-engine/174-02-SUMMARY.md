---
phase: 174-platform-registry-config-engine
plan: 02
subsystem: mcp
tags: [mcp, config-engine, json, jsonc, toml, yaml, backup, idempotent]

requires:
  - "PLATFORMS registry map from 174-01 (platforms.js)"
  - "strip-json-comments, smol-toml, yaml npm packages from 174-01"
provides:
  - "installToConfig() format-aware config read-merge-write with backup and idempotency"
  - "removeFromConfig() clean entry removal preserving other servers"
affects: [175-cli-wiring, mcp-install, mcp-uninstall]

tech-stack:
  added: []
  patterns: [format-dispatch, read-merge-write, backup-before-modify, idempotent-skip, continue-yaml-array]

key-files:
  created:
    - mcp-server/build/config-writer.js
    - mcp-server/build/test-config-engine.js
  modified: []

key-decisions:
  - "Moved .bak backup creation before idempotency check so backup is always created when reading an existing file"
  - "JSONC files written back as plain JSON (comments lost); .bak preserves original with comments"
  - "Continue YAML array format detected via format=yaml AND serverMapKey=mcpServers combination"
  - "Used git add -f for mcp-server/build/ files matching 174-01 force-add pattern"

patterns-established:
  - "Format dispatch pattern: parseByFormat/serializeByFormat switch on format string"
  - "Idempotency via JSON.stringify comparison of existing vs proposed entry"
  - "Continue array detection: isContinueArrayFormat(format, serverMapKey) helper"
  - "Backup-first read: copyFile before readFile ensures recovery on any failure path"

requirements-completed: [INST-02, INST-03, INST-04, INST-05, INST-08]

duration: 3min
completed: 2026-04-15
---

# Phase 174 Plan 02: Config Engine Summary

**Format-aware config read-merge-write engine with JSON/JSONC/TOML/YAML support, backup, idempotency, and error handling**

## Performance

- **Duration:** 3 min 30s
- **Started:** 2026-04-15T19:55:39Z
- **Completed:** 2026-04-15T19:59:09Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created config-writer.js exporting installToConfig and removeFromConfig functions
- Four format parsers: JSON, JSONC (with trailingCommas: true), TOML (smol-toml), YAML
- Backup (.bak) created before any file read/modification of existing configs
- Idempotent skip when FSB is already configured identically (JSON.stringify comparison)
- Graceful error on missing config directory (returns error status, never creates dirs)
- Continue platform YAML array merge handled separately from object-map formats
- Existing server entries preserved during merge for all formats
- removeFromConfig cleanly deletes only the FSB entry
- 13 total test assertions across 8 inline + 5 integration tests, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create config-writer engine module** - `666e913` (feat)
2. **Task 2: Integration test for config engine roundtrip** - `8852772` (test)

## Files Created/Modified
- `mcp-server/build/config-writer.js` - Format-aware config read-merge-write engine with installToConfig and removeFromConfig exports
- `mcp-server/build/test-config-engine.js` - Integration tests covering TOML roundtrip, YAML array roundtrip, idempotency for both, and full install-uninstall cycle

## Decisions Made
- Moved .bak backup creation before the idempotency check: the plan specified backup at step 6 after idempotency at step 4, but the verification test expected .bak to exist after an idempotent skip. Creating backup on read (before any logic) is safer and ensures recovery even when the engine skips a write.
- JSONC written back as plain JSON: comments and trailing commas in JSONC files are stripped during parsing and not reconstructed on write. The .bak file preserves the original commented content.
- Continue YAML array format detected by the combination of `format === 'yaml' && serverMapKey === 'mcpServers'` rather than by platform name, keeping the logic data-driven.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved backup step before idempotency check**
- **Found during:** Task 1 verification (T3 failed)
- **Issue:** Plan specified backup at step 6 after idempotency check at step 4, but verification test T3 expected .bak file to exist after an idempotent skip (where backup step 6 is never reached)
- **Fix:** Moved copyFile backup into the file-read block (step 3) so .bak is always created when an existing file is read, regardless of whether the engine subsequently skips or modifies
- **Files modified:** mcp-server/build/config-writer.js
- **Commit:** 666e913

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Backup is now created on every read of an existing file, which is strictly safer than only on modification. No scope change.

## Verification Results

### Task 1 Inline Tests (8/8 passed)
- T1: Install to new JSON (created)
- T2: Idempotent skip (skipped)
- T3: .bak backup exists
- T4: Preserves other servers during merge
- T5: JSONC with comments and trailing commas parsed correctly
- T6: Missing directory returns error status
- T7: Remove preserves other servers
- T8: Remove when not configured returns not-found

### Task 2 Integration Tests (5/5 passed)
- T1: TOML roundtrip with existing content preserved (Codex platform)
- T2: TOML idempotency skip
- T3: YAML array roundtrip with existing entries preserved (Continue platform)
- T4: YAML idempotency skip
- T5: Install-then-uninstall cycle (created -> removed -> not-found)

## Issues Encountered
- mcp-server/build/ is covered by root .gitignore `build/` pattern. Used `git add -f` to force-track files, consistent with 174-01 approach.

## Next Phase Readiness
- Config engine is complete and ready for CLI wiring in Phase 175
- installToConfig and removeFromConfig cover all 8 file-based platforms (JSON: Claude Desktop, Cursor, Windsurf, Cline, Gemini; JSONC: VS Code, Zed; TOML: Codex; YAML: Continue)
- Claude Code (CLI format) requires separate handling in the CLI layer, not the config engine

## Self-Check: PASSED

All files verified present on disk, all commit hashes found in git log.

---
*Phase: 174-platform-registry-config-engine*
*Completed: 2026-04-15*
