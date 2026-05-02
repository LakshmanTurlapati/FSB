// CrawlerManager - Orchestrator for concurrent SiteExplorer instances
// Manages up to MAX_CONCURRENT crawlers with domain locking and auto-cleanup

class CrawlerManager {
  constructor() {
    this.MAX_CONCURRENT = 5;
    this._crawlers = new Map();       // crawlerId -> SiteExplorer
    this._domainLock = new Map();     // domain -> crawlerId
    this._nextId = 1;
  }

  /**
   * Start a new crawler for the given URL.
   * @param {string} url - Starting URL
   * @param {Object} options - Crawl options (maxDepth, maxPages, callerTabId, autoSaveToMemory)
   * @returns {Object} - { success, crawlerId } or { success: false, error }
   */
  async start(url, options = {}) {
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    let domain;
    try {
      domain = new URL(url).hostname;
    } catch (e) {
      return { success: false, error: 'Invalid URL: ' + e.message };
    }

    // Check concurrency limit
    if (this._crawlers.size >= this.MAX_CONCURRENT) {
      return { success: false, error: 'Max concurrent crawlers reached (' + this.MAX_CONCURRENT + '). Stop an existing crawler first.' };
    }

    // Check domain lock
    if (this._domainLock.has(domain)) {
      const existingId = this._domainLock.get(domain);
      return { success: false, error: 'Already crawling ' + domain + ' (crawler ' + existingId + '). Stop it first or wait for completion.' };
    }

    // Create crawler instance
    const crawlerId = 'crawler_' + this._nextId++;
    const crawler = new SiteExplorer(crawlerId);

    // Set up auto-cleanup via onComplete callback
    crawler.onComplete = () => {
      this._cleanup(crawlerId);
    };

    // Register before starting (so domain lock is active during start)
    this._crawlers.set(crawlerId, crawler);
    this._domainLock.set(domain, crawlerId);

    // Start the crawl
    const result = await crawler.start(url, options);

    if (!result.success) {
      // Start failed, clean up registration
      this._cleanup(crawlerId);
      return result;
    }

    console.log('[CrawlerManager] Started ' + crawlerId + ' for ' + domain + ' (' + this._crawlers.size + '/' + this.MAX_CONCURRENT + ' active)');

    return { success: true, crawlerId, researchId: result.researchId };
  }

  /**
   * Stop a specific crawler or all crawlers.
   * @param {string} [crawlerId] - Specific crawler to stop. If omitted, stops all.
   * @returns {Object} - Result
   */
  async stop(crawlerId) {
    if (crawlerId) {
      const crawler = this._crawlers.get(crawlerId);
      if (!crawler) {
        return { success: false, error: 'Crawler not found: ' + crawlerId };
      }
      const result = await crawler.stop();
      this._cleanup(crawlerId);
      return result;
    }

    // Stop all
    const ids = Array.from(this._crawlers.keys());
    const results = [];
    for (const id of ids) {
      const crawler = this._crawlers.get(id);
      if (crawler) {
        try {
          await crawler.stop();
        } catch (e) {
          console.warn('[CrawlerManager] Error stopping ' + id + ':', e.message);
        }
        this._cleanup(id);
      }
      results.push(id);
    }

    return { success: true, stopped: results };
  }

  /**
   * Get status of a specific crawler or all crawlers.
   * @param {string} [crawlerId] - Specific crawler. If omitted, returns all.
   * @returns {Object} - Status data
   */
  getStatus(crawlerId) {
    if (crawlerId) {
      const crawler = this._crawlers.get(crawlerId);
      if (!crawler) {
        return { status: 'not_found', crawlerId };
      }
      return crawler.getStatus();
    }

    // Return all statuses
    const statuses = {};
    for (const [id, crawler] of this._crawlers) {
      statuses[id] = crawler.getStatus();
    }
    return {
      activeCrawlers: this._crawlers.size,
      maxConcurrent: this.MAX_CONCURRENT,
      crawlers: statuses
    };
  }

  /**
   * True if any crawler is active.
   */
  get isRunning() {
    for (const crawler of this._crawlers.values()) {
      if (crawler.running) return true;
    }
    return false;
  }

  /**
   * Clean up a finished/stopped crawler from internal maps.
   * @param {string} crawlerId
   */
  _cleanup(crawlerId) {
    const crawler = this._crawlers.get(crawlerId);
    if (crawler) {
      // Remove domain lock
      if (crawler.domain) {
        this._domainLock.delete(crawler.domain);
      }
      this._crawlers.delete(crawlerId);
      console.log('[CrawlerManager] Cleaned up ' + crawlerId + ' (' + this._crawlers.size + '/' + this.MAX_CONCURRENT + ' active)');
    }
  }
}
