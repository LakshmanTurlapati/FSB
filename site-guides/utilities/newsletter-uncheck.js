/**
 * Site Guide: Newsletter Uncheck Before Submit
 * Per-site guide for finding and unchecking hidden pre-checked newsletter
 * subscription checkboxes injected into registration, checkout, and signup
 * forms before form submission.
 *
 * Key challenge: E-commerce checkout forms, registration pages, and signup
 * flows commonly inject pre-checked newsletter/marketing subscription
 * checkboxes that are intentionally difficult to notice. The checkbox IS in
 * the DOM and technically visible, but the form's design makes it likely the
 * user will miss it and submit with it checked. The AI must use exhaustive
 * DOM checkbox scanning, label/name/context text classification, and targeted
 * unchecking of newsletter-related pre-checked checkboxes.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-07) -- the
 * newsletter checkbox is pre-checked by default and hidden using one or more
 * obfuscation techniques (below-fold, legal text burial, tiny font, grouped
 * consent, ambiguous labeling, accordion hiding, double-negative phrasing).
 * DOM checkbox analysis is the only reliable counter-strategy.
 *
 * Created for Phase 93, DARK-07 edge case validation.
 * Target: uncheck hidden pre-checked newsletter subscription checkbox before
 * submitting a registration, checkout, or signup form.
 */

registerSiteGuide({
  site: 'Newsletter Uncheck Before Submit',
  category: 'Utilities',
  patterns: [
    /newsletter.*uncheck/i,
    /uncheck.*newsletter/i,
    /hidden.*checkbox/i,
    /pre.?checked/i,
    /subscribe.*newsletter/i,
    /newsletter.*subscribe/i,
    /opt.?in/i,
    /opt.?out/i,
    /marketing.*email/i,
    /email.*marketing/i,
    /promotional.*email/i,
    /signup/i,
    /sign.?up/i,
    /register/i,
    /registration/i,
    /checkout/i,
    /automationexercise\.com/i,
    /saucedemo\.com/i,
    /practicesoftwaretesting\.com/i,
    /opencart/i,
    /magento/i,
    /shopify/i,
    /woocommerce/i
  ],

  guidance: `HIDDEN NEWSLETTER UNCHECK INTELLIGENCE (DARK-07):

DARK PATTERN CONTEXT (DARK-07):
E-commerce checkout forms, registration pages, and signup flows commonly inject
pre-checked newsletter/marketing subscription checkboxes that are intentionally
difficult to notice. The dark pattern relies on user inattention: the checkbox
is technically visible and in the DOM, but the form design ensures most users
will miss it and submit the form with the newsletter box still checked. This
is NOT about hidden buttons (DARK-02/04) or visual misdirection (DARK-06) --
it is about pre-checked consent injection where inaction equals opt-in.

Eight hiding techniques are used to obscure newsletter checkboxes:

(1) BELOW-FOLD PLACEMENT: Newsletter checkbox placed far below the visible form
    area, requiring scroll to see. Users who fill the visible fields and click
    Submit never scroll down to notice it. The checkbox may be 500-1000px below
    the last visible form field.
    Counter: Scroll down through the entire form before submitting. Use scroll
    tool to reveal all form content below the visible viewport.

(2) LEGAL TEXT BURIAL: Checkbox embedded within a block of terms-of-service or
    privacy policy text, making it appear as part of the legal agreement rather
    than an optional marketing opt-in. Often placed within a scrollable text
    area or a dense paragraph of legal boilerplate.
    Counter: Scan ALL checkboxes including those inside legal text containers.
    Check parent elements for class names containing "legal", "terms", "policy",
    "fine-print", or "disclaimer".

(3) TINY FONT / LOW CONTRAST: Checkbox label rendered in very small font
    (10-11px) or low-contrast gray text against a light background, making it
    nearly invisible to users scanning the form quickly.
    Counter: DOM analysis ignores visual styling entirely. All checkboxes are
    equally visible in the DOM regardless of font size or color contrast.

(4) GROUPED CONSENT CLUSTERING: Newsletter checkbox placed directly below or
    alongside mandatory consent checkboxes (terms of service, age verification),
    so users who check required boxes also check the newsletter box without
    distinguishing them. The visual proximity creates an assumption of sameness.
    Counter: Classify EACH checkbox individually by its label text. Do not
    treat grouped checkboxes as a single unit. A checkbox next to "I agree to
    Terms of Service" may still be a separate newsletter opt-in.

(5) AMBIGUOUS LABELING: Label text uses vague phrasing like "I agree to receive
    updates", "Keep me informed", "Stay updated with the latest", or "Send me
    relevant offers" rather than clearly stating "Subscribe to marketing
    newsletter". The marketing nature is obscured by neutral language.
    Counter: Check for newsletter/marketing indicator keywords in the label
    even when the word "newsletter" is absent. Keywords: "updates" combined
    with email context, "offers", "deals", "informed", "relevant information",
    "communications", "keep me posted".

(6) DEFAULT PRE-CHECK (OPT-OUT MODEL): Checkbox is pre-checked by default,
    requiring the user to actively uncheck it to opt out. Combined with any
    hiding technique above, this ensures most users unknowingly opt in because
    they never see or notice the already-checked box.
    Counter: After identifying newsletter checkboxes, always check the 'checked'
    attribute. A pre-checked newsletter checkbox must be unchecked before form
    submission. Use check_box tool to toggle it to unchecked state.

(7) ACCORDION / COLLAPSIBLE HIDING: Checkbox placed inside a collapsed
    "Additional options", "Communication preferences", or "More settings"
    accordion section that users must explicitly expand to see. The default
    collapsed state ensures the checkbox is never seen by users who do not
    click to expand.
    Counter: Before scanning for checkboxes, expand ALL collapsed accordion
    sections on the page. Click elements matching [aria-expanded="false"],
    details:not([open]), or elements with class names containing "collapsed",
    "accordion", "expand", or "toggle". Then rescan for checkboxes.

(8) DOUBLE-NEGATIVE PHRASING: Label uses confusing double-negative language
    like "Uncheck this box if you do NOT wish to receive newsletters" where
    the default checked state means opt-in. Users misread the double-negative
    and leave the box checked thinking they are opting out.
    Counter: Parse the semantic meaning of the label. If the label contains
    negative constructions ("do not wish to receive", "uncheck to not receive",
    "opt out by unchecking"), understand that checked = opt-in and unchecked =
    opt-out. The goal is always to reach unchecked (opt-out) state regardless
    of the confusing phrasing.

CHECKBOX IDENTIFICATION STRATEGY:
The core identification approach is DOM attribute and context text analysis.
The AI MUST NOT rely on visual position, font size, or styling -- only DOM
content and attributes determine checkbox classification.

Step A: SCAN ALL CHECKBOXES
Use get_dom_snapshot to find every input[type="checkbox"] on the page. Also
check for custom checkbox implementations: div[role="checkbox"],
span[role="checkbox"], label elements wrapping hidden inputs. Record every
checkbox found with its element reference, id, name, and checked state.

Step B: EXTRACT LABEL TEXT
For each checkbox, find its associated label text. Look for:
(1) label[for="checkbox-id"] matching the checkbox's id attribute
(2) Parent label element wrapping the checkbox (label > input[type=checkbox])
(3) Adjacent sibling text node or span element
(4) aria-label or aria-labelledby attribute on the checkbox itself
(5) title attribute on the checkbox
(6) Surrounding paragraph or div text within 200 characters of the checkbox
Use get_text on the label element and get_attribute for aria-label, name, id.

Step C: CLASSIFY EACH CHECKBOX
Based on label text, name attribute, and id attribute, classify each checkbox
into one of these categories:

NEWSLETTER/MARKETING indicators (TARGET for unchecking):
  "newsletter", "subscribe", "marketing", "promotional", "offers", "deals",
  "updates" (when combined with email/marketing context), "keep me informed",
  "stay updated", "receive emails", "email me", "send me", "opt in",
  "mailing list", "communications", "relevant offers", "special offers",
  "promotions", "latest news", "product updates"

REQUIRED CONSENT indicators (do NOT uncheck):
  "terms of service", "terms and conditions", "privacy policy", "I agree to
  the", "I accept", "age verification", "I am over", "I have read", "I
  consent to the processing", "data processing agreement", "GDPR consent"

AMBIGUOUS indicators (examine context more carefully):
  "updates", "notifications", "keep me posted", "relevant information",
  "stay in touch" -- check if the surrounding text mentions email, newsletter,
  or marketing. If it does, classify as NEWSLETTER. If it refers to account
  notifications or order updates, classify as OTHER (do not uncheck).

Step D: CHECK 'CHECKED' STATE
For each newsletter-classified checkbox, use get_attribute to check the
'checked' property. A pre-checked checkbox will have checked=true or the
'checked' HTML attribute present. Only pre-checked newsletter checkboxes need
to be unchecked. If a newsletter checkbox is already unchecked, leave it alone.

Step E: SCROLL TO FIND HIDDEN CHECKBOXES
Before assuming all checkboxes have been found, scroll down within the form to
reveal any below-fold checkboxes. Also expand any collapsed accordion sections
by clicking "Additional options", "Communication preferences", "More settings",
or any element with aria-expanded="false". After expanding and scrolling,
rescan for checkboxes that may have been dynamically loaded or revealed.

TARGET SITES:

automationexercise.com:
  - Registration form at /signup with "Subscribe to our newsletter" checkbox
  - May be pre-checked by default on the registration page
  - Form includes name, email, password fields with newsletter opt-in
  - URL pattern: automationexercise.com/signup or /login

practicesoftwaretesting.com:
  - Registration form with marketing opt-in options
  - Practice site for testing automation tools
  - May include checkbox for promotional emails or updates

demo.opencart.com:
  - Registration flow at /index.php?route=account/register
  - "I wish to subscribe to the ... newsletter" option at bottom of form
  - Often pre-checked by default in OpenCart installations
  - Checkout flow may also include newsletter opt-in step

Generic e-commerce pattern:
  - Most Shopify stores include newsletter checkbox in footer signup or checkout
  - WooCommerce checkout forms often include marketing consent checkbox
  - Magento registration forms include newsletter subscription option
  - OpenCart stores include "Subscribe to newsletter" on registration page

FORM SUBMIT VERIFICATION:
After unchecking the newsletter checkbox and before submitting the form, verify
the checkbox state with get_attribute to confirm checked=false. After form
submission, check for any confirmation page that mentions "subscribed to
newsletter" or "marketing preferences" as a secondary verification that the
uncheck was effective. If the confirmation page says "subscribed", the uncheck
did not persist through form submission -- report this as a verification failure.
`,

  selectors: {
    newsletterCheckbox: {
      byName: 'input[type="checkbox"][name*="newsletter"], input[type="checkbox"][name*="subscribe"], input[type="checkbox"][name*="marketing"], input[type="checkbox"][name*="mailing"], input[type="checkbox"][name*="opt"]',
      byId: 'input[type="checkbox"][id*="newsletter"], input[type="checkbox"][id*="subscribe"], input[type="checkbox"][id*="marketing"], input[type="checkbox"][id*="optin"]',
      byLabel: 'label:has(input[type="checkbox"])',
      byRole: '[role="checkbox"]',
      generic: 'input[type="checkbox"]'
    },
    labelText: {
      newsletterKeywords: 'newsletter|subscribe|marketing|promotional|offers|deals|mailing list|keep me informed|stay updated|receive emails|email me|send me|opt in|communications',
      consentKeywords: 'terms of service|terms and conditions|privacy policy|I agree|I accept|age verification',
      expandable: '[class*="accordion"], [class*="collapse"], [class*="expand"], details, summary, [aria-expanded]'
    },
    formSubmit: {
      button: 'button[type="submit"], input[type="submit"], [class*="submit"], [data-testid*="submit"]',
      form: 'form'
    },
    hidingIndicators: {
      belowFold: 'input[type="checkbox"]:not(:visible)',
      smallText: '[style*="font-size: 10"], [style*="font-size: 11"], [class*="small"], [class*="fine-print"], [class*="legal"]',
      accordion: 'details:not([open]), [aria-expanded="false"], [class*="collapsed"]'
    }
  },

  workflows: {
    uncheckNewsletterBeforeSubmit: [
      {
        step: 1,
        name: 'NAVIGATE TO FORM PAGE',
        description: 'Use navigate to load the registration, checkout, or signup page. Wait for the form to fully render by using get_dom_snapshot to confirm form fields (input elements, submit button) are present in the DOM. If the page requires scrolling to load lazy content, scroll once to trigger any deferred rendering.'
      },
      {
        step: 2,
        name: 'SCAN ALL CHECKBOXES',
        description: 'Use get_dom_snapshot to find every input[type="checkbox"] and [role="checkbox"] element on the page. Record each checkbox element reference, id attribute, name attribute, checked state, and any visible label text. Include custom checkbox implementations (div[role="checkbox"], span[role="checkbox"]). This initial scan captures all checkboxes currently visible in the DOM.'
      },
      {
        step: 3,
        name: 'SCROLL AND EXPAND',
        description: 'Scroll down through the entire form to reveal any below-fold checkboxes that were not in the initial viewport. Click any "Additional options", "Communication preferences", "More settings", or accordion/collapsible sections (elements with aria-expanded="false", details:not([open]), or class names containing "collapsed" or "accordion"). After expanding and scrolling, rescan checkboxes with get_dom_snapshot to capture any newly revealed elements.'
      },
      {
        step: 4,
        name: 'CLASSIFY CHECKBOXES',
        description: 'For each checkbox found in Steps 2-3, use get_text on its label element and get_attribute to read name, id, and aria-label attributes. Classify each checkbox into one of three categories: NEWSLETTER (label/name/id contains newsletter, subscribe, marketing, promotional, offers, deals, mailing list, keep me informed, stay updated, receive emails, email me, send me, opt in, communications keywords), CONSENT (label contains terms of service, privacy policy, I agree, I accept, age verification keywords), or OTHER (neither newsletter nor consent). For AMBIGUOUS labels ("updates", "notifications", "keep me posted"), check surrounding context text for email/marketing/newsletter mentions to determine classification.'
      },
      {
        step: 5,
        name: 'IDENTIFY PRE-CHECKED NEWSLETTER BOXES',
        description: 'From the NEWSLETTER-classified checkboxes, use get_attribute to check which have checked=true (pre-checked by default). These pre-checked newsletter checkboxes are the targets for unchecking. If no NEWSLETTER checkboxes are found, re-examine AMBIGUOUS-classified checkboxes with stricter context analysis. If still none found, the form may not have a newsletter checkbox -- document this finding and proceed to form submission.'
      },
      {
        step: 6,
        name: 'UNCHECK NEWSLETTER CHECKBOXES',
        description: 'For each pre-checked newsletter checkbox identified in Step 5, use check_box tool with the checkbox selector to toggle it from checked to unchecked state. The check_box tool toggles the current state, so calling it on a checked box will uncheck it. If multiple newsletter checkboxes are pre-checked, uncheck each one individually. Use the most specific selector available (by id, then by name, then by label context).'
      },
      {
        step: 7,
        name: 'VERIFY UNCHECKED STATE',
        description: 'After toggling each checkbox in Step 6, use get_attribute on the checkbox to confirm checked=false. The verification must confirm the checkbox is now in the unchecked state. If get_attribute still shows checked=true (toggle did not work), try clicking the checkbox directly with the click tool as a fallback unchecking method. Verify again after the fallback click. If the checkbox cannot be unchecked after both attempts, document the failure.'
      },
      {
        step: 8,
        name: 'SUBMIT FORM',
        description: 'After all newsletter checkboxes have been unchecked and verified, submit the form by clicking the submit button (button[type="submit"], input[type="submit"], or element with submit-related class/text). After submission, verify success by checking for a confirmation page, success message, or redirect to a dashboard/welcome page. Check if the confirmation mentions "subscribed to newsletter" as a secondary verification that the uncheck persisted through submission.'
      }
    ]
  },

  warnings: [
    'DARK-07: Forms hide pre-checked newsletter checkboxes to trick users into subscribing. SCAN ALL checkboxes via DOM analysis, CLASSIFY by label text, UNCHECK any pre-checked newsletter boxes before submitting.',
    'NEVER submit a form without first scanning for hidden newsletter checkboxes below the fold or inside collapsed sections. Scroll down and expand all accordion sections before submitting.',
    'Pre-checked checkboxes that say "newsletter", "subscribe", "marketing", or "promotional" in their label, name, or id are ALMOST ALWAYS opt-in marketing checkboxes. Uncheck them unless the user explicitly wants to subscribe.',
    'Do NOT uncheck checkboxes related to terms of service, privacy policy, or age verification -- these are required consent, not marketing opt-in. Only uncheck newsletter/marketing checkboxes.',
    'If a checkbox label uses double-negative phrasing like "Uncheck to not receive", understand the logic: checked = opt-in, unchecked = opt-out. The goal is to reach unchecked (opt-out) state regardless of phrasing.'
  ],

  toolPreferences: ['check_box', 'get_dom_snapshot', 'get_attribute', 'get_text', 'scroll', 'click', 'navigate']
});
