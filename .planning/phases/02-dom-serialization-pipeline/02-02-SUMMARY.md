---
phase: 02-dom-serialization-pipeline
plan: 02
subsystem: ai-prompt-construction
tags: [budget-partitioning, element-prioritization, compression, prompt-engineering]
depends_on:
  requires: ["02-01"]
  provides: ["Budget-partitioned buildPrompt", "Priority-aware formatElements", "Budget-aware formatHTMLContext", "prioritizeForTask method"]
  affects: ["02-03", "03-*"]
tech_stack:
  added: []
  patterns: ["budget-partitioned construction", "whole-element-or-nothing truncation", "task-adaptive element prioritization", "dynamic compression levels"]
key_files:
  created: []
  modified: ["ai/ai-integration.js"]
decisions:
  - id: "budget-split-ratio"
    choice: "80/20 split: 80% of remaining budget to elements, 20% to HTML context"
    reason: "Elements are the primary data the AI needs for action execution; HTML context is supplementary"
  - id: "compression-thresholds"
    choice: "none for <=30 elements, moderate for 31-60, heavy for 61+"
    reason: "Simple pages get full detail; complex pages compress to fit more elements in budget"
  - id: "separator-match"
    choice: "Used literal backslash-n separator to match existing formatElements join pattern"
    reason: "Existing code uses join('\\n') producing literal \\n between elements; preserved for backward compatibility"
  - id: "section-builder-helper"
    choice: "Added _buildHTMLSection helper for budget-gated HTML context sections"
    reason: "DRY pattern for evaluating section content before appending to formatted string"
metrics:
  duration: "3.6 min"
  completed: "2026-02-14"
---

# Phase 02 Plan 02: Budget-Partitioned Prompt Construction Summary

Budget-partitioned buildPrompt with priority-aware element formatting, dynamic compression, and budget-aware HTML context -- replaces destructive build-then-truncate pattern.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add prioritizeForTask, budget-aware formatElements and formatHTMLContext | 0c0c763 | prioritizeForTask method, formatElements with charBudget/taskType/compression, formatHTMLContext with charBudget |
| 2 | Restructure buildPrompt with budget-partitioned construction | fd53e4e | Budget calculation (80/20 split), pass budgets to formatElements and formatHTMLContext, remove destructive truncation |

## What Changed

### prioritizeForTask (new method)
Scores each element by task relevance and sorts by descending score:
- Base scores: viewport (+10), interactive element (+5), newly added (+8)
- Task boosts: form/email boosts inputs/textareas (+20), extraction boosts text-heavy elements (+15), search/navigation boosts links (+15, +10 for href), shopping boosts price-containing text (+10)
- Only activated when budget is finite (no reordering for infinite/unbounded calls)

### formatElements (updated signature and logic)
- New signature: `formatElements(elements, charBudget = Infinity, taskType = 'general')`
- Dynamic compression: none (<=30 elements), moderate (31-60), heavy (61+)
  - Heavy: skips description, class, placeholder, href, position fields
  - Moderate: reduces text limits via getTextLimit multiplier (0.8x)
  - None: full detail (matches previous behavior exactly)
- Whole-element-or-nothing: budget check before appending each element line; break on overflow
- Excluded element count reported at end of output

### formatHTMLContext (updated signature and logic)
- New signature: `formatHTMLContext(htmlContext, charBudget = Infinity)`
- PAGE INFORMATION always included (small, essential)
- Each subsequent section (META DATA, FORMS, NAVIGATION, HEADINGS, INTERACTIVE ELEMENTS) gated by budget check
- Early return with truncation notice when budget exhausted
- Individual interactive elements also budget-gated within their section

### buildPrompt (restructured)
- Measures `preContentChars` after task/context/automation sections are built
- Calculates `remainingBudget = HARD_PROMPT_CAP - preContentChars - closingLine.length`
- Partitions: `elementBudget = 80%`, `htmlBudget = 20%`
- Full DOM path: passes `elementBudget` and `taskType` to formatElements
- Delta path: builds into temp string, truncates at last newline if over elementBudget
- HTML context: passes `htmlBudget` to formatHTMLContext
- Safety fallback: only fires if prompt exceeds cap+500 (budget math error)
- Old destructive `substring(0, HARD_PROMPT_CAP)` pattern completely removed

## Requirements Satisfied

| Requirement | Status | How |
|-------------|--------|-----|
| DOM-01 (Budget allocation) | Complete | 15K cap with 80/20 proportional budget allocation |
| DOM-02 (Whole-element truncation) | Complete | Elements included whole or excluded entirely; never cut mid-field |
| DOM-04 (Dynamic complexity handling) | Complete | Three compression levels based on element count |
| DIF-03 (Task-adaptive prioritization) | Partial | prioritizeForTask scores elements by task type; content modes deferred to Plan 03 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Separator character mismatch**
- Found during: Task 1
- Issue: Plan specified `lines.join('\n')` but existing code uses `join('\\n')` (literal backslash-n)
- Fix: Used `const SEPARATOR = '\\n'` and `lines.join(SEPARATOR)` to match existing behavior
- Files modified: ai/ai-integration.js

**2. [Rule 2 - Missing Critical] Budget tracking accuracy for separator**
- Found during: Task 1
- Issue: Plan used `+1` for newline in budget tracking, but actual separator is 2 chars (`\\n`)
- Fix: Used `SEPARATOR.length` instead of hardcoded `+1` for accurate budget tracking
- Files modified: ai/ai-integration.js

**3. [Rule 2 - Missing Critical] Section builder helper for formatHTMLContext**
- Found during: Task 1
- Issue: Repeating try/catch section evaluation pattern 4 times was error-prone
- Fix: Added `_buildHTMLSection(builderFn)` helper method to DRY the budget-gated section pattern
- Files modified: ai/ai-integration.js

## Self-Check: PASSED
