---
phase: 27
slug: site-explorer-markdown-snapshot-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual testing (Chrome extension, no automated test framework) |
| **Config file** | none |
| **Quick run command** | Load extension, run Site Explorer crawl on test URL |
| **Full suite command** | Crawl multiple sites (Google Sheets + generic), verify snapshots in detail view and downloaded JSON |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Load extension, crawl test URL, verify snapshot appears
- **After every plan wave:** Crawl Google Sheets + generic site, verify both display correctly
- **Before `/gsd:verify-work`:** All 4 success criteria verified manually
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | SC-1 | manual | Load extension, crawl any page, verify markdownSnapshot in pageData | N/A | ⬜ pending |
| 27-01-02 | 01 | 1 | SC-1 | manual | Check console logs for getMarkdownSnapshot fetch after getDOM | N/A | ⬜ pending |
| 27-01-03 | 01 | 1 | SC-4 | manual | Download JSON, verify markdownSnapshot field present per page | N/A | ⬜ pending |
| 27-02-01 | 02 | 1 | SC-2 | manual | Open research detail, expand page, verify collapsible pre block | N/A | ⬜ pending |
| 27-02-02 | 02 | 1 | SC-2 | manual | Verify stats line shows char count and element count | N/A | ⬜ pending |
| 27-02-03 | 02 | 1 | SC-3 | manual | Crawl Google Sheets URL, verify fsbRole elements in snapshot | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No automated test framework applies — all verification is manual via extension UI.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| collectPageData fetches getMarkdownSnapshot after getDOM, stores as pageData.markdownSnapshot | SC-1 | Chrome extension, no automated test harness | Crawl any page, check console logs for snapshot fetch, verify in downloaded JSON |
| Research detail view renders markdown snapshot in collapsible pre block per page | SC-2 | UI rendering requires visual inspection in extension popup | Open research detail, expand page, verify collapsible pre block with snapshot text |
| Google Sheets URL produces snapshot showing formula bar, name box, toolbar | SC-3 | Requires live Google Sheets page interaction | Crawl a Google Sheets URL, verify snapshot contains fsbRole elements with values |
| Downloaded research JSON includes markdownSnapshot field per page | SC-4 | Requires actual download and JSON inspection | Download JSON, search for markdownSnapshot key in each page object |

---

## Validation Sign-Off

- [ ] All tasks have manual verification instructions
- [ ] Sampling continuity: manual check after each task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
