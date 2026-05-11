---
phase: 258
plan: 02
subsystem: mcp-package
tags:
  - mcp
  - version-bump
  - breaking-change
  - parity-test
  - migration-05
dependency_graph:
  requires:
    - 258-01 (TOOL_REMOVED + stub conversion landed; rebuild step picks up those compiled outputs)
  provides:
    - "fsb-mcp-server@0.9.0 in-tree (npm publish remains user-gated)"
    - "tests/mcp-version-parity.test.js gates against future drift at 0.9.0"
  affects:
    - mcp/build/version.js (regenerated)
    - mcp/build/version.d.ts (regenerated)
    - All MCP catalogs that read mcp/server.json (advertised version now 0.9.0)
tech_stack:
  added: []
  patterns:
    - "Four-file lockstep version bump (version.ts + package.json + server.json + parity test canonicalVersion)"
    - "TypeScript rebuild step after source bump regenerates the compiled artifact the CLI subprocesses read"
key_files:
  created:
    - .planning/phases/258-removal-migration-errors-package-0.9.0/258-02-SUMMARY.md
    - .planning/phases/258-removal-migration-errors-package-0.9.0/deferred-items.md
  modified:
    - mcp/src/version.ts
    - mcp/package.json
    - mcp/server.json
    - tests/mcp-version-parity.test.js
    - mcp/build/version.js
    - mcp/build/version.d.ts
decisions:
  - "Honored 258-CONTEXT.md 'Version bump: in-tree only' decision -- no npm publish executed; the publish remains user-gated per v0.9.60 / v0.9.61 precedent."
  - "Out-of-scope drift in mcp/build/install.js (pre-existing source-to-build drift from earlier install.ts copy work) logged to deferred-items.md instead of being silently rolled into this commit -- per GSD SCOPE BOUNDARY rule."
  - "Committed the two rebuilt artifacts (build/version.js + build/version.d.ts) alongside the four source bumps in a single atomic commit so the parity test's CLI-output assertions (which spawn node mcp/build/index.js help/install) pass against the committed tree, not a transient in-memory build state."
metrics:
  duration_minutes: 8
  completed_at: "2026-05-11T19:48:33Z"
  tasks_completed: 2
  files_modified: 6
  commits: 1
---

# Phase 258 Plan 02: Version Bump 0.8.0 -> 0.9.0 Summary

Bumped `fsb-mcp-server` from `0.8.0` to `0.9.0` across all four sources of truth in lockstep, regenerated the TypeScript build artifact via `cd mcp && npm run build`, and confirmed both the targeted parity test and the full `npm test` chain exit 0 against the new version. The npm publish step remains user-gated and was NOT executed.

## What Landed

### Source-file substitutions (4 sources, 5 literal edits)

| File | Line | Old | New |
|------|------|-----|-----|
| `mcp/src/version.ts` | 2 | `export const FSB_MCP_VERSION = '0.8.0';` | `export const FSB_MCP_VERSION = '0.9.0';` |
| `mcp/package.json` | 3 | `"version": "0.8.0",` | `"version": "0.9.0",` |
| `mcp/server.json` | 6 | `"version": "0.8.0",` (top-level) | `"version": "0.9.0",` |
| `mcp/server.json` | 11 | `"version": "0.8.0",` (packages[0]) | `"version": "0.9.0",` |
| `tests/mcp-version-parity.test.js` | 25 | `const canonicalVersion = '0.8.0';` | `const canonicalVersion = '0.9.0';` |

Non-version content in each edited file is byte-for-byte unchanged (verified: FSB_SERVER_NAME, FSB_EXTENSION_BRIDGE_PORT, FSB_EXTENSION_BRIDGE_URL, DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT, FSB_REGISTRY_NAME preserved in version.ts; name, license, scripts, dependencies, devDependencies, mcpName, repository, keywords, type, main, bin, files, engines preserved in package.json; $schema, name, title, description, packages[].registryType, packages[].identifier, packages[].transport preserved in server.json; extractRuntimeVersion, collectExplicitVersions, runCommand, readText, readJson, assert, assertEqual, run() body preserved in the parity test).

### Build step

`cd mcp && npm run build` ran `npm run clean && tsc && cp ../extension/ai/tool-definitions.js ai/tool-definitions.cjs` and exited 0. The clean step no-op'd (no stale `build/test-config-engine.js`), `tsc` regenerated `mcp/build/*` from source, and `cp` refreshed the tool-definitions parity copy. The two regenerated files whose contents tie to FSB_MCP_VERSION are:

- `mcp/build/version.js` line 2: now reads `export const FSB_MCP_VERSION = '0.9.0';` plus the preserved `//# sourceMappingURL=version.js.map` tail.
- `mcp/build/version.d.ts` line 2: now reads `export declare const FSB_MCP_VERSION = "0.9.0";`.

The rebuild also touched `mcp/build/install.js`, but that diff was pre-existing source-to-build drift unrelated to the version bump -- logged to `deferred-items.md` (see Deferred Issues below).

### Atomic commit

Commit `23e66bd` -- `feat(258-02): bump fsb-mcp-server 0.8.0 -> 0.9.0 across version.ts + package.json + server.json + parity test + rebuild (MIGRATION-05)` -- lands all 6 in-scope files together:

```
mcp/build/version.d.ts
mcp/build/version.js
mcp/package.json
mcp/server.json
mcp/src/version.ts
tests/mcp-version-parity.test.js
```

Commit message references MIGRATION-05 (subject + body, 2 occurrences) and 258-02 (subject, 1 occurrence).

## Verification

### Targeted parity test

```
$ node tests/mcp-version-parity.test.js

--- metadata parity ---
  PASS: mcp/package.json version stays on canonical version parity target (expected: 0.9.0, got: 0.9.0)
  PASS: FSB_MCP_VERSION matches canonical package version (expected: 0.9.0, got: 0.9.0)
  PASS: server.json top-level version matches canonical package version (expected: 0.9.0, got: 0.9.0)
  PASS: server.json package version matches canonical package version (expected: 0.9.0, got: 0.9.0)

--- cli output parity ---
  PASS: help output prints canonical MCP version
  PASS: install output prints canonical MCP version

--- docs flow parity ---
  PASS: mcp README mentions doctor
  PASS: mcp README mentions status --watch
  PASS: root README mentions doctor
  PASS: root README mentions status --watch

=== Results: 10 passed, 0 failed ===
```

Exit 0. 10/10 PASS. All four metadata-parity assertions PASS, both CLI-output parity assertions PASS, all four docs-flow assertions PASS.

### Full test chain

```
$ npm test
...
=== Results: 80 passed, 0 failed ===
=== Results: 17 passed, 0 failed ===
... (44 result blocks total)
=== Results: 48 passed, 0 failed ===
All checks passed.
```

Exit 0. Zero `FAIL:` lines across the entire chain. The npm test pipeline calls `npm --prefix mcp run build` before the parity test, so the in-tree rebuild was re-validated by the test harness itself.

### CLI prints 0.9.0

```
$ node mcp/build/index.js help | head -1
FSB MCP Server 0.9.0

$ node mcp/build/index.js install | head -1
FSB MCP Server 0.9.0
```

### README explicit-version scan

`grep -nE "fsb-mcp-server@0\.8\.0|FSB MCP Server 0\.8\.0" mcp/README.md README.md` returned zero matches -- the parity test's `collectExplicitVersions` scan found no explicit version references in either README, so no README edits were needed (which matches the plan's `read_first` precondition).

### Zero stale 0.8.0 literals in source files

```
$ grep -nE "0\.8\.0" mcp/src/version.ts mcp/package.json mcp/server.json tests/mcp-version-parity.test.js
(no output -- exit 1)
```

### Build artifact at 0.9.0

```
$ grep -c "FSB_MCP_VERSION = '0.9.0'" mcp/build/version.js
1
$ grep -c "0\.8\.0" mcp/build/version.js
0
```

## Deviations from Plan

None. Plan executed exactly as written.

## Deferred Issues

### mcp/build/install.js -- pre-existing source-to-build drift

**Discovered during:** Task 2 Step 2.1 (`cd mcp && npm run build`).

**What:** The rebuild step regenerated `mcp/build/install.js`. The resulting diff is NOT the version bump -- it is copy text in the OpenClaw section of `getSetupSections()` (canonical install via skills/FSB Skill/, consent-gated install for other detected MCP hosts, manual stdio fallback). Inspection shows the source `mcp/src/install.ts` already carries the new copy; the build was simply never rerun + committed in the plan that owned the install copy work. The next `npm run build` (this plan's) picked up the source-to-build drift.

**Scope:** Out of Plan 258-02 (this plan is strictly the version bump per 258-CONTEXT.md "Version bump: in-tree only"). Per GSD SCOPE BOUNDARY: only auto-fix issues DIRECTLY caused by the current task's changes. The install.js drift pre-dates this rebuild (it was unstaged at session start: `M mcp/build/install.js` appeared in the initial git status).

**Logged to:** `.planning/phases/258-removal-migration-errors-package-0.9.0/deferred-items.md`.

**Disposition:** Left unstaged in the working tree for a future plan owning install copy work to pick up.

## Authentication Gates

None. No auth gates were hit during execution.

## Self-Check

- [x] `mcp/src/version.ts` line 2 reads `FSB_MCP_VERSION = '0.9.0'` -- verified.
- [x] `mcp/package.json` line 3 reads `"version": "0.9.0"` -- verified.
- [x] `mcp/server.json` lines 6 + 11 both read `"version": "0.9.0"` -- verified (grep count = 2).
- [x] `tests/mcp-version-parity.test.js` line 25 reads `canonicalVersion = '0.9.0'` -- verified.
- [x] `mcp/build/version.js` line 2 reads `FSB_MCP_VERSION = '0.9.0'` after rebuild -- verified.
- [x] `node tests/mcp-version-parity.test.js` exits 0 with 10/10 PASS -- verified.
- [x] `node mcp/build/index.js help` prints `FSB MCP Server 0.9.0` -- verified.
- [x] `node mcp/build/index.js install` prints `FSB MCP Server 0.9.0` -- verified.
- [x] `npm test` exits 0 with zero FAIL lines -- verified.
- [x] Single atomic commit (23e66bd) lands all 6 in-scope files together -- verified via `git log -1 --name-only 23e66bd`.
- [x] Commit message references MIGRATION-05 and 258-02 -- verified.
- [x] `npm publish` was NOT executed -- verified (no publish in command history).
- [x] ASCII-only edits, no emojis, no em-dashes between sentences (uses `--`).
- [x] On branch `refinements`.

## Self-Check: PASSED
