# Technology Stack: v0.9.34 Vault, Payments & Secure MCP Access

**Project:** FSB (Full Self-Browsing)
**Researched:** 2026-04-20
**Overall confidence:** HIGH (builds on validated existing infrastructure)

## Executive Summary

This milestone requires NO new libraries, frameworks, or crypto primitives. The existing stack (secure-config.js with AES-256-GCM/PBKDF2, chrome.storage.session for ephemeral keys, WebSocket bridge on port 7225, chrome.scripting.executeScript for DOM injection) already provides every building block needed. The research focus is on **patterns and security boundaries** -- how to wire these existing pieces together safely for vault/payment operations exposed through MCP.

The key architectural decision is the **"proxy command" pattern**: MCP tools issue commands like `fill_credential(domain)` or `use_payment_method(id)`, but the command payload sent over WebSocket contains ONLY identifiers (domain name, payment method ID). The background.js service worker resolves credentials locally from encrypted storage and injects them directly into the page via `chrome.scripting.executeScript`. Secrets never traverse the WebSocket bridge.

---

## Recommended Stack (No Changes Needed)

### Core -- Already Validated, Reuse As-Is

| Technology | Version | Purpose | Why No Change |
|------------|---------|---------|---------------|
| AES-256-GCM + PBKDF2 | Web Crypto API | Encrypt credentials/payment data at rest | 38 tests passing, 1138 lines proven, NIST-approved primitives |
| chrome.storage.local | MV3 built-in | Persist encrypted blobs | Already stores `cred_*` and `payment_method_*` prefixed keys |
| chrome.storage.session | MV3 built-in | Ephemeral vault session key | Already stores `fsbCredentialVaultSessionKey`, survives SW restarts, clears on browser close |
| chrome.scripting.executeScript | MV3 built-in | Inject values into page DOM | Already used by `fillCredentialsOnPageDirect()` with React-compatible native setter pattern |
| WebSocket bridge (port 7225) | ws 8.x | MCP server <-> extension communication | Hub/relay architecture already handles 49 tools, message correlation, timeouts |
| Vanilla JS ES2021+ | No build system | Extension runtime | Project constraint, no transpilation |

### New MCP Message Types (Protocol Extension, Not New Stack)

| Message Type | Direction | Payload | Purpose |
|--------------|-----------|---------|---------|
| `mcp:list-credentials` | MCP -> Extension | `{}` | Return domain+username list (no passwords) |
| `mcp:fill-credential` | MCP -> Extension | `{ domain: string }` | Look up credential, inject into active tab |
| `mcp:list-payment-methods` | MCP -> Extension | `{}` | Return last4+brand list (no full card numbers) |
| `mcp:use-payment-method` | MCP -> Extension | `{ id: string }` | Inject payment data into active tab after confirmation |
| `mcp:vault-status` | MCP -> Extension | `{}` | Return configured/unlocked/paymentUnlocked booleans |

These are added to the existing `MCPMessageType` union in `mcp-server/src/types.ts`. No new transport, no new protocol.

---

## Security Architecture: The Proxy Command Pattern

### Pattern 1: Secret-Free Wire Protocol

**What:** MCP tool parameters contain ONLY identifiers. Secrets are resolved extension-side.

**Why this pattern is mandatory:**

1. The WebSocket bridge runs on `localhost:7225` -- any local process can connect. Sending passwords over it would make every local process a credential exfiltration vector.
2. MCP tool responses are returned to the LLM context. If `fill_credential` returned `{ password: "hunter2" }`, the password would enter the AI's conversation history, potentially logged, cached, or echoed back.
3. The MCP security best practices spec explicitly states: "Implement fine-grained access control for tools. Not every tool should be available to every AI query." (MCP Security Best Practices)

**How it works:**

```
MCP Client (Claude/etc) -> MCP Server: fill_credential(domain: "github.com")
MCP Server -> WebSocket -> Extension background.js: { type: "mcp:fill-credential", payload: { domain: "github.com" } }
background.js: secureConfig.getFullCredential("github.com") -> { username, password }
background.js: chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: fillFields, args: [selectors, username, password] })
background.js -> WebSocket -> MCP Server: { success: true, filled: { domain: "github.com", username: "user@example.com" } }
```

Password NEVER leaves the extension service worker. The MCP response confirms fill happened but contains NO secrets.

**Confidence:** HIGH. This is exactly how the existing `fillCredentialsOnPage()` / `fillCredentialsOnPageDirect()` already work (lines 6299-6384 of background.js). The credential is resolved in the service worker, passed as `args` to `executeScript`, and the function runs in the page context. The existing pattern is already correct -- we are extending it, not changing it.

### Pattern 2: Confirmation Gate for Payment Operations

**What:** Payment fill operations require explicit user confirmation in the sidepanel before proceeding.

**Why:** Credential autofill for login is a lower-stakes operation (wrong site = failed login). Payment autofill is higher-stakes (wrong site = financial data sent to attacker). Password managers (1Password, Bitwarden) require user gesture before revealing payment data. FSB should match this standard.

**How it works (existing pattern to clone):**

The `loginDetected` -> `waitForLoginResponse` pattern in background.js (lines 6177-6192, 8457-8516) already implements exactly this:

1. background.js sends `chrome.runtime.sendMessage({ action: 'paymentConfirmationRequired', ... })` to sidepanel
2. Sidepanel shows inline confirmation dialog (clone of `showLoginPrompt` pattern, lines 1275-1400 of sidepanel.js)
3. background.js pauses automation with `waitForPaymentConfirmation(sessionId)` (clone of `waitForLoginResponse`)
4. User approves or denies
5. On approval: background.js resolves payment data from `secureConfig.getFullPaymentMethod(id)` and injects via `executeScript`
6. On denial: background.js returns `{ success: false, error: 'User denied payment fill' }` to MCP

**Confidence:** HIGH. This is a direct structural clone of the login prompt pattern that has been production-tested. The only new UI element is the confirmation dialog content (showing card brand, last 4 digits, merchant domain).

### Pattern 3: Redacted List Responses

**What:** `list_credentials` returns `[{ domain, username }]` -- no passwords. `list_payment_methods` returns `[{ id, brand, last4, nickname }]` -- no full card numbers, no CVV, no expiry.

**Why:** These responses enter the LLM context window. Any data in the response is visible to the model and potentially logged. The `getAllCredentials()` method already returns metadata-only (lines 629-671 of secure-config.js). The `buildPaymentMethodMetadata()` method already builds redacted metadata (lines 930-946).

**Confidence:** HIGH. The redaction functions already exist and are tested.

---

## Payment Form Field Detection

### Recommended Approach: Heuristic Field Matching (Clone of extractLoginFields)

Build `extractPaymentFields(domData)` following the same structure as `extractLoginFields()` (lines 6205-6297 of background.js). The detection priority order:

**Tier 1: autocomplete attribute (most reliable)**

| autocomplete value | Field | Confidence |
|-------------------|-------|------------|
| `cc-number` | Card number | HIGH |
| `cc-name` | Cardholder name | HIGH |
| `cc-exp` | Expiry (combined) | HIGH |
| `cc-exp-month` | Expiry month | HIGH |
| `cc-exp-year` | Expiry year | HIGH |
| `cc-csc` | CVV/CVC | HIGH |

**Tier 2: name/id attribute pattern matching (fallback)**

| Pattern | Field |
|---------|-------|
| `/card.?num\|cc.?num\|credit.?card\|pan/i` | Card number |
| `/card.?hold\|cc.?name\|name.?on.?card/i` | Cardholder name |
| `/exp.?month\|cc.?exp.?m\|card.?month/i` | Expiry month |
| `/exp.?year\|cc.?exp.?y\|card.?year/i` | Expiry year |
| `/cvv\|cvc\|csc\|security.?code\|card.?code/i` | CVV/CVC |

**Tier 3: input type + context (last resort)**

| Signal | Field |
|--------|-------|
| `type="tel"` near card-like inputs, maxlength 16-19 | Card number |
| `type="tel"` with maxlength 2 | Expiry month |
| `type="tel"` with maxlength 2-4 | Expiry year |
| `type="tel"` or `type="password"` with maxlength 3-4 | CVV |

**Why heuristics over AI:** The AI agent already decides WHEN to fill payment info (it identifies the checkout form). The field detection is a mechanical mapping task that does not benefit from AI judgment. Heuristic detection is instant (no API call), deterministic (same result every time), and works offline.

**Confidence:** HIGH. The autocomplete attribute is a W3C standard (H98: Using HTML autocomplete attributes). Chromium's own autofill uses the same heuristic hierarchy. The fallback patterns cover sites that do not use standard attributes.

---

## Execution World Security Assessment

### Current State: world: 'MAIN' for Credential Fill

The existing `fillCredentialsOnPageDirect()` uses `world: 'MAIN'` (line 6376 of background.js). This is correct for this use case because:

1. **The native input value setter pattern requires MAIN world.** The React-compatible `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` approach works only in MAIN world where the page's prototype chain is accessible.
2. **The risk is theoretical, not practical.** A malicious page COULD intercept the prototype setter before FSB runs. But if the user is on a malicious page, they have bigger problems than credential interception. The user or AI chose to navigate to this page and fill credentials on it.
3. **ISOLATED world cannot modify page input values.** Setting `.value` in ISOLATED world does not trigger React/Vue/Angular change detection, making form fill fail on most modern sites.

**Recommendation:** Keep `world: 'MAIN'` for both credential and payment fill. This matches what Bitwarden, 1Password, and Chrome's native autofill do. The security boundary is the user/AI confirming the correct site, not the execution world.

**Confidence:** HIGH. Verified against Chrome extension documentation and practical necessity of framework compatibility.

---

## What NOT to Add

| Tempting Addition | Why NOT | What to Do Instead |
|-------------------|---------|-------------------|
| New crypto library (e.g., tweetnacl, forge) | AES-256-GCM via Web Crypto API is already implemented and tested | Reuse secure-config.js methods |
| OAuth/JWT for MCP auth | The WebSocket bridge is localhost-only, adding OAuth is overengineering | The session-key gate (vault must be unlocked) is sufficient |
| Payment tokenization service (Stripe, etc.) | FSB stores cards for local autofill, not for processing payments | Use encrypted local storage only |
| A new UI framework for confirmation dialogs | The login prompt pattern in sidepanel.js is vanilla JS and works | Clone the showLoginPrompt pattern |
| Separate encrypted storage for payments vs credentials | Both already use the same AES-256-GCM key derived from vault passphrase | Keep using SecureConfig's unified key derivation |
| A build system for the extension | Project constraint: no build system, direct JS execution | Continue with importScripts / programmatic injection |
| WebSocket message encryption (WSS) | Bridge is localhost-only, adding TLS to localhost adds complexity for zero security gain | Ensure secrets never traverse the wire at all (proxy command pattern) |
| Server-side vault (HashiCorp Vault, AWS Secrets Manager) | FSB is a local extension, not a cloud service | All secrets stay in chrome.storage.local, encrypted at rest |

---

## MCP Tool Registration Pattern

New vault/payment tools should follow the existing registration patterns in `mcp-server/src/tools/`. The closest analog is `read-only.ts` which maps tool names to bridge message types:

```typescript
// In a new file: mcp-server/src/tools/vault.ts
const MESSAGE_TYPE_MAP: Record<string, (params: Record<string, unknown>) => BridgeMessage> = {
  list_credentials: () => ({ type: 'mcp:list-credentials', payload: {} }),
  fill_credential: (p) => ({ type: 'mcp:fill-credential', payload: { domain: p.domain } }),
  list_payment_methods: () => ({ type: 'mcp:list-payment-methods', payload: {} }),
  use_payment_method: (p) => ({ type: 'mcp:use-payment-method', payload: { id: p.id } }),
  vault_status: () => ({ type: 'mcp:vault-status', payload: {} }),
};
```

These tools should NOT all be `_readOnly: true`. `fill_credential` and `use_payment_method` have side effects (filling forms) and should go through the TaskQueue for mutation serialization. `list_credentials`, `list_payment_methods`, and `vault_status` are truly read-only and can bypass the queue.

**Confidence:** HIGH. Follows the exact registration pattern of the 49 existing tools.

---

## Autopilot Tool Integration

For autopilot (non-MCP) use, the tools should be added to the CLI command table and tool registry:

| CLI Command | Background Handler | Description |
|-------------|-------------------|-------------|
| `fill_credential domain:<domain>` | Calls `fillCredentialsOnPage(tabId, domain, domData)` | Fill saved login credentials |
| `fill_payment id:<paymentMethodId>` | Calls `fillPaymentOnPage(tabId, id)` after confirmation | Fill saved payment method |

These reuse the same background.js functions as MCP, ensuring identical security boundaries regardless of whether the command comes from MCP or autopilot.

**Confidence:** HIGH. The CLI command table pattern is well-established (cli-parser.js).

---

## Confirmation Dialog: Sidepanel Integration

### UI Pattern: Inline Chat Message (Clone of showLoginPrompt)

The confirmation dialog should appear as an inline message in the sidepanel chat, NOT as a modal/popup. Rationale:

1. **Consistency:** The login prompt already uses this pattern (lines 1275-1400 of sidepanel.js)
2. **No new UI primitives:** Inline messages are the established sidepanel pattern
3. **Context preservation:** User can see the automation history above the prompt
4. **Timeout with auto-deny:** After 60 seconds, auto-deny (not auto-approve) -- the safe default for payment operations

### Confirmation Content

```
[Shield icon] Payment Confirmation Required
----
Fill payment method on [current domain]?

  Visa ending in 4242
  [Cardholder Name]

  [Approve]  [Deny]
```

### Message Flow

1. `background.js` -> `chrome.runtime.sendMessage({ action: 'paymentConfirmationRequired', sessionId, domain, paymentSummary: { brand, last4, nickname } })`
2. `sidepanel.js` -> `showPaymentConfirmation(domain, paymentSummary)` (renders inline)
3. User clicks Approve -> `chrome.runtime.sendMessage({ action: 'paymentConfirmationApproved', sessionId })`
4. User clicks Deny -> `chrome.runtime.sendMessage({ action: 'paymentConfirmationDenied', sessionId })`
5. Timeout (60s) -> auto-deny

### MCP-Originated Confirmation

When `use_payment_method` is triggered via MCP (not autopilot), the same confirmation flow applies. The WebSocket bridge holds the pending request while the sidepanel waits for user input. This works because the bridge already supports long timeouts per tool (see `TIMEOUT_OVERRIDES` in read-only.ts). Set `use_payment_method` timeout to 90 seconds (60s user prompt + 30s buffer).

**Confidence:** HIGH. Direct structural clone of the proven login prompt pattern.

---

## chrome.storage.session Considerations

### Service Worker Restart Resilience

The vault session key is stored in `chrome.storage.session` under key `fsbCredentialVaultSessionKey` (line 247 of secure-config.js). This survives service worker restarts but clears when the browser closes. This is the correct behavior:

- **On browser restart:** User must re-enter vault passphrase (security)
- **On service worker restart:** Vault stays unlocked (usability)
- **1MB session storage limit:** A session key is 44 bytes (Base64-encoded 256-bit key). Even with 100 additional state fields, session storage usage is negligible.

The payment access gate (`fsbPaymentAccessUnlocked`) is a separate boolean in `chrome.storage.session` (line 250). This is correct -- it requires a second explicit unlock even after the credential vault is open.

**Confidence:** HIGH. Already implemented and tested in secure-config.js.

---

## Redacted Logging Pattern

All vault/payment operations in background.js should use the existing `automationLogger` with explicit redaction:

```javascript
// GOOD: Log operation metadata, never secrets
automationLogger.info('Credential fill requested', { domain, username: cred.username });
automationLogger.info('Payment fill approved', { paymentId: id, brand: 'visa', last4: '4242' });

// BAD: Never log these
// automationLogger.debug('Credential data', { password: cred.password });
// automationLogger.debug('Payment data', { cardNumber: pm.cardNumber, cvv: pm.cvv });
```

No new logging infrastructure needed. The existing `automationLogger` already supports structured metadata. The discipline is in what fields are passed to it.

**Confidence:** HIGH. Pattern already established throughout background.js.

---

## Sources

### Official Documentation (HIGH confidence)
- [Chrome Extension chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) -- executeScript, world parameter, security model
- [Chrome Extension chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) -- session storage behavior, 1MB limit
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) -- tool access control, credential handling, scope minimization
- [W3C HTML autocomplete attributes (H98)](https://www.w3.org/WAI/WCAG21/Techniques/html/H98) -- cc-number, cc-exp, cc-csc standard values
- [Chrome Extension Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- ISOLATED vs MAIN world security
- [Chrome SidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) -- sidepanel lifecycle and behavior

### Codebase Evidence (HIGH confidence)
- `config/secure-config.js` (1138 lines) -- credential vault, payment method CRUD, encryption, metadata builders
- `background.js` lines 6177-6385 -- waitForLoginResponse, extractLoginFields, fillCredentialsOnPageDirect patterns
- `ui/sidepanel.js` lines 1231-1400 -- loginDetected handler, showLoginPrompt inline dialog pattern
- `mcp-server/src/types.ts` -- MCPMessageType union, MCPResponse interface
- `mcp-server/src/tools/read-only.ts` -- MESSAGE_TYPE_MAP pattern for tool-to-bridge mapping
- `mcp-server/src/tools/schema-bridge.ts` -- TOOL_REGISTRY, jsonSchemaToZod, PARAM_TRANSFORMS patterns
- `tests/secure-config-credential-vault.test.js` -- 38 passing tests for vault operations

### Community/Industry (MEDIUM confidence)
- [Bitwarden autofill security approach](https://bitwarden.com/help/auto-fill-browser/) -- user gesture requirement for payment fill
- [Chromium Form Autofill design](https://www.chromium.org/developers/design-documents/form-autofill/) -- heuristic field detection hierarchy
- [Autofill: What web devs should know](https://cloudfour.com/thinks/autofill-what-web-devs-should-know-but-dont/) -- autocomplete attribute behavior
- [MCP Security Guide - SentinelOne](https://www.sentinelone.com/cybersecurity-101/cybersecurity/mcp-security/) -- credential handling in MCP servers
