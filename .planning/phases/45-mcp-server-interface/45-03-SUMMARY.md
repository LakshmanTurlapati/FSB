---
phase: 45-mcp-server-interface
plan: 03
subsystem: mcp
tags: [mcp, resources, prompts, native-messaging, chrome-extension, zod]

requires:
  - phase: 45-01
    provides: "McpServer instance, NativeMessagingBridge class, project infrastructure"
provides:
  - "5 MCP resource registrations (DOM, tabs, site guides, memory, config)"
  - "4 MCP prompt template registrations (search-and-extract, fill-form, monitor-page, navigate-and-read)"
  - "Cross-platform native host manifest installer (macOS, Linux, Windows)"
  - "Native host manifest template (com.fsb.mcp.json)"
  - ".mcp.json for Claude Code auto-discovery"
affects: [45-04]

tech-stack:
  added: []
  patterns:
    - "registerResource pattern: check bridge.isConnected, sendAndWait, return contents array"
    - "registerPrompt pattern: Zod args schema, return messages array with user role"

key-files:
  created:
    - mcp-server/src/resources/index.ts
    - mcp-server/src/prompts/index.ts
    - mcp-server/native-host-manifest/com.fsb.mcp.json
    - mcp-server/scripts/install-host.cjs
    - .mcp.json
  modified:
    - mcp-server/src/index.ts

key-decisions:
  - "Used registerResource/registerPrompt (not deprecated resource/prompt methods) for SDK forward-compat"
  - "Renamed install-host.js to .cjs because package.json type:module makes .js files ESM"

patterns-established:
  - "Resource handler pattern: bridge connectivity check -> sendAndWait -> JSON contents response"
  - "Prompt handler pattern: Zod schema args -> interpolated instruction messages"

requirements-completed: [MCP-08, MCP-09, MCP-10, MCP-11]

duration: 5min
completed: 2026-03-18
---

# Phase 45 Plan 03: Resources, Prompts, Native Host & Config Summary

**5 MCP resources (DOM, tabs, guides, memory, config) and 4 prompt templates with cross-platform native host installer and Claude Code .mcp.json**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T01:58:52Z
- **Completed:** 2026-03-18T02:04:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Registered 5 MCP resources exposing FSB's data (DOM snapshot, open tabs, site guides, memory, extension config) with bridge connectivity checks
- Registered 4 MCP prompt templates (search-and-extract, fill-form, monitor-page, navigate-and-read) with Zod arg schemas
- Created cross-platform native host manifest installer supporting macOS, Linux, and Windows with --uninstall
- Added .mcp.json at repo root for Claude Code auto-discovery of FSB MCP server

## Task Commits

Each task was committed atomically:

1. **Task 1: Register MCP resources and prompt templates** - `317f8c0` (feat)
2. **Task 2: Create native host manifest, install script, .mcp.json config, and wire entry point** - `bde5c0e` (feat)
3. **Fix: Rename install-host.js to .cjs** - `b52442e` (fix)

## Files Created/Modified
- `mcp-server/src/resources/index.ts` - 5 MCP resource registrations with bridge connectivity checks
- `mcp-server/src/prompts/index.ts` - 4 MCP prompt template registrations with Zod schemas
- `mcp-server/native-host-manifest/com.fsb.mcp.json` - Template native messaging host manifest
- `mcp-server/scripts/install-host.cjs` - Cross-platform native host installer (macOS/Linux/Windows)
- `.mcp.json` - Claude Code MCP server auto-discovery config
- `mcp-server/src/index.ts` - Wired registerResources and registerPrompts calls

## Decisions Made
- Used `registerResource` and `registerPrompt` (not deprecated `resource`/`prompt` methods) for SDK forward-compatibility
- Renamed install-host.js to .cjs because package.json has `"type": "module"` making all .js files ESM by default, while the install script uses CommonJS require()

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed install-host.js to install-host.cjs**
- **Found during:** Task 2 verification
- **Issue:** Package uses `"type": "module"`, so `.js` files are treated as ESM. The install script uses CommonJS `require()` which fails in ESM context.
- **Fix:** Renamed to `.cjs` extension and updated package.json script reference
- **Files modified:** mcp-server/scripts/install-host.cjs, mcp-server/package.json
- **Verification:** `node scripts/install-host.cjs --help` runs successfully
- **Committed in:** b52442e

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for script usability. No scope creep.

## Issues Encountered
None beyond the .cjs rename noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All MCP server features (tools, resources, prompts) are now registered
- Native host installer ready for user setup
- .mcp.json enables one-step Claude Code integration
- Plan 04 (testing/integration) can proceed

## Self-Check: PASSED

All 5 created files verified present. All 3 commit hashes verified in git log.

---
*Phase: 45-mcp-server-interface*
*Completed: 2026-03-18*
