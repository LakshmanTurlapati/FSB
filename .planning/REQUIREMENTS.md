# Requirements: v9.4 Career Search Automation

**Defined:** 2026-02-23
**Core Value:** Reliable single-attempt execution

## v9.4 Requirements

### Data Pipeline

- [ ] **PIPE-01**: 38 crowd session logs parsed into per-domain sitemaps with confidence scoring (HIGH: >10 elements, MEDIUM: 1-10, LOW: 0 elements)
- [ ] **PIPE-02**: Per-company site guides generated with stability-classified selectors (prefer id, aria-label, role; hashed CSS selectors included but flagged as UNSTABLE)
- [ ] **PIPE-03**: Direct career URLs embedded in site guides for all session-log companies (skip Google search overhead)

### Career Search

- [ ] **SEARCH-01**: Single-company career search navigates site, searches, extracts jobs with required fields (company, title, apply link) and best-effort fields (date, location, description)
- [ ] **SEARCH-02**: Multi-company sequential search handles prompts naming 2-10 companies, visiting each in sequence
- [ ] **SEARCH-03**: Vague query interpretation maps broad terms ("tech internships", "DevOps positions") to concrete search queries
- [ ] **SEARCH-04**: Deduplication eliminates cross-site duplicate listings before writing to Sheets
- [ ] **SEARCH-05**: Error reporting communicates which companies had no results (never silent failure)
- [ ] **SEARCH-06**: Progress reporting shows current company and count during multi-site workflows ("Searching Microsoft... 2/5")

### Data Management

- [ ] **DATA-01**: Job data persisted to chrome.storage.local after each company extraction (survives service worker restarts)
- [ ] **DATA-02**: storeJobData and getStoredJobs tools exposed for AI to use during career workflows

### Google Sheets

- [ ] **SHEETS-01**: Data entry via Name Box + Tab/Enter pattern into new Sheet or user-provided URL
- [ ] **SHEETS-02**: Smart field defaults (company, title, date, location, description, apply link) with user-customizable field selection
- [ ] **SHEETS-03**: Bold headers, colored header row, frozen header row
- [ ] **SHEETS-04**: Sheet title naming from task context (e.g., "Job Search - SWE Internships - Feb 2026")
- [ ] **SHEETS-05**: Column auto-sizing for readable output

## Future Requirements (Deferred to Later Phases)

- [ ] **FUT-01**: Salary information extraction when available on career pages (pay transparency data)
- [ ] **FUT-02**: Apply link validation -- verify links lead to live application pages, not 404s or expired listings

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-apply to jobs | Legal/ethical risk, quality destruction, scope explosion into unreliable ATS form automation |
| Scraping behind login walls | TOS violations, account risk, credential security liability |
| Real-time job monitoring | MV3 service worker lifecycle prohibits continuous background polling |
| Resume/cover letter generation | Different product category with different quality bar |
| Full job description extraction | Destroys spreadsheet readability, multiplies extraction time 5-10x |
| Comparison scoring or ranking | Subjective, creates false confidence, exposes liability |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 9 | Complete |
| PIPE-02 | Phase 9 | Complete |
| PIPE-03 | Phase 9 | Complete |
| SEARCH-01 | Phase 10 | Complete |
| SEARCH-02 | Phase 11 | Complete |
| SEARCH-03 | Phase 10 | Complete |
| SEARCH-04 | Phase 11 | Complete |
| SEARCH-05 | Phase 10 | Complete |
| SEARCH-06 | Phase 11 | Complete |
| DATA-01 | Phase 11 | Complete |
| DATA-02 | Phase 11 | Complete |
| SHEETS-01 | Phase 12 | Pending |
| SHEETS-02 | Phase 12 | Pending |
| SHEETS-03 | Phase 13 | Pending |
| SHEETS-04 | Phase 12 | Pending |
| SHEETS-05 | Phase 13 | Pending |

**Coverage:**
- v9.4 requirements: 16 total
- Mapped: 16/16
- Future requirements: 2 (deferred)
- Unmapped: 0

---
*Defined: 2026-02-23 for milestone v9.4 Career Search Automation*
