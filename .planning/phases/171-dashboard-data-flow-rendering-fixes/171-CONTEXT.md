# Phase 171: Dashboard Data Flow & Rendering Fixes - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the broken analytics data pipeline in the control panel so the usage/analytics dashboard reliably reads tracked data from chrome.storage and renders it correctly. No new features — only fix existing broken wiring and crash paths.

</domain>

<decisions>
## Implementation Decisions

### Section Guard Behavior

- **D-01:** When `ANALYTICS_UPDATE` arrives while the user is on a section other than dashboard, set a dirty flag. Refresh analytics data when the user switches to the dashboard section. Do NOT call `loadStoredData()` on every update regardless of active section — wasted work. The dirty flag approach is the chosen pattern.

### No-Data State

- **D-02:** When `fsbUsageData` is empty or absent from storage, the dashboard shows zeros ($0.00, 0 tokens, 0 requests) and an empty chart. No placeholder text or "no data yet" message. Keep zeros — consistent with how the dashboard behaves as data accumulates.

### Bugs to Fix (implementation decisions locked)

- **D-03:** Fix init race: `refreshAnalyticsDashboard()` currently returns early if `analytics.initialized` is false. Any `ANALYTICS_UPDATE` arriving before init resolves is permanently dropped. Fix: await `initPromise` inside the refresh call, or move the guard to after awaiting init, or queue the dirty flag for post-init pickup.

- **D-04:** Fix null crash: `updateTimeRangeLabels()` lines 727-728 in `analytics.js` call `querySelector('#totalTokensToday').nextElementSibling` without null-checking the querySelector result. Guard each querySelector call before accessing `.nextElementSibling`.

- **D-05:** Fix section switch re-trigger: wire the dirty flag from D-01 into `switchSection()` in `options.js` — when switching to 'dashboard', if dirty flag is set, call `refreshAnalyticsDashboard()` and clear the flag.

- **D-06:** `loadDashboardCostBreakdown()` guard at line 5379 (`if (!analytics || !analytics.initialized) return`) is redundant since it's only called from `refreshAnalyticsDashboard` which already guards. Leave as-is (harmless defensive check). No change needed here.

</decisions>

<canonical_refs>
## Key Files

- `ui/options.js` — `refreshAnalyticsDashboard()` at line 228, ANALYTICS_UPDATE listener at line 564, `loadDashboardCostBreakdown()` at line 5378
- `utils/analytics.js` — `updateTimeRangeLabels()` at line 717, `loadStoredData()` at line 146, `initialize()` at line 121
- `background.js` — BackgroundAnalytics class at ~line 5123, `broadcastAnalyticsUpdate()` at ~line 10453

</canonical_refs>

<specifics>
## Key Notes for Planner

1. `loadStoredData()` in `analytics.js` is NOT stale — it calls `chrome.storage.local.get` directly every time. The data flow from background → storage is correct. The problem is the guards and race conditions on the options page side.

2. The init race window: `analytics.initPromise.then(() => { analytics.initializeChart(); refreshAnalyticsDashboard(); })` runs correctly on page load. The race is only when `ANALYTICS_UPDATE` arrives between page load and `initPromise` resolution.

3. The section guard (`dashboardState.currentSection === 'dashboard'`) at line 564 is the primary correctness issue — users will commonly be on other tabs when tasks finish.

4. Do not refactor or restructure unrelated code. Minimal targeted fixes only.

</specifics>
