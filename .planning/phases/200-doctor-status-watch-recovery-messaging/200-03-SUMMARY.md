---
phase: 200-doctor-status-watch-recovery-messaging
plan: "03"
subsystem: diagnostics
tags: [mcp, version-parity, docs, doctor, release]

requires:
  - phase: 200-doctor-status-watch-recovery-messaging
    provides: Layered diagnostics vocabulary and `status --watch` behavior from Plan 200-01
provides:
  - Canonical MCP version parity at `0.6.0` across runtime, registry metadata, CLI output, and tests
  - Doctor/status-first troubleshooting flow in the package README and root project README
  - Root-suite parity regression that fails on version drift before later tests run
affects: [phase-200, mcp-versioning, docs, release-surface, npm-test]

tech-stack:
  added: []
  patterns:
    - Canonical MCP version comes from `mcp-server/package.json` and is mirrored by runtime/registry metadata
    - Doctor/status-first troubleshooting guidance is treated as release-critical and covered by automated parity tests

key-files:
  created:
    - tests/mcp-version-parity.test.js
  modified:
    - README.md
    - mcp-server/README.md
    - mcp-server/build/version.d.ts
    - mcp-server/build/version.js
    - mcp-server/server.json
    - mcp-server/src/version.ts
    - package.json

key-decisions:
  - "Treat `mcp-server/package.json` version `0.6.0` as the canonical MCP version source of truth."
  - "Root docs should point users to doctor and status --watch without introducing a second MCP version banner."
  - "Version parity failures should stop the root test suite immediately after diagnostics coverage."

patterns-established:
  - "Explicit README `fsb-mcp-server` version references are allowed only when they match the canonical package version."
  - "CLI usage output is part of the parity contract and is verified by automation."

requirements-completed: [DIAG-01, DIAG-04]

duration: 4min
completed: 2026-04-23
---

# Phase 200 Plan 03: MCP Version Parity and Docs Summary

**The MCP release surface now agrees on `0.6.0`, and the docs consistently route failures through doctor and status watch before manual tinkering.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-23T18:13:03Z
- **Completed:** 2026-04-23T18:16:52Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Aligned `FSB_MCP_VERSION`, `mcp-server/server.json`, and the tracked built version artifacts to the canonical MCP package version `0.6.0`.
- Added doctor/status-first troubleshooting guidance to both the package README and the root project README.
- Added `tests/mcp-version-parity.test.js` and wired it into the root `npm test` sequence immediately after `tests/mcp-diagnostics-status.test.js`.

## Task Commits

Implementation work for this plan shipped in one atomic commit:

1. **Align MCP runtime/registry/docs parity and add regression coverage** - `ea8ed34` (chore)

## Files Created/Modified

- `mcp-server/src/version.ts` - Sets the canonical runtime MCP version to `0.6.0`.
- `mcp-server/server.json` - Aligns registry metadata to the same canonical version.
- `mcp-server/build/version.js` - Updates the tracked built MCP runtime version artifact.
- `mcp-server/build/version.d.ts` - Updates the tracked built MCP version declaration artifact.
- `mcp-server/README.md` - Adds the doctor/status-first troubleshooting flow and refreshes the explicit MCP version reference.
- `README.md` - Adds a short MCP troubleshooting note without introducing a second MCP version banner.
- `tests/mcp-version-parity.test.js` - Verifies metadata, CLI output, and troubleshooting-doc parity.
- `package.json` - Runs the new parity test immediately after diagnostics coverage in the root test suite.

## Decisions Made

- `help` and `install` CLI usage output are part of the parity contract and are now asserted in automation.
- The package README can mention `0.6.0` explicitly because it is the package-specific surface; the root README stays focused on the extension milestone story.
- Version parity is now treated as a release blocker, not a documentation nicety.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept only the generated build artifacts that belong to version parity**
- **Found during:** Verification build
- **Issue:** `npm --prefix mcp-server run build` regenerated unrelated `mcp-server/ai/tool-definitions.cjs` drift again while also updating the tracked built version files needed for this plan.
- **Fix:** Kept `mcp-server/build/version.js` and `mcp-server/build/version.d.ts` because they are part of the version parity surface, and restored the unrelated tool-definition copy.
- **Files modified:** `mcp-server/build/version.js`, `mcp-server/build/version.d.ts`
- **Verification:** `git diff --stat`
- **Committed in:** `ea8ed34`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The plan stayed within scope and the tracked package artifacts now match the intended parity surface.

## Issues Encountered

- None beyond the recurring ignored-build artifact churn handled during staging.

## Verification

- `npm --prefix mcp-server run build`
- `node tests/mcp-version-parity.test.js`
- `node tests/mcp-diagnostics-status.test.js`
- `node mcp-server/build/index.js help`
- `node mcp-server/build/index.js install`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 200-02. The remaining work is now purely the layer-aware MCP error messaging slice; the diagnostic vocabulary and version/doc surface are already stable.

---
*Phase: 200-doctor-status-watch-recovery-messaging*
*Completed: 2026-04-23*
