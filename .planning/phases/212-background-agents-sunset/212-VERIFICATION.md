---
phase: 212-background-agents-sunset
verified: 2026-04-29T03:56:54Z
status: gaps_found
score: 6/6 must-haves verified
overrides_applied: 1
overrides:
  - gap_index: 2
    truth: "Sunset notice provides copy-to-clipboard export of agent names (ROADMAP SC #3 explicit text)"
    status: overridden
    rationale: |
      CONTEXT.md decision D-11 deliberately removed clipboard / download / copy-to-clipboard
      affordances from the sunset notice. The names list is an assurance affordance only
      ("your work isn't lost"), not a migration path -- OpenClaw and Claude Routines have
      their own onboarding flows. Per PITFALLS.md P11, surfacing only the agent NAMES
      (no task text, no schedule, no run history) avoids leaking credentials or sensitive
      prompt content; adding a clipboard export of the same names would not breach this
      posture but would conflict with the explicit "no clipboard" decision recorded in D-11.
      Phase 212-04 formalizes the deviation rather than re-adding the CTA.
    decision_ref: "CONTEXT.md D-11 (locked); ROADMAP.md Phase 212 SC #3 (overridden)"
    confirmed_by: "user via /gsd-plan-phase 212 --gaps interactive question (2026-04-29)"
gaps:
  - truth: "On extension update from a prior version that had agents, the operator sees a one-time fsb_sunset_notice card listing the names of their previously created agents (AGENTS-03 / ROADMAP SC #3)"
    status: failed
    reason: "ui/options.js:4191 uses Array.isArray(stored.bgAgents) to coerce the storage value, but the canonical legacy storage shape (the only writer that ever ran -- agents/agent-manager.js:86-91) is an OBJECT map keyed by agentId, not an array. Array.isArray({}) returns false, so for every real upgrade target -- the users who actually created agents and whose names the notice is supposed to surface -- the renderer takes the agents=[] fallback, the agents.length===0 early-out fires, and the <aside id=\"fsbSunsetNotice\"> stays hidden forever. The notice silently never renders for the only profiles that matter. AGENTS-05 (storage preservation) is unaffected -- the data is still there -- but the user-visible rationale for preserving it is gone. WR-01 from 212-REVIEW.md flagged this; not yet addressed."
    artifacts:
      - path: "ui/options.js"
        issue: "Line 4191 narrows bgAgents via Array.isArray(), rejecting the legacy object-map shape that all existing-user profiles carry"
    missing:
      - "Replace Array.isArray-only branch with a conditional that handles both shapes: if Array.isArray, use directly; else if typeof stored.bgAgents === 'object', use Object.values(stored.bgAgents); else default to empty array"
      - "Add regression coverage in tests/agent-sunset-control-panel.test.js that simulates the legacy object-map storage shape and asserts the renderer would populate the names list (currently Section 6 only checks function shape + textContent, not the data-handling branch)"
  - truth: "Sunset notice provides copy-to-clipboard export of agent names (ROADMAP SC #3 explicit text)"
    status: overridden
    reason: "ROADMAP.md Phase 212 Success Criterion #3 explicitly requires 'a copy-to-clipboard export of names only (no task text)'. CONTEXT.md decision D-11 ('NO clipboard export, NO download button, NO copy-to-clipboard affordance') deliberately reduced this scope, and the plan + implementation honored D-11. No verification override was recorded. The ROADMAP-level contract therefore remains unmet, even though the deviation was an intentional decision. This is either: (a) an override the developer must accept by adding an overrides: entry to VERIFICATION.md frontmatter, or (b) a real gap that requires implementing the clipboard CTA."
    artifacts:
      - path: "ui/control_panel.html"
        issue: "Sunset notice has 'Got it' dismiss button but no 'Copy names' button; no element to copy names to clipboard"
      - path: "ui/options.js"
        issue: "initializeBackgroundAgentsDeprecation has no clipboard export wiring (no navigator.clipboard.writeText call)"
    missing:
      - "Either add a 'Copy names' button to the sunset notice that writes the joined names to navigator.clipboard, OR add an overrides: frontmatter entry justifying the D-11 deviation from ROADMAP SC #3"
human_verification:
  - test: "Open the FSB control panel after upgrade with pre-existing agents in chrome.storage.local['bgAgents'] (object-map shape from agents/agent-manager.js writer); click the Background Agents nav-item"
    expected: "The deprecation card renders permanently AND the <aside id='fsbSunsetNotice'> unhides showing one <li> per agent name; clicking 'Got it' hides the aside and persists fsb_sunset_notice_dismissed=true"
    why_human: "Requires loading the extension into Chrome with a seeded chrome.storage.local profile carrying the legacy object-map shape; static analysis cannot verify the rendered DOM state on a live profile. Once WR-01 is fixed this should be re-checked."
  - test: "Confirm the deprecation card visual treatment matches the founder/dry tone documented in CONTEXT D-03 (no emojis, no melodrama, dry/witty/founder voice)"
    expected: "Reviewer reads the card copy in the rendered control panel and approves the tone; tweaks land via PR"
    why_human: "Tone/copy review is subjective; CLAUDE.md no-emoji rule is enforced programmatically (4-byte UTF-8 grep) but voice and punch are PR-review judgments per D-03"
  - test: "Click 'Try OpenClaw' and 'Try Claude Routines' CTA buttons on the deprecation card and on both showcase dashboards"
    expected: "Each opens the destination in a new tab (target=_blank), and window.opener is null on the destination page (rel=noopener noreferrer effective)"
    why_human: "Verifying the rendered new-tab behavior and window.opener nullification requires a live browser; rel attribute presence is checked statically but its runtime effect is not"
  - test: "Confirm a stale popup or sidepanel sending chrome.runtime.sendMessage({action:'createAgent', payload:...}) post-upgrade no-ops silently with no console warning flood and no persistence side effects"
    expected: "The message router default handler ignores the action; no chrome.storage.local writes; no console.warn/error noise"
    why_human: "Requires running the extension with a stale UI surface that pre-dates the deprecation; static analysis confirms the cases are commented but cannot exercise the runtime fall-through behavior"
  - test: "Confirm a pre-existing fsb_agent_* chrome.alarms entry firing post-upgrade no-ops silently (the agent branch is commented; MCP_RECONNECT_ALARM and fsb-domstream-watchdog branches still execute their bodies)"
    expected: "The alarm listener early-returns from the MCP and watchdog branches when applicable; for fsb_agent_* alarms it falls through with no work, no error, no console flood"
    why_human: "Requires loading the extension with seeded fsb_agent_* alarms; static analysis confirms the agent branch is commented but cannot trigger live alarm dispatch"
---

# Phase 212: Background Agents Sunset Verification Report

**Phase Goal:** Retire the background-agents feature in favor of OpenClaw / Claude Routines via a playful deprecation card, comment-out (not delete) every agent-only code path with annotation, and mirror the messaging across showcase/dashboard surfaces — preserving shared utilities, storage, and the MCP reconnect alarm path.

**Verified:** 2026-04-29T03:56:54Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Operator opens FSB control panel and sees a permanent playful deprecation card naming OpenClaw + Claude Routines as recommended successors with link-out CTAs and a "Retired in v0.9.45rc1 (April 2026)" footer (AGENTS-01) | VERIFIED | `ui/control_panel.html` contains "Try OpenClaw" (1), "Try Claude Routines" (1), `rel="noopener noreferrer"` (2), `Retired in v0.9.45rc1 (April 2026)` (1); section body of `#background-agents` contains the `.fsb-deprecation-card` block; tests/agent-sunset-control-panel.test.js Section 1 PASSES |
| 2  | Every agent-only code path (agents/*.js, background.js agent surfaces, ws-client.js dispatch, MCP agent tools, popup/sidepanel slash commands, ui/options.js controllers, showcase JS/TS) is commented out (not deleted) with the canonical annotation; shared utilities preserved (AGENTS-02) | VERIFIED | All 4 agents/*.js files carry the canonical annotation and contain only `//`-prefixed body lines; mcp-server/src/tools/agents.ts has zero LIVE `server.tool()` calls; background.js, ws/ws-client.js, ui/options.js, ui/sidepanel.js, ui/popup.js, showcase/js/dashboard.js (42 annotations), showcase/.../dashboard-page.component.ts (48 annotations) all show their agent-only entry points commented; agent-sunset-back-end.test.js (12/12 PASS), agent-sunset-control-panel.test.js (9/9 PASS), agent-sunset-showcase.test.js (6/6 PASS) all green; node --check passes for every modified .js file; tsc --noEmit reports 0 errors in tools/agents.ts and dashboard-page.component.ts |
| 3  | On extension update from a prior version that had agents, operator sees a one-time fsb_sunset_notice card listing previously created agent NAMES with a copy-to-clipboard export (AGENTS-03 / ROADMAP SC #3) | FAILED | (a) ui/options.js:4191 uses Array.isArray(stored.bgAgents) which returns false for the legacy object-map shape that all existing-user profiles carry (writer at agents/agent-manager.js:86-91 stored {agentId: agent} object map). The renderer takes the empty fallback and never unhides the aside on real profiles. WR-01 from 212-REVIEW.md. (b) ROADMAP SC #3 explicitly requires "copy-to-clipboard export"; CONTEXT D-11 deliberately removed this with no override recorded. |
| 4  | Showcase home (Background Agents feature card) and both dashboards (vanilla + Angular) display agents-sunset messaging; ext:remote-control-state and _lz decompression preserved on showcase side (AGENTS-04) | VERIFIED | home-page.component.html shows "Background Agents Retired" with both successor links; showcase/dashboard.html and dashboard-page.component.html both show "Background agents have moved" sunset card; dash-agent-container removed in both (count=0); dash-preview / dash-paired-badge / dash-sse-status preserved (count=1 each); _lz decompression and ext:remote-control-state are LIVE byte-for-byte in both showcase/js/dashboard.js and dashboard-page.component.ts (containsLive() assertions); agent-sunset-showcase.test.js 6/6 PASS |
| 5  | chrome.storage.local['bgAgents'] preserved (not deleted); chrome.alarms fsb_agent_* entries not proactively cleaned (AGENTS-05) | VERIFIED | Section 6 of agent-sunset-back-end.test.js scans every modified back-end file (background.js, agents/*.js, ws/ws-client.js) for LIVE chrome.storage.local.remove(...bgAgents...), chrome.storage.local.set({...bgAgents...}), or chrome.alarms.clear(...fsb_agent_...) — found 0 violations; PASS line is "AGENTS-05 no LIVE bgAgents cleanup or fsb_agent_ alarm clear in modified files" |
| 6  | Shared chrome.alarms.onAlarm listener retains its MCP_RECONNECT_ALARM early-return path; only the agent branch is commented (AGENTS-06) | VERIFIED | Substring "  if (isMcpReconnectAlarm) {\n    armMcpBridge('alarm:' + MCP_RECONNECT_ALARM);\n    return;\n  }" appears LIVE byte-for-byte in background.js (Section 4 of agent-sunset-back-end.test.js PASSES); the Phase 211-02 fsb-domstream-watchdog branch appears LIVE on a unique non-commented line (Section 5 PASSES); tests/dom-stream-perf.test.js PASS confirms no Phase 211-02 regression |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `agents/agent-manager.js` | Inert (whole-file commented) module with canonical annotation header | VERIFIED | annotation count=1; node --check exits 0 |
| `agents/agent-scheduler.js` | Inert (whole-file commented) | VERIFIED | annotation count=1; node --check exits 0 |
| `agents/agent-executor.js` | Inert (whole-file commented) | VERIFIED | annotation count=1; node --check exits 0 |
| `agents/server-sync.js` | Inert (whole-file commented) | VERIFIED | annotation count=1; node --check exits 0 |
| `mcp-server/src/tools/agents.ts` | registerAgentTools shell preserved with zero LIVE server.tool() calls | VERIFIED | annotation count=1; export function registerAgentTools at line 13 LIVE; zero LIVE server.tool() lines (Section 2 of back-end test); tsc --noEmit clean |
| `background.js` | importScripts, message router cases, alarm agent branch, rescheduleAllAgents calls all commented; MCP early-return + dom-stream watchdog preserved | VERIFIED | annotation count=5; zero LIVE importScripts of agents/*.js; zero LIVE case 'createAgent'; zero LIVE rescheduleAllAgents() calls; MCP_RECONNECT_ALARM byte-for-byte preserved; node --check exits 0 |
| `ws/ws-client.js` | dash:agent-run-now case + _handleAgentRunNow method commented | VERIFIED | annotation count=2; zero LIVE case 'dash:agent-run-now'; zero LIVE _handleAgentRunNow method; node --check exits 0 |
| `ui/control_panel.html` | Deprecation card + sunset-notice scaffolding inside #background-agents; Server Sync card preserved untouched | VERIFIED | "Try OpenClaw" / "Try Claude Routines" / footer / fsbSunsetNotice / fsbSunsetNoticeNames / fsbSunsetNoticeDismiss all present (count=1 each); pairingQROverlay / btnPairDashboard / serverHashKey preserved (count=1 each); rel="noopener noreferrer" count=2 on new CTAs |
| `ui/options.css` | New deprecation-card + sunset-notice CSS rules appended | VERIFIED | annotation count=1; .fsb-deprecation-card and .fsb-sunset-notice-list classes defined |
| `ui/options.js` | initializeBackgroundAgentsDeprecation() LIVE; agent UI controllers commented; Server Sync wiring preserved | PARTIAL | Function defined and called (count=1 each); textContent rendering present (count=1); zero LIVE innerHTML in the function body; agent UI controllers commented (showAgentForm, saveAgent, etc. all return 0 LIVE matches); btnPairDashboard / btnGenerateHashKey / btnCopyHashKey / btnTestConnection / btnCancelPairing all LIVE for Phase 213 (Section 4 of UI test PASSES); BUT line 4191 `Array.isArray()` storage-shape check is incorrect (WR-01 from 212-REVIEW.md) — see truth #3 gap |
| `ui/sidepanel.js` | /agent slash command + helpers commented | VERIFIED | annotation count=6; zero LIVE if (message.startsWith('/agent')); zero LIVE function handleAgentCommand; node --check exits 0 |
| `ui/popup.js` | /agent slash command + helpers commented | VERIFIED | annotation count=6; zero LIVE matches for the same patterns; node --check exits 0 |
| `showcase/angular/.../home-page.component.html` | Background Agents feature card replaced with sunset/relocation messaging | VERIFIED | "Background Agents Retired" present; both successor URLs present; rel="noopener noreferrer" count=2; no emojis |
| `showcase/dashboard.html` | Vanilla dashboard agent UI replaced with sunset card; preview/paired/sse preserved | VERIFIED | "Background agents have moved" count=1; dash-agent-container removed (count=0); dash-preview/dash-paired-badge/dash-sse-status preserved (count=1 each); rel="noopener noreferrer" count=2; no emojis |
| `showcase/angular/.../dashboard-page.component.html` | Angular dashboard mirror of same sunset card | VERIFIED | "Background agents have moved" count=1; dash-agent-container removed (count=0); rel="noopener noreferrer" count=2; no emojis |
| `showcase/js/dashboard.js` | Agent code commented per-line; _lz + ext:remote-control-state LIVE byte-for-byte | VERIFIED | 42 annotations; both preservation substrings LIVE on non-commented lines; node --check exits 0 |
| `showcase/angular/.../dashboard-page.component.ts` | Angular agent code commented per-line; same preservation invariants | VERIFIED | 48 annotations; both preservation substrings LIVE on non-commented lines; tsc --noEmit reports 0 errors in this file (matches pre-Phase-212 baseline) |
| `tests/agent-sunset-back-end.test.js` | Regression test enforcing AGENTS-02 / AGENTS-05 / AGENTS-06 invariants | VERIFIED | 12/12 PASS, exits 0 |
| `tests/agent-sunset-control-panel.test.js` | Regression test enforcing AGENTS-01 / AGENTS-02 (UI) / AGENTS-03 invariants | VERIFIED (but blind spot) | 9/9 PASS, exits 0 — but Section 6 only verifies function exists with textContent, does not exercise the storage-shape branch that broke (WR-01) |
| `tests/agent-sunset-showcase.test.js` | Regression test enforcing AGENTS-04 + D-19 byte-for-byte preservation | VERIFIED | 6/6 PASS, exits 0 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `background.js` alarm listener | MCP_RECONNECT_ALARM early-return | byte-for-byte preserved range (post-211-02 offsets) | WIRED | Substring `if (isMcpReconnectAlarm)` and `armMcpBridge('alarm:' + MCP_RECONNECT_ALARM)` LIVE byte-for-byte; Section 4 of back-end test PASSES |
| `background.js` alarm listener | fsb-domstream-watchdog branch (Phase 211-02) | preserved untouched between MCP early-return and (now-commented) agent branch | WIRED | Substring `if (alarm.name === 'fsb-domstream-watchdog')` LIVE on a unique non-commented line; Section 5 PASSES; tests/dom-stream-perf.test.js still passes |
| `mcp-server/src/runtime.ts` | registerAgentTools (no-op shell) | import + call still execute, but inner registerTool calls are commented | WIRED | import at line 10 LIVE; call at line 35 LIVE; zero LIVE server.tool() bodies in agents.ts |
| `ui/control_panel.html` nav-item | `<section id="background-agents">` deprecation card | existing data-section / content-section toggle pattern; nav-item kept visible per D-02 | WIRED | nav-item present, section body replaced with card |
| `ui/options.js` initializeBackgroundAgentsDeprecation | `<ul id="fsbSunsetNoticeNames">` | textContent-only rendering of bgAgents[i].name | PARTIAL | The function reads chrome.storage.local correctly and renders via textContent (no innerHTML — T-01 mitigation holds); BUT it filters with Array.isArray() which rejects the legacy object-map shape, so the connection is intact in code but the data path is broken on real profiles |
| `ui/options.js` dismissSunsetNotice | `chrome.storage.local.fsb_sunset_notice_dismissed` | single-write boolean flag | WIRED | dismiss button click handler writes the flag; subsequent reads honor it (the dismissed early-return at line 4192) |
| showcase/dashboard.js inbound onmessage | _lz decompression branch | byte-for-byte preserved at line 3554 | WIRED | substring LIVE; agent-sunset-showcase.test.js Section 4 PASSES |
| showcase/.../dashboard-page.component.ts handleMessage | ext:remote-control-state renderer (Phase 209) | byte-for-byte preserved at line 3432 | WIRED | full one-line statement LIVE byte-for-byte; agent-sunset-showcase.test.js Section 5 PASSES |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ui/options.js` initializeBackgroundAgentsDeprecation | `agents` (local var, fed to namesList <li> rendering loop) | `chrome.storage.local.get(['bgAgents', 'fsb_sunset_notice_dismissed'], cb)` reads bgAgents which was written by agents/agent-manager.js#saveAgent (now commented; data persists). | NO — the storage-shape coercion `Array.isArray(stored.bgAgents) ? stored.bgAgents : []` rejects the only shape that ever existed in the wild (object map keyed by agentId per agents/agent-manager.js:86-91). On real upgrade profiles, `agents` becomes `[]`, the early-return fires, and the UI never unhides the aside. | HOLLOW (wired but data disconnected) |
| `ui/control_panel.html` deprecation card | none (static HTML; no dynamic data) | n/a | n/a | n/a |
| `showcase/dashboard.html` sunset card | none (static HTML) | n/a | n/a | n/a |
| `showcase/.../home-page.component.html` Background Agents Retired card | none (static HTML/Angular) | n/a | n/a | n/a |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All modified .js files parse with node --check | `node --check` for agents/*.js, background.js, ws/ws-client.js, ui/options.js, ui/sidepanel.js, ui/popup.js, showcase/js/dashboard.js | All exit 0 | PASS |
| Phase 212-01 regression test | `node tests/agent-sunset-back-end.test.js` | 12/12 PASS, exit 0 | PASS |
| Phase 212-02 regression test | `node tests/agent-sunset-control-panel.test.js` | 9/9 PASS, exit 0 | PASS |
| Phase 212-03 regression test | `node tests/agent-sunset-showcase.test.js` | 6/6 PASS, exit 0 | PASS |
| Phase 209 regression | `node tests/dashboard-runtime-state.test.js` | 57 passed / 0 failed | PASS |
| Phase 210 regression | `node tests/qr-pairing.test.js` | All assertions passed | PASS |
| Phase 211-01 regression | `node tests/ws-client-decompress.test.js` | All assertions passed | PASS |
| Phase 211-02 regression | `node tests/dom-stream-perf.test.js` | All assertions passed | PASS |
| Phase 211-03 regression | `node tests/redact-for-log.test.js && node tests/diagnostics-ring-buffer.test.js` | All assertions passed | PASS |
| TypeScript no-new-errors | `cd showcase/angular && npx tsc --noEmit` | 0 errors in dashboard-page.component.ts (matches pre-Phase-212 baseline) | PASS |
| Sunset notice unhides on real profile | seed `chrome.storage.local.set({ bgAgents: { agent_x: { name: 'demo' } } })`, open control panel, click Background Agents nav-item | not exercised by static analysis; current code would fail to render due to WR-01 | SKIP — routed to human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| AGENTS-01 | 212-02 | Playful deprecation card replacing Background Agents tab body, naming OpenClaw + Claude Routines | SATISFIED | ui/control_panel.html deprecation card present with both CTAs and footer; copy is dry/founder voice per CONTEXT D-03; agent-sunset-control-panel.test.js Section 1 PASSES |
| AGENTS-02 | 212-01, 212-02, 212-03 | Agent-only code paths commented out with canonical annotation; shared utilities preserved | SATISFIED | All 8 back-end + 5 UI + 5 showcase files carry annotations; zero LIVE agent entry points; shared utilities (Server Sync wiring, MCP_RECONNECT_ALARM, dom-stream watchdog, _lz, ext:remote-control-state) preserved; all three regression tests PASS |
| AGENTS-03 | 212-02 | One-time fsb_sunset_notice listing previously created agent names with copy-to-clipboard export | BLOCKED | Two sub-failures: (1) ui/options.js:4191 Array.isArray() rejects legacy object-map storage shape -> notice silently never renders for real users (WR-01); (2) ROADMAP SC #3 explicitly required "copy-to-clipboard export"; CONTEXT D-11 deleted that scope without recording an override |
| AGENTS-04 | 212-03 | Showcase mirror: home feature card + both dashboards show sunset messaging; ext:remote-control-state + _lz preserved | SATISFIED | All three HTML/template surfaces show sunset content; both transport contracts LIVE byte-for-byte; agent-sunset-showcase.test.js 6/6 PASS |
| AGENTS-05 | 212-01 | bgAgents storage preserved; fsb_agent_* alarms not proactively cleaned | SATISFIED | Section 6 of back-end test confirms zero LIVE bgAgents cleanup or fsb_agent_ alarm clear in any modified file; data is preserved (which is precisely what creates the WR-01 problem — the data is there in object-map shape and the renderer can't read it) |
| AGENTS-06 | 212-01 | chrome.alarms.onAlarm listener retains MCP_RECONNECT_ALARM early-return; only agent branch commented | SATISFIED | Section 4 of back-end test confirms byte-for-byte preservation of the early-return path; Section 5 confirms the Phase 211-02 dom-stream watchdog branch is LIVE and unique; the agent branch is commented per Task 2 of 212-01 |

All 6 declared requirement IDs are accounted for. AGENTS-03 is BLOCKED.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `ui/options.js` | 4191 | `Array.isArray(stored.bgAgents) ? stored.bgAgents : []` rejects the legacy object-map shape | Blocker | Silently disables the entire AGENTS-03 sunset notice for the only users it was designed for (existing-profile upgrades with agents). Documented in 212-REVIEW.md as WR-01. |
| `package.json` | 3 | version field still reads "0.9.31" while all sunset copy targets "v0.9.45rc1" | Info | Documentation/metadata mismatch; will surface when next release zip is built (`fsb-v0.9.31.zip` will carry "Retired in v0.9.45rc1" notice). 212-REVIEW.md IN-01. Out of strict 212 scope; suggested for the version-bump phase. |
| `ws/ws-client.js` (vs showcase consumers) | n/a | `_lz` envelope check uses `raw._lz === true` in SW but truthy `envelope._lz` in showcase consumers | Info | Pre-existing asymmetry not introduced by Phase 212; D-19 mandated byte-for-byte preservation of consumer side. 212-REVIEW.md IN-02. Flagged for future hygiene. |
| `ui/control_panel.html` (footer/help links) and showcase HTML | 1304-1340, 36, 55, 349-351, 11, 260 | Pre-existing `rel="noopener"` links missing `noreferrer` | Info | Out of 212 scope; new 212 links correctly use both. 212-REVIEW.md IN-03. |

### Human Verification Required

Five items routed to human testing — see frontmatter `human_verification:` section.

### Gaps Summary

Phase 212 successfully retired the back-end agent feature surface, mirrored the deprecation across showcase, and preserved every shared invariant (MCP_RECONNECT_ALARM, dom-stream watchdog, _lz decompression, ext:remote-control-state, bgAgents data, fsb_agent_* alarms). Five of six observable truths are VERIFIED, including the most critical preservation invariants enforced by byte-for-byte regression assertions.

The single failing truth is AGENTS-03 (the sunset notice / "your previous agents" names list). Two distinct sub-failures land here:

1. **WR-01 — silent storage-shape mismatch.** The renderer at `ui/options.js:4191` narrows `stored.bgAgents` via `Array.isArray()`, but the canonical legacy storage shape (the only writer that ever ran lives at `agents/agent-manager.js:86-91`) is an object map keyed by `agentId`. `Array.isArray({})` returns false, so the renderer takes the empty-array fallback and the early-return for `agents.length === 0` fires. The `<aside id="fsbSunsetNotice">` therefore stays hidden forever on every real upgrade profile. The data is preserved (AGENTS-05 holds), but the user-visible affordance that justifies the preservation never appears. The current regression test (Section 6 of `agent-sunset-control-panel.test.js`) only verifies the function exists with `textContent`; it never seeds a realistic storage value, so the bug slipped through. This was already flagged in the just-completed code review (`212-REVIEW.md` WR-01) and is not addressed in any later milestone phase (Phase 213 covers the Sync tab, not the names list).

2. **ROADMAP SC #3 vs CONTEXT D-11 — clipboard export removed without override.** ROADMAP.md Phase 212 Success Criterion #3 explicitly requires "a copy-to-clipboard export of names only (no task text)". CONTEXT D-11 deliberately removed clipboard / download / copy-to-clipboard affordances for assurance-only rendering. The plan + implementation honored D-11 (no clipboard button anywhere in `ui/control_panel.html` or `ui/options.js`), but no `overrides:` entry was added to formally accept the deviation. This is either a real gap (re-implement the clipboard CTA) or a deliberate scope reduction the developer should formalize via `overrides:` frontmatter.

**Recommendation:**

- For sub-failure 1: fix `ui/options.js:4191` to accept both shapes (`Array.isArray ? as-is : Object.values(...)`) and extend `tests/agent-sunset-control-panel.test.js` Section 6 to seed a realistic object-map `bgAgents` value and assert the rendering path populates `<li>` children.
- For sub-failure 2: either (a) add a small "Copy names" CTA to the sunset notice that calls `navigator.clipboard.writeText(names.join('\n'))`, or (b) record an `overrides:` entry in this VERIFICATION.md frontmatter justifying the D-11 deviation:

```yaml
overrides:
  - must_have: "Sunset notice provides copy-to-clipboard export of agent names (ROADMAP SC #3 explicit text)"
    reason: "CONTEXT D-11 removed clipboard / download / copy-to-clipboard affordances per assurance-only rationale; no migration path is needed because OpenClaw / Claude Routines have their own onboarding flows"
    accepted_by: "{name}"
    accepted_at: "2026-04-29T...Z"
```

Either path closes AGENTS-03; sub-failure 1 is independently a real defect that must be fixed regardless of whether sub-failure 2 is overridden.

After both sub-failures are addressed, the five human-verification items above remain — those are appropriate live-runtime checks that cannot be exercised by static analysis (rendered DOM state, tone review, new-tab behavior, zombie-message no-op, zombie-alarm no-op) and should be re-run on the live extension before release.

---

_Verified: 2026-04-29T03:56:54Z_
_Verifier: Claude (gsd-verifier)_
