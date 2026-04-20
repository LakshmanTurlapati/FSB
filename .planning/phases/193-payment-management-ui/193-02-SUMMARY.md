---
phase: 193-payment-management-ui
plan: 02
subsystem: ui/options
tags: [payments, modal, validation, CRUD]
dependency_graph:
  requires: [193-01]
  provides: [payment-modal-crud, card-validation]
  affects: [ui/options.js]
tech_stack:
  added: []
  patterns: [luhn-validation, brand-detection, modal-add-edit-pattern]
key_files:
  modified:
    - ui/options.js
decisions:
  - Client-side Luhn and brand detection reimplemented (cannot call SecureConfig from options page context)
  - Card number field disabled in edit mode (immutable after creation)
  - CVV and card number cleared on modal close for T-193-04 mitigation
metrics:
  duration: "2m 36s"
  completed: "2026-04-20T16:15:00Z"
  tasks: 2
  files: 1
---

# Phase 193 Plan 02: Payment Method Modal CRUD Summary

Wire payment method add/edit modal with Luhn validation, real-time brand detection, and full card CRUD lifecycle via chrome.runtime messages.

## What Was Done

### Task 1: Wire add-card modal with real-time brand detection and validation
- Added `detectPaymentCardBrand()` -- mirrors secure-config.js regex logic for Visa/MC/Amex/Discover
- Added `isValidPaymentCardNumber()` -- full Luhn algorithm, accepts 12-19 digit strings
- Added `isValidPaymentExpiry()` -- rejects past dates and invalid month values
- Implemented `showPaymentMethodModal(mode, id)` with add/edit modes, field clearing, and full pre-fill from `getFullPaymentMethod` response in edit mode
- Implemented `hidePaymentMethodModal()` with sensitive field clearing on close
- Implemented `savePaymentMethodFromModal()` with required-field checks, Luhn validation on add, expiry validation, and dispatches `savePaymentMethod` or `updatePaymentMethod` messages
- Implemented `deletePaymentMethodConfirm(id)` with confirm dialog and `deletePaymentMethod` message

### Task 2: Wire event listeners for modal buttons and section switching
- Wired Add Card button (`addPaymentMethodBtn`) to open modal in add mode
- Wired modal Save/Cancel/Close/Backdrop click handlers
- Wired CVV visibility toggle with icon swap (eye/eye-slash)
- Wired real-time brand detection `input` listener on `paymentMethodCardNumber`
- Extended `switchSection` override to refresh `loadPaymentVaultStatus()` when navigating to payments section

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4c554dc | feat(193-02): wire payment modal with brand detection, Luhn validation, and CRUD |
| 2 | 278aac4 | feat(193-02): wire payment modal event listeners and section switch handler |

## Verification

- `detectPaymentCardBrand` correctly returns visa/mastercard/amex/discover/unknown
- `isValidPaymentCardNumber` implements Luhn check (4111111111111111 passes, 1234567890123456 fails)
- `isValidPaymentExpiry` rejects 01/2020, accepts 12/2029
- `showPaymentMethodModal('edit', id)` fetches full card and pre-fills all fields
- `deletePaymentMethodConfirm(id)` sends deletePaymentMethod after confirm()
- All modal dismiss paths (Cancel, X, backdrop) call hidePaymentMethodModal
- Brand badge updates live on card number keystroke

## Self-Check: PASSED
