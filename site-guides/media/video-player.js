/**
 * Site Guide: HTML5 Video Player Volume Slider
 * Per-site guide for HTML5 video players with custom volume slider controls.
 *
 * HTML5 video players use custom slider controls (divs, spans, or input[type=range])
 * instead of native browser controls. Two interaction approaches for setting volume:
 *
 * 1. CLICK ON TRACK (preferred): Use click_at on the slider track at the calculated
 *    percentage position. Most custom players listen for click events on the track and
 *    set volume to the click position. This is a single action and most reliable for
 *    setting an exact value.
 *
 * 2. DRAG THUMB (fallback): Drag the slider thumb from its current position to the
 *    target position using the drag tool. Some players only respond to drag events on
 *    the thumb, not click on track. Use 10 intermediate steps with 20ms delay for
 *    smooth slider movement.
 *
 * Primary targets: Vimeo, Dailymotion, JW Player demo pages. These are free, no-auth,
 * publicly accessible video platforms with custom volume sliders.
 *
 * Created for Phase 57, MICRO-01 edge case validation.
 * Volume slider precision target: 37% (0.37 on 0-1 scale, 37 on 0-100 scale).
 */

registerSiteGuide({
  site: 'HTML5 Video Player',
  category: 'Media',
  patterns: [
    /vimeo\.com/i,
    /dailymotion\.com/i,
    /jwplayer\.com\/developers\/tools\/player-demos/i,
    /plyr\.io/i,
    /videojs\.com/i
  ],
  guidance: `HTML5 VIDEO PLAYER VOLUME SLIDER INTELLIGENCE:

VOLUME SLIDER ANATOMY:
- Custom HTML5 video players render volume as a horizontal or vertical slider track
  with a draggable thumb (handle/knob).
- The track is typically a div/span with a progress fill child showing current volume.
- The thumb sits at the current volume position on the track.
- Key attributes that reflect volume state:
  * aria-valuenow: current volume value (0-100 or 0-1 depending on player)
  * aria-valuemin: minimum value (always 0)
  * aria-valuemax: maximum value (100 or 1 depending on player)
  * data-value or value: raw volume value
  * style width percentage: fill element width reflects volume (e.g., "width: 37%")

SLIDER SELECTORS BY PLATFORM:
- Vimeo: .vp-volume-control, .vp-slider, [aria-label*="Volume"],
  input[type="range"][aria-label*="Volume"]. Vimeo uses an input[type="range"] for
  volume -- can set value directly via DOM if available, or click_at on the track.
- Dailymotion: .dmp_VolumeSlider, [aria-label*="volume" i],
  .dmp_ControlBar [class*="volume"]. Dailymotion uses a custom div-based slider.
- JW Player: .jw-slider-volume, .jw-slider-container, .jw-rail, .jw-knob,
  [aria-label*="Volume"]. JW Player uses a custom div slider with jw-slider-volume
  container, jw-rail track, and jw-knob thumb.
- Plyr: .plyr__volume input[type="range"], [data-plyr="volume"], .plyr__slider.
  Plyr uses an input[type="range"] for volume.
- Video.js: .vjs-volume-bar, .vjs-volume-level, .vjs-slider,
  [role="slider"][aria-label*="Volume"]. Video.js uses role="slider" with aria-valuenow.
- Generic fallback: input[type="range"][aria-label*="volume" i],
  [role="slider"][aria-label*="volume" i], [class*="volume"][class*="slider"],
  [class*="volume-bar"], [class*="volume-control"]

PERCENTAGE CALCULATION FORMULA:
- For a horizontal slider track at 37%:
  1. Get track bounding rect via get_dom_snapshot or read_page
  2. targetX = track_left + (0.37 * track_width)
  3. targetY = track_top + (track_height / 2)
- For vertical sliders (some players):
  1. targetY = track_bottom - (0.37 * track_height)
  2. targetX = track_left + (track_width / 2)
- The 0.37 multiplier can be replaced with any target percentage as a decimal.

METHOD 1 -- CLICK ON TRACK (preferred for precision):
- Use click_at(targetX, targetY) directly on the slider track at the 37% position.
- Most custom players listen for click events on the track and set volume to the
  click position proportionally.
- This is a single action and most reliable for setting an exact value.
- Steps:
  1. Hover over player to reveal controls
  2. Get volume slider track bounding rect from get_dom_snapshot
  3. Calculate targetX = track_left + (0.37 * track_width)
  4. Calculate targetY = track_top + (track_height / 2)
  5. Execute click_at(targetX, targetY)
  6. Verify via get_attribute for aria-valuenow

METHOD 2 -- DRAG THUMB (fallback):
- First locate the thumb element position (current volume position on track).
- Use drag(thumbX, thumbY, targetX, targetY, steps=10, stepDelayMs=20) to slide
  the thumb to 37%.
- Some players only respond to drag events on the thumb, not click on track.
- Use 10 intermediate steps with 20ms delay for smooth slider movement.
- Steps:
  1. Hover over player to reveal controls
  2. Get volume thumb bounding rect from get_dom_snapshot
  3. Record thumbX = thumb center X, thumbY = thumb center Y
  4. Calculate targetX = track_left + (0.37 * track_width)
  5. Calculate targetY = track_top + (track_height / 2)
  6. Execute drag(thumbX, thumbY, targetX, targetY, 10, 20)
  7. Verify via get_attribute for aria-valuenow

VERIFICATION:
- After setting volume, verify the value using:
  * get_attribute on the slider element for aria-valuenow (should be approximately
    37 or 0.37 depending on the player's scale)
  * get_attribute for aria-valuetext (may show "37%")
  * Read the slider fill width via style attribute (should be approximately
    "37%" or "width: 37%")
  * Some players show volume tooltip text -- read_page may capture it
- Accept a range of 35-39% as success due to pixel granularity on narrow tracks.

VOLUME BUTTON AND MUTE WARNING:
- Most players have a speaker icon button next to the volume slider.
- Clicking it toggles mute (volume 0).
- Make sure to NOT click the mute button -- only interact with the slider track/thumb.
- Mute button selectors: [aria-label*="Mute"], [aria-label*="Volume"],
  button[class*="mute"], button[class*="volume"].

PLAYER ACTIVATION:
- Some players hide volume controls until the user hovers over the player or
  control bar. Use hover on the player container or control bar first.
- YouTube requires clicking in the player area first.
- Vimeo shows controls on hover.
- JW Player shows controls on mouse movement over the player.

COOKIE/CONSENT POPUPS:
- Dismiss cookie banners before interacting with the player.
- Common selectors: #onetrust-accept-btn-handler,
  [class*="cookie"] button[class*="accept"],
  [class*="consent"] button.`,

  selectors: {
    volumeSlider: '[role="slider"][aria-label*="Volume" i], input[type="range"][aria-label*="volume" i], .vp-slider, .jw-slider-volume, .vjs-volume-bar, [data-plyr="volume"], [class*="volume"][class*="slider"], [class*="volume-bar"]',
    volumeThumb: '.jw-knob, .vjs-volume-handle, [class*="volume"][class*="thumb"], [class*="volume"][class*="knob"], [class*="slider-thumb"]',
    volumeTrack: '.jw-rail, .vjs-volume-level, [class*="volume"][class*="track"], [class*="volume"][class*="rail"], [class*="slider-track"]',
    volumeFill: '.jw-progress, .vjs-volume-level, [class*="volume"][class*="fill"], [class*="volume"][class*="progress"], [class*="volume"][class*="level"]',
    muteButton: '[aria-label*="Mute" i], [aria-label*="Unmute" i], button[class*="mute"], button[class*="volume-button"], .jw-icon-volume, .vjs-mute-control',
    playerContainer: 'video, .video-player, .jw-wrapper, .vjs-tech, .plyr, [class*="player-container"]',
    controlBar: '.jw-controlbar, .vjs-control-bar, .plyr__controls, [class*="control-bar"], [class*="controls"]',
    cookieConsent: '#onetrust-accept-btn-handler, [class*="cookie"] button[class*="accept"], [class*="consent"] button, [id*="cookie"] button'
  },

  workflows: {
    adjustVolumeByClick: [
      'Navigate to a video page with a custom HTML5 player via navigate tool',
      'Hover over the player container or control bar to reveal volume controls',
      'Use get_dom_snapshot to locate the volume slider track element and its bounding rect',
      'Calculate target position: targetX = track_left + (0.37 * track_width), targetY = track_top + (track_height / 2)',
      'Execute click_at(targetX, targetY) on the slider track at the 37% position',
      'Verify volume changed via get_attribute on the slider for aria-valuenow (approximately 37 or 0.37)'
    ],
    adjustVolumeByDrag: [
      'Navigate to a video page with a custom HTML5 player via navigate tool',
      'Hover over the player container or control bar to reveal volume controls',
      'Use get_dom_snapshot to locate the volume thumb element and its current bounding rect position',
      'Calculate target position for 37% on track: targetX = track_left + (0.37 * track_width), targetY = track_top + (track_height / 2)',
      'Execute drag(thumbX, thumbY, targetX, targetY, 10, 20) to slide thumb to 37% position',
      'Verify volume changed via get_attribute on the slider for aria-valuenow (approximately 37 or 0.37)',
      'If verification fails, try the click_at method (adjustVolumeByClick workflow) as fallback'
    ],
    fullVolumeSliderTest: [
      'Navigate to target video page via navigate tool (e.g., Vimeo, Dailymotion, or JW Player demo)',
      'Dismiss any cookie/consent popup by clicking the accept button (e.g., #onetrust-accept-btn-handler)',
      'Hover over the player container to reveal the control bar and volume controls',
      'Use get_dom_snapshot to identify the volume slider element and its bounding rect dimensions',
      'Read current volume via get_attribute on the slider element (aria-valuenow or value attribute)',
      'Calculate pixel position for 37% along slider track: targetX = track_left + (0.37 * track_width), targetY = track_top + (track_height / 2)',
      'Attempt click_at(targetX, targetY) on the slider track at the 37% position',
      'Verify volume changed via get_attribute for aria-valuenow (should be approximately 37 or 0.37)',
      'If click did not change volume, attempt drag method: locate thumb position, drag(thumbX, thumbY, targetX, targetY, 10, 20)',
      'Final verification of aria-valuenow approximately 37 (accept 35-39 range as success due to pixel granularity)'
    ]
  },

  warnings: [
    'Volume sliders can be horizontal (most common) or vertical -- check slider dimensions to determine orientation before calculating position',
    'Some players use 0-1 range instead of 0-100 -- 37% is 0.37 on a 0-1 scale or 37 on a 0-100 scale',
    'Do NOT click the mute/volume speaker icon button -- it toggles mute, not adjusts volume',
    'Volume controls may be hidden until hover -- hover on player container or control bar first',
    'Vimeo and some players use input[type="range"] which may respond to value setting via DOM rather than click events',
    'CDP click_at is preferred for track clicks as content script click events may be ignored on custom player controls',
    'After volume change, some players show a transient tooltip with the volume percentage -- capture via read_page if visible',
    'Accept 35-39% range as success (slider precision limited by pixel granularity on narrow tracks)'
  ],

  toolPreferences: ['click_at', 'drag', 'hover', 'get_attribute', 'click', 'navigate', 'get_dom_snapshot', 'read_page', 'waitForDOMStable', 'press_key']
});
