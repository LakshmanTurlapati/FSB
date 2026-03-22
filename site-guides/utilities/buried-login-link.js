/**
 * Site Guide: Buried Login Link
 * Per-site guide for finding and clicking the actual login link on homepages
 * that visually prioritize Sign Up CTAs over returning-user login access,
 * using DOM text analysis and href classification.
 *
 * Key challenge: SaaS, freemium, and subscription sites deliberately make their
 * Sign Up / Get Started / Create Account buttons visually dominant (large, colorful,
 * above-fold, centered) while burying the Login / Sign In link in small text, muted
 * color, footer, hamburger menu, or behind "Already have an account?" phrasing.
 * The AI has no vision and cannot detect visual weight differences -- it must scan
 * ALL clickable elements (links and buttons) on the page, classify each by text
 * content and href attribute as login-intent vs signup-intent, and click the
 * login-intent element regardless of its visual prominence or position.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-08) -- the login
 * link and signup button both exist in the DOM, but the site's design makes signup
 * visually dominant while login is intentionally de-emphasized. Semantic text
 * classification of all clickable elements is the only reliable identification method.
 *
 * Created for Phase 94, DARK-08 edge case validation.
 * Target: find and click the login link on a homepage dominated by Sign Up CTAs.
 */

registerSiteGuide({
  site: 'Buried Login Link',
  category: 'Utilities',
  patterns: [
    /buried.*login/i,
    /login.*link/i,
    /find.*login/i,
    /sign.*in/i,
    /log.*in/i,
    /already.*account/i,
    /existing.*user/i,
    /returning.*user/i,
    /member.*login/i,
    /login.*hidden/i,
    /login.*buried/i,
    /signup.*dominant/i,
    /dropbox\.com/i,
    /slack\.com/i,
    /notion\.so/i,
    /canva\.com/i,
    /figma\.com/i,
    /hubspot\.com/i,
    /mailchimp\.com/i,
    /trello\.com/i,
    /asana\.com/i,
    /zoom\.us/i,
    /atlassian\.com/i
  ],

  guidance: `BURIED LOGIN LINK INTELLIGENCE (DARK-08):

DARK PATTERN CONTEXT (DARK-08):
SaaS, freemium, and subscription sites deliberately manipulate visual hierarchy
to funnel visitors toward new signups. The Sign Up / Get Started / Create Account
CTA is made visually dominant -- large button, primary color, centered, above the
fold, repeated multiple times on the page. The Login / Sign In link for existing
users is intentionally de-emphasized: placed in small text, muted color, footer,
hamburger menu, or behind "Already have an account?" phrasing. The AI has no
vision and cannot see visual weight differences -- it must SCAN ALL CLICKABLE
ELEMENTS (links and buttons) on the page, CLASSIFY each by text content as
login-intent or signup-intent, and CLICK the login-intent element regardless of
its visual prominence or position.

DISTINCTION FROM OTHER DARK PATTERNS:
DARK-08 is NOT about hidden buttons (DARK-04) or fake buttons (DARK-01) or
shuffled buttons (DARK-03). It is about visual hierarchy manipulation: both Login
and Sign Up links exist in the DOM and are technically accessible, but the site's
design makes Sign Up visually dominant while Login is de-emphasized. The counter-
strategy is semantic text classification of all clickable elements to find
login-intent text regardless of visual prominence.

LOGIN LINK HIDING TECHNIQUES:

(1) SMALL FONT / MUTED COLOR: Login link rendered in 12-13px font with gray or
    light color while Sign Up button uses 16-18px bold with high-contrast primary
    color. The login link is technically visible but easily overlooked by humans.
    DOM counter: The text content ("Log in", "Sign in") is identical regardless
    of font size or color. Text analysis finds it instantly.

(2) FOOTER BURIAL: Login link placed in the page footer among other utility links
    (privacy policy, terms, about), far below the dominant hero section with Sign
    Up CTA. Users who focus on the main content area never scroll down to find it.
    DOM counter: Scan footer elements specifically -- footer a[href*="/login"] or
    footer a with login-intent text.

(3) HAMBURGER MENU HIDING: On both mobile and some desktop layouts, the Login link
    is placed inside a hamburger menu or dropdown navigation while the Sign Up
    button remains as a persistent, always-visible CTA in the header.
    DOM counter: Click hamburger trigger to expand hidden navigation, then rescan
    for login links inside the revealed menu.

(4) "ALREADY HAVE AN ACCOUNT?" DE-EMPHASIS: Login access provided as a small text
    link below or beside the Sign Up form with phrasing like "Already have an
    account? Log in" in small, muted text. The visual weight is entirely on the
    Sign Up form above.
    DOM counter: Search for "already have an account" text pattern, then find the
    associated login link (usually an <a> within the same container).

(5) CTA BUTTON VS TEXT LINK ASYMMETRY: Sign Up is a styled button (background
    color, padding, border-radius, shadow) while Login is a plain text link with
    no button styling. The visual affordance strongly suggests Sign Up is the
    primary action.
    DOM counter: The tag type (button vs a) and styling are irrelevant. Both have
    text content that classifies them as login-intent or signup-intent.

(6) CONDITIONAL RENDERING / SCROLL-GATED: Login link only appears after scrolling
    past the hero section, or is hidden until the user interacts with a "More
    options" link. Above-fold content shows only Sign Up.
    DOM counter: Scroll to bottom of page and rescan, or click "More options"
    triggers before classifying elements.

(7) TAB OR TOGGLE HIDING: Login and Sign Up are on separate tabs within the same
    form area, with the Sign Up tab selected by default. Login requires clicking
    a tab label that may be styled to look inactive.
    DOM counter: Find tab/toggle elements with login-intent text, click the tab
    to reveal the login form.

(8) REDIRECT-FIRST PATTERN: Clicking any CTA (including ambiguous ones like "Get
    Started") redirects to the signup flow, with a small "Already have an account?
    Log in here" link on the signup page itself, not on the original homepage.
    DOM counter: If no login link on homepage, navigate to signup page and scan
    for "already have an account" fallback text.

LOGIN vs SIGNUP CLASSIFICATION STRATEGY:

The core identification approach is text content and href attribute analysis of
every clickable element on the page.

Step A: SCAN ALL CLICKABLE ELEMENTS
  Use get_dom_snapshot to find every a[href], button, and [role="button"] element
  on the page. Include elements inside nav, header, footer, and any hamburger or
  dropdown menus. Do NOT limit to above-fold or visible-only elements.

Step B: EXTRACT TEXT AND HREF
  For each clickable element, extract:
  (1) text content (innerText)
  (2) href attribute
  (3) aria-label
  (4) title attribute
  (5) class name (may contain "login" or "signin" keywords)

Step C: CLASSIFY EACH ELEMENT
  Based on text and href, classify into:

  LOGIN-INTENT indicators (target for clicking):
    Text: "log in", "login", "sign in", "signin", "already have an account",
          "existing user", "returning user", "member login", "my account",
          "account login"
    Href: /login, /signin, /auth/login, /accounts/login, /session/new

  SIGNUP-INTENT indicators (skip these):
    Text: "sign up", "signup", "create account", "get started", "register",
          "join", "try free", "start free trial", "start now", "join free"
    Href: /signup, /register, /create-account, /trial, /pricing

  AMBIGUOUS indicators (examine href for confirmation):
    Text: "get started" (could be login if href points to /login), "continue"
          (check href), icon-only buttons (check aria-label)

Step D: CHECK HEADER AND FOOTER
  Login links are commonly placed in the top-right of the header (nav > a) or
  in the footer. Scan both areas specifically. If the header has only a Sign Up
  button, check the footer and hamburger menu.

Step E: EXPAND MENUS
  If the page has a hamburger menu (common on mobile-responsive layouts), click
  it to reveal hidden navigation items including the login link. Look for:
  button[aria-label*="menu"], .hamburger, .nav-toggle, [data-toggle="collapse"].

Step F: CHECK SIGNUP PAGE FALLBACK
  If no login link is found on the homepage, the login link may be on the signup
  page itself (redirect-first pattern). Navigate to the signup page and look for
  "Already have an account? Log in" text.

TARGET SITES:

Dropbox (dropbox.com):
  Sign Up button dominant, "Sign in" link in small text in header.
  Login URL: dropbox.com/login

Slack (slack.com):
  "Try for Free" and "Get Started" CTAs dominant, "Sign in" in top-right corner
  small text.
  Login URL: slack.com/signin

Notion (notion.so):
  "Get Notion Free" primary CTA, "Log in" link in header navigation.
  Login URL: notion.so/login

Canva (canva.com):
  "Sign up" prominent, "Log in" as secondary text link.
  Login URL: canva.com/login

Figma (figma.com):
  "Get started for free" dominant CTA, "Log in" as small header link.
  Login URL: figma.com/login

HubSpot (hubspot.com):
  Multiple "Get started free" CTAs, "Log in" in header top-right small text.
  Login URL: app.hubspot.com/login

Mailchimp (mailchimp.com):
  "Sign Up Free" dominant, "Log In" in header.
  Login URL: login.mailchimp.com

Generic SaaS pattern:
  Primary CTA is always signup-oriented, login is always secondary text.
  Look for login links in header nav, footer, or "Already have an account?" text.

VERIFICATION:
After clicking the login link, verify the login page loaded:
  - Look for email/username input field (input[type="email"], input[name="username"])
  - Look for password input field (input[type="password"])
  - Look for "Forgot password?" link (a[href*="forgot"], a[href*="reset"])
  - Look for "Sign in" or "Log in" form heading
If the page still shows the signup form, the wrong link was clicked. Go back and
try the next login-intent element.`,

  selectors: {
    loginLink: {
      byText: 'a:has-text("Log in"), a:has-text("Sign in"), a:has-text("Login"), a:has-text("Signin"), a:has-text("Already have an account")',
      byHref: 'a[href*="/login"], a[href*="/signin"], a[href*="/auth"], a[href*="/session"], a[href*="/accounts/login"]',
      byAria: '[aria-label*="log in" i], [aria-label*="sign in" i], [aria-label*="login" i]',
      byClass: '[class*="login"], [class*="signin"], [class*="sign-in"], [class*="log-in"]',
      inHeader: 'header a[href*="/login"], nav a[href*="/login"], header a[href*="/signin"], nav a[href*="/signin"]',
      inFooter: 'footer a[href*="/login"], footer a[href*="/signin"]'
    },
    signupButton: {
      byText: 'a:has-text("Sign up"), a:has-text("Get started"), a:has-text("Create account"), button:has-text("Sign up"), button:has-text("Get started")',
      byHref: 'a[href*="/signup"], a[href*="/register"], a[href*="/create-account"], a[href*="/trial"]'
    },
    hamburgerMenu: {
      trigger: 'button[aria-label*="menu" i], .hamburger, .nav-toggle, [data-toggle="collapse"], button[aria-expanded]',
      content: '.nav-menu, .dropdown-menu, [aria-expanded="true"] + *, nav[class*="mobile"]'
    },
    loginForm: {
      emailInput: 'input[type="email"], input[name="email"], input[name="username"], input[id*="email"], input[id*="username"]',
      passwordInput: 'input[type="password"]',
      forgotPassword: 'a[href*="forgot"], a[href*="reset"], a:has-text("Forgot")'
    }
  },

  workflows: {
    findBuriedLoginLink: [
      {
        step: 1,
        name: 'Navigate to homepage',
        description: 'Use navigate to load the site homepage or landing page. Wait for the page to fully render (use get_dom_snapshot to confirm navigation elements are present).',
        tools: ['navigate', 'get_dom_snapshot'],
        expected: 'Page loaded with navigation elements, header, and content visible in DOM'
      },
      {
        step: 2,
        name: 'Scan all clickable elements',
        description: 'Use get_dom_snapshot to find every a[href], button, and [role="button"] on the page. Record each element\'s text content, href, class, id, and aria-label. Include elements in nav, header, footer, and menus.',
        tools: ['get_dom_snapshot'],
        expected: 'Complete list of all clickable elements with text, href, and attributes extracted'
      },
      {
        step: 3,
        name: 'Classify elements as login-intent or signup-intent',
        description: 'For each clickable element, classify as LOGIN-INTENT, SIGNUP-INTENT, or OTHER using text keyword lists and href patterns. Login-intent: "log in", "sign in", "login", "signin", "already have an account", "existing user", "returning user", "member login", or href containing /login, /signin, /auth. Signup-intent: "sign up", "signup", "create account", "get started", "register", "join", "try free", or href containing /signup, /register, /create-account, /trial.',
        tools: ['get_text', 'get_attribute'],
        expected: 'Each element classified with login-intent elements identified for clicking'
      },
      {
        step: 4,
        name: 'Check header and footer specifically',
        description: 'Scan the header (nav, top bar) and footer areas for login links that may be visually de-emphasized but present in the DOM. Many sites place "Sign in" in the top-right nav with no button styling.',
        tools: ['get_dom_snapshot', 'get_text'],
        expected: 'Login link found in header, nav, or footer if not in main content area'
      },
      {
        step: 5,
        name: 'Expand hamburger menu if needed',
        description: 'If no login link found in visible navigation, check for hamburger/mobile menu triggers. Click to expand and rescan for login links inside the revealed menu. Look for: button[aria-label*="menu"], .hamburger, .nav-toggle, [data-toggle="collapse"].',
        tools: ['click', 'get_dom_snapshot'],
        expected: 'Hamburger menu expanded revealing hidden navigation items including login link'
      },
      {
        step: 6,
        name: 'Click login link',
        description: 'Click the login-intent element identified in Steps 2-5. Priority order: (a) links with explicit "Log in" or "Sign in" text, (b) links with /login or /signin in href, (c) header-positioned login links over footer ones.',
        tools: ['click'],
        expected: 'Login link clicked, page navigating to login form'
      },
      {
        step: 7,
        name: 'Verify login page loaded',
        description: 'After clicking, verify the login page loaded: use get_dom_snapshot to confirm presence of email/username input, password input, and/or "Forgot password" link. If the signup page loaded instead, go back and try the next login-intent element.',
        tools: ['get_dom_snapshot', 'navigate'],
        expected: 'Login page confirmed with email input, password input, and forgot password link present'
      },
      {
        step: 8,
        name: 'Fallback to signup page',
        description: 'If no login link found on homepage, navigate to the signup page and look for "Already have an account? Log in" text link. This covers the redirect-first dark pattern where login access is only available from the signup page.',
        tools: ['navigate', 'get_dom_snapshot', 'scroll', 'click'],
        expected: 'Login link found on signup page via "Already have an account?" text and clicked'
      }
    ]
  },

  warnings: [
    'DARK-08: Sites bury the Login link among dominant Sign Up CTAs to maximize new signups. SCAN ALL clickable elements by text content, CLASSIFY as login-intent vs signup-intent, and CLICK the login link regardless of its visual prominence or position.',
    'NEVER click the first prominent CTA button -- it is almost always Sign Up or Get Started, not Login. Always classify ALL clickable elements before choosing which to click.',
    'Login links are commonly found as: small text in the header top-right, plain text link (not button) near the Sign Up button, "Already have an account?" text below signup forms, or inside hamburger menus.',
    'If the page has multiple Sign Up buttons and no visible Login link, check the footer, hamburger menu, and any expandable navigation sections. The login link is almost always present somewhere in the DOM.',
    'After clicking what you believe is the login link, VERIFY the destination has a password input field. If you landed on a signup form, you clicked the wrong link -- go back and find the actual login link.'
  ],

  toolPreferences: ['get_dom_snapshot', 'get_text', 'get_attribute', 'click', 'scroll', 'navigate']
});
