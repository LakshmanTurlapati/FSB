/**
 * Shared Category Guidance: Design & Whiteboard
 * Category-level guidance that applies to all design and whiteboard canvas apps.
 */

registerCategoryGuidance({
  category: 'Design & Whiteboard',
  icon: 'fa-pen-ruler',
  guidance: `DESIGN & WHITEBOARD INTELLIGENCE:

CANVAS INTERACTION:
- Design/whiteboard apps render to HTML5 <canvas> elements
- Canvas elements do NOT respond to content script dispatchEvent() -- events are untrusted
- ALL canvas interactions MUST use CDP trusted events via cdpClickAt and cdpDrag tools
- Coordinates are viewport-relative (use getBoundingClientRect(), NOT offsetTop/offsetLeft)

TOOL SELECTION:
- Most canvas editors support keyboard shortcuts for tool selection (faster than toolbar clicks)
- Common shortcuts: R=rectangle, E=ellipse, L=line, V=selection/pointer, F=frame
- Toolbar buttons are standard HTML DOM elements -- use regular click tool for those
- After drawing a shape, the tool may auto-deselect -- re-press the shortcut before each draw

SHAPE DRAWING:
- Shapes are drawn via drag: mousedown at start corner, mousemove, mouseup at end corner
- Use cdpDrag with sufficient step count (10+) and stepDelay (10-20ms) for reliable rendering
- Ensure drag distance exceeds minimum threshold (typically 20-50px) to distinguish from click

MULTI-SELECT:
- Shift+click on individual shapes to add them to selection
- Or switch to selection tool (V) and drag a selection box around shapes
- Ctrl+A typically selects all shapes on canvas
- Multi-select triggers alignment toolbar to appear

ALIGNMENT:
- Alignment buttons appear in top toolbar or floating panel after multi-selecting 2+ shapes
- Common options: align left, center horizontally, align right, align top, center vertically, align bottom
- Distribution options: distribute horizontally, distribute vertically (for 3+ shapes)
- Alignment buttons are DOM elements -- use regular click tool, not CDP events`,
  warnings: [
    'Canvas interactions MUST use cdpClickAt or cdpDrag -- content script events are untrusted and ignored',
    'CDP coordinates are viewport-relative -- always use getBoundingClientRect() not offsetTop/offsetLeft',
    'After drawing one shape, re-activate the tool before drawing the next (tool may auto-deselect)',
    'DOM snapshots of canvas apps can be very large -- use targeted selectors to reduce token usage',
    'Some design apps (Figma) require authentication -- check for login walls before attempting interaction'
  ]
});
