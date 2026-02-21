/**
 * Site Guide: YouTube
 * Per-site guide for YouTube video platform.
 */

registerSiteGuide({
  site: 'YouTube',
  category: 'Social Media',
  patterns: [
    /youtube\.com/i
  ],
  guidance: `YOUTUBE-SPECIFIC INTELLIGENCE:

SEARCH:
- Search box: [role="combobox"] (class ytSearchboxComponentInput). Autocomplete appears as you type.
- Search submit: [aria-label="Search"] or .ytSearchboxComponentSearchButton
- Voice search: [aria-label="Search with your voice"]

MASTHEAD (TOP BAR):
- Create button: [aria-label="Create"]
- Guide/sidebar toggle: [aria-label="Guide"]
- Notifications: [aria-label="Notifications"]
- Account menu: [aria-label="Account menu"] or #avatar-btn
- YouTube logo: #logo

SIDEBAR NAVIGATION:
- Home, Shorts, Subscriptions: all [role="link"] with text matching (e.g. //a[normalize-space(.)="Home"])
- Library sections: History, Playlists, Liked videos, Your videos, Watch later -- all sidebar links

HOMEPAGE:
- Category filter chips: [role="tab"] buttons (All, Music, Podcasts, Gaming, etc.)
- Video titles: .yt-lockup-metadata-view-model__title (homepage) or #video-title (watch/channel pages)
- Channel avatars: [aria-label="Go to channel <Name>"] with [role="button"]

WATCH PAGE:
- Subscribe button: //button[normalize-space(.)="Subscribe"] or //button[normalize-space(.)="Subscribed"]
- Description expand: .yt-truncated-text__absolute-button (text "...more")
- Join channel: [aria-label="Join this channel"]
- Captions: [aria-label="Subtitles/CC turned on"]

SHORTS:
- Shorts have a different UI with custom controls
- Mute/unmute: [aria-label="Unmute"] / [aria-label="Mute"]

UI FRAMEWORK NOTES:
- YouTube uses custom web components (ytd-*, tp-yt-paper-item) -- standard CSS selectors may not work
- Prefer aria-label selectors over class names
- Category filter chips are personalized based on watch history
- Comments section loads lazily -- scroll down to trigger loading
- Video player is HTML5 but controls are custom overlays`,
  selectors: {
    searchBox: '[role="combobox"]',
    searchButton: '[aria-label="Search"]',
    voiceSearch: '[aria-label="Search with your voice"]',
    createButton: '[aria-label="Create"]',
    guideToggle: '[aria-label="Guide"]',
    notifications: '[aria-label="Notifications"]',
    accountMenu: '#avatar-btn',
    logo: '#logo',
    videoTitle: '#video-title, .yt-lockup-metadata-view-model__title',
    subscribeButton: '//button[normalize-space(.)="Subscribe"]',
    subscribedButton: '//button[normalize-space(.)="Subscribed"]',
    descriptionExpand: '.yt-truncated-text__absolute-button',
    joinChannel: '[aria-label="Join this channel"]',
    categoryChips: '[role="tab"]',
    captionsButton: '[aria-label="Subtitles/CC turned on"]',
    muteButton: '[aria-label="Mute"]',
    unmuteButton: '[aria-label="Unmute"]'
  },
  workflows: {
    searchVideo: [
      'Click the search box [role="combobox"]',
      'Type the search query',
      'Click [aria-label="Search"] or press Enter',
      'Wait for results to load',
      'Click on the desired video title from results'
    ],
    watchVideo: [
      'Navigate to the video URL or search for it',
      'Wait for the video player to load',
      'Video will autoplay -- report the video title and channel'
    ],
    subscribeToChannel: [
      'Navigate to the channel page or a video by the channel',
      'Find the Subscribe button (//button[normalize-space(.)="Subscribe"])',
      'Click Subscribe',
      'Verify button changes to "Subscribed"'
    ],
    browseHome: [
      'Navigate to youtube.com',
      'Optionally click a category chip [role="tab"] to filter',
      'Scroll the feed to load more videos',
      'Click on a video title to watch'
    ]
  },
  warnings: [
    'YouTube uses custom web components (ytd-*, tp-yt-paper-item) -- prefer aria-label selectors over CSS classes',
    'YouTube category filter chips change based on watch history -- content is personalized',
    'Shorts have a different UI -- mute/caption buttons use custom classes',
    'YouTube video player is HTML5 but controls are custom overlays -- use aria-label selectors',
    'YouTube comments section loads lazily -- scroll down to trigger loading',
    'Do NOT rely on Tailwind-like utility classes on YouTube -- use aria-labels and data attributes'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'focus', 'pressEnter', 'navigate', 'scrollToElement']
});
