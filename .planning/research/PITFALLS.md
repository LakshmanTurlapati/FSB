# Domain Pitfalls: v0.9.9 Excalidraw Mastery

**Domain:** Canvas-based diagramming automation via CDP
**Researched:** 2026-03-23

## Critical Pitfalls

Mistakes that cause the entire drawing to fail or produce garbage output.

### Pitfall 1: Text Entry Without Waiting for Textarea
**What goes wrong:** AI activates text tool, clicks canvas, immediately calls cdpInsertText. Text is silently dropped because the textarea hasn't been created yet by React.
**Why it happens:** Excalidraw creates textarea asynchronously after click event processes through React rendering cycle. There's a 50-200ms delay.
**Consequences:** No text appears. Shape labels are missing. AI doesn't detect the failure because canvas state isn't DOM-observable.
**Prevention:** After clicking to place text, ALWAYS wait for `textarea.excalidraw-wysiwyg` to appear in DOM before calling cdpInsertText. Use waitForElement or poll with getAttribute.
**Detection:** Check if `textarea.excalidraw-wysiwyg` exists in DOM after text insertion. If it still exists, text wasn't committed (Escape wasn't pressed). If it doesn't exist AND was never seen, text entry failed.

### Pitfall 2: Forgetting to Re-activate Tool Between Shapes
**What goes wrong:** AI draws first rectangle with press_key R + cdpDrag, then immediately does another cdpDrag expecting another rectangle. Second drag creates a selection box instead.
**Why it happens:** Excalidraw auto-switches to selection tool (V) after every shape creation. This is by design for easy editing flow.
**Consequences:** Only first shape is drawn. Subsequent drags select/move instead of creating shapes.
**Prevention:** Press the tool shortcut key (R, D, O, etc.) before EVERY shape draw, not just the first one. Site guide must emphasize this in every workflow.
**Detection:** If the AI issues multiple cdpDrag without intervening press_key, flag as likely failure.

### Pitfall 3: Small Drag Distance = No Shape
**What goes wrong:** cdpDrag with start and end coordinates too close together (less than 30px). Excalidraw treats this as a click, not a draw.
**Why it happens:** AI calculates coordinates that are too close, or rounds to similar values.
**Consequences:** No shape appears. AI may not detect failure.
**Prevention:** Enforce minimum 50px drag distance in both X and Y. Shape minimum size should be ~80x60px.
**Detection:** Difficult to detect via DOM since shapes aren't DOM elements. Track via action history.

### Pitfall 4: Arrow Not Binding to Shape
**What goes wrong:** Arrow is drawn near shapes but doesn't bind. Moving shapes later leaves the arrow disconnected.
**Why it happens:** Arrow endpoints must be within ~5px of shape boundary for binding to activate. Coordinates just slightly off = unbound arrow.
**Consequences:** Diagram falls apart when shapes are repositioned. Looks connected initially but isn't.
**Prevention:** Calculate arrow start/end coordinates to be exactly on shape edges. For a 150x80 rect at (200,200)-(350,280): bottom edge midpoint = (275, 280), top edge midpoint = (275, 200).
**Detection:** No reliable DOM detection. Arrow binding is internal Excalidraw state. Visual inspection or Stats panel only.

### Pitfall 5: Keyboard Shortcuts Intercepted When Not on Canvas
**What goes wrong:** AI presses R to activate rectangle tool, but focus is on a dialog, modal, or the text editor. R gets typed as text instead.
**Why it happens:** Excalidraw's keyboard shortcuts only work when focus is on the canvas/app, not on text inputs or dialogs.
**Consequences:** Wrong action, text corruption, or no response.
**Prevention:** Before any keyboard shortcut, ensure no modal/dialog is open and no text editor is active. Press Escape first to dismiss any open state. Site guide should include "Escape before shortcut" pattern.
**Detection:** Check for `textarea.excalidraw-wysiwyg`, `[class*="Modal"]`, `[class*="Dialog"]` in DOM. If present, dismiss first.

## Moderate Pitfalls

### Pitfall 6: Welcome Dialog on First Visit
**What goes wrong:** Excalidraw shows a welcome splash screen that blocks canvas interaction. AI tries to draw on canvas but clicks hit the dialog overlay instead.
**Prevention:** First step on Excalidraw should always be: check for modal/dialog, press Escape to dismiss.
**Detection:** Check for `[class*="Modal"]`, `[class*="Dialog"]`, `[data-testid*="dialog"]` in DOM.

### Pitfall 7: Color Picker DOM Fragility
**What goes wrong:** AI tries to click on a specific color in the color picker but the color grid layout or CSS classes have changed across Excalidraw versions.
**Prevention:** Use keyboard shortcut S (stroke) or G (background) to open picker, then use simpler selectors or coordinate-based clicks on color swatches. Prefer named colors near the top of the palette.
**Detection:** If color picker popup doesn't appear after S/G key press, the focus wasn't on canvas.

### Pitfall 8: Export Dialog Not Opening
**What goes wrong:** AI tries Shift+Alt+C but nothing copies to clipboard, or clicks "Save as image" but dialog doesn't appear.
**Prevention:** Ensure nothing is blocking (no modal, no text editor active). For Shift+Alt+C, ensure at least one element exists on canvas (empty canvas has nothing to export).
**Detection:** Export dialog presence via `[class*="Modal"]` or `[class*="Dialog"]` after menu click.

### Pitfall 9: Text Commitment Timing
**What goes wrong:** After cdpInsertText, AI immediately proceeds to next action without committing text (pressing Escape). Text stays in edit mode and next keyboard shortcut gets typed into the text field.
**Prevention:** After every cdpInsertText, ALWAYS press Escape to commit text and return to canvas mode. Wait 100ms after Escape for React to process.
**Detection:** Check if `textarea.excalidraw-wysiwyg` still exists after Escape. If it does, text wasn't committed.

### Pitfall 10: Zoom/Pan State Affecting Coordinates
**What goes wrong:** AI calculates coordinates based on default zoom, but canvas has been zoomed in/out or panned. All shapes appear in wrong positions.
**Prevention:** At start of drawing session, press Shift+1 (zoom to fit) or Ctrl+0 (reset zoom) to ensure known state. If canvas is empty, use Ctrl+0 for 100% zoom at origin.
**Detection:** Not directly detectable. Preventive reset is the only reliable approach.

## Minor Pitfalls

### Pitfall 11: Shift+V Conflict
**What goes wrong:** Pressing Shift+V to flip vertical when the intent was to activate selection tool (V). Shift changes V's behavior.
**Prevention:** Use plain V (no shift) for selection tool. Only use Shift+V deliberately for flip vertical.

### Pitfall 12: Frame Tool Availability
**What goes wrong:** F key may not activate frame tool in all Excalidraw versions or may conflict with Fullscreen.
**Prevention:** After pressing F, verify toolbar state changed. If not, use rectangle as visual frame fallback.

### Pitfall 13: Large DOM Snapshot from React
**What goes wrong:** Excalidraw's React DOM is very large (toolbar, panels, menus all rendered). DOM snapshot exceeds token budget.
**Prevention:** Site guide already warns about this. Use targeted data-testid selectors rather than full DOM traversal.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Text entry | Textarea timing (Pitfall 1) | Wait for excalidraw-wysiwyg, test with simple single-word text first |
| Drawing primitives | Tool re-activation (Pitfall 2) | Explicit press_key before EVERY shape in site guide workflows |
| Connectors/arrows | Binding precision (Pitfall 4) | Calculate edge coordinates from shape bounds, use 20+ drag steps |
| Styling/colors | Color picker fragility (Pitfall 7) | Use keyboard shortcuts S/G first, prefer coordinate clicks over selector clicks |
| Export | Empty canvas export (Pitfall 8) | Verify elements exist before export attempt |
| NL diagram generation | All pitfalls compound | Build on proven workflows from earlier phases |

## Sources

- [Excalidraw textWysiwyg.tsx](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx) -- textarea timing behavior
- [Excalidraw CANVAS-02 diagnostic](existing site guide) -- tool re-activation discovery
- [Excalidraw arrow binding](https://x.com/excalidraw/status/1786055557645824177) -- binding distance behavior
- [CDP Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/) -- keyboard event dispatch
