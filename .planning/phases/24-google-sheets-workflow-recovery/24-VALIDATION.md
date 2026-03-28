---
phase: 24
slug: google-sheets-workflow-recovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | CLI Validator (built-in options page tool, Phase 19) |
| **Config file** | test-data/ directory with golden responses |
| **Quick run command** | Manual: load extension, open options > CLI Validation, run golden tests |
| **Full suite command** | Manual: run all 24 golden tests (4 providers x 6 task types) |
| **Estimated runtime** | ~120 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Manual verification via debug logs (enable Debug Mode in extension settings)
- **After every plan wave:** Run golden test suite to ensure no regressions in CLI parsing
- **Before `/gsd:verify-work`:** Full golden test suite green + manual Sheets workflow test
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | Keyword matching | manual-only | Submit "open my google sheet", verify guide in debug logs | N/A | ⬜ pending |
| 24-01-02 | 01 | 1 | URL extraction | manual-only | Submit "fill in docs.google.com/spreadsheets/d/xxx", verify Sheets guide loads | N/A | ⬜ pending |
| 24-01-03 | 01 | 1 | Mid-session guide | manual-only | Start on new tab, navigate to Sheets, verify guide in iteration 2+ | N/A | ⬜ pending |
| 24-02-01 | 02 | 1 | Generic prompt exploration | manual-only | Start task on unknown canvas page, verify keyboard exploration | N/A | ⬜ pending |
| 24-02-02 | 02 | 1 | Canvas stuck recovery | manual-only | Get stuck on Sheets, verify recovery hints use keyboard not new tabs | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Keyword matching routes "google sheet" to Productivity Tools | Detection fix | Chrome extension UI interaction required | Load extension, submit task "open my google sheet", check debug logs for guide activation |
| URL in task text triggers guide match | Detection fix | Chrome extension UI interaction required | Submit task with Sheets URL, verify Sheets guide loads |
| Mid-session guide activates after navigation | URL freshness | Multi-iteration browser session required | Start on new tab, let AI navigate to Sheets, verify guide appears |
| Generic prompt includes exploration guidance | Safety net | Requires reading AI prompt output | Start task on unknown page, verify AI uses keyboard exploration |
| Canvas stuck recovery suggests keyboard | Safety net | Requires stuck state on canvas page | Get stuck on Sheets page, verify recovery suggests Escape/Tab/Enter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
