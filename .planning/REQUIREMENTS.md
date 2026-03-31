# Requirements: FSB v0.9.12 MCP Developer Experience

**Defined:** 2026-03-31
**Core Value:** Any AI connecting via MCP can use FSB tools effectively without source code access

## v1 Requirements

### Tool Descriptions

- [ ] **DESC-01**: Every MCP tool description includes a "when to use" hint that guides the AI on appropriate usage context
- [ ] **DESC-02**: Tool descriptions reference related tools (e.g., click mentions get_dom_snapshot for finding selectors)
- [ ] **DESC-03**: Stale descriptions updated to reflect current behavior (search uses site's own search bar, not just Google)
- [ ] **DESC-04**: Parameter descriptions include concrete examples (e.g., selector: "CSS selector like '#submit-btn' or element ref like 'e5' from get_dom_snapshot")

### MCP Prompts

- [ ] **PROMPT-01**: A "browser-automation-guide" MCP prompt teaches the read-then-act workflow pattern
- [ ] **PROMPT-02**: A "tool-reference" MCP prompt provides categorized tool list with usage examples and tool relationships
- [ ] **PROMPT-03**: MCP prompts are registered via server.prompt() and discoverable by any MCP client

### Error Recovery

- [ ] **ERR-01**: Tool failure responses include actionable recovery hints (e.g., click fails -> "try click_at with viewport coordinates")
- [ ] **ERR-02**: Tool descriptions mention fallback tools for common failure scenarios

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changing tool behavior or parameters | Documentation-only milestone, no functional changes |
| Adding new tools | Separate milestone scope |
| Client-specific optimizations | Must work with any MCP client equally |
| Autopilot tool_use rewrite | Separate v0.9.20 milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DESC-01 | Phase 132 | Pending |
| DESC-02 | Phase 132 | Pending |
| DESC-03 | Phase 132 | Pending |
| DESC-04 | Phase 132 | Pending |
| PROMPT-01 | Phase 133 | Pending |
| PROMPT-02 | Phase 133 | Pending |
| PROMPT-03 | Phase 133 | Pending |
| ERR-01 | Phase 134 | Pending |
| ERR-02 | Phase 134 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9/9
