---
phase: 18-ai-integration-wiring
plan: 01
subsystem: ai
tags: [cli-parser, response-parsing, security-sanitization, universal-provider]

# Dependency graph
requires:
  - phase: 15-cli-parser-module
    provides: parseCliResponse function and COMMAND_REGISTRY
  - phase: 17-prompt-architecture-rewrite
    provides: CLI command table and CLI response format instructions in system prompt
provides:
  - "parseCliResponse as sole response parser in processQueue"
  - "sanitizeActions standalone security function"
  - "UniversalProvider returns raw text (no JSON parsing)"
  - "CLI reformat retry for unparseable responses"
  - "createFallbackResponse matching parseCliResponse output shape"
affects: [18-02-PLAN, background-js-imports, ai-response-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CLI-only response pipeline", "standalone security sanitization"]

key-files:
  created: []
  modified:
    - ai/universal-provider.js
    - ai/ai-integration.js
    - background.js

key-decisions:
  - "parseCliResponse is the single entry point for all AI response parsing -- no JSON fallback"
  - "sanitizeActions extracted as module-level function (not class method) for reusability"
  - "CLI reformat retry sends AI's original response back asking for CLI reformatting before failing"
  - "batchActions compatibility shim set when parsed.actions.length > 1"

patterns-established:
  - "CLI-only pipeline: raw text -> parseCliResponse -> sanitizeActions -> resolved result"
  - "Reformat retry pattern: if zero valid commands, ask AI to reformat then re-parse"

requirements-completed: [INTEG-01, INTEG-04]

# Metrics
duration: 4min
completed: 2026-03-01
---

# Phase 18 Plan 01: AI Integration Wiring Summary

**Swapped response pipeline from JSON to CLI: parseCliResponse as sole parser, ~650 lines of JSON fixup deleted across provider and integration layers, security sanitization preserved in standalone function**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T20:03:34Z
- **Completed:** 2026-03-01T20:08:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Gutted UniversalProvider JSON fixup pipeline (~393 lines removed): cleanResponse, parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, fixJSONStructure, extractJSONFallback and helpers
- Wired parseCliResponse as the sole response parser in processQueue with CLI reformat retry
- Created standalone sanitizeActions function preserving javascript: URI and script injection blocking
- Deleted 7+ JSON parsing methods from ai-integration.js (~260 lines): parseResponse, parseCleanJSON, parseWithMarkdownBlocks, parseWithJSONExtraction, parseWithAdvancedCleaning, normalizeResponse, isValidParsedResponse, getModelSpecificInstructions
- Updated createFallbackResponse to match full parseCliResponse output shape
- Rewrote enhancePromptForRetry with CLI format reinforcement instead of JSON instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Gut UniversalProvider to return raw text and delete JSON fixup pipeline** - `97fdbbd` (feat)
2. **Task 2: Wire CLI parser into ai-integration.js as sole response path** - `b9b1774` (feat)

## Files Created/Modified
- `ai/universal-provider.js` - parseResponse returns raw text string, 6 JSON fixup methods deleted (-393 lines)
- `ai/ai-integration.js` - sanitizeActions function added, processQueue uses parseCliResponse, 7+ JSON methods deleted (-260 lines, +168 lines net)
- `background.js` - importScripts('ai/cli-parser.js') added before ai-integration.js

## Decisions Made
- parseCliResponse is the single entry point for all AI response parsing -- no JSON fallback exists
- sanitizeActions extracted as a module-level function (not a class method) for accessibility from processQueue
- CLI reformat retry sends the AI's original response text back with a reformatting request before giving up
- batchActions compatibility shim auto-set when parsed.actions.length > 1 (preserves batch execution path)
- Model-specific JSON formatting instructions deleted entirely -- CLI format is model-agnostic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AI response flow now runs entirely through CLI parser
- Phase 18 Plan 02 (background.js dispatch wiring) can proceed -- parseCliResponse output shape is stable
- Security sanitization preserved and accessible from both processQueue and any future callers

---
*Phase: 18-ai-integration-wiring*
*Completed: 2026-03-01*
