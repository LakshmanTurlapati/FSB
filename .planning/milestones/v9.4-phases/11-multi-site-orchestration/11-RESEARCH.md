# Phase 11: Multi-Site Orchestration with Data Persistence - Research

**Researched:** 2026-02-23
**Domain:** Chrome Extension service worker orchestration, chrome.storage.local persistence, AI tool dispatch
**Confidence:** HIGH

## Summary

This phase adds sequential multi-company career search (2-10 companies per prompt) with persistent data accumulation using chrome.storage.local. The core challenge is orchestrating multiple sequential single-company searches within a single automation session, persisting job data after each company to survive service worker restarts, deduplicating at the end by apply link URL, and updating the ProgressOverlay with multi-site context.

The codebase already has all the building blocks: a mature single-company career search workflow (Phase 10), chrome.storage.local with `unlimitedStorage` permission, a background-handled tool dispatch pattern (used by multi-tab actions), a ProgressOverlay with Shadow DOM in visual-feedback.js, and company name extraction via `extractCompanyFromTask`/`getGuideByCompanyName` in site-guides/index.js. The implementation requires: (1) a multi-company task parser that extracts company names from prompts like "find DevOps jobs at Microsoft, Amazon, and Google", (2) an orchestration layer in background.js that loops through companies sequentially reusing the existing single-company automation loop, (3) storeJobData/getStoredJobs tools added to the AI tool registry and dispatched as background-handled tools, (4) deduplication by apply link URL before final output, and (5) ProgressOverlay updates showing "Searching Amazon... 2/3".

**Primary recommendation:** Build this as an orchestration layer on top of the existing single-company career session, not as a replacement. The multi-site orchestrator parses companies from the prompt, runs N sequential single-company sessions (reusing existing career workflow), persists after each via storeJobData, deduplicates at the end, and reports results. The AI itself calls storeJobData during each company's extraction phase -- the orchestrator just manages the sequence and progress context.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auth walls: present existing login flow, auto-resume once login detected. Non-blocking -- continue with other companies, come back to auth-walled company last
- Other failures (site down, no page load): retry once, then skip and move to next company
- Timeout: aggressive -- ~5 seconds first attempt, ~10 seconds retry, then move on
- Partial results: keep whatever was extracted before a failure
- No retry pass at end: proceed with whatever data was collected
- Failure communication: silent during workflow, all failures listed in final summary
- Total failure: AI gives specific summary distinguishing "no results found" from "site failure"; skip Sheets step if no data
- Progress: No chat messages -- use existing ProgressOverlay only
- Progress bar: use existing approach, can be refined generally
- Respect user's overlay toggle setting
- Final chat summary: context-dependent -- table/listing only if user asked for it, otherwise concise natural language
- If documenting to Sheets, no need to repeat all data in chat
- Duplicate = same apply link (URL match)
- Silently drop duplicates -- no mention to user
- Dedup happens once at end after all companies, before Sheets output
- Session memory (history/replay) is permanent -- never deleted
- Temporary job accumulation buffer can be cleared after successful Sheets export
- New search with old data: context-dependent relevance check
- No preview of stored data needed
- No explicit storage cap -- use what chrome.storage.local allows

### Claude's Discretion
- Exact ProgressOverlay text formatting for multi-site context
- Progress bar calculation refinements (general, not phase-specific)
- How to determine if old accumulated data is "relevant" to a new search
- Technical storage schema and key structure in chrome.storage.local
- How to detect login success for auto-resume after auth wall

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

No new external libraries required. This phase uses only existing Chrome Extension APIs and internal FSB modules.

### Core APIs
| API | Purpose | Why Standard |
|-----|---------|--------------|
| chrome.storage.local | Persist job data across service worker restarts | Already used throughout FSB (config, memory, analytics, sessions); unlimitedStorage permission already declared |
| chrome.storage.session | Track transient orchestration state (current company index, session ID) | Already used for session persistence in background.js |
| chrome.tabs API | Navigation between company career sites | Already used for multi-tab actions |

### Internal Modules Used
| Module | File | Purpose |
|--------|------|---------|
| extractCompanyFromTask | site-guides/index.js | Parse single company from task string |
| getGuideByCompanyName | site-guides/index.js | Look up career guide for company |
| COMPANY_ALIASES | site-guides/index.js | Resolve informal names to guide .site values |
| ProgressOverlay | content/visual-feedback.js | Display multi-site progress in floating overlay |
| sendSessionStatus | background.js | Push overlay updates to content script |
| handleMultiTabAction | background.js | Background-handled tool dispatch pattern |
| TOOL_DOCUMENTATION | ai/ai-integration.js | AI tool registry |
| career prompt | ai/ai-integration.js (TASK_PROMPTS.career) | Single-company search workflow |
| _buildTaskGuidance | ai/ai-integration.js | Inject company-specific guidance |

## Architecture Patterns

### Recommended Implementation Structure

```
Changes in existing files:
  background.js
    - Multi-company task detection function
    - Multi-company company list parser
    - Orchestration loop (wraps single-company sessions)
    - storeJobData handler (background-handled tool)
    - getStoredJobs handler (background-handled tool)
    - Deduplication function
    - Auth wall detection and deferred-company queue
    - Progress context injection into sendSessionStatus calls

  ai/ai-integration.js
    - Add storeJobData/getStoredJobs to TOOL_DOCUMENTATION
    - Extend career prompt with multi-site instructions
    - Add multi-site context to buildPrompt (company list, current index)

  site-guides/index.js
    - extractCompaniesFromTask (new function, multi-company parser)

  content/messaging.js
    - No changes needed (overlay update path already supports taskSummary + statusText)
```

### Pattern 1: Background-Handled Tool Dispatch (existing pattern)

**What:** Tools that need chrome.* APIs (like chrome.storage) run in the background service worker, not the content script. The background.js dispatches them via `handleMultiTabAction`-style switch statements.

**When to use:** For storeJobData and getStoredJobs, which need chrome.storage.local access.

**How it works in the existing codebase (line 7443 in background.js):**
```javascript
// Existing pattern -- multi-tab actions dispatched in background
const multiTabActions = ['openNewTab', 'switchToTab', 'closeTab', 'listTabs', 'waitForTabLoad', 'getCurrentTab'];

if (multiTabActions.includes(action.tool)) {
  actionResult = await handleMultiTabAction(action, session.tabId);
} else {
  // Send to content script
  actionResult = await sendMessageWithRetry(session.tabId, actionPayload);
}
```

**New tools follow the same pattern:**
```javascript
// Extend the background-handled tools list
const backgroundHandledTools = [
  ...multiTabActions,
  'storeJobData',
  'getStoredJobs'
];

if (backgroundHandledTools.includes(action.tool)) {
  actionResult = await handleBackgroundAction(action, session);
}
```

### Pattern 2: Orchestrated Sequential Sessions

**What:** A single user prompt "find jobs at Microsoft, Amazon, and Google" spawns an orchestrator that runs N sequential single-company career searches. Each search reuses the existing career automation loop.

**How to implement:**

The orchestrator does NOT replace the automation loop. Instead, it:
1. Detects multi-company intent at task start
2. Parses the company list
3. Stores orchestration state on the session object
4. The career prompt is augmented with: "You are searching company N of M. Search ONLY [CompanyName]. When done extracting, call storeJobData with the extracted jobs, then set taskComplete: true."
5. When the AI completes one company (taskComplete: true), the orchestrator intercepts completion, advances to the next company, resets task state, and re-launches the automation loop for the next company
6. After all companies searched, orchestrator runs dedup and produces final report

**Key architectural decision:** The orchestrator lives in background.js as a wrapper around the existing `startAutomationLoop`. When a multi-company session completes one company, the completion handler checks for remaining companies and re-launches rather than truly completing.

### Pattern 3: Job Data Storage Schema

**What:** chrome.storage.local schema for persisting extracted jobs.

**Recommended schema:**
```javascript
// Storage key: 'fsbJobAccumulator'
{
  sessionId: 'session_1234567890',    // Which search session produced this
  searchQuery: 'DevOps',              // What role was searched
  startedAt: 1708700000000,           // When this multi-site search began
  companies: {
    'Microsoft': {
      status: 'completed',            // 'completed' | 'failed' | 'auth_required' | 'skipped'
      jobs: [
        {
          company: 'Microsoft',
          title: 'Senior DevOps Engineer',
          location: 'Redmond, WA',
          datePosted: '2026-02-20',
          description: 'Lead cloud infrastructure...',
          applyLink: 'https://careers.microsoft.com/...',
          extractedAt: 1708700100000
        }
      ],
      error: null                     // Error message if status is not 'completed'
    },
    'Amazon': {
      status: 'auth_required',
      jobs: [],
      error: 'AUTH REQUIRED: Amazon requires login to view listings.'
    }
  },
  totalJobs: 8,                       // Pre-dedup count
  dedupedJobs: 7,                     // Post-dedup count (set after dedup pass)
  completedAt: null                   // Set when entire multi-site search finishes
}
```

**Why this structure:**
- Company-keyed object allows partial updates after each company
- Per-company status enables the failure summary at the end
- Flat job objects are easy to deduplicate by applyLink
- sessionId ties accumulator to the search that created it
- searchQuery enables relevance checking for "new search with old data"

### Pattern 4: Multi-Company Task Detection and Parsing

**What:** Detect prompts naming multiple companies and extract the list.

**Parsing approach:**
```javascript
function extractCompaniesFromTask(taskString) {
  // Patterns:
  // "find jobs at Microsoft, Amazon, and Google"
  // "search for DevOps roles at Microsoft, Amazon, Google"
  // "find DevOps jobs at Microsoft and Amazon"
  // "check careers at Meta, Apple, Netflix"

  // Step 1: Extract the "at [company list]" portion
  const atPattern = /\bat\s+(.+?)$/i;
  const match = taskString.match(atPattern);
  if (!match) return null;

  const companyPart = match[1];

  // Step 2: Split on commas and "and"
  // "Microsoft, Amazon, and Google" -> ["Microsoft", "Amazon", "Google"]
  const companies = companyPart
    .split(/,\s*(?:and\s+)?|\s+and\s+/i)
    .map(c => c.trim())
    .filter(c => c.length > 0 && !isStopWord(c));

  return companies.length >= 2 ? companies : null;
}
```

**Important:** The existing `extractCompanyFromTask` only extracts a SINGLE company. The new `extractCompaniesFromTask` (plural) handles comma/and-separated lists. Keep the original function for single-company backward compatibility.

### Pattern 5: ProgressOverlay Multi-Site Context

**What:** Update the overlay to show "Searching Amazon... 2/3" during multi-site workflows.

**Implementation via existing sendSessionStatus:**
```javascript
// In the orchestrator, before launching each company's search:
sendSessionStatus(session.tabId, {
  phase: 'analyzing',
  taskName: `Searching ${companyName}`,
  statusText: `${companyName} (${currentIndex}/${totalCompanies})`,
  iteration: session.iterationCount,
  maxIterations: session.maxIterations,
  animatedHighlights: session.animatedActionHighlights,
  taskSummary: `Job search: ${currentIndex}/${totalCompanies} companies`
});
```

The existing ProgressOverlay.update() already supports `taskName` and `stepText` fields. The `taskSummary` field (line 1006 in messaging.js) overrides `taskName` when present, making it ideal for showing the overall multi-site context while `stepText` shows per-iteration detail.

**Recommended overlay text format:**
- taskSummary: "Job search: 2/3 companies" (persistent, top line)
- stepText: "Searching Microsoft..." / "Extracting jobs..." / "Navigating to career page..." (per-iteration, changes with each step)

### Anti-Patterns to Avoid

- **DO NOT create separate sessions per company:** The orchestrator reuses a single session, resetting task context between companies. Separate sessions would lose conversation history, break the overlay, and waste resources.
- **DO NOT store jobs in the AI reasoning field:** The AI's reasoning is truncated at ~1000 chars and lost across iterations. Use chrome.storage.local via the storeJobData tool.
- **DO NOT parse job data from the AI's result string:** The AI should call storeJobData with structured data during extraction. Parsing free-text completion messages is fragile and unreliable.
- **DO NOT run companies in parallel:** Sequential-only per the locked decisions. Parallel would require multiple tabs and complicate auth wall handling.
- **DO NOT add chat messages for progress:** Locked decision -- use ProgressOverlay only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Single-company career search | New search workflow | Existing career prompt + _buildTaskGuidance | Phase 10 already handles navigation, extraction, cookie dismissal, error reporting |
| Tool dispatch to background | New message passing system | Extend multiTabActions pattern (line 7443) | Pattern is proven, handles errors, integrates with action logging |
| Progress overlay | New UI component | Existing ProgressOverlay + sendSessionStatus | Already renders in Shadow DOM, supports taskSummary, handles top-layer promotion |
| Company name resolution | Custom matching | getGuideByCompanyName + COMPANY_ALIASES | 38+ aliases verified, 3-tier matching (alias, direct, partial) |
| Storage persistence | IndexedDB or custom | chrome.storage.local | Already has unlimitedStorage, used throughout codebase, simpler API |
| Session persistence | New persistence layer | Extend existing persistSession pattern | Already persists essential fields to chrome.storage.session |

## Common Pitfalls

### Pitfall 1: Service Worker Termination Mid-Workflow

**What goes wrong:** Chrome kills the service worker during a multi-company search (after 5 minutes of inactivity or 30 seconds after last event). All in-memory state (company queue, current index) is lost.

**Why it happens:** Manifest V3 service workers are ephemeral. The existing `startKeepAlive` ping mechanism prevents termination during active sessions, but if there's a gap (e.g., waiting for user login on auth wall), the worker can die.

**How to avoid:**
1. Persist orchestration state (company list, current index, accumulator key) to chrome.storage.session alongside the existing session data in persistSession()
2. On service worker restart, restoreSessionsFromStorage() already restores sessions -- extend it to check for multi-site orchestration state and resume
3. The keepAlive mechanism (line 814) already runs during active sessions. Ensure auth-wall-deferred companies don't cause the session to fully idle.
4. Job data is in chrome.storage.local (survives restarts); orchestration state is in chrome.storage.session (survives worker restarts within browser session)

**Warning signs:** Jobs extracted for first 2 companies are present but the 3rd company was never searched. Check that keepAlive is active during inter-company transitions.

### Pitfall 2: AI Forgets It Should Call storeJobData

**What goes wrong:** The AI extracts jobs and reports them in the result text but never calls storeJobData, so no data is persisted.

**Why it happens:** The AI follows the existing career prompt which says "report extracted jobs using the STRUCTURED OUTPUT FORMAT". It doesn't know about storeJobData unless explicitly told.

**How to avoid:**
1. Extend the career prompt for multi-site mode with: "After extracting jobs, you MUST call storeJobData with the extracted data BEFORE marking taskComplete: true. Do NOT only report jobs in the result text -- they must be stored."
2. Add a validation check: when taskComplete fires for a multi-site company, verify that storeJobData was called during that company's session. If not, parse the result text as fallback (but log a warning).
3. Add storeJobData to the task-specific tool documentation so the AI knows the tool exists and its parameters.

### Pitfall 3: Deduplication Misses Due to URL Normalization

**What goes wrong:** Same job appears twice because one URL has a trailing slash, query parameters, or tracking tags that differ.

**Why it happens:** Career sites append UTM parameters, session IDs, or other tracking to apply URLs. "https://careers.microsoft.com/job/123" and "https://careers.microsoft.com/job/123?source=internal" are the "same" job but different strings.

**How to avoid:** Normalize apply URLs before dedup:
```javascript
function normalizeApplyUrl(url) {
  try {
    const parsed = new URL(url);
    // Remove common tracking params
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'source', 'ref', 'src'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    // Remove trailing slash
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return url; // If parsing fails, use raw URL
  }
}
```

### Pitfall 4: Auth Wall Detection Timing

**What goes wrong:** The AI reports "AUTH REQUIRED" in the result text but the orchestrator doesn't detect it programmatically, so the auth-walled company is marked as "completed" instead of "auth_required".

**Why it happens:** Auth detection relies on the AI's free-text response, which may vary in format.

**How to avoid:**
1. The existing career prompt already defines the format: "AUTH REQUIRED: [Company] requires login..."
2. Check the AI's result string for the "AUTH REQUIRED" prefix when taskComplete fires
3. Also check via storeJobData -- if the AI stores 0 jobs and reports AUTH REQUIRED, mark the company as auth_required in the accumulator
4. For login detection after auth wall: monitor `chrome.tabs.onUpdated` for URL changes away from the login page. When the URL changes to a non-login page on the same domain, the user likely logged in successfully.

### Pitfall 5: Accumulator Stale Data Across Unrelated Searches

**What goes wrong:** User searches "DevOps jobs at Microsoft, Amazon" then later searches "marketing roles at Apple, Netflix". The second search sees the DevOps data from the first search.

**Why it happens:** The accumulator in chrome.storage.local persists across searches.

**How to avoid:** Each new multi-site search checks the existing accumulator's `searchQuery`:
- If the new search query is similar (same role keywords) AND overlapping companies, keep relevant data
- If the search query is different (different role), clear the accumulator and start fresh
- "Relevance" check: simple keyword overlap between stored searchQuery and new task's role keywords. If overlap < 50%, clear.

## Code Examples

### Example 1: Multi-Company Parser
```javascript
// In site-guides/index.js
function extractCompaniesFromTask(taskString) {
  if (!taskString) return null;
  const task = taskString.trim();

  // Look for "at [company list]" pattern at end of task
  // Handles: "find jobs at Microsoft, Amazon, and Google"
  //          "search DevOps at Meta and Apple"
  const atPattern = /\bat\s+(.+?)$/i;
  const atMatch = task.match(atPattern);

  if (!atMatch) return null;

  const companyPart = atMatch[1];

  // Split on comma-and, comma, or standalone "and"
  const raw = companyPart
    .split(/,\s*(?:and\s+)?|\s+and\s+/i)
    .map(c => c.trim())
    .filter(c => c.length > 0);

  // Filter out non-company words
  const nonCompanyWords = [
    'find', 'search', 'look', 'get', 'show', 'list',
    'software', 'engineering', 'remote', 'senior', 'junior',
    'jobs', 'careers', 'openings', 'positions', 'roles'
  ];

  const companies = raw.filter(c =>
    !nonCompanyWords.includes(c.toLowerCase())
  );

  return companies.length >= 2 ? companies : null;
}
```

### Example 2: storeJobData Tool Handler (background.js)
```javascript
// Add to handleMultiTabAction or a new handleBackgroundAction
case 'storeJobData': {
  const { company, jobs } = params;
  const STORAGE_KEY = 'fsbJobAccumulator';

  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const accumulator = result[STORAGE_KEY] || {
      sessionId: session.sessionId || null,
      searchQuery: '',
      startedAt: Date.now(),
      companies: {},
      totalJobs: 0
    };

    accumulator.companies[company] = {
      status: 'completed',
      jobs: (jobs || []).map(job => ({
        ...job,
        company: company,
        extractedAt: Date.now()
      })),
      error: null
    };

    // Update total count
    accumulator.totalJobs = Object.values(accumulator.companies)
      .reduce((sum, c) => sum + (c.jobs?.length || 0), 0);

    await chrome.storage.local.set({ [STORAGE_KEY]: accumulator });

    resolve({
      success: true,
      message: `Stored ${jobs?.length || 0} jobs for ${company}`,
      totalAccumulated: accumulator.totalJobs
    });
  } catch (error) {
    resolve({ success: false, error: error.message });
  }
  break;
}
```

### Example 3: getStoredJobs Tool Handler (background.js)
```javascript
case 'getStoredJobs': {
  const STORAGE_KEY = 'fsbJobAccumulator';

  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const accumulator = result[STORAGE_KEY] || { companies: {} };

    // Flatten all jobs across companies
    const allJobs = [];
    for (const [company, data] of Object.entries(accumulator.companies)) {
      if (data.jobs) {
        allJobs.push(...data.jobs);
      }
    }

    resolve({
      success: true,
      jobs: allJobs,
      totalJobs: allJobs.length,
      companies: Object.keys(accumulator.companies),
      searchQuery: accumulator.searchQuery || ''
    });
  } catch (error) {
    resolve({ success: false, error: error.message, jobs: [] });
  }
  break;
}
```

### Example 4: Deduplication by Apply Link
```javascript
function deduplicateJobs(jobs) {
  const seen = new Map(); // normalizedUrl -> job
  const deduplicated = [];

  for (const job of jobs) {
    const applyLink = job.applyLink || '';
    if (!applyLink || applyLink === 'not available') {
      // Jobs without apply links are never duplicates
      deduplicated.push(job);
      continue;
    }

    const normalized = normalizeApplyUrl(applyLink);
    if (!seen.has(normalized)) {
      seen.set(normalized, job);
      deduplicated.push(job);
    }
    // Silently drop duplicates (locked decision)
  }

  return deduplicated;
}
```

### Example 5: Orchestrator Company Loop (background.js)
```javascript
// In the taskComplete handler for multi-site sessions
if (session.multiSite && aiResponse.taskComplete) {
  const { companyList, currentIndex, deferredCompanies } = session.multiSite;

  // Check if current company had auth wall
  const resultText = aiResponse.result || '';
  if (resultText.includes('AUTH REQUIRED')) {
    deferredCompanies.push({
      name: companyList[currentIndex],
      reason: 'auth_required'
    });
  }

  // Advance to next company
  session.multiSite.currentIndex++;

  if (session.multiSite.currentIndex < companyList.length) {
    // More companies to search -- reset and continue
    const nextCompany = companyList[session.multiSite.currentIndex];
    session.task = buildSingleCompanyTask(session.multiSite.originalTask, nextCompany);
    session.iterationCount = 0;
    session.stuckCounter = 0;
    session.actionHistory = [];
    // Re-launch automation loop for next company
    startAutomationLoop(sessionId);
  } else if (deferredCompanies.length > 0) {
    // All companies attempted, check deferred (auth wall) companies
    handleDeferredCompanies(sessionId, deferredCompanies);
  } else {
    // All done -- run dedup and report
    finalizeMultiSiteSearch(sessionId);
  }
}
```

### Example 6: TOOL_DOCUMENTATION Addition
```javascript
// Add to TOOL_DOCUMENTATION object in ai/ai-integration.js
data: {
  storeJobData: {
    params: {company: "Company Name", jobs: [{title: "...", location: "...", applyLink: "...", datePosted: "...", description: "..."}]},
    desc: "Store extracted job data for a company. Call this AFTER extracting jobs and BEFORE marking taskComplete. Jobs are persisted to storage for accumulation across companies.",
    example: '{"tool": "storeJobData", "params": {"company": "Microsoft", "jobs": [{"title": "DevOps Engineer", "location": "Redmond, WA", "applyLink": "https://...", "datePosted": "2026-02-20", "description": "Lead cloud infrastructure..."}]}}'
  },
  getStoredJobs: {
    params: {},
    desc: "Retrieve all previously stored job data from the accumulation buffer. Returns jobs from all companies searched so far.",
    example: '{"tool": "getStoredJobs", "params": {}}'
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session data only in memory | persistSession to chrome.storage.session | Already implemented (background.js:1127) | Sessions survive SW restarts |
| Fixed progress text | ProgressOverlay with taskSummary override | Already implemented (messaging.js:1006) | Supports context-dependent text |
| Single-company extractCompanyFromTask | Single-company only | Phase 10 | New multi-company parser needed |
| All tool dispatch via content script | multiTabActions dispatched in background | Already implemented (background.js:7443) | Pattern ready for storeJobData/getStoredJobs |

**Key existing capability:** The `taskSummary` field in sendSessionStatus (line 1006 in content/messaging.js) already overrides the task name in the overlay when present. This means multi-site context can be injected without modifying the overlay component itself -- just pass the right taskSummary string from the orchestrator.

## Open Questions

1. **Task syntax ambiguity for multi-company detection**
   - What we know: "find jobs at Microsoft, Amazon, and Google" is clearly multi-company
   - What's unclear: How to handle "find jobs at Microsoft and senior DevOps positions" (is "senior DevOps positions" a company or a role qualifier?)
   - Recommendation: Use getGuideByCompanyName + COMPANY_ALIASES as validation. If a parsed "company" name does not resolve to a known guide or alias, treat the whole string as a single-company task with role qualifiers. This limits multi-company to known companies (38+ guides), which is acceptable for Phase 11.

2. **Auth wall login detection mechanism**
   - What we know: User needs to log in manually, FSB should detect success and resume
   - What's unclear: Exact mechanism for detecting "user logged in successfully" -- URL change? Cookie presence? Page content change?
   - Recommendation: Monitor chrome.webNavigation.onCompleted for the deferred company's domain. When a navigation completes on that domain to a non-login URL (not containing /login, /signin, /auth), assume login succeeded and resume. This is simple, reliable, and works for most career sites.

3. **Exact session reset between companies**
   - What we know: Session state needs partial reset (clear action history, stuck counter, iteration count) but preserve the AI instance and conversation history
   - What's unclear: Whether to fully reset the AI's conversation history or inject a "context switch" message
   - Recommendation: Inject a follow-up context message (similar to existing injectFollowUpContext) that says "Now searching [NextCompany]. Previous companies completed: [list]. Reset your page analysis." This preserves the AI instance and avoids cold-starting a new provider connection.

## Sources

### Primary (HIGH confidence)
- background.js direct code inspection -- session management (lines 1046-1200), automation loop (lines 6254-8145), multi-tab action dispatch (lines 6097-6237, 7440-7520)
- ai/ai-integration.js direct code inspection -- TOOL_DOCUMENTATION (lines 15-99), career prompt (lines 262-338), _buildTaskGuidance (lines 3931-4023), buildPrompt (lines 1940-2060)
- site-guides/index.js direct code inspection -- extractCompanyFromTask (lines 292-350), getGuideByCompanyName (lines 253-283), COMPANY_ALIASES (lines 205-244)
- content/visual-feedback.js direct code inspection -- ProgressOverlay class (lines 219-470)
- content/messaging.js direct code inspection -- sessionStatus handler (lines 969-1035)
- manifest.json -- permissions include "storage" and "unlimitedStorage"
- lib/memory/memory-storage.js -- chrome.storage.local CRUD pattern with caching

### Secondary (MEDIUM confidence)
- [Chrome storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage) -- storage.local limit is 10MB (5MB in Chrome 113 and earlier), unlimited with unlimitedStorage permission
- [Chrome service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- service workers are ephemeral, persist state via chrome.storage
- [chrome.storage.session docs](https://developer.chrome.com/docs/extensions/reference/api/storage) -- in-memory only, survives SW restarts within browser session, ~10MB quota

### Tertiary (LOW confidence)
None -- all findings verified against codebase and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all APIs and modules already in use in the codebase
- Architecture: HIGH -- patterns directly derived from existing code (multi-tab dispatch, session management, overlay updates)
- Pitfalls: HIGH -- identified from actual service worker behavior and career prompt analysis
- Code examples: MEDIUM -- based on existing patterns but not yet tested in multi-site context

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable -- Chrome extension APIs and FSB codebase are well-understood)
