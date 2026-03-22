# Autopilot Diagnostic Report: Phase 87 - Freeware Download Ad Avoidance

## Metadata
- Phase: 87
- Requirement: DARK-01
- Date: 2026-03-22
- Outcome: PARTIAL (SourceForge VLC project page fully accessible via HTTP 200, 105,416 bytes. Real download button identified: `a.button.download.big-text.green` with href `/projects/vlc/files/latest/download` inside `div.download-container` -- confirmed same-site domain, NOT inside iframe, NO ad-related parent containers, NO data-ad-* attributes. 6 server-rendered DoubleClick ad redirect chains found in `data-dest` attributes pointing to `ad.doubleclick.net/ddm/trackclk/`. 4 iframes found (2 YouTube embeds, 2 sf-syn conversion trackers -- zero ad network iframes). Retool sponsored banner with `vibe-banner-link` and `vibe-coding-bar` IDs identified as server-side ad placement. 13 "See Software" comparison links identified as partner promotion. Real download link correctly distinguished from all ad elements via href domain verification and parent container analysis. Full downloadRealFile workflow designed and documented but live click execution blocked by WebSocket bridge disconnect. MCP server running on port 7225 returns HTTP 426 "Upgrade Required", same persistent blocker as Phases 55-86.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch. Same persistent blocker as Phases 55-86.)

## Prompt Executed
"Navigate to a freeware download site (SourceForge), find the download page for a popular program (VLC), identify the real download link while ignoring all fake 'Download Now' ad buttons, and click only the real download link to initiate the download."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-86). HTTP-based validation was performed against SourceForge VLC project page and 3 fallback sites. The primary target sourceforge.net/projects/vlc/ is fully server-rendered (HTTP 200, 105,416 bytes) with one real download button (`a.button.download.big-text.green[href="/projects/vlc/files/latest/download"]`) inside `div.download-container`. The real download button was correctly identified via elimination: href points to sourceforge.net domain (same-site), element is NOT inside any iframe, parent container is `download-container` (not ad-related), no data-ad-* attributes present. Server-rendered ad elements found: 6 DoubleClick redirect chains in `data-dest` attributes, 1 Retool sponsored banner (`vibe-banner-link`, `vibe-coding-bar`), 13 partner "See Software" comparison links, 2 sf-syn conversion tracker iframes, and Google Tag Manager + DFP Audience Pixel scripts. Notably, SourceForge's current design has ZERO ad iframes with traditional ad network domains (googleads, doubleclick, adsrvr) in iframe src -- the ads are served through server-side `data-dest` redirect chains and JavaScript-injected placements rather than traditional iframe-based ads.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1a | navigate | https://sourceforge.net/projects/vlc/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 105,416 bytes) | VLC project page loads successfully. Title: "VLC media player download - SourceForge.net". Server-rendered HTML with project metadata, download button, partner ads, and comparison links. |
| 1b | navigate | https://sourceforge.net/projects/vlc/files/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 283,815 bytes) | VLC files listing page. Title: "VLC media player - Browse Files at SourceForge.net". Contains file directory with 2 download-related hrefs and 2 sf-syn conversion tracker iframes. Zero ad containers (data-ad-*, gpt-ad, adsbygoogle). |
| 1c | navigate | https://sourceforge.net/projects/vlc/files/latest/download | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 30,533,688 bytes -- direct binary) | The /latest/download URL resolves directly to the binary file (vlc-2.2.4-win32.exe, 30.5 MB) via cfhcable.dl.sourceforge.net CDN mirror. This URL is the real download link target -- following it initiates the actual file download with no intermediate ad page. |
| 2a | get_dom_snapshot | sourceforge.net/projects/vlc/ (all download-like elements) | NOT EXECUTED (MCP) / ANALYZED via HTTP | Extracted all elements containing "download" in text, href, or class from the 105KB HTML. Found: (a) 1 real download button: `a.button.download.big-text.green[href="/projects/vlc/files/latest/download"]` with title "Download vlc-2.2.4-win32.exe from SourceForge - 30.5 MB", (b) 1 downloads stats link: `a[href="/projects/vlc/files/stats/timeline"]` with title "Downloads This Week", (c) 1 addons download link: `a[href="http://addons.videolan.org/..."]` with text "Download" (links to VideoLAN addons, external but legitimate). Total: 3 download-text elements, of which 1 is the real download button. |
| 2b | (analysis) | Categorize download-like elements | COMPLETED | Element 1 (real download button): REAL DOWNLOAD -- href `/projects/vlc/files/latest/download` points to sourceforge.net domain. Element 2 (stats link): NOT A DOWNLOAD -- links to download statistics page, not a file. Element 3 (addons link): LEGITIMATE EXTERNAL -- links to addons.videolan.org, the official VLC addons site, not an ad. Zero fake ad download buttons found in server-rendered HTML. |
| 3a | get_dom_snapshot | sourceforge.net/projects/vlc/ (all iframe elements) | NOT EXECUTED (MCP) / ANALYZED via HTTP | Found 4 iframe elements total: (a) 2x `iframe[src="//www.youtube-nocookie.com/embed/N3fOEd0oWb8?rel=0"]` -- YouTube video embeds (privacy-enhanced mode), NOT ad iframes, (b) 2x `iframe[src="https://c.sf-syn.com/conversion_outbound_tracker/sf"]` -- SourceForge conversion tracking iframes (sf-syn.com domain, hidden via `display:none`). These are analytics/conversion trackers, not visual ad iframes. |
| 3b | (analysis) | Check iframe sources for ad network domains | COMPLETED | Zero iframes with traditional ad network domains (googleadservices.com, doubleclick.net, adsrvr.org, taboola.com, outbrain.com, pagead2.googlesyndication.com) found. The sf-syn.com iframes are SourceForge's own conversion tracking system. SourceForge does NOT use iframe-based ad injection on this page -- ads are served through server-side data-dest redirect chains and JavaScript placement instead. |
| 4a | get_attribute | Real download button href verification | NOT EXECUTED (MCP) / ANALYZED via HTTP | Extracted href from the real download button: `/projects/vlc/files/latest/download`. This is a relative URL on sourceforge.net domain. Full resolution: `https://sourceforge.net/projects/vlc/files/latest/download`. The title attribute confirms: "Download vlc-2.2.4-win32.exe from SourceForge - 30.5 MB". Button class: `button download big-text green`. Parent container: `div.download-container`. The download button contains an `img.sf-download-icon` (SourceForge logo) and text "Download". |
| 4b | get_attribute | Check real download link is NOT in iframe | CONFIRMED SAFE | The real download button at `div.download-container > a.button.download.big-text.green` is in the main document DOM at line 595 of the HTML. The nearest iframes are the YouTube embed and sf-syn trackers, which are in separate DOM branches. The download button is NOT inside any iframe element. |
| 4c | get_attribute | Check parent container for ad markers | CONFIRMED SAFE | Parent container is `div.download-container` -- the class name "download-container" contains NO ad-related keywords (ad, advert, sponsored, promoted, banner, gpt-ad, dfp, leaderboard, skyscraper, mpu, billboard). This is a legitimate content container. The next parent up is the project info section, also not ad-related. |
| 5a | (analysis) | Server-rendered ad elements on project page | COMPLETED | Found 6 `data-dest` attributes containing DoubleClick tracking redirect chains: `https://sourceforge.net/software/link?oaparams=2__bannerid=91055__zoneid=88463__cb=7c671bd80d__oadest=https%3A%2F%2Fad.doubleclick.net%2Fddm%2Ftrackclk%2F...`. These are SourceForge partner promotion links that redirect through DoubleClick for tracking. They appear in the partner/comparison section, NOT near the download button. |
| 5b | (analysis) | Retool sponsored banner | IDENTIFIED AS AD | `div#vibe-banner-link` and `div#vibe-coding-bar` contain a Retool advertisement with logo image (`retool.png`), input field, and CTA button. The `data-url` attribute contains `utm_content=homepage_ad` confirming it is a paid advertisement. The element has id `vibe-send-btn` and redirects to `login.retool.com/auth/signup`. This is NOT a download button -- it is a text input for Retool's AI app builder. |
| 5c | (analysis) | "See Software" comparison links | IDENTIFIED AS PARTNER PROMOTION | 13 links with class `button blue hollow see-project` and href pattern `/software/product/*/`. These link to SourceForge software comparison pages for competing products (X-Player, nPlayer Lite, 3Q, MPlayer, Kaffeine, etc.). They are affiliate/comparison links, NOT fake download buttons. They say "See Software" not "Download". |
| 5d | (analysis) | Google Tag Manager / DFP infrastructure | IDENTIFIED AS AD TECH | `bizx.cmp.embedScript("https://www.googletagmanager.com/gtag/js")` and `pagead2.googlesyndication.com/pagead/js/pcd.js` scripts loaded conditionally via SourceForge's CMP (Consent Management Platform). DFPAudiencePixel reference found for retargeting. These are JavaScript ad serving infrastructure but do NOT produce visible fake download buttons in the server-rendered HTML -- they inject ads client-side after JavaScript execution. |
| 6a | navigate | https://filehippo.com/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 131,948 bytes) | FileHippo homepage accessible. 33 download-related links found. 1 iframe (Google Tag Manager noscript container). 0 ad-class containers in server HTML. External ad infrastructure: securepubads.g.doubleclick.net preconnect link, ep2.adtrafficquality.google preconnect link. Owned by Softonic (hello.softonic.com legal links). |
| 6b | navigate | https://www.fosshub.com/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 123,474 bytes) | FossHub homepage accessible. 0 download-related links in server HTML (title shows "Logo" suggesting client-rendered React/Vue SPA). 0 iframes. Cleanest of all fallback targets. |
| 6c | navigate | https://www.majorgeeks.com/ | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 68,029 bytes) | MajorGeeks homepage accessible. 5 download-related links found. 0 iframes. 0 ad-class containers. Notable: CCleaner and Avast links with `utm_medium=partner&utm_source=majorgeek` tracking parameters -- these are paid partner placements, not organic download links. |
| 7a | click | Real download button | NOT EXECUTED (MCP) | Would click `a.button.download.big-text.green[href="/projects/vlc/files/latest/download"]` after all verification steps pass. Expected: browser navigates to download URL, which resolves to cfhcable.dl.sourceforge.net/project/vlc/2.2.4/win32/vlc-2.2.4-win32.exe and initiates file download. |
| 7b | read_page | Post-click verification | NOT EXECUTED (MCP) | Would verify the post-click page shows a download countdown/confirmation ("Your download will begin shortly") rather than an ad landing page. For the /latest/download URL, SourceForge typically shows a thank-you page with the auto-download starting after a few seconds countdown. |

## What Worked
- SourceForge VLC project page (sourceforge.net/projects/vlc/) is fully server-rendered with the real download button visible in the initial HTTP response (105,416 bytes) -- no JavaScript execution required to see the download button
- Real download button correctly identified via elimination: `a.button.download.big-text.green[href="/projects/vlc/files/latest/download"]` inside `div.download-container` -- only 1 download-action link on the entire page, unambiguous after ad elimination
- Href domain verification confirmed: `/projects/vlc/files/latest/download` is a relative same-site URL on sourceforge.net domain, resolving to the CDN mirror `cfhcable.dl.sourceforge.net` -- passes Indicator 6 (domain match) verification
- Iframe analysis completed: 4 iframes found, zero with ad network domains -- 2 YouTube embeds and 2 sf-syn conversion trackers. Indicator 2 (iframe wrapper) check found no fake download buttons in iframes
- Parent container analysis confirmed: `div.download-container` contains no ad-related keywords -- passes Indicator 8 (parent container markers) check
- No data-ad-* attributes found on the real download button or its ancestors -- passes Indicator 4 check
- No tracking redirect patterns in the real download button href -- passes Indicator 5 check
- Server-rendered ad elements successfully identified: 6 DoubleClick data-dest redirect chains, 1 Retool sponsored banner (vibe-banner-link), 13 "See Software" partner comparison links, Google Tag Manager + DFP audience pixel scripts
- All fallback sites accessible: FileHippo (HTTP 200, 131,948 bytes), FossHub (HTTP 200, 123,474 bytes), MajorGeeks (HTTP 200, 68,029 bytes)
- MajorGeeks partner links correctly identified as paid placements via utm tracking parameters (utm_medium=partner&utm_source=majorgeek)
- Download button title attribute provides confirmation: "Download vlc-2.2.4-win32.exe from SourceForge - 30.5 MB" -- includes filename, source, and file size
- MCP server process confirmed running on port 7225 (HTTP 426 response, consistent with Phases 55-86)

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected (HTTP 426). This is the same persistent blocker from Phases 55-86. Without the bridge, no MCP tool (navigate, get_dom_snapshot, get_attribute, click, read_page) can execute against the live browser. The full downloadRealFile workflow (navigate, snapshot all download elements, apply 8 heuristics, identify real link, verify before click, click, verify download) requires live browser MCP execution.
- **Client-side ad injection not testable via HTTP:** SourceForge loads Google Tag Manager (`googletagmanager.com/gtag/js`) and Google Syndication (`pagead2.googlesyndication.com/pagead/js/pcd.js`) scripts via its CMP framework (`bizx.cmp.embedScript`). These scripts inject additional ad elements after JavaScript execution that are NOT present in the server-rendered HTML. The HTTP fetch captures only server-rendered ads (data-dest redirect chains, vibe-banner, partner links), missing any JavaScript-injected display ads, interstitials, or overlay download buttons that may appear in a live browser.
- **Zero traditional fake download buttons found in server HTML:** The SourceForge VLC project page's server-rendered HTML contains NO traditional iframe-based fake "Download Now" ad buttons. This is a significant finding -- either (a) SourceForge has cleaned up its ad-heavy layout compared to its historical reputation, (b) fake download buttons are now 100% client-side JavaScript injected (not visible in server HTML), or (c) the specific VLC project page (high-traffic, established) receives less aggressive ad placement than lesser-known projects. Without live browser testing, we cannot distinguish between these possibilities.
- **VLC files page (/files/) has no visible ad containers:** The 283KB files listing page contains zero data-ad-* attributes, zero gpt-ad IDs, zero adsbygoogle elements. Only 2 sf-syn conversion tracker iframes. This makes the ad detection heuristics untestable on the files page via HTTP.
- **FossHub is a client-rendered SPA:** FossHub homepage returns 123KB HTML but the title tag shows "Logo" instead of a proper page title, suggesting the content is client-rendered (React/Vue/Angular SPA). Download links and ad elements are not present in the server HTML.
- **Download confirmation page not verified:** The post-click page state (download countdown, "your download will begin shortly" text) cannot be verified without live MCP click execution. The /latest/download URL directly serves the binary file (30.5 MB) via CDN, so there may be no intermediate confirmation page for this specific URL path.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-87):** The MCP server process runs on port 7225 but the Chrome extension side returns HTTP 426 "Upgrade Required" for browser action dispatch. This has blocked every live MCP test since Phase 55. The full DARK-01 workflow requires: navigate to project page, get_dom_snapshot for all download-like elements, get_attribute on each element href for domain verification, get_dom_snapshot to check iframe ancestry, read parent container classes, click verified real download link, read_page for post-click confirmation -- 7+ MCP tool invocations with DOM analysis.
- **No iframe content inspection tool:** The existing get_dom_snapshot captures the main document DOM but cannot inspect content INSIDE iframes. For ad detection, the iframe boundary itself is the signal (Indicator 2), but a dedicated `get_iframe_content(selector)` tool would allow checking whether an iframe contains fake download buttons -- useful when ads are injected into same-origin iframes rather than cross-origin ad network iframes.
- **No ancestor chain scanning tool:** Indicator 8 (parent container markers) requires checking the element's parent chain for ad-related class names. The existing get_attribute tool can check a single element's attributes, but scanning up the ancestor chain (parent, grandparent, great-grandparent) requires multiple sequential get_attribute calls with progressively broader selectors. A `get_ancestor_classes(selector, depth)` tool would enable single-call ancestor chain scanning for ad markers.
- **No pre-click URL resolution tool:** The real download button's href `/projects/vlc/files/latest/download` resolves through a CDN redirect to `cfhcable.dl.sourceforge.net/...`. For suspicious links, a `resolve_url(href)` tool that follows redirects and returns the final destination URL (without executing the navigation in the browser) would enable pre-click verification of redirect chains -- catching tracking redirects (Indicator 5) that may not be visible in the initial href value.
- **No JavaScript-injected ad detection:** Server-rendered HTML analysis misses ads injected by JavaScript after page load (Google AdSense, DFP, programmatic display). A `wait_for_ads_loaded()` tool that waits for ad scripts to finish injecting their elements (monitoring DOM mutations from ad-related scripts) would provide a complete picture of all ad elements on the page, including JavaScript-injected fake download buttons.
- **WebSocket bridge disconnect (persistent, Phases 55-87):** Same root cause as all previous phases. MCP server runs, returns HTTP 426 for non-WebSocket requests. The Chrome extension WebSocket client cannot establish or maintain the connection. This blocks all live browser interaction testing.

## Dark Pattern Analysis

### Download-Like Element Census

On the SourceForge VLC project page (sourceforge.net/projects/vlc/, 105,416 bytes server HTML):

| Category | Count | Elements |
|----------|-------|----------|
| Real download links | 1 | `a.button.download.big-text.green[href="/projects/vlc/files/latest/download"]` in `div.download-container` |
| Download stats links (not downloads) | 1 | `a[href="/projects/vlc/files/stats/timeline"]` titled "Downloads This Week" |
| Legitimate external download links | 1 | `a[href="http://addons.videolan.org/..."]` text "Download" for VLC addons |
| DoubleClick redirect chains (server ads) | 6 | `data-dest` attributes containing `ad.doubleclick.net/ddm/trackclk/` URLs in partner section |
| Sponsored banner (Retool) | 1 | `div#vibe-banner-link` with `div#vibe-coding-bar` containing Retool logo and CTA |
| Partner comparison links | 13 | `a.button.blue.hollow.see-project[href="/software/product/*/"]` for competing software |
| Conversion tracker iframes | 2 | `iframe[src="https://c.sf-syn.com/conversion_outbound_tracker/sf"]` (hidden) |
| YouTube embed iframes | 2 | `iframe[src="//www.youtube-nocookie.com/embed/..."]` |
| Traditional fake "Download" ad buttons | 0 | None found in server-rendered HTML |
| **Total download-like elements** | **3** | 1 real + 1 stats link + 1 addons link |
| **Total ad/promotional elements** | **22** | 6 doubleclick + 1 retool + 13 partner + 2 tracker iframes |

### Fake Download Button Assessment

**Critical finding:** The SourceForge VLC project page contains ZERO traditional fake "Download Now" ad buttons in its server-rendered HTML. The historical reputation of SourceForge for deceptive download ads (circa 2015-2018, when SourceForge wrapped downloads in bundleware installers) appears to have been significantly cleaned up. The current page (2026) shows:

- **Real download button is unambiguous in server HTML:** Only 1 element with download-action semantics (class `button download big-text green`, text "Download", href to `/files/latest/download`)
- **Ad elements are NOT disguised as download buttons:** The 6 DoubleClick chains are in `data-dest` attributes (not visible links), the Retool banner is a code/AI tool promotion (not a download button), and the 13 partner links say "See Software" (not "Download")
- **The dark pattern threat has shifted from server-side to client-side:** Modern SourceForge relies on JavaScript-injected ads (Google AdSense via `pagead2.googlesyndication.com`, DFP via `googletagmanager.com`) that are NOT present in the server HTML. Fake download buttons, if they exist, are injected by ad scripts AFTER page load

### Ad Detection Heuristic Effectiveness

| Rank | Heuristic | Fake Buttons Caught (Server HTML) | Assessment |
|------|-----------|-----------------------------------|------------|
| 1 | Indicator 6: Domain mismatch | 6 (DoubleClick data-dest links) + 2 (partner utm links on MajorGeeks) | Most effective for server-rendered ads. DoubleClick redirect chains caught by domain mismatch between sourceforge.net and ad.doubleclick.net |
| 2 | Indicator 8: Parent container markers | 1 (Retool vibe-banner-link) + 13 (partner see-project links in partners section) | The `vibe-banner-link` and `partners` container IDs are identifiable as ad/promotion containers. However, these do not use standard ad marker keywords (no "ad-" or "sponsored" in class) |
| 3 | Indicator 5: Tracking redirects | 6 (data-dest DoubleClick URLs contain /ddm/trackclk/) + 2 (MajorGeeks CCleaner/Avast utm_medium=partner) | Tracking URL patterns effectively identified DoubleClick redirect chains and MajorGeeks partner placements |
| 4 | Indicator 2: Iframe wrapper | 0 fake download buttons (4 iframes found: 2 YouTube, 2 sf-syn trackers) | No iframe-based fake download buttons on current SourceForge. Heuristic remains valid conceptually but SourceForge has moved away from iframe-based ads |
| 5 | Indicator 1: Ad domains in href | 0 (no direct links to googleadservices.com, doubleclick.net, etc.) | Ad domains appear in data-dest attributes and script srcs, NOT in visible link hrefs. Heuristic catches nothing in server HTML because ads are injected client-side |
| 6 | Indicator 3: Ad CSS classes | 0 (no elements with "advert", "sponsored", "promoted", "banner-ad" class names) | SourceForge uses custom class names (vibe-banner, mdb-sticky, see-project) instead of standard ad class patterns. Heuristic is ineffective on this site |
| 7 | Indicator 4: data-ad-* attributes | 0 (zero data-ad-slot, data-ad-client, data-ad-format, data-google-query-id) | No Google AdSense data attributes in server HTML. These attributes are injected by JavaScript after page load |
| 8 | Indicator 7: aria-label/title with ad keywords | 1 (title="Advertise" on a single link) | Only 1 element found with ad-keyword in title/aria-label, and it is a navigation link to SourceForge's advertising page, not a fake download button |

### False Positive Rate
**0% false positives.** No real download links were incorrectly flagged as ads. The real download button (`a.button.download.big-text.green`) passed all 8 heuristic checks cleanly: same-site href, not in iframe, no ad parent containers, no data-ad attributes, no tracking redirects, sourceforge.net domain, no ad aria labels, download-container parent.

### False Negative Rate
**Indeterminate for client-side ads.** Zero traditional fake download buttons were found in server HTML, which means either (a) there are no fake download buttons at all (false negative rate = 0%), or (b) fake download buttons are 100% JavaScript-injected and invisible to HTTP analysis (false negative rate = unknown, potentially high). Given SourceForge's ad infrastructure (Google Tag Manager, DFP Audience Pixel, pagead2.googlesyndication.com scripts), client-side ad injection is likely. The heuristics cannot be fully evaluated without live browser DOM access.

### Server-Rendered vs Client-Rendered Ads

| Ad Type | Server-Rendered (HTTP visible) | Client-Rendered (JavaScript-injected) |
|---------|-------------------------------|--------------------------------------|
| DoubleClick redirect chains | YES (6x data-dest attributes) | Unknown additional placements |
| Retool sponsored banner | YES (vibe-banner-link, vibe-coding-bar) | Unknown additional banners |
| Partner comparison links | YES (13x see-project buttons) | Unknown |
| Google AdSense display ads | NO | LIKELY (pagead2.googlesyndication.com/pagead/js/pcd.js loaded via bizx.cmp) |
| DFP programmatic ads | NO | LIKELY (DFPAudiencePixel reference, googletagmanager.com/gtag/js loaded) |
| iframe-based ad buttons | NO (0 ad iframes in server HTML) | POSSIBLE (ad scripts may inject iframes dynamically) |

**Key insight:** SourceForge uses a hybrid ad model. Server-rendered ads are relatively benign (partner promotions, sponsored banner) and do NOT mimic download buttons. The potentially deceptive ads (fake "Download Now" buttons) are likely JavaScript-injected by Google AdSense/DFP after page load, meaning they are invisible to HTTP-based analysis and require live browser DOM access to detect and test.

### DOM-Only Detection Effectiveness

For the server-rendered portion of the page, DOM-only ad detection (without vision) is **highly effective**:
- The real download button has unique, identifiable attributes (class `button download big-text green`, parent `download-container`, href on sourceforge.net domain)
- All server-rendered ad elements are structurally distinguishable (data-dest attributes, vibe-banner IDs, see-project classes)
- No false positives or ambiguous elements in server HTML

For the full page (with JavaScript-injected ads), DOM-only detection effectiveness is **uncertain** -- the heuristics are designed for the types of ads Google AdSense injects (iframes, data-ad-* attributes, ad class names), but without live browser testing, their effectiveness against SourceForge's specific ad implementation cannot be verified.

## Bugs Fixed In-Phase
None -- no code bugs encountered during HTTP-based validation. The freeware-download.js site guide selectors are structurally correct for the patterns they target, though SourceForge's current ad implementation differs from the expected pattern (see Dark Pattern Analysis above).

## Autopilot Recommendations

1. **Always use get_attribute to check href BEFORE clicking any download button.** The real download button href (`/projects/vlc/files/latest/download`) is a same-site relative URL. Any download-like button with an href pointing to an external domain (especially ad.doubleclick.net, googleadservices.com, or any domain not matching the current site) must be rejected. This is the single most reliable discrimination signal.

2. **Iframe elimination: any download button inside an iframe is an ad -- never click iframe content for downloads.** While the current SourceForge VLC page has zero ad iframes in server HTML, JavaScript-injected iframes are still the most common vehicle for fake download buttons across freeware sites. After page load stabilizes, re-scan for iframes injected by ad scripts and exclude any download-like elements within them.

3. **Href domain verification: build a trusted domain set per site and reject all others.** For SourceForge, the trusted set is: `sourceforge.net`, `downloads.sourceforge.net`, `*.dl.sourceforge.net` (CDN mirrors like cfhcable.dl.sourceforge.net). For FileHippo: `filehippo.com`. For MajorGeeks: `majorgeeks.com`. Any download button href outside the trusted set is suspicious.

4. **CSS class scanning: scan parent chain up to 3 levels for ad-related class names before clicking.** However, be aware that modern sites like SourceForge use custom ad container names (`vibe-banner-link`, `mdb-sticky`, `nels`) that do NOT match standard ad class patterns (`ad-`, `advert`, `sponsored`). Supplement standard class pattern matching with site-specific container ID recognition.

5. **Multi-page awareness: freeware sites often have 2-3 pages before actual download.** SourceForge has: project page (`/projects/vlc/`) -> files page (`/projects/vlc/files/`) -> download page (`/files/latest/download`). Each page transition may introduce fresh ad injections. Re-run the full ad detection heuristic sweep after every page navigation, not just on the initial page load.

6. **Fallback to direct URL: if ad detection is uncertain, construct the direct download URL from the project name pattern.** For SourceForge: `https://sourceforge.net/projects/{PROJECT}/files/latest/download`. This URL bypasses all intermediate pages and resolves directly to the CDN binary download. Use this as a fallback when the page has too many ambiguous download-like elements.

7. **Download confirmation detection: after clicking, verify the next page is a download countdown, NOT an ad landing page.** Check for text patterns: "your download will begin", "download starting", "thank you for downloading", "if your download doesn't start". If the post-click page contains ad landing page indicators (product signup forms, unrelated product descriptions, app store redirects), the wrong button was clicked -- navigate back and try again.

8. **Never click the first/largest "Download" button by default -- this is exactly what dark patterns exploit.** Always apply the full elimination pipeline (8 heuristics) before clicking. The most prominent, largest, or first-rendered download button is statistically more likely to be an ad on freeware sites, because ad networks pay for premium placement positions.

9. **If multiple real-looking candidates remain after elimination, prefer the one hosted on the site's own domain over any external CDN.** For SourceForge, prefer `sourceforge.net/projects/*/files/latest/download` over `downloads.sourceforge.net/*` or `*.dl.sourceforge.net/*`. The site's own domain URL typically goes through the proper download flow (verification, mirror selection), while CDN URLs may be direct file links that bypass important intermediate pages.

10. **Log every rejected candidate with the reason for debugging false positives.** When the elimination pipeline rejects a download-like element, record: element selector, href value, rejection reason (which heuristic triggered), and parent container context. This log enables post-hoc analysis of false positive rates and heuristic tuning across different freeware sites. Store in the diagnostic report's Step-by-Step Log.

## Selector Accuracy
| Selector (from freeware-download.js) | Expected | Actual (HTTP) | Match |
|---------------------------------------|----------|---------------|-------|
| sourceforge.realDownloadButton: `a.button.green[href*="/download"]` | 1 real download button | 0 matches (class is `button download big-text green`, not `button green`) | PARTIAL -- class mismatch; `a.button.green` does not match `a.button.download.big-text.green` because `.button.green` targets exact class tokens while actual has 4 classes |
| sourceforge.realDownloadButton: `a[href*="/files/latest/download"]` | 1 real download button | 1 match: `a[href="/projects/vlc/files/latest/download"]` | MATCH |
| sourceforge.projectTitle: `.project-info h1, #project-title` | 1 project title | 0 matches in grep (title may use different structure or h1 class) | NO MATCH -- SourceForge uses different title markup |
| sourceforge.fileList: `#files_list a` | File listing links | 0 matches on project page (files_list is on /files/ page) | N/A -- correct page scope |
| sourceforge.adIframes: `iframe[src*="googleads"], iframe[src*="doubleclick"]` | Ad-network iframes | 0 matches (no googleads or doubleclick iframes in server HTML) | MATCH (correctly returns 0 -- no iframe ads present) |
| sourceforge.adContainers: `div[id*="ad"], div[class*="ad-"], div[data-ad-slot], ins.adsbygoogle, div[id*="gpt-ad"]` | Ad container elements | 0 matches (no standard ad containers in server HTML) | MATCH (correctly returns 0 -- ads use custom containers) |
| fakeButtonIndicators.iframeAds: `iframe[src*="ad"], iframe[src*="doubleclick"]` | Ad iframes | 0 matches | MATCH (correctly returns 0) |
| fakeButtonIndicators.dataAdAttributes: `[data-ad-slot], [data-ad-client], [data-ad-format], [data-google-query-id]` | Ad data attributes | 0 matches | MATCH (correctly returns 0 -- data-ad attributes are JS-injected) |
| fakeButtonIndicators.adClasses: `[class*="advert"], [class*="sponsored"], ins.adsbygoogle` | Ad class elements | 0 matches | MATCH (correctly returns 0) |
| fakeButtonIndicators.trackingRedirects: `a[href*="/aclk?"], a[href*="/pagead/"], a[href*="click.php"]` | Tracking redirect links | 0 matches (tracking URLs are in data-dest, not href) | PARTIAL -- tracking URLs exist but in data-dest attributes, not href |
| filehippo.realDownloadButton: `a[href*="filehippo.com/download_"]` | FileHippo download links | 33 download-related links found (not tested with exact selector) | UNTESTED (homepage, not specific download page) |
| majorgeeks.realDownloadButton: `a[href*="majorgeeks.com/mg/getmirror"]` | MajorGeeks mirror links | 0 matches on homepage (getmirror pattern is on download pages) | N/A -- correct page scope |

**Selector accuracy summary:** 4 exact matches, 2 partial matches (class token mismatch, data-dest vs href), 2 N/A (wrong page scope), 3 correct-zero-results, 1 untested. The `a[href*="/files/latest/download"]` selector is the most reliable for identifying the real SourceForge download button. The `a.button.green` selector needs updating to `a.button.green, a.button.download` to catch the multi-class variant.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| downloadRealFile workflow | site-guides/utilities/freeware-download.js | 12-step elimination-based workflow for identifying and clicking real download links while ignoring fake ad buttons on freeware sites | navigate (URL), get_dom_snapshot (download elements), get_attribute (href verification), click (verified real download link), read_page (post-click confirmation) |
| 8 ad detection heuristics | site-guides/utilities/freeware-download.js (guidance section) | DOM-based indicators for fake download button identification: ad domains, iframe wrappers, ad CSS classes, data-ad-* attributes, tracking redirects, domain mismatch, aria/title labels, parent container markers | Applied via get_dom_snapshot + get_attribute analysis |

Note: No new MCP server tools were added this phase. The site guide provides workflow guidance and selector definitions for the existing MCP tool chain (navigate, get_dom_snapshot, get_attribute, click, read_page).
