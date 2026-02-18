# Phase 5: Task Completion Verification - Research

**Researched:** 2026-02-15
**Domain:** Browser automation task completion detection, multi-signal scoring, critical action safety
**Confidence:** HIGH (all findings based on direct codebase analysis of the 3 target files)

## Summary

Phase 5 adds system-level task completion verification to FSB so the extension independently knows when a task is done, rather than relying solely on the AI's `taskComplete: true` flag. This is the final phase of the v9.0.2 AI Situational Awareness milestone.

The current codebase already has primitive completion validation (background.js ~line 6383-6461) that checks for meaningful result text and recent critical action failures, but it is ad-hoc and messaging-task-specific. Phase 5 replaces this with a structured system: task-type-specific validators, multi-signal completion scoring (URL + DOM + AI + action chain + stability), a critical action registry with cooldown, enhanced progress tracking using Phase 3 change descriptors, and proactive completion signal detection in content.js.

**Primary recommendation:** Build a `classifyTask()` utility in background.js that maps session.task strings to task types, then restructure the existing completion validation block into a dispatcher that calls task-type-specific validator functions, each returning a confidence score. The critical action registry and proactive completion signals are independent subsystems that feed into the scoring.

## Standard Stack

No new libraries or dependencies. All work modifies existing functions in:

| File | Lines | Purpose in Phase 5 |
|------|-------|---------------------|
| `background.js` | 7504 | Completion validation, task classification, progress tracking, critical action registry |
| `content.js` | 12175 | Proactive completion signal scanning, extended `inferPageIntent()` |
| `ai/ai-integration.js` | 4093 | Prompt injection of completion signals and critical action warnings |

### Existing Infrastructure to Leverage

| Component | Location | How Phase 5 Uses It |
|-----------|----------|---------------------|
| `inferPageIntent()` | content.js:10300 | Extend with `success-confirmation` detection triggering completion candidate check |
| `pageState.hasSuccess` | content.js:10089 | Currently a simple CSS selector check -- enhance for proactive signal detection |
| `hardFacts.criticalActions` | ai-integration.js:331 | Already tracks irrevocable clicks -- Phase 5 adds cooldown and re-execution blocking |
| `changeSignals` | background.js:5187 | Multi-signal change data from Phase 3 -- feed into progress tracking |
| `detectTaskType()` | ai-integration.js:3549 | Existing task classifier in AI layer -- background.js needs its own for validators |
| `verifyMessageSent` | content.js:6743 | Existing messaging verification tool -- reference patterns for validator |
| `detectRepeatedSuccess()` | background.js:2466 | Existing stuck-state escape -- integrate with completion scoring |
| Completion validation block | background.js:6383-6461 | Current ad-hoc validation -- REPLACE with structured validators |
| Progress tracking | background.js:6215-6256 | Current progress logic -- ENHANCE with changeSignals integration |

## Architecture Patterns

### Recommended Structure for Phase 5 Changes

```
background.js additions:
  classifyTask(taskString)               -- NEW utility function
  validateCompletion(session, aiResponse, context)  -- NEW dispatcher replacing lines 6383-6461
    messagingValidator(session, aiResponse, context)
    formValidator(session, aiResponse, context)
    navigationValidator(session, aiResponse, context)
    searchValidator(session, aiResponse, context)
    extractionValidator(session, aiResponse, context)
    generalValidator(session, aiResponse, context)
  computeCompletionScore(signals)        -- NEW multi-signal scorer
  criticalActionRegistry                 -- NEW session-level data structure
    recordCriticalAction(session, action, result)
    isCooledDown(session, action)
    getCriticalActionSummary(session)

content.js additions:
  detectCompletionSignals()              -- NEW proactive scanner
  inferPageIntent() extensions           -- MODIFY existing function

ai/ai-integration.js additions:
  Prompt injection in buildPrompt()      -- MODIFY existing
  Prompt injection in buildMinimalUpdate() -- MODIFY existing
```

### Pattern 1: Task-Type-Specific Validators (CMP-01)

**What:** Each task type gets a dedicated validator function that checks task-specific completion signals.
**When to use:** Called from the completion validation block when `aiResponse.taskComplete === true`.

```javascript
// In background.js -- replaces lines 6383-6461
function validateCompletion(session, aiResponse, context) {
  // Require non-empty result from AI
  if (!aiResponse.result || aiResponse.result.trim().length < 10) {
    return { approved: false, reason: 'empty_result' };
  }

  const taskType = classifyTask(session.task);
  const signals = gatherCompletionSignals(session, aiResponse, context);
  const score = computeCompletionScore(signals, taskType);

  // Each validator returns { approved: bool, score: number, evidence: string[] }
  const validators = {
    messaging: messagingValidator,
    form: formValidator,
    navigation: navigationValidator,
    search: searchValidator,
    extraction: extractionValidator,
    email: emailValidator,
    shopping: shoppingValidator,
    general: generalValidator
  };

  const validator = validators[taskType] || validators.general;
  return validator(session, aiResponse, context, signals, score);
}
```

**Key insight:** The existing `isMessagingTask` check (background.js:6398) is already doing this for one type. The pattern generalizes it.

### Pattern 2: Multi-Signal Completion Scoring (CMP-02)

**What:** Weight-based scoring from 5 signal categories.
**Weights (from requirements):** URL patterns (0.3), DOM success indicators (0.25), AI self-report (0.2), action chain analysis (0.15), page stability (0.1).

```javascript
function computeCompletionScore(signals, taskType) {
  const weights = {
    urlSignal: 0.3,      // URL changed to expected pattern
    domSignal: 0.25,     // Success indicators in DOM
    aiReport: 0.2,       // AI says taskComplete: true with result
    actionChain: 0.15,   // Critical actions succeeded in history
    pageStability: 0.1   // Page stable after final action
  };

  let score = 0;
  const evidence = [];

  if (signals.urlMatch) {
    score += weights.urlSignal;
    evidence.push(`URL matches completion pattern: ${signals.urlMatch}`);
  }
  if (signals.domSuccess) {
    score += weights.domSignal;
    evidence.push(`DOM success indicator: ${signals.domSuccess}`);
  }
  if (signals.aiComplete) {
    score += weights.aiReport;
    evidence.push('AI reports task complete');
  }
  if (signals.actionChainComplete) {
    score += weights.actionChain;
    evidence.push(`Action chain complete: ${signals.actionChainEvidence}`);
  }
  if (signals.pageStable) {
    score += weights.pageStability;
    evidence.push('Page is stable');
  }

  return { score, evidence, threshold: 0.5 };
  // score >= 0.5 = approve completion
  // score >= 0.3 but < 0.5 = approve if AI is confident
  // score < 0.3 = reject
}
```

### Pattern 3: Critical Action Registry (CMP-03)

**What:** Session-level registry that records irrevocable actions and enforces cooldowns.
**Connects to:** Phase 4's `hardFacts.criticalActions` which already detects and records critical clicks.

```javascript
// Data structure on session object
session.criticalActionRegistry = {
  actions: [],  // { tool, selector, elementText, iteration, verified, timestamp }
  cooldowns: {} // { actionSignature: { blockedUntilIteration, reason } }
};

function recordCriticalAction(session, action, result) {
  const sig = createActionSignature(action); // Already exists in background.js
  session.criticalActionRegistry.actions.push({
    tool: action.tool,
    selector: action.params?.selector,
    elementText: result?.elementText || '',
    iteration: session.iterationCount,
    verified: result?.hadEffect === true,
    timestamp: Date.now()
  });
  // Block re-execution for 3 iterations
  session.criticalActionRegistry.cooldowns[sig] = {
    blockedUntilIteration: session.iterationCount + 3,
    reason: `Irrevocable action executed at iteration ${session.iterationCount}`
  };
}

function isCooledDown(session, action) {
  const sig = createActionSignature(action);
  const cooldown = session.criticalActionRegistry.cooldowns[sig];
  if (!cooldown) return false;
  return session.iterationCount < cooldown.blockedUntilIteration;
}
```

**Key relationship to Phase 4:** The `hardFacts.criticalActions` array (ai-integration.js:331) already detects irrevocable verb patterns (`send|submit|purchase|order|delete|publish|post`) and records them. Phase 5 adds the cooldown enforcement in background.js BEFORE actions execute, and surfaces the registry to the AI prompt.

### Pattern 4: Proactive Completion Signal Detection (DIF-01)

**What:** Content.js scans for success indicators AFTER each action and surfaces them as structured data.
**Where:** New `detectCompletionSignals()` function in content.js, called alongside existing page state detection.

```javascript
function detectCompletionSignals() {
  const signals = {
    successMessages: [],
    confirmationPage: false,
    formReset: false,
    toastNotification: null,
    urlPattern: null
  };

  // 1. Success messages (expand beyond current hasSuccess selector)
  const successSelectors = [
    '[class*="success"]', '.alert-success', '.success-message',
    '[role="status"][class*="success"]',
    '[role="alert"]:not([class*="error"])',
    '.toast', '.snackbar', '.notification',
    '.confirmation', '.thank-you', '.order-complete',
    '[class*="confirm"]', '[class*="receipt"]'
  ];

  for (const sel of successSelectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el.offsetParent === null) continue; // Not visible
      const text = (el.textContent || '').trim().substring(0, 100);
      if (text.length > 0) {
        signals.successMessages.push({ selector: sel, text });
      }
    }
  }

  // 2. Confirmation page URL patterns
  const url = window.location.href.toLowerCase();
  const confirmPatterns = [
    /confirm/, /success/, /thank/, /receipt/,
    /order[-_]?complete/, /checkout[-_]?complete/,
    /message[-_]?sent/, /submitted/
  ];
  for (const pat of confirmPatterns) {
    if (pat.test(url)) {
      signals.confirmationPage = true;
      signals.urlPattern = pat.source;
      break;
    }
  }

  // 3. Form reset detection
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const inputs = form.querySelectorAll('input:not([type="hidden"]), textarea');
    const allEmpty = Array.from(inputs).every(input => {
      const val = input.value || input.textContent || '';
      return val.trim() === '';
    });
    if (inputs.length > 0 && allEmpty) {
      signals.formReset = true;
      break;
    }
  }

  // 4. Toast/snackbar detection
  const toastSelectors = [
    '.toast:not(.hide)', '.snackbar:not(.hide)',
    '[class*="toast"][class*="show"]',
    '[class*="snack"][class*="show"]',
    '.Toastify__toast', '.MuiSnackbar-root',
    '[role="alert"]'
  ];
  for (const sel of toastSelectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) {
      signals.toastNotification = {
        text: (el.textContent || '').trim().substring(0, 100),
        selector: sel
      };
      break;
    }
  }

  return signals;
}
```

### Pattern 5: Enhanced Progress Tracking (CMP-04)

**What:** Integrate Phase 3 changeSignals into progress tracking to reduce false hard-stops.
**Where:** background.js ~line 6215-6256 (existing progress tracking block).

```javascript
// Current code (simplified):
const madeProgress = (
  (iterationStats.domChanged && iterationStats.actionsSucceeded > 0) ||
  iterationStats.urlChanged ||
  iterationStats.hadEffect ||
  iterationStats.hadNavigation
);

// Enhanced with changeSignals:
const madeProgress = (
  iterationStats.urlChanged ||
  iterationStats.hadNavigation ||
  iterationStats.hadEffect ||
  // NEW: Use changeSignals channels to distinguish meaningful changes
  (changeSignals.changed && changeSignals.channels.some(
    ch => ['structural', 'content', 'pageState'].includes(ch)
  ) && iterationStats.actionsSucceeded > 0) ||
  // NEW: Content-only change with successful read actions counts as progress for extraction tasks
  (changeSignals.changed && changeSignals.channels.includes('content') &&
   iterationStats.newDataExtracted)
);
```

### Pattern 6: Page Intent-Driven Completion (DIF-02)

**What:** Extend `inferPageIntent()` to return richer signals that influence completion checking.
**Where:** content.js:10300 -- the existing function already returns `'success-confirmation'` when `pageState.hasSuccess` is true. Phase 5 enhances the detection and propagates the intent to background.js for completion candidate checking.

```javascript
// In background.js, after receiving DOM with pageIntent:
const pageIntent = domResponse.structuredDOM.pageContext?.pageIntent;
if (pageIntent === 'success-confirmation') {
  // Trigger completion candidate check even if AI hasn't claimed taskComplete
  const completionSignals = domResponse.structuredDOM.completionSignals;
  if (completionSignals) {
    // Surface to AI as strong hint
    context.completionCandidate = {
      pageIntent,
      signals: completionSignals,
      suggestion: 'Page shows success state -- verify task completion and mark taskComplete: true'
    };
  }
}
```

### Anti-Patterns to Avoid

- **Replacing AI judgment entirely:** The system should augment AI completion detection, not override it. If the AI says `taskComplete: false` but the system sees success signals, surface the signals to AI rather than forcing completion.
- **Over-broad success selectors:** `[class*="success"]` can match CSS framework classes on non-success elements (e.g., `success-rate`, `success-stories`). Always combine selector match with text content analysis.
- **Blocking completion on stale cooldown data:** If the session has progressed past a cooldown window, do not retroactively block. Only check cooldowns BEFORE action execution.
- **Double-counting signals:** The existing `hardFacts.criticalActions` in ai-integration.js and the new `criticalActionRegistry` in background.js track the same events. The Phase 4 data feeds the AI prompt; the Phase 5 data feeds the completion validator. Do not duplicate detection logic -- have background.js be the source of truth and pass data to ai-integration.js.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task classification in background.js | Entirely new classifier | Port `detectTaskType()` from ai-integration.js:3549 | Same logic, already tested, add `messaging` type |
| Action signature computation | New signature function | Existing `createActionSignature()` in background.js | Already used for failed action dedup |
| Irrevocable action detection | New regex in background.js | Reuse MEM-03-01 pattern: `send\|submit\|purchase\|order\|delete\|publish\|post` | Already validated in Phase 4 |
| Page stability check | New stability implementation | Existing `waitForPageStability()` in content.js:4780 | Already used in completion flow (line 6470) |
| Toast detection framework | Complex MutationObserver | Simple selector scan per iteration | Toasts are transient but DOM-present; scanning each iteration catches them |

## Common Pitfalls

### Pitfall 1: AI Self-Report Unreliability

**What goes wrong:** The AI claims `taskComplete: true` when the task is not actually done (e.g., message typed but not sent).
**Why it happens:** The AI infers completion from its reasoning rather than verifying page state.
**How to avoid:** Multi-signal scoring (CMP-02). The AI self-report contributes only 0.2 weight. Require at least 0.5 total score.
**Warning signs:** Task completes within 2 iterations on messaging/form tasks.

### Pitfall 2: False Positive Success Detection

**What goes wrong:** `[class*="success"]` matches non-completion elements like a "success stories" section on a landing page.
**Why it happens:** CSS class name matching is inherently ambiguous.
**How to avoid:** Combine selector match with text content analysis. Check that the matched element contains success-indicative text (e.g., "sent", "submitted", "confirmed", "thank you", "order placed").
**Warning signs:** Completion triggers immediately on page load for certain sites.

### Pitfall 3: Stale Completion Signals

**What goes wrong:** A success banner from a previous form submission persists in the DOM, causing a false completion trigger for the next task.
**Why it happens:** Some sites show persistent success states.
**How to avoid:** Only count success signals that APPEARED after the session started (compare with initial page state) OR that appeared after a critical action in the current iteration.
**Warning signs:** Completion triggers on the first iteration without any actions.

### Pitfall 4: Cooldown Blocking Legitimate Re-Execution

**What goes wrong:** The user wants to send TWO messages, but the cooldown blocks the second send click.
**Why it happens:** The cooldown is action-signature-based and the second send uses the same selector.
**How to avoid:** Include actionable context in the signature (e.g., iteration + selector + text content). Different message text = different signature. Also, only block if the SAME exact action was verified as successful.
**Warning signs:** User reports "it only sent one message" on multi-message tasks.

### Pitfall 5: Progress Tracking False Negatives with Extraction Tasks

**What goes wrong:** The system triggers hard stop (6 iterations) during legitimate extraction tasks where the AI is reading content without changing DOM.
**Why it happens:** `getText` is read-only and doesn't count as progress in the current logic.
**How to avoid:** For extraction-type tasks, count successful `getText` that returns non-empty content as progress. Use `classifyTask()` to determine if extraction is the task type.
**Warning signs:** Extraction tasks hitting the 6-iteration hard stop consistently.

### Pitfall 6: Critical Action Registry Memory Growth

**What goes wrong:** Long sessions accumulate many entries in the registry, bloating session state.
**Why it happens:** Every irrevocable-verb click gets recorded with no cap.
**How to avoid:** Cap registry at 20 entries, dropping oldest. Cooldowns auto-expire by iteration check. Match Phase 4 pattern of capping `hardFacts.criticalActions` at 10.
**Warning signs:** Session JSON grows large on 30+ iteration tasks.

### Pitfall 7: Completion Signal Budget Impact on Prompt Size

**What goes wrong:** Adding completion signals to the AI prompt pushes it over the 15K HARD_PROMPT_CAP.
**Why it happens:** Phase 5 adds new prompt sections (completion signals, critical action warnings) to already-full prompts.
**How to avoid:** Budget the completion signal section at max 300 chars. Only include signals that are present (no empty sections). Prioritize: completion candidate hint > critical action warnings > detailed evidence.
**Warning signs:** Prompt truncation warnings in logs.

## Code Examples

### classifyTask() for Background.js

```javascript
// Source: Derived from ai-integration.js:3549 detectTaskType()
// Simplified for background.js -- no site guide dependency
function classifyTask(taskString) {
  const t = taskString.toLowerCase();

  // Email -- check before messaging to avoid overlap on "send"
  if (/email|mail|gmail|outlook|compose|inbox|draft/.test(t)) return 'email';
  // Messaging -- includes social media, chat, comments
  if (/message|send|text|chat|reply|comment|dm|post/.test(t)) return 'messaging';
  // Form submission
  if (/fill|form|submit|register|sign.?up|apply/.test(t)) return 'form';
  // Shopping
  if (/buy|purchase|order|add.?to.?cart|checkout|shop/.test(t)) return 'shopping';
  // Search/find
  if (/search|find|look.?for|what.?is|how.?to/.test(t)) return 'search';
  // Extraction
  if (/get|extract|price|read|check|scrape/.test(t)) return 'extraction';
  // Navigation
  if (/go.?to|navigate|open|visit/.test(t)) return 'navigation';

  return 'general';
}
```

### gatherCompletionSignals() Data Shape

```javascript
// Collected from multiple sources in background.js
function gatherCompletionSignals(session, aiResponse, context) {
  return {
    // URL signal (0.3 weight)
    urlMatch: detectUrlCompletionPattern(context.currentUrl, session.task),

    // DOM signal (0.25 weight) -- from content.js completionSignals
    domSuccess: context.completionSignals?.successMessages?.length > 0
      ? context.completionSignals.successMessages[0].text
      : null,
    confirmationPage: context.completionSignals?.confirmationPage || false,
    formReset: context.completionSignals?.formReset || false,
    toast: context.completionSignals?.toastNotification?.text || null,

    // AI self-report (0.2 weight)
    aiComplete: aiResponse.taskComplete === true,
    aiResult: aiResponse.result,
    aiConfidence: aiResponse.confidence,

    // Action chain (0.15 weight)
    actionChainComplete: checkActionChainComplete(session, classifyTask(session.task)),
    actionChainEvidence: summarizeActionChain(session),
    criticalActionsVerified: session.criticalActionRegistry?.actions
      ?.filter(a => a.verified).length || 0,

    // Page stability (0.1 weight) -- from existing stability check
    pageStable: context.pageStable || false
  };
}
```

### Messaging Validator Example

```javascript
function messagingValidator(session, aiResponse, context, signals, score) {
  const evidence = [...score.evidence];

  // Messaging-specific: compose window closing is strong signal
  if (signals.domSuccess && /sent|delivered|compose.*closed/.test(signals.domSuccess)) {
    score.score += 0.15; // Bonus for messaging-specific signal
    evidence.push('Messaging confirmation detected');
  }

  // Check for send action in recent history
  const recentSendClick = session.actionHistory.slice(-5).find(a =>
    a.tool === 'click' && a.result?.success &&
    /send|submit|post/i.test(a.result?.elementText || a.result?.clicked || '')
  );
  if (recentSendClick && recentSendClick.result?.hadEffect) {
    score.score += 0.1;
    evidence.push(`Send button clicked successfully at iteration ${recentSendClick.iteration}`);
  }

  return {
    approved: score.score >= 0.5,
    score: score.score,
    evidence,
    taskType: 'messaging'
  };
}
```

### Prompt Injection of Completion Signals

```javascript
// In ai-integration.js, added to buildPrompt() and buildMinimalUpdate()
if (context.completionCandidate) {
  userPrompt += `\n\n=== COMPLETION SIGNAL DETECTED ===`;
  userPrompt += `\nPage intent: ${context.completionCandidate.pageIntent}`;
  if (context.completionCandidate.signals.successMessages?.length > 0) {
    userPrompt += `\nSuccess message: "${context.completionCandidate.signals.successMessages[0].text}"`;
  }
  if (context.completionCandidate.signals.confirmationPage) {
    userPrompt += `\nURL indicates confirmation page`;
  }
  userPrompt += `\n--> ${context.completionCandidate.suggestion}`;
}

// Critical action warnings (always present when registry has entries)
if (context.criticalActionWarnings?.length > 0) {
  userPrompt += `\n\n=== CRITICAL ACTIONS (do NOT re-execute) ===`;
  context.criticalActionWarnings.forEach(w => {
    userPrompt += `\n- ${w.description} [${w.verified ? 'VERIFIED' : 'unverified'}] (blocked for ${w.cooldownRemaining} more iterations)`;
  });
}
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 5) | Impact |
|------------------------|------------------------|--------|
| Ad-hoc `isMessagingTask` boolean check | `classifyTask()` utility with 8 task types | All task types get specialized validation |
| Single `taskComplete` boolean from AI | Multi-signal scoring with 5 weighted signals | System-level confidence beyond AI self-report |
| No cooldown on critical actions | 3-iteration cooldown with registry | Prevents duplicate send/submit/purchase |
| `madeProgress` ignores changeSignals | Progress uses Phase 3 channel data | Fewer false hard-stops |
| Success detection only via `hasSuccess` CSS | Proactive multi-selector scanning with text analysis | Detects toasts, confirmations, form resets |
| `pageIntent` computed but unused for completion | `success-confirmation` intent triggers completion check | System notices success before AI does |

## Integration Points with Prior Phases

| Phase | What It Provides | How Phase 5 Consumes It |
|-------|-----------------|------------------------|
| Phase 1 | Accurate viewport detection | Completion signals only from visible elements |
| Phase 2 | Budget-based prompt (15K cap) | Completion signal section must fit in remaining budget (~300 chars) |
| Phase 3 | `changeSignals` with channels and summary | Enhanced progress tracking, `pageState` channel detects success/modal changes |
| Phase 4 | `hardFacts.criticalActions` with irrevocable verb detection | Background.js registry mirrors and extends with cooldown; AI prompt already shows critical actions |

## Data Flow Diagram

```
content.js                    background.js                  ai-integration.js
-----------                   -------------                  ------------------
detectCompletionSignals()  -> context.completionSignals   -> prompt: COMPLETION SIGNAL section
inferPageIntent()          -> context.pageIntent          -> prompt: PAGE UNDERSTANDING section
                              classifyTask(session.task)  <- (used internally by validators)
                              validateCompletion()        <- aiResponse.taskComplete
                              criticalActionRegistry      -> context.criticalActionWarnings -> prompt
                              computeCompletionScore()    <- gatherCompletionSignals()
                              Enhanced progress tracking  <- changeSignals (Phase 3)
```

## Blocker Resolution: lib/memory/ Overlap

STATE.md flagged: "`lib/memory/` is untracked and may overlap with MEM-04 long-term memory integration."

**Investigation findings:**
- `lib/memory/` exists with 6 files (schemas, storage, retriever, extractor, manager, consolidator)
- These files are imported via `importScripts()` at background.js lines 30-35
- Phase 4 (MEM-04) already integrated with these modules via `extractAndStoreMemories()` and long-term memory injection
- Phase 5 does NOT modify lib/memory/ files -- it only consumes session data already available in background.js
- **Conclusion:** No overlap concern for Phase 5. The blocker is resolved for this phase.

## Open Questions

1. **Completion score threshold calibration**
   - What we know: 0.5 threshold proposed for approval, 0.3 for conditional approval
   - What's unclear: Optimal thresholds may vary by task type (messaging might need higher confidence than navigation)
   - Recommendation: Start with 0.5 universal threshold, add per-type overrides if testing shows false positives/negatives. Log all scores for calibration.

2. **Form reset false positive rate**
   - What we know: Empty form fields can indicate reset OR initial empty state
   - What's unclear: How reliably we can distinguish "form was reset after submission" from "form was always empty"
   - Recommendation: Only count form reset if we have prior evidence of form being filled (action chain includes `type` actions targeting form inputs in the same form).

3. **Toast notification timing**
   - What we know: Toasts are transient (typically 3-5 seconds)
   - What's unclear: Whether scanning only at iteration boundaries catches toasts that appeared and disappeared between iterations
   - Recommendation: Scan immediately after action execution (within the action loop), not just at iteration start. Short toasts may still be missed -- accept this limitation since DOM change detection will still flag the structural change.

## Execution Order Recommendation

The 6 requirements should be implemented in this order based on dependencies:

1. **CMP-03** (Critical action registry) -- Independent subsystem, no other requirements depend on it, but all validators reference it
2. **CMP-01** (Task-type validators + `classifyTask()`) -- Needs CMP-03 data, replaces existing completion block
3. **CMP-02** (Multi-signal scoring) -- Integrates with CMP-01 validators
4. **DIF-01** (Proactive completion signals in content.js) -- Feeds data to CMP-02 signals
5. **DIF-02** (Page intent-driven completion) -- Extends DIF-01 signals with intent classification
6. **CMP-04** (Enhanced progress tracking) -- Independent of completion, modifies separate code block

Alternatively, CMP-04 and CMP-03 can be done first as they are independent foundation work, then CMP-01+CMP-02+DIF-01+DIF-02 as a connected set.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of background.js (7504 lines), content.js (12175 lines), ai/ai-integration.js (4093 lines)
- Existing completion validation block: background.js lines 6383-6461
- Existing progress tracking: background.js lines 6215-6256
- Existing `inferPageIntent()`: content.js lines 10300-10329
- Existing `detectTaskType()`: ai-integration.js lines 3549-3627
- Existing `hardFacts.criticalActions`: ai-integration.js lines 329-334, 721-736
- Existing `verifyMessageSent`: content.js lines 6743-6829
- Existing `changeSignals` construction: background.js lines 5183-5258
- Phase 3 and Phase 4 implementation details from previous plan summaries

### Secondary (MEDIUM confidence)
- Requirements document: CMP-01 through CMP-04, DIF-01, DIF-02 specifications
- ROADMAP.md Phase 5 description and success criteria
- STATE.md accumulated decisions from prior phases

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing files analyzed line-by-line
- Architecture: HIGH -- patterns derived from existing codebase conventions and prior phase patterns
- Pitfalls: HIGH -- based on actual code analysis showing where false positives/negatives arise
- Integration: HIGH -- all data flow paths traced through actual code

**Research date:** 2026-02-15
**Valid until:** Indefinite (codebase-specific research, not library-version-dependent)
