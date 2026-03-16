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
   * @returns {Promise<{ action: string, targetId?: string, reason: string }>}
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

    // For episodic memories with opposing outcomes, keep the newer one
    if (newMemory.type === 'episodic' && existing.type === 'episodic') {
      if (newMemory.typeData?.outcome !== existing.typeData?.outcome) {
        return {
          action: 'DELETE',
          targetId: existing.id,
          reason: 'newer session outcome supersedes older one'
        };
      }
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
    // Note: task memories with different outcomes for the same task are kept as separate
    // records -- they represent different runs and should both be preserved.
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

    for (const group of Object.values(groups)) {
      if (group.length < 2) continue;

      // Compare each pair within the group
      const toDelete = new Set();
      for (let i = 0; i < group.length; i++) {
        if (toDelete.has(group[i].id)) continue;
        for (let j = i + 1; j < group.length; j++) {
          if (toDelete.has(group[j].id)) continue;

          const sim = this._textSimilarity(group[i].text, group[j].text);
          if (sim >= 0.85) {
            // Keep the one with more accesses, delete the other
            const keep = group[i].accessCount >= group[j].accessCount ? group[i] : group[j];
            const remove = keep === group[i] ? group[j] : group[i];

            // Merge: update the kept memory's confidence
            await this._storage.update(keep.id, {
              metadata: {
                ...keep.metadata,
                confidence: Math.min(1.0, (keep.metadata.confidence || 0.8) + 0.1)
              }
            });

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
