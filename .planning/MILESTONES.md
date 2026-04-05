# Project Milestones: FSB (Full Self-Browsing)

## v0.9.24 Claude Code Architecture Adaptation (Shipped: 2026-04-05)

**Phases completed:** 10 phases, 20 plans, 33 requirements

**Key accomplishments:**

- Built the typed session-state foundation for the runtime with `createSession`, hot/warm persistence semantics, transcript storage, structured turn results, action history, and a state emitter.
- Extracted engine configuration seams for pricing, cost tracking, execution modes, session defaults, and permission gating so the runtime no longer relies on scattered inline constants.
- Introduced a reusable HookPipeline and refactored the agent loop to use lifecycle hooks, extracted modules, and resumable session behavior while preserving MV3-safe iteration flow.
- Structured service-worker bootstrap and migrated remaining consumers onto the new module contracts, including mode-aware session construction and session persistence.
- Wired runtime progress events into popup and sidepanel consumers, then added first-class partial outcomes and auth-wall handoff preservation so useful work survives blocked final steps.
- Made overlay/debugger feedback resilient across reconnects, navigation, long provider waits, and dashboard DOM-stream preview synchronization.

**Accepted debt at close:**

- `CostTracker` still needs a small ordering cleanup so its instantiated limit always matches the final per-mode session config.
- Auth-wall behavior shipped, but live browser smoke coverage is still recommended for no-sidepanel fallback, skip/timeout preservation, and same-session resume.

**Stats:**

- 10 phases, 20 plans, 33 requirements
- Key files: `ai/session-schema.js`, `ai/transcript-store.js`, `ai/hook-pipeline.js`, `ai/engine-config.js`, `ai/cost-tracker.js`, `background.js`, `ai/agent-loop.js`

---

## v0.9.21 UI Retouch & Cohesion (Shipped: 2026-04-02)

**Phases completed:** 5 phases, 9 plans

**Key accomplishments:**

- Established a shared `fsb-ui-core.css` baseline so popup, sidepanel, control panel, and dashboard surfaces all consume one FSB visual system
- Retouched the sidepanel into a cleaner persistent workspace with better hierarchy, history chrome, footer metadata, and composer behavior
- Retouched the popup into a cleaner quick-launch sibling with flatter chrome, aligned states, and tighter footer/composer treatment
- Flattened the control-panel/dashboard shell to a black-neutral dark mode, reduced oversized density, cleaned up pairing/docs surfaces, and normalized dashboard naming
- Replaced the oversized rectangular text highlight behavior with target-aware overlay feedback that uses text-style emphasis for inline targets and fitted boxes for controls, with DOM stream parity

**Stats:**

- 5 phases, 9 plans, 15 requirements
- Key files: `shared/fsb-ui-core.css`, `ui/sidepanel.css`, `ui/popup.css`, `ui/options.css`, `content/visual-feedback.js`

---

## v0.9.9.1 Phantom Stream (Shipped: 2026-03-31)

**Phases completed:** 9 phases (5 planned + 4 inserted fixes), 16 plans

**Key accomplishments:**

- Auto-connect DOM stream on WebSocket handshake with active tab tracking, recovery on disconnect, and 4-state health badge
- LZ-string compression for WS payloads (90%+ reduction on 100KB+ DOM snapshots) with envelope-based backward compat
- 4-mode layout system (inline, maximized, PiP with drag-to-reposition, fullscreen with mouse-tracked exit overlay)
- Full computed style capture (66 CSS properties) fixing broken layouts on complex sites like Google and YouTube
- Native alert/confirm/prompt dialog mirroring to dashboard with styled overlay cards
- Remote browser control (click/type/scroll) through preview with coordinate reverse-scaling and blue border active state
- Idempotent stop signals with promise resolution, eliminating hanging promises and duplicate task-complete messages
- Orange glow overlay broadcast during automation for visual element targeting in preview

**Stats:**

- 9 phases, 16 plans
- Key files: dashboard.js (2,718 lines), dom-stream.js (878 lines), ws-client.js (527 lines)

---

## v0.9.8.1 npm Publishing (Shipped: 2026-04-02)

**Phases completed:** 2 phases, 2 plans

**Key accomplishments:**

- npm-ready package with metadata, files whitelist, `.npmignore`, `prepublishOnly`, and tag-driven GitHub Actions publish workflow
- Public npm release means users can install and run the FSB MCP server via `npx -y fsb-mcp-server` without cloning the repo
- MCP docs now cover stdio usage, optional local HTTP mode, and setup/diagnostic commands without changing the extension bridge contract

**Stats:**

- 2 phases, 2 formal plans
- Key files: `mcp-server/package.json`, `mcp-server/README.md`, `.github/workflows/npm-publish.yml`, `mcp-server/server.json`

---

## v0.9.20 Autopilot Agent Architecture Rewrite (Shipped: 2026-04-02)

**Phases completed:** 8 phases (5 planned + 3 gap closures), 11 plans, 32 requirements

**Key accomplishments:**

- Replaced custom CLI text parsing autopilot with native tool_use agent loop -- the same pattern Claude Code, Computer Use API, and MCP clients all use. AI returns structured tool_use blocks, extension executes via unified tool-executor.js, feeds tool_result back, loops until AI emits end_turn.
- Canonical tool registry (tool-definitions.js, 47 tools in JSON Schema) shared between autopilot and MCP server via CJS-to-ESM schema-bridge.ts. MCP manual.ts reduced from 374 to 78 lines.
- Provider format adapter (tool-use-adapter.js) supporting all 6 providers (xAI, OpenAI, Anthropic, Gemini, OpenRouter, Custom) with native tool_use format translation. No more CLI text parsing or 5-strategy response fallbacks.
- Safety mechanisms: $2 cost circuit breaker, 10-minute time limit, 3-strike stuck detection with recovery hint injection, setTimeout-chained iterations for Chrome MV3 service worker compatibility, session persistence for SW resurrection.
- On-demand DOM snapshots and site guides (AI calls tools when needed instead of auto-injection every iteration), sliding window history compression at 80% token budget, Anthropic prompt caching.
- Net -11,184 lines removed (14,489 deleted, 3,305 added). background.js 14K->9.7K, ai-integration.js 5.2K->2.6K. cli-parser.js and cli-validator.js deleted entirely.

**Stats:**

- 33 files changed
- 3,305 lines added, 14,489 lines removed (net -11,184)
- 8 phases, 11 plans, 32 requirements (100% satisfied)
- 12 post-phase bug fix commits (importScripts scope, storage API, keyboard emulator, overlay cleanup, sidepanel notification)

---

## v0.9.11 MCP Tool Quality (Shipped: 2026-03-31)

**Phases completed:** 6 phases, 7 plans, 13 tasks

**Key accomplishments:**

- Main-content-first extraction with 8K MCP cap via findMainContentRoot selector cascade and fixed full flag passthrough
- Quick-extract-then-retry-if-sparse pattern in readPage handler: auto-waits up to 3s for DOM stability on JS-heavy SPA pages returning sparse content
- Content script auto-reconnects port on BF cache restore via pageshow listener, and MCP execute-action returns navigation info instead of cryptic port errors when clicks trigger page transitions
- Header-aware scroll pipeline with fixed/sticky detection, post-scroll compensation, obstruction recovery retries, and accurate fast-path viewport checks
- pressEnter handler now auto-discovers and clicks submit buttons when Enter key dispatch has no observable effect on form elements
- 3-tier cookie consent detection (6 CMPs + generic + text fallback) with reject-preferring dismiss, wired proactively into readPage and smartEnsureReady pipelines
- 5-tier DOM heuristic cascade detecting site search inputs (type=search, role=search, name=q, placeholder, form action) with visibility filtering and Google fallback

---

## v0.9.9 Excalidraw Mastery (Shipped: 2026-03-25)

**Phases completed:** 9 phases, 14 plans, 56 requirements

**Key accomplishments:**

- Fixed 2 gating engine bugs (isCanvasEditorUrl, isCanvasBasedEditor) preventing multi-step Excalidraw automation; added inserttext CLI command, dblclickat CDP tool, and batch CDP direct routing
- Expanded Excalidraw site guide from ~60 to ~893 lines covering all drawing primitives, text entry (3 modes), canvas operations, element editing, connectors/arrows, styling, alignment, export, and natural language diagram generation
- Built universal Canvas Vision system: canvas-interceptor.js wraps CanvasRenderingContext2D prototype at document_start in MAIN world, captures all draw calls (fillRect, fillText, lineTo, arc etc.), and injects structured CANVAS SCENE section into DOM snapshots
- Canvas Vision proven on 3 live apps (Excalidraw, TradingView, Photopea) with architectural coverage for 12/15 canvas apps; AI can now read canvas content without screenshots
- Added pixel-based fallback (color grid + edge detection) for when draw call interception is unavailable
- Fixed 9 systemic issues found during deep testing: debugger contention, guidance truncation (500->3000 for canvas), dynamic page fast-path threshold (3->6 iterations for editors), site guide CLI verb format, batch action CDP routing

---

## v0.9.8 Autopilot Refinement (Shipped: 2026-03-23)

**Phases completed:** 8 phases, 14 plans, 27 tasks

**Key accomplishments:**

- Procedural memory auto-extraction from successful sessions with RECOMMENDED APPROACH injection into autopilot prompts for proven action replay
- Auto-consolidation fires after every 10 sessions or at 80% per-type capacity via fire-and-forget pattern; all dead EPISODIC code removed from 5 files leaving 3 clean memory types
- Cross-domain procedural memory fallback with [from domain] attribution and mid-session domain-change memory refresh
- CDP tools reject out-of-viewport coordinates before execution; stuck recovery suggests opposite interaction paradigm (coordinate vs DOM) based on recent action history
- Progressive 3-stage prompt trimming at 200K char threshold and two-stage CLI parse failure recovery with simplified hint before full reformat
- Direct CDP tool dispatch in background automation loop, bypassing broken nested content-to-background message round-trip that caused 100% false failure reporting
- Dynamic page completion fast-path accepting AI done signals within 2 iterations for media/gaming/canvas tasks, plus 5-minute running session inactivity auto-expiry
- Registered 7 new CDP/interaction tools in CLI_COMMAND_TABLE prompt reference and isValidTool validator for autopilot tool parity with MCP
- 7 new COMMAND_REGISTRY verb entries for CDP/text/file tools plus enhanced dragdrop with MCP-parity optional parameters
- TOOL SELECTION GUIDE decision table and canvas task-type-aware PRIORITY TOOLS injection for autopilot system prompt
- 20 site guides enriched with distilled AUTOPILOT STRATEGY HINTS from v0.9.7 CANVAS and MICRO-INTERACTION diagnostic reports, prepended within 500-char continuation prompt window
- 20 site guides enriched with distilled autopilot strategy hints from SCROLL (phases 67-76) and CONTEXT (phases 77-86) diagnostic reports, prepended within the 500-char continuation prompt window
- 10 dark pattern site guides enriched with AUTOPILOT STRATEGY HINTS from diagnostic DARK-01 through DARK-10 reports -- countermeasure intelligence prepended at top of guidance strings for continuation prompt visibility

---

## v0.9.7 MCP Edge Case Validation (Shipped: 2026-03-22)

**Phases completed:** 50 phases, 100 plans, 183 tasks

**Key accomplishments:**

- CDP-based click_at and drag MCP tools for canvas interaction using Input.dispatchMouseEvent trusted events
- CANVAS-01 validated PASS: Fibonacci retracement drawn on TradingView via CDP click_at (click-click pattern, all 7 levels confirmed)
- CDP click_at and drag tools now accept shift/ctrl/alt modifiers, enabling shift+click multi-select and constrained drag in canvas apps
- Excalidraw site guide created and live MCP test confirms canvas drawing workflow (press_key + cdpDrag) works; multi-select/alignment blocked by MCP server restart needed for modifier params
- CDP mouseWheel tool for coordinate-targeted zoom on Google Maps and canvas apps, dispatching trusted Input.dispatchMouseEvent at specific viewport coordinates
- Google Maps site guide with 15 selectors, zoom/pan/search workflows, and CANVAS-03 diagnostic report (PARTIAL -- tooling ready, live test deferred to human checkpoint)
- Google Solitaire site guide with Klondike card game DOM selectors, click/drag card interaction workflows, and background.js registration
- Live MCP test of Google Solitaire revealing iframe-hosted game requires CDP coordinate tools (click_at/drag), not DOM selectors -- PARTIAL outcome with key architectural discovery
- Photopea site guide with magic wand background removal workflow, Photoshop keyboard shortcuts, and canvas/toolbar DOM split
- CANVAS-05 PARTIAL: Photopea editor launches and CDP clicks register, but entire UI is canvas-rendered with zero DOM elements -- all site guide selectors invalid
- Nike 3D viewer site guide with model-viewer/WebGL canvas selectors, Sketchfab fallback, and half-width horizontal drag rotation workflow for 180-degree shoe rotation
- Live MCP CDP drag on Sketchfab Nike Air Jordan 3D viewer -- rotation confirmed via horizontal drag, PARTIAL outcome human-approved
- Canvas browser game site guide with pixel-coordinate click_at workflows for fully canvas-rendered HTML5/WebGL game buttons
- CANVAS-07 live MCP test with PARTIAL outcome -- CDP click_at confirmed on Poki/Crossy Road game iframe, canvas button targeting blocked by game loading ads
- Online piano site guide for virtualpiano.net with press_key keyboard mapping (A=C4,S=D4,D=E4), DOM click, and click_at canvas fallback workflows for playing E-D-C-D (Mary Had a Little Lamb)
- CANVAS-08 PASS: all 4 notes of Mary Had a Little Lamb (E-D-C-D) played via press_key debuggerAPI on virtualpiano.net with corrected keyboard mapping (t=C4, y=D4, u=E4)
- Online PDF editor site guide with signature placement workflows for Smallpdf/Sejda/DocHub targeting click_at page placement and DOM click toolbar interaction
- CANVAS-09 PARTIAL outcome -- Smallpdf navigation confirmed via live MCP, DOM-based UI verified, signature placement blocked by WebSocket bridge disconnect
- Miro whiteboard site guide with sticky note creation, drag-to-cluster, and full 12-step clustering workflow using CDP canvas events
- CANVAS-10 diagnostic report with SKIP-AUTH outcome: Miro requires sign-in, 14-step test plan documented, 10 autopilot recommendations including Excalidraw fallback
- HTML5 video player site guide with click_at/drag volume slider workflows targeting 37% precision, supporting Vimeo, Dailymotion, JW Player, Plyr, and Video.js
- MICRO-01 diagnostic report with PARTIAL outcome -- click_at/drag tools confirmed capable for volume slider precision, live execution blocked by WebSocket bridge disconnect, 10 autopilot recommendations documented
- click_and_hold CDP tool wired through all three MCP layers (manual.ts, actions.js, background.js) with mousePressed -> holdMs delay -> mouseReleased, plus voice recorder site guide with dual record workflows
- MICRO-02 diagnostic report with PARTIAL outcome -- click_and_hold tool chain verified across all layers, live execution blocked by WebSocket bridge disconnect, 10 autopilot recommendations for hold/toggle recording
- drag_drop MCP tool exposing DOM-level 3-method fallback chain (HTML5 DragEvent, PointerEvent, MouseEvent) with Trello site guide 3-tier drag-and-drop reorder workflow
- MICRO-03 diagnostic report with PARTIAL outcome: drag_drop MCP tool chain verified complete with 3-method fallback, Trello 3-tier workflow ready, live Kanban card reorder blocked by WebSocket bridge disconnect
- select_text_range MCP tool with TreeWalker-based Range API substring selection, plus Wikipedia site guide with highlightSentence workflow for MICRO-04 sentence targeting
- MICRO-04 diagnostic report with PARTIAL outcome: select_text_range tool chain validated against live Albert Einstein article content, sentence boundary detection confirmed (offsets 113-345 for second sentence), live browser execution blocked by WebSocket bridge disconnect
- Color picker site guide with selectCustomHex workflow covering hue strip positioning, shade area reticle targeting, and hex value readout using click_at/drag CDP tools
- MICRO-05 diagnostic report generated with live DOM validation confirming all 6 colorpicker.me selectors, critical hue formula inversion bug found, 10 autopilot recommendations for coordinate-based color picker interaction
- Carousel site guide with scrollCarouselHorizontally workflow covering arrow buttons, scroll_at deltaX, and drag swipe methods with vertical scroll verification
- MICRO-06 carousel diagnostic with PARTIAL outcome -- Target.com carousel selectors validated against live DOM, 10 autopilot recommendations, WebSocket bridge persistent blocker
- Mega-menu site guide with two interaction strategies (DOM hover+click for JS menus, CDP drag+click_at for CSS :hover menus) covering Best Buy, Home Depot, and Lowes
- MICRO-07 PARTIAL: Lowes.com mega-menu DOM validated (click-to-open modal pattern with data-linkid selectors), physical hover/click blocked by WebSocket bridge disconnect
- drop_file MCP tool with synthetic File + DataTransfer + DragEvent dispatch, plus file-upload site guide with simulateFileUpload workflow covering Dropzone.js, react-dropzone, and native HTML5 patterns
- MICRO-08 diagnostic report with PARTIAL outcome: drop_file tool chain validated, DOM selectors tested against three live sites (dropzone.dev, file.io, gofile.io), WebSocket bridge disconnect blocked physical DragEvent dispatch
- drag_variable_speed MCP tool with quadratic ease-in-out timing curve and slider-captcha site guide with solveSliderCaptcha workflow for GEETEST/Tencent/generic slider CAPTCHAs
- MICRO-09 diagnostic report with PARTIAL outcome: drag_variable_speed tool chain validated at code level, GEETEST JS-rendered DOM structure documented, live MCP execution blocked by WebSocket bridge disconnect (persistent blocker Phases 55-65)
- Podcast audio timeline scrub site guide with click_at/drag workflows for seeking to 14:22 (862s), covering 12 podcast platforms with 5-second tolerance verification
- MICRO-10 diagnostic report with PARTIAL outcome -- Buzzsprout DOM validated (native range input, aria-valuemax=2144, 40.2% position calculation), Spreaker Alpine.js SPA confirmed, live CDP execution blocked by WebSocket bridge disconnect
- Twitter site guide updated with scrollAndCountPosts workflow, virtualized DOM recycling documentation, and permalink-based deduplication for extracting the 150th post from infinite scroll feed
- SCROLL-01 PARTIAL: X/Twitter SPA architecture confirmed (245KB React shell, zero server-rendered tweets), all 10 selectors UNTESTABLE without live browser, WebSocket bridge disconnect blocks MCP execution (Phases 55-67)
- Amazon site guide updated with 14-step scrapeAllSearchResults workflow using ASIN-based deduplication for paginated 500+ product name extraction
- SCROLL-02 diagnostic report with PARTIAL outcome -- Amazon paginated selectors validated via HTTP on amazon.in, ASIN deduplication confirmed with 3 cross-page overlaps, live MCP execution blocked by WebSocket bridge disconnect
- GitHub site guide updated with 12-step findLogEntryByDate workflow, 8 activity feed selectors, relative-time datetime parsing, and href-based event deduplication for SCROLL-03
- SCROLL-03 PARTIAL: GitHub activity timeline structure validated, target date (March 18) confirmed via contribution calendar and REST API (5 torvalds commits extracted), live MCP scroll-through-feed blocked by WebSocket bridge disconnect
- Reddit site guide updated with scrollToBottomAndReply workflow, 12 comment selectors for both new Reddit (Shreddit) and old Reddit, load-more-comments expansion pattern, and SKIP-AUTH reply documentation
- SCROLL-04 PARTIAL: old.reddit.com thread validated with 184/3342 server-rendered comments, 73 load-more buttons identified, last comment identified (kalaban101 at 09:36:59Z), reply auth-gated as SKIP-AUTH, live MCP scroll loop blocked by WebSocket bridge disconnect
- pdf.js virtualized viewer site guide with readVirtualizedDocument workflow (14 steps), textLayer text extraction, page virtualization detection, and 4 workflows for scroll-and-read automation
- SCROLL-05 diagnostic report with PARTIAL outcome -- pdf.js viewer validated via HTTP + viewer.mjs source analysis confirming textLayer/virtualization architecture, 4 selector corrections found, 10 autopilot recommendations, live MCP blocked by WebSocket bridge disconnect
- HN site guide with expandAllThreads workflow (12-step paginated expansion cycle), countComments workflow, 14 selectors, and full page navigation documentation for 1000+ comment threads
- SCROLL-06 HN thread expansion diagnostic with HTTP DOM validation across 3 threads (1115, 2530, 2507 comments), finding that HN loads all comments on a single page with no morelink pagination on comment threads
- Airbnb site guide updated with 11-step panMapForListings workflow, 9 map selectors, CDP drag panning strategy, and pin-count verification for SCROLL-07 edge case
- SCROLL-07 diagnostic report with PARTIAL outcome -- Airbnb map container validated via data-testid, listing pins confirmed client-rendered, live CDP drag panning blocked by WebSocket bridge disconnect
- TikTok site guide with scrollFeedForCatVideo workflow using data-e2e selectors, search-page-first auth avoidance, and cat keyword matching in video descriptions
- SCROLL-08 diagnostic report with PARTIAL outcome -- TikTok fully client-rendered SPA returns zero content in server HTML, all 11 data-e2e selectors untestable via HTTP, live MCP blocked by WebSocket bridge disconnect
- SaaS pricing table site guide with 15-step scroll-read-deduplicate extraction workflow, 18+ selectors, and Notion/Airtable targeting for SCROLL-09
- SCROLL-09 diagnostic report with PARTIAL outcome: Notion pricing page fully server-rendered (58 rows in 429KB HTML), generic table selectors 0/6 match, CSS Module prefix matching required, live scroll-read-deduplicate loop blocked by WebSocket bridge disconnect
- News feed site guide with 15-step scrollToYesterdaysArticles workflow, 21 selectors (generic + BBC/CNN/Reuters), and datetime-preferred date detection for SCROLL-10
- SCROLL-10 PARTIAL outcome: BBC News 47 articles validated via HTTP with 15 yesterday articles confirmed from __NEXT_DATA__ JSON, live scroll-stop loop blocked by WebSocket bridge disconnect
- ESPN scoreboard site guide with 17-step monitorLiveScores polling workflow, 20+ selectors (generic + ESPN/CBS/NBA-specific), and snapshot-based change detection for 30-minute sustained monitoring
- CONTEXT-01 diagnostic with PARTIAL outcome: ESPN NBA scoreboard HTTP polling confirmed 3 score changes across 5 polls (Thunder 69->73, Wizards 64->70), 13/27 selectors matched, 2-snapshot retention validated, 30-minute sustained polling blocked by WebSocket bridge disconnect
- Observable notebook editing site guide with forkAndEditCell workflow (15-step fork/tinker + cell edit sequence), verifyCellUnchanged workflow, 16 selectors, CodeMirror 6 interaction patterns, and background.js wiring
- CONTEXT-02 diagnostic with PARTIAL outcome: Observable notebook HTTP-validated (38 cells via __NEXT_DATA__ JSON), all 16 cell selectors client-rendered only, context bloat analysis showing breadth-based mitigation via targeted getText, live cell editing blocked by WebSocket bridge disconnect
- readPdfAndFillForm workflow and cross-site context retention guidance added to pdf-viewer.js for 50-page PDF to web form data transfer
- CONTEXT-03 PARTIAL diagnostic: pdf.js viewer toolbar (6/16 selectors match) and httpbin form (4 text-fillable fields) validated via HTTP, cross-site PDF-to-form chain blocked by WebSocket bridge disconnect
- compareFlightsMultiTab workflow and CONTEXT-04 guidance added to google-travel.js with 18-step multi-tab comparison sequence, tab lifecycle docs, and context bloat mitigation (under 2500 chars for 5 tabs)
- CONTEXT-04 diagnostic report with PARTIAL outcome: Google Flights HTTP-validated with 12+ server-rendered flight suggestions containing prices in aria-labels, 5-tab open_tab/switch_tab/list_tabs workflow documented but blocked by WebSocket bridge disconnect, Context Bloat Analysis showing 97-99% savings from targeted price-only extraction
- Demo-store.js site guide with 14-step multiStepCheckoutWithCorrection workflow targeting 5 auth-free e-commerce stores for CONTEXT-05 zip correction and tax verification
- CONTEXT-05 PARTIAL outcome: SauceDemo validated as best checkout correction target with data-test selectors for postalCode input and tax summary, but all 5 demo stores use flat tax (not zip-dependent), and live MCP execution blocked by persistent WebSocket bridge disconnect
- Support chatbot site guide with 13-step chatbot15TurnSummary workflow, CONTEXT-06 15-turn conversation strategy, iframe-aware widget detection, and context bloat mitigation for multi-turn exchanges
- CONTEXT-06 diagnostic report with PARTIAL outcome: 5 chatbot targets HTTP-validated (tidio.com, crisp.chat, drift.com, hubspot.com, intercom.com), context bloat analysis showing 92-97% savings via compact turn tracking, 10 chatbot-specific autopilot recommendations, zero conversation turns due to WebSocket bridge disconnect
- Two-factor-auth.js site guide with twoFactorMultiTab workflow documenting multi-tab 2FA authentication flow (login, email code fetch, tab switch, code entry) for CONTEXT-07
- CONTEXT-07 diagnostic report with PARTIAL outcome: 5 login targets and guerrillamail validated via HTTP, 9/14 selectors confirmed, 85-95% context savings from compact {authTabId, emailTabId, code} state tracking, live MCP blocked by WebSocket bridge disconnect
- manualWordReplace workflow with 5-phase Ctrl+F/double-click/type strategy for canvas-based Google Docs word replacement without Find/Replace dialog
- SKIP-AUTH diagnostic for Google Doc manual word replacement -- Ctrl+F search delegation saves 83-96% context, all 10 selectors untestable via HTTP due to auth gate
- crm-hr-cross-ref.js site guide with crossReferenceEmployees 12-step workflow, CONTEXT-09 batch processing guidance for 50-name CRM-to-HR cross-reference, selectors for DemoQA and herokuapp, 5 auth-free fallback targets
- CONTEXT-09 PARTIAL diagnostic: HR portal (herokuapp) fully validated with 7/12 selectors confirmed, CRM (DemoQA) client-rendered, DummyJSON fallback CRM with 208 users, 0 cross-reference matches (independent datasets), 84-96% context savings from batch-of-10 extraction with HR caching
- Session expiry site guide with 14-step handleSessionExpiry workflow, 4 detection patterns, and CONTEXT-10 context bloat mitigation via compact task state under 500 chars
- CONTEXT-10 diagnostic with PARTIAL outcome: herokuapp login selectors validated, session expiry via 302 redirect confirmed, 243-byte compact task state under 500-char budget, 10 autopilot recommendations for re-auth handling
- Freeware download site guide with 12-step downloadRealFile workflow, 8 ad detection heuristics, and elimination-based real link identification for DARK-01 dark pattern avoidance
- DARK-01 PARTIAL: SourceForge VLC real download button identified via 8-heuristic elimination (a.button.download.big-text.green), zero server-rendered fake download buttons found, 22 ad/promotional elements classified, live click blocked by WebSocket bridge disconnect
- Cookie consent dark pattern avoidance site guide with 5-CMP detection, 3-tier hidden reject strategy, and 10-step rejectAllCookies workflow for EU news sites
- DARK-02 diagnostic with PARTIAL outcome: 5 EU news sites validated via HTTP confirming Sourcepoint/iubenda/custom CMP detection, 100% JS-rendered consent UIs, 3 selector mismatches, and 10 cookie consent dark pattern autopilot recommendations
- Shuffled-cancel.js site guide with DARK-03 cancelSubscription workflow using text-based button identification for randomized Keep/Cancel positions
- DARK-03 diagnostic with PARTIAL outcome: userinyerface.com cancel modal validated via HTTP with trick-question "Cancel" = keep-intent pattern, Math.random/Shuffle randomization confirmed in app.js, text-based classification validated across 7 targets, and 10 shuffled button autopilot recommendations
- DARK-04 closePopupAd workflow with 3-tier DOM-based close button detection, decoy filtering, iframe handling, and 5 fallback dismissal strategies for camouflaged pop-up ad overlays
- DARK-04 PARTIAL: BusinessInsider aria-label="Close this ad" with SVG close-icon validated via Tier 1 attribute detection, delayed appearance (5s rollUpTimeout) confirmed from ad config JSON, live click blocked by WebSocket bridge disconnect
- DARK-05 adblocker modal bypass site guide with 8-step bypassAdblockerModal workflow, DOM removal and CSS override strategies, 4 detection library patterns, and MutationObserver re-detection handling
- DARK-05 diagnostic report with PARTIAL outcome: 5 live targets HTTP-validated (BlockAdBlock, Forbes, Wired, BusinessInsider, DetectAdBlock), adblocker detection infrastructure confirmed, all modals 100% JavaScript-rendered, DOM removal and CSS override bypass strategies validated against documented library patterns
- DARK-06 site guide with selectCheapestFlight 8-step workflow using numeric price comparison to defeat 7 misleading premium highlighting techniques across 5 airline sites
- PARTIAL outcome diagnostic for misleading premium highlighting: 12 Google Flights + 329 Kayak prices extracted via HTTP, cheapest identified ($56 ATL-TPA, $20 Kayak global), badge manipulation confirmed (Kayak "Best" is composite not cheapest), live click blocked by WebSocket bridge disconnect
- Newsletter-uncheck.js site guide with DARK-07 uncheckNewsletterBeforeSubmit workflow documenting 8 hiding techniques, checkbox classification strategy, and pre-checked newsletter detection using DOM-only analysis
- DARK-07 PARTIAL diagnostic: 2 of 4 targets HTTP-validated, 89% checkbox classification accuracy, 9/11 selectors matched, 10 autopilot recommendations for pre-checked newsletter detection and unchecking
- DARK-08 site guide with findBuriedLoginLink workflow using text-based login vs signup classification across header, footer, hamburger menu, and signup page fallback locations
- DARK-08 diagnostic report with HTTP validation across 5 SaaS homepages confirming login link identification via text/href classification on 4 sites, login:signup ratio 1:3 to 1:5, and CTA asymmetry on 3/4 sites
- DARK-09 skip-ad-countdown site guide with temporal gating workflow using wait_for_element to detect skip button appearance after pre-roll ad countdown, covering YouTube/Dailymotion/Twitch/JW Player/VAST/Vimeo
- DARK-09 diagnostic report with PARTIAL outcome -- HTTP validation confirms ad infrastructure on YouTube/Dailymotion/Twitch (adPlacements JSON, skip feature flags, client-side ad modules) with all skip button elements confirmed 100% client-rendered, wait_for_element validated as correct temporal gating counter-strategy, live execution blocked by WebSocket bridge disconnect
- DARK-10 site guide with extractProtectedText workflow documenting 8 anti-scrape protection types, 6 target sites, and DOM-level bypass strategies using get_dom_snapshot, read_page, and get_text
- DARK-10 PARTIAL diagnostic: Genius lyrics (1.18MB, styled-components sc-HASH) and NYTimes (1.34MB, Emotion css-HASH) both server-render text extractable via structural selectors despite class obfuscation; 3/5 sites blocked by HTTP-level bot detection; live MCP blocked by WebSocket bridge disconnect

---

## v0.9.5 Progress Overlay Intelligence (Shipped: 2026-03-17)

**Delivered:** Enhanced the automation progress overlay with AI-generated live action summaries, smart task-aware progress/ETA estimation, fixed debug feedback leaking to the overlay, and wired debug intelligence back into the AI continuation prompt for better recovery decisions.

**Phases completed:** 36-39 (8 plans across 4 phases)

**Key accomplishments:**

- sanitizeOverlayText strips markdown and clamps to 80 chars, expanded phase labels for sheets workflows
- AI debugger diagnosis and 8-point diagnostic suggestions wired into continuation prompt via slimActionResult + retroactive actionHistory patching
- detectTaskPhase classifies actions into navigation/extraction/writing with phase-weighted progress bands (0-30%, 30-70%, 70-100%)
- Complexity-aware ETA blending with decaying weight formula (70% estimate early, 10% late)
- Multi-site progress shows company completion, Sheets progress shows row completion
- generateActionSummary with 2.5s timeout and 50-entry FIFO cache, fire-and-forget per action
- Task summary line in overlay, recovery state display during debug fallback, 300ms debounce on phase transitions

**Stats:**

- 23 commits
- 37 files changed
- 2,224 lines added, 290 lines removed
- 4 phases, 8 plans, 17 requirements (100% satisfied)
- 1 day (2026-03-17)

**Git range:** `6453f92` -> `22cbf8c`

---

## v0.9.2-v0.9.4 Productivity, Memory & AI Quality (Shipped: 2026-03-17)

**Delivered:** Three milestones shipped in one burst: expanded site intelligence to 7 productivity apps, overhauled Memory tab with unified Task Memories and graph visualization, and added cross-cutting AI perception/action quality improvements (scroll-aware snapshots, 8-point diagnostics, stability detection, parallel debug fallback).

**Phases completed:** 30-35 (17 plans across 6 phases)

**Key accomplishments:**

- Generalized fsbElements pipeline + 7 productivity app site guides (Notion, Calendar, Trello, Keep, Todoist, Airtable, Jira) with keyword routing
- Unified Task Memory schema -- one consolidated recon report per automation session replacing 1-5 fragments
- Polished Memory tab with task cards, collapsible detail views, per-task graph visualization, knowledge graph integration
- Theme-aware rendering with zero hardcoded colors, JSON export/import with duplicate detection
- Scroll-aware DOM snapshots with viewport-complete element inclusion (no arbitrary cap)
- 8-point action diagnostics on every failure with natural language suggestions
- Observation-based stability detection (STABILITY_PROFILES) replacing all hardcoded setTimeout delays
- Hybrid continuation prompt preserving reasoning framework and site guide knowledge across iterations
- Context-aware selector re-resolution with unique match enforcement
- Parallel debug fallback -- heuristic engine and AI debugger fire concurrently on every failure

**Stats:**

- 72 commits
- 56 files changed
- 10,415 lines added, 872 lines removed
- 6 phases, 17 plans, 47 requirements (100% satisfied)
- 2 days (2026-03-16 to 2026-03-17)

**Git range:** `49784b9` -> `505db19`

---

## v10.0 CLI Architecture (Shipped: 2026-03-15)

**Delivered:** Replaced FSB's entire AI-to-extension communication protocol from JSON tool calls to line-based CLI commands, redesigned DOM snapshots as unified markdown with interleaved element refs, and hardened Google Sheets automation with multi-strategy selector resilience -- achieving ~40-60% token reduction and eliminating JSON parsing failures.

**Phases completed:** 15-29 (37 plans across 15 phases)

**Key accomplishments:**

- CLI command protocol: hand-written state-machine tokenizer with 75-command registry parses line-based AI output (click e5, type e12 "hello") into {tool, params} objects -- zero JSON fallback
- Unified markdown DOM snapshot: page text and backtick element refs interwoven (`` `e5: button "Submit"` ``), region headings, 12K char budget -- replacing verbose JSON/YAML with ~40-60% measured token reduction
- Full prompt architecture rewrite: system prompt, continuation, stuck recovery, and 43+ site guide files all speaking CLI grammar exclusively
- Multi-signal completion validator: media/extraction task types, URL pattern matching, DOM snapshot evidence, and consecutive-done escape hatch replacing unreliable AI self-report
- Google Sheets resilience: multi-strategy selector lookup (5 strategies per element), 24 toolbar/menu fsbElements, canvas-aware stuck recovery, keyboard-first interaction patterns, first-snapshot health check
- ~800 lines dead YAML/compact code removed, redundant HTML context eliminated from prompts when markdown present

**Stats:**

- 134 commits
- 237 files changed
- 26,343 lines added, 4,999 lines removed
- 15 phases, 37 plans, 67 requirements (100% satisfied)
- 16 days from start to ship (2026-02-27 to 2026-03-15)

**Git range:** `b5c737d` -> `f92f8b3`

**Tech debt (non-blocking):** 7 items -- stale JSDoc refs to deleted YAML functions (2), dead readPage message handler branch (2), fsbElements annotation format divergence (1), legacy viewport patterns (1), single-slash comment syntax (1)

---

## v9.3 Tech Debt Cleanup (Shipped: 2026-02-23)

**Delivered:** Modularized content.js into 10 logical modules, removed dead code, made ElementCache configurable, fixed AI memory extraction, overhauled memory intelligence with AI enrichment and cost tracking, and split site guides into 43 per-site files with a browsable viewer.

**Phases completed:** 4-8 (17 plans total)

**Key accomplishments:**

- Modularized 13K-line content.js into 10 modules with FSB._modules tracking and badge error indicator
- Removed waitForActionable dead code (158 lines), orphaned files, and unused UI helpers
- Made ElementCache configurable via Options page with preset dropdown and live storage updates (default 200)
- Fixed UniversalProvider constructor so AI memory extraction actually runs when configured
- AI enrichment pipeline for all memory types with cross-site pattern learning and expandable detail panels
- Split 9 site guide categories into 43 per-site files with browsable viewer in Memory tab

**Stats:**

- 100 files changed
- 21,950 lines added, 18,960 lines removed
- 5 phases, 17 plans, 9 requirements (100% satisfied)
- 3 days from start to ship (2026-02-21 to 2026-02-23)

**Git range:** `8249bf3` -> `ad5a4bd`

**Known issues:** Site Guides Viewer displays as custom accordion instead of memory-style list with mind maps (UAT blocker, deferred)

---

## v9.0.2 AI Situational Awareness (Shipped: 2026-02-18)

**Delivered:** Complete AI situational awareness -- the AI sees full page context, remembers what it did, detects changes accurately, and knows when the task is done. Plus session continuity, history, replay, career workflows, memory tab, and Google Docs formatted paste.

**Phases completed:** 1-10 (21 plans total)

**Key accomplishments:**

- 3x DOM context delivery (5K -> 15K prompt budget) with priority-aware truncation and task-adaptive content modes
- Multi-signal completion verification replacing unreliable AI self-report (task-type validators, weighted scoring, critical action registry)
- Structured change detection replacing coarse hash comparison (4-channel DOM signals, structural fingerprints, false stuck elimination)
- Resilient conversation memory with hard facts, compaction fallback, and long-term memory retrieval
- Session continuity, history UI, and action replay across conversations
- Career page search with Google Sheets data entry workflows
- Memory tab population with episodic/semantic/procedural memories

**Stats:**

- 194 files created/modified
- 28,148 lines added, 1,366 lines removed
- 32,578 LOC across core JavaScript files
- 10 phases, 21 plans, 22 requirements (100% satisfied)
- 4 days from start to ship (2026-02-14 to 2026-02-18)
- 10/10 systemic issues resolved

**Git range:** `fab9fe0` -> `e0ed6d5`

---

## v0.9 Reliability Improvements (Shipped: 2026-02-14)

**Delivered:** Transformed FSB from unreliable "hit or miss" automation into a precise single-attempt execution engine with visual feedback, smart debugging, and fast execution.

**Phases completed:** 1-11 (24 plans total, Phase 10 deferred)

**Key accomplishments:**

- Selector generation with uniqueness scoring and coordinate fallback when all selectors fail
- Element readiness checks (visibility, interactability, obscuration) before every action
- Orange glow visual highlighting and progress overlay using Shadow DOM isolation
- 3-stage element filtering pipeline reducing DOM from 300+ to ~50 relevant elements
- Action verification with state capture, expected-effects validation, and alternative selector retry
- Debugging infrastructure: action recording, element inspector, session replay, log export
- Execution speed optimization: element caching, outcome-based delays, parallel prefetch, batch execution
- Control panel cleanup: removed dead UI code, wired Debug Mode and Test API settings

**Stats:**

- 18 files created/modified
- 43,283 lines of JavaScript
- 11 phases, 24 plans
- 2 days from start to ship (2026-02-03 to 2026-02-04)

**Git range:** `feat(01-01)` to `fix(debug)`

**What's next:** Smart multi-tab management, advanced CAPTCHA integration, workflow templates

---

## v9.4 Career Search Automation (Shipped: 2026-02-28)

**Delivered:** Autonomous career search across 30+ company websites with formatted Google Sheets output. Parsed 38 crowd session logs into site intelligence (sitemaps + site guides), built single-site and multi-site career search workflows, and added Google Sheets data entry with professional formatting.

**Phases completed:** 9-14.3 (18 plans across 9 phases in v9.4 scope)

**Key accomplishments:**

- Session log parser converts 38 crowd logs into per-company site guides with confidence-scored selectors and direct career URLs
- 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo) covering 15+ companies with stability-classified selectors
- Single-company career search: navigate site, search, extract jobs (company, title, apply link, date, location, description)
- Multi-site orchestration: sequential 2-10 company search with chrome.storage persistence, deduplication, and progress reporting
- Google Sheets output via Name Box + Tab/Enter pattern with bold colored headers, frozen row, auto-sized columns, and context-aware sheet naming
- Batch action execution engine: AI returns multiple actions per turn with DOM-based completion detection between each, plus timezone/country locale injection

**Stats:**

- 20 commits
- 9 phases (6 main + 3 hotfix), 18 plans
- 21 requirements defined, 21 satisfied (100%)
- 4 days from start to ship (2026-02-23 to 2026-02-27)

**Git range:** `bd0b1ef` -> `19bad00`

**Known issues:** ACCEL-01, ACCEL-02, ACCEL-05 traceability table not updated to Complete (requirements checked off in body)

---
