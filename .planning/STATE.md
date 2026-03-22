---
gsd_state_version: 1.0
milestone: v0.9.7
milestone_name: milestone
status: unknown
stopped_at: Completed 83-01-PLAN.md
last_updated: "2026-03-22T07:12:48.432Z"
progress:
  total_phases: 50
  completed_phases: 36
  total_plans: 74
  completed_plans: 73
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely
**Current focus:** Phase 83 — 2fa-multi-tab-auth-flow

## Current Position

Phase: 83 (2fa-multi-tab-auth-flow) — EXECUTING
Plan: 2 of 2

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

- [MCP-FIX] Fixed 18/28 broken MCP verb mappings (lowercase -> camelCase FSB.tools keys)
- [MCP-FIX] Fixed get_dom_snapshot action name (getStructuredDOM -> getDOM)
- [MCP-FIX] Fixed mcp:get-memory reading from deprecated storage keys
- [MCP-FIX] Wired onProgress callback in autopilot run_task
- [MCP-FIX] Fixed mcpProgressCallbacks memory leak in cleanupSession
- [MCP-FIX] Added 5 observability tools (list_sessions, get_session_detail, get_logs, search_memory, get_memory_stats)
- [DIAG] Autopilot uses grok-4-1-fast-reasoning (times out on 11K token prompts) or grok-4-1-fast-non-reasoning (works but wastes iterations on CLI parse failures)
- [DIAG] Autopilot completed LinkedIn task in 2m40s with 19 iterations (12 actions, 7 empty) vs manual mode 25s with 6 actions
- [DIAG] Autopilot key weaknesses: wrong element clicks, CLI reformat retry loops, premature task completion, 452K input tokens for simple task
- [Phase 47]: CANVAS-01 outcome PASS: Fibonacci drawn via CDP click_at click-click pattern, all 7 levels confirmed
- [Phase 47]: TradingView Fibonacci uses click-click pattern (two separate CDP clicks), NOT click-drag -- confirmed via live test
- [Phase 48]: CDP click_at and drag tools now support shift/ctrl/alt modifiers via bitmask (1=Alt, 2=Ctrl, 8=Shift)
- [Phase 48]: CANVAS-02 outcome PARTIAL: Excalidraw drawing works via press_key+cdpDrag, multi-select blocked by MCP server restart needed for modifier params
- [Phase 49]: [Phase 49-01] CDP mouseWheel follows attach/dispatch/detach pattern; default deltaY=-120 for standard zoom-in tick
- [Phase 49]: [Phase 49-02]: CANVAS-03 PARTIAL -- site guide created with research-based selectors, live MCP test deferred to checkpoint
- [Phase 49]: CANVAS-03 human-verify approved: PARTIAL outcome accepted (tooling ready, research-based selectors)
- [Phase 50]: [Phase 50-01] Separate site-guides/games/ directory for browser-playable games vs site-guides/gaming/ for store-fronts
- [Phase 50]: [Phase 50-01] Research-based selectors with multiple fallback patterns for Google Solitaire -- to be validated in Plan 02 live MCP test
- [Phase 50]: [Phase 50]: CANVAS-04 PARTIAL -- game launches, CDP tools work through iframe, but card moves unverifiable without iframe DOM access
- [Phase 51]: Research-based selectors for Photopea custom UI framework -- to be validated in Plan 02 live MCP test
- [Phase 51]: URL hash method (photopea.com#open:URL) as simplest image loading path for automation
- [Phase 51]: CANVAS-05 outcome PARTIAL: Photopea renders entire UI via single HTML5 canvas -- zero DOM elements for editor features, all site guide selectors invalid
- [Phase 51]: Only viable Photopea automation: pixel-coordinate maps at known viewport sizes or Photopea JS API (photopea.com/api)
- [Phase 52]: Research-based selectors for Nike model-viewer and Sketchfab iframe -- to be validated in Plan 02 live test
- [Phase 52]: Half-width horizontal drag formula for 180-degree rotation: startX=left+width*0.25, endX=left+width*0.75
- [Phase 52]: CANVAS-06 outcome PARTIAL: CDP drag works on Sketchfab iframe WebGL canvas, Nike product page returned discontinued -- Sketchfab is reliable 3D test target
- [Phase 52]: 600px horizontal CDP drag at 30 steps / 20ms delay produces smooth 3D rotation on Sketchfab
- [Phase 53]: Target itch.io HTML5 games as primary canvas game platform with percentage-based coordinate calculation for viewport independence
- [Phase 53]: [Phase 53]: CANVAS-07 outcome PARTIAL: CDP click_at confirmed on Poki/Crossy Road game iframe, canvas button targeting blocked by game loading ads
- [Phase 54]: virtualpiano.net primary target with A=C4, S=D4, D=E4 keyboard mapping; press_key preferred over click_at for keyboard-mapped pianos
- [Phase 54]: CANVAS-08 outcome PASS: all 4 notes played via press_key debuggerAPI on virtualpiano.net with corrected mapping t=C4,y=D4,u=E4
- [Phase 55]: Smallpdf.com as primary target for PDF signature placement -- free, no-auth, widely used
- [Phase 55]: Type signature option preferred over Draw for automation simplicity; DOM click for toolbar, click_at for page-level placement
- [Phase 55]: CANVAS-09 outcome PARTIAL: Smallpdf navigation confirmed via live MCP, DOM-based UI verified, signature placement blocked by WebSocket bridge disconnect
- [Phase 56]: Miro site guide placed in site-guides/design/ alongside Excalidraw and Photopea
- [Phase 56]: N key as preferred sticky note shortcut, 20+ cdpDrag steps with 15ms delay for Miro canvas
- [Phase 56]: CANVAS-10 SKIP-AUTH: Miro requires sign-in, Excalidraw recommended as auth-free fallback for whiteboard automation
- [Phase 57]: New Media category section in background.js between Music and Productivity for video player site guides
- [Phase 57]: Dual interaction methods for volume slider: click_at on track (preferred) and drag thumb (fallback) with 35-39% acceptance range
- [Phase 57]: MICRO-01 outcome PARTIAL: volume slider site guide and tools confirmed, live execution blocked by WebSocket bridge disconnect
- [Phase 57]: Two potential tool gaps identified: set_input_value for range inputs, get_bounding_rect for precision positioning
- [Phase 58]: Dedicated click_and_hold tool instead of reusing drag with same start/end -- cleaner semantics, no unnecessary mouseMoved events
- [Phase 58]: MICRO-02 outcome PARTIAL: click_and_hold tool chain verified, live execution blocked by WebSocket bridge disconnect, toggle-to-record recommended as default
- [Phase 59]: drag_drop MCP tool placed in Interaction tools section (DOM selectors) not CDP section (coordinates)
- [Phase 59]: holdMs=200 recommended for react-beautiful-dnd drag recognition (vs default 150)
- [Phase 59]: MICRO-03 outcome PARTIAL: drag_drop tool chain complete with 3-method fallback, live execution blocked by WebSocket bridge disconnect
- [Phase 60]: Range API with TreeWalker for text selection instead of CDP drag coordinate approach -- deterministic across fonts and zoom levels
- [Phase 60]: Reference category for Wikipedia site guide placed after Design & Whiteboard in background.js import order
- [Phase 60]: MICRO-04 outcome PARTIAL: select_text_range tool chain validated via HTTP simulation, sentence boundary offsets 113-345 confirmed, live browser execution blocked by WebSocket bridge disconnect
- [Phase 61]: click_at as preferred tool over drag for color picker hue strip and shade area interaction
- [Phase 61]: Utilities site guide category created (site-guides/utilities/) for tool-type web apps
- [Phase 61]: MICRO-05 PARTIAL: all selectors and interaction model validated via live DOM, hue formula inversion bug found, WebSocket bridge disconnect blocked physical execution
- [Phase 62]: Arrow buttons as preferred carousel interaction method -- zero vertical scroll risk, works on CSS transform carousels
- [Phase 62]: MICRO-06 PARTIAL: Target.com carousel selectors validated via live DOM, physical execution blocked by WebSocket bridge disconnect
- [Phase 63]: Two interaction strategies for mega-menus: DOM hover+click (JS menus) and CDP drag+click_at (CSS :hover menus) with L-shaped hover path
- [Phase 63]: MICRO-07 PARTIAL: Lowes navigation DOM validated (click-to-open modal pattern with data-linkid), physical hover/click blocked by WebSocket bridge disconnect
- [Phase 63]: Three mega-menu strategies needed: DOM hover (JS menus), CDP coordinate path (CSS :hover), click-to-open modal (Lowes/Amazon pattern)
- [Phase 64]: drop_file tool creates real File object + DataTransfer + full DragEvent sequence (dragenter, dragover, drop, dragleave) for dropzone interaction
- [Phase 64]: Two file upload strategies: Strategy A (drop_file DragEvent, preferred) and Strategy B (hidden input[type=file] click, fallback)
- [Phase 64]: MICRO-08 PARTIAL: drop_file tool chain validated against 3 live sites, WebSocket bridge disconnect blocked physical DragEvent dispatch
- [Phase 65]: Quadratic speed curve (1-4*(t-0.5)^2) for ease-in-out variable-speed drag -- simpler than cubic, produces desired slow-fast-slow pattern
- [Phase 65]: drag_variable_speed as Strategy A (preferred) for slider CAPTCHAs, regular drag as Strategy B (fallback) for position-only checks
- [Phase 65]: [Phase 65]: MICRO-09 outcome PARTIAL: drag_variable_speed tool chain validated, GEETEST JS-rendered DOM confirmed, live execution blocked by WebSocket bridge disconnect
- [Phase 66]: Podcast-player site guide with 12 platform patterns, click_at/drag workflows for 14:22 timeline scrub, 5-second tolerance verification
- [Phase 66]: Buzzsprout confirmed as primary podcast test target -- server-rendered audio player with native input[type=range] and full ARIA attributes
- [Phase 66]: MICRO-10 outcome PARTIAL: DOM validation and calculation complete (862/2144=40.2%), live CDP execution blocked by WebSocket bridge disconnect
- [Phase 67]: Permalink hrefs as unique post identifiers for deduplication across virtualized DOM snapshots
- [Phase 67]: cellInnerDiv as timeline item wrapper with tweet/ad/suggestion discrimination
- [Phase 67]: Public profile fallback when home feed requires auth
- [Phase 67]: SCROLL-01 outcome PARTIAL: HTTP validation confirms page accessibility and SPA architecture, live MCP execution blocked by WebSocket bridge disconnect
- [Phase 67]: X/Twitter serves identical 245KB React SPA shell for all profiles -- zero server-rendered tweets, all selectors require live browser
- [Phase 68]: ASIN (data-asin attribute) as unique product identifier for deduplication across pagination pages
- [Phase 68]: 14-step scrapeAllSearchResults workflow covering search, extraction, pagination, and verification
- [Phase 68]: SCROLL-02 PARTIAL outcome: Amazon selectors validated via HTTP on amazon.in, ASIN deduplication confirmed, live MCP blocked by WebSocket bridge disconnect
- [Phase 69-dashboard-log-entry-search]: GitHub activity feed persists DOM elements during scroll (not virtualized), deduplication by event href recommended
- [Phase 69-dashboard-log-entry-search]: relative-time datetime attribute preferred over displayed text for precise date comparison in activity feeds
- [Phase 69]: GitHub uses contributions tab not activity tab -- activityTab selector incorrect, needs site guide update
- [Phase 69]: relative-time datetime attributes are client-rendered only -- HTTP validation cannot test timestamp parsing, live browser required
- [Phase 69]: GitHub REST API as fallback data source: 5 torvalds commits on March 18 confirmed without auth (60 req/hour unauthenticated)
- [Phase 70]: Documented both new Reddit (Shreddit web components) and old Reddit (div.comment) DOM structures for maximum thread navigation compatibility
- [Phase 70]: Sort by Old recommended for chronological bottom = most recent comment; SKIP-AUTH documented for reply portion
- [Phase 70]: Old Reddit (old.reddit.com) confirmed as preferred automation target -- server-renders 184 comments vs new Reddit 1 in server HTML
- [Phase 70]: Expansion-first strategy for load-more buttons: click all 73 before scrolling, not click-as-encountered
- [Phase 70]: Three reddit.js selectors confirmed incorrect: loadMoreComments (a.morecomments -> a.button[id^=more_t1]), sortComments (select -> div.dropdown), loginModal (data-testid -> a[href*=/login])
- [Phase 71]: Separate pdf-viewer.js from pdf-editor.js -- viewer targets read-only text extraction from virtualized pages, editor targets Smallpdf signature placement
- [Phase 71]: Page number input (#pageNumber) preferred over scroll-distance estimation for pdf.js viewer navigation reliability
- [Phase 71]: textLayer span concatenation as text extraction strategy for pdf.js viewers -- spans contain plain text in DOM order
- [Phase 71]: SCROLL-05 PARTIAL: pdf.js viewer validated via HTTP + source analysis, live MCP blocked by WebSocket bridge disconnect, 4 selector corrections identified
- [Phase 72]: Morelink is full page navigation (not AJAX) -- critical distinction from Reddit inline load-more
- [Phase 72]: News site guide category (site-guides/news/) created between Reference and Utilities in background.js
- [Phase 72]: HN loads ALL comments on single page (no morelink pagination on threads) -- tested up to 2530 comments / 3.5MB HTML
- [Phase 72]: SCROLL-06 outcome PARTIAL: 11/14 selectors validated, HTTP DOM validation comprehensive, live MCP blocked by WebSocket bridge disconnect
- [Phase 73]: Adapted Google Maps CDP drag panning pattern for Airbnb map with 2000-3000ms post-pan wait for API response + pin rendering
- [Phase 73]: data-testid selectors (map/markers/BasePillMarker) preferred over CSS class selectors for pin detection stability
- [Phase 73]: SCROLL-07 PARTIAL: Airbnb map container validated via data-testid, listing pins confirmed client-rendered React, live CDP drag panning blocked by WebSocket bridge disconnect
- [Phase 74]: data-e2e attribute selectors preferred over CSS class names for TikTok (dynamic tiktok-* classes change between deployments)
- [Phase 74]: Search page (tiktok.com/search?q=cat) as primary no-auth target over For You feed; tag page as fallback
- [Phase 74]: SCROLL-08 PARTIAL: TikTok fully client-rendered SPA, zero content in server HTML, all 11 data-e2e selectors untestable via HTTP
- [Phase 74]: TikTok SIGI_STATE pattern deprecated -- __UNIVERSAL_DATA_FOR_REHYDRATION__ contains only app config, not content data
- [Phase 75]: Feature name text as unique deduplication key for pricing table rows across scroll cycles
- [Phase 75]: Notion pricing page as primary SCROLL-09 target, Airtable pricing as fallback; 400-600px scroll increments for viewport-gated table extraction
- [Phase 75]: Notion pricing page fully server-rendered (58 rows in 429KB HTML); CSS Module prefix matching needed for React SaaS sites
- [Phase 75]: SCROLL-09 outcome PARTIAL: all 58 feature rows extractable from server HTML, live scroll-read-deduplicate loop blocked by WebSocket bridge disconnect
- [Phase 76]: BBC News as primary target with CNN/Reuters fallback for date-based scroll stop
- [Phase 76]: datetime attribute parsing preferred over relative text for date comparison accuracy
- [Phase 76]: Article link href as unique deduplication key across scroll batches
- [Phase 76]: BBC uses __NEXT_DATA__ JSON timestamps (Unix ms) not time[datetime] ISO 8601 -- site guide datetime strategy does not apply
- [Phase 76]: BBC homepage is finite curated page (47 articles) not true infinite scroll -- scroll sentinel absent
- [Phase 77]: ESPN as primary scoreboard target with CBS Sports and NBA.com fallback; 2-snapshot retention for context bloat mitigation over 30-minute polling
- [Phase 77]: CONTEXT-01 outcome PARTIAL: ESPN NBA scoreboard HTTP polling confirmed 3 score changes across 5 polls, 13/27 selectors matched, 2-snapshot retention validated, 30-minute sustained polling blocked by WebSocket bridge disconnect
- [Phase 77]: Embedded JSON (window.__CONFIG__ evts array) more reliable than DOM scraping for ESPN game data -- provides event IDs, scores, records, and machine-readable status
- [Phase 78]: Tinker mode as skip-auth fallback for Observable forking -- sufficient for CONTEXT-02 demonstration
- [Phase 78]: Cell identification by DOM position (0-indexed) since Observable has no visible cell numbers
- [Phase 78]: Baseline capture and comparison strategy for verifying cell 1 unchanged after cell 3 edit
- [Phase 78]: [Phase 78]: CONTEXT-02 outcome PARTIAL: Observable is full Next.js SPA with zero cell DOM in server HTML, 38 cells found via __NEXT_DATA__ JSON, context bloat is breadth-based (targeted getText mitigation), live cell editing blocked by WebSocket bridge disconnect
- [Phase 79]: 300-character per-page text budget for context bloat mitigation during cross-site PDF-to-form data transfer
- [Phase 79]: CONTEXT-03 outcome PARTIAL: pdf.js viewer toolbar and httpbin form validated via HTTP, cross-site PDF-to-form chain blocked by WebSocket bridge disconnect, context bloat analysis shows 85-95% savings from selective page reading
- [Phase 80]: Sequential open-and-read pattern for multi-tab comparison: open each tab and extract price immediately before opening the next
- [Phase 80]: Under-2500-character context budget for 5-tab workflows: extract only price text per tab, not full DOM
- [Phase 80]: CONTEXT-04 outcome PARTIAL: Google Flights HTTP-validated with 12+ server-rendered flight suggestions containing prices in aria-labels, 5-tab workflow blocked by WebSocket bridge disconnect
- [Phase 80]: pIav2d result card selector not found in Google Flights server HTML (0 occurrences in 1.9MB) -- may be client-rendered or renamed
- [Phase 80]: Context Bloat Analysis: 97-99% savings from targeted price-only extraction (0.5-2.5KB) vs full DOM reads (100-400KB) across 5 airline tabs
- [Phase 81]: 5 demo store targets prioritized by auth-free checkout: automationexercise.com primary, 4 fallbacks; Alaska 99501 vs New York 10001 for maximum tax differential
- [Phase 81]: SauceDemo confirmed as best CONTEXT-05 target over automationexercise.com -- stable data-test selectors, editable postalCode field, subtotal/tax/total summary display
- [Phase 81]: CONTEXT-05 outcome PARTIAL: checkout forms validated across 5 demo stores, clear_input + type_text correction documented, but no demo store has zip-dependent tax and live MCP blocked by WebSocket bridge disconnect
- [Phase 82]: 10 chatbot provider URL patterns covering Intercom, Zendesk, Drift, Crisp, Tawk.to, Freshdesk, HubSpot, Tidio, LiveChat, HelpScout
- [Phase 82]: Compact turn tracking under 3000 chars for 15-turn conversation context bloat mitigation; three-strategy iframe handling (DOM first, CDP fallback, standalone URL)
- [Phase 82]: CONTEXT-06 outcome PARTIAL: 5 chatbot targets HTTP-validated, crisp.chat most verifiable (CRISP_WEBSITE_ID in server HTML), drift.com non-functional (334-byte stub), 92-97% context savings from compact turn tracking vs per-turn DOM reads, zero conversation turns due to WebSocket bridge disconnect
- [Phase 83]: twoFactorMultiTab workflow uses 3-phase structure: login-and-trigger, fetch-code-from-email, return-and-complete with tab ID retention (authTabId/emailTabId)

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general)

### Blockers/Concerns

- Site Guides Viewer design mismatch (deferred from v9.3)
- uiReadySelector option implemented but not wired to any site guide
- Autopilot LLM timeout on heavy DOM pages (LinkedIn) -- to be addressed in future Autopilot Enhancement milestone

## Session Continuity

Last session: 2026-03-22T07:12:48.428Z
Stopped at: Completed 83-01-PLAN.md
Resume file: None
