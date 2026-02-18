---
phase: 10-memory-tab-population
plan: 01
subsystem: memory-extraction
tags: [memory, extraction, fallback, enrichment, pipeline]
dependency-graph:
  requires: []
  provides: [enriched-session-data, local-fallback-extraction, ai-prompt-enrichment]
  affects: [10-02]
tech-stack:
  added: []
  patterns: [synchronous-snapshot-before-await, local-fallback-extraction, enriched-ai-prompts]
key-files:
  created: []
  modified: [background.js, lib/memory/memory-extractor.js]
decisions:
  - id: MEM-TAB-01-01
    desc: "Synchronous AI instance snapshot before any await in extractAndStoreMemories"
  - id: MEM-TAB-01-02
    desc: "Local fallback produces 1-3 memories (episodic always, semantic if selectors, procedural if completed)"
  - id: MEM-TAB-01-03
    desc: "session.lastUrl as domain fallback when no navigate URLs in actionHistory"
metrics:
  duration: 2m
  completed: 2026-02-17
---

# Phase 10 Plan 01: Memory Extraction Pipeline Fix Summary

Fixed the data pipeline that feeds memories into the Memory tab. The critical gap was that extractAndStoreMemories received a session object without AI instance data, and the extractor returned empty when no AI provider was available.

## One-liner

Synchronous AI instance snapshot onto session._enrichedData + local fallback extractor producing 1-3 memories without API call

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Enrich extractAndStoreMemories with AI instance snapshot | c954456 | background.js |
| 2 | Add local fallback extractor and enrich AI extraction prompt | 1c2921f | lib/memory/memory-extractor.js |

## What Changed

### Task 1: background.js - extractAndStoreMemories Enrichment

**Before:** The function extracted domain from actionHistory and called `memoryManager.add(session, { domain })` with the bare session object. AI instance data (hardFacts, sessionMemory, compactedSummary) was never passed to the memory extractor.

**After:**
1. Synchronously snapshots `hardFacts` (taskGoal, criticalActions, workingSelectors), `sessionMemory` (stepsCompleted, failedApproaches), and `compactedSummary` from the AI instance onto `session._enrichedData` before any `await` call
2. Adds `session.lastUrl` as domain extraction fallback when no navigate URLs exist in actionHistory

The synchronous snapshot is critical because `cleanupSession` deletes the AI instance from `sessionAIInstances` Map, and this can race with the async memory extraction.

### Task 2: memory-extractor.js - Local Fallback and Enriched Prompt

**Part A - Fallback paths:** Both the no-provider path and the AI-error catch now call `_localFallbackExtract` instead of returning empty arrays.

**Part B - _localFallbackExtract method:** Produces 1-3 validated memories without any AI call:
- Episodic memory (always): "Completed/Failed: <task>" with stepsCompleted, failedApproaches, duration, iterationCount
- Semantic memory (if working selectors exist): "Working selectors for <domain>" with selector info
- Procedural memory (if completed + 2+ successful actions): "Workflow for '<task>': N steps" with action steps and selectors

**Part C - Enriched AI prompt:** `_buildExtractionPrompt` now includes working selectors, critical actions, and steps completed from `session._enrichedData` in the user prompt, giving the AI richer context for better memory extraction.

## Decisions Made

1. **MEM-TAB-01-01:** Synchronous snapshot pattern - AI instance data is copied synchronously before any `await` to prevent race with cleanup
2. **MEM-TAB-01-02:** Local fallback confidence levels - episodic at 0.6, semantic (selectors) at 0.8, procedural at 0.7
3. **MEM-TAB-01-03:** Domain fallback uses `session.lastUrl` which is set on every iteration of the automation loop

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `extractAndStoreMemories` contains `sessionAIInstances.get(sessionId)` and `_enrichedData` -- PASS
2. `memory-extractor.js` contains `_localFallbackExtract` with all three create*Memory calls -- PASS
3. `_buildExtractionPrompt` contains `enrichedSection` with working selectors and critical actions -- PASS
4. No new files created, no new imports/dependencies added -- PASS
5. Domain extraction has `session.lastUrl` fallback -- PASS

## Next Phase Readiness

Plan 10-02 can proceed. The extraction pipeline now produces memories from every completed session, which will populate the Memory tab UI that 10-02 wires up.

## Self-Check: PASSED
