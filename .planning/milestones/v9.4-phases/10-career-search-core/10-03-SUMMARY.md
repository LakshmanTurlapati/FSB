---
phase: 10-career-search-core
plan: 03
subsystem: ai-prompt-pipeline
tags: [career-prompt, company-guide-injection, structured-output, error-reporting, cookie-dismissal]

requires:
  - phase: 10-01
    provides: getGuideByCompanyName() and extractCompanyFromTask() functions
provides:
  - Phase 10 scoped career prompt (search+extract only, no Sheets)
  - Company-name guide injection in _buildTaskGuidance for careerUrl direct navigation
affects:
  - 11 (multi-site career search consumes structured output format)
  - 12-13 (Google Sheets entry phases will need their own prompt -- career prompt no longer includes Sheets)

tech-stack:
  added: []
  patterns:
    - Company-name override of keyword-fallback siteGuide in prompt pipeline
    - careerUrl directive injection for direct navigation (skip Google search)
    - Structured output format with JOBS FOUND header for downstream parsing

key-files:
  created: []
  modified:
    - ai/ai-integration.js

key-decisions:
  - "Career prompt reduced from 6 phases to 4 (Phase 0-3) -- removed Google Sheets phases 4-6 entirely"
  - "Company name extraction runs for ALL career tasks regardless of whether siteGuide is already set (keyword-fallback may return wrong company)"
  - "careerUrl directive injected both when siteGuide is null (appended to generic prompt) and when siteGuide is present (appended to site-specific guidance)"
  - "Apply link fallback: try parent a element href before reporting not available"

duration: 3min
completed: 2026-02-23
---

# Phase 10 Plan 03: Career Prompt Refactoring and Company Guide Injection Summary

**Replaced 6-phase career+Sheets prompt with 4-phase search-only prompt (cookie dismiss, navigate, search, extract) and wired company-name guide injection into _buildTaskGuidance for direct careerUrl navigation.**

## Performance
- **Duration:** ~3 minutes
- **Started:** 2026-02-23T12:53:45Z
- **Completed:** 2026-02-23T12:56:36Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- Replaced TASK_PROMPTS.career with Phase 10 scoped search+extract workflow (Phases 0-3)
- Added Phase 0 cookie banner dismissal as first action before any page interaction
- Added structured output format (JOBS FOUND: N with per-job fields: Company, Location, Date, Description, Apply)
- Added error reporting templates: NO RESULTS, AUTH REQUIRED, PAGE ERROR, NO GUIDE
- Added vague query interpretation guidance (e.g., "tech internships" -> "software engineer intern")
- Added apply link fallback logic (try parent element href before reporting unavailable)
- Added relevance rules and explicit completion instructions (no Sheets navigation)
- Modified _buildTaskGuidance to always extract company name for career tasks
- Company-specific guide overrides keyword-fallback siteGuide when they differ
- careerUrl injected as DIRECT CAREER URL directive for immediate navigation
- Updated buildPrompt call site to pass task string as 4th argument

## Task Commits
1. **Task 1: Refactor TASK_PROMPTS.career for Phase 10 search+extract scope** - `7259498` (feat)
2. **Task 2: Wire company-name guide injection into _buildTaskGuidance** - `08aa783` (feat)

## Files Created/Modified
- `ai/ai-integration.js` - Replaced career prompt (63 insertions, 52 deletions) + added company-name guide injection in _buildTaskGuidance (36 insertions, 3 deletions)

## Decisions Made
1. **Career prompt scope**: Removed all 3 Google Sheets phases (navigate, headers, row entry) and all references to spreadsheets. Career prompt now ends at "report extracted jobs."
2. **Company name extraction always runs**: The `taskType === 'career'` branch in _buildTaskGuidance runs regardless of whether siteGuide is already set. This is critical because getGuideForTask's keyword matching may return a generic career guide instead of the specific company the user asked about.
3. **careerUrl injected in both code paths**: When siteGuide is null (no guide found), careerUrlDirective is appended to the generic TASK_PROMPTS.career. When siteGuide exists (guide found), it is appended after all site-specific guidance, warnings, and workflows.
4. **Apply link fallback**: Added explicit instructions for the AI to try the parent `<a>` element's href when the apply button's getAttribute returns empty, "#", or a relative path, preventing blank apply links in structured output.

## Deviations from Plan
None -- plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
Phase 10 core pipeline is now complete across all 3 plans:
- Plan 10-01: Company lookup functions (getGuideByCompanyName, extractCompanyFromTask)
- Plan 10-02: Career scoring heuristics (careerUrl patterns, getText threshold, error report bonuses)
- Plan 10-03: Career prompt (search+extract scope) + guide injection into prompt pipeline

The AI now receives: (1) company-specific career site guidance, (2) direct careerUrl for navigation, (3) structured output format for job data, (4) error reporting templates, (5) cookie banner dismissal as Phase 0. Ready for Phase 11 (multi-site career search).

## Self-Check: PASSED
