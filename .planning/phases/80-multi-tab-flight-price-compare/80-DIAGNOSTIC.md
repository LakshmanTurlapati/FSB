# Autopilot Diagnostic Report: Phase 80 - Multi-Tab Flight Price Compare

## Metadata
- Phase: 80
- Requirement: CONTEXT-04
- Date: 2026-03-22
- Outcome: PARTIAL (Google Flights accessible via HTTP 200, 1,910,779 bytes. Server HTML contains 12+ flight result cards with prices embedded in aria-label attributes, e.g., "Find flights from Atlanta (ATL) to Tampa (TPA) from $56. Operated by Frontier." Search form elements confirmed: aria-label="Enter your origin", aria-label="Enter your destination", aria-label="Departure", aria-label="Return". YMlIz price class found 1 time in server HTML; pIav2d result card class NOT found in server HTML (0 occurrences -- likely client-rendered or class name changed since site guide was written). The full 5-tab workflow -- open_tab for 5 booking URLs, read_page for price extraction per tab, list_tabs verification, numeric comparison, switch_tab to cheapest, re-verification -- requires live browser MCP execution which is blocked by WebSocket bridge disconnect. Same persistent blocker as Phases 55-79.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch. Same persistent blocker as Phases 55-79.)

## Prompt Executed
"Search for flights from SFO to JFK on Google Flights, open 5 result options in separate tabs, extract the price from each tab, compare all 5 prices, and switch back to the tab with the cheapest flight."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-79). HTTP-based validation was performed against Google Flights (google.com/travel/flights, HTTP 200, 1,910,779 bytes). The server HTML confirms Google Flights is a fully functional flight search aggregator with server-rendered flight suggestions containing prices in aria-label attributes (12+ results with routes, prices, airlines, dates, and stop counts). The search form elements are present: origin input (aria-label="Enter your origin"), destination input (aria-label="Enter your destination"), departure date (aria-label="Departure"), and return date (aria-label="Return"). The YMlIz price class appears 1 time in server HTML while the pIav2d result card class was not found (0 occurrences), indicating result card selectors may have changed or are primarily client-rendered. The full CONTEXT-04 workflow -- Google Flights search, 5x open_tab to booking sites, 5x read_page for price extraction, list_tabs verification, numeric price comparison, switch_tab to cheapest tab, re-verification read -- requires live browser MCP execution that is blocked by the WebSocket bridge disconnect.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate | https://www.google.com/travel/flights | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 1,910,779 bytes) | Google Flights loads successfully. Server HTML contains: search form with origin/destination/date inputs, 12+ flight suggestion cards with aria-label attributes containing route, price, airline, dates, and stop count. Application name meta tag: "Google Flights". The page is a large React SPA (~1.9MB HTML) with both server-rendered suggestions and client-rendered interactive search. MCP server on port 7225 returns HTTP 426. |
| 2 | wait_for_stable | Wait for Google Flights to fully render | NOT EXECUTED (MCP) | Requires live browser. Google Flights loads search form and suggestion cards progressively. The interactive search form (origin/destination inputs, calendar) requires JavaScript execution. Server HTML contains static suggestion cards but the full search interaction is client-side. |
| 3 | read_page | Identify search form: origin input, destination input, date pickers, search button | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | Search form elements confirmed in server HTML: aria-label="Enter your origin" (origin input), aria-label="Enter your destination" (destination input), aria-label="Departure" (date input, 4 occurrences), aria-label="Return" (date input, 4 occurrences). Also found: aria-label="Where from?" (2 occurrences) and aria-label="Where to?" (4 occurrences) -- alternate labels for the same inputs. Search button: 67 occurrences of "search" in server HTML. Passenger selector: aria-label="1 passenger, change number of passengers." |
| 4 | click + type_text | Fill origin: click origin input, type "SFO" | NOT EXECUTED (MCP) | Requires live browser. Origin input exists (aria-label="Enter your origin" or "Where from?"). Google Flights uses autocomplete dropdowns -- typing "SFO" would trigger a suggestion for "San Francisco (SFO)" that must be clicked. |
| 5 | click + type_text | Fill destination: click destination input, type "JFK" | NOT EXECUTED (MCP) | Requires live browser. Destination input exists (aria-label="Enter your destination" or "Where to?"). Same autocomplete pattern -- typing "JFK" triggers suggestion for "New York (JFK)" to be clicked. |
| 6 | click + click | Select departure date from calendar | NOT EXECUTED (MCP) | Requires live browser. Departure date input exists (aria-label="Departure"). Clicking opens a calendar widget where specific days must be selected. Cannot type dates directly per site guide warning. |
| 7 | click | Click Search or wait for auto-search | NOT EXECUTED (MCP) | Requires live browser. Google Flights often auto-searches after destination and dates are set. A manual search button (aria-label="Search") may need to be clicked. 67+ "search" references in server HTML suggest multiple search-related elements. |
| 8 | read_page | Identify 5 flight result cards with prices and booking links | NOT EXECUTED (MCP) / SIMULATED (HTTP analysis) | Server HTML contains 12+ flight suggestion cards with full details in aria-labels. Example results found: (1) ATL to TPA from $56 (Frontier, Nonstop), (2) DFW to ATL from $92 (Frontier, Nonstop), (3) LGA to MCO from $98 (Frontier, Nonstop), (4) ORD to LAX from $128 (Frontier, Nonstop), (5) ATL to LAS from $133 (Frontier, Nonstop). These are suggestion cards, not search results for SFO-JFK. Actual SFO-JFK results would require live search execution. YMlIz price class: 1 occurrence. pIav2d result card class: 0 occurrences. |
| 9 | open_tab | Tab 1: Open first flight result booking URL | NOT EXECUTED (MCP) | Requires live browser with WebSocket bridge. open_tab tool sends message to Chrome extension via bridge to create a new tab. Cannot execute without bridge. Expected: returns numeric tabId for the new tab. |
| 10 | read_page | Tab 1: Extract price from booking/airline page | NOT EXECUTED (MCP) | Requires live browser. After open_tab, the new tab becomes active. read_page would extract price text using selectors like [class*="price"], [class*="fare"], or elements containing "$" followed by digits. Expected: store {tabId: <id>, price: <number>, airline: <name>, source: <url>}. |
| 11 | open_tab | Tab 2: Open second flight result booking URL | NOT EXECUTED (MCP) | Same as step 9. Would return a different tabId. |
| 12 | read_page | Tab 2: Extract price from booking/airline page | NOT EXECUTED (MCP) | Same as step 10. Store second price record. |
| 13 | open_tab | Tab 3: Open third flight result booking URL | NOT EXECUTED (MCP) | Same as step 9. Third tab opened. |
| 14 | read_page | Tab 3: Extract price from booking/airline page | NOT EXECUTED (MCP) | Same as step 10. Store third price record. |
| 15 | open_tab | Tab 4: Open fourth flight result booking URL | NOT EXECUTED (MCP) | Same as step 9. Fourth tab opened. |
| 16 | read_page | Tab 4: Extract price from booking/airline page | NOT EXECUTED (MCP) | Same as step 10. Store fourth price record. |
| 17 | open_tab | Tab 5: Open fifth flight result booking URL | NOT EXECUTED (MCP) | Same as step 9. Fifth tab opened. |
| 18 | read_page | Tab 5: Extract price from booking/airline page | NOT EXECUTED (MCP) | Same as step 10. Store fifth price record. |
| 19 | list_tabs | Verify all 5 booking tabs plus original results tab are open | NOT EXECUTED (MCP) | Requires live browser. list_tabs sends mcp:get-tabs message via bridge. Expected: returns array of 6+ tab objects {id, title, url, active}. Would cross-reference 5 stored tabIds against list_tabs output. |
| 20 | (analysis) | Compare all 5 prices numerically, identify cheapest | NOT EXECUTED (MCP) | Pure numeric comparison. Would sort stored prices array ascending, identify minimum. Example with server HTML suggestion prices: $56 (ATL-TPA) < $92 (DFW-ATL) < $98 (LGA-MCO) < $128 (ORD-LAX) < $133 (ATL-LAS). Cheapest: $56. |
| 21 | switch_tab | Switch to the tab with the cheapest flight | NOT EXECUTED (MCP) | Requires live browser. switch_tab sends switchToTab action via bridge with the numeric tabId of the cheapest entry. Expected: active tab changes to the cheapest flight tab. |
| 22 | read_page | Re-read price on the cheapest tab to verify it matches stored value | NOT EXECUTED (MCP) | Requires live browser. Final verification: read_page on now-active cheapest tab, extract price, confirm it matches the value stored in step 10 (or whichever tab was cheapest). |
| 23 | (analysis) | OUTCOME CLASSIFICATION | PARTIAL | Google Flights accessible via HTTP with server-rendered flight suggestions containing prices. Search form elements validated. But the complete 5-tab workflow (open_tab x5, read_page x5, list_tabs, switch_tab, verify) requires live browser MCP execution blocked by WebSocket bridge disconnect. |

## What Worked
- Google Flights (google.com/travel/flights) is accessible without authentication -- HTTP 200, 1,910,779 bytes of server-rendered HTML
- Application confirmed as Google Flights via meta tag: `<meta name="application-name" content="Google Flights">`
- Search form elements confirmed in server HTML: origin input (aria-label="Enter your origin" and "Where from?"), destination input (aria-label="Enter your destination" and "Where to?"), departure date (aria-label="Departure"), return date (aria-label="Return")
- 12+ flight suggestion cards found with full details in aria-label attributes containing: origin city, destination city, airport codes, price, airline name, dates, stop count
- Specific flight prices extracted from server HTML aria-labels: $56 (ATL-TPA, Frontier, Nonstop), $92 (DFW-ATL, Frontier, Nonstop), $98 (LGA-MCO, Frontier, Nonstop), $128 (ORD-LAX, Frontier, 1 stop), $133 (ATL-LAS, Frontier, Nonstop), $144 (ORD-LAS, Frontier, Nonstop), $160 (ATL-LAX, DFW-LAX, DFW-LAS, ORD-SFO, all Frontier, 1 stop), $185 (EWR-LAX, Frontier, 1 stop), $446 (JFK-LGW, Icelandair, 1 stop)
- Passenger selector confirmed: aria-label="1 passenger, change number of passengers."
- Seating class selector confirmed: aria-label="Change seating class."
- Ticket type selector confirmed: aria-label="Change ticket type."
- YMlIz price class found at least 1 time in server HTML, confirming price elements exist in the DOM
- Kayak flights page also accessible (HTTP 200, 275,528 bytes) as a fallback flight search target
- No authentication, CAPTCHA, or paywall required for Google Flights access

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected. MCP server process running on port 7225, returns HTTP 426 "Upgrade Required". This is the same persistent blocker from Phases 55-79. Without the bridge, no MCP tool (open_tab, switch_tab, list_tabs, read_page, navigate, click, type_text) can execute against the live browser.
- **open_tab could not be tested:** The core CONTEXT-04 capability -- opening 5 separate tabs with booking URLs -- requires the MCP bridge to send openNewTab action to the Chrome extension. The tool definition exists in manual.ts (line 278), the action mapping to openNewTab is correct, but execution is blocked by the bridge disconnect.
- **switch_tab could not be tested:** Switching to the cheapest tab (switch_tab with tabId from open_tab) requires the bridge to send switchToTab action. Tool definition exists in manual.ts (line 285) with tabId parameter. Cannot validate whether tab switching preserves the correct page context.
- **list_tabs could not be tested:** Tab enumeration (list_tabs sends mcp:get-tabs message) requires the bridge. Tool definition exists in read-only.ts (line 93). Cannot validate whether list_tabs returns accurate tab information after 5 open_tab calls.
- **read_page for price extraction not tested per tab:** Price extraction from 5 different airline/booking site tabs requires live browser DOM access. Each airline site (United, Delta, American, Southwest, etc.) has different DOM structures for displaying prices. Cannot validate whether read_page returns sufficient data for price identification across diverse airline sites.
- **pIav2d result card class not found in server HTML:** The google-travel.js site guide specifies `.pIav2d` as the result card selector. Zero occurrences found in Google Flights server HTML (1.9MB). This class may have been changed, may be generated client-side, or may only appear on search results pages (not the homepage suggestions). This selector requires live browser validation.
- **Actual SFO-JFK search results not available:** Server HTML contains suggestion cards for popular routes (ATL-TPA, DFW-ATL, etc.) but not specific SFO-JFK search results. Getting SFO-JFK results requires executing the search workflow (fill origin, destination, dates, wait for results) which needs live browser execution.
- **Multi-tab context retention not validated:** The core CONTEXT-04 challenge (maintaining tabId-to-price mappings across 5 tab switches while managing context from 5 separate page DOMs) cannot be tested without live browser execution. The MCP agent's ability to retain {tabId, price, airline, source} records across open_tab and switch_tab calls is the key capability being tested.
- **Price comparison accuracy not validated:** While numeric comparison logic is straightforward (sort by price, identify minimum), the challenge is extracting clean numeric prices from diverse airline website DOMs (different price formats: "$342", "$342.50", "342 USD", "From $342") and converting them reliably to comparable numbers.
- **Tab ID stability not validated:** Cannot confirm whether tabIds returned by open_tab remain stable through the entire workflow and match the IDs returned by list_tabs. Tab IDs should be Chrome-assigned integers that persist for the tab's lifetime, but this needs live validation.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-80):** The MCP server process runs on port 7225 with an established TCP connection, but the Chrome extension side returns HTTP 426 "Upgrade Required" for browser action dispatch. This has blocked every live MCP test since Phase 55. The full CONTEXT-04 workflow -- navigate to Google Flights, search for flights, identify 5 results, open_tab x5, read_page x5, list_tabs, numeric comparison, switch_tab, verify -- requires live browser execution. This is the most critical tool gap.
- **No targeted element extraction tool:** read_page returns full page content or a DOM summary. For the CONTEXT-04 workflow, the agent only needs the price text from each tab (a few characters). A tool like `get_text_by_selector(selector)` that returns only the matching element's text content would reduce context bloat from ~50-200KB per tab to under 100 characters. Currently, the agent must use read_page (which returns full page context) and then parse out the price from the response.
- **No numeric price parsing tool:** Airline sites display prices in various formats ("$342", "$342.50", "From $342", "342 USD", "US$342"). There is no MCP tool that extracts and normalizes price values. The agent must parse price text manually in its reasoning. A `parse_price(text)` helper is not strictly needed (the agent can do string manipulation in its chain-of-thought) but would standardize extraction across diverse sites.
- **No tab-aware read_page:** read_page reads from the currently active tab. There is no variant like `read_tab(tabId)` that reads from a specific tab without switching to it first. For the 5-tab workflow, this means the agent must switch_tab then read_page for each tab (2 tool calls per tab) rather than a single read_tab call. This adds 5 extra switch_tab calls to the workflow.
- **open_tab return value not documented in tool description:** The open_tab tool description says "Returns the new tab ID" but the exact response format (JSON with tabId field, or plain number, or wrapped in a status object) is not specified. The agent must parse the response format at runtime. Clearer documentation would reduce parsing ambiguity.
- **list_tabs response format ambiguity:** list_tabs description says "Returns array of tab objects" but the exact shape ({id, title, url, active} vs other fields) is inferred from the code. Clear response format documentation would help the agent cross-reference stored tabIds reliably.
- **No bulk tab operation tool:** Opening 5 tabs requires 5 separate open_tab calls. A `open_tabs([url1, url2, url3, url4, url5])` batch tool would reduce the number of round-trips. However, the sequential open-and-read pattern (open one tab, read price, then next) is actually preferred for context management -- opening all 5 at once would require tracking which tab is which without immediate price extraction.
- **WebSocket bridge (persistent gap from Phases 55-79):** Same fundamental infrastructure blocker. The bridge disconnect means no tool can interact with live browser DOM, making all multi-tab workflow testing impossible.

## Context Bloat Analysis

### Estimated Context Per Workflow Step
Based on the CONTEXT-04 multi-tab flight comparison workflow:

- **Step 1 (navigate to Google Flights):** ~2-5KB (URL, status, basic page structure confirmation)
- **Step 2 (wait_for_stable):** ~1-2KB (stability confirmation)
- **Step 3 (read_page to identify search form):** ~5-15KB (search form elements, aria-labels, page structure). Google Flights server HTML is 1.9MB but read_page would return a summarized DOM, not the full HTML.
- **Steps 4-7 (fill origin, destination, dates, search):** ~4-8KB total (4 click/type actions, ~1-2KB each)
- **Step 8 (read_page for results):** ~10-30KB (flight result cards with prices, airlines, durations, links). This is the most context-heavy step -- Google Flights may show 10-20+ results.
- **Steps 9-18 (5x open_tab + 5x read_page):** Critical context section.
  - **Per tab with full read_page:** ~20-80KB per airline site (full page DOM with pricing, booking options, seat selection, etc.)
  - **Per tab with targeted price extraction:** ~0.1-0.5KB (just the price text element and context)
  - **5 tabs total (full read):** ~100-400KB -- **this is the context bloat danger zone**
  - **5 tabs total (targeted):** ~0.5-2.5KB -- well within budget
- **Step 19 (list_tabs):** ~1-2KB (6 tab objects with id, title, url, active)
- **Step 20 (price comparison):** ~0.5KB (sorting 5 stored records)
- **Step 21 (switch_tab):** ~0.5-1KB (tab switch confirmation)
- **Step 22 (verify read_page):** ~0.1-0.5KB (targeted price re-read on cheapest tab)

### Total Context Consumed Across Full compareFlightsMultiTab Workflow

| Approach | Context Per Tab | 5-Tab Total | Full Workflow Total | Within Budget? |
|----------|----------------|-------------|---------------------|----------------|
| Full read_page per tab | 20-80KB | 100-400KB | 130-460KB | NO -- exceeds reasonable context budget |
| Targeted price extraction | 0.1-0.5KB | 0.5-2.5KB | 30-55KB | YES -- well within budget |
| Compact stored records only | ~0.05KB (50 chars) | ~0.25KB (250 chars) | 25-50KB | YES -- minimal overhead |

### Context Savings: Targeted Price Extraction vs Full DOM Reads

The key context management strategy for CONTEXT-04 is extracting ONLY the price text from each tab, not reading the full DOM.

- **Full DOM approach (5 tabs):** 100-400KB of context consumed just for tab reading. Each airline website (United, Delta, etc.) has a complex DOM with header navigation, pricing tables, seat selection, flight details, legal text, and footer. A full read_page or get_dom_snapshot would capture all of this.
- **Targeted approach (5 tabs):** 0.5-2.5KB total. On each tab, extract only the element matching [class*="price"], [class*="fare"], or the prominent dollar-amount text. Store as compact record: `{tabId: 123, price: 342, airline: "Delta", source: "delta.com/flights/..."}` -- approximately 100-200 characters per tab.
- **Context savings: 97-99% reduction** by using targeted price-only extraction instead of full DOM reads.

### Whether Compact {tabId, price, airline} Records Are Sufficient

Yes. For price comparison, the agent needs exactly 4 fields per tab:
1. `tabId` (numeric, ~3-6 characters): Required for switch_tab at the end
2. `price` (numeric, ~3-7 characters): The comparison value -- must be normalized to integer cents
3. `airline` (string, ~5-30 characters): For identification and reporting
4. `source` (URL, ~30-100 characters): For verification and debugging

Total per record: ~50-150 characters. Total for 5 records: ~250-750 characters. This is far under the 2,500-character budget specified in the google-travel.js site guide.

The compact records are fully sufficient because:
- Price comparison is a pure numeric operation on the `price` field
- The agent does not need to re-read any page content after initial extraction
- switch_tab requires only the `tabId` field
- The airline name and source URL are for reporting only, not for further interaction

### Comparison to Phase 77 (Polling Loop), Phase 78 (Multi-Step Edit), Phase 79 (Cross-Site Transfer)

| Aspect | Phase 77: CONTEXT-01 (30-Min Polling) | Phase 78: CONTEXT-02 (Notebook Edit) | Phase 79: CONTEXT-03 (PDF-to-Form) | Phase 80: CONTEXT-04 (5-Tab Price Compare) |
|--------|---------------------------------------|---------------------------------------|-------------------------------------|---------------------------------------------|
| Context growth pattern | Linear: grows per polling cycle | Step-wise: fixed set of steps | Two-phase: extract then fill | Parallel: 5 tab DOMs simultaneously |
| Total context estimate | ~180-600KB over 30 minutes | ~17-80KB total | ~32-120KB total | ~25-55KB (targeted) or ~130-460KB (full DOM) |
| Primary bloat source | Repeated full-page reads | Initial cell enumeration | textLayer extraction per page | Full DOM reads of 5 airline websites |
| Mitigation strategy | 2-snapshot retention | Targeted getText per cell | 300-char cap per page | Price-only extraction per tab (50-150 chars) |
| Cross-site navigation | No (single site polling) | No (single site editing) | Yes (PDF viewer to form) | Yes (Google Flights + 5 airline tabs) |
| Data retention pattern | Replace previous with current | Single-page cell positions | 900 chars across navigate | 5 compact records across tab switches |
| Unique challenge | Duration (30 min sustained) | Breadth (38 cells in one page) | Cross-site (data survives URL change) | Multiplicity (5 simultaneous tab contexts) |
| Context pressure | High (linear growth over time) | Medium (bounded by step count) | Low-Medium (bounded by page count) | Low (targeted) or Very High (full DOM) |

**Key insight for CONTEXT-04:** Unlike the previous CONTEXT phases, Phase 80's challenge is managing multiplicity -- 5 separate tab contexts that each contain a different airline website's DOM. The context pressure is entirely manageable if the agent follows the targeted extraction strategy (price text only per tab), but becomes a severe blocker if the agent reads full DOM on each airline site. The unique risk is that airline sites have very complex DOMs (50-200KB each) compared to simpler targets like ESPN scoreboards (~30KB), Observable notebooks (~40KB), or pdf.js viewers (~66KB).

The sequential open-and-read pattern (open tab, immediately read price, store compact record, continue to next tab) is the key mitigation. This pattern means the agent never needs to hold more than one tab's DOM in recent context at a time -- previous tab DOMs are replaced by compact stored records.

### Recommendations for Context-Efficient Multi-Tab Comparison Workflows
1. Open each tab and immediately extract the target data (price) before opening the next tab -- never open all 5 tabs then go back to read them
2. Store only the minimum data needed for comparison: {tabId, price (integer), airline, source URL} -- approximately 100-200 characters per record
3. Use targeted selectors for price extraction: [class*="price"], [class*="fare"], aria-label containing "price" or "total", elements with "$" text
4. Convert prices to integer cents immediately upon extraction to avoid string comparison errors (e.g., "$1,342.50" -> 134250)
5. Total stored context for 5 tabs should be under 2,500 characters (as specified in the google-travel.js site guide)
6. After all 5 prices are extracted and compared, switch_tab exactly once to the cheapest -- no back-and-forth navigation

## Bugs Fixed In-Phase
- **Plan 01 -- google-travel.js site guide extended (2a18d76):** Added MULTI-TAB FLIGHT PRICE COMPARISON (CONTEXT-04) guidance section, compareFlightsMultiTab workflow (18 steps), TAB LIFECYCLE documentation, CONTEXT BLOAT MITIGATION rules, TARGET SELECTION guidance, ALTERNATIVE APPROACH section, PRICE EXTRACTION PER TAB patterns, and 2 multi-tab warnings.
- **No runtime bugs found in Plan 02:** No live code was executed that could reveal runtime bugs. The diagnostic is based on HTTP-based analysis and server HTML parsing.
- **Observation: pIav2d result card class not found in server HTML.** The google-travel.js site guide specifies `.pIav2d` as the result card selector, but zero occurrences were found in the 1.9MB Google Flights server HTML. This class may be dynamically generated, may have been renamed in a Google Flights update, or may only appear on search results pages (not the homepage). The flight suggestion cards on the homepage use aria-label attributes ("Find flights from X to Y from $Z") rather than the pIav2d class. This selector requires live browser validation to determine whether it still works on actual search result pages.
- **Observation: Google Flights homepage shows popular route suggestions, not search results.** The server HTML contains 12+ flight suggestion cards for popular routes (ATL-TPA $56, DFW-ATL $92, etc.) but these are not SFO-JFK search results. Getting specific route results requires executing the search workflow, which needs live browser interaction.
- **Observation: Origin/destination aria-labels differ from site guide.** The google-travel.js site guide specifies `aria-label="Where from?"` and `aria-label="Where to?"` for the origin and destination inputs. The actual server HTML contains: `aria-label="Enter your origin"` and `aria-label="Enter your destination"` as primary labels, with "Where from?" and "Where to?" also present (2 and 4 occurrences respectively). The site guide selectors may still work but are not the primary aria-labels found in the current HTML.

## Autopilot Recommendations

1. **Use Google Flights as the aggregator starting point -- it shows prices from multiple airlines on a single results page.** Google Flights (google.com/travel/flights) aggregates flight options from dozens of airlines and OTAs. Start here to get a consolidated view of available flights with prices, then open individual airline/booking tabs for detailed comparison. The aggregator page reduces the initial search effort from 5 separate site searches to 1.

2. **Open tabs sequentially: open_tab + read_page for price + store record, then open next tab.** Do NOT open all 5 tabs at once and then go back to read them. The sequential pattern ensures: (a) you know which tabId corresponds to which flight because you read it immediately, (b) you never need to switch_tab back to read a previous tab, (c) context bloat is minimized because only one tab's DOM is in recent context at a time. The open-read-store-next loop is the safest pattern.

3. **Extract ONLY price text from each tab, not full page DOM, to minimize context consumption.** Each airline website DOM can be 50-200KB. Reading all 5 fully would consume 250KB-1MB of context. Instead, on each tab use read_page and look for specific price indicators: elements with [class*="price"], [class*="fare"], [class*="cost"], aria-label containing "price" or "total", or prominent elements containing "$" followed by digits. The extracted price text should be under 20 characters per tab.

4. **Store compact records: {tabId, price (numeric cents), airline, url} -- 4 fields per tab, under 200 characters each.** Example: `{tabId: 1234, price: 34250, airline: "Delta", source: "delta.com/flights/SFO-JFK"}`. This 4-field record is all that is needed for comparison and final tab switch. Total for 5 tabs: under 1,000 characters. Do not store flight details, seat availability, departure times, or other metadata unless the user's original task requires it.

5. **Use list_tabs after opening all 5 to verify tab IDs are stable and all tabs still open.** Chrome may occasionally discard or suspend background tabs, especially under memory pressure. After opening the 5th tab and extracting its price, call list_tabs to verify all 5 stored tabIds are still present in the browser's tab list. If any tab is missing, skip it in the comparison and proceed with the remaining tabs (require at least 3 of 5 for a valid comparison).

6. **Parse price text aggressively: strip "$", commas, whitespace, convert to integer cents for reliable comparison.** Airline sites display prices inconsistently: "$342", "$342.50", "From $342", "342 USD", "US$342", "$1,342.50". The agent must normalize all formats to a single comparable number. Best approach: extract all digit and decimal characters, multiply by 100 to get cents, and compare as integers. Example: "$1,342.50" -> "1342.50" -> 134250 cents.

7. **switch_tab to the cheapest ONCE after comparison, not back-and-forth during extraction.** The comparison is done purely on stored numeric data -- no need to revisit any tab during the comparison step. After identifying the cheapest entry in the stored array, make a single switch_tab call to that entry's tabId. This minimizes tab switching overhead and avoids the risk of losing track of which tab is active.

8. **Re-read price on the cheapest tab after switching as final verification.** After switch_tab to the cheapest tab, use read_page one more time to confirm the displayed price matches the stored value. If the price has changed (dynamic pricing, session timeout, currency switch), document the discrepancy. A small difference (rounding) is acceptable; a large difference suggests the initial extraction was incorrect.

9. **Handle airline sites that may redirect or show different prices than Google Flights preview.** Google Flights shows preview prices from partner data feeds, but clicking through to an airline site may show a different price due to: (a) dynamic pricing changes between search and click, (b) additional fees not included in Google Flights preview (seat selection, baggage), (c) currency conversion, (d) redirect to a different page than expected. If the extracted price differs significantly (>20%) from the Google Flights preview, log the discrepancy but use the actual airline site price for comparison.

10. **If a tab fails to load or price cannot be extracted: skip it and compare remaining (require at least 3 of 5).** Not all open_tab calls will succeed -- airline sites may block automation, show CAPTCHA, require login, or have DOM structures that prevent price extraction. The agent should track failures and proceed with whichever tabs successfully provided prices. A comparison of 3-4 prices is still valuable. Only fail the entire task if fewer than 3 prices can be extracted.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| `origin: [aria-label="Where from?"] input` | Origin airport input field | Found: aria-label="Where from?" appears 2 times in server HTML. Also found: aria-label="Enter your origin" as an alternative label. Both are present. The "Where from?" label likely applies to the input wrapper or combobox, with "Enter your origin" on the inner input. | PARTIAL MATCH (label exists but primary aria-label may be "Enter your origin") |
| `destination: [aria-label="Where to?"] input` | Destination airport input field | Found: aria-label="Where to?" appears 4 times in server HTML. Also found: aria-label="Enter your destination" and aria-label="Destination, Select multiple airports". Multiple aria-labels for the same functional input. | PARTIAL MATCH (label exists, multiple variants present) |
| `departDate: [aria-label="Departure"] input` | Departure date picker input | Found: aria-label="Departure" appears 4 times in server HTML. Date picker is present with calendar interaction required (per site guide warning: "do NOT type dates directly"). | MATCH (aria-label present and functional) |
| `returnDate: [aria-label="Return"] input` | Return date picker input | Found: aria-label="Return" appears 4 times in server HTML (note: "return" appears 787 times total due to JavaScript keyword usage, but the aria-label variant is clearly present). | MATCH (aria-label present) |
| `searchButton: [aria-label="Search"]` | Search/submit button | Found: "Search" appears 67+ times in server HTML including text labels, button labels, and link text. A specific aria-label="Search" element exists but would need live validation to confirm it triggers flight search. | PARTIAL MATCH (label exists, specificity needs live validation) |
| `resultCard: .pIav2d` | Flight result card container | NOT FOUND: 0 occurrences of "pIav2d" in 1,910,779 bytes of Google Flights server HTML. This class may be client-rendered, renamed, or page-specific (only on search results, not homepage). Flight suggestions on homepage use aria-label attributes instead. | NO MATCH (class not found in server HTML) |
| `price: .YMlIz` | Price display element within result card | Found: 1 occurrence of "YMlIz" in server HTML. Confirms the price class exists in the DOM but may be more prevalent on search results pages. On the homepage, prices are embedded in suggestion card aria-labels ("from $56"). | PARTIAL MATCH (1 occurrence found, may need live validation on results page) |

**Summary:** 2 of 7 selectors from the google-travel.js site guide fully match elements in the Google Flights server HTML (departDate, returnDate). 3 selectors partially match (origin, destination, searchButton -- the aria-labels exist but alternate labels like "Enter your origin" are also present). 1 selector has a minimal match (price YMlIz -- 1 occurrence). 1 selector does not match at all (resultCard pIav2d -- 0 occurrences). The result card selector requires live browser validation to determine if it appears on actual search results pages. The origin/destination selectors should be updated to include the alternate aria-labels as fallbacks.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| compareFlightsMultiTab workflow | site-guides/travel/google-travel.js | 18-step multi-tab workflow for opening 5 flight result tabs, extracting price from each, comparing prices numerically, switching to cheapest tab, and verifying the result. Steps cover: start from results page, identify 5 results, 5x open_tab+read_page+store, compare prices, list_tabs verification, switch_tab to cheapest, verify cheapest price. | (workflow in site guide, not an MCP tool) |
| MULTI-TAB FLIGHT PRICE COMPARISON guidance | site-guides/travel/google-travel.js | CONTEXT-04 guidance section covering multi-tab context retention strategy, tab lifecycle documentation (open_tab, list_tabs, switch_tab), sequential open-and-read workflow approach, alternative Google Flights results page approach, price extraction patterns for airline sites, and context bloat mitigation rules (under 2500 chars for 5 tabs). | (guidance in site guide, not an MCP tool) |
| Context bloat warning (multi-tab) | site-guides/travel/google-travel.js | Warning added to google-travel.js warnings array: "For CONTEXT-04 (5-tab flight compare): do NOT read full DOM on each tab. Extract ONLY the price element text. Store compact {tabId, price, airline} records. Total stored context for 5 tabs should be under 2500 characters." | (warning text, not an MCP tool) |
| Multi-tab tabId tracking warning | site-guides/travel/google-travel.js | Warning about tab ID management: "Multi-tab workflow: open_tab returns tabId immediately. Always store the tabId before opening the next tab. switch_tab requires the exact numeric tabId from open_tab or list_tabs." | (warning text, not an MCP tool) |

**Note:** No new MCP tools were added in Phase 80. The multi-tab flight comparison workflow relies on existing MCP tools: `open_tab` (url), `switch_tab` (tabId), `list_tabs` (no params), `read_page` (no params), `navigate` (url), `click` (selector), `type_text` (text), `wait_for_stable` (no params). The key additions are the compareFlightsMultiTab workflow (18 steps), CONTEXT-04 guidance section with tab lifecycle documentation, and context bloat mitigation rules in google-travel.js. The persistent WebSocket bridge fix remains the primary tool gap blocking all live MCP testing since Phase 55. For CONTEXT-04 specifically, a targeted `get_text_by_selector(selector)` tool and a `read_tab(tabId)` tool (read without switching) would simplify and optimize the multi-tab price extraction workflow.

---
*Phase: 80-multi-tab-flight-price-compare*
*Diagnostic generated: 2026-03-22*
