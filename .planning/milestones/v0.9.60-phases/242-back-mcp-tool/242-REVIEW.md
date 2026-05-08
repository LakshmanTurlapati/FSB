---
phase: 242-back-mcp-tool
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - mcp/src/tools/agents.ts
  - mcp/src/types.ts
  - extension/ws/mcp-tool-dispatcher.js
  - tests/back-tool.test.js
  - tests/back-tool-ownership.test.js
  - tests/mcp-tool-routing-contract.test.js
  - tests/mcp-tool-smoke.test.js
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 242: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 242 introduces a new `back` MCP tool with a server-side `server.tool('back', ...)` registration in `agents.ts` and an extension-side `mcp:go-back` route backed by `handleBackRoute`, `waitForBackSettle`, and `classifyBackOutcome`. The implementation is generally careful and well-documented:

- Same-microtask ownership-gate discipline preserved (synchronous `checkOwnershipGate` call before any `await` or chrome API touch).
- Background-tab invariant honored (no `chrome.tabs.update` calls anywhere in the new code path).
- The `finished` guard in `waitForBackSettle` correctly prevents double-resolve across the three race legs.
- `executeScript` failures on chrome:// / about: pages are intentionally swallowed and fall through to the `no_history` fail-closed branch (precheck) or to the timeout leg (settle).
- The pageshow listener self-removes via `{ once: true }` plus an explicit `removeEventListener` in both the handler and the inner-timeout cleanup — no leak.
- The `onUpdated` listener is removed in `cleanup()` regardless of which leg wins.

Two warnings are raised below: a security gap when `payload.tabId` is omitted (active-tab resolution skips ownership verification), and a settle-race that can mis-classify a same-origin BF-cache restoration as `ok` when the outer 2s timeout pre-empts the injected `pageshow` listener. Five informational items cover JSDoc accuracy, error-shape consistency, and a possible defensive guard.

## Warnings

### WR-01: Active-tab resolution path skips ownership verification

**File:** `extension/ws/mcp-tool-dispatcher.js:687-701`
**Issue:** When `payload.tabId` is omitted, `_resolveTabIdForGate` (line 131) returns `null` and `checkOwnershipGate` (line 161) explicitly skips the tab-ownership arm — only the agent-registration check runs. `handleBackRoute` then resolves the active tab via `getActiveTabFromClient(client)` at line 690, but it does NOT re-invoke the ownership gate against the newly resolved tab id. The handler proceeds to call `chrome.tabs.goBack(targetTabId)` at line 757 on whatever tab the resolver returned.

This is the same shape of gap noted in the comment at lines 137-140 ("the handler's own bindTab call (D-08) is the backstop"), but `bindTab` only fires on success AFTER `goBack` has already executed (line 800). A registered-but-non-owning agent can therefore drive history-back on the user's currently active tab without ever owning it.

The phase-context invariants explicitly call out cross-agent reject as load-bearing; the test suite (`back-tool-ownership.test.js` Test 4 lines 221-241) exercises the active-tab path with a registry where the calling agent IS the owner of the resolved tab, so the gap is not surfaced by the existing tests.

**Fix:** Re-invoke `checkOwnershipGate` after the active-tab is resolved, before calling `chrome.tabs.goBack`. The gate is sync and cheap; threading the resolved tabId through a fresh payload object preserves the existing contract. Example:

```javascript
if (targetTabId === null) {
  // ... existing active-tab resolution ...
  targetTabId = activeTab.id;
  // Re-gate now that the tab is concrete (active-tab path was unverifiable
  // at the dispatcher entry).
  const recheck = checkOwnershipGate({
    tool: 'back',
    params: {},
    payload: { ...payload, tabId: targetTabId }
  });
  if (recheck) return recheck;
}
```

Add a regression test in `back-tool-ownership.test.js` that calls `mcp:go-back` with NO `payload.tabId`, where `chrome.tabs.query` returns a tab owned by a DIFFERENT agent, and asserts `code === 'TAB_NOT_OWNED'` plus zero `chrome.tabs.goBack` invocations.

### WR-02: Settle race can misclassify BF-cache restoration as `ok`

**File:** `extension/ws/mcp-tool-dispatcher.js:531-567, 603-633`
**Issue:** The pageshow injection at line 537 (`inject()`) is fire-and-forget — `chrome.scripting.executeScript` is called AFTER `chrome.tabs.goBack(targetTabId)` returns at line 757. There is a real (though small) window where the BF-cache restoration's `pageshow` event fires in the page BEFORE `executeScript` lands the listener, in which case Leg 2 never sees `event.persisted = true`.

When that happens with a same-origin URL change, `classifyBackOutcome` falls through to the default branch and returns `'ok'` (line 633) instead of `'bf_cache'`. The Pitfall-1 carve-out at line 629 only catches the timeout-with-no-URL-change subset, not timeout-with-URL-change-but-actually-BF-cache.

This is a classification accuracy issue, not a security or correctness bug — the navigation completes correctly and the resultingUrl is reported faithfully. But callers relying on the `bf_cache` discriminator to make decisions (e.g. snapshot invalidation) may occasionally get a stale `'ok'` and act on cached state.

**Fix:** Two options:
1. (Cheap) Document the limitation in the JSDoc for `classifyBackOutcome` so callers know `'ok'` is best-effort and may shadow a missed BF-cache event.
2. (Correct) Inject the pageshow listener BEFORE calling `chrome.tabs.goBack` rather than after. The listener can be set up in the page first, then the back call fired, then the race awaited. This requires reordering `handleBackRoute` step 5 with the start of step 6's leg-2 setup, but eliminates the window.

Option 2 is the durable fix; option 1 is acceptable if the team accepts the inaccuracy and surfaces it in tooling.

## Info

### IN-01: `classifyBackOutcome` JSDoc return-type omits `'no_history'`

**File:** `extension/ws/mcp-tool-dispatcher.js:601`
**Issue:** The JSDoc `@returns` is correct that this helper returns one of 4 codes (since `no_history` is decided in the precheck before this helper is called), but the function-level comment at line 473-474 lists 5 status codes for the overall API, and a reader could expect this helper to cover all 5. Add a one-line note to the JSDoc clarifying that `'no_history'` is decided upstream by `handleBackRoute` step 4.

**Fix:**
```javascript
/**
 * ...
 * Note: 'no_history' is decided upstream by handleBackRoute's history.length
 * precheck (step 4); this helper only classifies the post-goBack settle.
 *
 * @returns {'ok'|'cross_origin'|'bf_cache'|'fragment_only'}
 */
```

### IN-02: `prechecked ? historyDepth : 1` reports synthetic depth on injection failure

**File:** `extension/ws/mcp-tool-dispatcher.js:747`
**Issue:** When `chrome.scripting.executeScript` fails (chrome://, devtools, restricted contexts), the response surfaces `historyDepth: 1` to mark the no_history outcome. This is a fail-closed convenience but a slight semantic stretch — the actual history depth is unknown, not 1. Consumers comparing `historyDepth` to the `resultingUrl` to debug "why did this say no_history?" may be confused.

**Fix:** Consider surfacing `historyDepth: null` (or omitting the field) when `prechecked === false`, and let the `status: 'no_history'` discriminator carry the meaning alone. Alternatively, add a sibling field like `historyPrecheckable: false` to disambiguate.

### IN-03: `Number.isFinite(payload.tabId)` accepts non-positive tabIds

**File:** `extension/ws/mcp-tool-dispatcher.js:677`
**Issue:** The agents.ts Zod schema (line 25) constrains `tabId` to `z.number().int().positive()`, but `handleBackRoute` only checks `Number.isFinite(payload.tabId)`. If a non-MCP caller (or future bridge route) sends `tabId: 0` or `tabId: -1`, the handler accepts it and forwards to `chrome.tabs.get(0)` which will error out into the `tab_unavailable` branch. Not a security issue (chrome.tabs.get rejects), but the error is slightly misleading.

**Fix:** Tighten to `Number.isFinite(payload.tabId) && payload.tabId > 0` or use `Number.isInteger(payload.tabId) && payload.tabId > 0` to match the Zod contract.

### IN-04: Inner pageshow timeout swallows the `timeout: true` signal silently

**File:** `extension/ws/mcp-tool-dispatcher.js:547-558`
**Issue:** The injected script resolves with `{ method: 'pageshow', persisted: null, timeout: true }` on inner timeout, but the outer code at line 556 only acts when `inner.timeout !== true`. The outer 2s timeout (Leg 3) is responsible for the final resolution, which is correct, but the injected page's promise stays pending for ~500ms after the outer Promise has already resolved. Not a leak (the page eventually resolves and the result is dropped), but worth a comment.

**Fix:** Add a brief comment near line 558 documenting that on inner timeout, the outer `Promise.race`'s timeout leg is the authoritative resolution path.

### IN-05: `executeScript` precheck does not pass `injectImmediately`

**File:** `extension/ws/mcp-tool-dispatcher.js:725-728`
**Issue:** The history-length precheck via `chrome.scripting.executeScript` does not specify `injectImmediately: true`. On slow-loading pages this can race with the page's own initialization scripts. Since the precheck reads `window.history.length` (a synchronous, always-available property), this is benign — but other parts of the codebase using executeScript may already use `injectImmediately`; consider matching style for consistency.

**Fix:** Audit other `executeScript` call sites in `extension/ws/mcp-tool-dispatcher.js` (e.g. via `Grep`) and align the option passing if the rest of the codebase uses `injectImmediately: true`. If not, this is a no-op style note.

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
