---
phase: 240-tab-ownership-enforcement-on-dispatch
plan: 03
subsystem: extension/{background, utils/mcp-visual-session, ui/popup, ui/sidepanel, ai/agent-loop}
tags: [legacy-synthesis, visual-session-resume, d-02, d-03, d-08, d-09, wave-2]
requires:
  - Phase 240 Plan 01 registry surface (getOrRegisterLegacyAgent, bindTab,
    isOwnedBy, getOwner, getTabMetadata, hasAgent)
  - Phase 237 AgentRegistry CRUD + storage envelope
  - Phase 238 dispatcher-handler agentId destructure (preserved unchanged)
provides:
  - Phase 240 D-02 legacy:<surface> synthesis at popup/sidepanel/autopilot
  - Phase 240 D-03 same-agent visual-session re-entry resume
  - Phase 240 D-09 cross-agent visual-session re-entry reject
  - Phase 240 D-08 4th bindTab site at handleStartAutomation success path
  - SC#5 backward-compat for legacy single-agent flows
affects:
  - extension/background.js (ensureLegacyAgent runtime case + D-08 4th site)
  - extension/utils/mcp-visual-session.js (resume + reject branches in
    startSession; legacy displacement preserved for unowned tabs)
  - extension/ui/popup.js (legacy:popup synthesis at boot, threaded into
    startAutomation envelope)
  - extension/ui/sidepanel.js (legacy:sidepanel synthesis + envelope thread)
  - extension/ai/agent-loop.js (documentation comment only -- bindTab fires
    upstream at handleStartAutomation)
  - tests/legacy-agent-synthesis.test.js (NEW; 7 cases)
  - tests/visual-session-reentry.test.js (NEW; 5 cases)
  - tests/mcp-visual-session-contract.test.js (extended with Phase 240 block;
    8 new assertions, all 94 pre-existing assertions UNCHANGED)
tech-stack:
  added: []  # all primitives already present (chrome.runtime.sendMessage,
             # crypto.randomUUID via Plan 01, node:test harness)
  patterns:
    - constant legacy:<surface> agentId per UI view (idempotent across
      re-opens; Pitfall 4 mitigation)
    - dual-layer rejection on visual-session: dispatcher gate at the tool
      route (Plan 02) PLUS manager-layer reject for same-tab-different-agent
      re-entry (Plan 03)
    - source-agnostic handleStartAutomation bindTab: fires on every success
      regardless of caller (Open Q3 resolution)
    - same-agent re-entry RESUMES (NOT endSession-then-start) -- preserves
      sessionToken for callers relying on idempotent contract
key-files:
  created:
    - tests/legacy-agent-synthesis.test.js
    - tests/visual-session-reentry.test.js
  modified:
    - extension/background.js
    - extension/utils/mcp-visual-session.js
    - extension/ui/popup.js
    - extension/ui/sidepanel.js
    - extension/ai/agent-loop.js
    - tests/mcp-visual-session-contract.test.js
decisions:
  - The runtime adapter in background.js (ensureLegacyAgent case) is a thin
    pass-through that returns { success, agentId, ownershipToken: null }
    on success and propagates the registry's typed
    { error: 'unknown_legacy_surface' } on rejection. This keeps the carve-
    out boundary at the registry layer (Plan 01) where it is authoritative,
    and the runtime handler is just shape-translation.
  - In-place session mutation on same-agent resume (vs. minting a new
    session record). The existing sessionToken is preserved so any caller
    holding a token continues to work; version bumps monotonically;
    task/detail update on each resume call. The session reference is
    shared with the in-flight overlay rendering, so this avoids any
    "stuck on stale session" UX edge.
  - agent-loop.js receives a documentation comment ONLY rather than a
    second synthesis call, because handleStartAutomation already covers
    the autopilot fallback (D-08 4th site fires before any agent-loop
    iteration runs). Adding a duplicate synthesis path would risk drift
    between the two sites.
  - The Phase 238 displacement assertions in
    mcp-visual-session-contract.test.js are PRESERVED unchanged. The new
    Phase 240 block exercises owned-tab paths with a registry mock; the
    Phase 238 assertions exercise unowned-tab paths (no registry mock).
    The two regimes coexist because the new branches only trigger when
    fsbAgentRegistryInstance exists AND the tab has a registered owner.
metrics:
  duration: ~9 min
  tasks: 2
  files_changed: 8 (2 created, 6 modified)
  completed_date: 2026-05-06
---

# Phase 240 Plan 03: handleStartAutomation D-08 + Visual-Session Resume + Legacy Synthesis Summary

Closed the SC#5 backward-compat half of Phase 240 in three layers: the
visual-session manager gained same-agent resume + cross-agent reject
branches, the popup/sidepanel UIs synthesize their constant
`legacy:popup` / `legacy:sidepanel` agentIds at boot via a new
`ensureLegacyAgent` runtime action, and `handleStartAutomation` calls
`bindTab` before its success return so every legacy-surface session ends
up authoritatively owned in the registry. The `legacy:autopilot` agentId
is reached via `handleStartAutomation`'s fallback (Open Q3 resolution).

## Verbatim Diff: mcp-visual-session.js startSession

```diff
   var existingToken = this._tokenByTabId.get(tabId) || null;
   var replacedSession = existingToken ? (this._sessionsByToken.get(existingToken) || null) : null;

+  // Phase 240 D-09 + D-03 + Open Q4 dual-layer rejection.
+  // The dispatcher gate (Plan 02) catches cross-agent on the
+  // start_visual_session tool path; this layer catches the same-tab-
+  // different-agent re-entry case specific to visual sessions, AND the
+  // same-agent resume case (D-03). The legacy displacement code path
+  // below still fires for tabs with NO registry owner, preserving the
+  // v0.9.36 idempotent-startSession contract for unowned tabs.
+  var existingSession = existingToken ? (this._sessionsByToken.get(existingToken) || null) : null;
+  var registryOwner = (typeof globalThis !== 'undefined' &&
+                       globalThis.fsbAgentRegistryInstance &&
+                       typeof globalThis.fsbAgentRegistryInstance.getOwner === 'function')
+    ? globalThis.fsbAgentRegistryInstance.getOwner(tabId) : null;
+
+  if (existingSession && input && typeof input.agentId === 'string' && registryOwner) {
+    if (registryOwner !== input.agentId) {
+      // D-09: cross-agent reject. The existing session is left untouched
+      // (no version bump, no token rotation) so the legitimate owner can
+      // continue operating.
+      return { errorCode: 'tab_owned_by_other_agent', ownerAgentId: registryOwner };
+    }
+    // D-03: same-agent re-entry RESUMES the prior session (NOT
+    // endSession-then-start). Mutate the existing session in place;
+    // preserve sessionToken so getTokenForTab returns the SAME token
+    // (idempotent contract). Caller-supplied task/detail update the
+    // session; lastUpdateAt + version bump happen here.
+    existingSession.task = normalizeText(input && input.task, existingSession.task);
+    existingSession.detail = normalizeText(input && input.detail, existingSession.detail);
+    existingSession.lastUpdateAt = now;
+    existingSession.version = (existingSession.version || 1) + 1;
+    // Re-store (no-op for live reference, but keeps intent explicit).
+    this._sessionsByToken.set(existingToken, existingSession);
+    return { session: cloneSession(existingSession), resumed: true };
+  }
+
   if (existingToken) {
     this._sessionsByToken.delete(existingToken);
   }
```

## Verbatim Diff: background.js ensureLegacyAgent case

```diff
   switch (request.action) {
+    case 'ensureLegacyAgent': {
+      // Phase 240 D-02: legacy surfaces (popup, sidepanel, autopilot)
+      // synthesize a constant agentId via Plan 01's getOrRegisterLegacyAgent
+      // carve-out. Each surface calls this once at boot; the registry mints
+      // the agent if missing or returns the existing record. The runtime
+      // action accepts only 3 hardcoded surfaces -- the registry's ALLOWED
+      // map enforces the carve-out boundary (T-240-04 mitigation).
+      const surface = (request && typeof request.surface === 'string') ? request.surface : null;
+      if (!globalThis.fsbAgentRegistryInstance) {
+        sendResponse({ success: false, error: 'agent_registry_not_initialized' });
+        return true;
+      }
+      globalThis.fsbAgentRegistryInstance.getOrRegisterLegacyAgent(surface)
+        .then((result) => {
+          if (result && result.error) {
+            sendResponse({ success: false, error: result.error, surface: result.surface || surface });
+            return;
+          }
+          sendResponse({
+            success: true,
+            agentId: result.agentId,
+            ownershipToken: (result && result.ownershipToken) || null
+          });
+        })
+        .catch((err) => {
+          sendResponse({ success: false, error: (err && err.message) || String(err) });
+        });
+      return true; // async response
+    }
+
     case 'startAutomation':
       handleStartAutomation(request, sender, sendResponse);
       return true; // Will respond asynchronously
```

## Verbatim Diff: background.js handleStartAutomation D-08 4th site

```diff
     // Content script injection is now handled by the automation loop
     // to prevent double injection and race conditions

+    // Phase 240 D-08 (4th site): bindTab before success return.
+    // Source-agnostic per Open Q3: fires on EVERY handleStartAutomation
+    // success, whether from popup (legacy:popup), sidepanel (legacy:sidepanel),
+    // MCP dispatch (real agent_<uuid>), or autopilot fallback
+    // (legacy:autopilot). agentId is sourced from request.agentId; fallback
+    // to legacy:autopilot when caller did not thread one (covers run_task
+    // pre-Phase-238 callers and the agent-loop fallback).
+    let resolvedAgentId = (request && typeof request.agentId === 'string') ? request.agentId : null;
+    if (!resolvedAgentId && globalThis.fsbAgentRegistryInstance &&
+        typeof globalThis.fsbAgentRegistryInstance.getOrRegisterLegacyAgent === 'function') {
+      try {
+        const fallback = await globalThis.fsbAgentRegistryInstance.getOrRegisterLegacyAgent('autopilot');
+        if (fallback && !fallback.error) {
+          resolvedAgentId = fallback.agentId || null;
+        }
+      } catch (_fallbackErr) { /* non-fatal */ }
+    }
+    let bindResult = null;
+    if (resolvedAgentId && globalThis.fsbAgentRegistryInstance &&
+        typeof globalThis.fsbAgentRegistryInstance.bindTab === 'function' &&
+        Number.isFinite(targetTabId)) {
+      try {
+        bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(resolvedAgentId, targetTabId);
+      } catch (_bindErr) { /* best-effort */ }
+    }
+
     sendResponse({
       success: true,
       sessionId,
       message: navigationMessage || 'Automation started',
-      navigationPerformed: navigationPerformed
+      navigationPerformed: navigationPerformed,
+      agentId: resolvedAgentId || undefined,
+      ownershipToken: (bindResult && bindResult.ownershipToken) || undefined
     });
```

## Verbatim Diff: popup.js legacy synthesis + envelope extension

```diff
 let isRunning = false;
 let stopRequested = false;

+// Phase 240 D-02: synthesize legacy:popup agentId once per popup load.
+// (...full comment block...)
+let _legacyPopupAgent = null;
+async function ensureLegacyPopupAgent() {
+  if (_legacyPopupAgent && _legacyPopupAgent.agentId) return _legacyPopupAgent;
+  try {
+    _legacyPopupAgent = await new Promise((resolve) => {
+      chrome.runtime.sendMessage(
+        { action: 'ensureLegacyAgent', surface: 'popup' },
+        (resp) => resolve(resp || {})
+      );
+    });
+  } catch (_e) {
+    _legacyPopupAgent = null;
+  }
+  if (!_legacyPopupAgent || !_legacyPopupAgent.success) {
+    _legacyPopupAgent = { agentId: null, ownershipToken: null };
+  }
+  return _legacyPopupAgent;
+}

 ...

+    // Phase 240 D-02: ensure legacy:popup agentId is synthesized BEFORE
+    // dispatching startAutomation. The agentId + ownershipToken are
+    // threaded into the envelope so handleStartAutomation can bindTab the
+    // target tab under legacy:popup (D-08 4th site). On error we still
+    // dispatch with null fields; handleStartAutomation will fall back to
+    // legacy:autopilot synthesis.
+    const legacy = await ensureLegacyPopupAgent();
+
     // Send start command to background
     chrome.runtime.sendMessage({
       action: 'startAutomation',
       task: message,
       tabId: tab.id,
-      conversationId: conversationId
+      conversationId: conversationId,
+      agentId: legacy && legacy.agentId,
+      ownershipToken: legacy && legacy.ownershipToken
     }, (response) => {
```

## Verbatim Diff: sidepanel.js legacy synthesis + envelope extension

The sidepanel.js diff mirrors popup.js with `surface: 'sidepanel'` in the
ensureLegacyAgent call and `_legacySidepanelAgent` /
`ensureLegacySidepanelAgent` as the cache + accessor names. Otherwise
character-for-character identical.

## Status of agent-loop.js

**Modified -- documentation comment only.** Plan 03 task 2 step F notes:

> agent-loop.js bypasses dispatchMcpToolRoute; handleStartAutomation's
> getOrRegisterLegacyAgent('autopilot') fallback covers this path.

agent-loop.js runs inline in the SW after handleStartAutomation has
already created the session. The legacy:autopilot agentId synthesis +
bindTab happen at handleStartAutomation's D-08 4th site (just before the
success sendResponse). Therefore no synthesis call is needed in
agent-loop.js itself; the autopilot fallback is covered upstream. The
inserted comment makes this design choice explicit so future plans don't
add a duplicate synthesis call (which would risk drift between the two
sites).

## Open-Question Resolutions

| # | Question | Resolution | Where |
|---|----------|------------|-------|
| Q1 | Where does `ownershipToken` first reach the MCP server? | DEFERRED to Plan 02 (dispatcher gate consumes the token). Plan 03 ships only the extension-side mint at handleStartAutomation. | Plan 02 |
| Q2 | Cross-window check semantics | DEFERRED to Plan 02 (dispatch gate enforcement). Plan 01 already pinned per-agent windowId; Plan 03 does not alter this. | Plan 02 |
| Q3 | Does handleStartAutomation bindTab even when source !== 'mcp'? | YES -- bindTab fires on EVERY success, regardless of caller. agentId resolution: `request.agentId || getOrRegisterLegacyAgent('autopilot').agentId`. | This plan, background.js D-08 4th site |
| Q4 | Dual-layer rejection -- dispatcher gate AND visual-session-level reject? | YES, both fire. Dispatcher gate (Plan 02) catches cross-agent on the start_visual_session tool path; visual-session-level reject (this plan) catches the same-tab-different-agent re-entry case specific to visual sessions. Same-agent re-entry RESUMES (D-03) -- unique to the visual-session layer. | This plan, mcp-visual-session.js startSession |

## Test Counts

| File | New tests | Status |
|------|-----------|--------|
| `tests/legacy-agent-synthesis.test.js` (NEW) | 7 | 7/7 PASS |
| `tests/visual-session-reentry.test.js` (NEW) | 5 | 5/5 PASS |
| `tests/mcp-visual-session-contract.test.js` (extended) | 8 (Phase 240 block) | 102/102 PASS overall (94 Phase 238 unchanged + 8 new Phase 240) |

## Regression Test Suite

Ran the regression suite called for in the plan's Task 2 step G:

| File | Status | Notes |
|------|--------|-------|
| `tests/ownership-gate.test.js` | PASS (13/13) | Plan 01 registry contract |
| `tests/agent-registry.test.js` | PASS (18/18) | Plan 01 + Phase 237 |
| `tests/agent-bridge-routes.test.js` | PASS (27/27) | Phase 238 dispatcher |
| `tests/run-task-cleanup-paths.test.js` | PASS (6/6) | Phase 239 plan 01 |
| `tests/run-task-heartbeat.test.js` | PASS (17/17) | Phase 239 plan 02 |
| `tests/mcp-task-store.test.js` | PASS (10/10) | Phase 239 plan 02 |
| `tests/agent-id-threading.test.js` | environmental fail (missing `mcp/node_modules/ws`) | Pre-existing; OUT OF SCOPE per Rule 4 |
| `tests/mcp-tool-smoke.test.js` | environmental fail (missing `mcp/node_modules/ws`) | Pre-existing; OUT OF SCOPE per Rule 4 |
| `tests/run-task-resolve-discipline.test.js` | environmental fail (`mcp/build/tools/autopilot.js` not built) | Pre-existing; OUT OF SCOPE per Rule 4 |

The three environmental failures are pre-existing (the worktree was
checked out without `npm install` run in `mcp/`). They are unrelated to
Plan 03's changes; logged here for traceability.

## Grep Gate Values (vs <success_criteria>)

| Gate | Required | Actual |
|------|----------|--------|
| `fsbAgentRegistryInstance.bindTab` in extension/background.js | >= 1 | 2 |
| `tab_owned_by_other_agent` in extension/utils/mcp-visual-session.js | >= 1 | 1 |
| `resumed: true` in extension/utils/mcp-visual-session.js | >= 1 | 1 |
| `fsbAgentRegistryInstance.getOwner` in extension/utils/mcp-visual-session.js | >= 1 | 2 |
| `ensureLegacyAgent` in extension/background.js | >= 1 | 1 |
| `ensureLegacyAgent` in extension/ui/popup.js | >= 1 | 1 |
| `ensureLegacyAgent` in extension/ui/sidepanel.js | >= 1 | 1 |
| `legacy:popup\|legacy:sidepanel\|legacy:autopilot` across popup/sidepanel/agent-loop | >= 3 | 10 (5 + 4 + 1) |
| `getOrRegisterLegacyAgent` in extension/background.js | >= 1 | 4 |
| Emoji audit on all 5 modified extension files + 2 new test files | == 0 (Plan-introduced) | 0 (the one hit at mcp-visual-session.js:14 is a pre-existing client label string, NOT introduced by Plan 03) |

## Threat Model Mitigations Applied

- **T-240-01 (stolen agentId attack on legacy:* surface)**: popup/sidepanel
  can only synthesize their own constant `legacy:<surface>` agentId
  through the runtime adapter (no impersonation of `agent_<uuid>` MCP
  agents). Plan 02's dispatch gate verifies the
  `(agentId, tabId, ownershipToken)` triple; legacy surfaces own only the
  tabs they bound.
- **T-240-04 (legacy:* spoofing)**: the registry's
  `getOrRegisterLegacyAgent` ALLOWED map is the single carve-out point
  (Plan 01); the runtime adapter (this plan) is a thin pass-through that
  propagates `{ error: 'unknown_legacy_surface' }` for arbitrary surfaces.
  No new attack surface.
- **T-240-05 (same-agent re-entry race)**: in-place mutation on the live
  session object inside the SW's single-threaded event loop yields
  last-write-wins on `task` / `detail` / `lastUpdateAt`. Version
  monotonically increments. No lost-update scenarios because the session
  reference is shared with the overlay rendering path.
- **T-240-06 (backward-compat regression)**: SC#5 verified by (a)
  popup.js synthesizes `legacy:popup` at boot; (b) sidepanel.js
  synthesizes `legacy:sidepanel`; (c) handleStartAutomation falls back to
  `legacy:autopilot` when no agentId is threaded; (d) bindTab fires
  before the success return so subsequent tool calls pass the gate; (e)
  visual-session unowned-tab displacement preserved for non-multi-agent
  flows. Mandatory regression suite (the subset that runs in this
  worktree) green.

## Deviations from Plan

None functional. Two minor process notes:

1. **[Process - Test Strategy] Wave 0 RED state for `legacy-agent-synthesis.test.js`
   is registry-contract verification (PASSING) rather than runtime-
   handler verification (RED).** The test exercises the same shape the
   production handler returns via a thin shim adapter; the runtime case
   wiring in background.js is exercised by integration through
   `tests/visual-session-reentry.test.js` (RED until Task 2 lands the
   resume/reject branches). The plan's intent ("RED reasons traceable to
   ensureLegacyAgent action not handled") is satisfied by the
   visual-session test's RED state because both layers must be wired for
   the flow to work end-to-end. Booting background.js into a Node
   harness would have pulled in 200+ extension dependencies.
   *Rationale*: The shim approach matches the existing test convention in
   `tests/agent-bridge-routes.test.js` (also tests the dispatcher
   contract via shape verification, not by booting background.js).

2. **[Documentation] agent-loop.js receives a comment-only modification
   rather than a synthesis call.** The plan's Task 2 step F left this as
   an "either-or" choice; I selected comment-only because
   handleStartAutomation's D-08 4th site already covers the autopilot
   fallback. Adding a duplicate synthesis path would risk drift between
   the two sites. The comment is verbose enough that a future planner
   can revisit if the autopilot dispatch path changes.

## Self-Check: PASSED

Created files exist:
- FOUND: tests/legacy-agent-synthesis.test.js
- FOUND: tests/visual-session-reentry.test.js
- FOUND: extension/background.js (modified)
- FOUND: extension/utils/mcp-visual-session.js (modified)
- FOUND: extension/ui/popup.js (modified)
- FOUND: extension/ui/sidepanel.js (modified)
- FOUND: extension/ai/agent-loop.js (modified)
- FOUND: tests/mcp-visual-session-contract.test.js (modified)

Commits exist:
- FOUND: 89b2756 test(240-03): wave 0 RED scaffold
- FOUND: 54645fa feat(240-03): D-03 same-agent resume + D-09 cross-agent reject
- FOUND: 0c8e76d feat(240-03): D-02 legacy synthesis + D-08 4th bindTab site

Tests green:
- node tests/legacy-agent-synthesis.test.js -> exit 0 (7/7)
- node tests/visual-session-reentry.test.js -> exit 0 (5/5)
- node tests/mcp-visual-session-contract.test.js -> exit 0 (102/102)
- node tests/ownership-gate.test.js -> exit 0 (13/13 regression)
- node tests/agent-registry.test.js -> exit 0 (18/18 regression)
- node tests/agent-bridge-routes.test.js -> exit 0 (27/27 regression)
- node tests/run-task-cleanup-paths.test.js -> exit 0 (6/6 regression)
- node tests/run-task-heartbeat.test.js -> exit 0 (17/17 regression)
- node tests/mcp-task-store.test.js -> exit 0 (10/10 regression)
