---
phase: 244
plan: 03
subsystem: mcp-release-engineering
tags:
  - mcp
  - release
  - version-bump
  - sdk-upgrade
  - changelog
  - readme
  - tag-ready
dependency-graph:
  requires:
    - 244-01 (multi-agent-regression suite green)
    - 244-02 (tool descriptions document multi-agent contract)
    - Phases 237-243 SUMMARYs (source of CHANGELOG concrete details)
  provides:
    - mcp/package.json @ 0.8.0 with @modelcontextprotocol/sdk ^1.29.0
    - mcp/server.json @ 0.8.0 (top-level + packages[0])
    - mcp/src/version.ts FSB_MCP_VERSION = '0.8.0'
    - mcp/package-lock.json with @modelcontextprotocol/sdk@1.29.0 resolved
    - mcp/CHANGELOG.md (new file, 79 lines) with the 0.8.0 entry
    - mcp/README.md What's New In v0.8.0 + Multi-Agent Contract section + Releasing 0.8.0
  affects:
    - tag-driven release workflow (USER action; this plan stops at tag-ready state)
    - Phase 244 audit / complete-milestone / cleanup chain (downstream of this plan)
tech-stack:
  added: []
  patterns:
    - "tag-ready state convention: autonomous mode prepares the bump + lockfile + docs, stops short of npm publish per CONTEXT D-06"
    - "version.ts / package.json / server.json triple-bump (release-checks invariant from existing README)"
key-files:
  created:
    - mcp/CHANGELOG.md
  modified:
    - mcp/package.json
    - mcp/server.json
    - mcp/src/version.ts
    - mcp/package-lock.json
    - mcp/README.md
decisions:
  - "@modelcontextprotocol/sdk ^1.29.0 chosen as the highest stable 1.29.x at execute time (npm view returned only 1.29.0 in the 1.29.x band; no 1.30.x stable exists yet)"
  - "Triple-version bump: package.json + server.json + src/version.ts (mcp/src/version.ts is the runtime constant the README's release-checks list flags as a release-time invariant)"
  - "CHANGELOG.md created (did not exist pre-plan); 79 lines, 0.8.0 section first, 0.7.4 noted as historical reference pointing back to README"
  - "README: added What's New In v0.8.0 ABOVE the existing 0.7.4 block (preserved as historical context per plan recommendation); added new top-level Multi-Agent Contract (v0.8.0) section between Visual Session Lifecycle and Tools; appended Releasing 0.8.0 sub-section under Versioning that flags npm publish as USER ACTION"
  - "npm publish was NOT run by this plan (CONTEXT D-06); the plan ends at tag-ready state and prints the ready-to-publish marker for the user"
  - "Tool count not changed in README header (still '59 Total') because the back tool plus tool description updates from 244-02 do not change the count; back is registered under autopilot/manual surfaces tracked separately and the public count contract docs the registered MCP handlers"
metrics:
  tasks: 3
  commits: 3
  files_created: 1
  files_modified: 5
  duration_min: 12
  completed: 2026-05-06
requirements-completed: [MCP-01, MCP-02, MCP-08]
---

# Phase 244 Plan 03: MCP 0.8.0 Release Engineering Summary

Bumped `fsb-mcp-server` from `0.7.4` to `0.8.0`, upgraded `@modelcontextprotocol/sdk` from `^1.27.1` to `^1.29.0`, regenerated the lockfile, rebuilt the package clean, authored a new `mcp/CHANGELOG.md` documenting the v0.9.60 milestone landings, updated `mcp/README.md` with a `What's New In v0.8.0` section, a Multi-Agent Contract section, and a `Releasing 0.8.0` user-action note. The build is tag-ready; `npm publish` was not executed (CONTEXT D-06; deferred to the user via the tag-driven release workflow).

## Tasks Completed

| # | Task | Commit | Verification |
|---|------|--------|--------------|
| 1 | Pre-flight green; bump versions; SDK ^1.27.1 -> ^1.29.0; rebuild | 6ee61d9 | package.json/server.json/version.ts at 0.8.0; lockfile resolves SDK 1.29.0; build exits 0; multi-agent-regression 6/6 PASS |
| 2 | Create mcp/CHANGELOG.md with 0.8.0 entry | 1a0629f | 79 lines; contains 0.8.0 header, AGENT_CAP_REACHED, TAB_NOT_OWNED, back, run_task, sdk reference |
| 3 | Update mcp/README.md (What's New + Multi-Agent Contract + Releasing 0.8.0); test sweep | 36f388a | Sections present; 8/8 representative test sweep PASS |

## SDK Upgrade Detail

- Discovery query: `npm view @modelcontextprotocol/sdk versions --json` returned `1.29.0` as the only `1.29.x` version (no `1.30.x` stable exists at execute time).
- Choice: `^1.29.0` -- preserves caret semantics so any future `1.29.x` patch is picked up automatically.
- Lockfile resolved exact: `@modelcontextprotocol/sdk@1.29.0` at `https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.29.0.tgz`.
- Build duration: 2 seconds. Zero TypeScript breakage from the `1.27 -> 1.29` minor bump (no renamed types or removed exports surfaced in the FSB MCP server import surface).

## Test Sweep Results

Representative subset across Phases 237-243 + Phase 244 plan 01 regression suite (per CONTEXT D-04 / VALIDATION.md SC#1 "must pass UNCHANGED"):

| File | Phase | Result |
|------|-------|--------|
| tests/agent-registry.test.js | 237 | PASS |
| tests/agent-scope.test.js | 238 | PASS |
| tests/run-task-cleanup-paths.test.js | 239 | PASS |
| tests/agent-id-threading.test.js | 240 | PASS |
| tests/agent-cap.test.js | 241 | PASS |
| tests/back-tool.test.js | 242 | PASS |
| tests/foreground-audit.test.js | 243 | PASS |
| tests/multi-agent-regression.test.js | 244-01 | PASS (6/6 cases) |

Sweep duration: ~0 seconds wall (subsecond per file).

## CHANGELOG.md Stats

- Path: `mcp/CHANGELOG.md` (new file, 79 lines)
- Sections under `## 0.8.0 (2026-05-06)`:
  - Multi-Agent Tab Concurrency
  - `back` MCP Tool (BACK-01..05)
  - `run_task` Return-on-Completion (Phase 236 reborn -- MCP-03..06)
  - Tool Description Updates (MCP-07)
  - UI / Observability
  - Background-Tab Execution
  - Dependencies
  - Migration Notes
  - Tests
- Single-source-of-truth bullets cite their landing phase by number.

## README.md Sections Added / Modified

- New: `### What's New In v0.8.0` (~17 bullets) inserted above the preserved `### What's New In v0.7.4` block.
- New: `## Multi-Agent Contract (v0.8.0)` (top-level section) covering Agent identity, Concurrency cap, Ownership enforcement (with the typed-error table), Lock release, Resilience (heartbeat + persistence + sw_evicted), the `back` tool, and Background-tab execution.
- Updated: `### Versioning` copy now reads `0.8.0` / extension `0.9.60` instead of `0.7.4` / `0.9.50`. New bullet added to release-checks list documenting the multi-agent contract surface.
- New: `### Releasing 0.8.0` sub-section under Versioning explicitly flags `npm publish` as USER ACTION via the existing tag-driven workflow (CONTEXT D-06 satisfied).

## Ready-to-Publish Marker (verbatim)

```
[Phase 244 / Plan 03] Ready to publish:
  - mcp/package.json version: 0.8.0
  - mcp/server.json version: 0.8.0
  - @modelcontextprotocol/sdk: ^1.29.0
  - Build: clean
  - Tests: green (8/8 representative sweep + multi-agent-regression 6/6)
  - CHANGELOG: written (mcp/CHANGELOG.md, 79 lines)
  - README: updated (What's New In v0.8.0 + Multi-Agent Contract section + Releasing 0.8.0)
  - npm publish: NOT executed (per CONTEXT D-06; user action via tag-driven workflow)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Triple-bump version.ts alongside package.json + server.json**

- Found during: Task 1 setup
- Issue: The plan's <files> list called out `mcp/package.json`, `mcp/server.json`, and `mcp/package-lock.json` but not `mcp/src/version.ts`. The README's own release-checks list explicitly states `mcp/src/version.ts and mcp/package.json agree.`, and that constant is used at runtime by the MCP server entry. Leaving it at `0.7.4` would have produced a published `0.8.0` package that reports `0.7.4` over the wire.
- Fix: Bumped `FSB_MCP_VERSION` from `'0.7.4'` to `'0.8.0'` in the same Task 1 commit.
- Files modified: `mcp/src/version.ts`
- Commit: 6ee61d9

**2. [Rule 3 - Blocking issue] Working tree restoration before pre-flight**

- Found during: Pre-flight, before Task 1
- Issue: The git worktree for this agent was at base `648f139` after the soft-reset in `<worktree_branch_check>`, but the working tree on disk was missing many Phase 237-243 / 244 source files (extension/utils/agent-registry.js, tests/multi-agent-regression.test.js, .planning/phases/244-* aside from 244-02-SUMMARY.md, etc.). `git status` showed them as `D` (staged deletes) rather than as files that needed checkout. Without restoring them, the regression suite, the build, and the plan-required reads would have all failed.
- Fix: `git checkout HEAD -- .` to materialize HEAD's tree onto disk, then copied the 244-* plan / context / 244-01/02 SUMMARY files into the worktree's `.planning/phases/244-*` directory from the main repo so the executor could read them.
- Files affected: working-tree restoration only; no commit produced (the post-restore tree matched HEAD).

### Auth Gates

None.

## Known Stubs

None. The 0.8.0 build does not introduce any UI-visible stubs.

## Threat Flags

None. This plan modifies metadata, lockfile, and documentation only -- no new network endpoints, auth paths, file-access patterns, or schema changes at trust boundaries beyond what was already shipped in Phases 237-243 (already covered by their threat models).

## Self-Check: PASSED

- mcp/package.json: FOUND (version 0.8.0; sdk ^1.29.0)
- mcp/server.json: FOUND (both version fields 0.8.0)
- mcp/package-lock.json: FOUND (sdk@1.29.0 resolved)
- mcp/src/version.ts: FOUND (FSB_MCP_VERSION = '0.8.0')
- mcp/CHANGELOG.md: FOUND (79 lines, 0.8.0 entry)
- mcp/README.md: FOUND (What's New In v0.8.0 + TAB_NOT_OWNED + AGENT_CAP_REACHED + Releasing 0.8.0)
- Commit 6ee61d9: FOUND in `git log` (chore(244-03): bump fsb-mcp-server to 0.8.0 ...)
- Commit 1a0629f: FOUND in `git log` (docs(244-03): create mcp/CHANGELOG.md ...)
- Commit 36f388a: FOUND in `git log` (docs(244-03): update mcp/README.md ...)
- npm publish was NOT executed: VERIFIED (no publish-related commands appear in the executor's bash log; no .tgz tarball produced; no v0.8.0 git tag created).

## Reminder for User

The actual `npm publish` is your action via the existing tag-driven release workflow. This plan deliberately stopped short. To publish:

```
git tag v0.8.0 && git push origin v0.8.0
```

(Or, manually from a clean working tree on the release branch: `cd mcp && npm publish`.)

Ready to publish: run `git tag v0.8.0 && git push origin v0.8.0`
