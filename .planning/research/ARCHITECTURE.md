# Architecture: Vault, Payments & Secure MCP Access

**Domain:** Credential vault unlock wiring, payment method management, secure MCP/autopilot tool integration
**Researched:** 2026-04-20
**Overall Confidence:** HIGH (based on direct code analysis of all integration points)

---

## Executive Summary

The v0.9.34 milestone wires up an already-implemented backend (`secure-config.js` has full credential vault + payment method CRUD) to three consumers: (1) background.js message handlers (vault lifecycle + payment CRUD), (2) AI autopilot tools (`fill_credential`, `fill_payment_method`), and (3) MCP tools (`list_credentials`, `fill_credential`, `list_payment_methods`, `use_payment_method`). The critical architectural constraint is the **security boundary**: passwords and full card numbers must NEVER traverse the WebSocket bridge between the MCP server and the extension. The extension fills sensitive values directly into page DOM via `chrome.scripting.executeScript` in the MAIN world -- the same proven pattern used by the existing `fillCredentialsOnPageDirect()` function (background.js:6318).

The architecture introduces no new transport layers, no new processes, and no new storage mechanisms. It extends three existing communication channels:

1. **chrome.runtime.sendMessage** (UI <-> background.js) -- add vault unlock/lock/status + 5 payment method handlers
2. **WebSocket bridge message routing** (MCP server -> mcp-bridge-client.js -> background.js) -- add credential/payment MCP message types
3. **MCP tool registration** (mcp-server/src/tools/) -- add a new `vault.ts` tool registration module

The data flow enforces a strict **redact-at-source** pattern: any response that leaves the service worker over the WebSocket bridge strips passwords, full card numbers, and CVVs before serialization. The `secureConfig` singleton already returns metadata-only objects from `getAllCredentials()` and `getAllPaymentMethods()`. For fill operations, the MCP server sends a command like "fill credential for domain X" and background.js resolves the credential locally, fills via `chrome.scripting.executeScript`, and returns only success/failure status.

---

## Current Architecture (Annotated)

### Data Flow: MCP Tool Execution (Existing)

```
MCP Host (Claude Code, Cursor, etc.)
  |
  | (stdio or HTTP)
  v
MCP Server (Node.js)
  |
  | (WebSocket on port 7225)
  v
WebSocketBridge (hub/relay)
  |
  | (WebSocket frame)
  v
MCPBridgeClient (ws/mcp-bridge-client.js, in service worker)
  |
  | _routeMessage() switch
  |   case 'mcp:execute-action' -> _handleExecuteAction()
  |     | checks _route field
  |     | 'content' -> sendToContentScript(tab.id, ...)
  |     | 'background' -> _dispatchToBackground({action, ...})
  |     |                    -> chrome.runtime.sendMessage(request)
  |     |                         -> background.js onMessage handler
  v
background.js  chrome.runtime.onMessage  (switch on request.action)
  |
  | case 'getCredential': secureConfig.getCredential(domain)
  | case 'saveCredential': secureConfig.saveCredential(domain, data)
  | case 'getAllCredentials': secureConfig.getAllCredentials()
  | ... (6 credential cases wired, 0 vault lifecycle, 0 payment method)
  v
secureConfig (config/secure-config.js singleton)
  |
  | AES-256-GCM encryption/decryption
  | Session key in chrome.storage.session
  | Encrypted records in chrome.storage.local
  v
chrome.storage.local / chrome.storage.session
```

### What Exists vs What Is Missing

| Component | Exists | Missing |
|-----------|--------|---------|
| `SecureConfig.createCredentialVault()` | YES | No background.js handler |
| `SecureConfig.unlockCredentialVault()` | YES | No background.js handler |
| `SecureConfig.lockCredentialVault()` | YES | No background.js handler |
| `SecureConfig.getCredentialVaultStatus()` | YES | No background.js handler |
| `SecureConfig.getPaymentVaultStatus()` | YES | No background.js handler |
| `SecureConfig.savePaymentMethod()` | YES | No background.js handler |
| `SecureConfig.getAllPaymentMethods()` | YES | No background.js handler |
| `SecureConfig.getFullPaymentMethod()` | YES | No background.js handler |
| `SecureConfig.updatePaymentMethod()` | YES | No background.js handler |
| `SecureConfig.deletePaymentMethod()` | YES | No background.js handler |
| `SecureConfig.unlockPaymentMethods()` | YES | No background.js handler |
| `SecureConfig.lockPaymentMethods()` | YES | No background.js handler |
| `ui/unlock.js` sends `action:'unlock'` | YES | No `case 'unlock'` in background.js |
| `fillCredentialsOnPageDirect()` | YES | Not exposed as MCP tool |
| Payment field DOM detection | YES (dom-analysis.js) | No `fillPaymentOnPageDirect()` |
| MCP tool-definitions.cjs | YES (49 tools) | No credential/payment tools |
| MCP bridge client _routeMessage | YES (13 cases) | No vault/credential/payment cases |
| Sidepanel login prompt dialog | YES | No payment confirmation dialog |
| Options page credential manager UI | YES | No payment method management UI |

---

## Proposed Architecture

### Component 1: background.js Message Handler Additions

Add to the existing `chrome.runtime.onMessage` switch statement. These are pure passthrough handlers calling `secureConfig` methods, following the exact same pattern as the existing 6 credential cases (lines 4287-4352).

**Vault lifecycle handlers (4 cases):**

```
case 'createCredentialVault':  -> secureConfig.createCredentialVault(request.passphrase)
case 'unlockCredentialVault':  -> secureConfig.unlockCredentialVault(request.passphrase)
case 'lockCredentialVault':    -> secureConfig.lockCredentialVault()
case 'getCredentialVaultStatus': -> secureConfig.getCredentialVaultStatus()
```

**Payment method handlers (7 cases):**

```
case 'getPaymentVaultStatus':  -> secureConfig.getPaymentVaultStatus()
case 'unlockPaymentMethods':   -> secureConfig.unlockPaymentMethods(request.passphrase)
case 'lockPaymentMethods':     -> secureConfig.lockPaymentMethods()
case 'savePaymentMethod':      -> secureConfig.savePaymentMethod(request.data)
case 'getAllPaymentMethods':   -> secureConfig.getAllPaymentMethods()
case 'updatePaymentMethod':    -> secureConfig.updatePaymentMethod(request.id, request.updates)
case 'deletePaymentMethod':    -> secureConfig.deletePaymentMethod(request.id)
```

**Vault unlock handler for ui/unlock.js:**

```
case 'unlock':  -> secureConfig.initialize(request.password)
                   + store in chrome.storage.session if request.remember
```

Note: The existing `ui/unlock.js` sends `{action: 'unlock', password, remember}` but there is NO matching case in background.js. This is the root cause of the broken vault unlock flow.

### Component 2: fillPaymentOnPageDirect() Function

New function in background.js, parallel to the existing `fillCredentialsOnPageDirect()`. Uses `chrome.scripting.executeScript` with `world: 'MAIN'` to fill payment fields directly in the page DOM without sending card data over any message channel.

**Data flow:**

```
background.js  fillPaymentOnPageDirect(tabId, paymentRecord, fieldMap)
  |
  | chrome.scripting.executeScript({
  |   target: { tabId },
  |   world: 'MAIN',
  |   func: (fields) => {
  |     // nativeInputValueSetter pattern (same as credentials)
  |     // Map intent -> selector from DOM analysis
  |     // Fill: cc-number, cc-name, cc-exp-month, cc-exp-year, cc-csc
  |     // Fill: billing name, address, city, state, zip, country
  |   },
  |   args: [serializedFieldData]
  | })
  v
Page DOM (filled directly, no intermediary)
```

The `fieldMap` parameter comes from `extractPaymentFields(domData)`, a new function parallel to `extractLoginFields(domData)` that uses the existing payment field detection in `content/dom-analysis.js` (lines 389-428).

### Component 3: MCP Tool Registration (vault.ts)

New file: `mcp-server/src/tools/vault.ts`

Registered in `runtime.ts` alongside the existing 5 tool modules. These tools use a NEW set of MCP message types routed through the WebSocket bridge.

**MCP Tools (4 tools):**

| MCP Tool | MCP Message Type | background.js Handler | Response Content |
|----------|-----------------|----------------------|------------------|
| `list_credentials` | `mcp:list-credentials` | `secureConfig.getAllCredentials()` | domain + username only (NO password) |
| `fill_credential` | `mcp:fill-credential` | `fillCredentialsOnPage()` | success/failure (password NEVER leaves SW) |
| `list_payment_methods` | `mcp:list-payment-methods` | `secureConfig.getAllPaymentMethods()` | last4 + brand only (NO full number, NO CVV) |
| `use_payment_method` | `mcp:use-payment-method` | `fillPaymentOnPageDirect()` | success/failure (card data NEVER leaves SW) |

**Registration pattern:**

```typescript
// mcp-server/src/tools/vault.ts
export function registerVaultTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
): void {
  server.tool(
    'list_credentials',
    'List saved credentials (domain and username only, passwords never exposed)',
    { domain: z.string().optional().describe('Filter to a specific domain') },
    async (params) => {
      const result = await bridge.sendAndWait({
        type: 'mcp:list-credentials',
        payload: { domain: params.domain },
      });
      return mapFSBError(result);
    },
  );
  // ... similar for other 3 tools
}
```

### Component 4: MCPBridgeClient Route Additions

Add cases to `ws/mcp-bridge-client.js` `_routeMessage()` switch:

```javascript
case 'mcp:list-credentials':
  return this._handleListCredentials(payload);

case 'mcp:fill-credential':
  return this._handleFillCredential(payload);

case 'mcp:list-payment-methods':
  return this._handleListPaymentMethods(payload);

case 'mcp:use-payment-method':
  return this._handleUsePaymentMethod(payload);

case 'mcp:get-vault-status':
  return this._handleGetVaultStatus();

case 'mcp:unlock-vault':
  return this._handleUnlockVault(payload);
```

**Critical: `_handleFillCredential` and `_handleUsePaymentMethod` operate entirely within the service worker.** They call `secureConfig.getFullCredential(domain)` / `secureConfig.getFullPaymentMethod(id)` locally, call `fillCredentialsOnPageDirect()` / `fillPaymentOnPageDirect()`, and return ONLY `{success: true/false}` over the WebSocket. The secret material is resolved, used, and discarded entirely within the service worker process boundary.

### Component 5: Autopilot Tool Definitions

Add to `ai/tool-definitions.js` and `mcp-server/ai/tool-definitions.cjs`:

```javascript
{
  name: 'fill_credential',
  description: 'Fill saved username/password credentials into login form fields on the current page. The extension looks up the credential by domain and fills directly -- the password is never exposed to the AI. Requires vault to be unlocked.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Domain to look up credentials for. Defaults to current page domain.' }
    },
    required: []
  },
  _route: 'background',
  _readOnly: false,
  _contentVerb: null,
  _cdpVerb: null
},
{
  name: 'fill_payment_method',
  description: 'Fill a saved payment method into payment form fields on the current page. The extension fills card number, expiry, CVV, and billing address directly -- sensitive card data is never exposed to the AI. Requires vault and payment access to be unlocked. The user must confirm in the sidepanel before filling.',
  inputSchema: {
    type: 'object',
    properties: {
      payment_method_id: { type: 'string', description: 'ID of the saved payment method to use. Use list_payment_methods first to get available IDs.' }
    },
    required: ['payment_method_id']
  },
  _route: 'background',
  _readOnly: false,
  _contentVerb: null,
  _cdpVerb: null
}
```

### Component 6: Sidepanel Confirmation Dialog

Extends the existing `showLoginPrompt()` pattern for payment confirmation. When `fill_payment_method` or `use_payment_method` is invoked, background.js sends a `paymentConfirmationRequired` message to the sidepanel. The sidepanel shows a confirmation card with:

- Card brand icon + masked last 4
- Merchant/domain name
- "Confirm" and "Cancel" buttons

The sidepanel sends back `paymentConfirmationApproved` or `paymentConfirmationDenied`. Background.js has a `waitForPaymentConfirmation(sessionId)` function parallel to the existing `waitForLoginResponse(sessionId)`.

```
background.js                    sidepanel.js
     |                                |
     | chrome.runtime.sendMessage({   |
     |   action: 'paymentConfirmationRequired',
     |   sessionId, paymentMetadata   |
     | })                             |
     |------------------------------->|
     |                                | Show confirmation card
     |                                | User clicks Confirm/Cancel
     |<-------------------------------|
     | chrome.runtime.sendMessage({   |
     |   action: 'paymentConfirmed'   |
     |   or 'paymentDenied'           |
     | })                             |
     |                                |
     | if confirmed:                  |
     |   fillPaymentOnPageDirect()    |
     |   return {success: true}       |
     | else:                          |
     |   return {success: false,      |
     |     error: 'user_denied'}      |
```

### Component 7: Payment Management UI (Options Page)

Add a "Payment Methods" section to `ui/control_panel.html` and `ui/options.js`, parallel to the existing "Credentials Manager" section. Uses the same card layout pattern with:

- List view showing masked card numbers (last 4), brand, nickname, expiry
- Add/Edit modal with card number, cardholder name, expiry, CVV, billing address
- Delete confirmation
- Lock/Unlock toggle for payment access (separate from vault unlock)

All communication via `chrome.runtime.sendMessage` to the new background.js handlers.

---

## Security Boundary Enforcement

### The Iron Rule

**Sensitive data (passwords, full card numbers, CVVs) NEVER cross the WebSocket bridge.**

This is enforced at three levels:

1. **Source-level redaction:** `secureConfig.getAllCredentials()` returns `{domain, username, notes}` -- no password field. `secureConfig.getAllPaymentMethods()` returns `{id, last4, cardBrand, maskedNumber}` -- no full number, no CVV.

2. **Bridge client filtering:** The `_handleListCredentials()` and `_handleListPaymentMethods()` methods in `mcp-bridge-client.js` call only the metadata methods. The `_handleFillCredential()` method resolves the full credential via `secureConfig.getFullCredential()`, uses it in `chrome.scripting.executeScript`, and returns only `{success: true}`.

3. **MCP tool descriptions:** Tool descriptions explicitly state "password is never exposed" / "card data is never exposed" so the AI understands the boundary.

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| MCP host reads credential password | Password never included in any WebSocket response |
| Malicious MCP tool calls fill_credential on wrong site | fill_credential matches credential by current page domain, not user-supplied domain. AI-supplied domain parameter is optional hint, but actual lookup uses `tab.url` |
| Payment fill without user consent | Payment fill requires explicit sidepanel confirmation dialog |
| Service worker restart loses vault session | Session key stored in `chrome.storage.session` (cleared on browser close, survives SW restart) |
| WebSocket message interception | Bridge is localhost-only (ws://localhost:7225). Additionally, sensitive payloads are never serialized. |

### Redacted Logging

All `automationLogger` calls for credential/payment operations must use redacted values:

```javascript
automationLogger.info('Credential fill', {
  domain: domain,
  username: cred.username,
  // password: NEVER logged
  success: result.success
});

automationLogger.info('Payment fill', {
  paymentMethodId: id,
  cardBrand: metadata.cardBrand,
  last4: metadata.last4,
  // cardNumber: NEVER logged
  // cvv: NEVER logged
  success: result.success
});
```

---

## Data Flow Diagrams

### Flow 1: MCP `fill_credential` (Secure Path)

```
Claude Code: "Fill in the login form"
  |
  | MCP tool call: fill_credential({domain: "github.com"})
  v
MCP Server (vault.ts)
  | bridge.sendAndWait({type: 'mcp:fill-credential', payload: {domain: 'github.com'}})
  v
WebSocket Bridge (port 7225)
  | frame: {id, type: 'mcp:fill-credential', payload: {domain: 'github.com'}}
  v
MCPBridgeClient._handleFillCredential({domain: 'github.com'})
  |
  | 1. tab = await getActiveTab()  // get current tab
  | 2. actualDomain = new URL(tab.url).hostname  // trust tab URL, not MCP param
  | 3. status = await secureConfig.getCredentialVaultStatus()
  |    if (!status.unlocked) -> return {success: false, error: 'vault_locked'}
  | 4. cred = await secureConfig.getFullCredential(actualDomain)
  |    if (!cred) -> return {success: false, error: 'no_credential_found'}
  | 5. domResponse = await sendToContentScript(tab.id, {action: 'getDOM'})
  | 6. fields = extractLoginFields(domResponse.structuredDOM)
  | 7. result = await fillCredentialsOnPageDirect(tab.id, {
  |      usernameSelector: fields.usernameSelector,
  |      passwordSelector: fields.passwordSelector,
  |      submitSelector: fields.submitSelector,
  |      username: cred.username,
  |      password: cred.password   // <-- STAYS in service worker
  |    })
  | 8. return {success: result.success, domain: actualDomain, username: cred.username}
  v                                  // <-- password NOT in response
WebSocket Bridge -> MCP Server -> Claude Code
  Response: {success: true, domain: 'github.com', username: 'user@example.com'}
            // NO password in the response
```

### Flow 2: MCP `use_payment_method` (Secure Path + Confirmation)

```
Claude Code: "Pay with my Visa ending in 4242"
  |
  | MCP tool call: use_payment_method({payment_method_id: "pm_abc123"})
  v
MCP Server (vault.ts)
  | bridge.sendAndWait({type: 'mcp:use-payment-method', payload: {id: 'pm_abc123'}})
  v
MCPBridgeClient._handleUsePaymentMethod({id: 'pm_abc123'})
  |
  | 1. status = await secureConfig.ensurePaymentAccessUnlocked()
  |    if (!status.ok) -> return {success: false, error: status.error}
  | 2. metadata = await secureConfig.buildPaymentMethodMetadata(...)
  |    // Get masked info for confirmation dialog
  | 3. tab = await getActiveTab()
  | 4. chrome.runtime.sendMessage({
  |      action: 'paymentConfirmationRequired',
  |      paymentMetadata: {cardBrand: 'visa', last4: '4242', ...},
  |      domain: tab.url
  |    })
  | 5. confirmation = await waitForPaymentConfirmation()
  |    if (denied) -> return {success: false, error: 'user_denied_payment'}
  | 6. fullRecord = await secureConfig.getFullPaymentMethod('pm_abc123')
  | 7. domResponse = await sendToContentScript(tab.id, {action: 'getDOM'})
  | 8. fields = extractPaymentFields(domResponse.structuredDOM)
  | 9. result = await fillPaymentOnPageDirect(tab.id, fullRecord, fields)
  |    // card number + CVV stay in service worker
  | 10. return {success: result.success, cardBrand: 'visa', last4: '4242'}
  v                                // NO card number, NO CVV in response
WebSocket Bridge -> MCP Server -> Claude Code
  Response: {success: true, cardBrand: 'visa', last4: '4242'}
```

### Flow 3: Vault Unlock (UI -> background.js, Currently Broken)

```
CURRENT (broken):
  ui/unlock.js -> chrome.runtime.sendMessage({action: 'unlock', password, remember})
              -> NO handler in background.js -> message silently dropped

FIXED:
  ui/unlock.js -> chrome.runtime.sendMessage({action: 'unlock', password, remember})
              -> background.js case 'unlock':
                   -> secureConfig.unlockCredentialVault(request.password)
                   -> if (request.remember) chrome.storage.session.set({...})
                   -> sendResponse({success: true, unlocked: true})
  ui/unlock.js -> window.close()
```

Note: The existing `ui/unlock.js` also tries to decrypt with `secureConfig.decrypt()` directly (line 28), but this is the old API key unlock flow, not the credential vault flow. The credential vault uses a completely different mechanism (`unlockCredentialVault()` which derives a session key via PBKDF2). The unlock.js needs to be updated to use the vault-specific unlock path.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `config/secure-config.js` | Encryption, storage, CRUD, validation | chrome.storage.local/session |
| `background.js` (message handler) | Route UI/MCP messages to secureConfig | secureConfig, chrome.scripting, content scripts |
| `ws/mcp-bridge-client.js` | Route MCP WebSocket messages, enforce security boundary | background.js (via sendMessage), secureConfig (direct access in SW scope) |
| `mcp-server/src/tools/vault.ts` | MCP tool registration, schema, bridge messaging | WebSocketBridge |
| `ai/tool-definitions.js` | Autopilot tool schema for fill_credential, fill_payment_method | agent-loop.js (tool executor) |
| `ui/sidepanel.js` | Payment confirmation dialog, login prompt | background.js (via sendMessage) |
| `ui/options.js` + `ui/control_panel.html` | Payment method management UI | background.js (via sendMessage) |
| `ui/unlock.js` | Vault unlock popup | background.js (via sendMessage) |
| `content/dom-analysis.js` | Payment field detection (existing) | content script message handler |

---

## Files Modified vs Files Created

### Modified Files (8)

| File | Changes |
|------|---------|
| `background.js` | Add ~15 message handler cases (vault lifecycle, payment CRUD, unlock), add `fillPaymentOnPageDirect()`, add `extractPaymentFields()`, add `waitForPaymentConfirmation()` |
| `ws/mcp-bridge-client.js` | Add ~6 route cases for MCP vault/credential/payment messages, add handler methods |
| `ai/tool-definitions.js` | Add `fill_credential` and `fill_payment_method` tool definitions |
| `mcp-server/ai/tool-definitions.cjs` | Mirror the same 2 tool definitions (this is the CJS copy for MCP server) |
| `mcp-server/src/runtime.ts` | Add `import { registerVaultTools }` and call it in `createRuntime()` |
| `ui/sidepanel.js` | Add payment confirmation dialog (parallel to `showLoginPrompt()`) |
| `ui/options.js` | Add payment method management section (list, add, edit, delete) |
| `ui/control_panel.html` | Add payment methods HTML section |
| `ui/unlock.js` | Fix to use `unlockCredentialVault()` path instead of direct decrypt |

### New Files (1)

| File | Purpose |
|------|---------|
| `mcp-server/src/tools/vault.ts` | MCP tool registration for list_credentials, fill_credential, list_payment_methods, use_payment_method |

---

## Suggested Build Order

The dependency chain dictates this order:

### Phase 1: Vault Unlock Fix (Foundation)

**Everything depends on the vault being unlockable.**

1. Add `case 'unlock'` (or `case 'unlockCredentialVault'`) handler to background.js
2. Add `case 'createCredentialVault'`, `case 'lockCredentialVault'`, `case 'getCredentialVaultStatus'` handlers
3. Fix `ui/unlock.js` to call the vault-specific unlock path
4. Verify: vault creates, unlocks, locks, survives service worker restart

### Phase 2: Payment Method Background Wiring

**Payment CRUD depends on vault being unlockable (Phase 1).**

5. Add 7 payment method message handlers to background.js
6. Add `case 'getPaymentVaultStatus'`, `case 'unlockPaymentMethods'`, `case 'lockPaymentMethods'`
7. Verify: payment methods save, list, update, delete when vault+payment unlocked

### Phase 3: Payment Management UI

**UI depends on background handlers being wired (Phase 2).**

8. Add payment methods section to `ui/control_panel.html`
9. Add payment management JS to `ui/options.js` (list, add modal, edit, delete, lock toggle)
10. Add masked card display, brand detection icon, expiry validation in UI
11. Verify: full CRUD cycle through options page UI

### Phase 4: Autopilot Tools

**fill_credential and fill_payment_method for the AI agent loop.**

12. Add `fill_credential` and `fill_payment_method` to `ai/tool-definitions.js` and `.cjs`
13. Add `fillPaymentOnPageDirect()` to background.js
14. Add `extractPaymentFields()` to background.js (using dom-analysis.js intents)
15. Wire autopilot tool executor to handle these as background-routed tools
16. Add payment confirmation dialog to sidepanel.js + `waitForPaymentConfirmation()`
17. Verify: autopilot can fill credentials on login pages, fill payment on checkout pages

### Phase 5: MCP Tools

**MCP tools depend on all background functions being implemented (Phases 1-4).**

18. Create `mcp-server/src/tools/vault.ts` with 4 tool registrations
19. Register in `mcp-server/src/runtime.ts`
20. Add MCP message routes to `ws/mcp-bridge-client.js` (6 new cases)
21. Add MCP handler methods that enforce security boundary (no secrets in responses)
22. Verify: MCP tools work from Claude Code, secrets never appear in MCP responses

### Phase 6: Redacted Logging & Hardening

23. Audit all `console.log`, `console.error`, `automationLogger` calls for credential/payment operations
24. Ensure no raw passwords, card numbers, or CVVs in any log output
25. Add timeout handling for payment confirmation (auto-deny after 2 minutes, like login prompt)

---

## Patterns to Follow

### Pattern 1: Background Message Handler (Existing)

Every handler follows this exact shape. Do not deviate.

```javascript
case 'actionName':
  (async () => {
    try {
      const result = await secureConfig.someMethod(request.param);
      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Will respond asynchronously
```

### Pattern 2: chrome.scripting.executeScript for Sensitive Fills

The existing `fillCredentialsOnPageDirect()` is the template. Key characteristics:

- `world: 'MAIN'` for full DOM access
- `nativeInputValueSetter` trick for React compatibility
- `dispatchEvent(new Event('input', {bubbles: true}))` for framework compatibility
- insertText fallback
- Return verification object, not the filled values

### Pattern 3: Confirmation Dialog (Login Prompt Pattern)

The existing `showLoginPrompt()` / `waitForLoginResponse()` pair is the template:

- Background sends a message to sidepanel requesting user action
- Background creates a `Promise` that resolves when sidepanel responds
- 2-minute timeout auto-resolves as "denied"/"skipped"
- Handler reference stored on session object for cleanup on termination

### Pattern 4: MCP Bridge Client Handler

```javascript
async _handleNewFeature(payload) {
  // 1. Check preconditions (vault unlocked, tab available, etc.)
  // 2. Call secureConfig method (metadata only for list, full for fill)
  // 3. If fill: execute chrome.scripting.executeScript
  // 4. Return REDACTED result (never include secrets)
  // 5. Log REDACTED info
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Passing Secrets Over WebSocket

**What:** Including password/card number/CVV in any WebSocket message payload
**Why bad:** The WebSocket bridge is a plain text channel on localhost. While the risk is local-only, the design principle is defense in depth. The MCP server runs in a separate Node.js process that could be compromised or have its stdout logged.
**Instead:** Always resolve secrets in the service worker, fill via `chrome.scripting.executeScript`, return only success/failure.

### Anti-Pattern 2: Trusting MCP-Supplied Domain for Credential Lookup

**What:** Using `payload.domain` from MCP tool call as the credential lookup key
**Why bad:** A compromised MCP host could request credentials for any domain
**Instead:** Use `tab.url` from `chrome.tabs.get(activeTab)` as the authoritative domain. The `payload.domain` parameter is optional and used only as a hint/filter, not as the lookup key for fill operations.

### Anti-Pattern 3: Creating New Message Transport

**What:** Adding a new communication channel between MCP server and extension
**Why bad:** The existing WebSocket bridge + message routing is battle-tested. Adding another channel creates maintenance burden and security surface.
**Instead:** Add new message types to the existing `_routeMessage()` switch in mcp-bridge-client.js.

### Anti-Pattern 4: Storing Vault Passphrase in chrome.storage.local

**What:** Persisting the vault passphrase beyond the browser session
**Why bad:** Defeats the purpose of the vault. The passphrase should be ephemeral.
**Instead:** Store only the derived session key in `chrome.storage.session` (already implemented in SecureConfig). Session storage is cleared when the browser closes.

---

## Scalability Considerations

| Concern | Current Scale | At Scale |
|---------|--------------|----------|
| Number of stored credentials | Tens | Hundreds: `getAllCredentials()` decrypts all -- consider pagination or index-only cache |
| Number of payment methods | Single digits | Tens: Not a concern, `getAllPaymentMethods()` is fine |
| Concurrent MCP tool calls | Sequential (TaskQueue) | Vault operations are fast (<50ms). No bottleneck. |
| Service worker lifecycle | Restarts after 5min idle | Session key in `chrome.storage.session` survives restarts. Vault stays unlocked until browser close. |

---

## Sources

All findings are based on direct code analysis of the existing codebase:

- `config/secure-config.js` (1138 lines) -- vault encryption, credential + payment CRUD
- `background.js` (lines 4287-4352) -- existing credential message handlers
- `background.js` (lines 6170-6385) -- login detection, credential fill, extractLoginFields
- `background.js` (lines 8400-8500) -- autopilot auth flow with credential fill
- `ws/mcp-bridge-client.js` (593 lines) -- MCP bridge client with _routeMessage switch
- `mcp-server/src/bridge.ts` (608 lines) -- WebSocket bridge hub/relay
- `mcp-server/src/tools/manual.ts` (83 lines) -- tool registration pattern
- `mcp-server/src/tools/schema-bridge.ts` (169 lines) -- JSON Schema to Zod conversion
- `mcp-server/src/runtime.ts` (38 lines) -- tool registration orchestration
- `ui/unlock.js` (90 lines) -- broken vault unlock popup
- `ui/sidepanel.js` (lines 1231-1390) -- login prompt dialog pattern
- `ui/options.js` (lines 2525+) -- credential manager UI pattern
- `content/dom-analysis.js` (lines 389-428) -- payment field detection
- `ai/tool-definitions.js` / `mcp-server/ai/tool-definitions.cjs` -- tool schema registry
