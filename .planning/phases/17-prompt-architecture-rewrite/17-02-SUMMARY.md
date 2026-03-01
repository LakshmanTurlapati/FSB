---
phase: 17-prompt-architecture-rewrite
plan: 02
subsystem: ai-prompts
tags: [cli-format, site-guides, common-patterns, storejobdata, prompt-engineering]

# Dependency graph
requires:
  - phase: 15-cli-parser
    provides: CLI command registry defining command names and syntax
  - phase: 16-yaml-snapshot
    provides: YAML snapshot format with numeric refs (e5, e12)
provides:
  - CLI COMMON PATTERNS sections in all 84 per-site guide files
  - Consistent CLI format across system prompt and site-specific guidance
  - storejobdata CLI command examples in all career guides
affects: [18-system-prompt-rewrite, 19-integration-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "COMMON PATTERNS section inserted after site header, before first content section"
    - "CLI one-liners with numeric refs (e5, e12) and # comments"
    - "Category-specific example workflows (search+cart, compose+send, lookup+extract, navigate+search+storejobdata)"

key-files:
  created: []
  modified:
    - site-guides/ecommerce/*.js (5 files)
    - site-guides/social/*.js (6 files)
    - site-guides/finance/*.js (6 files)
    - site-guides/travel/*.js (7 files)
    - site-guides/email/*.js (3 files)
    - site-guides/coding/*.js (6 files)
    - site-guides/gaming/*.js (4 files)
    - site-guides/productivity/*.js (2 files)
    - site-guides/career/*.js (45 files)

key-decisions:
  - "COMMON PATTERNS inserted after guidance header line, before first content section (NAVIGATION/SEARCH/etc.)"
  - "Career guides use 3 tiers: ATS platforms get comprehensive CLI examples, job boards get full search+extract, company guides get compact navigate+search+storejobdata"
  - "All career guides include storejobdata as final CLI command regardless of tier"

patterns-established:
  - "Site guide enrichment pattern: COMMON PATTERNS section with 3-8 CLI one-liners per site"
  - "Numeric ref placeholders (e5, e8, e10, e12, e15, e20, e25) with # comment explaining target"

requirements-completed: [PROMPT-04]

# Metrics
duration: 7min
completed: 2026-03-01
---

# Phase 17 Plan 02: Site Guide CLI Enrichment Summary

**All 84 per-site guide files enriched with CLI COMMON PATTERNS sections using numeric ref format, reinforcing CLI grammar from system prompt with site-specific examples**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-01T06:52:37Z
- **Completed:** 2026-03-01T06:59:09Z
- **Tasks:** 2
- **Files modified:** 84

## Accomplishments
- Enriched all 39 non-career site guides (ecommerce, social, finance, travel, email, coding, gaming, productivity) with category-appropriate CLI COMMON PATTERNS
- Enriched all 45 career site guides across 3 tiers (5 ATS, 4 job board, 36 company-specific) with job search CLI patterns including storejobdata
- Verified all 84 files pass node syntax check, contain COMMON PATTERNS, and use consistent CLI format with numeric refs

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich non-career site guides with CLI COMMON PATTERNS sections** - `f88e1f5` (feat)
2. **Task 2: Enrich career site guides with CLI COMMON PATTERNS sections** - `12ceeef` (feat)

## Files Created/Modified
- `site-guides/ecommerce/*.js` (5 files) - Search+add-to-cart CLI patterns
- `site-guides/social/*.js` (6 files) - Navigate+interact CLI patterns
- `site-guides/finance/*.js` (6 files) - Lookup+extract CLI patterns
- `site-guides/travel/*.js` (7 files) - Search destination+dates CLI patterns
- `site-guides/email/*.js` (3 files) - Compose+send CLI patterns
- `site-guides/coding/*.js` (6 files) - Solve+submit CLI patterns
- `site-guides/gaming/*.js` (4 files) - Search store+price check CLI patterns
- `site-guides/productivity/*.js` (2 files) - Edit document/spreadsheet CLI patterns
- `site-guides/career/*.js` (45 files) - Navigate+search+storejobdata CLI patterns

## Decisions Made
- COMMON PATTERNS section placed after the guidance header line and before the first content section to maintain guide readability
- Career guides tiered into 3 levels: ATS platforms (comprehensive), job boards (full search+extract), company-specific (compact navigate+search+extract)
- All career guides include storejobdata as the final CLI command since data extraction is the critical action
- Company-specific guides use their actual careerUrl in the navigate command for realistic examples

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 84 per-site guide files now have consistent CLI COMMON PATTERNS sections
- The AI will see CLI format reinforced in both the system prompt (Phase 17-01/18) and site-specific guidance
- Ready for Phase 18 (system prompt rewrite) which will reference these CLI patterns

## Self-Check: PASSED

- FOUND: 17-02-SUMMARY.md
- FOUND: f88e1f5 (Task 1 commit)
- FOUND: 12ceeef (Task 2 commit)

---
*Phase: 17-prompt-architecture-rewrite*
*Completed: 2026-03-01*
