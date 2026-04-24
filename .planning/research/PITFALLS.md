# Domain Pitfalls: Vault, Payments & Secure MCP Access

**Domain:** Adding credential/payment vault management and secure MCP access to a Chrome Extension (MV3) with an existing WebSocket-bridged MCP server
**Researched:** 2026-04-20
**Context:** FSB v0.9.34 milestone -- 49 existing MCP tools, ~11,558-line background.js, 38 passing secure-config tests, plaintext localhost WebSocket bridge on ws://localhost:7225

---

## Critical Pitfalls

Mistakes that cause credential leaks, data loss, or require architectural rework.

---

### Pitfall 1: Plaintext Password Leak via MCP Bridge Logging and Wire

**What goes wrong:** The `type_text` MCP tool sends text content (including passwords) through the WebSocket bridge to the content script. The bridge logs params in three confirmed locations: (1) `mcp-server/src/tools/manual.ts:30` logs `params=${JSON.stringify(params).slice(0, 150)}` which includes the `text` field in full, (2) `automationLogger.logActionExecution` in background.js passes full params as `details` spread into the log entry, (3) content script action results echo back the typed text in the result payload. When `fill_credential` or `fill_payment_method` reuse the `type_text` code path, passwords traverse every layer: Node.js stderr (captured by Claude Code terminal scrollback), Chrome extension service worker console, automation-logger action records (persisted in memory and exportable), and raw WebSocket frames on localhost (sniffable by any local process).

**Why it happens:** The existing logging was designed for general browser automation where all typed text is benign (search queries, form fields). Adding credential operations changes the threat model but reuses the same code path.

**Consequences:** Passwords appear in at minimum four places: MCP server stderr, extension console, logger records, WebSocket frames. A local process monitoring port 7225 or reading stderr can harvest credentials. This is documented as a real attack vector -- recent research found Chrome extensions transmitting sensitive data over unencrypted channels.

**Prevention:**
- **Architecture rule: No raw secrets cross the WebSocket boundary. Period.** MCP credential/payment tools send only opaque references (`{domain, username}` or `{paymentMethodId}`). The extension resolves secrets from its local encrypted vault and fills directly via content script. The MCP server NEVER sees a password.
- In `manual.ts:30`, add a redaction allowlist: if tool name matches `fill_credential`, `fill_payment_method`, or `use_payment_method`, replace the params JSON with `[REDACTED - sensitive operation]` before logging.
- Add a `sensitive: true` field to the action execution metadata so `automationLogger.logActionExecution` and `logActionRecord` redact the `text` parameter: `text: '[REDACTED]'`.
- MCP tool result payloads for credential operations must return only metadata: `{success: true, domain, username}` for credentials, `{success: true, last4, brand}` for payments. Never include `password`, `cvv`, or `cardNumber`.
- Content script fill actions for credentials should not include the filled text in their response -- return `{success: true, action: 'fillCredential', fieldsFilledCount: 2}` not `{success: true, text: 'hunter2'}`.

**Detection:** After implementing, run a credential fill via MCP, then search: MCP server stderr output, `chrome.runtime.getBackgroundPage()` console, `automationLogger` records, and a WebSocket frame capture (e.g., `websocat ws://localhost:7225`). If the actual password appears ANYWHERE, the firewall has leaked.

**Phase:** FIRST phase. This architectural boundary must be established before any MCP credential tool is registered.

---

### Pitfall 2: The Orphaned Unlock Flow -- Messages Sent to Nowhere

**What goes wrong:** `ui/unlock.js` (line 45-49) sends `chrome.runtime.sendMessage({ action: 'unlock', password, remember })` after successful local decryption. But `background.js` has NO case handler for `action: 'unlock'` in its `chrome.runtime.onMessage.addListener` switch statement (verified: zero matches for 'unlock' in the message handler starting at line 4065). The unlock popup works superficially -- it decrypts a test value locally and stores `masterPassword` in `chrome.storage.session` -- but the background.js service worker singleton `secureConfig` never gets initialized with the credential vault session key.

**Why it happens:** Two separate unlock flows were built independently: (1) the old API key encryption flow (stores raw `masterPassword` in session storage for `secureConfig.initialize()`), and (2) the new credential vault flow (derives a session key via 120K-iteration PBKDF2 and stores it as `fsbCredentialVaultSessionKey` in session storage). The unlock popup addresses flow (1) but never calls `secureConfig.unlockCredentialVault(password)` for flow (2). The `masterPassword` stored in session is useless for credential vault operations because `_loadCredentialSessionKey()` looks for `fsbCredentialVaultSessionKey`, not `masterPassword`.

**Consequences:** Users think they've unlocked the extension. All API-key-encrypted operations work. But credential vault operations (`getCredential`, `saveCredential`, `getFullCredential`, all payment methods) fail with "Credential vault is locked" because the derived session key was never stored. The user has no visible feedback about what's wrong.

**Prevention:**
- Add `case 'unlockCredentialVault':` to background.js that: (a) calls `secureConfig.unlockCredentialVault(request.passphrase)` for the credential vault flow, (b) optionally calls `secureConfig.initialize(request.passphrase)` for the legacy API key flow, (c) responds with combined status.
- Update `unlock.js` to also call `secureConfig.unlockCredentialVault(password)` directly (it can import the module via dynamic import) before sending the message. This handles both flows in one place.
- Handle the case where credential vault is not yet configured (first-time setup) -- `unlockCredentialVault()` returns `vault_not_configured`, which is not an error condition for the unlock popup.
- Add an integration test: simulate unlock popup flow -> verify `secureConfig.getCredentialVaultStatus()` returns `{ configured: true, unlocked: true }`.

**Detection:** After unlock via popup, call `secureConfig.getCredentialVaultStatus()` from the service worker console. If it returns `{ unlocked: false }`, the wiring is broken.

**Phase:** FIRST phase. This blocks all downstream credential and payment functionality.

---

### Pitfall 3: Trusting MCP-Supplied Domain for Credential Lookup

**What goes wrong:** The `fill_credential` MCP tool accepts a `domain` parameter from the AI/MCP host. A developer uses `secureConfig.getFullCredential(payload.domain)` directly, allowing any MCP caller to request credentials for any domain regardless of what page the user is actually viewing.

**Why it happens:** The MCP tool schema naturally includes a `domain` parameter for flexibility. It seems efficient to use it directly. But MCP tool parameters come from the AI model or an external host -- they are not authenticated inputs.

**Consequences:** A compromised, confused, or prompt-injected AI agent could request credentials for `bankofamerica.com` while the user is on `malicious-phishing-site.com`. The extension would happily look up and fill real banking credentials into the wrong page.

**Prevention:**
- For ALL fill operations, use `chrome.tabs.get(activeTabId).url` as the authoritative domain. The `payload.domain` parameter should be used only as a hint for list/filter operations (never for fill).
- The fill handler pattern must be: `const tab = await getActiveTab(); const actualDomain = new URL(tab.url).hostname; const cred = await secureConfig.getFullCredential(actualDomain);`
- Show the actual domain in the confirmation dialog: "Fill credentials for: login.bankofamerica.com" so the user verifies.
- If the MCP-supplied domain doesn't match the active tab's domain, return a clear error: "Cannot fill credentials: requested domain (x.com) does not match active tab domain (y.com)."

**Detection:** Code review: `_handleFillCredential` must derive domain from `tab.url`, not from `payload.domain`. Test with mismatched domains.

**Phase:** MCP tool implementation phase. Enforce in the first credential tool.

---

### Pitfall 4: Session Key Loss on Service Worker Kill Without Eager Rehydration

**What goes wrong:** The credential vault session key lives in two places: `SecureConfig._credentialSessionKey` (in-memory on the singleton) and `chrome.storage.session` (persists across service worker restarts within the same browser session). Chrome kills the service worker after ~30 seconds of inactivity (MV3 design). On restart, `_credentialSessionKey` is `null`. The lazy-load pattern in `_loadCredentialSessionKey()` correctly rehydrates from `chrome.storage.session` -- but only when called. If the MCP bridge client sends a credential request before any `ensure*` method is invoked, or if new code checks `_credentialSessionKey` directly (bypassing the async lazy load), the vault appears locked.

**Why it happens:** The service worker bootstrap in `background.js` does NOT eagerly rehydrate the `secureConfig` session key. The existing code relies entirely on lazy loading through `ensureCredentialVaultUnlocked()`. This works for direct `chrome.runtime.onMessage` handlers. But the MCP bridge client operates in the same scope and may dispatch credential operations before the lazy path warms up, especially if the first message after a cold start is a credential operation.

**Consequences:** Intermittent "vault is locked" errors that depend on timing. Works immediately after unlock, fails after 30+ seconds idle, works again if a non-credential operation happens first (warming the lazy path). Extremely confusing to debug.

**Prevention:**
- Add eager rehydration to the service worker bootstrap pipeline: after `importScripts` and initial setup, call `secureConfig._loadCredentialSessionKey()` and `secureConfig._loadPaymentAccessState()`. These are async but non-blocking -- fire them during startup so the singleton is warm before any message arrives.
- All new code MUST call `ensureCredentialVaultUnlocked()` or `ensurePaymentAccessUnlocked()`, never read `_credentialSessionKey` directly. Enforce this as a code review rule.
- Add a regression test: set `chrome.storage.session` with a valid session key, create a fresh `SecureConfig` instance (simulating worker restart), verify `ensureCredentialVaultUnlocked()` returns `{ ok: true }`.
- Real flow test: unlock vault, wait 60+ seconds (worker dies), invoke MCP credential tool -- must succeed without re-unlock.

**Detection:** Instrument `_loadCredentialSessionKey()` with a timestamp log. If the first call comes INSIDE an MCP tool handler (not during bootstrap), the eager rehydration is missing.

**Phase:** Vault unlock wiring phase. Add bootstrap rehydration alongside the unlock handler.

---

### Pitfall 5: Breaking Existing 49 MCP Tools with Message Handler Collisions

**What goes wrong:** Adding new message types to `mcp-bridge-client.js`'s `_routeMessage()` switch (currently 16 cases at lines 178-247) or to `background.js`'s `chrome.runtime.onMessage.addListener` switch (starts line 4065, extends 500+ lines) causes subtle regressions. The most dangerous failure modes:

1. **Action name collision:** Background.js already has credential CRUD handlers (`getCredential`, `saveCredential`, `getAllCredentials`, `deleteCredential`, `updateCredential`, `getFullCredential`) at lines 4288-4350 but NOT vault lifecycle handlers (`createCredentialVault`, `unlockCredentialVault`, `lockCredentialVault`) or payment method CRUD handlers. Using a short name like `unlock` could conflict with future handlers.

2. **Missing `return true`:** Every async handler in `chrome.runtime.onMessage` MUST return `true` to keep the sendResponse channel open. The existing credential handlers correctly do this. A new handler that forgets `return true` causes Chrome to close the message channel immediately -- the caller gets `undefined` instead of the result. This is the single most common Chrome Extension messaging bug.

3. **MCP bridge routing mismatch:** New MCP message types added to `bridge.ts` (server side) but not to `mcp-bridge-client.js` (extension side) cause "Unknown MCP message type" errors that surface as tool failures in Claude Code.

**Why it happens:** At 11,558 lines, background.js is beyond comfortable cognitive load. The switch statement has 30+ cases. Adding to it without full context is error-prone. The MCP bridge has a separate routing table in a different file that must stay in sync.

**Consequences:** Existing tools (click, navigate, read_page, type_text) silently fail or hang. MCP users lose core automation capability.

**Prevention:**
- Before adding ANY new case to background.js, grep the ENTIRE file for the exact action string to confirm no collision. Do this for BOTH background.js and mcp-bridge-client.js.
- Use distinct, fully-qualified action names: `createCredentialVault`, `unlockCredentialVault`, `lockCredentialVault`, `getCredentialVaultStatus`, `getPaymentVaultStatus`, `savePaymentMethod`, `getAllPaymentMethods`, etc. These match the SecureConfig method names exactly.
- Every new async handler MUST have `return true;` after the async IIFE. Copy the exact pattern from existing credential handlers (lines 4288-4341).
- New MCP bridge routes must be added to BOTH `bridge.ts` server-side tool registration AND `mcp-bridge-client.js` `_routeMessage()` switch. Missing either side breaks the tool.
- After EVERY handler change, run a 3-tool smoke test: `type_text` via MCP, `click` via MCP, `read_page` via MCP. If any hang or error, a routing regression occurred.
- Run the existing 38 secure-config tests after every change to `secure-config.js` or its callers.

**Detection:** After adding handlers, invoke each existing MCP tool category. Watch for "Unknown MCP message type" errors in bridge logs or hanging tool calls.

**Phase:** EVERY phase that touches message handlers. Non-negotiable regression testing.

---

### Pitfall 6: WebSocket Carries Secrets in Plaintext on Localhost

**What goes wrong:** The MCP bridge runs on `ws://localhost:7225` (not `wss://`). Every message -- including any credential/payment data that leaks into tool params or results -- travels as plaintext JSON over a local TCP socket. Any local process can sniff localhost traffic using standard tools.

**Why it happens:** The localhost WebSocket was designed for benign automation commands. Adding credential operations changes the threat model.

**Consequences:** Local malware, other browser extensions with localhost network access, or any process with network sniffing capability can intercept passwords and card numbers. 2025 research documented real Chrome extensions leaking sensitive data via unencrypted HTTP.

**Prevention:**
- The credential data firewall (Pitfall 1) is the primary defense: passwords and card numbers NEVER traverse the WebSocket. MCP tools send opaque references only.
- Add a bridge-level audit function: before sending any `mcp:result`, scan the payload for fields named `password`, `cvv`, `cardNumber`, `secret`, or `apiKey`. If found, replace with `[REDACTED]` and log a security warning. This is a defense-in-depth backstop, not the primary control.
- Document this architecture decision in a code comment at the top of `mcp-bridge-client.js`: "SECURITY: No raw credentials cross this WebSocket. Tools receive opaque identifiers; the extension resolves and fills locally."
- Future hardening (not v0.9.34): upgrade to `wss://` with a self-signed cert, or use `chrome.runtime.connectNative`.

**Detection:** Run `websocat ws://localhost:7225` while executing a credential fill. If any message contains a real password, the firewall is broken.

**Phase:** Architecture decision established in FIRST phase. Audit backstop added when MCP tools are registered.

---

## Moderate Pitfalls

---

### Pitfall 7: Payment Unlock Gate Confusion -- Two Tiers, One UX

**What goes wrong:** The vault has a two-tier unlock model: (1) credential vault unlock (required for ALL operations), then (2) separate payment access unlock (required specifically for payment methods, requires re-entering the same passphrase). Users don't understand why they need to "unlock twice." The payment unlock re-derives the session key and compares it to the stored one -- it's a re-authentication, not a different password.

**Prevention:**
- Design the unlock UI as a SINGLE flow with explicit tiers: "Unlock vault" -> success banner -> "Enable payment access" button (confirmation with optional re-auth, not a second password prompt from scratch).
- Consider auto-prompting for payment unlock when a payment tool is first invoked, rather than requiring pre-unlock.
- MCP tool error responses must include actionable guidance: `{ error: "Saved payment methods are locked. The credential vault is unlocked but payment access requires separate confirmation. Use unlock_payment_vault tool or open FSB settings.", errorCode: "payment_locked" }`.

**Phase:** Payment management UI phase.

---

### Pitfall 8: Confirmation Fatigue for Payment Operations

**What goes wrong:** If every `use_payment_method` call requires sidepanel confirmation, users doing multi-item checkout automation see 3-5 confirmation dialogs in sequence. They click "confirm" reflexively, defeating the security purpose. If the sidepanel isn't open, the confirmation cannot be displayed and the operation times out with a cryptic error.

**Prevention:**
- Session-scoped domain approval: "FSB wants to fill payment card ending in 4242 for checkout on amazon.com. Allow for this session?" -- one confirmation covers all payment fills on that domain for 5 minutes.
- Handle the "sidepanel not open" case: (a) try `chrome.sidePanel.open()`, (b) fall back to browser notification, (c) return clear error after 15 seconds: "User confirmation required but sidepanel is not responding."
- Track fatigue: if user confirms 3+ times in 60 seconds for the same domain, offer "Allow all payment operations on this domain for this session."

**Phase:** Confirmation dialog implementation phase.

---

### Pitfall 9: Options Page and Service Worker Hold Different SecureConfig Singletons

**What goes wrong:** `config/secure-config.js` exports a singleton and attaches to `self.secureConfig` (service worker) and `window.BrowserAgentSecureConfig` (pages). The options page imports it separately, creating its own instance. When the options page saves a credential, it writes to `chrome.storage.local` and invalidates its local cache. But the service worker's singleton still has the old 30-second TTL cache. An MCP tool that lists credentials immediately after an options page save sees stale data.

**Prevention:**
- Option A: Route ALL credential/payment operations from the options page through `chrome.runtime.sendMessage` to background.js. The service worker singleton handles all state.
- Option B: After any mutation in the options page, send `chrome.runtime.sendMessage({ action: 'invalidateCredentialCache' })`. Add a handler in background.js that nullifies both metadata caches.
- Option B is simpler if the options page already calls `secureConfig` directly for rendering.

**Phase:** Payment management UI phase (options page integration).

---

### Pitfall 10: fill_credential Fills Password Into Wrong Field

**What goes wrong:** Login forms vary wildly: multi-step logins (Google: email first, password second), forms with security questions, CAPTCHA fields mixed with login fields, forms where the password field is initially hidden. If the tool fills the password into a `type="text"` field (misidentified as username), the password is displayed in plaintext on screen. Research from 2025 showed even established password managers (1Password, LastPass, Bitwarden) are vulnerable to DOM-based clickjacking attacks on autofill.

**Prevention:**
- Content script fill MUST verify `input.type === 'password'` before injecting password content. If no `type="password"` field exists, return an error: `"No password field found. Navigate to the login page first."`
- For username, prefer inputs with `autocomplete="username"` or `autocomplete="email"`, or inputs whose label contains "email", "username", or "login".
- Fill password LAST, after username, to handle two-step login flows.
- Never auto-fill without user confirmation showing the exact target domain.

**Phase:** AI autopilot tools implementation phase.

---

### Pitfall 11: iframe Payment Forms (Stripe, Braintree, Adyen)

**What goes wrong:** Modern PCI-compliant payment forms embed card inputs in cross-origin iframes (Stripe Elements, Braintree Hosted Fields, Adyen Drop-in). `chrome.scripting.executeScript` and content script message passing cannot access cross-origin iframe content. The fill operation silently fails or throws.

**Prevention:**
- Detect iframe-based payment forms during DOM analysis: check for iframes with `src` matching known payment processor domains (`js.stripe.com`, `assets.braintreegateway.com`, `checkoutshopper-live.adyen.com`, etc.).
- Return a clear error: `{success: false, error: 'iframe_payment_form', message: 'This checkout uses an embedded payment form (Stripe/Braintree/Adyen) that cannot be auto-filled for security reasons. Please enter card details manually.'}` -- not a silent failure.
- This is a known, accepted limitation. Document it in MCP tool descriptions.

**Phase:** MCP tool implementation phase.

---

### Pitfall 12: Race Between MCP Tool Execution and Vault Lock

**What goes wrong:** An MCP tool calls `ensureCredentialVaultUnlocked()` (succeeds), then enters an async operation (content script interaction). During the gap, the vault locks. The credential read fails partway, leaving a half-filled form.

**Prevention:**
- Resolve the session key AND fully read the credential data in a single block BEFORE dispatching to the content script:
  ```
  const ready = await ensureCredentialVaultUnlocked();
  const cred = await getFullCredential(domain);
  // Now dispatch to content script with resolved data
  // Vault state during fill doesn't matter
  ```
- The content script fill is fire-and-forget after credential resolution.

**Phase:** MCP tool implementation phase. Pattern established in first credential tool.

---

### Pitfall 13: PBKDF2 Iteration Count Mismatch

**What goes wrong:** `secure-config.js` has two PBKDF2 paths: `encrypt()`/`decrypt()` use 10,000 iterations (line 107) for legacy API keys, while `deriveCredentialSessionKey()` uses 120,000 iterations (line 348) for the vault. If new code calls `this.encrypt(data, rawPassword)` instead of `this.encrypt(data, sessionKey)`, credentials get 12x weaker key derivation.

**Prevention:**
- All credential/payment encryption MUST use the vault session key from `ensureCredentialVaultUnlocked().sessionKey`, never a raw passphrase.
- The existing `saveCredential` and `savePaymentMethod` are correct. The risk is NEW code paths.
- Consider adding a runtime warning: if `encrypt()` receives a key shorter than 40 characters, log a warning.

**Phase:** Any phase modifying `secure-config.js` encryption calls.

---

### Pitfall 14: Confirmation Timeout Without Cleanup

**What goes wrong:** The payment confirmation dialog shows in the sidepanel with a timeout (e.g., 2 minutes). When the timeout fires, the Promise rejects but the dialog remains visible. If the user clicks "Confirm" after timeout, the callback fires with no listener, or worse, triggers a stale operation.

**Prevention:**
- When the timeout fires, send a `paymentConfirmationExpired` message to the sidepanel to dismiss the dialog.
- Store the handler reference on the session/request object for cleanup.
- Follow the same pattern as the existing `session._loginHandler` in background.js (line 1006) for handler lifecycle management.

**Phase:** Confirmation dialog implementation phase.

---

## Minor Pitfalls

---

### Pitfall 15: MCP Tool Registration Bypass via TOOL_REGISTRY Auto-Registration

**What goes wrong:** The shared `TOOL_REGISTRY` in `tool-definitions.cjs` feeds `manual.ts`'s auto-registration loop. If credential/payment tools are added to this registry, they get auto-registered as standard manual tools through the generic `execAction()` path -- which logs params, doesn't check vault state, and doesn't require confirmation.

**Prevention:**
- Register credential/payment MCP tools in a SEPARATE file (e.g., `mcp-server/src/tools/vault.ts`) with explicit handler functions, not through the schema bridge auto-registration.
- This keeps the 49 existing tools untouched and ensures vault tools have custom security handling.

**Phase:** MCP tool registration phase.

---

### Pitfall 16: Card Brand Detection / Validation Edge Cases

**What goes wrong:** `detectCardBrand()` regex patterns may not cover all Mastercard 2-series numbers or newer virtual card issuers. `isValidCardNumber()` Luhn check is correct but the 12-19 digit length check may reject some legitimate cards.

**Prevention:**
- Make validation a warning in the UI, not a hard block. Allow saving with a "card number may be invalid" note.
- Brand detection is best-effort cosmetic (icon display), not a save gate.

**Phase:** Payment management UI phase.

---

### Pitfall 17: Combined Expiry Fields (MM/YY vs Separate Month/Year)

**What goes wrong:** Some payment forms use a single combined expiry field (MM/YY or MM/YYYY) instead of separate month and year fields. The fill function sends separate values.

**Prevention:**
- Content script payment fill should detect field type: if a single field with `autocomplete="cc-exp"` or matching pattern, format as `MM/YY` or `MM/YYYY` based on field maxlength/pattern.
- If separate fields, fill month and year individually.

**Phase:** Content script payment fill implementation.

---

### Pitfall 18: Subdomain Credential Matching Leaks to Attacker Subdomains

**What goes wrong:** `getCredential()` falls back to parent domain with `allowSubdomains: true`. If credentials for `example.com` exist and the AI navigates to `evil.example.com`, auto-fill would inject real credentials into the attacker's page.

**Prevention:**
- MCP `fill_credential` uses active tab URL (Pitfall 3), not MCP-supplied domain.
- Display exact domain in confirmation dialog.
- Default `allowSubdomains` to `false` for new credentials.

**Phase:** MCP tool implementation phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Vault unlock wiring | P2: Orphaned unlock flow | Wire background.js handler AND update unlock.js vault call FIRST |
| Vault unlock wiring | P4: Session key loss on SW kill | Add bootstrap rehydration for session key |
| Payment backend handlers | P5: Breaking existing tools | Search for collision, always `return true`, smoke test 3 existing tools |
| Payment management UI | P9: Dual singletons | Route operations through background.js messages |
| Payment management UI | P7: Two-tier unlock confusion | Design single-flow unlock UX |
| AI autopilot tools | P1: Plaintext password leak | NEVER send secrets through WebSocket -- opaque references only |
| AI autopilot tools | P10: Wrong field fill | Verify `type="password"` before injecting, require confirmation |
| AI autopilot tools | P8: Confirmation fatigue | Session-scoped domain approval |
| MCP tool registration | P15: Auto-registration bypass | Register vault tools in separate file, not TOOL_REGISTRY |
| MCP tools | P3: Trusting MCP-supplied domain | Always derive domain from active tab URL for fill ops |
| MCP tools | P6: Plaintext WebSocket | Opaque references only, bridge-level audit backstop |
| MCP tools | P1: Bridge logging leak (manual.ts:30) | Redact sensitive tool params before logging |
| MCP tools | P12: Race with vault lock | Resolve credential data fully before async dispatch |
| MCP tools | P11: iframe payment forms | Detect and return clear error, don't silently fail |
| All phases | P5: 49-tool regression | Smoke test existing MCP tools after every handler change |
| All phases | P13: Iteration count mismatch | Always use vault session key for encrypt(), never raw passphrase |

---

## Security Threat Model Summary

| Attack Surface | Threat | Severity | Mitigation | Confidence |
|---------------|--------|----------|------------|------------|
| WebSocket bridge (ws://localhost:7225) | Local process sniffs credentials | HIGH | Never send raw secrets over WebSocket (opaque refs only) | HIGH |
| MCP tool result payloads | Password in response to Claude Code | HIGH | Return metadata only (domain, username, last4) | HIGH |
| MCP server stderr (manual.ts:30) | Password in `console.error` params | HIGH | Redact sensitive tool params before logging | HIGH |
| Extension console logs (automationLogger) | Password in action records | HIGH | Add `sensitive` flag, redact text field | HIGH |
| MCP-supplied domain parameter | Credential lookup for wrong domain | HIGH | Derive domain from active tab URL, not payload | HIGH |
| Content script response | Password echoed in fill result | MEDIUM | Return field count, not text content | HIGH |
| Service worker restart | Session key lost, vault re-locks | MEDIUM | Eager rehydration from chrome.storage.session | HIGH |
| Subdomain matching | Creds filled into attacker subdomain | MEDIUM | Confirmation dialog showing exact domain | MEDIUM |
| DOM clickjacking | Invisible form captures autofilled creds | MEDIUM | Never auto-fill without user confirmation | MEDIUM |
| Wrong field identification | Password filled into visible text field | MEDIUM | Verify input type="password" before injection | HIGH |
| Cross-origin iframe | Fill fails silently on Stripe/Braintree | LOW | Detect and return clear error message | HIGH |
| PBKDF2 iteration mismatch | Weak encryption of stored credentials | LOW | Use vault session key, never raw passphrase | HIGH |
| chrome.storage.session budget | Keys evicted due to 1MB limit | LOW | Monitor usage, keep keys minimal | HIGH |

---

## "Looks Done But Isn't" Checklist

- [ ] **Unlock wiring:** After unlock popup, `getCredentialVaultStatus()` returns `unlocked: true` from the SERVICE WORKER context (not just the popup context)
- [ ] **Session key rehydration:** Kill service worker (chrome://serviceworker-internals), invoke MCP credential tool -- must succeed without re-unlock
- [ ] **Password never in logs:** After fill_credential via MCP, search stderr output, extension console, and automationLogger records for the actual password string
- [ ] **Password never on WebSocket:** Capture frames on ws://localhost:7225 during credential fill -- no frame contains actual password
- [ ] **Domain from tab, not MCP:** fill_credential with mismatched payload.domain vs active tab URL returns error (not wrong-domain credentials)
- [ ] **Existing tools unbroken:** After adding all new handlers, run type_text, click, read_page, run_task via MCP -- all succeed
- [ ] **38 existing tests pass:** Run `node tests/secure-config-credential-vault.test.js` -- all 38 still pass
- [ ] **Payment two-tier unlock works:** Unlock vault -> payment operations still fail -> unlock payment -> payment operations succeed
- [ ] **Options page mutations visible to MCP:** Save credential in options -> immediately list via MCP -- credential appears
- [ ] **iframe detection:** Navigate to Stripe checkout, invoke fill_payment -- returns clear iframe error, not silent failure
- [ ] **Confirmation dialog for payments:** use_payment_method via MCP shows confirmation in sidepanel -- doesn't silently fill
- [ ] **No missing `return true`:** Every new async handler in background.js has `return true` after the IIFE

---

## Sources

### Codebase Analysis (PRIMARY -- HIGH confidence)
- `config/secure-config.js` -- dual PBKDF2 paths (10K vs 120K iterations), vault lifecycle, payment methods, cache TTLs
- `ui/unlock.js:45-49` -- sends `action: 'unlock'` message with no handler in background.js
- `ws/mcp-bridge-client.js:178-247` -- 16-case routing switch, `_handleExecuteAction` passes params to content script
- `mcp-server/src/bridge.ts:138` -- logs message types on send, plaintext WebSocket on port 7225
- `mcp-server/src/tools/manual.ts:30` -- logs `params=${JSON.stringify(params).slice(0, 150)}` including text content
- `background.js:4065-4350` -- message handler switch, existing credential CRUD handlers (6 cases), no vault lifecycle or payment handlers
- `utils/automation-logger.js:504-510` -- `logActionExecution` spreads details into log entries including full params

### External Research (MEDIUM confidence)
- [Chrome Extensions Transmit Sensitive Data Over HTTP (SECURITY.COM)](https://www.security.com/threat-intelligence/chrome-extension-leaks)
- [DOM-Based Extension Clickjacking (Marek Toth)](https://marektoth.com/blog/dom-based-extension-clickjacking/)
- [MCP Server Security 2025 Report (Astrix)](https://astrix.security/learn/blog/state-of-mcp-server-security-2025/)
- [MCP Security Checklist (SlowMist)](https://github.com/slowmist/MCP-Security-Checklist)
- [WebSocket Security: 9 Common Vulnerabilities (Ably)](https://ably.com/topic/websocket-security)
- [Chrome MV3 Service Worker Lifetime Issue](https://support.google.com/chrome/thread/372388083)
- [chrome.storage API Documentation](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [1Password Agentic Autofill (SiliconANGLE)](https://siliconangle.com/2025/10/08/1password-tackles-ai-credential-risks-new-agentic-autofill-integration-browserbase/)

---
*Pitfalls research for: Vault, Payments & Secure MCP Access (v0.9.34)*
*Researched: 2026-04-20*
