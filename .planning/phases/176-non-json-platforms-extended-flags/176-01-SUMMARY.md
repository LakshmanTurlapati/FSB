---
phase: 176-non-json-platforms-extended-flags
plan: "01"
subsystem: mcp-server/build
tags: [platforms, install, toml, yaml, cli, claude-code]
dependency_graph:
  requires: []
  provides: [all-10-platforms-installable, serializeByFormat-export]
  affects: [176-02-PLAN]
tech_stack:
  added: []
  patterns: [cli-delegation-via-execSync, format-filter-exclusion]
key_files:
  created: []
  modified:
    - mcp-server/build/install.js
    - mcp-server/build/config-writer.js
decisions:
  - "Used --scope user for Claude Code install (FSB is user-global, matching all other platform installs)"
  - "Filter by format !== 'cli' instead of allowlisting json/jsonc (forward-compatible for new formats)"
  - "Hardcoded command string with no user input interpolation (T-176-01 mitigation)"
metrics:
  duration: 2m 15s
  completed: 2026-04-15
---

# Phase 176 Plan 01: Non-JSON Platforms and Claude Code Install Summary

Unblocked TOML/YAML/CLI install paths by removing the DEFERRED_FORMATS gate and adding a Claude Code CLI delegation handler with execSync, idempotency detection, and fallback messaging.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove DEFERRED_FORMATS gate and add Claude Code install handler | f378a32 | mcp-server/build/install.js |
| 2 | Export serializeByFormat and verify TOML/YAML install paths | 688f808 | mcp-server/build/config-writer.js |

## Changes Made

### Task 1: Remove DEFERRED_FORMATS gate and add Claude Code install handler

- Deleted `DEFERRED_FORMATS` constant and `handleDeferredFlags()` function (dead code removal)
- Changed `getMatchedPlatforms()` from allowlisting `json`/`jsonc` to excluding `cli` format, letting TOML (Codex) and YAML (Continue) platforms pass through to the config engine
- Added `handleClaudeCodeInstall()` function that:
  - Shells out to `claude mcp add --scope user fsb -- npx -y fsb-mcp-server`
  - Uses `stdio: 'pipe'` to suppress raw CLI output (T-176-03 mitigation)
  - Detects "already exists" in stdout/stderr for idempotency
  - Falls back to printing the manual command if CLI is not found
- Wired `handleClaudeCodeInstall()` into `runInstall()` before `getMatchedPlatforms()`, mirroring the existing uninstall pattern
- Cleaned up `runUninstall()` to remove `hadDeferred` variable and condition

### Task 2: Export serializeByFormat and verify TOML/YAML install paths

- Changed `function serializeByFormat` to `export function serializeByFormat` in config-writer.js
- This export enables Plan 02's dry-run preview feature to format output in any supported format
- Ran all 5 integration tests confirming TOML roundtrip, TOML idempotency, YAML array roundtrip, YAML idempotency, and JSON install/uninstall cycle all pass
- Verified all 10 platforms present in the registry (claude-desktop, claude-code, cursor, vscode, windsurf, cline, zed, codex, gemini, continue)

## Verification Results

| Check | Result |
|-------|--------|
| DEFERRED_FORMATS removed | PASS (grep returns 0 matches) |
| handleDeferredFlags removed | PASS (grep returns 0 matches) |
| handleClaudeCodeInstall present | PASS (3 occurrences: JSDoc, definition, call) |
| claude mcp add command present | PASS |
| --scope user flag present | PASS |
| format !== 'cli' filter present | PASS |
| Integration tests (5/5) | PASS |
| All 10 platforms in registry | PASS |
| serializeByFormat exported | PASS |

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Surface Scan

No new threat surface introduced beyond what the plan's threat model already covers. The `execSync` call uses only hardcoded constants (T-176-01), `stdio: 'pipe'` suppresses raw output (T-176-03), and PATH trust is accepted (T-176-02).
