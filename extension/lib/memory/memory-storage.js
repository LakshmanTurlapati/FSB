/**
 * Chrome storage wrapper for FSB Memory Layer
 * Provides CRUD operations on chrome.storage.local with inverted indices
 * for fast lookup by domain, taskType, and tags.
 *
 * Follows the caching pattern from config/config.js (10s TTL).
 */

class MemoryStorage {
  constructor() {
    // In-memory cache (mirrors config.js pattern)
    this._cache = null;
    this._indexCache = null;
    this._cacheTimestamp = 0;
    this._cacheTTL = 10000; // 10 seconds

    // Invalidate cache on external storage changes
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes[MEMORY_STORAGE_KEY] || changes[MEMORY_INDEX_KEY])) {
          this._invalidateCache();
        }
      });
    }
  }

  _invalidateCache() {
    this._cache = null;
    this._indexCache = null;
    this._cacheTimestamp = 0;
  }

  _isCacheFresh() {
    return this._cache && (Date.now() - this._cacheTimestamp) < this._cacheTTL;
  }

  /**
   * Load all memories from storage (with cache)
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    if (this._isCacheFresh()) {
      return [...this._cache];
    }

    try {
      const result = await chrome.storage.local.get(MEMORY_STORAGE_KEY);
      const memories = result[MEMORY_STORAGE_KEY] || [];
      this._cache = memories;
      this._cacheTimestamp = Date.now();
      return [...memories];
    } catch (error) {
      console.error('[MemoryStorage] Failed to load memories:', error);
      return [];
    }
  }

  /**
   * Load inverted index from storage (with cache)
   * @returns {Promise<Object>}
   */
  async getIndex() {
    if (this._isCacheFresh() && this._indexCache) {
      return { ...this._indexCache };
    }

    try {
      const result = await chrome.storage.local.get(MEMORY_INDEX_KEY);
      const index = result[MEMORY_INDEX_KEY] || { domain: {}, taskType: {}, tags: {}, outcome: {}, stepCount: {} };
      // Ensure new buckets exist on older indices
      if (!index.outcome) index.outcome = {};
      if (!index.stepCount) index.stepCount = {};
      this._indexCache = index;
      return { ...index };
    } catch (error) {
      console.error('[MemoryStorage] Failed to load index:', error);
      return { domain: {}, taskType: {}, tags: {}, outcome: {}, stepCount: {} };
    }
  }

  /**
   * Get a single memory by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const memories = await this.getAll();
    return memories.find(m => m.id === id) || null;
  }

  /**
   * Add a new memory and update indices
   * @param {Object} memory - Validated memory object
   * @returns {Promise<boolean>}
   */
  async add(memory) {
    const validation = validateMemory(memory);
    if (!validation.valid) {
      console.error('[MemoryStorage] Invalid memory:', validation.errors);
      return false;
    }

    try {
      const memories = await this.getAll();

      // Evict if at capacity
      if (memories.length >= MAX_MEMORIES) {
        this._evict(memories);
      }

      memories.push(memory);

      // Update index
      const index = await this.getIndex();
      this._addToIndex(index, memory);

      // Persist both
      this._invalidateCache();
      await chrome.storage.local.set({
        [MEMORY_STORAGE_KEY]: memories,
        [MEMORY_INDEX_KEY]: index
      });

      // Refresh cache
      this._cache = memories;
      this._indexCache = index;
      this._cacheTimestamp = Date.now();

      return true;
    } catch (error) {
      console.error('[MemoryStorage] Failed to add memory:', error);
      return false;
    }
  }

  /**
   * Update an existing memory by ID
   * @param {string} id
   * @param {Object} updates - Partial memory updates
   * @returns {Promise<boolean>}
   */
  async update(id, updates) {
    try {
      const memories = await this.getAll();
      const idx = memories.findIndex(m => m.id === id);
      if (idx === -1) return false;

      const oldMemory = memories[idx];
      const updatedMemory = {
        ...oldMemory,
        ...updates,
        id: oldMemory.id, // prevent ID change
        createdAt: oldMemory.createdAt, // preserve creation time
        updatedAt: Date.now(),
        metadata: { ...oldMemory.metadata, ...(updates.metadata || {}) },
        typeData: { ...oldMemory.typeData, ...(updates.typeData || {}) }
      };

      memories[idx] = updatedMemory;

      // Rebuild index entry if domain/taskType/tags changed
      const index = await this.getIndex();
      this._removeFromIndex(index, oldMemory);
      this._addToIndex(index, updatedMemory);

      this._invalidateCache();
      await chrome.storage.local.set({
        [MEMORY_STORAGE_KEY]: memories,
        [MEMORY_INDEX_KEY]: index
      });

      this._cache = memories;
      this._indexCache = index;
      this._cacheTimestamp = Date.now();

      return true;
    } catch (error) {
      console.error('[MemoryStorage] Failed to update memory:', error);
      return false;
    }
  }

  /**
   * Delete a memory by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    try {
      const memories = await this.getAll();
      const idx = memories.findIndex(m => m.id === id);
      if (idx === -1) return false;

      const removed = memories.splice(idx, 1)[0];

      const index = await this.getIndex();
      this._removeFromIndex(index, removed);

      this._invalidateCache();
      await chrome.storage.local.set({
        [MEMORY_STORAGE_KEY]: memories,
        [MEMORY_INDEX_KEY]: index
      });

      this._cache = memories;
      this._indexCache = index;
      this._cacheTimestamp = Date.now();

      return true;
    } catch (error) {
      console.error('[MemoryStorage] Failed to delete memory:', error);
      return false;
    }
  }

  /**
   * Delete all memories
   * @returns {Promise<boolean>}
   */
  async deleteAll() {
    try {
      this._invalidateCache();
      await chrome.storage.local.set({
        [MEMORY_STORAGE_KEY]: [],
        [MEMORY_INDEX_KEY]: { domain: {}, taskType: {}, tags: {}, outcome: {}, stepCount: {} }
      });
      return true;
    } catch (error) {
      console.error('[MemoryStorage] Failed to delete all memories:', error);
      return false;
    }
  }

  /**
   * Query memories by structured filters (uses inverted index)
   * @param {{ domain?: string, taskType?: string, tags?: string[], type?: string }} filters
   * @returns {Promise<Object[]>}
   */
  async query(filters = {}) {
    const index = await this.getIndex();
    const memories = await this.getAll();

    // If no filters, return all
    if (!filters.domain && !filters.taskType && !filters.tags?.length && !filters.type && !filters.outcome && !filters.stepCount) {
      return memories;
    }

    // Collect candidate IDs from index (intersection of filter results)
    let candidateIds = null;

    if (filters.domain && index.domain[filters.domain]) {
      const ids = new Set(index.domain[filters.domain]);
      candidateIds = candidateIds ? intersect(candidateIds, ids) : ids;
    }

    if (filters.taskType && index.taskType[filters.taskType]) {
      const ids = new Set(index.taskType[filters.taskType]);
      candidateIds = candidateIds ? intersect(candidateIds, ids) : ids;
    }

    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        if (index.tags[tag]) {
          const ids = new Set(index.tags[tag]);
          candidateIds = candidateIds ? intersect(candidateIds, ids) : ids;
        } else {
          candidateIds = new Set(); // tag not found, no matches
          break;
        }
      }
    }

    if (filters.outcome && index.outcome?.[filters.outcome]) {
      const ids = new Set(index.outcome[filters.outcome]);
      candidateIds = candidateIds ? intersect(candidateIds, ids) : ids;
    }

    if (filters.stepCount && index.stepCount?.[filters.stepCount]) {
      const ids = new Set(index.stepCount[filters.stepCount]);
      candidateIds = candidateIds ? intersect(candidateIds, ids) : ids;
    }

    // If index filters produced candidates, filter the full list
    let results = candidateIds !== null
      ? memories.filter(m => candidateIds.has(m.id))
      : memories;

    // Apply type filter (not indexed, just a cheap filter)
    if (filters.type) {
      results = results.filter(m => m.type === filters.type);
    }

    return results;
  }

  /**
   * Record that a memory was accessed (for access-count based eviction)
   * @param {string} id
   */
  async recordAccess(id) {
    // Lightweight update: only touch access fields
    const memories = await this.getAll();
    const memory = memories.find(m => m.id === id);
    if (!memory) return;

    memory.lastAccessedAt = Date.now();
    memory.accessCount = (memory.accessCount || 0) + 1;

    // Persist without rebuilding index (access fields aren't indexed)
    try {
      await chrome.storage.local.set({ [MEMORY_STORAGE_KEY]: memories });
      this._cache = memories;
      this._cacheTimestamp = Date.now();
    } catch (error) {
      // Non-critical
      console.warn('[MemoryStorage] Failed to record access:', error);
    }
  }

  /**
   * Get storage usage stats
   * @returns {Promise<Object>}
   */
  async getStats() {
    const memories = await this.getAll();
    const byType = {};
    for (const type of Object.values(MEMORY_TYPES)) {
      byType[type] = memories.filter(m => m.type === type).length;
    }

    // Estimate storage size
    const dataString = JSON.stringify(memories);
    const estimatedBytes = new Blob([dataString]).size;

    const oldest = memories.length > 0
      ? Math.min(...memories.map(m => m.createdAt))
      : null;
    const newest = memories.length > 0
      ? Math.max(...memories.map(m => m.createdAt))
      : null;

    return {
      totalCount: memories.length,
      byType,
      estimatedBytes,
      estimatedMB: (estimatedBytes / (1024 * 1024)).toFixed(2),
      maxMemories: MAX_MEMORIES,
      maxBytes: MAX_STORAGE_BYTES,
      oldest,
      newest,
      utilizationPercent: ((memories.length / MAX_MEMORIES) * 100).toFixed(1)
    };
  }

  // --- Index helpers ---

  _addToIndex(index, memory) {
    const { domain, taskType, tags } = memory.metadata;

    if (domain) {
      if (!index.domain[domain]) index.domain[domain] = [];
      if (!index.domain[domain].includes(memory.id)) {
        index.domain[domain].push(memory.id);
      }
    }

    if (taskType) {
      if (!index.taskType[taskType]) index.taskType[taskType] = [];
      if (!index.taskType[taskType].includes(memory.id)) {
        index.taskType[taskType].push(memory.id);
      }
    }

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        if (!index.tags[tag]) index.tags[tag] = [];
        if (!index.tags[tag].includes(memory.id)) {
          index.tags[tag].push(memory.id);
        }
      }
    }

    // Task Memory-specific index fields
    if (memory.typeData?.session) {
      const outcome = memory.typeData.session.outcome;
      if (outcome) {
        if (!index.outcome) index.outcome = {};
        if (!index.outcome[outcome]) index.outcome[outcome] = [];
        if (!index.outcome[outcome].includes(memory.id)) {
          index.outcome[outcome].push(memory.id);
        }
      }

      const timelineLen = (memory.typeData.session.timeline || []).length;
      const bucket = timelineLen === 0 ? '0'
        : timelineLen <= 5 ? '1-5'
        : timelineLen <= 10 ? '6-10'
        : '10+';
      if (!index.stepCount) index.stepCount = {};
      if (!index.stepCount[bucket]) index.stepCount[bucket] = [];
      if (!index.stepCount[bucket].includes(memory.id)) {
        index.stepCount[bucket].push(memory.id);
      }
    }
  }

  _removeFromIndex(index, memory) {
    const { domain, taskType, tags } = memory.metadata;

    if (domain && index.domain[domain]) {
      index.domain[domain] = index.domain[domain].filter(id => id !== memory.id);
      if (index.domain[domain].length === 0) delete index.domain[domain];
    }

    if (taskType && index.taskType[taskType]) {
      index.taskType[taskType] = index.taskType[taskType].filter(id => id !== memory.id);
      if (index.taskType[taskType].length === 0) delete index.taskType[taskType];
    }

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        if (index.tags[tag]) {
          index.tags[tag] = index.tags[tag].filter(id => id !== memory.id);
          if (index.tags[tag].length === 0) delete index.tags[tag];
        }
      }
    }

    // Remove Task Memory-specific index entries
    if (memory.typeData?.session) {
      const outcome = memory.typeData.session.outcome;
      if (outcome && index.outcome?.[outcome]) {
        index.outcome[outcome] = index.outcome[outcome].filter(id => id !== memory.id);
        if (index.outcome[outcome].length === 0) delete index.outcome[outcome];
      }

      // Remove from all stepCount buckets (defensive -- bucket may have changed)
      if (index.stepCount) {
        for (const bucket of Object.keys(index.stepCount)) {
          index.stepCount[bucket] = index.stepCount[bucket].filter(id => id !== memory.id);
          if (index.stepCount[bucket].length === 0) delete index.stepCount[bucket];
        }
      }
    }
  }

  /**
   * Evict oldest/least-accessed memories to stay under capacity
   * @param {Object[]} memories - Mutable array
   */
  _evict(memories) {
    // Score each memory: higher = more expendable
    // Low access count + old age = high eviction score
    const now = Date.now();
    const scored = memories.map((m, i) => ({
      index: i,
      evictionScore:
        (1 / (m.accessCount + 1)) * // less accessed = higher score
        ((now - m.lastAccessedAt) / (1000 * 60 * 60 * 24)) // days since last access
    }));

    // Sort by eviction score descending, remove top 10%
    scored.sort((a, b) => b.evictionScore - a.evictionScore);
    const removeCount = Math.max(1, Math.ceil(MAX_MEMORIES * 0.1));
    const indicesToRemove = new Set(scored.slice(0, removeCount).map(s => s.index));

    // Remove from end to preserve indices
    for (let i = memories.length - 1; i >= 0; i--) {
      if (indicesToRemove.has(i)) {
        memories.splice(i, 1);
      }
    }
  }
}

/**
 * Set intersection helper
 * @param {Set} setA
 * @param {Set} setB
 * @returns {Set}
 */
function intersect(setA, setB) {
  const result = new Set();
  for (const item of setA) {
    if (setB.has(item)) result.add(item);
  }
  return result;
}

// Singleton
const memoryStorage = new MemoryStorage();

// Export for service worker and module contexts
if (typeof self !== 'undefined') {
  self.MemoryStorage = MemoryStorage;
  self.memoryStorage = memoryStorage;
}
