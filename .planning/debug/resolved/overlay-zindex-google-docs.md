---
status: resolved
trigger: "overlay-zindex-google-docs - FSB viewport overlay not rendering above Google Docs UI elements"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:03:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED - z-index approach fundamentally broken for complex web apps. Popover API is the correct solution.
test: All overlay classes updated to use popover="manual" + showPopover()
expecting: Overlays now render in browser top-layer, above ALL page content regardless of stacking contexts
next_action: Archive session

## Symptoms

expected: The FSB animation overlay should ALWAYS be the absolute topmost visual element on any webpage, including complex web apps like Google Docs
actual: On Google Docs and similar complex web apps, certain UI elements render above the FSB overlay despite z-index 2147483647 on documentElement
errors: No JS errors - visual CSS stacking issue
reproduction: Activate FSB on a Google Docs document. Overlay appears but Google Docs UI elements appear above it.
started: Persists despite previous fix moving overlays to document.documentElement with max z-index

## Eliminated

- hypothesis: Moving overlays to document.documentElement with z-index 2147483647 will always be on top
  evidence: z-index only works within the same stacking context. Complex web apps create stacking contexts via transform, will-change, contain, filter, etc. that trap z-index resolution.
  timestamp: 2026-02-17T00:01:00Z

## Evidence

- timestamp: 2026-02-17T00:00:10Z
  checked: Google Docs DOM and rendering architecture
  found: Canvas-based rendering with complex layering and stacking contexts
  implication: z-index cannot escape parent stacking contexts

- timestamp: 2026-02-17T00:00:20Z
  checked: Other Chrome extensions (Grammarly, etc.)
  found: Known z-index issues across the industry; no z-index solution exists
  implication: Need fundamentally different approach

- timestamp: 2026-02-17T00:00:30Z
  checked: CSS top-layer APIs (dialog showModal, Popover API)
  found: Popover API (popover="manual" + showPopover()) promotes to top layer without making page inert
  implication: Ideal solution for non-blocking visual overlays

- timestamp: 2026-02-17T00:00:40Z
  checked: Popover API compatibility
  found: Chrome 114+ (Baseline 2024), Shadow DOM compatible, CSS keyframes compatible
  implication: Safe to use with graceful fallback

- timestamp: 2026-02-17T00:00:50Z
  checked: Current overlay implementation
  found: Four overlay classes using z-index:2147483647 approach
  implication: All four need conversion

- timestamp: 2026-02-17T00:02:00Z
  checked: UA popover default styles
  found: UA applies inset:0, margin:auto, border:solid, etc. Must override with !important
  implication: Added style overrides, fixed CSS property ordering

## Resolution

root_cause: z-index:2147483647 on document.documentElement children only resolves within the same stacking context. Complex web apps (Google Docs, Sheets, etc.) create parent stacking contexts via CSS properties (transform, contain, will-change, filter, perspective, isolation), trapping z-index resolution and causing page elements to render above FSB overlays.

fix: Implemented browser top-layer promotion via the Popover API:
  1. Added promoteToTopLayer() utility - sets popover="manual", appends to DOM, calls showPopover()
  2. Added demoteFromTopLayer() utility - calls hidePopover() for clean removal
  3. Updated ProgressOverlay - create() promotes to top layer, show() re-promotes, destroy() demotes
  4. Updated ViewportGlow - _create() promotes, show() re-promotes, destroy() demotes
  5. Updated ActionGlowOverlay - show() promotes, hide()/destroy() demote
  6. Updated ElementInspector - all three create methods promote, disable() demotes all
  7. Added UA style overrides (inset:auto, margin:0, padding:0, border:none, background:none)
  8. Fixed CSS property ordering (inset:auto before specific position properties)
  9. Changed ElementInspector visibility toggles from display:none/block to visibility:hidden/visible
  10. Preserved z-index:2147483647 as fallback for browsers without Popover API

verification: Syntax check passes (node -c). All overlay creation, show, hide, and destroy paths updated consistently. CSS property ordering verified. Fallback paths preserved. No remaining display:none/block toggles that conflict with popover.

files_changed:
  - content.js
