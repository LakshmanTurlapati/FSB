---
status: complete
phase: 09-data-pipeline-foundation
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md
started: 2026-02-23T14:00:00Z
updated: 2026-02-23T14:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Parser Script Runs Successfully
expected: Run `node scripts/parse-research-logs.js` from the project root. The script should execute without errors and output information about the companies it processed (36 guides generated with HIGH/MEDIUM/LOW confidence counts).
result: pass

### 2. Career Guide Files Generated
expected: The site-guides/career/ directory should contain 36 per-company guide files plus 5 ATS base guides plus 4 existing guides. Total ~45 JS files in site-guides/career/.
result: pass

### 3. Extension Loads Without Import Errors
expected: Load the extension in Chrome (or reload if already loaded). Open the service worker console. No errors about missing career guide files or failed importScripts should appear.
result: pass

### 4. HIGH-Confidence Guide Has Selectors and Categories
expected: Open site-guides/career/microsoft.js. The file should contain a registerSiteGuide() call with: confidence set to HIGH, multiple selector categories, and a careerUrl pointing to the company's careers page.
result: pass

### 5. LOW-Confidence Guide Is URL-Only
expected: Open site-guides/career/tesla.js. The file should be a minimal guide with: confidence set to LOW, a careerUrl field, and reference to the generic fallback guide. No detailed selectors.
result: pass

### 6. ATS Detection on Workday Companies
expected: Open site-guides/career/deloitte.js. The file should contain an ats field set to "workday".
result: pass

### 7. Import Ordering in background.js
expected: Open background.js and find the career guide import section. Imports should be ordered: ATS base guides first, then third-party boards, then company guides alphabetically, then generic.js last.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
