---
phase: 249-skill-md-scripts
plan: 03
subsystem: skill
tags: [skill, openclaw, stdio, mcp-config, parity, esm, mjs]

# Dependency graph
requires:
  - phase: 248-skill-spec-research
    provides: OpenClaw stdio config block shape verified; STDIO_COMMAND source-of-truth at mcp/src/install.ts:28
provides:
  - Canonical OpenClaw stdio MCP config block printer at skills/FSB Skill/scripts/print-stdio.mjs
  - Hard-coded BLOCK literal mirroring mcp/src/install.ts (parity-verifiable byte-for-byte)
  - Defense-in-depth runtime self-validation (JSON.parse + structural assertion)
affects:
  - 251-skill-tests (TEST-03 enforces byte-level parity between this script and mcp/src/install.ts)
  - 252-skill-readme (skill docs reference print-stdio.mjs as the print surface)
  - 253-skill-publish (script ships in skill bundle to ClawHub)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Print-not-write for OpenClaw config (config schema unstable across builds; user pastes block manually)"
    - "Hard-coded literal blocks for byte-for-byte parity verification at CI time"
    - "process.stdout.write over console.log (preserves trailing newlines + zero spurious whitespace)"

key-files:
  created:
    - "skills/FSB Skill/scripts/print-stdio.mjs"
  modified: []

key-decisions:
  - "BLOCK constant is a hard-coded template literal (not built dynamically) so Phase 251 TEST-03 can assert byte-for-byte parity against mcp/src/install.ts"
  - "Used process.stdout.write instead of console.log to preserve exact trailing newlines required by parity contract"
  - "Self-validation uses structural property checks instead of JSON.stringify (Task 2 explicitly forbids JSON.stringify)"
  - "Parity contract documented in top-of-file comment block referencing install.ts:28 and lines 170-176, plus Phase 251 TEST-03 enforcement"

patterns-established:
  - "Skill scripts must be runtime-self-contained: no import or read of mcp/src/* (skill ships separately to ClawHub)"
  - "Cross-platform discipline: pure stdout writes, no shell-specific tokens, no OS paths, LF line endings, ASCII-only"

requirements-completed: [SKILL-04, SKILL-06]

# Metrics
duration: ~5min
completed: 2026-05-08
---

# Phase 249 Plan 03: scripts/print-stdio.mjs Summary

**ESM script that prints the canonical OpenClaw stdio MCP config block (parity-locked with mcp/src/install.ts:28 STDIO_COMMAND and lines 170-176 Claude Desktop section) for users to paste into OpenClaw's MCP config.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-08T15:35Z (approx)
- **Completed:** 2026-05-08T15:40:33Z
- **Tasks:** 2 (1 implementation, 1 cross-platform self-test)
- **Files created:** 1

## Accomplishments
- Authored skills/FSB Skill/scripts/print-stdio.mjs as a self-contained ESM script
- Hard-coded BLOCK template literal mirrors mcp/src/install.ts (STDIO_COMMAND constant at line 28; Claude Desktop section at lines 170-176)
- Defense-in-depth self-validation: JSON.parse + structural property assertions before printing; fails to stderr with exit 1 on drift
- Print sequence uses process.stdout.write (not console.log) to preserve exact byte sequence required by Phase 251 TEST-03 parity contract
- Header line "Paste this into your OpenClaw MCP config:" before block; footer references install.ts getSetupSections() as source of truth

## Task Commits

1. **Task 1: Implement print-stdio.mjs canonical block printer (SKILL-04)** - `0d399d3` (feat)
2. **Task 2: Cross-platform self-test for print-stdio.mjs (SKILL-06)** - no file changes (verify-only); all six discipline checks passed against the Task 1 commit

## Files Created/Modified
- `skills/FSB Skill/scripts/print-stdio.mjs` - Canonical OpenClaw stdio config block printer. ESM, no imports, no filesystem reads, no JSON.stringify, no shell-specific tokens, ASCII-only, LF line endings.

## Verification Results

Task 1 automated verification:
- File exists, shebang `#!/usr/bin/env node` on line 1
- Parity comment present (`Block parity with mcp/src/install.ts`)
- Contains literals: `"mcpServers"`, `"fsb"`, `"command": "npx"`, `"args": ["-y", "fsb-mcp-server"]`
- Header line and footer reference to `install.ts getSetupSections` both present
- No `require(`, no non-ASCII bytes, no CRLF
- `node --check` passes
- Live run round-trips to canonical JSON: `{"mcpServers":{"fsb":{"command":"npx","args":["-y","fsb-mcp-server"]}}}`

Task 2 cross-platform discipline (all six pass):
1. ESM parse via `node --check` - OK
2. No shell-specific tokens (cmd.exe, powershell, bash, sh -c) - OK
3. No hard-coded OS paths - OK
4. No filesystem reads (readFile, node:fs) - OK
5. No JSON.stringify (BLOCK is literal) - OK
6. Live run: header on line 1, JSON parses to canonical structure, footer references install.ts getSetupSections - OK

## Decisions Made
- **Hard-coded literal BLOCK:** Required so Phase 251 TEST-03 can perform byte-for-byte parity check against mcp/src/install.ts. Building the JSON dynamically with JSON.stringify would defeat the parity contract.
- **process.stdout.write instead of console.log:** console.log appends a newline and may interact badly with multi-line strings; process.stdout.write gives exact byte control needed for parity.
- **Structural self-check (no JSON.stringify):** Task 2 forbids JSON.stringify, so the defense-in-depth validation walks the parsed object's properties directly to confirm canonical shape.
- **No imports of any kind:** Skill ships separately to ClawHub, so the script cannot reference `mcp/src/install.ts` at runtime even though that file is the parity source of truth.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial draft used `JSON.stringify` for the structural assertion. Re-read Task 2 acceptance criteria, which explicitly forbids `JSON.stringify` anywhere in the file (the BLOCK must be a literal so parity is byte-verifiable). Rewrote the assertion using direct property/array checks before any commit. Not a deviation; caught and resolved before first commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- print-stdio.mjs is production-ready and parity-locked.
- Phase 251 TEST-03 can now assert byte-level parity between this script's BLOCK and mcp/src/install.ts at CI time.
- Phase 250 references and Phase 252 README updates can reference this script as the canonical "print surface" for OpenClaw stdio config.
- No blockers.

## Self-Check: PASSED

- `skills/FSB Skill/scripts/print-stdio.mjs` exists on disk
- `.planning/phases/249-skill-md-scripts/249-03-SUMMARY.md` exists on disk
- Commit `0d399d3` exists in `git log --oneline --all`

---
*Phase: 249-skill-md-scripts*
*Completed: 2026-05-08*
