---
phase: 179-mcp-source-recovery-validation
plan: 01
title: "MCP TypeScript Source Recovery"
subsystem: mcp-server
tags: [typescript, source-recovery, transliteration, strict-mode]
dependency_graph:
  requires: []
  provides: [platforms.ts, config-writer.ts, install.ts]
  affects: [mcp-server/build]
tech_stack:
  added: []
  patterns: [typed-platform-registry, format-aware-config-writer, cli-delegation]
key_files:
  created:
    - mcp-server/src/platforms.ts
    - mcp-server/src/config-writer.ts
    - mcp-server/src/install.ts
  modified: []
decisions:
  - "Simplified flags.all redundant check: JS artifact had defensive `flags.all === true || flags['all'] === true` but TypeScript strict mode flags the second branch as unreachable after the first narrows the type. Changed to single `flags['all'] === true` -- same runtime behavior."
  - "Used `as` type assertions in parseByFormat for JSON.parse and parseToml returns since these external parsers return unknown types that need narrowing to Record<string, unknown>."
  - "Used non-null assertion (!) on platform.serverMapKey in installToConfig/removeFromConfig/mergeServerEntry since those code paths only execute for file-based platforms where serverMapKey is always non-null."
metrics:
  duration: "5 min"
  completed: "2026-04-18T06:08:40Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 179 Plan 01: MCP TypeScript Source Recovery Summary

Faithfully transliterated three JS build artifacts into TypeScript source files with full strict-mode type annotations, recovering proper build-from-source capability for the MCP server's platform registry, config writer, and install orchestration modules.

## Completed Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create platforms.ts with typed platform registry | e646e8f | mcp-server/src/platforms.ts |
| 2 | Create config-writer.ts with format-aware read-merge-write engine | 8c298f9 | mcp-server/src/config-writer.ts |
| 3 | Create install.ts with install/uninstall orchestration | 38e622c | mcp-server/src/install.ts |

## What Was Built

### platforms.ts (196 lines)
- 5 type/interface exports: ConfigFormat, PlatformPaths, ServerEntry, PlatformConfig, PlatformRegistry
- PLATFORMS registry constant with all 10 platform configs (claude-desktop, claude-code, cursor, vscode, windsurf, cline, zed, codex, gemini, continue)
- 3 exported functions: getServerEntry(), resolvePlatformConfig(), getPlatformFlags()
- Cross-OS path resolution using process.platform and environment variables

### config-writer.ts (318 lines)
- ConfigResult interface for operation status reporting
- 5 internal functions: parseByFormat, isContinueArrayFormat, mergeServerEntry, checkIdempotent, hasExistingEntry
- 3 exported functions: serializeByFormat, installToConfig, removeFromConfig
- Format-aware parsing/serialization for JSON, JSONC (strip-json-comments), TOML (smol-toml), YAML (yaml)
- Backup-before-mutate pattern, idempotency checks, directory existence safety

### install.ts (320 lines)
- InstallFlags type, MatchedPlatform and ClaudeCodeResult internal interfaces
- 7 internal functions: getMatchedPlatforms, printResult, buildPlatformList, printInstallUsage, printUninstallUsage, printDryRunPreview, handleClaudeCodeInstall
- 2 exported async functions: runInstall, runUninstall
- --all flag expansion, --dry-run preview, VS Code type:"stdio" augmentation
- Claude Code CLI delegation via hardcoded execSync commands (no user input in shell)

## Import Graph

```
install.ts --> platforms.ts (PLATFORMS, resolvePlatformConfig, getServerEntry, PlatformConfig, ServerEntry)
install.ts --> config-writer.ts (installToConfig, removeFromConfig, serializeByFormat, ConfigResult)
install.ts --> version.ts (FSB_MCP_VERSION, FSB_SERVER_NAME)
config-writer.ts --> platforms.ts (getServerEntry, ConfigFormat, ServerEntry, PlatformConfig)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict-mode comparison error in runInstall/runUninstall**
- **Found during:** Task 3
- **Issue:** The JS artifact used `flags.all === true || flags['all'] === true` as a defensive double-check. TypeScript strict mode correctly identifies that after `flags.all === true` narrows the type, the `flags['all'] === true` branch is unreachable (type `string | false` cannot equal `true`).
- **Fix:** Captured `isAll` with a single `flags['all'] === true` check before the expansion loop, preserving identical runtime behavior.
- **Files modified:** mcp-server/src/install.ts
- **Commit:** 38e622c

## Verification

All three TypeScript source files compile cleanly under `npx tsc --noEmit --project tsconfig.json` with strict mode enabled (exit code 0). The import graph is correct: config-writer imports from platforms, install imports from both platforms and config-writer plus version. All exports from the JS build artifacts are preserved in the TypeScript versions.

## Threat Surface Scan

No new threat surface introduced beyond what was documented in the plan's threat model. All three files are transliterations of existing JS build artifacts with identical behavior. The hardcoded shell commands in install.ts (claude mcp add/remove) contain no user-interpolated input, matching T-179-03 mitigation.

## Self-Check: PASSED

- FOUND: mcp-server/src/platforms.ts
- FOUND: mcp-server/src/config-writer.ts
- FOUND: mcp-server/src/install.ts
- FOUND: .planning/phases/179-mcp-source-recovery-validation/179-01-SUMMARY.md
- FOUND: e646e8f (Task 1 commit)
- FOUND: 8c298f9 (Task 2 commit)
- FOUND: 38e622c (Task 3 commit)
