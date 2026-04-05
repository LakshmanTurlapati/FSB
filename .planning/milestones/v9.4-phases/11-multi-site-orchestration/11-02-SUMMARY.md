---
phase: 11
plan: 02
subsystem: orchestration
tags: [multi-site, career-search, sequencing, dedup, auth-deferral]
depends_on: ["11-01"]
provides: ["multi-site-orchestrator", "career-prompt-augmentation", "company-sequencing"]
affects: ["12-sheets-entry", "13-sheets-formatting"]
tech-stack:
  added: []
  patterns: ["session-state-machine", "completion-interception", "accumulator-pattern"]
key-files:
  created: []
  modified:
    - background.js
    - ai/ai-integration.js
decisions:
  - "Multi-site orchestration wraps existing automation loop -- does not replace it"
  - "Completion interception handles all exit paths: taskComplete, repeatedSuccess, no_progress, stuck"
  - "Auth-walled companies deferred to end; login detection uses tab-URL heuristic"
  - "storeJobData fallback parsing catches AI forgetting to call the tool"
  - "Per-company iteration cap set to 15 (min of user setting and 15)"
  - "Career task toolPreferences augmented to always include data tools"
metrics:
  duration: "8.6 min"
  completed: "2026-02-23"
---

# Phase 11 Plan 02: Multi-Site Orchestrator Summary

Multi-site orchestrator wrapping the existing single-company automation loop to sequence company searches, intercept completion to advance, defer auth-walled companies, run dedup at the end, and produce a concise final summary with failure reporting.

## What Was Built

### Task 1: Multi-site orchestrator in background.js (666318c)

Added the orchestration layer to background.js that detects multi-company career tasks and manages sequential company searches:

**Helper functions:**
- `extractSearchQuery(taskStr)`: Extracts role keywords from task (words before "at", excluding verbs)
- `buildSingleCompanyTask(originalTask, companyName)`: Rewrites "find X at A, B, C" to "find X at A"
- `initMultiSiteAccumulator(session)`: Initializes or validates chrome.storage.local accumulator
- `parseJobsFromResultText(resultText, company)`: Fallback parser when AI forgets storeJobData

**Core orchestration:**
- `handleMultiSiteCompletion(sessionId, session, aiResponse)`: Intercepts single-company completion, checks for auth walls (AUTH REQUIRED) and failures (PAGE ERROR), validates storeJobData was called (with fallback parsing), advances to next company or processes deferred companies
- `launchNextCompanySearch(sessionId, session, companyName)`: Resets session state (iterations, stuck counters, action history, DOM hashes) and restarts automation loop with 500ms transition delay
- `checkUserLoginStatus(companyName)`: Heuristic login detection by checking open tabs for non-login pages on company domain
- `finalizeMultiSiteSearch(sessionId, session)`: Flattens all jobs, runs deduplicateJobs, builds concise summary with per-company counts and failure list

**Session integration points:**
- Multi-company detection in session creation path using extractCompaniesFromTask
- Completion interception at 4 exit points: taskComplete, repeatedSuccess, no_progress, stuck
- Session state persistence includes multiSite object for service worker restart recovery
- context.multiSite injected into AI context for prompt augmentation
- ProgressOverlay updated with taskSummary "Job search: N/M companies"

### Task 2: Career prompt augmentation for multi-site mode (a291108)

Augmented ai-integration.js to give the AI multi-site awareness:

**Prompt injection:**
- MULTI-SITE SEARCH CONTEXT directive injected after system prompt (both full and minimal paths)
- Tells AI which company to search, its position in sequence, completed companies
- Explicit storeJobData obligation: "you MUST call storeJobData BEFORE marking taskComplete"

**Tool availability fixes (Rule 3 - blocking issue from 11-01):**
- Added storeJobData/getStoredJobs to `isValidTool` whitelist (was missing -- AI responses using these tools would be rejected as invalid)
- Added storeJobData/getStoredJobs to `allTools` map in `getToolsDocumentation` (was missing -- AI never saw documentation for these tools)
- Modified `getRelevantTools` to always include data tools for career task type even when site guide specifies toolPreferences

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] storeJobData/getStoredJobs missing from isValidTool and allTools**
- **Found during:** Task 2 verification
- **Issue:** 11-01 added TOOL_DOCUMENTATION.data and backgroundDataTools dispatch, but did not add the tools to the isValidTool whitelist or the allTools inline map in getToolsDocumentation. The AI would never see these tools in prompts, and any AI response using them would fail validation.
- **Fix:** Added both tools to isValidTool array and allTools map
- **Files modified:** ai/ai-integration.js
- **Commit:** a291108

**2. [Rule 3 - Blocking] Career site guides with toolPreferences exclude data tools**
- **Found during:** Task 2 verification of tool availability
- **Issue:** All career site guides (workday.js, greenhouse.js, etc.) define toolPreferences arrays that only include DOM interaction tools. When a site guide has toolPreferences, getRelevantTools returns ONLY those tools, bypassing the default case that would include data tools.
- **Fix:** Added career-specific augmentation in getRelevantTools to always include storeJobData/getStoredJobs when taskType is 'career'
- **Files modified:** ai/ai-integration.js
- **Commit:** a291108

**3. [Rule 2 - Missing Critical] Multi-site interception for no_progress and stuck exits**
- **Found during:** Task 1 implementation review
- **Issue:** Plan specified completion interception only for taskComplete handler. But single-company searches can also end via no_progress (6 consecutive no-progress iterations) or stuck (8 stuck iterations). Without interception at these exit points, a stuck company would end the entire multi-site session.
- **Fix:** Added multi-site interception at no_progress and stuck exit points, treating them as company-level failures and advancing to next company
- **Files modified:** background.js
- **Commit:** 666318c

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Multi-site orchestrator in background.js | 666318c | background.js |
| 2 | Career prompt augmentation for multi-site mode | a291108 | ai/ai-integration.js |

## Verification Results

1. Full multi-site flow: extractCompaniesFromTask detection -> orchestrator init -> sequential search -> storeJobData persist -> completion intercept -> next company -> dedup -> final summary -- all wired
2. Auth wall: AUTH REQUIRED pattern detected -> company deferred -> processed last with login heuristic check
3. Failure handling: no_progress/stuck/PAGE ERROR all caught -> failure logged -> advance to next company
4. Progress: ProgressOverlay shows "Job search: N/M companies" via taskSummary field at all sendSessionStatus calls
5. Service worker restart: multiSite state persisted via persistSession, accumulator in chrome.storage.local
6. Stale data: checkAccumulatorRelevance called during init, clears if 50%+ keyword mismatch
7. No chat progress messages: only ProgressOverlay updated (locked decision honored)
8. Final summary concise: natural language with per-company counts unless user asked for listing (locked decision honored)

## Self-Check: PASSED
