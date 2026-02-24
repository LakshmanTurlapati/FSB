# Phase 14: Execution Acceleration - Research

**Researched:** 2026-02-24
**Domain:** Browser automation execution engine -- action batching, DOM stability detection, locale injection
**Confidence:** HIGH

## Summary

Phase 14 accelerates the automation engine through three coordinated changes: (1) letting the AI batch multiple same-page actions into a single response, (2) replacing fixed inter-action delays with DOM mutation + network activity monitoring, and (3) injecting user timezone/country into every AI prompt for location-aware decisions.

The codebase already has significant infrastructure for all three areas. Action batching has a partial precedent in `executeDeterministicBatch` (SPEED-03 at line 5588 of background.js) which executes pattern-matched action batches with minimal delays. DOM stability detection already exists in `waitForPageStability` (content/actions.js line 804) combining MutationObserver + fetch/XHR interception. The `outcomeBasedDelay` function (background.js line 5375) already dispatches to different wait strategies based on action outcome type. The new work wires these together under AI control and adds a new `batchActions` array to the AI response format, plus a new "completion detection between each action" mechanism that uses the existing `waitForPageStability` as a foundation.

**Primary recommendation:** Implement `batchActions` as a new top-level array in the AI response JSON, processed by a new `executeBatchActions` function in background.js that sequentially runs each action with a `waitForPageStability` call between them (using the existing content-script-based MutationObserver + fetch/XHR interception). For timezone, use `Intl.DateTimeFormat().resolvedOptions().timeZone` in the background service worker with a static ~100-entry IANA-timezone-to-country lookup table -- no external library needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- AI explicitly declares batch intent via a new `batchActions` array (separate from the existing `actions` array)
- AI decides what's batchable based on page context -- system prompt tells it to always look for multi-action opportunities
- Batch size capped at 5-8 actions maximum
- Strictly sequential execution -- no conditional branching within a batch; if AI needs branching, it does so on the next iteration
- Navigation-triggering actions (clicks that may navigate, `navigate`, `searchGoogle`) must be the LAST action in any batch
- AI returns combined result after batch execution: "Executed N/M actions. Final page state: [DOM snapshot]"
- All tool types can be in a batch, but potential navigation actions must come last
- Existing single-action `actions` array still works unchanged for backward compatibility
- Primary completion detection: Content script using MutationObserver (DOM) + PerformanceObserver (network)
- Fallback: Background script via CDP (chrome.debugger) if content script detection fails or is unavailable
- Action is "complete" when both DOM mutations have stopped AND no pending network requests
- Each action gets a fresh 5-second timeout; timer resets after each successful action
- No-DOM-change scenario: if DOM is quiet but network is also idle, action is considered complete
- If DOM is quiet but network is still active, wait for network to settle (up to 5s)
- Timezone source: Browser APIs only -- `Intl.DateTimeFormat().resolvedOptions().timeZone` for timezone, derive country from timezone mapping
- Data passed to AI: country + local datetime (e.g., "User is in United States, local time: 2026-02-24 3:45 PM CST")
- Injected into ALL task types, not just career searches -- universally useful
- For career searches: if user mentions a country or state in their prompt, use that; otherwise, default to user's detected country
- No user configuration needed; purely automatic from browser APIs
- If any action in a batch fails: stop immediately, do not execute remaining actions
- No rollback of successfully completed actions -- they are committed to the page
- Failure report includes: which actions succeeded, which failed, failure reason, AND a fresh DOM snapshot
- AI reconsiders remaining (skipped) actions based on new context
- 5-second timeout on any action counts as a failure and stops the batch
- Combined result format includes success/failure status for each attempted action

### Claude's Discretion
- Exact DOM stability threshold (how many ms of quiet counts as "stable" -- likely 300-500ms)
- PerformanceObserver vs fetch/XHR interception for network monitoring in content script
- Timezone-to-country mapping implementation (static lookup table vs library)
- Exact prompt wording for batch instruction and locale injection
- Whether to use a separate `batchActions` key or extend the existing `actions` key with a `batch: true` flag

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (No New Dependencies)

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| MutationObserver | content/actions.js | DOM change detection | Already used in `waitForDOMStable` and `waitForPageStability` -- W3C standard, no polyfill needed |
| fetch/XHR interception | content/actions.js | Network activity tracking | Already implemented in `waitForPageStability` -- patches window.fetch and XMLHttpRequest.prototype |
| PerformanceObserver | content/actions.js (new) | Network request monitoring (alternative) | W3C standard, available in content scripts, observes `resource` entry type for all fetch/XHR/img/script loads |
| Intl.DateTimeFormat | background.js | Timezone detection | Built-in JS API, works in service workers, returns IANA timezone string |
| chrome.debugger | background.js | CDP fallback for completion detection | Already used by keyboard-emulator.js, `debugger` permission already in manifest.json |

### Supporting

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| Static timezone-to-country map | Derive country from IANA timezone | Always -- at session start, cached for session lifetime |
| `executeBatchActions` function (new) | Process `batchActions` array from AI response | When AI returns a `batchActions` key in its response |
| `waitForActionCompletion` function (new) | Unified completion detection between batch actions | Between every action in a batch |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fetch/XHR interception for network monitoring | PerformanceObserver with `resource` entryType | PerformanceObserver is cleaner (no monkey-patching) but only sees completed requests, not pending ones. Fetch/XHR interception tracks pending count. **Recommendation: Use fetch/XHR interception (already proven in codebase)** -- PerformanceObserver can supplement but cannot replace pending-request tracking |
| Static timezone-to-country lookup | `countries-and-timezones` npm package | npm package adds a dependency for something a 100-line static map solves. **Recommendation: Static map** -- Chrome extension cannot use npm packages without bundling, and the mapping is stable (IANA updates timezone names rarely) |
| Separate `batchActions` key | Extend `actions` with `batch: true` flag | CONTEXT.md leaves this as discretion. **Recommendation: Separate `batchActions` key** -- cleaner separation, zero risk of breaking existing single-action flow, AI models less likely to confuse batch vs non-batch semantics |
| CDP Network.requestWillBeSent for fallback | No network monitoring in fallback | CDP provides authoritative network state but requires debugger attachment. **Recommendation: Only use as fallback when content script detection is unavailable** -- debugger attachment shows a yellow bar in Chrome |

### Installation

No new packages needed. All implementation uses built-in browser APIs and existing Chrome extension APIs.

## Architecture Patterns

### Recommended Changes by File

```
background.js
  - New: executeBatchActions() function (~120 lines)
  - New: waitForActionCompletion() function (~40 lines)
  - New: getUserLocale() function (~30 lines)
  - New: TIMEZONE_TO_COUNTRY static map (~100 entries)
  - Modified: startAutomationLoop() -- add batchActions handling after existing actions handling
  - Modified: normalizeResponse() in ai-integration.js -- extract batchActions from AI response

ai/ai-integration.js
  - Modified: buildPrompt() -- inject locale context string into system prompt
  - Modified: system prompt text -- add batch action instructions
  - Modified: normalizeResponse() -- handle batchActions array

content/actions.js
  - New: waitForActionCompletion() tool (~60 lines, wraps existing waitForPageStability)
  - Modified: waitForPageStability() -- tune thresholds (discretion area)
```

### Pattern 1: Batch Action Execution Flow

**What:** When the AI returns a `batchActions` array, execute each action sequentially with completion detection between actions. Stop on failure.
**When to use:** Every time `batchActions` is present in AI response.

```javascript
// In background.js -- new function
async function executeBatchActions(batchActions, session, tabId) {
  const results = [];
  const batchStartTime = Date.now();
  const MAX_BATCH_SIZE = 8;

  // Cap batch size as a safety measure
  const actions = batchActions.slice(0, MAX_BATCH_SIZE);

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const actionStartTime = Date.now();

    // Route action to appropriate handler (same logic as existing action loop)
    let actionResult;
    if (multiTabActions.includes(action.tool)) {
      actionResult = await handleMultiTabAction(action, tabId);
    } else if (backgroundDataTools.includes(action.tool)) {
      actionResult = await handleBackgroundAction(action, session);
    } else {
      actionResult = await sendMessageWithRetry(tabId, {
        action: 'executeAction',
        tool: action.tool,
        params: action.params,
        visualContext: {
          taskName: session.task?.substring(0, 50),
          stepNumber: i + 1,
          totalSteps: actions.length,
          iterationCount: session.iterationCount,
          isBatchedAction: true,
          animatedHighlights: session.animatedActionHighlights ?? true
        }
      });
    }

    // Record result
    results.push({
      tool: action.tool,
      params: action.params,
      success: actionResult?.success || false,
      error: actionResult?.error || null,
      duration: Date.now() - actionStartTime
    });

    // Track in session history
    session.actionHistory.push({
      timestamp: Date.now(),
      tool: action.tool,
      params: action.params,
      result: slimActionResult(actionResult),
      iteration: session.iterationCount,
      batched: true,
      batchIndex: i,
      batchTotal: actions.length
    });

    // STOP ON FAILURE -- do not execute remaining actions
    if (!actionResult?.success) {
      automationLogger.warn('Batch action failed, stopping batch', {
        sessionId: session.sessionId,
        actionIndex: i,
        tool: action.tool,
        error: actionResult?.error,
        completedCount: i,
        remainingCount: actions.length - i - 1
      });
      break;
    }

    // COMPLETION DETECTION between actions (except after last action)
    if (i < actions.length - 1) {
      const nextAction = actions[i + 1];
      // Navigation-class actions get page load wait
      const navigationTools = ['navigate', 'searchGoogle', 'goBack', 'goForward'];
      if (navigationTools.includes(action.tool) || actionResult?.navigationTriggered) {
        await pageLoadWatcher.waitForPageReady(tabId, { maxWait: 5000 });
      } else {
        // DOM + network stability wait
        await sendMessageWithRetry(tabId, {
          action: 'executeAction',
          tool: 'waitForPageStability',
          params: { maxWait: 5000, stableTime: 300, networkQuietTime: 200 }
        });
      }
    }
  }

  return {
    batched: true,
    results,
    totalCount: actions.length,
    successCount: results.filter(r => r.success).length,
    failedAt: results.findIndex(r => !r.success),
    duration: Date.now() - batchStartTime,
    skippedActions: actions.slice(results.length)  // Actions not attempted
  };
}
```

### Pattern 2: Locale Context Injection

**What:** Detect user's timezone and country at session start, inject into every AI system prompt.
**When to use:** Every automation session.

```javascript
// In background.js -- new function
const TIMEZONE_TO_COUNTRY = {
  'America/New_York': 'United States',
  'America/Chicago': 'United States',
  'America/Denver': 'United States',
  'America/Los_Angeles': 'United States',
  'America/Anchorage': 'United States',
  'Pacific/Honolulu': 'United States',
  'America/Phoenix': 'United States',
  'Europe/London': 'United Kingdom',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'Asia/Tokyo': 'Japan',
  'Asia/Shanghai': 'China',
  'Asia/Kolkata': 'India',
  'Australia/Sydney': 'Australia',
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  // ... ~100 entries covering major timezones
};

function getUserLocale() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const country = TIMEZONE_TO_COUNTRY[timezone] || 'Unknown';
    const localDateTime = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    return {
      timezone,
      country,
      localDateTime,
      // Pre-formatted string for direct injection into system prompt
      promptString: `User is in ${country}, local time: ${localDateTime} (${timezone})`
    };
  } catch (e) {
    return {
      timezone: 'Unknown',
      country: 'Unknown',
      localDateTime: new Date().toISOString(),
      promptString: 'User timezone could not be detected.'
    };
  }
}
```

### Pattern 3: AI Response Format Extension

**What:** The AI response JSON gains an optional `batchActions` array alongside existing `actions`.
**When to use:** The AI decides when batching is appropriate based on system prompt guidance.

```javascript
// Extended AI response format -- batchActions is OPTIONAL
{
  "situationAnalysis": "...",
  "reasoning": "...",
  "actions": [{"tool": "click", "params": {"ref": "e5"}}],      // Single-action (existing, always works)
  "batchActions": [                                                // Multi-action batch (NEW, optional)
    {"tool": "click", "params": {"ref": "e1"}},
    {"tool": "type", "params": {"ref": "e2", "text": "hello"}},
    {"tool": "click", "params": {"ref": "e3"}}
  ],
  "taskComplete": false,
  "result": null
}

// Processing priority in background.js:
// 1. If batchActions present and non-empty -> executeBatchActions()
// 2. Else if actions present and non-empty -> existing action loop
// 3. Else -> no actions to execute
```

### Anti-Patterns to Avoid

- **Patching fetch/XHR permanently:** The current `waitForPageStability` temporarily patches `window.fetch` and `XMLHttpRequest.prototype`, then restores originals. This pattern must be maintained -- permanent patching would break websites. Each stability check should be a scoped observer lifetime.
- **Assuming batchActions is always safe:** Navigation-triggering actions (click on a link, navigate, searchGoogle) must always be the LAST item in a batch. The AI prompt must enforce this, and the execution engine should validate it as a guard.
- **Trusting AI batch size:** The AI might return more than 8 actions. The execution engine must enforce the cap (`slice(0, MAX_BATCH_SIZE)`) regardless of AI compliance.
- **Using PerformanceObserver as sole network monitor:** PerformanceObserver's `resource` entryType fires when a request COMPLETES, not when it starts. It cannot track "pending" requests. For completion detection, fetch/XHR interception is required to know if requests are in-flight.
- **Ignoring content script communication failures:** Between batch actions, if `waitForPageStability` fails (content script disconnect), the batch should stop and report the failure, not silently continue.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone-to-country mapping | Custom web scraper or geolocation API | Static lookup table (~100 entries) | IANA timezone names map deterministically to countries; no runtime API needed. The mapping changes only when IANA updates timezone definitions (extremely rare). |
| DOM stability detection | New MutationObserver-based system | Existing `waitForPageStability()` in content/actions.js | Already combines MutationObserver + fetch/XHR interception + pending request tracking. Tune thresholds, don't rebuild. |
| Network request monitoring | Custom `chrome.webRequest` interception from background | Existing fetch/XHR monkey-patching in content script | `chrome.webRequest` can't attribute requests to specific DOM actions. Content-script-level interception gives precise timing correlation. |
| Action delay management | New delay calculation system | Existing `outcomeBasedDelay()` + `OUTCOME_DELAYS` map | Already has strategy-based waiting (pageLoad, networkQuiet, domStable, minimal, none). For batch actions, reuse the `domStable` and `networkQuiet` strategies. |
| Deterministic batch detection | New pattern system | Existing `DETERMINISTIC_PATTERNS` + `executeDeterministicBatch()` | Keep this for automatic optimization. New `batchActions` from AI is a complementary path -- AI-declared batching vs engine-detected batching. Both can coexist. |

**Key insight:** The codebase already has ~80% of the infrastructure for all three features. This phase is primarily about wiring existing pieces together under AI control and adding the locale context layer. The risk is in integration, not in building new primitives.

## Common Pitfalls

### Pitfall 1: Batch Actions Causing Navigation Mid-Batch

**What goes wrong:** AI puts a click on a link (which navigates) in the middle of a batch. Subsequent actions target elements on the OLD page, causing failures or unintended behavior.
**Why it happens:** The AI doesn't always know which clicks will cause navigation. A "Submit" button might submit a form and stay on the page, or it might redirect.
**How to avoid:**
1. System prompt explicitly states navigation-triggering actions MUST be LAST in batch
2. Execution engine checks `actionResult.navigationTriggered` after each action; if true, stop the batch immediately (treat remaining as skipped, not failed)
3. After navigation, the next iteration gets fresh DOM context
**Warning signs:** `actionResult.navigationTriggered === true` for non-last actions in batch; URL changes mid-batch

### Pitfall 2: waitForPageStability Timeout Stalling Batch

**What goes wrong:** After a click that triggers AJAX, `waitForPageStability` waits the full 5s timeout because the site keeps making background requests (analytics pings, websocket polling, etc.).
**Why it happens:** Some sites have continuous network activity that never truly "settles."
**How to avoid:**
1. Use the existing significance filter in MutationObserver (ignore loading/spinner class changes)
2. For network quietness, only count fetch/XHR requests -- ignore image/script loads
3. Implement a "good enough" threshold: DOM stable for 300ms is sufficient even if network has background traffic
4. The 5s timeout is a hard cap -- if reached, proceed anyway (the action is "complete enough")
**Warning signs:** Frequent 5000ms wait times in timing logs; `timedOut: true` in stability results

### Pitfall 3: Content Script Disconnection During Batch

**What goes wrong:** A click navigates the page (even a soft navigation in SPAs), disconnecting the content script. The next `waitForPageStability` call fails because no content script is listening.
**Why it happens:** Single-page apps often do client-side navigation that re-initializes the page without a full reload.
**How to avoid:**
1. Wrap each `waitForPageStability` call in try/catch within the batch loop
2. On communication failure, attempt content script re-injection via `ensureContentScriptInjected()`
3. If re-injection also fails, stop the batch and report which actions completed
**Warning signs:** `sendMessageWithRetry` failures between batch actions; "content script not responding" errors

### Pitfall 4: macOS Sonoma Timezone Bug

**What goes wrong:** On macOS 14 (Sonoma), `Intl.DateTimeFormat().resolvedOptions().timeZone` can return a timezone abbreviation (like "CST") instead of an IANA name (like "America/Chicago").
**Why it happens:** Known Chrome bug on macOS Sonoma (Chromium issue #40540835).
**How to avoid:**
1. Validate that the returned timezone contains a "/" (IANA format is always "Region/City")
2. If no "/", fall back to `"Unknown"` country with a log warning
3. The service worker runs in Chrome's V8, not the page's -- this bug may not affect service workers
**Warning signs:** `getUserLocale()` returning timezone without "/" separator; country resolving to "Unknown" on macOS

### Pitfall 5: AI Ignoring Batch Instructions

**What goes wrong:** AI model continues to return single `actions` arrays and never uses `batchActions`.
**Why it happens:** Some models are less responsive to prompt engineering. The batchActions format is new and the model may default to what it has seen in training.
**How to avoid:**
1. System prompt includes explicit examples of when to use `batchActions`
2. Include a concrete example in the response format section
3. Don't make batching required -- the system works fine with single actions too (this is a performance optimization, not a correctness requirement)
4. Monitor batch usage in analytics/logging to detect adoption rates
**Warning signs:** `batchActions` never appearing in AI responses after deployment; logging shows 0% batch rate

### Pitfall 6: Double Execution of Actions

**What goes wrong:** Both `batchActions` and `actions` are present in the AI response, causing actions to execute twice.
**Why it happens:** AI returns both arrays with the same or overlapping content.
**How to avoid:**
1. Processing priority: if `batchActions` present and non-empty, use it exclusively; ignore `actions`
2. Document this precedence clearly in the code
3. Log when both arrays are present for debugging
**Warning signs:** Duplicate entries in `session.actionHistory` for the same iteration

## Code Examples

### Example 1: Integration Point in startAutomationLoop

```javascript
// In background.js, within startAutomationLoop, after existing AI response handling
// Location: after line ~8611 (current action processing block)

// Check for batch actions FIRST (takes precedence over regular actions)
if (aiResponse.batchActions && aiResponse.batchActions.length > 0) {
  automationLogger.info('Executing AI-declared batch', {
    sessionId,
    actionCount: aiResponse.batchActions.length,
    tools: aiResponse.batchActions.map(a => a.tool)
  });

  const batchResult = await executeBatchActions(aiResponse.batchActions, session, session.tabId);

  automationLogger.info('Batch execution complete', {
    sessionId,
    successCount: batchResult.successCount,
    totalCount: batchResult.totalCount,
    failedAt: batchResult.failedAt,
    duration: batchResult.duration
  });

  // If batch had failures, invalidate DOM prefetch
  if (batchResult.failedAt >= 0) {
    pendingDOMPrefetch = null;
  }

} else if (aiResponse.actions && aiResponse.actions.length > 0) {
  // Existing single-action execution path (unchanged)
  // ...existing code...
}
```

### Example 2: System Prompt Locale Injection

```javascript
// In ai-integration.js, within buildPrompt(), after taskType line (~2343)
// Inject locale context before tool documentation

const locale = getUserLocale();  // Called from background.js scope

systemPrompt += `

=== USER LOCALE ===
${locale.promptString}
Use this information for location-aware decisions (e.g., filtering job searches by country, using local date formats, time-sensitive actions).
For career/job searches: If the user does not specify a location, default to jobs in ${locale.country}.
`;
```

### Example 3: System Prompt Batch Instructions

```javascript
// Added to the REQUIRED RESPONSE FORMAT section in the system prompt

`=== ACTION BATCHING (PERFORMANCE OPTIMIZATION) ===

When multiple actions target the SAME page and don't depend on each other's results:
- Return them in a "batchActions" array instead of "actions"
- Maximum 5-8 actions per batch
- Actions execute sequentially with stability checks between each
- Navigation-triggering actions (click links, navigate, searchGoogle) MUST be LAST
- If an action fails, remaining actions are skipped
- The existing "actions" array still works for single actions

WHEN TO BATCH:
- Filling multiple form fields: type into field1, type into field2, type into field3
- Selecting multiple checkboxes or radio buttons
- Click + type sequences (click input, then type)
- Multiple data extraction calls (getText on several elements)
- Scroll + extract patterns (scroll down, then getText)

WHEN NOT TO BATCH:
- When the next action depends on the result of the previous one
- When any action might trigger page navigation (put it last or don't batch)
- When you need to verify an action's effect before deciding the next step

Example batch response:
{
  "reasoning": "Three form fields to fill on the same page, no dependencies between them",
  "batchActions": [
    {"tool": "type", "params": {"ref": "e3", "text": "John Doe"}},
    {"tool": "type", "params": {"ref": "e5", "text": "john@example.com"}},
    {"tool": "type", "params": {"ref": "e7", "text": "Software Engineer"}},
    {"tool": "click", "params": {"ref": "e9"}}
  ],
  "taskComplete": false
}`
```

### Example 4: Timezone-to-Country Lookup Map (Partial)

```javascript
// Static map -- covers all major IANA timezones (~100+ entries)
// Organized by region for maintainability
const TIMEZONE_TO_COUNTRY = {
  // Americas - United States
  'America/New_York': 'United States',
  'America/Chicago': 'United States',
  'America/Denver': 'United States',
  'America/Los_Angeles': 'United States',
  'America/Anchorage': 'United States',
  'Pacific/Honolulu': 'United States',
  'America/Phoenix': 'United States',
  'America/Indiana/Indianapolis': 'United States',
  'America/Detroit': 'United States',
  'America/Boise': 'United States',
  'America/Adak': 'United States',

  // Americas - Canada
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'America/Edmonton': 'Canada',
  'America/Winnipeg': 'Canada',
  'America/Halifax': 'Canada',
  'America/St_Johns': 'Canada',

  // Americas - Mexico
  'America/Mexico_City': 'Mexico',
  'America/Tijuana': 'Mexico',
  'America/Cancun': 'Mexico',

  // Americas - Brazil
  'America/Sao_Paulo': 'Brazil',
  'America/Manaus': 'Brazil',

  // Americas - Other
  'America/Bogota': 'Colombia',
  'America/Lima': 'Peru',
  'America/Santiago': 'Chile',
  'America/Buenos_Aires': 'Argentina',
  'America/Caracas': 'Venezuela',

  // Europe
  'Europe/London': 'United Kingdom',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'Europe/Madrid': 'Spain',
  'Europe/Rome': 'Italy',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Brussels': 'Belgium',
  'Europe/Zurich': 'Switzerland',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Warsaw': 'Poland',
  'Europe/Prague': 'Czech Republic',
  'Europe/Vienna': 'Austria',
  'Europe/Dublin': 'Ireland',
  'Europe/Lisbon': 'Portugal',
  'Europe/Athens': 'Greece',
  'Europe/Bucharest': 'Romania',
  'Europe/Istanbul': 'Turkey',
  'Europe/Moscow': 'Russia',
  'Europe/Kyiv': 'Ukraine',

  // Asia
  'Asia/Tokyo': 'Japan',
  'Asia/Shanghai': 'China',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Taipei': 'Taiwan',
  'Asia/Seoul': 'South Korea',
  'Asia/Kolkata': 'India',
  'Asia/Singapore': 'Singapore',
  'Asia/Bangkok': 'Thailand',
  'Asia/Jakarta': 'Indonesia',
  'Asia/Manila': 'Philippines',
  'Asia/Ho_Chi_Minh': 'Vietnam',
  'Asia/Kuala_Lumpur': 'Malaysia',
  'Asia/Dubai': 'United Arab Emirates',
  'Asia/Riyadh': 'Saudi Arabia',
  'Asia/Karachi': 'Pakistan',
  'Asia/Dhaka': 'Bangladesh',
  'Asia/Colombo': 'Sri Lanka',
  'Asia/Kathmandu': 'Nepal',
  'Asia/Tashkent': 'Uzbekistan',
  'Asia/Almaty': 'Kazakhstan',
  'Asia/Tehran': 'Iran',
  'Asia/Baghdad': 'Iraq',
  'Asia/Jerusalem': 'Israel',

  // Oceania
  'Australia/Sydney': 'Australia',
  'Australia/Melbourne': 'Australia',
  'Australia/Brisbane': 'Australia',
  'Australia/Perth': 'Australia',
  'Australia/Adelaide': 'Australia',
  'Pacific/Auckland': 'New Zealand',
  'Pacific/Fiji': 'Fiji',

  // Africa
  'Africa/Cairo': 'Egypt',
  'Africa/Lagos': 'Nigeria',
  'Africa/Johannesburg': 'South Africa',
  'Africa/Nairobi': 'Kenya',
  'Africa/Casablanca': 'Morocco',
  'Africa/Accra': 'Ghana'
};
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 14) | Impact |
|------------------------|------------------------|--------|
| 1 action per AI iteration, full DOM re-analysis each time | AI batches 2-8 same-page actions, DOM re-analysis only between iterations | 50-80% fewer AI roundtrips for multi-action pages (form fills, checkbox selections, data extraction) |
| Fixed 800ms delay between iterations | DOM stability detection (300-500ms threshold) between batch actions | Actions proceed as soon as page stabilizes -- faster for quick DOM updates, correct for slow AJAX |
| No locale context in AI prompts | Timezone + country + local datetime in every prompt | Career searches default to local jobs, time-aware decisions, date format awareness |
| `executeDeterministicBatch` detects patterns automatically | AI explicitly declares batches via `batchActions` | AI has broader batching intelligence than fixed patterns -- can batch any combination of same-page actions |
| `calculateActionDelay` uses category-based delays | `waitForPageStability` uses MutationObserver + network monitoring | Event-driven instead of estimate-based -- no wasted time on fast pages, correct waiting on slow pages |

**Coexistence note:** The existing `DETERMINISTIC_PATTERNS` / `executeDeterministicBatch` system should remain as an automatic optimization for the single-action path. When the AI returns regular `actions` (not `batchActions`), the existing batching system still applies. The two systems are complementary: AI-declared batching (batchActions) covers cases where the AI recognizes batch opportunities, while engine-detected batching covers cases where the AI didn't batch but the engine recognizes a safe pattern.

## Open Questions

1. **PerformanceObserver vs fetch/XHR interception for network monitoring**
   - What we know: The codebase already uses fetch/XHR interception in `waitForPageStability`. PerformanceObserver is cleaner but only fires on request completion, not initiation.
   - What's unclear: Whether PerformanceObserver in content script isolated world sees ALL page requests or only those initiated by the content script itself.
   - Recommendation: **Use fetch/XHR interception** (proven approach). PerformanceObserver can be added later as a supplementary signal if needed. The existing `waitForPageStability` function works well -- tune thresholds rather than rebuild.

2. **Exact DOM stability threshold**
   - What we know: Current `waitForPageStability` uses 500ms stableTime, 300ms networkQuietTime. Current `waitForDOMStable` also uses 500ms.
   - What's unclear: Whether 300ms is aggressive enough for fast SPAs or too conservative for slow server-rendered pages.
   - Recommendation: **Start with 300ms DOM stable + 200ms network quiet** for batch inter-action waits. This is more aggressive than the current 500ms defaults because batch actions are same-page operations that typically cause small DOM changes. The 5s timeout is the safety net.

3. **`batchActions` key vs `batch: true` flag on `actions`**
   - What we know: CONTEXT.md lists this as Claude's discretion. A separate key is simpler to parse and has zero backward-compatibility risk.
   - Recommendation: **Use separate `batchActions` key.** Reasoning: (a) `normalizeResponse()` already expects `actions` to be an array of single actions; (b) adding a flag would require the AI to always include it, increasing prompt size; (c) a separate key makes the intent explicit and parseable.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `background.js` lines 5358-5710 (OUTCOME_DELAYS, executeDeterministicBatch, DETERMINISTIC_PATTERNS)
- Codebase analysis: `background.js` lines 7529-9600 (startAutomationLoop, action execution loop)
- Codebase analysis: `background.js` lines 589-746 (PageLoadWatcher class)
- Codebase analysis: `background.js` lines 750-811 (smartWaitAfterAction function)
- Codebase analysis: `content/actions.js` lines 795-920 (waitForPageStability with MutationObserver + fetch/XHR)
- Codebase analysis: `content/actions.js` lines 2961-3060 (waitForDOMStable tool)
- Codebase analysis: `ai/ai-integration.js` lines 2141-2348 (system prompt construction)
- Codebase analysis: `ai/ai-integration.js` lines 3886-4084 (response parsing and normalizeResponse)
- Codebase analysis: `manifest.json` (debugger permission confirmed)

### Secondary (MEDIUM confidence)
- [MDN - PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver) - API reference for resource timing observation
- [MDN - Intl.DateTimeFormat.resolvedOptions()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions) - Timezone detection API
- [Chrome content scripts documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) - Isolated world execution context
- [Chromium issue #40540835](https://issues.chromium.org/issues/40540835) - macOS Sonoma timezone bug

### Tertiary (LOW confidence)
- [countries-and-timezones npm](https://www.npmjs.com/package/countries-and-timezones) - Reference for timezone-to-country mapping data (used to verify static map accuracy, not as a dependency)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components are existing browser APIs or already implemented in codebase
- Architecture: HIGH - extending proven patterns (executeDeterministicBatch, waitForPageStability, system prompt injection)
- Pitfalls: HIGH - identified from codebase analysis and known browser bugs
- Locale injection: HIGH for timezone detection, MEDIUM for country mapping accuracy (static map may miss obscure timezones)

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain -- browser APIs and extension patterns change slowly)
