/**
 * Site Guide: Camouflaged Close Button
 * Per-site guide for finding and clicking close buttons on pop-up ad overlays
 * where the close (X) button is deliberately styled to blend with the background
 * using DOM attribute analysis instead of visual recognition.
 *
 * Key challenge: Pop-up ads and overlay modals deliberately camouflage their close
 * button to maximize impression time and accidental ad clicks. The close button may
 * be: matching the background color (white X on white), nearly transparent (opacity
 * 0.1-0.3), extremely small (4x4px to 8x8px), positioned outside the visible ad
 * boundary, delayed by 3-10 seconds after load, or hidden inside an iframe. The AI
 * has no vision -- it must use DOM attribute analysis (aria-label, class, id, data-*,
 * onclick handlers, SVG paths) to locate the close button despite visual camouflage.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-04) -- the close
 * button is invisible to visual inspection but present in the DOM with identifiable
 * attributes. DOM analysis is the only reliable detection method.
 *
 * Created for Phase 90, DARK-04 edge case validation.
 * Target: close a pop-up ad where the X button is camouflaged against the background.
 */

registerSiteGuide({
  site: 'Camouflaged Close Button',
  category: 'Utilities',
  patterns: [
    /camouflaged.*close/i,
    /close.*button/i,
    /popup.*close/i,
    /pop-up.*ad/i,
    /overlay.*dismiss/i,
    /dismiss.*popup/i,
    /interstitial/i,
    /close.*ad/i,
    /ad.*overlay/i,
    /modal.*close/i
  ],

  guidance: `CAMOUFLAGED CLOSE BUTTON INTELLIGENCE (DARK-04):

DARK PATTERN CONTEXT (DARK-04):
Pop-up ads and overlay modals deliberately camouflage their close button to maximize
impression time and accidental ad clicks. The close button is present in the DOM but
made nearly invisible to human users through multiple camouflage techniques:

(a) COLOR MATCHING: The close button X character or SVG is styled with the same color
    as the ad background. A white X on a white background, or a gray X on a gray
    overlay, renders the close button invisible to human eyes but still present in the
    DOM as a clickable element with identifiable attributes.

(b) LOW OPACITY: The close button has opacity set to 0.1-0.3, making it nearly
    transparent. The element is fully functional and clickable but visually undetectable
    without careful inspection. Computed style shows opacity < 0.5.

(c) TINY HIT TARGET: The close button is sized at 4x4px to 8x8px -- far below the
    recommended 44x44px minimum touch target. This makes it nearly impossible for
    humans to find and click precisely, but the element still exists in the DOM with
    measurable dimensions.

(d) OFF-BOUNDARY POSITIONING: The close button is positioned outside the visual
    boundary of the ad using absolute positioning with negative offsets (top: -10px,
    right: -15px) or placed above/to the right of the visible ad frame. The element
    is in the DOM but visually outside the area a user would look.

(e) DELAYED APPEARANCE: The close button does not appear until 3-10 seconds after the
    ad loads. Some use setTimeout to add the element to the DOM after a delay, others
    have the element present from load but with display:none or visibility:hidden until
    a CSS animation-delay or JS timer fires. The button may exist in the DOM but be
    hidden until the timer completes.

(f) COUNTDOWN TIMER: A countdown overlay ("You can close this ad in 5...4...3...")
    blocks the close button until the timer expires. The close button element may exist
    in the DOM but be covered by the countdown overlay or have pointer-events:none
    until the countdown completes.

(g) DECOY CLOSE BUTTON: A fake "X" button is placed prominently that actually opens
    another ad or triggers a click-through instead of closing the overlay. The real
    close button is smaller, less visible, and positioned nearby. The decoy X has an
    onclick handler or href that navigates to an external URL.

(h) IFRAME NESTING: The close button is inside an iframe that has a different z-index
    than the ad content, or the ad renders entirely inside an iframe with the close
    button either inside the iframe DOM or in a separate small overlay iframe.

The AI MUST use DOM attribute analysis since it has no visual perception. Even a close
button that is invisible to human users is PRESENT IN THE DOM with identifiable
attributes such as aria-label, role, class names, data attributes, or onclick handlers.

DOM-BASED CLOSE BUTTON DETECTION STRATEGY:
The core approach is to scan all elements within the pop-up overlay container and any
associated iframes for close button indicators. Detection signals are ranked by
reliability into three tiers:

TIER 1 -- HIGH CONFIDENCE (reliable close button indicators):
  - aria-label containing "close", "dismiss", "shut", or "exit" (case-insensitive)
  - role="button" with textContent of "X", "x", or unicode cross characters:
    U+2715 (multiplication X), U+2716 (heavy multiplication X), U+2717 (ballot X),
    U+00D7 (multiplication sign), U+2573 (box drawings light diagonal cross)
  - data-dismiss attribute (Bootstrap modal pattern)
  - data-close attribute (custom close handler)
  - data-action="close" attribute
  - id containing "close", "dismiss", "exit", or "shut"
  - class containing "close", "dismiss", "exit", or "shut"

TIER 2 -- MEDIUM CONFIDENCE (probable close button indicators):
  - SVG elements with path data drawing an X shape (two diagonal lines from corners):
    look for M/L path commands forming two crossing lines, or use elements within SVG
    that create a cross/X visual
  - Elements with onclick or click handler containing function calls to close(), dismiss(),
    hide(), remove(), fadeOut(), slideUp(), or destroy()
  - Button or anchor elements that are direct children of the overlay/modal container
    with very small dimensions (width < 30px, height < 30px) -- typical close button sizing
  - Elements with position:absolute in the top-right corner of the overlay container
    (typical close button placement: top: 0-20px, right: 0-20px relative to container)

TIER 3 -- LOW CONFIDENCE (fallback close button indicators):
  - Any element with text content "X", "x", "Close", "No thanks", "Not now",
    "Maybe later", "Skip", "Dismiss", "Got it"
  - Link elements with href="#" or href="javascript:void(0)" inside the overlay container
  - Elements whose computed style has opacity < 0.5 and are inside the overlay container
  - Any small (< 30px) absolutely positioned element in the top-right quadrant of the overlay

IFRAME CLOSE BUTTON DETECTION:
Many ad overlays render the ad content (including its close button) inside an iframe.
The close button may be in one of three locations:

(a) INSIDE THE AD IFRAME: The close button is part of the ad creative, rendered inside
    the iframe DOM. Requires iframe DOM access via CDP or get_dom_snapshot targeting the
    iframe. Look for the same Tier 1/2/3 signals inside the iframe DOM.

(b) OUTSIDE THE IFRAME (PARENT DOCUMENT): The close button is in the parent document,
    overlaying the iframe. Typically positioned at the top-right corner of the iframe
    element's bounding rect. Check the parent document for close button elements near
    the iframe's position.

(c) SEPARATE SMALL IFRAME: Some ad platforms use a dedicated small iframe (20x20px or
    similar) that contains only the close button, positioned at the corner of the main
    ad iframe. Look for small iframes near the ad iframe boundaries.

Strategy: First scan the parent document for close buttons near the overlay. If not
found, use get_dom_snapshot on any iframes within the overlay to check for close buttons
inside them. If CDP tools are available, use click_at with coordinates calculated from
the iframe's bounding rect + typical close button position (top-right corner, offset
10-15px from edge).

FALLBACK DISMISSAL STRATEGIES:
If no close button can be found in the DOM after scanning all tiers and iframes, use
these fallback approaches in order:

Fallback 1: ESCAPE KEY -- Press the Escape key. Many overlay modals listen for the
  keydown event on Escape (keyCode 27) and close automatically. This is the simplest
  and least invasive fallback.

Fallback 2: BACKDROP CLICK -- Click the dark backdrop/overlay area behind the pop-up
  modal. Many modal implementations close when the user clicks outside the modal content
  area (on the semi-transparent backdrop). Use click_at targeting a coordinate in the
  visible backdrop area (outside the modal bounds).

Fallback 3: DOM REMOVAL -- Use get_dom_snapshot to find the overlay container element,
  then set its style.display='none' or call element.remove() to force-remove it from
  the DOM. This bypasses the intended close mechanism but guarantees the overlay is
  dismissed. May cause issues if the site has cleanup handlers tied to the close button.

Fallback 4: COOKIE SET -- Some overlays check a cookie to decide whether to show. If
  the overlay has a specific cookie that controls its display (e.g., "popup_shown=1",
  "newsletter_dismissed=true", "ad_closed=1"), set that cookie and reload the page.
  The overlay will not appear on reload.

Fallback 5: COORDINATE CLICK -- Use click_at with coordinates just outside the overlay
  boundary. Some overlays close when clicking anywhere outside their content area, even
  if there is no visible backdrop element. Calculate coordinates from the overlay's
  bounding rect and click 20px outside any edge.

DELAYED CLOSE BUTTON DETECTION:
Some close buttons appear only after a timer. If no close button is found on the first
DOM scan:

Step 1: Wait 3 seconds and rescan the DOM for close button elements.
Step 2: If still not found, wait an additional 2 seconds (5 seconds total) and rescan.
Step 3: If still not found, wait an additional 2 seconds (7 seconds total) and rescan.
Step 4: If still not found after 7 seconds total, wait 3 more seconds (10 seconds total)
  for the final rescan.
Step 5: After 10 seconds with no close button found, switch to Fallback dismissal strategies.

Note: Some ads use setTimeout or CSS animation-delay to show the close button. The DOM
element may exist but have display:none or visibility:hidden until the timer fires.
During rescans, also check elements that exist but have display:none or visibility:hidden --
they may become visible after the timer.

DECOY CLOSE BUTTON DETECTION:
Some ads place a fake "X" button that opens another ad instead of closing the overlay.
Detection strategy:

(a) Before clicking any X element, check its onclick handler: if it calls window.open(),
    location.href=, or navigates to an external URL, it is a decoy.
(b) Check the href attribute: if it points to an external URL (not "#", not "javascript:void(0)",
    not same-domain), it is a decoy.
(c) Check for target="_blank" attribute: close buttons should not open new windows.
    Presence of target="_blank" is a strong decoy indicator.
(d) Check if the element is inside a link (<a>) that wraps the entire ad creative.
    Some ads make the whole ad area clickable, so clicking anywhere (including the fake X)
    triggers the ad click-through.
(e) If clicking an X element triggers a navigation event or opens a new window instead of
    dismissing the overlay, it was a decoy. Immediately go back (if navigated) or close
    the new tab, then look for the REAL close button: typically a smaller, less visible
    element nearby with an onclick that calls close/dismiss/hide/remove functions.

POP-UP AD PLATFORMS AND CLOSE BUTTON DOM PATTERNS:

Platform 1: GOOGLE AD MANAGER (GPT/DFP) INTERSTITIAL OVERLAYS
  - Overlay container: div with id containing "google_ads" or class "gpt-ad"
  - Close button: typically a div or button with id="dismiss-button" or
    class="close-button" inside the ad iframe
  - The close button is often a 15x15px SVG X icon with opacity:0.3 or color matching
    the ad background
  - May have aria-label="Close" or aria-label="Dismiss ad"
  - Selectors: div[id*="dismiss"], button[class*="close"], [aria-label*="Close" i]

Platform 2: ADSENSE OVERLAY ADS
  - Overlay container: ins.adsbygoogle with data-ad-status="filled", wrapped in a
    positioned div
  - Close button: small X in the top-right corner of the ad unit, sometimes outside
    the ins element in a sibling div
  - Selectors: .close-button, [data-dismiss], button[aria-label*="close" i]

Platform 3: NATIVE AD PLATFORMS (TABOOLA, OUTBRAIN)
  - Sponsored content widgets with tiny "X" or "close" link
  - Close link styled as 8px light gray text, positioned at the widget corner
  - Selectors: .taboola-close, .ob-close, [class*="ad-close"], a[class*="close"]
  - Text content: "X", "close", "remove"

Platform 4: NEWSLETTER SIGNUP MODALS
  - Overlay container: div with class containing "popup", "modal", "overlay",
    "newsletter", "subscribe", or "signup"
  - Close button: thin "X" or "No thanks" link with font-size:10px and color:#ccc
    on white background
  - Common libraries: OptinMonster (class="om-close"), Sumo (class="sumo-close"),
    Privy (class="privy-close"), Mailchimp embedded (class*="popup-close")
  - Selectors: .om-close, .sumo-close, .privy-close, [class*="popup-close"],
    button[aria-label*="close" i], a:contains("No thanks")

Platform 5: VIDEO PRE-ROLL OVERLAY ADS
  - Overlay appears on top of video player with countdown timer
  - Close/skip button appears after 5-15 second countdown
  - Selectors: .video-ad-close, .skip-button, button[class*="skip"],
    [aria-label*="Skip" i], div[class*="ad-countdown"]
  - The close button often has visibility:hidden or display:none until countdown ends`,

  selectors: {
    overlayContainer: {
      popup: 'div[class*="popup"], div[class*="modal"], div[class*="overlay"], div[role="dialog"], div[class*="interstitial"], div[class*="lightbox"]',
      backdrop: 'div[class*="backdrop"], div[class*="overlay-bg"], div[class*="mask"], div[class*="dimmer"]'
    },
    closeButtonByAttribute: {
      ariaLabel: '[aria-label*="close" i], [aria-label*="dismiss" i], [aria-label*="shut" i], [aria-label*="exit" i]',
      dataAttribute: '[data-dismiss], [data-close], [data-action="close"], [data-testid*="close"]',
      idOrClass: '[id*="close"], [class*="close"], [id*="dismiss"], [class*="dismiss"], [class*="exit"]'
    },
    closeButtonByContent: {
      xCharacter: 'button, span, div, a',
      svgClose: 'svg, svg path',
      textClose: 'a, button, span'
    },
    adPlatformClose: {
      googleAdManager: 'div[id*="dismiss"], div[id*="close-button"], .gpt-ad-close',
      nativeAd: '.taboola-close, .ob-close, [class*="ad-close"]',
      newsletter: '.om-close, .sumo-close, .privy-close, [class*="popup-close"]'
    },
    iframeAd: {
      adIframe: 'iframe[id*="google_ads"], iframe[src*="doubleclick"], iframe[class*="ad"]',
      closeInIframe: 'button[id*="close"], [aria-label*="close" i], .close-button'
    }
  },

  workflows: {
    closePopupAd: [
      'Step 1: DETECT POP-UP OVERLAY -- Use get_dom_snapshot to identify overlay/modal/popup containers on the page. Look for elements matching overlayContainer selectors: div[class*="popup"], div[class*="modal"], div[class*="overlay"], div[role="dialog"], div[class*="interstitial"], div[class*="lightbox"]. Check each candidate for visibility (display not none, opacity > 0). If no overlay detected, the page may not have an active pop-up -- report "No active pop-up overlay found" and exit.',

      'Step 2: SCAN FOR CLOSE BUTTON BY ATTRIBUTES (TIER 1) -- Within the detected overlay container and all its descendants, search for elements matching closeButtonByAttribute selectors. Check for: (a) aria-label containing "close", "dismiss", "shut", or "exit" (case-insensitive), (b) data-dismiss, data-close, or data-action="close" attributes, (c) id or class containing "close", "dismiss", "exit", or "shut". Record all Tier 1 candidates with their selector, text content, computed dimensions, and position within the overlay.',

      'Step 3: SCAN FOR CLOSE BUTTON BY CONTENT (TIER 2 AND 3) -- If no Tier 1 attribute-based match found, expand the search. Tier 2: look for SVG elements with X-shaped paths, elements with onclick handlers calling close/dismiss/hide/remove, small button/anchor children of the overlay container (width/height < 30px), absolutely positioned elements in the top-right corner. Tier 3: search for elements with text content "X", "x", "Close", "No thanks", "Dismiss", links with href="#" or "javascript:void(0)" inside the overlay, elements with opacity < 0.5 inside the overlay. Record all candidates.',

      'Step 4: FILTER DECOY CLOSE BUTTONS -- For each candidate close button from Steps 2-3, check for decoy indicators: (a) does its onclick handler call window.open() or navigate to an external URL? If yes, DECOY. (b) Does its href point to an external URL (not "#" or "javascript:void(0)")? DECOY. (c) Does it have target="_blank"? DECOY. (d) Is it wrapped in an <a> that covers the entire ad area? DECOY. Filter out all decoys, keeping only candidates whose action would close/dismiss/hide the overlay.',

      'Step 5: CHECK IFRAME CLOSE BUTTONS -- If no valid close button found in the parent document, scan any iframes within the overlay container. Use get_dom_snapshot on iframe contents if accessible. Check inside each iframe for the same Tier 1/2/3 close button signals. If CDP tools are available and no iframe DOM access, calculate the close button coordinates: get the iframe bounding rect, then target the top-right corner (iframe.right - 15px, iframe.top + 15px) using click_at.',

      'Step 6: CLICK THE CLOSE BUTTON -- Click the highest-confidence close button candidate. Priority order: (1) aria-label match (Tier 1, highest confidence), (2) data-attribute match (Tier 1), (3) class/id match (Tier 1), (4) onclick handler match (Tier 2), (5) text content match (Tier 3), (6) SVG X-path match (Tier 2), (7) coordinate-based click_at for iframe close buttons. If the target element is very small (< 10px width or height), use click_at with the element center coordinates for precision rather than a CSS selector click.',

      'Step 7: VERIFY DISMISSAL -- After clicking, wait 500ms for animations, then use get_dom_snapshot to verify the overlay is gone. Check: (a) overlay container has display:none or is removed from DOM, (b) page content behind the overlay is now interactive and visible, (c) no NEW overlay appeared (some ads chain multiple overlays). If the overlay is still present, the clicked element may have been a decoy or non-functional. Go back to Step 4 and try the next candidate. If all candidates have been tried, proceed to Step 8 fallback strategies.',

      'Step 8: FALLBACK AND REPORT -- If no close button succeeded in dismissing the overlay, execute fallback strategies in order: (1) Press Escape key via press_key, (2) Click the backdrop area via click_at targeting coordinates outside the modal content but inside the viewport, (3) DOM removal via setting overlay container style.display="none" or calling element.remove(). After each fallback, verify dismissal. Report final outcome: total close button candidates found (by tier), which was clicked, whether dismissal was verified, whether fallback strategies were needed and which succeeded. Include the list of decoy buttons detected with their indicators.'
    ]
  },

  warnings: [
    'DARK-04: The close button on a pop-up ad may be INVISIBLE to visual inspection but still present in the DOM. ALWAYS use DOM attribute analysis (aria-label, class, id, data-* attributes) to find close buttons, NEVER rely on visual appearance.',
    'Some pop-up ads use a DECOY close button that opens another ad instead of closing. Check onclick handlers and href attributes before clicking any X element. If it points to an external URL, it is a decoy -- look for the real close button nearby.',
    'Close buttons may appear DELAYED -- not present in DOM until 3-10 seconds after the ad loads. If no close button found on first scan, wait and rescan up to 10 seconds before switching to fallback strategies (Escape key, backdrop click, DOM removal).',
    'Ad close buttons inside IFRAMES require either iframe DOM access or coordinate-based click_at targeting. Calculate coordinates from the iframe bounding rect plus typical close button offset (top-right corner, 10-15px inset from edge).',
    'If all close button detection and fallback strategies fail, use DOM removal as last resort: find the overlay container and set style.display="none" or call element.remove(). This bypasses the intended close mechanism but guarantees the overlay is dismissed.'
  ],

  toolPreferences: ['navigate', 'click', 'click_at', 'read_page', 'get_dom_snapshot', 'get_attribute', 'press_key']
});
