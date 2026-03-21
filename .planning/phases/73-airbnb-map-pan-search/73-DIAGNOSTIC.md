# Autopilot Diagnostic Report: Phase 73 - Airbnb Map Pan Search

## Metadata
- Phase: 73
- Requirement: SCROLL-07
- Date: 2026-03-21
- Outcome: PARTIAL (Airbnb search results page loads via HTTP 200 with 823KB HTML for San Francisco. Map container confirmed in server HTML via data-testid="map/GoogleMap" and aria-label="Google Map". Page heading confirmed via data-testid="stays-page-heading". However, listing cards (card-container), map pins (BasePillMarker), pin price labels, and interactive toggles (Search as I move) are all client-rendered by React -- zero instances in server HTML. CDP drag map panning could not be attempted. Live MCP tool execution blocked by persistent WebSocket bridge disconnect -- extension_not_connected error, same blocker as Phases 55-72.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225 with established connection, but Chrome extension not connected for browser action dispatch)

## Prompt Executed
"Navigate to Airbnb search results for San Francisco, pan the map eastward using CDP drag, wait for new listing pins to load, and verify different listings appeared in the new viewport area."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (extension_not_connected, same blocker as Phases 55-72). HTTP-based validation was performed against Airbnb search results for both San Francisco and New York. The primary finding is that Airbnb is a React SPA that server-renders only the page shell (map container div, page heading, navigation) while listing cards, map pins, price labels, and interactive controls are all client-rendered by JavaScript. Of the 9 map-related selectors from the airbnb.js site guide, only 3 structural selectors could be validated via server HTML (mapContainer, stays-page-heading, universal-map-controlled). The remaining 6 (listingCard, listingPin, pinPriceLabel, searchAsMapMoves, searchThisArea, cookieAccept) require live browser JavaScript execution for validation. CDP drag map panning, pin count comparison, and price verification all require a live browser session.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate | https://www.airbnb.com/s/San-Francisco--CA/homes | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 823,085 bytes / 823KB) | Airbnb SF search results page loaded successfully via HTTP. Server returns full React SPA shell with CSS, embedded JSON config data, and structural div elements. No auth required for search browsing. |
| 2 | read_page | Verify search results page structure: listing cards, map, pins | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | data-testid="map/GoogleMap": 1 instance FOUND. data-testid="stays-page-heading": 1 instance FOUND. data-testid="card-container": 0 instances (client-rendered). data-testid="map/markers/BasePillMarker": 0 instances (client-rendered). aria-label="Google Map": 1 instance FOUND. Shimmer/loading skeleton: 9 instances (placeholder UI before React hydration). |
| 3 | click | Cookie/consent popup dismiss | NOT EXECUTED (MCP) / ANALYZED (HTML) | CSS references to "main-cookies-banner" found in server HTML styles, confirming the banner component exists in the Airbnb codebase. However, the actual cookie banner DOM element is client-rendered -- it may or may not appear depending on the visitor's cookie state and geographic region. No clickable accept button found in server HTML. |
| 4 | read_page | BASELINE RECORDING: count pins and cards before pan | NOT EXECUTED | Cannot count listing pins or cards from server HTML -- all are client-rendered by React after JavaScript hydration. data-testid="card-container" count: 0 in server HTML. BasePillMarker count: 0 in server HTML. Pin price labels: 0 in server HTML. Baseline recording requires live browser session. |
| 5 | (calculation) | Identify map center coordinates for drag | CALCULATED (estimated) | Map container (data-testid="map/GoogleMap") is present in server HTML. For a standard 1920x1080 viewport with Airbnb's split layout (listings left, map right), the map occupies roughly the right 40-50% of the viewport. Estimated map center: approximately (1440, 540) for 1920x1080 or (viewport.width * 0.75, viewport.height * 0.5). This calculation is valid but untested. |
| 6 | drag | CDP drag to pan map eastward: drag(1640, 540, 1240, 540, steps=20, stepDelayMs=25) | NOT EXECUTED (MCP) | Could not execute CDP drag -- WebSocket bridge disconnected (extension_not_connected). Planned parameters: startX=1640 (centerX+200), startY=540, endX=1240 (centerX-200), endY=540, steps=20, stepDelayMs=25. Pan direction: right-to-left = eastward. Pan distance: 400px (meets the 300-500px minimum recommended in site guide). |
| 7 | wait_for_stable | Wait for new listing pins after pan | NOT EXECUTED (MCP) | Could not execute wait_for_stable -- WebSocket bridge disconnected. Planned: wait 2000-3000ms for Airbnb API response + pin rendering, then use wait_for_stable to confirm DOM has settled. |
| 8 | read_page | VERIFY: count pins and cards after pan, compare to baseline | NOT EXECUTED (MCP) | Could not execute post-pan read_page. Planned: count BasePillMarker buttons, count card-container divs, read pin price label text, compare all against baseline from step 4. |
| 9 | navigate | Backup: fetch NY search results for cross-city comparison | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 833,241 bytes / 833KB) | New York search results also return 833KB SPA shell. Same structure confirmed: map/GoogleMap present, stays-page-heading present, card-container and BasePillMarker both absent from server HTML. Confirms this is a consistent Airbnb SPA pattern, not SF-specific. |
| 10 | (analysis) | Validate selectors from airbnb.js site guide against server HTML | COMPLETED (HTTP DOM analysis) | 3 of 9 map-related selectors confirmed present in server HTML (mapContainer, mapCanvas parent, stays-page-heading). 6 selectors are client-rendered only. See Selector Accuracy table below. |

## What Worked
- Airbnb search results pages load successfully via HTTP without authentication (200 OK for both SF and NY)
- **mapContainer selector confirmed:** data-testid="map/GoogleMap" found in server HTML (1 instance). The map container div exists in the initial page shell
- **stays-page-heading confirmed:** data-testid="stays-page-heading" found in server HTML -- page heading renders server-side
- **universal-map-controlled confirmed:** data-testid="universal-map-controlled" found -- map wrapper div exists in server HTML
- **aria-label="Google Map" confirmed:** Accessibility label present on the map container, providing a fallback selector
- **Cookie banner CSS found:** Styles referencing "main-cookies-banner" confirm the component exists in the Airbnb codebase
- Airbnb URL patterns work as documented: /s/San-Francisco--CA/homes and /s/New-York--NY/homes both return valid search result pages
- Page structure is consistent across cities (SF 823KB, NY 833KB) -- the SPA shell is the same
- Site guide's panMapForListings workflow steps are well-structured and would be executable with a live browser connection
- Drag parameters calculated: startX=1640, startY=540, endX=1240, endY=540, steps=20, stepDelayMs=25 (eastward pan, 400px distance)
- No geo-blocking or rate limiting observed on search result pages

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected (extension_not_connected error). Navigate tool returns extension_not_connected. This is the same persistent blocker from Phases 55-72.
- **Listing cards not in server HTML:** data-testid="card-container" has 0 instances in server-rendered HTML. All listing cards are client-rendered by React after JavaScript hydration. Cannot count or verify listing cards via HTTP.
- **Map listing pins not in server HTML:** data-testid="map/markers/BasePillMarker" has 0 instances in server HTML. Map pins (price badge buttons) are rendered by JavaScript after the map initializes and Airbnb's API returns listing data for the visible area.
- **Pin price labels not in server HTML:** No pin price text (e.g., "$150") found in server HTML. Prices are embedded in client-rendered pin components.
- **"Search as I move" toggle not in server HTML:** The interactive toggle is client-rendered. Cannot verify its default state (on/off) without a live browser.
- **"Search this area" button not in server HTML:** The fallback button for manual area search is client-rendered, not present in the initial page shell.
- **Cookie accept button not in server HTML:** While cookie banner CSS exists, the actual banner DOM and its accept button are conditionally rendered by JavaScript based on visitor state and region.
- **CDP drag panning not tested:** Cannot execute CDP drag against the Airbnb map canvas without a live browser connection via the WebSocket bridge.
- **Before/after pin count comparison not performed:** The core test (baseline pin count -> pan -> post-pan pin count) requires live browser execution at every step.
- **Search form selectors not testable:** bigsearch-query-location-input and structured-search-input-field selectors are absent from server HTML (search form is the compact "little-search" variant on results pages, client-rendered to full form on interaction).

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-73):** The MCP server process runs on port 7225 with an established TCP connection, but the Chrome extension side does not respond to action dispatch requests. Without the bridge, no MCP tool can execute against the live browser. This is the primary blocker for all live MCP testing in this milestone and has blocked every phase since Phase 55.
- **React SPA hydration dependency:** Airbnb is a React SPA that server-renders only structural containers (map div, page heading) while all interactive content (listing cards, map pins, price labels, toggles, buttons) is client-rendered by JavaScript. HTTP-based validation can only confirm the page shell, not the functional elements. A live browser with full JavaScript execution is required for any meaningful DOM validation.
- **Map pin counting requires live browser:** The BasePillMarker buttons that represent listing pins are created dynamically by Airbnb's map component after the Google Maps/Mapbox canvas initializes and Airbnb's API returns listing data for the visible map bounds. A get_element_count tool would be useful for quickly counting pins without reading full DOM snapshots.
- **Pin price text extraction requires live browser:** Pin price labels (span elements within BasePillMarker buttons) contain dynamically rendered price text. A targeted get_text_content(selector) tool could efficiently extract just the price values for before/after comparison.
- **Map bounds verification via URL:** After panning, Airbnb may update the URL with ne_lat, ne_lng, sw_lat, sw_lng parameters reflecting the new map viewport. A get_url tool (or checking URL in read_page output) would help verify the map actually moved without relying solely on pin count comparison.
- **Screenshot/visual comparison not available:** For map pan verification, a screenshot before and after pan would provide definitive visual evidence of map movement, even if DOM selectors for pins are unreliable. This is not available in the current MCP tool set.
- **Canvas interaction verification:** The map canvas is a raster element -- its visual state cannot be read from the DOM. Verifying that a drag actually moved the map (as opposed to being intercepted or ignored) requires either URL bound changes, pin count/content changes, or visual comparison.

## Bugs Fixed In-Phase
- **Plan 01 -- airbnb.js site guide updated (87e7a19):** Added comprehensive map pan workflow (panMapForListings), 9 new selectors, CDP drag panning strategy, cookie dismissal guidance, and search-as-you-move toggle documentation to the existing Airbnb site guide.
- **No runtime bugs found in Plan 02:** No code was executed that could reveal runtime bugs. The diagnostic is limited to HTTP-based DOM structure analysis.
- **Selector observations (not bugs, expected behavior):**
  - `destination: '#bigsearch-query-location-input'` -- NOT present on search results pages. The results page shows a compact "little-search" bar (data-testid="little-search") that expands to the full search form on click. The full search input (bigsearch-query-location-input) only appears on the homepage or when the compact bar is expanded.
  - `searchButton: '[data-testid="structured-search-input-search-button"]'` -- NOT present in server HTML on results pages. Same reason as above -- only appears in the expanded search form.
  - These selectors are correct for the homepage search flow but not for the results page context. No site guide fix needed since the panMapForListings workflow starts from results page navigation, not search form interaction.

## Autopilot Recommendations

1. **Airbnb is a React SPA -- all listing content is client-rendered.** The server returns an 823KB HTML shell with structural containers (map div, page heading, navigation) but zero listing cards, map pins, or price labels. Autopilot must execute in a live browser with full JavaScript; HTTP-only validation can only confirm page accessibility and structural selectors, not functional content.

2. **Use airbnb.com/s/[City-Name]/homes URL pattern for direct search results.** Tested URLs: airbnb.com/s/San-Francisco--CA/homes (823KB, 200 OK) and airbnb.com/s/New-York--NY/homes (833KB, 200 OK). Both load the split-view results page with listings on the left and map on the right. Use major cities (San Francisco, New York, Los Angeles, London, Tokyo) for high listing density.

3. **Map container is reliably identifiable via data-testid="map/GoogleMap" and aria-label="Google Map".** Both selectors are present in server HTML, confirming they are stable structural markers. The data-testid="universal-map-controlled" wrapper div is also present. For map canvas center calculation, use (viewport.width * 0.75, viewport.height * 0.5) since the map occupies the right portion of the split-view layout.

4. **CDP drag parameters for map panning: drag(centerX+200, centerY, centerX-200, centerY, steps=20, stepDelayMs=25).** This produces a 400px eastward pan, which exceeds the 300-500px minimum recommended for triggering Airbnb's viewport listing refresh. The steps=20 and stepDelayMs=25 values are adapted from the Google Maps drag pattern (Phase 49). For north/south panning, swap the Y coordinates instead.

5. **Wait 2000-3000ms after panning before checking for new listings.** Airbnb makes an API call to fetch listings for the new viewport area after each pan. The API response + React rendering of new pin components takes longer than Google Maps tile loading. Use wait_for_stable after the initial wait to detect when pin DOM mutations have settled.

6. **Verify "Search as I move the map" toggle before panning.** This toggle controls whether panning automatically triggers a new listing search. When disabled, panning moves the map visually but does NOT load new listings -- the user must click "Search this area" instead. The toggle is client-rendered and not in server HTML, so it must be checked via read_page in a live browser. If the toggle is off, either click it to enable auto-search or click the "Search this area" button (data-testid="map/searchThisArea") after each pan.

7. **Record baseline before panning: count BasePillMarker buttons AND read pin price text.** Use read_page to count button[data-testid="map/markers/BasePillMarker"] elements and extract their inner span text (price labels like "$150"). After panning and waiting, repeat the same read. Verification criteria: (a) pin count changed, OR (b) pin prices are different values, OR (c) both. Different prices are the strongest indicator that the map panned to a genuinely new area.

8. **Dismiss cookie/consent popup before any map interaction.** Airbnb may show a cookie consent banner (data-testid="main-cookies-banner") that overlays part of the viewport. The banner can intercept click and drag events intended for the map. Click the accept/OK button within the banner first. The banner is conditionally rendered based on visitor state and may not appear for all sessions.

9. **Drag direction convention: drag right-to-left reveals eastern area.** This matches Google Maps convention. To pan the map view eastward (showing what is east of the current view), drag from a point to the RIGHT of center to a point to the LEFT of center. The map moves left, revealing the eastern area. For southward exploration, drag from below center to above center.

10. **Error recovery: if drag does not move the map, click the map first to ensure focus.** The Google Maps/Mapbox canvas may need to receive focus before accepting drag events. If the first drag attempt does not change pin counts or URL bounds, try: (a) click_at the map center coordinates to give the map focus, (b) wait 500ms, (c) retry the drag. Also verify the drag coordinates are within the actual map bounds, not on a listing card or header element.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| `destination: #bigsearch-query-location-input` | Search input field | NOT FOUND in server HTML on results page. Results page uses compact "little-search" bar (data-testid="little-search"). Full search input only appears on homepage or when compact bar is expanded. | NO (correct for homepage, not for results page context) |
| `searchButton: [data-testid="structured-search-input-search-button"]` | Search submit button | NOT FOUND in server HTML on results page. Same reason as destination -- only in expanded search form. | NO (correct for homepage, not for results page) |
| `listingCard: [data-testid="card-container"]` | Listing card containers | NOT FOUND in server HTML (0 instances). Client-rendered by React after JavaScript hydration. Expected to be present in live browser DOM. | UNTESTABLE (client-rendered, requires live browser) |
| `mapContainer: div[data-testid="map/GoogleMap"]` | Map container div | FOUND: 1 instance in server HTML. Also confirmed via aria-label="Google Map" (1 instance) and data-testid="universal-map-controlled" (1 instance). | YES |
| `mapCanvas: div[data-testid="map/GoogleMap"] canvas` | Map canvas element | PARENT FOUND (map/GoogleMap div exists). Canvas element itself is created by Google Maps JavaScript SDK after initialization. Cannot confirm canvas presence from server HTML. | PARTIAL (parent confirmed, canvas is client-rendered) |
| `listingPin: button[data-testid="map/markers/BasePillMarker"]` | Map listing pin buttons | NOT FOUND in server HTML (0 instances). Pins are created dynamically by Airbnb's map component after API returns listing data for the visible area. | UNTESTABLE (client-rendered, requires live browser) |
| `pinPriceLabel: button[data-testid="map/markers/BasePillMarker"] span` | Pin price text | NOT FOUND in server HTML (0 instances). Price text spans are inside client-rendered pin buttons. | UNTESTABLE (client-rendered, requires live browser) |
| `searchAsMapMoves: button:has(> span:contains("Search as I move"))` | Toggle for auto-search on pan | NOT FOUND in server HTML. The toggle is an interactive client-rendered component. Note: the :contains() pseudo-selector is not valid CSS -- this selector would need to be matched via text content search in read_page. | UNTESTABLE (client-rendered; also uses non-standard :contains()) |
| `searchThisArea: button[data-testid="map/searchThisArea"]` | Manual search area button | NOT FOUND in server HTML. The button appears conditionally when auto-search toggle is off and the map has been panned. | UNTESTABLE (conditional client-rendered element) |
| `cookieBanner: div[data-testid="main-cookies-banner"]` | Cookie consent banner | CSS references to "main-cookies-banner" found in server HTML styles. Actual DOM element is conditionally client-rendered based on visitor cookie state and region. | PARTIAL (component exists in codebase, DOM rendering is conditional) |
| `cookieAccept: div[data-testid="main-cookies-banner"] button` | Cookie accept button | NOT FOUND in server HTML. Button is inside the conditionally rendered cookie banner. | UNTESTABLE (inside conditional client-rendered banner) |
| `resultsCount: div[data-testid="stays-page-heading"]` | Results count heading | FOUND: 1 instance of data-testid="stays-page-heading" in server HTML. The heading text content (e.g., "Over 1,000 places") is likely client-rendered but the container div is server-rendered. | YES (container confirmed) |

**Summary:** 3 selectors confirmed present in server HTML (mapContainer, mapCanvas parent, resultsCount container). 2 selectors confirmed NOT applicable to results page context (destination, searchButton -- they are for the homepage search form). 1 selector partially confirmed (cookieBanner CSS exists but DOM is conditional). 6 selectors are untestable via HTTP because they are entirely client-rendered by React (listingCard, listingPin, pinPriceLabel, searchAsMapMoves, searchThisArea, cookieAccept). The searchAsMapMoves selector also uses non-standard :contains() CSS pseudo-selector which would not work with querySelectorAll -- text-based matching via read_page or custom selector logic would be needed.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| airbnb.js site guide map updates | site-guides/travel/airbnb.js | Updated Airbnb site guide with panMapForListings workflow (11-step navigate-pan-wait-verify cycle), 9 new map selectors (mapContainer, mapCanvas, listingPin, pinPriceLabel, searchAsMapMoves, searchThisArea, cookieBanner, cookieAccept, resultsCount), CDP drag panning strategy (steps=20, stepDelayMs=25), cookie dismissal guidance, search-as-you-move toggle documentation, and 6 new warnings. Created in Plan 01, commit 87e7a19. | (site guide, not a tool) |

**Note:** No new MCP tools were added in Phase 73. The Airbnb map pan test relies on existing MCP tools: `navigate` (url), `drag` (startX, startY, endX, endY, steps, stepDelayMs), `click_at` (x, y), `read_page` (no params), `get_dom_snapshot` (maxElements), `wait_for_stable` (no params). The key addition is the airbnb.js site guide update with comprehensive map interaction documentation. The persistent WebSocket bridge fix remains the primary tool gap blocking all live MCP testing.

---
*Phase: 73-airbnb-map-pan-search*
*Diagnostic generated: 2026-03-21*
