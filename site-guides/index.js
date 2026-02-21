/**
 * Site Guides Registry
 * URL pattern matching and guide loader for domain-specific AI guidance.
 * Loads only the relevant guide per page to reduce token usage and improve accuracy.
 */

// All guide modules are loaded via importScripts in background.js
// They register themselves on the global SITE_GUIDES array

// Global registry of all loaded guides
const SITE_GUIDES_REGISTRY = [];

// Category-level metadata and shared guidance storage
const CATEGORY_GUIDANCE = {};

/**
 * Register a site guide into the registry.
 * Called by each guide module on load.
 * Supports both old category format (guide.name + guide.patterns) and
 * new per-site format (guide.site + guide.category + guide.patterns).
 * @param {Object} guide - The guide object with name/site, patterns, guidance, etc.
 */
function registerSiteGuide(guide) {
  if (guide && guide.patterns && (guide.name || guide.site)) {
    SITE_GUIDES_REGISTRY.push(guide);
  }
}

/**
 * Register category-level metadata (icon, shared guidance, warnings).
 * Called by each category _shared.js file.
 * @param {Object} meta - Category metadata with category, icon, guidance, warnings
 */
function registerCategoryGuidance(meta) {
  if (meta && meta.category) {
    CATEGORY_GUIDANCE[meta.category] = meta;
  }
}

/**
 * Get all per-site guides grouped by category name.
 * Only includes guides that have a .site property (per-site format).
 * @returns {Object} Object keyed by category name, values are arrays of per-site guides
 */
function getSiteGuidesByCategory() {
  const grouped = {};
  for (const guide of SITE_GUIDES_REGISTRY) {
    if (!guide.site) continue;
    const cat = guide.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(guide);
  }
  return grouped;
}

/**
 * Get category metadata (icon, shared guidance, warnings).
 * @param {string} category - The category name
 * @returns {Object|null} Category metadata or null
 */
function getCategoryGuidance(category) {
  return CATEGORY_GUIDANCE[category] || null;
}

/**
 * Get the total count of per-site guides (guides with .site property).
 * @returns {number} Count of per-site guides
 */
function getTotalSiteCount() {
  return SITE_GUIDES_REGISTRY.filter(g => g.site).length;
}

/**
 * Extract the base domain from a URL string.
 * E.g., "https://www.amazon.com/dp/B09V..." -> "amazon"
 * @param {string} url
 * @returns {string|null} The base domain key (e.g., "amazon", "linkedin")
 */
function extractDomain(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Extract the main domain name (before the TLD)
    // Handles: amazon.com, amazon.co.uk, finance.yahoo.com
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      // Check for subdomains that are part of the brand (e.g., finance.yahoo.com)
      const knownSubdomains = ['finance', 'mail', 'drive', 'docs', 'maps'];
      if (parts.length >= 3 && knownSubdomains.includes(parts[0])) {
        return parts[0] + '.' + parts[1]; // e.g., "finance.yahoo"
      }
      // For country-code TLDs like .co.uk, .com.au
      if (parts.length >= 3 && (parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'com')) {
        return parts[parts.length - 3];
      }
      return parts[parts.length - 2];
    }
    return hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Find the matching guide for a given URL by testing URL patterns.
 * @param {string} url - The current page URL
 * @returns {Object|null} The matched guide or null
 */
function getGuideForUrl(url) {
  if (!url) return null;
  for (const guide of SITE_GUIDES_REGISTRY) {
    if (guide.patterns.some(pattern => pattern.test(url))) {
      return guide;
    }
  }
  return null;
}

/**
 * Hybrid guide lookup: checks URL first, falls back to task keyword matching.
 * Maps task types to guide categories.
 * @param {string} task - The user's task description
 * @param {string} url - The current page URL (optional)
 * @returns {Object|null} The matched guide or null
 */
function getGuideForTask(task, url) {
  // Primary: URL-based match
  if (url) {
    const urlGuide = getGuideForUrl(url);
    if (urlGuide) return urlGuide;
  }

  // Fallback: task keyword matching
  if (!task) return null;
  const taskLower = task.toLowerCase();

  // Map keywords to guide category names
  const categoryKeywords = {
    'E-Commerce & Shopping': [
      'buy', 'purchase', 'order', 'add to cart', 'checkout', 'shop',
      'product', 'amazon', 'ebay', 'walmart', 'price compare'
    ],
    'Social Media': [
      'post', 'tweet', 'message', 'dm', 'linkedin', 'twitter',
      'facebook', 'instagram', 'reddit', 'connect', 'follow',
      'comment', 'like', 'share', 'profile',
      'youtube', 'video', 'subscribe', 'watch', 'channel'
    ],
    'Coding Platforms': [
      'leetcode', 'hackerrank', 'codeforces', 'github',
      'solve problem', 'coding challenge', 'submit solution',
      'pull request', 'repository', 'geeksforgeeks',
      'copilot', 'commit', 'branch', 'issue', 'star'
    ],
    'Travel & Booking': [
      'flight', 'hotel', 'booking', 'travel', 'airline',
      'reservation', 'airbnb', 'expedia', 'trip'
    ],
    'Finance & Trading': [
      'stock', 'finance', 'trading', 'portfolio', 'invest',
      'market', 'crypto', 'robinhood', 'fidelity', 'watchlist'
    ],
    'Email Platforms': [
      'email', 'mail', 'gmail', 'outlook', 'compose',
      'send email', 'inbox', 'reply', 'forward', 'draft', 'recipient'
    ],
    'Gaming Platforms': [
      'steam', 'epic games', 'gog', 'humble bundle',
      'game price', 'game store', 'wishlist', 'dlc'
    ],
    'Career & Job Search': [
      'career', 'job', 'jobs', 'position', 'opening',
      'hiring', 'employment', 'indeed', 'glassdoor',
      'linkedin jobs', 'builtin', 'job search', 'job listing'
    ],
    'Productivity Tools': [
      'google sheets', 'spreadsheet', 'sheets', 'google docs',
      'create sheet', 'new sheet', 'add to sheet', 'enter data',
      'create document', 'new document', 'write document', 'google doc',
      'share document', 'edit document'
    ]
  };

  // Require at least 2 keyword matches to avoid false positives
  // (e.g., "search for hotels" matching Social Media because of "share" substring)
  let bestMatch = null;
  let bestMatchCount = 0;
  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    const matchCount = keywords.filter(kw => taskLower.includes(kw)).length;
    if (matchCount >= 2 && matchCount > bestMatchCount) {
      const guide = SITE_GUIDES_REGISTRY.find(g => g.name === categoryName);
      if (guide) {
        bestMatch = guide;
        bestMatchCount = matchCount;
      }
    }
  }
  if (bestMatch) return bestMatch;

  return null;
}

/**
 * Format a selectors object into a readable string for prompt injection.
 * @param {Object} selectors - Key-value pairs of selector names and CSS selectors
 * @returns {string} Formatted selector list
 */
function formatSelectors(selectors) {
  if (!selectors || typeof selectors !== 'object') return '';
  return Object.entries(selectors)
    .map(([name, selector]) => `- ${name}: ${selector}`)
    .join('\n');
}
