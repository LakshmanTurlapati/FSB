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
      'hiring', 'employment', 'internship', 'internships', 'indeed', 'glassdoor',
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
      const guide = SITE_GUIDES_REGISTRY.find(g => g.name === categoryName || g.category === categoryName);
      if (guide) {
        bestMatch = guide;
        bestMatchCount = matchCount;
      }
    }
  }
  if (bestMatch) return bestMatch;

  return null;
}

// Company name aliases mapping to exact .site values in career guides.
// Each alias target MUST exactly match a registered career guide .site value.
const COMPANY_ALIASES = {
  'jpmorgan': 'JPMorgan Chase',
  'jp morgan': 'JPMorgan Chase',
  'jp morgan chase': 'JPMorgan Chase',
  'jpm': 'JPMorgan Chase',
  'bofa': 'Bank of America',
  'boa': 'Bank of America',
  'bank of america': 'Bank of America',
  'cap one': 'Capital One',
  'meta': 'Meta',
  'facebook': 'Meta',
  'cvs': 'CVS Health',
  'jnj': 'Johnson & Johnson',
  'j&j': 'Johnson & Johnson',
  'johnson & johnson': 'Johnson & Johnson',
  'johnson and johnson': 'Johnson & Johnson',
  'lm': 'Lockheed Martin',
  'lockheed': 'Lockheed Martin',
  'uhg': 'UnitedHealth Group',
  'unitedhealth': 'UnitedHealth Group',
  'amex': 'American Express',
  'american express': 'American Express',
  'ti': 'Texas Instruments',
  'texas instruments': 'Texas Instruments',
  'mr cooper': 'Mr. Cooper',
  'mrcooper': 'Mr. Cooper',
  'gs': 'Goldman Sachs',
  'goldman': 'Goldman Sachs',
  'ms': 'Morgan Stanley',
  'morgan stanley': 'Morgan Stanley',
  'goog': 'Google Careers',
  'google': 'Google Careers',
  'openai': 'OpenAI',
  'att': 'AT&T',
  'at&t': 'AT&T',
  'homedepot': 'Home Depot',
  'home depot': 'Home Depot',
  'lowes': "Lowe's",
  "lowe's": "Lowe's"
};

/**
 * Look up a career site guide by company name or alias.
 * Supports exact alias match, direct .site match, and partial match.
 * Only returns guides in the 'Career & Job Search' category.
 * @param {string} companyName - The company name or alias to look up
 * @returns {Object|null} The matched career guide or null
 */
function getGuideByCompanyName(companyName) {
  if (!companyName) return null;
  const nameLower = companyName.toLowerCase().trim();
  if (!nameLower) return null;

  // 1. Check alias map first
  const aliasTarget = COMPANY_ALIASES[nameLower];
  if (aliasTarget) {
    const aliasGuide = SITE_GUIDES_REGISTRY.find(
      g => g.category === 'Career & Job Search' && g.site === aliasTarget
    );
    if (aliasGuide) return aliasGuide;
  }

  // 2. Direct .site name match (case-insensitive)
  const directMatch = SITE_GUIDES_REGISTRY.find(
    g => g.category === 'Career & Job Search' &&
      g.site && g.site.toLowerCase() === nameLower
  );
  if (directMatch) return directMatch;

  // 3. Partial match (company name contained in guide site name or vice versa)
  const partialMatch = SITE_GUIDES_REGISTRY.find(
    g => g.category === 'Career & Job Search' &&
      g.site && (
        g.site.toLowerCase().includes(nameLower) ||
        nameLower.includes(g.site.toLowerCase())
      )
  );
  return partialMatch || null;
}

/**
 * Extract a company name from a natural language task string.
 * Matches patterns like "at [Company]", "jobs at [Company]", "[Company] careers".
 * Handles multi-word company names by capturing until end of string or a stopword.
 * @param {string} taskString - The user's task description
 * @returns {string|null} The extracted company name or null
 */
function extractCompanyFromTask(taskString) {
  if (!taskString) return null;
  const task = taskString.trim();
  if (!task) return null;

  // Words that are NOT company names (job-related nouns, verbs, adjectives)
  const nonCompanyWords = [
    'find', 'search', 'look', 'get', 'show', 'list', 'browse', 'check', 'view',
    'software', 'engineering', 'tech', 'remote', 'senior', 'junior', 'lead',
    'jobs', 'job', 'careers', 'career', 'openings', 'opening', 'positions',
    'position', 'roles', 'role', 'internships', 'internship', 'hiring',
    'the', 'this', 'that', 'their', 'a', 'an', 'all', 'any', 'some',
    'new', 'best', 'top', 'open', 'available'
  ];

  // Pattern 1 (primary): "at [Company]" -- most reliable indicator
  // Matches the LAST occurrence of "at" followed by a capitalized word
  // to handle "search for openings at Goldman Sachs"
  const atMatches = [...task.matchAll(/\bat\s+([A-Z][\w&.\-']+(?:\s+[A-Z&][\w&.\-']*)*)/gi)];
  if (atMatches.length > 0) {
    // Use the last "at [X]" match -- it's most likely the company
    const lastMatch = atMatches[atMatches.length - 1];
    const candidate = lastMatch[1].trim();
    if (!nonCompanyWords.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Pattern 2: "[Company] careers" / "[Company] jobs" / "[Company] openings"
  // Capture the word(s) immediately before the job-related suffix.
  // Use a greedy match but then filter out non-company words from the result.
  const suffixPattern = /(?:^|\s)([A-Z][\w&.\-']+(?:\s+[A-Z&][\w&.\-']*)*)\s+(?:careers?|jobs?|openings?|positions?|hiring|employment)/i;
  const suffixMatch = task.match(suffixPattern);
  if (suffixMatch && suffixMatch[1]) {
    // Clean: if the captured group contains prepositions, take only the last segment
    const parts = suffixMatch[1].split(/\s+(?:for|at|on|in)\s+/i);
    const candidate = parts[parts.length - 1].trim();
    if (candidate && !nonCompanyWords.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Pattern 3: "for [Company]" -- only when "for" precedes a non-job-word
  // Does not require end-of-string to handle "for Microsoft in Texas"
  const forPattern = /\bfor\s+([A-Z][\w&.\-']+(?:\s+[A-Z&][\w&.\-']*)*)/i;
  const forMatch = task.match(forPattern);
  if (forMatch && forMatch[1]) {
    const firstWord = forMatch[1].split(/\s+/)[0].toLowerCase();
    if (!nonCompanyWords.includes(firstWord)) {
      return forMatch[1].trim();
    }
  }

  // Pattern 4: "on [Company]" (e.g., "search on Indeed")
  // Take only the first word(s) that look like a company name, stop at prepositions
  const onPattern = /\bon\s+([A-Z][\w&.\-']+(?:\s+[A-Z&][\w&.\-']*)*)/i;
  const onMatch = task.match(onPattern);
  if (onMatch && onMatch[1]) {
    // Strip trailing preposition-led phrases: "Indeed for software" -> "Indeed"
    const cleaned = onMatch[1].replace(/\s+(?:for|at|in|to|with)\s+.*/i, '').trim();
    if (cleaned && !nonCompanyWords.includes(cleaned.toLowerCase())) {
      return cleaned;
    }
  }

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
