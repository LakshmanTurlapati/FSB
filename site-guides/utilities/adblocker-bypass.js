/**
 * Site Guide: Adblocker Modal Bypass
 * Per-site guide for bypassing "disable your adblocker" modals that deliberately
 * provide NO close button or exit path, using DOM manipulation to remove the
 * blocking overlay and restore page interactivity.
 *
 * Key challenge: Adblocker detection modals are designed to be completely inescapable
 * through normal UI interaction. Unlike DARK-04 (camouflaged close button) where a
 * hidden close element exists in the DOM, adblocker modals deliberately OMIT any close
 * mechanism entirely. The modal covers the viewport with a high z-index overlay, locks
 * body scroll, blurs/dims content, and may continuously re-inject itself via
 * MutationObserver if removed. The AI must bypass this by manipulating the DOM directly
 * since there is no close button to click.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-05) -- the modal has
 * NO close button at all. The only intended user options are: disable the adblocker,
 * whitelist the site, or leave. DOM manipulation is the only bypass method.
 *
 * Created for Phase 91, DARK-05 edge case validation.
 * Target: bypass a "disable your adblocker" modal that has no close button.
 */

registerSiteGuide({
  site: 'Adblocker Modal Bypass',
  category: 'Utilities',
  patterns: [
    /adblocker/i,
    /adblock/i,
    /ad.block/i,
    /disable.*ad/i,
    /ad.*detect/i,
    /whitelist/i,
    /turn.off.*ad/i,
    /ad.*wall/i,
    /anti.adblock/i,
    /blockadblock/i,
    /fuckadblock/i,
    /adblock.*modal/i,
    /please.*disable/i,
    /support.*ads/i
  ],

  guidance: `ADBLOCKER MODAL BYPASS INTELLIGENCE (DARK-05):

DARK PATTERN CONTEXT (DARK-05):
Adblocker detection modals are a category of dark pattern where the site detects an
adblocker extension and shows a full-screen modal/overlay with no close button, no exit
path, and no way to dismiss. Unlike DARK-04 (camouflaged close button) where a hidden
close element exists in the DOM, adblocker modals deliberately omit any close mechanism.
The only intended user options are: (1) disable the adblocker and reload, (2) whitelist
the site in the adblocker, or (3) leave. The modal typically:

(a) VIEWPORT OVERLAY: Covers the entire viewport with a high z-index overlay element
    (position:fixed, top:0, left:0, width:100%, height:100%, z-index:9999 or higher).
    The overlay prevents any interaction with the page content underneath. The z-index
    is typically set very high (9999, 99999, or 2147483647) to ensure nothing can
    appear above the modal.

(b) BODY SCROLL LOCK: Adds overflow:hidden to body and/or html elements to prevent
    the user from scrolling the page behind the modal. Some implementations also set
    position:fixed on the body element (mobile scroll lock pattern) which prevents
    any scrolling entirely. Body classes like "no-scroll", "modal-open", "locked",
    or "adblock-active" are commonly added to trigger these styles via CSS.

(c) CONTENT BLUR/DIM: Applies CSS to the main page content to make it unreadable:
    filter:blur(5px) makes text illegible, opacity:0.1-0.3 dims the content,
    pointer-events:none prevents clicking on any page elements, and user-select:none
    prevents text selection. These styles are applied to the main content container
    (body > main, #content, .content, article, or the first significant body child
    that is not the modal).

(d) KEYBOARD BLOCKING: May disable keyboard interaction including Tab key navigation,
    Escape key (which would otherwise be a dismiss mechanism), and other keyboard
    shortcuts. Some implementations add a keydown event listener that calls
    preventDefault() on all keyboard events while the modal is active.

(e) RE-DETECTION VIA MUTATIONOBSERVER: Some sites use MutationObserver to monitor
    the DOM for modal removal. If the modal element is removed from the DOM (via
    element.remove() or display:none), the observer callback re-injects the modal
    within milliseconds. This makes simple DOM removal insufficient -- the bypass
    must also neutralize the re-detection script or use CSS override instead of
    element removal to evade the observer.

The AI MUST bypass this by manipulating the DOM directly since there is NO close button
to click. This is the fundamental distinction from DARK-04 (camouflaged close) -- there
is no close button to find, no matter how thoroughly the DOM is scanned.

ADBLOCKER DETECTION METHOD IDENTIFICATION:
Before bypassing the modal, identify HOW the site detects the adblocker. This helps
predict re-detection behavior and choose the best bypass strategy.

Detection Method 1: BAIT ELEMENT TECHNIQUE
The most common detection method. The site creates a div element with ad-related class
names or IDs (class="ad-banner", id="ad-container", class="adsbox", class="textads",
class="ad-placeholder", class="sponsor-ads") and inserts it into the DOM. If the
adblocker hides or removes this bait element (setting display:none, visibility:hidden,
or removing it entirely), the detection script checks the element's offsetHeight,
clientHeight, or computed display property. If the element has height 0 or is not
visible, the adblocker is detected and the modal is triggered.

Detection Method 2: SCRIPT LOAD FAILURE TEST
The site includes a script tag with src pointing to a known ad domain:
  - pagead2.googlesyndication.com/pagead/js/adsbygoogle.js (Google AdSense)
  - securepubads.g.doubleclick.net/tag/js/gpt.js (Google Publisher Tags)
  - ads.example.com/ads.js (generic ad server)
If the script fails to load (blocked by the adblocker's network filter list), the
detection script checks for the absence of expected global variables (window.adsbygoogle,
window.googletag) or catches the onerror event on the script tag. Script load failure
triggers the modal.

Detection Method 3: AD SERVER REQUEST CHECK
The site makes a fetch() or XMLHttpRequest to an ad server endpoint. If the request
fails (net::ERR_BLOCKED_BY_CLIENT from the adblocker), the catch handler triggers the
modal. Some sites also check for specific response patterns from the ad server.

Detection Method 4: DOM MEASUREMENT CHECK
Similar to bait element but focuses on measurement: the site creates an ad-like element
with specific dimensions (e.g., 300x250 for a medium rectangle ad slot), inserts it into
the DOM, then measures its offsetWidth and offsetHeight. If the adblocker collapses the
element to 0x0 or hides it, the measurement check fails and the modal appears.

Knowing the detection method informs whether simple DOM removal of the modal suffices
or whether the detection script must also be neutralized to prevent re-triggering.

COMMON ADBLOCKER DETECTION LIBRARIES AND MODAL DOM PATTERNS:

Library 1: BLOCKADBLOCK (blockadblock.com)
  - Creates a modal overlay element with id="blockadblock" or class="blockadblock"
  - Adds class="blockadblock" to the body element
  - Modal is a full-screen overlay div with position:fixed, z-index:9999+
  - No close button is provided -- modal is designed to be inescapable
  - Detection variable: window.blockAdBlock (BlockAdBlock instance)
  - Detection method: Bait element with class="pub_300x250" (standard ad slot class)
  - Re-detection: Uses setInterval to periodically re-check for the bait element
  - Bypass target: Remove the #blockadblock element, remove body.blockadblock class,
    override window.blockAdBlock = undefined to prevent re-checking

Library 2: FUCKADBLOCK / DETECTADBLOCK
  - Similar architecture to BlockAdBlock (same original author)
  - Creates overlay element, adds class to body or html element
  - Detection variables: window.fuckAdBlock, window.detectAdBlock
  - Uses bait element technique with ad-related CSS classes
  - Modal structure: overlay div with no dismiss controls
  - Bypass target: Remove overlay element, override window.fuckAdBlock = undefined,
    remove bait-monitoring interval

Library 3: ADMIRAL (getadmiral.com)
  - Enterprise-level adblock recovery platform used by major publishers
  - Injects content via iframe or shadow DOM container
  - Modal may appear in a shadow root (making direct DOM selection harder) or in a
    cross-origin iframe (making DOM access impossible without CDP)
  - Detection uses multiple signals: bait element + script load + request check
  - Bypass challenge: Shadow DOM and cross-origin iframe require CSS override approach
    rather than direct DOM manipulation
  - Selectors: iframe[src*="getadmiral"], div[class*="admiral"], shadow host elements

Library 4: CUSTOM BAIT-DIV IMPLEMENTATIONS
  - Most common approach on smaller sites -- custom JavaScript without external library
  - Detection pattern: create a div with ad class (e.g., class="ad-banner"), set a timer
    (setTimeout 100-2000ms), check if the div is visible/has height
  - Modal structure varies by site but typically: position:fixed overlay div with high
    z-index, message text asking to disable adblocker, no close button
  - No standard detection variable -- must be identified by DOM inspection
  - Often simpler to bypass than library-based detection (no re-detection loop)

DOM-BASED BYPASS STRATEGY:
The core bypass approach is a multi-step DOM manipulation sequence. Since the modal has
NO close button, direct DOM manipulation is the ONLY viable approach.

Step A: IDENTIFY THE MODAL CONTAINER
Use get_dom_snapshot to find the overlay element on the page. Look for:
  - div with position:fixed and z-index greater than 1000
  - div with class or id containing "adblock", "modal", "overlay", "wall", "gate",
    "blocker", "detector", "notice", "barrier"
  - div with role="dialog" or aria-modal="true" that contains text mentioning
    adblocker, whitelist, disable ads, or similar messaging
  - Full-screen elements (width:100%, height:100% or 100vw/100vh)
The modal container is typically a direct child of body or injected at the end of the
document body. It may have multiple child elements (message text, icon, links to
whitelist instructions) but NO close/dismiss button.

Step B: REMOVE THE MODAL OVERLAY
Remove the modal element from the DOM using execute_js:
  - element.remove() -- fastest approach, removes the element entirely
  - element.style.display = 'none' -- hides without removing (safer if scripts check
    for element existence)
If the modal is inside a shadow DOM or cross-origin iframe, direct DOM removal may not
work. In that case, use the CSS override bypass strategy instead (see below).

Step C: REMOVE THE BACKDROP
Many adblocker modals add a separate backdrop div behind the modal content:
  - position:fixed with background:rgba(0,0,0,0.5) or similar semi-transparent color
  - z-index just below the modal container
  - class containing "backdrop", "overlay-bg", "mask", "dimmer", "shade"
  - May be a sibling element of the modal container with lower z-index
Find and remove the backdrop element the same way as the modal (element.remove() or
display:none). If the backdrop and modal are the same element, Step B already handles it.

Step D: RESTORE BODY SCROLL
The modal script typically adds overflow:hidden to body and/or html elements to prevent
scrolling. Undo this:
  - body.style.overflow = 'auto' (restore vertical scrolling)
  - html.style.overflow = 'auto' (some scripts set overflow on html instead of body)
  - document.documentElement.style.overflow = 'auto' (explicit html element targeting)
Also check for position:fixed on body (mobile scroll lock pattern) and restore to
  - body.style.position = 'static' or body.style.position = ''
Remove blocking CSS classes from body:
  - body.classList.remove('no-scroll', 'modal-open', 'locked', 'adblock-active')

Step E: REMOVE CONTENT BLOCKING
The modal script may add CSS to the main content container to prevent interaction.
Find the main content container (look for: main, article, #content, .content, .main,
.page, .wrapper, or the first significant child of body that is not the modal) and
remove these blocking styles:
  - filter: none (remove blur -- was filter:blur(5px))
  - opacity: 1 (restore full visibility -- was opacity:0.1-0.3)
  - pointer-events: auto (restore click ability -- was pointer-events:none)
  - user-select: auto (restore text selection -- was user-select:none)
  - visibility: visible (if hidden -- was visibility:hidden)

Step F: NEUTRALIZE RE-DETECTION
Some sites use MutationObserver to watch for modal removal and re-inject it. After
removing the modal, check if it reappears within 2-3 seconds using get_dom_snapshot.
If the modal reappears, the site uses active re-detection. Counter-strategies:
  (a) CSS OVERRIDE instead of DOM removal: inject a style tag that hides the modal
      with display:none !important. The observer watches for node removal but typically
      does not detect style changes. The modal element stays in the DOM (satisfying
      any existence checks) but is invisible.
  (b) Remove the detection script element from the DOM: find script tags whose src
      contains "adblock", "blockadblock", "fuckadblock", or detection library URLs,
      and remove them. This may stop the re-detection loop.
  (c) Override detection variables: set window.blockAdBlock = undefined,
      window.fuckAdBlock = undefined, window.detectAdBlock = undefined to break the
      library reference used by the re-injection callback.
  (d) Clear detection intervals: if the detection library uses setInterval for
      periodic re-checks, override the interval by setting the library instance to
      null or calling clearInterval on the stored interval ID.

CSS OVERRIDE BYPASS STRATEGY:
An alternative to DOM removal that is harder for re-detection scripts to counter.
Instead of removing the modal element from the DOM, inject a style element that
overrides its visibility using CSS specificity and !important declarations:

Strategy: Use execute_js to create and inject a style tag:
  var s = document.createElement('style');
  s.textContent = '[modal-selector] { display: none !important; } ' +
    'body, html { overflow: auto !important; position: static !important; } ' +
    '[content-selector] { filter: none !important; opacity: 1 !important; ' +
    'pointer-events: auto !important; user-select: auto !important; }';
  document.head.appendChild(s);

Replace [modal-selector] with the actual modal element selector identified in Step A.
Replace [content-selector] with the main content container selector identified in Step E.

This CSS override approach works because:
  (a) MutationObserver typically watches for childList changes (node addition/removal)
      and not for style changes. Injecting a style tag is a different mutation type
      than removing the modal node.
  (b) CSS !important declarations override inline styles set by the detection script,
      even if the script re-applies them after the style tag is injected.
  (c) The modal element stays in the DOM, so any existence checks by the detection
      script still pass -- the element exists but is hidden by CSS.

FALLBACK STRATEGIES:
If DOM removal and CSS override both fail (e.g., modal is in shadow DOM, cross-origin
iframe, or detection script actively fights all override attempts):

Fallback 1: ESCAPE KEY -- Press the Escape key via press_key. Some adblocker modals
  listen for the Escape keydown event as an undocumented dismiss path, even though no
  close button is visible. This is the simplest fallback to try first.

Fallback 2: GOOGLE CACHE / ARCHIVE -- Navigate to a cached version of the page that
  does not run the detection script. Use Google Cache (webcache.googleusercontent.com)
  or Wayback Machine (web.archive.org) URL patterns. The cached version serves the page
  content without the adblocker detection JavaScript.

Fallback 3: URL PARAMETER DEBUG MODE -- Append "?no_adblock_modal=1" or
  "?disable_adblock_check=1" to the URL. Some sites check URL parameters during
  development/testing and skip the adblocker detection when debug parameters are present.
  This is unlikely to work on production sites but costs nothing to try.

Fallback 4: READER MODE -- If the browser supports Reader Mode and the page has article
  content, Reader Mode extracts the article text without running page scripts. This
  bypasses the adblocker detection entirely. Note: Reader Mode only works for article-
  style content and may not preserve all page functionality.

Fallback 5: BEHIND-OVERLAY CONTENT EXTRACTION -- If the page content loaded before the
  modal appeared (which is typical -- the content loads first, then the detection script
  runs and shows the modal), the text content is still in the DOM behind the overlay.
  Even though it is visually blocked, use execute_js to extract text from DOM elements
  that are behind the overlay: query main content elements and read their textContent
  or innerText directly. Scroll the body element via window.scrollTo() if needed to
  trigger lazy-loaded content. This does not dismiss the modal but provides the page
  content the user was trying to access.`,

  selectors: {
    modalContainer: {
      byClass: 'div[class*="adblock"], div[class*="ad-block"], div[class*="blocker"], div[class*="adwall"], div[class*="gate"], div[id*="adblock"], div[id*="blocker"]',
      byRole: 'div[role="dialog"], div[aria-modal="true"]',
      byStyle: 'div[style*="position: fixed"][style*="z-index"]',
      generic: '.modal, .overlay, .popup, [class*="modal"], [class*="overlay"]'
    },
    modalBackdrop: {
      backdrop: 'div[class*="backdrop"], div[class*="overlay-bg"], div[class*="mask"], div[class*="dimmer"], div[class*="shade"]',
      fixedOverlay: 'div[style*="position: fixed"][style*="background"]'
    },
    bodyScrollLock: {
      overflow: 'body[style*="overflow: hidden"], html[style*="overflow: hidden"]',
      fixed: 'body[style*="position: fixed"]',
      bodyClass: 'body.no-scroll, body.modal-open, body.locked, body.adblock-active'
    },
    contentBlocking: {
      blur: '[style*="filter: blur"], [style*="filter:blur"]',
      opacity: '[style*="opacity: 0"], [style*="opacity:0"]',
      pointerEvents: '[style*="pointer-events: none"], [style*="pointer-events:none"]'
    },
    detectionLibrary: {
      blockAdBlock: '#blockadblock, .blockadblock, [class*="blockadblock"]',
      fuckAdBlock: '[class*="fuckadblock"], [class*="detectadblock"]',
      admiral: 'iframe[src*="getadmiral"], [class*="admiral"]',
      baitElement: '.ad-banner, .ad-placeholder, .adsbox, #ad-container, .textads, .sponsor-ads'
    },
    adblockMessage: {
      text: 'div, p, h1, h2, h3, span'
    }
  },

  workflows: {
    bypassAdblockerModal: [
      'Step 1: DETECT ADBLOCKER MODAL -- Use get_dom_snapshot to identify an adblocker detection modal on the page. Look for full-screen overlay elements with position:fixed and z-index greater than 1000. Check text content for keywords: "adblock", "ad blocker", "whitelist", "disable", "turn off", "ad-free", "support us by". Match against selectors: modalContainer.byClass, modalContainer.byRole, modalContainer.generic. If no modal detected, the page may not have adblocker detection active -- report "No adblocker modal detected" and exit.',

      'Step 2: IDENTIFY DETECTION METHOD -- Examine the page for clues about which adblocker detection method the site uses. Check for: (a) bait elements matching detectionLibrary.baitElement selectors that have display:none or offsetHeight:0, (b) blocked script tags with src containing "adsbygoogle", "pagead", "doubleclick", "ads.js", or ad-related domains, (c) detection library signatures matching detectionLibrary.blockAdBlock, detectionLibrary.fuckAdBlock, or detectionLibrary.admiral selectors, (d) global variables window.blockAdBlock, window.fuckAdBlock, window.detectAdBlock. Record the identified detection method for re-detection neutralization in Step 6.',

      'Step 3: CONFIRM NO CLOSE BUTTON (DARK-05 DISTINCTION) -- This is the critical DARK-05 distinction from DARK-04 (camouflaged close button). Scan the detected modal container for ANY close or dismiss elements: (a) aria-label containing "close", "dismiss", or "exit", (b) class or id containing "close", "dismiss", or "exit", (c) X characters or cross unicode symbols in text content, (d) SVG close icons, (e) buttons or links with text "Close", "Dismiss", "Skip", "Not now". If a close button IS found, this is a DARK-04 pattern (camouflaged close button), not DARK-05 -- redirect to the camouflaged-close.js workflow instead. DARK-05 specifically handles modals with NO close mechanism whatsoever.',

      'Step 4: ATTEMPT DOM REMOVAL -- Remove the modal overlay element and its backdrop from the DOM via execute_js. Execute the following sequence: (a) find the modal container element identified in Step 1, (b) call element.remove() on the modal container to remove it from the DOM, (c) find the backdrop element using modalBackdrop selectors and remove it similarly, (d) if element.remove() fails or the element is in a shadow DOM, try element.style.display = "none" as an alternative.',

      'Step 5: RESTORE PAGE INTERACTIVITY -- After modal removal, undo all body-level and content-level blocking applied by the detection script. Execute via execute_js: (a) body.style.overflow = "auto" and html.style.overflow = "auto" to restore scrolling, (b) body.style.position = "" to undo mobile scroll lock, (c) body.classList.remove("no-scroll", "modal-open", "locked", "adblock-active") to remove blocking classes, (d) find the main content container (main, article, #content, .content, or first significant body child) and remove blocking styles: filter = "none", opacity = "1", pointerEvents = "auto", userSelect = "auto".',

      'Step 6: CHECK RE-DETECTION -- Wait 2-3 seconds and use get_dom_snapshot to check if the modal has reappeared. If the modal reappeared, the site uses MutationObserver-based re-detection or setInterval re-checking. Apply counter-strategies via execute_js: (a) try CSS override bypass instead of DOM removal -- inject a style tag with display:none !important on the modal selector, overflow:auto !important on body/html, and filter:none !important + pointer-events:auto !important on the content container, (b) remove detection script elements from the DOM (script tags with src containing adblock detection URLs), (c) override detection variables: window.blockAdBlock = undefined, window.fuckAdBlock = undefined, window.detectAdBlock = undefined.',

      'Step 7: VERIFY BYPASS SUCCESS -- Use get_dom_snapshot to confirm the bypass worked: (a) no full-screen overlay elements with high z-index are blocking content, (b) page text content is readable -- try read_page to extract article text, (c) body overflow is not hidden (scrolling restored), (d) content is not blurred (no filter:blur on content elements), (e) content is not dimmed (opacity is 1 or not overridden), (f) pointer-events are not disabled on content. If verification fails on any check, try the CSS override bypass strategy if not already attempted, or proceed to Step 8 fallbacks.',

      'Step 8: FALLBACK AND REPORT -- If DOM removal and CSS override both failed, try fallback strategies in order: (1) press Escape key via press_key, (2) navigate to a Google Cache version of the page (prepend "webcache.googleusercontent.com/search?q=cache:" to the URL) to bypass detection scripts, (3) extract content from behind the overlay using execute_js to read textContent from main content elements despite the visual blocking. Report final outcome: which detection method was identified, which bypass strategy was attempted (DOM removal, CSS override, fallback), whether re-detection was encountered and how it was countered, whether page content was ultimately accessible and readable.'
    ]
  },

  warnings: [
    'DARK-05: Adblocker modals have NO close button -- do NOT waste iterations looking for one. If get_dom_snapshot shows a full-screen overlay with "disable adblock" text and no dismiss/close elements, go directly to DOM removal bypass.',
    'Some adblocker modals use MutationObserver to RE-INJECT the modal after DOM removal. If the modal reappears within 2-3 seconds, switch to CSS override bypass (inject style tag with display:none !important) instead of repeated element.remove() calls.',
    'Adblocker modals typically lock body scroll AND block content interaction. After removing the modal overlay, ALWAYS also restore body.style.overflow and remove pointer-events:none from the main content container.',
    'Check for the DETECTION METHOD before bypassing: bait element (hidden ad-class div), script load test (blocked ad domain script), or library (BlockAdBlock/FuckAdBlock). Knowing the method helps neutralize re-detection after bypass.',
    'If DOM manipulation fails (shadow DOM, cross-origin iframe modal), extract content from BEHIND the overlay: the page content usually loaded before the modal appeared, so text is in the DOM even though it is visually blocked.'
  ],

  toolPreferences: ['navigate', 'click', 'click_at', 'read_page', 'get_dom_snapshot', 'get_attribute', 'press_key', 'execute_js']
});
