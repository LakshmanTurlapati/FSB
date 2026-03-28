---
phase: 21
slug: google-sheets-cli-engine-refinement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing + CLI Validation golden tests (Phase 19) |
| **Config file** | options.html#validation (debug mode) |
| **Quick run command** | Load extension, open Google Sheets, run "fill random data" task |
| **Full suite command** | CLI Validation page golden tests + manual Sheets workflow |
| **Estimated runtime** | ~120 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Manual smoke test on Google Sheets
- **After every plan wave:** Full manual Sheets workflow (create sheet, enter headers, enter 3 rows)
- **Before `/gsd:verify-work`:** Full Sheets data entry + golden test suite green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | P21-01 | manual | Inspect session logs for ref format in iter 2+ | N/A | pending |
| 21-01-02 | 01 | 1 | P21-02 | manual | Sheets: navigate to cell, `type "test"` without ref | N/A | pending |
| 21-01-03 | 01 | 1 | P21-03 | manual | Sheets: `enter` with no ref confirms cell value | N/A | pending |
| 21-02-01 | 02 | 2 | P21-04 | manual | Force stuck (3x same action), verify CLI format preserved | N/A | pending |
| 21-02-02 | 02 | 2 | P21-05 | manual | Sheets task outputs <= 8 commands per response | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers parser changes via CLI Validation golden tests. Content script and integration changes require manual testing against live Google Sheets.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Compact refs in iter 2+ | P21-01 | Requires live DOM snapshot generation | Run 3+ iteration Sheets task, inspect session log for element format |
| Ref-less type into active cell | P21-02 | Canvas grid interaction | Navigate to cell via Name Box, issue `type "data"` without ref |
| Enter on focused element | P21-03 | Canvas grid interaction | Type cell value, issue `enter`, verify cell confirmed |
| Stuck recovery preserves CLI | P21-04 | Requires triggering stuck detection | Repeat failing action 3x, verify next AI response is CLI format |
| Action count cap | P21-05 | Requires AI response generation | Run Sheets task, check parsed action count in logs |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual test after each plan wave
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
