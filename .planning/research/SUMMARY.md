# Project Research Summary

**Project:** FSB (Full Self-Browsing) v0.9.34 -- Vault, Payments & Secure MCP Access
**Domain:** Chrome Extension credential/payment vault management with secure AI agent integration
**Researched:** 2026-04-20
**Confidence:** HIGH

## Executive Summary

This milestone wires an already-implemented encryption backend (secure-config.js with 38 passing tests, AES-256-GCM, PBKDF2 key derivation, full credential/payment CRUD) to three consumers: the extension UI, the AI autopilot agent, and the MCP server. No new libraries, frameworks, or crypto primitives are needed. The existing stack (chrome.storage.session for ephemeral keys, WebSocket bridge on port 7225, chrome.scripting.executeScript for DOM injection) provides every building block.

The critical architectural constraint is the "proxy command" security pattern: passwords and full card numbers NEVER traverse the WebSocket bridge. MCP tools send only opaque identifiers (domain name, payment method ID). The extension resolves credentials locally and injects via executeScript. The immediate blocker is a broken vault unlock flow -- ui/unlock.js sends a message with no handler in background.js.

## Key Findings

### Stack
- No new dependencies needed. All crypto, storage, transport, and injection primitives exist and are tested.
- 5 new MCP message types added to existing WebSocket protocol -- not new infrastructure.
- Payment confirmation clones the proven loginDetected/waitForLoginResponse pattern in sidepanel.js.
- world: MAIN is correct for injection (React/Vue/Angular compatibility).

### Features
- Backend is fully built but completely unwired. secure-config.js has all methods, zero message handlers exist for payments.
- HTML/CSS for payment UI exists in control_panel.html/options.css but options.js has zero payment code.
- Credential autofill works but is blocked by the missing vault unlock handler.
- Security boundary is sound and must be preserved -- matches 1Password/Bitwarden architecture.

### Architecture
- 1 new file (mcp-server/src/tools/vault.ts), 8 modified files.
- Data flow: MCP sends identifier -> WebSocket -> background.js resolves credential -> executeScript injects -> returns success/fail only.
- fillPaymentOnPageDirect() parallels existing fillCredentialsOnPageDirect().
- MCP tools registered in separate vault.ts, not through auto-registration TOOL_REGISTRY.

### Critical Pitfalls
1. Plaintext password leak via logging (manual.ts:30, automationLogger) -- redact before registering credential tools
2. Orphaned unlock flow (ROOT BLOCKER) -- unlock.js sends action:'unlock' with no handler
3. MCP-supplied domain trust -- fill ops MUST derive domain from chrome.tabs.get, never MCP payload
4. Session key loss on service worker kill -- add eager rehydration at startup
5. Breaking existing 49 MCP tools -- use fully-qualified action names, smoke-test after changes

## Implications for Roadmap

**6 phases, strict dependency chain:**

1. **Vault Unlock Fix + Bootstrap Rehydration** -- Root blocker. Everything depends on vault being unlockable.
2. **Payment Method Backend Wiring** -- Pure passthrough CRUD handlers. Low risk, unblocks UI and tools.
3. **Payment Management UI** -- Options page card CRUD. Clone of existing credential manager pattern.
4. **Autopilot Tools + Confirmation Dialog** -- Highest user-value. fill_credential + fill_payment_method + sidepanel confirmation.
5. **MCP Tools + Security Hardening** -- 4 MCP tools in vault.ts with security boundary enforcement.
6. **Logging Audit + Hardening Pass** -- Final verification no secrets leak through any path.

**Ordering rationale:** Phase 1 unblocks everything. Phases 2-3 are backend-then-UI. Phase 4 before 5 proves fill functions in autopilot before MCP exposure. Phase 6 is final audit.

## Research Flags

- **Phase 4:** Payment field heuristics need testing against real checkout pages
- **Phase 5:** MCP bridge timeout for long confirmation flows needs validation
- **Phases 1-3, 6:** Standard patterns, skip research-phase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new tech. All primitives validated with tests and production use. |
| Features | HIGH | Backend fully implemented. Feature list from direct code analysis. |
| Architecture | HIGH | All integration points verified by line-number reference. |
| Pitfalls | HIGH | From actual code bugs and documented attack vectors. |

## Known Limitations

- Cross-origin iframe payment forms (Stripe Elements, Braintree) cannot be auto-filled -- detect and error
- Combined MM/YY expiry fields need format detection logic
- Sidepanel must be open for confirmation dialog (fallback: auto-open via chrome.sidePanel.open())

---
*Research completed: 2026-04-20*
*Ready for requirements: yes*
