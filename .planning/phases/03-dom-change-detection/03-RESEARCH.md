# Phase 3: DOM Change Detection - Research

**Researched:** 2026-02-14
**Domain:** DOM diffing, element fingerprinting, change signal generation within Chrome Extension content/background script architecture
**Confidence:** HIGH (all changes are internal to existing codebase; no external dependencies needed; patterns derived from direct code analysis)

## Summary

Phase 3 replaces the coarse DOM hash (`urlPath|title|elementCount|topTypes`) with a multi-signal change detection system that tells the AI **what** changed, not just **whether** something changed. The current system misses content changes, interaction state transitions, and structural changes that preserve element counts -- causing false stuck detections (Issue #2).

The work spans three files across two execution contexts: `content.js` (runs in the page), `background.js` (service worker), and `ai/ai-integration.js` (prompt construction). The core change is a shift from single-value hash comparison to structured change signals: a multi-channel hash that samples content, interaction states, and page-level flags; structural path fingerprinting that ignores viewport position; and a change descriptor object that enumerates what appeared, disappeared, or changed.

**Primary recommendation:** Build bottom-up: fix `hashElement()` first (removes scroll-induced hash instability), then rebuild `createDOMHash()` as multi-signal (captures real changes), then generate structured descriptors (tells the AI what changed), and finally rewire stuck detection to consume the new signals.

## Standard Stack

No external libraries are needed. All changes modify existing functions in three files that are already loaded.

### Core (existing, modified in-place)
| Module | Location | Purpose | Change Scope |
|--------|----------|---------|-------------|
| `DOMStateManager.hashElement()` | content.js ~line 222 | Per-element fingerprint for diff tracking | Replace position-based with structural-path-based |
| `createDOMHash()` | background.js ~line 4494 | Cross-iteration DOM comparison | Replace single hash with multi-signal object |
| Stuck detection block | background.js ~lines 5073-5126 | Decides if automation is stuck | Consume structured signals instead of hash equality |
| Context assembly | background.js ~lines 5376-5401 | Pass change info to AI | Add `changeSignals` object to context |
| `buildMinimalUpdate()` | ai/ai-integration.js ~line 340 | Multi-turn prompt for AI | Replace `domChanged: Yes/No` with change summary |
| `buildPrompt()` | ai/ai-integration.js ~line 1693 | Full prompt for AI | Replace `domChanged` boolean with structured info |

### Supporting (existing functions used but not modified)
| Function | Location | Purpose | How Used |
|----------|----------|---------|----------|
| `DOMStateManager.computeDiff()` | content.js ~line 285 | Computes added/removed/modified | Already exists; its output feeds change descriptors |
| `DOMStateManager.hasElementChanged()` | content.js ~line 261 | Element-level change check | Remove position sensitivity from this too |
| `hashElement()` standalone | content.js ~line 8447 | Legacy hash used in `diffDOM()` | Also needs structural path fix for consistency |
| `diffDOM()` | content.js ~line 9724 | Legacy diff used in some paths | Uses standalone `hashElement()`; must stay consistent |
| `shallowEqual()` | content.js ~line 133 | Fast object comparison | Reused for interaction state comparison in multi-signal hash |

### No New Dependencies
This phase adds zero new dependencies. All algorithms are string hashing, object comparison, and array diffing -- well within vanilla JavaScript capabilities.

## Architecture Patterns

### Pattern 1: Structural Path Fingerprinting (CHG-02)

**What:** Replace `position.x,position.y` in element fingerprints with a DOM tree path that is scroll-independent.

**Why:** The current `hashElement()` uses `${element.position?.x || 0},${element.position?.y || 0}` which changes every time the user scrolls. This causes the entire element cache to invalidate on scroll, making `computeDiff()` report all elements as "added" and all previous as "removed" -- a catastrophic false positive.

**How:**
```javascript
// CURRENT (scroll-dependent -- breaks on scroll)
hashElement(element) {
  const hashStr = `${element.type}|${element.id || ''}|${element.class || ''}|${text}|${element.position?.x || 0},${element.position?.y || 0}`;
  // ...
}

// NEW (structural path -- scroll-independent)
hashElement(element) {
  // Build fingerprint from stable properties only
  const stableId = element.id || '';
  const testId = element.attributes?.['data-testid'] || '';
  const role = element.attributes?.role || '';
  const name = element.attributes?.name || '';
  const type = element.type || '';
  const text = element.text ? element.text.substring(0, 30) : '';

  // Structural path from parentContext + cluster (already available on element)
  const parentTag = element.context?.parentContext?.tag || '';
  const parentRole = element.context?.parentContext?.role || '';
  const formId = element.formId || element.context?.formId || '';

  const hashStr = `${type}|${stableId}|${testId}|${role}|${name}|${parentTag}:${parentRole}|${formId}|${text}`;
  // ... same DJB2 hash function
}
```

**Key insight:** The element data object already contains `context.parentContext` (tag, class, role, aria-label) and `formId` and `cluster` and `relationshipContext` from `getStructuredDOM()`. These are all structural properties that do not change on scroll. No new DOM traversal is needed.

**Stable attributes to use (ordered by reliability):**
1. `id` -- globally unique when present (skip auto-generated: `:r1:`, `ember123`, etc.)
2. `attributes['data-testid']` -- explicitly stable test identifier
3. `attributes.role` -- semantic role (button, textbox, dialog, etc.)
4. `attributes.name` -- form element name (stable across renders)
5. `type` -- element tag name
6. `context.parentContext.tag + role` -- structural position
7. `formId` -- form association
8. `text` (first 30 chars) -- content hint for disambiguation

**What NOT to use:**
- `position.x`, `position.y` -- scroll-dependent
- `class` -- frequently toggled by CSS frameworks (hover states, animations, active states)
- Full `text` -- too long, varies with dynamic content

### Pattern 2: Multi-Signal DOM Hash (CHG-01)

**What:** Replace the single hash string with a multi-channel signal object that detects changes the current hash misses.

**Current problem:** The hash `${urlPath}|${title}|${elements.length}|${topTypes}` misses:
- Content changes (text typed into a field, success message replacing an error)
- Interaction state changes (button becoming disabled after click, checkbox toggling)
- Modal/toast appearance (same element count, different content)
- Form submission feedback (same URL, same title, different form state)

**How:**
```javascript
// NEW: Multi-signal hash object
function createDOMSignals(domState) {
  const elements = domState.elements || [];

  // Signal 1: Structural signature (element types + count -- same as before)
  const typeCounts = {};
  for (const el of elements) {
    const t = el.type;
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}:${count}`)
    .join(',');

  // Signal 2: Content sampling -- sample text from first N interactive elements
  // Catches: text changes in forms, success/error messages, modal content
  const contentSample = elements
    .filter(el => el.isInput || el.isButton || el.text?.length > 0)
    .slice(0, 15)
    .map(el => {
      if (el.isInput) return `${el.attributes?.name || el.id || 'input'}:${(el.value || '').substring(0, 20)}`;
      return (el.text || '').substring(0, 30);
    })
    .join('|');

  // Signal 3: Interaction state signature -- disabled/checked/focused states
  // Catches: button disabled after submit, checkbox toggle, form validation states
  const interactionSignature = elements
    .filter(el => el.interactionState && (el.isInput || el.isButton))
    .slice(0, 20)
    .map(el => {
      const s = el.interactionState;
      return `${el.id || el.type}:${s.disabled ? 'D' : ''}${s.checked ? 'C' : ''}${s.readonly ? 'R' : ''}${s.focused ? 'F' : ''}`;
    })
    .join(',');

  // Signal 4: Page state flags -- URL path, title, visibility indicators
  // Catches: toast/snackbar appearance, modal open/close, success page navigation
  let urlPath = '';
  try { urlPath = new URL(domState.url || '').pathname; } catch { urlPath = domState.url || ''; }

  const pageStateFlags = {
    urlPath,
    title: domState.title || '',
    elementCount: elements.length,
    hasModal: elements.some(el => el.attributes?.role === 'dialog' || el.attributes?.role === 'alertdialog'),
    hasAlert: elements.some(el => el.attributes?.role === 'alert' || el.attributes?.role === 'status'),
    captchaPresent: domState.captchaPresent || false
  };

  return {
    structural: quickHash(topTypes),
    content: quickHash(contentSample),
    interaction: quickHash(interactionSignature),
    pageState: quickHash(JSON.stringify(pageStateFlags)),
    // Keep raw flags for structured comparison
    _raw: { topTypes, elementCount: elements.length, pageStateFlags }
  };
}

function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}
```

**Comparison logic:** Instead of `currentHash !== lastHash`, compare each signal channel independently:
```javascript
function compareSignals(current, previous) {
  if (!previous) return { changed: true, channels: ['initial'] };
  const changed = [];
  if (current.structural !== previous.structural) changed.push('structural');
  if (current.content !== previous.content) changed.push('content');
  if (current.interaction !== previous.interaction) changed.push('interaction');
  if (current.pageState !== previous.pageState) changed.push('pageState');
  return { changed: changed.length > 0, channels: changed };
}
```

### Pattern 3: Structured Change Descriptors (CHG-03)

**What:** Generate a human-readable change summary that tells the AI exactly what appeared/disappeared/changed.

**Where it goes:** The `context` object passed from background.js to ai-integration.js (line 5376-5401) currently has `domChanged: boolean`. Add `changeSignals` object alongside it.

**How:**
```javascript
// In background.js, after comparing signals:
const changeResult = compareSignals(currentSignals, session.lastDOMSignals);

const changeSignals = {
  changed: changeResult.changed,
  channels: changeResult.channels,    // ['content', 'interaction'] etc.
  summary: []                          // Human-readable descriptors
};

// Generate descriptors from the channel comparison
if (changeResult.channels.includes('structural')) {
  const prev = session.lastDOMSignals._raw;
  const curr = currentSignals._raw;
  const countDelta = curr.elementCount - (prev?.elementCount || 0);
  if (countDelta > 0) changeSignals.summary.push(`${countDelta} elements appeared`);
  if (countDelta < 0) changeSignals.summary.push(`${Math.abs(countDelta)} elements removed`);
  if (countDelta === 0) changeSignals.summary.push('element types changed');
}
if (changeResult.channels.includes('content')) {
  changeSignals.summary.push('page content changed (text or input values)');
}
if (changeResult.channels.includes('interaction')) {
  changeSignals.summary.push('element states changed (disabled, checked, or focus)');
}
if (changeResult.channels.includes('pageState')) {
  const prev = session.lastDOMSignals._raw?.pageStateFlags;
  const curr = currentSignals._raw.pageStateFlags;
  if (prev && curr) {
    if (curr.hasModal && !prev.hasModal) changeSignals.summary.push('modal/dialog opened');
    if (!curr.hasModal && prev.hasModal) changeSignals.summary.push('modal/dialog closed');
    if (curr.hasAlert && !prev.hasAlert) changeSignals.summary.push('alert/status message appeared');
    if (curr.title !== prev.title) changeSignals.summary.push(`title changed to "${curr.title.substring(0, 50)}"`);
  }
}

// Pass to context object
context.changeSignals = changeSignals;
// Keep backward-compatible domChanged boolean
context.domChanged = changeSignals.changed;
```

**AI prompt integration:**
```javascript
// In buildMinimalUpdate and buildPrompt, replace:
//   DOM changed: ${context?.domChanged ? 'Yes' : 'No'}
// With:
const changeInfo = context.changeSignals;
if (changeInfo?.changed) {
  update += `\nDOM changed: Yes -- ${changeInfo.summary.join('; ')}`;
} else {
  update += `\nDOM changed: No (page appears unchanged)`;
}
```

### Pattern 4: Multi-Signal Stuck Detection (CHG-04)

**What:** Use structured change signals to reduce false stuck detections.

**Current problem:** When `domChanged === false` (single hash comparison), the stuck counter increments. But "no change" is often wrong -- the content changed (e.g., text was typed) but the element count and types stayed the same, so the hash matches.

**How:**
```javascript
// CURRENT (lines 5073-5126): Single boolean stuck logic
if (!domChanged && !urlChanged) {
  // ... complex typing-sequence checks ...
  session.stuckCounter++;
}

// NEW: Multi-signal stuck logic
if (!changeResult.changed && !urlChanged) {
  // No signal changed at all -- genuinely stuck
  // Keep existing typing-sequence refinements
  session.stuckCounter++;
} else if (changeResult.changed) {
  // SOMETHING changed -- not stuck
  // But check if it's only trivial changes (just focus moved)
  const substantiveChannels = changeResult.channels.filter(c => c !== 'interaction');
  if (substantiveChannels.length > 0) {
    session.stuckCounter = 0;  // Definite progress
  } else {
    // Only interaction state changed (focus moved) -- might be progress, reduce penalty
    session.stuckCounter = Math.max(0, session.stuckCounter - 1);
  }
}
```

**Key insight:** The current typing-sequence special case (lines 5080-5113) exists precisely because the hash cannot detect content changes from typing. With content sampling in the multi-signal hash, typing will show up as a `content` channel change, automatically preventing false stuck detection without the special case. The typing-sequence code can be simplified but should be kept as a safety net.

### Anti-Patterns to Avoid

- **Full DOM serialization for hashing:** Never JSON.stringify the entire DOM state for comparison. The current hash approach (sampling key signals) is correct; the problem is which signals are sampled.
- **MutationObserver for change detection in background.js:** The background script cannot observe DOM mutations. Change detection must compare snapshots, not track mutations in real-time. (MutationObserver in content.js already exists for the DOMStateManager's internal use.)
- **CSS class in element fingerprints:** Classes are frequently toggled by frameworks (React, Vue, Angular, Tailwind) for hover/active/selected states. Using class in fingerprints causes hash instability similar to the position problem.
- **Deep equality comparison on entire elements:** O(n * fields) comparison is expensive. Use channel-based hashing where each channel is a quick hash of sampled values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Element identity tracking | Full XPath generation | Composite key from existing element data (id, testid, role, name, parent context) | XPath is expensive to compute for every element and fragile to DOM restructuring |
| String hashing | Crypto-grade hash functions | DJB2 (the `quickHash` already used in `createDOMHash`) | Cryptographic hashing is overkill for change detection; DJB2 is fast and sufficient |
| DOM tree diffing | Custom tree diff algorithm | Snapshot-to-snapshot comparison using element maps (existing `computeDiff` pattern) | Tree diffing is O(n^3); map-based diffing is O(n) |
| Change notification system | Event-based change broadcast | Object returned synchronously from `createDOMSignals()` | The automation loop is already synchronous iteration-based; no events needed |

## Common Pitfalls

### Pitfall 1: Hash Collision on Similar Elements
**What goes wrong:** Two different elements produce the same hash because they share the same type, id (empty), role, and text prefix.
**Why it happens:** Many pages have multiple similar elements (list items, table rows, nav links) with identical stable attributes.
**How to avoid:** Include the `elementId` (semantic ID like `btn_submit_0`) in the hash as a tiebreaker. The `elementId` is already generated uniquely by `generateSemanticElementId()` in content.js. However, since elementId may change between snapshots (if element order changes), use it only as a secondary discriminator, not the primary key.
**Warning signs:** `computeDiff()` reports zero added/removed when elements clearly changed visually.

### Pitfall 2: Content Sample Sensitivity
**What goes wrong:** Sampling too many characters from element text causes the content hash to change on every trivial text update (e.g., timestamp, counter).
**Why it happens:** Dynamic content like clocks, live counts, or animation text changes every second.
**How to avoid:** Sample only the first 15-20 interactive elements, limit to 20-30 chars each. Focus on inputs (value), buttons (text), and alerts -- not decorative text. Skip elements with rapidly changing content (timestamps, counters) by excluding elements whose text is purely numeric.
**Warning signs:** Content channel always reports "changed" even when nothing meaningful happened.

### Pitfall 3: Interaction State Over-Sensitivity
**What goes wrong:** Focus changes cause the interaction hash to change every iteration (because the AI's last click changed focus).
**Why it happens:** Every click or type action moves focus, changing which element has `focused: true`.
**How to avoid:** Exclude `focused` from the interaction signature hash. Focus changes are expected behavior, not a meaningful state change. Only track `disabled`, `checked`, `readonly`, `selected`.
**Warning signs:** Interaction channel reports "changed" after every action even when no meaningful state change occurred.

### Pitfall 4: Backward Compatibility with domChanged
**What goes wrong:** Removing `domChanged` from the context object breaks `buildPrompt()` and `buildMinimalUpdate()` which check `context?.domChanged`.
**Why it happens:** Multiple consumers read `domChanged` from the context.
**How to avoid:** Keep `domChanged` as a backward-compatible boolean derived from the new signals: `context.domChanged = changeSignals.changed`. Add `changeSignals` as a new property alongside it. Update AI prompt templates to use the richer signals, but leave the boolean for any code that just needs yes/no.
**Warning signs:** AI prompt shows `DOM changed: undefined` or crashes on missing property.

### Pitfall 5: Two hashElement Functions
**What goes wrong:** Updating `DOMStateManager.hashElement()` (line 222) but not the standalone `hashElement()` (line 8447) causes inconsistent behavior between the two diff paths.
**Why it happens:** content.js has two separate element hashing implementations -- one in the class, one standalone. The standalone is used by `diffDOM()` (line 9724).
**How to avoid:** Update BOTH functions to use structural path fingerprinting. Or better: make the standalone function delegate to the class method if the DOMStateManager instance is available.
**Warning signs:** `DOMStateManager.computeDiff()` and `diffDOM()` return different results for the same DOM state.

### Pitfall 6: Performance of Content Sampling
**What goes wrong:** Iterating all elements to build the content sample adds latency to every iteration.
**Why it happens:** The element array can have 50-150 elements after Phase 2's budget system.
**How to avoid:** The sampling is already bounded (first 15 elements, 20 chars each). With 150 elements max, the filter+slice+map is O(n) with small constants. No performance concern. Do NOT add caching or memoization -- the whole point is detecting changes between iterations.
**Warning signs:** None expected; this is a non-issue flagged for completeness.

## Code Examples

### Example 1: Structural Path Hash (content.js hashElement replacement)

```javascript
// Source: Direct analysis of existing element data structure in getStructuredDOM()
hashElement(element) {
  // Build fingerprint from stable, scroll-independent properties
  const type = element.type || '';
  const stableId = element.id || '';
  const testId = element.attributes?.['data-testid'] || '';
  const role = element.attributes?.role || '';
  const name = element.attributes?.name || '';
  const text = element.text ? element.text.substring(0, 30) : '';

  // Structural context from parent (already in element data from getStructuredDOM)
  const parentTag = element.context?.parentContext?.tag || '';
  const parentRole = element.context?.parentContext?.role || '';
  const formId = element.formId || element.context?.formId || '';

  const hashStr = `${type}|${stableId}|${testId}|${role}|${name}|${parentTag}:${parentRole}|${formId}|${text}`;

  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    const char = hashStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(36);
}
```

### Example 2: Standalone hashElement Alignment (content.js line 8447)

```javascript
// Source: Must match DOMStateManager.hashElement() for consistency
function hashElement(element) {
  // Mirror the structural-path approach from DOMStateManager
  const type = element.type || '';
  const stableId = element.id || '';
  const testId = element.attributes?.['data-testid'] || '';
  const role = element.attributes?.role || '';
  const name = element.attributes?.name || '';
  const text = element.text ? element.text.substring(0, 30) : '';
  const parentTag = element.context?.parentContext?.tag || '';
  const parentRole = element.context?.parentContext?.role || '';
  const formId = element.formId || element.context?.formId || '';

  return `${type}|${stableId}|${testId}|${role}|${name}|${parentTag}:${parentRole}|${formId}|${text}`;
}
```

Note: The standalone version returns the raw string (used by `diffDOM()` for Map key lookup). The class version returns the DJB2 hash (used by `computeDiff()` for Set/Map operations). Both must use the same input fields to be consistent in identity semantics.

### Example 3: hasElementChanged Without Position Sensitivity (content.js line 261)

```javascript
// Source: Direct analysis of existing function
hasElementChanged(current, previous) {
  // Text changes
  if (current.text !== previous.text) return true;

  // REMOVED: Position change check (was scroll-dependent)
  // const posChange = Math.abs(...) > 10;
  // Position is no longer part of change detection -- only structural identity matters

  // Visibility changes
  if (current.visibility?.display !== previous.visibility?.display) return true;

  // Interaction state changes (shallow compare)
  if (!shallowEqual(current.interactionState, previous.interactionState)) return true;

  // Attribute changes (shallow compare)
  if (!shallowEqual(current.attributes, previous.attributes)) return true;

  return false;
}
```

### Example 4: Change Signal Summary for AI Prompt

```javascript
// Source: Pattern for AI prompt construction in ai-integration.js
function formatChangeInfo(context) {
  const cs = context.changeSignals;
  if (!cs) return `DOM changed: ${context?.domChanged ? 'Yes' : 'No'}`;

  if (!cs.changed) {
    return 'DOM changed: No (page appears unchanged since your last action)';
  }

  let info = 'DOM changed: Yes';
  if (cs.summary && cs.summary.length > 0) {
    info += ' -- ' + cs.summary.join('; ');
  }
  return info;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `position.x,y` in element hash | Structural path fingerprint | Phase 3 (this phase) | Eliminates scroll-induced hash instability |
| `urlPath\|title\|elementCount\|topTypes` hash | Multi-signal hash (structural, content, interaction, pageState) | Phase 3 (this phase) | Detects content/state changes the old hash missed |
| `domChanged: boolean` in context | `changeSignals: { changed, channels, summary }` | Phase 3 (this phase) | AI knows WHAT changed, not just IF something changed |
| Special-case typing detection for stuck | Multi-signal automatically detects content changes from typing | Phase 3 (this phase) | Simpler stuck logic, fewer false positives |

## Execution Sequence

The four requirements have a clear dependency order:

1. **CHG-02 first** -- Fix `hashElement()` to use structural path. This is a prerequisite because `createDOMHash()` in background.js consumes the element data that content.js hashes. If element identity is wrong, change detection built on top of it will be wrong.

2. **CHG-01 second** -- Replace `createDOMHash()` with `createDOMSignals()` in background.js. This consumes the DOM state (with structurally-hashed elements) and produces multi-channel signals.

3. **CHG-03 third** -- Generate structured change descriptors from signal comparison. This layer sits between the signal generation and the AI prompt, translating channel diffs into human-readable summaries.

4. **CHG-04 last** -- Rewire stuck detection to use multi-signal data. This is the consumer of all the above work, replacing the single-boolean stuck counter logic with channel-aware decision-making.

This can potentially be done in 2 plans:
- **Plan 1:** CHG-02 + CHG-01 (fingerprinting + signal generation -- the "data" layer)
- **Plan 2:** CHG-03 + CHG-04 (descriptors + stuck detection -- the "consumer" layer)

## Open Questions

1. **Element identity across page navigation**
   - What we know: When the URL changes, elements are completely different, so structural path comparison is meaningless. The current code already resets stuck counter on URL change.
   - What's unclear: Should we also reset the signal history on URL change, or keep it for detecting URL-change-then-back-to-same-page cycles?
   - Recommendation: Reset `lastDOMSignals` on URL change. The `stateHistory` array already tracks URL changes for cycle detection.

2. **Content sample element selection**
   - What we know: We need to sample "the right" elements for content hashing. Inputs (form values), buttons (text), and alert/status elements are high-signal.
   - What's unclear: Exact element selection criteria and ordering for consistent sampling across iterations.
   - Recommendation: Filter for `isInput || isButton || attributes.role in ['alert','status','dialog']`, then sort by a stable key (elementId), take first 15. Sorting by stable key ensures the same elements are sampled in the same order across iterations.

3. **Standalone hashElement vs DOMStateManager.hashElement**
   - What we know: Both exist, both need updating, they serve different diff paths.
   - What's unclear: Whether `diffDOM()` (line 9724) is still actively used or if all paths now go through `DOMStateManager.computeDiff()`.
   - Recommendation: Update both for safety. If investigation reveals `diffDOM()` is dead code, document it but still update for consistency.

## Sources

### Primary (HIGH confidence)
- **content.js direct analysis** -- `DOMStateManager` class (lines 147-490), `hashElement()` standalone (line 8447), `diffDOM()` (line 9724), `getStructuredDOM()` (lines 10580-10800)
- **background.js direct analysis** -- `createDOMHash()` (lines 4494-4526), stuck detection block (lines 5073-5126), context assembly (lines 5376-5401), `analyzeStuckPatterns()` (lines 1694-1752)
- **ai/ai-integration.js direct analysis** -- `buildMinimalUpdate()` (line 340-345), `buildPrompt()` (line 1693), domChanged usage

### Secondary (MEDIUM confidence)
- **Roadmap/Requirements** -- Phase 3 requirements CHG-01 through CHG-04, pitfall mitigations 6/7/11

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all modifications are to existing code, no new dependencies
- Architecture: HIGH -- patterns derived from direct code analysis with verified data flows
- Pitfalls: HIGH -- identified from actual code issues (two hashElement functions, position in fingerprint, CSS class instability)
- Code examples: HIGH -- based on actual current code with minimal modifications

**Research date:** 2026-02-14
**Valid until:** Indefinite (internal architecture, no external version dependencies)
