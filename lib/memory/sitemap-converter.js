/**
 * Sitemap Converter (Tier 1) - Local data transformer
 * Converts raw Site Explorer research data into a structured sitePattern
 * object suitable for storage as a site_map memory.
 *
 * Input: research object from fsbResearchData[researchId]
 * Output: sitePattern object for createSiteMapMemory()
 */

function convertToSiteMap(research) {
  if (!research || !research.pages) {
    return null;
  }

  const pages = {};
  const navigationSet = new Map(); // label -> path, deduped
  const forms = [];
  const keySelectors = {};

  for (const page of research.pages) {
    let path;
    try {
      path = new URL(page.url).pathname;
    } catch {
      continue;
    }

    // Build pages object keyed by pathname
    pages[path] = {
      title: page.title || '',
      elementCount: page.interactiveElements?.length || 0,
      formCount: page.forms?.length || 0,
      linkCount: page.internalLinks?.length || 0
    };

    // Collect navigation items (deduplicate by path)
    if (page.navigation && Array.isArray(page.navigation)) {
      for (const nav of page.navigation) {
        const navPath = nav.href || nav.path || nav.url;
        if (navPath && nav.text) {
          try {
            const parsed = new URL(navPath, page.url);
            const normalizedPath = parsed.pathname;
            if (!navigationSet.has(normalizedPath)) {
              navigationSet.set(normalizedPath, {
                label: nav.text.trim().substring(0, 60),
                path: normalizedPath
              });
            }
          } catch {
            // Skip invalid nav URLs
          }
        }
      }
    }

    // Extract form metadata
    if (page.forms && Array.isArray(page.forms)) {
      for (const form of page.forms) {
        forms.push({
          page: path,
          fields: (form.fields || form.inputs || []).map(f =>
            typeof f === 'string' ? f : (f.name || f.type || 'unknown')
          ),
          action: form.action || form.method || 'submit'
        });
      }
    }

    // Collect key selectors per page
    if (page.keySelectors && Array.isArray(page.keySelectors) && page.keySelectors.length > 0) {
      keySelectors[path] = page.keySelectors.slice(0, 20);
    }
  }

  const totalForms = forms.length;
  const navigation = Array.from(navigationSet.values());

  return {
    domain: research.domain || '',
    pages,
    navigation,
    forms,
    keySelectors,
    workflows: [],  // Empty for Tier 1, populated by Tier 2
    tips: [],       // Empty for Tier 1, populated by Tier 2
    source: 'recon',
    refined: false,
    refinedAt: null,
    reconId: research.id,
    pageCount: research.pages.length,
    formCount: totalForms,
    crawledAt: research.startTime || Date.now()
  };
}

// Export for page contexts and service worker
if (typeof self !== 'undefined') {
  self.convertToSiteMap = convertToSiteMap;
}
