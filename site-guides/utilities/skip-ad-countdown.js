/**
 * Site Guide: Skip Ad Countdown
 * Per-site guide for detecting pre-roll video ad countdowns and clicking the
 * Skip Ad button after the countdown completes, using wait_for_element to
 * poll for skip button appearance in the DOM.
 *
 * Key challenge: Video platforms show pre-roll ads that force a timed wait
 * (typically 5 seconds, sometimes 6, 15, or 30 seconds) before revealing a
 * clickable Skip Ad button. The dark pattern is temporal gating -- the Skip Ad
 * button either does not exist in the DOM, is hidden via CSS display:none or
 * visibility:hidden, or is disabled until the countdown timer reaches zero. Some
 * platforms also use misleading styling: the countdown text ("You can skip in 5..."
 * or "Video will play after ad") occupies the same visual space where the skip
 * button will appear, and the transition from countdown to clickable button may be
 * subtle. The AI has no vision and cannot see the countdown timer -- it must use
 * wait_for_element to poll for the skip button appearance, wait for it to become
 * clickable (not disabled, not hidden), and click it immediately.
 *
 * Distinction from other DARK patterns:
 * - DARK-01 (freeware-download.js): Fake download buttons -- elimination by href domain
 * - DARK-04 (camouflaged-close.js): Hidden close buttons -- DOM attribute analysis
 * - DARK-05 (adblocker-bypass.js): Adblocker modals with no close -- DOM removal/CSS override
 * - DARK-09 (this guide): Temporal gating -- skip button absent/hidden/disabled during
 *   countdown, present/visible/enabled after countdown. Counter-strategy: wait_for_element
 *   to poll for skip button appearance, then immediately click.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-09) -- the skip
 * button is gated by time, not by visual camouflage or absence of close mechanism.
 * The counter-strategy is wait_for_element with appropriate timeout.
 *
 * Created for Phase 95, DARK-09 edge case validation.
 * Target: click Skip Ad on a video player after the pre-roll ad countdown completes.
 */

registerSiteGuide({
  site: 'Skip Ad Countdown',
  category: 'Utilities',
  patterns: [
    /skip.*ad/i,
    /ad.*skip/i,
    /skip.*countdown/i,
    /pre.?roll/i,
    /video.*ad/i,
    /ad.*countdown/i,
    /youtube\.com\/watch/i,
    /dailymotion\.com\/video/i,
    /twitch\.tv/i,
    /vimeo\.com/i
  ],

  guidance: `SKIP AD COUNTDOWN INTELLIGENCE (DARK-09):

DARK PATTERN CONTEXT (DARK-09):
Video platforms use pre-roll ads with a forced wait period (typically 5 seconds,
sometimes 6, 15, or 30 seconds) before showing a clickable Skip Ad button. The
dark pattern is temporal gating -- the platform prevents the user from skipping
the ad for a fixed duration, hoping the user will watch the full ad. During the
countdown, the skip button either does not exist in the DOM (YouTube injects it
dynamically after the countdown), is hidden via CSS (JW Player uses display:none
on .jw-skip during countdown), or shows a disabled countdown text instead of a
clickable button (Dailymotion shows "Skip Ad in 5..." text that is not clickable).

The AI has no vision and cannot see the countdown timer visually. It must use
wait_for_element to poll for the skip button appearance in the DOM, wait for it
to become clickable (not disabled, not display:none, not visibility:hidden), and
click it immediately once it appears. The key insight is that the skip button
appearance is deterministic after a fixed time offset configured in the ad server
response (VAST XML skipoffset attribute), so wait_for_element with a 10-15 second
timeout will reliably catch it regardless of the specific countdown duration.

SKIP BUTTON STATE TRANSITIONS:
The skip button goes through two distinct phases during a pre-roll ad:

Phase 1 -- COUNTDOWN ACTIVE (skip NOT available):
  (a) Element ABSENT from DOM entirely -- YouTube dynamically creates the skip
      button element only after the countdown completes. Before that, the
      .ytp-ad-skip-button element does not exist in the DOM tree at all.
  (b) Element PRESENT but display:none / visibility:hidden -- JW Player has the
      .jw-skip element in the DOM from ad start but sets display:none during
      countdown. The element exists but is not visible or clickable.
  (c) Element PRESENT but disabled attribute set -- some VAST/VPAID players
      render the skip button immediately but with the disabled attribute,
      preventing click events from firing.
  (d) Element shows COUNTDOWN TEXT instead of clickable button -- Dailymotion and
      some players show "Skip Ad in 5..." text in the same container where the
      skip button will appear. The text element is not a button and not clickable.

Phase 2 -- COUNTDOWN COMPLETE (skip IS available):
  (a) Element INSERTED into DOM -- YouTube adds the .ytp-ad-skip-button element.
  (b) display changed to block/inline-block -- JW Player shows .jw-skip.
  (c) disabled attribute REMOVED -- VAST/VPAID players enable the button.
  (d) Text changes to "Skip Ad" or "Skip" and element becomes a clickable button.

The transition from Phase 1 to Phase 2 is the critical moment for automation.
wait_for_element detects this transition by polling for element presence and
visibility at a configurable interval (recommended: 500ms).

SKIP BUTTON DETECTION STRATEGY:
Use a four-step approach to reliably skip pre-roll video ads:

Step A -- DETECT AD PLAYING:
Use get_dom_snapshot to check for ad overlay indicators in the DOM. Each platform
uses different elements to indicate an ad is currently playing:
  - YouTube: .video-ads container, .ytp-ad-player-overlay, or .ad-showing class
    on the .html5-video-player element. The .ad-showing class is the most reliable
    single indicator that an ad is active.
  - Dailymotion: .dmp_AdContainer element, or elements with class containing
    "AdOverlay" (e.g., [class*="AdOverlay"]).
  - Twitch: [data-a-target="video-ad-overlay"] element present in the DOM.
  - JW Player: .jw-flag-ads class on the player container, or .jw-ad-playing
    state class indicating an ad is currently rendering.
  - Generic VAST/VPAID: Elements with class containing "ad-overlay", "ad-container",
    or "preroll" (e.g., [class*="ad-overlay"], [class*="ad-container"],
    [class*="preroll"]).
If no ad indicators are found, the video may not have a pre-roll ad. Proceed to
watch the content directly.

Step B -- WAIT FOR SKIP BUTTON:
Use wait_for_element with a CSS selector matching the skip button for the detected
platform. Critical parameters:
  - timeout: 15000 (15 seconds) -- covers 5-second and 6-second countdowns with
    margin. Also provides enough time for slow ad loading. If the button does not
    appear within 15 seconds, the ad may be non-skippable.
  - poll interval: 500 (500ms) -- responsive detection without excessive DOM queries.
    The skip button appearance after countdown is near-instant, so 500ms polling
    catches it within one poll cycle.
The selector should match the CLICKABLE state of the skip button, not the countdown
text state. For YouTube, use .ytp-ad-skip-button or .ytp-ad-skip-button-modern
(these elements only exist when the button is clickable). For JW Player, the
.jw-skip element may exist during countdown with display:none -- wait_for_element
should detect when it becomes visible.

Step C -- CLICK SKIP BUTTON:
Once wait_for_element confirms the skip button is present and visible, immediately
use click on the skip button element with the CSS selector. Do NOT use click_at
(coordinate-based) because the skip button position varies by player size, ad
format, viewport dimensions, and whether the player is in fullscreen or inline
mode. DOM-based click with the CSS selector is deterministic and viewport-independent.

Step D -- VERIFY AD DISMISSED:
After clicking, use get_dom_snapshot to verify the ad overlay is gone. Check:
  - Ad overlay elements removed from DOM or set to display:none / visibility:hidden.
  - YouTube: .ad-showing class removed from .html5-video-player element. The
    selector .html5-video-player:not(.ad-showing) confirms content mode.
  - Video content is loading or playing (ad-related elements replaced by content
    player controls).
  - Video time is advancing (not stuck at 0:00 which indicates still in ad).
If the ad is still showing after the click, retry the click up to 2 more times
with a 1-second delay between retries. Some players have a brief transition
animation (500-1000ms) after the skip button is clicked before the ad overlay
is fully dismissed.

PLATFORM-SPECIFIC SKIP BUTTON SELECTORS:

YouTube (.ytp-ad-skip-button, .ytp-ad-skip-button-modern):
  YouTube shows a countdown overlay in the bottom-right of the video player.
  During countdown, the element shows "You can skip ad in X" text with a timer.
  After 5 seconds, the button changes to a clickable "Skip Ad" or "Skip" button.
  Primary selectors: .ytp-ad-skip-button, .ytp-ad-skip-button-modern (2024+
  redesign), button.ytp-ad-skip-button-modern, .ytp-skip-ad-button.
  Fallback selectors: .ytp-ad-skip-button-slot button (the slot container is
  always present but the button inside appears only after countdown),
  [class*="skip-button"][class*="ytp"] (wildcard for future class name changes).
  Ad overlay: .video-ads, .ytp-ad-player-overlay, .ad-showing on player element.

Dailymotion (button[aria-label="Skip Ad"], .dmp_SkipButton):
  Dailymotion shows a skip countdown in the ad overlay. The skip button uses
  aria-label="Skip Ad" or class containing SkipButton/skip. The countdown may
  show in a .dmp_AdCountdown element that transitions to the skip button.
  Primary selectors: button[aria-label="Skip Ad"], .dmp_SkipButton,
  [class*="SkipButton"].
  Ad overlay: .dmp_AdContainer, [class*="AdOverlay"].

Twitch (button[data-a-target="video-ad-countdown-skip"]):
  Twitch pre-roll ads show a countdown before allowing skip. The skip button uses
  data-a-target="video-ad-countdown-skip" or similar data-a-target attributes.
  Primary selectors: button[data-a-target="video-ad-countdown-skip"],
  [data-a-target*="skip"].
  Ad overlay: [data-a-target="video-ad-overlay"].

JW Player (.jw-skip-button, .jw-skip):
  JW Player VAST/VPAID ads show a skip countdown text ("Skip ad in X") that
  transforms into a clickable skip button after the configured skip offset
  (typically 5 seconds). The .jw-skip element has display:none during countdown
  and becomes display:block when skippable.
  Primary selectors: .jw-skip-button, .jw-skip, .jw-skipButton.
  Ad overlay: .jw-flag-ads, .jw-ad-playing.

Generic VAST/VPAID:
  Standard video ad formats use VAST (Video Ad Serving Template) and VPAID (Video
  Player-Ad Interface Definition) protocols. Skip buttons commonly use class names
  containing "skip" combined with "ad" context. The skip offset is configured in
  the VAST XML (skipoffset attribute on the Linear element) and varies per ad.
  Primary selectors: button[class*="skip"][class*="ad"], [class*="ad-skip"],
  [data-role="skip"], button[class*="skip-button"].

Vimeo OTT / Embedded:
  Vimeo OTT and some embedded players show skippable pre-roll ads with a skip
  button that appears after the configured offset.
  Primary selectors: button.skip-button, [data-skip-button].

COUNTDOWN ELEMENT SELECTORS:
These selectors identify where the countdown timer text is displayed per platform.
The countdown text is useful for context awareness (confirming an ad countdown is
active) but should NOT be the click target -- wait for the skip button instead.
  - YouTube: .ytp-ad-preview-text (shows "Video will play after ad" or
    "You can skip ad in X"), .ytp-ad-skip-button-text (skip button text area),
    .ytp-ad-text (general ad text overlay).
  - Dailymotion: .dmp_AdCountdown, [class*="AdCountdown"] -- shows remaining
    seconds before skip becomes available.
  - Twitch: [data-a-target="video-ad-countdown"] -- displays countdown timer.
  - JW Player: .jw-skip-icon, .jw-skip-text -- shows "Skip ad in X" text during
    countdown phase, transitions to "Skip" when clickable.
  - Generic: [class*="ad-countdown"], [class*="countdown"] -- common patterns for
    countdown timer elements in VAST/VPAID ad players.

TIMING AND WAIT STRATEGY:
  - Use wait_for_element with timeout=15000 (15 seconds) and poll interval=500
    (500ms) to detect skip button appearance.
  - 15 seconds covers: 5-second countdown (most common on YouTube), 6-second
    countdown (some ad networks), and slow ad loading scenarios.
  - If wait_for_element times out after 15 seconds, the ad may be NON-SKIPPABLE
    (forced 15-second or 30-second watch). In that case, wait for the ad to end
    naturally by polling for the ad overlay dismissal every 5 seconds, up to 60
    seconds total. Non-skippable ads have no skip button at all -- the entire ad
    must play before content begins.
  - Do NOT attempt to click the countdown text or the skip button area before the
    button actually appears. Premature clicks will either fail (no element) or
    trigger unintended actions (clicking the ad overlay opens the advertiser URL).

VERIFICATION:
After clicking Skip Ad, verify the ad is dismissed by checking:
  1. Ad overlay elements are removed or hidden (display:none, visibility:hidden).
  2. YouTube: .html5-video-player:not(.ad-showing) -- the .ad-showing class is
     removed when the ad ends and content resumes.
  3. Video content is loading or playing (content-mode player controls visible).
  4. If still showing ad after click: retry click up to 2 more times, with a
     1-second delay between attempts to allow for transition animations.`,

  selectors: {
    adOverlay: {
      youtube: '.video-ads, .ytp-ad-player-overlay, .ad-showing',
      dailymotion: '.dmp_AdContainer, [class*="AdOverlay"]',
      twitch: '[data-a-target="video-ad-overlay"]',
      jwplayer: '.jw-flag-ads, .jw-ad-playing',
      generic: '[class*="ad-overlay"], [class*="ad-container"], [class*="preroll"]'
    },
    skipButton: {
      youtube: '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, button.ytp-ad-skip-button-modern, .ytp-skip-ad-button',
      youtubeFallback: '.ytp-ad-skip-button-slot button, [class*="skip-button"][class*="ytp"]',
      dailymotion: 'button[aria-label="Skip Ad"], .dmp_SkipButton, [class*="SkipButton"]',
      twitch: 'button[data-a-target="video-ad-countdown-skip"], [data-a-target*="skip"]',
      jwplayer: '.jw-skip-button, .jw-skip, .jw-skipButton',
      generic: 'button[class*="skip"][class*="ad"], [class*="ad-skip"], [data-role="skip"], button[class*="skip-button"]',
      vimeo: 'button.skip-button, [data-skip-button]'
    },
    countdown: {
      youtube: '.ytp-ad-preview-text, .ytp-ad-skip-button-text, .ytp-ad-text',
      dailymotion: '.dmp_AdCountdown, [class*="AdCountdown"]',
      twitch: '[data-a-target="video-ad-countdown"]',
      jwplayer: '.jw-skip-icon, .jw-skip-text',
      generic: '[class*="ad-countdown"], [class*="countdown"]'
    },
    adDismissed: {
      youtube: '.html5-video-player:not(.ad-showing)',
      dailymotion: 'video:not([class*="ad"])',
      generic: '.video-player:not([class*="ad"])'
    }
  },

  workflows: {
    skipAdCountdown: [
      {
        step: 1,
        name: 'NAVIGATE TO VIDEO',
        description: 'Use navigate to load the video page. Trigger video playback if needed by clicking the play button. Pre-roll ads typically start automatically on page load or when playback begins. If the video does not auto-play, click the play button (.ytp-play-button for YouTube, or the platform-specific play control) to trigger the ad.',
        tools: ['navigate', 'click'],
        tips: [
          'YouTube videos with ads auto-play the ad on page load',
          'Some platforms require a click on the play button to start the ad',
          'The ad overlay appears within 1-2 seconds of playback starting'
        ]
      },
      {
        step: 2,
        name: 'DETECT AD OVERLAY',
        description: 'Use get_dom_snapshot to check for ad overlay indicators using platform-specific selectors from the adOverlay selector group. If ad indicators are found (e.g., .ad-showing class on YouTube player, .jw-flag-ads on JW Player), an ad is playing and we proceed to wait for the skip button. If NO ad indicators are found, the video has no pre-roll ad -- report this finding and proceed to watch content.',
        tools: ['get_dom_snapshot'],
        selectors: 'adOverlay',
        tips: [
          'YouTube: check for .ad-showing class on .html5-video-player',
          'JW Player: check for .jw-flag-ads class on player container',
          'If no ad overlay found, the video may have no pre-roll ad'
        ]
      },
      {
        step: 3,
        name: 'IDENTIFY PLATFORM',
        description: 'Based on the current URL and DOM structure, identify which platform selectors to use. YouTube (youtube.com/watch), Dailymotion (dailymotion.com/video), Twitch (twitch.tv), JW Player (presence of .jwplayer or jw-* class patterns in DOM), or generic VAST/VPAID (any other video player with ad overlay). Select the corresponding skip button selector for the detected platform.',
        tools: ['read_page'],
        tips: [
          'URL is the primary platform identifier',
          'DOM class patterns confirm the player framework',
          'Fall back to generic selectors if platform is unknown'
        ]
      },
      {
        step: 4,
        name: 'WAIT FOR SKIP BUTTON',
        description: 'Use wait_for_element with the platform-specific skip button selector and a 15000ms timeout (15 seconds). The skip button will appear after the countdown completes (typically 5 seconds). Do NOT try to click before it appears -- premature clicks on the ad overlay will open the advertiser URL. If wait_for_element times out, the ad may be non-skippable. In that case, wait for the ad to end naturally by checking for ad overlay dismissal every 5 seconds, up to 60 seconds total.',
        tools: ['wait_for_element'],
        selectors: 'skipButton',
        timeout: 15000,
        pollInterval: 500,
        tips: [
          'The skip button appears after a fixed countdown (typically 5 seconds)',
          'Do NOT click before the button appears -- this opens the ad URL',
          'If timeout expires, the ad may be non-skippable (15s or 30s forced watch)',
          'wait_for_element handles all state transitions: absent->present, hidden->visible, disabled->enabled'
        ]
      },
      {
        step: 5,
        name: 'CLICK SKIP BUTTON',
        description: 'Once the skip button is detected by wait_for_element, use click with the CSS selector to dismiss the ad. Use DOM-based click (CSS selector), NOT click_at (coordinates), because the skip button position varies by player size, ad format, viewport dimensions, and fullscreen state. A DOM-based click is deterministic and viewport-independent.',
        tools: ['click'],
        selectors: 'skipButton',
        tips: [
          'Use CSS selector click, NOT coordinate-based click_at',
          'The skip button position varies by player configuration',
          'Click immediately after wait_for_element confirms presence',
          'Some players need a brief moment (200-500ms) after button appears before click registers'
        ]
      },
      {
        step: 6,
        name: 'VERIFY AD DISMISSED',
        description: 'Use get_dom_snapshot to confirm the ad overlay is removed. Check that: (a) ad overlay elements are gone or hidden (display:none, visibility:hidden), (b) .ad-showing class removed from YouTube player element, (c) video content is loading or playing (content player controls visible). If the ad is still showing after click, retry the click up to 2 more times with a 1-second delay between retries to allow for transition animations.',
        tools: ['get_dom_snapshot', 'click'],
        selectors: 'adDismissed',
        tips: [
          'Allow 500-1000ms after click for ad overlay transition animation',
          'YouTube: verify .html5-video-player:not(.ad-showing) is present',
          'If ad still showing, retry click up to 2 more times',
          'Video time advancing confirms content is playing (not stuck at 0:00)'
        ]
      }
    ]
  },

  warnings: [
    'DARK-09: Video ads force a countdown (typically 5 seconds) before the Skip Ad button appears. Use wait_for_element to wait for the skip button -- do NOT attempt to click before it exists in the DOM.',
    'The skip button may appear in different DOM states: absent -> inserted, display:none -> display:block, disabled -> enabled, or countdown text -> clickable button. wait_for_element handles all of these by polling for element presence and visibility.',
    'Use a 15-second timeout for wait_for_element to cover 5-second, 6-second, and longer countdowns with margin. If the button never appears, the ad may be non-skippable -- wait for natural ad completion instead.',
    'Always use DOM-based click (CSS selector) for the skip button, NOT click_at (coordinates). The skip button position varies by player size, ad format, and viewport dimensions.',
    'After clicking Skip Ad, VERIFY the ad overlay is dismissed by checking DOM for removal of ad-related elements. Some players require a brief delay (500-1000ms) after click before the ad overlay transitions out.'
  ],

  toolPreferences: ['wait_for_element', 'click', 'get_dom_snapshot', 'read_page', 'navigate']
});
