---
phase: 241-pooling-configurable-cap-reconnect-grace
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - extension/background.js
  - extension/ui/control_panel.html
  - extension/ui/options.js
  - extension/utils/agent-registry.js
  - extension/ws/mcp-bridge-client.js
  - extension/ws/mcp-tool-dispatcher.js
  - mcp/src/agent-scope.ts
  - mcp/src/tools/autopilot.ts
  - mcp/src/tools/manual.ts
  - mcp/src/tools/visual-session.ts
  - tests/agent-cap.test.js
  - tests/agent-cap-storage.test.js
  - tests/agent-cap-ui.test.js
  - tests/agent-grace.test.js
  - tests/agent-no-idle.test.js
  - tests/agent-pool-shrink.test.js
  - tests/agent-pooling.test.js
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 241: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 241 (pooling, configurable cap, reconnect grace) lands a coherent, well-instrumented implementation. The core invariants the phase commits to are honored:

- **Atomic cap-check + insert**: `registerAgent` does a synchronous `_agents.size >= cap` test and a synchronous `_agents.set(...)` insert, with the only `await` (`_persist()`) placed AFTER the insert. Combined with the module-scope `withRegistryLock` promise-chain mutex, this serializes 20 concurrent claims correctly (verified by `tests/agent-cap.test.js:41-71`).
- **No `chrome.alarms` for grace**: `agent-registry.js` and `mcp-bridge-client.js` use `setTimeout` exclusively for the 10s grace window. `chrome.alarms` only appears in the bridge's reconnect path (`MCP_RECONNECT_ALARM`), which is unrelated to the grace mechanism.
- **Three-layer cap clamping**: HTML (`min="1" max="64"`) + JS input handler clamp (`options.js:298-308`) + SW-side `_clampCap` on `setCap`/`getCap`/`_loadCapFromStorage`/`_subscribeToCapChanges`. The SW layer is authoritative — even a tampered storage value (`fsbAgentCap: 9999`) is clamped on read (`tests/agent-cap-storage.test.js` covers this).
- **LOG-04 categories**: All three constants (`agent-cap-reached`, `agent-grace-expired`, `agent-cap-lowered-grandfathered`) are defined and emitted at exactly the expected sites.
- **`agent-release-when-pool-empty`**: `releaseTab` correctly inlines the agent-record drop when `ownedTabs.size === 0`, avoiding a re-entrant `releaseAgent` call (which would deadlock the promise chain). Idempotency holds — the no-op early-return at `agent-registry.js:511-514` prevents double-release on tabId-reuse.
- **`chrome.tabs.onCreated.openerTabId` undefined-handling**: `background.js:2574` correctly uses `typeof tab.openerTabId !== 'number'` so Ctrl+T, address-bar, and programmatic `chrome.tabs.create({})` (no opener) tabs are intentionally left unowned.
- **No emoji slip-ups in new Phase 241 code**: All new code paths (registry, bridge, dispatcher, options.js cap card) are emoji-free per CLAUDE.md.

Two concerns worth addressing before close: a duplicate-stage timer-leak in `stageReleaseByConnectionId` (Warning), and the `saveSettings` write path not clamping the cap value before persisting (Warning, defense-in-depth gap that the SW layer ultimately covers but which violates the stated three-layer model at the write site).

## Warnings

### WR-01: `stageReleaseByConnectionId` leaks the prior timer if called twice for the same connectionId

**File:** `extension/utils/agent-registry.js:631-661`
**Issue:** `stageReleaseByConnectionId` overwrites `self._stagedReleases.set(connectionId, ...)` unconditionally. If a staged entry already exists for the same connectionId (no intervening `cancelStagedRelease`), the prior `timeoutId` is dropped on the floor and never `clearTimeout`-ed. The orphan timer will eventually fire and call `_fireStagedRelease(connectionId)`, which finds the *replacement* entry (with a different agentIds snapshot and earlier-than-intended deadline) and releases that snapshot prematurely.

In the normal bridge flow (`onclose` → stage, `onopen` → cancel), this cannot trigger because `cancelStagedRelease` runs before any second stage. However:
- A duplicated `_ws.onclose` event (some browsers fire `error` then `close`, and bridge code treats them as independent) could double-stage.
- Hydrate-time recovery (`_recoverStagedReleasesFromPayload`) schedules a fresh timer; if the bridge then immediately reconnects under a NEW connectionId, but somehow the same persisted connId gets re-staged via a hypothetical replay path, the recovery timer is leaked.
- A test or operator calling `stageReleaseByConnectionId` twice without cancel will hit this.

**Fix:** Clear an existing entry's timer before overwriting:
```javascript
return withRegistryLock(async function() {
  if (typeof connectionId !== 'string' || !connectionId) return false;
  // ... existing setup ...
  if (agentIds.length === 0) return false;

  // Clear any prior timer for this connectionId so we don't leak it.
  var prior = self._stagedReleases.get(connectionId);
  if (prior && prior.timeoutId) {
    try { clearTimeout(prior.timeoutId); } catch (_e) { /* swallow */ }
  }

  var deadline = Date.now() + ms;
  var timeoutId = setTimeout(function() {
    self._fireStagedRelease(connectionId).catch(function() {});
  }, ms);
  // ... rest unchanged ...
});
```

### WR-02: `saveSettings` writes `fsbAgentCap` to storage without range clamping

**File:** `extension/ui/options.js:878`
**Issue:** The save path uses `parseInt(elements.fsbAgentCap?.value, 10) || 8`, which only handles NaN. If the input element's value is somehow set to an out-of-range number (e.g., via DevTools `document.getElementById('fsbAgentCap').value = '9999'` then click Save, or a build that loads an older settings export with `fsbAgentCap: 9999`), the value 9999 is written verbatim to `chrome.storage.local`.

The SW-side defense (`_clampCap` on read in `getCap`, `_loadCapFromStorage`, and `_subscribeToCapChanges`) does ultimately keep the in-memory cap correct, so no operational impact. However, this violates the stated three-layer clamping model at the write site (the comment at `options.js:876-877` claims layer 2 is the input clamp and layer 3 is `setCap` — but the save path bypasses both). Also, anyone reading `chrome.storage.local.fsbAgentCap` directly (e.g., the dashboard remote-control surface, or settings export) would see the unclamped value.

**Fix:** Clamp at the write site for symmetry with the load path (`options.js:805-818`):
```javascript
// Phase 241 D-05 / POOL-05: Agent Concurrency cap. Defense-in-depth
// layer 2 (input clamp = layer 1; SW setCap on storage.onChanged = layer 3).
fsbAgentCap: (function() {
  var raw = parseInt(elements.fsbAgentCap?.value, 10);
  if (!Number.isFinite(raw)) return 8;
  if (raw < 1) return 1;
  if (raw > 64) return 64;
  return raw;
})()
```

## Info

### IN-01: `_recoverStagedReleasesFromPayload` schedules `setTimeout(..., 0)` for expired deadlines

**File:** `extension/utils/agent-registry.js:1108-1121`
**Issue:** When a persisted deadline has already passed during SW eviction, the recovery path schedules `setTimeout(fire, 0)` rather than firing synchronously. The comment at `agent-registry.js:1095-1097` correctly documents that synchronous fire would deadlock the lock chain (since `_fireStagedRelease` re-enters `withRegistryLock`), so the deferred fire is intentional. However, a 0ms timer in the MV3 SW context can race against a same-tick `cancelStagedRelease` from the bridge's `onopen` if the bridge reconnects concurrently with hydrate. Test 4 (`agent-grace.test.js:201-239`) waits 30ms before asserting — that suggests the timing is implicitly relied upon.

**Fix:** Consider documenting this race in the comment block (or, if it's a real concern, use `queueMicrotask` after the lock releases, which is more deterministic than `setTimeout(0)`). Low priority — current behavior is correct in the tested paths.

### IN-02: Pre-existing emoji `OpenClaw 🦀` in `mcp/src/tools/visual-session.ts:11`

**File:** `mcp/src/tools/visual-session.ts:11`
**Issue:** The `MCP_VISUAL_CLIENT_LABELS` array contains `'OpenClaw 🦀'` as an approved client label. Per CLAUDE.md "no emojis," this is a slip. NOT introduced by Phase 241 (pre-existing), but flagged because the phase context explicitly asks to verify "no emoji slip-ups." This is a string literal used for label matching at runtime, not a log line, so behavior is unaffected — but if the policy is strict, it should be normalized to `'OpenClaw'` (the array also contains a duplicate-without-emoji form on the same line).

**Fix:** Either remove the emoji entry (callers send the plain label and `normalizeMcpVisualClientLabel` strips whitespace), or keep it and document the carve-out in the file header.

### IN-03: `releaseTab` early-return does not clean up `_tabsByAgent` if `_tabOwners` is missing but `_tabsByAgent` has a stale entry

**File:** `extension/utils/agent-registry.js:511-514`
**Issue:** `releaseTab` early-returns `false` when `!self._tabOwners.has(tabId)`. If invariants are violated such that `_tabsByAgent[someAgent]` contains a tabId that is NOT in `_tabOwners` (e.g., a partial reap path), the stale Set entry is never cleaned. In current code, the only mutator paths (`bindTab`, `releaseTab`, hydrate reconciliation, `_fireStagedRelease`) all keep the two maps consistent, so this is theoretical. Still, a defensive cleanup at the early-return path would harden against future drift.

**Fix:** Optional. Could add a defensive scan `_tabsByAgent.forEach((set, agent) => set.delete(tabId))` at the early-return, but this trades O(1) for O(agents). Not recommended unless real drift is observed.

### IN-04: Magic number `RECONNECT_GRACE_MS = 10000` duplicated across `agent-registry.js` and `mcp-bridge-client.js`

**File:** `extension/utils/agent-registry.js:56` and `extension/ws/mcp-bridge-client.js:26`
**Issue:** The 10s grace constant lives in two files. The bridge passes `RECONNECT_GRACE_MS` explicitly to `stageReleaseByConnectionId` so they happen to agree, but the registry's default fallback (`agent-registry.js:637`) also uses its own copy. If one file is updated and the other forgotten, the bridge's call would override the registry's default, masking the drift. Comments in both files cross-reference each other, which is the right mitigation.

**Fix:** Optional. Could export `RECONNECT_GRACE_MS` from the registry module and have the bridge import it (the registry already exposes `FSB_AGENT_REGISTRY_STORAGE_KEY`, etc., on `globalThis.FsbAgentRegistry`). Low priority because the bridge always passes the value explicitly.

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
