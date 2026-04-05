---
status: resolved
trigger: "E2E career search automation stalls - hover overlay disappears and nothing happens"
created: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two interacting failures caused the stall
test: Full session log analysis + source code trace
expecting: n/a - root cause confirmed
next_action: none - analysis complete

## Symptoms

expected: Multi-company career search (Microsoft + Amazon) -> extract jobs -> write to Google Sheets -> format
actual: Automation stalled completely after ~60s on iteration 3, hover overlay animation disappeared, nothing visible happened for ~70s until user manually stopped session
errors: (1) API request timed out after 35000ms, (2) xai API error: 520 - Web server is returning an unknown error (Cloudflare)
reproduction: Run "Find software engineer internship jobs at Microsoft and Amazon and put them in a Google Sheet" when xAI API is experiencing instability
started: During this specific session (2026-02-24 01:22:48 UTC)

## Eliminated

- hypothesis: Multi-site orchestration failed to detect companies
  evidence: Log shows "Multi-site orchestration initialized" with companies: ["Microsoft", "Amazon"], rewrittenTask: "Find software engineer internship jobs at Microsoft"
  timestamp: immediate

- hypothesis: Career task type detection failed
  evidence: Log shows taskType: "career" detected correctly, multi-site directive injected into system prompt (company: Microsoft, index: 0, total: 2)
  timestamp: immediate

- hypothesis: Navigation to Microsoft Careers failed
  evidence: Iteration 1 successfully navigated to careers.microsoft.com, iteration 2 showed DOM on careers.microsoft.com/v2/global/en/home.html, iteration 3 showed search results at apply.careers.microsoft.com with job listings
  timestamp: immediate

- hypothesis: Content script disconnected
  evidence: Health checks passed on iterations 2 and 3. Iteration 2 had 1 retry but recovered in 2s. DOM fetch on iteration 3 succeeded (74ms). Content script was healthy throughout.
  timestamp: immediate

- hypothesis: Service worker died
  evidence: Session log shows continuous operation from background.js. The "Stop automation request received" at 01:25:34 proves service worker was alive. Session was properly stopped and logged.
  timestamp: immediate

- hypothesis: Stuck detection triggered and halted the loop
  evidence: stuckCounter remained 0 throughout all 3 iterations. DOM changes were detected as "substantive" each time. No stuck recovery was triggered.
  timestamp: immediate

- hypothesis: Task completion was incorrectly flagged
  evidence: All AI responses had taskComplete: false. The fallback response (if reached) also sets taskComplete: false.
  timestamp: immediate

## Evidence

- timestamp: 2026-02-24T01:22:48Z
  checked: Session initialization and multi-site setup
  found: Multi-site orchestration correctly initialized with companies: ["Microsoft", "Amazon"]. Task rewritten to "Find software engineer internship jobs at Microsoft" for first company. Session created on tabId 695749984.
  implication: Multi-site orchestration code is working correctly

- timestamp: 2026-02-24T01:22:55Z
  checked: Iteration 1 - initial DOM and AI response
  found: Started on Amazon.com (wrong page). AI correctly reasoned it needed to navigate to careers.microsoft.com. Career site guide directive was injected. Action: navigate to https://careers.microsoft.com/. Navigation succeeded.
  implication: Career prompt injection and site-specific guidance working

- timestamp: 2026-02-24T01:23:04Z
  checked: Iteration 2 - Microsoft Careers interaction
  found: Now on careers.microsoft.com. DOM showed search form with job textbox (#job) and location textbox (#location). AI typed "software engineer internship" into e14 (job field) - succeeded. Then tried to click e2 ("Find jobs" button) but got "Unknown ref e2 - stale". Despite the click failure, the page actually navigated to search results at apply.careers.microsoft.com (the typing may have triggered autocomplete/navigation).
  implication: Stale ref issue is a minor problem (page navigation happened anyway), but the real issue is about to begin

- timestamp: 2026-02-24T01:23:23Z
  checked: Iteration 3 - search results page, API call begins
  found: DOM correctly shows search results with job cards (e.g., "Software Engineer: Internship Opportunities - Neurodiversity Hiring Program"). 76 elements visible. sendSessionStatus('thinking') sent to content script, starting the 60-second overlay watchdog timer.
  implication: Everything is correct at this point. The automation is working. The next step should be to extract job data.

- timestamp: 2026-02-24T01:23:58Z
  checked: API call attempt 1 result
  found: "API request timed out after 35000ms" - xAI API did not respond within the 30s default timeout (35s with overhead). No tokens returned (outputTokens: 0).
  implication: xAI API is unresponsive. Retry mechanism kicks in with 1s delay.

- timestamp: 2026-02-24T01:24:23Z (estimated)
  checked: Overlay watchdog behavior
  found: 60 seconds after the last sendSessionStatus call (at ~01:23:23), the overlay watchdog timer fires. It logs "[FSB] Overlay watchdog: no session status for 60s, cleaning up orphaned overlays" and calls destroy() on viewportGlow, progressOverlay, and actionGlowOverlay. The user sees the visual debug overlay disappear.
  implication: THIS IS THE VISUAL STALL. The overlay disappears because the background script is blocked in API retry loops and sends no status updates during that time.

- timestamp: 2026-02-24T01:24:40Z
  checked: API call attempt 2 result
  found: "xai API error: 520" - Cloudflare returned "Web server is returning an unknown error" for api.x.ai. The xAI backend server was down. Error page shows "Host: api.x.ai - Error". Retry mechanism kicks in with 2s delay.
  implication: xAI API infrastructure was experiencing an outage. This is an external service issue.

- timestamp: 2026-02-24T01:24:42Z
  checked: API call attempt 3 begins
  found: Third retry started. No response logged before user stopped the session at 01:25:34 (52 seconds later). The 3rd attempt was either also timing out or getting another 520 error.
  implication: All 3 retry attempts were failing due to xAI API outage.

- timestamp: 2026-02-24T01:25:34Z
  checked: Session termination
  found: "Stop automation request received" - user manually stopped after 2m 45s total duration. Only 3 actions completed total (navigate, type, click-failed). Session status: "stopped".
  implication: User gave up after seeing no visual feedback for ~70 seconds.

## Resolution

root_cause: TWO INTERACTING FAILURES caused the perceived "stall":

(1) PRIMARY: xAI API outage on iteration 3. The API was unresponsive/down during the critical moment when the automation needed to decide what to do with the search results. Attempt 1 timed out after 35s, attempt 2 got HTTP 520 from Cloudflare (api.x.ai server error), attempt 3 was pending when user stopped. Total API retry time: ~2+ minutes with no progress.

(2) SECONDARY (UX): The 60-second overlay watchdog in content/messaging.js:1020-1029 fires during the API retry cycle because no sendSessionStatus calls are made while the background script is blocked waiting for API responses. After 60s of no status updates, the watchdog destroys all visual overlays (viewport glow, progress overlay, action glow), making the automation appear dead to the user even though the background script was actively retrying.

The combination creates a terrible UX: the automation is still trying (retrying API calls), but the user sees no visual indication and concludes it's frozen.

fix: Two fixes needed:

FIX 1 - Send periodic "still alive" status updates during API retries:
In ai-integration.js, the retry loop (lines 1730-1916) should send a sendSessionStatus or chrome.runtime.sendMessage with a "retrying" phase between retry attempts, so the overlay watchdog gets reset and the user sees feedback like "AI service slow, retrying (attempt 2/3)..."

FIX 2 - Increase overlay watchdog timeout or make it smarter:
In content/messaging.js:1029, the 60000ms (60s) watchdog is too aggressive when API calls can take 35s+ per attempt with 3 retries. Options:
  (a) Increase to 120s or 180s
  (b) Show a "waiting for AI..." message instead of destroying overlays
  (c) Have the watchdog transition to a "degraded" state rather than full destruction

verification: Not applicable - this was a transient xAI API outage. The code-level fix would prevent the visual stall symptom.

files_changed: []

## Timeline Summary

```
01:22:48  Session started, multi-site detected [Microsoft, Amazon]
01:22:55  Iter 1: Navigate to careers.microsoft.com (SUCCESS)
01:23:04  Iter 2: Type search + click Find jobs (type OK, click stale ref, page navigated anyway)
01:23:23  Iter 3: Search results visible, API call starts, overlay watchdog starts 60s timer
01:23:58  API attempt 1: TIMEOUT after 35s
01:23:59  Retry delay: 1s
01:24:00  API attempt 2 starts
01:24:23  *** OVERLAY WATCHDOG FIRES *** - 60s since last status update - overlays destroyed
01:24:40  API attempt 2: HTTP 520 (xAI server down via Cloudflare)
01:24:42  Retry delay: 2s, API attempt 3 starts
01:25:34  User manually stops session after ~70s of no visual feedback
```

## Actionable Recommendations

1. **[HIGH] Keep-alive pings during API retries** - The retry loop in ai-integration.js should emit status messages between attempts so the content script overlay stays alive and the user sees retry progress.

2. **[MEDIUM] Softer overlay watchdog** - Instead of destroying overlays after 60s silence, show a degraded "waiting..." state. Only destroy after 5+ minutes or explicit session end.

3. **[LOW] API fallback provider** - When xAI fails 2+ times, consider falling back to an alternate configured provider (if available) rather than retrying the same failing endpoint.

4. **[LOW] Stale ref on iteration 2** - The click on e2 failed because typing into the search field caused autocomplete suggestions that changed the DOM, invalidating the ref. The AI batched type+click actions but the DOM changed between them. Consider re-fetching DOM between actions in a batch when the first action involves typing.
