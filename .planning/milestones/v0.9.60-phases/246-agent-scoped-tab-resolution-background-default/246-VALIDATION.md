---
phase: 246
slug: agent-scoped-tab-resolution-background-default
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 246 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:assert` (CommonJS) + `vm` for SW-context loading + hand-rolled chrome mocks |
| **Config file** | None -- `package.json:test` script is a `&&`-chained sequence of `node tests/<file>.test.js` invocations |
| **Quick run command** | `node tests/agent-tab-resolver.test.js` (per-task) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60s for full suite; ~1-2s per individual test file |

---

## Sampling Rate

- **After every task commit:** Run the specific test file for the task (e.g., `node tests/agent-tab-resolver.test.js`)
- **After every plan wave:** Run all NEW + EXTENDED test files together (~10s):
  ```
  node tests/agent-tab-resolver.test.js && \
  node tests/read-tool-tab-resolution.test.js && \
  node tests/visual-session-agent-scoped.test.js && \
  node tests/action-tool-agent-scoped.test.js && \
  node tests/open-tab-background-default.test.js && \
  node tests/legacy-agent-synthesis.test.js && \
  node tests/visual-session-reentry.test.js && \
  node tests/ownership-error-codes.test.js
  ```
- **Before `/gsd-verify-work`:** Full suite (`npm test`) must be green AND a manual smoke run of `node tests/multi-agent-regression.test.js`
- **Max feedback latency:** ~10s for the wave gate; ~60s for full-suite gate

---

## Per-Task Verification Map

Phase 246 has no new REQ-IDs (gap-closure on existing v0.9.60 OWN-* controls). The map is keyed against design contracts (D-01..D-16) instead.

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| 246-01-01 | 01 | 0 | D-01 | T-multi-agent-read-isolation | Resolver returns 1 owned tab; `NO_OWNED_TAB` for 0; `AMBIGUOUS_TAB` for 2+ | unit | `node tests/agent-tab-resolver.test.js` | NO (Wave 0) | pending |
| 246-01-02 | 01 | 1 | D-04 | T-legacy-ux-preserved | Resolver legacy:* branch returns active tab via `_getActiveTab` | unit | `node tests/agent-tab-resolver.test.js` | NO (Wave 0) | pending |
| 246-01-03 | 01 | 1 | D-02 | T-multi-agent-read-isolation | Read tool with explicit `tab_id` reaches the right tab; without `tab_id` auto-resolves | integration | `node tests/read-tool-tab-resolution.test.js` | NO (Wave 0) | pending |
| 246-01-04 | 01 | 1 | D-05/D-06/D-08 | T-no-focus-steal | open_tab without `active:true` opens background; with `active:true` foreground; bindTab + ownershipToken returned | integration | `node tests/open-tab-background-default.test.js` | NO (Wave 0) | pending |
| 246-01-05 | 01 | 1 | D-02 | T-read-only-overturn | read-only.ts threads agentId + optional tab_id (overturns Phase 238 D-06) | integration | extends existing `tests/agent-id-threading.test.js` | YES (extend) | pending |
| 246-02-01 | 02 | 1 | D-09/D-10/D-11 | T-visual-session-isolation | start_visual_session uses resolver; AMBIGUOUS_TAB for multi-tab agents; same-agent resume preserved | integration | `node tests/visual-session-agent-scoped.test.js` + extend `tests/visual-session-reentry.test.js` | NO + extend | pending |
| 246-02-02 | 02 | 1 | D-13/D-14 | T-action-tool-isolation | Action tool with multi-tab agent errors AMBIGUOUS_TAB; with explicit tab_id reaches right tab; PARAM_TRANSFORMS forwards tab_id (5 tools) | integration | `node tests/action-tool-agent-scoped.test.js` | NO (Wave 0) | pending |
| 246-02-03 | 02 | 1 | D-13 | T-vault-overturn | fill_credential and use_payment_method now agent-scoped (overturns vault.ts:27 `void agentScope`) | integration | `node tests/action-tool-agent-scoped.test.js` (vault subset) | NO (Wave 0) | pending |
| 246-02-04 | 02 | 2 | D-16 | T-tab-arm-fires | Resolver-fed tabId triggers gate's tab-arm; cross-agent rejects with TAB_NOT_OWNED | integration | extend `tests/ownership-error-codes.test.js` | YES (extend) | pending |
| 246-02-05 | 02 | 2 | D-15 | T-legacy-popup-active-tab | Legacy popup action targets user's active tab; legacy:* skipGate path verified | integration | extend `tests/legacy-agent-synthesis.test.js` | YES (extend) | pending |
| 246-03-01 | 03 | 1 | D-02/D-10/D-14 | T-mcp-schema-propagation | TOOL_REGISTRY tab_id field propagates to MCP via jsonSchemaToZod; tool-definitions.js and .cjs byte-identical | unit | `node tests/tool-definitions-parity.test.js` (extend if exists, else new) | NO/CHECK | pending |
| 246-03-02 | 03 | 2 | full surface | T-multi-agent-regression | Full multi-agent regression: 2 agents, each owning own tab; A reads/acts on A's tab not B's; legacy popup keeps user's active tab | integration | `node tests/multi-agent-regression.test.js` (existing; verify still passes after Phase 246 changes; ADD scenarios) | YES (extend) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Wave 0 (test infrastructure) creates 5 new test files and extends 4 existing test files. No framework install required (`node:assert` is built-in; chrome mocks reuse existing `tests/fixtures/`).

**New test files:**
- [ ] `tests/agent-tab-resolver.test.js` -- covers D-01, D-04 (resolver unit + legacy:* branch)
- [ ] `tests/read-tool-tab-resolution.test.js` -- covers D-02 (read tool integration; auto-resolve + explicit tab_id)
- [ ] `tests/visual-session-agent-scoped.test.js` -- covers D-09, D-10 (visual session integration)
- [ ] `tests/action-tool-agent-scoped.test.js` -- covers D-13, D-14 (action tool integration; includes the 5 PARAM_TRANSFORMS cases + vault overturn)
- [ ] `tests/open-tab-background-default.test.js` -- covers D-05, D-06, D-08 (open_tab default flip + bindTab/ownershipToken preserved)

**Extensions to existing test files:**
- [ ] `tests/legacy-agent-synthesis.test.js` -- adds 2 cases for legacy:* tab-resolution via resolver (D-04, D-15)
- [ ] `tests/visual-session-reentry.test.js` -- adds 1 case for D-11 same-agent resume with explicit tab_id
- [ ] `tests/ownership-error-codes.test.js` -- adds 2 cases for D-16 gate-arm-fires-after-resolver-feed
- [ ] `tests/agent-id-threading.test.js` -- adds 2 cases for read-only.ts overturn (agentId now threaded)

**Optional new test (verify when planning, may already exist):**
- [ ] `tests/tool-definitions-parity.test.js` -- byte-identity check between `extension/ai/tool-definitions.js` and `mcp/ai/tool-definitions.cjs` (D-14 schema rollout safety)

**Wave 0 acceptance:** All 5 new test files exist with at least placeholder `console.log('PASS:')` lines and `process.exit(0)`; all 4 existing test files still pass after extension stubs are added (extensions can be `// TODO: 246-XX-YY` placeholders that get filled by their owning task).

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| open_tab default flip does not break Codex / Claude / OpenClaw real-world usage | D-05 | Real MCP host integration cannot be deterministically reproduced in node:assert; needs manual host bring-up | After plan complete, install local MCP build (`npm pack` then `npx fsb-mcp-server`), connect each host, issue `open_tab url=https://example.com` without active flag, verify tab opens in background and the host receives `{tabId, ownershipToken}` |
| Multi-agent visual session does not collide on overlay glow | D-09/D-11 | Visual feedback (orange glow + badge) is an end-user UX artifact | Manual: spawn 2 MCP agents, each calls `open_tab` then `start_visual_session`, verify each glow attaches to the correct tab, badges show distinct agentIds |
| Legacy popup interaction smoke (user-facing UX preserved byte-for-byte) | D-04/D-15 | Popup is a user-facing surface; visual regression is hard to assert in unit tests | Manual: open extension popup, click any tool button, confirm tab=user's active tab is what receives the action |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for wave-merge gate; < 60s for full-suite gate
- [ ] `nyquist_compliant: true` set in frontmatter (set after planner finalizes the per-task verify wiring)

**Approval:** pending
