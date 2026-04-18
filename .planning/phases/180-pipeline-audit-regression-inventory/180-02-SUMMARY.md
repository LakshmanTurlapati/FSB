---
phase: 180-pipeline-audit-regression-inventory
plan: 02
subsystem: AI Communication, DOM Analysis
tags: [audit, regression-inventory, ai-integration, dom-analysis, tool-use-adapter, selectors]
dependency_graph:
  requires: []
  provides: [ai-communication-findings, dom-analysis-findings]
  affects: [180-03-PLAN]
tech_stack:
  added: []
  patterns: [function-level-audit, git-diff-baseline-comparison]
key_files:
  created:
    - .planning/phases/180-pipeline-audit-regression-inventory/180-ai-communication-findings.md
    - .planning/phases/180-pipeline-audit-regression-inventory/180-dom-analysis-findings.md
  modified: []
decisions:
  - "Phase 139.1 cleanup incorrectly deleted the entire CLI autopilot pipeline as dead code in v0.9.24"
  - "Three cascading response-parsing fixes (8a7a8cf, 1ff5b52, 7ba62d9) repaired UniversalProvider CLI mangling"
  - "DOM analysis subsystem had zero regressions -- all 5 changes were additive improvements"
  - "tool-use-adapter.js isToolCallResponse fallback is a correct improvement for mixed text+tools responses"
metrics:
  duration: 8 min
  completed: "2026-04-18T18:35:33Z"
  tasks: 2
  files: 2
---

# Phase 180 Plan 02: AI Communication and DOM Analysis Audit Summary

Function-level audit of AI communication (ai-integration.js, tool-use-adapter.js, universal-provider.js) and DOM analysis (dom-analysis.js, selectors.js) subsystems against v0.9.24 baseline, producing 16 documented findings with per-function verdicts.

## Results

### Task 1: AI Communication Subsystem Audit

- **Commit:** 9048cfe
- **Output:** 180-ai-communication-findings.md
- **Findings:** 11 findings across 40+ functions audited
- **Critical finding (AC-01):** Phase 139.1 deleted the entire CLI autopilot pipeline (getAutomationActions, processQueue, buildPrompt, TASK_PROMPTS, CLI_COMMAND_TABLE, and 10+ supporting functions) as "dead code." These were actively called by background.js. Restored in commit 23c0ad1 but the restoration introduced response-parsing regressions fixed across 3 subsequent commits.
- **Response parsing chain (AC-02, AC-03):** UniversalProvider.parseJSONSafely was mangling CLI-format responses by stripping text before `{`, running JSON fixers on non-JSON text, and returning fake JSON error objects. Fixed by bypassing cleanResponse entirely.
- **Provider adapter (AC-09):** isToolCallResponse gained a fallback for mixed text+tools responses -- this is a correct improvement.
- **Dead code (AC-11):** cleanResponse/parseJSONSafely remain as unreachable dead code in universal-provider.js.

### Task 2: DOM Analysis Subsystem Audit

- **Commit:** 5fec26b
- **Output:** 180-dom-analysis-findings.md
- **Findings:** 5 findings across 40+ functions audited
- **All changes additive:** Zero regressions. All from single commit 77de57b (Angular Material fixes).
- **Payment fields (DA-01):** inferElementPurpose expanded with 14 granular autocomplete-based matchers.
- **Element lookup (DA-02, DA-03):** data-fsb-id attribute stamping on DOM nodes + fallback selector resolution.
- **CDK overlay (DA-04):** Angular Material mat-select/autocomplete options now captured from overlay container.
- **Snapshot format:** No breaking changes. Two additive fields (autocomplete, _fromOverlay).
- **Caller contracts:** All 3 caller paths (background.js getDOM, agent-loop.js get_page_snapshot, background.js getMarkdownSnapshot) are intact and unchanged.

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Phase 139.1 root cause identified:** The v0.9.24 Phase 139.1 cleanup incorrectly classified the CLI autopilot pipeline as "dead code" based on the agent-loop.js tool_use pipeline being the intended replacement. However, background.js still called the old pipeline (getAutomationActions), making the deletion a critical regression.

2. **Response parsing regression chain mapped:** Three separate fix commits (8a7a8cf, 1ff5b52, 7ba62d9) were needed to repair the response parsing pipeline, each addressing a different layer: JSON parsing failure fallback, object-vs-string return type, and cleanResponse bypass.

3. **DOM analysis is stable:** The DOM analysis subsystem is the most stable component -- zero regressions, additive-only improvements, and unchanged caller contracts.

4. **Dual pipeline concern noted:** ai-integration.js CLI_COMMAND_TABLE and agent-loop.js TOOL_REGISTRY represent parallel tool documentation systems that may diverge. This is a maintenance concern, not an active regression.

## Self-Check: PASSED

All created files exist and all commits are present:

- 180-ai-communication-findings.md: EXISTS (11 AC- findings)
- 180-dom-analysis-findings.md: EXISTS (5 DA- findings)
- Commit 9048cfe: EXISTS
- Commit 5fec26b: EXISTS
