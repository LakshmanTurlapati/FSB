---
phase: 22
slug: page-text-extraction-for-reading-tasks
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing + existing CLI Validation golden test harness |
| **Config file** | Options page > Advanced > CLI Validation |
| **Quick run command** | Browser console: `FSB.buildMarkdownSnapshot()` |
| **Full suite command** | Options page CLI Validation (golden + live modes) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `FSB.buildMarkdownSnapshot()` in browser console on test page
- **After every plan wave:** Run CLI Validation golden tests + live smoke test
- **Before `/gsd:verify-work`:** Full suite must be green + manual verification on 5+ page types
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | P22-01 | unit | `FSB.buildMarkdownSnapshot()` in console | Existing harness | ⬜ pending |
| 22-01-02 | 01 | 1 | P22-02 | unit | Inspect backtick refs in snapshot output | Manual | ⬜ pending |
| 22-01-03 | 01 | 1 | P22-03 | unit | Verify region headings on multi-region page | Manual | ⬜ pending |
| 22-01-04 | 01 | 1 | P22-06 | unit | Check output length on long page | Manual | ⬜ pending |
| 22-02-01 | 02 | 1 | P22-04 | integration | Type `readpage` in automation | Manual | ⬜ pending |
| 22-02-02 | 02 | 1 | P22-05 | integration | Type `readpage --full` in automation | Manual | ⬜ pending |
| 22-03-01 | 03 | 2 | P22-01 | integration | CLI Validation live test (any task type) | Existing harness | ⬜ pending |
| 22-03-02 | 03 | 2 | P22-07 | visual | Compare snapshot to page visual | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Self-test function `_runMarkdownSnapshotSelfTest()` — similar to existing `_runYAMLSnapshotSelfTest()`
- [ ] Test pages: verify on Amazon, Gmail, Google Search, Wikipedia, a form-heavy page

*Existing CLI Validation harness covers golden test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Text interwoven with element refs matches visual page | P22-07 | Requires human comparison of snapshot vs rendered page | Load Amazon product page, run `FSB.buildMarkdownSnapshot()`, verify text flows naturally around element refs |
| Region heading hierarchy correct | P22-03 | Region detection depends on site's semantic HTML | Load pages with nav/header/main/footer, verify `## Header`, `## Main Content`, etc. |
| readpage output useful for reading tasks | P22-04 | Quality of text extraction is subjective | Run `readpage` on a news article, verify readable output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
