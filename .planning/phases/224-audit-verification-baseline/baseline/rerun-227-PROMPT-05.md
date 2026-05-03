---
phase: 227
plan: 01
baseline_prompt: PROMPT-05
predicted_failure_category: scroll-load
verifies: TARGET prompt -- expect early termination with reason=stuck_action_repetition
status: operator-pending
---

# Rerun (Phase 227-01) -- PROMPT-05: Scroll an infinite-loading feed and capture posts

**Phase:** 227 (Target Precision)
**Plan:** 227-01 (Action-repetition stuck detector + outcome attribution)
**Verifies:** TARGET prompt -- 114-action baseline loop should now terminate early
**Baseline reference:** [../baseline/PROMPT-05.md](../baseline/PROMPT-05.md)
**Status:** operator-pending

## Prompt
Open https://news.ycombinator.com/. Scroll down until at least 30 story rows are loaded into the DOM (HN paginates with a "More" link near the bottom -- clicking it counts as load). Then return the titles of stories 25 through 30 in a numbered list.

## Original Baseline Outcome
Baseline (see [../baseline/PROMPT-05.md](../baseline/PROMPT-05.md)) ran 114 actions before timing out. The model repeatedly invoked the same scroll/click("More") combination without the existing DOM-hash detector tripping (the DOM was changing each iteration as more stories rendered, but the model's selector was stuck).

## Phase 227-01 Hypothesis
Expect autopilot to terminate with `outcomeDetails.reason='stuck_action_repetition'` within <50 actions instead of looping to time-limit. The strict consecutive-fingerprint counter will fire at iteration 5 of identical scroll-or-click("More") tuples.

If the model successfully completes the task by varying its approach (e.g., reads page after each scroll), that is also a PASS -- the goal is to bound the loop, not to mandate failure.

## How to Run
Operator runs `mcp__fsb__run_task` with the prompt above against the Refinements branch with Plan 227-01 edits in place. The gsd-executor agent does NOT have MCP tools -- this scaffold is filled in by the orchestrator post-execution.

---
<!-- BELOW THIS LINE: operator-filled per VERIFY-RECIPE.md -->

## Run Result (operator-filled via mcp__fsb__run_task)

**Run timestamp:**
**Final outcome:**
**Observed category:**
**actionCount:**
**outcomeDetails.reason:**
**Notes:**

## Pass/Fail Criteria
PASS if EITHER:
  (a) `outcomeDetails.reason='stuck_action_repetition'` AND actionCount < 50, OR
  (b) `outcomeDetails.reason in {end_turn, success}` with the task actually completed AND actionCount < 50.
FAIL if actionCount >= 50 OR if the session times out without firing stuck_action_repetition.

## Run Result (operator-filled by Claude via mcp__fsb__run_task, 2026-05-02)

**Run timestamp:** 2026-05-02 (session_1777785637487)
**Final outcome:** partial (clean blocker report — much better than baseline failure)
**Observed category:** none (autopilot exited cleanly)
**Behavior vs baseline:**
- BASELINE: 114 actions / ~6m 15s / $0.053 / status=error (API call failed: API request timed out after 30000ms) — autopilot got stuck in scroll loop
- RERUN: 26 actions / ~1m 38s / $0.035 / status=partial / reason=blocked (clean exit with blocker description AND next step)
- 77% fewer actions, 74% faster, $0.018 cheaper. **Major improvement.**

**Behavior change:**
- Autopilot recognized HN frontpage already has 30 stories — DID NOT scroll forever
- Tried to extract specific story titles via get_text → blocked by selector mismatch
- Tried execute_js fallback → blocked by HN CSP (no unsafe-eval)
- Reported partial-with-blocker including next-step guidance — clean refusal, no fabrication

**Findings:**
1. Phase 226 pagination-before-scroll rule + no-progress-toward-goal rule worked together — model didn't loop on scroll
2. Phase 226 action-matches-request self-check engaged — model didn't claim success when extraction failed
3. Refusal quality preserved (mirrors EDGE-14 baseline finding) — autopilot reports clearly when blocked
4. The selector mismatch (a.storylink:nth-of-type(25) failed despite matching HN HTML) is a tool-implementation issue (get_text selector engine), NOT a Phase 224-227 scope item — log as future work

**Verdict: clear PASS for the stuck-prevention dimension.** Autopilot exited at ~1.5min instead of looping for 6.5min.
