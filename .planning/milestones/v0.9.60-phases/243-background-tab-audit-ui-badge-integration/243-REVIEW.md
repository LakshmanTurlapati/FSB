---
phase: 243-background-tab-audit-ui-badge-integration
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - extension/ai/tool-definitions.js
  - extension/ai/tool-executor.js
  - extension/ws/mcp-tool-dispatcher.js
  - extension/utils/agent-registry.js
  - extension/utils/agent-nav-emission.js
  - extension/utils/overlay-state.js
  - extension/content/visual-feedback.js
  - extension/content/badge-combine.js
  - extension/ui/control_panel.html
  - extension/ui/options.js
  - extension/ui/owner-chip.js
  - extension/ui/cap-counter-helpers.js
  - extension/ui/popup.js
  - extension/ui/sidepanel.js
  - extension/ui/popup.html
  - extension/ui/sidepanel.html
  - extension/background.js
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 243: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 243 introduces four integration deltas: (BG-02) per-tool `_forceForeground` flag with `switch_tab` as the sole opt-in; (BG-04) a `webNavigation.onCommitted` LOG-04 emission with a 500ms agent-nav suppression window; (UI-01) overlay badge `clientLabel / agentIdShort`; (UI-02) read-only "owned by ..." popup/sidepanel chip; (UI-03) options-page cap counter with `legacy:*` filter and inline validation.

The pure helpers (`agent-nav-emission.js`, `badge-combine.js`, `owner-chip.js`, `cap-counter-helpers.js`) are correct, clean, and well-tested. The `_forceForeground` gate on both autopilot (`tool-executor.js`) and MCP (`mcp-tool-dispatcher.js`) routes is implemented per spec. Test coverage is solid (foreground-audit, agent-tab-user-navigation, badge-agent-id, owner-chip, cap-counter-live).

The most serious finding is a missing `stampAgentNavigation` call site set: the registry helper at `agent-registry.js:920-936` enumerates SIX concrete sites that MUST stamp, but only TWO sites (both inside `handleStartAutomation`) actually call it. Every MCP-driven `navigate`, `go_back`, `go_forward`, `refresh`, and `back` will trigger the BG-04 false-positive emission the suppression window was designed to prevent. The owner chip in the persistent sidepanel also misses storage-onChanged updates, so cross-agent ownership churn while the same tab stays active will render stale data.

## Critical Issues

### CR-01: BG-04 500ms suppression stamp is missing at FIVE of SEVEN navigation call sites

**File:** `extension/ws/mcp-tool-dispatcher.js:386` (handleNavigateRoute), `:429` (go_back), `:431` (go_forward), `:433` (reload), `:784` (handleBackRoute goBack); also `extension/ai/tool-executor.js:207, 219, 229, 239`

**Issue:** The Phase 243 BG-04 design depends on every agent-initiated navigation calling `registry.stampAgentNavigation(targetTabId)` BEFORE the chrome.tabs API call so the `webNavigation.onCommitted` listener can suppress its `agent-tab-user-navigation` emission within a 500ms window. The registry docstring at `extension/utils/agent-registry.js:920-936` enumerates the seven required call sites:

> Callers: any code path that invokes chrome.tabs.update({url}) or
> chrome.tabs.goBack on an agent-owned tab MUST call this helper BEFORE
> the chrome API call. Concrete sites:
>   - extension/background.js handleStartAutomation smart-tab navigation
>   - extension/ws/mcp-tool-dispatcher.js handleNavigateRoute
>   - extension/ws/mcp-tool-dispatcher.js handleNavigationHistoryRoute
>   - extension/ws/mcp-tool-dispatcher.js handleBackRoute
>   - extension/ai/tool-executor.js navigate / go_back autopilot path

A `Grep` for `stampAgentNavigation` across the entire `extension/` tree (excluding the registry itself) returns ONLY two matches, both at `background.js:6414, 6422` (handleStartAutomation). Five of seven required sites are unstamped:

1. `mcp-tool-dispatcher.js:386` — `chrome.tabs.update(targetTabId, { url: params.url })` in `handleNavigateRoute`. The `link` and `typed` transitionTypes both fall in `USER_INITIATED_TRANSITIONS`, so every MCP `navigate` will now emit `agent-tab-user-navigation` against the agent's own commit.
2. `mcp-tool-dispatcher.js:429` — `chrome.tabs.goBack(targetTabId)` in `handleNavigationHistoryRoute`. Phase 242 documented the `auto_bookmark` transitionType problem; without the stamp, every `go_back` re-triggers the very false positive the 500ms guard was built to swallow.
3. `mcp-tool-dispatcher.js:431` — `chrome.tabs.goForward(targetTabId)` (same handler).
4. `mcp-tool-dispatcher.js:433` — `chrome.tabs.reload(targetTabId)`. `reload` is in `USER_INITIATED_TRANSITIONS`.
5. `mcp-tool-dispatcher.js:784` — `chrome.tabs.goBack(targetTabId)` in `handleBackRoute` (Phase 242 single-step back). The registry docstring explicitly mentions "Phase 242 `back` produces transitionType auto_bookmark which falls inside USER_INITIATED_TRANSITIONS"; this is the canonical false-positive vector.
6. `tool-executor.js:207, 219, 229, 239` — autopilot navigate / go_back / go_forward / refresh. Same problem on the autopilot dispatch path.

Impact: every agent-initiated navigation pollutes the LOG-04 ring with `agent-tab-user-navigation` events that look like genuine user interruptions. Downstream consumers (UI overlays, dashboards, audit pipelines) will see false pause signals on every tool call.

**Fix:** Stamp before each chrome.tabs.* call. The pattern from `background.js:6414` is the template. Example for `handleNavigateRoute`:

```javascript
// extension/ws/mcp-tool-dispatcher.js:385-386
const targetTabId = Number.isFinite(params.tabId) ? params.tabId : activeTab.id;
// Phase 243 BG-04: stamp BEFORE the chrome.tabs.update so webNavigation
// suppresses the resulting commit within the 500ms window.
try {
  if (globalThis.fsbAgentRegistryInstance
      && typeof globalThis.fsbAgentRegistryInstance.stampAgentNavigation === 'function') {
    globalThis.fsbAgentRegistryInstance.stampAgentNavigation(targetTabId);
  }
} catch (_e) { /* best-effort */ }
const updatedTab = await chrome.tabs.update(targetTabId, { url: params.url });
```

Apply the same three-line stamp ahead of `chrome.tabs.goBack`, `goForward`, and `reload` at lines 429/431/433 (handleNavigationHistoryRoute), `chrome.tabs.goBack` at line 784 (handleBackRoute), and the four chrome.tabs.* calls in `tool-executor.js` at lines 207, 219, 229, 239. Recommend factoring into a small helper (e.g., `_stampNavIfPossible(tabId)`) since the pattern repeats.

## Warnings

### WR-01: Sidepanel owner chip does not refresh when ownership changes on the same tab

**File:** `extension/ui/sidepanel.js:222-280`

**Issue:** The sidepanel's `refreshOwnerChip` is invoked on (a) `DOMContentLoaded` and (b) `chrome.tabs.onActivated`. The persistent sidepanel correctly handles tab switches, but it does NOT subscribe to `chrome.storage.onChanged` for the `session.fsbAgentRegistry` envelope. If the user stays on the same active tab while an MCP agent claims, releases, or transfers ownership, the chip continues to render the snapshot it captured at the last activation. This produces a stale display the user cannot resolve except by switching tabs and back.

The existing `chrome.storage.onChanged` listener at `sidepanel.js:216-220` only filters for `local/showSidepanelProgress`. Adding a second branch for `area === 'session' && changes.fsbAgentRegistry` would close the gap.

**Fix:**
```javascript
// extension/ui/sidepanel.js:216-220 (extend existing listener)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.showSidepanelProgress != null) {
    showSidepanelProgressEnabled = changes.showSidepanelProgress.newValue ?? false;
  }
  // Phase 243 plan 03 (UI-02) follow-up: refresh chip when registry mutates
  // for the active tab (ownership claimed/released/transferred).
  if (area === 'session' && changes && changes.fsbAgentRegistry) {
    refreshOwnerChip();
  }
});
```

The popup is short-lived and explicitly excluded from this ("popup is short-lived and skips this" comment at line 229), so popup.js does not need the same change.

### WR-02: Multiple chrome.storage.onChanged listeners installed by AgentRegistry instances

**File:** `extension/utils/agent-registry.js:848-864`

**Issue:** `_subscribeToCapChanges` is called from the `AgentRegistry` constructor (line 262). Every instance registers its OWN `chrome.storage.onChanged` listener. In the MV3 service worker today there is exactly one instance (`globalThis.fsbAgentRegistryInstance`), so this is benign in production. But:

1. There is no guard against re-registration across SW restarts. After every SW wake, a fresh `AgentRegistry` is constructed and a fresh listener is attached. Chrome reuses the same listener registry, so over many wake cycles the SW memory accumulates listener references. Chrome eventually GCs the SW process, masking the leak — but during long-running multi-agent sessions the per-listener invocation count grows unbounded (each storage event fires N+1 callbacks).
2. Tests that construct multiple registries (`new AgentRegistry()` in a loop, common in re-runs) will register N listeners, all of which mutate `_cachedCap` on the SAME shared cache because the listener captures `self`. The latest-constructed instance will leak its `self` capture into all earlier listeners' callbacks.

The race the prompt asked about (cross-context onChanged) is real: the SW writes via `setCap`, fires the listener, and the listener writes back to `_cachedCap` — that path is safe (the comment at line 845 notes "read-only listener (does NOT write back) so no cross-context loop is possible"), but the listener leak across SW wakes is not addressed.

**Fix:** Either (a) hoist `_subscribeToCapChanges` to module-scope so a single listener exists for the lifetime of the SW classloader, or (b) detect re-attachment via a module-scope flag:

```javascript
// extension/utils/agent-registry.js
var _capListenerAttached = false;
AgentRegistry.prototype._subscribeToCapChanges = function() {
  if (_capListenerAttached) return;
  // ... existing logic
  _capListenerAttached = true;
};
```

### WR-03: agent-nav-emission boundary at exactly 500ms is documented two ways

**File:** `extension/utils/agent-nav-emission.js:70-80`

**Issue:** The code uses `elapsed <= AGENT_NAV_SUPPRESSION_MS` to suppress, meaning a 500ms-old stamp DOES suppress. The docstring above says:

> Pitfall 2: 500ms suppression. (now - lastAgentNav) must be STRICTLY
> greater than 500 to emit; equal-or-less suppresses.

That's consistent. But the registry docstring at `agent-registry.js:898-908` and the BG-04 design notes refer to the window as "500ms" without specifying inclusive/exclusive boundary. The test at `agent-tab-user-navigation.test.js:243-269` codifies "exactly 500ms suppresses, 501ms emits" — matching the implementation. Not a bug, but the inconsistent wording (`> 500` vs `<= 500`) across documentation invites future edits to flip the boundary. Recommend pinning the boundary into the registry docstring too:

> 500ms suppression window (boundary INCLUSIVE: `now - stamp <= 500` suppresses).

### WR-04: getTabMetadata may surface partial metadata after stampAgentNavigation on an unbound tab

**File:** `extension/utils/agent-registry.js:938-954`

**Issue:** `stampAgentNavigation` auto-creates a metadata bucket (`if (!meta) { meta = {}; this._tabMetadata.set(id, meta); }`) when no entry exists. The bucket is then populated only with `lastAgentNavigationAt`. A subsequent `getTabMetadata(tabId)` returns:

```javascript
{
  ownershipToken: undefined,   // missing
  incognito: undefined,         // missing -- normalized to undefined, NOT false
  windowId: undefined,          // missing
  boundAt: undefined,           // missing
  forced: false,                // explicit false (=== check on undefined)
  lastAgentNavigationAt: <ts>
}
```

The dispatch gate (`isOwnedBy`) at line 554-560 would fail correctly (`_tabOwners.get(tabId) !== agentId` since the tab was never bound), so token-based ownership checks are still safe. But code paths that call `getTabMetadata` and assume `incognito` is a boolean (e.g. dispatch gate's incognito branch at unknown call site) would receive `undefined` and could mis-interpret. The Phase 240 D-04 design assumed metadata buckets are populated only via `bindTab`. Stamping breaks that assumption.

The user-facing impact today appears low (the only consumer of `lastAgentNavigationAt` is the BG-04 helper, which gracefully falls back to 0). But the auto-creation pattern is a latent foot-gun.

**Fix:** Either (a) document explicitly that `stampAgentNavigation` may produce partial metadata buckets and consumers MUST tolerate undefined fields, or (b) skip the stamp entirely when no bucket exists yet (a tab that has never been bound cannot be the target of an agent-driven navigation in normal flow). Option (b) is safer:

```javascript
AgentRegistry.prototype.stampAgentNavigation = function(tabId) {
  var id = (typeof tabId === 'number') ? tabId : Number(tabId);
  if (!Number.isFinite(id)) return;
  var meta = this._tabMetadata.get(id);
  if (!meta) return; // unbound tab cannot have agent-initiated navigation
  meta.lastAgentNavigationAt = Date.now();
  // ... persist
};
```

Note: this conflicts with the test at `agent-tab-user-navigation.test.js:50-61` which stamps an unbound tab and asserts the metadata is created. If the registry contract is "stamps create buckets," the test is correct and the docstring should be updated to surface the partial-bucket gotcha to gate callers.

## Info

### IN-01: Owner chip uses fragile heuristic for legacy:* surface detection

**File:** `extension/ui/owner-chip.js:65-73`

**Issue:** `ownerLabelFor` uses `ownerAgentId.indexOf('legacy:') === 0` to decide whether to apply `formatAgentIdForDisplay`. `formatAgentIdForDisplay` itself returns `''` for non-`agent_` prefixes (registry line 186), so the literal-vs-format branch is technically defensive. However, callers that introduce a new prefix family (e.g. `mcp:` or `bg:`) in a future phase would silently fall through to the raw-id branch (`return ownerAgentId`). Recommend documenting the explicit allowlist in the function comment.

**Fix:** Add a comment:
```javascript
// Recognized prefix families: 'legacy:' (literal) and 'agent_' (formatted via SSOT).
// Any future prefix MUST be added to this branch explicitly.
```

### IN-02: Cap counter debounce uses module-scope mutable handle

**File:** `extension/ui/options.js:910-920`

**Issue:** `_capCounterDebounceHandle` lives at module scope (`let _capCounterDebounceHandle = null;`). The options page is short-lived per open, but if the user reopens the options panel without a full page reload (rare but possible), the previous handle would still be live. The 100ms timer is small enough that the leak is invisible in practice, but the pattern of stashing timers on module-scope `let` instead of inside a closure is brittle. Not a bug; just a code-quality nit.

**Fix:** Hide behind an IIFE-scoped factory or reset the handle on `loadSettings` boot.

### IN-03: control_panel.html embeds `legacy:*` filter rationale only as inline comment

**File:** `extension/ui/control_panel.html:441-444`

**Issue:** The HTML comment at line 441-443 says "Excludes legacy:* synthesized agents (Pitfall 1 per 243-RESEARCH.md)" — the filter logic actually lives in `cap-counter-helpers.js`. The HTML comment is the only on-page reminder; if a future contributor changes the filter without updating the helper, the HTML continues to claim the exclusion. Low risk because the helper is unit-tested (`cap-counter-live.test.js` lines 44-75 explicitly cover legacy:* exclusion).

**Fix:** Keep as-is; the test gate is sufficient. Optionally point the HTML comment at the helper file for findability.

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
