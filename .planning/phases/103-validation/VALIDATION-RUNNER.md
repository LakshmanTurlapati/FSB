# Phase 103: Autopilot Validation Runner

**Generated:** 2026-03-23T08:28:34.522Z
**Test Cases:** 50
**Milestone Gate:** 90%+ pass rate (45/50 minimum)

## How To Use

1. Open the FSB extension in Chrome with autopilot mode enabled
2. For each test case below, paste the Autopilot Prompt into the FSB chat input
3. Let autopilot execute the task
4. Record results in the tracking columns:
   - **Result**: PASS, FAIL, or SKIP (with reason)
   - **CLI Parse Failures**: Count of CLI parse errors during the run (check console/logs)
   - **Completion Correct**: YES if autopilot's done/not-done determination matched reality, NO if it declared done when not done or vice versa
   - **Notes**: Any observations about the run
5. After all 50 tests, scroll to the Metrics section for automatic tallies

## Quick Reference

### Category Descriptions

**CANVAS** -- Canvas/visual editor interactions requiring CDP coordinate-based tools (click_at, drag). Tests: TradingView drawing, Figma alignment, Google Maps tracing, browser games, image editors, 3D viewers, piano keys, PDF signatures, Miro boards.
- MCP Baseline: 2 PASS, 7 PARTIAL, 0 FAIL, 1 SKIP-AUTH

**MICRO-INTERACTION** -- Precise UI micro-interactions requiring exact positioning and timing. Tests: volume sliders, click-and-hold recording, drag-and-drop reorder, text selection, color pickers, carousel scrolling, mega-menu hover navigation, file upload dropzones, slider CAPTCHAs, podcast timeline scrubbing.
- MCP Baseline: 0 PASS, 10 PARTIAL, 0 FAIL, 0 SKIP-AUTH

**SCROLL** -- Infinite scroll, pagination, and large dataset navigation. Tests: Twitter feed counting (150 posts), Amazon product scraping (500 items), GitHub activity log search, Reddit thread bottom reply, virtualized PDF readers, HN comment expansion, Airbnb map panning, TikTok search, pricing table extraction, date-stop scrolling.
- MCP Baseline: 0 PASS, 10 PARTIAL, 0 FAIL, 0 SKIP-AUTH

**CONTEXT** -- Multi-tab, multi-step, and stateful workflows requiring context persistence. Tests: live score monitoring, Observable notebook editing, PDF-to-form data transfer, multi-tab flight comparison, checkout correction flows, chatbot conversations, 2FA flows, Google Doc editing, CRM cross-referencing, session expiry recovery.
- MCP Baseline: 0 PASS, 9 PARTIAL, 0 FAIL, 1 SKIP-AUTH

**DARK** -- Dark pattern and adversarial UI detection and avoidance. Tests: fake download button avoidance, hidden cookie reject buttons, shuffled cancel buttons, camouflaged close buttons, adblocker modal bypass, misleading price highlighting, pre-checked newsletter uncheck, buried login links, skip-ad countdowns, anti-scrape text extraction.
- MCP Baseline: 0 PASS, 10 PARTIAL, 0 FAIL, 0 SKIP-AUTH

### Expected Difficulty Ranking (by MCP baseline performance)

| Rank | Category | MCP Pass Rate | Difficulty for Autopilot |
|------|----------|---------------|-------------------------|
| 1 | CANVAS | 2/10 (20%) | Hard |
| 2 | MICRO | 0/10 (0%) | Very Hard |
| 3 | SCROLL | 0/10 (0%) | Very Hard |
| 4 | CONTEXT | 0/10 (0%) | Very Hard |
| 5 | DARK | 0/10 (0%) | Very Hard |

### Overall MCP Baseline Summary

- PASS: 2/50
- PARTIAL: 46/50
- FAIL: 0/50
- SKIP-AUTH: 2/50

## Test Cases

### CANVAS (01-10)

| # | Req ID | Phase | Autopilot Prompt | MCP Baseline | Result | CLI Parse Failures | Completion Correct | Notes |
|---|--------|-------|------------------|--------------|--------|-------------------|-------------------|-------|
| 1 | CANVAS-01 | 47 | Draw a Fibonacci retracement on the TradingView chart from a local low to a local high. | PASS | | | | |
| 2 | CANVAS-02 | 48 | Create a frame, draw 3 rectangles inside it, and align all 3 using toolbar alignment buttons in Excalidraw. | PARTIAL | | | | |
| 3 | CANVAS-03 | 49 | Zoom Google Maps to Central Park Reservoir and trace the walking path around the reservoir perimeter. | PARTIAL | | | | |
| 4 | CANVAS-04 | 50 | Play browser-based solitaire on Google and move a specific card to a valid target pile. | PARTIAL | | | | |
| 5 | CANVAS-05 | 51 | Open an image in Photopea, select the Magic Wand tool, click on the background area, and press Delete to remove the background. | PARTIAL | | | | |
| 6 | CANVAS-06 | 52 | Navigate to a 3D product viewer for a shoe, activate the 3D view, and drag horizontally across half the viewer to rotate the shoe approximately 180 degrees. | PARTIAL | | | | |
| 7 | CANVAS-07 | 53 | Navigate to a canvas-rendered browser game, locate a canvas-painted button (Play/Start), and click it at pixel coordinates using click_at. | PARTIAL | | | | |
| 8 | CANVAS-08 | 54 | Navigate to an online piano keyboard, play the first four notes of Mary Had a Little Lamb (E-D-C-D) using press_key keyboard mapping or click_at coordinates. | PASS | | | | |
| 9 | CANVAS-09 | 55 | Navigate to an online PDF editor, open a multi-page PDF, navigate to page 3, activate the signature tool, and place a signature on the dotted line area. | PARTIAL | | | | |
| 10 | CANVAS-10 | 56 | Navigate to Miro, create a blank board, place 3 sticky notes ('Idea A' at 400,300, 'Idea B' at 700,500, 'Idea C' at 300,600) using the N key shortcut and cdpClickAt, then switch to selection mode (V) and cdpDrag each note toward a central cluster area (~450, 400) to group them. Verify note proximity via read_page or get_dom_snapshot. | SKIP-AUTH | | | | |

### MICRO-INTERACTION (01-10)

| # | Req ID | Phase | Autopilot Prompt | MCP Baseline | Result | CLI Parse Failures | Completion Correct | Notes |
|---|--------|-------|------------------|--------------|--------|-------------------|-------------------|-------|
| 11 | MICRO-01 | 57 | Navigate to an HTML5 video player page, locate the custom volume slider, and adjust it to exactly 37%. | PARTIAL | | | | |
| 12 | MICRO-02 | 58 | Navigate to an online voice recorder, locate the record button, click and hold it for 5 seconds then release, and verify that a recording was captured. | PARTIAL | | | | |
| 13 | MICRO-03 | 59 | Navigate to a Kanban board (Trello or similar), identify the bottom card in one list, drag and drop it to the top of another list, and verify the card moved successfully. | PARTIAL | | | | |
| 14 | MICRO-04 | 60 | Navigate to the Albert Einstein Wikipedia article, identify the third paragraph, and highlight exactly the second sentence of that paragraph. | PARTIAL | | | | |
| 15 | MICRO-05 | 61 | Navigate to colorpicker.me, drag the hue slider to select blue, position the shade reticle for high saturation and brightness, and verify the hex value is approximately #2196F3. | PARTIAL | | | | |
| 16 | MICRO-06 | 62 | Navigate to amazon.com, find a horizontal product carousel, scroll it to the right to reveal more items, and verify that the page did not scroll vertically. | PARTIAL | | | | |
| 17 | MICRO-07 | 63 | Navigate to bestbuy.com, hover over the 'Products' navigation item to open the mega-menu, then click on a sub-category link (e.g., 'Computer Accessories') inside the mega-menu to navigate to that category page. | PARTIAL | | | | |
| 18 | MICRO-08 | 64 | Navigate to dropzonejs.com, find the file upload dropzone area, simulate dropping a text file named 'test-document.txt' onto the dropzone using the drop_file tool, and verify the file was accepted (file name displayed, upload progress shown). | PARTIAL | | | | |
| 19 | MICRO-09 | 65 | Navigate to a slider CAPTCHA demo page, find the slider thumb element, drag it to the target position using drag_variable_speed with ease-in-out timing (slow start, fast middle, slow end), and verify the CAPTCHA was solved (success indicator displayed or slider completed). | PARTIAL | | | | |
| 20 | MICRO-10 | 66 | Navigate to a public podcast episode page, find the audio timeline/progress bar, click at the calculated pixel position for 14:22 (862 seconds into the episode), and verify the current time display shows approximately 14:22 (within 5 seconds tolerance). | PARTIAL | | | | |

### SCROLL (01-10)

| # | Req ID | Phase | Autopilot Prompt | MCP Baseline | Result | CLI Parse Failures | Completion Correct | Notes |
|---|--------|-------|------------------|--------------|--------|-------------------|-------------------|-------|
| 21 | SCROLL-01 | 67 | Navigate to a public X/Twitter profile page, scroll through the infinite feed counting posts via permalink deduplication across DOM snapshots, reach the 150th post, and extract its text content. | PARTIAL | | | | |
| 22 | SCROLL-02 | 68 | Navigate to Amazon, search for a broad product category, extract product names from search results across paginated pages using ASIN-based deduplication, collect 500 unique product names. | PARTIAL | | | | |
| 23 | SCROLL-03 | 69 | Navigate to a public GitHub user profile, scroll through the activity feed to find a log entry from 3 days ago, extract the entry text and timestamp. | PARTIAL | | | | |
| 24 | SCROLL-04 | 70 | Navigate to a populated Reddit thread, scroll to the very bottom of the comment thread, identify the last comment, and attempt to reply to it. | PARTIAL | | | | |
| 25 | SCROLL-05 | 71 | Navigate to a multi-page PDF in a virtualized viewer, scroll through multiple pages reading text content, scroll back to a previously visited page, and verify the text is consistent after page re-rendering. | PARTIAL | | | | |
| 26 | SCROLL-06 | 72 | Navigate to a Hacker News post with 1000+ comments, expand all comment thread pages by clicking morelinks, and count the total expanded comments. | PARTIAL | | | | |
| 27 | SCROLL-07 | 73 | Navigate to Airbnb search results for San Francisco, pan the map eastward using CDP drag, wait for new listing pins to load, and verify different listings appeared in the new viewport area. | PARTIAL | | | | |
| 28 | SCROLL-08 | 74 | Navigate to TikTok search results for 'cat', read video descriptions from search result cards, identify the first video containing cat-related content, and extract its URL and description. | PARTIAL | | | | |
| 29 | SCROLL-09 | 75 | Navigate to Notion pricing page, find the feature comparison table, extract all plan column headers and feature rows by scrolling the table into viewport section by section, deduplicating rows by feature name, and assembling a complete pricing data structure. | PARTIAL | | | | |
| 30 | SCROLL-10 | 76 | Navigate to BBC News, scroll through the article feed checking publication timestamps on each article, stop scrolling when reaching articles published yesterday, and extract the headlines and links of yesterday's articles. | PARTIAL | | | | |

### CONTEXT (01-10)

| # | Req ID | Phase | Autopilot Prompt | MCP Baseline | Result | CLI Parse Failures | Completion Correct | Notes |
|---|--------|-------|------------------|--------------|--------|-------------------|-------------------|-------|
| 31 | CONTEXT-01 | 77 | Navigate to ESPN scoreboard, take an initial snapshot of all game scores, then poll every 30-60 seconds for 30 minutes. On each poll, compare current scores to previous snapshot and log any changes. After 30 minutes, produce a summary of all detected score changes. | PARTIAL | | | | |
| 32 | CONTEXT-02 | 78 | Navigate to a public Observable notebook, fork it (or use tinker mode), modify the data array in cell 3, and verify that cell 1 content remains unchanged after the edit. | PARTIAL | | | | |
| 33 | CONTEXT-03 | 79 | Navigate to a pdf.js viewer with a long PDF document, extract text from pages 4, 17, and 42, then navigate to a web form and fill 3 fields with the extracted page text. | PARTIAL | | | | |
| 34 | CONTEXT-04 | 80 | Search for flights from SFO to JFK on Google Flights, open 5 result options in separate tabs, extract the price from each tab, compare all 5 prices, and switch back to the tab with the cheapest flight. | PARTIAL | | | | |
| 35 | CONTEXT-05 | 81 | Navigate to a demo e-commerce store, add a product to cart, proceed to checkout, enter shipping address with wrong zip code 99501 (Alaska), observe tax calculation, go back and correct zip to 10001 (New York), verify the tax amount changes. | PARTIAL | | | | |
| 36 | CONTEXT-06 | 82 | Navigate to a website with an automated support chatbot, open the chat widget, send 15 messages to the chatbot (waiting for each response), then scroll to the top of the conversation and summarize the first instruction the chatbot gave. | PARTIAL | | | | |
| 37 | CONTEXT-07 | 83 | Navigate to a website with 2FA login, enter credentials, trigger email verification code delivery, open a new browser tab to the email provider, find and extract the verification code, switch back to the authentication tab, enter the code, and complete login. | PARTIAL | | | | |
| 38 | CONTEXT-08 | 84 | Open a Google Doc containing the word 'synergy', manually find and replace every occurrence of 'synergy' with 'collaboration' without using the Find and Replace dialog (Ctrl+H). Use Find (Ctrl+F) to locate each occurrence, double-click to select the word, and type the replacement. | SKIP-AUTH | | | | |
| 39 | CONTEXT-09 | 85 | Open a web CRM containing employee records, extract 50 employee names. Open a separate HR portal in a new tab. Cross-reference each name from the CRM against the HR portal. Report which names appear in both systems, which are CRM-only, and which are HR-only. | PARTIAL | | | | |
| 40 | CONTEXT-10 | 86 | Navigate to a web application, log in, and begin reading a page. The session expires mid-task (simulated via logout). Detect the session expiration, re-authenticate with the same credentials, and resume reading the same page to verify the content matches what was seen before the session expired. | PARTIAL | | | | |

### DARK (01-10)

| # | Req ID | Phase | Autopilot Prompt | MCP Baseline | Result | CLI Parse Failures | Completion Correct | Notes |
|---|--------|-------|------------------|--------------|--------|-------------------|-------------------|-------|
| 41 | DARK-01 | 87 | Navigate to a freeware download site (SourceForge), find the download page for a popular program (VLC), identify the real download link while ignoring all fake 'Download Now' ad buttons, and click only the real download link to initiate the download. | PARTIAL | | | | |
| 42 | DARK-02 | 88 | Navigate to an EU news site (The Guardian), detect the cookie consent banner, avoid clicking 'Accept All', find the hidden 'Reject All' option through the 'Manage my cookies' intermediary layer, opt out of all non-essential cookies, and verify the consent banner is dismissed. | PARTIAL | | | | |
| 43 | DARK-03 | 89 | Navigate to a subscription cancellation page with shuffled Keep/Cancel button positions, identify the correct Cancel button by reading text content (not relying on position), click Cancel, and verify the cancellation was confirmed. | PARTIAL | | | | |
| 44 | DARK-04 | 90 | Navigate to a page with a pop-up ad overlay, find the close (X) button that is camouflaged against the background using DOM attribute analysis, click the close button, and verify the pop-up is dismissed. | PARTIAL | | | | |
| 45 | DARK-05 | 91 | Navigate to a news site with an adblocker detection modal that has no close button, bypass the modal by removing the overlay element from the DOM, restore body scroll and content interactivity, and verify the page content is accessible. | PARTIAL | | | | |
| 46 | DARK-06 | 92 | Navigate to an airline flight search results page, identify the cheapest available flight by extracting and comparing all visible prices from the DOM (ignoring visual highlighting, badges, and position), select the cheapest option, and verify the selection. | PARTIAL | | | | |
| 47 | DARK-07 | 93 | Navigate to an e-commerce registration or checkout form, find all checkboxes via DOM analysis, identify any pre-checked newsletter/marketing subscription checkbox by analyzing label text and name/id attributes, uncheck it using the check_box tool, verify the unchecked state, and submit the form. | PARTIAL | | | | |
| 48 | DARK-08 | 94 | Navigate to a SaaS homepage, find all clickable elements via DOM analysis, classify each by text content and href as login-intent vs signup-intent, identify the login link buried among dominant Sign Up CTAs, click the login link, and verify the login page loads with email and password inputs. | PARTIAL | | | | |
| 49 | DARK-09 | 95 | Navigate to a video page with pre-roll ads, detect the ad overlay, wait for the 5-second countdown to complete and the Skip Ad button to appear using wait_for_element, click the Skip Ad button, and verify the ad is dismissed and the video content plays. | PARTIAL | | | | |
| 50 | DARK-10 | 96 | Navigate to a site that blocks right-clicks, disables text selection, and uses obfuscated CSS class names, then extract the full article text using DOM-level tools (get_dom_snapshot, read_page, get_text) that bypass these UI-layer anti-scrape protections. | PARTIAL | | | | |

## Metrics

### VALID-02: Pass Rate
- Total tests: 50
- Passed: ___ / 50
- Pass rate: ___% (gate: 90% / 45 minimum)
- Status: [ ] GATE MET / [ ] GATE NOT MET

### VALID-03: CLI Parse Failure Rate
- Total CLI actions across all 50 runs: ___
- Total CLI parse failures: ___
- Parse failure rate: ___% (gate: <5%)
- Status: [ ] GATE MET / [ ] GATE NOT MET

### VALID-04: Completion Accuracy
- Total completion judgments: 50
- Correct judgments: ___ / 50
- Accuracy: ___% (gate: 90%+)
- Status: [ ] GATE MET / [ ] GATE NOT MET

### Overall Milestone Gate
- [ ] VALID-02: Pass rate >= 90%
- [ ] VALID-03: Parse failure rate < 5%
- [ ] VALID-04: Completion accuracy >= 90%
- [ ] ALL GATES MET -- v0.9.8 milestone complete
