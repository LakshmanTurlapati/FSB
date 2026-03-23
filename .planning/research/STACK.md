# Technology Stack: v0.9.9 Excalidraw Mastery

**Project:** FSB v0.9.9 - Full Excalidraw drawing mastery via CDP automation
**Researched:** 2026-03-23
**Constraint:** Vanilla JS Chrome Extension MV3 (no build system), existing CDP tools, keyboard emulator
**Overall confidence:** HIGH (Excalidraw source verified, CDP mechanisms proven in existing codebase)

---

## Executive Summary

This milestone requires NO new libraries, frameworks, or external dependencies. Everything needed for full Excalidraw mastery is already in FSB's toolbox. The work is entirely about *intelligence* -- teaching the AI the right keyboard shortcuts, CDP event sequences, and DOM selectors for every Excalidraw operation.

The critical discovery: Excalidraw's text editor creates a standard `<textarea>` element (class `excalidraw-wysiwyg`, `data-type="wysiwyg"`) positioned absolutely over the canvas. This means FSB's existing `Input.insertText` CDP method (already implemented as `cdpInsertText`) will work directly once the textarea is focused. The text entry problem is NOT a contenteditable issue -- it's a focus/activation sequence issue.

**Key principle: Keyboard shortcuts over DOM clicks.** Excalidraw has comprehensive keyboard shortcuts for nearly every operation. CDP `press_key` dispatching shortcuts is faster, more reliable, and avoids the fragile React DOM selectors that change across versions.

---

## Recommended Stack

### Existing Tools -- No Changes Needed

| Tool | Purpose in Excalidraw Context | Status |
|------|-------------------------------|--------|
| `press_key` (keyboard emulator) | Tool selection (R, D, O, A, L, P, T, F, E), shortcuts for all operations | Existing, proven |
| `cdpDrag` | Drawing shapes on canvas, creating selection boxes | Existing, proven in CANVAS-02 |
| `cdpDragVariableSpeed` | Smooth connector/arrow drawing for natural-looking paths | Existing |
| `cdpClickAt` | Clicking on canvas elements, toolbar buttons at coordinates | Existing, proven |
| `cdpInsertText` | Text entry into Excalidraw's WYSIWYG textarea | Existing but UNTESTED on Excalidraw |
| `Input.insertText` | Direct text insertion into focused textarea | Existing in background.js |
| `click` (DOM) | Toolbar buttons, menu items, color swatches, alignment buttons | Existing |
| `waitForDOMStable` | Wait for Excalidraw React re-renders after actions | Existing |
| `navigate` | Navigate to excalidraw.com | Existing |
| `getAttribute` / `getText` | Verify DOM state, read element properties | Existing |

### Stack Additions Required

**None.** Zero new npm packages, zero new Chrome APIs, zero new tools to build.

### What IS Needed (Site Guide Intelligence Only)

| Addition | Type | Purpose |
|----------|------|---------|
| Expanded Excalidraw site guide | Site guide update | Complete keyboard shortcut map, text entry workflow, styling selectors, export workflow, connector patterns |
| Text entry workflow documentation | Site guide section | Activate text mode -> double-click/Enter -> wait for textarea -> cdpInsertText -> Escape to commit |
| Color/styling selector map | Site guide section | Keyboard shortcuts S (stroke) and G (background) to open pickers, DOM selectors for color swatches |
| Export workflow steps | Site guide section | Menu button -> Export image -> format selection -> download/copy |
| Connector/arrow patterns | Site guide section | Arrow tool (A) -> drag from shape edge to shape edge for auto-binding |
| Verification selectors | Site guide section | textarea.excalidraw-wysiwyg presence, .layer-ui__wrapper state, toolbar active states |

---

## Critical Technical Findings

### 1. Text Entry on Excalidraw (THE Key Problem to Solve)

**Discovery:** Excalidraw uses a standard `<textarea>` element, NOT a contenteditable div.

**Source:** Excalidraw source `packages/excalidraw/wysiwyg/textWysiwyg.tsx`

**DOM element details:**
- Element type: `<textarea>`
- CSS class: `excalidraw-wysiwyg`
- Data attribute: `data-type="wysiwyg"`
- Positioning: `position: absolute` with calculated viewport coordinates
- Transform: scaled/rotated based on zoom and element angle

**Text entry workflow for FSB:**
1. Activate text tool: `press_key T`
2. Click on canvas where text should go: `cdpClickAt x y` (creates new text element)
   - OR: Double-click existing shape to add label: `cdpClickAt x y` twice rapidly
   - OR: Select existing text element and press Enter to edit
3. Wait for textarea to appear: check for `textarea.excalidraw-wysiwyg` in DOM
4. The textarea auto-receives focus when created
5. Insert text: `cdpInsertText "your text here"`
6. Commit text: `press_key Escape` or `press_key Enter` with ctrl=true
7. Excalidraw calls `onSubmit` which mutates the canvas element via `app.scene.mutateElement()`

**Why the existing `type` tool fails:** FSB's `type` tool targets standard input/textarea elements found via DOM selectors. But Excalidraw's textarea is:
- Created dynamically (not in initial DOM)
- Positioned absolutely over the canvas
- Removed from DOM after text is committed
- Has no stable ID, only class `excalidraw-wysiwyg`

**Solution:** Use `cdpInsertText` which uses `Input.insertText` CDP command. This inserts text into whatever element currently has focus. Since Excalidraw's textarea auto-focuses when created, the sequence is: activate text mode -> click canvas -> wait for textarea -> `cdpInsertText`.

**Newlines in text:** Excalidraw uses `Shift+Enter` for new lines in text elements (standard Enter commits the text or, in some contexts, creates a new line). The shortcut `Q` is documented as creating new lines in the text editor. Use `press_key q` for multi-line text.

**Confidence:** HIGH -- verified from Excalidraw source code (textWysiwyg.tsx)

### 2. Complete Keyboard Shortcuts Reference

**Confidence:** HIGH -- verified from multiple sources including official docs

#### Tool Selection (single key press, no modifiers)
| Key | Tool | Notes |
|-----|------|-------|
| V or 1 | Selection/Pointer | Also deselects current tool |
| R or 2 | Rectangle | Auto-returns to V after drawing |
| D or 3 | Diamond | Auto-returns to V after drawing |
| O or 4 | Ellipse/Oval | Auto-returns to V after drawing |
| A or 5 | Arrow | Auto-returns to V after drawing |
| L or 6 | Line | Auto-returns to V after drawing |
| P or 7 | Pencil/Free draw | Auto-returns to V after drawing |
| T or 8 | Text | Auto-returns to V after placing |
| 9 | Insert image | Opens file picker |
| E or 0 | Eraser | Click elements to erase |
| F | Frame | Draw a container frame |
| H | Hand/Pan | Drag to pan canvas |
| K | Laser pointer | Presentation mode pointer |
| I or Shift+S or Shift+G | Color picker (eyedropper) | Pick color from canvas |

#### Canvas Operations
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y or Ctrl+Shift+Z | Redo |
| Ctrl+A | Select all |
| Ctrl+Delete | Clear/reset canvas |
| Delete or Backspace | Delete selected |
| Escape | Deselect / cancel tool |

#### Element Manipulation
| Shortcut | Action |
|----------|--------|
| Ctrl+D | Duplicate selected |
| Ctrl+G | Group selected |
| Ctrl+Shift+G | Ungroup |
| Ctrl+Shift+L | Lock/unlock element |
| Shift+H | Flip horizontal |
| Shift+V | Flip vertical |
| Ctrl+C | Copy |
| Ctrl+X | Cut |
| Ctrl+V | Paste |
| Ctrl+Shift+V | Paste as plaintext |
| Enter | Edit text / add label to shape |
| Ctrl+Enter | Edit line/arrow points |

#### Layer Ordering
| Shortcut | Action |
|----------|--------|
| Ctrl+] | Bring forward one layer |
| Ctrl+[ | Send backward one layer |
| Ctrl+Shift+] | Bring to front |
| Ctrl+Shift+[ | Send to back |

#### Alignment (multi-select required)
| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+ArrowUp | Align top |
| Ctrl+Shift+ArrowDown | Align bottom |
| Ctrl+Shift+ArrowLeft | Align left |
| Ctrl+Shift+ArrowRight | Align right |

#### Zoom & View
| Shortcut | Action |
|----------|--------|
| Ctrl++ | Zoom in |
| Ctrl+- | Zoom out |
| Ctrl+0 | Reset zoom |
| Shift+1 | Zoom to fit all elements |
| Shift+2 | Zoom to selection |
| Alt+Z | Zen mode (hide UI) |
| Alt+R | View mode (read-only) |
| Ctrl+' | Show grid |

#### Styling Shortcuts
| Shortcut | Action |
|----------|--------|
| S | Show stroke color picker |
| G | Show background color picker |
| Ctrl+Alt+C | Copy styles |
| Ctrl+Alt+V | Paste styles |
| Ctrl+Shift+< | Decrease font size |
| Ctrl+Shift+> | Increase font size |

#### Clipboard/Export
| Shortcut | Action |
|----------|--------|
| Shift+Alt+C | Copy as PNG to clipboard |
| Ctrl+/ | Open command palette |
| Shift+/ (?) | Show keyboard shortcuts |

### 3. Toolbar and Menu DOM Structure

**Main menu (hamburger):**
- Trigger: top-left hamburger icon button
- Key menu items with data-testid:
  - `data-testid="load-button"` -- Load scene
  - `data-testid="save-button"` -- Save to active file
  - `data-testid="image-export-button"` -- Save as image (export dialog)
  - `data-testid="json-export-button"` -- Export to JSON
  - `data-testid="clear-canvas-button"` -- Clear canvas
  - `data-testid="toggle-dark-mode"` -- Toggle theme
  - `data-testid="command-palette-button"` -- Command palette
  - `data-testid="help-menu-item"` -- Help/shortcuts
  - `data-testid="search-menu-button"` -- Search

**Toolbar (shape tools):**
- Container: `.App-toolbar`, `.Island`
- Tool buttons use: `[data-testid="toolbar-{toolname}"]`
  - `toolbar-selection`, `toolbar-rectangle`, `toolbar-diamond`, `toolbar-ellipse`
  - `toolbar-arrow`, `toolbar-line`, `toolbar-text`, `toolbar-frame`, `toolbar-eraser`

**Properties panel (left side when shape selected):**
- Stroke color trigger: color swatch button for stroke
- Background color trigger: color swatch button for background
- Fill style: RadioSelection buttons (solid, hachure, cross-hatch)
- Stroke width: RadioSelection buttons (thin, bold, extra bold)
- Stroke style: RadioSelection buttons (solid, dashed, dotted)
- Roundness: RadioSelection buttons (sharp, round)
- Arrow type: RadioSelection (sharp, round, elbow)
- Font family: FontPicker dropdown (Virgil/hand-drawn, Helvetica, Cascadia/code, Nunito, Excalifont)
- Font size: RadioSelection (S, M, L, XL)
- Text alignment: RadioSelection (left, center, right)
- Opacity: Range slider
- Arrowheads: RadioSelection for start/end (none, arrow, bar, dot, triangle)

**Color picker popup:**
- Opens when clicking stroke/background color swatch
- Contains color grid (palette) and top picks row
- Also supports hex input via `ColorInput` component
- CSS class on trigger: various including `is-transparent`, `has-outline`

**Alignment buttons (appear with 2+ elements selected):**
- `[aria-label="Align left"]`, `[aria-label="Align right"]`
- `[aria-label="Align top"]`, `[aria-label="Align bottom"]`
- `[aria-label="Center horizontally"]`, `[aria-label="Center vertically"]`
- `[aria-label="Distribute horizontally"]`, `[aria-label="Distribute vertically"]`

**Confidence:** MEDIUM -- data-testid values verified from source DefaultItems.tsx; property panel structure from DeepWiki analysis of Actions.tsx. Exact CSS classes may vary by version.

### 4. Export Mechanisms

**Method 1: Copy as PNG keyboard shortcut (FASTEST)**
- `Shift+Alt+C` copies current selection (or entire canvas if nothing selected) as PNG to clipboard
- No dialog, instant clipboard copy
- Best for automation: single keyboard shortcut, no DOM interaction needed

**Method 2: Menu-based export dialog**
1. Click hamburger menu (top-left)
2. Click "Save as image" (`data-testid="image-export-button"`)
3. Export dialog opens with format options (PNG, SVG)
4. Select format, toggle background, set scale
5. Click export/download button

**Method 3: Command palette**
- `Ctrl+/` opens command palette
- Type "export" to filter export commands
- Select desired export action

**Method 4: Right-click context menu**
- Right-click on selected elements
- "Copy to clipboard as PNG" or "Copy to clipboard as SVG"

**Recommendation for automation:** Use `Shift+Alt+C` (copy as PNG) as the primary export method. It requires zero DOM interaction and works instantly. For SVG export, use the menu-based flow since there's no direct SVG keyboard shortcut.

**Confidence:** MEDIUM -- Shift+Alt+C confirmed from keyboard shortcut documentation; menu data-testid from source. Export dialog internal selectors not fully mapped.

### 5. Connectors and Arrows

**Creating a connected arrow between two shapes:**
1. Press `A` to activate arrow tool
2. Move cursor near the edge of source shape -- Excalidraw shows a faint outline when binding is available
3. Click and drag from source shape edge toward target shape
4. When cursor is near target shape edge, Excalidraw shows binding indicator
5. Release mouse on target shape -- arrow is now bound to both shapes
6. Shapes can be moved and arrow auto-routes to follow

**CDP automation pattern:**
1. `press_key a` -- activate arrow tool
2. `cdpDrag sourceEdgeX sourceEdgeY targetEdgeX targetEdgeY steps=20 stepDelayMs=20`
   - Start coordinates should be on the edge/border of the source shape
   - End coordinates should be on the edge/border of the target shape
   - Use more steps (20+) and slower delay for reliable binding detection

**Arrow types (selectable after drawing):**
- Sharp (default): straight segments with sharp corners
- Round: curved path
- Elbow: orthogonal 90-degree routing (auto-routes around obstacles)

**Endpoint styles (arrowheads):**
- Start arrowhead: none, arrow, bar, dot, triangle
- End arrowhead: none, arrow, bar, dot, triangle
- Accessible via properties panel RadioSelection buttons when arrow is selected

**Multi-point arrows (curved/segmented):**
- Click-click-click pattern: `A` then click multiple points, double-click or Escape to finish
- For CDP: use multiple `cdpClickAt` calls for each vertex, then `press_key Escape` to finish

**Prevent binding (draw arrow without connecting):**
- Hold Ctrl/Cmd while drawing to prevent auto-binding to shapes

**Labeled arrows:**
- Select arrow, press Enter to add text label
- Label appears at midpoint of arrow
- Edit label: double-click arrow or select + Enter

**Confidence:** HIGH -- binding behavior confirmed from Excalidraw team's official communications and source PRs

### 6. Verification and Drawing State

**Problem:** Excalidraw renders on `<canvas>` -- individual shapes are NOT DOM elements. You cannot query "how many rectangles are on the canvas" via DOM selectors.

**What IS observable via DOM:**

| What to Check | Selector / Method | What It Tells You |
|---------------|-------------------|-------------------|
| Text editor is active | `textarea.excalidraw-wysiwyg` exists in DOM | Text input mode is active |
| WYSIWYG editor content | `textarea.excalidraw-wysiwyg` value | Current text being edited |
| Toolbar active tool | `[data-testid="toolbar-*"].selected` or `[aria-checked="true"]` | Which tool is currently active |
| Properties panel visible | `.layer-ui__wrapper` children for property fieldsets | Shape is selected (panel appears) |
| Alignment buttons visible | `[aria-label="Align left"]` exists | 2+ elements are selected |
| Menu open | `[data-testid="image-export-button"]` visible | Hamburger menu is expanded |
| Dialog open | `[class*="Modal"]`, `[class*="Dialog"]` | Export/settings dialog is showing |
| Color picker open | Color picker popup content in DOM | Color selection is active |
| Canvas element | `canvas.interactive` | Canvas is loaded and ready |
| Layer UI wrapper | `.layer-ui__wrapper` | Excalidraw UI has fully rendered |

**What is NOT observable via DOM:**
- Number of shapes on canvas
- Shape positions, sizes, colors
- Whether shapes are connected by arrows
- Whether alignment was applied correctly

**Verification strategies for non-DOM state:**
1. **Action count heuristic:** Track how many draw operations were issued -- if 3 rectangles were drawn with 3 cdpDrag calls, assume 3 exist
2. **Undo stack:** If undo (Ctrl+Z) removes the last shape, the draw succeeded
3. **Export verification:** Copy as PNG (Shift+Alt+C) and check clipboard has content
4. **Stats for nerds:** `Alt+/` opens element statistics panel showing element count -- this IS a DOM element that can be read

**Confidence:** HIGH for DOM-observable items; MEDIUM for verification strategies (need live testing)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Text entry | cdpInsertText on auto-focused textarea | DOM-based type on textarea selector | cdpInsertText is simpler and doesn't need selector; textarea is ephemeral |
| Tool selection | press_key shortcuts (R, D, O, etc.) | DOM click on toolbar buttons | Keyboard shortcuts are faster, more reliable, version-stable |
| Color selection | Keyboard S/G to open picker + DOM click on swatch | cdpClickAt on color swatch coordinates | DOM click on swatches is more reliable than coordinate guessing |
| Export | Shift+Alt+C (copy as PNG) | Menu navigation to export dialog | Single shortcut vs multi-step menu flow |
| Alignment | Keyboard shortcuts (Ctrl+Shift+Arrow) | DOM click on alignment buttons | Shortcuts work without needing to find alignment button selectors |
| Arrow creation | cdpDrag from shape edge to shape edge | Multi-click pattern | Drag is simpler for straight connectors |

---

## Anti-Stack (What NOT to Add)

| Temptation | Why Not |
|------------|---------|
| Screenshot-based visual verification | Adds complexity, slow, and FSB has no screenshot analysis pipeline |
| Excalidraw API injection (window.excalidrawAPI) | Content scripts run in isolated world, cannot access page JS objects |
| MCP Excalidraw server (npm package exists) | Separate concern -- FSB automates the browser, not the API |
| rrweb or canvas capture | Overkill for verification; DOM-based checks plus action counting suffices |
| New CDP tools | All needed CDP tools already exist (click_at, drag, insertText, press_key) |
| Build system / TypeScript | Project constraint: vanilla JS, no transpilation |

---

## Installation

```bash
# No installation needed -- zero new dependencies
# All capabilities exist in current FSB codebase
```

---

## Sources

- [Excalidraw source: textWysiwyg.tsx](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx) -- HIGH confidence
- [Excalidraw source: DefaultItems.tsx](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/main-menu/DefaultItems.tsx) -- HIGH confidence
- [Excalidraw keyboard shortcuts (csswolf.com)](https://csswolf.com/excalidraw-keyboard-shortcuts-pdf/) -- MEDIUM confidence (third-party compilation)
- [DeepWiki: Excalidraw export system](https://deepwiki.com/excalidraw/excalidraw/6.6-export-system) -- MEDIUM confidence
- [DeepWiki: Properties and color picker](https://deepwiki.com/zsviczian/excalidraw/4.6-properties-and-color-picker) -- MEDIUM confidence
- [DeepWiki: Actions and toolbars](https://deepwiki.com/excalidraw/excalidraw/4.1-actions-and-toolbars) -- MEDIUM confidence
- [Excalidraw MainMenu docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/children-components/main-menu) -- HIGH confidence
- [Excalidraw arrow binding behavior](https://x.com/excalidraw/status/1786055557645824177) -- HIGH confidence (official team)
- [1337skills Excalidraw cheatsheet](https://1337skills.com/cheatsheets/excalidraw/) -- MEDIUM confidence
- [HackMD Excalidraw guide](https://hackmd.io/@alkemio/SJuewkPwn) -- MEDIUM confidence
- [CDP Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/) -- HIGH confidence (official Chrome docs)
