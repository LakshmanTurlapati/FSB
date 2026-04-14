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
- v0.9.25 MCP & Dashboard Reliability Closure (shipped 2026-04-11) -- [archive](milestones/v0.9.25-ROADMAP.md)
- v0.9.26 Progress Overlay Refinement (shipped 2026-04-12) -- [archive](milestones/v0.9.26-ROADMAP.md)
- v0.9.27 Usage Dashboard Fix (shipped 2026-04-14) -- [archive](milestones/v0.9.27-ROADMAP.md)

---

## No Active Milestone

Last shipped milestone: `v0.9.27 Usage Dashboard Fix` (shipped 2026-04-14) -- [archive](milestones/v0.9.27-ROADMAP.md)

No new milestone has been opened yet. Start the next planning cycle with `$gsd-new-milestone`.

---

## v0.9.26 Progress Overlay Refinement (shipped 2026-04-12)

**Status:** Shipped 2026-04-12 -- see [milestones/v0.9.26-ROADMAP.md](milestones/v0.9.26-ROADMAP.md) for the archived detail.

**Goal:** Make the progress overlay show clean, accurate, human-readable task progress instead of developer debug noise.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 168. Data Audit & Display Firewall | 2/2 | Complete | 2026-04-12 |
| 169. Display Cleanup & Performance | 2/2 | Complete | 2026-04-12 |
| 170. Cross-Site Validation & Final Polish | 1/1 | Complete | 2026-04-12 |

## v0.9.25 MCP & Dashboard Reliability Closure (shipped 2026-04-11)

**Status:** Shipped 2026-04-11 with accepted tech debt -- see [milestones/v0.9.25-ROADMAP.md](milestones/v0.9.25-ROADMAP.md) and [v0.9.25-MILESTONE-AUDIT.md](v0.9.25-MILESTONE-AUDIT.md) for the archived detail.

**Goal:** Close the remaining operator-facing reliability gaps across restricted-tab MCP behavior, deferred dashboard reliability work, and the live verification debt carried forward from `v0.9.24`.

| Phase | Plans Complete | Status | Goal |
|-------|----------------|--------|------|
| 163. Restricted-Tab MCP Parity | 2/2 | Complete    | 2026-04-06 |
| 164. Dashboard Reliability Rebaseline | 2/2 | Complete   | 2026-04-06 |
| 165. Live Dashboard Verification & Fixes | 2/2 | Complete (tech debt accepted) | 2026-04-11 |
| 166. Runtime Carryover Hardening | 2/2 | Complete | 2026-04-07 |
| 167. Auth Outcome Smoke Verification | 0/0 | Complete | 2026-04-07 |

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
