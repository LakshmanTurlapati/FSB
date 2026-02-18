---
status: resolved
trigger: "gdocs-clipboard-paste-silent-failure: formatted clipboard paste fires and reports success, but no text appears in Google Doc body"
created: 2026-02-17T12:00:00Z
updated: 2026-02-17T12:03:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: Syntax validation passed for both modified files (node -c)
expecting: User to reload extension and test Google Docs paste
next_action: User acceptance test

## Symptoms

expected: After clipboard paste (write HTML to clipboard + simulate Ctrl+V via CDP), formatted text should appear in Google Docs body
actual: type action reports success=true, method="gdocs_formatted_clipboard_paste", but zero text appears in document body. Only title typed via different element worked.
errors: No errors -- code reports success without verifying paste worked
reproduction: Session log at logs/fsb-session-2026-02-17-1771369428116.json shows type action at line 10537 used gdocs_formatted_clipboard_paste and returned success=true but no body text appeared
started: First time formatted paste path was reached (previous sessions used plain CDP)

## Eliminated

- hypothesis: navigator.clipboard.write() fails silently in content script without user gesture
  evidence: With "clipboardWrite" permission in manifest.json (line 18), the async Clipboard API works in content scripts on HTTPS pages without requiring transient user activation. docs.google.com is HTTPS. The code also reported success=true (the try/catch in clipboardPasteHTML would have caught a clipboard write failure and returned success=false, falling through to plain CDP).
  timestamp: 2026-02-17T12:00:30Z

- hypothesis: Ctrl+V vs Cmd+V platform mismatch (wrong modifier on Mac)
  evidence: clipboardPasteHTML line 2535 correctly detects Mac via navigator.userAgent/platform and sends meta:true for Mac, ctrl:true for other platforms. The KeyboardEmulator calculateModifierMask correctly maps meta to MODIFIER_MASKS.Meta (4). This logic is correct.
  timestamp: 2026-02-17T12:00:35Z

## Evidence

- timestamp: 2026-02-17T12:00:10Z
  checked: manifest.json permissions
  found: "clipboardWrite" permission present at line 18. HTTPS-only requirement satisfied by docs.google.com
  implication: Clipboard API write should work from content script

- timestamp: 2026-02-17T12:00:15Z
  checked: clipboardPasteHTML() in content.js lines 2518-2562
  found: Writes HTML+text to clipboard via navigator.clipboard.write(), waits 100ms, sends 'keyboardDebuggerAction' message with method:'pressKey', key:'v', modifiers:{meta:true} (Mac). Has try/catch that returns success:false on error. The calling code at line 6129 checks pasteResult.success before returning success.
  implication: Pipeline structure is correct. If clipboard.write failed, it would be caught. The success=true in logs means BOTH clipboard.write and the CDP key press reported success. The issue is that the key press DID execute but Chrome didn't interpret it as a paste.

- timestamp: 2026-02-17T12:00:20Z
  checked: KeyboardEmulator.sendKeyEvent() in keyboard-emulator.js lines 285-332
  found: ROOT CAUSE -- line 309: when type==='keyDown' and isPrintableKey(keyData.key) is true, params.text = keyData.key is set. For key='v', isPrintableKey('v') returns true, so text:'v' is added. Per CDP spec, when 'text' is present on Input.dispatchKeyEvent, Chrome treats the event as text input (character insertion), NOT as a keyboard shortcut. So Cmd+V with text:'v' causes Chrome to attempt inserting 'v' as text rather than triggering the paste command.
  implication: The paste shortcut never fires. Chrome may insert a literal 'v' or do nothing (GDocs may ignore the mixed signal). Either way, no paste happens.

- timestamp: 2026-02-17T12:00:25Z
  checked: Secondary issue -- no paste verification
  found: clipboardPasteHTML returns success:true without checking if text actually appeared in the editor. The type handler at line 6129 trusts this result and returns success:true to the AI.
  implication: Even after fixing the paste, we need verification to ensure honest success/failure reporting.

- timestamp: 2026-02-17T12:01:30Z
  checked: Same bug pattern in Ctrl+A (select-all) shortcut at content.js line 8145
  found: The clearFirst logic in typeWithKeys also sends key='a' with modifiers:{ctrl:true}. Before the fix, sendKeyEvent would add text:'a', potentially causing the select-all shortcut to fail and insert a literal 'a' instead. The keyboard-emulator fix covers this case too.
  implication: Fix has a beneficial side-effect beyond just paste -- all keyboard shortcuts using modifiers were broken by the text param.

- timestamp: 2026-02-17T12:02:30Z
  checked: Syntax validation of both modified files
  found: node -c passes for both utils/keyboard-emulator.js and content.js
  implication: Changes are syntactically correct

## Resolution

root_cause: In keyboard-emulator.js sendKeyEvent(), line 309 adds text:'v' to the CDP Input.dispatchKeyEvent params when pressing Cmd+V/Ctrl+V for paste. Per the CDP protocol, the 'text' field causes Chrome to treat the event as character input rather than a keyboard shortcut. The paste command (Cmd+V) is never interpreted as paste -- Chrome sees "insert character 'v'" instead. Secondary issue: clipboardPasteHTML reports success without verifying that text actually appeared in the editor. Tertiary issue: Same bug affected ALL keyboard shortcuts with modifiers (Ctrl+A, Cmd+A, etc.).

fix: Three changes applied:
1. keyboard-emulator.js sendKeyEvent(): Skip adding text param when Ctrl/Meta/Alt modifiers are present (line 308-315). This fixes ALL shortcut key events, not just paste. Shift is intentionally excluded since Shift+letter is uppercase character input.
2. content.js clipboardPasteHTML(): Added DOM-based verification using .kix-paragraphrenderer text length before/after paste. Returns success=false if no text appeared. Added separate try/catch for clipboard.write with specific error messages.
3. content.js formatted paste path: Added cursor focusing on .kix-page-content-wrapper before paste to ensure cursor is in editable area. Added markdown stripping for the CDP fallback path so plain text is clean if formatted paste fails. Added verified paste logging.

verification: Syntax validation passed. Requires user acceptance test (Chrome extension in-browser).

files_changed:
- utils/keyboard-emulator.js: Fixed sendKeyEvent to not include text param when modifier shortcuts are active
- content.js: Enhanced clipboardPasteHTML with verification, improved formatted paste path with cursor focus and fallback
