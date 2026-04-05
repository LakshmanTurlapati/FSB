---
phase: "08"
plan: "02"
subsystem: "site-guides"
tags: ["per-site-guides", "data-restructuring", "finance", "travel", "email", "coding"]
dependency-graph:
  requires:
    - "08-01 (registry enhancement, _shared.js files, per-site pattern)"
  provides:
    - "22 per-site guide files across finance, travel, email, and coding categories"
  affects:
    - "08-03 (viewer UI needs to load these files)"
    - "08-04 (background.js importScripts update for new file paths)"
tech-stack:
  added: []
  patterns:
    - "Per-site registration with flat selectors (same pattern from 08-01)"
key-files:
  created:
    - "site-guides/finance/yahoo-finance.js"
    - "site-guides/finance/google-finance.js"
    - "site-guides/finance/tradingview.js"
    - "site-guides/finance/robinhood.js"
    - "site-guides/finance/coinbase.js"
    - "site-guides/finance/finviz.js"
    - "site-guides/travel/booking.js"
    - "site-guides/travel/expedia.js"
    - "site-guides/travel/airbnb.js"
    - "site-guides/travel/kayak.js"
    - "site-guides/travel/southwest.js"
    - "site-guides/travel/united.js"
    - "site-guides/travel/google-travel.js"
    - "site-guides/email/gmail.js"
    - "site-guides/email/outlook.js"
    - "site-guides/email/yahoo-mail.js"
    - "site-guides/coding/leetcode.js"
    - "site-guides/coding/hackerrank.js"
    - "site-guides/coding/github.js"
    - "site-guides/coding/codeforces.js"
    - "site-guides/coding/geeksforgeeks.js"
    - "site-guides/coding/stackoverflow.js"
  modified: []
decisions: []
metrics:
  duration: "6m 28s"
  completed: "2026-02-21"
---

# Phase 8 Plan 02: Per-Site Guide Split for Finance, Travel, Email, and Coding Summary

Split finance.js, travel.js, email.js, and coding.js into 22 per-site files with flat selectors and site-specific guidance following the pattern from Plan 01.

## What Was Done

### Task 1: Split finance.js and travel.js into Per-Site Files
- Created 6 finance per-site files: yahoo-finance.js, google-finance.js, tradingview.js, robinhood.js, coinbase.js, finviz.js
- Created 7 travel per-site files: booking.js, expedia.js, airbnb.js, kayak.js, southwest.js, united.js, google-travel.js
- Each file uses flat selectors extracted from the nested domain-keyed structure in the parent category file
- Site-specific guidance written for each site focusing on that site's unique features and selectors
- Site-specific workflows tailored to each platform (e.g., Coinbase's two-step search, Expedia's button-trigger inputs)
- Site-specific warnings covering platform-specific gotchas (e.g., Coinbase double-space aria-label, Southwest not on aggregators)
- Old category files (finance.js, travel.js) preserved untouched

### Task 2: Split email.js and coding.js into Per-Site Files
- Created 3 email per-site files: gmail.js, outlook.js, yahoo-mail.js
- Created 6 coding per-site files: leetcode.js, hackerrank.js, github.js, codeforces.js, geeksforgeeks.js, stackoverflow.js
- Gmail file includes detailed Unicode send-button workaround and recipient chip handling
- LeetCode file includes comprehensive Monaco editor interaction, Radix UI dropdown, and error handling guidance
- GitHub file includes Copilot chat, issue/PR filtering, and repository action selectors
- Old category files (email.js, coding.js) preserved untouched

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Split finance and travel into per-site files | 667cd54 | 6 finance + 7 travel per-site files |
| 2 | Split email and coding into per-site files | ccb283c | 3 email + 6 coding per-site files |

## Decisions Made

None -- followed the exact same pattern established in Plan 01.

## Deviations from Plan

None -- plan executed exactly as written.

## Next Phase Readiness

Plan 08-03 can proceed with the remaining category splits (career, gaming, productivity) and/or the viewer UI. All 22 per-site files from this plan are ready for loading via script tags or importScripts.

## Self-Check: PASSED
