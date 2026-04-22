---
phase: 197-mcp-security-boundary-fixes
plan: 01
subsystem: mcp-security
tags: [mcp, vault, credentials, payments, logging, security]
requires:
  - phase: 195
    provides: MCP vault tools and bridge message routing
  - phase: 196
    provides: logging audit requirements
provides:
  - active-tab credential domain derivation for MCP fill_credential
  - two-phase sidepanel payment confirmation for MCP use_payment_method
  - content-script redaction for credential and payment fill params
affects: [mcp-server, ws-bridge, content-logging, vault-fill]
tech-stack:
  added: []
  patterns: [active-tab-domain-derivation, two-phase-confirmation-listener, sensitive-param-redaction]
key-files:
  created: []
  modified:
    - ws/mcp-bridge-client.js
    - mcp-server/src/tools/vault.ts
    - content/messaging.js
key-decisions:
  - "MCP fill_credential ignores the request domain and derives lookup domain from the active tab URL."
  - "MCP use_payment_method uses the same broadcast-plus-listener confirmation pattern as autopilot payment fills."
  - "Content action logging redacts fillCredentialFields and fillPaymentFields params before writing to logs."
patterns-established:
  - "Vault bridge handlers treat MCP payload fields as hints when browser state can provide trusted context."
  - "Sensitive content-script action params are normalized through a SENSITIVE_TOOLS set before logging."
requirements-completed: [MCP-04, SEC-02, SEC-01]
duration: 10 min
completed: 2026-04-22
---

# Phase 197 Plan 01: MCP Security Boundary Fixes Summary

MCP vault fills now use trusted active-tab context, payment fills wait on sidepanel approval, and content logs redact credential/payment params.

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-22T04:02:00Z
- **Completed:** 2026-04-22T04:11:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Closed SEC-02 by deriving `fill_credential` lookup domain from `new URL(tab.url).hostname` inside the extension bridge.
- Closed MCP-04 by replacing the broken confirmation dispatch with a sidepanel broadcast plus `paymentFillApproved` / `paymentFillDenied` listener and 120-second timeout.
- Closed SEC-01 by redacting `fillCredentialFields` and `fillPaymentFields` params before `content/messaging.js` writes action-start logs.
- Updated `mcp-server/src/tools/vault.ts` so `fill_credential.domain` is optional and documented as a backward-compatible hint only.

## Task Commits

1. **Task 1: Fix MCP payment confirmation flow and credential domain derivation** - `7aeb31c` (fix)
2. **Task 2: Add sensitive tool param redaction in content script logging** - `60dbd52` (fix)

## Files Created/Modified

- `ws/mcp-bridge-client.js` - derives credential lookup domain from the active tab and waits for sidepanel payment confirmation through a two-phase listener.
- `mcp-server/src/tools/vault.ts` - marks `fill_credential.domain` optional and documents it as ignored for security.
- `content/messaging.js` - redacts sensitive fill params before action execution logging.

## Decisions Made

- Domain supplied by MCP clients is no longer trusted for credential lookup because it crosses the untrusted MCP boundary.
- Payment confirmation now mirrors the existing autopilot tool-executor confirmation pattern so approval/denial arrives through explicit runtime messages.
- Redaction stays scoped inside the `executeAction` case to avoid changing unrelated content-script logging behavior.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope expansion.

## Issues Encountered

- Existing unrelated uncommitted edits were already present in `ws/mcp-bridge-client.js`; only the Phase 197 hunks were staged for the Task 1 commit.

## Verification

- `grep -n "new URL(tab.url).hostname" ws/mcp-bridge-client.js` shows active-tab domain derivation for credential and payment flows.
- `grep -n "chrome.runtime.onMessage.addListener(confirmHandler)" ws/mcp-bridge-client.js` confirms the sidepanel confirmation listener.
- `grep -n "paymentFillApproved" ws/mcp-bridge-client.js` and `grep -n "sidepanel_unavailable" ws/mcp-bridge-client.js` confirm approval/denial and sidepanel-unavailable handling.
- `grep -c "const { domain } = payload" ws/mcp-bridge-client.js` returns `0`.
- `grep -n "SENSITIVE_TOOLS" content/messaging.js` and `grep -n "safeParams" content/messaging.js` confirm content-log redaction.
- `node --check ws/mcp-bridge-client.js` passed.
- `node --check content/messaging.js` passed.
- `npm --prefix mcp-server run build` passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 197 implementation reached verification, but one gap remains: `mcp-server/src/tools/vault.ts` waits 30 seconds for `use_payment_method` while the extension confirmation gate waits 120 seconds. Gap closure should align those timeouts or add cancellation before the phase is marked complete.

## Self-Check: PASSED

---
*Phase: 197-mcp-security-boundary-fixes*
*Completed: 2026-04-22*
