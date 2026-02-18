---
status: verifying
trigger: "overlay-zindex-stacking: FSB animation overlay not always topmost element"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - root cause identified and fix applied
test: Verify all changes are consistent and no regressions
expecting: All overlays use max z-index, attach to documentElement, and isFsbElement recognizes all hosts
next_action: Final verification of all changes

## Symptoms

expected: The FSB animation overlay should always be the topmost element on the page, covering ALL page content including elements with high z-index values
actual: On various websites (especially social media sites), page elements with high z-index values appear above/on top of the FSB overlay
errors: No specific error messages - visual stacking context issue
reproduction: Activate FSB on social media sites or any site with high z-index elements
started: Ongoing issue, previous fix attempts made but problem persists

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: All overlay components in content.js - z-index values and DOM attachment
  found: |
    THREE overlay components with DIFFERENT z-index values and attachment strategies:
    1. ViewportGlow (line 1445): z-index:2147483644, appended to document.body (line 1535)
    2. ActionGlowOverlay (line 1618): z-index:2147483646, appended to document.body (line 1675)
    3. ProgressOverlay (line 1038): z-index:2147483647, appended to document.documentElement (line 1185)

    Additional overlays:
    4. HighlightManager (line 939): z-index:2147483646 on highlighted elements
    5. ElementInspector hoverOverlay (line 1811): z-index:2147483645, appended to document.body
    6. ElementInspector inspectionPanel (line 1819): z-index:2147483647
    7. ElementInspector activeIndicator (line 1835): z-index:2147483647
  implication: |
    CRITICAL FINDINGS:
    A) ViewportGlow has the LOWEST z-index (2147483644) - 3 less than max. Page elements with z-index:2147483645+ will appear above it.
    B) ViewportGlow appends to document.body (not document.documentElement). If body has a stacking context created by any CSS property (transform, filter, opacity, etc.), the glow is TRAPPED inside that context.
    C) ProgressOverlay appends to document.documentElement - this is correct and explains why it may work while ViewportGlow doesn't.
    D) isFsbElement() only checks for 'fsb-progress-host' - misses 'fsb-viewport-glow-host' and 'fsb-action-glow-host'.
    E) All three use Shadow DOM (good for style isolation) but the host element's stacking depends on WHERE it's inserted and its z-index relative to siblings.

- timestamp: 2026-02-17T00:01:00Z
  checked: CSS stacking context rules
  found: |
    Any element with these properties creates a new stacking context:
    - position with z-index (not auto)
    - transform (even transform: translateZ(0))
    - opacity < 1
    - filter
    - will-change (for certain properties)
    - contain: paint/layout/strict/content
    Modern frameworks frequently apply these to body or high-level containers,
    trapping child elements (like ViewportGlow appended to body) inside.
  implication: When a site applies e.g. transform:translateZ(0) to document.body, ALL children of body (including our glow) are trapped in body's stacking context, while elements in a sibling stacking context with higher z-index escape above.

- timestamp: 2026-02-17T00:02:00Z
  checked: Fix verification - all changes applied to content.js
  found: |
    All 8 changes verified:
    1. ViewportGlow z-index: 2147483644 -> 2147483647 (line 1464)
    2. ViewportGlow attachment: document.body -> document.documentElement (line 1554)
    3. ViewportGlow.show() re-append: added re-append to documentElement (lines 1303-1305)
    4. ActionGlowOverlay z-index: 2147483646 -> 2147483647, added all:initial + !important (line 1637)
    5. ActionGlowOverlay attachment: document.body -> document.documentElement (line 1694)
    6. ActionGlowOverlay tracking check: document.body.contains -> document.documentElement.contains (line 1719)
    7. ElementInspector: all 3 sub-elements (hoverOverlay, inspectionPanel, activeIndicator) moved to document.documentElement, hoverOverlay z-index raised to 2147483647
    8. isFsbElement(): expanded from single ID check to FSB_HOST_IDS Set covering all 6 FSB element IDs

    Zero remaining document.body.appendChild calls for FSB elements.
    Only non-max z-index remaining: HighlightManager (2147483646 on page elements - intentionally lower).
  implication: Fix is complete and consistent across all overlay components.

## Resolution

root_cause: |
  TWO issues combine to cause the overlay stacking problem:
  1. ViewportGlow and ActionGlowOverlay are appended to document.body instead of document.documentElement. When sites apply CSS properties that create stacking contexts on body (transform, filter, opacity, will-change), our overlays become TRAPPED inside body's stacking context and cannot appear above elements outside that context.
  2. ViewportGlow uses z-index:2147483644 (3 below max), while some site elements use z-index values at or near the maximum. Even without stacking context issues, any page element at z-index:2147483645+ will appear above the viewport glow.

fix: |
  Applied 8 changes to content.js:

  A) Unified DOM attachment point:
     - ViewportGlow._create(): document.body -> document.documentElement
     - ActionGlowOverlay.show(): document.body -> document.documentElement
     - ElementInspector (hoverOverlay, inspectionPanel, activeIndicator): all moved to document.documentElement
     This escapes stacking contexts created on <body> by page CSS.

  B) Unified maximum z-index:
     - ViewportGlow: 2147483644 -> 2147483647
     - ActionGlowOverlay: 2147483646 -> 2147483647
     - ElementInspector hoverOverlay: 2147483645 -> 2147483647
     All FSB overlays now use the maximum 32-bit signed integer z-index.

  C) Added re-append on show():
     - ViewportGlow.show() now re-appends host to documentElement (matching ProgressOverlay behavior)
     This ensures FSB overlays win DOM-order ties with same-z-index page elements.

  D) Hardened ActionGlowOverlay host styles:
     - Added all:initial!important to prevent page style inheritance
     - Added !important to all properties for consistency with other overlays

  E) Updated ActionGlowOverlay tracking:
     - Changed DOM containment check from document.body to document.documentElement

  F) Expanded isFsbElement() recognition:
     - Created FSB_HOST_IDS Set with all 6 FSB overlay element IDs
     - Updated ancestor check to iterate all FSB IDs
     - Updated shadow DOM boundary check to recognize all FSB hosts

verification: |
  - All overlay host elements now use z-index:2147483647 (verified via grep)
  - Zero document.body.appendChild calls remain for FSB elements (verified via grep)
  - All overlay hosts use all:initial!important + position:fixed!important
  - pointer-events:none maintained on non-interactive overlays
  - isFsbElement() recognizes all 6 FSB element IDs
  - DOM order preserved: ViewportGlow shows first, then ProgressOverlay on top
  - HighlightManager intentionally kept at z-index:2147483646 (highlights page elements, not FSB overlay)

files_changed:
  - content.js
