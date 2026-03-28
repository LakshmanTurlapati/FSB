# Phase 21: Google Sheets CLI Engine Refinement - Research

**Researched:** 2026-03-06
**Domain:** CLI engine reliability for canvas-based web apps (Google Sheets)
**Confidence:** HIGH

## Summary

This phase addresses five interrelated bugs that cause the CLI automation engine to fail catastrophically on Google Sheets: (1) snapshot format inconsistency where `_compactSnapshot` refs (e1, e2) degrade to full element IDs on iterations 2+, (2) the CLI parser requiring a ref for `type` but Sheets needing ref-less typing into the active/focused cell, (3) `pressEnter` failing with "selector: undefined" when no ref is provided, (4) conversation history reset on stuck destroying CLI format context, and (5) the AI generating 15+ broken commands in a loop after history reset.

All five problems are internal to the existing codebase and involve well-understood code paths. The fixes are surgical -- no new dependencies, no architectural changes. The key files are `ai/cli-parser.js` (command registry), `ai/ai-integration.js` (snapshot formatting, stuck recovery, prompt building), `content/actions.js` (pressEnter handler), and `content/messaging.js` (ref resolution). The Google Sheets site guide already has comprehensive workflow documentation; the issue is enforcement, not knowledge.

**Primary recommendation:** Fix the five bugs in order of dependency: snapshot consistency first (affects everything), then ref-optional commands, then stuck recovery, then prompt enforcement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Element ref format (e1, e2, e3) MUST be preserved across ALL iterations, not just iteration 1
- The fallback from `_compactSnapshot` to full element IDs in ai-integration.js ~L871-902 must be eliminated
- Delta/change snapshots must use the same ref format as the initial snapshot
- If `_compactSnapshot` is unavailable in iteration 2+, the system must regenerate it rather than falling back
- `type` command must support ref-optional mode for typing into the active/focused element
- When no ref is provided, `type "data"` should target the currently focused element
- `enter` (pressEnter) already has optional ref but content script fails with "selector: undefined" -- fix the action handler
- Conversation history reset is counterproductive -- replace with trim-to-last-2 + format reminder
- Cap max actions per response for Sheets workflows
- Site guide patterns need stronger integration -- "MANDATORY WORKFLOW" injection

### Claude's Discretion
- Implementation approach for snapshot regeneration (rebuild vs cache)
- Specific max-actions-per-response limit (suggest 10-15 for Sheets)
- Whether to add a dedicated `typecell` CLI command vs making `type` smarter
- How to detect "canvas-based app" mode automatically

### Deferred Ideas (OUT OF SCOPE)
- Google Docs support
- Generic "canvas-based app" detection framework
- Macro recording for repeated Sheets operations
- Google Sheets API integration as alternative to DOM automation
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2020+ | All implementation | Project rule: no external deps, no build system |
| Chrome Extensions MV3 | v3 | Extension platform | Existing architecture |

### Supporting
No new libraries needed. All changes are to existing files.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Making `type` ref-optional | New `typecell` command | Adds cognitive load for AI; `type` without ref is more natural and consistent with `enter` which already supports optional ref |
| Snapshot cache | Full rebuild each iteration | Rebuild is safer (no stale cache issues), and `generateCompactSnapshot` already runs in ~50ms on Sheets pages with ~62 elements |

**Recommendations (Claude's Discretion areas):**
- **Snapshot regeneration:** Use rebuild (not cache). `generateCompactSnapshot` resets `refMap` and rebuilds from live DOM each call. Caching would risk stale refs. The function is already fast enough. Simply ensure the compact snapshot path is always used.
- **Max actions per response:** Cap at 8 for Sheets (matching existing `MAX_BATCH_SIZE`). The batch suppression already exists for Sheets with 2+ type actions, but the AI itself needs to be instructed to limit output.
- **typecell vs smarter type:** Make `type` smarter (ref-optional). Adding a new command would require teaching every AI model about it. The `type` command already has the arg schema machinery; just mark `ref` as optional.
- **Canvas-based app detection:** Use URL pattern matching (already done for batch suppression at `background.js:6078`). Expand the Sheets URL pattern check to a helper function used by both batch suppression and action count capping.

## Architecture Patterns

### Bug 1: Snapshot Format Inconsistency

**Root cause (VERIFIED, HIGH confidence):**
The snapshot format is determined in `ai-integration.js:871-882`. When `domState._compactSnapshot` exists, compact refs are used. When it doesn't, the legacy `formatElements()` path runs, which uses full `elementId` strings like `[input_t_name_box_docs_chrome_text]`.

The compact snapshot is generated in `content/messaging.js:747-754` only when `domOptions.includeCompactSnapshot` is true. Checking `background.js`, this flag is set to `true` in ALL four places where getDOM is called (lines 8403, 8483, 9094, 9301). So the compact snapshot SHOULD always be present.

**Likely actual cause:** The `_compactSnapshot` field may be empty/null when `generateCompactSnapshot` throws an error or returns an empty snapshot. On Google Sheets, the canvas grid means many "interactive" elements are toolbar buttons -- but the DOM analysis pipeline may encounter errors with Sheets-specific elements (e.g., canvas children, shadow DOM in Google's widgets).

**Fix approach:**
1. In `ai-integration.js` `buildContinuationPrompt()` (~L2997-3001) and `buildProgressUpdate()` (~L871-882): if `_compactSnapshot` is missing/empty, explicitly request a fresh compact snapshot via `getCompactDOM` message instead of falling back to legacy format.
2. Add a guard: if compact snapshot generation fails, log the error but still use the compact format with whatever elements were successfully processed (partial snapshot > legacy format).

### Bug 2: `type` Command Ref-Optional

**Root cause (VERIFIED, HIGH confidence):**
In `cli-parser.js:157`, the `type` command schema is:
```javascript
type: { tool: 'type', args: [{ name: 'ref', type: 'ref' }, { name: 'text', type: 'string' }] }
```
Both args are required (no `optional: true`). When AI outputs `type "hello"` (no ref), the parser treats `"hello"` as the ref argument (since it's first positional) and text is missing.

**Fix approach:**
1. Mark `ref` as optional in the type command schema: `{ name: 'ref', type: 'ref', optional: true }`
2. In `mapCommand()`, detect when type has only one positional token -- if that token is NOT a valid ref pattern (e.g., it starts with a quote or doesn't match `e\d+`/CSS selector pattern), treat it as `text` instead of `ref`.
3. This requires a disambiguation heuristic in `mapCommand`: if `type` has 1 token and that token doesn't look like a ref/selector, shift it to `text` param.

**Content script side:** In `content/messaging.js:806`, when `params.ref` is absent AND `params.selector` is absent, the action handler needs to target `document.activeElement`. This is the focused element -- on Sheets, after Name Box navigation, the grid cell input is focused.

### Bug 3: `pressEnter` With No Ref

**Root cause (VERIFIED, HIGH confidence):**
In `cli-parser.js:168`, `enter` has `ref` marked as optional. The parser correctly produces `{ tool: 'pressEnter', params: {} }` with no ref/selector. But in `content/messaging.js:806-828`, ref resolution requires `params.ref` to be present. When it's absent, no selector is set. Then `content/actions.js:2545` reads `params.selectors || [params.selector]` which becomes `[undefined]`, and `querySelectorWithShadow(undefined)` returns null, producing "Element not found with selector: undefined".

**Fix approach:**
In `content/messaging.js` or `content/actions.js`, add a focused-element fallback: when `pressEnter` (or `type`) receives no ref AND no selector, dispatch the keypress/type on `document.activeElement` instead of querying by selector.

### Bug 4: Stuck Recovery - History Reset

**Root cause (VERIFIED, HIGH confidence):**
In `ai-integration.js:1854-1860`:
```javascript
if (context?.isStuck && this.conversationHistory.length > 0) {
    this.conversationHistory = [];
}
```
This wipes ALL conversation history. On the next iteration, `buildPrompt` is called fresh (line 1847), which rebuilds the full system prompt. However, the AI loses all context about what it has already done, what commands worked, and critically, the CLI format examples from prior exchanges. This causes the AI to revert to its training-data default (JSON tool calls) or generate malformed output.

**Fix approach:**
Replace `this.conversationHistory = []` with a trim that keeps system prompt + last 2 exchanges:
```javascript
if (context?.isStuck && this.conversationHistory.length > 3) {
    const systemMsg = this.conversationHistory[0];
    const lastExchanges = this.conversationHistory.slice(-4); // 2 user + 2 assistant
    this.conversationHistory = [systemMsg, ...lastExchanges];
}
```
Additionally, inject a "format reminder" into the stuck recovery prompt text (already partially done at L2553-2598) that explicitly shows CLI command format.

### Bug 5: Excessive Actions After Reset

**Root cause:** After history reset, the AI doesn't have prior CLI exchange context, so it hallucinates long sequences. The existing `MAX_BATCH_SIZE = 8` cap in `background.js:6052` limits execution, but the AI still wastes tokens generating 15-35 commands.

**Fix approach:**
1. Add a per-response action cap instruction in the system/user prompt for Sheets tasks. When task type is "sheets" or URL matches Sheets pattern, add: "Output at most 8 CLI commands per response. Wait for DOM updates between batches."
2. In `ai-integration.js` `processQueue()`, after parsing, cap `parsed.actions` to a configurable limit (e.g., 8-10 for Sheets tasks, based on URL detection).

### Anti-Patterns to Avoid
- **Do NOT add a separate `typecell` command** -- it fragments the command surface and requires retraining all AI models
- **Do NOT cache compact snapshots across iterations** -- DOM changes between iterations make cached refs stale
- **Do NOT rely on `document.activeElement` without checking it's a valid target** -- it could be `<body>` if nothing is focused

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active element detection | Custom focus tracking | `document.activeElement` | Browser-native, always current |
| Sheets URL detection | Manual URL string matching | Existing pattern at `background.js:6078` (`/docs\.google\.com\/spreadsheets\/d\//i`) | Already battle-tested in batch suppression |
| Keyboard event dispatch | Custom KeyboardEvent construction | Existing `keyPress` action handler | Already handles modifiers, bubbling, trusted events |

## Common Pitfalls

### Pitfall 1: `document.activeElement` Returns `<body>`
**What goes wrong:** When no element has focus, `document.activeElement` returns `document.body`. Typing into `<body>` has no visible effect.
**Why it happens:** After a batch suppression or failed action, focus may be lost. Google Sheets may also move focus to its internal canvas frame.
**How to avoid:** Check that `document.activeElement` is not `<body>` and not `<html>`. If it is, log a warning and return a descriptive error: "No element is currently focused. Use click to focus an element first."
**Warning signs:** `type "data"` succeeds (no error) but has no visible effect on the page.

### Pitfall 2: Ref Disambiguation in `type` Command
**What goes wrong:** `type "A1"` could be interpreted as typing the text "A1" into the focused element, OR as targeting a CSS selector "A1". The token `A1` doesn't match the `e\d+` ref pattern, so it would be classified as a CSS selector.
**Why it happens:** The `classifyTarget` function only recognizes `e\d+` as refs; everything else is treated as a CSS selector.
**How to avoid:** The disambiguation must check: if `type` has exactly 1 positional token and that token is a quoted string, treat it as text. If it's an unquoted token matching `e\d+` or starting with `#`/`.`/`[`, treat it as a ref/selector. Otherwise, treat as text.
**Warning signs:** Parse errors like "Missing required argument: text for command: type".

### Pitfall 3: Stuck Recovery Trim May Remove System Prompt
**What goes wrong:** If conversation history has fewer than 3 entries, the trim logic may incorrectly slice.
**Why it happens:** Edge case when stuck occurs on iteration 1 or 2.
**How to avoid:** Guard the trim: only apply when `conversationHistory.length > 3`. If length is 3 or less, skip trim entirely (not enough history to cause problems).

### Pitfall 4: Google Sheets iframes
**What goes wrong:** Google Sheets may embed content in iframes (e.g., chart editors, template gallery). `document.activeElement` in the main frame won't find focused elements inside iframes.
**Why it happens:** Cross-origin iframe isolation.
**How to avoid:** For Phase 21, scope to main frame only. The Name Box, formula bar, and grid are all in the main frame. Iframe-based interactions (charts, sidebars) are edge cases for future phases.

### Pitfall 5: Compact Snapshot Rebuild Resets All Refs
**What goes wrong:** Each call to `generateCompactSnapshot` calls `refMap.reset()`, which clears all existing refs. If the AI references an old ref (e.g., "click e5") and the DOM has changed, e5 now maps to a different element.
**Why it happens:** Refs are regenerated from scratch each iteration by design.
**How to avoid:** This is actually correct behavior -- refs SHOULD be regenerated. The key is ensuring the AI always gets a fresh snapshot before acting. The fix is to never use stale compact snapshots.

## Code Examples

### Fix 1: Make `type` ref-optional in CLI parser
```javascript
// ai/cli-parser.js line 157
// BEFORE:
type: { tool: 'type', args: [{ name: 'ref', type: 'ref' }, { name: 'text', type: 'string' }] },

// AFTER:
type: { tool: 'type', args: [{ name: 'ref', type: 'ref', optional: true }, { name: 'text', type: 'string' }] },
```

### Fix 2: Disambiguation in mapCommand for ref-optional `type`
```javascript
// In mapCommand(), after positional argument assignment, add:
if (def.tool === 'type' && params.text === undefined && (params.ref || params.selector)) {
  // Only one positional token was provided and it was consumed as ref.
  // If it doesn't look like a real ref/selector, treat it as text.
  const target = params.ref || params.selector;
  const looksLikeRef = /^e\d+$/i.test(target);
  const looksLikeSelector = /^[#.\[]/.test(target) || target.includes(' ');
  if (!looksLikeRef && !looksLikeSelector) {
    // This is actually the text argument, not a ref
    params.text = target;
    delete params.ref;
    delete params.selector;
  }
}
```

### Fix 3: Focused-element fallback for pressEnter and type
```javascript
// content/messaging.js, after ref resolution block (~L828), before tool dispatch:
if (FSB.tools[tool]) {
  // Ref-less action fallback: target focused element
  if (!params.selector && !params.ref) {
    const focused = document.activeElement;
    if (focused && focused !== document.body && focused !== document.documentElement) {
      const sels = FSB.generateSelectors(focused);
      const cssSel = sels.find(s => typeof s === 'string' ? !s.startsWith('//') : !s.selector?.startsWith('//'));
      params.selector = typeof cssSel === 'string' ? cssSel : (cssSel?.selector || '');
      if (params.selector) FSB.elementCache.set(params.selector, focused);
    } else {
      sendResponse({ success: false, error: 'No element focused. Click an element first, then retry.' });
      return;
    }
  }
  // ... existing tool dispatch
}
```

### Fix 4: Stuck recovery trim instead of reset
```javascript
// ai-integration.js ~L1854-1860
// BEFORE:
if (context?.isStuck && this.conversationHistory.length > 0) {
    this.conversationHistory = [];
}

// AFTER:
if (context?.isStuck && this.conversationHistory.length > 3) {
    const systemMsg = this.conversationHistory[0];
    const recentExchanges = this.conversationHistory.slice(-4);
    this.conversationHistory = [systemMsg, ...recentExchanges];
    // Inject format reminder into the next prompt
    this._injectFormatReminder = true;
}
```

### Fix 5: Action cap for Sheets in prompt
```javascript
// ai-integration.js, in buildPrompt or buildContinuationPrompt, when Sheets detected:
if (/docs\.google\.com\/spreadsheets/i.test(context?.currentUrl)) {
    userPrompt += '\n\nSHEETS RULE: Output at most 8 CLI commands per response. The grid is canvas-based -- you MUST wait for DOM updates between each navigation+type cycle.';
}
```

### Fix 6: Snapshot format guard
```javascript
// ai-integration.js, in buildProgressUpdate (~L871) and buildContinuationPrompt (~L2997):
// BEFORE: falls through to formatElements if _compactSnapshot missing
// AFTER: always use compact format, regenerate if missing
if (!domState._compactSnapshot && domState.elements?.length > 0) {
    automationLogger.warn('Compact snapshot missing, legacy format suppressed', {
        sessionId: this.currentSessionId,
        elementCount: domState.elements?.length
    });
    // Construct minimal compact-style lines from available element data
    const compactLines = (domState.elements || []).slice(0, 40).map((el, i) => {
        const ref = `e${i + 1}`;
        return `[${ref}] ${el.type || 'unknown'} "${(el.text || el.id || '').substring(0, 60)}"`;
    });
    domState._compactSnapshot = compactLines.join('\n');
    domState._compactElementCount = compactLines.length;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON tool calls | CLI commands | Phase 15-18 (Feb 2026) | ~40% token reduction, model-agnostic |
| Full element IDs | Compact refs (e1, e2) | Phase 16 (Feb 2026) | Further token reduction, cleaner AI output |
| Full conversation reset on stuck | Full reset (current, broken) | Pre-Phase 21 | Causes format regression -- this phase fixes it |

## Open Questions

1. **When exactly does `_compactSnapshot` become null/empty on Sheets?**
   - What we know: `includeCompactSnapshot: true` is always sent. `generateCompactSnapshot` runs in content script.
   - What's unclear: Whether Sheets-specific DOM (canvas, Google widgets) causes the function to throw or return empty.
   - Recommendation: Add try-catch logging around `generateCompactSnapshot` in `content/messaging.js:749` to capture the failure mode. This is a Phase 21 task.

2. **Should action cap be enforced in parser or at execution time?**
   - What we know: `MAX_BATCH_SIZE = 8` already caps execution. But the AI still generates excess commands, wasting tokens.
   - What's unclear: Whether parser-level truncation is safe (dropping later commands may break a sequence).
   - Recommendation: Enforce in BOTH places. Prompt instructs "max 8 commands". Parser truncates at 10 (safety margin). Executor caps at 8.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (Chrome extension) |
| Config file | None -- no automated test framework |
| Quick run command | Load extension, open Google Sheets, run a data entry task |
| Full suite command | CLI Validation page (options.html#validation) with golden tests |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P21-01 | Compact refs preserved across iterations 2+ | manual | Open Sheets, run 3+ iteration task, inspect logs for ref format | N/A |
| P21-02 | `type "data"` without ref targets focused element | manual | In Sheets, navigate to cell via Name Box, then `type "test"` | N/A |
| P21-03 | `enter` with no ref presses Enter on focused element | manual | In Sheets, type cell value then `enter` to confirm | N/A |
| P21-04 | Stuck recovery preserves conversation context | manual | Force stuck (repeat same action 3x), check AI still outputs CLI | N/A |
| P21-05 | Action count capped for Sheets | manual | Run Sheets task, verify AI outputs <= 8 commands per response | N/A |

### Sampling Rate
- **Per task commit:** Manual smoke test on Google Sheets
- **Per wave merge:** Full manual Sheets workflow (create sheet, enter headers, enter 3 rows of data)
- **Phase gate:** Sheets data entry task completes without stuck loops or format regression

### Wave 0 Gaps
- No automated test infrastructure exists for this browser extension
- Manual testing against live Google Sheets is the only validation path
- The CLI Validation golden tests (Phase 19) can verify parser changes but not content script behavior

## Sources

### Primary (HIGH confidence)
- `ai/cli-parser.js` lines 150-168 -- COMMAND_REGISTRY schema for type and enter
- `ai/ai-integration.js` lines 871-882 -- snapshot format branching
- `ai/ai-integration.js` lines 1854-1860 -- stuck conversation reset
- `content/actions.js` lines 2543-2557 -- pressEnter selector resolution
- `content/messaging.js` lines 806-828 -- ref resolution pipeline
- `content/messaging.js` lines 747-754 -- compact snapshot generation
- `background.js` lines 6052-6099 -- batch size cap and Sheets suppression
- `site-guides/productivity/google-sheets.js` -- full site guide (256 lines)

### Secondary (MEDIUM confidence)
- Session log analysis cited in CONTEXT.md -- failure modes observed in real execution

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all changes to existing well-understood code
- Architecture: HIGH - all five bugs have verified root causes with clear fix paths
- Pitfalls: HIGH - edge cases are well-documented from session log analysis and code inspection

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable codebase, no external dependency changes expected)
