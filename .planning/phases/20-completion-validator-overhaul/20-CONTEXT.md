# Phase 20: Completion Validator Overhaul - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the completion validator so it correctly accepts legitimate task completions on the first `done` signal for common task types (media playback, data extraction, navigation) instead of forcing unnecessary extra iterations. All changes are within `background.js` completion validation functions (~L3393-3972).

</domain>

<decisions>
## Implementation Decisions

### Score Weights & Threshold
- Rebalance weights to total 1.0 with AI report raised: URL 0.20, DOM 0.20, AI 0.30, Actions 0.15, Stability 0.10
- Raise the no-actions boost from 0.15 to 0.20 so AI done + no-actions = 0.30 + 0.20 = 0.50, exactly meeting threshold
- Keep threshold at 0.50 -- the weights rebalance makes AI self-report viable on its own
- AI result minimum length: keep >= 10 chars as default, but short results ("playing X") should be accepted for media tasks

### Task Classification Fixes
- Fix "play X on youtube" misclassification as gaming -- Claude decides whether to add a dedicated `media` task type or fix the gaming regex exclusion
- Extraction validator should accept AI done + result data without requiring getText action -- YAML DOM snapshots let the AI read page content directly
- Whether to add a separate `data-check` type vs fixing the extraction validator: Claude decides based on validation logic needs
- Classification order and approach (first-match vs scored): Claude decides

### Escape Hatch Behavior
- When the AI is stuck saying done repeatedly, an escape hatch must override the score -- Claude decides the exact threshold (2 or 3 consecutive dones) and mechanism (force-accept vs progressive threshold lowering)
- Stall detection scope (consecutive done signals only vs also counting no-action iterations): Claude decides
- Observability (escapeHatch flag in result vs log-only): Claude decides

### URL Pattern Expansion
- Task-type-specific URL patterns: each task type gets its own URL regex set (media: youtube.com/watch, spotify.com/track; shopping: /cart, /checkout; etc.)
- Whether patterns are inline or in a separate map: Claude decides based on maintainability
- Navigation URL change detection (host-only vs host+path): Claude decides
- Media validator: URL match is a strong bonus (+0.30 or similar) but NOT instant-accept -- still must clear threshold via scoring

### Claude's Discretion
- AI result minimum length per task type (keep flat 10 chars or vary)
- Whether to add `media` as a new task type vs fixing gaming regex
- Whether to add `data-check` as a new task type vs fixing extraction validator
- Escape hatch consecutive-done count and mechanism
- URL pattern storage (inline vs config map)
- Navigation URL change detection scope
- Stall detection scope for escape hatch
- Escape hatch observability approach

</decisions>

<specifics>
## Specific Ideas

- "play sunflower on youtube" must complete within 1 iteration of AI issuing done -- the YouTube watch URL + AI done signal should be sufficient
- "check the price of X" must complete when AI reports price via done without needing getText -- DOM snapshot visibility counts
- The escape hatch must eliminate infinite stuck loops (the YouTube task wasted 8 iterations)
- AI done + no-remaining-actions must reach at least 0.50 score (currently maxes at 0.35-0.45)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyTask()` (~L3393): First-match regex classifier returning task type strings -- needs media fix
- `detectUrlCompletionPattern()` (~L3550): URL success pattern matcher -- needs task-type patterns
- `checkActionChainComplete()` (~L3571): Per-task-type action chain validator -- extraction case needs fix
- `computeCompletionScore()` (~L3683): Weighted multi-signal scorer -- needs weight rebalance
- `validateCompletion()` (~L3919): Main dispatcher routing to per-type validators -- needs escape hatch
- Per-type validators (messagingValidator, formValidator, etc. ~L3736-3909): Each returns {approved, score, evidence, taskType}
- `gatherCompletionSignals()` (~L3652): Collects all signal sources into a bundle

### Established Patterns
- Validators follow a consistent pattern: take (session, aiResponse, context, signals, scoreResult), add bonuses, return {approved, score >= threshold, evidence, taskType}
- Score capping with Math.min(1, score + bonus) prevents exceeding 1.0
- automationLogger.debug/info/warn used for observability throughout
- Action history accessed via session.actionHistory, URL history via session.urlHistory

### Integration Points
- `validateCompletion()` called from iteration loop at ~L9941 when aiResponse.taskComplete is true
- If validation rejects, aiResponse.taskComplete is set to false and iteration continues
- Completion signals gathered from context object (DOM signals from content script)
- CLI parser's `done "result"` maps to aiResponse.taskComplete=true + aiResponse.result

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 20-completion-validator-overhaul*
*Context gathered: 2026-03-06*
