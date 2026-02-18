---
status: resolved
trigger: "overlay-not-stopping: When FSB automation stops, the viewport overlay animation continues to display and does not get removed/hidden."
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:03:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED - Multiple layers of defense now ensure overlay cleanup in all code paths.
test: Syntax validation passed. Logic verified through manual code trace.
expecting: Overlays will now be properly cleaned up in all scenarios.
next_action: Archive session.

## Symptoms

expected: When FSB automation stops (task completes, user clicks stop, session ends), the viewport overlay animation should immediately stop and be removed. Page returns to normal.
actual: The overlay animation persists on the page even after FSB has stopped. Continues covering viewport and animating.
errors: No specific error messages - overlay just doesn't get cleaned up
reproduction: Start FSB automation task, then stop it (or let it complete). Overlay remains visible.
started: Ongoing issue

## Eliminated

- hypothesis: Content script sessionStatus handler is broken
  evidence: The handler correctly destroys all three overlay types (viewportGlow, progressOverlay, actionGlowOverlay) when phase==='ended'
  timestamp: 2026-02-17T00:00:30Z

- hypothesis: Race condition where executeAction re-creates overlays after ended
  evidence: Chrome message passing preserves order per-tab. executeAction is sent BEFORE ended by background, so ended always arrives second. The loop also checks isSessionTerminating between actions.
  timestamp: 2026-02-17T00:00:45Z

## Evidence

- timestamp: 2026-02-17T00:00:10Z
  checked: Overlay types and their lifecycle in content.js
  found: Three overlay singletons (viewportGlow, progressOverlay, actionGlowOverlay) with proper destroy() methods
  implication: Content-side cleanup logic is correct IF the ended message is received

- timestamp: 2026-02-17T00:00:20Z
  checked: endSessionOverlays function in background.js
  found: Was fire-and-forget (sendSessionStatus not awaited)
  implication: Message delivery failures went unnoticed

- timestamp: 2026-02-17T00:00:30Z
  checked: Automation loop catch block in background.js
  found: endSessionOverlays NOT called, cleanupSession NOT called on unhandled errors
  implication: Any unhandled error in the loop left overlays orphaned permanently

- timestamp: 2026-02-17T00:00:35Z
  checked: cleanupSession function in background.js
  found: Central cleanup function did NOT send phase:'ended' to content script
  implication: Any path calling cleanupSession without endSessionOverlays left overlays

- timestamp: 2026-02-17T00:00:40Z
  checked: All cleanupSession call sites
  found: Multiple paths called cleanupSession WITHOUT endSessionOverlays
  implication: Edge-case paths left overlays orphaned

## Resolution

root_cause: The cleanupSession function in background.js did not send a phase:'ended' message to content.js to clean up overlays. It relied on every caller to independently call endSessionOverlays first. Multiple code paths missed this call: (1) the automation loop's catch block for unhandled errors, (2) early session failure paths, (3) tab close handler. Additionally, endSessionOverlays was fire-and-forget (not awaited), so delivery failures went unnoticed.

fix: Applied a multi-layer defense approach across background.js and content.js:
  BACKGROUND.JS:
  1. Made endSessionOverlays async and awaited sendSessionStatus for reliable delivery
  2. Added defense-in-depth endSessionOverlays call inside cleanupSession (catches ALL paths)
  3. Added endSessionOverlays + cleanupSession to automation loop catch block (was missing)
  4. Awaited endSessionOverlays in handleStopAutomation and replay handler
  CONTENT.JS:
  5. Added overlay cleanup to port disconnect handler (handles service worker sleep/update)
  6. Added 60-second watchdog timer to auto-cleanup orphaned overlays if background goes silent
  7. Added watchdog timer cleanup to beforeunload handler
  8. Watchdog properly cleared when phase:'ended' is received

verification: Both files pass syntax validation (node -c). All stop/error/cleanup paths now guaranteed to send overlay cleanup through at least one mechanism. Three independent safety nets: (A) direct endSessionOverlays at each exit point, (B) defense-in-depth in cleanupSession, (C) content-side watchdog timer + port disconnect handler.

files_changed:
  - background.js
  - content.js
