---
phase: 212
plan: 03
subsystem: showcase
tags: [agents, deprecation, showcase, dashboard, angular, vanilla, mirror, _lz, remote-control-state, AGENTS-04]
requires:
  - showcase/dashboard.html (vanilla dashboard template)
  - showcase/angular/src/app/pages/dashboard/dashboard-page.component.html
  - showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts
  - showcase/angular/src/app/pages/home/home-page.component.html
  - showcase/js/dashboard.js
  - tests/agent-sunset-back-end.test.js (precedent)
  - tests/agent-sunset-control-panel.test.js (precedent)
provides:
  - Showcase mirror of agents sunset (home + both dashboards)
  - Per-line // commenting of agent-only contiguous blocks in showcase JS + Angular TS
  - Byte-for-byte LIVE preservation of _lz decompression and ext:remote-control-state consumers
  - Regression test asserting AGENTS-04 + D-19 preservation invariants
affects:
  - showcase/angular/src/app/pages/home/home-page.component.html
  - showcase/dashboard.html
  - showcase/angular/src/app/pages/dashboard/dashboard-page.component.html
  - showcase/js/dashboard.js
  - showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts
  - tests/agent-sunset-showcase.test.js (new)
  - package.json (test chain)
tech-stack:
  added: []
  patterns:
    - Per-line // commenting (D-13 fallback per D-14)
    - Canonical deprecation annotation header
    - String-anchored Edit operations (post Phase 211 line shifts)
    - Python-driven multi-block commenting with brace-balance verification
    - containsLive() regex helper for non-commented substring assertion
key-files:
  created:
    - tests/agent-sunset-showcase.test.js
  modified:
    - showcase/angular/src/app/pages/home/home-page.component.html
    - showcase/dashboard.html
    - showcase/angular/src/app/pages/dashboard/dashboard-page.component.html
    - showcase/js/dashboard.js
    - showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts
    - package.json
decisions:
  - AGENTS-04 delivered via copy-mirror of 212-02 control panel deprecation card
  - HTML agent blocks REPLACED (not commented) per plan; JS/TS agent code commented per-line
  - D-19 preservation enforced byte-for-byte in regression test using containsLive() helper
  - Cleanup tracking flag (private destroyed = false) explicitly preserved as non-agent infra
metrics:
  duration_seconds: 1054
  duration_human: "~17 minutes"
  tasks_completed: 4
  files_modified: 6
  files_created: 1
  commits: 4
  completed: 2026-04-29
---

# Phase 212 Plan 03: Showcase Mirror of Background-Agents Sunset Summary

Mirrored the agents-sunset messaging across the FSB showcase surfaces (home feature card + vanilla dashboard.html + Angular dashboard-page.component.html) and commented the agent-only code paths in both showcase/js/dashboard.js and dashboard-page.component.ts while preserving Phase 209 / Phase 211 transport contracts (`_lz` decompression and `ext:remote-control-state` consumer) byte-for-byte LIVE.

## Decision Coverage

- **AGENTS-04: DELIVERED**
  - Home-page Background Agents feature card replaced with sunset/relocation card naming OpenClaw + Claude Routines (`fa-flag-checkered` icon, both inline `<a>` links carry `rel="noopener noreferrer"`).
  - Vanilla `showcase/dashboard.html` agent UI block (header `Your Agents`, agent count badge, New Agent button, stat-agents card, dash-agent-container, dash-agent-modal-overlay, dash-delete-overlay) REPLACED with single sunset card section. Header renamed `FSB Dashboard`. Preview, paired badge, SSE status, and task panels PRESERVED.
  - Angular `dashboard-page.component.html` mirror of the same replacement.
  - 42 commented agent blocks in `showcase/js/dashboard.js` (annotated). 48 commented agent blocks in `dashboard-page.component.ts` (annotated). Both files parse cleanly.
- **D-19: BYTE-FOR-BYTE PRESERVED** (regression-tested)
  - `showcase/js/dashboard.js` `if (envelope._lz && envelope.d && typeof LZString !== 'undefined') {` LIVE on a non-`//`-prefixed line (now at line 3554 post line shifts).
  - `showcase/js/dashboard.js` `if (msg.type === 'ext:remote-control-state') {` LIVE on a non-`//`-prefixed line (now at line 3850).
  - `dashboard-page.component.ts` `_lz` branch LIVE.
  - `dashboard-page.component.ts` full one-line `if (msg.type === 'ext:remote-control-state') { this.renderRemoteControlState(msg.payload || {}); return; }` LIVE byte-for-byte.

## Sunset Card Copy (Landed)

### Home page feature card

```html
<!-- DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md -->
<div class="feature-card reveal delay-1">
  <div class="feature-icon"><i class="fa-solid fa-flag-checkered"></i></div>
  <h3>Background Agents Retired</h3>
  <p>Scheduling and recurring task work moved to tools built for it. Try <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noopener noreferrer">OpenClaw</a> for an open-source agent loop, or <a href="https://www.anthropic.com/claude/routines" target="_blank" rel="noopener noreferrer">Claude Routines</a> for managed long-running automations. FSB stays focused on precise single-attempt browser execution.</p>
</div>
```

### Vanilla + Angular dashboard sunset card (identical content)

```html
<!-- DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md -->
<section class="dash-section dash-section-card" id="dash-agents-sunset">
  <div class="dash-empty-state">
    <h3>Background agents have moved.</h3>
    <p>FSB no longer ships scheduled or recurring agent runs. For that work, the recommended successors are <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noopener noreferrer">OpenClaw</a> (open-source agent loop) and <a href="https://www.anthropic.com/claude/routines" target="_blank" rel="noopener noreferrer">Claude Routines</a> (managed long-running automations). The dashboard above continues to show live remote-control state and DOM streaming for one-shot task execution.</p>
    <p class="dash-empty-state-footer"><small>Retired in v0.9.45rc1 (April 2026)</small></p>
  </div>
</section>
```

Tone matches the planner-drafted founder/dry voice. No emojis. Reviewer can tweak in PR per D-03.

## Commits

| Task | Hash      | Description                                                                                                                |
| ---- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1    | f18ee9f   | feat(212-03): replace home-page Background Agents feature card with sunset messaging (AGENTS-04)                           |
| 2    | 5b16278   | feat(212-03): replace agent UI in showcase/dashboard.html + dashboard-page.component.html with sunset card (AGENTS-04)     |
| 3    | 00562be   | refactor(212-03): comment agent-related blocks in showcase/js/dashboard.js + dashboard-page.component.ts; preserve _lz + ext:remote-control-state (AGENTS-04) |
| 4    | dc114a5   | test(212-03): add showcase mirror regression test (AGENTS-04, D-19 preservation)                                           |

## Annotation Counts (per file)

| File                                                                          | Annotations |
| ----------------------------------------------------------------------------- | ----------- |
| showcase/angular/src/app/pages/home/home-page.component.html                  | 1           |
| showcase/dashboard.html                                                       | 1           |
| showcase/angular/src/app/pages/dashboard/dashboard-page.component.html        | 1           |
| showcase/js/dashboard.js                                                      | 42          |
| showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts          | 48          |

The 42/48 counts match roughly the ~226/~221 grepped agent-reference counts coalesced into ~10-30 contiguous blocks each (per planner estimate).

## TypeScript Baseline

- **Pre-Phase-212 baseline** (recorded BEFORE Task 3 edits): `0` errors in `dashboard-page.component.ts` from `npx tsc --noEmit` (filtered to that file with `error TS` substring).
- **Post-Task-3 count**: `0` errors -- matches baseline. No new errors introduced.

Two transient mid-task issues were caught and fixed before commit (commented-out `}` braces from `showScanError`/`handleWSMessage` and the unrelated `private destroyed = false;` cleanup-tracking field). Final commit is clean.

## Test Results

### Phase 212-03 regression test (`tests/agent-sunset-showcase.test.js`)

```
PASS - AGENTS-04 home-page sunset card present (headline + both successors + rel=noopener noreferrer x2)
PASS - AGENTS-04 showcase/dashboard.html: sunset card present, agent UI removed, preview + paired + sse PRESERVED
PASS - AGENTS-04 Angular dashboard sunset card present, agent UI removed
PASS - D-19 _lz decompression LIVE byte-for-byte in both showcase/js/dashboard.js and dashboard-page.component.ts
PASS - D-19 ext:remote-control-state LIVE byte-for-byte in both showcase/js/dashboard.js and dashboard-page.component.ts
PASS - AGENTS-04 no emojis in modified showcase HTML/template files

All Phase 212-03 regression checks PASSED
```

Exit 0. All 6 sections green.

### Phase 209 / 210 / 211 / 212-01 regression checks (still passing)

| Test                                  | Result | Notes                                                       |
| ------------------------------------- | ------ | ----------------------------------------------------------- |
| `dashboard-runtime-state.test.js`     | PASS   | 57 passed, 0 failed (Phase 209 contract intact)             |
| `ws-client-decompress.test.js`        | PASS   | All assertions passed (Phase 211-01 contract intact)        |
| `qr-pairing.test.js`                  | PASS   | All assertions passed (Phase 210 contract intact)           |
| `agent-sunset-back-end.test.js`       | PASS   | All Phase 212-01 regression checks PASSED                   |

The four blocks called out in CONTEXT D-19 stayed byte-for-byte LIVE -- confirmed by both `git diff` inspection (lines surrounding the original positions in the source files were not commented) and the new test's `containsLive()` assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inadvertent commenting of `showScanError` closing `}` and `handleWSMessage` closing `}`**

- **Found during:** Task 3 verification (`npx tsc --noEmit` returned 2 errors at lines 2508 and 3489 — the first live class members after the over-eager block commenting).
- **Issue:** The "DATA LOADING section" and "POLLING FALLBACK section" block boundaries used `section_start - 2` to capture the section header comment, but the line at `section_start - 2` was actually the closing `}` of the preceding live function (`showScanError` and `handleWSMessage` respectively). Per-line `//` prefixing turned `}` into `// }`, breaking the class brace balance.
- **Fix:** Detected by post-commenting `npx tsc --noEmit` check. Identified the two specific `// }` lines that sat just above section dividers and uncommented them; removed the spurious DEPRECATED annotations that had been inserted above them.
- **Files modified:** `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts`
- **Commit:** Folded into Task 3's commit `00562be` (caught before commit during the integrated TS verification step).

**2. [Rule 1 - Bug] `private destroyed = false;` (cleanup tracking field) caught up in agent-mgmt ref block**

- **Found during:** Task 3 verification (`npx tsc --noEmit` returned 3 errors referencing a missing `destroyed` property after the first fix).
- **Issue:** The "Agent management/Modal/Delete/Save-as DOM ref fields" block was sized as `(newAgentBtn..resizeObserver - 2)`. The `- 2` was meant to stop just before `resizeObserver` (one blank line before it), but the cleanup-tracking comment + `private destroyed = false;` field landed inside that range.
- **Fix:** Detected by `npx tsc --noEmit`. Located the `// Cleanup tracking` comment and `// private destroyed = false;` field, restored both as live (kept the `// Cleanup tracking` as an actual comment, not as code).
- **Files modified:** `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts`
- **Commit:** Folded into Task 3's commit `00562be`.

### Auth Gates / Architectural Changes

None.

## Threat Model Coverage

All four HIGH-severity Tampering threats from the plan's `<threat_model>` are covered by the regression test:

| Threat ID    | Mitigation Site                                                        | Test Section |
| ------------ | ---------------------------------------------------------------------- | ------------ |
| T-212-03-01  | Sunset CTA links carry `rel="noopener noreferrer"`                     | Sections 1, 2 |
| T-212-03-02  | `showcase/js/dashboard.js` `_lz` decompression LIVE byte-for-byte      | Section 4    |
| T-212-03-03  | `showcase/js/dashboard.js` `ext:remote-control-state` LIVE             | Section 5    |
| T-212-03-04  | `dashboard-page.component.ts` `_lz` + full `ext:remote-control-state`  | Sections 4, 5 |

## Self-Check: PASSED

Verified all claims:

- `showcase/angular/src/app/pages/home/home-page.component.html` modified: FOUND
- `showcase/dashboard.html` modified: FOUND
- `showcase/angular/src/app/pages/dashboard/dashboard-page.component.html` modified: FOUND
- `showcase/js/dashboard.js` modified: FOUND
- `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts` modified: FOUND
- `tests/agent-sunset-showcase.test.js` created: FOUND
- `package.json` modified (test wired): FOUND
- Commit `f18ee9f`: FOUND in `git log`
- Commit `5b16278`: FOUND in `git log`
- Commit `00562be`: FOUND in `git log`
- Commit `dc114a5`: FOUND in `git log`
- `node tests/agent-sunset-showcase.test.js` exits 0 with all PASS
- `node --check showcase/js/dashboard.js` exits 0
- `npx tsc --noEmit` shows 0 errors in `dashboard-page.component.ts` (matches pre-Phase-212 baseline)
- D-19 `_lz` LIVE byte-for-byte: confirmed via `containsLive()` in Section 4
- D-19 `ext:remote-control-state` LIVE byte-for-byte: confirmed via `containsLive()` in Section 5
