# Roadmap: FSB (Full Self-Browsing)

## Milestones

- v0.9 Reliability Improvements (shipped 2026-02-14)
- v9.0.2 AI Situational Awareness (shipped 2026-02-18)
- v9.3 Tech Debt Cleanup (shipped 2026-02-23)
- v9.4 Career Search Automation (shipped 2026-02-28)
- v10.0 CLI Architecture (shipped 2026-03-15)
- v0.9.2-v0.9.4 Productivity, Memory & AI Quality (shipped 2026-03-17)
- v0.9.5 Progress Overlay Intelligence (shipped 2026-03-17)
- v0.9.6 Agents & Remote Control (shipped 2026-03-19)
- v0.9.7 MCP Edge Case Validation (shipped 2026-03-22) -- [archive](milestones/v0.9.7-ROADMAP.md)
- v0.9.8 Autopilot Refinement (shipped 2026-03-23) -- [archive](milestones/v0.9.8-ROADMAP.md)
- v0.9.8.1 npm Publishing (shipped 2026-03-27)
- v0.9.9 Excalidraw Mastery (shipped 2026-03-27)
- v0.9.10 Agent Intelligence (in progress)

## v0.9.10 Agent Intelligence

**Milestone Goal:** Make FSB's background agents production-ready — expose agent management via MCP, fix cost tracking, add scheduling flexibility, improve replay intelligence, give agents a dedicated UI in the sidepanel, and close verification gaps from v0.9.6.

**Context:** v0.9.6 shipped the core agent infrastructure (manager, scheduler, executor, server sync, replay recording) plus the full remote dashboard (relay, QR pairing, DOM cloning, remote task control). The agent scaffolding works but has gaps: MCP clients can't manage agents, cost data is hardcoded, replay timing ignores recorded durations, and the only UI is buried in the options page. Phase 44 (DOM cloning) was never formally verified. This milestone closes all of those gaps.

### Phases (v0.9.10)

- [x] **Phase 116: MCP Agent Tools** - Expose create/list/run/stop/delete agent operations as MCP tools so external clients (Claude Code, Cursor, etc.) can manage background agents (completed 2026-03-28)
- [x] **Phase 117: Cost & Metrics Pipeline** - Thread real token count and cost data from AI integration through executeAutomationTask into agent run history and recorded scripts (completed 2026-03-28)
- [x] **Phase 118: Scheduling Enhancements** - Add cron expression support, weekly schedules, retry-on-failure with exponential backoff, and persistent server sync queue (completed 2026-03-28)
- [ ] **Phase 119: Replay Intelligence** - Use recorded original action durations for replay timing, add step-level error recovery (retry individual steps before full AI fallback), track replay success rates per step
- [ ] **Phase 120: Sidepanel Agents UI** - Dedicated Agents tab in sidepanel with agent list, status indicators, run history, create/edit form, and one-click run
- [ ] **Phase 121: DOM Cloning Verification** - Formal E2E verification of Phase 44 DOM cloning stream (snapshot fidelity, mutation sync, scroll tracking, overlay positioning, iframe scaling)

### Phase 116: MCP Agent Tools
**Goal**: MCP clients can create, list, run, stop, and delete background agents without touching the extension UI
**Depends on**: Nothing (first phase)
**Requirements**: MCP-AGENT-01, MCP-AGENT-02, MCP-AGENT-03, MCP-AGENT-04, MCP-AGENT-05
**Success Criteria** (what must be TRUE):
  1. `create_agent` MCP tool creates a background agent with name, task, schedule, and URL
  2. `list_agents` MCP tool returns all agents with status, schedule, last run time, and replay info
  3. `run_agent_now` MCP tool triggers immediate execution of a specific agent
  4. `stop_agent` MCP tool stops a running agent execution
  5. `delete_agent` MCP tool removes an agent and its alarm
**Plans**: 2 plans
Plans:
- [x] 116-01-PLAN.md -- MCP server agent tools (types, agents.ts, index.ts, queue.ts)
- [x] 116-02-PLAN.md -- Extension handleMCPMessage agent cases (background.js)

### Phase 117: Cost & Metrics Pipeline
**Goal**: Agent run history shows accurate token usage and cost, not hardcoded placeholders
**Depends on**: Nothing (independent)
**Requirements**: COST-01, COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. `executeAutomationTask` resolve object includes real `tokensUsed` and `costUsd` from the AI provider response
  2. Agent `recordedScript.estimatedCostPerRun` reflects actual cost of the recording run
  3. Agent stats dashboard (options page) shows accurate cumulative cost and tokens
**Plans**: 1 plan
Plans:
- [ ] 117-01-PLAN.md -- Wire session cost data into executeAutomationTask resolve paths

### Phase 118: Scheduling Enhancements
**Goal**: Agents can run on flexible schedules with automatic retry on failure
**Depends on**: Nothing (independent)
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04
**Success Criteria** (what must be TRUE):
  1. Agents accept cron-style expressions (e.g., `"0 9 * * 1-5"` for weekdays at 9am) as a schedule type
  2. Failed agent runs are retried with exponential backoff (1min, 5min, 15min) up to 3 attempts
  3. Server sync queue persists to `chrome.storage.local` and resumes after service worker restart
  4. Agent scheduler validates and displays human-readable schedule descriptions
**Plans**: 2 plans
Plans:
- [ ] 118-01-PLAN.md -- Cron expression support and human-readable schedule descriptions
- [x] 118-02-PLAN.md -- Retry-on-failure with exponential backoff and persistent sync queue

### Phase 119: Replay Intelligence
**Goal**: Agent replay uses smart timing and recovers from individual step failures without full AI fallback
**Depends on**: Phase 117 (needs accurate cost data for savings calculations)
**Requirements**: REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04
**Success Criteria** (what must be TRUE):
  1. Replay steps use the recorded `originalDuration` (with min/max clamps) instead of hardcoded delays
  2. When a single replay step fails, the executor retries that step up to 2 times before falling back to AI
  3. Per-step success rates are tracked and steps below 50% success rate trigger automatic script re-recording
  4. Replay cost savings (AI cost avoided) are accurately calculated from real cost data
**Plans**: [to be planned]

### Phase 120: Sidepanel Agents UI
**Goal**: Users can manage all background agents from the sidepanel without opening the options page
**Depends on**: Phase 116 (UI should match MCP tool capabilities)
**Requirements**: UI-AGENT-01, UI-AGENT-02, UI-AGENT-03, UI-AGENT-04, UI-AGENT-05
**Success Criteria** (what must be TRUE):
  1. Sidepanel has an "Agents" tab showing all agents with name, status (active/paused/running), and next run time
  2. Each agent row has quick actions: run now, pause/resume, delete
  3. Expanding an agent shows run history (last 10 runs) with status, duration, cost, and execution mode (AI/replay)
  4. A create/edit form allows setting agent name, task description, target URL, and schedule
  5. Running agents show live progress (iteration count, current action) via status updates
**Plans**: [to be planned]

### Phase 121: DOM Cloning Verification
**Goal**: Formally verify that the Phase 44 DOM cloning stream works end-to-end (extension → relay → dashboard)
**Depends on**: Nothing (independent, verification-only)
**Requirements**: DOM-VERIFY-01, DOM-VERIFY-02, DOM-VERIFY-03, DOM-VERIFY-04, DOM-VERIFY-05
**Success Criteria** (what must be TRUE):
  1. `serializeDOM()` snapshot renders faithfully in dashboard iframe (layout, images, styles)
  2. MutationObserver diffs apply correctly (add/remove/attr/text ops by `data-fsb-nid`)
  3. Scroll tracking syncs extension viewport position to dashboard iframe
  4. Orange glow overlay and progress indicator position correctly over the iframe
  5. DOM stream pause/resume on dashboard tab visibility works without data loss
**Plans**: [to be planned]

### Progress

**Execution Order:** 116 + 117 + 121 (parallel) -> 118 -> 119 -> 120

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 116. MCP Agent Tools | 2/2 | Complete | 2026-03-28 |
| 117. Cost & Metrics Pipeline | -/- | Complete    | 2026-03-28 |
| 118. Scheduling Enhancements | 1/2 | Complete    | 2026-03-28 |
| 119. Replay Intelligence | -/- | Pending | - |
| 120. Sidepanel Agents UI | -/- | Pending | - |
| 121. DOM Cloning Verification | -/- | Pending | - |
