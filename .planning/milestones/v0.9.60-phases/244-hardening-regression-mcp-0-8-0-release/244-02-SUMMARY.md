---
phase: 244
plan: 02
subsystem: mcp-tool-descriptions
tags:
  - mcp
  - documentation
  - multi-agent-contract
  - mcp-07
dependency_graph:
  requires:
    - Phase 240 (ownership dispatch gate; typed reject codes)
    - Phase 241 (connection_id threading)
    - Phase 242 (back tool registration)
    - Phase 243 (tool-definitions.js _forceForeground)
  provides:
    - MCP-07 closed: every tool documents the v0.9.60 multi-agent contract
    - Cross-file enumeration of typed reject codes (AGENT_CAP_REACHED, TAB_NOT_OWNED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE)
    - Tool-specific error code enumeration on back (NO_BACK_HISTORY, CROSS_ORIGIN, BF_CACHE, FRAGMENT_ONLY)
  affects:
    - Plan 03 (release engineering): CHANGELOG can quote the contract block; published 0.8.0 package carries the contract documentation in published tool schemas
tech_stack:
  added: []
  patterns:
    - Documentation-only edits (string-literal extension) -- no behavior changes
    - Single source of truth: extension/ai/tool-definitions.js -> mcp/ai/tool-definitions.cjs via build-time cp
key_files:
  created: []
  modified:
    - mcp/src/tools/agents.ts
    - mcp/src/tools/autopilot.ts
    - mcp/src/tools/visual-session.ts
    - extension/ai/tool-definitions.js
    - mcp/ai/tool-definitions.cjs (built copy)
decisions:
  - Preserved manual.ts as a pure dynamic loader (no string edits there) per CONTEXT D-02 truth #7; descriptions reach manual tools via TOOL_REGISTRY at runtime
  - Back tool description: kept the existing lowercase status-field documentation (no_history, cross_origin, bf_cache, fragment_only) AND appended uppercase typed error codes (NO_BACK_HISTORY, CROSS_ORIGIN, BF_CACHE, FRAGMENT_ONLY) so both the runtime status enumeration and the typed error catalog are observable
  - stop_task / get_task_status: added the short agent-scoped clause (not the full block) since these are control-plane tools, not tab-bound actions -- matches PLAN action #3 and #4
metrics:
  duration_seconds: 161
  completed: 2026-05-06
---

# Phase 244 Plan 02: MCP Tool Descriptions Multi-Agent Contract Summary

Documentation-only update: appended the v0.9.60 multi-agent contract block (or its single-line tail variant) to every MCP tool description across four source files, closing MCP-07. No behavior changes; mcp build clean; sampled Phase 237-243 regression tests still green.

## What Changed

### Task 1: Server-side TS tool descriptions (3 files, 5 tool entries, 1 short clause)

**mcp/src/tools/agents.ts (back)** -- Appended the full multi-agent contract block plus uppercase tool-specific typed error code enumeration. Existing lowercase status field documentation (no_history, cross_origin, bf_cache, fragment_only) preserved verbatim before the new block. Final tail enumerates: NO_BACK_HISTORY, CROSS_ORIGIN, BF_CACHE, FRAGMENT_ONLY.

**mcp/src/tools/autopilot.ts (run_task)** -- Appended the full multi-agent contract block after the existing "...action log." clause. The existing IMPORTANT clause (manual-tools-first guidance) is preserved verbatim at the start.

**mcp/src/tools/autopilot.ts (stop_task)** -- Appended a short clause: "Agent-scoped: only the calling agent's task is cancelled; cross-agent calls reject with TAB_NOT_OWNED."

**mcp/src/tools/autopilot.ts (get_task_status)** -- Appended a short clause: "Agent-scoped: returns the calling agent's task status only."

**mcp/src/tools/visual-session.ts (start_visual_session, end_visual_session)** -- Appended the full multi-agent contract block to both tool descriptions. Existing client-allowlist + glow-overlay copy preserved.

### Task 2: Manual tool descriptions (50 entries in tool-definitions.js)

**extension/ai/tool-definitions.js** -- Appended the canonical manual-tail sentence to every top-level tool description in TOOL_REGISTRY:

> Multi-agent: agent-scoped tabs; cross-agent reject with TAB_NOT_OWNED; cap configurable (default 8, 1-64).

The mcp build's `cp ../extension/ai/tool-definitions.js ai/tool-definitions.cjs` step propagated the edits to mcp/ai/tool-definitions.cjs automatically. Both files carry exactly 50 occurrences of "Multi-agent: agent-scoped".

The script edited ONLY top-level description fields (4-space indent under each `{ name, description, ... }`); nested `inputSchema.properties.<param>.description` strings (6+ space indent) were left untouched.

### Task 3: Cross-file verification

- Aggregate grep across the four .ts files for the four typed error codes: 5 occurrences (>= 4 floor).
- Per-file: agents.ts=1 (TAB_NOT_OWNED appears multiple times in the long contract block, but `grep -c` counts lines not tokens), autopilot.ts=2, visual-session.ts=2, manual.ts=0.
- manual.ts intentionally has 0 -- it loads descriptions dynamically from TOOL_REGISTRY (CONTEXT D-02 truth #7); the tail sentence reaches its tools at runtime via that load.

## Tool Edit Counts

| File | Tool entries edited | Notes |
| ---- | ------------------- | ----- |
| mcp/src/tools/agents.ts | 1 (back) | Full contract block + uppercase tool-specific codes |
| mcp/src/tools/autopilot.ts | 3 (run_task, stop_task, get_task_status) | Full block on run_task; short clause on the other two |
| mcp/src/tools/visual-session.ts | 2 (start_visual_session, end_visual_session) | Full contract block on both |
| extension/ai/tool-definitions.js | 50 (every TOOL_REGISTRY entry) | Single-line tail sentence |
| mcp/ai/tool-definitions.cjs | 50 (auto-propagated by build) | Verified identical count to source |

Total: 56 tool descriptions touched across 4 source files (+ 1 build-propagated copy).

## Verification Evidence

```
$ npm --prefix mcp run build
# exits 0 (build duration ~1s; tsc + cp succeed)

$ grep -c "Multi-agent: agent-scoped" extension/ai/tool-definitions.js
50

$ grep -c "Multi-agent: agent-scoped" mcp/ai/tool-definitions.cjs
50

$ grep -c "AGENT_CAP_REACHED\|TAB_NOT_OWNED\|TAB_INCOGNITO_NOT_SUPPORTED\|TAB_OUT_OF_SCOPE" \
    mcp/src/tools/agents.ts mcp/src/tools/autopilot.ts \
    mcp/src/tools/manual.ts mcp/src/tools/visual-session.ts
mcp/src/tools/agents.ts:1
mcp/src/tools/autopilot.ts:2
mcp/src/tools/manual.ts:0
mcp/src/tools/visual-session.ts:2
# Aggregate: 5 lines (each line contains multiple distinct tokens)

$ grep -oE "AGENT_CAP_REACHED|TAB_NOT_OWNED|TAB_INCOGNITO_NOT_SUPPORTED|TAB_OUT_OF_SCOPE" \
    mcp/src/tools/agents.ts mcp/src/tools/autopilot.ts mcp/src/tools/visual-session.ts | wc -l
18
# 18 distinct token occurrences across the three modified .ts files
```

Sampled Phase 237-243 regression tests (5/5 green):

- `node tests/agent-cap.test.js` -> PASS (agent cap, clamping, headroom)
- `node tests/agent-registry.test.js` -> PASS (all assertions)
- `node tests/agent-pooling.test.js` -> PASS (pooling)
- `node tests/back-tool.test.js` -> PASS (30 passed, 0 failed)
- `node tests/back-tool-ownership.test.js` -> PASS (31 passed, 0 failed)

TypeScript warnings introduced: 0 (description strings are plain string literals; no type changes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical Functionality] Added uppercase typed error codes to back description**

- **Found during:** Task 1 (back tool edit)
- **Issue:** The existing back tool description used lowercase status-field names (`no_history`, `cross_origin`, `bf_cache`, `fragment_only`) which document the `result.status` enum. Per the prompt's `<critical_constraints>`, the typed error codes must be enumerated in uppercase (NO_BACK_HISTORY, BF_CACHE, FRAGMENT_ONLY, CROSS_ORIGIN). Per PLAN truth #1, the existing prose must be preserved verbatim AND the uppercase codes must be documented.
- **Fix:** Preserved the existing lowercase status enumeration verbatim, then appended a final sentence: "Tool-specific typed error codes returnable by this tool: NO_BACK_HISTORY, CROSS_ORIGIN, BF_CACHE, FRAGMENT_ONLY." Both the runtime status field documentation and the typed error catalog are now observable in the description.
- **Files modified:** mcp/src/tools/agents.ts
- **Commit:** 7c02b3d

### Out-of-scope discoveries

None. The four target files were touched in isolation; no unrelated regressions surfaced.

## Constraint Reconciliation: manual.ts grep count

The prompt's `<success_criteria>` requested `grep -c "..." each >= 1` for all four .ts files including manual.ts. The PLAN's truth #7 and the canonical_refs in CONTEXT D-02 explicitly state manual.ts is NOT modified -- it pulls descriptions from TOOL_REGISTRY at runtime via schema-bridge.ts createRequire(). The two constraints are reconciled by:

1. Treating the PLAN's verify (aggregate >= 4) as authoritative over the success-criteria checkbox per CONTEXT design intent.
2. Documenting that the typed reject codes DO appear in every manual-tool description at runtime (50 occurrences in tool-definitions.cjs which manual.ts loads), they just don't show up in a static grep of manual.ts.
3. Achieving an aggregate of 5 lines / 18 token occurrences across the three .ts files we did modify -- well above the >= 4 floor.

This is a documentation-only nuance; no behavior change is implied.

## Commits

- `7c02b3d` docs(244-02): add multi-agent contract block to back, run_task, stop_task, get_task_status, start/end_visual_session
- `aaa86be` docs(244-02): append multi-agent tail sentence to all 50 manual tool descriptions

## Self-Check: PASSED

- [x] mcp/src/tools/agents.ts modified -- FOUND
- [x] mcp/src/tools/autopilot.ts modified -- FOUND
- [x] mcp/src/tools/visual-session.ts modified -- FOUND
- [x] extension/ai/tool-definitions.js modified (50 tail-sentence appends) -- FOUND
- [x] mcp/ai/tool-definitions.cjs propagated (50 occurrences) -- FOUND
- [x] Commit 7c02b3d -- FOUND in `git log`
- [x] Commit aaa86be -- FOUND in `git log`
- [x] mcp build exits 0 -- VERIFIED
- [x] All 5 sampled regression tests green -- VERIFIED
- [x] No emojis anywhere in edits -- VERIFIED
