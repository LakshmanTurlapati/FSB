/**
 * Cross-Site Pattern Analysis Module
 *
 * Analyzes sitemap memories across multiple domains to find recurring
 * UI patterns (login forms, search bars, navigation structures) and
 * stores results as a reusable "common patterns" semantic memory.
 *
 * This module uses local heuristic analysis only -- no AI calls.
 * Analysis runs only during manual consolidation to avoid excess cost.
 *
 * Depends on: memory-schemas.js (createSemanticMemory)
 */

/**
 * Main entry point: analyze all memories for cross-site patterns.
 *
 * @param {Object[]} allMemories - All stored memories from MemoryStorage
 * @returns {Promise<Object|null>} A semantic memory object with cross-site patterns, or null if insufficient data
 */
async function analyzeCrossSitePatterns(allMemories) {
  if (!allMemories || !Array.isArray(allMemories)) {
    return null;
  }

  // Filter to sitemap memories only
  const sitemapMemories = allMemories.filter(
    m => m.typeData && m.typeData.category === 'site_map'
  );

  if (sitemapMemories.length === 0) {
    return null;
  }

  // Group by domain
  const byDomain = groupSitemapsByDomain(sitemapMemories);
  const domainNames = Object.keys(byDomain);

  // Need at least 2 domains for cross-site analysis
  if (domainNames.length < 2) {
    return null;
  }

  // Extract structural patterns per domain
  const domainPatterns = {};
  for (const domain of domainNames) {
    // Use the most recent sitemap for each domain
    const domainSitemaps = byDomain[domain];
    const latest = domainSitemaps.reduce((a, b) =>
      (a.updatedAt || a.createdAt) > (b.updatedAt || b.createdAt) ? a : b
    );
    domainPatterns[domain] = extractDomainPatterns(latest);
  }

  // Find patterns appearing in 2+ domains
  const commonFormTypes = findCommonItems(
    domainNames.map(d => domainPatterns[d].formTypes)
  );
  const sharedSelectorPatterns = findCommonItems(
    domainNames.map(d => domainPatterns[d].selectorPatterns)
  );
  const commonNavPatterns = findCommonItems(
    domainNames.map(d => domainPatterns[d].navPatterns)
  );
  const commonWorkflows = findCommonItems(
    domainNames.map(d => domainPatterns[d].pageTypes)
  );

  const totalPatterns = commonFormTypes.length + sharedSelectorPatterns.length
    + commonNavPatterns.length + commonWorkflows.length;

  // Create a semantic memory for the cross-site patterns
  const patternMemory = createSemanticMemory(
    `Cross-site patterns: ${domainNames.length} domains analyzed, ${totalPatterns} common patterns found`,
    {
      domain: null,
      tags: ['cross-site', 'patterns', 'auto-generated'],
      confidence: 0.7
    },
    {
      category: 'cross_site_pattern',
      sitePattern: {
        domains: domainNames,
        commonFormTypes,
        sharedSelectorPatterns,
        commonNavPatterns,
        commonWorkflows,
        analyzedAt: Date.now()
      }
    }
  );

  return patternMemory;
}

/**
 * Group an array of sitemap memories by their metadata.domain field.
 *
 * @param {Object[]} sitemapMemories - Array of memories with category 'site_map'
 * @returns {Object} Map of domain -> [memory, ...]
 */
function groupSitemapsByDomain(sitemapMemories) {
  const byDomain = {};
  for (const memory of sitemapMemories) {
    const domain = (memory.metadata && memory.metadata.domain) || 'unknown';
    if (!byDomain[domain]) {
      byDomain[domain] = [];
    }
    byDomain[domain].push(memory);
  }
  return byDomain;
}

/**
 * Extract structured patterns from a single sitemap memory.
 * Uses simple heuristics -- no AI calls.
 *
 * @param {Object} sitemapMemory - A memory with typeData.sitePattern
 * @returns {{ formTypes: string[], navPatterns: string[], selectorPatterns: string[], pageTypes: string[] }}
 */
function extractDomainPatterns(sitemapMemory) {
  const sitePattern = (sitemapMemory.typeData && sitemapMemory.typeData.sitePattern) || {};

  return {
    formTypes: classifyForms(sitePattern.forms || []),
    navPatterns: classifyNavigation(sitePattern.navigation || []),
    selectorPatterns: classifySelectorStrategies(sitePattern.keySelectors || {}),
    pageTypes: classifyPages(sitePattern.pages || {})
  };
}

// --- Internal helpers ---

/**
 * Classify forms by their field names into types like login, search, registration, contact.
 */
function classifyForms(forms) {
  const types = new Set();

  for (const form of forms) {
    const fields = (form.fields || []).map(f => (typeof f === 'string' ? f : '').toLowerCase());
    const allFields = fields.join(' ');

    if (hasAny(allFields, ['password', 'login', 'signin', 'sign_in'])) {
      if (hasAny(allFields, ['confirm', 'register', 'signup', 'sign_up', 'create'])) {
        types.add('registration');
      } else {
        types.add('login');
      }
    }
    if (hasAny(allFields, ['search', 'query', 'q', 'keyword'])) {
      types.add('search');
    }
    if (hasAny(allFields, ['email', 'message', 'subject', 'contact'])) {
      types.add('contact');
    }
    if (hasAny(allFields, ['subscribe', 'newsletter'])) {
      types.add('newsletter');
    }
    if (hasAny(allFields, ['payment', 'card', 'billing', 'checkout'])) {
      types.add('checkout');
    }
    // Generic form if nothing specific matched
    if (types.size === 0 && fields.length > 0) {
      types.add('generic-form');
    }
  }

  return Array.from(types);
}

/**
 * Classify navigation structures by item count and content.
 */
function classifyNavigation(navigation) {
  const patterns = new Set();

  if (!Array.isArray(navigation) || navigation.length === 0) {
    return [];
  }

  // Categorize by volume
  if (navigation.length > 10) {
    patterns.add('rich-navigation');
  } else if (navigation.length > 3) {
    patterns.add('standard-navigation');
  } else {
    patterns.add('minimal-navigation');
  }

  // Look for common nav link patterns
  const labels = navigation.map(n => ((n.label || n.text || '') + ' ' + (n.path || '')).toLowerCase());
  const allLabels = labels.join(' ');

  if (hasAny(allLabels, ['home', 'dashboard'])) {
    patterns.add('has-home-link');
  }
  if (hasAny(allLabels, ['settings', 'preferences', 'config', 'account'])) {
    patterns.add('has-settings');
  }
  if (hasAny(allLabels, ['help', 'support', 'faq', 'docs'])) {
    patterns.add('has-help');
  }
  if (hasAny(allLabels, ['login', 'signin', 'sign in', 'register', 'signup'])) {
    patterns.add('has-auth-links');
  }

  return Array.from(patterns);
}

/**
 * Classify selector strategies used across pages.
 * Identifies patterns like "uses data-testid", "uses aria-label", "id-based", etc.
 */
function classifySelectorStrategies(keySelectors) {
  const strategies = new Set();

  // keySelectors is { path: [selector1, selector2, ...] }
  const allSelectors = [];
  if (typeof keySelectors === 'object' && keySelectors !== null) {
    for (const selectors of Object.values(keySelectors)) {
      if (Array.isArray(selectors)) {
        allSelectors.push(...selectors);
      }
    }
  }

  if (allSelectors.length === 0) {
    return [];
  }

  for (const selector of allSelectors) {
    const s = typeof selector === 'string' ? selector : '';
    if (s.includes('data-testid') || s.includes('data-test')) {
      strategies.add('uses-data-testid');
    }
    if (s.includes('aria-label') || s.includes('aria-')) {
      strategies.add('uses-aria-attributes');
    }
    if (s.includes('[role=')) {
      strategies.add('uses-role-attributes');
    }
    if (s.startsWith('#') || s.includes('#')) {
      strategies.add('uses-id-selectors');
    }
    if (s.startsWith('.') || s.includes('.')) {
      strategies.add('uses-class-selectors');
    }
    if (s.includes('data-') && !s.includes('data-testid') && !s.includes('data-test')) {
      strategies.add('uses-data-attributes');
    }
  }

  return Array.from(strategies);
}

/**
 * Classify pages by their content/purpose based on page info.
 */
function classifyPages(pages) {
  const types = new Set();

  // pages is { path: { title, elementCount, formCount, linkCount, ... } }
  if (typeof pages !== 'object' || pages === null) {
    return [];
  }

  for (const [path, info] of Object.entries(pages)) {
    const pathLower = (path || '').toLowerCase();
    const titleLower = ((info && info.title) || '').toLowerCase();
    const combined = pathLower + ' ' + titleLower;

    if (pathLower === '/' || pathLower === '/index' || hasAny(combined, ['home', 'landing', 'welcome'])) {
      types.add('landing-page');
    }
    if (hasAny(combined, ['login', 'signin', 'sign-in', 'auth'])) {
      types.add('auth-page');
    }
    if (hasAny(combined, ['search', 'results', 'browse', 'explore', 'list'])) {
      types.add('list-page');
    }
    if (hasAny(combined, ['detail', 'view', 'show', 'profile', 'item'])) {
      types.add('detail-page');
    }
    if (hasAny(combined, ['dashboard', 'admin', 'panel'])) {
      types.add('dashboard-page');
    }
    if (hasAny(combined, ['settings', 'preferences', 'config', 'account'])) {
      types.add('settings-page');
    }
    if (hasAny(combined, ['contact', 'feedback', 'support'])) {
      types.add('contact-page');
    }
    if (info && info.formCount > 0) {
      types.add('form-page');
    }
  }

  return Array.from(types);
}

/**
 * Find items that appear in 2+ of the given arrays.
 * @param {string[][]} arrays - Array of string arrays, one per domain
 * @returns {string[]} Items appearing in at least 2 arrays
 */
function findCommonItems(arrays) {
  if (!arrays || arrays.length < 2) return [];

  const counts = {};
  for (const arr of arrays) {
    // Deduplicate within each domain's array
    const unique = new Set(arr);
    for (const item of unique) {
      counts[item] = (counts[item] || 0) + 1;
    }
  }

  return Object.keys(counts).filter(item => counts[item] >= 2);
}

/**
 * Check if a string contains any of the given keywords.
 */
function hasAny(str, keywords) {
  return keywords.some(kw => str.includes(kw));
}

// Export for service worker (importScripts) and module contexts
if (typeof self !== 'undefined') {
  self.analyzeCrossSitePatterns = analyzeCrossSitePatterns;
  self.groupSitemapsByDomain = groupSitemapsByDomain;
  self.extractDomainPatterns = extractDomainPatterns;
}
