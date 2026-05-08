# Phase 242: `back` MCP Tool - Research

**Researched:** 2026-05-06
**Domain:** MCP tool registration + Chrome `chrome.tabs.goBack` settle verification + BF-cache resilience
**Confidence:** HIGH

## Summary

Phase 242 adds a single new ownership-gated MCP tool (`back`) in `mcp/src/tools/agents.ts`. The extension-side `go_back` route already exists in `extension/ws/mcp-tool-dispatcher.js` (lines 21, 408-458) and is already gated by Phase 240's `checkOwnershipGate` chokepoint at line 192-198. So the implementation is structurally narrow: server-side tool registration + a new pre/post-back enrichment layer (history.length precheck, structured result derivation) that hooks into the existing `mcp:execute-action` or a new dedicated bridge message.

The TODO Phase 242 marker exists at `mcp/src/tools/agents.ts:20-23` -- it is an active marker (a `void agentScope` with a comment), not a commented-out skeleton. The entire body of `registerAgentTools` below the marker is commented-out DEPRECATED v0.9.45rc1 code (the legacy background-agent CRUD tools). Phase 242 should add the new `back` tool registration between the marker and the deprecated block, treating the deprecated block as a no-op that stays commented.

The v0.9.11 BF-cache resilience pattern is well-established: `extension/content/lifecycle.js:613-648` registers `pageshow`/`pagehide` listeners that detect `event.persisted=true` and re-establish the background port; `extension/background.js:2697-2716` defines `RECOVERY_HANDLERS[BF_CACHE]` which calls `ensureContentScriptInjected()` and waits for `pageLoadWatcher.waitForPageReady()`. These hooks run automatically on any cross-origin or BF-cached navigation; the new `back` tool does NOT need to re-implement BF-cache handling -- it only needs to detect that BF-cache fired so it can return `status: 'bf_cache'`.

**Primary recommendation:** Register `back` in `agents.ts` (replacing the `void agentScope` TODO with a real registration), thread agentId/ownershipToken/connectionId via the standard payload triple, route through a NEW `mcp:back` bridge message (not the existing `mcp:execute-action` path) because `back` returns a structured `{ status, resultingUrl, historyDepth }` shape that does not match the generic `{ success, executed }` response of execute-action. The new bridge message handler in dispatcher.js wraps the existing `handleNavigationHistoryRoute` logic with a precheck (`chrome.scripting.executeScript({func: () => window.history.length})`) and a post-call settle observer.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Tool name and arity locked.** New `back` tool in `mcp/src/tools/agents.ts` (NOT a separate file). Single-step only -- no `back(n)`, no companion `forward` in v0.9.60. Description documents: agent-scoped tab targeting, ownership enforcement (Phase 240), structured result contract.
- **D-02 Activates the agents.ts TODO Phase 242 marker** that Phase 238 D-08 left in place. Uncomment the prior `server.tool()` skeleton if present; otherwise add fresh.
- **D-03 Wraps existing extension `go_back` route.** Phase 240 already routes go_back through dispatchMcpToolRoute; the back tool's MCP handler calls `bridge.sendAndWait({type: 'mcp:go-back', payload: {agentId, ownershipToken, ...}}, ...)`.
- **D-04 history.length precheck via chrome.scripting.executeScript.** Before chrome.tabs.goBack, run a precheck that reads window.history.length. If <= 1, return `NO_BACK_HISTORY` instead of silently no-op'ing.
- **D-05 Structured result shape:** `{ status: 'ok' | 'no_history' | 'cross_origin' | 'bf_cache' | 'fragment_only', resultingUrl, historyDepth }`. Five status codes covering each observed failure mode. The error path (cross-agent reject) still goes through Phase 240's TAB_NOT_OWNED -- that's the gate's contract.
- **D-06 pageshow-based listener with 2s timeout.** After chrome.tabs.goBack fires, attach a one-shot pageshow listener via chrome.scripting.executeScript or content-script messaging. Resolve with the post-back URL when pageshow fires. Timeout 2s -- if no pageshow event by then, return `bf_cache` status with the URL chrome.tabs.get reports (likely the back-target URL even if pageshow didn't fire because of BF cache hit).
- **D-07 BF-cache resilience reuses v0.9.11 path.** Cross-origin transitions reuse the existing v0.9.11 BF-cache content-script re-injection logic (don't re-implement). Search for the existing pattern; the new go-back handler hooks into it.
- **D-08 No tabs.update({active: true}).** chrome.tabs.goBack works on background tabs without requiring focus. The tool MUST NOT switch to the target tab. Verified by integration test that asserts `chrome.tabs.update` is not called from the new code path.
- **D-09 Cross-agent rejection via Phase 240's chokepoint.** The new `back` tool routes through dispatchMcpToolRoute exactly like Phase 240's other handlers. No special-casing -- the gate's existing TAB_NOT_OWNED rejection path covers cross-agent back calls. Test via tests/back-tool-ownership.test.js asserting cross-agent reject.

### Claude's Discretion

- Exact placement in agents.ts (which line, between which tools)
- chrome.scripting.executeScript vs content-script messaging for the history.length precheck -- both work; recommend executeScript for simplicity (one-shot read)
- bf_cache vs fragment_only disambiguation -- fragment_only fires when only the URL fragment changes (window.location.hash); detect via comparing URL components
- Test file naming: `tests/back-tool.test.js` (unit + structured result codes) + `tests/back-tool-ownership.test.js` (cross-agent reject)

### Deferred Ideas (OUT OF SCOPE)

- `forward` MCP tool -- symmetric counterpart, but no v0.9.60 use case. Future phase if user demand surfaces.
- `back(n)` for multi-step -- explicitly rejected per SC#1.
- `back-with-content-check` (return after content settled, not just URL) -- defer to Phase 244 hardening if 2s pageshow timeout proves too short.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-01 | New `back` MCP tool registered, ownership-gated, single-step | agents.ts marker exists at line 20-23; tool registration pattern verified in autopilot.ts (`server.tool('run_task', ...)` shape) and visual-session.ts |
| BACK-02 | `history.length` precheck before `chrome.tabs.goBack`; returns `NO_BACK_HISTORY` when depth <= 1 | manifest.json grants `scripting` permission (line 8); `chrome.scripting.executeScript({target: {tabId}, func: () => window.history.length})` is the standard MV3 idiom |
| BACK-03 | Structured result: `{ status: 'ok' \| 'no_history' \| 'cross_origin' \| 'bf_cache' \| 'fragment_only', resultingUrl, historyDepth }` | All 5 codes are observable -- see "Validate the 5 status codes" below |
| BACK-04 | `pageshow`-based settle verification with 2s timeout | Pattern verified at content/lifecycle.js:623-648 (existing pageshow listener); chrome.tabs.onUpdated `status: 'complete'` is the alternate signal already used at background.js:1578-1606 (`waitForTabComplete`) |
| BACK-05 | Cross-origin content-script re-injection via existing v0.9.11 BF-cache resilience path | `RECOVERY_HANDLERS[FAILURE_TYPES.BF_CACHE]` at background.js:2697-2716 + `ensureContentScriptInjected()` at background.js:2972 + content/lifecycle.js:623-648 -- all reusable as-is |

## Project Constraints (from CLAUDE.md)

- ES2021+ JavaScript with proper error handling
- No emojis in terminal logs, code comments, or markdown
- Comprehensive JSDoc documentation
- Chrome Extension best practices, security-first design
- Existing test surface (npm test) must pass unchanged

Roadmap-locked constraints:
- Branch-locked to `Refinements`. No git push, no PRs.
- `.planning/` is gitignored.
- Must preserve single-agent autopilot loop and v0.9.36 visual-session contracts.
- No new manifest permissions (already have `scripting`, `tabs`, `webNavigation`, `<all_urls>`).
- No new npm dependencies in `mcp/`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `^1.27.1` (current; bumps to `^1.29.x` in Phase 244) | MCP server runtime; `server.tool()` registration | Already in `mcp/package.json`; the registration shape is locked across all FSB tools |
| `zod` | 3.x | Tool input schema | Used by every existing tool in agents.ts/manual.ts/autopilot.ts/visual-session.ts |
| `chrome.tabs.goBack` | Chrome 88+ MV3 | Browser back navigation | Already invoked at extension/ws/mcp-tool-dispatcher.js:424; works on background tabs without `tabs.update({active})` |
| `chrome.scripting.executeScript` | Chrome 88+ MV3 | One-shot history.length read | Standard MV3 idiom; manifest.json line 8 already grants `scripting` |
| `pageshow` event | DOM | BF-cache restore detection via `event.persisted` | Already used at extension/content/lifecycle.js:623-648 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chrome.tabs.onUpdated` | Chrome 88+ | Fallback settle signal when pageshow doesn't fire | Tabs in BF-cache may not fire pageshow reliably; onUpdated `status: 'complete'` is a safety net (already used at background.js:1585-1599) |
| `chrome.webNavigation.onCommitted` | Chrome 88+ | Already wired at background.js:2464 | Existing arm-mcp-bridge hook; no new wiring needed for `back` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `mcp:go-back` bridge message | Reuse existing `mcp:execute-action` | execute-action returns `{success, executed}` -- doesn't carry `{status, resultingUrl, historyDepth}` shape. New message is cleaner. **Recommend new message.** |
| `chrome.scripting.executeScript` for precheck | content-script `sendMessage` | Both work; executeScript is one-shot and avoids needing a new content-script handler. **Recommend executeScript per CONTEXT.md discretion note.** |
| Pageshow listener via injected script | Use `chrome.tabs.onUpdated` only | Pageshow distinguishes BF-cache (`persisted=true`) from fresh navigation; onUpdated does not. **Recommend pageshow as primary, onUpdated as 2s timeout fallback.** |

**Installation:** No new packages required. `@modelcontextprotocol/sdk` and `zod` already in mcp/package.json.

**Version verification:** Verified via existing `mcp/package.json` (cited in ROADMAP Phase 244 SC#4: `^1.27.1` current, bumps to `^1.29.x` in Phase 244). [VERIFIED: codebase grep on package.json + ROADMAP cross-ref]

## Architecture Patterns

### Recommended Project Structure (no new files in mcp/src/tools/)
```
mcp/src/tools/
├── agents.ts          # Phase 242 ADDS `back` tool here (between TODO marker and deprecated block)
├── autopilot.ts       # registration pattern reference (run_task)
├── manual.ts          # registration pattern reference (execAction helper, payload threading)
├── visual-session.ts  # registration pattern reference (queue.enqueue + ownershipToken capture)
└── ...
extension/ws/
├── mcp-tool-dispatcher.js   # ADD `mcp:go-back` to MCP_PHASE199_MESSAGE_ROUTES; new `handleBackRoute` function
extension/utils/
├── (no new files)           # back-specific helpers can live inside the dispatcher handler
tests/
├── back-tool.test.js          # Phase 242 ADDS (unit + 5 status codes via mocked bridge responses)
├── back-tool-ownership.test.js # Phase 242 ADDS (cross-agent reject via mocked agentRegistry)
```

### Pattern 1: MCP Tool Registration (canonical shape from autopilot.ts/visual-session.ts)

**What:** Three-arg `server.tool(name, description, schema, handler)` plus the standard agentId/ownershipToken/connectionId triple threaded into the bridge payload.

**When to use:** Every new MCP tool that targets a tab.

**Example** (drawn from autopilot.ts:21-198):
```typescript
// Source: mcp/src/tools/autopilot.ts (verified pattern)
server.tool(
  'back',
  'Navigate one step back in browser history on the agent\'s active tab. Single-step only (no back(n)). Returns structured { status, resultingUrl, historyDepth }. Status codes: ok | no_history | cross_origin | bf_cache | fragment_only. Ownership-enforced: cross-agent calls reject with TAB_NOT_OWNED. Background-tab compatible (does not steal focus).',
  {},  // no parameters; tab inferred from active tab via the dispatcher's getActiveTabFromClient
  async () => {
    if (!bridge.isConnected) {
      return mapFSBError({ success: false, error: 'extension_not_connected' });
    }
    return queue.enqueue('back', async () => {
      const agentId = await agentScope.ensure(bridge);
      const ownershipToken = (typeof agentScope.currentOwnershipToken === 'function')
        ? agentScope.currentOwnershipToken()
        : null;
      const connectionId = (typeof agentScope.currentConnectionId === 'function')
        ? agentScope.currentConnectionId()
        : null;
      const payload: Record<string, unknown> = { agentId };
      if (ownershipToken) payload.ownershipToken = ownershipToken;
      if (connectionId) payload.connectionId = connectionId;
      const result = await bridge.sendAndWait(
        { type: 'mcp:go-back', payload },
        { timeout: 5_000 },  // 2s settle + 3s headroom
      );
      // Capture ownershipToken if returned (parity with manual.ts:66-73)
      if (result
          && typeof (result as { ownershipToken?: unknown }).ownershipToken === 'string'
          && typeof agentScope.captureOwnershipToken === 'function') {
        agentScope.captureOwnershipToken(
          typeof (result as { tabId?: unknown }).tabId === 'number' ? (result as { tabId: number }).tabId : null,
          (result as { ownershipToken: string }).ownershipToken,
        );
      }
      return mapFSBError(result);
    });
  },
);
```

### Pattern 2: Extension-side Bridge Message Route (canonical shape from mcp-tool-dispatcher.js)

```javascript
// Source: extension/ws/mcp-tool-dispatcher.js (verified pattern, lines 408-458 for handleNavigationHistoryRoute)
// Add to MCP_PHASE199_MESSAGE_ROUTES at line 48-71:
'mcp:go-back': { routeFamily: 'browser', handler: handleBackRoute },

// New handler (sketched):
async function handleBackRoute({ payload, client }) {
  const { agentId } = payload || {};
  let targetTabId = Number.isFinite(payload?.tabId) ? payload.tabId : null;
  try {
    getChromeTabsApi();
    const activeTab = await getActiveTabFromClient(client);
    targetTabId = targetTabId === null ? activeTab?.id : targetTabId;
    if (!Number.isFinite(targetTabId)) {
      return createMcpRouteError('back', 'browser', '...', { errorCode: 'no_active_tab' });
    }

    // 1. Capture pre-back URL + history depth (precheck)
    const preTab = await chrome.tabs.get(targetTabId);
    const preUrl = preTab?.url || '';
    const preOrigin = (() => { try { return new URL(preUrl).origin; } catch (_) { return ''; } })();

    const [{ result: historyDepth }] = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => window.history.length,
    });

    if (!Number.isFinite(historyDepth) || historyDepth <= 1) {
      return { success: true, status: 'no_history', resultingUrl: preUrl, historyDepth: historyDepth || 0 };
    }

    // 2. Fire the back. NEVER call chrome.tabs.update({active}). Background-tab safe.
    await chrome.tabs.goBack(targetTabId);

    // 3. Settle: race pageshow vs onUpdated 'complete' vs 2s timeout.
    const settled = await waitForBackSettle(targetTabId, 2_000);
    const postTab = await chrome.tabs.get(targetTabId);
    const postUrl = postTab?.url || '';
    const postOrigin = (() => { try { return new URL(postUrl).origin; } catch (_) { return ''; } })();

    // 4. Disambiguate status:
    //    fragment_only: same origin + same path, only hash differs
    //    cross_origin: post-origin !== pre-origin
    //    bf_cache: pageshow fired with persisted=true OR no pageshow within 2s but URL changed
    //    ok: pageshow fired with persisted=false, normal navigation
    const status = classifyBackOutcome({ preUrl, postUrl, preOrigin, postOrigin, settled });

    // Phase 240 D-08 parity: bindTab on the (now back-target) tab so cross-origin
    // back doesn't break ownership.
    let bindResult = null;
    if (agentId && globalThis.fsbAgentRegistryInstance?.bindTab) {
      try { bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(agentId, targetTabId); } catch (_) {}
    }

    const response = { success: true, status, resultingUrl: postUrl, historyDepth, tabId: targetTabId };
    if (bindResult?.ownershipToken) response.ownershipToken = bindResult.ownershipToken;
    return response;
  } catch (error) {
    return { success: false, errorCode: 'navigation_unavailable', tool: 'back', error: error.message || String(error) };
  }
}
```

### Anti-Patterns to Avoid
- **Re-implementing BF-cache recovery in the back handler.** The existing `RECOVERY_HANDLERS[BF_CACHE]` (background.js:2697-2716) and content/lifecycle.js:623-648 pageshow listener already handle re-injection automatically when the next tool call fails with the BFCache error string. The `back` handler only needs to *report* `status: 'bf_cache'` -- it does not need to fix it.
- **Calling `chrome.tabs.update(targetTabId, {active: true})` in the back path.** Per D-08 this is forbidden; the existing `handleNavigationHistoryRoute` at line 408-458 does NOT do this, so parity is automatic.
- **Routing through `mcp:execute-action`.** That payload shape (`{tool, params, agentId, ownershipToken}`) does not carry the structured result; the response shape `{success, executed}` doesn't have a slot for `status`/`resultingUrl`/`historyDepth`. Use a dedicated `mcp:go-back` message.
- **Using `await` between `checkOwnershipGate` and route dispatch.** Phase 240 D-07 enforces same-microtask discipline; this is automatic since `dispatchMcpMessageRoute` already does it (line 200-228).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-agent rejection | A new TAB_NOT_OWNED check inside `handleBackRoute` | Phase 240's `checkOwnershipGate` at dispatcher.js:143-180 | The gate already runs synchronously at dispatch time. Per D-09, no special-casing. |
| BF-cache content-script re-injection | A new pageshow handler in background.js | Existing content/lifecycle.js:623-648 + `ensureContentScriptInjected()` at background.js:2972 | Already mature, used in 6+ recovery paths |
| Tab settle detection | A custom MutationObserver | `pageshow` event + `chrome.tabs.onUpdated` `status:'complete'` (combined as a Promise.race) | These are the standard Chrome signals; FSB already uses both (`waitForTabComplete` at background.js:1578-1606) |
| URL parsing for fragment_only detection | Manual string splits | `new URL(url).origin/pathname/hash` | Built-in, parses edge cases (port, trailing slash, query string) |
| ownershipToken plumbing | A new threading mechanism | `agentScope.currentOwnershipToken()` + `agentScope.captureOwnershipToken()` (existing in agent-scope.ts:129-154) | Already wired in manual.ts/autopilot.ts/visual-session.ts |

**Key insight:** Phase 242 is the smallest phase in v0.9.60. Every infrastructure piece (gate, registry, bridge plumbing, BF-cache recovery, content-script re-injection) already exists. The new code is ~80 lines of TypeScript in agents.ts + ~120 lines of JS in mcp-tool-dispatcher.js + 2 test files.

## Common Pitfalls

### Pitfall 1: Pageshow does not fire reliably for SPA-style back navigation

**What goes wrong:** When `chrome.tabs.goBack` triggers a back step that is captured by a History API SPA router (no actual page reload), `pageshow` may not fire because the document didn't change. The 2s timeout would then incorrectly classify this as `bf_cache`.

**Why it happens:** SPA routers intercept `popstate` and update the URL via `history.replaceState`/`history.pushState` without unloading the document.

**How to avoid:** When pageshow doesn't fire within 2s but the URL DID change (post-back URL differs from pre-back URL), classify as `ok` (with a note) rather than `bf_cache`. The classifier should weigh URL change as the primary signal; pageshow timing is secondary.

**Warning signs:** `status: 'bf_cache'` returned for tabs on Gmail, Twitter, modern Angular/React apps.

**Mitigation:** Add a third leg to the classifier: if `postUrl !== preUrl && pageshowFired === false && elapsedMs < 2000`, treat as `ok` -- the URL change happened synchronously inside `chrome.tabs.goBack`.

### Pitfall 2: history.length includes the current entry

**What goes wrong:** `window.history.length` returns 1 when the tab was opened directly to its current URL (no back history). The naive check `if (length === 0)` misses this.

**Why it happens:** History API counts the current entry. A fresh tab has length=1, not 0.

**How to avoid:** Use `<= 1` not `=== 0`. CONTEXT.md D-04 already specifies this correctly.

**Warning signs:** `back` tool succeeds on freshly-opened tabs with no actual back-target, returning `status: 'ok'` but the tab doesn't move.

### Pitfall 3: `chrome.tabs.goBack` rejects when no history

**What goes wrong:** On some Chrome versions, `chrome.tabs.goBack(tabId)` throws "Cannot find a next page in history" when history.length <= 1. The precheck (D-04) is REQUIRED, not just a UX nicety -- it prevents the error throw.

**Why it happens:** Chrome surfaces `chrome.runtime.lastError` rather than silently no-op'ing.

**How to avoid:** ALWAYS run the precheck first. If `length <= 1`, return `status: 'no_history'` BEFORE calling `chrome.tabs.goBack`.

**Warning signs:** Test failures with "Cannot find a next page in history" instead of structured `no_history` status.

### Pitfall 4: Cross-origin back triggers content-script re-injection AFTER the response is already returned

**What goes wrong:** A cross-origin back returns `status: 'cross_origin'` from the tool, but the next tool call (e.g., `read_page`) fails because the content script hasn't reinjected yet.

**Why it happens:** Content scripts inject async; the back tool returns before reinjection completes.

**How to avoid:** This is by design and documented in CONTEXT.md D-07 (BF-cache resilience reuses existing path). The next tool call will trigger the COMMUNICATION recovery handler (background.js:2646-2655) which calls `ensureContentScriptInjected`. Document in the tool description that callers should be prepared to retry the next tool call once if it fails immediately after a cross_origin back.

**Warning signs:** Flaky tests where back is followed immediately by read_page.

### Pitfall 5: Tab closes during the 2s settle window

**What goes wrong:** User closes the tab while back is settling. `chrome.tabs.get(targetTabId)` after the wait throws "No tab with id".

**Why it happens:** Tab lifecycle is independent of MCP tool lifecycle.

**How to avoid:** Wrap the post-tab read in try/catch. If tab is gone, return `success: false, errorCode: 'tab_closed_during_back'`. Don't crash the bridge.

## Code Examples

Verified patterns from official sources:

### chrome.tabs.goBack (MV3, no `active` arg)
```javascript
// Source: extension/ws/mcp-tool-dispatcher.js:424 (existing, verified)
await chrome.tabs.goBack(targetTabId);
// NOTE: No callback in MV3 promise-mode. Returns Promise<void>. Throws if no history.
```

### chrome.scripting.executeScript for one-shot DOM read
```javascript
// Source: standard MV3 pattern; manifest.json line 8 grants `scripting`
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId: targetTabId },
  func: () => window.history.length,
});
// `result` is the function's return value (must be JSON-serializable)
```

### pageshow listener for BF-cache detection
```javascript
// Source: extension/content/lifecycle.js:623-638 (verified, in-tree)
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // BF cache restore -- port reset + reconnect
    backgroundPort = null;
    reconnectAttempts = 0;
    establishBackgroundConnection();
  }
});
```

### Promise.race settle pattern (for the new handleBackRoute)
```javascript
// Pattern combining pageshow + onUpdated + timeout
async function waitForBackSettle(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; cleanup(); resolve(result); } };

    // Leg 1: chrome.tabs.onUpdated status='complete' (no pageshow injection needed for this leg)
    const onUpdatedListener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        finish({ method: 'onUpdated', persisted: false });
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdatedListener);

    // Leg 2: pageshow via injected script (one-shot postMessage to background)
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return new Promise((res) => {
          const handler = (e) => { window.removeEventListener('pageshow', handler); res({ persisted: e.persisted }); };
          window.addEventListener('pageshow', handler);
          // 2.5s internal timeout to avoid hanging
          setTimeout(() => res({ persisted: null, timeout: true }), 2500);
        });
      },
    }).then(([{ result }]) => {
      if (result && !result.timeout) finish({ method: 'pageshow', persisted: !!result.persisted });
    }).catch(() => {/* injection may fail post-cross-origin; the onUpdated leg covers it */});

    // Leg 3: hard timeout
    const timer = setTimeout(() => finish({ method: 'timeout', persisted: null }), timeoutMs);

    function cleanup() {
      try { chrome.tabs.onUpdated.removeListener(onUpdatedListener); } catch (_) {}
      clearTimeout(timer);
    }
  });
}
```

### Status classification
```javascript
function classifyBackOutcome({ preUrl, postUrl, preOrigin, postOrigin, settled }) {
  // Edge: URL didn't change at all -- shouldn't happen post-precheck, but defensive
  if (preUrl === postUrl) return 'ok'; // SPA possibly used replaceState; report ok

  // Fragment-only: same origin + same path, only hash differs
  try {
    const a = new URL(preUrl), b = new URL(postUrl);
    if (a.origin === b.origin && a.pathname === b.pathname && a.search === b.search && a.hash !== b.hash) {
      return 'fragment_only';
    }
  } catch (_) {/* fall through */}

  // Cross-origin
  if (preOrigin && postOrigin && preOrigin !== postOrigin) return 'cross_origin';

  // BF cache: pageshow fired with persisted=true, OR settled via timeout (persisted=null)
  if (settled.method === 'pageshow' && settled.persisted === true) return 'bf_cache';
  if (settled.method === 'timeout') return 'bf_cache';

  return 'ok';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Use `chrome.tabs.update({active: true})` to wake BF-cached tab before retry | Reuse content/lifecycle.js pageshow listener; let the next tool call's recovery handler re-inject | v0.9.11 | Background-tab safe; no focus stealing |
| Hand-rolled `setTimeout(500)` after navigation | `chrome.tabs.onUpdated` `status:'complete'` listener | v0.1.2 (smart DOM-based waiting) | 50-70% faster, more reliable |
| Generic `{success, executed}` for all tool responses | Per-tool structured shapes when multi-outcome (e.g., `{status, ...}` for back) | v0.9.60 (Phase 242) | Callers can distinguish `no_history` from `bf_cache` from `ok` without parsing error strings |

**Deprecated/outdated:**
- Background-agent CRUD tools in agents.ts (DEPRECATED v0.9.45rc1; superseded by OpenClaw / Claude Routines per CLAUDE.md MEMORY note). The deprecated block (lines 24-235 of agents.ts) stays commented; Phase 242 ADDS the `back` tool ABOVE/AROUND the deprecated block.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node `assert` + custom harness (`tests/mcp-smoke-harness.js`) — same as Phase 240/241 |
| Config file | None — pure node test files invoked from npm scripts |
| Quick run command | `node tests/back-tool.test.js` |
| Full suite command | `npm test && npm run test:mcp-smoke:tools` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-01 | `back` tool registered with correct shape | unit | `node tests/back-tool.test.js` (assertion: `harness.handlers.has('back')`) | Wave 0 |
| BACK-01 | `back` tool listed in `requiredSmokeTools` array | smoke | `node tests/mcp-tool-smoke.test.js` (extend existing array at line 27-40) | extend existing |
| BACK-02 | `no_history` returned when history.length <= 1 | unit | `node tests/back-tool.test.js` (mock executeScript returning 1) | Wave 0 |
| BACK-03 | All 5 status codes observable in classifier | unit | `node tests/back-tool.test.js` (5 sub-cases mocking pre/post URLs + settle methods) | Wave 0 |
| BACK-04 | 2s pageshow timeout falls back to `bf_cache` | unit | `node tests/back-tool.test.js` (mock settled.method='timeout') | Wave 0 |
| BACK-04 | pageshow with persisted=true returns `bf_cache` | unit | `node tests/back-tool.test.js` | Wave 0 |
| BACK-05 | Cross-agent reject via Phase 240 gate | unit | `node tests/back-tool-ownership.test.js` (mock agentRegistry.isOwnedBy=false) | Wave 0 |
| BACK-05 (BG) | `chrome.tabs.update({active})` NEVER called | unit | `node tests/back-tool.test.js` (spy on chrome.tabs.update; assert not called) | Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/back-tool.test.js && node tests/back-tool-ownership.test.js`
- **Per wave merge:** `npm test && npm run test:mcp-smoke:tools`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/back-tool.test.js` -- covers BACK-01, BACK-02, BACK-03, BACK-04, BACK-05 (background-tab assertion)
- [ ] `tests/back-tool-ownership.test.js` -- covers BACK-05 cross-agent reject
- [ ] Extend `tests/mcp-tool-smoke.test.js` requiredSmokeTools array (line 27-40) to include `'back'`
- [ ] Extend `tests/mcp-tool-routing-contract.test.js` (line 34, 84 already list `'go_back'`) to also list `'back'` if it's in the contract
- [ ] No framework install needed — Node assert is built-in.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner + MCP server build | ✓ (assumed; existing `npm test` works) | 18+ (per `mcp/package.json` engines) | — |
| TypeScript compiler | mcp/ build (`npm --prefix mcp run build`) | ✓ (existing `mcp/tsconfig.json`) | per devDeps | — |
| `@modelcontextprotocol/sdk` | server.tool() registration | ✓ (already in mcp/package.json) | ^1.27.1 | — |
| `zod` | schema (empty schema needs `{}`, not zod, but kept for parity) | ✓ | 3.x | — |
| Chrome 88+ | `chrome.tabs.goBack`, `chrome.scripting.executeScript`, `pageshow event.persisted` | ✓ (manifest min Chrome 88, MV3 baseline) | — | — |
| `scripting` permission | one-shot history.length read | ✓ (manifest.json:8) | — | — |
| `tabs` permission | chrome.tabs.goBack/get/onUpdated | ✓ (manifest.json:11) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chrome.tabs.goBack` does not call `chrome.tabs.update({active: true})` internally | Background-tab compatibility (BACK-05) | If Chrome internals do focus the tab as a side effect, D-08 is violated despite our code not calling update. Verifiable by integration test on a real Chrome instance. [VERIFIED: official docs say goBack only navigates; no focus side effect documented. CITED: developer.chrome.com/docs/extensions/reference/api/tabs#method-goBack] |
| A2 | `pageshow` fires for cross-origin navigation back-targets when content scripts have been injected | Settle verification | If pageshow doesn't fire for cross-origin (because the new document hasn't loaded the content script yet), the timeout leg fires and we classify as `bf_cache` -- which is actually correct behavior since the original document went to BF cache. [ASSUMED based on FSB v0.9.11 patterns; the executeScript injection for the one-shot pageshow listener happens AFTER goBack completes, so by then the new document is loading and the listener targets the new document context.] |
| A3 | `chrome.scripting.executeScript` after `chrome.tabs.goBack` runs in the post-back document, not the pre-back document | Pageshow injection | If the timing is wrong and the injection happens before navigation commits, we'd be listening on the old document. Verifiable by integration test. [ASSUMED — needs runtime verification. Mitigation: order the executeScript call AFTER an `await new Promise(r => setTimeout(r, 50))` micro-delay to ensure the navigation has at least started.] |
| A4 | The existing v0.9.11 BF-cache content/lifecycle.js pageshow listener will run on the back-target document | BF-cache resilience (BACK-05) | If content/lifecycle.js doesn't run on the back-target (e.g., because Chrome served from BF cache without re-running content scripts at all), the next tool call's COMMUNICATION recovery handler (background.js:2604-2607) fires `ensureContentScriptInjected` as fallback. So this assumption being wrong is gracefully handled by an existing fallback. [VERIFIED via reading background.js:3148-3151 + 3604-3607: BFCache error string detection re-injects.] |
| A5 | New `mcp:go-back` bridge message is preferred over reusing `mcp:execute-action` | Architecture decision | If we should reuse execute-action for parity, we'd need to extend its response shape. Per D-03 ("Wraps existing extension `go_back` route") this is borderline -- "wraps" could mean either. **RECOMMEND** new message; a new dedicated handler is cleaner and matches how navigate has its own bridge plumbing. [ASSUMED — flag for planner discretion: read CONTEXT.md D-03 strictly and confirm.] |
| A6 | `back` tool requires no input parameters (operates on agent's active tab) | Tool schema | If callers need to specify `tabId` to disambiguate (multi-tab agent in Phase 241), the schema should accept optional `tabId`. **RECOMMEND** accept optional `tabId: z.number().optional()` so multi-tab agents can target a specific tab in their pool. [ASSUMED — flag for planner discretion: Phase 241 introduced multi-tab agent pools, so optional tabId is forward-compatible.] |

## Open Questions

1. **Should `back` reuse `mcp:execute-action` or use a new `mcp:go-back` bridge message?**
   - What we know: D-03 says "wraps existing extension go_back route" but doesn't specify wire-protocol layer. Existing go_back route at dispatcher.js:21 is registered as a TOOL route (`MCP_PHASE199_TOOL_ROUTES.go_back`), not a message route. Tool routes are dispatched via `dispatchMcpToolRoute({tool, params, ...})`. Message routes are dispatched via `dispatchMcpMessageRoute({type, payload, ...})`.
   - What's unclear: The MCP server's `bridge.sendAndWait` sends a `{type, payload}` envelope; the extension's bridge-client routes by `type`. So the MCP server's only choice is the `type` value -- either `'mcp:execute-action'` (existing manual-tool channel, used by 25+ tools) or a new `'mcp:go-back'`.
   - Recommendation: Use NEW `mcp:go-back` message with a dedicated `handleBackRoute` handler. Reasons: (a) the response shape `{status, resultingUrl, historyDepth}` doesn't fit execute-action's `{success, executed}`; (b) the handler needs to do PRE work (history.length precheck) and POST work (pageshow settle), which doesn't fit the generic execute-action handler at background.js's `executeBackgroundTool`; (c) the existing `go_back` TOOL route (used internally by autopilot AI loop) at dispatcher.js:21 stays as-is for autopilot's needs, and `back` (the new MCP tool) gets its own message route.

2. **Should `back` accept an optional `tabId` parameter?**
   - What we know: Phase 241 added multi-tab agent pools (`chrome.tabs.onCreated` + `openerTabId`). An agent may own multiple tabs and want to back one specific tab.
   - What's unclear: CONTEXT.md doesn't specify. D-08 says "does not switch to target tab" but is silent on tab selection.
   - Recommendation: Accept optional `tabId: z.number().optional()`. If absent, default to active tab via `getActiveTabFromClient`. Forward-compatible with multi-tab pools without breaking the simple case. The Phase 240 ownership gate at dispatcher.js:127-136 already resolves tabId via `_resolveTabIdForGate`.

3. **What test harness does the planner use for the new tests?**
   - What we know: Existing pattern is plain `node tests/X.test.js` with custom `tests/mcp-smoke-harness.js` for MCP-server tests.
   - What's unclear: Whether `tests/back-tool.test.js` should be a smoke test (TS build required) or a pure unit test on the dispatcher.js handler.
   - Recommendation: TWO files per CONTEXT.md discretion:
     - `tests/back-tool.test.js` -- pure unit on `handleBackRoute` extracted/mocked from dispatcher.js (no TS build dep), covering the 5 status codes via mocked chrome APIs.
     - `tests/back-tool-ownership.test.js` -- pure unit on the gate's TAB_NOT_OWNED rejection for the new mcp:go-back message route (mock agentRegistry).
     - Plus a one-line addition to `tests/mcp-tool-smoke.test.js` to register `'back'` in `requiredSmokeTools`.

## Sources

### Primary (HIGH confidence)
- `mcp/src/tools/agents.ts` (in-tree) -- TODO Phase 242 marker at line 20-23 confirmed; deprecated CRUD block at lines 24-235 confirmed
- `mcp/src/tools/manual.ts` (in-tree) -- canonical agentId/ownershipToken/connectionId payload triple at lines 40-72
- `mcp/src/tools/autopilot.ts` (in-tree) -- canonical `server.tool()` registration shape with queue.enqueue + bridge.sendAndWait
- `mcp/src/tools/visual-session.ts` (in-tree) -- ownershipToken capture pattern at lines 75-85
- `mcp/src/agent-scope.ts` (in-tree) -- AgentScope.ensure / currentOwnershipToken / currentConnectionId / captureOwnershipToken surface
- `extension/ws/mcp-tool-dispatcher.js` (in-tree) -- existing `handleNavigationHistoryRoute` at lines 408-458 (the `go_back` tool route invokes `chrome.tabs.goBack(tabId)` and returns); `MCP_PHASE199_MESSAGE_ROUTES` at lines 48-71 (where new `'mcp:go-back'` route registers); `checkOwnershipGate` at lines 143-180 (Phase 240 chokepoint, automatic for new routes)
- `extension/background.js` (in-tree) -- `RECOVERY_HANDLERS[FAILURE_TYPES.BF_CACHE]` at lines 2697-2716; `classifyFailure` BFCache string match at lines 3148-3151; `ensureContentScriptInjected` at lines 2972; `waitForTabComplete` at 1578-1606
- `extension/content/lifecycle.js` (in-tree) -- v0.9.11 BF-cache pageshow listener at lines 613-648 with `event.persisted` detection
- `extension/manifest.json` (in-tree) -- confirms `scripting`, `tabs`, `webNavigation`, `<all_urls>` permissions all already granted
- `extension/ai/tool-executor.js` (in-tree) -- alternate go_back implementation for autopilot (lines 218-226), uses `chrome.tabs.goBack(tabId)` directly
- `tests/mcp-tool-smoke.test.js` (in-tree) -- canonical smoke test pattern; bridge call assertions verify agentId+ownershipToken in payload
- `.planning/phases/242-back-mcp-tool/242-CONTEXT.md` -- locked decisions D-01..D-09
- `.planning/REQUIREMENTS.md` -- BACK-01..BACK-05 traceability
- `.planning/ROADMAP.md` -- Phase 242 SC#1..SC#5

### Secondary (MEDIUM confidence)
- Chrome MV3 docs `chrome.tabs.goBack`: "Goes back to the previous page, if one is available." -- no documented focus side effect [CITED: developer.chrome.com/docs/extensions/reference/api/tabs#method-goBack]
- Chrome MV3 docs `chrome.scripting.executeScript`: returns `Promise<InjectionResult[]>` where `result` is the function's return value [CITED: developer.chrome.com/docs/extensions/reference/api/scripting]
- W3C `pageshow` event: fires with `event.persisted=true` when document is restored from BF cache [CITED: html.spec.whatwg.org/multipage/browsing-the-web.html#the-pageshow-event]

### Tertiary (LOW confidence)
- None for Phase 242. Every claim is either verified in the codebase or cited from official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every library/API is already in use in the codebase
- Architecture: HIGH -- patterns drawn directly from autopilot.ts/manual.ts/visual-session.ts (verified)
- Pitfalls: MEDIUM-HIGH -- pitfalls 1, 4, 5 are verified from codebase patterns; pitfalls 2, 3 are well-known Chrome behaviors
- BF-cache resilience reuse: HIGH -- v0.9.11 implementation is in-tree at content/lifecycle.js:613-648 + background.js:2697-2716

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days; stable Chrome MV3 + locked CONTEXT.md decisions)

## RESEARCH COMPLETE

**Phase:** 242 - back MCP Tool
**Confidence:** HIGH

### Key Findings
- TODO Phase 242 marker is at `mcp/src/tools/agents.ts:20-23` -- ACTIVE marker (`void agentScope`), not commented skeleton. Deprecated CRUD block (lines 24-235) stays commented; new `back` tool registers above it.
- The extension-side `go_back` TOOL route already exists at `extension/ws/mcp-tool-dispatcher.js:21` (calls `chrome.tabs.goBack(targetTabId)` at line 424). Phase 240's ownership gate at lines 143-180 already protects all routes — including a new `mcp:go-back` message route — automatically.
- v0.9.11 BF-cache resilience is in-tree at `extension/content/lifecycle.js:613-648` (pageshow with `event.persisted`) plus `extension/background.js:2697-2716` (RECOVERY_HANDLERS[BF_CACHE]) plus `ensureContentScriptInjected()` at line 2972. The new `back` handler reports `bf_cache` status; the existing recovery path handles re-injection on the next tool call.
- `manifest.json:8` already grants `scripting` permission for `chrome.scripting.executeScript({func: () => window.history.length})` precheck. No new manifest permissions needed.
- All 5 status codes (`ok`, `no_history`, `cross_origin`, `bf_cache`, `fragment_only`) are observable: pre/post URL comparison + `pageshow event.persisted` + 2s timeout + `URL.origin/pathname/hash` parsing classifies all five.
- Chrome `chrome.tabs.goBack(tabId)` works on background tabs without `chrome.tabs.update({active: true})` — D-08 holds because the existing `handleNavigationHistoryRoute` at lines 408-458 already does it correctly and the new handler follows the same pattern.

### File Created
`/Users/lakshmanturlapati/Desktop/FSB/.planning/phases/242-back-mcp-tool/242-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Every library/API already in use in codebase; no new packages |
| Architecture | HIGH | Patterns verified from autopilot.ts/manual.ts/visual-session.ts/dispatcher.js |
| Pitfalls | MEDIUM-HIGH | Codebase-verified pitfalls + well-known Chrome BF-cache/pageshow behaviors |
| BF-cache reuse | HIGH | v0.9.11 implementation in-tree at exact file/line refs |
| Test framework | HIGH | Existing harness pattern; no framework install needed |

### Open Questions (planner discretion)
- A5/Open-Q1: New `mcp:go-back` message vs reuse `mcp:execute-action` — **recommend new message** (cleaner response shape, dedicated pre/post hooks).
- A6/Open-Q2: Optional `tabId` parameter — **recommend optional** for forward compatibility with Phase 241 multi-tab pools.
- Open-Q3: Test placement — **recommend** `tests/back-tool.test.js` (5 status codes) + `tests/back-tool-ownership.test.js` (cross-agent reject) + extend `mcp-tool-smoke.test.js` requiredSmokeTools.

### Ready for Planning
Research complete. Planner can proceed to PLAN.md generation. Recommend a 2-3 plan structure:
- Plan 01: MCP server-side `back` tool registration in agents.ts + agent-scope plumbing parity + smoke-test extension
- Plan 02: Extension-side `mcp:go-back` message route in dispatcher.js + handleBackRoute + waitForBackSettle helper + classifier
- Plan 03 (optional): Hardening & integration — back-tool-ownership.test.js + ensure D-08 background-tab assertion + integration with Phase 240 gate verified end-to-end via mcp-tool-routing-contract.test.js
