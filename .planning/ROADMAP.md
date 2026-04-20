# Roadmap: FSB (Full Self-Browsing)

## Active Milestone: v0.9.34 Vault, Payments & Secure MCP Access

## Phases

- [ ] **Phase 191: Vault Unlock Fix & Bootstrap Rehydration** - Fix broken vault unlock propagation and eager session key rehydration on SW restart
- [ ] **Phase 192: Payment Method Backend Wiring** - Wire all 5 payment message handlers with separate unlock gate
- [ ] **Phase 193: Payment Management UI** - Options page card CRUD with masked display, validation, and vault lock/unlock
- [ ] **Phase 194: Autopilot Tools & Confirmation Dialog** - fill_credential, fill_payment_method tools with sidepanel payment confirmation
- [ ] **Phase 195: MCP Tools & Security Boundary** - 4 MCP vault tools in isolated vault.ts with domain derivation from active tab
- [ ] **Phase 196: Logging Audit & Hardening Pass** - Verify no secrets leak through any log path

## Phase Details

### Phase 191: Vault Unlock Fix & Bootstrap Rehydration
**Goal**: Users can unlock the credential vault and have it remain usable across service worker restarts
**Depends on**: Nothing (first phase -- root blocker)
**Requirements**: VAULT-01, VAULT-02, VAULT-03
**Success Criteria** (what must be TRUE):
  1. User clicks unlock in the vault popup, enters master password, and the vault becomes accessible in background.js immediately
  2. User can create a new vault, lock it, and check its status through extension messaging without errors
  3. After Chrome kills and restarts the service worker, vault operations succeed without requiring re-unlock (session key rehydrates from chrome.storage.session)
**Plans:** 2 plans
Plans:
- [x] 191-01-PLAN.md -- Wire vault lifecycle message handlers + fix unlock popup action
- [x] 191-02-PLAN.md -- Eager session key rehydration at SW startup

### Phase 192: Payment Method Backend Wiring
**Goal**: Payment method CRUD operations work end-to-end through extension messaging with proper access control
**Depends on**: Phase 191
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):
  1. User can save a complete payment method (card number, expiry, CVV, name, billing address) via message passing and retrieve it later
  2. Listing payment methods returns only masked data (last 4 digits, brand, cardholder name) -- never full card number or CVV
  3. User can update cardholder name or billing address, and delete a payment method entirely
  4. Payment operations require their own unlock gate separate from the credential vault unlock
**Plans:** 1 plan
Plans:
- [ ] 192-01-PLAN.md -- Wire 8 payment message handlers (5 CRUD + 3 access gate)

### Phase 193: Payment Management UI
**Goal**: Users can manage payment methods visually from the options page
**Depends on**: Phase 192
**Requirements**: PAYUI-01, PAYUI-02, PAYUI-03, PAYUI-04
**Success Criteria** (what must be TRUE):
  1. Options page displays saved cards with masked numbers (xxxx-xxxx-xxxx-1234) and brand icons (Visa/MC/Amex)
  2. Add-card modal validates card number (Luhn check), expiry (future date), and auto-detects brand from BIN prefix
  3. User can edit cardholder name/billing and delete cards from the options page
  4. Options page shows lock/unlock toggle for the payment vault with visual state feedback
**Plans**: TBD
**UI hint**: yes

### Phase 194: Autopilot Tools & Confirmation Dialog
**Goal**: AI autopilot can fill credentials and payment methods into forms with user confirmation for payments
**Depends on**: Phase 192, Phase 193
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04
**Success Criteria** (what must be TRUE):
  1. AI autopilot invokes fill_credential on a login page and the correct username/password are filled without user confirmation
  2. AI autopilot invokes fill_payment_method on a checkout page and a sidepanel dialog appears showing card brand, last 4, and merchant domain before any fill occurs
  3. User approving the confirmation dialog causes payment fields to fill; declining aborts
  4. Payment field detection correctly identifies card number, CVV, expiry, cardholder name, and billing address inputs on checkout pages
**Plans**: TBD
**UI hint**: yes

### Phase 195: MCP Tools & Security Boundary
**Goal**: MCP clients can trigger credential and payment fills without ever receiving raw secrets
**Depends on**: Phase 194
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. MCP list_credentials returns domain + username pairs only -- password field is never present in the response
  2. MCP fill_credential triggers autofill on the active tab's login form -- password travels background.js to content script only, never over WebSocket
  3. MCP list_payment_methods returns last 4 + brand only -- full card data never present in response
  4. MCP use_payment_method shows terminal confirmation prompt before fill executes; fill domain is derived from chrome.tabs.get, not from the MCP request payload
  5. MCP vault tools live in a dedicated vault.ts file, not auto-registered through the shared TOOL_REGISTRY path
**Plans**: TBD

### Phase 196: Logging Audit & Hardening Pass
**Goal**: No sensitive data appears in any log output across the entire system
**Depends on**: Phase 195
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):
  1. automationLogger never logs passwords, full card numbers, or CVV values (redacted to "***" or last-4)
  2. MCP bridge WebSocket messages contain no raw credentials or full card data in any direction
  3. Browser console.log/warn/error calls from vault and payment code paths produce only redacted output
**Plans**: TBD

## Progress

**Execution Order:** 191 -> 192 -> 193 -> 194 (after 192+193) -> 195 (after 194) -> 196 (after 195)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 191. Vault Unlock Fix & Bootstrap Rehydration | 2/2 | Complete    | 2026-04-20 |
| 192. Payment Method Backend Wiring | 0/1 | Not started | - |
| 193. Payment Management UI | 0/? | Not started | - |
| 194. Autopilot Tools & Confirmation Dialog | 0/? | Not started | - |
| 195. MCP Tools & Security Boundary | 0/? | Not started | - |
| 196. Logging Audit & Hardening Pass | 0/? | Not started | - |

## Previous Milestones

<details>
<summary>v0.9.33 Dashboard Task Results & Stream Quality (shipped 2026-04-20)</summary>

5 phases (186-190), 6 plans. Canonical dashboard surface, task lifecycle bridge, DOM stream forwarding, structured result card with action feed, stream quality with frozen overlays. Post-milestone: ported all features to Angular production dashboard, bridged agent-loop analytics to BackgroundAnalytics for control panel metrics, fixed page title.

</details>

<details>
<summary>v0.9.32 Fixx (shipped 2026-04-19)</summary>

6 phases (180-185), 13 plans. Diagnosed and repaired autopilot regressions. Re-enabled modular agent-loop.js, restored safety limits, fixed 7 CDP tools, deleted dead code, synced CLI pipeline, verified all 49 tools.

</details>

<details>
<summary>v0.9.31 Dashboard & MCP Repair (shipped 2026-04-18)</summary>

Started but no phases completed. Superseded by v0.9.32 Fixx.

</details>

<details>
<summary>v0.9.30 MCP Platform Install Flags (shipped 2026-04-18)</summary>

3 phases (174-176), 6 plans. Platform registry, config engine, install/uninstall CLI.

</details>

## Backlog

### Phase 999.1: MCP Tool Gaps & Click Heuristics (BACKLOG)

**Goal:** Fix three MCP tool issues surfaced during LinkedIn automation.
**Depends on**: Nothing (independent backlog fix)
**Requirements**: MCP-ROUTE-01, MCP-EXEC-01, MCP-CLICK-01, MCP-CLICK-02
**Plans:** 2/2 plans complete
