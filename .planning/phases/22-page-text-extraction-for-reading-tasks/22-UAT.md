---
status: complete
phase: 22-page-text-extraction-for-reading-tasks
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md]
started: 2026-03-06T17:10:00Z
updated: 2026-03-06T17:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Markdown Snapshot in AI Prompt
expected: Open the extension on any page, issue a command. The AI's page context should show structured markdown with H1 title, region headings (## Navigation, ## Main Content, etc.), page text interleaved with backtick element refs like `[ref:1] button "Submit"` — not the old compact element list format.
result: pass

### 2. Readpage Command - Basic
expected: Type "readpage" in the CLI input. The AI should receive extracted page text in markdown format and respond with a summary or acknowledgment of the page content. The text should reflect the visible viewport content.
result: issue
reported: "AI outputs readpage command but session crashes with 'AI service failed' — Invalid response structure: missing required fields"
severity: blocker

### 3. Readpage with Selector
expected: Type "readpage main" or "readpage .article-body" (using a CSS selector that exists on the page). The extracted text should be scoped to only that element's content, not the full page.
result: skipped
reason: blocked by test 2 failure

### 4. Readpage --full Flag
expected: Type "readpage --full" on a long page. The extracted text should include content beyond the viewport (the full page text), not just what's currently visible.
result: skipped
reason: blocked by test 2 failure

### 5. Fallback on Markdown Failure
expected: If markdown snapshot generation fails for any reason, the AI prompt should fall back to the previous compact element format rather than showing nothing. (This may be hard to trigger — skip if you can't reproduce a failure scenario.)
result: skipped
reason: hard to trigger manually

## Summary

total: 5
passed: 1
issues: 1
pending: 0
skipped: 3

## Gaps

- truth: "readpage command works end-to-end without crashing"
  status: resolved
  reason: "readPage missing from isValidTool() whitelist in ai-integration.js — AI response rejected as invalid"
  severity: blocker
  test: 2
  root_cause: "Plan 22-02 added readPage to CLI parser, action handler, and background.js but missed the response validator tool whitelist"
  artifacts:
    - path: "ai/ai-integration.js"
      issue: "isValidTool() missing readPage entry"
  missing:
    - "Add readPage to isValidTool() valid tools array"
  debug_session: ""

- truth: "AI done summaries should not leak internal terminology"
  status: resolved
  reason: "System prompt used 'snapshot' terminology which AI parroted to users"
  severity: minor
  test: 1
  root_cause: "System prompt referenced 'snapshot' 6 times in user-visible text"
  artifacts:
    - path: "ai/ai-integration.js"
      issue: "System prompt exposing internal terms"
  missing:
    - "Replace snapshot with page/page content in prompts"
    - "Add rule preventing AI from using internal terms in done summaries"
  debug_session: ""
