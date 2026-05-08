---
phase: 243-background-tab-audit-ui-badge-integration
fixed_at: 2026-05-05T00:00:00Z
review_path: .planning/phases/243-background-tab-audit-ui-badge-integration/243-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 243: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** `.planning/phases/243-background-tab-audit-ui-badge-integration/243-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01 + WR-01..WR-04; IN-* skipped per scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: BG-04 500ms suppression stamp missing at FIVE of SEVEN navigation call sites

**Files modified:** `extension/ws/mcp-tool-dispatcher.js`, `extension/ai/tool-executor.js`
**Commit:** 3aa961f
**Applied fix:** Added `globalThis.fsbAgentRegistryInstance?.stampAgentNavigation?.(targetTabId)` (guarded try/catch best-effort pattern matching `background.js:6414`) BEFORE every programmatic chrome.tabs API call on the five unstamped sites:

- `mcp-tool-dispatcher.js` `handleNavigateRoute` (before `chrome.tabs.update` at line 386)
- `mcp-tool-dispatcher.js` `handleNavigationHistoryRoute` (single stamp before the if/else chain that dispatches `goBack` / `goForward` / `reload` at lines 429/431/433)
- `mcp-tool-dispatcher.js` `handleBackRoute` (before `chrome.tabs.goBack` at line 784, the canonical Phase 242 `auto_bookmark` false-positive vector)
- `tool-executor.js` autopilot cases `navigate` / `go_back` / `go_forward` / `refresh` (4 stamps at lines 207/219/229/239)

Marker: `Phase 243 plan 02 (BG-04)` comments anchor each stamp for future grep auditing. WR-04 (also in this commit set) ensures the stamps are no-ops on unbound tabs, so the per-site additions remain safe even if a non-agent-owned tabId is somehow passed.

**Verification:** `node -c` syntax-clean on both files. The pattern mirrors the two existing stamped sites in `background.js handleStartAutomation`. Logic correctness REQUIRES HUMAN VERIFICATION at runtime: confirm in browser session that an MCP `back` / `navigate` / `refresh` no longer produces an `agent-tab-user-navigation` LOG-04 entry, while a true user-initiated nav on the same tab still does.

---

### WR-01: Sidepanel owner chip stale on same-tab ownership churn

**Files modified:** `extension/ui/sidepanel.js`
**Commit:** bacd5ee
**Applied fix:** Extended the existing `chrome.storage.onChanged` listener at `sidepanel.js:216` with a second branch:

```js
if (area === 'session' && changes && changes.fsbAgentRegistry) {
  refreshOwnerChip();
}
```

`refreshOwnerChip` is an async function declaration above this listener so hoisting handles the forward reference. The popup is intentionally NOT updated; popup is short-lived per the existing comment at line 229.

**Verification:** `node -c` syntax-clean. Listener wiring matches the existing pattern; runtime verification (chip re-render on agent claim/release while staying on the same tab) is left to manual smoke-test.

---

### WR-02: Multiple chrome.storage.onChanged listeners across SW wakes

**Files modified:** `extension/utils/agent-registry.js`
**Commit:** 045212e
**Applied fix:** Added two module-scope variables (`_capListenerAttached` and `_capListenerLiveSelf`) declared near the LOG-04 category constants block. `_subscribeToCapChanges` now:

1. Always refreshes `_capListenerLiveSelf = self` (so re-instantiation routes events to the latest live registry).
2. Returns early if `_capListenerAttached` is true.
3. Sets `_capListenerAttached = true` only after the addListener call succeeds.

The listener body now mutates `_capListenerLiveSelf._cachedCap` instead of capturing a `self` closure, so prior captures from earlier instances cannot leak.

**Verification:** `node -c` syntax-clean. Smoke-test: `new AgentRegistry()` followed by a second `new AgentRegistry()` in one process completes without error (`stampAgentNavigation` and `_subscribeToCapChanges` both still typeof `function`). Existing test suites (`agent-cap.test.js`, `agent-cap-storage.test.js`, `agent-registry.test.js`, `agent-tab-user-navigation.test.js`) all pass unchanged.

---

### WR-03: 500ms boundary documented two ways

**Files modified:** `extension/utils/agent-nav-emission.js`, `extension/utils/agent-registry.js`
**Commit:** 3a56509
**Applied fix:** Pinned `extension/utils/agent-nav-emission.js` `AGENT_NAV_SUPPRESSION_MS` as the SINGLE SOURCE OF TRUTH for the suppression window, with an explicit comment block documenting:

- Inclusive boundary semantics (`elapsed <= ms` suppresses; strictly greater emits)
- Reference to test 4(e) as the contract test
- Note that other modules reference rather than redeclare the value

Updated the `stampAgentNavigation` docstring in `agent-registry.js` to remove the prior un-qualified "500ms" wording and instead direct readers to consult `agent-nav-emission.js` as the authoritative source.

**Verification:** `node -c` syntax-clean on both files. Test 4(e) (boundary test) still passes.

---

### WR-04: stampAgentNavigation auto-creates partial metadata on unbound tabs

**Files modified:** `extension/utils/agent-registry.js`, `tests/agent-tab-user-navigation.test.js`
**Commit:** 3f1587a
**Applied fix:** Replaced the `if (!meta) { meta = {}; this._tabMetadata.set(id, meta); }` auto-create block in `stampAgentNavigation` with `if (!meta) return;` — a silent skip when no bucket exists. Updated the docstring to call out the new bound-tab guard semantic and explain why the suppression contract is preserved (a missing bucket evaluates as `lastAgentNav=0` in the BG-04 helper, so `now - 0 > 500` cleanly emits).

Updated tests:

- Test 1 retitled to "writes lastAgentNavigationAt on a BOUND tab" and now seeds the metadata bucket directly (mimicking what `bindTab` does) before stamping.
- Test 2 likewise seeds the bucket before its idempotency assertions.
- Added Test 1b which asserts that `stampAgentNavigation` on an unbound tab leaves `getTabMetadata` returning `null`.

**Verification:** `node -c` syntax-clean. `node tests/agent-tab-user-navigation.test.js` reports all 11 sub-tests passing (Tests 1, 1b, 2, 3, 4(a)-(f), 5).

---

## Skipped Issues

None. All five in-scope findings (CR-01, WR-01, WR-02, WR-03, WR-04) were fixed and committed atomically. The three Info findings (IN-01, IN-02, IN-03) were out of scope per the `fix_scope: critical_warning` configuration.

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
