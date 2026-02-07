# Roadmap: FSB Reliability Improvements

## Overview

This roadmap transforms FSB from an unreliable "hit or miss" automation tool into a precise, single-attempt execution engine. The journey starts with fixing element targeting (the core broken functionality), adds visual feedback so users can see what's happening, improves context quality for better AI decisions, adds verification to confirm actions succeeded, provides debugging tools for when things go wrong, and finally optimizes execution speed. Each phase builds on the previous, creating a foundation of reliability before adding polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Selector Generation** - Multiple selector strategies with reliability scoring
- [x] **Phase 2: Element Readiness** - Verify elements are visible, interactable, and in viewport
- [x] **Phase 3: Coordinate Fallback** - X,Y clicking when selectors fail
- [x] **Phase 4: Visual Highlighting** - Orange glow feedback showing targeted elements
- [x] **Phase 5: Context Quality** - Focused, semantic DOM context for AI
- [x] **Phase 6: Action Verification** - Confirm actions succeeded before proceeding
- [x] **Phase 7: Debugging Infrastructure** - Comprehensive logging and inspection tools
- [x] **Phase 8: Execution Speed** - Dynamic delays and parallel processing
- [x] **Phase 9: Verification Completeness** - Global stability gate and verification-outcome wiring (Gap Closure)
- [ ] **Phase 10: Tech Debt Cleanup** - Dead code removal, consistency fixes, cache tuning (Gap Closure)
- [x] **Phase 11: Control Panel Refinement** - Remove dead UI code, wire disconnected settings, fix non-functional buttons

## Phase Details

### Phase 1: Selector Generation
**Goal**: Generated selectors reliably identify the intended element across diverse websites
**Depends on**: Nothing (first phase)
**Requirements**: TARG-01, TARG-03
**Success Criteria** (what must be TRUE):
  1. Each element gets multiple selector strategies (ID, data-attributes, CSS path, XPath)
  2. Each selector has a reliability score based on uniqueness
  3. Selectors that match exactly one element score higher than ambiguous selectors
  4. The system prefers high-scoring selectors when executing actions
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md - Add uniqueness validation utilities and enhanced filtering patterns
- [x] 01-02-PLAN.md - Integrate validation into selector generation functions

### Phase 2: Element Readiness
**Goal**: Actions only execute on elements that are ready to receive them
**Depends on**: Phase 1
**Requirements**: TARG-04, TARG-05
**Success Criteria** (what must be TRUE):
  1. Elements outside viewport are scrolled into view before action
  2. Hidden or invisible elements are not targeted
  3. Disabled elements are identified and reported as non-interactable
  4. Elements obscured by overlays (modals, popups) are detected
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md - Create unified element readiness check functions
- [x] 02-02-PLAN.md - Integrate ensureElementReady into action handlers

### Phase 3: Coordinate Fallback
**Goal**: When all selectors fail, the system falls back to coordinate-based clicking
**Depends on**: Phase 2
**Requirements**: TARG-02
**Success Criteria** (what must be TRUE):
  1. If all selectors fail to match, the system uses stored x,y coordinates
  2. Coordinate-based clicks hit the center of where the element was observed
  3. The fallback is logged so users know a selector-based approach failed
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md - Add coordinate validation utilities and integrate into click tool failure path
- [x] 03-02-PLAN.md - Fix unreachable coordinate fallback code (gap closure)

### Phase 4: Visual Highlighting
**Goal**: Users see exactly which element FSB is targeting before each action
**Depends on**: Phase 3
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04
**Success Criteria** (what must be TRUE):
  1. An orange glow highlights the target element before each action
  2. The highlight persists for at least 500ms so users can observe it
  3. A floating overlay shows current step, task name, and progress
  4. Highlights are removed cleanly with no visual artifacts after action completes
  5. Visual feedback works on any website without CSS conflicts
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md - Create HighlightManager and ProgressOverlay classes
- [x] 04-02-PLAN.md - Integrate visual feedback into action execution flow
- [x] 04-03-PLAN.md - Human verification of visual feedback system

### Phase 5: Context Quality
**Goal**: AI receives focused, semantic DOM information instead of noise
**Depends on**: Phase 1
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05
**Success Criteria** (what must be TRUE):
  1. DOM analysis returns approximately 50 relevant elements instead of 300+ raw elements
  2. Elements have semantic descriptions like "Submit button in checkout form"
  3. Page structure summary identifies forms, navigation, and content regions
  4. AI sees action history showing what was attempted and results
  5. Element relationships (button in form, link in nav) are explicitly stated
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md - Create 3-stage element filtering pipeline (visibility, interactivity, relevance)
- [x] 05-02-PLAN.md - Add relationship context to element descriptions (form, navigation, region)
- [x] 05-03-PLAN.md - Enhance AI context with page structure summary and action history

### Phase 6: Action Verification
**Goal**: Each action is verified to have succeeded before proceeding to next step
**Depends on**: Phase 2, Phase 3
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04
**Success Criteria** (what must be TRUE):
  1. After each action, the system checks for expected state change (URL, DOM, element state)
  2. If first selector has no effect, an alternative selector is tried
  3. Actions with no observable effect are reported clearly
  4. Completion is only reported after page stability (no pending requests, DOM stable)
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md - Create unified verification utilities (captureActionState, verifyActionEffect, waitForPageStability)
- [x] 06-02-PLAN.md - Integrate verification into action handlers (type, selectOption, toggleCheckbox, pressEnter)

### Phase 7: Debugging Infrastructure
**Goal**: Clear visibility into what FSB is doing and why actions fail
**Depends on**: Phase 4, Phase 6
**Requirements**: DEBUG-01, DEBUG-02, DEBUG-03, DEBUG-04, DEBUG-05
**Success Criteria** (what must be TRUE):
  1. Every action is logged with: selector tried, element found status, coordinates, result
  2. User can click any element to see FSB's view (selectors, attributes, interactability)
  3. Failures show clear diagnostics: "Element not found", "Element not visible", etc.
  4. Completed sessions can be replayed step-by-step
  5. Logs can be exported for offline debugging
**Plans**: 4 plans

Plans:
- [x] 07-01-PLAN.md - Create structured action logging with diagnostic messages (DEBUG-01, DEBUG-03)
- [x] 07-02-PLAN.md - Create element inspection mode for click-to-inspect debugging (DEBUG-02)
- [x] 07-03-PLAN.md - Add session replay UI and human-readable log export (DEBUG-04, DEBUG-05)
- [x] 07-04-PLAN.md - Gap closure: Complete action recording for remaining tool handlers (DEBUG-01)

### Phase 8: Execution Speed
**Goal**: Automation executes as fast as possible without sacrificing reliability
**Depends on**: Phase 6
**Requirements**: SPEED-01, SPEED-02, SPEED-03, SPEED-04, SPEED-05
**Success Criteria** (what must be TRUE):
  1. Delays are dynamic based on action type (click: 200ms, navigation: wait for load)
  2. DOM analysis begins while waiting for AI response (parallel processing)
  3. Deterministic action sequences execute without AI roundtrip
  4. Element lookups are cached within same page state, invalidated on DOM mutation
  5. Ready and interactable elements proceed without unnecessary delays
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md - Element caching with MutationObserver invalidation and fast-path readiness
- [x] 08-02-PLAN.md - Dynamic outcome-based delays replacing static category delays
- [x] 08-03-PLAN.md - Parallel DOM prefetching and deterministic action batching

### Phase 9: Verification Completeness
**Goal**: Task completion is only reported after verified page stability, and verification results inform delay optimization
**Depends on**: Phase 6, Phase 8
**Requirements**: VERIFY-04 (gap closure)
**Gap Closure**: Closes gaps from v1 milestone audit
**Success Criteria** (what must be TRUE):
  1. When AI returns taskComplete: true, background.js waits for page stability before confirming completion
  2. detectActionOutcome() consumes verifyActionEffect() results to choose optimal delay strategy
  3. tools.click uses waitForPageStability instead of fixed 300ms delay
**Plans**: 1 plans

Plans:
- [x] 09-01-PLAN.md - Add global stability gate before taskComplete and wire verification to outcome detection

### Phase 10: Tech Debt Cleanup
**Goal**: Remove dead code, extend verification coverage, and tune caching for consistency across the codebase
**Depends on**: Phase 9
**Requirements**: None (tech debt only)
**Gap Closure**: Closes tech debt from v1 milestone audit
**Success Criteria** (what must be TRUE):
  1. waitForActionable() removed from content.js (dead code)
  2. tools.click uses shared verification utilities (captureActionState + verifyActionEffect) instead of inline logic
  3. ElementCache maxCacheSize adapts based on page element count
**Plans**: TBD

Plans:
- [ ] 10-01-PLAN.md - Remove dead code and extend click verification to use shared utilities
- [ ] 10-02-PLAN.md - Add adaptive ElementCache sizing

### Phase 11: Control Panel Refinement
**Goal**: The options page, popup, and side panel contain only functional, wired-up features with no dead code or orphaned UI elements
**Depends on**: Phase 10
**Requirements**: None (UI cleanup)
**Success Criteria** (what must be TRUE):
  1. No JS references to non-existent HTML elements (speedModeNormal, speedModeFast, apiStatusCard, quickDebugMode, quickConfirmSensitive removed)
  2. Debug Mode toggle in options actually controls verbose logging in background.js
  3. DOM Optimization settings in options are wired to content.js DOM analysis parameters
  4. Pin button in popup either works correctly (pins window) or is removed
  5. DOM Optimization Stats section shows real compression metrics or is removed
  6. No duplicate initialization code (session history double-init fixed)
  7. Test API button reflects actual selected provider (not hardcoded "xAI")
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md -- Remove orphaned element references, dead speedMode code, and DOM Optimization Stats placeholder
- [x] 11-02-PLAN.md -- Wire Debug Mode toggle to background.js logging and fix Test API provider display

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Selector Generation | 2/2 | Complete | 2026-02-03 |
| 2. Element Readiness | 2/2 | Complete | 2026-02-03 |
| 3. Coordinate Fallback | 2/2 | Complete | 2026-02-04 |
| 4. Visual Highlighting | 3/3 | Complete | 2026-02-04 |
| 5. Context Quality | 3/3 | Complete | 2026-02-04 |
| 6. Action Verification | 2/2 | Complete | 2026-02-04 |
| 7. Debugging Infrastructure | 4/4 | Complete | 2026-02-04 |
| 8. Execution Speed | 3/3 | Complete | 2026-02-04 |
| 9. Verification Completeness | 1/1 | Complete | 2026-02-04 |
| 10. Tech Debt Cleanup | 0/2 | Pending | - |
| 11. Control Panel Refinement | 2/2 | Complete | 2026-02-04 |

---
*Roadmap created: 2026-02-03*
*Updated: 2026-02-04 (Phase 11 complete)*
*Total requirements: 28 | Total phases: 11*
