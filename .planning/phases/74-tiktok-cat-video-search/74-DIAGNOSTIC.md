# Autopilot Diagnostic Report: Phase 74 - TikTok Cat Video Search

## Metadata
- Phase: 74
- Requirement: SCROLL-08
- Date: 2026-03-21
- Outcome: PARTIAL (TikTok search page (tiktok.com/search?q=cat) loads via HTTP 200 with 294KB HTML. Tag page (tiktok.com/tag/cats) also loads via HTTP 200 with 292KB HTML. However, TikTok is a fully client-rendered SPA -- zero data-e2e attributes, zero search result cards, zero /video/ URLs, and zero video descriptions in server HTML. Both pages return the same generic SPA shell (title: "TikTok - Make Your Day") with a single empty #app div. TikTok classifies HTTP requests as botType: "others" and returns no content data in server HTML. All search result cards, video descriptions, and cat keyword matching require live browser JavaScript execution. Live MCP tool execution blocked by persistent WebSocket bridge disconnect -- same blocker as Phases 55-73.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225 with established TCP connection, but Chrome extension dispatch returns "Upgrade Required" indicating WebSocket protocol mismatch for direct HTTP calls)

## Prompt Executed
"Navigate to TikTok search results for 'cat', read video descriptions from search result cards, identify the first video containing cat-related content, and extract its URL and description."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-73). HTTP-based validation was performed against both the primary target (tiktok.com/search?q=cat, 294KB, HTTP 200) and the fallback target (tiktok.com/tag/cats, 292KB, HTTP 200). The critical finding is that TikTok is a fully client-rendered JavaScript SPA that returns zero content in server HTML -- no data-e2e attributes, no search result cards, no video URLs, no video descriptions, and no cat-related content text. The server returns only a minimal SPA shell with configuration JSON, script loaders, and an empty #app div that React hydrates entirely on the client. All 11 selectors from the tiktok.js site guide require live browser JavaScript execution for validation. Cat keyword matching in video descriptions cannot be tested without a live browser session.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate | https://www.tiktok.com/search?q=cat | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 293,852 bytes / 294KB) | TikTok search page loads successfully via HTTP. Server returns SPA shell with configuration JSON (pumbaa-rule, api-domains, service-region, slardar-config, __UNIVERSAL_DATA_FOR_REHYDRATION__) and empty #app div. Title: "TikTok - Make Your Day" (generic, not search-specific). No auth wall encountered. |
| 2 | read_page | Verify search results page: video cards, descriptions, links | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | data-e2e attributes: 0 instances in entire HTML. search-card-container: 0 instances. search-card-desc: 0 instances. search-card-link: 0 instances. /video/ URLs: 0 instances. div elements: 1 (the #app container). Script tags: 2. TikTok renders ALL content client-side via React -- server HTML is a bare shell. |
| 3 | click | Cookie consent banner (onetrust-accept-btn-handler) | NOT EXECUTED (MCP) / ANALYZED (HTML) | onetrust references: 0 in server HTML. No cookie banner DOM, no accept button. The __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON includes regional config but the actual cookie consent UI is client-rendered and may only appear for EU visitors in a live browser. |
| 4 | click | Login modal dismiss (modal-close-inner-button) | NOT EXECUTED (MCP) / ANALYZED (HTML) | modal-close-inner-button: 0 instances in server HTML. LoginModal: 0 instances. Login modals are conditionally client-rendered when TikTok prompts non-authenticated users after certain interactions (scroll, click). Cannot test dismissal without live browser. |
| 5 | read_page | Read search result cards -- extract descriptions for cat keywords | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | search-card-container: 0, search-card-desc: 0, recommend-list-item-container: 0, new-desc: 0. Zero video cards in server HTML. The hydration JSON (__UNIVERSAL_DATA_FOR_REHYDRATION__) contains app context metadata (region: "US", language: "en", appType: "m") but NO search result data, video metadata, or description text. Cat keyword matching impossible via HTTP. |
| 6 | (analysis) | Check for embedded search results in hydration JSON | COMPLETED (HTML analysis) | Searched for: ItemModule, SearchResult, search_result, video, VideoSearchPage, video_id, videoId, video_url -- all 0 instances. The hydration JSON contains only app configuration (A/B test versions, region data, API domains, Slardar monitoring config). TikTok does NOT embed search result data in server-rendered HTML. Results are fetched client-side via XHR/fetch API after React mounts. |
| 7 | navigate | https://www.tiktok.com/tag/cats (fallback) | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 291,583 bytes / 292KB) | Tag page also loads successfully via HTTP. Same SPA shell structure as search page. Title: "TikTok - Make Your Day" (generic). botType: "others". data-e2e: 0, /video/: 0, challenge-item: 0. Tag page is equally client-rendered -- no content in server HTML. |
| 8 | read_page | Read tag page video cards for cat content | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | challenge-item: 0 instances. challenge-item-desc: 0 instances. Same result as search page -- tag page returns identical SPA shell with no video content in server HTML. Page sizes are nearly identical (294KB vs 292KB) confirming the same template is returned regardless of URL path. |
| 9 | scroll | Scroll down 800px for more search results | NOT EXECUTED (MCP) | Could not execute scroll -- WebSocket bridge disconnected. Scroll testing for loading more search result cards requires a live browser where the initial batch has been client-rendered first. |
| 10 | (analysis) | Validate selectors from tiktok.js site guide against server HTML | COMPLETED (HTTP DOM analysis) | 0 of 11 tested selectors found in server HTML. All TikTok DOM content is client-rendered by React/JavaScript after the #app div is hydrated. See Selector Accuracy table below. |

## What Worked
- TikTok search page (tiktok.com/search?q=cat) is accessible without authentication -- HTTP 200 with 294KB response
- TikTok tag page (tiktok.com/tag/cats) is accessible without authentication -- HTTP 200 with 292KB response
- Both pages load without geo-blocking or rate limiting from US IP
- TikTok does not require authentication for search or tag page access -- confirmed no redirect to login
- The __UNIVERSAL_DATA_FOR_REHYDRATION__ hydration script is present in both pages, confirming TikTok uses a React-based SSR/CSR hybrid architecture
- Regional metadata is available in server HTML: region "US", language "en", appType "m" (mobile-first web)
- The SPA shell structure is consistent between search and tag pages -- same template with different hydration configs
- URL patterns documented in the tiktok.js site guide (tiktok.com/search?q={query} and tiktok.com/tag/{topic}) both resolve correctly
- Site guide's auth avoidance strategy confirmed: search and tag pages are public, no auth wall

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected. MCP server process running on port 7225 with established TCP connection, but browser action dispatch not functional. This is the same persistent blocker from Phases 55-73.
- **Zero data-e2e attributes in server HTML:** The primary selector strategy (data-e2e attributes) cannot be validated via HTTP. TikTok renders all data-e2e attributes client-side. All 11 tested selectors returned 0 matches.
- **Zero search result cards in server HTML:** Neither search-card-container nor recommend-list-item-container exists in server HTML. All video cards are client-rendered after React hydration.
- **Zero video descriptions in server HTML:** search-card-desc, new-desc, browse-video-desc -- all absent. Cat keyword matching is impossible without a live browser.
- **Zero video URLs in server HTML:** No /video/ links, no video IDs, no video metadata embedded anywhere in server HTML or hydration JSON.
- **No search result data in hydration JSON:** Unlike some SPAs that embed initial data in a __NEXT_DATA__ or SIGI_STATE JSON block, TikTok's __UNIVERSAL_DATA_FOR_REHYDRATION__ contains only app configuration (A/B tests, region, API domains) with zero content data.
- **Cookie banner not testable:** onetrust elements absent from server HTML (0 instances). Cannot confirm if cookie banner appears in live browser for this region.
- **Login modal not testable:** modal-close-inner-button absent from server HTML (0 instances). Login modal is triggered by user interaction, not present in initial page load.
- **Cat keyword matching not performed:** With zero video descriptions in server HTML, cat keywords (cat, kitten, kitty, meow, feline, purr) could not be matched against any content.
- **Scroll pagination not testable:** Cannot test scroll-to-load-more behavior without initial client-rendered content visible in a live browser.
- **TikTok bot detection:** Server classifies HTTP requests as botType: "others", which may result in reduced content delivery compared to real browser sessions.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-74):** The MCP server process runs on port 7225 with an established TCP connection, but the Chrome extension side does not dispatch browser actions. This has blocked every live MCP test since Phase 55. Without the bridge, no MCP tool can execute against the live browser DOM.
- **TikTok is fully client-rendered SPA:** Unlike Airbnb (Phase 73) which server-renders structural containers, TikTok returns ZERO content in server HTML. The entire page (including structural elements, video cards, descriptions, links) is built client-side by React/JavaScript. This means HTTP-based validation can only confirm page accessibility (200 OK), not any DOM structure or content.
- **No embedded search data in hydration JSON:** TikTok does not use __NEXT_DATA__ (Next.js pattern) or SIGI_STATE (older TikTok pattern) to embed search results in server HTML. The __UNIVERSAL_DATA_FOR_REHYDRATION__ contains only app configuration. Search results are fetched via client-side API calls after React mounts. This means even parsing the server HTML JSON cannot extract video data.
- **Bot detection may limit content:** TikTok classifies non-browser requests as botType: "others". It is unknown whether this classification affects content rendering in a live browser session (e.g., showing CAPTCHA, limiting results, or requiring login for certain actions).
- **Page text extraction requires live DOM:** The read_page tool would need to extract text from client-rendered React components. If TikTok uses Shadow DOM or iframes for video cards, additional DOM traversal strategies may be needed.
- **Screenshot/visual comparison not available:** For verifying that cat video thumbnails are visible, a screenshot tool would provide definitive evidence. Current MCP tools rely on DOM text extraction only.

## Bugs Fixed In-Phase
- **Plan 01 -- tiktok.js site guide created (4427892):** Created comprehensive TikTok site guide with scrollFeedForCatVideo workflow, 25+ data-e2e selectors, cat keyword matching strategy, auth fallback paths, and 7 warnings.
- **Plan 01 -- background.js wiring (6a20572):** Wired tiktok.js import into background.js Social Media section.
- **No runtime bugs found in Plan 02:** No code was executed that could reveal runtime bugs. The diagnostic is limited to HTTP-based page accessibility and structure analysis.
- **Observation: SIGI_STATE pattern deprecated:** Older TikTok versions (pre-2025) used a SIGI_STATE JSON block in server HTML that contained video metadata and search results. Current TikTok (March 2026) uses __UNIVERSAL_DATA_FOR_REHYDRATION__ which contains only app configuration, not content data. This is a significant change from what older TikTok scraping documentation describes.

## Autopilot Recommendations

1. **TikTok is a fully client-rendered SPA -- live browser execution is mandatory.** The server returns a 294KB SPA shell with zero content: no video cards, no descriptions, no URLs, no data-e2e attributes. Unlike Airbnb (Phase 73) which server-renders structural containers, TikTok renders EVERYTHING client-side. HTTP-only validation can only confirm page accessibility (200 OK). Autopilot must execute all steps in a live browser with full JavaScript execution.

2. **Use tiktok.com/search?q=cat as primary target -- public, pre-filtered, no auth required.** HTTP 200 confirmed for search page. The "cat" search query pre-filters results to cat-related content, so the first batch of search result cards should predominantly contain cat videos. This eliminates the need for extensive scrolling in most cases.

3. **Use tiktok.com/tag/cats as fallback if search page fails.** HTTP 200 confirmed for tag page. Both pages use the same SPA shell. If search results are empty or blocked, the tag page provides an alternative source of cat-related content.

4. **Dismiss cookie consent banner before any interaction.** The cookie banner (onetrust-accept-btn-handler) is client-rendered and may appear for certain regions (primarily EU). Click the accept button immediately after page load and React hydration. The banner can overlay interactive elements and intercept clicks intended for video cards.

5. **Dismiss login modal promptly when it appears.** TikTok shows login modals after certain interactions (scroll depth, video click). Use div[data-e2e="modal-close-inner-button"] or the visible X/close button to dismiss. Do NOT attempt to log in -- the search and tag pages provide sufficient public content without authentication.

6. **Cat keyword matching strategy: case-insensitive check against description text.** Since the search query is "cat", most result descriptions should contain cat-related keywords. Check for: "cat", "kitten", "kitty", "meow", "feline", "purr", "#cat", "#cats", "#catsoftiktok", "#catlife". Match case-insensitively against the full description text extracted from search-card-desc or new-desc elements.

7. **Scroll timing for search results: 800-1000px with 500-1000ms delay.** Search results load in grid batches as the user scrolls. After each scroll, wait for DOM stabilization (waitForDOMStable or wait_for_stable) before reading new cards. Each scroll batch typically adds 8-12 new video cards in the grid layout.

8. **Video URL extraction from search result cards: use a[href*="/video/"] selector.** Each search result card contains a link to the full video page. The URL format is tiktok.com/@username/video/{videoId}. Extract this URL as the primary identifier for the found cat video.

9. **TikTok is NOT server-rendered -- older SIGI_STATE pattern is deprecated.** Older TikTok documentation references a SIGI_STATE JSON block in server HTML containing video data. Current TikTok (March 2026) uses __UNIVERSAL_DATA_FOR_REHYDRATION__ which contains ONLY app configuration (A/B tests, region, API domains) and zero content data. Do not rely on server HTML parsing for any content extraction.

10. **Error recovery: if search returns zero visible results after hydration, try tag page.** If tiktok.com/search?q=cat renders but shows zero search result cards (possibly due to bot detection, regional restrictions, or A/B test), navigate to tiktok.com/tag/cats as fallback. If both fail, the outcome is PARTIAL (page accessible but content not extractable). If both pages require authentication, the outcome is SKIP-AUTH.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| `searchInput: input[data-e2e="search-user-input"]` | Search input field on search page | NOT FOUND in server HTML. 0 data-e2e attributes exist in entire page. Search input is client-rendered by React. | UNTESTABLE (client-rendered) |
| `searchResultCard: div[data-e2e="search-card-container"]` | Search result video card container | NOT FOUND in server HTML (0 instances). All search result cards are client-rendered. | UNTESTABLE (client-rendered) |
| `searchCardDesc: span[data-e2e="search-card-desc"]` | Video description text in search results | NOT FOUND in server HTML (0 instances). Descriptions are client-rendered inside card components. | UNTESTABLE (client-rendered) |
| `searchCardLink: a[data-e2e="search-card-link"]` | Video link in search result cards | NOT FOUND in server HTML (0 instances). No /video/ URLs anywhere in server HTML. | UNTESTABLE (client-rendered) |
| `searchCardUser: span[data-e2e="search-card-user-unique-id"]` | Author username in search results | NOT FOUND in server HTML (0 instances). Author info is client-rendered inside card components. | UNTESTABLE (client-rendered) |
| `cookieBanner: div[id="onetrust-banner-sdk"]` | OneTrust cookie consent banner | NOT FOUND in server HTML (0 instances). Cookie banner is conditionally client-rendered based on visitor region and cookie state. | UNTESTABLE (conditional client-rendered) |
| `cookieAccept: button[id="onetrust-accept-btn-handler"]` | Cookie consent accept button | NOT FOUND in server HTML (0 instances). Button is inside the conditionally rendered cookie banner. | UNTESTABLE (conditional client-rendered) |
| `loginModal: div[data-e2e="modal-close-inner-button"]` | Login modal close button | NOT FOUND in server HTML (0 instances). Login modal is triggered by user interaction, not present in initial load. | UNTESTABLE (interaction-triggered client-rendered) |
| `loginModalClose: button[data-e2e="modal-close-inner-button"]` | Login modal close button (button variant) | NOT FOUND in server HTML (0 instances). Same as loginModal -- interaction-triggered. | UNTESTABLE (interaction-triggered client-rendered) |
| `videoDesc: h1[data-e2e="browse-video-desc"]` | Video description on feed/browse page | NOT FOUND in server HTML (0 instances). Feed page is entirely client-rendered. | UNTESTABLE (client-rendered) |
| `tagVideoCard: div[data-e2e="challenge-item"]` | Video card on tag/hashtag page | NOT FOUND in server HTML (0 instances). Tag page uses same SPA shell with client-rendered content. | UNTESTABLE (client-rendered) |

**Summary:** 0 of 11 selectors confirmed in server HTML. TikTok is a fully client-rendered SPA where the server returns an empty #app div and React builds the entire DOM client-side. This is more extreme than Twitter/X (Phase 67, also SPA but 245KB shell) and Airbnb (Phase 73, server-renders structural containers). All data-e2e selectors are correct in concept (TikTok's documented test attribute pattern) but require a live browser with full JavaScript execution for validation. The selectors cannot be confirmed or denied via HTTP analysis alone -- they remain untestable until the WebSocket bridge blocker is resolved.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| tiktok.js site guide | site-guides/social/tiktok.js | TikTok site guide with scrollFeedForCatVideo workflow (14-step search-scroll-read-match cycle), 25+ data-e2e selectors (search results, feed, auth modals, cookie consent), cat keyword matching strategy (6 primary + 6 hashtag keywords), auth fallback paths (search page primary, tag page fallback), 7 warnings, toolPreferences. Created in Plan 01, commit 4427892. | (site guide, not a tool) |
| background.js tiktok import | background.js | Wired tiktok.js importScripts into background.js Social Media section alongside existing youtube.js and twitter.js guides. Created in Plan 01, commit 6a20572. | (import statement, not a tool) |

**Note:** No new MCP tools were added in Phase 74. The TikTok cat video search test relies on existing MCP tools: `navigate` (url), `read_page` (no params), `get_dom_snapshot` (maxElements), `scroll` (direction, amount), `click` (selector), `wait_for_stable` (no params). The key additions are the tiktok.js site guide with comprehensive TikTok web DOM documentation and the background.js wiring. The persistent WebSocket bridge fix remains the primary tool gap blocking all live MCP testing since Phase 55.

---
*Phase: 74-tiktok-cat-video-search*
*Diagnostic generated: 2026-03-21*
