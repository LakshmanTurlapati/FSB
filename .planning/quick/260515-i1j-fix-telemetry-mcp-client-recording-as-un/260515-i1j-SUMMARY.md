---
quick_id: 260515-i1j
description: Fix telemetry mcp_client recording as 'unknown' (extension WS dispatcher leak)
date: 2026-05-15
branch: fix/telemetry-mcp-client-label-leak
status: complete
---

# Quick Task 260515-i1j — Summary

## Bug fixed

`telemetry_events.mcp_client` was `'unknown'` on 100% of production rows (verified live: 61/61 events / 2 install_uuids via `flyctl ssh fsb-server -> better-sqlite3 /data/fsb-data.db`). Same root cause cascaded into `model='unknown'` because the pricing module receives the same `client` value.

## Root cause

`extension/ws/mcp-bridge-client.js:523` and `:851` invoke `dispatchMcpToolRoute({ ..., client: this })` — passing the **MCPBridgeClient instance object** as `client`. The dispatcher (`extension/ws/mcp-tool-dispatcher.js`) forwarded that object straight into `recordDispatch()` at lines 340 and 424. The recorder (`extension/utils/mcp-metrics-recorder.js:273`) gates on `typeof input.client === 'string'`, which the object fails → fallback `'unknown'`.

The MCP server has been sending the canonical normalised label correctly the whole time, attached to `payload.visualSession.client` (set at `mcp/src/tools/manual.ts:180`, normalised against the 13-label allowlist at `mcp/src/tools/visual-session.ts:19`). The extension already reads it for visual-session lifecycle (`mcp-bridge-client.js:605-611`) but the telemetry path never consumed it.

## Fix

Added helper `extractMcpClientLabel(payload)` in `mcp-tool-dispatcher.js` that returns `payload.visualSession.client` when it's a non-empty trimmed string, else `'unknown'`. Swapped both `recordDispatch` call sites to use it. Bridge-client object semantics for the rest of the dispatch flow (route handlers, restricted-response builders, helper invocations) are unchanged.

## Files changed

- `extension/ws/mcp-tool-dispatcher.js` — added `extractMcpClientLabel(payload)` helper + swapped 2 call sites + exported helper for the new test
- `tests/mcp-dispatcher-client-label.test.js` — new (24 assertions across 6 sections)
- `package.json` — wired new test into the `test` script after `mcp-metrics-recorder.test.js`
- `.planning/STATE.md` — quick-task row appended

## Test coverage (24/24 PASS)

1. Allowlist labels pass through verbatim (Claude / Codex / OpenCode / Cursor / ChatGPT / Gemini)
2. Whitespace trimmed
3. Missing payload / missing visualSession sidecar → `'unknown'`
4. Non-string client (object / number / null / undefined) → `'unknown'` — the **object** case directly reproduces the original bridge-instance leak shape
5. Empty / whitespace-only string → `'unknown'`
6. **Regression guard:** read dispatcher source; assert both `recordDispatch({` blocks contain `extractMcpClientLabel(payload)` AND do NOT contain bare `client,` arg. Catches a future partial revert.

## must_haves verification

- [x] `extractMcpClientLabel({visualSession:{client:'Claude'}}) === 'Claude'`
- [x] `extractMcpClientLabel(null) === 'unknown'`
- [x] `extractMcpClientLabel({visualSession:{client:{instance:true}}}) === 'unknown'` (the original leak shape)
- [x] Both `recordDispatch` sites in `mcp-tool-dispatcher.js` use `extractMcpClientLabel(payload)`
- [x] Existing tests still pass: `mcp-metrics-recorder` (88/88), `mcp-tool-routing-contract` (151/151), `mcp-bridge-client-lifecycle` (55/55), `mcp-metrics-no-pii-leak` PASS, `extension-record-dispatch-serializes` (7/7), `visual-session-agent-scoped` (16/16), `mcp-visual-tick-lifecycle` (79/79)
- [x] New regression test passes: `mcp-dispatcher-client-label` (24/24)

## Live impact

Starting next deploy:
- `telemetry_events.mcp_client` records the actual client label (Claude / Codex / OpenCode / ...) instead of `'unknown'`
- `model` will populate correctly too — the pricing module looks up model by `client` + tokens, and the fallback path was firing only because `client` was an object
- `popular_mcp_clients` array in `/api/public-stats/global` will populate once any client crosses the k≥5 anonymity floor (the housekeeper aggregator is correct; it was just receiving 100% `'unknown'`)

## Non-goals (explicit)

- MCP server code (`mcp/src/`) was correct — not touched
- Bridge-client passing semantics elsewhere in the dispatch flow — not touched
- `agents` / `agent_runs` empty tables — separate scheduled-agent feature, unrelated
- `model='unknown'` — downstream of the same root cause; will self-correct once client label is real
