---
status: resolved
trigger: "automation-logger-no-sw - The automation logger throws 'Failed to load logs: Error: No SW' at utils/automation-logger.js:498"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - loadLogs() lacked chrome.runtime?.id guard, causing "No SW" error when called in invalidated context
test: Added guards to all 9 async methods that use chrome.storage.local
expecting: No more "Failed to load logs: Error: No SW" errors on the extension errors page
next_action: Archive session

## Symptoms

expected: The automation logger should load logs from chrome.storage.local without errors, or handle the absence of a service worker gracefully without throwing errors to the console.
actual: Error "Failed to load logs: Error: No SW" appears in the Chrome extension errors page. The error originates from utils/automation-logger.js line 498 in the catch block of the loadLogs() async method.
errors: "Failed to load logs: Error: No SW" - Stack trace: utils/automation-logger.js:498 (anonymous function)
reproduction: The error shows up in the Chrome extension error page (chrome://extensions errors). It occurs when the automation logger tries to load logs while the service worker is inactive/sleeping or the extension context has been invalidated.
started: Current issue visible in the extension's error log

## Eliminated

(none - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: utils/automation-logger.js - full class structure
  found: persistLogs() (line 479) has chrome.runtime?.id guard BEFORE calling chrome.storage.local.set() and also checks chrome.runtime?.id in the catch block before logging errors. loadLogs() (line 493) has NO such guard - it calls chrome.storage.local.get() directly and console.error's unconditionally in catch.
  implication: Inconsistent protection - persistLogs was hardened but loadLogs was not.

- timestamp: 2026-02-17T00:02:00Z
  checked: Line 721 - where loadLogs() is called
  found: globalThis.automationLogger.loadLogs() is called immediately after singleton construction, with no await (fire-and-forget). If this runs when the extension context is invalidated (e.g., after reload, or when the service worker has been killed), chrome.storage.local.get() throws "No SW".
  implication: The fire-and-forget call means the rejected promise's error surfaces in the Chrome extension error page.

- timestamp: 2026-02-17T00:03:00Z
  checked: Where automation-logger.js is loaded
  found: 3 contexts: (1) background.js via importScripts (service worker), (2) content.js injection via chrome.scripting.executeScript, (3) options.html via script tag. The content script context (ISOLATED world) runs inside web pages - when the extension is reloaded or updated, any previously-injected content scripts have their chrome.runtime context invalidated, making chrome.storage calls fail with "No SW".
  implication: The most likely trigger is re-injection or stale content script context after extension reload.

- timestamp: 2026-02-17T00:04:00Z
  checked: "No SW" string in codebase
  found: Not present in any project file. This is a Chrome internal error message that chrome.storage.local.get() throws when the backing service worker is unavailable.
  implication: This is a Chrome MV3 platform error, not application code. The fix must guard against it.

- timestamp: 2026-02-17T00:05:00Z
  checked: All chrome.storage.local calls in automation-logger.js
  found: 12 total chrome.storage.local calls across methods: persistLogs, loadLogs, getDOMSnapshots, saveSession, _persistDOMSnapshots, loadSession, listSessions, deleteSession, clearAllSessions. Only persistLogs has the chrome.runtime?.id guard.
  implication: Multiple methods are vulnerable, but loadLogs is the one surfacing errors because it runs on initialization (line 721).

- timestamp: 2026-02-17T00:08:00Z
  checked: Syntax validation of fixed file
  found: node -c passes with zero errors
  implication: Fix is syntactically correct

## Resolution

root_cause: loadLogs() at line 493 lacks the chrome.runtime?.id guard that persistLogs() already has. When automation-logger.js is loaded in a context where the service worker is unavailable (e.g., stale content script after extension reload, or service worker waking up), chrome.storage.local.get('automationLogs') throws "No SW". The catch block at line 498 unconditionally logs via console.error, causing the error to appear on the Chrome extension errors page.

fix: Added chrome.runtime?.id guard to ALL 9 async methods that use chrome.storage.local (loadLogs, getDOMSnapshots, saveSession, _persistDOMSnapshots, loadSession, listSessions, deleteSession, clearAllSessions - persistLogs already had it). Each method now: (1) early-returns a safe default if chrome.runtime?.id is falsy, (2) only console.error's in catch blocks when chrome.runtime?.id is still truthy (context valid). This ensures the logger silently degrades when the extension context is invalidated, matching the pattern already established in persistLogs().

verification: Syntax validated with node -c (passes). The fix uses the exact same guard pattern (chrome.runtime?.id) that was already proven to work in persistLogs(). All methods return safe defaults (false, null, [], or void) when guarded, so callers are unaffected. No behavioral changes when extension context is valid -- guards are only active when chrome.runtime.id is undefined/null (invalidated context).

files_changed:
- utils/automation-logger.js: Added chrome.runtime?.id guards to 8 methods (loadLogs, getDOMSnapshots, saveSession, _persistDOMSnapshots, loadSession, listSessions, deleteSession, clearAllSessions) and wrapped 4 catch-block console.error calls with chrome.runtime?.id checks (loadLogs, getDOMSnapshots, saveSession, _persistDOMSnapshots)
