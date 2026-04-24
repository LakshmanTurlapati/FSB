# Roadmap: FSB (Full Self-Browsing)

## Active Milestone: v0.9.36 MCP Visual Lifecycle & Client Identity

## Phases

- [x] **Phase 203: MCP Visual Session Contract** - Add explicit MCP start/progress/end routes and trusted client allowlist validation for client-owned visual feedback on the active tab.
- [x] **Phase 204: Overlay Badge & Session Persistence** - Render approved client badges in the on-page overlay and mirrored preview surfaces while honoring navigation, reinjection, timeout, and cleanup rules.
- [x] **Phase 205: Validation & MCP Usage Docs** - Lock the feature with route/UI regression tests, stale-cleanup coverage, and docs for Claude/Codex/ChatGPT-style MCP clients.

## Phase Details

### Phase 203: MCP Visual Session Contract

**Goal**: MCP clients can explicitly claim and release the visible automation surface without invoking FSB autopilot.

**Depends on**: Nothing

**Requirements**: LIFE-01, LIFE-02, LIFE-03, BADGE-01

**Success Criteria** (what must be TRUE):
1. MCP exposes a clear start tool and end/finalization path for visual sessions on the active normal webpage.
2. Progress updates can change overlay detail text without creating duplicate or competing sessions.
3. Success, partial, failure, cancel, and explicit end flows all clear the client-owned session cleanly.
4. Caller-supplied client labels are validated against an approved allowlist instead of being rendered as arbitrary text.

### Phase 204: Overlay Badge & Session Persistence

**Goal**: The page overlay and mirrored preview surfaces visibly show which approved MCP client is driving the session and keep that state coherent through runtime churn.

**Depends on**: Phase 203

**Requirements**: LIFE-04, BADGE-02, BADGE-03, BADGE-04

**Success Criteria** (what must be TRUE):
1. The page overlay shows a compact client badge alongside the existing task/progress treatment.
2. Dashboard or DOM-stream preview surfaces display the same client label and lifecycle state as the live page.
3. Client identity survives content-script reinjection and same-session navigation on the owned tab.
4. Watchdog or disconnect handling degrades or clears stale sessions so the glow never stays stuck after the client disappears.

### Phase 205: Validation & MCP Usage Docs

**Goal**: The new lifecycle contract is trustworthy because it is documented, regression-tested, and explicit about when to use it.

**Depends on**: Phase 203, Phase 204

**Requirements**: VALID-01, VALID-02, VALID-03

**Success Criteria** (what must be TRUE):
1. MCP route tests prove start/progress/end flows, allowlist enforcement, and cleanup idempotency.
2. Overlay/UI tests prove badge rendering, final freeze, watchdog recovery, and stale-message suppression for client-owned sessions.
3. MCP docs show how a client should bracket its browser work with start/progress/end calls and when `run_task` remains the better fit.

## Progress

**Execution Order:** 203 -> 204 -> 205

| Phase | Requirements | Status |
|-------|--------------|--------|
| 203. MCP Visual Session Contract | LIFE-01, LIFE-02, LIFE-03, BADGE-01 | Completed |
| 204. Overlay Badge & Session Persistence | LIFE-04, BADGE-02, BADGE-03, BADGE-04 | Completed |
| 205. Validation & MCP Usage Docs | VALID-01, VALID-02, VALID-03 | Completed |

## Archive

See [.planning/milestones/v0.9.35-ROADMAP.md](./milestones/v0.9.35-ROADMAP.md) for the full active-roadmap snapshot that was archived at the v0.9.35 milestone close.

## Previous Milestones

<details>
<summary>v0.9.35 MCP Plug-and-Play Reliability (shipped 2026-04-24)</summary>

5 phases, 15 plans. Bridge lifecycle recovery, direct MCP route contracts, diagnostics, installer parity, and release smoke/UAT hardening.

</details>

<details>
<summary>v0.9.34 Vault, Payments & Secure MCP Access (shipped 2026-04-22)</summary>

8 phases, 11 plans. Vault unlock repair, payment method backend/UI wiring, autopilot vault fills, MCP vault tools, and security boundary fixes for sensitive credential/payment flows. Archived with accepted validation debt for live vault/payment UAT.

</details>

<details>
<summary>v0.9.30 MCP Platform Install Flags (shipped 2026-04-18)</summary>

3 phases, 6 plans. Platform registry, format-aware config engine, install/uninstall CLI, Claude Code delegation, Codex TOML, Continue YAML, `--dry-run`, and `--all` support.

</details>

## Backlog

- Deferred Angular migration requirements (DASH-08 through MIGR-03) remain parked from v0.9.29.
- Live UAT for v0.9.34 vault behavior and MCP payment approve/deny/delayed approval remains accepted validation debt unless it overlaps future verification work.

---
*Roadmap created: 2026-04-23*
*Last updated: 2026-04-24 after completing v0.9.36 execution*
