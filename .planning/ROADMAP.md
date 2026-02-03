# Roadmap: FSB Reliability Improvements

## Overview

This roadmap transforms FSB from an unreliable "hit or miss" automation tool into a precise, single-attempt execution engine. The journey starts with fixing element targeting (the core broken functionality), adds visual feedback so users can see what's happening, improves context quality for better AI decisions, adds verification to confirm actions succeeded, provides debugging tools for when things go wrong, and finally optimizes execution speed. Each phase builds on the previous, creating a foundation of reliability before adding polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Selector Generation** - Multiple selector strategies with reliability scoring
- [ ] **Phase 2: Element Readiness** - Verify elements are visible, interactable, and in viewport
- [ ] **Phase 3: Coordinate Fallback** - X,Y clicking when selectors fail
- [ ] **Phase 4: Visual Highlighting** - Orange glow feedback showing targeted elements
- [ ] **Phase 5: Context Quality** - Focused, semantic DOM context for AI
- [ ] **Phase 6: Action Verification** - Confirm actions succeeded before proceeding
- [ ] **Phase 7: Debugging Infrastructure** - Comprehensive logging and inspection tools
- [ ] **Phase 8: Execution Speed** - Dynamic delays and parallel processing

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
- [ ] 02-01-PLAN.md - Create unified element readiness check functions
- [ ] 02-02-PLAN.md - Integrate ensureElementReady into action handlers

### Phase 3: Coordinate Fallback
**Goal**: When all selectors fail, the system falls back to coordinate-based clicking
**Depends on**: Phase 2
**Requirements**: TARG-02
**Success Criteria** (what must be TRUE):
  1. If all selectors fail to match, the system uses stored x,y coordinates
  2. Coordinate-based clicks hit the center of where the element was observed
  3. The fallback is logged so users know a selector-based approach failed
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

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
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Action Verification
**Goal**: Each action is verified to have succeeded before proceeding to next step
**Depends on**: Phase 2, Phase 3
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04
**Success Criteria** (what must be TRUE):
  1. After each action, the system checks for expected state change (URL, DOM, element state)
  2. If first selector has no effect, an alternative selector is tried
  3. Actions with no observable effect are reported clearly
  4. Completion is only reported after page stability (no pending requests, DOM stable)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Selector Generation | 2/2 | Complete | 2026-02-03 |
| 2. Element Readiness | 0/2 | Planned | - |
| 3. Coordinate Fallback | 0/1 | Not started | - |
| 4. Visual Highlighting | 0/2 | Not started | - |
| 5. Context Quality | 0/3 | Not started | - |
| 6. Action Verification | 0/2 | Not started | - |
| 7. Debugging Infrastructure | 0/3 | Not started | - |
| 8. Execution Speed | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-03*
*Total requirements: 28 | Total phases: 8*
