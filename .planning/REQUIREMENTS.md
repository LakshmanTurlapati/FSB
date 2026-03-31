# Requirements: FSB v0.9.11 MCP Tool Quality

**Defined:** 2026-03-31
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Search Reliability

- [ ] **SRCH-01**: User can use the `search` tool on any site and it types the query into the site's own search input instead of redirecting to Google
- [ ] **SRCH-02**: Search tool detects the site's search input via DOM heuristics (input[type=search], [role=search] input, input[name=q], placeholder matching)
- [ ] **SRCH-03**: Search tool submits the search form after typing (Enter key or submit button click)
- [ ] **SRCH-04**: Search tool falls back to Google only when no site search input is detected

### Content Extraction

- [x] **CONT-01**: `read_page` automatically waits for DOM stability before extracting text (no separate wait_for_stable call needed)
- [x] **CONT-02**: `read_page` uses quick-extract-then-retry pattern: if initial extraction returns <200 chars, wait for DOM stability and re-extract
- [x] **CONT-03**: `read_page` prioritizes main content area (`<main>`, `[role=main]`, `#content`, article) over sidebar/nav/footer
- [x] **CONT-04**: `read_page` caps output at ~8K chars with intelligent truncation (main content first, then supplementary)
- [x] **CONT-05**: Sites that previously returned <200 chars (Airbnb, Booking.com, Kayak) return meaningful content after stability wait

### Navigation Resilience

- [x] **NAV-01**: Content script survives BF cache transitions via `pageshow` event listener with `event.persisted` detection
- [x] **NAV-02**: Click that causes page navigation returns success with navigation info instead of a BF cache error
- [x] **NAV-03**: After BF cache restoration, content script re-establishes communication port with background service worker
- [x] **NAV-04**: MCP caller receives actionable response from click even when page transitions (not an opaque error)

### Interaction Reliability

- [x] **INTR-01**: Click and hover scroll elements into view accounting for fixed/sticky headers (not just raw scrollIntoView)
- [x] **INTR-02**: After scrolling, click verifies element is actually visible via elementFromPoint check before clicking
- [ ] **INTR-03**: `press_enter` automatically falls back to clicking the form's submit button when Enter key has no effect
- [x] **INTR-04**: Off-viewport elements that get_text/get_attribute can access are also clickable/hoverable after scroll

### Overlay Handling

- [ ] **OVLY-01**: Cookie consent overlays are automatically detected via CMP framework identifiers (OneTrust, Cookiebot, TrustArc class/ID patterns)
- [ ] **OVLY-02**: Detected cookie consent overlays are dismissed by clicking reject/decline/necessary-only buttons
- [ ] **OVLY-03**: Cookie dismiss runs proactively before read_page and interaction tools, not only reactively
- [ ] **OVLY-04**: Non-cookie overlays (login prompts, newsletter popups, paywalls) are NOT dismissed -- only cookie consent

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Content Extraction (Advanced)

- **CONT-06**: Configurable maxChars parameter on read_page MCP tool (currently fixed default)
- **CONT-07**: Canvas/chart element data extraction (SVG labels, axis values from chart sites like TradingView, Finviz)

### Search (Advanced)

- **SRCH-05**: Site-guide selector integration for search inputs on known sites (higher coverage on Amazon, YouTube, etc.)
- **SRCH-06**: Autocomplete handling -- dismiss autocomplete dropdown before submitting search

### Overlay Handling (Advanced)

- **OVLY-05**: Newsletter/email signup popup auto-dismiss
- **OVLY-06**: Paywall detection and notification to user

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Readability.js library integration | Lightweight heuristic (~100 lines) sufficient; library adds bundle size and maintenance |
| AI-powered search input detection | Too slow; deterministic DOM heuristics cover 90%+ of sites |
| Headless browser fallback for JS rendering | Architecture constraint -- FSB runs in user's browser, not server-side |
| Multi-tab search coordination | Separate feature, not part of tool quality fixes |
| Screenshot-based content extraction | Out of scope -- DOM text extraction approach maintained |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 126 | Complete |
| CONT-02 | Phase 126 | Complete |
| CONT-03 | Phase 126 | Complete |
| CONT-04 | Phase 126 | Complete |
| CONT-05 | Phase 126 | Complete |
| NAV-01 | Phase 127 | Complete |
| NAV-02 | Phase 127 | Complete |
| NAV-03 | Phase 127 | Complete |
| NAV-04 | Phase 127 | Complete |
| INTR-01 | Phase 128 | Complete |
| INTR-02 | Phase 128 | Complete |
| INTR-04 | Phase 128 | Complete |
| INTR-03 | Phase 129 | Pending |
| OVLY-01 | Phase 130 | Pending |
| OVLY-02 | Phase 130 | Pending |
| OVLY-03 | Phase 130 | Pending |
| OVLY-04 | Phase 130 | Pending |
| SRCH-01 | Phase 131 | Pending |
| SRCH-02 | Phase 131 | Pending |
| SRCH-03 | Phase 131 | Pending |
| SRCH-04 | Phase 131 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation (all 21 requirements mapped to phases 126-131)*
