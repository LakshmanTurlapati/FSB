/**
 * Site Guide: Freeware Download Ad Avoidance
 * Per-site guide for navigating freeware download sites while distinguishing
 * real download links from fake ad "Download Now" buttons using DOM analysis.
 *
 * Key challenge: Freeware sites (SourceForge, FileHippo, FossHub, MajorGeeks)
 * display multiple prominent "Download" buttons, most of which are advertisements
 * linking to external ad network domains or redirect through tracking URLs. The AI
 * must use DOM attribute analysis (href domain, class names, iframe wrappers,
 * data-* attributes, sponsored markers) to identify which download link is real.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-01) -- the fake
 * buttons are intentionally styled to look identical to the real download button.
 * DOM analysis is the only reliable discrimination method.
 *
 * Created for Phase 87, DARK-01 edge case validation.
 * Target: download a file from a freeware site while ignoring fake ad download buttons.
 */

registerSiteGuide({
  site: 'Freeware Download Ad Avoidance',
  category: 'Utilities',
  patterns: [
    /freeware.download/i,
    /fake.download/i,
    /ad.avoidance/i,
    /sourceforge\.net/i,
    /filehippo\.com/i,
    /fosshub\.com/i,
    /majorgeeks\.com/i,
    /ninite\.com/i,
    /download.*button/i
  ],

  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic DARK-01):
- [dark] NEVER click the largest/first Download button -- verify href domain matches site before clicking
- [dark] Any download button inside an iframe is ALWAYS an ad -- eliminate all iframe-hosted elements first
- [dark] Check href for same-site domain (e.g. sourceforge.net/*) vs ad domains (doubleclick, googleads)
- [dark] Scan parent chain 3 levels up for ad container markers (ad-, sponsored, gpt-ad, banner)
- [dark] If uncertain, construct direct download URL from project pattern as fallback

FREEWARE DOWNLOAD AD AVOIDANCE INTELLIGENCE (DARK-01):

DARK PATTERN CONTEXT:
Freeware download sites monetize through ad networks that serve fake "Download"
buttons designed to look like the real download link. These ads are intentionally
styled to match the site's theme and are positioned near the real download button
to trick users into clicking them. The AI must use DOM analysis, NOT visual
similarity, to distinguish real from fake. A button that says "Download Now" in
large green text may be an advertisement, while the actual download link may be
smaller or less prominent. The href attribute and element context are the only
reliable signals.

TARGET SITES:

Primary target: sourceforge.net
  - Widely used open-source hosting site
  - Download pages (e.g., sourceforge.net/projects/vlc/files/ or
    sourceforge.net/projects/7zip/) contain a prominent green "Download" button
    for the real file, surrounded by ad-served banners and buttons
  - The real download link has href pointing to sourceforge.net/projects/*/files/*/download
    or downloads.sourceforge.net domain
  - Fake ad buttons are served inside iframes or have href pointing to ad network
    domains (googleadservices.com, doubleclick.net, adsrvr.org, etc.)

Secondary target: filehippo.com
  - Freeware aggregator with download pages containing both a real download button
    and multiple ad-served download banners
  - The real download button typically has an href containing
    filehippo.com/download_* pattern
  - Ad buttons often appear in div elements with class names containing "ad",
    "sponsored", or "banner"

Fallback 1: fosshub.com
  - Open-source software hosting, cleaner than SourceForge but still has ad
    banners near download buttons
  - Real download links point to fosshub.com/*/download or directly to the
    software file

Fallback 2: majorgeeks.com
  - Freeware download site with multiple mirror links
  - Real download links point to majorgeeks.com/mg/getmirror/* pattern
  - Ad download buttons link to external domains

Fallback 3: ninite.com
  - Bulk installer site with simpler layout
  - Useful as a contrast example where the download button is unambiguous
    (single "Get Your Ninite" button)

AD DETECTION HEURISTICS (8 indicators of fake download buttons):

Indicator 1: Ad network domains in href
  Links pointing to the following domains are ALWAYS ads:
  googleadservices.com, doubleclick.net, googleads.g.doubleclick.net,
  adsrvr.org, taboola.com, outbrain.com, revcontent.com, media.net,
  amazon-adsystem.com, pagead2.googlesyndication.com
  Any download button with href containing these domains is a fake ad button.

Indicator 2: Iframe wrapper
  Download buttons inside iframe elements are almost always ad-served. Real
  download buttons are in the page's own DOM, not inside iframes. Check the
  element ancestry -- if any parent is an iframe, the button is an ad.
  Common ad iframe patterns: iframe[src*="googleads"], iframe[src*="doubleclick"],
  iframe[src*="adsrvr"], iframe[id*="google_ads"].

Indicator 3: Ad-related CSS classes
  Class names containing any of these keywords indicate ad containers:
  ad, ads, advert, advertisement, sponsored, promoted, banner, promo, dfp,
  gpt-ad, taboola, outbrain. Check both the element itself and its parent
  containers up to 3 levels.

Indicator 4: data-ad-* attributes
  Elements with data-ad-slot, data-ad-client, data-ad-format,
  data-google-query-id, or data-ad-unit attributes are ad containers. These
  attributes are injected by ad serving scripts (Google AdSense, DFP) and are
  never present on real download buttons.

Indicator 5: Tracking redirect URLs
  Hrefs containing /aclk?, /pagead/, /redirect?, utm_source=ad, click.php,
  or /track/ are ad redirect chains, not direct downloads. Real download
  links point directly to the file or a download confirmation page on the
  same domain.

Indicator 6: External domain mismatch
  If the page is on sourceforge.net but the download button href points to a
  completely different domain (not downloads.sourceforge.net or
  master.dl.sourceforge.net), it is likely an ad. Real download links stay
  within the site's domain ecosystem.

Indicator 7: aria-label or title containing ad keywords
  Accessibility labels sometimes expose the ad nature of elements. Check
  aria-label and title attributes for keywords: "advertisement", "sponsored",
  "ad", "promoted". These labels are required by ad compliance standards and
  are reliable indicators.

Indicator 8: Parent container markers
  The download link's parent div/section having id or class containing "ad",
  "sponsor", "promo", "leaderboard", "skyscraper", "mpu" (medium placement
  unit), or "billboard" indicates an ad container. Real download buttons are
  typically inside content containers with classes like "download", "project",
  "file-info", or similar site-specific content identifiers.

REAL DOWNLOAD LINK IDENTIFICATION:
Strategy is ELIMINATION -- first identify and exclude all fake ad buttons using
the 8 indicators above, then among remaining download-like links, find the one
whose href points to the same domain or a known CDN/mirror of the site.

For SourceForge: href matches sourceforge.net/projects/*/files/*/download or
  downloads.sourceforge.net/* or master.dl.sourceforge.net/*
For FileHippo: href matches filehippo.com/download_*
For FossHub: href matches fosshub.com/*/download or the direct file CDN
For MajorGeeks: href matches majorgeeks.com/mg/getmirror/*

If multiple candidates remain after elimination, prefer:
  (a) Same-site href over external CDN
  (b) Most specific download path (contains file name or version)
  (c) Element with download-specific class names (e.g., "button green", "download-link")

VERIFICATION BEFORE CLICK:
Before clicking any download link, use get_attribute to extract the href and
verify it is NOT an ad domain. Use get_dom_snapshot to check if the element is
inside an iframe. Read the parent element's class/id for ad markers. Only click
after positive verification that:
  1. href points to expected download domain (same-site or known CDN)
  2. Element is NOT inside an iframe
  3. No ad-related parent containers
  4. No tracking redirect patterns in href
  5. No data-ad-* attributes on element or ancestors
Log the full href for the diagnostic report before clicking.`,

  selectors: {
    sourceforge: {
      realDownloadButton: 'a.button.green[href*="/download"], a[href*="downloads.sourceforge.net"], a[href*="/files/latest/download"]',
      projectTitle: '.project-info h1, #project-title',
      fileList: '#files_list a, .files a[href*="/download"]',
      downloadCount: '.download-count, .stats .count',
      adIframes: 'iframe[src*="googleads"], iframe[src*="doubleclick"], iframe[src*="adsrvr"], iframe[id*="google_ads"]',
      adContainers: 'div[id*="ad"], div[class*="ad-"], div[class*="advert"], div[data-ad-slot], ins.adsbygoogle, div[id*="gpt-ad"]'
    },
    filehippo: {
      realDownloadButton: 'a[href*="filehippo.com/download_"], a.download-link, a.program-header-download-link',
      programTitle: 'h1.program-header-title, h1.program-title',
      adContainers: 'div[class*="ad"], div[id*="ad-"], div[class*="banner"], iframe[src*="doubleclick"]'
    },
    fosshub: {
      realDownloadButton: 'a[href*="fosshub.com"][href*="download"], a.download-link',
      programTitle: 'h1, .program-name',
      adContainers: 'div[class*="ad"], iframe[src*="google"]'
    },
    majorgeeks: {
      realDownloadButton: 'a[href*="majorgeeks.com/mg/getmirror"], a.mirror-link',
      programTitle: 'h1, .program-title',
      adContainers: 'div[class*="ad"], div[id*="ad-"], iframe[src*="doubleclick"]'
    },
    adNetworkDomains: {
      patterns: 'googleadservices.com, doubleclick.net, googleads.g.doubleclick.net, adsrvr.org, taboola.com, outbrain.com, revcontent.com, media.net, amazon-adsystem.com, pagead2.googlesyndication.com'
    },
    fakeButtonIndicators: {
      iframeAds: 'iframe[src*="ad"], iframe[src*="doubleclick"], iframe[src*="google_ads"]',
      dataAdAttributes: '[data-ad-slot], [data-ad-client], [data-ad-format], [data-google-query-id]',
      adClasses: '[class*="advert"], [class*="sponsored"], [class*="promoted"], [class*="banner-ad"], [id*="gpt-ad"], ins.adsbygoogle',
      trackingRedirects: 'a[href*="/aclk?"], a[href*="/pagead/"], a[href*="click.php"], a[href*="/redirect?"]'
    }
  },

  workflows: {
    downloadRealFile: [
      'Step 1: NAVIGATE TO DOWNLOAD PAGE -- Navigate to the freeware download site page (e.g., sourceforge.net/projects/vlc/files/latest/download). Use read_page to capture the initial page content and verify the page loaded correctly with a project/program title visible.',

      'Step 2: SNAPSHOT ALL DOWNLOAD-LIKE ELEMENTS -- Use get_dom_snapshot to capture all elements that look like download buttons: links containing text "download", "get", "install", or similar action words. Also capture all iframe elements on the page. Record the total count of download-like elements found.',

      'Step 3: IDENTIFY AD IFRAMES -- From the snapshot, list all iframe elements. Check each iframe src attribute for ad network domains (googleadservices, doubleclick, adsrvr, taboola, outbrain). Mark all elements INSIDE iframes as FAKE AD. Elements in the main document DOM are candidates for the real button.',

      'Step 4: CHECK HREF DOMAINS -- For each download-like link in the main DOM (not in iframes), use get_attribute to extract the href. Classify each href: (a) same-site domain (e.g., sourceforge.net, downloads.sourceforge.net) = CANDIDATE for real download, (b) known ad network domain from adNetworkDomains list = FAKE AD, (c) tracking redirect URL pattern (/aclk?, /pagead/, click.php) = FAKE AD, (d) unknown external domain = SUSPICIOUS (investigate parent containers).',

      'Step 5: CHECK PARENT CONTAINERS -- For each remaining candidate link, examine the parent elements (div, section) for ad-related class names or IDs: ad, advert, sponsored, promoted, banner, gpt-ad, dfp, leaderboard, skyscraper, mpu. If the parent has ad markers, classify the child link as FAKE AD even if its href looks legitimate.',

      'Step 6: CHECK DATA ATTRIBUTES -- For each remaining candidate, check for data-ad-slot, data-ad-client, data-ad-format, data-google-query-id attributes on the element or its ancestors. Presence of any data-ad-* attribute = FAKE AD.',

      'Step 7: CHECK ARIA/TITLE LABELS -- For each remaining candidate, check aria-label and title attributes for keywords: "advertisement", "sponsored", "ad", "promoted". Presence of ad-related accessibility labels = FAKE AD.',

      'Step 8: IDENTIFY THE REAL DOWNLOAD LINK -- After eliminating all fake ad buttons (steps 3-7), the remaining download-like link(s) should be the real download. For SourceForge: the real button typically has class "button green" or href containing "/files/latest/download" or "downloads.sourceforge.net". If multiple candidates remain, prefer the one with (a) same-site href, (b) most specific download path, (c) largest visual size (likely the main call-to-action).',

      'Step 9: VERIFY BEFORE CLICK -- Before clicking the identified real download link, perform final verification: (a) get_attribute to confirm href points to expected download domain, (b) confirm the element is NOT inside an iframe, (c) confirm no ad-related parent containers, (d) confirm no tracking redirect patterns in href. Log the full href for the diagnostic report.',

      'Step 10: CLICK REAL DOWNLOAD LINK -- Click the verified real download link. Note: the browser may navigate to an intermediate download page (e.g., SourceForge shows a "your download will begin shortly" page before starting the actual file download). This is normal behavior -- do not interpret the intermediate page as failure.',

      'Step 11: VERIFY DOWNLOAD INITIATED -- After clicking, check the page state: (a) SourceForge shows a countdown page with "Your download will begin shortly" text, (b) the URL may change to a /download path, (c) the browser may show a download prompt (not detectable via DOM, but the page transition confirms the click target was correct). Use read_page to confirm the post-click page is a download confirmation, not an ad landing page.',

      'Step 12: REPORT -- State final outcome: number of fake ad buttons identified and skipped (with reasons for each), the real download link that was clicked (full href), whether the download confirmation page appeared (success) or an ad page appeared (failure -- wrong button clicked). Include a summary of which ad detection indicators were triggered and how many elements were eliminated at each step.'
    ]
  },

  warnings: [
    'DARK-01: NEVER click a download button without first verifying its href via get_attribute. Fake ad buttons are intentionally designed to look identical to real download buttons.',
    'Ad detection priority: check for iframes FIRST (fastest elimination), then href domain, then parent container classes, then data-ad-* attributes, then aria-label/title.',
    'SourceForge real download buttons typically have class "button green" or href containing "downloads.sourceforge.net". Any button inside an iframe is ALWAYS an ad on SourceForge.',
    'Some freeware sites have MULTIPLE pages before the actual download starts (e.g., SourceForge: project page -> files page -> download countdown page). Each page may have fresh ad buttons -- re-run ad detection on every page transition.',
    'If ALL download-like links are eliminated as ads, the page may be entirely ad-driven with no real download. Navigate directly to the known download URL pattern (e.g., sourceforge.net/projects/PROJECT/files/latest/download) to bypass the ad-heavy page.'
  ],

  toolPreferences: ['navigate', 'click', 'read_page', 'get_dom_snapshot', 'get_attribute']
});
