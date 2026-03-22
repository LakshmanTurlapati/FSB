# Autopilot Diagnostic Report: Phase 91 - Adblocker Modal Bypass

## Metadata
- Phase: 91
- Requirement: DARK-05
- Date: 2026-03-22
- Outcome: PARTIAL (HTTP validation confirms adblocker detection infrastructure on 5 targets. BlockAdBlock.com provides complete library documentation including bait element IDs, block screen configuration, warntype behavior modes, and configurable delay timing -- the canonical implementation of a no-close-button adblocker modal. Forbes server HTML reveals Freestar ad containers (fbs-ad) with body.noScroll scroll lock pattern, overflow:hidden on 32 CSS rules, and z-index values from 1000-1005 for overlay positioning. Wired has Conde Nast journey/paywall gate infrastructure with PaywallModalWrapper and PaywallBarWrapper styled components, 50+ modal/overlay class references, and consumer-marketing-unit journey integration. BusinessInsider has Google Ad Manager with googletag (19 references), Amazon TAM, Prebid, superZoomer/lazyLoad/collapseIfEmpty ad configuration, and paywall infrastructure. DetectAdBlock.com documents the lazyad-loader.min.js bait script technique with hidden div detection. All adblocker detection modals are JavaScript-rendered -- no modal overlay DOM exists in server HTML because the modal only appears after the detection script runs in a live browser with an active adblocker extension. DOM manipulation bypass strategy validated against documented library patterns. Live MCP execution blocked by WebSocket bridge disconnect.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch. Same persistent blocker as Phases 55-90.)

## Prompt Executed
"Navigate to a news site with an adblocker detection modal that has no close button, bypass the modal by removing the overlay element from the DOM, restore body scroll and content interactivity, and verify the page content is accessible."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-90). HTTP-based validation was performed against 5 targets: BlockAdBlock.com (canonical library homepage with full documentation of bait element detection, block screen overlay, and configurable behavior), Forbes.com (production news site with Freestar ad containers, body.noScroll scroll lock, 32 overflow:hidden CSS rules), Wired.com (Conde Nast paywall/journey gate infrastructure with PaywallModalWrapper styled component), BusinessInsider.com (Google Ad Manager + Amazon TAM + Prebid ad stack with 19 googletag references), and DetectAdBlock.com (tutorial site documenting lazyad-loader.min.js bait script technique). The key DARK-05 finding: all adblocker detection modals are 100% JavaScript-rendered. No modal overlay DOM exists in server HTML because the detection script must run in a live browser with an active adblocker to trigger the modal. The BlockAdBlock library configuration page confirms: the "block screen" is a full-screen overlay with NO close button, configurable delay (default 7 seconds), 3 behavior modes (shim/redirect to PDBA/redirect to URL), and 17+ bait element IDs for detection. DOM removal and CSS override bypass strategies are validated against the documented library patterns, but physical execution requires a live browser with WebSocket bridge.

## Step-by-Step Log

| Step | MCP Tool / Method | Target | Result | Notes |
|------|-------------------|--------|--------|-------|
| 1 | HTTP fetch (curl) | https://blockadblock.com/ | 200 OK, 41KB | BlockAdBlock library homepage with 49 "blockadblock" references, 17 "BlockAdblock" references in content |
| 2 | HTTP fetch (curl) | https://blockadblock.com/blockadblock_basic_script.php | 200 OK, 49KB | Basic script page with minified library code for copy-paste installation |
| 3 | HTTP fetch (curl) | https://blockadblock.com/configure.php | 200 OK, 121KB | Full configuration page: 17 bait element IDs, 3 warntype modes, block screen delay slider (default 7s), color/text customization, advanced detection options |
| 4 | HTTP fetch (curl) | https://www.forbes.com/ | 200 OK, 765KB | Forbes homepage: body.noScroll class (5 references), overflow:hidden (32 rules), Freestar ad containers (fbs-ad 16x), z-index:1000-1005, celtra expanded-ad z-index:1001 |
| 5 | HTTP fetch (curl) | https://www.forbes.com/sites/digital-assets/ | 200 OK | Forbes article section: same ad infrastructure, no adblock detection scripts in server HTML (JavaScript-rendered only) |
| 6 | HTTP fetch (curl) | https://www.wired.com/ | 200 OK, 1.4MB | Wired: PaywallModalWrapper-itMFEN and PaywallBarWrapper-gFBZnd styled components, 59 journey references, 32 paywall refs, 19 gate refs, Conde Nast SDK, LaunchDarkly feature flags |
| 7 | HTTP fetch (curl) | https://www.businessinsider.com/ | 200 OK, 536KB | BI: googletag (19x), superZoomer/lazyLoad/collapseIfEmpty ad config, Amazon TAM (pubID:3201, timeout:1500ms), Prebid, paywall (4 references), doubleclick |
| 8 | HTTP fetch (curl) | https://www.detectadblock.com/ | 200 OK, 17KB | DetectAdBlock tutorial: lazyad-loader.min.js bait technique documented with hidden div creation, offsetHeight check, Google Analytics integration example |
| 9 | grep analysis | Forbes server HTML | 0 adblock detection scripts | No BlockAdBlock/FuckAdBlock/Admiral library references. Forbes detection is entirely JavaScript-side (runs in browser, not server-rendered) |
| 10 | grep analysis | Wired server HTML | 0 adblock detection scripts | No explicit adblock detection. Uses Conde Nast "journey" system (paywall/registration gate) which may overlap with adblock walls but is primarily subscription-gated |
| 11 | grep analysis | BusinessInsider server HTML | 0 adblock detection scripts | No BlockAdBlock library. BI uses Google Ad Manager infrastructure; adblock detection would be client-side via ad script load failure |
| 12 | grep analysis | BlockAdBlock configure page | 17 bait element IDs confirmed | adBanner, banner_ad, ad_box, ad_channel, adserver, bannerid, adslot, popupad, adsense, google_ad, outbrain-paid, sponsored_link, glinkswrapper, adTeaser, adbanner, adAd, bannerad |
| 13 | grep analysis | BlockAdBlock configure page | 3 warntype modes confirmed | 1=shim (block screen overlay), 2=redirect to pleasedontblockads.org, 3=redirect to custom URL |
| 14 | grep analysis | BlockAdBlock configure page | Block screen delay: default 7s | Configurable delay before modal appears; re-check delay: 10 seconds (bab_checkagaindelayseconds) |
| 15 | selector test | All 5 targets | modalContainer.byClass: 0 matches on all news sites | Adblocker modal containers are JavaScript-generated, never present in server HTML |
| 16 | selector test | Wired + BI | modalContainer.generic: 50 (Wired), 6 (BI) | Generic modal/overlay classes exist for paywall/UI modals, not specifically adblocker modals |
| 17 | selector test | Forbes + Wired | bodyScrollLock patterns: 6 (Forbes), 8 (Wired) | noScroll/modal-open classes referenced in CSS confirming scroll lock infrastructure exists |
| 18 | selector test | BlockAdBlock.com | detectionLibrary.blockAdBlock: 49 matches | BlockAdBlock library references abundant on its own homepage (expected) |
| 19 | selector test | Forbes + BI | detectionLibrary.baitElement: 7 (Forbes ad-container), 1 (BI) | Forbes has "ad-container" class elements for ad slots; these are actual ad containers not bait elements, but adblockers would target them |
| 20 | selector test | All targets | adblockMessage.text: 88 (BAB), 52 (DAB), 4 (Forbes), 6 (Wired) | Text mentioning adblock/whitelist/disable found across all targets |

## What Worked
- HTTP validation of all 5 target sites succeeded (200 OK on all)
- BlockAdBlock.com configure page reveals complete library architecture: 17 bait element IDs, 3 behavior modes, configurable delay, block screen customization, and advanced detection options
- BlockAdBlock "block screen" confirmed as DARK-05 pattern: full-screen overlay with NO close button, NO dismiss mechanism, only options are whitelist/disable/leave
- DetectAdBlock.com confirms lazyad-loader.min.js bait technique: hidden div with obscure ID, loaded via ad-named script file that adblockers block, then JavaScript checks if div exists
- Forbes body.noScroll pattern confirmed (5 references in CSS) along with overflow:hidden (32 CSS rules) confirming scroll lock infrastructure used by modals/overlays
- Forbes z-index hierarchy documented: 1000-1005 for overlays, celtra expanded-ad at z-index:1001 -- overlay positioning infrastructure exists
- Wired PaywallModalWrapper and PaywallBarWrapper styled components identified with Conde Nast journey integration -- paywall gate infrastructure that could overlap with adblock walls
- BusinessInsider Google Ad Manager configuration fully extracted: Amazon TAM (pubID 3201, 1500ms timeout), Prebid, superZoomer, lazyLoad, collapseIfEmpty, refresh (30s interval, 50% viewable) -- comprehensive ad tech stack
- Selector accuracy testing completed for all 6 selector categories across all targets
- Block screen re-check interval documented (bab_checkagaindelayseconds = 10 seconds) confirming periodic re-detection behavior

## What Failed
- Live MCP execution blocked by WebSocket bridge disconnect (port 7225, HTTP 426 "Upgrade Required") -- same persistent blocker as Phases 55-90
- No adblocker detection modal DOM found in any server HTML because modals are 100% JavaScript-rendered (only appear when detection script runs in live browser with active adblocker)
- modalContainer.byClass selector returned 0 matches on all news sites -- these selectors target JavaScript-generated elements not present in server HTML
- Cannot validate DOM removal bypass (element.remove()) without live browser execution
- Cannot validate CSS override bypass (display:none !important injection) without live browser execution
- Cannot validate MutationObserver re-detection behavior without live browser
- Cannot confirm NO close button in live modal DOM (confirmed via BlockAdBlock documentation that block screen has no close mechanism, but not validated via live get_dom_snapshot)
- Forbes/Wired/BI detection scripts not identifiable from server HTML alone -- all detection runs client-side after page load

## Tool Gaps Identified

| Gap | Description | Impact | Known Since |
|-----|-------------|--------|-------------|
| WebSocket bridge disconnect | MCP server returns HTTP 426 on port 7225, preventing all live browser tool execution | Blocks ALL live MCP testing -- navigate, get_dom_snapshot, execute_js, click, read_page all unavailable | Phase 55 |
| execute_js for DOM removal | Need execute_js to run element.remove() on modal overlay container | Critical for DARK-05 bypass -- no UI element to click (no close button), DOM manipulation is the ONLY approach | Phase 61 (identified) |
| execute_js for CSS injection | Need execute_js to inject style tags with display:none !important for CSS override bypass | Required as MutationObserver-resistant alternative when DOM removal triggers re-detection | Phase 61 (identified) |
| execute_js for body style modification | Need execute_js to restore body.style.overflow and remove position:fixed scroll lock | Essential post-bypass step -- removing modal without restoring scroll leaves page unusable | New (Phase 91) |
| Computed CSS style reading | No tool to read getComputedStyle() values (blur, opacity, pointer-events) on content elements | Cannot verify content blocking styles are present before bypass or removed after bypass | New (Phase 91) |
| MutationObserver detection | No tool to detect if a page has active MutationObserver instances watching for DOM changes | Would allow pre-emptive choice of CSS override (MO-resistant) vs DOM removal strategy | New (Phase 91) |
| Script element inspection | No tool to enumerate and read script tag src attributes to identify detection libraries | Would enable automated detection method classification (BlockAdBlock vs FuckAdBlock vs custom) before bypass | New (Phase 91) |
| Bait element measurement | No tool to read offsetHeight/clientHeight of specific elements to determine if adblocker has hidden them | Would allow verification that detection bait elements are triggering (confirming adblocker is active) | New (Phase 91) |

## Dark Pattern Analysis

### Detection Methods Found Per Target

| Target | Detection Method | Library | Confidence | Re-detection Behavior |
|--------|-----------------|---------|------------|----------------------|
| BlockAdBlock.com | Bait element (17 IDs: adBanner, banner_ad, ad_box, etc.) | BlockAdBlock (own library) | HIGH | setInterval re-check every 10 seconds (bab_checkagaindelayseconds=10) |
| Forbes.com | Script load failure (Freestar ad scripts) + bait element (ad-container class, 7 instances) | Custom (Freestar ad platform) | MEDIUM | Unknown from HTTP -- likely JavaScript-side detection on ad script load failure |
| Wired.com | Paywall/journey gate (Conde Nast SDK + LaunchDarkly feature flags) | Custom (Conde Nast journey system) | LOW for adblock-specific | Journey system is primarily subscription/registration gating, may have adblock detection as secondary trigger |
| BusinessInsider.com | Script load failure (googletag, Amazon TAM, Prebid) + ad refresh monitoring | Custom (Google Ad Manager stack) | MEDIUM | 30-second ad refresh interval suggests periodic state monitoring |
| DetectAdBlock.com | Bait script file (lazyad-loader.min.js creates hidden div, script blocked by adblocker filter list) | Custom (lazyad-loader pattern) | HIGH | Single check on page load (no documented re-detection loop) |

### Modal DOM Structure Classification

**BlockAdBlock Block Screen (CANONICAL DARK-05 PATTERN):**
- Container: Full-screen overlay div (position:fixed, z-index:9999+, width:100%, height:100%)
- Backdrop: Integrated with container (single element, configurable background color via bab_warncolor_shim, default "#006" dark blue)
- Body modifications: overflow:hidden added to body element to prevent background scrolling
- Content blocking: Main page content obscured behind the overlay (no separate blur/opacity -- overlay covers entirely)
- Close mechanism: **NONE** -- this is the defining DARK-05 characteristic. The block screen has NO close button, NO dismiss link, NO exit path. The only options presented are "whitelist this site" or "disable your adblocker"
- Delay: Configurable (default 7 seconds after page load before modal appears)
- Behavior modes: 3 options (1=shim/overlay, 2=redirect to pleasedontblockads.org, 3=redirect to custom URL)

**Forbes Overlay Infrastructure (INFERRED FROM CSS):**
- Container: celtra-expanded-ad class with z-index:1001 (ad overlay)
- Backdrop: Separate ha__ribbon sticky element
- Body modifications: body.noScroll class adds overflow-y:hidden (!important), overflow-x:hidden on body default style
- Content blocking: no-overflow class adds overflow:hidden to content areas
- Close mechanism: Unknown from server HTML -- Forbes ad overlays may have close buttons (DARK-04) or may be timed auto-dismiss; adblock-specific modal structure not identifiable from HTTP

**Wired Paywall Modal (HYBRID PAYWALL/ADBLOCK GATE):**
- Container: PaywallModalWrapper-itMFEN styled component (full-screen modal wrapper)
- Backdrop: PaywallBarWrapper-gFBZnd styled component (persistent bottom bar alternative)
- Body modifications: Journey unit container with full width/height flex display
- Content blocking: consumer-marketing-unit journey-unit wraps content gates
- Close mechanism: Unknown -- paywall modals typically have "X" or "Subscribe" options; if triggered by adblock detection, may lack close button

**BusinessInsider Ad Infrastructure (AD MANAGEMENT, NOT ADBLOCK MODAL):**
- Container: Google Ad Manager slots with data-node-id attributes
- Backdrop: Not applicable (inline ad slots, not overlay modals)
- Body modifications: None identified for adblock-specific modal
- Content blocking: Paywall gate (4 references) separate from ad infrastructure
- Close mechanism: aria-label="Close this ad" confirmed in Phase 90 -- this is DARK-04 (camouflaged close), not DARK-05

### Close Button Absence Confirmation (DARK-05 vs DARK-04 Distinction)

| Target | Close Button Present? | Pattern Classification | Evidence |
|--------|----------------------|----------------------|----------|
| BlockAdBlock.com | **NO** -- confirmed NO close button | DARK-05 (adblocker modal, no exit) | Configure page documents "block screen" with zero close/dismiss options. User must whitelist or disable adblocker. This is the canonical DARK-05 implementation. |
| DetectAdBlock.com | **NO** -- no modal at all in tutorial | N/A (tutorial site, not a detection target) | Documents the detection technique, does not itself display a modal |
| Forbes.com | Unknown -- modal is JavaScript-rendered | Likely DARK-04 (ad overlay with delayed close) | Phase 90 confirmed Forbes uses Ketch consent manager with fs-icon--close class. Ad overlays likely have close buttons. |
| Wired.com | Unknown -- paywall modal is JavaScript-rendered | Hybrid (paywall gate, may have close for subscribe prompt) | Paywall modals typically offer subscription options plus close/later; not a pure DARK-05 pattern |
| BusinessInsider.com | **YES** -- aria-label="Close this ad" confirmed | DARK-04 (camouflaged close button) | Phase 90 validated: close-icon-wrapper > close-icon-circle > SVG hierarchy with rollUpTimeout:5000ms delayed appearance |

### Bypass Difficulty Per Target

| Target | Difficulty | Rationale |
|--------|-----------|-----------|
| BlockAdBlock (shim mode) | MEDIUM | Single overlay element removal + body overflow restoration. Re-detection via 10-second setInterval requires either CSS override or clearInterval/variable nullification |
| BlockAdBlock (redirect mode) | HARD | Redirect happens via JavaScript navigation -- must intercept before redirect fires. Only viable approach: inject CSS override or remove detection script before the redirect timer executes |
| Custom bait-div sites | EASY | Simple overlay removal + body restoration. No re-detection loop in most custom implementations. One-shot detection on page load. |
| Forbes (if adblock modal) | MEDIUM | Freestar platform likely has sophisticated detection. body.noScroll + overflow:hidden need restoration. Unknown re-detection behavior. |
| Wired (paywall gate) | HARD | Conde Nast journey system with LaunchDarkly feature flags suggests server-side gating logic. CSS override may hide modal but server may still restrict content access. |

### Re-detection Prevalence

| Detection Library | Re-detection Method | Frequency | Counter-strategy |
|-------------------|-------------------|-----------|-----------------|
| BlockAdBlock | setInterval re-check every 10 seconds | HIGH (built into library) | CSS override (!important on display:none), OR nullify window.blockAdBlock variable, OR clearInterval on re-check timer |
| FuckAdBlock | Similar setInterval pattern (same author as BlockAdBlock) | HIGH (built into library) | CSS override, OR nullify window.fuckAdBlock variable |
| Admiral | MutationObserver on shadow DOM / iframe | HIGH (enterprise grade) | CSS override only -- shadow DOM and cross-origin iframe prevent direct DOM manipulation |
| Custom bait-div | None (single check on page load) | LOW | Simple element.remove() sufficient -- no re-injection mechanism |
| Script load failure | None (async check) | LOW | DOM removal sufficient if modal is simple overlay |

### Content Accessibility Behind Modal

For all targets tested, page content loads in the DOM BEFORE the detection script triggers the modal:
- Forbes: Full article text rendered in server HTML (765KB), accessible via DOM queries behind any overlay
- Wired: Full homepage content rendered (1.4MB) including article excerpts, links, and navigation
- BusinessInsider: Full homepage content rendered (536KB) with article previews and navigation
- BlockAdBlock.com: Site content (41KB) fully accessible -- the block screen is an overlay OVER loaded content

This means the "behind-overlay content extraction" fallback (Fallback 5 in adblocker-bypass.js) is viable: even if the modal cannot be dismissed, execute_js can read textContent from content elements behind the overlay.

### Recommendations for DOM-only Bypass Without Browser Extension Modification

1. **CSS override as primary strategy (not DOM removal):** For sites using BlockAdBlock or similar libraries with setInterval re-checking, CSS override via injected style tag is more reliable than element.remove() because (a) the element stays in DOM satisfying existence checks, (b) !important overrides inline styles, (c) MutationObserver typically watches childList mutations not attribute/style changes
2. **Variable nullification as secondary strategy:** After CSS override, nullify detection library variables (window.blockAdBlock = undefined, window.fuckAdBlock = undefined) to prevent the library from re-triggering on next interval check
3. **Content extraction as last resort:** If bypass fails entirely, extract page content from behind the overlay via execute_js reading textContent of main/article/#content elements
4. **Never attempt DOM removal first on unknown sites:** Always check for re-detection before committing to element.remove(). A failed removal that triggers re-injection wastes iterations.

## Bugs Fixed In-Phase

None -- no code changes required for this diagnostic phase. All findings are observational from HTTP validation against live targets.

## Autopilot Recommendations

1. **Always use get_dom_snapshot first to detect full-screen overlay elements:** When navigating to a news or content site, immediately check for position:fixed elements with z-index greater than 1000 that contain text matching "adblock", "ad blocker", "whitelist", "disable", "turn off", or "support us by". Match against modalContainer.byClass and modalContainer.byRole selectors from adblocker-bypass.js. If detected, enter the bypassAdblockerModal workflow before attempting any other page interaction.

2. **Immediately confirm NO close button exists (DARK-05 distinction from DARK-04):** After detecting a potential adblocker modal, scan its DOM subtree for ANY close/dismiss elements: aria-label containing "close"/"dismiss"/"exit", class/id containing "close"/"dismiss", text content with "X" or unicode cross symbols, SVG close icons, buttons/links with "Close"/"Skip"/"Not now" text. If a close element IS found, this is DARK-04 (camouflaged close) -- redirect to the camouflaged-close.js workflow. DARK-05 specifically means zero close mechanism.

3. **Identify the detection method to predict re-detection behavior:** Check for: (a) bait elements with ad-related classes (class="ad-banner", class="adsbox", id="ad-container") that have zero height -- indicates bait element technique, (b) blocked script tags with src containing "adsbygoogle", "pagead", "doubleclick" -- indicates script load failure detection, (c) window.blockAdBlock or window.fuckAdBlock global variables -- indicates library-based detection with periodic re-checking. Library-based detection (BlockAdBlock, FuckAdBlock) uses setInterval re-checks and WILL re-inject the modal after DOM removal.

4. **Use CSS override as PRIMARY bypass strategy, not DOM removal:** Inject a style tag via execute_js with: `[modal-selector] { display: none !important; } body, html { overflow: auto !important; position: static !important; } [content-selector] { filter: none !important; opacity: 1 !important; pointer-events: auto !important; user-select: auto !important; }`. CSS override is MutationObserver-resistant (observers watch childList changes, not style changes) and keeps the modal element in DOM (satisfying library existence checks).

5. **Always restore body scroll after modal bypass:** The detection script adds overflow:hidden (and sometimes position:fixed) to body/html. After hiding/removing the modal, ALWAYS execute: `document.body.style.overflow = 'auto'; document.documentElement.style.overflow = 'auto'; document.body.style.position = '';` plus remove blocking classes: `document.body.classList.remove('no-scroll', 'modal-open', 'locked', 'adblock-active', 'noScroll');`. Forbes uses body.noScroll, other sites use body.modal-open or body.locked.

6. **Monitor for re-detection after bypass:** Wait 2-3 seconds after initial bypass and re-check with get_dom_snapshot for modal reappearance. BlockAdBlock re-checks every 10 seconds (bab_checkagaindelayseconds). If the modal reappears: (a) switch from DOM removal to CSS override if not already used, (b) nullify detection variables: `window.blockAdBlock = undefined; window.fuckAdBlock = undefined; window.detectAdBlock = undefined;`, (c) remove detection script elements from DOM to stop the re-check loop.

7. **CSS override as fallback when DOM removal triggers re-detection:** If element.remove() causes the modal to reappear within seconds, the site uses MutationObserver-based re-injection. Switch to CSS override: inject a style tag that hides the modal with display:none !important. The modal element stays in DOM but is invisible. The observer's childList watcher does not fire for style changes, so the re-injection callback is not triggered.

8. **Extract content from behind overlay as last resort:** Page content is always loaded in the DOM before the adblocker detection modal appears (content loads first, then detection script runs after a delay -- BlockAdBlock default is 7 seconds). Even if the modal cannot be dismissed, use execute_js to read document.querySelector('main, article, #content, .content').textContent to extract the article text from behind the overlay. This does not dismiss the modal but provides the content the user was trying to access.

9. **Avoid wasting iterations searching for a close button that does not exist:** The defining characteristic of DARK-05 is the ABSENCE of any close mechanism. If the initial get_dom_snapshot shows a full-screen overlay with adblocker-related text and NO aria-label="close", NO class*="close", NO "X" text, NO SVG close icon -- stop searching immediately and proceed to DOM manipulation bypass. Spending additional iterations scanning for hidden close buttons is wasted effort on a DARK-05 modal.

10. **Test bypass verification with read_page to confirm content accessibility:** After the bypass sequence (CSS override + body scroll restoration + content unblocking), use read_page to extract article text. If read_page returns substantive article content (not just "disable your adblocker" text), the bypass succeeded. If read_page still returns only modal text, the bypass failed -- try the next fallback strategy (Google Cache, behind-overlay extraction).

## Selector Accuracy

| Selector | Expected | Actual | Match | Notes |
|----------|----------|--------|-------|-------|
| modalContainer.byClass (`div[class*="adblock"]`, etc.) | Match on adblocker modal containers | 0 matches on Forbes, Wired, BI, BAB server HTML | NO | Adblocker modals are 100% JavaScript-rendered. These selectors are correct for live browser DOM but return 0 in server HTML because the modal only exists after detection script runs. Valid for live get_dom_snapshot. |
| modalContainer.generic (`.modal`, `.overlay`, `[class*="modal"]`) | Match on generic modal/overlay elements | Wired: 50 matches, BI: 6 matches, Forbes: 0, BAB: 0 | PARTIAL | Generic modal/overlay classes exist for paywall and UI modals on Wired and BI. Not specific to adblocker modals. High false-positive risk on content sites. |
| bodyScrollLock.bodyClass (`body.no-scroll`, `body.modal-open`, etc.) | Match on scroll lock patterns in CSS | Forbes: 6 (noScroll), Wired: 8 (various) | YES | Forbes body.noScroll class confirmed in CSS rules. Wired has multiple scroll lock references. These selectors correctly identify scroll lock infrastructure. NOTE: Forbes uses "noScroll" not "no-scroll" -- selector should include both variants. |
| detectionLibrary.blockAdBlock (`#blockadblock`, `.blockadblock`) | Match on BlockAdBlock library elements | BAB site: 49 matches, Forbes/Wired/BI: 0 | PARTIAL | BlockAdBlock references found only on blockadblock.com itself. No production news sites in our sample use BlockAdBlock. Library is used by smaller publishers (11,000+ per BAB claims). |
| detectionLibrary.baitElement (`.ad-banner`, `.adsbox`, `#ad-container`, etc.) | Match on adblocker bait elements | Forbes: 7 (ad-container class), BI: 1 | PARTIAL | Forbes has "ad-container" class elements -- these are actual ad slot containers that adblockers would target. They function as natural bait elements since adblockers hide them, triggering detection. |
| adblockMessage.text (generic text element selector) | Match on elements with adblock-related text | BAB: 88, DAB: 52, Forbes: 4, Wired: 6 | YES | Text content mentioning adblock/whitelist/disable found across all targets. The generic selector (div, p, h1-h3, span) casts too wide; needs to be combined with text content filtering in the workflow. |

## New Tools Added This Phase

| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| bypassAdblockerModal workflow | site-guides/utilities/adblocker-bypass.js | 8-step workflow for detecting and bypassing DARK-05 adblocker modals with no close button using DOM removal, CSS override, body restoration, re-detection neutralization, and fallback strategies | N/A (workflow steps, not MCP tool) |

No new MCP tools were added this phase. The adblocker-bypass.js site guide was created in Plan 01 with the bypassAdblockerModal 8-step workflow, comprehensive selectors (modalContainer, modalBackdrop, bodyScrollLock, contentBlocking, detectionLibrary, adblockMessage), 4 detection library patterns (BlockAdBlock, FuckAdBlock, Admiral, custom bait-div), DOM removal and CSS override bypass strategies, 5 fallback strategies (Escape, Google Cache, URL parameter, Reader Mode, behind-overlay extraction), and 5 warnings for autopilot behavior. The diagnostic testing in Plan 02 validated these patterns against 5 live targets via HTTP analysis.
