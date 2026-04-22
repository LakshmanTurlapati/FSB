---
phase: 197-mcp-security-boundary-fixes
plan: 02
subsystem: mcp-security
tags: [mcp, payments, timeout, sidepanel, security]

requires:
  - phase: 197-mcp-security-boundary-fixes
    provides: "197-01 extension-side payment confirmation gate and verification gap report"
provides:
  - "MCP server payment confirmation timeout aligned with the extension-side confirmation window"
affects: [mcp-server, payments, vault, sidepanel-confirmation]

tech-stack:
  added: []
  patterns:
    - "Named timeout constant for human-gated MCP bridge operations"

key-files:
  created: []
  modified:
    - mcp-server/src/tools/vault.ts

key-decisions:
  - "Set MCP use_payment_method bridge timeout to 125 seconds so it exceeds the extension's 120-second sidepanel confirmation gate."

patterns-established:
  - "Human-confirmed MCP fills should use a bridge timeout longer than the browser-side approval window."

requirements-completed: [MCP-04]

duration: 4 min
completed: 2026-04-22T04:41:14Z
---

# Phase 197: MCP Payment Timeout Gap Summary

**MCP `use_payment_method` now remains pending through the full sidepanel payment confirmation window**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-22T04:35:00Z
- **Completed:** 2026-04-22T04:41:14Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `PAYMENT_CONFIRMATION_TIMEOUT_MS = 125_000` to `mcp-server/src/tools/vault.ts`.
- Replaced the stale 30-second `use_payment_method` bridge timeout with the named 125-second timeout.
- Preserved shorter list/read/fill timeouts for non-payment-confirmation vault operations.

## Task Commits

Each task was committed atomically:

1. **Task 1: Align MCP payment bridge timeout with sidepanel confirmation window** - `d84b5ae` (fix)

## Files Created/Modified

- `mcp-server/src/tools/vault.ts` - Adds the payment confirmation timeout constant and uses it for `use_payment_method`.

## Decisions Made

- Used a 125-second server-side timeout to exceed the extension-side 120-second confirmation gate with a small response buffer.
- Left `ws/mcp-bridge-client.js` unchanged because the extension-side confirmation gate was already wired and verified in `197-01`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `grep -n "PAYMENT_CONFIRMATION_TIMEOUT_MS = 125_000" mcp-server/src/tools/vault.ts` - found the named timeout constant.
- `grep -n "timeout: PAYMENT_CONFIRMATION_TIMEOUT_MS" mcp-server/src/tools/vault.ts` - found the `use_payment_method` bridge timeout.
- `grep -n "timeout: 30_000" mcp-server/src/tools/vault.ts` - returned no matches.
- `grep -n "120_000" ws/mcp-bridge-client.js` - confirmed the extension-side confirmation gate remains 120 seconds.
- `npm --prefix mcp-server run build` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 197 is ready for re-verification of MCP-04. The remaining confidence check is live browser/MCP UAT for approve, deny, and delayed approval behavior.

---
*Phase: 197-mcp-security-boundary-fixes*
*Completed: 2026-04-22T04:41:14Z*
