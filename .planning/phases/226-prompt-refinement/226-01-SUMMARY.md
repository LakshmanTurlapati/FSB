---
phase: 226-prompt-refinement
plan: 01
subsystem: extension/ai (system prompt construction)
tags: [prompt-engineering, autopilot, guardrails]
requires: [Phase 224 baseline (PROMPT-05/08/10, EDGE-12), Phase 225 drag tool reachability]
provides: [Four prompt-time rules: no-shortcut-escapes, pagination-before-scroll, no-progress-toward-goal, action-matches-request self-check]
affects: [extension/ai/ai-integration.js system prompt + hybrid continuation prompt + tool selection guide]
tech-stack:
  added: []
  patterns: [surgical additive prompt edits, terse hybrid mirroring]
key-files:
  created:
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-05.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-08.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-EDGE-12.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-01.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-02.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-04.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-06.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-07.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-09.md
    - .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-13.md
  modified:
    - extension/ai/ai-integration.js
decisions:
  - "Backticks inside template literals (referencing `done` and `fail` CLI verbs) escaped with backslash to preserve template literal syntax."
  - "PROMPT-13 baseline scaffold does not exist in baseline/; rerun-226-PROMPT-13.md uses a Wikipedia exact-sentence extraction prompt as a representative regression target and notes the baseline gap for the orchestrator."
metrics:
  duration: ~10min
  completed: 2026-05-02
---

# Phase 226 Plan 01: System Prompt Rules Summary

Four surgical prompt rules added to FSB autopilot's system prompt + tool-selection guide + hybrid continuation prompt to close the prompt-time tool-choice and no-progress gaps surfaced by Phase 224 baseline (PROMPT-05/08, EDGE-12).

## What Changed

### Edit anchors used (extension/ai/ai-integration.js)

1. **CLI_COMMAND_TABLE TOOL SELECTION GUIDE** (~line 29, after the existing `DECISION RULE:` paragraph): appended two new decision rules
   - `DRAG TASKS:` -- forbids `executejs innerHTML` substitution; example uses `dragdrop e5 e12`.
   - `SCROLL-LOAD TASKS:` -- check for "More" / "Next" / "Load more" link before re-scrolling; HN example.

2. **TOOL PREFERENCES** in FULL system prompt (~line 2680, before `=== RULES FOR SPECIFIC SCENARIOS ===`): added items 5 and 6
   - Item 5: `NO SHORTCUT ESCAPES` -- forbids URL fragments, query params, and executejs DOM mutations as substitutes; cites drag and expand examples.
   - Item 6: `NO-PROGRESS HEURISTIC` -- change strategy after >3 same-target repeats; hard cap at 5 iterations.

3. **TASK COMPLETION** in FULL system prompt (~line 2643, appended after the "NEVER mention internal terms" bullet):
   - `ACTION-MATCHES-REQUEST SELF-CHECK` -- before `done`, verify the executed action matches the requested action; mismatch -> fix or `fail` honestly.

4. **HYBRID_CONTINUATION_PROMPT RULES list** (~line 512, after existing item 7 "Maximum 8 commands per response"): added items 8, 9, 10
   - Item 8: terse NO SHORTCUT ESCAPES reminder.
   - Item 9: terse NO PROGRESS HEURISTIC reminder + pagination check.
   - Item 10: terse ACTION-MATCHES-REQUEST reminder.

### Note on syntax
The TASK COMPLETION addition and HYBRID item 10 reference the CLI verbs `done` and `fail` in markdown backticks. Both insertions live inside template literals, so backticks were escaped (`\``) to preserve template literal syntax. Verified by `node -e "require('./extension/ai/ai-integration.js')"` exit 0 and `npm test` exit 0.

## Verification

### Code-side (Task 1)
All 8 grep checks from `<verify>` block pass:
- OK: TOOL SELECTION GUIDE has DRAG TASKS rule
- OK: TOOL SELECTION GUIDE has SCROLL-LOAD rule
- OK: TOOL PREFERENCES has NO SHORTCUT ESCAPES
- OK: TOOL PREFERENCES has NO-PROGRESS HEURISTIC
- OK: TASK COMPLETION has ACTION-MATCHES-REQUEST
- OK: HYBRID prompt has shortcut escapes reminder
- OK: HYBRID prompt has progress heuristic reminder
- OK: HYBRID prompt has action-matches-request reminder

### npm test (Task 2 / GUARD-02)
`npm test` exits 0. 1364 tests passed, 0 failed.

### Rerun Scaffolds (Task 2)
10 scaffolds created at `.planning/phases/224-audit-verification-baseline/baseline/`:

| Scaffold | Verifies | Notes |
|---|---|---|
| rerun-226-PROMPT-08.md | NO SHORTCUT ESCAPES + ACTION-MATCHES-REQUEST | drag-and-drop |
| rerun-226-EDGE-12.md | NO SHORTCUT ESCAPES (URL fragment subcase) + ACTION-MATCHES-REQUEST | HN expand-all |
| rerun-226-PROMPT-05.md | SCROLL-LOAD pagination rule + NO-PROGRESS HEURISTIC | HN scroll-load |
| rerun-226-PROMPT-01.md | PASS regression | Google search + click first organic |
| rerun-226-PROMPT-02.md | PASS regression | Selenium contact form |
| rerun-226-PROMPT-04.md | PASS regression (canvas DRAG sanity) | Excalidraw rectangle |
| rerun-226-PROMPT-06.md | PASS regression | multi-tab price compare |
| rerun-226-PROMPT-07.md | PASS regression | nested label-wrapped checkbox |
| rerun-226-PROMPT-09.md | PASS regression | BBC cookie banner |
| rerun-226-PROMPT-13.md | PASS regression | Wikipedia exact-sentence extraction (no upstream baseline scaffold; placeholder prompt provided) |

All `Run Result` sections are intentionally empty -- the executor agent does not have MCP tools.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Escaped CLI-verb backticks inside template literals**
- **Found during:** Task 2 npm test
- **Issue:** First pass of the TASK COMPLETION addition and HYBRID item 10 included unescaped backticks around `done` and `fail`. Both live inside template-literal-delimited strings, so the backticks closed the string and made the next identifier a syntax error. `node -e "require('./extension/ai/ai-integration.js')"` and `npm test` both failed with `SyntaxError: Unexpected identifier 'done'`.
- **Fix:** Escaped each inner backtick with `\\\`` so the template literal stays open. Re-ran `npm test`: exit 0.
- **Files modified:** extension/ai/ai-integration.js (same file as Task 1)
- **Commit:** Folded into the Task 1 commit (a12712c).

**2. [Documentation gap] PROMPT-13 baseline scaffold missing**
- **Found during:** Task 2 scaffold creation
- **Issue:** Plan files_modified lists `rerun-226-PROMPT-13.md` and the per-scaffold spec gives "Wikipedia exact-sentence extraction" as the prompt, but no `baseline/PROMPT-13.md` file exists in `.planning/phases/224-audit-verification-baseline/baseline/`.
- **Fix:** Created `rerun-226-PROMPT-13.md` with a representative Wikipedia exact-sentence extraction prompt (en.wikipedia.org/wiki/Browser_extension, "History" section first sentence) and a note in the `Baseline reference` field explaining the upstream gap so the orchestrator can either source the canonical prompt or accept this stand-in.
- **Files modified:** .planning/phases/224-audit-verification-baseline/baseline/rerun-226-PROMPT-13.md
- **Commit:** 4593c76 (Task 2 commit)

## Pending (operator-driven, post-execution)

The 10 rerun scaffolds are ready for `mcp__fsb__run_task` execution. The executor agent does NOT have MCP tools per the task instructions; the orchestrator runs the actual MCP reruns and fills in each `Run Result` section. Acceptance criteria per the plan's `<verification>` block:
- PROMPT-08 outcome should change from "partial (JS escape)" to real-drag success or honest fail; no `execute_js innerHTML` in trace.
- EDGE-12 outcome should change from "partial (URL fragment hack)" to genuine click-through (or honest partial); no `#expanded` URL fragment.
- PROMPT-05 trace should show a "More" link click after ~30 stories instead of pure scroll loop.
- PROMPT-01, 02, 04, 06, 07, 09, 13 must still PASS (no regression).

## Commits

- `a12712c` feat(226-01): add four prompt rules to system prompt
- `4593c76` test(226-01): add 10 operator-fillable rerun scaffolds

## Self-Check: PASSED

- extension/ai/ai-integration.js: 4 edits present (8/8 grep checks pass).
- 10 rerun scaffolds present on disk.
- `npm test` exit 0.
- Both commits present in `git log`.
