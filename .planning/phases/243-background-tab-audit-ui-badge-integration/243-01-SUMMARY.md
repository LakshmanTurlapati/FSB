---
phase: 243
plan: 01
subsystem: background-tab-audit
tags: [background-tab, foreground-audit, force-foreground, tool-definitions, mcp-dispatcher, autopilot, BG-01, BG-02, BG-03, phase-244-followup]
requires: [phase-237, phase-240, phase-241]
provides: [_forceForeground per-tool flag, switch_tab foreground gate (MCP + autopilot), 243-BACKGROUND-TAB-AUDIT.md, tests/foreground-audit.test.js]
affects: [extension/ai/tool-definitions.js, extension/ws/mcp-tool-dispatcher.js, extension/ai/tool-executor.js]
tech_stack_added: []
tech_stack_patterns: [per-tool boolean discriminator on registry entries, dispatcher gate via tool-def lookup, doc-as-test invariant via grep]
key_files_created:
  - tests/foreground-audit.test.js
  - .planning/phases/243-background-tab-audit-ui-badge-integration/243-BACKGROUND-TAB-AUDIT.md
key_files_modified:
  - extension/ai/tool-definitions.js
  - extension/ws/mcp-tool-dispatcher.js
  - extension/ai/tool-executor.js
decisions:
  - Per-tool _forceForeground flag is the SSOT (D-01); switch_tab is the only opt-in; all 49 other tools default false.
  - Both MCP route (handleSwitchTabRoute) and autopilot route (case 'switch_tab') gate behind the same flag, lookup via _mcp_getToolByName / _te_getToolByName.
  - Background-safe branch resolves chrome.tabs.get for return-shape parity without stealing focus.
  - setTimeout >= 30s migrations: ZERO this phase (per D-02). 12 entries in 1-30s band documented as Phase 244 follow-ups.
metrics:
  duration_minutes: 25
  tasks_completed: 3
  tests_added: 1
  test_assertions: 14
  files_created: 2
  files_modified: 3
  completed: 2026-05-05
---

# Phase 243 Plan 01: Foreground Audit + _forceForeground Flag + setTimeout Audit Doc Summary

Audited the foreground-steal surface across MCP and autopilot tool dispatch paths, introduced a per-tool `_forceForeground` boolean (default false; switch_tab=true), gated the `chrome.tabs.update({active:true})` + `chrome.windows.update({focused:true})` calls in both `mcp-tool-dispatcher.js` `handleSwitchTabRoute` and `tool-executor.js` `case 'switch_tab'` behind that flag, and authored `243-BACKGROUND-TAB-AUDIT.md` recording (a) every chrome.tabs.update({active:true}) call site classified by tool-route relevance and (b) the setTimeout audit verdict that ZERO >=30s waits exist, with the 12 1-30s entries handed off as Phase 244 follow-ups.

## Tasks Completed

| # | Task | Commit | Verification |
|---|------|--------|--------------|
| 1 | Wave-0 foreground-audit test scaffold + tool-definitions.js _forceForeground flag | 44453ea | foreground-audit Tests 1+2 GREEN; Tests 3-5 RED as expected |
| 2 | Gate foreground transitions in MCP dispatcher AND autopilot tool-executor | 18d0c9d | foreground-audit Tests 1-4 GREEN; Test 5 RED |
| 3 | Author 243-BACKGROUND-TAB-AUDIT.md and close foreground-audit.test.js | 3174cd6 | foreground-audit 14/14 GREEN |

## Files Created

- `tests/foreground-audit.test.js` — 14 invariants across 5 test groups: tool-def shape, source-text grep, dispatcher gate window-grep, executor gate window-grep, audit doc canonical phrases.
- `.planning/phases/243-background-tab-audit-ui-badge-integration/243-BACKGROUND-TAB-AUDIT.md` — 4 sections (foreground audit, setTimeout audit, Phase 244 follow-up list, verdict).

## Files Modified

- `extension/ai/tool-definitions.js` — `_forceForeground` added to all 50 tool definitions; only `switch_tab` is `true`. Comment block above switch_tab's flag cites D-01.
- `extension/ws/mcp-tool-dispatcher.js` — `handleSwitchTabRoute` reads tool def via `_mcp_getToolByName('switch_tab')` and gates the `chrome.tabs.update({active:true})` + `chrome.windows.update({focused:true})` calls behind `_forceForeground === true`. Background-safe branch resolves `chrome.tabs.get` for return-shape parity.
- `extension/ai/tool-executor.js` — autopilot `case 'switch_tab'` mirrors the same gate via `_te_getToolByName('switch_tab')`.

## Foreground Audit Verdict (BG-01)

- **8 chrome.tabs.update({active:true}) call sites total** across the codebase (per RESEARCH); **4 in MCP/autopilot tool routes** (mcp-tool-dispatcher.js:376/381 and tool-executor.js:274/279, post-fix line numbers) — all 4 are `switch_tab` and all 4 are gated behind `_forceForeground`.
- **7 out-of-scope sites** (BFCache recovery, smart-tab routing inside `handleStartAutomation`, legacy popup/sidepanel UI handlers, site-explorer back-switch). These are NOT MCP tool routes; they are documented in Section 1 of the audit doc for awareness.
- **switch_tab is the only tool with `_forceForeground: true`** (D-01); all 49 other tools default `false`.
- **open_tab is already background-safe** — it honors `params.active !== false` per `tool-executor.js`; the MCP route does not call `chrome.tabs.update({active:true})` after creation.

## setTimeout Audit Verdict (BG-03)

- **ZERO setTimeout >= 30s exist** across the audited files (`mcp-tool-dispatcher.js`, `agent-loop.js`, `background.js`, `content/lifecycle.js`).
- **Longest setTimeout: 10000ms** at `extension/background.js:6404` (navigation watchdog).
- **No chrome.alarms migrations performed** this phase per CONTEXT D-02 (chrome.alarms 30s floor).
- **12 entries in 1-30s band** documented as Phase 244 follow-ups in Section 3 of the audit doc.

## Test Results

`node tests/foreground-audit.test.js` → **14 passed, 0 failed** (exit 0).

| Test group | Assertions | Status |
|------------|-----------|--------|
| Test 1: tool-definitions.js _forceForeground shape | 5 | PASS |
| Test 2: tool-definitions.js grep _forceForeground:true | 2 | PASS |
| Test 3: mcp-tool-dispatcher.js gates active:true behind _forceForeground | 2 | PASS |
| Test 4: tool-executor.js gates active:true behind _forceForeground | 2 | PASS |
| Test 5: 243-BACKGROUND-TAB-AUDIT.md presence + canonical phrases | 3 | PASS |

## Regression Status

- `node tests/tool-executor-readonly.test.js` — 35/35 PASS (Phase 200-series stuck-detection invariants).
- `node tests/mcp-tool-routing-contract.test.js` — 144/144 PASS (Phase 199 + observability route contracts).
- `node tests/runtime-contracts.test.js` — 13/13 PASS.
- `node tests/agent-sunset-back-end.test.js` — all checks PASS (Phase 211/212 sunset annotations).
- `tests/mcp-restricted-tab.test.js` and `tests/mcp-bridge-topology.test.js` show **pre-existing** failures rooted in missing `mcp/build/` TypeScript artifacts (the worktree's `mcp/` build was never produced; `npm --prefix mcp run build` itself shows pre-existing TS7031 errors in `src/tools/visual-session.ts`). These failures are unrelated to this plan; they predate the 243-01 changes and are out of scope per the deviation Rule 0 (scope boundary).

## Deviations from Plan

### Rule 3 (auto-fix blocking) deviations

**1. [Rule 3 - File extension] Plan referenced `tool-definitions.cjs`; actual file is `tool-definitions.js`**
- **Found during:** Task 1 read-first phase
- **Issue:** Plan frontmatter and CONTEXT D-01 mention `tool-definitions.cjs`; the file on disk (and all imports throughout the codebase) is `tool-definitions.js` (CommonJS via `module.exports`).
- **Fix:** Used the actual filename `tool-definitions.js` consistently in test, edits, audit doc, and SUMMARY. The functional contract (CommonJS export of `TOOL_REGISTRY`, `getToolByName`) is unchanged.
- **Files modified:** all 4 (test, dispatcher edit, executor edit, audit doc)
- **No commit-level deviation:** this is a naming reconciliation; the per-task commits use the correct filename.

**2. [Rule 3 - Worktree planning dir] `.planning/phases/243-...` did not exist in worktree**
- **Found during:** Task 3 audit-doc write
- **Issue:** Worktree was branched off an older base (commit `0c0be6f`); the phase 243 directory exists in the main repo but not in the worktree.
- **Fix:** Created the directory with `mkdir -p` before authoring `243-BACKGROUND-TAB-AUDIT.md`. Used `git add -f` because `.planning/` is in this worktree's `.gitignore`.
- **Files modified:** `.planning/phases/243-background-tab-audit-ui-badge-integration/243-BACKGROUND-TAB-AUDIT.md` (created via mkdir + Write).

### Rule 1/2/4 deviations

**None.** Plan was executed as written; the only adjustments were the `.cjs`->`.js` filename reconciliation and the worktree directory bootstrap.

## Authentication Gates

None encountered.

## Known Stubs

None. All code paths are wired; switch_tab's flag-driven branch returns the same shape as the legacy implementation.

## BG-01 / BG-02 / BG-03 Closure

- **BG-01 closed.** 100% of the 25+ tools audited; only `switch_tab` opts into `_forceForeground`. All chrome.tabs.update({active:true}) sites in MCP / autopilot tool routes are gated.
- **BG-02 closed.** Per-tool flag wired in `tool-definitions.js` (50 occurrences; switch_tab=true; 49 false). Both dispatcher and tool-executor honor the flag. `tests/foreground-audit.test.js` enforces the invariant via grep window scan.
- **BG-03 closed.** ZERO setTimeout >= 30s; no chrome.alarms migrations needed this phase. The 12 1-30s entries are tracked as Phase 244 follow-ups by file:line.

## Self-Check: PASSED

- [x] `tests/foreground-audit.test.js` exists at `/Users/lakshmanturlapati/Desktop/FSB/.claude/worktrees/agent-aa327886/tests/foreground-audit.test.js`
- [x] `.planning/phases/243-background-tab-audit-ui-badge-integration/243-BACKGROUND-TAB-AUDIT.md` exists
- [x] Commit `44453ea` (Task 1) present in `git log`
- [x] Commit `18d0c9d` (Task 2) present in `git log`
- [x] Commit `3174cd6` (Task 3) present in `git log`
- [x] `grep -c "_forceForeground:\s*true" extension/ai/tool-definitions.js` → 1
- [x] `grep -c "_forceForeground" extension/ai/tool-definitions.js` → 50
- [x] `grep -c "_forceForeground" extension/ws/mcp-tool-dispatcher.js` → 2
- [x] `grep -c "_forceForeground" extension/ai/tool-executor.js` → 2
- [x] `grep -c "ZERO setTimeout >= 30s" .planning/phases/243-background-tab-audit-ui-badge-integration/243-BACKGROUND-TAB-AUDIT.md` → 2
- [x] `grep -c "Phase 244 follow-up" .planning/phases/243-background-tab-audit-ui-badge-integration/243-BACKGROUND-TAB-AUDIT.md` → 17
- [x] `node tests/foreground-audit.test.js` → 14 passed, 0 failed (exit 0)
