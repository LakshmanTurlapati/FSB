---
phase: 10
verified: 2026-02-23T13:02:22Z
status: gaps_found
score: 3/4 must-haves verified
gaps:
  - truth: "User says 'find tech internships' and FSB interprets it into concrete search terms and executes a career search"
    status: failed
    reason: "The VAGUE QUERY HANDLING guidance exists only inside TASK_PROMPTS.career, but the task classifier routes 'find tech internships' to taskType='search' (not 'career') because 'internship/internships' is absent from both the career keyword regex in detectTaskType and the career category keywords in getGuideForTask. The vague query prompt block is therefore never injected."
    artifacts:
      - path: "ai/ai-integration.js"
        issue: "detectTaskType regex at line 4131 matches /\\b(career|job|jobs|position|opening|hiring|employment)\\b/ -- 'internship' and 'internships' are absent. A user saying 'find tech internships' gets taskType='search' because 'find' triggers the else-if at line 4133 first."
      - path: "site-guides/index.js"
        issue: "getGuideForTask career category keywords (lines 171-175) do not include 'internship' or 'internships'. The keyword match requires 2 career hits -- 'find tech internships' has 0, so siteGuide returns null, eliminating the siteGuide-based career classification path in detectTaskType."
    missing:
      - "Add 'internship' and 'internships' to the career keyword regex in detectTaskType (ai/ai-integration.js line 4131)"
      - "Add 'internship' and 'internships' to the 'Career & Job Search' category keywords array in getGuideForTask (site-guides/index.js line 171-175)"
---

# Phase 10: Career Search Core Verification Report

**Phase Goal:** Users can ask FSB to search one company's career site and get back extracted job listings with clear error reporting
**Verified:** 2026-02-23T13:02:22Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User says "find software engineer jobs at Microsoft" and FSB navigates to Microsoft's career page, searches, and extracts jobs with required and best-effort fields | VERIFIED | Microsoft guide exists at site-guides/career/microsoft.js with careerUrl='https://careers.microsoft.com/'. extractCompanyFromTask matches "at Microsoft" -> "Microsoft". getGuideByCompanyName("Microsoft") finds it via direct .site lowercase match. _buildTaskGuidance injects "DIRECT CAREER URL" directive. Career prompt (TASK_PROMPTS.career) specifies all required fields (company, title, apply link) and best-effort fields (date, location, description). |
| 2 | User says "find tech internships" (vague query) and FSB interprets it into concrete search terms and executes a career search | FAILED | VAGUE QUERY HANDLING section exists in TASK_PROMPTS.career (lines 319-327 of ai-integration.js) and correctly maps "tech internships" -> "software engineer intern". However, "find tech internships" classifies as taskType='search' (not 'career') because 'internship/internships' is absent from the career regex in detectTaskType and absent from career keywords in getGuideForTask. The career prompt with vague query guidance is never injected for this phrasing. |
| 3 | When a company's career site yields no results or hits an auth wall, FSB explicitly reports the failure (never silent) | VERIFIED | Error reporting templates in TASK_PROMPTS.career (lines 313-317) define "NO RESULTS:", "AUTH REQUIRED:", "PAGE ERROR:", "NO GUIDE:" formats. _shared.js guidance (lines 49-54) reinforces these templates with "NEVER silently fail". careerValidator in background.js (lines 3649, 3655-3659) awards +0.15 score bonus for error reports matching /NO RESULTS|AUTH REQUIRED|PAGE ERROR|NO GUIDE|no.*results|requires.*login|auth.*wall/i, treating them as valid completions (SEARCH-05 compliance). |
| 4 | Cookie consent banners are dismissed before search interaction begins | VERIFIED | PHASE 0 -- COOKIE BANNER DISMISSAL added to TASK_PROMPTS.career (lines 266-270). Category guidance in site-guides/career/_shared.js (lines 11-16) adds "COOKIE BANNER DISMISSAL (DO THIS FIRST)" with common selectors (#onetrust-accept-btn-handler, [id*="cookie"] button, [class*="cookie-accept"]) and a one-action limit. Warning at line 61 reinforces: "Cookie consent banners can block interaction with page elements -- dismiss BEFORE searching". |

**Score:** 3/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `site-guides/index.js` | getGuideByCompanyName + extractCompanyFromTask functions | VERIFIED | Both functions exist (lines 253-357). COMPANY_ALIASES has 38 entries. getGuideByCompanyName uses 3-tier matching (alias, direct, partial). extractCompanyFromTask uses 4 NLP patterns. Exported globally. Imported via importScripts at background.js line 15. |
| `site-guides/career/_shared.js` | Category guidance with cookie dismissal + error templates | VERIFIED | 64 lines. COOKIE BANNER DISMISSAL section exists at lines 11-16. ERROR REPORTING section exists at lines 49-54. warnings array (lines 55-63) includes cookie and silent-failure warnings. Imported via importScripts at background.js line 24. |
| `background.js careerValidator` | Updated validator for search+extract scope (no Sheets) | VERIFIED | careerValidator at lines 3603-3670. No Sheets references in function body. Career URL pattern array (12 patterns). getText/getAttribute bonuses. Job data detection (JOBS FOUND, job titles + apply links). Error report detection as valid completion. Dispatched via validators table at line 3737. |
| `ai/ai-integration.js TASK_PROMPTS.career` | Phase 10 search+extract prompt with structured output | VERIFIED | Lines 262-338. Contains PHASE 0 (cookie), PHASE 1 (navigate), PHASE 2 (search), PHASE 3 (extract). STRUCTURED OUTPUT FORMAT with JOBS FOUND. ERROR REPORTING templates. VAGUE QUERY HANDLING section. No Sheets/spreadsheet/PHASE 4-6 references in prompt body (only "Do NOT navigate to Google Sheets" as explicit prohibition). |
| `ai/ai-integration.js _buildTaskGuidance` | Company-name guide injection for career tasks | VERIFIED | Method at line 3931. Accepts 4th parameter `task`. Career branch runs for ALL career tasks (line 3935, not gated by !siteGuide). Calls extractCompanyFromTask and getGuideByCompanyName with typeof guards. Overrides siteGuide when company-specific guide differs. Injects "DIRECT CAREER URL" directive when guide has careerUrl. Call site at line 2219 passes 4 arguments. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| background.js | site-guides/index.js | importScripts line 15 | WIRED | index.js loaded before career guides; getGuideByCompanyName and extractCompanyFromTask are global. |
| background.js | site-guides/career/_shared.js | importScripts line 24 | WIRED | _shared.js loaded after index.js; registerCategoryGuidance called at module load. |
| background.js | site-guides/career/microsoft.js | importScripts line 106 | WIRED | Microsoft guide registered; careerUrl='https://careers.microsoft.com/' accessible. |
| ai/ai-integration.js _buildTaskGuidance | site-guides/index.js extractCompanyFromTask | typeof guard + function call line 3936-3937 | WIRED | Guard checks typeof before calling; function is available in service worker scope via importScripts. |
| ai/ai-integration.js _buildTaskGuidance | site-guides/index.js getGuideByCompanyName | typeof guard + function call line 3938-3939 | WIRED | Guard checks typeof before calling. |
| ai/ai-integration.js buildPrompt | _buildTaskGuidance | 4-argument call at line 2219 | WIRED | `this._buildTaskGuidance(taskType, siteGuide, currentUrl, task)` -- task string correctly passed. |
| background.js validateCompletion | careerValidator | validators dispatch table line 3737 | WIRED | `career: careerValidator` entry present; careerValidator called for taskType='career'. |
| detectTaskType | TASK_PROMPTS.career | taskType='career' detection | PARTIAL | "find software engineer jobs at Microsoft" -> 'career' (CORRECT, 'jobs' in regex). "find tech internships" -> 'search' (GAP, 'internship' not in career regex). "DevOps positions" -> 'career' (CORRECT, 'position' in regex). |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| SEARCH-01: Single-company career search navigates site, searches, extracts jobs with required fields (company, title, apply link) and best-effort fields (date, location, description) | SATISFIED | Microsoft guide wired. careerUrl injected for direct navigation. Structured output format defines all 6 fields. Extract tools (getText, getAttribute) guided. |
| SEARCH-03: Vague query interpretation maps broad terms ("tech internships", "DevOps positions") to concrete search queries | BLOCKED | "DevOps positions" correctly routes to career prompt (contains 'position'). "tech internships" routes to generic search prompt instead (contains neither 'job/jobs/career/position/opening/hiring/employment'). Vague query guidance exists in career prompt but is unreachable for this phrasing. |
| SEARCH-05: Error reporting communicates which companies had no results (never silent failure) | SATISFIED | Error templates in prompt. careerValidator scores error reports as valid completions. _shared.js reinforces with NEVER silently fail. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | No TODO/FIXME/placeholder/stub patterns in modified files. |

### Human Verification Required

The following items require human testing to fully confirm:

**1. Microsoft Career Search End-to-End**
Test: Ask FSB "find software engineer jobs at Microsoft" in the side panel.
Expected: FSB navigates directly to https://careers.microsoft.com/ (not via Google), searches "software engineer", extracts 3-5 jobs with title, company name, apply link, and best-effort date/location/description in JOBS FOUND format.
Why human: Cannot verify AI navigation behavior or DOM extraction success programmatically.

**2. Error Reporting on No-Results or Auth Wall**
Test: Ask FSB "find jobs at a company with an auth wall" (e.g., a company whose career page requires login).
Expected: FSB reports "AUTH REQUIRED: [Company] requires login to view listings. Career page: [URL]" and does not silently complete.
Why human: Cannot simulate live auth-wall behavior in code review.

**3. Cookie Banner Dismissal**
Test: Navigate to a career site with a cookie banner (e.g., a European company's careers page), then ask FSB to search for jobs.
Expected: FSB clicks the accept/dismiss button before interacting with the search box.
Why human: Cookie banner presence and dismissal requires live browser interaction.

## Gaps Summary

One gap blocks full SC2 (SEARCH-03) compliance.

**Gap: "find tech internships" does not route to career prompt**

The VAGUE QUERY HANDLING section is correctly authored inside TASK_PROMPTS.career and maps "tech internships" to "software engineer intern" as intended. The problem is upstream: task classification. The phrase "find tech internships" contains none of the career keywords in detectTaskType's regex (`/\b(career|job|jobs|position|opening|hiring|employment)\b/`), so the task is classified as 'search', and the career prompt (with vague query guidance) is never injected.

Affected queries: any phrasing that uses "internship/internships" without also using "job/jobs/career/position/opening/hiring/employment". Queries with "position/opening" (e.g., "find DevOps positions") correctly route to career.

Fix: Add 'internship' and 'internships' to:
1. The career regex in detectTaskType at ai/ai-integration.js line 4131
2. The 'Career & Job Search' category keywords array in getGuideForTask at site-guides/index.js line 171-175

This is a narrow, well-defined fix -- two array/regex additions, no architectural change.

---

_Verified: 2026-02-23T13:02:22Z_
_Verifier: Claude (gsd-verifier)_
