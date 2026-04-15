/**
 * Site Guide: Color Picker
 * Per-site guide for online color picker tools (colorpicker.me, htmlcolorcodes.com).
 *
 * Color pickers have two coordinate-based controls:
 * 1. Hue strip (1D slider): vertical or horizontal rainbow bar selecting the base hue (0-360 degrees)
 * 2. Shade area (2D reticle): square gradient controlling saturation (X) and brightness/value (Y)
 *
 * Both require CDP coordinate-based interaction (drag or click_at) since they are
 * typically canvas elements or absolutely-positioned divs, not standard form inputs.
 *
 * The resulting hex value appears in a text input that can be read via get_attribute or getText.
 *
 * Created for Phase 61, MICRO-05 edge case validation.
 * Target: drag hue slider and shade reticle to select a custom hex color.
 */

registerSiteGuide({
  site: 'Color Picker',
  category: 'Utilities',
  patterns: [
    /colorpicker\.me/i,
    /htmlcolorcodes\.com/i,
    /w3schools\.com\/colors/i,
    /color-hex\.com/i,
    /coolors\.co/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic MICRO-05):
- [micro] Hue direction varies by site: colorpicker.me maps 360 at TOP, 0 at BOTTOM (inverted)
- [micro] click_at is sufficient -- no drag needed; mousedown handler updates color on single click
- [micro] Shade area: S increases left-to-right, V DECREASES top-to-bottom (y = (1-V)*height)
- [micro] Direct hex input (#enter-color + Enter) is reliable fallback bypassing coord calculation
- [micro] Verify hex via RGB channel tolerance (+/-15 per channel) not exact string match

COLOR PICKER INTERACTION INTELLIGENCE:

COLOR PICKER ANATOMY:
- Two primary controls: HUE STRIP (1D) and SHADE AREA (2D)
- Hue strip: narrow bar showing rainbow spectrum (red->yellow->green->cyan->blue->magenta->red)
  - On colorpicker.me: vertical bar on the right side of the shade area
  - Dragging along it selects base hue (0-360 degrees)
  - Red=top (0 deg), Green=middle-top (~120 deg), Blue=middle-bottom (~240 deg)
- Shade area: large square gradient
  - X axis: saturation (left=gray/desaturated, right=fully saturated pure color)
  - Y axis: brightness/value (top=white/bright, bottom=black/dark)
  - The reticle (small circle/crosshair) shows current position
- Hex input: text field showing the current hex value (e.g., #FF0000)

COORDINATE CALCULATION FOR HUE STRIP:
1. Use get_dom_snapshot to find the hue strip element (look for narrow vertical/horizontal bar with rainbow gradient)
2. Get bounding rect: use read_page or get_dom_snapshot to find element position
3. For VERTICAL hue strip (colorpicker.me):
   - X coordinate: center of the strip (left + width/2)
   - Y coordinate: calculate from target hue degree
   - Formula: y = top + (hueDegrees / 360) * height
   - Red=0deg (top), Yellow=60deg, Green=120deg, Cyan=180deg, Blue=240deg, Magenta=300deg
4. For HORIZONTAL hue strip:
   - Y coordinate: center of the strip (top + height/2)
   - X coordinate: x = left + (hueDegrees / 360) * width

COORDINATE CALCULATION FOR SHADE AREA:
1. Use get_dom_snapshot to find the shade/saturation area element (large square with gradient)
2. Get bounding rect for the shade area
3. Calculate target position from HSV saturation and value:
   - X coordinate: x = left + (saturation / 100) * width (0% left, 100% right)
   - Y coordinate: y = top + ((100 - value) / 100) * height (100% value at top, 0% at bottom)
4. IMPORTANT: saturation increases left-to-right, brightness/value DECREASES top-to-bottom

INTERACTION SEQUENCE:
1. FIRST set hue (drag or click_at on hue strip) -- this changes the base color of the shade area
2. THEN set shade (drag or click_at on shade area) -- this selects the specific shade within that hue
3. Order matters: changing hue after shade will alter the final color

PREFERRED TOOL: click_at
- For both hue strip and shade area, click_at at the calculated coordinates is simpler than drag
- click_at produces a mousedown+mouseup at the target position, which most color pickers respond to
- Use drag only if click_at does not update the color (some pickers require drag events on the reticle)

FALLBACK: drag tool
- If click_at does not move the reticle/slider, use drag:
  - For hue strip: drag from current reticle position to target position along the strip
  - For shade area: drag from current reticle position to target position in the gradient
  - Use steps=15, stepDelayMs=20 for smooth movement

HEX VALUE READING:
- After setting hue and shade, read the hex value from the input field
- colorpicker.me: look for input with hex value (usually input[type="text"] near the color display)
- Use get_attribute(selector, "value") on the hex input to read the current value
- Or use getText on the hex display element
- Compare with target hex to verify accuracy (exact match or within tolerance)

HEX COLOR TOLERANCE:
- Exact hex match is difficult with coordinate-based interaction
- Accept if each RGB channel is within +/-15 of target (e.g., target #2196F3, accept #1E90E8 to #25A0FF)
- This accounts for sub-pixel positioning differences in the shade area

COMMON SELECTORS (colorpicker.me):
- Shade area: the large colored square (often a canvas or div with background gradient)
- Hue strip: the narrow rainbow bar (often canvas or div with linear-gradient)
- Hex input: input field showing hex value
- Use get_dom_snapshot to discover actual element references since these vary by site

STUCK RECOVERY:
- If color picker does not respond to click_at: try drag instead (some implementations only listen to drag)
- If hex input is not found: look for elements with text matching /#[0-9A-Fa-f]{6}/ pattern
- If shade area coordinates seem wrong: verify element bounding rect with a diagnostic click_at at known corner
- If hue strip is horizontal instead of vertical: swap X/Y calculation formulas
- Alternative approach: type the hex value directly into the hex input field using click(selector) then type_text(hex_value)`,
  selectors: {
    shadeArea: 'canvas, .saturation-value, .color-picker-panel, [class*="saturation"], [class*="shade"], [class*="picker-area"]',
    hueStrip: '.hue, [class*="hue"], .color-strip, canvas + canvas, [class*="spectrum"]',
    hexInput: 'input[type="text"], input[name*="hex"], input[class*="hex"], [class*="hex-input"]',
    colorPreview: '.color-preview, .current-color, [class*="preview"], [class*="swatch"]',
    reticle: '.reticle, .picker-cursor, .pointer, [class*="cursor"], [class*="reticle"]'
  },
  workflows: {
    selectCustomHex: [
      'Navigate to the color picker page (colorpicker.me or htmlcolorcodes.com) using navigate tool',
      'Use read_page to verify the page loaded. Dismiss any cookie/consent banners via click if present.',
      'Use get_dom_snapshot to map the page elements. Identify: (a) the shade/saturation area (large colored square), (b) the hue strip (narrow rainbow bar), (c) the hex value input field. Record their element references.',
      'IDENTIFY ELEMENT BOUNDS: For the hue strip and shade area, determine their bounding rectangles. Look for position, width, height in the DOM snapshot. If not available, estimate from viewport layout (hue strip is typically 20-30px wide, shade area is 200-300px square).',
      'SET HUE: Calculate the Y coordinate for the target hue on the vertical hue strip. Formula: y = stripTop + (hueDegrees / 360) * stripHeight. For blue (#2196F3, hue ~207 degrees): y = stripTop + 0.575 * stripHeight. X = center of strip. Use click_at(x, y) on the hue strip.',
      'VERIFY HUE: After clicking the hue strip, use get_dom_snapshot or read_page to verify the shade area changed to show the target hue gradient (blue tones if targeting blue).',
      'SET SHADE: Calculate coordinates in the shade area for target saturation and brightness. For #2196F3 (S~82%, V~95%): x = areaLeft + 0.82 * areaWidth, y = areaTop + 0.05 * areaHeight (95% brightness = 5% from top). Use click_at(x, y) on the shade area.',
      'READ HEX: Read the hex value from the input field. Use get_attribute on the hex input element to read its value attribute. Compare with target hex #2196F3.',
      'VERIFY: Check if the hex value is within tolerance (each RGB channel within +/-15 of target). If not, fine-tune by adjusting hue strip or shade area position with small offset corrections.',
      'STUCK RECOVERY: If click_at does not update the color, try drag from the current reticle position to the target position. If hex input cannot be found, search for text matching /#[0-9A-Fa-f]{6}/ on the page. If the site layout is different from expected, use get_dom_snapshot to re-examine element structure. As a last resort, click the hex input field and type the hex value directly.'
    ]
  },
  toolPreferences: ['navigate', 'read_page', 'get_dom_snapshot', 'click_at', 'drag', 'click', 'type_text', 'scroll', 'waitForElement']
});
