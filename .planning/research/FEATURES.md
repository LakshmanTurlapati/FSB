# Feature Landscape: Vault, Payments & Secure MCP Access

**Domain:** Credential vault unlock wiring, payment method management UI, MCP credential/payment tools, confirmation flows
**Researched:** 2026-04-20
**Existing backend:** secure-config.js (credential vault CRUD, payment method CRUD, card validation, Luhn, brand detection, masked display, dual-lock model)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vault unlock actually works | Users click unlock and nothing happens today | Low | Missing case handler in background.js, root blocker |
| Vault create/lock/status | Users need to set up and manage vault lifecycle | Low | SecureConfig methods exist, just needs message routing |
| Payment method CRUD via options page | Users need to add/view/edit/delete saved cards | Medium | UI work in options.js + control_panel.html, backend exists |
| Masked card display (last 4 + brand) | Security expectation: never show full card number in list views | Low | SecureConfig.buildPaymentMethodMetadata() already returns masked data |
| Card brand auto-detection | Visual feedback when entering card number | Low | SecureConfig.detectCardBrand() already implemented |
| Luhn validation on card input | Prevent saving invalid card numbers | Low | SecureConfig.isValidCardNumber() already implemented |
| Expiry validation (not expired) | Prevent saving expired cards | Low | SecureConfig.isValidPaymentExpiry() already implemented |
| Payment access separate lock | Payment methods require extra confirmation beyond vault unlock | Low | SecureConfig dual-lock model (vault + payment) already implemented |
| fill_credential autopilot tool | AI agent can fill login forms using saved credentials | Medium | Extends existing fillCredentialsOnPage flow |
| fill_payment_method autopilot tool | AI agent can fill payment forms using saved cards | Medium | New fillPaymentOnPageDirect function needed |
| Payment confirmation dialog | User must approve before card data is filled | Medium | Follows existing showLoginPrompt pattern in sidepanel |
| MCP list_credentials | MCP host can query available credentials (domain + username only) | Low | Thin wrapper over getAllCredentials metadata |
| MCP fill_credential | MCP host can trigger credential fill (password never leaves extension) | Medium | Security boundary enforcement in bridge client |
| MCP list_payment_methods | MCP host can query saved cards (last4 + brand only) | Low | Thin wrapper over getAllPaymentMethods metadata |
| MCP use_payment_method | MCP host can trigger payment fill with user confirmation | Medium | Confirmation flow + security boundary |
| Redacted logging for all sensitive ops | No passwords, card numbers, CVVs in any log output | Low | Audit pass over all console.log/automationLogger calls |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Domain-matched credential lookup with subdomain support | Auto-fills login for subdomains when parent domain credential has allowSubdomains=true | Low | Already implemented in SecureConfig.getCredential() |
| React-compatible value injection | Works on React/Vue/Angular sites via nativeInputValueSetter + insertText fallback | Low | Already implemented in fillCredentialsOnPageDirect() |
| Tab-URL-based security (not MCP-supplied domain) | fill_credential uses actual tab URL, not attacker-controlled MCP parameter | Low | Architecture decision, not extra code |
| Billing address auto-fill | Payment fill includes full billing profile, not just card number | Medium | dom-analysis.js already detects 7 billing field intents |
| Vault survives service worker restart | Session key persisted in chrome.storage.session | Low | Already implemented in SecureConfig |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Export passwords in plaintext | Security risk, liability | Export encrypted backup only (future milestone) |
| Auto-fill without vault unlock | Defeats vault purpose | Always require vault unlocked, return clear error message |
| Payment fill without confirmation | Users must consent to card use | Always show confirmation dialog, auto-deny on 2min timeout |
| Credential sync to cloud | Scope creep, security surface | Keep everything in chrome.storage.local, encrypted at rest |
| Cross-origin iframe card fill | Cannot access Stripe Elements etc. via chrome.scripting | Detect and return clear error about iframe-based payment forms |
| Password strength meter | Out of scope for this milestone | Defer to password manager integrations (future) |
| Card tokenization / one-time numbers | PCI compliance complexity | Store raw encrypted cards, fill directly |

## Feature Dependencies

```
Vault Unlock Fix -> ALL other features (everything requires unlocked vault)
Vault Unlock Fix -> Payment Backend Wiring (payment ops check vault status first)
Payment Backend Wiring -> Payment Management UI (UI calls backend handlers)
Vault Unlock Fix -> fill_credential autopilot tool (needs getFullCredential)
Payment Backend Wiring -> fill_payment_method autopilot tool (needs getFullPaymentMethod)
fill_credential function -> MCP fill_credential tool (MCP delegates to same function)
fill_payment_method function -> MCP use_payment_method tool (MCP delegates to same function)
Sidepanel confirmation dialog -> fill_payment_method and MCP use_payment_method (both require confirmation)
```

## MVP Recommendation

Prioritize:
1. Vault unlock fix (unblocks everything)
2. Payment method background handlers (unblocks UI and tools)
3. fill_credential autopilot tool (highest user value -- unblocks auth-wall automation)
4. MCP credential tools (enables MCP-driven login flows)

Defer: Payment management UI polish (cards can be added via console/API while UI is built). Billing address fill (card number + expiry + CVV fill covers 80% of checkout flows).

## Sources

- Direct code analysis of secure-config.js (1138 lines), background.js credential handlers (lines 4287-4352), dom-analysis.js payment detection (lines 389-428)
- Existing autopilot auth flow in background.js (lines 8400-8500)
- Sidepanel login prompt pattern (sidepanel.js lines 1275-1390)
