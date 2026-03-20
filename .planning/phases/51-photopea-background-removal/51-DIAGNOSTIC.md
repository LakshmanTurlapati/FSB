# Autopilot Diagnostic Report: Phase 51 - Photopea Background Removal

## Metadata
- Phase: 51
- Requirement: CANVAS-05
- Date: 2026-03-20
- Outcome: PARTIAL
- Live MCP Testing: NO (no active MCP server connection to Chrome in this executor session)

## Prompt Executed
"Open an image in Photopea, select the Magic Wand tool, click on the background area, and press Delete to remove the background using MCP manual tools."

## Result Summary
Photopea site guide was created in Plan 01 with comprehensive selectors and 6 workflows covering the full background removal pipeline (dismiss splash, load image via URL hash, select Magic Wand via W shortcut, click background on canvas with click_at, press Backspace to clear, Ctrl+D to deselect). All required MCP tools (navigate, press_key, click_at, get_dom_snapshot, wait_for_stable) are implemented from Phases 47-49. Live MCP execution against Photopea was not performed in this session because no MCP server connection to Chrome was available. Classification: PARTIAL because the tooling is complete and site guide documents the full workflow, but no live Magic Wand selection or background deletion was executed to confirm Photopea canvas responsiveness to CDP events.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate (planned) | https://www.photopea.com | DEFERRED | URL documented in site guide; Photopea is free, no auth required |
| 2 | get_dom_snapshot + press_key (planned) | Splash dialog dismissal | DEFERRED | Escape key or close button documented in site guide dismissSplash workflow |
| 3 | navigate (planned) | photopea.com#open:IMAGE_URL | DEFERRED | URL hash method is simplest image loading path per site guide loadImageViaUrl workflow |
| 4 | press_key (planned) | W key for Magic Wand tool | DEFERRED | Photoshop-standard shortcut; selectMagicWand workflow documented with toolbar click fallback |
| 5 | click_at (planned) | Background area on canvas (corner coordinates) | DEFERRED | CDP click_at required for canvas pixel interaction; background usually at image corners |
| 6 | press_key (planned) | Backspace to clear selected area | DEFERRED | Mac Delete = Backspace; documented in site guide removeBackground workflow step 5 |
| 7 | press_key (planned) | Ctrl+D to deselect | DEFERRED | Standard Photoshop shortcut; documented in removeBackground workflow step 7 |

## What Worked
- Photopea site guide created with 10 selectors covering canvas, toolbar, menu bar, file menu, select menu, layers panel, tool options bar, tolerance input, splash dialog, and splash close button
- Six workflows documented: dismissSplash, loadImageViaUrl, loadSampleImage, selectMagicWand, removeBackground, invertAndDelete
- 14+ Photoshop keyboard shortcuts documented (W for Magic Wand, B for Brush, E for Eraser, C for Crop, V for Move, etc.)
- URL hash image loading method documented (photopea.com#open:IMAGE_URL) as simplest automation path
- Site guide registered in background.js importScripts under Design & Whiteboard category
- All required MCP tools already exist from prior phases: navigate, press_key, click_at, get_dom_snapshot, wait_for_stable
- Mac Backspace vs Delete distinction documented (press_key should use "Backspace" not "Delete")
- Magic Wand tolerance documentation included (default 32, configurable, contiguous mode toggle)

## What Failed
- Live MCP execution was not performed -- no active MCP server connection to Chrome was available in this executor session
- Research-based selectors have not been validated against actual Photopea DOM (Photopea uses a custom UI framework, not standard HTML form elements)
- Canvas element selector (#canvas, canvas) has not been confirmed to match Photopea's actual canvas element
- Magic Wand tool activation via W key shortcut has not been tested on live Photopea
- CDP click_at behavior on Photopea's canvas element is unknown -- Photopea may handle mouse events differently than TradingView or Excalidraw
- Marching ants selection appearance after Magic Wand click has not been verified
- Background deletion via Backspace key has not been confirmed to produce transparency (checkerboard pattern)

## Tool Gaps Identified
- No new tool gap for the Photopea use case in theory -- navigate, press_key, click_at, and get_dom_snapshot cover all required interactions
- Potential gap: no MCP tool for verifying canvas-rendered content (checkerboard transparency pattern is rendered on canvas, not visible in DOM)
- Potential gap: Magic Wand tolerance may need adjustment for specific images -- no automated way to detect if selection quality is sufficient
- Potential gap: if Photopea's canvas intercepts keyboard events when focused, press_key for tool shortcuts may not work without first clicking outside the canvas to unfocus it
- Observation: Photopea's custom UI framework may use non-standard DOM structure for toolbar and menus, making research-based selectors unreliable

## Bugs Fixed In-Phase
- Plan 01: Created Photopea site guide with 10 selectors, 6 workflows, 14+ keyboard shortcuts, and 9 warning annotations
- Plan 01: Registered site guide in background.js importScripts under Design & Whiteboard section
- No additional bugs discovered (live test not performed)

## Autopilot Recommendations
- Keyboard shortcuts are the preferred method for tool selection in Photopea -- press_key(W) for Magic Wand is faster and more reliable than clicking the toolbar icon, which may have non-standard selectors
- Image loading via URL hash (photopea.com#open:IMAGE_URL) is the simplest automation path and avoids File menu interaction complexity -- autopilot should use this method with a known test image URL
- Background area identification: click on image corners (e.g., top-left at canvas offset + 10px, 10px) where background is most likely to be, since backgrounds typically fill the outer areas of portrait/product images
- Magic Wand tolerance of 32 (default) works well for solid-color backgrounds; increase to 50-80 for slightly noisy backgrounds or gradients
- Verification challenge: Photopea renders all editing results on HTML5 canvas, so checkerboard transparency pattern is NOT visible in DOM snapshots -- autopilot cannot programmatically verify background deletion succeeded without a screenshot tool or canvas pixel reading capability
- Alternative verification: check if Undo (Ctrl+Z) menu item becomes active after deletion, or check layers panel for alpha channel changes
- If W shortcut does not activate Magic Wand (possibly intercepted by canvas focus), try: (1) click outside canvas to unfocus, (2) press W, (3) if still fails, use get_dom_snapshot to find toolbar Magic Wand button and DOM-click it
- Token budget concern: Photopea DOM may be very large due to panel/toolbar structure -- autopilot should use targeted selectors rather than full DOM snapshot
- Splash dialog must be dismissed before any canvas interaction -- Escape key is the fastest method
- For automation reliability, the removeBackground workflow should include error recovery: if click_at on background selects nothing (no marching ants), try a different corner; if Backspace does nothing, try Delete key as alternative

## New Tools Added This Phase
| Tool | Type | Location | Purpose |
|------|------|----------|---------|
| (none) | - | - | All tools from Phases 47-49 are sufficient for Photopea interaction |
