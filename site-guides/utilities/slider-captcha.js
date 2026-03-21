/**
 * Site Guide: Slider CAPTCHA (Slide-to-Fit Puzzle)
 * Per-site guide for slide-to-fit puzzle CAPTCHAs where the user drags a
 * puzzle piece or slider thumb to match a target position.
 *
 * Slider CAPTCHAs are anti-bot verification controls that require dragging
 * a puzzle piece into a gap at variable speed to mimic human behavior.
 * Common implementations:
 * 1. GEETEST -- puzzle piece overlay on background image
 * 2. Tencent Captcha -- slider bar with puzzle piece
 * 3. Custom slider CAPTCHAs -- various implementations on demo/test sites
 *
 * The primary challenge is that anti-bot CAPTCHAs detect uniform-speed drag
 * as bot behavior. The drag_variable_speed MCP tool uses an ease-in-out
 * timing curve (slow start, fast middle, slow end) to mimic human drag.
 *
 * Two interaction approaches:
 * A. drag_variable_speed tool (preferred) -- CDP trusted events with ease-in-out
 *    timing curve for human-like movement
 * B. Regular drag tool (fallback) -- CDP trusted events with uniform speed,
 *    may be flagged by sophisticated CAPTCHAs but works for basic sliders
 *
 * Created for Phase 65, MICRO-09 edge case validation.
 * Target: solve slide-to-fit puzzle CAPTCHA by dragging piece at variable speed.
 */

registerSiteGuide({
  site: 'Slider CAPTCHA',
  category: 'Utilities',
  patterns: [
    /geetest\.com/i,
    /slider.*captcha/i,
    /captcha.*slider/i,
    /slide.*verify/i,
    /puzzle.*captcha/i,
    /captcha.*puzzle/i,
    /2captcha\.com/i,
    /slider-captcha/i,
    /slide-to-fit/i
  ],
  guidance: `SLIDER CAPTCHA (SLIDE-TO-FIT PUZZLE) INTELLIGENCE:

CAPTCHA ANATOMY:
- A slide-to-fit CAPTCHA presents a background image with a puzzle-piece-shaped gap.
- A draggable puzzle piece (or slider thumb) sits at the left edge of a slider track.
- The user must drag the piece horizontally until it fits into the gap.
- The CAPTCHA verifies both the final position AND the drag speed profile.
- Anti-bot detection flags:
  1. Constant-speed drag (robotic movement)
  2. Pixel-perfect positioning (too accurate)
  3. Instant jump to target (no drag motion)
  4. No mouse acceleration/deceleration curve

SLIDER CAPTCHA DOM STRUCTURE (common patterns):
- Slider track: container element holding the slider bar
  Classes: .slider-track, .captcha-slider, .slide-bar, .gt_slider,
  .tc-slider, .verify-bar, [class*="slider"], [class*="slide"]
- Slider thumb (drag handle): the element the user grabs and drags
  Classes: .slider-thumb, .slider-btn, .slider-handle, .gt_slider_knob,
  .tc-slider-btn, .drag-btn, [class*="thumb"], [class*="knob"],
  [class*="handle"], [class*="drag"]
  Often has cursor:pointer or cursor:grab styling
- Puzzle piece: the visual piece that moves with the slider
  Classes: .puzzle-piece, .captcha-piece, .gt_slice, .jigsaw-piece,
  [class*="puzzle"], [class*="piece"], [class*="slice"]
- Background image: the image with the gap
  Classes: .captcha-bg, .gt_bg, .captcha-image, [class*="captcha-bg"]
- Gap/target: the target position where the piece must fit
  Classes: .captcha-gap, .gt_cut, [class*="gap"], [class*="cut"],
  [class*="target"]
- Success indicator: shown when puzzle is solved
  Classes: .captcha-success, .gt_success, [class*="success"],
  text content like "Verification successful"
- Failure indicator: shown when puzzle placement is wrong
  Classes: .captcha-fail, .gt_fail, [class*="fail"], [class*="error"],
  text content like "Try again"

INTERACTION STRATEGY A -- DRAG_VARIABLE_SPEED (PREFERRED):
The drag_variable_speed MCP tool uses CDP trusted mouse events with an
ease-in-out timing curve for human-like drag movement. Steps:
1. Use get_dom_snapshot to identify the slider CAPTCHA elements.
   Look for: a slider track element, a slider thumb/handle inside the track,
   a background image with a gap, a puzzle piece element.
2. Determine the slider thumb position using get_bounding_rect or by reading
   the element position from the DOM snapshot. Record the center coordinates
   of the slider thumb (startX, startY).
3. Estimate the target X position. Methods:
   a. If the gap position is visible in the DOM (some CAPTCHAs expose it):
      read the gap element's left offset.
   b. If not visible: estimate as roughly 40-70% of the track width.
      Formula: targetX = trackLeft + trackWidth * 0.55 (start with center estimate).
   c. For demo pages: the target may be at a fixed position or random each load.
4. Use drag_variable_speed to drag from thumb to target:
   drag_variable_speed(startX=thumbCenterX, startY=thumbCenterY,
   endX=targetX, endY=thumbCenterY, steps=25, minDelayMs=5, maxDelayMs=45)
   - steps=25 gives smooth curve
   - minDelayMs=5 for fast center movement
   - maxDelayMs=45 for slow start/end (human-like)
   - endY = startY (horizontal slider, same Y)
5. VERIFY: Use get_dom_snapshot to check for success or failure indicators:
   - Success: .captcha-success, "success", "verified", "passed", green check
   - Failure: .captcha-fail, "try again", "failed", red X
   - If failed: the puzzle piece often resets to start. Retry with adjusted target.
6. If first attempt fails, try adjusting target position +/-20px and retry.

INTERACTION STRATEGY B -- REGULAR DRAG (FALLBACK):
If drag_variable_speed is unavailable, use the regular drag tool:
drag(startX=thumbCenterX, startY=thumbCenterY,
endX=targetX, endY=thumbCenterY, steps=30, stepDelayMs=15)
- Use more steps (30) with lower delay (15ms) to approximate variable speed
- This produces uniform speed and may be detected by sophisticated CAPTCHAs
- Works for basic/demo slider CAPTCHAs that only check position, not speed

GEETEST SPECIFIC PATTERNS:
- Container: .geetest_panel, .geetest_panel_box
- Slider track: .geetest_slider, .gt_slider
- Slider thumb: .geetest_slider_button, .gt_slider_knob
- Puzzle piece: .geetest_slice, .gt_slice, .geetest_canvas_slice
- Background: .geetest_canvas_bg, .gt_bg
- Gap (cut): .geetest_canvas_fullbg (shows gap position via CSS)
- Success: .geetest_panel_success, text "success"
- Refresh: .geetest_refresh (button to get new puzzle)
- GEETEST uses canvas rendering -- the puzzle piece position may not be
  in DOM but rendered on a canvas element

TENCENT CAPTCHA PATTERNS:
- Container: .tc-captcha-popup, #tc-captcha
- Slider: .tc-slider, .tc-slider-normal
- Thumb: .tc-slider-btn
- Background: .tc-bg-img
- Piece: .tc-jigsaw

GENERIC SLIDER CAPTCHA INDICATORS:
- Elements with "captcha" AND "slider" in class/id
- Elements with "slide" AND "verify" in class/id
- Canvas elements paired with slider controls
- Images with puzzle-piece cutout styling
- Slider tracks with drag handles that have cursor:grab/pointer

VERIFICATION AFTER DRAG:
- Check for success text: "Verification successful", "Verified", "Pass"
- Check for success visual: green checkmark, success icon, slider turns green
- Check for failure text: "Try again", "Failed", "Error"
- Check for position reset: slider thumb returns to start position
- Check the CAPTCHA container for class changes (added success/fail class)
- Some CAPTCHAs redirect or remove the CAPTCHA overlay on success

TARGET POSITION ESTIMATION:
- Without vision, the gap position in the puzzle image is not directly accessible
  from the DOM (it is rendered on a canvas or as a background image)
- Estimation strategies:
  1. Fixed percentage: try 50% of track width, then adjust +/-10%
  2. DOM clues: some implementations expose the gap position in a data attribute
     or CSS transform on the puzzle piece element
  3. Trial and error: drag to estimated position, check result, adjust
- For demo/test pages: the target position is often more lenient (wider acceptance)
- For production CAPTCHAs: pixel-level accuracy is often required (within 5-10px)

STUCK RECOVERY:
- If the slider does not move: the thumb element may require a mousedown event
  before drag begins. Try click_at on the thumb first, then drag_variable_speed.
- If the CAPTCHA refreshes on every attempt: the site may be rate-limiting.
  Wait a few seconds between attempts.
- If no slider thumb found: look for iframe wrapping the CAPTCHA. The slider
  may be inside an iframe from a third-party CAPTCHA provider.
- If the puzzle piece snaps back: the position was wrong. Adjust target.
- If the CAPTCHA shows "human verification required": the CAPTCHA provider
  detected automation. This is expected for production CAPTCHAs.`,
  selectors: {
    // Generic slider CAPTCHA selectors
    sliderTrack: '[class*="slider" i][class*="track" i], [class*="slide" i][class*="bar" i], [class*="captcha" i][class*="slider" i], [class*="verify" i][class*="bar" i]',
    sliderThumb: '[class*="slider" i][class*="thumb" i], [class*="slider" i][class*="btn" i], [class*="slider" i][class*="handle" i], [class*="slider" i][class*="knob" i], [class*="drag" i][class*="btn" i]',
    puzzlePiece: '[class*="puzzle" i][class*="piece" i], [class*="captcha" i][class*="piece" i], [class*="jigsaw" i], [class*="slice" i]',
    captchaBg: '[class*="captcha" i][class*="bg" i], [class*="captcha" i][class*="image" i]',
    captchaGap: '[class*="captcha" i][class*="gap" i], [class*="captcha" i][class*="cut" i], [class*="captcha" i][class*="target" i]',
    successIndicator: '[class*="captcha" i][class*="success" i], [class*="verify" i][class*="success" i], [class*="slider" i][class*="success" i]',
    failIndicator: '[class*="captcha" i][class*="fail" i], [class*="captcha" i][class*="error" i], [class*="slider" i][class*="fail" i]',
    // GEETEST specific
    gtContainer: '.geetest_panel, .geetest_panel_box, [class*="geetest"]',
    gtSlider: '.geetest_slider, .gt_slider',
    gtThumb: '.geetest_slider_button, .gt_slider_knob',
    gtPiece: '.geetest_slice, .gt_slice, .geetest_canvas_slice',
    gtBg: '.geetest_canvas_bg, .gt_bg',
    gtSuccess: '.geetest_panel_success',
    gtRefresh: '.geetest_refresh',
    // Tencent specific
    tcContainer: '.tc-captcha-popup, #tc-captcha',
    tcSlider: '.tc-slider, .tc-slider-normal',
    tcThumb: '.tc-slider-btn',
    tcBg: '.tc-bg-img',
    tcPiece: '.tc-jigsaw'
  },
  workflows: {
    solveSliderCaptcha: [
      'Navigate to a site with a slider CAPTCHA demo. Primary targets: any GEETEST demo page, custom slider CAPTCHA demos (search "slider captcha demo"), or 2captcha.com demo page. Dismiss any cookie/consent popups.',
      'Use get_dom_snapshot to map the page elements. Identify: (1) The slider track element -- a horizontal bar the thumb slides along, (2) The slider thumb/handle -- the draggable element at the left edge, (3) The puzzle background image (if visible), (4) The gap/target position (if exposed in DOM). Record CSS selectors for the thumb and track.',
      'Determine the slider thumb center coordinates. Use the DOM snapshot position data or bounding rect. Record startX = thumb center X, startY = thumb center Y.',
      'Estimate the target X position. If the gap position is visible in DOM attributes or CSS, use that. Otherwise, estimate targetX = trackLeft + trackWidth * 0.55 (55% across the track). Record endX = targetX, endY = startY (horizontal drag, same Y coordinate).',
      'STRATEGY A -- VARIABLE SPEED DRAG: Use drag_variable_speed to drag from thumb to estimated target: drag_variable_speed(startX, startY, endX, endY, steps=25, minDelayMs=5, maxDelayMs=45). The tool applies ease-in-out timing: slow start (45ms delay), fast middle (5ms delay), slow end (45ms delay).',
      'VERIFY: Use get_dom_snapshot to check for success or failure indicators. Look for: success classes, "verified"/"success"/"pass" text, green checkmark, slider color change to green. Also check for failure: "try again"/"failed" text, slider reset to start, red indicators.',
      'If FAILED (slider reset or failure indicator): Adjust target position. Try targetX +/- 20px from the original estimate. Retry drag_variable_speed with the adjusted position. Maximum 3 attempts before reporting failure.',
      'If STRATEGY A is unavailable, use STRATEGY B -- REGULAR DRAG: drag(startX, startY, endX, endY, steps=30, stepDelayMs=15). This uses uniform speed which may be detected by sophisticated CAPTCHAs but works for demo/basic implementations.',
      'REPORT: Document which strategy was used (A or B), the thumb and target coordinates, whether the CAPTCHA was solved (success/fail/partial), and any observations about the speed detection behavior.'
    ]
  },
  toolPreferences: ['navigate', 'read_page', 'get_dom_snapshot', 'drag_variable_speed', 'drag', 'click_at', 'wait_for_element', 'wait_for_stable']
});
