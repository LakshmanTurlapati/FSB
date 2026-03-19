# Roadmap: FSB v0.9.7 MCP Edge Case Validation

**Milestone:** v0.9.7
**Created:** 2026-03-19
**Granularity:** Fine (50 phases, one per edge case)
**Coverage:** 50/50 requirements mapped

## Phases

- [ ] **Phase 47: TradingView Fibonacci** - CANVAS-01: draw Fibonacci retracement via MCP manual tools
- [ ] **Phase 48: Figma Frame Alignment** - CANVAS-02: create frame and align rectangles in Figma-like editor
- [ ] **Phase 49: Google Maps Path Tracing** - CANVAS-03: zoom and trace walking path around Central Park reservoir
- [ ] **Phase 50: Browser Solitaire** - CANVAS-04: move specific card to target in browser-based solitaire
- [ ] **Phase 51: Photopea Background Removal** - CANVAS-05: upload image and use magic wand to remove background
- [ ] **Phase 52: 3D Product Viewer Rotation** - CANVAS-06: rotate shoe 180 degrees in 3D product viewer
- [ ] **Phase 53: Canvas-Painted Button Click** - CANVAS-07: click canvas-pixel button in browser game
- [ ] **Phase 54: Online Piano Notes** - CANVAS-08: play first four notes of Mary Had a Little Lamb
- [ ] **Phase 55: PDF Signature Placement** - CANVAS-09: place signature on dotted line on page 3 of PDF
- [ ] **Phase 56: Miro Sticky Note Grouping** - CANVAS-10: group scattered sticky notes into cluster on Miro board
- [ ] **Phase 57: Volume Slider Precision** - MICRO-01: adjust HTML5 video volume slider to exactly 37%
- [ ] **Phase 58: Click-and-Hold Record** - MICRO-02: hold record button for 5 seconds then release
- [ ] **Phase 59: Drag-and-Drop Reorder** - MICRO-03: move bottom card to top of another list via drag-and-drop
- [ ] **Phase 60: Text Selection Precision** - MICRO-04: highlight exactly the second sentence of third paragraph
- [ ] **Phase 61: Color Picker Custom Hex** - MICRO-05: drag hue slider and shade reticle to select custom hex
- [ ] **Phase 62: Horizontal Carousel Scroll** - MICRO-06: scroll horizontally through carousel without vertical scroll
- [ ] **Phase 63: CSS Mega-Menu Navigation** - MICRO-07: hover nav, wait for animation, click nested sub-link
- [ ] **Phase 64: Dropzone File Upload** - MICRO-08: trigger file upload via browser dropzone simulation
- [ ] **Phase 65: Slide-to-Fit CAPTCHA** - MICRO-09: solve slide-to-fit puzzle by dragging piece at variable speed
- [ ] **Phase 66: Podcast Timeline Scrub** - MICRO-10: scrub podcast audio timeline to exactly 14:22 mark
- [ ] **Phase 67: Twitter 150th Post Extraction** - SCROLL-01: scroll X/Twitter feed and extract text of 150th post
- [ ] **Phase 68: E-Commerce 500-Item Scrape** - SCROLL-02: scrape all 500 dynamically loading product names
- [ ] **Phase 69: Dashboard Log Entry Search** - SCROLL-03: find log entry from 3 days ago in infinite-scroll dashboard
- [ ] **Phase 70: Reddit Thread Bottom Reply** - SCROLL-04: navigate to bottom of Reddit thread and reply to last comment
- [ ] **Phase 71: Virtualized PDF Reader** - SCROLL-05: read multi-page document in virtualized viewer
- [ ] **Phase 72: Hacker News Thread Expansion** - SCROLL-06: expand all nested comment threads on HN post with 1000+ comments
- [ ] **Phase 73: Airbnb Map Pan Search** - SCROLL-07: pan Airbnb map until new listing pins populate
- [ ] **Phase 74: TikTok Cat Video Search** - SCROLL-08: scroll TikTok web feed until finding a cat video
- [ ] **Phase 75: Viewport-Only Pricing Table** - SCROLL-09: extract pricing from table that only loads visible rows
- [ ] **Phase 76: News Site Date-Stop Scroll** - SCROLL-10: scroll infinite-scroll news site stopping at yesterday's articles
- [ ] **Phase 77: Live Sports Score Monitor** - CONTEXT-01: monitor live sports ticker for 30 minutes logging score changes
- [ ] **Phase 78: Observable Notebook Edit** - CONTEXT-02: fork Observable notebook, modify cell 3 data without altering cell 1
- [ ] **Phase 79: 50-Page PDF Form Fill** - CONTEXT-03: read 50-page PDF then fill form with details from pages 4, 17, 42
- [ ] **Phase 80: Multi-Tab Flight Price Compare** - CONTEXT-04: open 5 tabs comparing flight prices, return to cheapest
- [ ] **Phase 81: Multi-Step Checkout with Correction** - CONTEXT-05: complete checkout, input wrong zip, correct it, verify tax updates
- [ ] **Phase 82: Support Chatbot 15-Turn Summary** - CONTEXT-06: converse with chatbot for 15 turns then summarize first instruction
- [ ] **Phase 83: 2FA Multi-Tab Auth Flow** - CONTEXT-07: handle 2FA, open new tab to fetch code, return to complete login
- [ ] **Phase 84: Google Doc Word Replace** - CONTEXT-08: replace every "synergy" with "collaboration" in Google Doc manually
- [ ] **Phase 85: CRM vs HR Portal Cross-Reference** - CONTEXT-09: cross-reference 50 employee names across CRM and HR portal
- [ ] **Phase 86: Session Expiry Re-Auth** - CONTEXT-10: handle session expiration modal, re-authenticate, resume task
- [ ] **Phase 87: Freeware Download Ad Avoidance** - DARK-01: download file from freeware site ignoring fake download buttons
- [ ] **Phase 88: Cookie Opt-Out Hidden Reject** - DARK-02: opt out of non-essential cookies with hidden reject option
- [ ] **Phase 89: Shuffled Cancel Button** - DARK-03: cancel subscription on site with shuffled Keep/Cancel buttons
- [ ] **Phase 90: Camouflaged Close Button** - DARK-04: close pop-up where X button is camouflaged against background
- [ ] **Phase 91: Adblocker Modal Bypass** - DARK-05: bypass "disable adblocker" modal with no visible DOM exit
- [ ] **Phase 92: Misleading Premium Highlighting** - DARK-06: select cheapest flight on site with misleading premium highlights
- [ ] **Phase 93: Hidden Newsletter Uncheck** - DARK-07: uncheck hidden newsletter subscription box before submit
- [ ] **Phase 94: Buried Login Link** - DARK-08: find actual login link on homepage that prioritizes Sign Up CTAs
- [ ] **Phase 95: Skip Ad Countdown** - DARK-09: click Skip Ad button after 5-second countdown finishes
- [ ] **Phase 96: Anti-Scrape Site Text Extraction** - DARK-10: scrape text from site blocking right-clicks, selection, masking CSS

## Phase Details

### Phase 47: TradingView Fibonacci
**Goal:** Execute TradingView Fibonacci retracement drawing via MCP manual tools; fix any canvas interaction blockers found
**Depends on:** Nothing (first phase of milestone)
**Requirements:** CANVAS-01
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** 2 plans
Plans:
- [ ] 47-01-PLAN.md -- CDP click_at and drag MCP tools for canvas interaction
- [ ] 47-02-PLAN.md -- Execute TradingView Fibonacci test, update site guide, generate diagnostic report

### Phase 48: Figma Frame Alignment
**Goal:** Execute Figma-like editor frame creation and rectangle alignment via MCP manual tools; fix blockers
**Depends on:** Phase 47
**Requirements:** CANVAS-02
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 49: Google Maps Path Tracing
**Goal:** Execute Google Maps zoom and walking path trace around Central Park reservoir via MCP manual tools; fix blockers
**Depends on:** Phase 48
**Requirements:** CANVAS-03
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 50: Browser Solitaire
**Goal:** Execute browser solitaire card move to target via MCP manual tools; fix blockers
**Depends on:** Phase 49
**Requirements:** CANVAS-04
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 51: Photopea Background Removal
**Goal:** Execute Photopea image upload and magic wand background removal via MCP manual tools; fix blockers
**Depends on:** Phase 50
**Requirements:** CANVAS-05
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 52: 3D Product Viewer Rotation
**Goal:** Execute 3D retail shoe viewer 180-degree rotation via MCP manual tools; fix blockers
**Depends on:** Phase 51
**Requirements:** CANVAS-06
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 53: Canvas-Painted Button Click
**Goal:** Execute canvas-pixel button click in browser game via MCP manual tools; fix blockers
**Depends on:** Phase 52
**Requirements:** CANVAS-07
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 54: Online Piano Notes
**Goal:** Execute online piano note playing (Mary Had a Little Lamb, first four notes) via MCP manual tools; fix blockers
**Depends on:** Phase 53
**Requirements:** CANVAS-08
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 55: PDF Signature Placement
**Goal:** Execute online PDF editor signature placement on page 3 dotted line via MCP manual tools; fix blockers
**Depends on:** Phase 54
**Requirements:** CANVAS-09
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 56: Miro Sticky Note Grouping
**Goal:** Execute Miro board sticky note clustering via MCP manual tools; fix blockers
**Depends on:** Phase 55
**Requirements:** CANVAS-10
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 57: Volume Slider Precision
**Goal:** Execute HTML5 video custom volume slider adjustment to exactly 37% via MCP manual tools; fix blockers
**Depends on:** Phase 56
**Requirements:** MICRO-01
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 58: Click-and-Hold Record
**Goal:** Execute 5-second click-and-hold then release on voice memo record button via MCP manual tools; fix blockers
**Depends on:** Phase 57
**Requirements:** MICRO-02
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 59: Drag-and-Drop Reorder
**Goal:** Execute Jira/Trello card drag-and-drop from bottom to top of another list via MCP manual tools; fix blockers
**Depends on:** Phase 58
**Requirements:** MICRO-03
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 60: Text Selection Precision
**Goal:** Execute precise text selection of second sentence in third Wikipedia paragraph via MCP manual tools; fix blockers
**Depends on:** Phase 59
**Requirements:** MICRO-04
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 61: Color Picker Custom Hex
**Goal:** Execute color picker hue slider and shade reticle drag to select custom hex via MCP manual tools; fix blockers
**Depends on:** Phase 60
**Requirements:** MICRO-05
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 62: Horizontal Carousel Scroll
**Goal:** Execute horizontal carousel scroll without triggering vertical scroll via MCP manual tools; fix blockers
**Depends on:** Phase 61
**Requirements:** MICRO-06
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 63: CSS Mega-Menu Navigation
**Goal:** Execute hover-triggered CSS mega-menu navigation to nested sub-link via MCP manual tools; fix blockers
**Depends on:** Phase 62
**Requirements:** MICRO-07
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 64: Dropzone File Upload
**Goal:** Execute browser dropzone file upload simulation via MCP manual tools; fix blockers
**Depends on:** Phase 63
**Requirements:** MICRO-08
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 65: Slide-to-Fit CAPTCHA
**Goal:** Execute slide-to-fit puzzle CAPTCHA drag at variable speed via MCP manual tools; fix blockers
**Depends on:** Phase 64
**Requirements:** MICRO-09
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 66: Podcast Timeline Scrub
**Goal:** Execute podcast audio timeline scrub to exactly 14:22 mark via MCP manual tools; fix blockers
**Depends on:** Phase 65
**Requirements:** MICRO-10
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 67: Twitter 150th Post Extraction
**Goal:** Execute X/Twitter infinite feed scroll to extract text of 150th post via MCP manual tools; fix blockers
**Depends on:** Phase 66
**Requirements:** SCROLL-01
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 68: E-Commerce 500-Item Scrape
**Goal:** Execute dynamic e-commerce search page full scrape of 500 product names via MCP manual tools; fix blockers
**Depends on:** Phase 67
**Requirements:** SCROLL-02
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 69: Dashboard Log Entry Search
**Goal:** Execute infinite-scroll dashboard search for log entry from 3 days ago via MCP manual tools; fix blockers
**Depends on:** Phase 68
**Requirements:** SCROLL-03
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 70: Reddit Thread Bottom Reply
**Goal:** Execute Reddit thread bottom navigation and last comment reply via MCP manual tools; fix blockers
**Depends on:** Phase 69
**Requirements:** SCROLL-04
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 71: Virtualized PDF Reader
**Goal:** Execute multi-page virtualized PDF viewer reading with unloading pages via MCP manual tools; fix blockers
**Depends on:** Phase 70
**Requirements:** SCROLL-05
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 72: Hacker News Thread Expansion
**Goal:** Execute HN post nested comment thread full expansion with 1000+ comments via MCP manual tools; fix blockers
**Depends on:** Phase 71
**Requirements:** SCROLL-06
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 73: Airbnb Map Pan Search
**Goal:** Execute Airbnb map pan to populate new listing pins via MCP manual tools; fix blockers
**Depends on:** Phase 72
**Requirements:** SCROLL-07
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 74: TikTok Cat Video Search
**Goal:** Execute TikTok web feed infinite scroll to find cat-containing video via MCP manual tools; fix blockers
**Depends on:** Phase 73
**Requirements:** SCROLL-08
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 75: Viewport-Only Pricing Table
**Goal:** Execute viewport-gated pricing table row extraction via MCP manual tools; fix blockers
**Depends on:** Phase 74
**Requirements:** SCROLL-09
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 76: News Site Date-Stop Scroll
**Goal:** Execute infinite-scroll news site scroll stopping at yesterday's articles via MCP manual tools; fix blockers
**Depends on:** Phase 75
**Requirements:** SCROLL-10
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 77: Live Sports Score Monitor
**Goal:** Execute 30-minute live sports ticker monitoring with score change logging via MCP manual tools; fix blockers
**Depends on:** Phase 76
**Requirements:** CONTEXT-01
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 78: Observable Notebook Edit
**Goal:** Execute Observable notebook fork with cell 3 data modification without altering cell 1 via MCP manual tools; fix blockers
**Depends on:** Phase 77
**Requirements:** CONTEXT-02
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 79: 50-Page PDF Form Fill
**Goal:** Execute 50-page PDF read then web form fill from pages 4, 17, 42 via MCP manual tools; fix blockers
**Depends on:** Phase 78
**Requirements:** CONTEXT-03
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 80: Multi-Tab Flight Price Compare
**Goal:** Execute 5-tab flight price comparison then return to cheapest tab via MCP manual tools; fix blockers
**Depends on:** Phase 79
**Requirements:** CONTEXT-04
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 81: Multi-Step Checkout with Correction
**Goal:** Execute multi-step checkout with wrong zip entry, correction, and tax update verification via MCP manual tools; fix blockers
**Depends on:** Phase 80
**Requirements:** CONTEXT-05
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 82: Support Chatbot 15-Turn Summary
**Goal:** Execute 15-turn support chatbot conversation then summarize first instruction via MCP manual tools; fix blockers
**Depends on:** Phase 81
**Requirements:** CONTEXT-06
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 83: 2FA Multi-Tab Auth Flow
**Goal:** Execute 2FA flow with new tab email code fetch and return to complete login via MCP manual tools; fix blockers
**Depends on:** Phase 82
**Requirements:** CONTEXT-07
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 84: Google Doc Word Replace
**Goal:** Execute manual Google Doc word replacement of "synergy" with "collaboration" (no Find/Replace) via MCP manual tools; fix blockers
**Depends on:** Phase 83
**Requirements:** CONTEXT-08
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 85: CRM vs HR Portal Cross-Reference
**Goal:** Execute 50-employee name cross-reference between web CRM and HR portal via MCP manual tools; fix blockers
**Depends on:** Phase 84
**Requirements:** CONTEXT-09
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 86: Session Expiry Re-Auth
**Goal:** Execute session expiration modal handling, re-authentication, and task resumption via MCP manual tools; fix blockers
**Depends on:** Phase 85
**Requirements:** CONTEXT-10
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 87: Freeware Download Ad Avoidance
**Goal:** Execute freeware site real download while ignoring fake "Download Now" ad buttons via MCP manual tools; fix blockers
**Depends on:** Phase 86
**Requirements:** DARK-01
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 88: Cookie Opt-Out Hidden Reject
**Goal:** Execute EU news site full cookie opt-out with hidden reject button via MCP manual tools; fix blockers
**Depends on:** Phase 87
**Requirements:** DARK-02
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 89: Shuffled Cancel Button
**Goal:** Execute subscription cancellation on site with randomized Keep/Cancel button positions via MCP manual tools; fix blockers
**Depends on:** Phase 88
**Requirements:** DARK-03
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 90: Camouflaged Close Button
**Goal:** Execute pop-up ad close where X is camouflaged against the background via MCP manual tools; fix blockers
**Depends on:** Phase 89
**Requirements:** DARK-04
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 91: Adblocker Modal Bypass
**Goal:** Execute "disable adblocker" modal bypass with no visible DOM exit button via MCP manual tools; fix blockers
**Depends on:** Phase 90
**Requirements:** DARK-05
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 92: Misleading Premium Highlighting
**Goal:** Execute cheapest flight selection on airline site with deceptive premium UI highlighting via MCP manual tools; fix blockers
**Depends on:** Phase 91
**Requirements:** DARK-06
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 93: Hidden Newsletter Uncheck
**Goal:** Execute hidden pre-checked newsletter subscription uncheck before form submit via MCP manual tools; fix blockers
**Depends on:** Phase 92
**Requirements:** DARK-07
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 94: Buried Login Link
**Goal:** Execute login link discovery on homepage dominated by Sign Up CTAs via MCP manual tools; fix blockers
**Depends on:** Phase 93
**Requirements:** DARK-08
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 95: Skip Ad Countdown
**Goal:** Execute video player Skip Ad button click after 5-second countdown completes via MCP manual tools; fix blockers
**Depends on:** Phase 94
**Requirements:** DARK-09
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

### Phase 96: Anti-Scrape Site Text Extraction
**Goal:** Execute text extraction from site blocking right-clicks, disabling selection, and masking CSS classes via MCP manual tools; fix blockers
**Depends on:** Phase 95
**Requirements:** DARK-10
**Success Criteria** (what must be TRUE):
  1. Edge case prompt attempted via MCP manual tools with documented outcome (pass/fail/partial/skip-auth)
  2. Any tool or extension bugs discovered are fixed in-phase with tests
  3. Autopilot diagnostic report generated documenting: what worked, what failed, tool gaps, and autopilot recommendations
**Plans:** TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 47. TradingView Fibonacci | 0/1 | Not started | - |
| 48. Figma Frame Alignment | 0/1 | Not started | - |
| 49. Google Maps Path Tracing | 0/1 | Not started | - |
| 50. Browser Solitaire | 0/1 | Not started | - |
| 51. Photopea Background Removal | 0/1 | Not started | - |
| 52. 3D Product Viewer Rotation | 0/1 | Not started | - |
| 53. Canvas-Painted Button Click | 0/1 | Not started | - |
| 54. Online Piano Notes | 0/1 | Not started | - |
| 55. PDF Signature Placement | 0/1 | Not started | - |
| 56. Miro Sticky Note Grouping | 0/1 | Not started | - |
| 57. Volume Slider Precision | 0/1 | Not started | - |
| 58. Click-and-Hold Record | 0/1 | Not started | - |
| 59. Drag-and-Drop Reorder | 0/1 | Not started | - |
| 60. Text Selection Precision | 0/1 | Not started | - |
| 61. Color Picker Custom Hex | 0/1 | Not started | - |
| 62. Horizontal Carousel Scroll | 0/1 | Not started | - |
| 63. CSS Mega-Menu Navigation | 0/1 | Not started | - |
| 64. Dropzone File Upload | 0/1 | Not started | - |
| 65. Slide-to-Fit CAPTCHA | 0/1 | Not started | - |
| 66. Podcast Timeline Scrub | 0/1 | Not started | - |
| 67. Twitter 150th Post Extraction | 0/1 | Not started | - |
| 68. E-Commerce 500-Item Scrape | 0/1 | Not started | - |
| 69. Dashboard Log Entry Search | 0/1 | Not started | - |
| 70. Reddit Thread Bottom Reply | 0/1 | Not started | - |
| 71. Virtualized PDF Reader | 0/1 | Not started | - |
| 72. Hacker News Thread Expansion | 0/1 | Not started | - |
| 73. Airbnb Map Pan Search | 0/1 | Not started | - |
| 74. TikTok Cat Video Search | 0/1 | Not started | - |
| 75. Viewport-Only Pricing Table | 0/1 | Not started | - |
| 76. News Site Date-Stop Scroll | 0/1 | Not started | - |
| 77. Live Sports Score Monitor | 0/1 | Not started | - |
| 78. Observable Notebook Edit | 0/1 | Not started | - |
| 79. 50-Page PDF Form Fill | 0/1 | Not started | - |
| 80. Multi-Tab Flight Price Compare | 0/1 | Not started | - |
| 81. Multi-Step Checkout with Correction | 0/1 | Not started | - |
| 82. Support Chatbot 15-Turn Summary | 0/1 | Not started | - |
| 83. 2FA Multi-Tab Auth Flow | 0/1 | Not started | - |
| 84. Google Doc Word Replace | 0/1 | Not started | - |
| 85. CRM vs HR Portal Cross-Reference | 0/1 | Not started | - |
| 86. Session Expiry Re-Auth | 0/1 | Not started | - |
| 87. Freeware Download Ad Avoidance | 0/1 | Not started | - |
| 88. Cookie Opt-Out Hidden Reject | 0/1 | Not started | - |
| 89. Shuffled Cancel Button | 0/1 | Not started | - |
| 90. Camouflaged Close Button | 0/1 | Not started | - |
| 91. Adblocker Modal Bypass | 0/1 | Not started | - |
| 92. Misleading Premium Highlighting | 0/1 | Not started | - |
| 93. Hidden Newsletter Uncheck | 0/1 | Not started | - |
| 94. Buried Login Link | 0/1 | Not started | - |
| 95. Skip Ad Countdown | 0/1 | Not started | - |
| 96. Anti-Scrape Site Text Extraction | 0/1 | Not started | - |

---
*Roadmap created: 2026-03-19*
*Milestone: v0.9.7 MCP Edge Case Validation*
*Coverage: 50/50 requirements (CANVAS-01 through DARK-10)*
