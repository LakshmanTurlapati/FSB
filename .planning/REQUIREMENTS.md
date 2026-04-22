# Requirements: FSB v0.9.34 Vault, Payments & Secure MCP Access

**Defined:** 2026-04-20
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v1 Requirements

Requirements for fixing vault unlock, wiring payment methods, and exposing secure credential/payment operations through autopilot and MCP.

### Vault Lifecycle

- [ ] **VAULT-01**: User can unlock the credential vault via the unlock popup and have it propagate to the background service worker
- [ ] **VAULT-02**: User can create, lock, and check status of the credential vault via extension messaging
- [ ] **VAULT-03**: Vault session key rehydrates eagerly on service worker restart so credential operations succeed without re-unlock

### Payment Backend

- [ ] **PAY-01**: User can save a payment method (card number, expiry, CVV, cardholder name, billing address) through extension messaging
- [ ] **PAY-02**: User can list saved payment methods with metadata only (last 4 digits, brand, cardholder name -- never full card number or CVV)
- [ ] **PAY-03**: User can update and delete saved payment methods through extension messaging
- [ ] **PAY-04**: Payment methods require a separate unlock gate from the credential vault

### Payment UI

- [ ] **PAYUI-01**: User can view saved payment methods in the options page with masked card numbers and brand indicators
- [ ] **PAYUI-02**: User can add a new payment method via a modal form with card validation (Luhn, expiry, brand detection)
- [ ] **PAYUI-03**: User can edit and delete saved payment methods from the options page
- [ ] **PAYUI-04**: User can unlock/lock the payment vault from the options page

### Autopilot Tools

- [ ] **AUTO-01**: AI autopilot can fill saved credentials into login forms using a fill_credential tool (no confirmation needed)
- [ ] **AUTO-02**: AI autopilot can fill saved payment methods into checkout forms using a fill_payment_method tool
- [ ] **AUTO-03**: Payment fills via autopilot show a confirmation dialog in the sidepanel displaying card brand, last 4 digits, and merchant domain before proceeding
- [ ] **AUTO-04**: Payment field detection identifies card number, CVV, expiry, cardholder name, and billing address fields on checkout pages

### MCP Secure Access

- [ ] **MCP-01**: MCP client can list saved credentials showing domain and username only (passwords never exposed)
- [ ] **MCP-02**: MCP client can trigger credential fill on the active tab's login form (password never travels over WebSocket)
- [ ] **MCP-03**: MCP client can list saved payment methods showing last 4 digits and brand only (full card data never exposed)
- [ ] **MCP-04**: MCP client can trigger payment method fill on the active tab with MCP terminal confirmation before execution

### Security Hardening

- [x] **SEC-01**: No password, full card number, or CVV appears in any log output (MCP bridge, automationLogger, console)
- [x] **SEC-02**: Fill operations derive the target domain from the active tab URL, never from MCP payload parameters
- [ ] **SEC-03**: MCP vault tools are registered in a separate vault.ts file, not through the shared TOOL_REGISTRY auto-registration path

## v2 Requirements

Deferred to future release.

### Advanced Vault

- **VAULT-10**: User can export encrypted vault backup
- **VAULT-11**: User can import vault backup with conflict resolution
- **VAULT-12**: Password strength meter on credential save

### Advanced Payments

- **PAY-10**: User can auto-fill payment forms inside cross-origin iframes (Stripe Elements, Braintree Hosted Fields)
- **PAY-11**: Combined MM/YY expiry field auto-detection and formatting

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud credential sync | Requires server infrastructure, out of scope for local-first extension |
| Cross-origin iframe payment fill | Stripe Elements/Braintree use sandboxed iframes extensions cannot access -- known browser limitation |
| Password generator | Not core to automation value, users have dedicated password managers |
| Biometric unlock | Chrome Extension API does not support WebAuthn for extension context |
| Credit card scanning via camera | Requires additional permissions and libraries, low ROI |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAULT-01 | Phase 191 | Pending |
| VAULT-02 | Phase 191 | Pending |
| VAULT-03 | Phase 191 | Pending |
| PAY-01 | Phase 192 | Pending |
| PAY-02 | Phase 192 | Pending |
| PAY-03 | Phase 192 | Pending |
| PAY-04 | Phase 192 | Pending |
| PAYUI-01 | Phase 193 | Pending |
| PAYUI-02 | Phase 193 | Pending |
| PAYUI-03 | Phase 193 | Pending |
| PAYUI-04 | Phase 193 | Pending |
| AUTO-01 | Phase 194 | Pending |
| AUTO-02 | Phase 194 | Pending |
| AUTO-03 | Phase 194 | Pending |
| AUTO-04 | Phase 194 | Pending |
| MCP-01 | Phase 195 | Pending |
| MCP-02 | Phase 195 | Pending |
| MCP-03 | Phase 195 | Pending |
| MCP-04 | Phase 197 | Pending |
| SEC-01 | Phase 197 | Complete |
| SEC-02 | Phase 197 | Complete |
| SEC-03 | Phase 195 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-22 after Phase 197 verification*
