---
phase: 183-ai-communication-repair
plan: 02
subsystem: ai
tags: [cli-pipeline, max_tokens, xai, tool-registry, ai-integration]

# Dependency graph
requires:
  - phase: 180-pipeline-audit-regression-inventory
    provides: AC-04/AC-06/AL-13/XS-05/XS-06 audit findings identifying CLI_COMMAND_TABLE divergence and max_tokens issue
provides:
  - CLI_COMMAND_TABLE synced with TOOL_REGISTRY (execute_js added, click text param documented)
  - max_tokens 4096 applied in CLI path callAPI and legacyCallAPI
  - Verified restored pipeline functions (getAutomationActions -> processQueue -> callAPI -> provider chain)
  - Verified buildMinimalUpdate continuation prompts include DOM state, action results, completion signals
affects: [ai-integration, agent-loop, cli-parser]

# Tech tracking
tech-stack:
  added: []
  patterns: [max_tokens guard pattern for provider-agnostic token budget enforcement]

key-files:
  created: []
  modified: [ai/ai-integration.js]

key-decisions:
  - "max_tokens guard uses if-not-set pattern to avoid overriding provider-specific values while ensuring a floor of 4096"
  - "execute_js documented as ESCAPE HATCH with LAST RESORT language to prevent AI from using it as primary action method (T-183-03 mitigation)"

patterns-established:
  - "max_tokens guard: check if (!requestBody.max_tokens) before setting default, so provider buildRequest can override if needed"

requirements-completed: [AICOM-01, AICOM-02, AICOM-03, AICOM-05]

# Metrics
duration: 4min
completed: 2026-04-19
---

# Phase 183 Plan 02: Legacy CLI AI Pipeline Repair Summary

**CLI_COMMAND_TABLE synced with TOOL_REGISTRY (execute_js + click text param), max_tokens 4096 fix applied in both callAPI and legacyCallAPI, and restored pipeline functions verified end-to-end**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-19T03:18:16Z
- **Completed:** 2026-04-19T03:22:09Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Synced CLI_COMMAND_TABLE with TOOL_REGISTRY: added execute_js as ESCAPE HATCH section and documented click text-based targeting option
- Applied max_tokens 4096 guard in callAPI (provider path) and updated legacyCallAPI from 4000 to 4096, preventing xAI truncation in CLI path
- Verified full pipeline chain: getAutomationActions -> processQueue -> callAPI -> provider.sendRequest -> parseResponse returns raw text string for CLI parsing
- Verified buildMinimalUpdate includes page URL/title, DOM element snapshot, action results, stuck warnings, completion signals, and format reminders (AICOM-05)
- Verified processQueue two-stage recovery correctly constructs messages array from systemPrompt/userPrompt format via fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Sync CLI_COMMAND_TABLE with TOOL_REGISTRY and verify restored pipeline** - `d38f5aa` (feat)
2. **Task 2: Apply max_tokens 4096 fix for xAI in CLI path callAPI** - `60b8fe8` (fix)

## Files Created/Modified
- `ai/ai-integration.js` - CLI_COMMAND_TABLE synced (execute_js added, click text param), max_tokens 4096 guard in callAPI, legacyCallAPI updated to 4096, Phase 183 verification comment

## Decisions Made
- Used if-not-set guard pattern (`if (!requestBody.max_tokens)`) for the callAPI max_tokens fix rather than unconditionally setting it, so that if UniversalProvider.buildRequest already sets max_tokens for a specific provider, the guard does not override it
- Documented execute_js as "LAST RESORT" in CLI_COMMAND_TABLE to mitigate T-183-03 (Tampering risk from AI overusing raw JS execution)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

Pipeline chain verification (D-06, D-07):
- getAutomationActions (line 1948) queues request to processQueue (line 2250)
- processQueue calls callAPI (line 4294) which calls provider.buildRequest, provider.sendRequest, provider.parseResponse
- callAPI returns parsed.content (raw text string) at line 4335
- processQueue passes raw text to parseCliResponse for CLI command extraction
- buildMinimalUpdate (line 827) constructs continuation context with URL/title, action results, CAPTCHA warnings, stuck warnings, DOM elements, Sheets reminders, and format reminders

Recovery stage verification (AC-06):
- Stage 1 (line 2299) and Stage 2 (line 2345) both correctly handle systemPrompt/userPrompt format via: `request.prompt.messages || [{role:'system', content: request.prompt.systemPrompt || ''}, {role:'user', content: request.prompt.userPrompt || ''}]`

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-183-03 | execute_js CLI entry marked as "LAST RESORT" to prevent AI from using it as primary action method |
| T-183-04 | max_tokens: 4096 guard in callAPI prevents xAI truncation causing infinite retry loops |

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CLI path is now fully synced and verified
- Tool_use path verification completed in 183-01
- Ready for 183-03 (conversation history and continuation prompts)

---
*Phase: 183-ai-communication-repair*
*Completed: 2026-04-19*
