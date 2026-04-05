---
phase: 142-control-panel-dashboard-retouch
plan: 02
subsystem: ui/dashboard-utilities
tags: [ui, dashboard, server-sync, docs, qr, naming]
dependency_graph:
  requires: [plan-142-01]
  provides: [cleaner-pairing-flow, docs-surface-polish, dashboard-naming-consistency]
  affects: [ui/control_panel.html, ui/options.css, ui/options.js, README.md]
tech_stack:
  added: []
  patterns: [utility-surface-polish, safer-information-disclosure, docs-link-alignment]
key_files:
  created: []
  modified:
    - ui/control_panel.html
    - ui/options.css
    - ui/options.js
    - README.md
decisions:
  - The server endpoint URL does not need to be surfaced in the dashboard UI
  - Pairing should emphasize the QR visually instead of small utility text
  - Help onboarding should point to the canonical FSB web properties, not repo-first flows
metrics:
  completed: "2026-04-02T09:05:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 142 Plan 02: Dashboard Utility Surface Polish Summary

**One-liner:** Polished dashboard utility surfaces by hiding the raw server endpoint, enlarging the pairing QR flow, updating docs/help links, and unifying user-facing naming.

## What Was Done

### Task 1: Clean up server sync pairing
- Removed the visible server endpoint from the control panel display
- Enlarged the pairing QR modal and rendered the QR code significantly bigger for practical scanning
- Kept the pairing flow intact while making it feel more productized

### Task 2: Align help and documentation surfaces
- Updated `Getting Started` links to use `https://full-selfbrowsing.com`
- Added the privacy policy destination at `https://full-selfbrowsing.com/privacy.html`
- Mirrored those docs/help changes in the README where appropriate

### Task 3: Unify dashboard naming
- Renamed `Site Explorer` to `Reconnaissance` in the control panel
- Corrected associated toasts/log text so the surface language stays consistent
- Preserved underlying implementation identifiers where renaming them would have been unnecessary churn

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1-3 | 2dbc609 | feat(141): UI polish pass - popup, sidepanel, options, control panel |

## Verification Results

- Pairing QR popup now presents a large, scan-friendly QR without showing the raw endpoint URL -- PASS
- Help & Documentation surfaces now point to the live FSB website and privacy policy -- PASS
- User-facing dashboard labels no longer mix `Site Explorer` with the newer `Reconnaissance` terminology -- PASS

## Deviations from Plan

- The roadmap originally described this work as a generic dashboard polish plan; the implemented work ended up being concentrated in the utility surfaces users actually interacted with most.

## Known Stubs

- No automated visual regression exists for the dashboard utility surfaces; validation remained manual.

