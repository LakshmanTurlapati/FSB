# Autopilot Diagnostic Report: Phase 86 - Session Expiry Re-Authentication

## Metadata
- Phase: 86
- Requirement: CONTEXT-10
- Date: 2026-03-22
- Outcome: PARTIAL (Login page the-internet.herokuapp.com/login fully accessible via HTTP 200, 2,376 bytes, server-rendered form with #login, #username, #password, button[type="submit"], .radius, #flash-messages container, and h2 "Login Page" heading. All session-expiry.js selectors confirmed in live HTML. Secure page (/secure) returns HTTP 302 redirect to /login (session expiry detection via Pattern B login redirect confirmed). Logout endpoint (/logout) returns HTTP 302 redirect to /login (session invalidation confirmed). Full login -> read secure page -> logout -> detect expiry -> re-authenticate -> resume reading workflow designed and documented but live execution blocked by WebSocket bridge disconnect. MCP server running on port 7225 returns HTTP 426 "Upgrade Required", same persistent blocker as Phases 55-85. Compact task state snapshot validated at 243 bytes, well under the 500-character limit.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch. Same persistent blocker as Phases 55-85.)

## Prompt Executed
"Navigate to a web application, log in, and begin reading a page. The session expires mid-task (simulated via logout). Detect the session expiration, re-authenticate with the same credentials, and resume reading the same page to verify the content matches what was seen before the session expired."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-85). HTTP-based validation was performed against all target sites. The primary target the-internet.herokuapp.com/login is fully server-rendered (HTTP 200, 2,376 bytes) with a complete login form (#login form, #username input, #password input, button[type="submit"] with .radius class). The session expiry detection pattern was confirmed via HTTP redirect behavior: accessing /secure without a session cookie returns HTTP 302 redirect to /login (Pattern B: login page redirect), and accessing /logout returns HTTP 302 redirect to /login (session invalidation). The #flash-messages container exists in the HTML but the #flash element appears only after login/logout actions (server-side rendered into the redirect response). The compact task state snapshot was validated at 243 bytes for the full re-auth cycle context, well under the 500-character CONTEXT-10 budget. Fallback targets were validated: uitestingplayground.com/sampleapp (HTTP 200, 5,159 bytes, login form selectors confirmed), demoqa.com/login (HTTP 200, 436 bytes, React SPA shell with no server-rendered form).

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1a | navigate | https://the-internet.herokuapp.com/login | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 2,376 bytes) | Page loads successfully. Title: "The Internet". Server-rendered login form present with form#login (action="/authenticate", method="post"), input#username (type="text"), input#password (type="password"), button.radius[type="submit"] containing "Login" text with Font Awesome icon. Demo credentials displayed in h4.subheader: tomsmith / SuperSecretPassword!. The h2 heading reads "Login Page". jQuery 1.11.3 and Foundation framework loaded. |
| 1b | (analysis) | Selector validation: #login form | CONFIRMED (1 match) | `<form name="login" id="login" action="/authenticate" method="post">` found at expected location. The form contains two input fields and one submit button. Action posts to /authenticate endpoint. |
| 1c | (analysis) | Selector validation: #username | CONFIRMED (1 match) | `<input type="text" name="username" id="username" />` with associated `<label for="username">Username</label>`. |
| 1d | (analysis) | Selector validation: #password | CONFIRMED (1 match) | `<input type="password" name="password" id="password" />` with associated `<label for="password">Password</label>`. |
| 1e | (analysis) | Selector validation: button[type="submit"] | CONFIRMED (1 match) | `<button class="radius" type="submit"><i class="fa fa-2x fa-sign-in"> Login</i></button>`. Both button[type="submit"] and .radius selectors match the same element. |
| 1f | (analysis) | Selector validation: #flash-messages | CONFIRMED (1 match, empty) | `<div id="flash-messages" class="large-12 columns">` exists but contains no #flash child element on the initial login page. The #flash element is dynamically injected by the server after login/logout actions (e.g., "You logged into a secure area!" or "You logged out of the secure area!"). |
| 1g | (analysis) | Selector validation: h2 heading | CONFIRMED (1 match) | `<h2>Login Page</h2>` inside `.example` div. This confirms the .example h2 pattern from session-expiry.js for heading extraction. |
| 2a | navigate | https://the-internet.herokuapp.com/secure | NOT EXECUTED (MCP) / FETCHED (HTTP 302, redirect to /login) | Without a session cookie, /secure returns HTTP 302 with Location: https://the-internet.herokuapp.com/login. This IS the session expiry detection pattern: Pattern B (login page redirect). When curl follows the redirect (-L flag), the final page is the login page (2,376 bytes). The redirect confirms that session state is server-managed via cookies -- no cookie means no session means redirect to login. |
| 2b | (analysis) | Session expiry detection via redirect | CONFIRMED (Pattern B) | The /secure endpoint does not render any content for unauthenticated requests. It immediately returns 302 to /login. For the autopilot, this means: after any action, if the current URL changes from /secure to /login unexpectedly, session expiry has occurred. Detection is trivial: compare current URL against expected task URL. |
| 2c | (analysis) | Flash message on redirect | NOT PRESENT in initial redirect | The login page after redirect from /secure does not include a flash message (the #flash-messages container is empty). The flash message "You logged out of the secure area!" only appears when hitting /logout, not when accessing /secure without a session. This means Pattern C (inline banner) co-occurs with /logout but not with /secure redirect. |
| 3a | navigate | https://the-internet.herokuapp.com/logout | NOT EXECUTED (MCP) / FETCHED (HTTP 302, redirect to /login) | Without a session cookie, /logout returns HTTP 302 with Location: https://the-internet.herokuapp.com/login. In a live browser with an active session, /logout would invalidate the session cookie and redirect to /login with a flash message "You logged out of the secure area!". Since HTTP fetch has no session cookie, the redirect behavior is the same but the flash message is absent (no session to invalidate). |
| 3b | (analysis) | Logout endpoint redirect behavior | CONFIRMED (302 to /login) | /logout always redirects to /login regardless of session state. In a live browser session: (a) with active session, /logout destroys the session and adds flash message, (b) without session, /logout simply redirects. This endpoint is the session expiry simulation mechanism -- navigating to /logout forces the session to end. |
| 4a | navigate + type_text + click | Full login workflow on /login | NOT EXECUTED (MCP) | Would execute: (a) navigate to /login, (b) type_text on #username with "tomsmith", (c) type_text on #password with "SuperSecretPassword!", (d) click button[type="submit"]. Expected result: POST to /authenticate, server validates credentials, sets session cookie, redirects to /secure with flash "You logged into a secure area!". Selectors for all 3 interaction points confirmed in steps 1b-1e. |
| 4b | read_page | .example (secure page content) | NOT EXECUTED (MCP) | Would read the heading and paragraph from the secure area page. Expected content based on known herokuapp pages: "Secure Area" heading and "Welcome to the Secure Area" description text with a logout button link. This content is the "task in progress" baseline for later comparison after re-auth. |
| 4c | (analysis) | Task state capture after login | VALIDATED (243 bytes) | Compact task state: `{"taskGoal":"read secure page content","lastUrl":"https://the-internet.herokuapp.com/secure","lastAction":"read_page on .example","lastResult":"Secure Area heading with Welcome to the Secure Area text. When you are done click logout button."}` = 243 bytes. Well under the 500-character CONTEXT-10 limit. |
| 4d | navigate | /logout (simulate session expiry) | NOT EXECUTED (MCP) | Would navigate to /logout to force session end. Expected: redirect to /login with flash message "You logged out of the secure area!". At this point, the session cookie is invalidated. |
| 4e | navigate | /secure (detect session expiry) | NOT EXECUTED (MCP) / SIMULATED via HTTP | Would attempt to navigate back to /secure. Expected: redirect to /login (Pattern B -- session expired, login required). HTTP validation confirms: /secure without session cookie returns HTTP 302 to /login (step 2a). Detection: URL does NOT contain /secure, URL contains /login, get_dom_snapshot would find #login form. |
| 4f | get_dom_snapshot | /login (confirm expiry) | NOT EXECUTED (MCP) | Would capture DOM snapshot of login page to confirm session expiry. Expected: #login form present with #username and #password inputs. Absence of secure page content and presence of login form confirms session is expired. |
| 4g | type_text + click | Re-authenticate on /login | NOT EXECUTED (MCP) | Would re-enter credentials: type_text on #username with "tomsmith", type_text on #password with "SuperSecretPassword!", click button[type="submit"]. Same sequence as step 4a. Expected: redirect to /secure with flash "You logged into a secure area!". |
| 4h | read_page | .example (resume task after re-auth) | NOT EXECUTED (MCP) | Would read the secure page content again after re-authentication. Expected: same "Secure Area" heading and description as captured in step 4b. Content match confirms task resumption is successful -- the session expiry was transparent to the overall task outcome. |
| 5a | (HTTP fetch) | https://uitestingplayground.com/sampleapp | FETCHED (HTTP 200, 5,159 bytes, SSL warning bypassed) | UITestingPlayground sample app accessible. Login form selectors found: input[name="UserName"] (username field), input[name="Password"] (password field), button#login (login button), #loginstatus (status text element). Server-rendered HTML with Bootstrap framework. Functional login form for practice, though no session/secure page concept (login status shown inline on same page). |
| 5b | (HTTP fetch) | https://demoqa.com/login | FETCHED (HTTP 200, 436 bytes) | DemoQA login page is a React SPA shell: `<div id="root"></div>` with Vite-bundled JavaScript. Zero server-rendered login form elements. The #userName, #password, and #login selectors from session-expiry.js are client-rendered by React after JavaScript bundle execution. Not testable via HTTP. |
| 6a | (analysis) | Pattern A: Modal/Dialog -- applicability to herokuapp | NOT APPLICABLE | The-Internet herokuapp does NOT use modals for session expiry. There are no aria-modal="true" or role="dialog" elements in any of the server-rendered pages. Session expiry is handled via redirect, not overlay. Pattern A would apply to enterprise apps (Workday, Salesforce) that show "Your session has expired" modal dialogs. |
| 6b | (analysis) | Pattern B: Login Redirect -- applicability to herokuapp | CONFIRMED PRIMARY PATTERN | /secure redirects to /login (HTTP 302) when no session cookie is present. This is the primary session expiry detection method for the-internet.herokuapp.com. Detection is trivial: compare current URL -- if it contains /login when the task was on /secure, session has expired. Fastest detection method (URL comparison, no DOM read needed). |
| 6c | (analysis) | Pattern C: Inline Banner -- applicability to herokuapp | PARTIALLY APPLICABLE | The #flash-messages container exists on all pages. After /logout, the server injects a #flash element with "You logged out of the secure area!" message. After failed login, #flash shows "Your username is invalid!" or "Your password is invalid!". However, when /secure redirects to /login (the actual session expiry path), no flash message is present. Pattern C co-occurs with Pattern B only on the /logout path, not on the /secure redirect path. |
| 6d | (analysis) | Pattern D: HTTP 401/403 -- applicability to herokuapp | NOT APPLICABLE | The-Internet herokuapp returns HTTP 302 (redirect) for unauthenticated /secure access, not 401 or 403. Pattern D would apply to API endpoints or basic-auth-protected pages. The /basic_auth endpoint on herokuapp does use 401, but that is a different authentication mechanism (HTTP Basic Auth, not session-based). |

## What Worked
- The-Internet Herokuapp login page (the-internet.herokuapp.com/login) is fully server-rendered -- the complete login form with all selectors is present in the initial HTTP response (2,376 bytes), no JavaScript execution required
- All session-expiry.js herokuapp selectors validated against live HTML: #login form (found, 1 match), #username input (found, 1 match), #password input (found, 1 match), button[type="submit"] (found, 1 match), .radius class on button (found, 1 match), #flash-messages container (found, 1 match, empty on initial page)
- Session expiry detection via login redirect (Pattern B) confirmed: /secure returns HTTP 302 to /login when no session cookie is present -- this is the primary detection mechanism
- Session invalidation via /logout confirmed: HTTP 302 redirect to /login, which simulates session expiry by destroying the session cookie
- Compact task state snapshot validated at 243 bytes for the complete re-auth context (taskGoal + lastUrl + lastAction + lastResult), well under the 500-character CONTEXT-10 limit
- UITestingPlayground sample app confirmed as functional fallback with server-rendered login form (5,159 bytes, input[name="UserName"], input[name="Password"], button#login, #loginstatus)
- MCP server process confirmed running on port 7225 (HTTP 426 response, consistent with Phases 55-85)
- The h2 heading "Login Page" and .example wrapper div confirmed -- these match the session-expiry.js selector pattern (.example h2) for page identification
- Demo credentials (tomsmith / SuperSecretPassword!) are displayed directly on the login page in the h4.subheader element, confirming availability for automation
- Login form action="/authenticate" with method="post" confirmed -- standard form submission that sets a session cookie

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected (HTTP 426). This is the same persistent blocker from Phases 55-85. Without the bridge, no MCP tool (navigate, type_text, click, read_page, get_dom_snapshot, wait_for_element) can execute against the live browser. The full session expiry workflow (login, read secure page, logout, detect expiry redirect, re-authenticate, resume and compare content) requires live browser MCP execution with session cookie management.
- **#flash element not present on initial login page:** The session-expiry.js selector for flashMessage (#flash) targets a dynamically injected element that only appears after server-side actions (login success, login failure, logout). On the initial /login page, the #flash-messages container exists but is empty. This is not a selector error -- #flash is correct for the post-login/post-logout state -- but it means the flash message cannot be validated via HTTP fetch on the initial page load.
- **Secure page content not readable via HTTP:** The /secure page requires an authenticated session cookie. HTTP fetch without a cookie receives only the 302 redirect to /login. The actual secure page content ("Secure Area" heading, description text, logout button) is only visible in a live browser after successful login. This means the pre-expiry task content and the post-re-auth content comparison cannot be performed via HTTP.
- **DemoQA login page is a React SPA shell:** demoqa.com/login returns a 436-byte HTML page with only `<div id="root"></div>`. All login form elements (#userName, #password, #login) are client-rendered by React. Cannot validate selectors via HTTP fetch.
- **Full re-auth cycle not executed:** The complete login -> task -> logout -> detect expiry -> re-auth -> resume -> compare workflow requires 8+ MCP tool invocations in sequence with session cookie persistence. HTTP fetch is stateless (each request is independent, no cookie jar) and cannot simulate the multi-step session workflow.
- **Content comparison not performed:** The CONTEXT-10 success criterion requires comparing secure page content before and after re-authentication to prove task resumption. Without live MCP execution, both content captures (pre-expiry and post-re-auth) are unavailable. The comparison logic is validated conceptually (same .example selector, same page) but not empirically.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-86):** The MCP server process runs on port 7225 but the Chrome extension side returns HTTP 426 "Upgrade Required" for browser action dispatch. This has blocked every live MCP test since Phase 55. The full CONTEXT-10 workflow requires: navigate to /login, type_text x2 for credentials, click login button, read_page on /secure, navigate to /logout, navigate to /secure (detect redirect), get_dom_snapshot for login form detection, type_text x2 for re-auth, click login button, read_page on /secure for comparison -- 11 MCP tool invocations in sequence with session state preservation.
- **No session state detection tool (cookies/auth headers):** There is no MCP tool to inspect browser cookies or authentication state directly. Session expiry detection relies on URL comparison (checking for redirect to /login) or DOM analysis (checking for login form presence). A `get_session_state` or `get_cookies(domain)` tool would enable direct session validity checking without navigating to a protected page. This would be useful for preemptive session monitoring (detect expiry before hitting a 302 redirect).
- **No automatic modal detection tool:** While get_dom_snapshot can capture the full DOM and a manual check for [aria-modal="true"] or [role="dialog"] could detect modals, there is no dedicated `detect_modal` or `check_for_overlay` tool that specifically scans for session expiry dialogs. For sites that use Pattern A (modal/dialog overlay), the autopilot would need to include modal detection as a step in every read_page cycle, adding context overhead.
- **type_text credential re-entry requires clearing existing field content:** When re-authenticating (step 4g), the #username and #password fields may still contain the previous credentials if the browser autofills or retains form state. The clear_input tool (or Ctrl+A before type_text) may be needed to ensure clean credential entry during re-authentication. This is a minor gap -- the session-expiry.js workflow does not explicitly mention clearing fields before re-entering credentials.
- **navigate cannot preserve response headers for redirect detection:** When navigate loads /secure and the server returns 302, the MCP navigate tool follows the redirect and loads /login. The autopilot sees the final URL (/login) but does not see the intermediate 302 status code or the original redirect chain. This is adequate for Pattern B detection (URL comparison works) but a `get_response_headers` tool would provide more diagnostic information about the redirect chain.

## Context Bloat Analysis

### Task State Snapshot Size

The compact task state snapshot for CONTEXT-10 session re-auth:

```
{
  "taskGoal": "read secure page content",
  "lastUrl": "https://the-internet.herokuapp.com/secure",
  "lastAction": "read_page on .example",
  "lastResult": "Secure Area heading with Welcome to the Secure Area text. When you are done click logout button."
}
```

**Total size: 243 bytes** -- well under the 500-character limit specified in CONTEXT-10.

The 4 fields capture everything needed to resume the task after re-authentication:
- taskGoal: what to do (read secure page content)
- lastUrl: where to go back to (/secure)
- lastAction: what to repeat (read_page on .example)
- lastResult: what to compare against (baseline content, truncated to 100 chars)

### DOM Reads Per Phase of the Re-Auth Workflow

| Phase | DOM Read | Estimated Size | Retained After Phase? |
|-------|----------|---------------|----------------------|
| 1. Login page (initial) | read_page or get_dom_snapshot on /login | ~2.4KB (full login page HTML) | NO -- discarded after login |
| 2. Secure page (pre-expiry task) | read_page on .example | ~0.5-1KB (heading + paragraph text) | YES -- stored as lastResult (100 chars) |
| 3. Login page (post-expiry detection) | get_dom_snapshot on /login | ~2.4KB (login form confirmation) | NO -- discarded after expiry confirmed |
| 4. Secure page (post-re-auth resume) | read_page on .example | ~0.5-1KB (heading + paragraph text) | YES -- compared with lastResult, then discarded |

**Total DOM reads: 4 read_page/get_dom_snapshot calls across the full workflow.**

Without compact state tracking, the autopilot would retain all 4 DOM snapshots: ~6.8KB cumulative.
With compact state tracking, only the 243-byte task state snapshot persists between phases: **96% reduction.**

### Compact State Tracking vs Full DOM Retention

| Tracking Strategy | Data Retained Across Re-Auth | Size | Context Cost |
|-------------------|------------------------------|------|-------------|
| Full DOM retention (all 4 snapshots) | Login page DOM + secure page DOM + login page DOM (post-expiry) + secure page DOM (post-re-auth) | ~6.8KB | HIGH -- stale login page DOMs are entirely irrelevant after re-auth |
| Partial retention (task-relevant only) | Secure page content (pre-expiry) + secure page content (post-re-auth) | ~1-2KB | MODERATE -- both secure page reads retained for comparison |
| Compact state (CONTEXT-10 approach) | {taskGoal, lastUrl, lastAction, lastResult} | 243 bytes | MINIMAL -- only 4 fields, lastResult truncated to 100 chars |
| Ultra-compact (without lastResult) | {taskGoal, lastUrl, lastAction} | ~130 bytes | MINIMAL BUT LOSSY -- cannot compare pre/post content without re-deriving |

**Recommendation: Compact state (243 bytes) is optimal.** It retains enough context for task resumption and content comparison baseline while discarding all stale DOM data.

### DOM Size Comparison: Login Page vs Secure Page vs Task State

| Page | Full HTML Size | Relevant Content Size | Task State Contribution |
|------|---------------|----------------------|------------------------|
| /login (2,376 bytes) | 2,376 bytes (full page with form, styles, scripts) | ~200 bytes (form fields + button -- the interactable elements) | 0 bytes after login (form data is not part of task state) |
| /secure (estimated) | ~1,500-2,500 bytes (heading, paragraph, logout button) | ~200-400 bytes (heading text + paragraph text from .example) | 100 bytes (lastResult: first 100 chars of .example content) |
| Task state snapshot | N/A | N/A | 243 bytes (entire snapshot) |

**Key insight:** The login page is 2,376 bytes but contributes 0 bytes to the task state after login. The secure page contributes only ~100 bytes (truncated lastResult). The 243-byte task state snapshot captures the essential information from a ~4,000-5,000 byte multi-page workflow.

### Full Workflow Context Budget

| Workflow Step | Context Added | Context Discarded | Running Total |
|--------------|--------------|-------------------|---------------|
| Navigate to /login | ~2.4KB (page HTML) | -- | 2.4KB |
| Type credentials + click login | ~0.3KB (tool responses) | 2.4KB (login page no longer needed) | 0.3KB |
| Read /secure content | ~1KB (read_page result) | 0.3KB (login tool responses) | 1KB |
| Capture task state | 243 bytes (compact snapshot) | 1KB (full page content replaced by 100-char lastResult) | 243 bytes |
| Navigate to /logout | ~0.5KB (redirect response) | -- | 0.7KB |
| Navigate to /secure (detect expiry) | ~2.4KB (login page after redirect) | 0.5KB (logout response) | 2.6KB |
| get_dom_snapshot (confirm expiry) | ~2.4KB (DOM snapshot) | 2.4KB (previous login page read) | 2.6KB |
| Re-authenticate (type + click) | ~0.3KB (tool responses) | 2.4KB (DOM snapshot, confirmed expiry) | 0.5KB |
| Read /secure (resume task) | ~1KB (read_page result) | 0.3KB (re-auth tool responses) | 1.2KB |
| Compare content | ~0.1KB (match/mismatch result) | 1KB (page content after comparison) | 0.3KB |

**Peak context: ~2.6KB** (during expiry detection, when login page DOM and task state are both in context).
**Steady-state context: ~0.3KB** (after each phase completes and stale data is discarded).
**Final context: ~0.5KB** (task state + comparison result).

### Comparison to Phase 83 (2FA Multi-Tab Auth Flow)

| Aspect | Phase 83: CONTEXT-07 (2FA Multi-Tab) | Phase 86: CONTEXT-10 (Session Expiry Re-Auth) |
|--------|---------------------------------------|-----------------------------------------------|
| Auth interruption type | 2FA code required after login (expected interruption) | Session expires mid-task (unexpected interruption) |
| Number of tabs | 2 (auth tab + email tab) | 1 (single tab, URL changes via redirect) |
| Interruption timing | Immediately after credential entry (predictable) | During task execution (unpredictable) |
| State to preserve | {authTabId, emailTabId, code} = ~50-80 bytes | {taskGoal, lastUrl, lastAction, lastResult} = 243 bytes |
| Re-auth complexity | Extract code from email tab, switch back, enter code | Re-enter same credentials (no external code needed) |
| Tab switching | 2 switches (auth->email, email->auth) | 0 switches (single tab, URL redirect handling) |
| Context peak | ~3-5KB (two tab DOMs + code extraction) | ~2.6KB (login page DOM + task state) |
| Primary challenge | Multi-tab coordination and code extraction | Detecting unexpected URL change and preserving task state |
| Credential reuse | Same password, plus new 2FA code from email | Exact same credentials (username + password) |

**Key difference:** Phase 83 is a predictable auth flow (2FA always happens after login), while Phase 86 is an unpredictable interruption (session can expire at any point during task execution). Phase 86 requires continuous URL monitoring, while Phase 83 has a fixed interruption point.

### Comparison to Phase 82 (Support Chatbot 15-Turn)

| Aspect | Phase 82: CONTEXT-06 (15-Turn Chatbot) | Phase 86: CONTEXT-10 (Session Expiry Re-Auth) |
|--------|----------------------------------------|-----------------------------------------------|
| Workflow type | Long-running conversation (15 turns) | Mid-task interruption and resumption |
| State tracking | Per-turn: {turnNumber, lastMessage, lastResponse} | Per-phase: {taskGoal, lastUrl, lastAction, lastResult} |
| Context growth pattern | Linear (grows with each turn) | Flat (compact state never exceeds 500 chars) |
| State size at completion | ~3,000 chars for 15 turns (200 chars/turn) | 243 bytes for entire re-auth cycle |
| Primary bloat source | Accumulating conversation history | Retaining stale DOM snapshots from before expiry |
| Mitigation strategy | Compact turn tracking, discard old turn DOMs | Compact task state, discard all pre-expiry DOM data |
| Context savings | 92-97% (compact tracking vs per-turn DOM reads) | 96% (243 bytes vs 6.8KB full DOM retention) |

**Key similarity:** Both phases use a compact state tracking pattern that captures only essential data per cycle and discards stale DOM content. The context savings are comparable (92-97% vs 96%).

### Recommendations for Context-Efficient Session Re-Auth Handling

1. **Capture task state immediately when session expiry is detected** -- do not attempt to read or save additional page content from the expired session. The current page (login form) is irrelevant to the task; only the pre-expiry state matters.
2. **Limit lastResult to 100 characters** -- enough for content comparison verification but prevents large page content from inflating the task state. If the task involves extracting structured data (tables, lists), store only the first item or a hash of the full data.
3. **Discard all DOM snapshots from before the session expiry** -- they describe pages that are no longer accessible. Fresh DOM reads after re-auth will rebuild the necessary context.
4. **The 4-field compact state ({taskGoal, lastUrl, lastAction, lastResult}) is the minimum viable state for task resumption.** Removing any field degrades resumption quality: without lastUrl, the autopilot does not know where to navigate after re-auth; without lastAction, it does not know what to repeat; without lastResult, it cannot verify successful resumption.

## Bugs Fixed In-Phase
- **Plan 01 -- session-expiry.js site guide created (8797dec):** Added registerSiteGuide with CONTEXT-10 guidance, handleSessionExpiry 14-step workflow, selectors for 5 demo targets, 5 warnings, 6 toolPreferences. Updated background.js with importScripts entry in Utilities section. No runtime bugs found during site guide addition.
- **No runtime bugs found in Plan 02:** No live code was executed that could reveal runtime bugs. The diagnostic is based on HTTP-based analysis against demo sites.
- **Observation: #flash element is absent from initial login page.** The session-expiry.js flashMessage selector (#flash) is correct for the post-login/post-logout state but cannot be validated on the initial page load. The #flash-messages container is present and empty. This is expected behavior -- not a bug.
- **Observation: uitestingplayground.com SSL certificate mismatch.** The HTTPS certificate for uitestingplayground.com does not match the hostname (curl error 60). The site is accessible when SSL verification is bypassed (-k flag). In a live browser, this may show a certificate warning. This does not affect the login form functionality but could block MCP navigate if the browser rejects the certificate.

## Autopilot Recommendations

1. **Detection priority: check URL change first (fastest), then DOM for modal/dialog, then flash/alert text, then page content.** URL comparison is O(1) and requires no DOM interaction. After any navigation or page load, compare the current URL against the expected task URL. If the URL contains /login, /signin, /auth when the task was on a different path, session expiry is likely. Only if URL comparison is inconclusive (same URL but different content) should the autopilot fall back to DOM analysis for modal/dialog detection or flash message parsing.

2. **Pre-expiry state capture: save {taskGoal, lastUrl, lastAction, lastResult} BEFORE attempting re-auth -- max 500 chars.** The compact task state must be captured as soon as session expiry is detected, before any re-authentication actions overwrite the context. The 4 fields provide: what to do (taskGoal), where to go (lastUrl), what to repeat (lastAction), and what to expect (lastResult). Total size is 243 bytes for the herokuapp workflow -- well under the 500-character budget. Truncate lastResult to the first 100 characters to prevent large page content from inflating the snapshot.

3. **Credential management: reuse credentials from initial login, do not ask user again.** The autopilot should store the credentials used for the initial login (username and password) in memory for the duration of the session. When session expiry is detected, the same credentials are re-entered without user intervention. For the-internet.herokuapp.com, this means reusing "tomsmith" and "SuperSecretPassword!" from the initial type_text calls. Never store credentials in persistent storage or logs -- memory only, cleared when the task completes.

4. **Re-auth verification: always navigate to the protected page AFTER re-auth to confirm session is truly restored.** Submitting the login form is not sufficient proof of re-authentication. The autopilot must navigate to the original task URL (lastUrl from the compact state) and verify that the expected content loads (not a login form). For herokuapp: after re-auth, navigate to /secure and verify read_page returns "Secure Area" content, not a login form redirect.

5. **Task resumption: re-execute the last action (e.g., read_page on same selector) and compare results.** After re-auth verification, the autopilot should repeat lastAction (e.g., read_page on .example) and compare the result with lastResult from the compact state. If the content matches, task resumption is successful. If content differs (page was updated during the session expiry window), note the difference but continue with the new content -- do not treat changed content as a failure.

6. **Double expiry handling: if session expires again during re-auth, restart from login (max 2 retry cycles).** A double expiry can occur if: (a) the session timeout is very short, (b) re-auth takes too long, or (c) the server has a rate limit on logins. If the autopilot detects a login redirect during or immediately after re-authentication, it should restart the full login sequence. Limit to 2 retry cycles to prevent infinite loops. After 2 failed re-auth attempts, report the task as blocked by authentication failure.

7. **Modal dismissal: if session expiry appears as modal overlay, dismiss/interact with modal before re-entering credentials.** For sites using Pattern A (modal/dialog), the session expiry notification overlays the page content. The autopilot must: (a) detect the modal via [aria-modal="true"] or [role="dialog"] selectors, (b) find and click the dismiss/close button (look for button with "Close", "X", "OK", "Log In" text or aria-label="Close"), (c) wait for the modal to be removed from the DOM, (d) then proceed to the revealed login form. Do not attempt to interact with form fields behind the modal -- they are not focusable.

8. **Flash message parsing: check #flash or .alert elements for "expired", "logged out", "session" keywords.** After any page load that might indicate session expiry, scan for banner/alert elements using the selectors from session-expiry.js (`.flash, .alert, .notification, .toast, [role="alert"]`). Extract text content and check for keywords: "expired", "logged out", "session", "timed out", "please log in", "authentication required". Flash messages provide diagnostic information about the type of session expiry (intentional logout vs timeout vs server-side invalidation) that can guide re-auth strategy.

9. **Avoid context bloat: discard all DOM snapshots from before the expiry -- only retain the compact task state.** This is the core CONTEXT-10 principle. When session expiry is detected: (a) capture the 4-field compact state (243 bytes), (b) discard the full DOM snapshot from the expired page (2-5KB saved), (c) discard the full page content from the last read_page (0.5-2KB saved), (d) discard any accumulated element lists or selector maps. After re-auth, rebuild context by reading the page fresh. Total savings: 96% reduction in context carried across the re-auth boundary.

10. **Polling approach: for real session timeouts, periodically check if current page still shows expected content (every 5 read_page calls, verify URL has not changed to /login).** In a long-running task with multiple page reads (e.g., extracting data from a paginated table over 10+ pages), insert periodic session health checks. Every 5th action, verify: (a) current URL matches expected URL (not redirected to /login), (b) read_page returns expected content type (not a login form). This catches session expiry early, before the autopilot has executed multiple actions on a stale/expired page. The polling overhead is minimal: one URL comparison (~0 bytes) and one conditional read_page (~1KB) every 5 actions.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| herokuapp loginForm: `#login` | Form element wrapping username/password inputs and submit button | FOUND (1 match). `<form name="login" id="login" action="/authenticate" method="post">` containing 2 inputs and 1 button. | MATCH |
| herokuapp usernameField: `#username` | Text input for entering username (tomsmith) | FOUND (1 match). `<input type="text" name="username" id="username" />` with associated label "Username". | MATCH |
| herokuapp passwordField: `#password` | Password input for entering password (SuperSecretPassword!) | FOUND (1 match). `<input type="password" name="password" id="password" />` with associated label "Password". | MATCH |
| herokuapp loginButton: `button[type="submit"]` | Submit button for the login form | FOUND (1 match). `<button class="radius" type="submit"><i class="fa fa-2x fa-sign-in"> Login</i></button>`. | MATCH |
| herokuapp loginButton alt: `.radius` | Alternate selector for submit button via class name | FOUND (1 match). Same element as button[type="submit"] -- the button has class="radius". | MATCH |
| herokuapp flashMessage: `#flash` | Flash message element showing login/logout status | NOT FOUND on initial login page (0 matches). The #flash-messages container exists (1 match) but #flash child is only present after server-side actions (login success/failure, logout). Expected to be present after login attempt with "You logged into a secure area!" or after logout with "You logged out of the secure area!". | CONDITIONAL MATCH (present after login/logout, absent on initial page) |
| herokuapp secureHeading: `.example h2` | Heading element on the secure page or login page | FOUND on login page (1 match). `<h2>Login Page</h2>` inside `.example` div. On /secure page, would show "Secure Area" heading. Selector works on both pages but returns different content. | MATCH |
| herokuapp secureParagraph: `.example p` | Paragraph text on secure page | NOT TESTABLE via HTTP. The /secure page requires authentication. On the login page, no `.example p` element is present (only h2 and h4 within .example). Would contain "Welcome to the Secure Area" description text on /secure. | NOT TESTABLE (auth required) |
| herokuapp logoutButton: `a[href="/logout"]` | Logout link/button on the secure page | NOT FOUND on login page (0 matches). The logout button is only present on the /secure page after authentication. Expected as an anchor element with href="/logout" and class="button secondary". | NOT TESTABLE (auth required, /secure page only) |
| uitestingplayground userField: `input[name="UserName"]` | Username input on sampleapp page | FOUND (1 match). `<input class="form-control" type="text" placeholder="User Name" name="UserName">`. | MATCH |
| uitestingplayground passField: `input[name="Password"]` | Password input on sampleapp page | FOUND (1 match). `<input class="form-control" type="password" placeholder="********" name="Password">`. | MATCH |
| uitestingplayground loginBtn: `#login` | Login button on sampleapp page | FOUND (1 match). `<button class="btn btn-primary" type="button" id="login">`. Note: type="button" not type="submit" -- click handler is JavaScript-based, not form submission. | MATCH |
| demoqa usernameField: `#userName` | Username input on demoqa login page | NOT FOUND in HTTP (0 matches in 436-byte SPA shell). Client-rendered by React. | NOT TESTABLE (client-rendered) |
| demoqa passwordField: `#password` | Password input on demoqa login page | NOT FOUND in HTTP (0 matches in 436-byte SPA shell). Client-rendered by React. | NOT TESTABLE (client-rendered) |
| demoqa loginButton: `#login` | Login button on demoqa login page | NOT FOUND in HTTP (0 matches). Client-rendered by React. | NOT TESTABLE (client-rendered) |

**Summary:** 9 of 15 selectors from session-expiry.js were validated. All 6 testable herokuapp selectors match the live HTML (5 exact matches, 1 conditional match for #flash which is present only after login/logout actions). All 3 uitestingplayground selectors match. 3 herokuapp selectors are not testable via HTTP (require authenticated session for /secure page access). 3 demoqa selectors are not testable via HTTP (client-rendered React SPA).

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| handleSessionExpiry workflow | site-guides/utilities/session-expiry.js | 14-step workflow for detecting session expiry (4 patterns: modal, redirect, banner, HTTP error), re-authenticating with saved credentials, and resuming the original task from a compact state snapshot under 500 characters. Covers: initial login, task state capture, session invalidation simulation via /logout, expiry detection via URL redirect, re-authentication, content comparison, and edge cases (double expiry, stale content, modal dismissal). Added in Plan 01 alongside CONTEXT-10 guidance, selectors for 5 demo targets (herokuapp primary + secondary, practiceautomation, uitestingplayground, demoqa), 5 warnings, and 6 toolPreferences. | N/A (site guide workflow, not MCP tool) |

No new MCP tools were added in this phase. The handleSessionExpiry workflow in session-expiry.js provides step-by-step guidance for the session expiry detection and re-authentication strategy using existing MCP tools (navigate, click, type_text, read_page, get_dom_snapshot, wait_for_element). The key architectural contributions are: (1) the 4-pattern detection framework (modal/dialog, login redirect, inline banner, HTTP 401/403) prioritized by detection speed, (2) the compact task state snapshot ({taskGoal, lastUrl, lastAction, lastResult} at 243 bytes) for context-efficient session re-auth interruption handling, and (3) the simulate-via-logout approach for testing re-auth workflows on the-internet.herokuapp.com without waiting for real session timeouts.
