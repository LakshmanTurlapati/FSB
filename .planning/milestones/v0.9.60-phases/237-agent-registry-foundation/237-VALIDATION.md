---
phase: 237
slug: agent-registry-foundation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-05
---

# Phase 237 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> See `237-RESEARCH.md` Validation Architecture section for full reasoning.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `node:test` (in-tree FSB convention; jsdom-style chrome mocks) |
| **Config file** | none (per-file invocation; see `package.json` scripts.test) |
| **Quick run command** | `node --test tests/agent-registry.test.js` |
| **Full suite command** | `npm test` (runs root `tests/` recursively) |
| **Estimated runtime** | ~5-10 seconds (registry tests only); ~60s for full suite |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/agent-registry.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds (registry-scoped); ~60s (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 237-01-01 | 01 | 1 | AGENT-01 | -- | `agent_id` minted FSB-side via `crypto.randomUUID()`; caller-supplied IDs ignored | unit | `node --test tests/agent-registry.test.js -- --test-name="registerAgent ignores caller-supplied agent_id"` | TBD W0 | pending |
| 237-01-02 | 02 | 2 | AGENT-02 | -- | Mutations write-through to `chrome.storage.session` under `fsbAgentRegistry` | unit | `node --test tests/agent-registry.test.js -- --test-name="storage round-trip"` | TBD W0 | pending |
| 237-01-03 | 02 | 2 | AGENT-03 | -- | `hydrate()` reconciles persisted records against `chrome.tabs.query({})`; ghost records dropped + `agent:reaped` event emitted | unit | `node --test tests/agent-registry.test.js -- --test-name="hydrate drops ghost records and emits diagnostic"` | TBD W0 | pending |
| 237-01-04 | 01 | 1 | AGENT-04 | -- | Multiple independent `agent_id`s coexist (registry connection-agnostic) | unit | `node --test tests/agent-registry.test.js -- --test-name="multiple agents coexist independently"` | TBD W0 | pending |
| 237-01-05 | 01 | 1 | AGENT-01..04 | -- | TOCTOU under 20-concurrent claims: no claim silently dropped (cap-of-N ships in 241; 237 verifies serialization) | unit | `node --test tests/agent-registry.test.js -- --test-name="20-concurrent-claim mutex serialization"` | TBD W0 | pending |
| 237-01-06 | 01 | 1 | AGENT-03 | -- | `chrome.tabs.onRemoved` invokes `releaseTab` idempotently; double-fire is a no-op | unit | `node --test tests/agent-registry.test.js -- --test-name="releaseTab is idempotent"` | TBD W0 | pending |
| 237-01-07 | 01 | 1 | -- | -- | `formatAgentIdForDisplay` is the single source of truth for short-prefix display | unit | `node --test tests/agent-registry.test.js -- --test-name="formatAgentIdForDisplay returns 6-char prefix"` | TBD W0 | pending |

*Status: pending green red flaky*

---

## Wave 0 Requirements

- [ ] `tests/agent-registry.test.js` -- unit tests for all six task verifications above (created as part of the implementation plan, reusing `createChromeMock` + `createStorageArea` harness from `tests/mcp-bridge-client-lifecycle.test.js:38-146`)
- [ ] No new test framework needed -- in-tree `node:test` convention applies
- [ ] No new chrome.* mocks beyond `chrome.tabs.{query,get,onRemoved}` extensions of the existing harness

*The single test file covers all phase requirements via per-test-name discrimination; no shared conftest needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `[FSB AGT]` log prefix appears in `chrome.storage.local.fsb_diagnostics_ring` after a real ghost-record reaping | AGENT-03 | Requires loaded extension + reproduced SW eviction (eviction is hostile to determinism) | (1) Load unpacked extension; (2) Open DevTools on a tab; (3) `chrome.storage.session.set({fsbAgentRegistry: {records: {agent_test: {tabId: 999999, ...}}}})`; (4) Service-worker -> Inspect -> "Stop"; (5) Send any message; (6) Inspect `chrome.storage.local.fsb_diagnostics_ring` for `[FSB AGT]` entry with `agent_id_short: 'agent_test'` |
| `formatAgentIdForDisplay` is canonical -- no UI/log call site slices IDs locally | -- | Grep-based audit, not unit-testable | `grep -rn 'agent_[a-f0-9-]\{6,\}' extension/ --exclude-dir=node_modules \| grep -v 'agent-registry\|formatAgentIdForDisplay\|RESEARCH\|CONTEXT'` should return zero hits other than the registry itself |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`tests/agent-registry.test.js` is created in Plan 01 task 1 itself)
- [x] No watch-mode flags
- [x] Feedback latency < 10s for quick run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-05
