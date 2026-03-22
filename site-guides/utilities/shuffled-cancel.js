/**
 * Site Guide: Shuffled Cancel Button
 * Per-site guide for navigating subscription cancellation pages that randomize
 * the position of Keep/Cancel buttons on each page load, using text-based
 * button identification instead of positional targeting.
 *
 * Key challenge: Subscription cancellation flows intentionally randomize the
 * position of "Keep subscription" and "Cancel subscription" buttons so users
 * cannot rely on muscle memory (e.g., "Cancel is always on the left"). The AI
 * must identify the correct Cancel button by reading text content (innerText,
 * aria-label, data-action), NEVER by position, DOM order, or visual styling.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-03) -- the
 * button positions are shuffled to exploit trained spatial expectations. DOM
 * text content analysis is the only reliable identification method.
 *
 * Created for Phase 89, DARK-03 edge case validation.
 * Target: cancel a subscription on a site that shuffles Keep/Cancel button
 * positions by identifying the correct button via text content, not position.
 */

registerSiteGuide({
  site: 'Shuffled Cancel Button',
  category: 'Utilities',
  patterns: [
    /shuffled.*cancel/i,
    /cancel.*subscription/i,
    /unsubscribe/i,
    /cancel.*button/i,
    /keep.*subscription/i,
    /cancel.*anyway/i,
    /end.*subscription/i,
    /confirm.*cancel/i,
    /randomized.*button/i,
    /button.*position/i
  ],

  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic DARK-03):
- [dark] NEVER use button position (left/right/first/second) -- positions are randomized each load
- [dark] Read ALL button text and classify by cancel-intent vs keep-intent keywords before clicking
- [dark] Handle confirmshaming: parse SEMANTIC ACTION (what happens on click), not emotional framing
- [dark] In "Are you sure?" dialogs, "Yes"=cancel-intent and "Cancel"=keep-intent (trick question)
- [dark] Navigate through ALL retention steps (offers, surveys) before final shuffled confirmation

SHUFFLED CANCEL BUTTON INTELLIGENCE (DARK-03):

DARK PATTERN CONTEXT (DARK-03):
Subscription cancellation flows intentionally randomize the position of "Keep
subscription" and "Cancel subscription" buttons on each page load. This dark
pattern exploits users' muscle memory -- after training users that the right
button or the colored button means "confirm," the site swaps button positions
on the cancellation page so the trained behavior leads to clicking "Keep"
instead of "Cancel."

How the dark pattern manifests:

(a) Button position randomization: The Keep and Cancel buttons swap left/right
    or top/bottom positions on each page load via JavaScript Math.random() or
    server-side randomization. The user who habitually clicks "the left button"
    or "the right button" will sometimes hit Keep when they meant Cancel.

(b) Visual prominence manipulation: The "Keep subscription" button is styled as
    the primary/prominent action -- larger, colored (green, blue), with hover
    effects -- while "Cancel" is styled as a plain text link, a secondary gray
    button, or an underlined text. Visual styling is part of the dark pattern.

(c) Confirmshaming language: Instead of neutral labels, some sites use emotional
    framing to discourage cancellation:
    - "Yes, I want to miss out on savings" (means: Cancel)
    - "No, keep my exclusive benefits" (means: Keep)
    - "I understand I will lose access" (means: Cancel)
    - "Take me back to my amazing plan" (means: Keep)
    The AI must parse the SEMANTIC MEANING (what action occurs when clicked),
    not the emotional framing.

(d) Double negatives: Some sites use confusing phrasing:
    - "Don't cancel my subscription" (means: Keep)
    - "Don't keep my subscription" (means: Cancel)
    The AI must determine what clicking the button DOES, not what it says to
    not do.

(e) Extra confirmation steps: Cancellation requires 3-5 extra steps (retention
    offer, reason survey, final confirmation), while keeping requires exactly
    one click. This asymmetric effort is the structural dark pattern.

(f) CSS flexbox order or grid placement: The DOM order of buttons may not match
    the visual order. CSS order property, flexbox row-reverse, or grid column
    assignment can reposition buttons visually without changing the DOM tree
    structure. Position-based selectors (nth-child, first-child) will target
    the wrong button when CSS reordering is applied.

The AI must use TEXT CONTENT analysis, never position or visual style, to
identify the correct button. Read every button's innerText or textContent
and match against known cancel-intent keywords.

TEXT-BASED BUTTON IDENTIFICATION STRATEGY:
The core approach is to read all button/link text in the cancellation dialog
and match against known cancel-intent and keep-intent keywords. The button
whose text matches cancel-intent keywords is the one to click, regardless of
its position, size, color, or DOM order.

Cancel-intent keywords (the button the AI SHOULD click):
  "Cancel", "Cancel subscription", "Cancel anyway", "Cancel my subscription",
  "End subscription", "Unsubscribe", "Yes, cancel", "Confirm cancellation",
  "I want to cancel", "Proceed with cancellation", "Cancel my account",
  "End my trial", "Stop subscription", "Yes, I'm sure", "Continue to cancel",
  "Finalize cancellation", "Complete cancellation"

Keep-intent keywords (the button the AI must NOT click):
  "Keep", "Keep subscription", "Keep my subscription", "Stay subscribed",
  "Don't cancel", "Go back", "Never mind", "I changed my mind",
  "Keep my benefits", "No, keep it", "Stay", "Continue subscription",
  "Keep my plan", "Reconsider", "Save my subscription", "Stay on plan",
  "Keep membership", "Return to account"

CONFIRMSHAMING DETECTION:
Some sites phrase the cancel button using negative emotional language to
discourage clicking it. The AI must parse the SEMANTIC ACTION (what will
happen if the button is clicked), not the emotional framing:

  Confirmshaming text                         | Actual action
  --------------------------------------------|-------------------
  "Yes, I want to miss out on savings"        | CANCEL (click this)
  "No, keep my exclusive benefits"            | KEEP (do NOT click)
  "I understand I will lose access"           | CANCEL (click this)
  "Take me back to my amazing plan"           | KEEP (do NOT click)
  "Yes, I don't want premium features"        | CANCEL (click this)
  "No, I want to keep my benefits"            | KEEP (do NOT click)
  "I'm sure, cancel my account"               | CANCEL (click this)
  "Wait, let me reconsider"                   | KEEP (do NOT click)

Detection strategy: If button text contains emotional language about "losing"
or "missing out" or "giving up," but the semantic action IS cancellation, then
that button should be clicked. If button text contains emotional language about
"keeping" or "saving" benefits, the semantic action is to KEEP the subscription.

Parse what happens, not what the text makes you feel.

MULTI-STEP CANCELLATION FLOW:
Many subscription sites have multiple retention steps before the final cancel
button appears. Expect and navigate through all of these:

  Step 1: ACCOUNT SETTINGS PAGE
    Navigate to the subscription management or cancellation page. This usually
    requires going through Account > Settings > Subscription > Cancel or a
    similar navigation path. Some sites have direct URLs like /cancel or
    /account/subscription.

  Step 2: INITIAL CANCEL LINK
    Find and click "Cancel subscription" or "Manage subscription" link/button
    on the account/subscription page. This is usually a text link or secondary
    button, not a prominent action button.

  Step 3: RETENTION OFFER PAGE
    "We'll give you 50% off if you stay!" with "Accept offer" / "No thanks,
    cancel" buttons. Identify the cancel/decline variant and click it. The
    offer button will be prominent (colored, larger); the cancel variant will
    be a text link or secondary button. Match by text content.

  Step 4: REASON SELECTION PAGE
    "Why are you leaving?" with a dropdown or radio buttons and a "Continue"
    or "Next" button. Select any reason from the dropdown/radio and click the
    continue/next button to proceed. This is a data collection step, not a
    blocking step.

  Step 5: FINAL CONFIRMATION -- THE SHUFFLED BUTTON PAGE
    "Are you sure you want to cancel?" with randomized Keep / Cancel button
    positions. This is the critical step where the dark pattern activates.
    Use get_dom_snapshot to read ALL button text content. Classify each button
    as cancel-intent or keep-intent by text. Click the cancel-intent button.
    Do NOT rely on button position (left/right), DOM order (first/second),
    or visual style (colored/plain).

  Step 6: CONFIRMATION PAGE
    "Your subscription has been cancelled" success message. Verify the
    cancellation was processed by checking for confirmation text.

BUTTON POSITION INDEPENDENCE:
Why position-based identification fails on shuffled cancellation pages:

(a) DOM order randomization: The button that is first in the DOM (first child
    of the container) may be "Cancel" on one page load and "Keep" on the next.
    Using element index selectors (nth-child(1), first-child) will target
    different buttons on different loads.

(b) CSS visual reordering: CSS flexbox order property or grid-column assignment
    can visually move buttons without changing the DOM. A button that appears
    on the left visually may be the second child in the DOM, or vice versa.
    Position (left/right, top/bottom) does not correlate with DOM order.

(c) Absolute positioning with random offsets: Some sites use JavaScript to set
    random left/right pixel values on button elements, physically randomizing
    their screen position on each load.

(d) Visual prominence is unreliable: The "Keep" button is intentionally styled
    as the primary/prominent button (larger, colored, with shadow) to attract
    clicks. The "Cancel" button is styled as secondary (smaller, gray, plain
    text link). The AI must IGNORE visual styling entirely.

The AI must NEVER use:
  - Element index (first button, second button, nth-child)
  - CSS position (left button, right button, top, bottom)
  - Visual prominence (the colored button, the larger button)
  - DOM order (first child, last child)

The AI must ALWAYS use:
  - Text content (innerText, textContent of the button)
  - aria-label attribute value
  - data-action or data-testid attribute value
  - href for link-based cancel buttons (e.g., href="/cancel/confirm")

DEMO AND REAL SUBSCRIPTION CANCELLATION TARGETS:

Demo target 1: deceptive.design (formerly darkpatterns.org)
  - Documents and showcases dark pattern examples including confirmshaming,
    trick questions, and misdirection in subscription flows
  - URL: deceptive.design/types/confirmshaming or similar showcase pages
  - Useful for understanding the pattern taxonomy, though may not have
    interactive demos with actual shuffled buttons

Demo target 2: Dark pattern testing/demo pages
  - Various dark pattern demonstration sites exist for educational purposes
  - Any page with two buttons where the positions are randomized via JavaScript
    can serve as a test target for the text-based identification strategy
  - Key: the detection strategy is generic and works on any shuffled layout

Real-world target 1: Gym membership cancellation flows
  - Planet Fitness, LA Fitness, and similar gym chains have online cancellation
    flows with retention pages and button-position manipulation
  - Typically require authentication to reach the cancellation page
  - Cancellation path: Account > Membership > Cancel > Retention offer >
    Reason selection > Final confirmation with shuffled buttons

Real-world target 2: SaaS trial cancellation dialogs
  - Many SaaS products (Adobe, Spotify, streaming services) randomize the
    "Keep trial" / "Cancel anyway" button positions on the final confirmation
  - Path: Account > Subscription > Cancel > "We'll miss you" > Shuffled buttons

Real-world target 3: Newsletter unsubscribe confirmation pages
  - Some newsletter/email marketing platforms shuffle "Stay subscribed" /
    "Unsubscribe" button positions on the confirmation page
  - Direct URL access via unsubscribe link in email footer
  - Simpler flow (usually single page) but same text-based identification need

VERIFICATION:
After clicking the cancel button:

(a) Success text detection: Look for confirmation text on the resulting page:
    "cancelled", "subscription ended", "successfully cancelled",
    "cancellation confirmed", "account closed", "unsubscribed",
    "your subscription has been cancelled", "cancellation complete",
    "you have been unsubscribed"

(b) Error/failure detection: Check that the page does NOT show:
    "Your subscription is still active", "cancellation failed",
    "error processing", "unable to cancel", "please try again"

(c) Re-check detection: If redirected back to the "Are you sure?" page (the
    shuffled button page again), the cancel click may not have registered.
    Re-read button text, re-identify the cancel button, and click again.

(d) Status verification: If possible, navigate to the account/subscription
    page and verify the subscription status shows "Cancelled", "Inactive",
    "Ended", or similar non-active state.`,

  selectors: {
    // Cancellation dialog detection
    cancelDialog: {
      container: 'div[class*="cancel"], div[class*="confirmation"], div[role="dialog"], div[class*="modal"], div[data-testid*="cancel"]',
      allButtons: 'button, a[role="button"], a[class*="btn"], input[type="submit"]'
    },
    // Cancel-intent text patterns (button text the AI SHOULD click)
    cancelIntentText: {
      primary: 'Cancel|Unsubscribe|End subscription|Cancel anyway|Cancel my subscription|Confirm cancellation|Proceed with cancellation',
      secondary: 'Yes, cancel|I want to cancel|Cancel my account|End my trial|Stop subscription|Yes, I\'m sure'
    },
    // Keep-intent text patterns (button text the AI must NOT click)
    keepIntentText: {
      primary: 'Keep|Stay|Don\'t cancel|Go back|Never mind|Continue subscription|Keep my plan',
      secondary: 'Keep subscription|Keep my benefits|I changed my mind|Stay subscribed|Reconsider|No, keep it'
    },
    // Confirmation success indicators
    confirmationSuccess: {
      text: 'cancelled|subscription ended|successfully cancelled|cancellation confirmed|account closed|unsubscribed',
      container: 'div[class*="success"], div[class*="confirmation"], div[class*="result"]'
    },
    // Retention offer detection
    retentionOffer: {
      container: 'div[class*="retention"], div[class*="offer"], div[class*="discount"]',
      declineText: 'No thanks|Cancel anyway|Decline offer|Skip offer|I still want to cancel'
    },
    // Reason selection page detection
    reasonSelection: {
      container: 'div[class*="reason"], div[class*="survey"], form[class*="cancel"]',
      continueButton: 'button[type="submit"], button[class*="continue"], button[class*="next"]'
    }
  },

  workflows: {
    cancelSubscription: [
      {
        step: 1,
        name: 'NAVIGATE TO CANCELLATION PAGE',
        description: 'Navigate to the subscription management or cancellation page. This may require navigating through account settings first: Account > Settings > Subscription > Cancel. Some sites have direct cancellation URLs (e.g., /cancel, /account/subscription/cancel). Use navigate tool to go to the target URL or follow links through the account navigation.',
        tools: ['navigate', 'click'],
        expected: 'Subscription cancellation page or account settings page loaded'
      },
      {
        step: 2,
        name: 'DETECT CANCELLATION DIALOG',
        description: 'Use get_dom_snapshot to identify the cancellation confirmation dialog or page. Look for containers with cancel/confirmation/modal classes (div[class*="cancel"], div[class*="confirmation"], div[role="dialog"], div[class*="modal"]) and buttons within them. Determine if this is a retention offer, reason selection, or final confirmation page.',
        tools: ['get_dom_snapshot', 'read_page'],
        expected: 'Cancellation dialog or page identified with buttons visible'
      },
      {
        step: 3,
        name: 'READ ALL BUTTON TEXT',
        description: 'Use get_dom_snapshot or get_text to extract the text content of EVERY button and clickable link in the cancellation area. For each button, record: (a) its text content (innerText/textContent), (b) its selector (id, class, data-testid), (c) any aria-label or data-action attributes. Do NOT decide which button to click based on position. Record ALL button texts for classification in the next step.',
        tools: ['get_dom_snapshot', 'get_text'],
        expected: 'Complete list of all button texts and their selectors in the cancellation area'
      },
      {
        step: 4,
        name: 'CLASSIFY BUTTONS BY TEXT INTENT',
        description: 'For each button found in Step 3, classify it as cancel-intent or keep-intent by matching its text against the keyword lists. Cancel-intent: Cancel, Unsubscribe, End subscription, Cancel anyway, Confirm cancellation, Yes cancel, Proceed with cancellation. Keep-intent: Keep, Stay, Don\'t cancel, Go back, Never mind, Continue subscription, Keep my plan. If confirmshaming is detected (emotional language about losing benefits or missing out), parse the SEMANTIC ACTION -- what will happen if the button is clicked -- not the emotional framing. A button that says "Yes, I want to lose my benefits" but whose action IS cancellation should be classified as cancel-intent.',
        tools: ['get_dom_snapshot', 'get_text'],
        expected: 'Each button classified as cancel-intent or keep-intent with reasoning'
      },
      {
        step: 5,
        name: 'HANDLE RETENTION STEPS',
        description: 'If the current page is a retention offer (discount, special deal, "50% off if you stay"), find and click the decline/cancel variant button. Match text: "No thanks", "Cancel anyway", "Decline offer", "I still want to cancel." If it is a reason selection page ("Why are you leaving?"), select any reason from the dropdown or radio buttons and click the continue/next button. Repeat this step until the final confirmation dialog with the Keep/Cancel buttons is reached.',
        tools: ['click', 'get_dom_snapshot', 'read_page'],
        expected: 'All retention steps navigated, final confirmation page reached'
      },
      {
        step: 6,
        name: 'CLICK THE CANCEL BUTTON',
        description: 'Click the button classified as cancel-intent in Step 4. Use a text-based selector (e.g., button containing "Cancel") rather than a positional selector (e.g., first button, left button). If multiple cancel-intent buttons exist, prefer the one with the most explicit cancel text (e.g., "Cancel subscription" over just "Cancel"). NEVER click based on: element index, CSS position (left/right), visual prominence (colored/larger), or DOM order (first/last child).',
        tools: ['click'],
        expected: 'Cancel-intent button clicked, waiting for confirmation page'
      },
      {
        step: 7,
        name: 'VERIFY CANCELLATION',
        description: 'After clicking the cancel button, use read_page to verify the cancellation was successful. Look for success confirmation text: "cancelled", "subscription ended", "successfully cancelled", "cancellation confirmed", "account closed", "unsubscribed." Check that the page does NOT show an error message ("cancellation failed", "unable to cancel") or redirect back to the "Are you sure?" page. If redirected back, the cancel click did not register -- return to Step 3 and retry.',
        tools: ['read_page', 'get_dom_snapshot'],
        expected: 'Cancellation confirmation page with success text visible'
      },
      {
        step: 8,
        name: 'REPORT',
        description: 'State final outcome: (a) which buttons were found and their text content, (b) which button was identified as the cancel button and why, (c) whether the button positions appeared randomized (different from typical left=cancel, right=confirm convention), (d) whether confirmshaming language was detected and how it was parsed, (e) what confirmation text was shown after clicking cancel, (f) whether cancellation was verified successfully. Include the number of retention steps navigated.',
        tools: ['read_page'],
        expected: 'Complete report of button identification, click action, and verification results'
      }
    ]
  },

  warnings: [
    'DARK-03: NEVER rely on button position (left/right, first/second) to identify the Cancel button. Positions may be randomized. ALWAYS read button text content to determine which button cancels vs keeps the subscription.',
    'Some sites use confirmshaming: the cancel button may say "Yes, I want to lose my benefits" or "No, I don\'t want savings." Parse the SEMANTIC ACTION (what clicking does), not the emotional language.',
    'Subscription cancellation flows often have 3-5 retention steps before the final cancel. Expect: retention offer, reason selection, final confirmation. Navigate through all steps by identifying and clicking the cancel/decline variant at each stage.',
    'The "Keep subscription" button may be styled as the primary/prominent button (colored, larger) while "Cancel" is styled as a plain link or secondary button. Visual styling is part of the dark pattern -- ignore it, use text content only.',
    'After cancellation, verify the outcome. Some sites show a "cancelled" confirmation page but actually do not process the cancellation. Check for confirmation text and, if possible, verify the subscription status on the account page.'
  ],

  toolPreferences: ['navigate', 'click', 'read_page', 'get_dom_snapshot', 'get_text']
});
