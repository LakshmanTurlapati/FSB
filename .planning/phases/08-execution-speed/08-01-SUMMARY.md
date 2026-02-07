---
phase: 08-01
plan: 01
subsystem: execution-speed
tags: [element-cache, readiness-check, performance, mutation-observer]
requires: [02-01]
provides: [element-caching, fast-path-readiness]
affects: [08-02, 08-03]
tech-stack:
  added: []
  patterns: [WeakRef-caching, MutationObserver-invalidation, fast-path-pattern]
key-files:
  created: []
  modified: [content.js]
decisions:
  - id: 08-01-01
    decision: "Use WeakRef for auto-cleanup when elements are garbage collected"
    rationale: "Prevents memory leaks from cached element references"
  - id: 08-01-02
    decision: "Invalidate cache on >20 mutations OR structural changes"
    rationale: "Balance between cache hit rate and stale element risk"
  - id: 08-01-03
    decision: "Quick check is conservative - fall through when in doubt"
    rationale: "Prefer reliability over speed; only skip full check when definitely ready"
metrics:
  duration: 8min
  completed: 2026-02-04
---

# Phase 08 Plan 01: Element Caching and Fast-Path Readiness Summary

Element caching with MutationObserver invalidation and quick readiness fast-path to skip unnecessary delays for ready elements.

## Completed Tasks

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | ElementCache class with MutationObserver invalidation | 70f4d19 | Added ElementCache class with WeakRef storage, auto-invalidation on DOM changes |
| 2 | performQuickReadinessCheck and smartEnsureReady | b3aa307 | Added 5-point quick check and smart wrapper with fast-path bypass |
| 3 | Integrate cache and smartEnsureReady into code paths | 0f65967 | Cache integration in querySelectorWithShadow, action handlers use smartEnsureReady |

## Implementation Details

### ElementCache Class (lines 463-565)

Caches element lookups to avoid repeated DOM queries:

```javascript
class ElementCache {
  // Map storage: selector -> { ref: WeakRef(element), version, timestamp }
  // MutationObserver invalidates on:
  //   - mutations.length > 20 (high activity)
  //   - hasStructuralChange (nodes added/removed)
  // WeakRef allows garbage collection of unused elements
}
```

**Key methods:**
- `get(selector)`: Returns cached element if valid (connected, version matches)
- `set(selector, element)`: Caches with WeakRef, evicts oldest if > 100 entries
- `invalidate()`: Clears cache, increments stateVersion
- `initialize()`: Sets up MutationObserver on document.body

### performQuickReadinessCheck (lines 2590-2654)

Fast 5-point check to determine if element is obviously ready:

1. **hasSize**: rect.width > 0 AND rect.height > 0
2. **notDisabled**: !element.disabled AND aria-disabled !== 'true'
3. **visible**: display/visibility/opacity check
4. **inViewport**: element fully within viewport
5. **receivesEvents**: elementFromPoint matches element

**Return values:**
- `definitelyReady`: All 5 checks pass -> skip full ensureElementReady
- `definitelyNotReady`: Basic checks fail -> immediate rejection
- `concern`: 'scroll' or 'obscured' -> needs attention

### smartEnsureReady (lines 2663-2687)

Wrapper that uses quick check as fast-path:

```javascript
async function smartEnsureReady(element, actionType) {
  const quickCheck = performQuickReadinessCheck(element);

  if (quickCheck.definitelyReady) {
    return { ready: true, fastPath: true, ... };  // Skip full check
  }

  return ensureElementReady(element, actionType);  // Fall through
}
```

### Integration Points

**querySelectorWithShadow** (lines 1712-1769):
- Cache check at start: `elementCache.get(sanitized)`
- Cache population before return: `elementCache.set(sanitized, element)`

**Action handlers using smartEnsureReady:**
- tools.click (line 3953)
- tools.type (line 4423)
- tools.pressEnter (line 4947)
- tools.rightClick (line 5499)
- tools.doubleClick (line 5539)
- tools.focus (line 5961)
- tools.hover (line 6003)
- tools.selectOption (line 6063)
- tools.toggleCheckbox (line 6159)

## Deviations from Plan

None - plan executed exactly as written.

## Performance Impact

**SPEED-04 (Element Cache):**
- Repeated selector queries return cached element immediately
- No DOM traversal for cached hits
- Automatic cache invalidation on significant DOM changes

**SPEED-05 (Quick Readiness):**
- Visible, in-viewport, enabled elements skip full readiness pipeline
- Eliminates stability wait, scroll check, obscuration check for ready elements
- Conservative approach: only fast-path when all 5 checks pass

**Expected improvement:**
- Repeated element lookups: ~10-50x faster (cache vs DOM query)
- Ready element interaction: ~50-200ms saved per action (skip readiness delays)

## Verification Results

All success criteria met:

- [x] Element lookups cached via elementCache.set()
- [x] Cache retrieved via elementCache.get() in querySelectorWithShadow
- [x] Cache invalidates on structural changes or >20 mutations
- [x] performQuickReadinessCheck returns definitelyReady for ready elements
- [x] smartEnsureReady bypasses ensureElementReady on fast-path
- [x] All action handlers use smartEnsureReady
- [x] No syntax errors in content.js

## Next Phase Readiness

Ready for 08-02 (Outcome-Based Delays) which builds on this performance foundation.
