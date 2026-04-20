---
phase: 191-vault-unlock-fix-bootstrap-rehydration
plan: 01
subsystem: vault-lifecycle
tags: [vault, credential-management, message-handlers, unlock-popup]
dependency_graph:
  requires: [config/secure-config.js vault methods]
  provides: [vault lifecycle message routing, fixed unlock popup]
  affects: [background.js, ui/unlock.js]
tech_stack:
  added: []
  patterns: [async IIFE message handler, promise-based sendMessage]
key_files:
  created: []
  modified: [background.js, ui/unlock.js]
decisions:
  - "Pass secureConfig responses directly to sendResponse without envelope wrapping"
  - "Remove all local crypto logic from unlock.js -- background.js owns vault operations"
  - "Use getCredentialVaultStatus instead of masterPassword session check for already-unlocked detection"
metrics:
  duration: ~1 min
  completed: 2026-04-20
  tasks: 2
  files: 2
---

# Phase 191 Plan 01: Vault Lifecycle Message Handlers and Unlock Fix Summary

Wire vault create/unlock/lock/status message handlers into background.js and fix the unlock popup to use the correct action name with response-awaited close behavior.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add vault lifecycle message handlers to background.js | 3cc5f40 | background.js |
| 2 | Fix unlock.js to send correct action and await response | b93358c | ui/unlock.js |

## What Changed

### Task 1: Vault Lifecycle Message Handlers

Added four new switch cases in background.js after the existing credential management block (line 4354):

- `createCredentialVault` -- routes to `secureConfig.createCredentialVault(request.passphrase)`, returns success/error with migratedCount
- `unlockCredentialVault` -- routes to `secureConfig.unlockCredentialVault(request.passphrase)`, returns success/error with errorCode
- `lockCredentialVault` -- routes to `secureConfig.lockCredentialVault()`, returns success confirmation
- `getCredentialVaultStatus` -- routes to `secureConfig.getCredentialVaultStatus()`, returns configured/unlocked booleans

All use the established async IIFE pattern with try/catch and `return true` for async sendResponse.

### Task 2: Fixed Unlock Popup

Rewrote ui/unlock.js submit handler:

- Changed action from `'unlock'` to `'unlockCredentialVault'`
- Changed field from `password` to `passphrase` to match SecureConfig API
- Added `await` on sendMessage (promise form instead of fire-and-forget)
- `window.close()` only executes when `response.success === true`
- Shows user-friendly error messages: "No vault configured" for vault_not_configured, "Incorrect password" for invalid_passphrase
- Removed local `import('../config/secure-config.js')` and all local decrypt/initialize logic
- Removed `chrome.storage.session.set({ masterPassword: ... })` -- session key management is internal to SecureConfig
- Replaced `chrome.storage.session.get('masterPassword')` check with `getCredentialVaultStatus` query on load

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Evidence

```
background.js:4354:    // Vault lifecycle actions (Phase 191)
background.js:4355:    case 'createCredentialVault':
background.js:4366:    case 'unlockCredentialVault':
background.js:4377:    case 'lockCredentialVault':
background.js:4388:    case 'getCredentialVaultStatus':

ui/unlock.js:24:      action: 'unlockCredentialVault',
ui/unlock.js:25:      passphrase: password
ui/unlock.js:28:    if (response && response.success) {
ui/unlock.js:60:chrome.runtime.sendMessage({ action: 'getCredentialVaultStatus' })

No 'action: unlock' (old incorrect name) found.
No 'secureConfig' import found in unlock.js.
No 'masterPassword' reference found in unlock.js.
```

## Self-Check: PASSED

- background.js: FOUND
- ui/unlock.js: FOUND
- 191-01-SUMMARY.md: FOUND
- Commit 3cc5f40: FOUND
- Commit b93358c: FOUND
