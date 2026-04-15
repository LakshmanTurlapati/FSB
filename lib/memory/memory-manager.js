/**
 * Main API orchestrating all memory layer components.
 *
 * Provides:
 *   - add(sessionData, context) -- extract memories, check for conflicts, store
 *   - search(query, filters, options) -- retrieve relevant memories
 *   - update(id, data) / delete(id) -- modify/remove
 *   - consolidate() -- merge duplicates, cleanup stale entries
 *   - getStats() -- storage utilization info
 */

class MemoryManager {
  constructor() {
    this._storage = memoryStorage;
    this._retriever = memoryRetriever;
    this._extractor = typeof memoryExtractor !== 'undefined' ? memoryExtractor : null;
    this._consolidator = null; // Lazy-loaded in Phase 4
  }

  /**
   * Extract and store memories from a completed session.
   * Non-blocking, fire-and-forget safe.
   * @param {Object} session - Session object from background.js
   * @param {Object} context - { domain, provider, ... }
   * @returns {Promise<Object[]>} Stored memories
   */
  async add(session, context = {}) {
    try {
      // Extract memories via AI
      const extracted = await this._extractor.extract(session, context);

      if (extracted.length === 0) {
        console.log('[MemoryManager] No memories extracted from session');
        return [];
      }

      const stored = [];
      for (const memory of extracted) {
        // Run consolidation if available (Phase 4)
        if (this._consolidator) {
          const operation = await this._consolidator.resolve(memory);
          if (operation.action === 'NOOP') continue;
          if (operation.action === 'UPDATE' && operation.targetId) {
            // Use pre-merged data from consolidator if available (task memory merges),
            // otherwise fall back to simple overwrite (existing behavior for non-task types)
            const updateData = operation.mergedData || {
              text: memory.text,
              metadata: memory.metadata,
              typeData: memory.typeData
            };
            await this._storage.update(operation.targetId, updateData);
            stored.push(memory);
            continue;
          }
          if (operation.action === 'DELETE' && operation.targetId) {
            await this._storage.delete(operation.targetId);
            // Still add the new one
          }
          // action === 'ADD' falls through
        }

        const success = await this._storage.add(memory);
        if (success) {
          stored.push(memory);
        }
      }

      console.log(`[MemoryManager] Stored ${stored.length}/${extracted.length} memories from session`);

      // Fire async AI enrichment (store-first, enrich-second)
      if (this._extractor?.enrich) {
        for (const memory of stored) {
          // Task memories ALWAYS get enriched (per CONTEXT.md: no "Refine with AI" button)
          if (memory.type === 'task') {
            this._enrichAsync(memory).catch(err =>
              console.warn('[MemoryManager] Async enrichment failed:', err.message)
            );
          }
        }
        // Non-task memories still respect autoAnalyze setting
        const autoAnalyze = await this._getAutoAnalyzeSetting();
        if (autoAnalyze) {
          for (const memory of stored) {
            if (memory.type !== 'task') {
              this._enrichAsync(memory).catch(err =>
                console.warn('[MemoryManager] Async enrichment failed:', err.message)
              );
            }
          }
        }
      }

      return stored;
    } catch (error) {
      console.error('[MemoryManager] Failed to add memories:', error.message);
      return [];
    }
  }

  /**
   * Search for relevant memories
   * @param {string} query
   * @param {{ domain?: string, taskType?: string, tags?: string[], type?: string }} filters
   * @param {{ topN?: number, minScore?: number }} options
   * @returns {Promise<Object[]>}
   */
  async search(query, filters = {}, options = {}) {
    const results = await this._retriever.search(query, filters, options);

    // Record access for retrieved memories
    for (const memory of results) {
      this._storage.recordAccess(memory.id).catch(() => {}); // fire-and-forget
    }

    return results;
  }

  /**
   * Update a specific memory
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<boolean>}
   */
  async update(id, updates) {
    return this._storage.update(id, updates);
  }

  /**
   * Delete a specific memory
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    return this._storage.delete(id);
  }

  /**
   * Delete all memories
   * @returns {Promise<boolean>}
   */
  async deleteAll() {
    return this._storage.deleteAll();
  }

  /**
   * Get all memories (for browsing/export)
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    return this._storage.getAll();
  }

  /**
   * Run consolidation: merge duplicates, cleanup stale entries
   * @returns {Promise<Object>} { merged, deleted, total }
   */
  async consolidate() {
    let result;
    if (!this._consolidator) {
      // Consolidator not yet loaded (Phase 4)
      // Fallback: just do basic stale cleanup
      result = await this._basicCleanup();
    } else {
      result = await this._consolidator.consolidateAll();
    }

    // Cross-site pattern analysis (runs only during consolidation)
    if (typeof analyzeCrossSitePatterns === 'function') {
      try {
        const allMemories = await this._storage.getAll();
        const patternMemory = await analyzeCrossSitePatterns(allMemories);
        if (patternMemory) {
          const existing = allMemories.find(m => m.typeData && m.typeData.category === 'cross_site_pattern');
          if (existing) {
            await this._storage.update(existing.id, {
              text: patternMemory.text,
              typeData: patternMemory.typeData,
              metadata: Object.assign({}, existing.metadata, patternMemory.metadata),
              updatedAt: Date.now()
            });
          } else {
            await this._storage.add(patternMemory);
          }
        }
      } catch (error) {
        console.warn('[MemoryManager] Cross-site pattern analysis failed:', error.message);
      }
    }

    return result;
  }

  /**
   * Basic cleanup: remove memories older than 90 days with <2 accesses
   */
  async _basicCleanup() {
    const memories = await this._storage.getAll();
    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

    let deleted = 0;
    for (const memory of memories) {
      const age = now - memory.createdAt;
      if (age > NINETY_DAYS && memory.accessCount < 2) {
        await this._storage.delete(memory.id);
        deleted++;
      }
    }

    return { merged: 0, deleted, total: memories.length - deleted };
  }

  /**
   * Asynchronously enrich a single memory with AI analysis.
   * Updates the stored memory with aiAnalysis data if enrichment succeeds.
   * This method is fire-and-forget; failures are caught by the caller.
   * @param {Object} memory - The memory object to enrich
   */
  async _enrichAsync(memory) {
    const analysis = await this._extractor.enrich(memory, {});
    if (analysis) {
      await this._storage.update(memory.id, {
        aiAnalysis: analysis,
        metadata: {
          ...memory.metadata,
          aiEnriched: true,
          enrichedAt: Date.now()
        }
      });
      console.log(`[MemoryManager] Enriched memory ${memory.id} with AI analysis`);
    }
  }

  /**
   * Read the autoAnalyzeMemories setting from chrome.storage.local.
   * Defaults to true if the setting is not present.
   * @returns {Promise<boolean>}
   */
  async _getAutoAnalyzeSetting() {
    try {
      const result = await chrome.storage.local.get('autoAnalyzeMemories');
      // Default to true if not set
      return result.autoAnalyzeMemories !== false;
    } catch (error) {
      console.warn('[MemoryManager] Failed to read autoAnalyzeMemories setting:', error.message);
      return true;
    }
  }

  /**
   * Get storage stats
   * @returns {Promise<Object>}
   */
  async getStats() {
    return this._storage.getStats();
  }

  /**
   * Set the consolidator (called when memory-consolidator.js loads)
   */
  setConsolidator(consolidator) {
    this._consolidator = consolidator;
  }
}

// Singleton
const memoryManager = new MemoryManager();

if (typeof self !== 'undefined') {
  self.MemoryManager = MemoryManager;
  self.memoryManager = memoryManager;
}
