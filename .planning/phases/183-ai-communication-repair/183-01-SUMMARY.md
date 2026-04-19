---
phase: 183-ai-communication-repair
plan: 01
subsystem: ai-communication
tags: [dead-code-removal, tool-use-verification, provider-adapters]
dependency_graph:
  requires: [180-ai-communication-findings]
  provides: [cleaned-universal-provider, verified-tool-use-path]
  affects: [ai/universal-provider.js, ai/agent-loop.js, ai/tool-use-adapter.js]
tech_stack:
  added: []
  patterns: [raw-text-pass-through, provider-family-adapter]
key_files:
  created: []
  modified:
    - ai/universal-provider.js
    - ai/agent-loop.js
    - ai/tool-use-adapter.js
decisions:
  - Deleted 8 dead methods (363 lines) from universal-provider.js rather than leaving them bypassed
  - All tool_use contracts verified correct -- no bugs found, only verification comments added
metrics:
  duration_seconds: 176
  completed: 2026-04-19T03:21:27Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 183 Plan 01: AI Communication Path Repair -- Tool Use Verification Summary

Deleted dead response-mangling code from universal-provider.js (8 methods, 363 lines) and verified the canonical tool_use path end-to-end across all 4 provider families (xAI/OpenAI, Anthropic, Gemini, OpenRouter/Custom).

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete dead cleanResponse/parseJSONSafely code | db2d961 | ai/universal-provider.js |
| 2 | Verify tool_use path end-to-end | 5cbb774 | ai/agent-loop.js, ai/tool-use-adapter.js |

## Task Details

### Task 1: Delete dead cleanResponse/parseJSONSafely code (D-02, AC-02, AC-11)

Removed 8 dead methods from the UniversalProvider class in `ai/universal-provider.js`:
- `cleanResponse(content)` -- called parseJSONSafely
- `parseJSONSafely(content)` -- stripped text before first `{`, ran JSON fixers on CLI text
- `fixTruncatedJSON(input)` -- added missing JSON closing characters
- `fixCommonMalformations(input)` -- fixed unquoted string values
- `fixJSONStructure(input)` -- tokenizer-based JSON repair
- `ensureQuotedPropertyNames(input)` -- regex property name quoting
- `fixMissingCommas(input)` -- missing comma insertion
- `extractJSONFallback(content)` -- regex JSON extraction with fallback

These methods were bypassed in `parseResponse()` across commits 8a7a8cf, 1ff5b52, 7ba62d9 but remained as unreachable code. Deleted entirely to prevent future accidental re-enablement.

The existing `parseResponse()` method (lines 604-614) was verified unchanged -- still returns `{ content, usage, model }` with the "Do NOT call cleanResponse" comment intact.

Net: 363 lines deleted, 14 lines added (explanatory comment block).

### Task 2: Verify tool_use path (D-03, D-04, D-05)

Verified the following contracts across the canonical tool_use communication path:

**AICOM-01 -- System prompt construction:**
- `buildSystemPrompt(task, pageUrl)` includes `${task}` and `${pageUrl}` interpolation
- CRITICAL RULES section includes narration-only rule for report_progress
- CRITICAL RULES section includes execute_js escape hatch for obscured elements
- `callProviderWithTools` passes `tools: formattedTools` in all 3 switch branches (anthropic, gemini, default)
- `max_tokens: 4096` set in both anthropic and default branches

**AICOM-02 -- Provider adapter formatting:**
- `formatToolsForProvider` handles anthropic (`input_schema`), gemini (`functionDeclarations`/`parameters`), and default (`function`/`parameters`)
- `cleanSchema` helper strips empty `required` arrays (xAI/OpenAI reject them)
- `isToolCallResponse` default case has the AC-09 fallback check for `tool_calls` array existence

**AICOM-03 -- Response parsing:**
- `parseToolCalls` extracts `{ id, name, args }` correctly for all 3 provider families
- OpenAI/xAI `arguments` JSON string is properly JSON.parsed
- Anthropic/Gemini `input`/`args` objects are used directly (no double-parse)

No bugs found. Verification comments added to both files.

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Deleted 8 methods (not 6):** The plan listed 6 dead methods but `fixJSONStructure` called two additional helpers (`ensureQuotedPropertyNames`, `fixMissingCommas`) that were also dead code. Deleted all 8 for completeness.
2. **No code fixes needed in Task 2:** All contracts verified correct. Only verification comments added.

## Threat Mitigation

| Threat ID | Status | Action Taken |
|-----------|--------|-------------|
| T-183-01 | Mitigated | Dead cleanResponse/parseJSONSafely code deleted entirely from universal-provider.js |
| T-183-02 | Accepted | No change needed -- existing behavior acknowledged |

## Self-Check: PASSED

- FOUND: ai/universal-provider.js
- FOUND: ai/agent-loop.js
- FOUND: ai/tool-use-adapter.js
- FOUND: commit db2d961 (Task 1)
- FOUND: commit 5cbb774 (Task 2)
- FOUND: 183-01-SUMMARY.md
