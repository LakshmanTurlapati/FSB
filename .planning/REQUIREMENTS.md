# Requirements: FSB (Full Self-Browsing)

**Defined:** 2026-03-16
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.2 Requirements

Requirements for Productivity Site Intelligence milestone. All map to a single phase.

### Infrastructure

- [x] **INFRA-01**: fsbElements injection in Stage 1b generalized to fire for any site guide with fsbElements, not just Google Sheets
- [x] **INFRA-02**: Keyword matching in site-guides/index.js updated with app names and task keywords for all 7 new apps
- [x] **INFRA-03**: Google domain disambiguation (calendar.google.com vs docs.google.com/spreadsheets vs keep.google.com) in URL pattern matching

### Google Keep

- [x] **KEEP-01**: Site guide with URL patterns, guidance, keyboard shortcuts, and warnings for Google Keep
- [x] **KEEP-02**: Workflows for create note, create checklist, pin/archive/delete notes, add labels

### Todoist

- [x] **TODO-01**: Site guide with URL patterns, guidance, keyboard shortcuts (with single-key conflict warnings), and warnings for Todoist
- [x] **TODO-02**: Workflows for quick-add with natural language syntax (#project @label p1 tomorrow), complete task, organize by project/label/priority

### Trello

- [x] **TREL-01**: Site guide with URL patterns, fsbElements (3-8 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Trello
- [x] **TREL-02**: Workflows for create card, move card between lists (keyboard-only, no drag), edit card details, create list, board navigation

### Google Calendar

- [x] **GCAL-01**: Site guide with URL patterns, fsbElements (5-10 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Google Calendar
- [x] **GCAL-02**: Workflows for create event, edit event details, navigate dates, switch views (day/week/month), RSVP to invitations

### Notion

- [x] **NOTN-01**: Site guide with URL patterns, fsbElements (10-18 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Notion
- [x] **NOTN-02**: Workflows for create page, add blocks (text/heading/todo/table), slash command usage, database view navigation, search

### Jira

- [x] **JIRA-01**: Site guide with URL patterns, fsbElements (8-12 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Jira (new UI only)
- [x] **JIRA-02**: Workflows for create issue, transition issue status, board navigation, search/filter issues, add comment

### Airtable

- [x] **ATBL-01**: Site guide with URL patterns, fsbElements (10-16 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Airtable
- [x] **ATBL-02**: Workflows for navigate grid, edit cells by field type, create record, switch views (grid/kanban/calendar/gallery), sort/filter

## v0.9.4 Requirements

Requirements for AI Perception & Action Quality milestone. Cross-cutting refinements to snapshot quality, action diagnostics, stability detection, error recovery.

### Snapshot & Perception

- [x] **SNAP-01**: Scroll metadata header on every snapshot with scroll position %, hasMoreAbove/hasMoreBelow flags, content-remaining estimate
- [x] **SNAP-02**: Viewport-complete element inclusion -- all interactive elements in current viewport included, no arbitrary element cap (80). Dynamic based on what's visible

### Action Diagnostics & Verification

- [ ] **DIAG-01**: 8-point diagnostic check before action failure reporting (visible? disabled? covered? needs scroll? pointer-events:none? collapsed? needs hover? removed from DOM?)
- [ ] **DIAG-02**: Diagnostics applied to ALL interactive actions (click, type, select, check), not just click
- [ ] **VRFY-01**: Localized + global verification -- track changes near action target AND global state, report specific observations
- [ ] **VRFY-02**: Canvas-aware verification for Google Docs/Sheets via visible text changes, selection movement, URL fragment updates
- [ ] **VRFY-03**: Every action response includes what changed, what didn't, and confidence level

### Continuation Prompt Quality

- [x] **CONT-01**: Hybrid continuation prompt keeping REASONING FRAMEWORK, TOOL PREFERENCES, site guide knowledge, specific scenarios; only dropping security preamble and locale
- [x] **CONT-02**: Explicit domain change flag to AI: "DOMAIN CHANGED from [old] to [new]. Previous site assumptions invalid."
- [x] **CONT-03**: Site-aware tool hints in continuation prompt using site guide toolPreferences array
- [x] **CONT-04**: Stuck detection heuristic cleanup -- document and simplify counter/reset conditions in background.js

### Adaptive Waiting

- [ ] **WAIT-01**: Replace ALL hardcoded setTimeout delays in actions.js with observation-based waitForPageStability calls
- [ ] **WAIT-02**: UI-ready detection for infinite-fetching sites -- detect when interactive elements become enabled/focusable, proceed even if background fetches continue

### Selector Resilience

- [ ] **SEL-01**: Context-aware re-resolve when selectors fail -- use element's last-known context (nearby text, parent structure, position) to re-find it
- [ ] **SEL-02**: Unique selector match requirement -- if selector matches >1 element, fall back to more specific selector or add positional constraint

### Binary State Actions

- [ ] **BIN-01**: Generic ARIA pre-check for all binary state actions (toggle/expand/collapse) -- check aria-expanded/aria-checked/aria-selected/aria-pressed before acting, skip if already in target state
- [ ] **BIN-02**: Intent-based check/uncheck CLI commands that enforce target state (separate from toggle for explicit flip)

### Error Reporting & Debug

- [ ] **ERR-01**: Structured diagnostic on every failure: reason (human-readable), diagnostic (what was checked), suggestions (natural language for AI)
- [ ] **ERR-02**: Element state snapshot on failure: visibility, disabled state, ARIA attributes, parent context
- [ ] **ERR-03**: Parallel debug fallback -- heuristic engine AND AI debugger fire concurrently on failure; if heuristic works, discard debugger; if heuristic fails, AI diagnosis already ready

## Future Requirements

### Mechanical Tools (v2+)

- **MECH-01**: Airtable bulk data entry tool (fillairtable) for deterministic grid filling
- **MECH-02**: Notion database bulk entry tool for table/database views
- **MECH-03**: Cross-app workflow support (e.g., Jira issues to Airtable)

### Template Support (v2+)

- **TMPL-01**: Notion template-aware page creation
- **TMPL-02**: Jira issue template selection during creation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drag-and-drop automation | CDP synthetic events don't work with react-beautiful-dnd; keyboard alternatives documented instead |
| Old Jira UI support | Building for new UI only; old UI is being deprecated by Atlassian |
| Airtable mechanical tools | Keyboard navigation sufficient for v1; revisit if grid is canvas-rendered |
| Cross-app workflows | Single-app intelligence first; cross-app orchestration is a separate milestone |
| Per-field-type Airtable tools | Rich field types (attachments, linked records) handled via guidance, not mechanical tools |
| Multi-pass DOM snapshot | Architectural change (critical first, on-demand expansion) -- separate phase |
| Segment pages into scroll chunks | Complex overlapping viewport windows -- separate phase |
| Learned selector caching from memory | Depends on memory system maturity -- separate phase |
| Security pre-filtering | Command-like pattern filtering in page content -- separate security phase |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 30 | Complete |
| INFRA-02 | Phase 30 | Complete |
| INFRA-03 | Phase 30 | Complete |
| KEEP-01 | Phase 30 | Complete |
| KEEP-02 | Phase 30 | Complete |
| TODO-01 | Phase 30 | Complete |
| TODO-02 | Phase 30 | Complete |
| TREL-01 | Phase 30 | Complete |
| TREL-02 | Phase 30 | Complete |
| GCAL-01 | Phase 30 | Complete |
| GCAL-02 | Phase 30 | Complete |
| NOTN-01 | Phase 30 | Complete |
| NOTN-02 | Phase 30 | Complete |
| JIRA-01 | Phase 30 | Complete |
| JIRA-02 | Phase 30 | Complete |
| ATBL-01 | Phase 30 | Complete |
| ATBL-02 | Phase 30 | Complete |
| SNAP-01 | Phase 35 | Planned |
| SNAP-02 | Phase 35 | Planned |
| DIAG-01 | Phase 35 | Planned |
| DIAG-02 | Phase 35 | Planned |
| VRFY-01 | Phase 35 | Planned |
| VRFY-02 | Phase 35 | Planned |
| VRFY-03 | Phase 35 | Planned |
| CONT-01 | Phase 35 | Planned |
| CONT-02 | Phase 35 | Planned |
| CONT-03 | Phase 35 | Planned |
| CONT-04 | Phase 35 | Planned |
| WAIT-01 | Phase 35 | Planned |
| WAIT-02 | Phase 35 | Planned |
| SEL-01 | Phase 35 | Planned |
| SEL-02 | Phase 35 | Planned |
| BIN-01 | Phase 35 | Planned |
| BIN-02 | Phase 35 | Planned |
| ERR-01 | Phase 35 | Planned |
| ERR-02 | Phase 35 | Planned |
| ERR-03 | Phase 35 | Planned |

**Coverage:**
- v0.9.2 requirements: 17 total, mapped: 17, unmapped: 0
- v0.9.4 requirements: 18 total, mapped: 18, unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after Phase 35 planning*
