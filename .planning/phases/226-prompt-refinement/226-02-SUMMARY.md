---
phase: 226-prompt-refinement
plan: 02
subsystem: extension/ai
tags: [tool-annotations, dropdown-pattern, prompt-refinement]
requirements:
  - PROMPT-01
  - PROMPT-03
  - GUARD-01
  - GUARD-02
  - GUARD-03
key-files:
  modified:
    - extension/ai/tool-definitions.js
  created:
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-10.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-r2-PROMPT-01.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-r2-PROMPT-02.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-r2-PROMPT-04.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-r2-PROMPT-06.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-r2-PROMPT-07.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-r2-PROMPT-09.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-r2-PROMPT-13.md
decisions:
  - "Tool-annotation rules (Plan 02) reinforce the system-prompt-level rules from Plan 01 -- intentional dual-layer placement, not duplication."
  - "select_option marked NATIVE-ONLY with explicit two-click pattern pointer; click description gained CUSTOM DROPDOWN PATTERN paragraph; execute_js gained NOT A SHORTCUT framing."
metrics:
  tasks: 2
  files-modified: 1
  files-created: 8
---

# Phase 226 Plan 02: Tool annotations + dropdown two-click pattern Summary

Three surgical TOOL_REGISTRY description edits in extension/ai/tool-definitions.js add the two-click custom-dropdown pattern (rule 2 of 5 from CONTEXT) and tighten execute_js framing so the model stops reaching for it as a shortcut around real interaction tools.

## Diffs Applied

**1. select_option (~line 211)** -- description rewritten. NATIVE-ONLY callout up front, two-click pattern with concrete react-select example, "if no error but value unchanged you are on a custom dropdown" diagnostic, Related field strengthened from "click (for custom non-native dropdowns)" to "click (the correct tool for custom non-native dropdowns)".

**2. click (~line 142)** -- existing description preserved verbatim, then appended CUSTOM DROPDOWN PATTERN sentence with the two-click flow and an example, plus a pointer that select_option only works on native <select>. Related field gained `select_option (for native <select> only)`.

**3. execute_js (~line 41)** -- existing capability list preserved (read structured content, mutate state, query computed styles, cross-origin iframe inspection, complex widgets, html2canvas, multi-step JS-only operations). Inserted NOT A SHORTCUT clarification near the start with two concrete anti-patterns (innerHTML for drag, URL fragments for expand). Related field added drag_drop and click as preferred alternatives.

inputSchema, _route, _readOnly, _contentVerb, _cdpVerb fields untouched on all three. No other TOOL_REGISTRY entries touched (GUARD-03 holds).

## Verification Results

- `node -c extension/ai/tool-definitions.js`: PASS (syntactic validity).
- 8/8 grep checks: PASS (all expected phrases present in the right entries).
- `npm test`: exit 0 (GUARD-02 holds).

## Rerun Scaffolds Created

| Scaffold | Verifies |
| --- | --- |
| rerun-226-PROMPT-10.md | TOOL_REGISTRY two-click pattern (react-select) -- expected: action count drops from 254 to ~10-30, outcome success with "Green" |
| rerun-226-r2-PROMPT-01.md | PASS regression -- Google search + first organic |
| rerun-226-r2-PROMPT-02.md | PASS regression -- Selenium contact form (click flow integrity) |
| rerun-226-r2-PROMPT-04.md | PASS regression -- Excalidraw rectangle (execute_js framing does not suppress legitimate canvas inspection) |
| rerun-226-r2-PROMPT-06.md | PASS regression -- multi-tab price compare |
| rerun-226-r2-PROMPT-07.md | PASS regression -- nested label-wrapped checkbox |
| rerun-226-r2-PROMPT-09.md | PASS regression -- BBC cookie banner |
| rerun-226-r2-PROMPT-13.md | PASS regression -- Wikipedia exact-sentence extraction |

All scaffolds use the 226-01 Task 2 template; Run Result sections left empty for operator fill via `mcp__fsb__run_task`.

## Operator Follow-up

Operator-driven MCP reruns are pending. The orchestrator (not this executor) runs all 8 scaffolds against the post-Plan-02 Refinements branch and fills the Run Result sections per VERIFY-RECIPE.md. PROMPT-10 is the targeted behavioral check; the 7 round-2 r2 reruns are regression evidence for GUARD-01 (no PROJECT.md regression).

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

- `df65287` -- feat(226-02): add two-click custom-dropdown pattern + tighten execute_js framing in TOOL_REGISTRY
- `eb832c6` -- test(226-02): add PROMPT-10 + 7 round-2 PASS regression rerun scaffolds
