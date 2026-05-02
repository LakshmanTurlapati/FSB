/**
 * Site Guide: Podcast Audio Player Timeline Scrub
 * Per-site guide for podcast audio players with timeline/progress bar seeking.
 *
 * Podcast players render a horizontal progress bar (timeline/scrubber) showing
 * playback position over the total episode duration. Two interaction approaches
 * for seeking to a specific timestamp:
 *
 * 1. CLICK ON PROGRESS BAR (preferred): Use click_at on the progress bar track
 *    at the calculated pixel position. Most podcast players listen for click
 *    events on the progress bar and seek to the click position. Single action,
 *    most reliable.
 *
 * 2. DRAG SCRUBBER THUMB (fallback): Drag the scrubber thumb from its current
 *    position to the target position using the drag tool. Some players only
 *    respond to drag events on the thumb. Use 10 intermediate steps with 20ms
 *    delay for smooth scrubber movement.
 *
 * Primary targets: Podbean, Buzzsprout, Spreaker, SoundCloud, Apple Podcasts web,
 * Spotify (public episodes), Anchor.fm, Transistor.fm, Simplecast.
 *
 * Created for Phase 66, MICRO-10 edge case validation.
 * Timeline scrub target: 14:22 = 862 seconds.
 */

registerSiteGuide({
  site: 'Podcast Audio Player',
  category: 'Media',
  patterns: [
    /podbean\.com/i,
    /buzzsprout\.com/i,
    /spreaker\.com/i,
    /anchor\.fm/i,
    /transistor\.fm/i,
    /simplecast\.com/i,
    /podcasts\.apple\.com/i,
    /open\.spotify\.com.*episode/i,
    /soundcloud\.com/i,
    /overcast\.fm/i,
    /pocketcasts\.com/i,
    /castbox\.fm/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic MICRO-10):
- [micro] click_at on progress bar at (targetSec/totalSec)*trackWidth is preferred seek method
- [micro] Extract duration from data-duration attr or aria-valuemax on range input
- [micro] Click play button FIRST to load audio before attempting timeline scrub
- [micro] Verify via time display text parsed to seconds; accept +/-5s tolerance
- [micro] SPA players (Alpine.js, React) need wait_for_element before DOM scan

PODCAST AUDIO TIMELINE SCRUB INTELLIGENCE:

AUDIO TIMELINE ANATOMY:
- Podcast players render a horizontal progress bar (timeline/scrubber) showing
  playback position over the total episode duration.
- The track is a div/span representing total episode duration, with a fill child
  showing elapsed time (played portion).
- Some players have a draggable thumb/handle on the timeline; others respond to
  click on the track directly.
- Key attributes for time state:
  * aria-valuenow: current playback position in seconds
  * aria-valuemin: 0 (start)
  * aria-valuemax: total duration in seconds
  * data-current-time, data-duration: raw time values
  * Time display elements showing "MM:SS" or "HH:MM:SS" format
  * HTML5 audio element currentTime and duration properties

TIMELINE POSITION CALCULATION:
- Target: 14:22 = 14 * 60 + 22 = 862 seconds
- Formula: targetX = trackLeft + (862 / totalDurationSeconds) * trackWidth
- targetY = trackTop + (trackHeight / 2) -- center of the track vertically
- Need total duration from: aria-valuemax, data-duration, duration text element,
  or audio.duration
- If total duration unknown, estimate from common podcast lengths (30min=1800s,
  60min=3600s)

TIMELINE SELECTORS BY PLATFORM:
- Podbean: .progress-bar, .podcast-player [class*="progress"],
  [class*="seek"], input[type="range"][class*="progress"]
- Buzzsprout: .episode-player [class*="progress"], [class*="scrubber"],
  [role="slider"]
- Spreaker: .player [class*="progress"], [class*="timeline"],
  [role="slider"]
- Apple Podcasts: .podcast-player [class*="progress"],
  [role="slider"][aria-label*="seek" i]
- Spotify: [data-testid="progress-bar"], [class*="progress-bar"],
  [role="slider"]
- SoundCloud: .playbackTimeline__progressWrapper, .playbackTimeline__bar,
  [role="progressbar"]
- Generic HTML5: audio + adjacent [role="slider"],
  input[type="range"][class*="progress"], [class*="seek-bar"],
  [class*="timeline"], [class*="progress-bar"],
  [aria-label*="seek" i], [aria-label*="progress" i],
  [aria-label*="timeline" i]

TIME DISPLAY SELECTORS:
- Current time: [class*="current-time"], [class*="currentTime"],
  [class*="elapsed"], [class*="time-current"], time[class*="current"]
- Total duration: [class*="duration"], [class*="total-time"],
  [class*="totalTime"], [class*="time-total"], [class*="time-remaining"]
- Combined display: [class*="time-display"], [class*="timeDisplay"],
  [class*="time-info"]

METHOD 1 -- CLICK ON PROGRESS BAR (preferred for seeking):
Steps:
1. Identify the audio player and ensure playback has started (click play button
   if the player is paused).
2. Get total duration from aria-valuemax, data-duration, duration text element,
   or audio.duration.
3. Get progress bar track bounding rect from get_dom_snapshot.
4. Calculate targetX = trackLeft + (862 / totalDurationSeconds) * trackWidth
5. Calculate targetY = trackTop + (trackHeight / 2)
6. Execute click_at(targetX, targetY) on the progress bar at the 14:22 position.
7. Verify via current time display showing approximately "14:22" or "14:2" prefix.

METHOD 2 -- DRAG SCRUBBER THUMB (fallback):
Steps:
1. Locate the scrubber thumb position on the progress bar.
2. Record thumbX = thumb center X, thumbY = thumb center Y.
3. Calculate targetX = trackLeft + (862 / totalDurationSeconds) * trackWidth
4. Execute drag(thumbX, thumbY, targetX, targetY, 10, 20)
5. Verify via current time display.

VERIFICATION:
- After seeking, verify current time using:
  * Read time display element text (should show "14:22" or within 5 seconds:
    "14:17" to "14:27")
  * get_attribute on slider for aria-valuenow (should be approximately 862)
  * The progress bar fill width should reflect the correct percentage
- Accept range of 14:17 to 14:27 (within 5 seconds tolerance) as success due
  to pixel granularity on narrow progress bars.

PLAY STATE:
- Most podcast players must be playing (or at least loaded) before seeking works.
- Click the play button first if the player shows a play icon.
- Some players only load the audio on first play click.
- After seeking, player may auto-pause -- this is acceptable, position is what
  matters.

COOKIE/CONSENT POPUPS:
- Dismiss cookie banners before interacting with the player.
- Common selectors: #onetrust-accept-btn-handler,
  [class*="cookie"] button[class*="accept"],
  [class*="consent"] button.`,

  selectors: {
    progressBar: '[role="slider"][aria-label*="seek" i], [role="slider"][aria-label*="progress" i], [role="slider"][aria-label*="timeline" i], input[type="range"][class*="progress"], [class*="progress-bar"][class*="seek"], [class*="seek-bar"], [class*="scrubber"], [class*="timeline-bar"], .playbackTimeline__progressWrapper',
    progressThumb: '[class*="progress"][class*="thumb"], [class*="seek"][class*="thumb"], [class*="scrubber"][class*="handle"], [class*="timeline"][class*="knob"], [class*="progress-handle"]',
    progressTrack: '[class*="progress"][class*="track"], [class*="seek"][class*="track"], [class*="timeline"][class*="track"], [class*="progress-bar"][class*="rail"], .playbackTimeline__bar',
    progressFill: '[class*="progress"][class*="fill"], [class*="progress"][class*="played"], [class*="progress-level"], [class*="elapsed-bar"], .playbackTimeline__timePassed',
    currentTime: '[class*="current-time"], [class*="currentTime"], [class*="elapsed"], [class*="time-current"], [data-testid*="current-time"]',
    totalDuration: '[class*="duration"], [class*="total-time"], [class*="totalTime"], [class*="time-total"], [data-testid*="duration"]',
    playButton: '[aria-label*="Play" i], button[class*="play"], [data-testid*="play"], [class*="play-button"], [class*="playButton"]',
    pauseButton: '[aria-label*="Pause" i], button[class*="pause"], [data-testid*="pause"]',
    playerContainer: '[class*="podcast-player"], [class*="audio-player"], [class*="episode-player"], [class*="player-container"], [class*="player-wrapper"]',
    audioElement: 'audio',
    cookieConsent: '#onetrust-accept-btn-handler, [class*="cookie"] button[class*="accept"], [class*="consent"] button, [id*="cookie"] button'
  },

  workflows: {
    scrubTimelineByClick: [
      'Navigate to a podcast episode page with an audio player via navigate tool',
      'Use get_dom_snapshot to locate the audio player and progress bar track bounding rect',
      'Read total episode duration from aria-valuemax, data-duration attribute, duration text, or audio.duration',
      'Calculate target position: targetX = trackLeft + (862 / totalDurationSeconds) * trackWidth, targetY = trackTop + (trackHeight / 2)',
      'Execute click_at(targetX, targetY) on the progress bar at the 14:22 position (862 seconds)',
      'Verify current time display shows approximately "14:22" (accept 14:17-14:27 range)'
    ],
    scrubTimelineByDrag: [
      'Navigate to a podcast episode page with an audio player via navigate tool',
      'Use get_dom_snapshot to locate the progress bar track and scrubber thumb bounding rects',
      'Read total episode duration from aria-valuemax, data-duration attribute, duration text, or audio.duration',
      'Record current thumb position: thumbX = thumb center X, thumbY = thumb center Y',
      'Calculate target position: targetX = trackLeft + (862 / totalDurationSeconds) * trackWidth, targetY = trackTop + (trackHeight / 2)',
      'Execute drag(thumbX, thumbY, targetX, targetY, 10, 20) to slide thumb to 14:22 position',
      'Verify current time display shows approximately "14:22" (accept 14:17-14:27 range)'
    ],
    fullTimelineScrubTest: [
      'Navigate to target podcast episode page via navigate tool (e.g., Podbean, Buzzsprout, or SoundCloud)',
      'Dismiss any cookie/consent popup by clicking the accept button (e.g., #onetrust-accept-btn-handler)',
      'Click the play button to start playback and load the audio element',
      'Use get_dom_snapshot to identify the progress bar element and its bounding rect dimensions',
      'Read total episode duration from aria-valuemax, duration text display, or audio.duration property',
      'Calculate pixel position for 14:22 (862 seconds): targetX = trackLeft + (862 / totalDurationSeconds) * trackWidth, targetY = trackTop + (trackHeight / 2)',
      'Attempt click_at(targetX, targetY) on the progress bar at the calculated 14:22 position',
      'Verify via current time display text (should show approximately "14:22" or within 5 second tolerance)',
      'If click did not seek correctly, attempt drag method: locate thumb, drag(thumbX, thumbY, targetX, targetY, 10, 20)',
      'Final verification: current time within 14:17-14:27 range (5 second tolerance for pixel granularity on narrow progress bars)'
    ]
  },

  warnings: [
    'Audio must be loaded (click play first) before seeking works on most players',
    'Some players use 0-1 range (percentage) while others use seconds for aria-valuenow',
    '14:22 = 862 seconds -- ensure you convert MM:SS to total seconds for calculation',
    'Do NOT click the play/pause button when trying to seek -- only interact with the progress bar',
    'Accept 14:17-14:27 (5 second tolerance) as success due to pixel granularity on narrow progress bars',
    'Some podcast pages require the audio to fully load before the timeline is interactive',
    'SoundCloud uses a different progress bar structure (.playbackTimeline__) than most players',
    'Spotify web player may require authentication -- use public podcast pages without auth'
  ],

  toolPreferences: ['click_at', 'drag', 'hover', 'get_attribute', 'click', 'navigate', 'get_dom_snapshot', 'read_page', 'waitForDOMStable', 'press_key']
});
