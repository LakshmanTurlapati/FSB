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
- v0.9.9 Excalidraw Mastery (shipped 2026-03-25) -- [archive](milestones/v0.9.9-ROADMAP.md)
- v0.9.8.1 npm Publishing (shipped 2026-04-02) -- [archive](milestones/v0.9.8.1-ROADMAP.md)
- v0.9.9.1 Phantom Stream (shipped 2026-03-31)
- v0.9.11 MCP Tool Quality (shipped 2026-03-31) -- [archive](milestones/v0.9.11-ROADMAP.md)
- v0.9.20 Autopilot Agent Architecture Rewrite (shipped 2026-04-02) -- [archive](milestones/v0.9.20-ROADMAP.md)
- v0.9.21 UI Retouch & Cohesion (shipped 2026-04-02) -- [archive](milestones/v0.9.21-ROADMAP.md)
- v0.9.22 Showcase High-Fidelity Replicas (superseded after Phase 145)
- v0.9.23 Dashboard Stream & Remote Control Reliability (deferred after Phase 150)
- v0.9.24 Claude Code Architecture Adaptation (shipped 2026-04-05) -- [archive](milestones/v0.9.24-ROADMAP.md)
- v0.9.25 MCP & Dashboard Reliability Closure (active)

---

## v0.9.25 MCP & Dashboard Reliability Closure (active)

**Goal:** Close the remaining operator-facing reliability gaps across restricted-tab MCP behavior, deferred dashboard reliability work, and the live verification debt carried forward from `v0.9.24`.

| Phase | Plans Complete | Status | Goal |
|-------|----------------|--------|------|
| 163. Restricted-Tab MCP Parity | 2/2 | Complete    | 2026-04-06 |
| 164. Dashboard Reliability Rebaseline | 2/2 | Complete   | 2026-04-06 |
| 165. Live Dashboard Verification & Fixes | 2/2 | Blocked | 2026-04-06 |
| 166. Runtime Carryover Hardening | 2/2 | Complete | 2026-04-07 |
| 167. Auth Outcome Smoke Verification | 0/0 | Complete | 2026-04-07 |

### Phase 163: Restricted-Tab MCP Parity

**Goal:** Make MCP manual and task-driven flows behave predictably when the active tab is `chrome://newtab` or another restricted page.

**Requirements:** `MCP-01`, `MCP-02`, `MCP-03`

**Success criteria:**
1. Navigation-safe MCP tools continue to work from restricted tabs without content-script injection failures.
2. Task-driven automation keeps sidepanel-style smart start routing from restricted tabs when a destination can be inferred.
3. DOM/manual tools and MCP resources fail fast with actionable recovery guidance instead of raw injection errors.

### Phase 164: Dashboard Reliability Rebaseline

**Goal:** Reconcile the dashboard preview, remote-control, and task-relay path with the current runtime and finish the deferred reliability behavior.

**Requirements:** `DASH-01`, `DASH-02`, `DASH-03`

**Success criteria:**
1. Preview traffic is bound to the active stream generation and resyncs on divergence rather than freezing.
2. Remote control keeps bounded coordinates, focus-scoped capture, and recoverable debugger ownership through toggles and stream-tab changes.
3. Dashboard task submission, progress, stop, and completion stay attached to one run identity across live sends and reconnect recovery.

### Phase 165: Live Dashboard Verification & Fixes

**Goal:** Execute the real browser-backed dashboard matrix and convert any discovered defects into fixes with evidence.

**Requirements:** `LIVE-01`, `LIVE-02`

**Plans:** 2 plans

Plans:
- [x] `165-01-PLAN.md` — Seed the Phase 165-local live checklist, record the real environment contract, and capture the automated baseline.
- [x] `165-02-PLAN.md` — Run the live matrix, patch and rerun in-scope failures, and publish the final Phase 165 verification artifacts.

**Current outcome:** Phase execution is complete, but live closure is blocked. Hosted dashboard traffic exposed remote-key drift, the local in-scope fix could not be rerun in the same Chrome session because the unpacked extension could not be reloaded, and the hosted environment did not expose the full diagnostics surfaces needed for the remaining proof rows.

**Success criteria:**
1. The Phase 154 live checklist is executed with evidence for stream lifecycle, remote control, task relay, and diagnostics.
2. Failures found in the live matrix are turned into concrete fixes and re-run evidence, not just notes.
3. Milestone verification artifacts reflect real browser and relay behavior rather than terminal-only assumptions.

### Phase 166: Runtime Carryover Hardening

**Goal:** Close the small v0.9.24 runtime debts that can still skew operator confidence or future planning.

**Requirements:** `ENG-01`, `ENG-02`

**Success criteria:**
1. `CostTracker` is instantiated only after the final per-mode session config is known, so its limit matches the active mode.
2. Unused emitter/runtime contract leftovers are removed or explicitly documented.
3. Any affected tests or smoke checks are updated so the same debt does not silently return.

### Phase 167: Auth Outcome Smoke Verification

**Goal:** Prove the preserved partial/auth-resume flow works end to end in a real extension session.

**Requirements:** `AUTH-01`

**Current outcome:** Completed on 2026-04-07 from operator-confirmed live auth smoke evidence recorded under Phase 167 and reconciled back into the old Phase 162.2 human-UAT artifact.

**Success criteria:**
1. No-sidepanel auth fallback ends as a preserved manual handoff instead of a hang or generic failure.
2. Skip and timeout cases preserve completed work with the correct blocker wording.
3. Successful sign-in resumes the same session and records verification evidence.

## v0.9.23 Dashboard Stream & Remote Control Reliability (deferred)

Historical deferred milestone. Phase 150 shipped, and the remaining reliability goals are now re-scoped into `v0.9.25` with fresh phase numbers instead of reviving the old `151-155` sequence.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 150. Dashboard Transport Baseline & Recovery | 2/2 | Complete | 2026-04-02 |
| 151. DOM Stream Consistency & State Sync | 0/2 | Deferred | - |
| 152. Remote Control Reliability | 0/2 | Deferred | - |
| 153. Dashboard Task Relay Correctness | 0/2 | Deferred | - |
| 154. End-to-End Verification & Hardening | 0/1 | Deferred | - |
| 155. Agent Conversation Continuity & Context Reuse | 2/2 | Complete | 2026-04-02 |
