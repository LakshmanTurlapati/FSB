---
status: resolved
trigger: "CDP typing into Google Docs fails because debugger is attached to wrong tab in multi-tab workflow"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two independent CDP codepaths conflict because KeyboardEmulator keeps debugger attached persistently
test: Traced code path from keyPress(Cmd+End) through KeyboardEmulator to handleCDPInsertText
expecting: N/A - root cause confirmed and fix applied
next_action: N/A - resolved

## Symptoms

expected: When AI navigates from X.com to Google Docs and tries to type, CDP should attach its debugger to the current Google Docs tab and insert text.
actual: CDP type fails with error "Another debugger is already attached to the tab with id: 695748861". The debugger was attached to tab 695748861 (original X.com tab) but the Google Docs page may be on the same tab after navigation.
errors: "Canvas editor CDP fallback failed: Another debugger is already attached to the tab with id: 695748861."
reproduction: Multi-tab task "check elon's latest post and summarize it in google doc". Session navigated to docs.google.com, clicked editor, pressed Cmd+End, then type failed with debugger attachment error.
started: New failure mode -- CDP works for single-tab but breaks in multi-tab workflows.

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:00:30Z
  checked: background.js handleCDPInsertText (line 8092-8207)
  found: Uses sender.tab.id for tabId. Calls chrome.debugger.attach directly with no pre-check for existing attachment. Properly detaches in finally/catch blocks.
  implication: This handler is correct in isolation but does not coordinate with KeyboardEmulator.

- timestamp: 2026-02-17T00:00:35Z
  checked: content.js keyPress tool (line 7888-7966)
  found: keyPress sends 'keyboardDebuggerAction' message to background.js which uses KeyboardEmulator class
  implication: keyPress(Cmd+End) at step 11 used KeyboardEmulator to attach the debugger

- timestamp: 2026-02-17T00:00:40Z
  checked: utils/keyboard-emulator.js KeyboardEmulator class
  found: KeyboardEmulator.attachDebugger() attaches debugger and sets this.debuggerAttached=true but NEVER auto-detaches after pressKey/sendKeyEvent. Detach only happens on tab close or extension suspend. Additionally, it tracks debuggerAttached as a single boolean without tracking WHICH tab -- so if tab A attaches, tab B calls attachDebugger and gets true without actually being attached.
  implication: ROOT CAUSE -- keyPress(Cmd+End) attached debugger via KeyboardEmulator, debugger stayed attached, then handleCDPInsertText tried to attach to the SAME tab and got "Another debugger already attached" error.

- timestamp: 2026-02-17T00:00:45Z
  checked: background.js handleKeyboardDebuggerAction (line 8478-8540)
  found: This handler calls emulator.pressKey() but never calls emulator.detachDebugger() after the operation completes. The debugger stays attached indefinitely.
  implication: Every keyPress via debugger API leaves the debugger attached, blocking any subsequent chrome.debugger.attach calls on that tab.

## Resolution

root_cause: Two independent CDP codepaths (KeyboardEmulator for keyPress and handleCDPInsertText for type) both use chrome.debugger but do not coordinate. KeyboardEmulator attaches the debugger during keyPress and never detaches it, so when handleCDPInsertText later tries to chrome.debugger.attach to the same tab, Chrome rejects it with "Another debugger is already attached". Secondary issue: KeyboardEmulator tracks attachment state as a boolean without tracking the tab ID, making it unable to handle multi-tab scenarios correctly.

fix: Three-layer fix applied:
  1. KeyboardEmulator now tracks attachedTabId (not just boolean) and handles cross-tab scenarios by auto-detaching from old tab before attaching to new tab. Added isAttachedTo(tabId) helper for coordination.
  2. handleKeyboardDebuggerAction now detaches the debugger after every operation completes (both success and error paths), preventing stale attachment that blocks subsequent CDP callers.
  3. handleCDPInsertText now checks for and detaches any existing KeyboardEmulator debugger before attaching, plus includes a force-detach-and-retry fallback for any stale "already attached" errors.

verification: Code review of all three changes confirms the fix addresses the exact failure path (keyPress leaves debugger attached -> cdpInsertText cannot attach). The fix is defensive at multiple layers so even if one layer fails, subsequent layers handle it.

files_changed:
  - utils/keyboard-emulator.js: Added attachedTabId tracking, tab-aware attach/detach, isAttachedTo() method
  - background.js: handleKeyboardDebuggerAction detaches after each operation; handleCDPInsertText coordinates with KeyboardEmulator and retries on stale attachment; tabs.onRemoved uses isAttachedTo check
