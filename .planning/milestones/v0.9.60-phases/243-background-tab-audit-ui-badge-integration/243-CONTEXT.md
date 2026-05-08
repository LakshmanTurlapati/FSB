# Phase 243: Background-Tab Audit + UI/Badge Integration - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Auto-generated context (autonomous mode with recommended decisions)

<domain>
## Phase Boundary

Two-pronged: (a) audit + remediate the 25+ existing MCP/autopilot tools so none steal focus on background tabs (force_foreground opt-in flag), migrate long setTimeout waits to chrome.alarms, detect user-initiated navigation pause; (b) UI: agent-id badge on the v0.9.36 overlay + dashboard mirror, "owned by Agent X" read-only chip in popup/sidepanel, Concurrency Cap control finishing touches in options.html (helper text + current-active counter — extends Phase 241's cap input).

</domain>

<decisions>
## Implementation Decisions

### Background-tab audit (BG-01, BG-02)

- **D-01 force_foreground flag in tool-definitions.cjs.** Per-tool boolean, default false. Tools that legitimately need focus (e.g., file pickers, OAuth windows) opt in. The audit pass identifies all chrome.tabs.update({active:true}) call sites and either:
  - removes the call (default, most tools should NOT need focus)
  - moves it behind `if (toolDef.force_foreground)` — the per-tool definition is the single source of truth
- **D-02 setTimeout > 1s migrated to chrome.alarms.** chrome.alarms minimum is 30s in Chrome 120+ but THIS phase only migrates waits >= 30s to chrome.alarms; waits between 1s and 30s use setTimeout (acceptable in foreground; throttled in background but non-fatal — flag for Phase 244 hardening if real-world testing shows issues). Document the threshold rationale in the audit doc.
- **D-03 webNavigation.onCommitted user-initiated pause signal.** Listener detects user-initiated navigation (transition_type 'typed' / 'auto_bookmark' / 'reload' / 'link' triggered without programmatic navigate) on agent-owned tabs; emits `agent-tab-user-navigation` LOG-04 event AND posts a pause signal to the active automation session (existing pause/resume infra; verify in research).

### Badge integration (UI-01, UI-02)

- **D-04 v0.9.36 overlay badge + dashboard mirror.** The existing trusted-client badge renderer (find via grep on 'badge' in extension/) gets a short agentId suffix: `<clientLabel> / <agentId.slice(0, 8)>` (e.g., "Claude / agent_a3f1"). Mirrors on the dashboard if the dashboard already shows the badge.
- **D-05 popup + sidepanel "owned by Agent X" read-only chip.** When the popup/sidepanel detects a tab is owned by a different agent (via existing tab metadata bridge), display a small chip "owned by Agent X" with no enforcement — informational only. Option 3 from architecture research per ROADMAP. The legacy:popup / legacy:sidepanel surfaces from Phase 240 do NOT show this chip when they own the tab themselves.

### Concurrency cap UI polish (UI-03)

- **D-06 Helper text + current-active counter.** Phase 241 shipped the numeric input + reset; this phase adds:
  - Helper text below the input explaining the trade-off (lower = predictable resource use; higher = more parallel agents)
  - Current-active counter (e.g., "3 of 8 active") that updates in real-time via a lightweight listener on chrome.storage.session changes to the registry's active count
  - Inline validation message when the user enters out-of-range values (red text "Must be between 1 and 64")
- **D-07 No new chrome.storage.local key.** The existing `fsbAgentCap` from Phase 241 stays. This phase only adds UI polish around it.

### Claude's Discretion

- Where to render "owned by Agent X" chip — in existing popup/sidepanel header vs as a tab strip annotation
- Badge format options: "Claude / agent_a3f1" vs "Claude (a3f1)" — recommend the slash form for parity with Phase 238's agentIdShort pattern
- The audit doc artifact: 243-BACKGROUND-TAB-AUDIT.md (per-tool table: tool_name, file:line, current force_foreground need, after-fix state)
- Whether to add a per-tool annotation in tool-definitions.cjs JSDoc explaining force_foreground reason — recommend yes for the 1-2 tools that opt in

</decisions>

<canonical_refs>
- `.planning/ROADMAP.md` Phase 243 — 4 SC; depends on Phase 240 + 241; UI hint yes
- `.planning/REQUIREMENTS.md` BG-01..04, UI-01..03
- extension/utils/agent-registry.js (Phase 240/241 — getAgentIdForTab, current-active count source)
- extension/ws/mcp-tool-dispatcher.js (the 25+ tool handlers — audit target)
- extension/ai/tool-definitions.cjs (where the per-tool force_foreground flag lives)
- extension/ui/control_panel.html + options.js (Phase 241 cap input — extend with helper text + counter)
- popup/popup.js + sidepanel/sidepanel.js (chip display)

</canonical_refs>

<code_context>
- Phase 240/241 registry has the data the badge needs (agent_id + ownerLabel)
- v0.9.36 trusted-client badge renderer is the parity point for D-04
- chrome.alarms 30s floor (Phase 241 RESEARCH) — this phase audits setTimeout > 1s but only MIGRATES waits >= 30s to chrome.alarms

</code_context>

<specifics>
- Phase 243 is mostly an audit + polish phase. SC#4 cap control already exists from Phase 241; this phase extends it with helper text + current-active counter.
- The user-navigation pause signal (D-03) is an EMISSION — it doesn't actively pause. The receiving automation loop handles pause/resume.

</specifics>

<deferred>
- Migrating setTimeout 1s-30s waits to chrome.alarms — out of scope (chrome.alarms 30s floor); Phase 244 hardening if real-world testing shows issues.
- Cross-agent badge "click to switch" — UI hint says read-only; defer to future user-demand phase.
- Badge color coding by agent — too far for v0.9.60 polish.

</deferred>

---

*Phase: 243-background-tab-audit-ui-badge-integration*
