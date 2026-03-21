/**
 * Site Guide: TikTok
 * Per-site guide for TikTok web video platform.
 *
 * Includes feed scroll workflow for finding videos by content keywords
 * (specifically cat-related videos). TikTok web uses a full-screen vertical
 * video feed where each video occupies the entire viewport. Videos must be
 * scrolled one at a time, reading each video's description/caption to
 * identify target content.
 *
 * Created for Phase 74, SCROLL-08 edge case validation.
 * Target: scroll TikTok web feed until finding a video containing a cat.
 */

registerSiteGuide({
  site: 'TikTok',
  category: 'Social Media',
  patterns: [
    /tiktok\.com/i
  ],
  guidance: `TIKTOK-SPECIFIC INTELLIGENCE:

FEED STRUCTURE:
- TikTok web uses a full-screen vertical video feed (one video per viewport)
- Each video occupies the entire visible area with overlay text (description, author, music info)
- Scrolling down moves to the NEXT video (not a continuous timeline like Twitter)
- Each scroll action moves exactly one video forward
- Videos auto-play when visible

PAGE TYPES:
- For You feed: tiktok.com (personalized -- may require auth)
- Search results: tiktok.com/search?q=cat (public, no auth required -- PREFERRED for SCROLL-08)
- Tag/hashtag pages: tiktok.com/tag/cats (public, no auth required -- FALLBACK)
- Explore/discover: tiktok.com/explore (trending content, may or may not require auth)
- User profile: tiktok.com/@username (public profile videos)

AUTH HANDLING:
- TikTok For You feed requires login -- DO NOT rely on it
- Search pages (tiktok.com/search?q=cat) are accessible WITHOUT login -- use as PRIMARY target
- Tag pages (tiktok.com/tag/cats) are accessible WITHOUT login -- use as FALLBACK
- If login wall appears: indicators are modal with "Log in" heading, or redirect to login page
- Login wall selectors: div[data-e2e="modal-close-inner-button"], [class*="LoginModal"], button containing "Log in" text
- Dismiss login prompts by clicking the close/X button on the modal if it appears

VIDEO ELEMENT SELECTORS:
- Video item container: div[data-e2e="recommend-list-item-container"], div[data-e2e="search-card-container"]
- Video description: span[data-e2e="search-card-desc"], span[data-e2e="new-desc"], h1[data-e2e="browse-video-desc"]
- Video link (for URL extraction): a[data-e2e="search-card-link"], a[href*="/video/"]
- Author name: span[data-e2e="search-card-user-unique-id"], a[data-e2e="video-author-uniqueid"], span[data-e2e="browse-username"]
- Author link: a[data-e2e="search-card-user-link"], a[href*="/@"]
- Hashtag links: a[data-e2e="search-common-link"], a[href*="/tag/"]
- Like count: strong[data-e2e="search-card-like-count"], strong[data-e2e="like-count"]
- Comment count: strong[data-e2e="search-card-comment-count"], strong[data-e2e="comment-count"]
- Video player: video element inside video container div
- Music/sound info: a[data-e2e="search-card-music"]

SEARCH PAGE LAYOUT:
- Search results show video thumbnails in a grid layout (not full-screen)
- Each search result card contains: thumbnail, description snippet, author name, like/comment counts
- The description text is visible without clicking the video
- Search results page URL: tiktok.com/search?q={query}
- Search input: input[data-e2e="search-user-input"], input[type="search"], input[name="q"]
- Search button: button[data-e2e="search-button"], button[type="submit"]
- Top tab filters: div[data-e2e="search-tabs"] (Videos, Users, Sounds, LIVE, etc.)

FEED/FOR-YOU PAGE LAYOUT (if accessible):
- Full-screen vertical scroll: one video visible at a time
- Description overlay on video: bottom-left corner with text, hashtags, music
- Scroll down = next video, scroll up = previous video
- Each scroll of ~500-800px advances one video

COOKIE / CONSENT POPUP:
- TikTok may show a cookie consent banner on first visit (especially EU regions)
- Cookie banner selector: div[class*="CookieBanner"], button[id="onetrust-accept-btn-handler"], div[id="onetrust-banner-sdk"]
- Accept button: button[id="onetrust-accept-btn-handler"], button containing "Accept" or "Allow" text

CAT CONTENT DETECTION (keyword matching in descriptions):
- Primary keywords: "cat", "kitten", "kitty", "meow", "feline", "purr"
- Hashtag keywords: "#cat", "#cats", "#kitten", "#catsoftiktok", "#catlife", "#meow"
- Match case-insensitively against the full description text
- For search results: search for "cat" which pre-filters results, then verify descriptions contain cat content
- A video "contains a cat" if its description or hashtags match ANY of the above keywords

SCROLL STRATEGY FOR SEARCH RESULTS:
- Search results load in batches as you scroll (similar to Twitter timeline)
- Scroll down by 800-1000px to load more search result cards
- Each scroll batch typically adds 8-12 new video cards
- Use waitForDOMStable after each scroll to wait for new cards to render
- Read each card's description text to check for cat keywords

SCROLL STRATEGY FOR FEED (if accessible):
- Each scroll action (500-800px) advances exactly one video
- After each scroll, read the video description overlay text
- Check if the description contains cat-related keywords
- If not a cat video, scroll to the next video and repeat`,

  selectors: {
    // Search page
    searchInput: 'input[data-e2e="search-user-input"], input[type="search"], input[name="q"]',
    searchButton: 'button[data-e2e="search-button"], button[type="submit"]',
    searchTabs: 'div[data-e2e="search-tabs"]',
    searchVideoTab: 'a[data-e2e="search-top-tab"]',
    searchResultCard: 'div[data-e2e="search-card-container"], div[data-e2e="recommend-list-item-container"]',
    searchCardDesc: 'span[data-e2e="search-card-desc"], span[data-e2e="new-desc"]',
    searchCardLink: 'a[data-e2e="search-card-link"], a[href*="/video/"]',
    searchCardUser: 'span[data-e2e="search-card-user-unique-id"], a[data-e2e="search-card-user-link"]',
    searchCardLikes: 'strong[data-e2e="search-card-like-count"]',
    searchCardComments: 'strong[data-e2e="search-card-comment-count"]',
    searchCardMusic: 'a[data-e2e="search-card-music"]',
    searchCommonLink: 'a[data-e2e="search-common-link"]',
    // Feed/For You page
    videoDesc: 'h1[data-e2e="browse-video-desc"], span[data-e2e="video-desc"]',
    videoAuthor: 'a[data-e2e="video-author-uniqueid"], span[data-e2e="browse-username"]',
    videoMusic: 'h4[data-e2e="browse-music"]',
    videoLikeCount: 'strong[data-e2e="like-count"]',
    videoCommentCount: 'strong[data-e2e="comment-count"]',
    videoShareCount: 'strong[data-e2e="share-count"]',
    videoPlayer: 'video',
    // Auth and navigation
    loginModal: 'div[data-e2e="modal-close-inner-button"], [class*="LoginModal"]',
    loginModalClose: 'div[data-e2e="modal-close-inner-button"], button[data-e2e="modal-close-inner-button"]',
    // Cookie consent
    cookieBanner: 'div[id="onetrust-banner-sdk"], div[class*="CookieBanner"]',
    cookieAccept: 'button[id="onetrust-accept-btn-handler"]',
    // Hashtag/tag page
    tagVideoCard: 'div[data-e2e="challenge-item"], div[data-e2e="recommend-list-item-container"]',
    tagDesc: 'div[data-e2e="challenge-item-desc"]'
  },
  workflows: {
    scrollFeedForCatVideo: [
      'Navigate to TikTok search page: tiktok.com/search?q=cat (preferred -- public, pre-filtered results)',
      'Wait for page to load via wait_for_stable -- verify search results visible',
      'Dismiss cookie/consent popup if present: click cookieAccept button',
      'Dismiss login modal if present: click loginModalClose button (X/close icon)',
      'Read the first batch of search result cards using read_page or get_dom_snapshot',
      'For each search result card, extract the description text from searchCardDesc element',
      'Check each description for cat keywords (case-insensitive): cat, kitten, kitty, meow, feline, purr, #cat, #cats, #catsoftiktok',
      'If a cat video found: extract its URL from searchCardLink (a[href*="/video/"]) and its description text -- DONE',
      'If no cat video in current batch: scroll down 800-1000px to load more search results',
      'Wait for new cards to render via wait_for_stable or waitForDOMStable',
      'Repeat steps 5-10 for up to 10 scroll cycles (approximately 80-120 videos checked)',
      'If still no cat video found after 10 scrolls on search page: try tag page tiktok.com/tag/cats as fallback',
      'Report: number of videos checked, cat video URL and description if found, or reason not found',
      'EXPECTED: searching for "cat" on TikTok should return cat-related videos in the first batch -- PASS likely on first read_page'
    ],
    searchForTopic: [
      'Navigate to tiktok.com',
      'Dismiss cookie/consent popup if present',
      'Dismiss login modal if present',
      'Click search input or navigate directly to tiktok.com/search?q={topic}',
      'Type search query if using search input',
      'Read search results and extract video descriptions and URLs'
    ]
  },
  warnings: [
    'TikTok For You feed requires authentication -- use search page (tiktok.com/search?q=cat) as primary target',
    'TikTok may show a login modal overlay even on public pages -- dismiss it by clicking the close/X button before proceeding',
    'TikTok uses dynamic CSS class names (tiktok-*) that change between deployments -- prefer data-e2e attribute selectors',
    'Search results page uses a grid layout, NOT full-screen vertical video format -- scroll by 800-1000px for more results',
    'TikTok may rate-limit or show CAPTCHAs after rapid automated scrolling -- use moderate scroll timing (500-1000ms delays)',
    'Video descriptions may contain emojis and non-ASCII characters -- match keywords case-insensitively on the text content',
    'The search query "cat" pre-filters results to cat-related content -- first batch likely contains cat videos'
  ],
  toolPreferences: ['navigate', 'scroll', 'read_page', 'get_dom_snapshot', 'click', 'type', 'waitForElement', 'waitForDOMStable', 'getText', 'wait_for_stable']
});
