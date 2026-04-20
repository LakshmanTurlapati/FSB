# Roadmap: FSB (Full Self-Browsing)

## Active Milestone: None (v0.9.33 shipped)

## Phases

- [x] **Phase 186: Canonical Surface Determination** - Designate one dashboard.js as canonical, delete legacy-vanilla duplicate
- [x] **Phase 187: Task Lifecycle Bridge** - Wire task completions and per-iteration progress from extension to dashboard via WebSocket
- [x] **Phase 188: DOM Stream Forwarding Bridge** - Add 6 missing case handlers to forward domStream messages to dashboard
- [x] **Phase 189: Dashboard Result UI** - Structured result card, live action feed, AI summary display
- [x] **Phase 190: Stream Quality & Resilience** - Disconnect freeze, auto-restart, timeout alignment, completion freeze

## Phase Details

### Phase 186: Canonical Surface Determination
**Goal**: One dashboard.js is the single source of truth, tests target it
**Depends on**: Nothing (first phase)
**Requirements**: SURF-01, SURF-02
**Success Criteria** (what must be TRUE):
  1. Exactly one dashboard.js file is designated canonical (other archived/deleted)
  2. Test suite exercises the canonical dashboard file, not the non-canonical one
  3. A developer can identify which dashboard.js to modify within 10 seconds
**Plans:** 1 plan

Plans:
- [x] 186-01-PLAN.md -- Copy missing JS to canonical dir, delete legacy-vanilla, fix test imports

### Phase 187: Task Lifecycle Bridge
**Goal**: Task completions, failures, and per-iteration progress reach the dashboard
**Depends on**: Phase 186
**Requirements**: PIPE-02, PIPE-03, PIPE-04
**Success Criteria** (what must be TRUE):
  1. Dashboard receives ext:task-complete with status, summary, action count, cost, final URL, page title
  2. Each agent-loop iteration sends ext:task-progress with current action and iteration count
  3. broadcastDashboardProgress forwards progress to connected dashboard clients via fsbWebSocket
  4. After WebSocket reconnect mid-task, dashboard receives recovery snapshot with current/recent task state
**Plans:** 2 plans

Plans:
- [x] 187-01-PLAN.md -- Implement broadcastDashboardProgress and tag dashboard sessions
- [x] 187-02-PLAN.md -- Wire automationComplete interception and recovery snapshot

### Phase 188: DOM Stream Forwarding Bridge
**Goal**: Live DOM preview data flows from content script through background.js to dashboard
**Depends on**: Phase 186
**Requirements**: PIPE-01
**Success Criteria** (what must be TRUE):
  1. Snapshot, mutation, scroll, overlay, dialog messages each have a case handler forwarding to fsbWebSocket
  2. Dashboard DOM preview iframe renders current page content when task is running
  3. domStreamReady message is handled (not dropped by default case)
**Plans:** 1 plan

Plans:
- [x] 188-01-PLAN.md -- Add 6 domStream case handlers forwarding to ext:dom-* via fsbWebSocket

### Phase 189: Dashboard Result UI
**Goal**: Users see structured task results and live action feedback on the dashboard
**Depends on**: Phase 187, Phase 188
**Requirements**: DRES-01, DRES-02, DRES-03
**Success Criteria** (what must be TRUE):
  1. Completed task displays result card with status badge, action count, elapsed time, cost, final URL
  2. Scrolling mini-log shows recent actions during execution
  3. Result card includes AI-generated summary text
  4. Failed/partial tasks show distinct status badge
**Plans:** 1 plan

Plans:
- [x] 189-01-PLAN.md -- Structured result card, scrolling action feed, AI summary rendering

### Phase 190: Stream Quality & Resilience
**Goal**: DOM preview stream handles disconnects, reconnects, timeouts, and completion gracefully
**Depends on**: Phase 188
**Requirements**: STRM-01, STRM-02, STRM-03, STRM-04
**Success Criteria** (what must be TRUE):
  1. DOM preview freezes on last frame when WebSocket disconnects (does not clear)
  2. DOM stream auto-restarts after WebSocket reconnection
  3. Dashboard timeout matches extension safety limit (10 minutes)
  4. Preview freezes on task completion showing final page state
**Plans:** 1 plan

Plans:
- [x] 190-01-PLAN.md -- Preview freeze overlays, reconnect auto-restart, timeout alignment to 10 min

## Progress

**Execution Order:** 186 -> 187 + 188 (parallel) -> 189 (after both) -> 190 (after 188)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 186. Canonical Surface Determination | 1/1 | Complete | 2026-04-19 |
| 187. Task Lifecycle Bridge | 2/2 | Complete | 2026-04-19 |
| 188. DOM Stream Forwarding Bridge | 1/1 | Complete | 2026-04-19 |
| 189. Dashboard Result UI | 1/1 | Complete | 2026-04-20 |
| 190. Stream Quality & Resilience | 1/1 | Complete | 2026-04-20 |

## Previous Milestones

<details>
<summary>v0.9.33 Dashboard Task Results & Stream Quality (shipped 2026-04-20)</summary>

5 phases (186-190), 6 plans. Canonical dashboard surface, task lifecycle bridge, DOM stream forwarding, structured result card with action feed, stream quality with frozen overlays. Post-milestone: ported all features to Angular production dashboard, bridged agent-loop analytics to BackgroundAnalytics for control panel metrics, fixed page title.

</details>

<details>
<summary>v0.9.32 Fixx (shipped 2026-04-19)</summary>

6 phases (180-185), 13 plans. Diagnosed and repaired autopilot regressions. Re-enabled modular agent-loop.js, restored safety limits, fixed 7 CDP tools, deleted dead code, synced CLI pipeline, verified all 49 tools.

</details>

<details>
<summary>v0.9.31 Dashboard & MCP Repair (shipped 2026-04-18)</summary>

Started but no phases completed. Superseded by v0.9.32 Fixx.

</details>

<details>
<summary>v0.9.30 MCP Platform Install Flags (shipped 2026-04-18)</summary>

3 phases (174-176), 6 plans. Platform registry, config engine, install/uninstall CLI.

</details>

## Backlog

### Phase 999.1: MCP Tool Gaps & Click Heuristics (BACKLOG)

**Goal:** Fix three MCP tool issues surfaced during LinkedIn automation.
**Depends on**: Nothing (independent backlog fix)
**Requirements**: MCP-ROUTE-01, MCP-EXEC-01, MCP-CLICK-01, MCP-CLICK-02
**Plans:** 2/2 plans complete
