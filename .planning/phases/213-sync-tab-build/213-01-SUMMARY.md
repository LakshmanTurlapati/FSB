---
phase: 213
plan: 01
subsystem: ui
tags: [ui, control-panel, sync-tab, pill, navigation, css, js]
requirements: [SYNC-01, SYNC-02]
dependency_graph:
  requires:
    - "Phase 212-02 left Server Sync card and pairing wiring LIVE inside <section id='background-agents'> (D-15)"
    - "Phase 210-01 QR pairing controller bound at ui/options.js:4271 via getElementById"
  provides:
    - "Sync tab UI surface (<section id='sync'>) hosting Server Sync card and live status pill"
    - "initializeSyncSection() pill state machine consuming getRemoteControlState replay + remoteControlStateChanged push"
    - ".sync-status-pill CSS contract with four [data-state] variants"
  affects:
    - "ui/control_panel.html nav order: API Configuration -> Sync -> Agents (existing cells unchanged)"
    - "<section id='background-agents'> body now contains only Phase 212 deprecation card + fsbSunsetNotice aside"
tech_stack:
  added: []
  patterns:
    - "data-state attribute-driven CSS state variants (no JS class toggling)"
    - "chrome.runtime.lastError defensive suppression for dispatch-order tolerance"
    - "Replay-on-attach via chrome.runtime.sendMessage + live updates via chrome.runtime.onMessage"
key_files:
  created: []
  modified:
    - "ui/control_panel.html"
    - "ui/options.css"
    - "ui/options.js"
decisions:
  - "Substituted var(--info-color) (FSB cyan) for D-13 Tailwind blue (#3b82f6) per UI-SPEC authorization (D-14 token reuse)"
  - "Placed pill state machine code at end of options.js before module.exports for clean isolation"
  - "Used var-style declarations in new code to match top-level scope idiom and avoid TDZ on initializeSyncSection forward reference from switchSection wrapper"
metrics:
  completed_at: "2026-04-29T16:01:10Z"
  duration_seconds: 240
  duration_minutes: 4
  tasks_completed: 4
  files_modified: 3
---

# Phase 213 Plan 01: Sync Tab UI Surface Summary

Add the Sync tab UI to the FSB control panel: new top-level nav-item, new `<section id="sync">` hosting a verbatim-relocated Server Sync card and a live four-state connection pill, with CSS variants and a JS state machine that replays from `getRemoteControlState` and updates on `remoteControlStateChanged` runtime push (graceful degradation if 213-02 has not registered the action yet).

## Tasks Completed

### Task 1: Insert Sync nav-item and create empty `<section id="sync">` shell with pill
**Commit:** `c75bd75`
**Files:** `ui/control_panel.html`

- Inserted `<li class="nav-item" data-section="sync">` between `data-section="api-config"` (line 58) and `data-section="background-agents"` (line 66) — final order matches D-01 (Profile -> API Configuration -> Sync -> Agents -> Passwords -> Payments -> Advanced).
- Used `fa-sync-alt` icon class per D-03; sentence-case "Sync" label per D-04; no `feature-badge`.
- Inserted empty `<section class="content-section" id="sync">` (lines 567-579) immediately before the Background Agents section. Section header uses the new `.sync-section-header` modifier class with a `.section-header-text` wrapper and the pill markup:
  ```html
  <span class="sync-status-pill" id="syncStatusPill" role="status" aria-live="polite" aria-atomic="true" data-state="disconnected">
    <span class="dot"></span>
    <span class="label">Disconnected</span>
  </span>
  ```
- Default `data-state="disconnected"` per D-18 safe default; label "Disconnected" verbatim per D-15.

### Task 2: Move Server Sync card verbatim into `<section id="sync">`
**Commit:** `4f70f36`
**Files:** `ui/control_panel.html`

- Cut the `<div class="settings-card full-width" style="margin-top: 20px;">` block (originally at lines 610-658 after Phase 212) from inside `<section id="background-agents">`.
- Pasted it verbatim inside `<section id="sync">` (now at lines 581-627). Updated the leading comment from `<!-- Server Connection (Phase 2) -->` to `<!-- Server Sync card relocated from background-agents per Phase 213 D-05 -->` to disambiguate the relocation. NO inner markup, IDs, attributes, or strings changed.
- Confirmed all 12 Server Sync IDs preserved byte-for-byte (each grep count = 1, except `connectionStatus` which is 2 due to a pre-existing unrelated `id="connectionStatus"` on the page header at line 27 — out of scope per plan note).
- `<input type="hidden" id="serverUrl">` stays hidden per D-07.
- After the move, `<section id="background-agents">` body (lines 631-677) contains ONLY the Phase 212 deprecation card and the `<aside id="fsbSunsetNotice">` aside (D-08 satisfied).
- HTML balance verified: 11 `<section ` opens / 11 `</section>` closes; 9 `<section class="content-section"` content sections / matching closes accounted for.
- Existing pairing wiring at `ui/options.js:4189-4205` and `:4271` (was `:4264` pre-edit; the line shifted by 7 due to the new section header insert in Task 1 above its caller) continues to bind via `getElementById` — zero-touch per D-06.

### Task 3: Add `.sync-status-pill` CSS + `.sync-section-header` flex layout
**Commit:** `dc4f26a`
**Files:** `ui/options.css`

- Appended 80 lines (from line 5048 to file tail) covering:
  - `.sync-section-header` flex layout with `.section-header-text` and `#syncStatusPill` flex children, plus a `@media (max-width: 640px)` mobile-stack fallback.
  - `.sync-status-pill` base chrome (inline-flex, `var(--bg-primary)` background, `var(--border-color)` border, `999px` radius, `var(--shadow-sm)` elevation, `var(--dashboard-body-md)` font-size, weight 500, `--text-primary` color, `user-select: none`).
  - `.dot` and `.label` child rules; `.dot` defaults to `var(--text-muted)` fallback when `data-state` is missing.
  - Four `[data-state]` variants on `.dot` background:
    - `connected` -> `var(--success-color)`
    - `connecting` -> `var(--warning-color)`
    - `disconnected` -> `var(--danger)`
    - `remote-active` -> `var(--info-color)` (substitutes D-13 Tailwind blue per UI-SPEC authorization under D-14)
  - `@media (prefers-reduced-motion: no-preference)` guard wrapping `animation: pulse 2s ease-in-out infinite` for `connecting` + `remote-active` only.
- No new `:root` tokens added.
- No raw hex values introduced (token aliases only).
- Existing `@keyframes pulse` at line 1384 is REUSED (not redeclared); the second `@keyframes pulse` text match in the file is in a CSS comment referencing the existing declaration.
- CSS brace balance maintained: 798 open / 798 close.

### Task 4: Wire pill state machine in `ui/options.js`
**Commit:** `e2fcaa6`
**Files:** `ui/options.js`

- Added 115 lines (function block at lines 5988-6101 plus 5-line wrapper hook at lines 3099-3103 plus 2-line prime call at lines 506-507) implementing:
  - `initializeSyncSection()` with idempotent `_syncSectionInitialized` flag.
  - `chrome.runtime.sendMessage({ action: 'getRemoteControlState' }, callback)` for replay-on-attach. Reads `chrome.runtime.lastError` defensively in the callback so the JS console stays clean if 213-02 has not registered the action yet (CONTEXT D-25). Accepts both `{ state }` envelope and bare payload shapes.
  - `chrome.runtime.onMessage.addListener` subscribing to `remoteControlStateChanged` runtime push (CONTEXT D-17) — updates `_syncLastRemoteControlState` and refreshes the pill.
  - `_deriveSyncPillState()` implementing CONTEXT D-19 derivation logic exactly:
    1. `remoteControlState.enabled === true` -> `remote-active`
    2. else WS open AND `serverHashKey` value set -> `connected`
    3. else `#pairingQROverlay` visible -> `connecting`
    4. else -> `disconnected`
  - `_SYNC_PILL_LABELS` map with verbatim D-15 strings: `Connected`, `Connecting...`, `Disconnected`, `Remote control active`.
  - `_applySyncPillState()` whitelists state to one of the four known keys and falls through to `disconnected` for unknown inputs (T-213-01-02 mitigation).
  - Helpers `_isPairingOverlayVisible`, `_hasServerHashKey`, `_wsIsOpen` (defensive `typeof dashboardState !== 'undefined'` guard since `dashboardState` does not currently expose a `wsConnected` field — this gracefully evaluates to `false`).
- Hooked into the wrapped `switchSection` at line 3082 by adding a `sectionId === 'sync'` branch alongside the existing `passwords` / `memory` / `payments` branches.
- Primed once from `initializeSections()` at line 506 so the pill has a value even if the user lands on a non-Sync section first.
- Existing pairing wiring at `ui/options.js:4189-4205` (sunset notice render — Phase 212 D-15) and at the `btnPairDashboard` registration block (now at lines 4271-4275, which was `:4264` pre-edit; shifted by 7 due to the empty Sync section insert above) is byte-for-byte unchanged.
- `node --check ui/options.js` passes.

## Line Range Map (after all four commits)

| File | Range | Content |
|------|-------|---------|
| `ui/control_panel.html` | 58-61 | API Configuration nav-item (existing) |
| `ui/control_panel.html` | 62-65 | Sync nav-item (NEW) |
| `ui/control_panel.html` | 66-69 | Background-agents nav-item (existing) |
| `ui/control_panel.html` | 567-628 | `<section id="sync">` (NEW) — section header + relocated Server Sync card |
| `ui/control_panel.html` | 631-677 | `<section id="background-agents">` body — deprecation card + sunset notice ONLY |
| `ui/options.css` | 5048-5128 | `.sync-section-header` + `.sync-status-pill` rules (NEW) |
| `ui/options.js` | 506-507 | `initializeSyncSection()` prime call inside `initializeSections()` |
| `ui/options.js` | 3099-3103 | `sectionId === 'sync'` branch inside wrapped `switchSection` |
| `ui/options.js` | 5988-6101 | Pill state machine block (NEW) |
| `ui/options.js` | 4189-4216 | Sunset notice render (Phase 212 D-15) — UNCHANGED |
| `ui/options.js` | 4271-4275 | btnPairDashboard wiring (Phase 210 / 212 D-15) — UNCHANGED |

## Server Sync ID Preservation Audit

All 12 IDs verified via grep. Each row shows the `grep -c 'id="<ID>"' ui/control_panel.html` count.

| ID | Count | Lives Inside |
|----|-------|--------------|
| serverUrl | 1 | `<section id="sync">` |
| serverHashKey | 1 | `<section id="sync">` |
| btnGenerateHashKey | 1 | `<section id="sync">` |
| btnCopyHashKey | 1 | `<section id="sync">` |
| btnPairDashboard | 1 | `<section id="sync">` |
| pairingQROverlay | 1 | `<section id="sync">` |
| btnCancelPairing | 1 | `<section id="sync">` |
| pairingQRCode | 1 | `<section id="sync">` |
| pairingCountdown | 1 | `<section id="sync">` |
| pairingQRMessage | 1 | `<section id="sync">` |
| btnTestConnection | 1 | `<section id="sync">` |
| connectionStatus | 2 | one in `<section id="sync">`, one pre-existing in dashboard header at line 27 (out of scope) |

## Background Agents Section Body Audit (Post-Move)

`<section class="content-section" id="background-agents">` (lines 631-677) now contains:
1. `.section-header` with `<h2>Background Agents</h2>` + retired-feature paragraph (Phase 212)
2. `.fsb-deprecation-card` with OpenClaw + Claude Routines CTAs (Phase 212)
3. `<aside id="fsbSunsetNotice" hidden>` for the previous-agents names list (Phase 212)

Server Sync DOM, h3, and all 12 IDs are absent from this section. D-08 satisfied.

## Deviations from Plan

None — plan executed exactly as written. The only Claude's-discretion choice resolved differently from CONTEXT D-13 (Tailwind blue `#3b82f6` for `remote-active`) used `var(--info-color)` instead, but this substitution was explicitly authorized by both CONTEXT D-14 ("use existing settings/badge color tokens where possible") and the pre-locked UI-SPEC.md (which spelled out the substitution and its rationale: free dark-mode parity via `[data-theme="dark"]` overrides at `options.css:103-110`). Not a deviation — a planner-locked choice.

## Open Questions for 213-02 / 213-03

None. All file boundaries are disjoint per D-26:
- 213-02 owns `background.js` + `ws/ws-client.js` + tests + package.json. The Sync tab JS in this plan tolerates 213-02 absence (the `getRemoteControlState` action call falls through to "unknown -> disconnected" via `chrome.runtime.lastError` suppression — D-25).
- 213-03 owns showcase copy (`showcase/dashboard.html`, `showcase/angular/...`, `showcase/js/dashboard.js`). No file overlap.

## Self-Check: PASSED

Verified the following:

- File `ui/control_panel.html` exists: FOUND
- File `ui/options.css` exists: FOUND
- File `ui/options.js` exists: FOUND
- Commit `c75bd75` (Task 1): FOUND
- Commit `4f70f36` (Task 2): FOUND
- Commit `dc4f26a` (Task 3): FOUND
- Commit `e2fcaa6` (Task 4): FOUND
- All 12 Server Sync IDs preserved (grep counts above): PASS
- `<section id="background-agents">` body contains only Phase 212 artifacts: PASS
- `node --check ui/options.js` clean: PASS
- All 4 plan-level success criteria met: PASS
