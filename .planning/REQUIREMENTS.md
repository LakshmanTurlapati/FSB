# Requirements: FSB Reliability Improvements

**Defined:** 2026-02-03
**Core Value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely.

## v1 Requirements

Requirements for the reliability improvement milestone. Each maps to roadmap phases.

### Element Targeting

- [x] **TARG-01**: Generate multiple selector strategies per element (ID, data attributes, CSS path, XPath) with reliability scoring
- [x] **TARG-02**: Fall back to x,y coordinate-based clicking when all selectors fail
- [x] **TARG-03**: Score selectors by uniqueness - prefer selectors that match exactly one element
- [x] **TARG-04**: Verify element is in viewport before acting; scroll into view if needed
- [x] **TARG-05**: Confirm element is interactable (visible, not disabled, not obscured) before action

### Visual Feedback

- [x] **VIS-01**: Display orange glow highlight on the element being targeted before each action
- [x] **VIS-02**: Show floating progress overlay with current step, task name, and overall progress
- [x] **VIS-03**: Highlight persists for 500ms minimum so user can see what was targeted
- [x] **VIS-04**: Remove highlight cleanly after action (no visual artifacts)

### Execution Speed

- [ ] **SPEED-01**: Calculate delays dynamically based on action type (click: 200ms, navigation: wait for load, form submit: wait for response)
- [ ] **SPEED-02**: Begin DOM analysis while waiting for AI response (parallel processing)
- [ ] **SPEED-03**: Execute multiple quick actions in sequence without AI roundtrip when actions are deterministic
- [ ] **SPEED-04**: Cache element lookups within same page state; invalidate on DOM mutation
- [ ] **SPEED-05**: Skip unnecessary delays when element is already ready and interactable

### Context Quality

- [x] **CTX-01**: Filter DOM to only interactive, visible elements (reduce noise from 300+ to ~50 relevant elements)
- [x] **CTX-02**: Generate semantic descriptions like "Submit button in checkout form" instead of just element type
- [x] **CTX-03**: Include page structure summary (identified forms, navigation areas, main content regions)
- [x] **CTX-04**: Provide action history to AI showing what was attempted and what happened
- [x] **CTX-05**: Indicate element relationships (button inside form, link in navigation, etc.)

### Debugging & Observability

- [ ] **DEBUG-01**: Log every action attempt with: selector tried, element found (yes/no), coordinates, action result
- [ ] **DEBUG-02**: Provide element inspection mode - user clicks any element to see FSB's view (selectors, attributes, interactability)
- [ ] **DEBUG-03**: Show clear failure diagnostics: "Element not found", "Element not visible", "Element disabled", "Click intercepted by overlay"
- [ ] **DEBUG-04**: Enable session replay to review automation step-by-step after completion
- [ ] **DEBUG-05**: Export logs for debugging failed automations

### Action Verification

- [ ] **VERIFY-01**: Verify action succeeded by checking for expected state change (URL change, DOM mutation, element state)
- [ ] **VERIFY-02**: Retry action with alternative selector if first attempt has no effect
- [ ] **VERIFY-03**: Detect and report when action appears to have no effect
- [ ] **VERIFY-04**: Wait for page stability (no pending requests, DOM stable) before reporting completion

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Visual Feedback (Deferred)

- **VIS-05**: Show action preview tooltip before execution (what action will be performed)
- **VIS-06**: Success/failure visual indicators (green check / red X) after each action

### Advanced Features

- **ADV-01**: Multi-tab automation support
- **ADV-02**: Workflow recording - watch user actions and generate automation
- **ADV-03**: Scheduling - run automations at specified times
- **ADV-04**: MCP server integration for Claude Code compatibility

### Code Quality

- **QUAL-01**: Split content.js into modular files (DOM analysis, action handlers, utilities)
- **QUAL-02**: Add unit tests for selector generation
- **QUAL-03**: Add integration tests for action execution
- **QUAL-04**: Extract magic numbers to named constants

## Out of Scope

Explicitly excluded from this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Screenshot-based automation | Adds complexity, higher token costs, DOM approach should be sufficient when fixed |
| Firefox support | Requires significant Manifest V2/V3 adaptation |
| CAPTCHA solving | Third-party integration complexity, users can solve manually |
| Desktop app automation | Out of scope for browser extension |
| Offline mode | AI requires connectivity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TARG-01 | Phase 1: Selector Generation | Complete |
| TARG-02 | Phase 3: Coordinate Fallback | Complete |
| TARG-03 | Phase 1: Selector Generation | Complete |
| TARG-04 | Phase 2: Element Readiness | Complete |
| TARG-05 | Phase 2: Element Readiness | Complete |
| VIS-01 | Phase 4: Visual Highlighting | Complete |
| VIS-02 | Phase 4: Visual Highlighting | Complete |
| VIS-03 | Phase 4: Visual Highlighting | Complete |
| VIS-04 | Phase 4: Visual Highlighting | Complete |
| SPEED-01 | Phase 8: Execution Speed | Complete |
| SPEED-02 | Phase 8: Execution Speed | Complete |
| SPEED-03 | Phase 8: Execution Speed | Complete |
| SPEED-04 | Phase 8: Execution Speed | Complete |
| SPEED-05 | Phase 8: Execution Speed | Complete |
| CTX-01 | Phase 5: Context Quality | Complete |
| CTX-02 | Phase 5: Context Quality | Complete |
| CTX-03 | Phase 5: Context Quality | Complete |
| CTX-04 | Phase 5: Context Quality | Complete |
| CTX-05 | Phase 5: Context Quality | Complete |
| DEBUG-01 | Phase 7: Debugging Infrastructure | Complete |
| DEBUG-02 | Phase 7: Debugging Infrastructure | Complete |
| DEBUG-03 | Phase 7: Debugging Infrastructure | Complete |
| DEBUG-04 | Phase 7: Debugging Infrastructure | Complete |
| DEBUG-05 | Phase 7: Debugging Infrastructure | Complete |
| VERIFY-01 | Phase 6: Action Verification | Complete |
| VERIFY-02 | Phase 6: Action Verification | Complete |
| VERIFY-03 | Phase 6: Action Verification | Complete |
| VERIFY-04 | Phase 9: Verification Completeness | Complete |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-04 after Phase 9 completion*
