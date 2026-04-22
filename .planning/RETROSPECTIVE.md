# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.9.34 -- Vault, Payments & Secure MCP Access

**Shipped:** 2026-04-22
**Phases:** 8 | **Plans:** 11

### What Was Built
- Vault lifecycle messaging and eager session/payment-access rehydration across service worker restarts
- Payment method backend handlers, masked metadata listing, separate unlock state, and options-page payment management UI
- Autopilot credential/payment fill execution with sidepanel payment confirmation before any payment fill
- MCP vault tools and bridge handlers that keep raw secrets inside the extension/content-script boundary
- Phase 197 security boundary fixes for active-tab domain derivation, sidepanel MCP payment confirmation, content-script log redaction, and the 125-second payment confirmation timeout

### What Worked
- Phase 197 gap closure was small and focused: one code commit closed the timeout mismatch and one docs commit updated verification/UAT state.
- The proxy command pattern remained coherent: MCP clients receive opaque IDs and masked metadata while the extension resolves secrets locally.
- Sidepanel confirmation became a shared security pattern across autopilot and MCP payment fills.

### What Was Inefficient
- The milestone audit was run before the Phase 197 gap-closure work and was archived as stale `gaps_found` instead of being rerun.
- Requirements traceability was incomplete at close: 19 v1 requirements remained unchecked even though roadmap phases were marked complete.
- Phase 195 and Phase 196 were closed as 0-plan phases, which made later audit and requirement attribution weaker.

### Patterns Established
- Active-tab authority pattern: derive credential/payment target domains from browser state rather than MCP payloads.
- Sensitive-param redaction pattern: content-script fill actions redact params before logging even if logging is later enabled.
- Human-gated MCP timeout pattern: server-side bridge timeouts must exceed browser-side confirmation windows.

### Key Lessons
1. Run milestone audit after all gap-closure phases, not before the final closure commit.
2. Requirements checkboxes and traceability rows need to be updated during each phase, not reconstructed at milestone close.
3. Zero-plan phases make archives look complete while weakening evidence; future milestones should create explicit audit/verification plans even for hardening passes.

### Cost Observations
- Model mix: inherit profile.
- Notable: The final closure was code-small but documentation-heavy because audit and requirements state lagged behind implementation.

---

## Milestone: v0.9.30 -- MCP Platform Install Flags

**Shipped:** 2026-04-18
**Phases:** 3 | **Plans:** 6

### What Was Built
- Platform registry module mapping 10 MCP platforms to config paths, formats, and entry shapes per OS
- Format-aware config engine: read-merge-write for JSON, JSONC, TOML, and YAML with .bak backups and idempotency
- Install/uninstall CLI with per-platform flags for all 7 JSON-format clients
- Non-JSON platform support: Claude Code CLI delegation (execSync), Codex TOML, Continue YAML
- --dry-run preview and --all bulk install/uninstall across all 10 platforms

### What Worked
- Data-driven platform registry pattern: each platform described as config data, single ConfigWriter handles all formats -- no per-platform code branches
- Clean phase dependency chain (registry -> CLI wiring -> extended flags) kept each phase focused
- Zero-dep library choices (smol-toml, yaml, strip-json-comments) kept the install lightweight
- All 3 phases executed in a single day with stable sub-10min plan durations

### What Was Inefficient
- REQUIREMENTS.md was stale (from v0.9.27) during the entire milestone -- requirements were only tracked in ROADMAP.md phase details
- No milestone audit was created before completion -- should have run /gsd-audit-milestone

### Patterns Established
- Platform registry map pattern: platform metadata as data, not code, enabling new platforms without code changes
- Format-gate removal pattern: start with restricted format support, remove gates as format parsers ship
- CLI delegation pattern for platforms that have their own install tooling (Claude Code)

### Key Lessons
1. Requirements files should be created fresh at milestone start -- stale files from prior milestones cause confusion
2. Platform-as-data patterns scale well: adding an 11th platform requires only a registry entry, not new code
3. Format diversity (JSON/JSONC/TOML/YAML) is manageable with a unified read-merge-write abstraction

### Cost Observations
- Model mix: quality profile (opus for planning and execution)
- Notable: Compact milestone -- 3 phases, 6 plans, single-day execution

---

## Milestone: v0.9.7 -- MCP Edge Case Validation

**Shipped:** 2026-03-22
**Phases:** 50 | **Plans:** 100 | **Tasks:** 183

### What Was Built
- 50 edge case prompts tested via MCP manual mode across 5 categories (canvas, micro-interaction, scroll, context bloat, dark patterns)
- 6 new CDP tools: scroll_at, click_and_hold, drag_drop, select_text_range, drop_file, drag_variable_speed
- 30+ site guides with real-world selectors, workflows, and automation intelligence
- 50 autopilot diagnostic reports with 500+ recommendations catalogued
- 2 PASS, 46 PARTIAL, 2 SKIP-AUTH outcomes

### What Worked
- Autonomous execution: 50 phases completed in ~3 days with minimal human intervention
- Two-plan-per-phase pattern (01: tooling/site guide, 02: test/diagnostic) kept phases focused and parallelizable
- Smart discuss with --auto flag eliminated interactive questioning overhead for 50 repetitive phases
- Site guide creation captured real-world DOM knowledge that will feed autopilot refinement
- Diagnostic report format (what worked, what failed, tool gaps, autopilot recommendations) created a clear evidence base for v0.9.8

### What Was Inefficient
- WebSocket bridge disconnect persisted from Phase 55 onward, causing 46/50 PARTIAL outcomes -- should have been diagnosed and fixed early
- Verifier agent was skipped for 43 phases to maintain execution speed -- created tech debt of missing VERIFICATION.md files
- HTTP-only validation insufficient for client-rendered SPAs (TikTok, X/Twitter, Observable) -- resulted in "selectors untestable" findings
- Each diagnostic report followed the same template with mostly identical boilerplate (WebSocket blocker section) -- could have been templatized

### Patterns Established
- Edge case validation pattern: site guide + diagnostic report per prompt
- CDP tool creation pattern: manual.ts (MCP) + actions.js (content) + background.js (relay)
- Elimination-based heuristics for dark patterns (ad detection, button classification, checkbox scanning)
- Text/semantic-based identification over positional/visual for randomized UI elements

### Key Lessons
1. MCP tools and autopilot tools diverged -- new tools added to MCP but not to autopilot's CLI_COMMAND_TABLE. Must keep both in sync.
2. WebSocket bridge is a single point of failure for live testing. Needs health check and auto-reconnect.
3. PARTIAL outcomes provide value (tooling validated, strategies documented) even without full live execution.
4. Site guides are the bridge between MCP intelligence and autopilot capability -- they encode what the AI learned.
5. 50 phases in 3 days is sustainable with autonomous execution, but quality gates (verification) shouldn't be skipped.

### Cost Observations
- Model mix: quality profile (opus-heavy for planning, sonnet for execution)
- Sessions: ~331 commits across 3 days
- Notable: Two-plan structure kept individual plan execution fast despite 100 total plans

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.9 | 11 | 24 | Foundation -- reliability engineering |
| v9.0.2 | 10 | 21 | AI perception + context quality |
| v9.3 | 5 | 17 | Modularization + tech debt |
| v9.4 | 9 | 18 | Career search workflows |
| v10.0 | 15 | 37 | CLI architecture rewrite |
| v0.9.2-4 | 6 | 17 | Productivity + memory + AI quality |
| v0.9.5 | 4 | 8 | Progress overlay intelligence |
| v0.9.6 | 7 | - | Agents + remote control |
| v0.9.7 | 50 | 100 | Autonomous edge case validation at scale |
| v0.9.30 | 3 | 6 | MCP platform install flags -- compact, data-driven |
| v0.9.34 | 8 | 11 | Vault/payment/MCP security closure with accepted validation debt |

### Top Lessons (Verified Across Milestones)

1. Keep autopilot and MCP tool registries in sync -- divergence causes capability gaps (v0.9.7)
2. Site guides encode automation intelligence that survives across sessions and modes (v9.3, v9.4, v0.9.7)
3. Two-plan phase structure scales well from 4 phases to 50 phases (v0.9.5, v0.9.7)
4. Autonomous execution at scale works but needs quality gates that don't get skipped (v0.9.7)
5. DOM-based identification beats position/visual for resilient automation (v0.9, v10.0, v0.9.7)
