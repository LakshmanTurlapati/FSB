/**
 * Site Guide: News Feed (Infinite Scroll)
 * Per-site guide for scrolling infinite-scroll news sites and stopping at
 * articles from a target date (e.g., yesterday).
 *
 * Covers news sites that use infinite scroll or "load more" patterns to
 * display article feeds chronologically. Articles have timestamps that can
 * be parsed to determine publication date. Primary target: BBC News
 * (bbc.com/news). Also covers common patterns across CNN, Reuters, AP News,
 * The Guardian, and other major news sites.
 *
 * Created for Phase 76, SCROLL-10 edge case validation.
 * Target: scroll news feed until reaching articles published yesterday, then stop.
 */

registerSiteGuide({
  site: 'News Feed (Infinite Scroll)',
  category: 'News',
  patterns: [
    /bbc\.com\/news/i,
    /bbc\.co\.uk\/news/i,
    /cnn\.com/i,
    /reuters\.com/i,
    /apnews\.com/i,
    /theguardian\.com/i
  ],
  guidance: `NEWS FEED DATE-STOP SCROLL (SCROLL-10):

NEWS SITE ARTICLE FEED DOM STRUCTURE:
- News sites display articles in a chronological feed (newest first at top)
- Each article is wrapped in a container element (article, div, li) with a headline, summary, timestamp, and link
- Articles may be grouped by date sections ("Today", "Yesterday", date headers)
- Infinite scroll loads more articles when the user reaches the bottom of the current batch
- Some sites use a "Load More" button instead of automatic infinite scroll
- Article timestamps can appear in multiple formats:
  * time elements with datetime attribute (ISO 8601): <time datetime="2026-03-20T14:30:00Z">
  * Relative text: "2 hours ago", "Yesterday", "1 day ago"
  * Absolute text: "March 20, 2026", "20 Mar 2026", "03/20/2026"
  * Data attributes: data-timestamp, data-published, data-date

DATE DETECTION STRATEGY:
- PREFERRED: Look for time elements with datetime attribute -- parse ISO 8601 for exact date comparison
- FALLBACK 1: Look for data-timestamp or data-published attributes on article containers
- FALLBACK 2: Parse visible date text using date keywords ("Yesterday", "hours ago", date patterns)
- "Yesterday" means: compare article date to (today - 1 day) in UTC or local timezone
- Articles are assumed to be in reverse chronological order (newest first)
- When scrolling down, article dates should get progressively older
- Stop condition: first article with a date BEFORE yesterday (meaning we have passed through all of yesterday's articles)

YESTERDAY CALCULATION:
- Get today's date: new Date() or from the page's timezone context
- Yesterday = today minus 1 day (set hours to 0 for date-only comparison)
- An article is "from yesterday" if its publication date (date portion only) equals yesterday's date
- An article is "older than yesterday" if its date is before yesterday -- this is the stop signal
- An article is "from today" if its date equals today -- keep scrolling

PRIMARY TARGET -- BBC NEWS (bbc.com/news):
- URL: https://www.bbc.com/news
- BBC News homepage displays article cards in a feed layout
- Each article card typically uses article or div elements with data-testid attributes
- Timestamps: time elements with datetime attributes in ISO 8601 format
- Article links: a[href^="/news/"] pointing to individual article pages
- Headlines: h3 or h2 elements inside article containers
- The feed loads more articles on scroll (infinite scroll or pagination)
- BBC also has date-sectioned pages (/news/topics/...) that group by date

FALLBACK TARGET -- CNN (cnn.com):
- CNN homepage and section pages have article cards with timestamps
- Article containers: div[data-uri], article elements, or li elements in feed containers
- Timestamps: may use relative text ("1 hour ago") or span elements with date data
- Some CNN pages use a "More Stories" button rather than infinite scroll

FALLBACK TARGET -- REUTERS (reuters.com):
- Reuters article feed at reuters.com or reuters.com/world
- Article containers: article elements with time elements containing datetime attributes
- Reuters typically shows absolute dates ("March 20, 2026") and relative times
- Good infinite scroll behavior on topic pages

SCROLL-COMPARE-STOP LOOP:
- Step 1: Load the news page and read the initial batch of articles
- Step 2: For each article, extract the publication timestamp
- Step 3: Compare each timestamp to yesterday's date
- Step 4: If all articles are from today, scroll down to load more articles
- Step 5: After scroll, wait for DOM to stabilize (new articles to render)
- Step 6: Read the newly loaded batch of articles
- Step 7: Check timestamps again -- if any article date equals yesterday, mark those articles
- Step 8: If an article date is OLDER than yesterday, STOP scrolling (we have passed yesterday's articles)
- Step 9: The last batch containing yesterday-dated articles is the target zone
- Step 10: Extract article info (headline, link, timestamp) from the yesterday-dated articles

DEDUPLICATION STRATEGY:
- Use article link href as unique identifier (each article has a distinct URL path)
- After each scroll, extract article hrefs from visible articles
- Compare against already-seen hrefs to identify genuinely new articles
- If scroll loads 0 new unique articles for 2 consecutive scrolls, the feed may have reached its end`,
  selectors: {
    // Generic article feed selectors
    articleContainer: 'article, [role="article"], div[data-testid*="card"], div[data-testid*="article"], li[class*="article"], div[class*="story-card"]',
    articleHeadline: 'article h2, article h3, [data-testid*="headline"], h3[class*="headline"], h2[class*="title"], a[class*="headline"]',
    articleTimestamp: 'time[datetime], time, span[data-timestamp], span[class*="timestamp"], span[class*="date"], [data-published]',
    articleLink: 'article a[href], [data-testid*="card"] a[href], h2 a[href], h3 a[href]',
    articleSummary: 'article p, [data-testid*="summary"], p[class*="summary"], p[class*="description"]',
    articleImage: 'article img, [data-testid*="image"] img, picture img',
    // Date section headers
    dateSectionHeader: 'h2[class*="date"], div[class*="date-header"], div[class*="section-date"], span[class*="group-date"]',
    // Load more triggers
    loadMoreButton: 'button[class*="load-more"], button[class*="more"], a[class*="load-more"], [data-testid*="load-more"]',
    scrollSentinel: 'div[class*="sentinel"], div[class*="infinite"], div[class*="loader"], div[class*="loading"]',
    // BBC-specific selectors
    bbcArticleCard: '[data-testid="edinburgh-card"], [data-testid="card"], article[class*="media"]',
    bbcHeadline: '[data-testid="card-headline"], h3[class*="promo-heading"], a[class*="focusIndicator"]',
    bbcTimestamp: 'time[datetime], span[data-testid="card-metadata-lastupdated"], time[class*="date"]',
    bbcArticleLink: 'a[href*="/news/"], a[data-testid="internal-link"]',
    // CNN-specific selectors
    cnnArticleCard: 'div[data-uri], article[class*="container__item"], div[class*="card"]',
    cnnHeadline: 'span[class*="headline"], h3[class*="title"], a[class*="container__link"]',
    cnnTimestamp: 'div[class*="timestamp"], span[class*="update-time"]',
    // Reuters-specific selectors
    reutersArticleCard: 'article[class*="story"], div[class*="media-story"], li[class*="story"]',
    reutersHeadline: 'h3[class*="story-title"], a[class*="story-title"]',
    reutersTimestamp: 'time[datetime], span[class*="date"]'
  },
  workflows: {
    scrollToYesterdaysArticles: [
      'Navigate to the news site (e.g., bbc.com/news) using navigate tool',
      'Wait for page to fully load via wait_for_stable -- verify article feed content visible',
      'Dismiss any cookie consent banners, notification permission prompts, or promotional overlays (BBC shows cookie banner on first visit)',
      'Calculate yesterday date: get today date, subtract 1 day, format as YYYY-MM-DD for comparison',
      'Use read_page or get_dom_snapshot to capture initial batch of articles in the feed',
      'For each article in the initial batch: extract the publication timestamp from time[datetime] attribute or visible date text',
      'Parse each timestamp to extract the date portion (YYYY-MM-DD) -- compare to yesterday date',
      'If all initial articles are from today: scroll down 600-800px to load more articles',
      'Wait 1500-2000ms for DOM to stabilize after scroll (infinite scroll content load)',
      'Read newly loaded articles -- extract timestamps and check dates',
      'Continue scroll-read-compare loop: scroll down, wait, read articles, check dates',
      'STOP SCROLLING when an article date is OLDER than yesterday (date before yesterday) -- this means all yesterday articles have been passed',
      'Collect all articles whose date matches yesterday from the accumulated results',
      'Extract article info for yesterday articles: headline text, article link href, publication timestamp',
      'Report: number of scroll cycles performed, total articles scanned, yesterday articles found (count + details), first and last article timestamps encountered'
    ],
    extractArticleDates: [
      'On current news page: find all article containers using articleContainer selectors',
      'For each article: locate the timestamp element (time[datetime] preferred, then visible text)',
      'Parse each timestamp to extract date -- handle ISO 8601, relative text, and absolute date formats',
      'Group articles by date (today, yesterday, older)',
      'Report: article count per date group, oldest and newest article dates found'
    ]
  },
  warnings: [
    'News sites frequently redesign their DOM structure -- selectors may need updating if articles are not found',
    'BBC cookie consent banner blocks interaction until dismissed -- click accept or reject before scrolling',
    'Infinite scroll may stop loading after a certain number of articles -- check for a "Load More" button as fallback',
    'Relative timestamps ("2 hours ago") require knowing the current time to calculate the actual date -- prefer datetime attributes over relative text',
    'Some news sites use client-side hydration: article timestamps may not exist in initial server HTML and only appear after JavaScript execution',
    'Article timestamps may be in the site local timezone (e.g., GMT for BBC, ET for CNN) -- compare dates at day granularity to avoid timezone edge cases',
    'Scroll increments of 600-800px recommended for news feeds to avoid skipping article cards (articles are taller than pricing table rows)',
    'News feeds that group articles by date section headers ("Today", "Yesterday") provide a reliable stop signal without parsing individual timestamps'
  ],
  toolPreferences: ['navigate', 'scroll', 'read_page', 'get_dom_snapshot', 'click', 'getText', 'waitForElement', 'waitForDOMStable', 'wait_for_stable']
});
