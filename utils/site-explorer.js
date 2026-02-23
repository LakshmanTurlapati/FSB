// FSB Site Explorer - Automated Site Reconnaissance Tool
// BFS crawls a website, maps interactive structure, saves as downloadable research JSON

class SiteExplorer {
  constructor(crawlerId = null) {
    this.crawlerId = crawlerId;  // Unique ID assigned by CrawlerManager
    this.tabId = null;
    this.urlQueue = [];        // [{url, depth}]
    this.visited = new Set();
    this.pagesCollected = [];
    this.running = false;
    this.researchId = null;
    this.startUrl = null;
    this.domain = null;
    this.startTime = null;
    this.maxDepth = 3;
    this.maxPages = 25;
    this.currentUrl = null;
    this.status = 'idle';      // idle | crawling | completed | stopped | error
    this.callerTabId = null;   // tab to switch back to after crawl
    this.onComplete = null;    // Callback for CrawlerManager cleanup
  }

  /**
   * Start a site exploration crawl
   * @param {string} url - Starting URL
   * @param {Object} options - Crawl options
   * @returns {Object} - { success, researchId }
   */
  async start(url, { maxDepth = 3, maxPages = 25, callerTabId = null, autoSaveToMemory = false } = {}) {
    if (this.running) {
      return { success: false, error: 'Explorer is already running' };
    }

    try {
      // Normalize and validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      const parsed = new URL(url);
      this.domain = parsed.hostname;
      this.startUrl = url;
      this.maxDepth = Math.min(maxDepth, 5);
      this.maxPages = Math.min(maxPages, 50);
      this.researchId = 'research_' + Date.now();
      this.startTime = Date.now();
      this.running = true;
      this.status = 'crawling';
      this.urlQueue = [{ url, depth: 0 }];
      this.visited = new Set();
      this.pagesCollected = [];
      this.currentUrl = null;
      this.callerTabId = callerTabId;
      this.autoSaveToMemory = autoSaveToMemory;

      console.log(`[SiteExplorer] Starting crawl of ${this.domain} (depth=${this.maxDepth}, pages=${this.maxPages})`);

      // Create crawler tab in background so user's active tab is undisturbed
      const tab = await chrome.tabs.create({ url, active: false });
      this.tabId = tab.id;

      // Keep service worker alive during crawl
      startKeepAlive();

      this.broadcastStatus();

      // Fire-and-forget: run crawl loop in background so sendResponse returns immediately
      this.crawlLoop().catch(error => {
        console.error('[SiteExplorer] crawlLoop error:', error?.message || error);
        console.error('[SiteExplorer] crawlLoop stack:', error?.stack || 'no stack');
        console.error(`[SiteExplorer] State at error: pages=${this.pagesCollected.length}, queue=${this.urlQueue.length}, visited=${this.visited.size}`);
        this.status = 'error';
        this.running = false;
        this._sendOverlayMessage('hideCrawlOverlay').catch(() => {});
        this.saveResearch('error').catch(() => {});
        this.switchBackToCallerTab().catch(() => {});
        this.broadcastStatus();
        if (this.onComplete) {
          try { this.onComplete(); } catch (e) { /* ignore */ }
        }
      });

      return { success: true, researchId: this.researchId };
    } catch (error) {
      console.error('[SiteExplorer] Start failed:', error);
      this.status = 'error';
      this.running = false;
      await this.saveResearch('error');
      await this.switchBackToCallerTab();
      this.broadcastStatus();
      if (this.onComplete) {
        try { this.onComplete(); } catch (e) { /* ignore */ }
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop the current crawl
   */
  async stop() {
    if (!this.running) {
      return { success: false, error: 'Explorer is not running' };
    }

    console.log('[SiteExplorer] Stopping crawl...');
    this.running = false;
    this.status = 'stopped';

    // Hide in-page overlay before closing tab
    await this._sendOverlayMessage('hideCrawlOverlay');

    // Save partial results
    await this.saveResearch('stopped');

    // Clean up tab
    if (this.tabId) {
      try {
        await chrome.tabs.remove(this.tabId);
      } catch (e) {
        // Tab may already be closed
      }
      this.tabId = null;
    }

    // Switch focus back to the caller tab
    await this.switchBackToCallerTab();

    this.broadcastStatus();

    // Notify CrawlerManager for cleanup
    if (this.onComplete) {
      try { this.onComplete(); } catch (e) { /* ignore */ }
    }

    return { success: true, pagesCollected: this.pagesCollected.length };
  }

  /**
   * BFS crawl loop
   */
  async crawlLoop() {
    while (this.urlQueue.length > 0 && this.running && this.pagesCollected.length < this.maxPages) {
      const { url, depth } = this.urlQueue.shift();

      // Skip if already visited or too deep
      if (this.visited.has(url) || depth > this.maxDepth) {
        continue;
      }

      this.visited.add(url);
      this.currentUrl = url;
      this.broadcastStatus();

      try {
        const pageData = await this.collectPageData(url, depth);
        if (pageData) {
          this.pagesCollected.push(pageData);
          this.broadcastStatus();

          // Extract internal links and add to queue
          if (pageData.internalLinks && depth < this.maxDepth) {
            let addedCount = 0;
            for (const link of pageData.internalLinks) {
              if (link.url && !this.visited.has(link.url) && this.isSameDomain(link.url)) {
                this.urlQueue.push({ url: link.url, depth: depth + 1 });
                addedCount++;
              }
            }
            console.log(`[SiteExplorer] Queued ${addedCount} new links from ${url} (queue size: ${this.urlQueue.length})`);
          }
        }
      } catch (error) {
        console.warn(`[SiteExplorer] Failed to collect data for ${url}:`, error.message);
      }

      // Delay between pages to avoid overwhelming the site
      if (this.running && this.urlQueue.length > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Crawl finished
    if (this.running) {
      this.status = 'completed';
      this.running = false;

      // Hide in-page overlay before closing tab
      await this._sendOverlayMessage('hideCrawlOverlay');

      await this.saveResearch('completed');

      // Auto-convert crawl results to site map memory if requested
      if (this.autoSaveToMemory) {
        try {
          await this.autoConvertToMemory();
        } catch (err) {
          console.warn('[SiteExplorer] Auto memory save failed:', err.message);
        }
      }

      // Close the crawler tab
      if (this.tabId) {
        try {
          await chrome.tabs.remove(this.tabId);
        } catch (e) {
          // Tab may already be closed
        }
        this.tabId = null;
      }

      // Switch focus back to the caller tab
      await this.switchBackToCallerTab();

      this.broadcastStatus();
      console.log(`[SiteExplorer] Crawl completed: ${this.pagesCollected.length} pages collected`);

      // Notify CrawlerManager for cleanup
      if (this.onComplete) {
        try { this.onComplete(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Collect data from a single page
   * @param {string} url - Page URL
   * @param {number} depth - Current crawl depth
   * @returns {Object|null} - Page data or null on failure
   */
  async collectPageData(url, depth) {
    if (!this.tabId) return null;

    // For the first URL (depth 0, first page), the tab was already created with this URL
    // so skip the redundant chrome.tabs.update to avoid onUpdated not firing properly.
    const isFirstPage = depth === 0 && this.pagesCollected.length === 0;
    if (!isFirstPage) {
      await chrome.tabs.update(this.tabId, { url });
    }

    // Wait for page to finish loading
    await this.waitForTabLoad(this.tabId);

    // Ensure content script is injected
    await ensureContentScriptInjected(this.tabId);
    await waitForContentScriptReady(this.tabId);

    // Wait for page to settle using DOM stability detection, with fallback
    await this.waitForPageSettle(this.tabId);

    // Show in-page crawl overlay after content script is ready
    await this._sendOverlayMessage('showCrawlOverlay', this._getOverlayData());

    // Scroll page to trigger lazy-loaded content (LinkedIn, infinite scroll sites)
    await this.scrollForDiscovery(this.tabId);

    // Get DOM structure
    let domData = null;
    try {
      domData = await this.sendTabMessage(this.tabId, {
        action: 'getDOM',
        options: { maxElements: 500, prioritizeViewport: false }
      });
    } catch (error) {
      console.warn(`[SiteExplorer] getDOM failed for ${url}:`, error.message);
    }

    // Get explorer-specific data
    let explorerData = null;
    try {
      explorerData = await this.sendTabMessage(this.tabId, {
        action: 'getExplorerData'
      });
    } catch (error) {
      console.warn(`[SiteExplorer] getExplorerData failed for ${url}:`, error.message);
    }

    // Get page title and meta from the tab
    let tabInfo = null;
    try {
      tabInfo = await chrome.tabs.get(this.tabId);
    } catch (e) {
      // Tab may be gone
    }

    // Build page data object
    const pageData = {
      url,
      depth,
      title: tabInfo?.title || '',
      timestamp: Date.now(),
      interactiveElements: [],
      forms: [],
      navigation: [],
      headings: [],
      layout: {},
      internalLinks: [],
      keySelectors: []
    };

    // Merge DOM data
    if (domData && domData.success && domData.structuredDOM) {
      const dom = domData.structuredDOM;
      pageData.interactiveElements = (dom.elements || []).map(el => ({
        elementId: el.elementId,
        type: el.type,
        text: el.text,
        id: el.id,
        class: el.class,
        selectors: el.selectors,
        position: el.position,
        interactionState: el.interactionState,
        attributes: el.attributes
      }));

      // Extract forms from DOM context
      if (dom.htmlContext && dom.htmlContext.pageStructure) {
        pageData.forms = dom.htmlContext.pageStructure.forms || [];
      }
    }

    // Merge explorer data
    if (explorerData && explorerData.success) {
      const data = explorerData.data || explorerData;
      pageData.navigation = data.navigation || [];
      pageData.headings = data.headings || [];
      pageData.layout = data.layout || {};
      pageData.internalLinks = data.internalLinks || [];
      pageData.keySelectors = data.keySelectors || [];

      // Also use loading patterns if present
      if (data.loadingPatterns) {
        pageData.loadingPatterns = data.loadingPatterns;
      }
    }

    // Fallback: if explorerData failed or returned no links, extract from DOM htmlContext
    if ((!pageData.internalLinks || pageData.internalLinks.length === 0) && domData && domData.success && domData.structuredDOM) {
      const dom = domData.structuredDOM;
      const fallbackLinks = [];
      const seen = new Set();

      // Extract links from navigation items in htmlContext
      if (dom.htmlContext && dom.htmlContext.pageStructure && dom.htmlContext.pageStructure.navigation) {
        for (const nav of dom.htmlContext.pageStructure.navigation) {
          if (nav.items) {
            for (const item of nav.items) {
              if (item.href && !seen.has(item.href) && this.isSameDomain(item.href)) {
                seen.add(item.href);
                fallbackLinks.push({ url: item.href, text: item.text || '' });
              }
            }
          }
        }
      }

      // Also scan DOM elements for any elements with href attributes
      // (tagName is uppercase in DOM, so el.type may be 'A' not 'a')
      if (dom.elements) {
        for (const el of dom.elements) {
          if (el.attributes && el.attributes.href) {
            const href = el.attributes.href;
            if (!seen.has(href) && this.isSameDomain(href)) {
              seen.add(href);
              fallbackLinks.push({ url: href, text: el.text || '' });
            }
          }
        }
      }

      if (fallbackLinks.length > 0) {
        pageData.internalLinks = fallbackLinks;
        console.log(`[SiteExplorer] Fallback link extraction found ${fallbackLinks.length} links from DOM data for ${url}`);
      }
    }

    // Last-resort: if still no links, extract directly via chrome.scripting.executeScript
    if ((!pageData.internalLinks || pageData.internalLinks.length === 0) && this.tabId) {
      try {
        const directLinks = await this.extractLinksDirectly(this.tabId);
        if (directLinks && directLinks.length > 0) {
          pageData.internalLinks = directLinks.filter(link => this.isSameDomain(link.url));
          console.log(`[SiteExplorer] Direct extraction found ${pageData.internalLinks.length} same-domain links for ${url}`);
        }
      } catch (error) {
        console.warn(`[SiteExplorer] Direct link extraction failed for ${url}:`, error.message);
      }
    }

    console.log(`[SiteExplorer] Page ${url}: ${pageData.internalLinks.length} internal links discovered, ${pageData.interactiveElements.length} elements, ${pageData.forms.length} forms`);

    return pageData;
  }

  /**
   * Wait for a tab to finish loading
   * @param {number} tabId - Tab ID
   * @param {number} timeout - Max wait time in ms
   */
  waitForTabLoad(tabId, timeout = 15000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // Timeout fallback
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, timeout);

      // Check if already loaded
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }).catch(() => resolve());
    });
  }

  /**
   * Send a message to a tab's content script with timeout
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @param {number} timeout - Timeout in ms
   * @returns {Object} - Response from content script
   */
  sendTabMessage(tabId, message, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Message timeout for action: ${message.action}`));
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Save research results to chrome.storage.local
   * @param {string} status - Final status (completed, stopped, error)
   */
  async saveResearch(status) {
    const research = {
      id: this.researchId,
      domain: this.domain,
      startUrl: this.startUrl,
      startTime: this.startTime,
      endTime: Date.now(),
      status,
      settings: {
        maxDepth: this.maxDepth,
        maxPages: this.maxPages
      },
      pages: this.pagesCollected,
      siteMap: this.buildSiteMap(),
      summary: {
        totalPages: this.pagesCollected.length,
        totalElements: this.pagesCollected.reduce((sum, p) => sum + (p.interactiveElements?.length || 0), 0),
        totalForms: this.pagesCollected.reduce((sum, p) => sum + (p.forms?.length || 0), 0),
        totalLinks: this.pagesCollected.reduce((sum, p) => sum + (p.internalLinks?.length || 0), 0),
        uniqueUrls: this.visited.size,
        crawlDuration: Date.now() - this.startTime
      }
    };

    const indexEntry = {
      id: this.researchId,
      domain: this.domain,
      startUrl: this.startUrl,
      startTime: this.startTime,
      endTime: Date.now(),
      status,
      pageCount: this.pagesCollected.length
    };

    try {
      const stored = await chrome.storage.local.get(['fsbResearchData', 'fsbResearchIndex']);
      const researchData = stored.fsbResearchData || {};
      let researchIndex = stored.fsbResearchIndex || [];

      // Add new research
      researchData[this.researchId] = research;
      researchIndex.unshift(indexEntry);

      // Enforce max 100 results
      if (researchIndex.length > 100) {
        const removed = researchIndex.splice(100);
        for (const item of removed) {
          delete researchData[item.id];
        }
      }

      await chrome.storage.local.set({
        fsbResearchData: researchData,
        fsbResearchIndex: researchIndex
      });

      console.log(`[SiteExplorer] Research saved: ${this.researchId} (${this.pagesCollected.length} pages)`);
    } catch (error) {
      console.error('[SiteExplorer] Failed to save research:', error);
    }
  }

  /**
   * Build a hierarchical site map from collected pages
   * @returns {Object} - Tree structure of crawled pages
   */
  buildSiteMap() {
    const map = {};
    for (const page of this.pagesCollected) {
      const parsed = new URL(page.url);
      const path = parsed.pathname;
      map[path] = {
        url: page.url,
        title: page.title,
        depth: page.depth,
        elementCount: page.interactiveElements?.length || 0,
        formCount: page.forms?.length || 0,
        linkCount: page.internalLinks?.length || 0
      };
    }
    return map;
  }

  /**
   * Get current crawl status for UI updates
   * @returns {Object} - Current status
   */
  getStatus() {
    return {
      crawlerId: this.crawlerId,
      status: this.status,
      researchId: this.researchId,
      domain: this.domain,
      startUrl: this.startUrl,
      currentUrl: this.currentUrl,
      pagesCollected: this.pagesCollected.length,
      pagesQueued: this.urlQueue.length,
      pagesVisited: this.visited.size,
      maxPages: this.maxPages,
      maxDepth: this.maxDepth,
      startTime: this.startTime,
      elapsed: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Broadcast status update to options page and update in-page overlay
   */
  broadcastStatus() {
    const statusData = this.getStatus();
    try {
      chrome.runtime.sendMessage({
        type: 'explorerStatusUpdate',
        data: statusData
      }).catch(() => {
        // Options page may not be open - ignore
      });
    } catch (e) {
      // Ignore broadcast errors
    }

    // Also update the in-page crawl overlay on the crawler's tab
    if (this.tabId && this.status === 'crawling') {
      this._sendOverlayMessage('updateCrawlOverlay', this._getOverlayData()).catch(() => {});
    }
  }

  /**
   * Wait for page to settle using content script stability detection.
   * Falls back to a fixed 2000ms delay if message passing fails.
   * @param {number} tabId - Tab ID
   */
  async waitForPageSettle(tabId) {
    try {
      const result = await this.sendTabMessage(tabId, {
        action: 'waitForPageStability',
        options: { maxWait: 5000, stableTime: 500 }
      }, 6000);
      console.log(`[SiteExplorer] Page settle: stable=${result?.stable}, timedOut=${result?.timedOut}`);
    } catch (error) {
      console.log(`[SiteExplorer] Page settle fallback (message failed): ${error.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  /**
   * Scroll page to trigger lazy-loaded content before link extraction.
   * Scrolls down in viewport-height steps, waits for content, then scrolls back.
   * @param {number} tabId - Tab ID
   * @param {number} steps - Number of viewport heights to scroll (default 3)
   */
  async scrollForDiscovery(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async () => {
          const viewportHeight = window.innerHeight;
          const maxScroll = document.documentElement.scrollHeight;
          const steps = Math.min(3, Math.ceil(maxScroll / viewportHeight) - 1);

          for (let i = 1; i <= steps; i++) {
            window.scrollTo({ top: viewportHeight * i, behavior: 'instant' });
            // Wait for lazy content to load
            await new Promise(r => setTimeout(r, 600));
          }

          // Scroll back to top
          window.scrollTo({ top: 0, behavior: 'instant' });
          await new Promise(r => setTimeout(r, 300));

          return { scrolled: steps, maxScroll };
        }
      });

      const scrollInfo = results?.[0]?.result;
      if (scrollInfo) {
        console.log(`[SiteExplorer] Scroll discovery: ${scrollInfo.scrolled} steps (page height: ${scrollInfo.maxScroll}px)`);
      }
    } catch (error) {
      console.log(`[SiteExplorer] Scroll discovery skipped: ${error.message}`);
    }
  }

  /**
   * Last-resort link extraction using chrome.scripting.executeScript
   * Bypasses content script message passing entirely
   * @param {number} tabId - Tab ID
   * @returns {Array} - Array of {url, text} objects
   */
  async extractLinksDirectly(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const links = [];
        const seen = new Set();

        function processHref(href, textContent) {
          if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
          try {
            const urlObj = new URL(href, window.location.origin);
            const normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
            if (!seen.has(normalized)) {
              seen.add(normalized);
              links.push({ url: normalized, text: (textContent || '').trim().substring(0, 100) });
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }

        // Standard <a href> links
        document.querySelectorAll('a[href]').forEach(a => {
          processHref(a.href, a.textContent);
        });

        // [role="link"] elements (LinkedIn, SPAs)
        document.querySelectorAll('[role="link"]').forEach(el => {
          const href = el.getAttribute('href') || el.getAttribute('data-href') || el.getAttribute('data-url');
          if (href) {
            processHref(href, el.textContent);
          }
        });

        return links;
      }
    });

    // executeScript returns an array of results, one per frame
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    return [];
  }

  /**
   * Switch focus back to the caller tab (e.g. options page)
   */
  async switchBackToCallerTab() {
    if (this.callerTabId) {
      try {
        await chrome.tabs.update(this.callerTabId, { active: true });
      } catch (e) {
        // Caller tab may have been closed
      }
    }
  }

  /**
   * Convert crawl results to a site map memory and save it.
   * Optionally triggers AI refinement if the autoRefineSiteMaps toggle is ON.
   * Broadcasts a siteMapSaved message so the side panel can react.
   */
  async autoConvertToMemory() {
    // Build a research-like object from current crawl data
    const research = {
      id: this.researchId,
      domain: this.domain,
      pages: this.pagesCollected,
      startTime: this.startTime
    };

    // Tier 1: local conversion
    if (typeof convertToSiteMap !== 'function') {
      console.warn('[SiteExplorer] convertToSiteMap not available, skipping auto-save');
      return;
    }
    let sitePattern = convertToSiteMap(research);
    if (!sitePattern) {
      console.warn('[SiteExplorer] convertToSiteMap returned null');
      return;
    }

    // Check autoRefineSiteMaps toggle -- if ON, run Tier 2 refinement
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['autoRefineSiteMaps'], resolve);
    });
    if (settings.autoRefineSiteMaps !== false && typeof refineSiteMapWithAI === 'function') {
      console.log('[SiteExplorer] Starting AI refinement for', this.domain);
      try {
        sitePattern = await refineSiteMapWithAI(sitePattern, research);
        console.log('[SiteExplorer] AI refinement completed, refined=' + (sitePattern.refined || false));
      } catch (refineErr) {
        console.warn('[SiteExplorer] AI refinement failed:', refineErr.message);
      }
    }

    // Create and save the memory
    // Use memoryStorage.add() directly -- memoryManager.add() expects a session object
    // and runs it through the extractor, which would fail on a pre-built memory.
    if (typeof createSiteMapMemory !== 'function' || typeof memoryStorage === 'undefined') {
      console.warn('[SiteExplorer] Memory system not available for auto-save');
      return;
    }

    const memory = createSiteMapMemory(this.domain, sitePattern);
    await memoryStorage.add(memory);
    console.log('[SiteExplorer] Auto-saved site map memory for', this.domain);

    // Broadcast so the side panel can react
    try {
      chrome.runtime.sendMessage({
        type: 'siteMapSaved',
        data: { domain: this.domain, refined: sitePattern.refined || false }
      }).catch(() => {});
    } catch (e) {
      // Side panel may not be open
    }
  }

  /**
   * Build overlay data object for in-page crawl progress overlay
   * @returns {Object}
   */
  _getOverlayData() {
    let pathname = '';
    try {
      pathname = this.currentUrl ? new URL(this.currentUrl).pathname : '';
    } catch (e) { /* ignore */ }

    return {
      crawlerId: this.crawlerId,
      domain: this.domain,
      pagesCollected: this.pagesCollected.length,
      maxPages: this.maxPages,
      currentPath: pathname,
      percent: this.maxPages > 0 ? Math.round((this.pagesCollected.length / this.maxPages) * 100) : 0
    };
  }

  /**
   * Send an overlay message to the crawler's tab content script.
   * Non-critical: errors are silently caught.
   * @param {string} action - Message action (showCrawlOverlay, updateCrawlOverlay, hideCrawlOverlay)
   * @param {Object} [data] - Optional overlay data
   */
  async _sendOverlayMessage(action, data = {}) {
    if (!this.tabId) return;
    try {
      await this.sendTabMessage(this.tabId, { action, ...data }, 3000);
    } catch (e) {
      // Overlay is informational only, ignore failures
    }
  }

  /**
   * Check if a URL belongs to the same domain
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isSameDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === this.domain;
    } catch {
      return false;
    }
  }
}
