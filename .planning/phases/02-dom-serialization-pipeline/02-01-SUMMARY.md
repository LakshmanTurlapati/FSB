---
phase: 02-dom-serialization-pipeline
plan: 01
subsystem: ai-prompt-construction
tags: [dom-serialization, prompt-cap, text-truncation, adaptive-limits]
dependency-graph:
  requires: []
  provides: [HARD_PROMPT_CAP-15K, getTextLimit-adaptive-helper]
  affects: [02-02-budget-partitioning, 02-03-format-compression]
tech-stack:
  added: []
  patterns: [per-element-type-adaptive-limits, compression-level-multipliers]
key-files:
  created: []
  modified: [ai/ai-integration.js]
decisions:
  - id: DOM-01-cap
    description: "HARD_PROMPT_CAP raised from 5K to 15K -- 3x page visibility for AI"
  - id: DOM-03-limits
    description: "Adaptive text limits: 150 chars list items, 80 chars buttons/links, 100 chars default"
metrics:
  duration: 1m 12s
  completed: 2026-02-14
---

# Phase 02 Plan 01: Raise Prompt Cap and Adaptive Text Limits Summary

**One-liner:** Tripled AI page visibility (5K to 15K prompt cap) and added per-element-type text truncation (150/80/100 chars)

## Objective

Raise HARD_PROMPT_CAP from 5000 to 15000 and add adaptive text limits per element type, giving the AI 3x more page content without changing any parsing format.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Raise HARD_PROMPT_CAP and add adaptive text limits | 4dfe27e | ai/ai-integration.js |

## Changes Made

### 1. HARD_PROMPT_CAP raised to 15000 (line 1898)

Changed from `5000` to `15000` with updated comment referencing DOM-01. This triples the amount of DOM content the AI receives in each prompt, directly addressing issue #4 from the LinkedIn log analysis ("Prompt truncated to 5K chars -- 74% DOM lost").

### 2. getTextLimit() helper method added (line 2069)

New method on the AIIntegration class that returns adaptive text truncation limits based on element type:

- **List items** (li, links/divs inside list containers): 150 chars -- enough for "First Last - Title at Company" patterns
- **Buttons, links, inputs, selects**: 80 chars -- sufficient for action labels
- **Textareas**: 100 chars -- slightly more for form content
- **Default**: 100 chars

The method also accepts a `compressionLevel` parameter (`none`/`moderate`/`heavy`) with multipliers (1.0/0.8/0.5) for future use in budget-constrained scenarios.

### 3. formatElements() updated to use getTextLimit (line 2115)

Replaced the hardcoded `substring(0, 150)` with `substring(0, textLimit)` where `textLimit = this.getTextLimit(el)`. The element output format (selector pattern, element IDs, field ordering) is completely unchanged.

### 4. Truncation preserves closing question line

When prompts exceed 15K and get truncated, the closing `What actions should I take to complete the task?` line is now appended after the truncation notice, ensuring the AI always sees the call-to-action.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| DOM-01-cap | 15K prompt cap (was 5K) | Original 15K was reduced to 5K for performance; restoring it with future budget partitioning (Plan 02) to manage intelligently |
| DOM-03-limits | Per-type text limits (150/80/100) | LinkedIn list items need ~150 chars for name+title, but buttons only need ~80 chars for labels |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Closing question line preserved in truncated prompts**

- **Found during:** Task 1, reviewing truncation logic
- **Issue:** When prompt exceeded cap, truncation dropped the closing `What actions should I take to complete the task?` line, which the plan's must_haves explicitly require
- **Fix:** Appended the question line after truncation notice
- **Files modified:** ai/ai-integration.js
- **Commit:** 4dfe27e

## Verification Results

- HARD_PROMPT_CAP = 15000 exists exactly once at line 1898
- getTextLimit method defined at line 2069, called at line 2115
- No remaining `substring(0, 150)` in formatElements (replaced with adaptive limit)
- `selector: "` pattern preserved in formatElements (line 2146)
- File has balanced braces, no syntax errors

## Next Phase Readiness

Plan 02 (Budget Partitioning) can proceed immediately. It will:
- Add budget partitioning logic that uses HARD_PROMPT_CAP to allocate space between elements and HTML context
- Potentially use getTextLimit's compressionLevel parameter for adaptive compression

No blockers or concerns.

## Self-Check: PASSED
