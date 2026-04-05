---
phase: 11
plan: 01
subsystem: career-data-persistence
tags: [multi-company-parser, chrome-storage, deduplication, tool-documentation]
dependency-graph:
  requires: [phase-10]
  provides: [extractCompaniesFromTask, storeJobData, getStoredJobs, deduplicateJobs, normalizeApplyUrl, checkAccumulatorRelevance]
  affects: [11-02]
tech-stack:
  added: []
  patterns: [background-data-tools-dispatch, accumulator-pattern-chrome-storage]
key-files:
  created: []
  modified: [site-guides/index.js, background.js, ai/ai-integration.js]
decisions:
  - id: 11-01-01
    decision: "backgroundDataTools separate from multiTabActions -- data tools get overlay status updates, multi-tab tools do not"
    context: "storeJobData/getStoredJobs don't change tabs, so they should show acting status in viewport overlay"
  - id: 11-01-02
    decision: "extractCompaniesFromTask validates candidates against COMPANY_ALIASES and getGuideByCompanyName -- unknown names are dropped"
    context: "Prevents non-company phrases like 'senior DevOps positions' from being treated as company names"
  - id: 11-01-03
    decision: "checkAccumulatorRelevance uses 50% keyword overlap threshold"
    context: "Balances keeping relevant data vs clearing stale data from different searches"
metrics:
  duration: 2.8 min
  completed: 2026-02-23
---

# Phase 11 Plan 01: Data Persistence Layer and Multi-Company Parser Summary

Multi-company parser that extracts company lists from natural language, chrome.storage.local persistence for job accumulation, deduplication by normalized apply URL, and accumulator relevance checking by role keyword overlap.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Multi-company parser + AI tool handlers + tool documentation | 4f3a714 | extractCompaniesFromTask in site-guides/index.js, storeJobData/getStoredJobs handlers in background.js, data category in TOOL_DOCUMENTATION |
| 2 | Deduplication, URL normalization, and accumulator relevance check | 689ad79 | normalizeApplyUrl, deduplicateJobs, checkAccumulatorRelevance in background.js |

## What Was Built

### extractCompaniesFromTask (site-guides/index.js)
Parses "find DevOps jobs at Microsoft, Amazon, and Google" into ["Microsoft", "Amazon", "Google"]. Splits on comma-and, comma, or standalone "and". Each candidate is validated against COMPANY_ALIASES and getGuideByCompanyName -- unknown names are dropped. Returns null if fewer than 2 valid companies (single-company tasks fall through to extractCompanyFromTask).

### storeJobData handler (background.js)
Receives {company, jobs} params. Creates or updates fsbJobAccumulator in chrome.storage.local. Each job gets company and extractedAt metadata. Accumulator tracks sessionId, searchQuery, per-company status/jobs/error, and totalJobs count.

### getStoredJobs handler (background.js)
Reads fsbJobAccumulator, flattens all jobs across all companies. Returns {jobs, totalJobs, companies, searchQuery}.

### normalizeApplyUrl (background.js)
Strips 10 common tracking parameters (utm_source, utm_medium, etc.) and trailing slashes. Falls back to raw string on parse failure.

### deduplicateJobs (background.js)
Keyed by normalizeApplyUrl. Jobs without apply links or "not available" links are never deduplicates. First occurrence wins.

### checkAccumulatorRelevance (background.js)
Extracts role keywords (words before "at" excluding common verbs). Compares new vs existing keywords: 50%+ overlap returns 'keep', otherwise 'clear'.

### TOOL_DOCUMENTATION data category (ai/ai-integration.js)
Added storeJobData and getStoredJobs entries with params, descriptions, and examples so the AI knows these tools exist during career workflows.

### Dispatch wiring (background.js)
backgroundDataTools list routes storeJobData/getStoredJobs to handleBackgroundAction. These tools get viewport overlay status updates (unlike multi-tab actions which suppress overlays during tab switches).

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **backgroundDataTools vs multiTabActions separation** -- Data tools (storeJobData, getStoredJobs) are dispatched separately from multi-tab tools. They share the background handler pattern but get overlay status updates since they don't change tabs.

2. **Validation-gated company extraction** -- extractCompaniesFromTask only returns companies that resolve via COMPANY_ALIASES or getGuideByCompanyName. This prevents false positives like treating role descriptions as company names.

3. **50% keyword overlap threshold for accumulator relevance** -- checkAccumulatorRelevance uses 50% overlap of role keywords to decide keep vs clear, balancing data retention with freshness.

## Verification Results

- extractCompaniesFromTask exists in site-guides/index.js (line 369)
- storeJobData/getStoredJobs handlers exist in background.js
- handleBackgroundAction dispatch function exists in background.js (line 6357)
- TOOL_DOCUMENTATION.data category exists with both tool entries (line 67)
- extractCompanyFromTask (singular) untouched at line 292
- Existing TOOL_DOCUMENTATION categories (captcha, multitab) intact
- multiTabActions dispatch still works (unchanged at line 7652)
- backgroundDataTools dispatch correctly routes to handleBackgroundAction (line 7671)

## Next Phase Readiness

Plan 11-02 (orchestrator) can now use:
- extractCompaniesFromTask to parse multi-company prompts
- storeJobData/getStoredJobs to persist and retrieve job data
- deduplicateJobs to clean final accumulated dataset
- checkAccumulatorRelevance to decide whether to keep or clear old accumulator data

## Self-Check: PASSED
