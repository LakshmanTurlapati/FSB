---
phase: 243
plan: 03
subsystem: extension/ui + extension/content + extension/utils
tags: [ui, badge, owner-chip, multi-agent, observability, agent-registry]
requires:
  - "extension/utils/overlay-state.js (Phase 168/229 v0.9.36 trusted-client badge envelope, lines 331-353)"
  - "extension/content/visual-feedback.js (Phase 229 badge consumer, lines 697-702)"
  - "extension/utils/agent-registry.js (Phase 237 plan 01 formatAgentIdForDisplay SSOT, line 184; Phase 237 D-03 chrome.storage.session envelope)"
  - "extension/ui/popup.js + popup.html (Phase 240 D-02 legacy:popup surface)"
  - "extension/ui/sidepanel.js + sidepanel.html (Phase 240 D-02 legacy:sidepanel surface)"
provides:
  - "agentIdShort field threaded through overlay envelope (sourced via formatAgentIdForDisplay; never sliced locally)"
  - "Badge renderer combines clientLabel + agentIdShort as 'Claude / agent_a3f1ab'"
  - "Read-only 'owned by Agent X' chip in popup + sidepanel for foreign-owner active tabs"
  - "Pure helpers (FSBBadgeCombine + FSBOwnerChip) testable without DOM, reusable across surfaces"
  - "chrome.tabs.onActivated subscription on sidepanel refreshes chip on tab switch (T-243-03-02)"
affects:
  - "extension/utils/overlay-state.js"
  - "extension/content/visual-feedback.js"
  - "extension/content/badge-combine.js (new)"
  - "extension/background.js (content-script load order)"
  - "extension/ui/popup.js + popup.html"
  - "extension/ui/sidepanel.js + sidepanel.html"
  - "extension/ui/owner-chip.js (new)"
tech-stack:
  added:
    - "extension/content/badge-combine.js (pure combine helper; dual CommonJS + browser-global export)"
    - "extension/ui/owner-chip.js (pure render-decision + envelope-scan helpers; dual CommonJS + browser-global export)"
  patterns:
    - "Pure helper extraction for Node-test parity with browser code (matches Phase 243-04 cap-counter-helpers.js pattern)"
    - "Lazy formatAgentIdForDisplay resolution via globalThis.FsbAgentRegistry with require() fallback for Node tests"
    - "Read directly from chrome.storage.session.fsbAgentRegistry envelope (Phase 237 D-03) instead of adding a background.js bridge route -- preserves Wave-1 zero-overlap with Plan 02"
    - "chrome.tabs.onActivated listener for chip auto-refresh in persistent surfaces (sidepanel only; popup is short-lived)"
key-files:
  created:
    - "extension/content/badge-combine.js"
    - "extension/ui/owner-chip.js"
    - "tests/badge-agent-id.test.js"
    - "tests/owner-chip.test.js"
    - ".planning/phases/243-background-tab-audit-ui-badge-integration/243-03-SUMMARY.md"
  modified:
    - "extension/utils/overlay-state.js"
    - "extension/content/visual-feedback.js"
    - "extension/background.js (content-script injection list)"
    - "extension/ui/popup.js"
    - "extension/ui/popup.html"
    - "extension/ui/sidepanel.js"
    - "extension/ui/sidepanel.html"
decisions:
  - "Badge envelope adds agentIdShort as a SEPARATE field (not concatenated upstream) so the dashboard mirror retains composition flexibility (D-04 must_have truth)"
  - "agentIdShort sourced via formatAgentIdForDisplay (agent-registry.js:184 SSOT) at every site -- NEVER sliced locally (T-243-03-01 mitigation, RESEARCH anti-pattern)"
  - "Owner chip reads chrome.storage.session.fsbAgentRegistry envelope directly instead of adding a background.js getActiveTabOwner bridge route -- avoids same-file collision with Plan 02 and stays Wave-1 zero-overlap (PLAN <interfaces> DECISION)"
  - "Cross-surface legacy ownership IS shown (popup viewing a sidepanel-owned tab) -- only the SAME-surface case is suppressed per CONTEXT D-05; informative for the user even though still legacy"
  - "Chip is a <span> with no click handler, no button/anchor (Threat T-243-03-03 mitigation -- ASVS V4 audit forbids action affordance on a read-only informational chip)"
  - "Sidepanel subscribes to chrome.tabs.onActivated; popup does not (popup is short-lived; user closes/reopens to refresh naturally)"
  - "Pure helpers (combineBadgeText / shouldShowOwnerChip / buildChipText / ownerLabelFor / findOwnerInEnvelope) extracted into separate files so Node tests exercise the SAME logic the browser runs"
  - "agent-registry.js is loaded in popup.html and sidepanel.html ahead of the helpers so FsbAgentRegistry.formatAgentIdForDisplay is reachable; agent-registry.js is IIFE-wrapped with lazy chrome refs so it loads cleanly in UI contexts"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-06"
  tasks: 3
  commits: 3
  tests-added: 2
  tests-total: 57
  files-created: 4
  files-modified: 7
---

# Phase 243 Plan 03: Badge AgentId Suffix + Popup/Sidepanel Owner Chip Summary

UI-01 + UI-02 implementation -- the v0.9.36 trusted-client badge now displays a 6-hex-char agentId suffix (`Claude / agent_a3f1ab`), and the popup + sidepanel render a read-only "owned by Agent X" chip whenever the active tab is owned by a different agent than the rendering surface.

## Outcome

UI-01 and UI-02 closed. The trusted-client overlay badge threads agentIdShort through the overlay-state envelope and combines it with clientLabel in the visual-feedback renderer. Popup and sidepanel surfaces read the persisted agent-registry envelope directly from chrome.storage.session, locate the active tab's owner, and render a read-only chip with surface-self exclusion. All chip rendering and badge formatting routes through the canonical formatAgentIdForDisplay helper (agent-registry.js:184) -- no local slicing.

## Tasks Completed

### Task 1: UI-01 -- overlay-state agentIdShort + badge renderer combine

- Added `agentIdShort` field to `buildOverlayState` envelope in `extension/utils/overlay-state.js`, populated via a new `_resolveFormatAgentIdForDisplay()` helper that prefers `globalThis.FsbAgentRegistry.formatAgentIdForDisplay` and falls back to `require('./agent-registry.js')` in Node test harnesses.
- Source for `agentId` is `statusData.agentId` first, then `session.agentId` (defensive against either threading path). Output is `null` when the agent id cannot be canonicalized -- legacy:* and non-prefixed strings deliberately yield falsy so the badge stays clean.
- Created `extension/content/badge-combine.js` exporting `combineBadgeText(clientLabel, agentIdShort)` -- handles all four input combinations, trims whitespace, returns `''` when both are empty.
- Modified `extension/content/visual-feedback.js` badge update block (lines 697-702) to read both fields and delegate to `window.FSBBadgeCombine.combineBadgeText` (with inline string-concat fallback if the helper failed to load).
- Updated `extension/background.js` content-script injection list to load `content/badge-combine.js` immediately before `content/visual-feedback.js`.

**Commit:** 2bdea1a -- `feat(243-03): UI-01 thread agentIdShort through overlay-state and combine in badge renderer`

### Task 2: UI-02 -- popup owner chip with surface-self exclusion

- Created `extension/ui/owner-chip.js` exporting four pure helpers:
  - `shouldShowOwnerChip(ownerAgentId, mySurface)` -- render decision (foreign owner -> show; same-surface or unowned -> hide)
  - `buildChipText(ownerAgentIdShort)` -- always begins with `'owned by '`
  - `ownerLabelFor(ownerAgentId, formatAgentIdForDisplay)` -- legacy:* literal; agent_<uuid> via canonical formatter
  - `findOwnerInEnvelope(envelope, tabId)` -- flat scan over the Phase 237 D-03 records map (handles both `tabIds[]` and scalar `tabId` shapes)
- Added `MY_SURFACE = 'legacy:popup'` constant + `refreshOwnerChip()` in `extension/ui/popup.js`. The function queries `chrome.tabs.query({ active: true, currentWindow: true })`, reads `chrome.storage.session.get('fsbAgentRegistry')`, and routes through the helpers to set `#fsb-owner-chip` text + display.
- Inserted `<span id="fsb-owner-chip" class="fsb-owner-chip" style="display:none">` into the `.status-indicator` row in `extension/ui/popup.html`. Loaded `agent-registry.js` + `owner-chip.js` ahead of `popup.js`.
- `refreshOwnerChip()` is called once on `DOMContentLoaded`. Best-effort: failures are silently swallowed so chip glitches never poison popup boot.

**Commit:** 35b3dbb -- `feat(243-03): UI-02 popup owner-chip render with surface-self exclusion`

### Task 3: UI-02 -- sidepanel owner chip + chrome.tabs.onActivated refresh

- Mirrored Task 2 in `extension/ui/sidepanel.js` with `MY_SURFACE = 'legacy:sidepanel'`. The `refreshOwnerChip()` function is identical in structure but bound to the sidepanel's surface id.
- Added a top-level `chrome.tabs.onActivated` listener that calls `refreshOwnerChip()` -- the sidepanel persists across tab switches, so without this listener the chip would display stale ownership data (Threat T-243-03-02 mitigation).
- Inserted matching `<span id="fsb-owner-chip">` into `extension/ui/sidepanel.html`. Loaded `agent-registry.js` + `owner-chip.js` ahead of `sidepanel.js`.

**Commit:** c38d08a -- `feat(243-03): UI-02 sidepanel owner-chip render + chrome.tabs.onActivated refresh`

## Test Results

```
node tests/badge-agent-id.test.js   -> 18 passed, 0 failed
node tests/owner-chip.test.js       -> 39 passed, 0 failed
node tests/test-overlay-state.js    -> 80 passed, 0 failed (regression)
node tests/agent-registry.test.js   -> all assertions passed (regression)
```

Total: 57 new tests + 80+ regression tests, all GREEN.

### Test coverage notes

- `tests/badge-agent-id.test.js` validates the buildOverlayState shape contract (agentIdShort field via formatAgentIdForDisplay, falsy for non-prefixed ids), the combineBadgeText helper edge cases (both/one/neither/whitespace), and source-level audit (no local slice).
- `tests/owner-chip.test.js` validates render conditions (foreign / self / unowned / cross-surface legacy), label format, envelope scan (tabIds[] + scalar tabId), and source-level wiring (popup.js + sidepanel.js + html). It also enforces the read-only invariant (chip span MUST NOT be a button or anchor).

## Sanity Grep (success criteria)

| Check                                              | Count    | Required |
| -------------------------------------------------- | -------- | -------- |
| `agentIdShort` in overlay-state.js                 | 5        | >= 1     |
| `agentIdShort` in visual-feedback.js               | 6        | >= 1     |
| `formatAgentIdForDisplay` in overlay-state.js      | 5        | >= 1     |
| `owned by\|owner chip` in popup.js                 | 3        | >= 1     |
| `owned by\|owner chip` in sidepanel.js             | 3        | >= 1     |
| `fsb-owner-chip` in popup.html                     | 1        | >= 1     |
| `fsb-owner-chip` in sidepanel.html                 | 1        | >= 1     |
| Local `.slice()` on agent IDs in any new/touched file | 0     | 0 (forbidden) |

## Threat Model Disposition Realized

| Threat ID    | Mitigation Implemented                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| T-243-03-01  | All renders route through `formatAgentIdForDisplay` (6-hex SSOT). Tests assert no local slice. `ownerLabelFor` is the single chokepoint for chip labels. |
| T-243-03-02  | popup refreshes on DOMContentLoaded; sidepanel refreshes on DOMContentLoaded AND on `chrome.tabs.onActivated` (covers persistent-surface tab switches). No caching layer; envelope is read fresh on every refresh. |
| T-243-03-03  | Chip is a `<span>` with no event listeners, no button/anchor element. Tests assert the chip is NOT a button or anchor in either HTML file. |
| T-243-03-04  | Accepted: overlayState builds in SW, consumed in content script via runtime message. Pages cannot inject into runtime messages; trust boundary already enforced. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Module reachability] Lazy formatAgentIdForDisplay resolution**

- **Found during:** Task 1 implementation
- **Issue:** The plan's <interfaces> spec said "if overlay-state.js is loaded via importScripts AFTER agent-registry.js, the global is reachable" -- but agent-registry.js exports as `globalThis.FsbAgentRegistry.formatAgentIdForDisplay`, not as a bare global function. Direct `formatAgentIdForDisplay(...)` would fail.
- **Fix:** Added `_resolveFormatAgentIdForDisplay()` helper that probes `globalThis.FsbAgentRegistry.formatAgentIdForDisplay` first, then falls back to `require('./agent-registry.js')` for Node test harnesses. Returns `null` if neither is available; agentIdShort is then null -- safe degradation (badge falls back to clientLabel-only).
- **Files modified:** extension/utils/overlay-state.js
- **Commit:** 2bdea1a

**2. [Rule 2 - Critical functionality] background.js content-script load order**

- **Found during:** Task 1 implementation
- **Issue:** Plan did not mention adding `content/badge-combine.js` to background.js's `INJECT_FILES` list. Without this, the helper would not load at the correct time and `window.FSBBadgeCombine` would be undefined in the content script context.
- **Fix:** Added `'content/badge-combine.js'` to the injection list immediately before `'content/visual-feedback.js'`.
- **Files modified:** extension/background.js
- **Commit:** 2bdea1a

**3. [Rule 2 - Critical functionality] agent-registry.js loaded in popup/sidepanel HTML**

- **Found during:** Task 2 implementation
- **Issue:** The owner-chip helpers need `formatAgentIdForDisplay` for non-legacy agent labels. Plan did not specify loading agent-registry.js into the UI surfaces.
- **Fix:** Added `<script src="../utils/agent-registry.js">` ahead of `owner-chip.js` in both popup.html and sidepanel.html. agent-registry.js is IIFE-wrapped with lazy chrome refs so it loads safely in UI contexts (no SW-only assumptions).
- **Files modified:** extension/ui/popup.html, extension/ui/sidepanel.html
- **Commit:** 35b3dbb (popup), c38d08a (sidepanel)

### Authentication Gates

None.

## UI-01 + UI-02 Status

- **UI-01:** CLOSED. Badge displays `<clientLabel> / <agentIdShort>` when both present (or each alone when only one is set; hidden when neither). agentIdShort is the 6-hex canonical short prefix from `formatAgentIdForDisplay`.
- **UI-02:** CLOSED. Popup and sidepanel both render `owned by <ownerAgentIdShort>` chip when the active tab is owned by a non-self agent. Read-only (no click handler). Hidden for self-owned legacy:* tabs and unowned tabs. agent_<uuid> labels are formatted via the canonical helper; legacy:* labels are shown literally.

## Out of Scope (deferred)

- Manual UAT in real Chrome -- per VALIDATION.md (deferred to phase verifier).
- Click-to-switch agent control on the chip -- explicitly deferred per CONTEXT.md "deferred" + Threat T-243-03-03 (read-only is intentional).
- Badge color coding by agent -- too far for v0.9.60 polish.
- Dashboard-mirror badge (D-04 second half) -- if the dashboard surfaces a badge today, it now has access to `agentIdShort` on the overlay envelope and can mirror without further changes; if it does not yet show the badge, that wiring is owned by the dashboard plan, not this UI surface plan.

## Self-Check: PASSED

- `extension/content/badge-combine.js` -> FOUND
- `extension/ui/owner-chip.js` -> FOUND
- `tests/badge-agent-id.test.js` -> FOUND
- `tests/owner-chip.test.js` -> FOUND
- `extension/utils/overlay-state.js` agentIdShort grep -> FOUND (5 occurrences)
- `extension/content/visual-feedback.js` agentIdShort grep -> FOUND (6 occurrences)
- `extension/ui/popup.html` fsb-owner-chip grep -> FOUND (1 occurrence)
- `extension/ui/sidepanel.html` fsb-owner-chip grep -> FOUND (1 occurrence)
- Commit 2bdea1a -> FOUND in git log
- Commit 35b3dbb -> FOUND in git log
- Commit c38d08a -> FOUND in git log
