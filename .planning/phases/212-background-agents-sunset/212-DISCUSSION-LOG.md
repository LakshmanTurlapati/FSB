# Phase 212: Background Agents Sunset - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 212-background-agents-sunset
**Areas discussed:** Deprecation card design + copy, fsb_sunset_notice card behavior, Plan split shape, Comment-out style + MCP tool surface

---

## Deprecation card design + copy

| Option | Description | Selected |
|--------|-------------|----------|
| One canonical playful tagline (Recommended) | Single well-written tagline, no rotation. | ✓ |
| Three rotating taglines | Rotates per page load via Math.random(). | |

**User's choice:** One canonical playful tagline.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single card with two named-CTA buttons (Recommended) | Replace #background-agents body with one card. Headline + body + two side-by-side CTA buttons opening in new tabs. Optional muted footer. | ✓ |
| Card with combined link copy | One card with body paragraph that inlines both alternatives as text links. No CTA buttons. | |
| Full-width banner above existing UI | Banner above existing UI; contradicts "replacing the tab body". | |

**User's choice:** Single card with two named-CTA buttons.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Always shown, not dismissible (Recommended) | The card IS the section. Permanent. | ✓ |
| Dismissible with "shown again later" | X close hides for 7 days, persisted. | |

**User's choice:** Always shown, not dismissible.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Claude picks playful copy at plan time (Recommended) | Claude drafts something witty/dry. User reviews in PR. | ✓ |
| Let me write the tagline + body now | User dictates exact words. | |

**User's choice:** Claude picks playful copy at plan time.

**Notes:** Tone is dry, witty, founder-style. No emojis. ~30-50 words headline+body.

---

## fsb_sunset_notice card behavior

| Option | Description | Selected |
|--------|-------------|----------|
| First open of control panel after update, control panel only (Recommended) | Modal or top-of-section card on first open after onInstalled (reason=update). | |
| First open of any UI surface | Card appears in popup/sidepanel/control panel whichever opens first. | |
| Always-shown banner in Background Agents section, dismissible | Banner at top of #background-agents section. | |
| Other (free-text) | "only in agents tab" | ✓ |

**User's choice:** Free-text -- "only in agents tab". Interpretation: the names list lives BELOW the deprecation card, inside the Background Agents tab body. NOT a first-launch modal. NOT a popup or sidepanel notice.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Plain-text numbered list (Recommended) | Copy-to-clipboard produces "1. Daily LinkedIn Check\n2. Weekly Notion Backup\n..." | |
| JSON with names array | { "agents": [...], "exportedAt": "<ISO>", "version": "v0.9.45rc1" } | |
| CSV (single column) | name\nDaily LinkedIn Check\n... | |
| Other (free-text) | "no export" | ✓ |

**User's choice:** Free-text -- "no export". Interpretation: drop the copy-to-clipboard / download / export affordance entirely. Names are displayed for assurance ("your work isn't lost"), not for migration. AGENTS-03 still satisfied: "user sees a one-time fsb_sunset_notice card listing the names of their previously created agents" -- export was an enhancement that's now dropped.

---

| Option | Description | Selected |
|--------|-------------|----------|
| One-time -- dismiss button persists 'shown' (Recommended) | "Got it" button sets fsb_sunset_notice_dismissed = true. | ✓ |
| Show once, auto-dismiss on copy | Auto-dismisses after Copy click. | |

**User's choice:** One-time dismiss button. Note: with "no export" decision, this means the dismiss button is the ONLY way to clear the names list; no auto-dismiss-on-copy path.

---

## Plan split shape

| Option | Description | Selected |
|--------|-------------|----------|
| 3 plans -- Back-end / Control Panel / Showcase (Recommended) | Atomic per surface. | ✓ |
| 2 plans -- Code commenting / UI replacement | Larger diffs. | |
| 4 plans -- split showcase by Angular vs vanilla | Smaller per-plan; more orchestration. | |

**User's choice:** 3 plans.

---

| Option | Description | Selected |
|--------|-------------|----------|
| All in one parallel wave (Recommended) | File-disjoint plans; sequential dispatch handles ordering. | ✓ |
| 212-01 first, then 212-02 + 212-03 wave 2 | Cleaner gate-before-UI ordering; slower. | |

**User's choice:** All in one parallel wave.

---

## Comment-out style + MCP tool surface

| Option | Description | Selected |
|--------|-------------|----------|
| Block comment (/*...*/) wrapping the whole file body (Recommended) | Top: `// DEPRECATED v0.9.45rc1: ...` annotation + `/*` open. Bottom: `*/` close. Caveat: if file body contains `*/`, fall back to per-line `//`. | |
| Every-line // comment | Prefix every line with //. Bigger diff but unambiguous. | |
| Smart per-file: try block comment, fall back to // | Best of both. | |
| (User asked for clarification first) | "does mcp have a tool agent? clarofy" | (clarification provided) |

After clarification on a re-asked question:

| Option | Description | Selected |
|--------|-------------|----------|
| Block comment (/*...*/) wrapping the whole file body (Recommended) | + pre-flight scan for `*/` and fall back to per-line `//` if found. | ✓ |
| Every-line // comment for all 5 files | Bigger diff but unambiguous. | |
| Smart per-file: try block comment, fall back to // if file contains */ | Best of both. | |

**User's choice (after clarification):** Block comment with pre-flight scan fallback.

**Notes:** Final answer combines D-13 (block comment as preferred style) + D-14 (pre-flight `*/` scan with per-line `//` fallback per file).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Comment out registerAgentTools call site only (Recommended) | Two-line change at runtime.ts:10 (import) and :35 (call). | |
| Comment out individual tool registrations only | Keep registerAgentTools function but comment each registerTool call inside. | ✓ |
| (other -- not selected) | | |

**User's choice:** Comment out individual tool registrations inside `registerAgentTools`. Function shell stays; registers no tools.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Block-comment the agent-related blocks (Recommended) | Same approach as back-end files: locate contiguous agent-related method/state blocks, wrap in /* ... */ with annotation. | ✓ |
| isAgentsRetired = true flag with conditional rendering | Component flag + *ngIf. Less code churn but leaves dead code in TS. | |
| Wholesale delete agent-related code in showcase only | Cleaner showcase but contradicts "comment, don't delete". | |

**User's choice:** Block-comment the agent-related blocks.

---

## Claude's Discretion

The following items were left for the planner/researcher to resolve without further user input:

- The exact deprecation card tagline + body copy -- Claude drafts at plan time; user reviews in PR.
- Visual treatment of the names list (table vs <ul> vs comma-separated) -- planner picks.
- Optional `[FSB BG]` deprecation-gate logging via Phase 211's ring buffer -- planner decides.
- Exact set of regression tests beyond the must-haves (MCP_RECONNECT_ALARM byte preservation, bgAgents preservation, no fsb_agent_* alarm cleanup).
- Angular component refactor strategy beyond block-commenting (e.g., DI-injected agent service no-op stubs).

## Deferred Ideas

None added during this discussion. Items already deferred at the milestone level:

- AGENTS-FUTURE-01: One-time chrome.alarms.getAll() cleanup of fsb_agent_* alarms.
- AGENTS-FUTURE-02: MCP agent tools return structured deprecated error payloads.

Considered and explicitly rejected:
- First-launch modal for sunset notice (replaced with in-tab placement).
- Copy-to-clipboard / JSON export of agent names (dropped per user explicit "no export").
- Component flag isAgentsRetired = true for Angular (dropped in favor of block-commenting).
- Rotating taglines (dropped in favor of one canonical tagline).
- Dismissible deprecation card (dropped; the card is permanent).
