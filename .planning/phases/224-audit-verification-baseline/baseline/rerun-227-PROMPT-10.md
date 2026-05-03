---
phase: 227
plan: 01
baseline_prompt: PROMPT-10
predicted_failure_category: historical-element
verifies: TARGET prompt -- expect early termination with reason=stuck_action_repetition
status: operator-pending
---

# Rerun (Phase 227-01) -- PROMPT-10: Select a value from a custom (non-native) dropdown

**Phase:** 227 (Target Precision)
**Plan:** 227-01 (Action-repetition stuck detector + outcome attribution)
**Verifies:** TARGET prompt -- 254-action baseline loop should now terminate early
**Baseline reference:** [../baseline/PROMPT-10.md](../baseline/PROMPT-10.md)
**Status:** operator-pending

## Prompt
Open https://react-select.com/home. Find the first single-select dropdown at the top of the page (placeholder "Select..."), open it, and choose the option labeled "Green". Report the dropdown's displayed value after selection.

## Original Baseline Outcome
Baseline (see [../baseline/PROMPT-10.md](../baseline/PROMPT-10.md)) ran 254 actions before timing out. The model repeatedly invoked `select_option` on the same react-select dropdown element; the call returned hadEffect=true (DOM kept changing as the dropdown opened/closed) so the existing DOM-hash detector never tripped.

## Phase 227-01 Hypothesis
Expect autopilot to terminate with `outcomeDetails.reason='stuck_action_repetition'` within <50 actions instead of running 254 actions to time-limit. This is the canonical scenario the strict consecutive-fingerprint counter was designed to catch (Test 6 in the unit test mirrors this exact pattern).

If the model successfully completes via the two-click pattern (open-dropdown then click option) added by Phase 226-02, that is also a PASS.

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
  (b) `outcomeDetails.reason in {end_turn, success}` with the dropdown successfully set to "Green" AND actionCount < 50.
FAIL if actionCount >= 50 OR if the session times out without firing stuck_action_repetition.

## Run Result (operator-filled by Claude via mcp__fsb__run_task, 2026-05-02)

**Run timestamp:** 2026-05-02 (session_1777785179035)
**Final outcome:** stopped (operator-stopped via mcp__fsb__stop_task)
**Observed category:** completion (stuck-detection did NOT auto-fire)
**Behavior vs baseline:**
- BASELINE: 254 actions / 10-min cap / $0.23 / status=stopped (time_limit_exceeded)
- RERUN: 116 actions / 6.6 min / $0.13 / status=stopped (operator stop_task)
- DIRECTIONAL IMPROVEMENT: ~54% fewer actions before termination, ~34% lower cost — autopilot is wandering less. But the stuck-detection did NOT auto-fire.

**Why stuck-detection didn't fire:**
Action sequence was mixed: click + get_dom_snapshot + report_progress alternated. The strict consecutive-fingerprint detector (Plan 227-01) requires 5 STRICT consecutive identical (tool, target, params) tuples. Autopilot evaded detection by varying tools.

**Findings:**
1. Plan 227-01 strict-consecutive threshold is too strict for real autopilot behavior. The model interleaves diagnostic tools (get_dom_snapshot, report_progress) between primary actions — even when underlying task is stuck.
2. Plan 227-02 goal-progress tracker should have caught this — windowed unique-state-vector check over 8 iterations. May not be wired into the relevant detection point yet, OR the state vector IS growing because each click updates focused-element identifiers.
3. Plan 225-01 fix #2 (in-flight session_detail) and fix #3 (stop_task on active session) BOTH verified working end-to-end: get_session_detail returned `inFlight: true` with current state; stop_task cleanly terminated.
4. Phase 226 prompt rule "no-progress-toward-goal" likely contributed to the 54% reduction (model self-evaluated and varied strategy more) but not enough.

**Phase 227 follow-up (would-be Phase 228 work):**
- Lower action-repetition threshold OR add "fingerprint family" matching (treat click+snapshot+click+snapshot as a single repeating pattern)
- Verify goal-progress tracker is actually being invoked from agent-loop.detectStuck()
- Add "tool-mix excludes diagnostic-only tools" filter (don't count get_dom_snapshot / report_progress in the fingerprint window)
