# Phase 20: Completion Validator Overhaul - Research

**Researched:** 2026-03-06
**Domain:** Completion validation scoring, task classification, escape hatch logic in background.js
**Confidence:** HIGH

## Summary

Phase 20 fixes the completion validator so it correctly accepts legitimate task completions on the first `done` signal for common task types. The root cause is a combination of: (1) AI self-report weight being too low (0.20 base + 0.15 no-actions boost = 0.35 max, always below the 0.50 threshold), (2) the gaming classifier falsely matching media playback tasks like "play X on youtube", (3) extraction validation requiring a `getText` action even when the AI reads data from the DOM snapshot, (4) URL patterns only matching generic success URLs and missing common sites like YouTube/Amazon, and (5) no escape hatch when the AI issues consecutive `done` signals.

All changes are confined to `background.js` in the completion validation function cluster (~L3393-3972). The functions are: `classifyTask()`, `detectUrlCompletionPattern()`, `checkActionChainComplete()`, `gatherCompletionSignals()`, `computeCompletionScore()`, the per-type validators, and `validateCompletion()`. The iteration loop at ~L9940 is the only caller.

**Primary recommendation:** Rebalance score weights (AI report 0.30, no-actions boost 0.20), add a `media` task type with proper URL patterns, fix extraction to accept AI result data without `getText`, and add a consecutive-done escape hatch in `validateCompletion()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rebalance weights to total 1.0 with AI report raised: URL 0.20, DOM 0.20, AI 0.30, Actions 0.15, Stability 0.10
- Raise the no-actions boost from 0.15 to 0.20 so AI done + no-actions = 0.30 + 0.20 = 0.50, exactly meeting threshold
- Keep threshold at 0.50 -- the weights rebalance makes AI self-report viable on its own
- AI result minimum length: keep >= 10 chars as default, but short results ("playing X") should be accepted for media tasks
- Fix "play X on youtube" misclassification as gaming
- Extraction validator should accept AI done + result data without requiring getText action
- Task-type-specific URL patterns: each task type gets its own URL regex set
- Media validator: URL match is a strong bonus (+0.30 or similar) but NOT instant-accept -- still must clear threshold via scoring
- When the AI is stuck saying done repeatedly, an escape hatch must override the score

### Claude's Discretion
- AI result minimum length per task type (keep flat 10 chars or vary)
- Whether to add `media` as a new task type vs fixing gaming regex
- Whether to add `data-check` as a new task type vs fixing extraction validator
- Escape hatch consecutive-done count and mechanism
- URL pattern storage (inline vs config map)
- Navigation URL change detection scope
- Stall detection scope for escape hatch
- Escape hatch observability approach

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMP-01 | Task-type-specific completion validators | Add `media` task type + validator; fix extraction validator to accept AI result without getText |
| CMP-02 | Multi-signal completion scoring | Rebalance weights (URL 0.20, DOM 0.20, AI 0.30, Actions 0.15, Stability 0.10); raise no-actions boost to 0.20 |
| CMP-03 | Task classification | Fix classifyTask() gaming regex to exclude media playback; add media patterns |
| CMP-04 | Enhanced progress tracking | Escape hatch for consecutive-done stalls; stall counter in session state |
| CMP-05 | Score calibration | AI done + no-actions must reach 0.50; media URL bonus; extraction AI-result bonus |
</phase_requirements>

## Architecture Patterns

### Affected Code Map (all in background.js)

```
background.js (~L3393-3972):
├── classifyTask()              # L3393  -- Add media exclusion to gaming regex OR add media type
├── detectUrlCompletionPattern() # L3550  -- Add task-type-specific URL pattern maps
├── checkActionChainComplete()   # L3571  -- Fix extraction case (L3608-3612)
├── gatherCompletionSignals()    # L3652  -- Update weight comments to match new values
├── computeCompletionScore()     # L3683  -- Rebalance all 5 weights + raise no-actions boost
├── extractionValidator()        # L3848  -- Accept AI result as extraction evidence
├── [NEW] mediaValidator()       # After generalValidator -- Media-specific validation
├── validateCompletion()         # L3919  -- Add escape hatch, wire media validator, relax min-length for media
└── (iteration loop ~L9940)      # Caller -- No changes needed here
```

### Pattern 1: Add `media` Task Type (Recommended)

**What:** Add a dedicated `media` task type to `classifyTask()` rather than patching the gaming regex exclusion list.

**Why this over fixing the gaming regex:**
- The gaming regex exclusion already has 4 patterns (`play.*video`, `play.*music`, `play.*song`, `playlist`). Adding more makes it fragile.
- Media tasks have unique completion semantics: URL match is the strongest signal (YouTube watch page, Spotify track page), and short AI results like "playing Sunflower" are valid.
- A dedicated media validator can apply the +0.30 URL bonus and the relaxed min-length.

**Implementation:**
```javascript
// In classifyTask(), BEFORE the gaming check (~L3420):
// Media -- play/listen/watch on streaming platforms (must precede gaming)
if (/play|watch|listen/.test(t) && /youtube|spotify|soundcloud|netflix|hulu|twitch|vimeo|apple.?music|pandora/.test(t)) return 'media';

// Gaming check stays the same (media already returned above)
if (/play|game|start game|asteroids|snake|pong|tetris/.test(t) && !/play.*video|play.*music|play.*song|playlist/.test(t)) return 'gaming';
```

**Why it works:** "play sunflower on youtube" matches `play` + `youtube`, returns `media` before reaching gaming. "play asteroids" has no streaming platform keyword, falls through to gaming. Clean separation.

### Pattern 2: Score Weight Rebalance

**Current weights (total 1.0):**
| Signal | Weight | Max contribution |
|--------|--------|-----------------|
| URL | 0.30 | 0.30 |
| DOM | 0.25 | 0.25 |
| AI report | 0.20 | 0.20 |
| Action chain | 0.15 | 0.15 |
| Page stability | 0.10 | 0.10 |
| No-actions boost | +0.15 (flat) | 0.15 |

**AI done + no-actions max:** 0.20 + 0.15 = 0.35 (BELOW 0.50 threshold)

**New weights (total 0.95 base, as decided):**
| Signal | Weight | Max contribution |
|--------|--------|-----------------|
| URL | 0.20 | 0.20 |
| DOM | 0.20 | 0.20 |
| AI report | 0.30 | 0.30 |
| Action chain | 0.15 | 0.15 |
| Page stability | 0.10 | 0.10 |
| No-actions boost | +0.20 (flat) | 0.20 |

**AI done + no-actions max:** 0.30 + 0.20 = 0.50 (EXACTLY meets 0.50 threshold)

Note: Base weights sum to 0.95, not 1.0. The no-actions boost of 0.20 brings the effective max to 1.15, capped at 1.0 by `Math.min`. This is intentional -- the AI self-report path should barely clear the threshold on its own, requiring either meaningful result text (>= 10 chars) or additional signals to confirm.

### Pattern 3: Task-Type URL Pattern Map

**Current URL detection:** Only matches generic success patterns (`/confirm|success|thank|receipt|done|complete/`) and host-change navigation. Misses all site-specific patterns.

**Recommended approach:** A `TASK_URL_PATTERNS` map object at module scope, keyed by task type, with arrays of regex patterns:

```javascript
const TASK_URL_PATTERNS = {
  media: [
    /youtube\.com\/watch/i,        // YouTube video playing
    /youtu\.be\//i,                // YouTube short URL
    /spotify\.com\/track/i,        // Spotify track
    /spotify\.com\/album/i,        // Spotify album
    /music\.youtube\.com\/watch/i, // YouTube Music
    /soundcloud\.com\/.+\/.+/i,   // SoundCloud track
    /netflix\.com\/watch/i,        // Netflix playback
    /twitch\.tv\/.+/i,            // Twitch stream
    /vimeo\.com\/\d+/i            // Vimeo video
  ],
  shopping: [
    /amazon\.\w+\/.*\/dp\//i,     // Amazon product page
    /amazon\.\w+\/gp\/cart/i,     // Amazon cart
    /ebay\.com\/itm\//i,          // eBay listing
    /\/cart/i,                     // Generic cart
    /\/checkout/i                  // Generic checkout
  ],
  extraction: [
    /amazon\.\w+\/.*\/dp\//i,     // Amazon product (price check)
    /google\.com\/search/i         // Google search results
  ],
  navigation: [] // Handled by host-change detection, no specific patterns needed
};
```

**Integration into `detectUrlCompletionPattern()`:** Accept `taskType` as a third parameter. Check task-specific patterns first, then fall back to generic success patterns.

### Pattern 4: Escape Hatch for Consecutive Done Signals

**Recommendation:** 3 consecutive done signals triggers force-accept.

**Why 3 (not 2):**
- 2 is too aggressive -- the validator legitimately rejects the first done in some cases (e.g., page still loading), and the AI reasonably retries once.
- 3 means the AI has been stuck for at least 3 full iteration cycles after completing its work. This is a clear stall.
- The YouTube UAT case had 8 wasted iterations -- even 3 would have saved 5 iterations.

**Mechanism:** Track `session.consecutiveDoneCount` in the iteration loop. Increment when `aiResponse.taskComplete` is true and validation rejects. Reset to 0 when `aiResponse.taskComplete` is false (AI is still working). When count reaches 3, force `validation.approved = true`.

**Where to add:**
```javascript
// In validateCompletion() or in the iteration loop at ~L9940
// Option A: Inside validateCompletion() (cleaner -- all completion logic in one place)
// Option B: In the iteration loop (simpler -- just override the result)

// Recommended: Option A inside validateCompletion()
function validateCompletion(session, aiResponse, context) {
  // ... existing validation ...

  // Escape hatch: consecutive done signals override score threshold
  if (!result.approved) {
    session.consecutiveDoneCount = (session.consecutiveDoneCount || 0) + 1;
    if (session.consecutiveDoneCount >= 3) {
      result.approved = true;
      result.evidence.push('Escape hatch: ' + session.consecutiveDoneCount + ' consecutive done signals');
      result.escapeHatch = true;
      automationLogger.warn('Escape hatch triggered', {
        sessionId: session.id,
        consecutiveDoneCount: session.consecutiveDoneCount,
        score: result.score
      });
    }
  } else {
    session.consecutiveDoneCount = 0; // Reset on successful validation
  }

  return result;
}
```

**Observability:** Add `escapeHatch: true` flag to the result object. Log a warning when triggered. This gives enough observability without requiring a separate system.

**Important:** The counter must also be reset when `aiResponse.taskComplete` is false (AI is still working, not stuck saying done). This reset should happen in the iteration loop caller, not inside validateCompletion (which only runs when taskComplete is true).

### Pattern 5: Extraction Validator Fix

**Current problem (L3608-3612):**
```javascript
case 'extraction': {
  return recent.some(a =>
    a.tool === 'getText' && a.result?.success && a.result?.value && a.result.value.trim().length > 0
  );
}
```
This requires a `getText` action in history. But with YAML DOM snapshots, the AI can read data directly from the snapshot and report it via `done "price is $599"` without ever calling `getText`.

**Fix:** In `checkActionChainComplete()`, also accept extraction as complete when AI result contains substantive data:
```javascript
case 'extraction': {
  // Traditional: getText action with result
  const hasGetText = recent.some(a =>
    a.tool === 'getText' && a.result?.success && a.result?.value && a.result.value.trim().length > 0
  );
  if (hasGetText) return true;
  // New: AI reported data without getText (read from DOM snapshot)
  // AI result with numbers/prices/data is evidence of extraction
  return false; // Let the extractionValidator handle AI-result-as-evidence
}
```

Better approach: Keep `checkActionChainComplete` returning false for no-getText extraction, but fix `extractionValidator()` to give a bonus when the AI result contains substantive data:
```javascript
function extractionValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  // Original: getText returned content
  if (signals.actionChainComplete && signals.aiResult.length >= 10) {
    score = Math.min(1, score + 0.1);
    evidence.push('Extraction: data extracted via getText');
  }
  // NEW: AI result contains data patterns (numbers, prices, names) without getText
  // This covers the "check the price of X" case where AI reads from DOM snapshot
  if (!signals.actionChainComplete && signals.aiComplete && signals.aiResult.length >= 10) {
    const hasDataPattern = /\$[\d,.]+|\d+\.\d+|price|cost|total|\d{2,}/i.test(signals.aiResult);
    if (hasDataPattern) {
      score = Math.min(1, score + 0.15);
      evidence.push('Extraction: AI reported data from DOM snapshot');
    }
  }
  return { approved: score >= 0.5, score, evidence, taskType: 'extraction' };
}
```

### Pattern 6: Media Validator

**New validator following the established pattern:**
```javascript
function mediaValidator(session, aiResponse, context, signals, scoreResult) {
  let { score, evidence } = scoreResult;
  const currentUrl = context.currentUrl || session.lastUrl || '';

  // Task-type URL pattern match -- strong bonus for media
  const mediaUrlPatterns = TASK_URL_PATTERNS.media || [];
  const urlMatches = mediaUrlPatterns.some(p => p.test(currentUrl));
  if (urlMatches) {
    score = Math.min(1, score + 0.30);
    evidence.push('Media: on streaming platform URL');
  }

  return { approved: score >= 0.5, score, evidence, taskType: 'media' };
}
```

**Wire into validators map in validateCompletion():**
```javascript
const validators = {
  // ... existing ...
  media: mediaValidator,
};
```

### Pattern 7: Relaxed Minimum Length for Media Tasks

**Current:** `validateCompletion()` rejects any result < 10 chars at L3921. "playing X" is typically 10+ chars, but edge cases like "done" or very short confirmations would be blocked.

**Recommendation:** Reduce min length to 5 for media tasks:
```javascript
const minLength = (taskType === 'media') ? 5 : 10;
if (!aiResponse.result || aiResponse.result.trim().length < minLength) {
  return { approved: false, score: 0, evidence: ['AI result too short or missing'], taskType: 'unknown' };
}
```

Note: The taskType must be determined before the min-length check. Currently classifyTask is called after the check. Reorder: call classifyTask first, then apply min-length.

### Anti-Patterns to Avoid

- **Instant-accept for any signal:** Never bypass the scoring system entirely. Even the escape hatch should log and flag, not silently accept.
- **Per-type thresholds:** The user decided to keep 0.50 universal. Don't introduce per-type thresholds.
- **Modifying the iteration loop caller:** All completion logic should stay in the validator functions. The escape hatch counter can use session state, but the decision stays in `validateCompletion()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL pattern matching | Custom URL parser per site | Simple regex patterns in a map | Maintainable, easy to extend |
| Stall detection | Complex state machine | Simple counter on session object | The pattern is clear: consecutive done signals |
| Data extraction detection | NLP analysis of AI result | Regex for common data patterns ($, numbers) | Sufficient for the use case |

## Common Pitfalls

### Pitfall 1: Weight Sum Exceeding 1.0
**What goes wrong:** After rebalancing, base weights + bonuses can exceed 1.0, making the score misleading.
**How to avoid:** All additions use `Math.min(1, score + bonus)` -- this is already the pattern in every validator. Maintain it.

### Pitfall 2: Media Regex Catching Non-Media Tasks
**What goes wrong:** "play" appears in many contexts ("play a role", "display settings").
**How to avoid:** The media classification requires BOTH a media verb AND a streaming platform keyword. "play a role on the team" won't match because no platform keyword is present.

### Pitfall 3: Escape Hatch Counter Not Resetting
**What goes wrong:** Counter increments across different task phases or after the AI actually does new work.
**How to avoid:** Reset `consecutiveDoneCount` to 0 when: (a) validation approves, (b) `aiResponse.taskComplete` is false in the iteration loop, (c) session is reset/continued.

### Pitfall 4: Reorder Bug in validateCompletion
**What goes wrong:** The min-length check at L3921 runs BEFORE `classifyTask()` at L3925. To apply a per-task-type min-length, must reorder: classify first, then check length.
**How to avoid:** Move `classifyTask()` call before the min-length check. The sheets URL override also needs to happen before min-length.

### Pitfall 5: detectUrlCompletionPattern Signature Change
**What goes wrong:** Adding `taskType` parameter to `detectUrlCompletionPattern()` breaks the existing call in `gatherCompletionSignals()` at L3656.
**How to avoid:** Update the caller in `gatherCompletionSignals()` to pass `taskType`. The taskType is already computed at L3653.

### Pitfall 6: Extraction Data Pattern False Positives
**What goes wrong:** Regex like `/\d{2,}/` matches dates, IDs, and other non-extraction data.
**How to avoid:** Use a more specific pattern: require currency symbols, "price", "cost", or decimal numbers. Keep the bonus moderate (+0.15 not +0.30) so false positives don't auto-approve.

## Code Examples

### Complete computeCompletionScore Rebalance
```javascript
// Source: background.js ~L3683 (modified)
function computeCompletionScore(signals, taskType) {
  const weights = {
    urlSignal: 0.20,      // Was 0.30
    domSignal: 0.20,      // Was 0.25
    aiReport: 0.30,       // Was 0.20 -- raised per user decision
    actionChain: 0.15,    // Unchanged
    pageStability: 0.10   // Unchanged
  };
  let score = 0;
  const evidence = [];

  // URL signal
  if (signals.urlMatch) {
    score += weights.urlSignal;
    evidence.push('URL: ' + signals.urlMatch);
  }
  // DOM signal
  if (signals.domSuccess || signals.confirmationPage || signals.toast) {
    score += weights.domSignal;
    evidence.push('DOM: ' + (signals.domSuccess || signals.toast || 'confirmation page'));
  } else if (signals.formReset && signals.actionChainComplete) {
    score += weights.domSignal * 0.5;
    evidence.push('DOM: form reset + action chain');
  }
  // AI self-report
  if (signals.aiComplete && signals.aiResult.length >= 10) {
    score += weights.aiReport;
    evidence.push('AI: task complete');
    if (signals.aiActionsEmpty) {
      score += 0.20;  // Was 0.15 -- raised per user decision
      evidence.push('AI: no remaining actions');
    }
  }
  // Action chain
  if (signals.actionChainComplete) {
    score += weights.actionChain;
    evidence.push('Actions: chain complete');
  }
  // Page stability
  if (signals.pageStable) {
    score += weights.pageStability;
    evidence.push('Page: stable');
  }

  return { score, evidence, threshold: 0.5 };
}
```

### Media Task Classification
```javascript
// Source: background.js ~L3419 (insert BEFORE gaming check)
// Media playback -- must precede gaming to prevent "play X on youtube" misclassification
const mediaVerbs = /play|watch|listen|stream/;
const mediaPlatforms = /youtube|spotify|soundcloud|netflix|hulu|twitch|vimeo|apple.?music|pandora|deezer|tidal|music/;
if (mediaVerbs.test(t) && mediaPlatforms.test(t)) return 'media';
```

### Escape Hatch in validateCompletion
```javascript
// Source: background.js, inside validateCompletion() after validator dispatch
// Escape hatch: consecutive rejected done signals force-accept
if (!result.approved) {
  session.consecutiveDoneCount = (session.consecutiveDoneCount || 0) + 1;
  if (session.consecutiveDoneCount >= 3) {
    result.approved = true;
    result.evidence.push('Escape hatch: ' + session.consecutiveDoneCount + ' consecutive done signals');
    result.escapeHatch = true;
    automationLogger.warn('Completion escape hatch triggered', {
      sessionId: session.id, consecutiveDoneCount: session.consecutiveDoneCount,
      originalScore: result.score, taskType: result.taskType
    });
  }
} else {
  session.consecutiveDoneCount = 0;
}
```

## Open Questions

1. **`music` keyword overlap in media platform regex**
   - What we know: The regex `/music/` would match "play music on my phone" (not a streaming task).
   - Recommendation: Use `/\bmusic\b/` or require it paired with a platform context. Or simply rely on the more specific platform names and drop the generic `music` keyword.

2. **Session `consecutiveDoneCount` initialization**
   - What we know: Need to add this to session creation at ~L5027 and session reset points (~L1107, ~L7113, ~L7585).
   - Recommendation: Initialize to 0 in all session creation/reset sites. Also reset in the iteration loop when `aiResponse.taskComplete` is false.

3. **AI result length check for media: threshold value**
   - What we know: "playing sunflower" = 18 chars (fine). "playing X" = 10 chars (borderline). Very short song names might be < 10.
   - Recommendation: Use 5 chars for media tasks. Any non-empty result like "playing" (7 chars) should pass.

## Sources

### Primary (HIGH confidence)
- `background.js` L3393-3972: Direct code reading of all affected functions
- `background.js` L9940-9957: Iteration loop validateCompletion call site
- `background.js` L5027-5031, L1107-1108: Session state initialization
- `.planning/phases/20-completion-validator-overhaul/20-CONTEXT.md`: User decisions and constraints

### Secondary (MEDIUM confidence)
- `.planning/phases/05-task-completion-verification/`: Original Phase 5 implementation context (CMP-01 through CMP-04)
- `.planning/ROADMAP.md`: Phase 20 requirements and success criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all changes are in existing vanilla JS functions, no new dependencies
- Architecture: HIGH - code patterns well-established (validator pattern, score capping, session state)
- Pitfalls: HIGH - identified from direct code reading and UAT session logs

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- internal code, no external dependencies)
