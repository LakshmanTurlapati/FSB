/**
 * Mem0-inspired conflict resolution for FSB Memory Layer
 *
 * For each new memory, finds similar existing ones via retriever and determines:
 *   - ADD: Genuinely new information
 *   - UPDATE: Complementary to an existing memory (merge)
 *   - DELETE: Contradicts/supersedes an existing memory
 *   - NOOP: Duplicate of an existing memory
 *
 * Also handles periodic cleanup of stale entries.
 */

class MemoryConsolidator {
  constructor(storage, retriever) {
    this._storage = storage || memoryStorage;
    this._retriever = retriever || memoryRetriever;

    // Similarity threshold for considering two memories related
    this._similarityThreshold = 0.6;

    // Stale memory criteria
    this._staleAgeDays = 90;
    this._staleMinAccesses = 2;
  }

  /**
   * Resolve how a new memory should be stored relative to existing memories
   * @param {Object} newMemory - The candidate memory to add
   * @returns {Promise<{ action: string, targetId?: string, reason: string, mergedData?: Object }>}
   */
  async resolve(newMemory) {
    try {
      // Find similar existing memories
      const similar = await this._retriever.search(
        newMemory.text,
        {
          domain: newMemory.metadata?.domain,
          type: newMemory.type
        },
        { topN: 3, minScore: this._similarityThreshold }
      );

      if (similar.length === 0) {
        return { action: 'ADD', reason: 'no similar memories found' };
      }

      // Special handling for task type: match by domain + task description similarity
      if (newMemory.type === 'task') {
        const domain = newMemory.metadata?.domain;
        const taskDesc = newMemory.typeData?.session?.task || '';

        // Filter to task memories on the same domain
        const domainTaskMatches = similar.filter(
          s => s.type === 'task' && s.metadata?.domain === domain
        );

        for (const match of domainTaskMatches) {
          const existingTask = match.typeData?.session?.task || '';
          const taskSim = this._textSimilarity(taskDesc, existingTask);

          if (taskSim >= 0.7) {
            // Repeat run of same task on same domain -- merge
            const mergedData = this._mergeTaskData(match, newMemory);
            return {
              action: 'UPDATE',
              targetId: match.id,
              reason: `merging repeat task run on ${domain}`,
              mergedData
            };
          }
        }

        // No task match found -- fall through to standard similarity logic
        // (which may still ADD for genuinely different tasks)
        if (domainTaskMatches.length > 0) {
          return { action: 'ADD', reason: 'different task on same domain' };
        }
      }

      const bestMatch = similar[0];
      const similarity = bestMatch._searchScore || 0;

      // High similarity: likely duplicate or update
      if (similarity >= 0.85) {
        return this._resolveHighSimilarity(newMemory, bestMatch);
      }

      // Medium similarity: might be complementary
      if (similarity >= this._similarityThreshold) {
        return this._resolveMediumSimilarity(newMemory, bestMatch);
      }

      return { action: 'ADD', reason: 'similarity below threshold' };
    } catch (error) {
      console.error('[MemoryConsolidator] Resolve failed:', error.message);
      return { action: 'ADD', reason: 'resolve error, defaulting to ADD' };
    }
  }

  /**
   * Handle high similarity (>=0.85): likely duplicate or direct update
   */
  _resolveHighSimilarity(newMemory, existing) {
    // Same type and very similar text: NOOP (duplicate)
    if (newMemory.type === existing.type) {
      const textSimilarity = this._textSimilarity(newMemory.text, existing.text);
      if (textSimilarity >= 0.9) {
        return {
          action: 'NOOP',
          targetId: existing.id,
          reason: 'duplicate memory (text similarity >= 0.9)'
        };
      }
    }

    // Task memories: merge with pre-built data
    if (newMemory.type === 'task' && existing.type === 'task') {
      const mergedData = this._mergeTaskData(existing, newMemory);
      return {
        action: 'UPDATE',
        targetId: existing.id,
        reason: `merging repeat task run on ${existing.metadata?.domain || 'unknown'}`,
        mergedData
      };
    }

    // For procedural memories, update with newer success rate
    if (newMemory.type === 'procedural' && existing.type === 'procedural') {
      return {
        action: 'UPDATE',
        targetId: existing.id,
        reason: 'updating procedural memory with latest run data'
      };
    }

    // Default for high similarity: update existing
    return {
      action: 'UPDATE',
      targetId: existing.id,
      reason: 'high similarity, merging into existing memory'
    };
  }

  /**
   * Handle medium similarity (0.6-0.85): might be complementary
   */
  _resolveMediumSimilarity(newMemory, existing) {
    // Different types are always additive
    if (newMemory.type !== existing.type) {
      return { action: 'ADD', reason: 'different memory types, both valuable' };
    }

    // Task memories: check task description similarity on same domain
    if (newMemory.type === 'task' && existing.type === 'task') {
      const sameDomain = newMemory.metadata?.domain === existing.metadata?.domain;
      if (sameDomain) {
        const taskSim = this._textSimilarity(
          newMemory.typeData?.session?.task || '',
          existing.typeData?.session?.task || ''
        );
        if (taskSim >= 0.7) {
          const mergedData = this._mergeTaskData(existing, newMemory);
          return {
            action: 'UPDATE',
            targetId: existing.id,
            reason: `merging repeat task run on ${existing.metadata?.domain || 'unknown'}`,
            mergedData
          };
        }
      }
      return { action: 'ADD', reason: 'different task, adding as separate memory' };
    }

    // Semantic memories about the same domain: check for contradiction
    if (newMemory.type === 'semantic' && existing.type === 'semantic') {
      // If the new memory explicitly contradicts the old one
      if (newMemory.typeData?.contradicts === existing.id) {
        return {
          action: 'DELETE',
          targetId: existing.id,
          reason: 'new semantic memory contradicts existing one'
        };
      }
    }

    // Default: add as new (complementary information)
    return { action: 'ADD', reason: 'medium similarity, adding as complementary' };
  }

  /**
   * Run full consolidation across all memories
   * @returns {Promise<{ merged: number, deleted: number, total: number }>}
   */
  async consolidateAll() {
    const memories = await this._storage.getAll();
    let merged = 0;
    let deleted = 0;

    // Pass 1: Remove stale memories
    const now = Date.now();
    const staleThreshold = this._staleAgeDays * 24 * 60 * 60 * 1000;

    for (const memory of memories) {
      const age = now - memory.createdAt;
      if (age > staleThreshold && memory.accessCount < this._staleMinAccesses) {
        await this._storage.delete(memory.id);
        deleted++;
      }
    }

    // Pass 2: Find and merge duplicates
    // Group by domain + type for efficient comparison
    const groups = {};
    const remainingMemories = await this._storage.getAll();

    for (const memory of remainingMemories) {
      const key = `${memory.metadata?.domain || '_'}:${memory.type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(memory);
    }

    for (const [groupKey, group] of Object.entries(groups)) {
      if (group.length < 2) continue;

      const isTaskGroup = groupKey.endsWith(':task');

      // Compare each pair within the group
      const toDelete = new Set();
      for (let i = 0; i < group.length; i++) {
        if (toDelete.has(group[i].id)) continue;
        for (let j = i + 1; j < group.length; j++) {
          if (toDelete.has(group[j].id)) continue;

          let shouldMerge = false;

          if (isTaskGroup) {
            // Task memories: compare task descriptions instead of full text
            const taskSim = this._textSimilarity(
              group[i].typeData?.session?.task || '',
              group[j].typeData?.session?.task || ''
            );
            shouldMerge = taskSim >= 0.7;
          } else {
            const sim = this._textSimilarity(group[i].text, group[j].text);
            shouldMerge = sim >= 0.85;
          }

          if (shouldMerge) {
            // Keep the one with more accesses, delete the other
            const keep = group[i].accessCount >= group[j].accessCount ? group[i] : group[j];
            const remove = keep === group[i] ? group[j] : group[i];

            if (isTaskGroup) {
              // Task memories: full merge using _mergeTaskData
              const mergedData = this._mergeTaskData(keep, remove);
              await this._storage.update(keep.id, mergedData);
            } else {
              // Non-task: update confidence only
              await this._storage.update(keep.id, {
                metadata: {
                  ...keep.metadata,
                  confidence: Math.min(1.0, (keep.metadata.confidence || 0.8) + 0.1)
                }
              });
            }

            toDelete.add(remove.id);
            merged++;
          }
        }
      }

      // Delete merged duplicates
      for (const id of toDelete) {
        await this._storage.delete(id);
        deleted++;
      }
    }

    const total = (await this._storage.getAll()).length;
    console.log(`[MemoryConsolidator] Consolidation complete: ${merged} merged, ${deleted} deleted, ${total} remaining`);

    return { merged, deleted, total };
  }

  /**
   * Merge two task memories into a single combined record.
   * Used by resolve (high/medium similarity) and consolidateAll for dedup.
   * @param {Object} existing - The older stored task memory
   * @param {Object} newMemory - The newer incoming task memory
   * @returns {Object} { text, metadata, typeData } ready for storage.update()
   */
  _mergeTaskData(existing, newMemory) {
    const oldTD = existing.typeData || {};
    const newTD = newMemory.typeData || {};
    const oldSession = oldTD.session || {};
    const newSession = newTD.session || {};
    const oldLearned = oldTD.learned || {};
    const newLearned = newTD.learned || {};
    const oldProcs = oldTD.procedures || [];
    const newProcs = newTD.procedures || [];

    // Deduplicate arrays of objects by a key field (keep newer on conflict)
    const dedupeByName = (oldArr, newArr) => {
      const map = new Map();
      for (const item of oldArr) { if (item?.name) map.set(item.name, item); }
      for (const item of newArr) { if (item?.name) map.set(item.name, item); } // newer wins
      return Array.from(map.values());
    };

    // Deduplicate arrays of strings
    const dedupeStrings = (a, b) => [...new Set([...(a || []), ...(b || [])])];

    return {
      text: newMemory.text, // most recent description
      metadata: {
        ...existing.metadata,
        ...newMemory.metadata,
        updatedAt: Date.now()
      },
      typeData: {
        session: {
          ...newSession,
          runCount: (oldSession.runCount || 1) + 1,
          timeline: [...(oldSession.timeline || []), ...(newSession.timeline || [])],
          failures: dedupeStrings(oldSession.failures, newSession.failures)
        },
        learned: {
          selectors: dedupeByName(oldLearned.selectors || [], newLearned.selectors || []),
          siteStructure: dedupeStrings(oldLearned.siteStructure, newLearned.siteStructure),
          patterns: dedupeStrings(oldLearned.patterns, newLearned.patterns)
        },
        procedures: dedupeByName(oldProcs, newProcs)
      }
    };
  }

  /**
   * Simple text similarity using token overlap (Jaccard index)
   * @param {string} textA
   * @param {string} textB
   * @returns {number} 0-1 similarity score
   */
  _textSimilarity(textA, textB) {
    if (!textA || !textB) return 0;

    const tokensA = new Set(
      textA.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 1)
    );
    const tokensB = new Set(
      textB.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 1)
    );

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) intersection++;
    }

    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

// Singleton
const memoryConsolidator = new MemoryConsolidator();

// Register with memory manager
if (typeof memoryManager !== 'undefined') {
  memoryManager.setConsolidator(memoryConsolidator);
}

if (typeof self !== 'undefined') {
  self.MemoryConsolidator = MemoryConsolidator;
  self.memoryConsolidator = memoryConsolidator;
}
