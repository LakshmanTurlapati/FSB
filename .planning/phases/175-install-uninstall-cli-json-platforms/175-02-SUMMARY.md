---
phase: 175-install-uninstall-cli-json-platforms
plan: "02"
subsystem: mcp-server
tags: [cli, install, uninstall, mcp]
dependency_graph:
  requires: [175-01]
  provides: [cli-install-subcommand, cli-uninstall-subcommand, help-listing, setup-tip]
  affects: [mcp-server/build/index.js, mcp-server/build/version.js]
tech_stack:
  added: []
  patterns: [esm-import-wiring, switch-case-routing]
key_files:
  created: [mcp-server/build/index.js]
  modified: [mcp-server/build/version.js]
decisions:
  - "Placed install/uninstall switch cases after setup and before wait-for-extension for logical command ordering"
  - "Added missing version.js constants (DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT, FSB_EXTENSION_BRIDGE_URL) required by index.js imports"
metrics:
  duration: "3 min"
  completed: "2026-04-15T20:56:35Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 175 Plan 02: Wire Install/Uninstall CLI Subcommands Summary

CLI entry point wired with install/uninstall switch cases dispatching to install.js, plus updated help listing and setup tip line.

## Completed Tasks

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Wire install/uninstall switch cases and update help/setup | a5d3c1e | Added ESM import, 2 switch cases, 2 help entries, setup tip line |
| 2 | Verify end-to-end install/uninstall flow (checkpoint) | -- | Auto-verified: all 6 plan-level checks passed |

## Changes Made

### mcp-server/build/index.js (created in worktree, force-added past .gitignore)
- Added `import { runInstall, runUninstall } from './install.js'` after existing imports
- Added `case 'install':` and `case 'uninstall':` switch cases in `main()` between `setup` and `wait-for-extension`
- Added two lines to `printHelp()` command listing for install and uninstall
- Prepended tip line `"Tip: Use 'npx fsb-mcp-server install --<platform>' for automatic setup."` to `printSetup()` output

### mcp-server/build/version.js
- Added `DEFAULT_HTTP_HOST`, `DEFAULT_HTTP_PORT`, and `FSB_EXTENSION_BRIDGE_URL` constants required by index.js

## Verification Results

All acceptance criteria verified:

| Check | Result |
|-------|--------|
| `node index.js install` prints usage with platform list | PASS |
| `node index.js uninstall` prints usage with platform list | PASS |
| `node index.js help` lists install and uninstall commands | PASS (4 lines matching) |
| `node index.js setup` starts with Tip line | PASS |
| Import statement present | PASS |
| `case 'install'` switch case present | PASS |
| `case 'uninstall'` switch case present | PASS |
| All original commands still listed in help | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing version.js constants**
- **Found during:** Task 1
- **Issue:** index.js imports DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT, FSB_EXTENSION_BRIDGE_URL from version.js, but Plan 01 only created version.js with FSB_SERVER_NAME and FSB_MCP_VERSION
- **Fix:** Added the three missing constants to version.js
- **Files modified:** mcp-server/build/version.js
- **Commit:** a5d3c1e

**2. [Rule 3 - Blocking] Created stub modules for index.js dependencies**
- **Found during:** Task 1
- **Issue:** index.js statically imports runtime.js, diagnostics.js, http.js, bridge.js, queue.js which don't exist in the worktree (they're part of the npm package build output, not tracked in git)
- **Fix:** Created minimal stubs for these 5 modules so index.js can load and the install/uninstall/help/setup commands can be verified
- **Files created:** runtime.js, diagnostics.js, http.js, bridge.js, queue.js (stubs, NOT committed -- they are gitignored build artifacts)

## Known Stubs

None in committed files. The worktree-only stub modules (runtime.js, diagnostics.js, http.js, bridge.js, queue.js) are not committed and exist only to enable verification in the worktree environment.

## Self-Check: PASSED

- mcp-server/build/index.js: FOUND
- mcp-server/build/version.js: FOUND
- 175-02-SUMMARY.md: FOUND
- Commit a5d3c1e: FOUND
