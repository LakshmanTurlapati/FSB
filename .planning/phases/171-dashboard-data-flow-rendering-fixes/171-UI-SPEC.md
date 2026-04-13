---
phase: 171
slug: dashboard-data-flow-rendering-fixes
status: approved
reviewed_at: 2026-04-12
shadcn_initialized: false
preset: none
created: 2026-04-12
---

# Phase 171 -- UI Design Contract

> Visual and interaction contract for the Dashboard Data Flow & Rendering Fixes phase. This is a **bug-fix-only phase** -- no new UI components or visual changes are introduced. The contract documents the existing design system that MUST be preserved and the data-state rendering rules that must hold after the fixes.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (vanilla Chrome extension) |
| Icon library | inline emoji glyphs (existing) |
| Font | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif` (system stack) |

Source: `shared/fsb-ui-core.css` and `ui/options.css` -- established in Phase 140, unchanged by this phase.

---

## Spacing Scale

**Global scale (checker-evaluable):**

| Token | Value | CSS Variable | Usage |
|-------|-------|-------------|-------|
| xs | 4px | `--fsb-space-1` | Icon gaps, inline padding |
| sm | 8px | `--fsb-space-2` | Compact element spacing |
| md | 16px | `--fsb-space-4` | Default element spacing |
| lg | 24px | `--fsb-space-6` | Section padding |
| xl | 32px | `--fsb-space-8` | Layout gaps |
| 2xl | 48px | `--fsb-space-12` | Major section breaks |

All values are multiples of 4. This is the authoritative spacing scale for this phase.

> **Existing system note:** The dashboard container in `ui/options.css` defines its own rem-based spacing overrides (`--space-xs` through `--space-2xl`) and a `--dashboard-icon-box-size: 40px` token. These are pre-existing values established in prior phases and are **read-only -- not changed by this phase**. They are documented in `ui/options.css` and are out of scope for this contract. See `ui/options.css` `.dashboard-container` for the full reference.

---

## Typography

**typography_mode: existing-system-documented**

This phase introduces NO typography changes. The full existing type scale was established in prior phases and is preserved as-is. It is out of scope for modification.

**Primary type scale (4 sizes used in dashboard metrics and headings):**

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 15px | 400 | 1.5 |
| Heading | 17px | 700 | 1.2 |
| Heading large | 21px | 700 | 1.2 |
| Metric display | 33px | 700 | 1.0 |

Weights used: 400 (regular), 700 (bold).

> **Existing system note:** The dashboard type system in `ui/options.css` includes additional intermediate sizes (11px, 13px, 14px, 28px) for body-small, body-medium, heading-small, and heading-xl roles. These are pre-existing values established in prior phases and are **read-only -- not changed by this phase**. The full scale is documented in `ui/options.css` `.dashboard-container` and is out of scope for this contract.

Monospace font for setting values: `'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace` (`--font-mono`).

---

## Color

Existing color system from `shared/fsb-ui-core.css`. No changes in this phase.

| Role | Value (Light) | Value (Dark) | Usage |
|------|---------------|--------------|-------|
| Dominant (60%) | `#fffdfb` (--fsb-surface-base) | `#141110` | Page background |
| Secondary (30%) | `#ffffff` (--fsb-surface-elevated) | `#1a1513` | Cards, elevated surfaces |
| Accent (10%) | `#ff6b35` (--fsb-primary) | `#ff6b35` | Primary CTA buttons, active nav items, chart accent, setting value badges |
| Destructive | `#dc2626` (--fsb-danger) | `#dc2626` | Error states only |
| Success | `#10b981` (--fsb-success) | `#10b981` | Positive metric indicators |
| Warning | `#f59e0b` (--fsb-warning) | `#f59e0b` | Warning alerts |
| Info | `#0891b2` (--fsb-info) | `#0891b2` | Informational badges |

Accent reserved for: active sidebar nav item background, primary action buttons, chart line/fill color, setting value display badges, icon box backgrounds, focus ring glow.

---

## Data State Rendering Contract

This is the critical section for Phase 171. The fixes ensure these states render correctly.

### State: Fresh Data Available

When `fsbUsageData` exists in `chrome.storage.local` with recorded sessions:

| Element | Renders | Format |
|---------|---------|--------|
| Total cost metric | Dollar amount | `$X.XX` |
| Total tokens metric | Token count | Comma-separated integer |
| Total requests metric | Request count | Integer |
| Usage chart (Chart.js) | Line/bar chart with data points | Time-range-filtered data |
| Cost breakdown items | Per-model cost rows | `$X.XX` per model name |
| Time range labels | Period labels next to metrics | "Today" / "7 Days" / "30 Days" |

### State: No Data (D-02 -- locked decision)

When `fsbUsageData` is empty or absent from storage:

| Element | Renders | Value |
|---------|---------|-------|
| Total cost metric | Zero | `$0.00` |
| Total tokens metric | Zero | `0` |
| Total requests metric | Zero | `0` |
| Usage chart | Empty chart (no data points, axes still visible) | Chart.js instance with empty dataset |
| Cost breakdown items | Zero values or empty list | `$0.00` for each model or no rows |
| Time range labels | Labels still present | "Today" / default range text |

NO placeholder text. NO "No data yet" message. NO illustration. Show zeros. Source: D-02 in CONTEXT.md.

### State: Data Arrives While Off-Screen (D-01, D-05 -- locked decisions)

When `ANALYTICS_UPDATE` or `chrome.storage.onChanged` fires while user is on a non-dashboard section:

| Behavior | Detail |
|----------|--------|
| Visible change | None -- user sees their current section unchanged |
| Internal state | `dashboardState.analyticsNeedsRefresh` set to `true` |
| On switch to dashboard | `refreshAnalyticsDashboard()` called, flag cleared, dashboard re-renders with fresh data |

### State: Data Arrives During Init Race (D-03)

When `ANALYTICS_UPDATE` arrives before `analytics.initPromise` resolves:

| Behavior | Detail |
|----------|--------|
| Visible change | Delayed -- data appears after init completes |
| Internal state | `refreshAnalyticsDashboard()` awaits `initPromise` instead of returning early |
| No crash | Function does not throw; awaits cleanly |

### State: DOM Elements Missing (D-04)

When `updateTimeRangeLabels()` runs but `#totalTokensToday` or `#totalCostToday` are not in the DOM:

| Behavior | Detail |
|----------|--------|
| Visible change | Labels are simply not updated (graceful no-op) |
| No crash | Optional chaining (`?.`) prevents `TypeError` |
| Console output | No error logged |

---

## Copywriting Contract

| Element | Copy | Source |
|---------|------|--------|
| Primary CTA | None -- this phase has no user-facing actions | Phase scope |
| Empty state heading | None -- zeros are shown, not a heading | D-02 |
| Empty state body | None -- zeros are shown, not explanatory text | D-02 |
| Error state | No new error states introduced | Phase scope |
| Destructive confirmation | No destructive actions in this phase | Phase scope |

### Existing Copy Preserved (no changes)

| Element | Existing Copy |
|---------|---------------|
| Cost metric label | `$0.00` (zero state) |
| Token metric label | `0` (zero state) |
| Request metric label | `0` (zero state) |
| Chart time range options | "24h" / "7d" / "30d" (existing `<select>` values) |
| Cost breakdown section header | Existing text preserved as-is |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Not applicable | No component registries | Not applicable -- vanilla CSS/JS Chrome extension |

---

## Interaction Contract

This phase introduces no new interactions. Existing interactions preserved:

| Interaction | Behavior After Fix |
|-------------|-------------------|
| Switch to dashboard section | If dirty flag is set, dashboard refreshes with latest data; flag is cleared |
| Change chart time range (`<select>`) | Chart re-renders with filtered data (existing, unchanged) |
| Page load with stored data | Chart and metrics render immediately after init resolves (existing, now reliable) |
| ANALYTICS_UPDATE while on dashboard | Dashboard refreshes in place (existing, unchanged) |
| ANALYTICS_UPDATE while off dashboard | Dirty flag set; refresh deferred to section switch (new behavior, invisible mechanism) |

---

## Visual Regression Boundaries

The following CSS and DOM structures MUST NOT be modified by this phase:

| File | Scope | Reason |
|------|-------|--------|
| `shared/fsb-ui-core.css` | All tokens | Global design tokens -- no changes permitted |
| `ui/options.css` | All rules | Dashboard styling -- no changes permitted |
| `options.html` | All markup | Dashboard DOM structure -- no changes permitted |
| `utils/analytics.js` | `initializeChart()` | Chart.js setup -- out of scope per CONTEXT.md |
| `utils/analytics.js` | `updateChart()` | Chart rendering -- out of scope |

Only permitted modifications:
- `utils/analytics.js` lines 727-728: add `?.` operator (two characters per line)
- `ui/options.js` line 74 area: add `analyticsNeedsRefresh: false` property
- `ui/options.js` line 228 area: change `function` to `async function`, add `await analytics.initPromise`
- `ui/options.js` line 530 area: add dirty flag set in storage listener
- `ui/options.js` line 563 area: add dirty flag set in message listener
- `ui/options.js` line 570 area: add dirty flag check in `switchSection()`

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
