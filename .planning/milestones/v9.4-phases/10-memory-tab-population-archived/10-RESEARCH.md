# Phase 10: Memory Tab Population - Research

**Researched:** 2026-02-16
**Domain:** Chrome Extension memory layer integration (extraction pipeline + options UI)
**Confidence:** HIGH

## Summary

This phase is an integration/wiring phase, not a greenfield build. All infrastructure already exists: the memory module (`lib/memory/`) has full CRUD operations with schemas, storage, retrieval, consolidation, and extraction; the options.html Memory tab has complete UI with stats bar, search, type filtering, consolidate/export/clear buttons; and the options.js has working functions for loading, rendering, searching, and managing memories. The extraction pipeline (`extractAndStoreMemories`) is called at every session termination point in background.js (12+ call sites covering completed, failed, stopped, stuck, timeout, max_iterations, no_progress, and error exit paths).

The core problem is a data quality gap: the session object passed to `extractAndStoreMemories` contains actionHistory (with enriched slim results: tool, elementText, selectorUsed) but does NOT include the AI instance's hard facts, working selectors, critical actions, or compacted session memory. These live on the `AIIntegration` instance stored in `sessionAIInstances` Map, which is separate from the `activeSessions` session object. The extractor sends the session to the AI for memory generation but the AI only sees actionHistory, task, status, and stuckCounter -- missing the most valuable learned data.

The secondary problem is that options.js memory rendering works correctly (verified by code inspection) but the Memory tab appears empty because no memories have been successfully extracted and stored. This means once the extraction pipeline produces real data, the UI should populate automatically.

**Primary recommendation:** Enrich the session object with AI instance data (hardFacts, workingSelectors, criticalActions, sessionMemory.stepsCompleted) before calling `extractAndStoreMemories`, and add a local fallback extractor that creates memories without an AI call for cases where the API is unavailable.

## Standard Stack

No new libraries needed. This phase uses only existing infrastructure.

### Core
| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| memory-schemas.js | lib/memory/ | Type definitions (MEMORY_TYPES, createEpisodicMemory, createSemanticMemory, createProceduralMemory, validateMemory) | Complete, well-tested |
| memory-storage.js | lib/memory/ | Chrome storage wrapper with inverted indices, CRUD, eviction | Complete |
| memory-retriever.js | lib/memory/ | Hybrid search (keyword + boost scoring) | Complete |
| memory-extractor.js | lib/memory/ | AI-powered extraction from session data | **Needs enrichment** |
| memory-manager.js | lib/memory/ | Orchestration API (add, search, consolidate, getStats, getAll) | Complete |
| memory-consolidator.js | lib/memory/ | Duplicate detection, stale cleanup, merge | Complete |
| options.js | ui/ | Memory tab UI functions (load, render, search, filter, consolidate, export, clear) | **Complete but untested** |
| options.html | ui/ | Memory tab HTML with stats bar, controls, list container | Complete |
| background.js | root | `extractAndStoreMemories()` function + 12 call sites at session termination | **Session object missing AI data** |

### Storage Keys
| Key | Location | Purpose |
|-----|----------|---------|
| `fsb_memories` | chrome.storage.local | Array of memory objects |
| `fsb_memory_index` | chrome.storage.local | Inverted indices (domain, taskType, tags) |
| `fsb_memory_meta` | chrome.storage.local | Metadata (defined but not currently used) |

### Constants
| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_MEMORIES | 500 | Maximum stored memories before eviction |
| MAX_STORAGE_BYTES | 8 MB | Storage cap (of 10MB chrome.storage.local limit) |

## Architecture Patterns

### Data Flow: Session Completion to Memory Storage

```
Session terminates (any exit path)
    |
    v
extractAndStoreMemories(sessionId, session)   <-- PROBLEM: session lacks AI data
    |
    v
memoryManager.add(session, { domain })
    |
    v
memoryExtractor.extract(session, context)
    |-- builds AI prompt from session.task, session.actionHistory, session.status
    |-- sends to AI provider for memory extraction
    |-- parses AI response into 1-5 memory objects
    |
    v
For each extracted memory:
    |-- memoryConsolidator.resolve(memory)  -- dedup check
    |-- memoryStorage.add(memory)           -- persist to chrome.storage.local
    |
    v
Memories available via memoryManager.getAll() / .search()
    |
    v
options.js loadMemoryDashboard() reads and renders
```

### Data Flow: Options.html Memory Tab

```
DOMContentLoaded
    |-- setTimeout(initializeMemorySection, 400)
        |-- Wire button event listeners (refresh, consolidate, export, clear)
        |-- Wire search input with 300ms debounce
        |-- Wire type filter dropdown
        |-- loadMemoryDashboard()
            |-- memoryManager.getStats() -> updateMemoryStats()
            |-- memoryManager.getAll() -> renderMemoryList()
```

### Pattern 1: Session Data Enrichment Before Extraction

**What:** Before calling `extractAndStoreMemories`, copy AI instance data onto the session object so the extractor has full context.

**Why:** The AI instance (`sessionAIInstances.get(sessionId)`) holds hardFacts (taskGoal, criticalActions, workingSelectors), sessionMemory (stepsCompleted, failedApproaches), and compacted summaries. None of this is on the session object today. The enrichment must happen BEFORE `cleanupSession()` deletes the AI instance.

**Where to add:** In `extractAndStoreMemories()` itself, or at each call site. The cleanest approach is inside `extractAndStoreMemories()` since it already receives the sessionId and can look up the AI instance.

```javascript
async function extractAndStoreMemories(sessionId, session) {
  try {
    // Enrich session with AI instance data before extraction
    const ai = sessionAIInstances.get(sessionId);
    if (ai) {
      session._hardFacts = ai.hardFacts ? { ...ai.hardFacts } : null;
      session._sessionMemory = ai.sessionMemory ? { ...ai.sessionMemory } : null;
      session._compactedSummary = ai.compactedSummary || null;
    }

    // Extract domain from session URL or action history
    let domain = null;
    // ... existing domain extraction logic ...

    const memories = await memoryManager.add(session, { domain });
    // ... existing logging ...
  } catch (error) {
    console.warn('[FSB] Memory extraction failed for session', sessionId, error.message);
  }
}
```

### Pattern 2: Local Fallback Extractor (No AI Call)

**What:** When the AI provider is unavailable (no API key, API error, budget concerns), create memories directly from structured session data without an AI call.

**Why:** The current extractor returns empty array if no provider is available (line 26-28 of memory-extractor.js). This means users without an API key or with API errors get zero memories. A local fallback creates 2-3 memories from the structured data that already exists.

```javascript
// In memory-extractor.js, after AI extraction fails or provider unavailable:
_localFallbackExtract(session, context) {
  const memories = [];
  const domain = context.domain || this._extractDomain(session);
  const metadata = {
    domain,
    taskType: 'general',
    tags: ['auto-extracted'],
    confidence: 0.6,
    sourceSessionId: session.sessionId
  };

  // Episodic: always create one
  memories.push(createEpisodicMemory(
    `${session.status === 'completed' ? 'Completed' : 'Failed'}: ${(session.task || '').substring(0, 100)}`,
    metadata,
    {
      task: session.task,
      outcome: session.status === 'completed' ? 'success' : 'failure',
      domain,
      duration: session.startTime ? Date.now() - session.startTime : 0,
      iterationCount: session.iterationCount || 0,
      stepsCompleted: session._sessionMemory?.stepsCompleted || [],
      failures: session._sessionMemory?.failedApproaches || []
    }
  ));

  // Semantic: create from working selectors
  if (session._hardFacts?.workingSelectors) {
    const ws = session._hardFacts.workingSelectors;
    const entries = Object.entries(ws);
    if (entries.length > 0) {
      const selectorText = entries.map(([label, sel]) => `${label}: ${sel}`).join('; ');
      memories.push(createSemanticMemory(
        `Working selectors for ${domain}: ${selectorText}`.substring(0, 150),
        { ...metadata, tags: ['selectors', 'auto-extracted'], confidence: 0.8 },
        { category: 'selector', selectorInfo: ws }
      ));
    }
  }

  // Procedural: create from action sequence if session succeeded
  if (session.status === 'completed' && session.actionHistory?.length > 0) {
    const steps = session.actionHistory
      .filter(a => a.result?.success)
      .slice(-10)
      .map(a => `${a.tool}(${(a.params?.selector || a.params?.url || a.params?.text || '').substring(0, 40)})`);
    if (steps.length >= 2) {
      memories.push(createProceduralMemory(
        `Workflow for "${(session.task || '').substring(0, 60)}": ${steps.length} steps`,
        { ...metadata, tags: ['workflow', 'auto-extracted'], confidence: 0.7 },
        {
          steps,
          selectors: Object.values(session._hardFacts?.workingSelectors || {}),
          successRate: 1.0,
          totalRuns: 1
        }
      ));
    }
  }

  return memories;
}
```

### Pattern 3: Memory Extractor Prompt Enrichment

**What:** Feed the enriched session data (hard facts, working selectors, critical actions) into the AI extraction prompt so the AI produces richer memories.

**Why:** Currently `_buildExtractionPrompt` only includes task, status, duration, stuckCounter, and last 15 actions. It does not include hardFacts, working selectors, critical actions, or compacted session summaries -- even though these contain the most valuable insights.

### Anti-Patterns to Avoid

- **Querying background.js from options.js via message passing for memories:** The memory layer is loaded directly in options.html via script tags. options.js can call `memoryManager.getAll()` directly. Do NOT add message passing for memory data.

- **Creating memories on every iteration:** Memory extraction is fire-and-forget at session END only. Do not trigger mid-session extraction -- it wastes API calls and creates duplicate episodic memories.

- **Storing full actionHistory in memories:** Memory text is capped at 150 chars. The typeData.steps array should contain concise step descriptions, not raw action objects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Memory storage | Custom storage layer | memoryStorage (existing) | Already has CRUD, indexing, eviction, caching |
| Memory search | Custom text search | memoryRetriever (existing) | Already has keyword scoring, boost scoring, inverted indices |
| Memory dedup | Custom duplicate check | memoryConsolidator (existing) | Already has Jaccard similarity, merge/noop/update/delete resolution |
| Memory UI rendering | New rendering system | renderMemoryList (existing in options.js) | Already renders with icons, metadata, delete buttons, sorting |
| Stats calculation | Custom counting | memoryStorage.getStats() (existing) | Already computes byType counts, bytes, utilization |
| Memory validation | Custom validation | validateMemory (existing in schemas) | Already validates id, type, text, metadata, createdAt |

**Key insight:** Every piece of infrastructure already exists. This phase is purely about fixing the data flow (enriching session data for extraction) and verifying the existing UI works once real data flows through it.

## Common Pitfalls

### Pitfall 1: AI Instance Deleted Before Memory Extraction

**What goes wrong:** `extractAndStoreMemories` is async/fire-and-forget. If `cleanupSession` runs immediately after, the AI instance is deleted before the extraction can read hardFacts/workingSelectors from it.
**Why it happens:** `extractAndStoreMemories(sessionId, session).catch(() => {})` is non-awaited, and `cleanupSession(sessionId)` follows immediately on some paths (e.g., line 4345-4346).
**How to avoid:** Copy AI instance data onto the session object synchronously INSIDE `extractAndStoreMemories` before any async work. The `sessionAIInstances.get(sessionId)` lookup is synchronous and will succeed as long as the function is called before `cleanupSession`.
**Warning signs:** Extracted memories only contain episodic type with minimal data, never semantic (selectors) or procedural (workflows).

### Pitfall 2: Memory Extractor Requires AI Provider

**What goes wrong:** `memoryExtractor._getProvider()` tries to load config and create a `UniversalProvider`. If no API key is configured, it returns null, and `extract()` returns empty array.
**Why it happens:** The extractor was designed to use AI for smart extraction. But many users may not have API keys, or the extraction API call may fail.
**How to avoid:** Add a local fallback in `extract()` that creates memories from structured data when no provider is available or when the AI call fails. The existing parse error fallback (line 192-211) already creates a simple episodic memory -- extend this pattern.
**Warning signs:** `[MemoryExtractor] No AI provider available, skipping extraction` in console.

### Pitfall 3: Options.html Loads Memory Modules But Cannot Create Provider

**What goes wrong:** options.html includes all memory module scripts (memory-schemas.js through memory-consolidator.js). When the memory extractor tries to create a provider inside options.html context, it may work because UniversalProvider is also loaded. But the extraction should NOT happen in the options page -- it happens in background.js.
**Why it happens:** Confusion about where extraction vs. display happens.
**How to avoid:** The extraction pipeline runs in background.js (service worker) at session end. The options.html page only READS memories via `memoryManager.getAll()` and `memoryManager.getStats()`. These use `chrome.storage.local` which works the same in both contexts.
**Warning signs:** None -- this is a conceptual pitfall for the planner, not a runtime issue.

### Pitfall 4: chrome.storage.local Quota

**What goes wrong:** With `unlimitedStorage` permission, the quota is technically unlimited, but chrome.storage.local is slower with large datasets.
**Why it happens:** Storing 500 memories with typeData could be several MB.
**How to avoid:** MAX_MEMORIES=500 and MAX_STORAGE_BYTES=8MB caps already exist. The eviction logic in `memoryStorage._evict()` handles this. Just verify these caps are working.
**Warning signs:** `getAll()` calls take >100ms.

### Pitfall 5: Empty actionHistory in Session Object

**What goes wrong:** Some session termination paths (e.g., content script health check failure at line 4338-4346) terminate before any actions are executed. The actionHistory is empty.
**Why it happens:** Session fails during setup, before the automation loop starts.
**How to avoid:** The local fallback extractor should gracefully handle empty actionHistory. The episodic memory still has value (recording that a task was attempted and failed). Check `actionHistory?.length` before creating procedural memories.
**Warning signs:** Procedural memories never appear.

### Pitfall 6: idleSession vs cleanupSession Timing

**What goes wrong:** For successful/stuck/timeout sessions, `idleSession()` is called instead of `cleanupSession()`. The AI instance persists for 10 minutes. But `extractAndStoreMemories` is fire-and-forget, so it should still complete before idle timeout.
**Why it happens:** Phase 6 changed success paths to use `idleSession` for follow-up continuation.
**How to avoid:** No issue here for memory extraction. The AI instance is available during extraction because `idleSession` does NOT delete it. Just verify that `extractAndStoreMemories` is called BEFORE `idleSession` at every relevant path.
**Warning signs:** None -- this is actually favorable for extraction.

### Pitfall 7: Double Extraction on Follow-up Commands

**What goes wrong:** If a conversation has 3 follow-up commands, each command's completion triggers `extractAndStoreMemories`. The session object has growing actionHistory, so each extraction covers overlapping data.
**Why it happens:** `idleSession()` is called after each command completion, and `extractAndStoreMemories` is called before that.
**How to avoid:** The consolidator's duplicate detection (Jaccard similarity >= 0.85) should catch duplicates. But for belt-and-suspenders safety, track a `lastExtractionTimestamp` on the session and skip extraction if less than 30s have passed. Or filter actionHistory to only actions since last extraction.
**Warning signs:** Multiple near-identical episodic memories for the same session.

## Code Examples

### Example 1: Enriched extractAndStoreMemories (the critical fix)

```javascript
// background.js -- modified extractAndStoreMemories
async function extractAndStoreMemories(sessionId, session) {
  try {
    // CRITICAL: Snapshot AI instance data before it gets cleaned up
    // This is synchronous and MUST happen before any await
    const ai = sessionAIInstances.get(sessionId);
    if (ai) {
      session._enrichedData = {
        hardFacts: ai.hardFacts ? {
          taskGoal: ai.hardFacts.taskGoal,
          criticalActions: [...(ai.hardFacts.criticalActions || [])],
          workingSelectors: { ...(ai.hardFacts.workingSelectors || {}) }
        } : null,
        sessionMemory: ai.sessionMemory ? {
          taskGoal: ai.sessionMemory.taskGoal,
          stepsCompleted: [...(ai.sessionMemory.stepsCompleted || [])],
          failedApproaches: [...(ai.sessionMemory.failedApproaches || [])]
        } : null,
        compactedSummary: ai.compactedSummary || null
      };
    }

    // Extract domain from session URL or action history
    let domain = null;
    if (session.actionHistory) {
      for (const action of session.actionHistory) {
        if (action.params?.url) {
          try { domain = new URL(action.params.url).hostname; } catch {}
          if (domain) break;
        }
      }
    }

    const memories = await memoryManager.add(session, { domain });
    if (memories.length > 0) {
      debugLog('Extracted memories from session', {
        sessionId,
        count: memories.length,
        types: memories.map(m => m.type)
      });
    }
  } catch (error) {
    console.warn('[FSB] Memory extraction failed for session', sessionId, error.message);
  }
}
```

### Example 2: Enhanced Extraction Prompt with Enriched Data

```javascript
// In memory-extractor.js _buildExtractionPrompt
_buildExtractionPrompt(session, context) {
  // ... existing code ...

  // NEW: Include enriched data from AI instance
  let enrichedSection = '';
  if (session._enrichedData) {
    const ed = session._enrichedData;
    if (ed.hardFacts?.workingSelectors) {
      const ws = Object.entries(ed.hardFacts.workingSelectors);
      if (ws.length > 0) {
        enrichedSection += `\nWorking selectors discovered:\n${ws.map(([k,v]) => `  ${k}: ${v}`).join('\n')}`;
      }
    }
    if (ed.hardFacts?.criticalActions?.length > 0) {
      enrichedSection += `\nCritical actions performed:\n${ed.hardFacts.criticalActions.map(a => `  ${a.description} (verified: ${a.verified})`).join('\n')}`;
    }
    if (ed.sessionMemory?.stepsCompleted?.length > 0) {
      enrichedSection += `\nSteps completed:\n${ed.sessionMemory.stepsCompleted.slice(-10).join('\n')}`;
    }
  }

  const userPrompt = `Session data:
Task: ${session.task}
Domain: ${domain}
Status: ${status}
Duration: ${Math.round(duration / 1000)}s
Total actions: ${actionCount}
Stuck count: ${session.stuckCounter || 0}

Action log (last 15):
${actionSummary || 'No actions recorded'}
${enrichedSection}
${session.error ? `Error: ${session.error}` : ''}

Extract memories from this session as a JSON array:`;
  // ... rest unchanged ...
}
```

### Example 3: Local Fallback in Extract Method

```javascript
// In memory-extractor.js extract method
async extract(session, context = {}) {
  if (!session || !session.task) {
    console.warn('[MemoryExtractor] No session or task to extract from');
    return [];
  }

  const provider = await this._getProvider(context);
  if (!provider) {
    // No AI provider -- use local fallback
    console.log('[MemoryExtractor] No AI provider, using local fallback extraction');
    return this._localFallbackExtract(session, context);
  }

  try {
    // ... existing AI extraction ...
  } catch (error) {
    console.error('[MemoryExtractor] Extraction failed:', error.message);
    // Fall back to local extraction on any AI error
    return this._localFallbackExtract(session, context);
  }
}
```

### Example 4: Memory Tab Stats Display (already working)

```javascript
// This code already exists in options.js and works correctly
function updateMemoryStats(stats) {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  el('memStatTotal', stats.totalCount);
  el('memStatEpisodic', stats.byType?.episodic || 0);
  el('memStatSemantic', stats.byType?.semantic || 0);
  el('memStatProcedural', stats.byType?.procedural || 0);

  const kb = Math.round(stats.estimatedBytes / 1024);
  el('memStatStorage', kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
  el('memStatUtilization', `${stats.utilizationPercent}%`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session object only has actionHistory | AI instance has hardFacts, workingSelectors, sessionMemory | Phase 4 (2026-02-14) | AI data is the richest source but not flowing to extractor |
| Fixed 5K prompt cap | 15K prompt cap with budget allocation | Phase 2 (2026-02-14) | More session data available for extraction prompts |
| Boolean domChanged | Multi-signal change descriptors | Phase 3 (2026-02-14) | Could inform richer episodic memories about what changed |
| cleanupSession always | idleSession for non-error paths | Phase 6 (2026-02-16) | AI instance survives longer, favorable for extraction |

## Identified Gaps (What Needs Fixing)

### Gap 1: Session Object Missing AI Instance Data (CRITICAL)

**Severity:** CRITICAL -- This is why no useful memories are being extracted.
**Evidence:** The `extractAndStoreMemories` function receives the `session` object from `activeSessions` Map. This object has `actionHistory`, `task`, `status`, `stuckCounter`, `iterationCount`, `startTime`. But it does NOT have `hardFacts`, `workingSelectors`, `sessionMemory`, or `compactedSummary`. These live on the AI instance in `sessionAIInstances`.
**Fix:** In `extractAndStoreMemories`, synchronously snapshot AI instance data onto the session object before any async work.
**Confidence:** HIGH -- verified by reading both `activeSessions` session creation (line 4248-4282) and AI instance data structure (line 404-408 of ai-integration.js).

### Gap 2: No Local Fallback When AI Provider Unavailable

**Severity:** MEDIUM -- Affects users without API keys or during API outages.
**Evidence:** `memory-extractor.js` line 26: `if (!provider) return [];`
**Fix:** Add `_localFallbackExtract` method that creates memories from structured session data without AI call.
**Confidence:** HIGH -- verified by reading memory-extractor.js.

### Gap 3: Extraction Prompt Missing Enriched Data

**Severity:** MEDIUM -- Reduces quality of AI-generated memories.
**Evidence:** `_buildExtractionPrompt` only includes task, status, duration, stuckCounter, and last 15 raw actions. Hard facts, working selectors, critical actions, and session steps are not included.
**Fix:** Feed `session._enrichedData` into the extraction prompt.
**Confidence:** HIGH -- verified by reading `_buildExtractionPrompt` in memory-extractor.js.

### Gap 4: Options.js Memory Tab Untested

**Severity:** LOW -- Code looks correct but has never rendered real data.
**Evidence:** The Memory tab UI exists in options.html (lines 640-713), and options.js has complete functions for stats, rendering, search, filter, consolidate, export, and clear (lines 3655-3856). The rendering code handles icons, metadata display, delete buttons, and empty states. But since no memories have been stored, this code has never actually executed with real data.
**Fix:** After fixing Gaps 1-3, manually verify the UI renders correctly. May need minor CSS fixes for memory items.
**Confidence:** HIGH -- code inspection shows complete implementation.

## Open Questions

1. **Domain extraction from URL history vs current tab URL**
   - What we know: `extractAndStoreMemories` extracts domain from `actionHistory` URLs (navigate actions). The `lastUrl` field on session could also be used.
   - What's unclear: If the session only visits one domain, this works. If it visits multiple (e.g., search then navigate), which domain should be tagged?
   - Recommendation: Use `session.lastUrl` as primary domain (where the session ended), fall back to first actionHistory URL. Tag with both if different.

2. **Follow-up command memory overlap**
   - What we know: Each command completion triggers extraction. A 3-command conversation will generate 3 sets of memories with overlapping actionHistory.
   - What's unclear: Will the consolidator's 0.85 Jaccard threshold reliably catch these duplicates?
   - Recommendation: Track `_lastExtractionActionIndex` on the session and only extract actions since last extraction.

3. **Memory cost per session**
   - What we know: The AI extraction costs ~$0.0003-0.0005 per call (grok-4-1-fast), as documented in memory-extractor.js.
   - What's unclear: Is this acceptable to users? There's no opt-in/opt-out toggle for memory extraction.
   - Recommendation: Memory extraction already exists as fire-and-forget. The local fallback (zero cost) should be the default for users concerned about cost. Add an "Enable AI Memory Extraction" toggle in advanced settings if desired (but defer to future phase).

## Sources

### Primary (HIGH confidence)
- `lib/memory/memory-schemas.js` -- Memory type definitions, validation, constants (MAX_MEMORIES=500, MAX_STORAGE_BYTES=8MB)
- `lib/memory/memory-storage.js` -- CRUD operations, inverted indices, eviction logic, getStats()
- `lib/memory/memory-retriever.js` -- Hybrid search with keyword + boost scoring
- `lib/memory/memory-extractor.js` -- AI extraction pipeline, prompt construction, response parsing
- `lib/memory/memory-manager.js` -- Orchestration API (add, search, consolidate, getAll, getStats)
- `lib/memory/memory-consolidator.js` -- Duplicate detection (Jaccard), stale cleanup, merge resolution
- `background.js` lines 45-76 -- `extractAndStoreMemories()` function
- `background.js` lines 798, 658-663 -- `sessionAIInstances` Map and cleanup
- `background.js` lines 4248-4282 -- Session object structure (no AI data)
- `ai/ai-integration.js` lines 404-408 -- hardFacts structure (taskGoal, criticalActions, workingSelectors)
- `ai/ai-integration.js` lines 820-910 -- Session memory enrichment (stepsCompleted, failedApproaches, working selectors)
- `ui/options.html` lines 640-713 -- Memory tab HTML
- `ui/options.js` lines 3655-3856 -- Memory tab JavaScript (init, load, render, search, consolidate, export, clear)

### Secondary (MEDIUM confidence)
- `background.js` -- 12+ call sites for `extractAndStoreMemories` (verified by grep: lines 4345, 4592, 5769, 5801, 5940, 6750, 7328, 7358, 7405, 7502, 7552)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All code read directly from source files
- Architecture: HIGH -- Data flow traced through all components
- Pitfalls: HIGH -- Identified from actual code analysis, not speculation
- Gaps: HIGH -- Root cause identified by comparing session object (4248-4282) with AI instance data (404-408)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable codebase, no external dependencies changing)
