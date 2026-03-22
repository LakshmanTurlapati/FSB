/**
 * Site Guide: Session Expiry Re-Authentication
 * Per-site guide for detecting session expiration, re-authenticating, and resuming
 * the interrupted task without losing progress or bloating context.
 *
 * Key challenge: preserving minimal task state across an authentication interruption.
 * Uses compact snapshot (under 500 characters) with only taskGoal, lastUrl, lastAction,
 * and lastResult -- discarding all DOM snapshots before re-auth.
 *
 * Created for Phase 86, CONTEXT-10 edge case validation.
 * Target: detect session expiry modal/redirect, re-authenticate, resume original task.
 */

registerSiteGuide({
  site: 'Session Expiry Re-Authentication',
  category: 'Utilities',
  patterns: [
    /session.expir/i,
    /session.timeout/i,
    /login.*redirect/i,
    /re.?auth/i,
    /the-internet\.herokuapp\.com/i,
    /practiceautomation\.com/i,
    /uitestingplayground\.com/i,
    /demoqa\.com\/login/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CONTEXT-10):
- [context] Store compact pre-expiry state: {lastUrl, lastAction, lastResult} ~200 chars
- [context] Detect session expiry by login form reappearance or 401/403 redirects
- [context] Re-auth then navigate to protected page to confirm session is restored
- [context] Resume task by re-executing lastAction and comparing with lastResult
- [context] Budget under 500 chars for re-auth state -- never dump full page DOM

SESSION EXPIRY RE-AUTHENTICATION INTELLIGENCE (CONTEXT-10):

This site guide handles the CONTEXT-10 edge case: session expiration mid-task. The workflow
detects session expiry (modal, redirect, banner, or HTTP error), re-authenticates with
saved credentials, and resumes the original task from a compact state snapshot. The core
challenge is preserving task state across an authentication interruption without bloating
context -- all DOM snapshots are discarded before re-auth and only a minimal state object
(under 500 characters) is retained.

TARGET SITES:

Primary target: the-internet.herokuapp.com/login
  - Heroku test app with known test credentials: tomsmith / SuperSecretPassword!
  - After login, navigate to /secure page
  - Simulate session expiry by navigating to /logout which redirects to /login
    with a flash message "You logged out of the secure area!"
  - Re-authenticate and verify /secure page is accessible again
  - This demonstrates the full login -> session loss -> re-auth -> resume cycle

Secondary target: the-internet.herokuapp.com/basic_auth
  - Basic HTTP auth page with user:admin / password:admin credentials
  - Auth state is per-request (session-less), demonstrating a different re-auth pattern

Fallback 1: practiceautomation.com
  - Test site with various form types including login forms

Fallback 2: uitestingplayground.com/sampleapp
  - Simple login form with test credentials for practice

Fallback 3: demoqa.com/login
  - BookStore login form (requires registration but demonstrates login form interaction)

SIMULATION APPROACH:
Since real session timeout is time-dependent (typically 15-30 minutes), the workflow
simulates session expiry by:
  (a) Logging in to the target site
  (b) Performing a task (e.g., reading secure page content)
  (c) Navigating to /logout to force session end
  (d) Attempting to access the secure page (which triggers redirect to login)
  (e) Detecting the login page redirect as "session expiry"
  (f) Re-authenticating
  (g) Resuming the original task (re-reading secure page content)

SESSION EXPIRY DETECTION PATTERNS:

Pattern A: Modal/Dialog overlay
  - Elements with aria-modal="true", role="dialog", .modal, .modal-dialog, .overlay
  - Appears over page content blocking interaction
  - Detection: get_dom_snapshot checks for [aria-modal="true"] or [role="dialog"] elements
  - Common text: "Your session has expired", "Session timeout", "Please log in again"
  - Dismiss: click close/X button, then re-authenticate in the revealed login form

Pattern B: Login page redirect
  - URL changes to /login, /signin, /auth -- current URL differs from expected task URL
  - The server invalidated the session cookie and redirected to the login page
  - Detection: after any navigation, compare current URL to expected task URL
  - Strongest signal: URL contains /login or /signin when task URL was /secure or /dashboard
  - On the-internet.herokuapp.com: /secure redirects to /login after logout

Pattern C: Inline banner/toast
  - Flash messages like "Session expired", "Please log in again"
  - Appear as div.flash, .alert, .notification, .toast, [role="alert"]
  - Detection: read_page or get_dom_snapshot checks for banner text patterns
  - On the-internet.herokuapp.com: #flash element shows "You logged out of the secure area!"
  - May co-occur with Pattern B (redirect + flash message)

Pattern D: HTTP 401/403 response
  - Page content replaced with "Unauthorized" or "Forbidden" text
  - Detection: read_page returns auth error content instead of expected page content
  - Less common on modern sites (most redirect to login instead)
  - Fallback detection: check if page content contains "401", "403", "Unauthorized", "Forbidden"

RE-AUTH AND RESUME STRATEGY:
  Phase 1 -- DETECT: Identify which session expiry pattern is present (A/B/C/D)
  Phase 2 -- RE-AUTH: Enter credentials and submit login form
  Phase 3 -- RESUME: Navigate back to the saved task URL and continue the original task

CONTEXT BLOAT MITIGATION FOR SESSION RE-AUTH (CONTEXT-10):
  The session re-auth interruption is a context bloat risk: the full DOM snapshot from
  the interrupted task is no longer relevant (the page has changed to a login form).
  MITIGATION: Before re-authenticating, capture ONLY a compact task state snapshot:
    { taskGoal: "...", lastUrl: "...", lastAction: "...", lastResult: "..." }
  Total snapshot must be UNDER 500 CHARACTERS. Discard all DOM snapshots, page content,
  and element lists from before the session expiry. After re-auth, rebuild context by
  navigating to lastUrl and reading fresh page content.

TASK STATE PRESERVATION:
  Before re-authenticating, capture minimal state:
    - taskGoal: what the user asked to accomplish (e.g., "read secure page content")
    - lastUrl: the URL where the task was being performed (e.g., "/secure")
    - lastAction: the last successful action before session expiry (e.g., "read_page on .example")
    - lastResult: truncated result of the last action (first 100 characters)
  This is all that is needed to resume after re-auth. No DOM snapshots, no element lists,
  no full page content -- just the 4 fields above.

SKIP-AUTH EXPECTATION:
  If no demo site with session behavior is available, document as skip-auth. The
  the-internet.herokuapp.com primary target should always be available for the
  simulated session expiry workflow.`,

  selectors: {
    herokuapp: {
      loginForm: '#login',
      usernameField: '#username',
      passwordField: '#password',
      loginButton: 'button[type="submit"], .radius',
      flashMessage: '#flash',
      secureHeading: '.example h2',
      secureParagraph: '.example p',
      logoutButton: '.button.secondary, a[href="/logout"]'
    },
    sessionExpiryIndicators: {
      modal: '[aria-modal="true"], [role="dialog"], .modal, .modal-dialog',
      overlay: '.overlay, .modal-overlay, .modal-backdrop',
      loginRedirect: 'input[name="username"], input[type="email"][name*="user"], #username, #email',
      flashBanner: '.flash, .alert, .notification, .toast, [role="alert"]',
      expiredText: 'Session expired, session has expired, please log in, please sign in, login required, authentication required'
    },
    uitestingplayground: {
      loginForm: '#login',
      userField: 'input[name="UserName"]',
      passField: 'input[name="Password"]',
      loginBtn: '#login',
      statusText: '#loginstatus'
    },
    demoqa: {
      loginForm: '#login',
      usernameField: '#userName',
      passwordField: '#password',
      loginButton: '#login',
      logoutButton: '#submit'
    }
  },

  workflows: {
    handleSessionExpiry: [
      // Step 1: INITIAL LOGIN
      'Navigate to the-internet.herokuapp.com/login. Enter test credentials: type_text on #username with "tomsmith", type_text on #password with "SuperSecretPassword!". Click login button (button[type="submit"] or .radius). Verify successful login: read_page checks #flash for "You logged into a secure area!" OR URL contains /secure.',

      // Step 2: CAPTURE TASK STATE
      'Record pre-task state as compact snapshot: { taskGoal: "read secure page content", currentUrl: "/secure", loginCredentials: "tomsmith", loggedIn: true }. This snapshot is under 200 characters. This is the baseline state before any task work begins.',

      // Step 3: PERFORM ORIGINAL TASK
      'Use read_page on .example to extract the secure page heading and paragraph text. Record the content as lastResult. This is the "task in progress" before session expiry. Save the extracted text for later comparison after re-auth.',

      // Step 4: SIMULATE SESSION EXPIRY
      'Navigate to the-internet.herokuapp.com/logout to force session end. This simulates what happens when a session cookie expires mid-task. The page redirects to /login with a flash message "You logged out of the secure area!". Do NOT dismiss or interact with the flash -- it confirms the session was invalidated.',

      // Step 5: DETECT SESSION EXPIRY
      'After simulated expiry, attempt to navigate back to the-internet.herokuapp.com/secure. The site redirects to /login (Pattern B: login page redirect). Detection criteria: (a) URL does NOT contain /secure, (b) URL contains /login, (c) get_dom_snapshot finds #login form, (d) flash message may contain expiry text.',

      // Step 6: CONFIRM EXPIRY TYPE
      'Use get_dom_snapshot to identify which session expiry pattern is present. Check for: aria-modal="true" or role="dialog" elements (Pattern A -- modal/dialog), URL containing /login (Pattern B -- login redirect), .flash or .alert elements with expiry text (Pattern C -- inline banner), page content containing "Unauthorized" or "Forbidden" (Pattern D -- HTTP error). Record the detected pattern type.',

      // Step 7: PRESERVE PRE-REAUTH STATE
      'Before re-authenticating, update task state to compact snapshot: { taskGoal: "read secure page content", lastUrl: "/secure", lastAction: "read_page on .example", lastResult: "(first 100 chars of previously read content)", sessionExpired: true, expiryPattern: "login-redirect" }. Total under 500 characters. DISCARD all DOM snapshots from before session expiry.',

      // Step 8: RE-AUTHENTICATE
      'Enter credentials again: type_text on #username with "tomsmith", type_text on #password with "SuperSecretPassword!", click login button (button[type="submit"] or .radius). Verify re-auth success: read_page checks #flash for "You logged into a secure area!" OR URL contains /secure.',

      // Step 9: VERIFY RE-AUTH SUCCESS
      'Confirm the session is restored: URL should contain /secure, read_page should show the secure page content (not a login form). If re-auth fails (flash contains "Your username is invalid!" or "Your password is invalid!"), retry once with the same credentials. If retry also fails, report re-auth failure.',

      // Step 10: RESUME ORIGINAL TASK
      'Navigate back to the URL from saved task state (the-internet.herokuapp.com/secure). Use read_page on .example to re-extract the secure page content. Compare with lastResult from Step 3 to verify the same content is accessible after re-authentication.',

      // Step 11: VERIFY TASK CONTINUITY
      'Confirm the resumed task produces the same result as before session expiry. The secure page content after re-auth should match the content captured before logout (Step 3). This proves task resumption works -- the session expiry was transparent to the overall task outcome.',

      // Step 12: CONTEXT TRACKING
      'Throughout the workflow, maintain only: { phase: "login|task|expired|reauth|resumed", taskGoal: "...", url: "...", step: N }. Total tracking under 150 characters at any point. Do NOT accumulate DOM snapshots or full page content across steps -- each step reads fresh and discards.',

      // Step 13: EDGE CASES
      'Handle edge cases: (a) Re-auth fails (credentials rejected after expiry) -- retry once, then escalate as blocked. (b) Session expires during re-auth attempt (double expiry) -- start from Step 1 with fresh login. (c) Original page changed after re-auth (stale content) -- re-read and proceed with new content, note the difference. (d) Modal blocks page interaction -- dismiss modal first (click X or close button) before re-entering credentials.',

      // Step 14: REPORT
      'State final outcome: session expiry detected (pattern type: modal/redirect/banner/HTTP-error), re-auth completed (success/fail), original task resumed (content matched/differed). Include compact state snapshot sizes at each phase to confirm context bloat was mitigated (all under 500 chars).'
    ]
  },

  warnings: [
    'CONTEXT-10: Before re-authenticating, capture ONLY minimal task state: {taskGoal, lastUrl, lastAction, lastResult (truncated to 100 chars)}. Total under 500 characters. Do NOT retain DOM snapshots from before the session expiry.',
    'Session expiry detection priority: check URL first (fastest -- login redirect pattern), then check DOM for modal/dialog elements, then check flash/alert messages, then check page content for auth error text.',
    'The-Internet herokuapp uses flash messages for login status -- #flash element with class "success" or "error". Check this element after every login attempt.',
    'After re-authentication, always verify the session is truly restored by navigating to the protected page and reading content -- do NOT assume re-auth succeeded just because no error appeared.',
    'If the target site requires real session timeout (15+ minutes), use the simulate approach: login, logout, re-login. This demonstrates the same re-auth pattern without waiting for a real timeout.'
  ],

  toolPreferences: ['navigate', 'click', 'type_text', 'read_page', 'get_dom_snapshot', 'wait_for_element']
});
