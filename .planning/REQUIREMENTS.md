# Requirements: FSB v0.9.22 Showcase High-Fidelity Replicas

**Defined:** 2026-04-02
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.22 Requirements

Requirements for replacing outdated "See It in Action" renders with pixel-accurate replicas of the real extension UI and MCP-in-Claude-Code examples.

### Sidepanel Replica

- [ ] **SP-01**: User sees a pixel-accurate recreation of the real sidepanel Chat view in the showcase "See It in Action" section, matching current header, message types, input bar, and footer
- [ ] **SP-02**: User sees the sidepanel replica render correctly in both dark and light themes with accurate color tokens from the real sidepanel.css
- [ ] **SP-03**: User sees scroll-triggered animated message cascade in the sidepanel replica using the existing IntersectionObserver pattern

### Control Panel Replica

- [ ] **CP-01**: User sees a pixel-accurate recreation of the real control panel Dashboard view in the showcase, matching current sidebar nav, analytics cards, chart, and session history
- [ ] **CP-02**: User sees the control panel replica render correctly in both dark and light themes with accurate warm-gray tokens from the real options.css
- [ ] **CP-03**: User sees scroll-triggered animated counters and chart line draw in the control panel replica

### MCP Terminal Examples

- [ ] **MCP-01**: User sees an autopilot terminal example showing a run_task command with progress output and completion summary in a Claude Code-styled terminal block
- [ ] **MCP-02**: User sees a manual mode terminal example showing a read_page + click + type_text multi-tool orchestration flow in a Claude Code-styled terminal block
- [ ] **MCP-03**: User sees terminal blocks styled with accurate Claude Code dark theme colors, monospace typography, and semantic CSS classes

### Audit & Fidelity

- [ ] **AUD-01**: All replicas are built from a fresh audit of the current extension UI state (sidepanel, control panel) accounting for recent changes
- [ ] **AUD-02**: User sees no obvious visual discrepancies between replicas and the real extension in a side-by-side comparison
- [ ] **AUD-03**: Each replica section includes version-stamped sync comments for future drift detection

## Future Requirements

### Deferred from v0.9.22

- **SP-04**: Interactive tab switching in sidepanel replica (Chat/Agents/History tabs)
- **MCP-04**: MCP agent creation terminal example (create_agent with scheduling)
- **CP-04**: Control panel tab navigation beyond Dashboard view
- **AUD-04**: Automated screenshot regression test for replica fidelity

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full options page feature parity (all 7+ tabs) | Marginal showcase value for months of work; Dashboard view is sufficient |
| Functional replicas (clickable, API-connected) | These are static visual recreations for the showcase, not working copies |
| Changes to sections outside "See It in Action" | Milestone scope is limited to this one section |
| Importing real extension CSS directly | CSS collision risk; replicas use rec- namespace translation instead |
| New dependencies (xterm.js, Termynal, chart.js) | Existing vanilla HTML/CSS/JS patterns handle everything needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUD-01 | Phase 145 | Pending |
| SP-01 | Phase 146 | Pending |
| SP-02 | Phase 146 | Pending |
| SP-03 | Phase 146 | Pending |
| CP-01 | Phase 147 | Pending |
| CP-02 | Phase 147 | Pending |
| CP-03 | Phase 147 | Pending |
| MCP-01 | Phase 148 | Pending |
| MCP-02 | Phase 148 | Pending |
| MCP-03 | Phase 148 | Pending |
| AUD-02 | Phase 149 | Pending |
| AUD-03 | Phase 149 | Pending |

**Coverage:**
- v0.9.22 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
