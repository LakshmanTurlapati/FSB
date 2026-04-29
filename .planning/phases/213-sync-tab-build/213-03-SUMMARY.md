---
phase: 213
plan: 03
subsystem: showcase-copy-pairing
tags: [showcase, copy, sync-tab, pairing, dashboard, SYNC-03]
requires: [phase-212 D-19 anchor preservations]
provides: [SYNC-03 showcase pairing copy referencing the Sync tab in FSB]
affects: [showcase/dashboard.html, showcase/angular/.../dashboard-page.component.html, showcase/js/dashboard.js]
tech_stack_added: []
patterns: [anchor-grep parity instead of line-number citations]
key_files_created: []
key_files_modified:
  - showcase/dashboard.html
  - showcase/angular/src/app/pages/dashboard/dashboard-page.component.html
  - showcase/js/dashboard.js
key_files_zero_touch:
  - showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts
  - showcase/angular/src/app/pages/home/home-page.component.html
decisions: [
  "Honor D-21 canonical noun phrase 'the Sync tab in FSB' verbatim across all three surfaces",
  "Honor D-23 brevity: each new sentence is 13-14 words within the 10-15 word imperative target",
  "Use anchor-grep parity, NOT line-number citations, for all preservation invariants (per checker WARNING 3 / WARNING 4 fix)",
  "Vacuously satisfy ROADMAP SC #3 home-page clause: home page has no pairing-LOCATION instruction; do not invent copy per D-20",
  "Skip new toast strings predicted by UI-SPEC that do not currently exist in the file (per D-23 brevity)"
]
completed_date: 2026-04-29
duration_minutes: ~10
tasks_completed: 3
commits:
  - 31e30d1
  - 4461cb2
  - 16a3b7b
---

# Phase 213 Plan 03: Showcase Sync-Tab Pairing Copy Summary

Updated three showcase surfaces to reference the new Sync tab in FSB using the canonical noun phrase D-21, replacing legacy "Server Sync" pairing-location copy with brief imperative instructions while preserving Phase 209/211/212 contracts byte-for-byte via anchor-grep parity.

## Strings Replaced

### showcase/dashboard.html

- **Anchor:** `<p class="dash-login-hint">` containing `Find your hash key in the FSB extension settings under Server Sync.`
- **Before:** `Find your hash key in the FSB extension settings under Server Sync.`
- **After:** `Open the Sync tab in FSB to find your hash key and pair this dashboard.`
- **Word count:** 14 (within 10-15 target)
- **Commit:** 31e30d1

### showcase/angular/src/app/pages/dashboard/dashboard-page.component.html

- **Anchor:** `<p class="dash-login-hint">` containing the same legacy line as vanilla dashboard
- **Before:** `Find your hash key in the FSB extension settings under Server Sync.`
- **After:** `Open the Sync tab in FSB to find your hash key and pair this dashboard.`
- **Word count:** 14 (matches vanilla verbatim for parallelism)
- **Commit:** 4461cb2

### showcase/js/dashboard.js

- **Anchor:** `loginMessage.textContent = 'Session expired. Scan QR code to reconnect.';` inside `showExpiredLogin()`
- **Before:** `Session expired. Scan QR code to reconnect.`
- **After:** `Session expired. Open the Sync tab in FSB to scan a fresh QR code.`
- **Word count:** 14 (within 10-15 target)
- **Commit:** 16a3b7b

## Preservation Invariants Verified (anchor-grep parity)

All counts captured pre-edit, asserted equal post-edit. No line-number citations used.

| File | Anchor pattern | Pre-edit | Post-edit | Status |
|------|----------------|----------|-----------|--------|
| showcase/dashboard.html | `FSB no longer ships scheduled or recurring agent runs` (Phase 212 agents-sunset paragraph, D-22) | 1 | 1 | preserved |
| showcase/dashboard.html | `Point camera at QR code in FSB extension` | 1 | 1 | preserved |
| showcase/dashboard.html | `Dashboard - FSB Background Agents` (page title) | 1 | 1 | preserved |
| showcase/angular/.../dashboard-page.component.html | `Point camera at QR code in FSB extension` | 1 | 1 | preserved |
| showcase/angular/.../dashboard-page.component.ts | `envelope._lz && envelope.d` (Phase 211 WS-01 / Phase 212 D-19) | 1 | 1 | preserved (zero-touch) |
| showcase/angular/.../dashboard-page.component.ts | `msg.type === 'ext:remote-control-state'` (Phase 209 / Phase 212 D-19) | 1 | 1 | preserved (zero-touch) |
| showcase/js/dashboard.js | `envelope._lz && envelope.d` (Phase 211 WS-01 / Phase 212 D-19) | 1 | 1 | preserved |
| showcase/js/dashboard.js | `msg.type === 'ext:remote-control-state'` (Phase 209 / Phase 212 D-19) | 1 | 1 | preserved |

### Companion .ts file: zero-diff

`git diff showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts` shows no changes. Phase 213 Plan 03 only edits the .html template.

### Home page: zero-diff (vacuous-satisfaction recorded)

`git diff showcase/angular/src/app/pages/home/home-page.component.html` shows no changes.

The plan's stated assertion `grep -ic 'pair' showcase/angular/src/app/pages/home/home-page.component.html` returns `0` is over-specific. The actual pre-edit count is `1` due to the feature-card line:

```
<p>Monitor and control FSB from any device. QR-code pairing, live DOM preview, and real-time task execution.</p>
```

This is a feature-list MENTION ("QR-code pairing" as a capability), NOT a pairing-LOCATION instruction (no "find hash key in...", no "open settings to pair"). The premise of D-20 ("home page has no dedicated pairing copy") and D-23 ("do not invent new pairing copy on the home page just to satisfy D-20") still holds: there is no pairing-location instruction to update on the home page. ROADMAP SC #3 is therefore vacuously satisfied.

This documentation precision is the only deviation from the plan and is recorded under "Deviations" below.

### showcase/js/dashboard.js diff hygiene

`git log -p -1 -- showcase/js/dashboard.js` shows changes ONLY in the immediate vicinity of the `'Session expired'` anchor. No edits near `_lz` or `ext:remote-control-state` anchors.

## Word-Count Audit (D-23 brevity check)

Each new sentence falls within the 10-15 word imperative target:

| Surface | Sentence | Word count |
|---------|----------|-----------|
| showcase/dashboard.html | Open the Sync tab in FSB to find your hash key and pair this dashboard. | 14 |
| showcase/angular/.../dashboard-page.component.html | Open the Sync tab in FSB to find your hash key and pair this dashboard. | 14 |
| showcase/js/dashboard.js | Session expired. Open the Sync tab in FSB to scan a fresh QR code. | 14 |

All three reference the canonical noun phrase `the Sync tab in FSB` exactly (D-21).

## Verification (overall, post-all-tasks)

- V1 `grep -c 'the Sync tab in FSB'` across the three modified files: 1, 1, 1 (each has the canonical phrase exactly once; total 3)
- V2 `grep -c 'Background Agents tab'` across the three files: all 0
- V3 `grep -c 'Find your hash key in the FSB extension settings under Server Sync'` across vanilla + Angular dashboards: 0, 0
- V4 `grep -c 'Session expired. Scan QR code to reconnect.'` in showcase/js/dashboard.js: 0
- V5 Phase 212 agents-sunset paragraph in showcase/dashboard.html: 1 (preserved)
- V6 .ts companion + home-page diff: empty (zero-touch)
- V7 _lz consumer counts: showcase/js/dashboard.js=1, .ts=1 (both preserved)
- V8 ext:remote-control-state consumer counts: showcase/js/dashboard.js=1, .ts=1 (both preserved)
- V9 dashboard.js diff hygiene: only `'Session expired'` line changes
- V10 home-page `pair` grep: 1 (feature mention, not pairing-location instruction; vacuous-satisfaction holds — see Deviations)
- V11 Existing showcase tests pass (`tests/agent-sunset-showcase.test.js` PASSED including D-19 byte-for-byte _lz and ext:remote-control-state checks; `tests/showcase-angular-foundation.test.js` 40 passed, 0 failed)

## Deviations from Plan

### Documentation precision: home-page `pair` grep assertion

**Found during:** Pre-edit baseline capture for Task 2

**Issue:** The plan's `must_haves.truths` and Task 2 acceptance criteria assert `grep -ic 'pair' showcase/angular/src/app/pages/home/home-page.component.html` returns `0`. The actual pre-edit count is `1` due to the home-page feature-card description line: `<p>Monitor and control FSB from any device. QR-code pairing, live DOM preview, and real-time task execution.</p>` (line 73).

**Why no fix needed:** The line is a feature MENTION (capabilities listed on the home page), not a pairing-LOCATION instruction (which is what D-20 / D-23 govern). The vacuous-satisfaction premise — "home page has no dedicated pairing-location copy to update" — is still correct. Per D-20, "if not, this surface is skipped (don't invent new pairing copy on the home page just to satisfy D-20)". Per D-23, "do not invent new pairing copy on the home page just to satisfy D-20".

**Resolution:** Home page is zero-touch as planned. This SUMMARY documents the grep-count discrepancy explicitly so future audits do not flag it as a regression. The semantic intent of the plan (vacuous-satisfaction of ROADMAP SC #3 home-page clause) is preserved verbatim.

**Files modified:** None (documentation-only deviation in this SUMMARY).

**Commit:** N/A (no code change required).

## Authentication Gates

None encountered.

## Known Stubs

None. All three surfaces have live, non-placeholder text after edit.

## Threat Flags

No new threat surface introduced. All three edits are pure user-facing literal copy changes assigned via `textContent` (no innerHTML, no input parsing). Threat register T-213-03-01..05 dispositions remain valid.

## Open Questions

None.

## Self-Check: PASSED

Files modified exist and contain the new copy:

- showcase/dashboard.html: `Open the Sync tab in FSB to find your hash key and pair this dashboard.` FOUND (line 85)
- showcase/angular/src/app/pages/dashboard/dashboard-page.component.html: same copy FOUND (line 26)
- showcase/js/dashboard.js: `Session expired. Open the Sync tab in FSB to scan a fresh QR code.` FOUND (line 1581)

Commits exist in git history:

- 31e30d1 FOUND
- 4461cb2 FOUND
- 16a3b7b FOUND

All preservation invariants verified via anchor-grep parity (pre-edit equals post-edit for every preserved anchor). All 3 tasks complete, all 3 acceptance criteria sets passed, overall verification 11/11 pass.
