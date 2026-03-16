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

- [ ] **TREL-01**: Site guide with URL patterns, fsbElements (3-8 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Trello
- [ ] **TREL-02**: Workflows for create card, move card between lists (keyboard-only, no drag), edit card details, create list, board navigation

### Google Calendar

- [ ] **GCAL-01**: Site guide with URL patterns, fsbElements (5-10 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Google Calendar
- [ ] **GCAL-02**: Workflows for create event, edit event details, navigate dates, switch views (day/week/month), RSVP to invitations

### Notion

- [ ] **NOTN-01**: Site guide with URL patterns, fsbElements (10-18 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Notion
- [ ] **NOTN-02**: Workflows for create page, add blocks (text/heading/todo/table), slash command usage, database view navigation, search

### Jira

- [ ] **JIRA-01**: Site guide with URL patterns, fsbElements (8-12 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Jira (new UI only)
- [ ] **JIRA-02**: Workflows for create issue, transition issue status, board navigation, search/filter issues, add comment

### Airtable

- [ ] **ATBL-01**: Site guide with URL patterns, fsbElements (10-16 elements with 5 strategies each), guidance, keyboard shortcuts, and warnings for Airtable
- [ ] **ATBL-02**: Workflows for navigate grid, edit cells by field type, create record, switch views (grid/kanban/calendar/gallery), sort/filter

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
| TREL-01 | Phase 30 | Pending |
| TREL-02 | Phase 30 | Pending |
| GCAL-01 | Phase 30 | Pending |
| GCAL-02 | Phase 30 | Pending |
| NOTN-01 | Phase 30 | Pending |
| NOTN-02 | Phase 30 | Pending |
| JIRA-01 | Phase 30 | Pending |
| JIRA-02 | Phase 30 | Pending |
| ATBL-01 | Phase 30 | Pending |
| ATBL-02 | Phase 30 | Pending |

**Coverage:**
- v0.9.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation*
