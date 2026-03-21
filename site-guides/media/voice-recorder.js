/**
 * Site Guide: Online Voice Recorder
 * Per-site guide for online voice recorder applications with record button interaction.
 *
 * Online voice recorders typically have a large record button (often circular, red)
 * that requires click-and-hold or click-to-start/click-to-stop interaction. Two
 * interaction types exist:
 *
 * 1. HOLD-TO-RECORD: mousedown starts recording, mouseup stops -- use click_and_hold
 *    tool with holdMs=5000 for 5-second recording.
 *
 * 2. TOGGLE-TO-RECORD: click starts recording, click again stops -- use click_at twice
 *    with a 5-second delay between clicks. This is the more common pattern on web-based
 *    voice recorders.
 *
 * Primary targets: onlinevoicerecorder.com, vocaroo.com. Free, no-auth required.
 *
 * Created for Phase 58, MICRO-02 edge case validation.
 * Click-and-hold duration target: 5 seconds (5000ms).
 */

registerSiteGuide({
  site: 'Online Voice Recorder',
  category: 'Media',
  patterns: [
    /online-voice-recorder\.com/i,
    /onlinevoicerecorder\.com/i,
    /vocaroo\.com/i,
    /rev\.com\/voice-recorder/i,
    /voca\.ro/i
  ],
  guidance: `ONLINE VOICE RECORDER INTELLIGENCE:

RECORD BUTTON ANATOMY:
- Online voice recorders typically have a prominent circular record button, often
  red or with a microphone icon.
- The button may be an HTML button element, a div with click handler, or a
  canvas-rendered element.
- Key attributes: aria-label containing "record", data-action containing "record",
  class containing "record" or "mic".
- Some sites use a single button that toggles between record/stop states.

SELECTORS BY PLATFORM:
- onlinevoicerecorder.com: #recordButton, .record-button,
  button[aria-label*="Record" i], [class*="record"][class*="button"],
  [class*="rec-btn"], svg[class*="mic"]. The main record interface is typically
  a large circular button in the center of the page.
- vocaroo.com: #record-button, button[aria-label*="Record" i], [class*="record"],
  [data-action="record"], .rec-button. Vocaroo shows a large red button to start
  recording.
- Generic fallback: button[aria-label*="Record" i], button[aria-label*="record" i],
  [role="button"][aria-label*="record" i], [class*="record"][class*="btn"],
  [class*="record-button"], [class*="rec-btn"], [class*="microphone"],
  [id*="record"]

MICROPHONE PERMISSION:
- The browser will prompt for microphone access on first recording attempt.
- The extension cannot auto-grant this permission.
- If a permissions dialog appears, it must be accepted manually before the
  recording can start.
- Some sites show their own permission prompt UI before the browser's native
  permission dialog.

INTERACTION TYPE DETECTION:
- Check the record button behavior:
  * If the button text/aria-label changes to "Stop" or "Recording" after mousedown,
    it is a hold-to-record button -- use click_and_hold(x, y, 5000) for 5 seconds.
  * If the button text/aria-label changes to "Stop" after a click and stays in
    "recording" state, it is a toggle-to-record button -- use click_at to start,
    wait 5 seconds, click_at again to stop.
  * Default assumption: toggle-to-record (more common on web-based recorders).

WORKFLOW -- HOLD-TO-RECORD (5 seconds):
1. Navigate to voice recorder page
2. Dismiss cookie/consent popups
3. Locate the record button via get_dom_snapshot
4. Get the record button bounding rect (center coordinates)
5. Use click_and_hold(centerX, centerY, 5000) to press for 5 seconds then release
6. Verify recording occurred: check for playback controls, timer display, or
   download button appearing

WORKFLOW -- TOGGLE-TO-RECORD (5 seconds):
1. Navigate to voice recorder page
2. Dismiss cookie/consent popups
3. Locate the record button via get_dom_snapshot
4. Get the record button bounding rect (center coordinates)
5. Use click_at(centerX, centerY) to start recording
6. Wait 5 seconds (the MCP caller should wait between tool invocations)
7. Use click_at(centerX, centerY) again to stop recording (button may now show "Stop")
8. Alternatively, look for a separate stop button and click_at that
9. Verify recording: check for playback controls or audio waveform

VERIFICATION AFTER RECORDING:
- Look for playback button (play/pause), audio waveform display, timer showing
  elapsed time.
- Check for download/save button appearing after recording stops.
- Selectors: [class*="play"], [aria-label*="Play" i], [class*="waveform"],
  [class*="timer"], [class*="download"], [class*="save"], audio[src]
- If timer shows >= 4 seconds (allowing for startup delay), recording succeeded.

COOKIE/CONSENT HANDLING:
- Dismiss cookie banners before interacting.
- Common selectors: #onetrust-accept-btn-handler,
  [class*="cookie"] button[class*="accept"],
  [class*="consent"] button, button[class*="agree"].`,

  selectors: {
    recordButton: '#recordButton, #record-button, .record-button, .rec-btn, button[aria-label*="Record" i], [role="button"][aria-label*="record" i], [class*="record"][class*="btn"], [class*="record-button"], [data-action="record"], [id*="record"]',
    stopButton: '#stopButton, #stop-button, .stop-button, button[aria-label*="Stop" i], [class*="stop"][class*="btn"], [data-action="stop"]',
    playbackButton: '.play-button, button[aria-label*="Play" i], [class*="play"][class*="btn"], [data-action="play"]',
    timer: '.timer, .recording-timer, [class*="timer"], [class*="duration"], [class*="elapsed"]',
    waveform: '.waveform, [class*="waveform"], [class*="audio-wave"], canvas[class*="wave"]',
    downloadButton: '.download-button, button[aria-label*="Download" i], [class*="download"], a[download], [class*="save"]',
    cookieConsent: '#onetrust-accept-btn-handler, [class*="cookie"] button[class*="accept"], [class*="consent"] button'
  },

  workflows: {
    holdToRecord: [
      'Navigate to voice recorder page via navigate tool',
      'Dismiss cookie/consent popups by clicking the accept button',
      'Locate the record button via get_dom_snapshot',
      'Calculate button center: centerX = left + width/2, centerY = top + height/2',
      'Execute click_and_hold(centerX, centerY, 5000) to press for 5-second recording',
      'Verify recording occurred via playback controls appearing or timer >= 4 seconds'
    ],
    toggleToRecord: [
      'Navigate to voice recorder page via navigate tool',
      'Dismiss cookie/consent popups by clicking the accept button',
      'Locate the record button via get_dom_snapshot',
      'Calculate button center: centerX = left + width/2, centerY = top + height/2',
      'Execute click_at(centerX, centerY) to start recording',
      'Wait 5 seconds for recording duration',
      'Execute click_at(centerX, centerY) or click stop button to end recording',
      'Verify recording via playback controls or timer display'
    ],
    fullRecordTest: [
      'Navigate to target voice recorder via navigate tool',
      'Dismiss cookie/consent popups by clicking the accept button',
      'Use get_dom_snapshot to identify the record button and its interaction type (hold vs toggle)',
      'Read button bounding rect to calculate center coordinates',
      'Attempt holdToRecord with click_and_hold(centerX, centerY, 5000) for 5-second recording',
      'Verify recording by checking for playback controls or timer >= 4 seconds',
      'If hold method failed, try toggleToRecord method: click_at to start, wait 5 seconds, click_at to stop',
      'Verify recording again after toggle method attempt',
      'Check for download/save option appearing after successful recording',
      'Report outcome: PASS if recording captured, PARTIAL if button interacted but no recording, FAIL if no interaction'
    ]
  },

  warnings: [
    'Microphone permission must be granted before recording can start -- browser will show a permission dialog that cannot be automated',
    'Most web voice recorders use toggle-to-record (click start, click stop), not hold-to-record -- try toggle method first if hold method fails',
    'Some sites require HTTPS for microphone access -- ensure the URL uses https://',
    'The record button may change appearance/label between record and stop states -- re-snapshot DOM after starting recording to find the stop button',
    'Audio recording may have a 0.5-1 second startup delay -- a 5-second hold may produce approximately 4-4.5 seconds of audio',
    'Cookie/consent popups can block the record button -- always dismiss popups first',
    'Some sites show an interstitial "allow microphone" UI before the browser native permission dialog -- dismiss this first'
  ],

  toolPreferences: ['click_and_hold', 'click_at', 'click', 'navigate', 'get_dom_snapshot', 'read_page', 'waitForDOMStable', 'hover']
});
