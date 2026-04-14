---
phase: 171
slug: dashboard-data-flow-rendering-fixes
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-14
updated: 2026-04-14
---

# Phase 171 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `background.js` -> `chrome.storage.local` | Background tracking persists usage snapshots that the UI later consumes. | Usage counters, token totals, model/cost metadata |
| `chrome.storage.local` / runtime messages -> `ui/options.js` | The operator-facing dashboard re-reads storage and reacts to `ANALYTICS_UPDATE` events. | Analytics update signals plus stored usage data |
| `ui/options.js` -> dashboard DOM helpers in `utils/analytics.js` | Refresh logic updates cards, labels, and chart state against DOM that may be partially absent during section changes or early init. | Rendered metrics, chart inputs, label text |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-171-01 | Tampering | `ui/options.js` analytics refresh lifecycle | mitigate | `refreshAnalyticsDashboard()` is async, awaits `analytics.initPromise`, then forces `analytics.loadStoredData()` before updating cards/chart, which prevents stale in-memory analytics state from controlling dashboard output. Evidence: `ui/options.js:229-247`, `tests/dashboard-analytics-refresh.test.js:32-40`. | closed |
| T-171-02 | Denial of Service | `ui/options.js` event listeners and section switching | mitigate | Off-screen analytics updates no longer drop on the floor: storage and runtime listeners set `dashboardState.analyticsNeedsRefresh`, and dashboard re-entry clears/consumes the flag before refreshing. Evidence: `ui/options.js:74-80`, `ui/options.js:535-579`, `ui/options.js:3354-3359`, `tests/dashboard-analytics-refresh.test.js:42-55`. | closed |
| T-171-03 | Denial of Service | `utils/analytics.js` `updateTimeRangeLabels()` | mitigate | Optional chaining guards the `#totalTokensToday` and `#totalCostToday` label lookups so missing nodes cannot throw and abort dashboard rendering. Evidence: `utils/analytics.js:711-712`, `tests/dashboard-analytics-refresh.test.js:57-64`. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-14 | 3 | 3 | 0 | Codex |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-14
