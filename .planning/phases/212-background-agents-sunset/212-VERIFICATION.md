---
phase: 212-background-agents-sunset
verified: 2026-04-29T03:56:54Z
re_verified: 2026-04-29T05:42:00Z
status: verified
score: 6/6 must-haves verified
overrides_applied: 1
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  closure_plan: 212-04
  gaps_closed:
    - "Gap 1 (WR-01): bgAgents storage-shape coercion in ui/options.js initializeBackgroundAgentsDeprecation now handles both array and object-map shapes via Object.values; regression coverage added in tests/agent-sunset-control-panel.test.js Section 7"
  gaps_overridden:
    - "Gap 2 (clipboard / ROADMAP SC #3): formal overrides[] frontmatter block added per D-11; status overridden, audit trail intact"
  gaps_remaining: []
  regressions: []
  closure_commits:
    - "6270672 -- fix(212-04): accept both array and object-map shapes for bgAgents in sunset notice renderer (Gap 1 / WR-01 / AGENTS-03)"
    - "31fd469 -- test(212-04): extend agent-sunset-control-panel Section 7 to cover bgAgents storage-shape coercion"
    - "12bbf99 -- docs(212-04): add overrides: block to 212-VERIFICATION.md formalizing D-11 deviation from ROADMAP SC #3"
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
    status: resolved
    reason: "WR-01 fix shipped in 212-04 commit 6270672 -- bgAgents object-map shape now correctly coerced via Object.values. ui/options.js:4191 no longer contains the buggy single-branch Array.isArray(stored.bgAgents) literal (grep count = 0); the new three-branch coercion is present at lines 4196-4199 (raw = stored && stored.bgAgents; Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : [])); regression coverage added as Section 7 of tests/agent-sunset-control-panel.test.js (PASS line 'Gap1 / WR-01 storage-shape coercion handles object-map (Object.values) AND array (Array.isArray) shapes; old single-branch literal removed' -- test now reports 10/10 PASS, exit 0). T-01 XSS mitigation preserved (li.textContent = name still on a single LIVE line; zero li.innerHTML = assignments). D-11 honored (no clipboard CTA introduced; navigator.clipboard.writeText count in ui/options.js is 1 -- the pre-existing copyHashKey() at line 4804, not in initializeBackgroundAgentsDeprecation). D-15 invariant preserved (Server Sync wiring at lines 4189-4205 untouched)."
    artifacts:
      - path: "ui/options.js"
        issue: "RESOLVED: lines 4191-4199 now contain the three-branch coercion; old buggy literal grep returns 0"
      - path: "tests/agent-sunset-control-panel.test.js"
        issue: "RESOLVED: Section 7 added (handlesObjectMap + handlesArray + hasBuggyOldBranch=false assertion); test prints 10 PASS lines and exits 0"
    missing: []
  - truth: "Sunset notice provides copy-to-clipboard export of agent names (ROADMAP SC #3 explicit text)"
    status: overridden
    reason: "ROADMAP.md Phase 212 Success Criterion #3 explicitly requires 'a copy-to-clipboard export of names only (no task text)'. CONTEXT.md decision D-11 ('NO clipboard export, NO download button, NO copy-to-clipboard affordance') deliberately reduced this scope, and the plan + implementation honored D-11. The user formally accepted this deviation via the overrides[] block at the top of this frontmatter on 2026-04-29 during gap-closure planning; D-11 stands and the clipboard CTA is not re-added."
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
    why_human: "Requires loading the extension into Chrome with a seeded chrome.storage.local profile carrying the legacy object-map shape; static analysis cannot verify the rendered DOM state on a live profile. WR-01 fix is shipped (212-04 commit 6270672); this UAT now exercises the corrected coercion path on a live profile."
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

**Phase Goal:** Retire the background-agents feature in favor of OpenClaw / Claude Routines via a playful deprecation card, comment-out (not delete) every agent-only code path with annotation, and mirror the messaging across showcase/dashboard surfaces -- preserving shared utilities, storage, and the MCP reconnect alarm path.

**Verified:** 2026-04-29T03:56:54Z
**Re-verified:** 2026-04-29T05:42:00Z
**Status:** verified
**Re-verification:** Yes -- after gap-closure plan 212-04 shipped (commits 6270672 + 31fd469 + 12bbf99). Both prior gaps now closed: Gap 1 (WR-01) RESOLVED via storage-shape coercion patch + Section 7 regression coverage; Gap 2 (clipboard / ROADMAP SC #3) OVERRIDDEN per CONTEXT.md D-11 with formal frontmatter audit trail. Five live-runtime UAT items remain in `human_verification:` -- these are the same items recorded at initial verification and require browser-level testing that static analysis cannot exercise; they are deferred to live UAT, not new gaps.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Operator opens FSB control panel and sees a permanent playful deprecation card naming OpenClaw + Claude Routines as recommended successors with link-out CTAs and a "Retired in v0.9.45rc1 (April 2026)" footer (AGENTS-01) | VERIFIED | `ui/control_panel.html` contains "Try OpenClaw" (1), "Try Claude Routines" (1), `rel="noopener noreferrer"` (2), `Retired in v0.9.45rc1 (April 2026)` (1); section body of `#background-agents` contains the `.fsb-deprecation-card` block; tests/agent-sunset-control-panel.test.js Section 1 PASSES |
| 2  | Every agent-only code path (agents/*.js, background.js agent surfaces, ws-client.js dispatch, MCP agent tools, popup/sidepanel slash commands, ui/options.js controllers, showcase JS/TS) is commented out (not deleted) with the canonical annotation; shared utilities preserved (AGENTS-02) | VERIFIED | All 4 agents/*.js files carry the canonical annotation and contain only `//`-prefixed body lines; mcp-server/src/tools/agents.ts has zero LIVE `server.tool()` calls; background.js, ws/ws-client.js, ui/options.js, ui/sidepanel.js, ui/popup.js, showcase/js/dashboard.js (42 annotations), showcase/.../dashboard-page.component.ts (48 annotations) all show their agent-only entry points commented; agent-sunset-back-end.test.js (12/12 PASS), agent-sunset-control-panel.test.js (10/10 PASS), agent-sunset-showcase.test.js (6/6 PASS) all green; node --check passes for every modified .js file; tsc --noEmit reports 0 errors in tools/agents.ts and dashboard-page.component.ts |
| 3  | On extension update from a prior version that had agents, operator sees a one-time fsb_sunset_notice card listing previously created agent NAMES (AGENTS-03 / ROADMAP SC #3) | VERIFIED | (Gap 1 RESOLVED in 212-04) `ui/options.js:4196-4199` now reads `const raw = stored && stored.bgAgents; const agents = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);` -- correctly handles both the canonical legacy object-map shape (the only writer that ever ran) and a defensive array shape. The buggy `Array.isArray(stored.bgAgents)` literal grep count is now 0. tests/agent-sunset-control-panel.test.js Section 7 enforces this on every run (handlesObjectMap + handlesArray + !hasBuggyOldBranch -> PASS). T-01 XSS mitigation preserved (`li.textContent = name`; zero `li.innerHTML =` assignments). Live-profile rendering deferred to human UAT #1 below. (Gap 2 OVERRIDDEN: ROADMAP SC #3 clipboard requirement formally deviated per CONTEXT.md D-11; see `overrides:` frontmatter block above.) |
| 4  | Showcase home (Background Agents feature card) and both dashboards (vanilla + Angular) display agents-sunset messaging; ext:remote-control-state and _lz decompression preserved on showcase side (AGENTS-04) | VERIFIED | home-page.component.html shows "Background Agents Retired" with both successor links; showcase/dashboard.html and dashboard-page.component.html both show "Background agents have moved" sunset card; dash-agent-container removed in both (count=0); dash-preview / dash-paired-badge / dash-sse-status preserved (count=1 each); _lz decompression and ext:remote-control-state are LIVE byte-for-byte in both showcase/js/dashboard.js and dashboard-page.component.ts (containsLive() assertions); agent-sunset-showcase.test.js 6/6 PASS |
| 5  | chrome.storage.local['bgAgents'] preserved (not deleted); chrome.alarms fsb_agent_* entries not proactively cleaned (AGENTS-05) | VERIFIED | Section 6 of agent-sunset-back-end.test.js scans every modified back-end file (background.js, agents/*.js, ws/ws-client.js) for LIVE chrome.storage.local.remove(...bgAgents...), chrome.storage.local.set({...bgAgents...}), or chrome.alarms.clear(...fsb_agent_...) -- found 0 violations; PASS line is "AGENTS-05 no LIVE bgAgents cleanup or fsb_agent_ alarm clear in modified files" |
| 6  | Shared chrome.alarms.onAlarm listener retains its MCP_RECONNECT_ALARM early-return path; only the agent branch is commented (AGENTS-06) | VERIFIED | Substring "  if (isMcpReconnectAlarm) {\n    armMcpBridge('alarm:' + MCP_RECONNECT_ALARM);\n    return;\n  }" appears LIVE byte-for-byte in background.js (Section 4 of agent-sunset-back-end.test.js PASSES); the Phase 211-02 fsb-domstream-watchdog branch appears LIVE on a unique non-commented line (Section 5 PASSES); tests/dom-stream-perf.test.js PASS confirms no Phase 211-02 regression |

**Score:** 6/6 truths verified (5 VERIFIED + 1 OVERRIDDEN-counts-as-resolved per the verifier contract).

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
| `ui/options.js` | initializeBackgroundAgentsDeprecation() LIVE; agent UI controllers commented; Server Sync wiring preserved; bgAgents storage-shape coercion accepts both array and object-map | VERIFIED | (Gap 1 RESOLVED in 212-04 commit 6270672) Function defined and called (count=1 each); textContent rendering present (count=1); zero LIVE innerHTML in the function body; agent UI controllers commented (showAgentForm, saveAgent, etc. all return 0 LIVE matches); btnPairDashboard / btnGenerateHashKey / btnCopyHashKey / btnTestConnection / btnCancelPairing all LIVE for Phase 213 (Section 4 of UI test PASSES); coercion patch shipped: Object.values(raw) count=1, Array.isArray(raw) count=1, Array.isArray(stored.bgAgents) count=0 (old buggy literal removed); node --check exits 0 |
| `ui/sidepanel.js` | /agent slash command + helpers commented | VERIFIED | annotation count=6; zero LIVE if (message.startsWith('/agent')); zero LIVE function handleAgentCommand; node --check exits 0 |
| `ui/popup.js` | /agent slash command + helpers commented | VERIFIED | annotation count=6; zero LIVE matches for the same patterns; node --check exits 0 |
| `showcase/angular/.../home-page.component.html` | Background Agents feature card replaced with sunset/relocation messaging | VERIFIED | "Background Agents Retired" present; both successor URLs present; rel="noopener noreferrer" count=2; no emojis |
| `showcase/dashboard.html` | Vanilla dashboard agent UI replaced with sunset card; preview/paired/sse preserved | VERIFIED | "Background agents have moved" count=1; dash-agent-container removed (count=0); dash-preview/dash-paired-badge/dash-sse-status preserved (count=1 each); rel="noopener noreferrer" count=2; no emojis |
| `showcase/angular/.../dashboard-page.component.html` | Angular dashboard mirror of same sunset card | VERIFIED | "Background agents have moved" count=1; dash-agent-container removed (count=0); rel="noopener noreferrer" count=2; no emojis |
| `showcase/js/dashboard.js` | Agent code commented per-line; _lz + ext:remote-control-state LIVE byte-for-byte | VERIFIED | 42 annotations; both preservation substrings LIVE on non-commented lines; node --check exits 0 |
| `showcase/angular/.../dashboard-page.component.ts` | Angular agent code commented per-line; same preservation invariants | VERIFIED | 48 annotations; both preservation substrings LIVE on non-commented lines; tsc --noEmit reports 0 errors in this file (matches pre-Phase-212 baseline) |
| `tests/agent-sunset-back-end.test.js` | Regression test enforcing AGENTS-02 / AGENTS-05 / AGENTS-06 invariants | VERIFIED | 12/12 PASS, exits 0 |
| `tests/agent-sunset-control-panel.test.js` | Regression test enforcing AGENTS-01 / AGENTS-02 (UI) / AGENTS-03 invariants + storage-shape branch coverage | VERIFIED | (Section 7 added in 212-04 commit 31fd469) 10/10 PASS, exits 0; new Section 7 line: "Gap1 / WR-01 storage-shape coercion handles object-map (Object.values) AND array (Array.isArray) shapes; old single-branch literal removed" |
| `tests/agent-sunset-showcase.test.js` | Regression test enforcing AGENTS-04 + D-19 byte-for-byte preservation | VERIFIED | 6/6 PASS, exits 0 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `background.js` alarm listener | MCP_RECONNECT_ALARM early-return | byte-for-byte preserved range (post-211-02 offsets) | WIRED | Substring `if (isMcpReconnectAlarm)` and `armMcpBridge('alarm:' + MCP_RECONNECT_ALARM)` LIVE byte-for-byte; Section 4 of back-end test PASSES |
| `background.js` alarm listener | fsb-domstream-watchdog branch (Phase 211-02) | preserved untouched between MCP early-return and (now-commented) agent branch | WIRED | Substring `if (alarm.name === 'fsb-domstream-watchdog')` LIVE on a unique non-commented line; Section 5 PASSES; tests/dom-stream-perf.test.js still passes |
| `mcp-server/src/runtime.ts` | registerAgentTools (no-op shell) | import + call still execute, but inner registerTool calls are commented | WIRED | import at line 10 LIVE; call at line 35 LIVE; zero LIVE server.tool() bodies in agents.ts |
| `ui/control_panel.html` nav-item | `<section id="background-agents">` deprecation card | existing data-section / content-section toggle pattern; nav-item kept visible per D-02 | WIRED | nav-item present, section body replaced with card |
| `ui/options.js` initializeBackgroundAgentsDeprecation | `<ul id="fsbSunsetNoticeNames">` | textContent-only rendering of bgAgents[i].name; storage shape coerced via three-branch Array.isArray / Object.values / [] | WIRED | (Gap 1 RESOLVED) The function reads chrome.storage.local correctly, coerces via `Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : [])`, and renders via textContent (no innerHTML -- T-01 mitigation holds). Section 7 of the UI regression test enforces this invariant. Live-profile rendering deferred to human UAT #1. |
| `ui/options.js` dismissSunsetNotice | `chrome.storage.local.fsb_sunset_notice_dismissed` | single-write boolean flag | WIRED | dismiss button click handler writes the flag; subsequent reads honor it (the dismissed early-return after the coercion block) |
| showcase/dashboard.js inbound onmessage | _lz decompression branch | byte-for-byte preserved | WIRED | substring LIVE; agent-sunset-showcase.test.js Section 4 PASSES |
| showcase/.../dashboard-page.component.ts handleMessage | ext:remote-control-state renderer (Phase 209) | byte-for-byte preserved | WIRED | full one-line statement LIVE byte-for-byte; agent-sunset-showcase.test.js Section 5 PASSES |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ui/options.js` initializeBackgroundAgentsDeprecation | `agents` (local var, fed to namesList <li> rendering loop) | `chrome.storage.local.get(['bgAgents', 'fsb_sunset_notice_dismissed'], cb)` reads bgAgents which was written by agents/agent-manager.js#saveAgent (now commented; data persists). | YES -- the storage-shape coercion at lines 4196-4199 (after 212-04 fix) accepts both `Array.isArray(raw)` (defensive) and `raw && typeof raw === 'object'` (canonical legacy object-map shape from agents/agent-manager.js:86-91 -- the only writer that ever ran). On real upgrade profiles the object-map values flow through `Object.values(raw)` into the rendering loop and populate `<li>` children. Live-profile rendering routed to human UAT #1. | FLOWING (after 212-04 fix; data now reaches the UI via the corrected coercion) |
| `ui/control_panel.html` deprecation card | none (static HTML; no dynamic data) | n/a | n/a | n/a |
| `showcase/dashboard.html` sunset card | none (static HTML) | n/a | n/a | n/a |
| `showcase/.../home-page.component.html` Background Agents Retired card | none (static HTML/Angular) | n/a | n/a | n/a |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All modified .js files parse with node --check | `node --check` for agents/*.js, background.js, ws/ws-client.js, ui/options.js, ui/sidepanel.js, ui/popup.js, showcase/js/dashboard.js | All exit 0 | PASS |
| Phase 212-01 regression test | `node tests/agent-sunset-back-end.test.js` | 12/12 PASS, exit 0 | PASS |
| Phase 212-02 regression test (with new Section 7) | `node tests/agent-sunset-control-panel.test.js` | 10/10 PASS, exit 0 | PASS |
| Phase 212-03 regression test | `node tests/agent-sunset-showcase.test.js` | 6/6 PASS, exit 0 | PASS |
| Phase 209 regression | `node tests/dashboard-runtime-state.test.js` | 57 passed / 0 failed | PASS |
| Phase 210 regression | `node tests/qr-pairing.test.js` | All assertions passed | PASS |
| Phase 211-01 regression | `node tests/ws-client-decompress.test.js` | All assertions passed | PASS |
| Phase 211-02 regression | `node tests/dom-stream-perf.test.js` | All assertions passed | PASS |
| Phase 211-03 regression | `node tests/redact-for-log.test.js && node tests/diagnostics-ring-buffer.test.js` | All assertions passed | PASS |
| TypeScript no-new-errors | `cd showcase/angular && npx tsc --noEmit` | 0 errors in dashboard-page.component.ts (matches pre-Phase-212 baseline) | PASS |
| WR-01 fix shipped (storage-shape coercion present, old buggy literal absent) | `grep -c "Object.values(raw)" ui/options.js` (=1), `grep -c "Array.isArray(raw)" ui/options.js` (=1), `grep -c "Array.isArray(stored.bgAgents)" ui/options.js` (=0) | All three counts match expected | PASS |
| T-01 mitigation preserved (textContent only, zero innerHTML) | `grep -c "li.textContent = name" ui/options.js` (=1), `grep -nE "li\.innerHTML\s*=" ui/options.js` (0 lines) | textContent present, innerHTML absent | PASS |
| D-11 honored (no clipboard CTA in deprecation function) | `grep -cE "navigator\.clipboard|writeText" ui/options.js` (=1, but it is in copyHashKey() at line 4804 -- pre-existing Server Sync code, NOT in initializeBackgroundAgentsDeprecation) | Confirmed | PASS |
| Sunset notice unhides on real profile | seed `chrome.storage.local.set({ bgAgents: { agent_x: { name: 'demo' } } })`, open control panel, click Background Agents nav-item | not exercised by static analysis; the WR-01 coercion fix is now shipped so the rendering path is correct in code | SKIP -- routed to human verification #1 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| AGENTS-01 | 212-02 | Playful deprecation card replacing Background Agents tab body, naming OpenClaw + Claude Routines | SATISFIED | ui/control_panel.html deprecation card present with both CTAs and footer; copy is dry/founder voice per CONTEXT D-03; agent-sunset-control-panel.test.js Section 1 PASSES |
| AGENTS-02 | 212-01, 212-02, 212-03 | Agent-only code paths commented out with canonical annotation; shared utilities preserved | SATISFIED | All 8 back-end + 5 UI + 5 showcase files carry annotations; zero LIVE agent entry points; shared utilities (Server Sync wiring, MCP_RECONNECT_ALARM, dom-stream watchdog, _lz, ext:remote-control-state) preserved; all three regression tests PASS |
| AGENTS-03 | 212-02 + 212-04 | One-time fsb_sunset_notice listing previously created agent names with copy-to-clipboard export | SATISFIED | (Was BLOCKED at initial verification; now SATISFIED after 212-04.) Sub-failure 1 (WR-01 storage-shape coercion): RESOLVED in commit 6270672 -- ui/options.js now reads bgAgents through `Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : [])`; Section 7 of the UI regression test enforces both branches and guards against revert. Sub-failure 2 (ROADMAP SC #3 clipboard requirement): formally OVERRIDDEN per CONTEXT.md D-11 with audit trail in the `overrides:` frontmatter block (decision_ref + confirmed_by); the deviation is accepted, the clipboard CTA is intentionally absent. |
| AGENTS-04 | 212-03 | Showcase mirror: home feature card + both dashboards show sunset messaging; ext:remote-control-state + _lz preserved | SATISFIED | All three HTML/template surfaces show sunset content; both transport contracts LIVE byte-for-byte; agent-sunset-showcase.test.js 6/6 PASS |
| AGENTS-05 | 212-01 | bgAgents storage preserved; fsb_agent_* alarms not proactively cleaned | SATISFIED | Section 6 of back-end test confirms zero LIVE bgAgents cleanup or fsb_agent_ alarm clear in any modified file; data is preserved AND now correctly read by the patched coercion (the user-visible rationale for AGENTS-05 is now intact end-to-end) |
| AGENTS-06 | 212-01 | chrome.alarms.onAlarm listener retains MCP_RECONNECT_ALARM early-return; only agent branch commented | SATISFIED | Section 4 of back-end test confirms byte-for-byte preservation of the early-return path; Section 5 confirms the Phase 211-02 dom-stream watchdog branch is LIVE and unique; the agent branch is commented per Task 2 of 212-01 |

All 6 declared requirement IDs are SATISFIED. AGENTS-03 status flipped from BLOCKED to SATISFIED via the 212-04 gap-closure plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `ui/options.js` | (was 4191) | `Array.isArray(stored.bgAgents) ? stored.bgAgents : []` rejects the legacy object-map shape | RESOLVED in 212-04 (commit 6270672) | (Was Blocker; now FIXED.) The buggy single-branch literal is gone (grep count = 0); the new three-branch coercion accepts both array and object-map shapes; Section 7 of the UI regression test guards against revert. |
| `package.json` | 3 | version field still reads "0.9.31" while all sunset copy targets "v0.9.45rc1" | Info | Documentation/metadata mismatch; will surface when next release zip is built (`fsb-v0.9.31.zip` will carry "Retired in v0.9.45rc1" notice). 212-REVIEW.md IN-01. Out of strict 212 scope; suggested for the version-bump phase. |
| `ws/ws-client.js` (vs showcase consumers) | n/a | `_lz` envelope check uses `raw._lz === true` in SW but truthy `envelope._lz` in showcase consumers | Info | Pre-existing asymmetry not introduced by Phase 212; D-19 mandated byte-for-byte preservation of consumer side. 212-REVIEW.md IN-02. Flagged for future hygiene. |
| `ui/control_panel.html` (footer/help links) and showcase HTML | 1304-1340, 36, 55, 349-351, 11, 260 | Pre-existing `rel="noopener"` links missing `noreferrer` | Info | Out of 212 scope; new 212 links correctly use both. 212-REVIEW.md IN-03. |

### Human Verification Required

Five items routed to human testing -- see frontmatter `human_verification:` section. These are live-runtime UAT items (rendered DOM state on a seeded chrome.storage.local profile, tone/copy review, target=_blank + window.opener nullification, zombie-message no-op, zombie-alarm no-op) that cannot be exercised by static analysis. They were identified at initial verification and are unchanged by 212-04 -- the gap-closure plan addressed only the static-analysis gaps; live UAT remains the final acceptance step before release.

### Re-Verification Summary

The initial verification (2026-04-29T03:56:54Z) recorded 5/6 must-haves verified with two open gaps under AGENTS-03:

1. **Gap 1 (WR-01)** -- silent storage-shape mismatch in `ui/options.js:4191` (`Array.isArray(stored.bgAgents)` rejected the canonical legacy object-map shape from `agents/agent-manager.js:86-91`).
2. **Gap 2 (ROADMAP SC #3 clipboard)** -- the locked CONTEXT D-11 decision (no clipboard / download / copy-to-clipboard) deviated from ROADMAP SC #3 with no recorded override.

Gap-closure plan **212-04** shipped three atomic commits on 2026-04-29:

1. **`6270672`** -- `fix(212-04)`: replaced the single-branch coercion at `ui/options.js:4191` with a three-branch shape-tolerant coercion (`Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : [])`). The downstream T-01 textContent rendering loop and the D-09 / D-10 early-returns are preserved verbatim. `node --check` exits 0; old buggy literal grep count is 0; new branches both present.
2. **`31fd469`** -- `test(212-04)`: appended Section 7 to `tests/agent-sunset-control-panel.test.js`, exercising the storage-shape branch via brace-walk extraction of `initializeBackgroundAgentsDeprecation`'s body and asserting `Object.values(` AND `Array.isArray(` are present AND the buggy `Array.isArray(stored.bgAgents)` literal is absent. The test now reports 10/10 PASS lines (the prior 9 + the new Section 7). The existing T-01 / D-15 / annotation invariants continue to pass.
3. **`12bbf99`** -- `docs(212-04)`: added the `overrides:` frontmatter block to this VERIFICATION.md formally accepting the D-11 deviation from ROADMAP SC #3 with `decision_ref: "CONTEXT.md D-11 (locked); ROADMAP.md Phase 212 SC #3 (overridden)"` and `confirmed_by: "user via /gsd-plan-phase 212 --gaps interactive question (2026-04-29)"`. The gap-2 entry's `status` field flipped from `failed` to `overridden`; the truth/reason/artifacts/missing arrays remain so the audit trail is intact.

**Static re-verification on 2026-04-29T05:42:00Z confirms:**

- `grep -c "Object.values(raw)" ui/options.js` returns 1 (object-map branch present at line 4199).
- `grep -c "Array.isArray(raw)" ui/options.js` returns 1 (defensive array branch present at line 4197).
- `grep -c "Array.isArray(stored.bgAgents)" ui/options.js` returns 0 (old buggy literal removed).
- `grep -c "raw && typeof raw === 'object'" ui/options.js` returns 1 (object-shape gate present).
- `grep -c "li.textContent = name" ui/options.js` returns 1 (T-01 mitigation preserved unchanged).
- `grep -nE "li\.innerHTML\s*=" ui/options.js` returns 0 lines (T-01 invariant; no innerHTML introduced by the patch).
- `node tests/agent-sunset-control-panel.test.js` exits 0 with the new Section 7 PASS line: "Gap1 / WR-01 storage-shape coercion handles object-map (Object.values) AND array (Array.isArray) shapes; old single-branch literal removed".
- `node tests/agent-sunset-back-end.test.js` exits 0 (Phase 212-01 invariants unchanged).
- `node tests/agent-sunset-showcase.test.js` exits 0 (Phase 212-03 invariants unchanged).
- `node --check ui/options.js` exits 0.
- The `overrides:` frontmatter block is structurally present with `gap_index: 2`, `status: overridden`, `decision_ref:` referencing CONTEXT.md D-11, and `confirmed_by:` documenting the user's interactive confirmation.
- The `gaps[1].status` is `overridden`; the `gaps[0].status` is now `resolved` (this re-verification flip).
- Top-level `score:` is `6/6 must-haves verified`; `overrides_applied:` is `1`.
- No new gaps surfaced during this re-verification pass.
- No regressions detected in any phase 209/210/211/212 regression test.

**Status flipped from `gaps_found` to `verified`.** All six requirement IDs (AGENTS-01..06) are SATISFIED. The five human_verification items remain unchanged -- they require live browser UAT (rendered DOM state on a seeded chrome.storage.local profile, tone/copy review, target=_blank + window.opener nullification, zombie-message no-op, zombie-alarm no-op) and cannot be resolved by static analysis. Per the user's directive on this re-verification, these items remain in the report for live UAT but do not block the `verified` status -- they are pre-existing UAT for live runtime behavior, not new gaps surfaced by this pass.

---

_Verified: 2026-04-29T03:56:54Z_
_Re-verified: 2026-04-29T05:42:00Z (after gap-closure plan 212-04)_
_Verifier: Claude (gsd-verifier)_
