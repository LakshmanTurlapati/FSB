/**
 * AI-powered memory extraction from completed sessions
 * Uses the existing AI provider to extract 1-5 memories per session.
 * Cost: ~$0.0003-0.0005 per extraction (grok-4-1-fast)
 */

class MemoryExtractor {
  constructor() {
    this._provider = null;
  }

  /**
   * Extract memories from a completed automation session
   * @param {Object} session - The session object from background.js
   * @param {Object} context - Additional context (domain, AI integration ref)
   * @returns {Promise<Object[]>} Array of memory objects ready for storage
   */
  async extract(session, context = {}) {
    if (!session || !session.task) {
      console.warn('[MemoryExtractor] No session or task to extract from');
      return [];
    }

    const provider = await this._getProvider(context);
    if (!provider) {
      console.warn('[MemoryExtractor] No AI provider available, skipping extraction');
      return [];
    }

    try {
      const prompt = this._buildExtractionPrompt(session, context);
      const requestBody = await provider.buildRequest(prompt, {});
      const response = await provider.sendRequest(requestBody, { attempt: 0 });
      const parsed = provider.parseResponse(response);

      const rawContent = typeof parsed.content === 'string'
        ? parsed.content
        : (parsed.content?.memories || parsed.content?.result || JSON.stringify(parsed.content));

      return this._parseExtractedMemories(rawContent, session, context);
    } catch (error) {
      console.error('[MemoryExtractor] Extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Build the extraction prompt for the AI
   */
  _buildExtractionPrompt(session, context) {
    const domain = context.domain || this._extractDomain(session);
    const status = session.status || 'unknown';
    const duration = session.startTime ? Date.now() - session.startTime : 0;
    const actionCount = session.actionHistory?.length || 0;

    // Summarize actions (keep it concise for token efficiency)
    const actionSummary = (session.actionHistory || [])
      .slice(-15) // last 15 actions
      .map(a => {
        const tool = a.tool || 'unknown';
        const success = a.result?.success !== false;
        const target = a.params?.selector || a.params?.url || a.params?.query || '';
        return `${tool}(${target.substring(0, 60)}) -> ${success ? 'ok' : 'fail'}`;
      })
      .join('\n');

    const systemPrompt = `You are a memory extraction system for a browser automation tool.
Given a completed automation session, extract 1-5 useful memories that would help future sessions.

Output ONLY valid JSON array. Each memory object must have:
- type: "episodic" (session summary), "semantic" (learned fact), or "procedural" (action pattern)
- text: concise description (max 150 chars)
- confidence: 0.0-1.0 (how reliable this learning is)
- tags: array of relevant keywords
- taskType: category like "search", "form", "navigation", "purchase", "login", "extraction"

Rules:
- Extract the MOST USEFUL lessons, not everything
- For failed sessions, focus on what went wrong and what to avoid
- For successful sessions, capture the winning strategy
- For procedural memories, include key selectors that worked
- Keep text actionable and specific to the domain
- Do NOT include sensitive data (passwords, personal info)`;

    const userPrompt = `Session data:
Task: ${session.task}
Domain: ${domain}
Status: ${status}
Duration: ${Math.round(duration / 1000)}s
Total actions: ${actionCount}
Stuck count: ${session.stuckCounter || 0}

Action log (last 15):
${actionSummary || 'No actions recorded'}

${session.error ? `Error: ${session.error}` : ''}

Extract memories from this session as a JSON array:`;

    return {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };
  }

  /**
   * Parse the AI response into validated memory objects
   */
  _parseExtractedMemories(rawContent, session, context) {
    let memories = [];

    try {
      // Try direct JSON parse
      let parsed;
      if (typeof rawContent === 'string') {
        // Strip markdown code blocks if present
        const cleaned = rawContent
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
        parsed = JSON.parse(cleaned);
      } else if (Array.isArray(rawContent)) {
        parsed = rawContent;
      } else if (rawContent && typeof rawContent === 'object') {
        parsed = rawContent.memories || [rawContent];
      }

      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      const domain = context.domain || this._extractDomain(session);
      const sessionId = session.sessionId || null;

      for (const item of parsed.slice(0, 5)) { // max 5
        if (!item || !item.type || !item.text) continue;

        const metadata = {
          domain,
          taskType: item.taskType || null,
          tags: item.tags || [],
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
          sourceSessionId: sessionId
        };

        let memory;
        switch (item.type) {
          case 'episodic':
            memory = createEpisodicMemory(item.text, metadata, {
              task: session.task,
              outcome: session.status === 'completed' ? 'success' : 'failure',
              domain,
              duration: session.startTime ? Date.now() - session.startTime : 0,
              iterationCount: session.iterationCount || 0,
              stepsCompleted: item.stepsCompleted || [],
              failures: item.failures || []
            });
            break;

          case 'semantic':
            memory = createSemanticMemory(item.text, metadata, {
              category: item.category || 'general',
              selectorInfo: item.selectorInfo || null,
              sitePattern: item.sitePattern || null
            });
            break;

          case 'procedural':
            memory = createProceduralMemory(item.text, metadata, {
              steps: item.steps || [],
              selectors: item.selectors || [],
              successRate: session.status === 'completed' ? 1.0 : 0.0,
              totalRuns: 1,
              targetUrl: item.targetUrl || null
            });
            break;

          default:
            continue;
        }

        const validation = validateMemory(memory);
        if (validation.valid) {
          memories.push(memory);
        }
      }
    } catch (error) {
      console.error('[MemoryExtractor] Failed to parse AI response:', error.message);
      // Fallback: create a simple episodic memory from the session
      const domain = context.domain || this._extractDomain(session);
      const fallback = createEpisodicMemory(
        `${session.status === 'completed' ? 'Completed' : 'Failed'}: ${session.task?.substring(0, 100)}`,
        {
          domain,
          taskType: 'general',
          tags: ['auto-extracted'],
          confidence: 0.5,
          sourceSessionId: session.sessionId
        },
        {
          task: session.task,
          outcome: session.status === 'completed' ? 'success' : 'failure',
          domain,
          duration: session.startTime ? Date.now() - session.startTime : 0,
          iterationCount: session.iterationCount || 0
        }
      );
      memories.push(fallback);
    }

    return memories;
  }

  /**
   * Get or create an AI provider for extraction calls
   */
  async _getProvider(context) {
    // Reuse provider from context if available
    if (context.provider) return context.provider;
    if (this._provider) return this._provider;

    try {
      // Load config and create a provider (same pattern as ai-integration.js)
      const cfg = await config.loadFromStorage();
      if (!cfg.apiKey && !cfg.geminiApiKey) return null;

      const provider = new UniversalProvider(cfg.modelProvider, cfg.modelName, {
        apiKey: cfg.apiKey,
        geminiApiKey: cfg.geminiApiKey,
        openaiApiKey: cfg.openaiApiKey,
        anthropicApiKey: cfg.anthropicApiKey,
        customEndpoint: cfg.customEndpoint,
        customApiKey: cfg.customApiKey
      });

      this._provider = provider;
      return provider;
    } catch (error) {
      console.error('[MemoryExtractor] Failed to create provider:', error.message);
      return null;
    }
  }

  /**
   * Extract domain from session data
   */
  _extractDomain(session) {
    // Try to get domain from action history URLs
    if (session.actionHistory) {
      for (const action of session.actionHistory) {
        if (action.params?.url) {
          try {
            return new URL(action.params.url).hostname;
          } catch { /* skip */ }
        }
      }
    }
    return null;
  }
}

// Singleton
const memoryExtractor = new MemoryExtractor();

if (typeof self !== 'undefined') {
  self.MemoryExtractor = MemoryExtractor;
  self.memoryExtractor = memoryExtractor;
}
