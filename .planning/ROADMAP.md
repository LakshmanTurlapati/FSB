# Roadmap: FSB v0.9.5 — Progress Overlay Intelligence

**Created:** 2026-03-17
**Milestone:** v0.9.5
**Phases:** 36-39 (continues from v0.9.4 Phase 35)
**Requirements:** 17 (LIVE: 4, PROG: 4, DBG: 6, UX: 3)

## Phase Overview

| Phase | Name | Requirements | Depends On |
|-------|------|-------------|------------|
| 36 | 2/2 | Complete    | 2026-03-17 |
| 37 | 1/2 | In Progress|  |
| 38 | Live Action Summaries | LIVE-01 through LIVE-04 | 36 (clean text paths) |
| 39 | Overlay UX Polish | UX-01 through UX-03 | 36, 37, 38 |

## Phase 36: Debug Feedback Pipeline

**Goal:** Fix debug feedback leaking to the progress overlay AND wire debug intelligence back into the AI continuation prompt so the automation agent makes better recovery decisions.

**Requirements:** DBG-01, DBG-02, DBG-03, DBG-04, DBG-05, DBG-06

**Plans:** 2/2 plans complete

Plans:
- [ ] 36-01-PLAN.md — Overlay text sanitization (phase labels, markdown stripping, text clamping)
- [ ] 36-02-PLAN.md — Wire debug intelligence into AI continuation prompt

**Key changes:**
- Sanitize all text paths feeding the progress overlay (phase label map, markdown stripping, text clamping)
- Add `aiDiagnosis` and `suggestions` fields to `slimActionResult()` so they flow into `session.actionHistory`
- Update continuation prompt builder (`ai-integration.js`) to include diagnosis + suggestions for failed actions
- Map custom `phase` values to human-readable labels in `content/messaging.js` sessionStatus handler

**Files:** `background.js` (slimActionResult, parallelDebugFallback, summarizeTask), `content/messaging.js` (sessionStatus handler), `ai/ai-integration.js` (continuation prompt)

**Risk:** Low — isolated changes to data flow, no new APIs or UI components

---

## Phase 37: Smart Progress & ETA

**Goal:** Replace naive iteration-based progress with task-aware estimation that accounts for complexity type, phase transitions, and workflow-specific metrics.

**Requirements:** PROG-01, PROG-02, PROG-03, PROG-04

**Plans:** 1/2 plans executed

Plans:
- [ ] 37-01-PLAN.md — Phase detection + weighted progress model + complexity-aware ETA
- [ ] 37-02-PLAN.md — Multi-site and Sheets workflow-specific progress

**Key changes:**
- Refactor `calculateProgress()` to use weighted progress model: navigation phase (0-30%), action phase (30-70%), verification phase (70-100%)
- Integrate `_taskEstimate` (from existing `estimateTaskComplexity`) into ETA calculation
- Track phase transitions (navigation → extraction → writing) and adjust progress curve
- Multi-site: progress = `(completedCompanies + currentCompanyProgress) / totalCompanies`
- Sheets: progress = `rowsWritten / totalRows` for entry, separate progress for formatting

**Files:** `background.js` (calculateProgress, formatETA, sendSessionStatus calls, multi-site/sheets progress)

**Risk:** Low — refactoring existing calculation functions, no new message types

---

## Phase 38: Live Action Summaries

**Goal:** Replace static `getActionStatus()` labels with AI-generated contextual descriptions that reflect what the automation is doing and why.

**Requirements:** LIVE-01, LIVE-02, LIVE-03, LIVE-04

**Key changes:**
- Add `generateActionSummary(action, session)` function that produces contextual descriptions using task goal + action + element context
- Non-blocking: fire summary generation in parallel with action execution, use `getActionStatus()` as immediate fallback
- Cache recent summaries to avoid redundant calls for similar actions
- Update `sendSessionStatus` calls to include AI-generated `statusText` when available

**Files:** `background.js` (new summary generator, action execution loop, sendSessionStatus calls)

**Risk:** Medium — adds an AI call per action; must be strictly non-blocking with tight timeout (2-3s) to avoid slowing automation. Cache + fallback pattern mitigates this.

**Depends on:** Phase 36 (clean text paths must be in place before adding new text sources)

---

## Phase 39: Overlay UX Polish

**Goal:** Polish the progress overlay experience — task summary display, recovery state handling, smooth phase transitions.

**Requirements:** UX-01, UX-02, UX-03

**Key changes:**
- Add task summary line to overlay UI (below task name, above step text)
- Show "Recovering..." state when debug fallback is active instead of raw error
- Smooth phase transition labels with debounce to prevent flicker on rapid phase changes
- Ensure all overlay text is plain text (no markdown artifacts)

**Files:** `content/visual-feedback.js` (ProgressOverlay), `content/messaging.js` (sessionStatus handler), `background.js` (recovery state signals)

**Risk:** Low — UI-only changes within existing Shadow DOM overlay

**Depends on:** Phases 36, 37, 38 (all text and progress sources must be clean and ready)

---

## Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| DBG-01 | 36 | Block diagnostic suggestions from overlay text |
| DBG-02 | 36 | Block AI debugger output from overlay text |
| DBG-03 | 36 | Map custom phases to readable labels |
| DBG-04 | 36 | Sanitize summarizeTask output |
| DBG-05 | 36 | Wire aiDiagnosis into continuation prompt |
| DBG-06 | 36 | Wire diagnostic suggestions into action history |
| PROG-01 | 37 | Task-aware progress percentage |
| PROG-02 | 37 | Complexity-aware ETA |
| PROG-03 | 37 | Phase transition progress tracking |
| PROG-04 | 37 | Multi-site/Sheets workflow progress |
| LIVE-01 | 38 | AI-generated step descriptions |
| LIVE-02 | 38 | Non-blocking fallback to static labels |
| LIVE-03 | 38 | Real-time per-action updates |
| LIVE-04 | 38 | Context-aware descriptions |
| UX-01 | 39 | Task summary line in overlay |
| UX-02 | 39 | Recovery state display |
| UX-03 | 39 | Smooth phase transitions |

**Coverage:** 17/17 requirements mapped (0 unmapped)

---
*Roadmap created: 2026-03-17*
*Last updated: 2026-03-17*
