# Requirements: v9.3 Tech Debt Cleanup

**Defined:** 2026-02-21
**Core Value:** Reliable single-attempt execution

## v9.3 Requirements

### Modularization

- [ ] **MOD-01**: content.js is split into logical modules with clear boundaries (DOM analysis, action execution, element utilities, visual feedback, etc.)
- [ ] **MOD-02**: All existing message handlers and tool functions continue to work identically after modularization
- [ ] **MOD-03**: Modules are loaded via manifest.json content_scripts array in correct dependency order

### Dead Code Removal

- [ ] **DEAD-01**: waitForActionable() function and all references removed from content.js
- [ ] **DEAD-02**: No remaining unreachable or unused code paths related to waitForActionable

### Configuration

- [ ] **CFG-01**: ElementCache maxCacheSize is configurable via options page or config.js instead of hardcoded to 100
- [ ] **CFG-02**: Default value remains 100 for backward compatibility

### Bug Fixes

- [ ] **FIX-01**: memory-extractor.js UniversalProvider constructor receives correct arguments so AI extraction runs when available
- [ ] **FIX-02**: Local fallback still works when AI extraction genuinely fails

## Out of Scope

| Feature | Reason |
|---------|--------|
| content.js rewrite or architecture change | Modularization only -- extract existing code into files, do not restructure logic |
| New features or capabilities | This is cleanup only, no new functionality |
| Performance optimization | Separate concern, defer to future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOD-01 | Phase 4 | Pending |
| MOD-02 | Phase 4 | Pending |
| MOD-03 | Phase 4 | Pending |
| DEAD-01 | Phase 5 | Pending |
| DEAD-02 | Phase 5 | Pending |
| CFG-01 | Phase 5 | Pending |
| CFG-02 | Phase 5 | Pending |
| FIX-01 | Phase 6 | Pending |
| FIX-02 | Phase 6 | Pending |

**Coverage:**
- v9.3 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation*
