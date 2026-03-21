# Requirements: FSB v0.9.7 MCP Edge Case Validation

**Defined:** 2026-03-19
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.7 Requirements

Each requirement = one edge case prompt executed via MCP manual mode (no vision, DOM only). Success means: prompt completed OR specific blockers identified and fixed in-phase with autopilot diagnostic report generated.

### Canvas, WebGL & Spatial Reasoning

- [x] **CANVAS-01**: MCP can interact with TradingView chart elements (draw Fibonacci retracement from local low to local high)
- [x] **CANVAS-02**: MCP can interact with Figma-like editor (create frame, align rectangles) -- free alternative if Figma requires auth
- [x] **CANVAS-03**: MCP can interact with Google Maps (zoom, trace walking path around Central Park reservoir)
- [x] **CANVAS-04**: MCP can play browser-based solitaire (move specific card to target)
- [x] **CANVAS-05**: MCP can interact with Photopea (upload image, use magic wand tool to remove background)
- [x] **CANVAS-06**: MCP can interact with 3D product viewer on retail site (rotate shoe 180 degrees)
- [x] **CANVAS-07**: MCP can click canvas-painted button (pixels, not HTML element) in browser game
- [x] **CANVAS-08**: MCP can play notes on online piano keyboard (first four notes of Mary Had a Little Lamb)
- [x] **CANVAS-09**: MCP can use online PDF editor to place signature on dotted line on page 3
- [x] **CANVAS-10**: MCP can interact with Miro board (group scattered sticky notes into cluster)

### Continuous Input & Micro-Interactions

- [x] **MICRO-01**: MCP can adjust volume slider on custom HTML5 video player to exactly 37%
- [x] **MICRO-02**: MCP can click-and-hold record button for 5 seconds then release on voice memo app
- [x] **MICRO-03**: MCP can reorder items via drag-and-drop (Jira/Trello board, bottom card to top of another list)
- [x] **MICRO-04**: MCP can highlight exactly the second sentence of third paragraph in Wikipedia article
- [x] **MICRO-05**: MCP can use color picker tool (drag hue slider and shade reticle to select custom hex)
- [x] **MICRO-06**: MCP can scroll horizontally through carousel without triggering vertical scroll
- [x] **MICRO-07**: MCP can hover over nav menu, wait for CSS animation mega-menu, click nested sub-link
- [x] **MICRO-08**: MCP can trigger file upload via browser dropzone (simulate drag-and-drop file input)
- [x] **MICRO-09**: MCP can solve slide-to-fit puzzle CAPTCHA by dragging piece at variable speed
- [x] **MICRO-10**: MCP can scrub podcast audio timeline to exactly the 14:22 mark

### Infinite Scroll & Virtualized DOMs

- [x] **SCROLL-01**: MCP can scroll through X/Twitter feed and extract text of a user's 150th post
- [x] **SCROLL-02**: MCP can scrape names of all 500 items on dynamically loading e-commerce search page
- [x] **SCROLL-03**: MCP can find specific log entry from 3 days ago in infinitely scrolling dashboard
- [x] **SCROLL-04**: MCP can navigate to bottom of populated Reddit thread and reply to last comment
- [x] **SCROLL-05**: MCP can read multi-page document in virtualized viewer (pages unload as you scroll)
- [x] **SCROLL-06**: MCP can expand all nested comment threads on Hacker News post with 1000+ comments
- [x] **SCROLL-07**: MCP can find Airbnb listing by panning map interface until new pins populate
- [x] **SCROLL-08**: MCP can scroll TikTok web feed until finding a video containing a cat
- [x] **SCROLL-09**: MCP can extract pricing data from table that only loads rows in viewport
- [x] **SCROLL-10**: MCP can navigate infinite-scroll news site and stop at articles published yesterday

### Context Bloat & Long-Running Workflows

- [x] **CONTEXT-01**: MCP can monitor live sports ticker for 30 minutes logging score changes
- [x] **CONTEXT-02**: MCP can fork Observable notebook, modify data array in cell 3 without altering cell 1
- [ ] **CONTEXT-03**: MCP can read 50-page PDF then fill web form with details from pages 4, 17, and 42
- [ ] **CONTEXT-04**: MCP can open 5 tabs comparing flight prices, switch back to cheapest after searching
- [ ] **CONTEXT-05**: MCP can complete multi-step checkout, input wrong zip, correct it, verify tax updates
- [ ] **CONTEXT-06**: MCP can converse with support chatbot for 15 turns then summarize first instruction
- [ ] **CONTEXT-07**: MCP can handle 2FA flow (trigger email code, open new tab to fetch, return to complete login)
- [ ] **CONTEXT-08**: MCP can edit Google Doc replacing every "synergy" with "collaboration" without Find/Replace
- [ ] **CONTEXT-09**: MCP can cross-reference 50 employee names in web CRM against separate HR portal
- [ ] **CONTEXT-10**: MCP can handle session expiration modal, re-authenticate, and resume previous task

### Visual Ambiguity & Dark Patterns

- [ ] **DARK-01**: MCP can download file from freeware site ignoring fake "Download Now" ad buttons
- [ ] **DARK-02**: MCP can opt out of all non-essential cookies on EU news site with hidden reject option
- [ ] **DARK-03**: MCP can cancel subscription on site that shuffles Keep/Cancel button positions
- [ ] **DARK-04**: MCP can close pop-up ad where X button is camouflaged against background
- [ ] **DARK-05**: MCP can bypass "disable adblocker" modal with no visible DOM exit button
- [ ] **DARK-06**: MCP can select cheapest flight on airline site with misleading premium highlighting
- [ ] **DARK-07**: MCP can uncheck hidden "subscribe to newsletter" box injected before submit
- [ ] **DARK-08**: MCP can find actual login link on homepage that prioritizes Sign Up CTAs
- [ ] **DARK-09**: MCP can click Skip Ad button on video player when 5-second countdown finishes
- [ ] **DARK-10**: MCP can scrape text from site that blocks right-clicks, disables selection, masks CSS classes

## Future Requirements (v0.9.8 Autopilot Enhancement)

Deferred to next milestone. Will use diagnostic reports from this milestone as input.

- **AUTO-01**: Autopilot can complete edge cases that manual MCP mode solved
- **AUTO-02**: Autopilot CLI parse failure rate reduced below 5%
- **AUTO-03**: Autopilot LLM timeout eliminated on heavy DOM pages
- **AUTO-04**: Autopilot stuck detection recovery actually advances the task
- **AUTO-05**: Autopilot completion validation accuracy above 90%

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vision-based interaction | No screenshot/visual analysis -- DOM only per project constraint |
| Paid service authentication | Skip prompts requiring paid accounts with no free alternative |
| Autopilot fixes | Diagnostic only this milestone -- fixes deferred to v0.9.8 |
| Mobile browser testing | Chrome desktop extension only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CANVAS-01 | Phase 47 | Complete |
| CANVAS-02 | Phase 48 | Complete |
| CANVAS-03 | Phase 49 | Complete |
| CANVAS-04 | Phase 50 | Complete |
| CANVAS-05 | Phase 51 | Complete |
| CANVAS-06 | Phase 52 | Complete |
| CANVAS-07 | Phase 53 | Complete |
| CANVAS-08 | Phase 54 | Complete |
| CANVAS-09 | Phase 55 | Complete |
| CANVAS-10 | Phase 56 | Complete |
| MICRO-01 | Phase 57 | Complete |
| MICRO-02 | Phase 58 | Complete |
| MICRO-03 | Phase 59 | Complete |
| MICRO-04 | Phase 60 | Complete |
| MICRO-05 | Phase 61 | Complete |
| MICRO-06 | Phase 62 | Complete |
| MICRO-07 | Phase 63 | Complete |
| MICRO-08 | Phase 64 | Complete |
| MICRO-09 | Phase 65 | Complete |
| MICRO-10 | Phase 66 | Complete |
| SCROLL-01 | Phase 67 | Complete |
| SCROLL-02 | Phase 68 | Complete |
| SCROLL-03 | Phase 69 | Complete |
| SCROLL-04 | Phase 70 | Complete |
| SCROLL-05 | Phase 71 | Complete |
| SCROLL-06 | Phase 72 | Complete |
| SCROLL-07 | Phase 73 | Complete |
| SCROLL-08 | Phase 74 | Complete |
| SCROLL-09 | Phase 75 | Complete |
| SCROLL-10 | Phase 76 | Complete |
| CONTEXT-01 | Phase 77 | Complete |
| CONTEXT-02 | Phase 78 | Complete |
| CONTEXT-03 | Phase 79 | Pending |
| CONTEXT-04 | Phase 80 | Pending |
| CONTEXT-05 | Phase 81 | Pending |
| CONTEXT-06 | Phase 82 | Pending |
| CONTEXT-07 | Phase 83 | Pending |
| CONTEXT-08 | Phase 84 | Pending |
| CONTEXT-09 | Phase 85 | Pending |
| CONTEXT-10 | Phase 86 | Pending |
| DARK-01 | Phase 87 | Pending |
| DARK-02 | Phase 88 | Pending |
| DARK-03 | Phase 89 | Pending |
| DARK-04 | Phase 90 | Pending |
| DARK-05 | Phase 91 | Pending |
| DARK-06 | Phase 92 | Pending |
| DARK-07 | Phase 93 | Pending |
| DARK-08 | Phase 94 | Pending |
| DARK-09 | Phase 95 | Pending |
| DARK-10 | Phase 96 | Pending |

**Coverage:**
- v0.9.7 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
