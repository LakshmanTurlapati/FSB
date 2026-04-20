---
phase: 194-autopilot-tools-confirmation-dialog
plan: 01
subsystem: autopilot-tools
tags: [tool-registry, content-script, vault-fill, credential-autofill, payment-autofill]
dependency_graph:
  requires: []
  provides: [fill_credential-tool, fill_payment_method-tool, fillCredentialFields-handler, fillPaymentFields-handler]
  affects: [ai/tool-executor.js, background.js]
tech_stack:
  added: []
  patterns: [inferElementPurpose-field-classification, input-change-event-dispatch]
key_files:
  created: []
  modified:
    - ai/tool-definitions.js
    - content/actions.js
decisions:
  - Used FSB.inferElementPurpose (existing) instead of non-existent classifyFormField
  - Placed vault fill tools at end of TOOL_REGISTRY as final category
  - Updated tool count from 43 to 51 (actual count, was already out of date)
metrics:
  duration: ~3m
  completed: 2026-04-20
  tasks: 2/2
---

# Phase 194 Plan 01: Vault Fill Tool Definitions and Content Handlers Summary

Register fill_credential and fill_payment_method tools in TOOL_REGISTRY with background routing, and implement content-script handlers that classify form fields via inferElementPurpose to fill login/payment forms.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add fill_credential and fill_payment_method to TOOL_REGISTRY | d4af523 | ai/tool-definitions.js |
| 2 | Implement fillCredentialFields and fillPaymentFields content handlers | e724ef3 | content/actions.js |

## Implementation Details

### Task 1: Tool Registry Additions

Added two new tool definitions under a `VAULT FILL TOOLS` category section:

- **fill_credential**: Takes `domain` string parameter, routes through `background`, used to look up and fill saved login credentials.
- **fill_payment_method**: Takes `paymentMethodId` string parameter, routes through `background`, used to fill checkout forms with saved payment data after user confirmation.

Both tools have `_readOnly: false` (they mutate form state) and `_contentVerb: null` / `_cdpVerb: null` (background handles dispatch).

### Task 2: Content Script Handlers

**fillCredentialFields** handler:
- Scans visible inputs on page using `FSB.inferElementPurpose`
- Identifies `credential-input` role with `username`/`password` intents
- Also accepts `contact-input` with `email` intent as username fallback (common on login forms)
- Fills by setting `.value` and dispatching `input` + `change` events for React/Vue/Angular reactivity

**fillPaymentFields** handler:
- Scans visible inputs + select elements using `FSB.inferElementPurpose`
- Builds intent map for all `payment-input` classified fields
- Fills: cc-number, cc-csc, cc-exp (combined or split month/year), cc-name
- Fills billing address: line1, line2, city, region, postalCode, country, billing-name
- Handles `<select>` elements by matching option value or text
- Dispatches appropriate events per element type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used inferElementPurpose instead of classifyFormField**
- **Found during:** Task 2
- **Issue:** Plan referenced `FSB.classifyFormField` which does not exist in the codebase. The actual function is `inferElementPurpose` in dom-analysis.js, exported as `FSB.inferElementPurpose`.
- **Fix:** Used `FSB.inferElementPurpose` in both handlers. Same return shape (role, intent, etc.) as plan expected.
- **Files modified:** content/actions.js

**2. [Rule 1 - Bug] Corrected tool count in JSDoc**
- **Found during:** Task 1
- **Issue:** TOOL_REGISTRY JSDoc said "43 tools" but actual count was 49 before additions (51 after). Plan said to update to 45.
- **Fix:** Updated to accurate count of 51.
- **Files modified:** ai/tool-definitions.js

## Threat Mitigations Applied

- T-194-01 (Information Disclosure - credentials): Values set via `.value` only, no innerHTML. No console.log of credential values in handler code.
- T-194-02 (Information Disclosure - payment): Card number and CVV set via `.value` only. No logging of sensitive values.

## Verification Results

- fill_credential registered: background route, domain param -- PASS
- fill_payment_method registered: background route, paymentMethodId param -- PASS
- fillCredentialFields uses credential-input classification -- PASS
- fillPaymentFields uses payment-input classification with all intents -- PASS
- Both handlers dispatch input+change events -- PASS

## Self-Check: PASSED

All files exist, all commits verified (d4af523, e724ef3).
