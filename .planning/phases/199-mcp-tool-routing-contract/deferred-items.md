# Deferred Items

## 2026-04-22 - Out-of-scope root npm test failure

- **Found during:** Plan 199-03 full verification
- **Command:** `npm test`
- **Failure:** `tests/runtime-contracts.test.js` reports 7 failures around `SessionStateEmitter` runtime contracts and popup `sessionStateEvent` consumption.
- **Reason deferred:** The failing assertions concern `background.js`, popup, sidepanel, dashboard, and state-emitter documentation contracts. Plan 199-03 modified only MCP route dispatcher, bridge-client route usage, and MCP server error mapping.
- **Plan impact:** Focused Phase 199 checks passed; root npm test remains blocked by unrelated runtime contract drift.
