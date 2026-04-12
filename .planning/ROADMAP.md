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
- v0.9.26 Progress Overlay Refinement (in progress)

---

## v0.9.26 Progress Overlay Refinement

**Goal:** Make the progress overlay show clean, accurate, human-readable task progress instead of developer debug noise. Strip internal metrics from the display layer without breaking downstream consumers (dashboard, sidepanel, popup, MCP), upgrade the progress bar to GPU-composited rendering, add an elapsed timer and action counter, and validate across diverse sites.

## Phases

- [x] **Phase 168: Data Audit & Display Firewall** - Map field dependencies across all overlay consumers, then filter developer-facing noise from overlay display without breaking session data downstream (completed 2026-04-12)
- [x] **Phase 169: Display Cleanup & Performance** - Upgrade progress bar to scaleX(), add local elapsed timer and action counter with tabular-nums, and wire completion freeze and motion preferences (completed 2026-04-12)
- [ ] **Phase 170: Cross-Site Validation & Final Polish** - Validate overlay rendering across Google Docs, YouTube fullscreen, Amazon, and 320px narrow viewport

## Phase Details

### Phase 168: Data Audit & Display Firewall
**Goal**: Overlay displays only human-readable task information while all session fields remain intact for dashboard, sidepanel, popup, and MCP consumers
**Depends on**: Nothing (first phase of v0.9.26)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. User sees no iteration counts, token usage, cost figures, or model name anywhere in the progress overlay during task execution
  2. User sees plain-English action summaries in the overlay (e.g. "Clicking Add to Cart"), never raw CLI commands or tool call JSON
  3. Dashboard options page, sidepanel, popup, and MCP tool responses continue to receive iterationCount, tokenUsage, cost, and model fields unchanged -- a field dependency audit document exists confirming which fields are display-filtered versus passed through
  4. calculateProgress() continues to use iterationCount internally for progress computation even though the value is hidden from the overlay display
**Plans**: 2 plans
Plans:
- [x] 168-01-PLAN.md -- Display firewall: sanitizeActionText, Step X/Y removal, ETA null, popup/sidepanel phase labels
- [x] 168-02-PLAN.md -- Field dependency audit: inline comments at all consumer sites, downstream payload verification
**UI hint**: yes

### Phase 169: Display Cleanup & Performance
**Goal**: Users see a smooth, jitter-free overlay with GPU-composited progress bar, live elapsed timer, action counter, and correct accessibility and completion behavior
**Depends on**: Phase 168
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-04, POLISH-02, POLISH-03
**Success Criteria** (what must be TRUE):
  1. Progress bar width is driven by CSS scaleX() transform, not width property, and updates cause zero layout reflows on complex pages
  2. User sees elapsed time (e.g. "0:42") updating in real-time via content-script-local performance.now() + requestAnimationFrame, not pushed from background.js, and the timer freezes at its final value on task completion
  3. User sees an "Actions: N" counter in the overlay meta row that increments on each click, type, or navigation action and freezes at its final value on task completion
  4. All numeric displays (elapsed time digits, action count) use font-variant-numeric: tabular-nums so digit changes never shift surrounding layout
  5. All new transitions, the progress bar animation, and the elapsed timer tick respect prefers-reduced-motion: reduce by falling back to instant updates
**Plans**: 2 plans
Plans:
- [x] 169-01-PLAN.md -- Data pipeline (actionCount), scaleX() progress bar migration, tabular-nums
- [x] 169-02-PLAN.md -- Elapsed timer (rAF), action count display, completion presentation, reduced-motion
**UI hint**: yes

### Phase 170: Cross-Site Validation & Final Polish
**Goal**: Overlay renders correctly across the sites and viewport conditions that represent real-world usage diversity
**Depends on**: Phase 169
**Requirements**: POLISH-01
**Success Criteria** (what must be TRUE):
  1. Overlay renders with correct layout, readable text, and no clipping on Google Docs (contenteditable + iframes), YouTube fullscreen (z-index competition), Amazon product pages (heavy DOM), and a 320px-wide viewport (narrow responsive)
  2. No visual regressions are introduced on any of the four test surfaces compared to the pre-v0.9.26 overlay behavior
**Plans**: 1 plan
Plans:
- [ ] 170-01-PLAN.md -- CSS defensive hardening + 7-point lifecycle validation on Google Docs, YouTube fullscreen, Amazon, 320px viewport
**UI hint**: yes

## Progress

**Execution Order:** 168 -> 169 -> 170

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 168. Data Audit & Display Firewall | 2/2 | Complete    | 2026-04-12 |
| 169. Display Cleanup & Performance | 2/2 | Complete    | 2026-04-12 |
| 170. Cross-Site Validation & Final Polish | 0/1 | Not started | - |

---

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
