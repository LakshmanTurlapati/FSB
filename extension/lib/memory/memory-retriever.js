/**
 * Hybrid search for FSB Memory Layer (no embeddings needed)
 *
 * Three-stage scoring pipeline:
 *   1. Structured filtering via inverted indices (domain, taskType, tags) -- O(1)
 *   2. Keyword scoring -- tokenize query + memory text, compute overlap ratio
 *   3. Boost scoring -- recency decay, success rate, access frequency
 *
 * Returns top-N ranked memories in <50ms.
 */

class MemoryRetriever {
  constructor(storage) {
    this._storage = storage || memoryStorage;
  }

  /**
   * Search memories with hybrid scoring
   * @param {string} query - Natural language search query
   * @param {{ domain?: string, taskType?: string, tags?: string[], type?: string }} filters
   * @param {{ topN?: number, minScore?: number }} options
   * @returns {Promise<Object[]>} Scored and sorted memories
   */
  async search(query, filters = {}, options = {}) {
    const { topN = 5, minScore = 0.1 } = options;

    // Stage 1: Structured filtering via index
    const candidates = await this._storage.query(filters);

    if (candidates.length === 0) return [];

    // Stage 2 + 3: Score each candidate
    const queryTokens = this._tokenize(query);
    const now = Date.now();

    const scored = candidates.map(memory => {
      const keywordScore = this._keywordScore(queryTokens, memory);
      const boostScore = this._boostScore(memory, now);
      const finalScore = (keywordScore * 0.6) + (boostScore * 0.4);

      return { ...memory, _searchScore: finalScore };
    });

    // Filter by minimum score, sort descending, take top N
    return scored
      .filter(m => m._searchScore >= minScore)
      .sort((a, b) => b._searchScore - a._searchScore)
      .slice(0, topN);
  }

  /**
   * Stage 2: Keyword overlap scoring
   * Tokenizes both query and memory text, computes Jaccard-like overlap
   */
  _keywordScore(queryTokens, memory) {
    if (queryTokens.length === 0) return 0;

    // Build memory text from all relevant fields
    const memoryText = [
      memory.text,
      memory.metadata?.domain || '',
      memory.metadata?.taskType || '',
      ...(memory.metadata?.tags || []),
      // Task Memory fields (nested session/learned/procedures)
      memory.typeData?.session?.task || '',
      memory.typeData?.session?.outcome || '',
      ...(memory.typeData?.session?.timeline || []).map(s => [s.action, s.target, s.result].join(' ')),
      ...(memory.typeData?.session?.failures || []),
      ...(memory.typeData?.learned?.selectors || []),
      ...(memory.typeData?.learned?.patterns || []),
      ...(memory.typeData?.procedures || []).map(p => p.name)
    ].join(' ');

    const memoryTokens = new Set(this._tokenize(memoryText));

    if (memoryTokens.size === 0) return 0;

    // Count query tokens found in memory
    let matchCount = 0;
    for (const token of queryTokens) {
      if (memoryTokens.has(token)) {
        matchCount++;
      } else {
        // Partial match: check if any memory token contains this query token
        for (const memToken of memoryTokens) {
          if (memToken.includes(token) || token.includes(memToken)) {
            matchCount += 0.5;
            break;
          }
        }
      }
    }

    return matchCount / queryTokens.length;
  }

  /**
   * Stage 3: Boost scoring based on recency, success, and access frequency
   */
  _boostScore(memory, now) {
    let score = 0;

    // Recency: exponential decay over 30 days
    const daysSinceAccess = (now - memory.lastAccessedAt) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSinceAccess / 30);
    score += recencyScore * 0.4;

    // Access frequency: log scale, capped
    const accessScore = Math.min(Math.log2(memory.accessCount + 1) / 5, 1);
    score += accessScore * 0.2;

    // Confidence from metadata
    const confidence = memory.metadata?.confidence ?? 1.0;
    score += confidence * 0.2;

    // Type-specific boosts
    if (memory.type === MEMORY_TYPES.PROCEDURAL && memory.typeData?.successRate) {
      score += memory.typeData.successRate * 0.2;
    } else if (memory.type === MEMORY_TYPES.TASK) {
      // Task memories get a boost: base 0.15, plus 0.05 for success outcome
      const outcomeBonus = memory.typeData?.session?.outcome === 'success' ? 0.05 : 0;
      score += 0.15 + outcomeBonus;
    } else {
      score += 0.1; // base for semantic or unknown
    }

    return score;
  }

  /**
   * Tokenize a string into lowercase alphanumeric tokens
   * Strips stop words for better relevance
   */
  _tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !STOP_WORDS.has(t));
  }
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'in', 'on', 'to', 'a', 'an', 'of', 'for',
  'and', 'or', 'it', 'by', 'be', 'as', 'do', 'if', 'so', 'no',
  'up', 'my', 'me', 'we', 'he', 'am', 'was', 'has', 'had', 'are',
  'but', 'not', 'you', 'all', 'can', 'her', 'its', 'our', 'out',
  'one', 'two', 'way', 'may', 'day', 'get', 'new', 'now', 'old',
  'see', 'how', 'did', 'let', 'say', 'she', 'too', 'use', 'this',
  'that', 'with', 'have', 'from', 'they', 'been', 'said', 'each',
  'which', 'their', 'will', 'other', 'about', 'many', 'then',
  'them', 'some', 'what', 'when', 'your', 'than', 'into'
]);

// Singleton
const memoryRetriever = new MemoryRetriever();

// Export for service worker and module contexts
if (typeof self !== 'undefined') {
  self.MemoryRetriever = MemoryRetriever;
  self.memoryRetriever = memoryRetriever;
}
