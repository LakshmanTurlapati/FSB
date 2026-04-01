---
phase: 138-context-management-on-demand-tools
plan: 01
subsystem: ai/agent-loop
tags: [agent-loop, tools, context, compression, caching]
dependency_graph:
  requires: [phase-137-agent-loop, phase-135-tool-registry]
  provides: [on-demand-context-tools, history-compression, prompt-caching]
  affects: [ai/tool-definitions.js, ai/agent-loop.js]
tech_stack:
  added: []
  patterns: [local-tool-interception, sliding-window-compression, anthropic-prompt-caching]
key_files:
  created: []
  modified:
    - ai/tool-definitions.js
    - ai/agent-loop.js
decisions:
  - On-demand DOM snapshot replaces per-iteration auto-injection (D-01/D-03)
  - Site guide fetched via tool call instead of always injected (D-04/D-06)
  - 80% token budget threshold triggers history compaction (D-07)
  - Keep 5 most recent tool_result messages, compact older to one-liners (D-08)
  - Anthropic cache_control on system prompt and last tool definition (D-14)
metrics:
  duration_seconds: 181
  completed: "2026-04-01T10:16:03Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 138 Plan 01: On-Demand Context Tools, History Compression, and Prompt Caching Summary

**One-liner:** 3 on-demand tools (get_page_snapshot, get_site_guide, report_progress) with local interception, sliding-window history compression at 80% token budget, and Anthropic prompt caching via cache_control headers.

## What Was Done

### Task 1: Register 3 on-demand tools and add local interception in agent loop
- Added `get_page_snapshot`, `get_site_guide`, and `report_progress` to TOOL_REGISTRY in tool-definitions.js (42 -> 45 tools)
- `get_page_snapshot`: _route content, _readOnly true, no parameters -- fetches markdown DOM snapshot via content script getMarkdownSnapshot
- `get_site_guide`: _route background, _readOnly true, domain parameter -- loads site guide via getGuideForTask
- `report_progress`: _route background, _readOnly true, message parameter -- updates progress overlay
- Added local interception in runAgentIteration's tool execution loop: all 3 tools handled before _executeTool dispatch
- get_page_snapshot sends chrome.tabs.sendMessage with charBudget 12000, maxElements 80
- get_site_guide calls getGuideForTask with constructed URL, returns guidance or "no guide available" fallback
- report_progress calls sendStatus with phase 'progress' and user-visible message
- Updated buildSystemPrompt to reference get_page_snapshot, get_site_guide, and report_progress
- Per-tool progress update now includes cost display string

### Task 2: Add sliding-window history compression and Anthropic prompt caching
- Added `estimateTokens()` function using char/4 heuristic for OpenAI, Anthropic, and Gemini message formats
- Added `compactHistory()` function that triggers at 80% of 128K token budget
- Compaction preserves 5 most recent tool_result messages, replaces older ones with "{toolName} returned {status}" one-liners
- Handles all 3 provider formats: OpenAI (role:tool), Anthropic (content array with tool_result type), Gemini (parts with functionResponse)
- compactHistory called before callProviderWithTools in runAgentIteration
- Anthropic case in callProviderWithTools now sets cache_control:{type:'ephemeral'} on system prompt text block
- Last tool definition in Anthropic tools array marked with cache_control:{type:'ephemeral'}
- Other providers unchanged (they handle caching internally or don't support it)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | e67cae1 | feat(138-01): register 3 on-demand tools and add local interception in agent loop |
| 2 | 7df6403 | feat(138-01): add sliding-window history compression and Anthropic prompt caching |

## Verification Results

- Tool count: 45 (42 original + 3 new) -- PASS
- get_page_snapshot in TOOL_REGISTRY with _route:'content', _readOnly:true -- PASS
- get_site_guide in TOOL_REGISTRY with _route:'background', _readOnly:true, domain param -- PASS
- report_progress in TOOL_REGISTRY with _route:'background', _readOnly:true, message param -- PASS
- Local interception for all 3 tools in agent-loop.js -- PASS
- buildSystemPrompt references get_page_snapshot, get_site_guide, report_progress -- PASS
- compactHistory function exists (2 occurrences: definition + call site) -- PASS
- estimateTokens function exists -- PASS
- cache_control appears 2 times (system prompt + last tool) -- PASS

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all data sources are wired to existing infrastructure (getMarkdownSnapshot, getGuideForTask, sendStatus).

## Self-Check: PASSED

- ai/tool-definitions.js: FOUND
- ai/agent-loop.js: FOUND
- 138-01-SUMMARY.md: FOUND
- Commit e67cae1: FOUND
- Commit 7df6403: FOUND
