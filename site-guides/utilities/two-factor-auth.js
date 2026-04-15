/**
 * Site Guide: Two-Factor Authentication
 * Per-site guide for 2FA login flows that require fetching a verification code
 * from email in a separate tab and returning to complete authentication.
 *
 * Key challenge: maintaining tab state (auth tab vs email tab) while extracting
 * only the verification code from the email provider, not the full inbox DOM.
 * Uses open_tab, switch_tab, list_tabs for multi-tab orchestration.
 *
 * Created for Phase 83, CONTEXT-07 edge case validation.
 * Target: handle 2FA flow -- trigger email code, open new tab to fetch, return to complete login.
 */

registerSiteGuide({
  site: 'Two-Factor Authentication',
  category: 'Utilities',
  patterns: [
    /2fa/i,
    /two.factor/i,
    /verify.*code/i,
    /login.*verification/i,
    /otp/i,
    /one.time.password/i,
    /practiceautomation\.com/i,
    /the-internet\.herokuapp\.com/i,
    /conduit\.realworld\.how/i,
    /demoqa\.com/i,
    /uitestingplayground\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CONTEXT-07):
- [context] Capture auth tab ID (list_tabs) BEFORE opening the email tab
- [context] Use open_tab (not navigate) for email -- preserves auth tab session
- [context] Extract ONLY the verification code (4-8 digits), not full email body
- [context] switch_tab back by stored authTabId, not by URL search
- [context] Verify login success via dashboard/profile selectors, not URL alone

TWO-FACTOR AUTHENTICATION INTELLIGENCE:

TARGET SELECTION (CONTEXT-07):
- This edge case tests MULTI-TAB 2FA: trigger email code delivery on auth site, open new tab to email provider, extract code, switch back, enter code, complete login
- The challenge is finding a demo 2FA site that: (a) has a working 2FA login, (b) sends a code to an accessible email, (c) does not require a real paid account
- Primary target: practiceautomation.com/2fa or similar 2FA practice site
  -- Look for sites that simulate 2FA by displaying the code on a separate page or sending to a test email inbox
- Fallback 1: the-internet.herokuapp.com/login (Heroku test app -- basic auth, may not have 2FA but demonstrates multi-step login)
- Fallback 2: conduit.realworld.how (RealWorld demo app -- registration + login, may have 2FA toggle)
- Fallback 3: demoqa.com (has login form but likely no 2FA)
- Fallback 4: Any site with a demo/sandbox 2FA that does not require real email delivery
- ALTERNATIVE APPROACH: If no demo 2FA site is available, simulate the multi-tab pattern:
  (a) Navigate to a login page, (b) Open a new tab to a test email service (e.g., guerrillamail.com, mailinator.com, tempail.com for disposable email), (c) Check for any email, (d) Switch back to original tab
  This demonstrates the multi-tab orchestration pattern even without real 2FA
- SKIP-AUTH: if no demo 2FA site exists and the multi-tab simulation cannot demonstrate the pattern, document as skip-auth

MULTI-TAB 2FA WORKFLOW STRATEGY (CONTEXT-07):
- This workflow tests MULTI-TAB STATE MANAGEMENT: remember the auth tab ID, open email tab, extract code, return to auth tab by ID
- The challenge is maintaining tab identity across switches without losing track of which tab is which

Step-by-step pattern:
  Phase A -- Login and trigger 2FA:
    1. Navigate to target site login page
    2. list_tabs to capture current tab ID -- this is the AUTH TAB (store as authTabId)
    3. Enter username/email credentials
    4. Enter password
    5. Click login/submit button
    6. Wait for 2FA prompt to appear (the site asks for a verification code)
    7. If no 2FA prompt appears: site does not have 2FA, try next target

  Phase B -- Fetch code from email:
    8. open_tab to email provider (Gmail: mail.google.com, Outlook: outlook.live.com, or disposable: guerrillamail.com)
    9. list_tabs to capture email tab ID -- this is the EMAIL TAB (store as emailTabId)
    10. Search for the 2FA email (search for "verification code" or "login code" or sender domain)
    11. Open the most recent matching email
    12. Extract the verification code (typically 4-8 digit number) using read_page
    13. Store the code as a simple string (e.g., "482916") -- do NOT store full email content

  Phase C -- Return and complete login:
    14. switch_tab to authTabId (the original auth tab)
    15. Verify the 2FA input field is still visible
    16. type_text the extracted code into the 2FA input field
    17. Click verify/submit button
    18. Wait for login to complete (redirect to dashboard/homepage)
    19. Verify login succeeded (check for user profile element, logout button, or dashboard content)

CONTEXT RETENTION -- TAB ID MANAGEMENT:
- CRITICAL: Store authTabId BEFORE opening the email tab. This is the key state to retain.
- After open_tab returns the new tab: you are automatically in the new tab (email tab)
- After extracting the code: switch_tab(authTabId) to return to the exact auth tab
- Do NOT use list_tabs to find the auth tab after switching -- rely on the stored authTabId
- Compact state record: {authTabId: N, emailTabId: M, code: "XXXXXX", codeFetched: true}

EMAIL CODE EXTRACTION PATTERNS:
- Gmail: search "is:unread verification code" or "is:unread login code", open first result, read body
- Outlook: search "verification code" in inbox, open first unread, read body
- Disposable email (guerrillamail.com): check inbox for latest email, read body
- Code format: typically 4-8 digits, sometimes with hyphens (e.g., "482916", "48-29-16", "4829-16")
- Extraction: use read_page on the email body, look for a standalone number pattern (\\d{4,8})
- IMPORTANT: extract ONLY the code string, not the full email body -- context bloat mitigation

2FA INPUT FIELD PATTERNS:
- Common selectors: input[type="text"][maxlength="6"], input[name*="code"], input[name*="otp"], input[name*="token"], input[autocomplete="one-time-code"]
- Some sites split 2FA into individual digit inputs (6 separate single-digit fields)
  - For split inputs: type one digit per field, or try typing the full code in the first field (some sites auto-advance)
- Label text: "Verification code", "Enter code", "Two-factor code", "OTP", "Authentication code"

VERIFICATION CRITERIA:
- PASS = 2FA code triggered, fetched from email tab, entered on auth tab, login completed
- PARTIAL = multi-tab pattern demonstrated (open_tab, switch_tab, read_page across tabs) but 2FA not fully completed (no demo site has real 2FA, or email delivery not accessible)
- FAIL = could not demonstrate multi-tab orchestration pattern
- SKIP-AUTH = no demo 2FA site available and multi-tab pattern simulation could not run

CONTEXT BLOAT MITIGATION FOR MULTI-TAB 2FA:
- On the auth tab: extract only the 2FA prompt presence (is there a code input field?) -- not the full login page DOM
- On the email tab: extract ONLY the verification code (4-8 digits) -- not the full email body, inbox list, or email headers
- Total context for 2FA flow: under 500 characters (authTabId, emailTabId, code, login status)
- Compare to Phase 80 (multi-tab flights): same open_tab/switch_tab pattern but with code extraction instead of price extraction
- After code entry: do NOT re-read the email tab -- it served its purpose`,
  selectors: {
    // Login form fields
    usernameInput: 'input[name="username"], input[name="email"], input[type="email"], input[id*="email"], input[id*="username"], input[autocomplete="username"], input[autocomplete="email"]',
    passwordInput: 'input[name="password"], input[type="password"], input[autocomplete="current-password"]',
    loginButton: 'button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login"), [data-testid*="login"], [data-testid*="submit"]',
    // 2FA code input (single field)
    codeInput: 'input[name*="code"], input[name*="otp"], input[name*="token"], input[name*="totp"], input[autocomplete="one-time-code"], input[maxlength="6"], input[maxlength="8"], input[placeholder*="code" i], input[placeholder*="digit" i], input[aria-label*="code" i], input[aria-label*="verification" i]',
    // 2FA code input (split digit fields)
    splitDigitInput: 'input[maxlength="1"][type="text"], input[maxlength="1"][type="tel"], input[maxlength="1"][inputmode="numeric"]',
    // 2FA verify/submit button
    verifyButton: 'button[type="submit"], button:has-text("Verify"), button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Continue"), [data-testid*="verify"], [data-testid*="confirm"]',
    // 2FA prompt container (indicates 2FA step is active)
    twoFactorPrompt: '[class*="two-factor"], [class*="2fa"], [class*="otp"], [class*="verification"], [class*="mfa"], [data-testid*="2fa"], [data-testid*="otp"], form[action*="verify"], form[action*="2fa"]',
    // Success indicators (login completed)
    loginSuccess: '[class*="dashboard"], [class*="profile"], [class*="account"], button[aria-label*="logout" i], a[href*="logout"], [data-testid*="avatar"], [data-testid*="user-menu"]',
    // Email code in email body (for read_page extraction)
    emailCodePattern: '[class*="code"], [class*="otp"], [class*="verification"], strong, b, .code, #code',
    // Disposable email inbox
    disposableInbox: '[class*="inbox"], [id*="inbox"], table.email-list, [class*="mail-list"], [data-testid*="inbox"]'
  },
  workflows: {
    twoFactorMultiTab: [
      'SETUP: Navigate to target site with 2FA login. Primary: practiceautomation.com/2fa or similar 2FA demo site. If no dedicated 2FA demo available, try simulating multi-tab pattern with disposable email service.',
      'CAPTURE AUTH TAB: Use list_tabs to get the current tab ID. Store as authTabId. This is CRITICAL -- you must remember this ID to return after fetching the code.',
      'ENTER CREDENTIALS: Type username/email into usernameInput field. Type password into passwordInput field.',
      'SUBMIT LOGIN: Click loginButton to submit credentials. Wait for page to respond.',
      'DETECT 2FA PROMPT: Check if a 2FA code input appeared (codeInput or splitDigitInput selector). If yes, 2FA is active. If the site logged in directly (no 2FA), note as "no 2FA on this target" and try next target.',
      'OPEN EMAIL TAB: Use open_tab to open the email provider where the 2FA code was sent. Gmail: https://mail.google.com, Outlook: https://outlook.live.com, Disposable: https://www.guerrillamail.com. Store the new tab ID as emailTabId.',
      'SEARCH FOR CODE EMAIL: On the email tab, search for "verification code" or "login code" or the sender domain. Look for the most recent unread email matching the 2FA pattern.',
      'EXTRACT CODE: Open the 2FA email and use read_page to extract the verification code. Look for a 4-8 digit number in the email body. Store ONLY the code string (e.g., "482916"), not the full email content.',
      'SWITCH BACK TO AUTH TAB: Use switch_tab(authTabId) to return to the original authentication tab. Verify the 2FA input field is still visible.',
      'ENTER CODE: Type the extracted code into the codeInput field. If the site uses split digit inputs (splitDigitInput), type each digit into the corresponding field.',
      'SUBMIT 2FA: Click verifyButton to submit the code. Wait for login to complete.',
      'VERIFY LOGIN: Check for login success indicators (loginSuccess selector): dashboard page, profile menu, logout button, or user avatar. Confirm the user is now authenticated.',
      'REPORT: State outcome (PASS/PARTIAL/FAIL/SKIP-AUTH) with: target site used, 2FA method encountered, code fetched (yes/no), tabs used (authTabId, emailTabId), login completed (yes/no).'
    ],
    simulateMultiTabCodeFetch: [
      'If no real 2FA site is available, demonstrate the multi-tab pattern with a simulated flow:',
      '1. Navigate to any login page (the "auth tab"). Store authTabId via list_tabs.',
      '2. Open a new tab to guerrillamail.com or mailinator.com (the "email tab"). Store emailTabId.',
      '3. Read the disposable email inbox using read_page.',
      '4. Switch back to authTabId using switch_tab.',
      '5. Confirm you are back on the original auth tab.',
      'This validates open_tab, list_tabs, switch_tab, read_page across tabs even without real 2FA.'
    ]
  },
  warnings: [
    'Most real 2FA flows require an authenticated account with email access -- demo/test sites may not have working 2FA.',
    'Disposable email services (guerrillamail, mailinator) are public -- anyone can read emails sent to them. Do NOT use for real credentials.',
    'Some 2FA codes expire quickly (60-120 seconds) -- minimize time spent on the email tab.',
    '2FA code input may be a single field (type full code) or split into individual digit inputs (type one digit per field).',
    'After switching tabs with switch_tab, verify the expected page is still loaded -- tabs can refresh or expire.',
    'Email provider may require its own authentication -- if Gmail/Outlook requires login, the 2FA flow adds another auth step.',
    'Some sites use authenticator app TOTP instead of email codes -- this workflow only covers email-based 2FA.',
    'If the 2FA code email has not arrived, wait 10-15 seconds and refresh the inbox before concluding it failed.',
    'For CONTEXT-07: store ONLY authTabId, emailTabId, and the extracted code. Do NOT read full page DOM from either tab.'
  ],
  toolPreferences: ['navigate', 'open_tab', 'switch_tab', 'list_tabs', 'click', 'type_text', 'press_enter', 'read_page', 'wait_for_stable']
});
