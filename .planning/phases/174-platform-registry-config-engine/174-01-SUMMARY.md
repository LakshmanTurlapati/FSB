---
phase: 174-platform-registry-config-engine
plan: 01
subsystem: mcp
tags: [mcp, platform-registry, cross-platform, config-parsing, npm]

requires: []
provides:
  - "PLATFORMS registry map with 10 MCP platform configs (paths, formats, keys)"
  - "getServerEntry() for Windows-aware npx command building"
  - "resolvePlatformConfig() for OS-aware config file path resolution"
  - "getPlatformFlags() for CLI flag enumeration"
  - "npm dependencies for JSONC, TOML, and YAML config parsing"
affects: [174-02, config-engine, mcp-install, mcp-uninstall]

tech-stack:
  added: [strip-json-comments@5, smol-toml@1, yaml@2]
  patterns: [platform-registry-map, os-aware-path-resolution, windows-npx-wrapping]

key-files:
  created:
    - mcp-server/build/platforms.js
    - mcp-server/package.json
    - mcp-server/package-lock.json
  modified: []

key-decisions:
  - "Restored mcp-server/package.json to git tracking with existing MCP deps plus 3 new config parsing libraries"
  - "Used git add -f for mcp-server files since build/ pattern in .gitignore covers mcp-server/build/"
  - "platforms.js does not import from version.js -- uses literal fsb-mcp-server package name in server entry args"

patterns-established:
  - "Platform registry pattern: single PLATFORMS const object as source of truth for all platform config metadata"
  - "OS path resolution: homedir() at module load time, process.env for Windows APPDATA/LOCALAPPDATA"
  - "Force-add pattern for mcp-server tracked files under gitignored build/ directory"

requirements-completed: [INST-01, INST-06, INST-07]

duration: 3min
completed: 2026-04-15
---

# Phase 174 Plan 01: Platform Registry Summary

**Platform registry module with 10 MCP platform configs, cross-OS path resolution, and config format parsing dependencies**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-15T19:48:30Z
- **Completed:** 2026-04-15T19:52:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Installed strip-json-comments, smol-toml, and yaml npm dependencies for config format parsing
- Created platforms.js with complete PLATFORMS registry mapping all 10 MCP-capable platforms
- Each platform entry has displayName, flag, format, serverMapKey, and OS-specific configPath
- getServerEntry() handles Windows cmd /c npx wrapping per INST-07
- resolvePlatformConfig() resolves config path for current OS, returns null for CLI-only platforms
- getPlatformFlags() returns all 10 platform flag names for CLI enumeration

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm dependencies for config format parsing** - `e8e6af9` (chore)
2. **Task 2: Create platform registry module (platforms.js)** - `5d70719` (feat)

## Files Created/Modified
- `mcp-server/package.json` - Package manifest with existing MCP deps plus 3 new config parsing libraries
- `mcp-server/package-lock.json` - Lockfile for reproducible installs
- `mcp-server/build/platforms.js` - Platform registry with PLATFORMS map, getServerEntry, resolvePlatformConfig, getPlatformFlags

## Decisions Made
- Restored mcp-server/package.json to git tracking: the directory previously had no tracked package.json (removed from git after v0.4.0 publish) but npm install requires one for the new dependencies
- Used `git add -f` for mcp-server files: the root .gitignore has `build/` and `node_modules/` patterns that cover mcp-server subdirectories, matching the existing force-add pattern used for .planning/ files
- platforms.js uses literal `fsb-mcp-server` package name in getServerEntry() args rather than importing from version.js, per plan specification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored mcp-server/package.json for npm install**
- **Found during:** Task 1 (npm dependency installation)
- **Issue:** mcp-server/ directory had no package.json (removed from git tracking after v0.4.0 npm publish); npm install requires a package.json
- **Fix:** Created package.json based on the last known version (git show 60dc41e:mcp-server/package.json), adding the 3 new config parsing dependencies alongside existing MCP deps
- **Files modified:** mcp-server/package.json
- **Verification:** npm install succeeded, all 3 packages importable
- **Committed in:** e8e6af9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Package.json creation was necessary to enable npm install. No scope creep.

## Issues Encountered
- mcp-server/ directory did not exist in the worktree (not tracked in git). Created the directory structure and restored package.json from git history to enable npm install.
- mcp-server/build/ path is covered by root .gitignore `build/` pattern. Used `git add -f` to force-track platforms.js, matching existing pattern for .planning/ files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Platform registry is complete and importable as ESM
- All 10 platforms mapped with format, serverMapKey, and OS-specific configPath
- Config parsing libraries (strip-json-comments, smol-toml, yaml) are installed and ready for 174-02 config engine
- getServerEntry() provides the server entry shape needed for install/uninstall operations

---
*Phase: 174-platform-registry-config-engine*
*Completed: 2026-04-15*
