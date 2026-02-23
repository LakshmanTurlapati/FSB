/**
 * AI-powered memory extraction from completed sessions
 * Uses the existing AI provider to extract 1-5 memories per session.
 * Cost: ~$0.0003-0.0005 per extraction (grok-4-1-fast)
 *
 * AI-only extraction -- no local fallback. Failures surface via
 * extension badge (red "!") and console errors so the user knows
 * something went wrong.
 */

class MemoryExtractor {
  constructor() {
    // No cached provider -- fresh instance every call
  }

  /**
   * Extract memories from a completed automation session.
   * Requires a configured AI provider. On failure the extension badge
   * is set to red "!" and the error propagates to the caller.
   * @param {Object} session - The session object from background.js
   * @param {Object} context - Additional context (domain, AI integration ref)
   * @returns {Promise<Object[]>} Array of memory objects ready for storage
   */
  async extract(session, context = {}) {
    if (!session || !session.task) {
      console.warn('[MemoryExtractor] No session or task to extract from');
      return [];
    }

    // Slice actionHistory to only new actions since last extraction.
    // This prevents duplicate memories when follow-up commands trigger
    // extraction on a session whose actionHistory keeps growing.
    const actionStartIndex = session._lastExtractionActionIndex || 0;
    const allActions = session.actionHistory || [];
    const newActions = allActions.slice(actionStartIndex);

    if (actionStartIndex > 0 && newActions.length === 0) {
      console.log('[MemoryExtractor] No new actions since last extraction, skipping');
      return [];
    }

    // Retry configuration for transient errors
    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1000, 2000];

    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const provider = await this._getProvider(context);
        const prompt = this._buildExtractionPrompt(session, context, newActions);
        const requestBody = await provider.buildRequest(prompt, {});
        const response = await provider.sendRequest(requestBody, { attempt: 0 });
        const parsed = provider.parseResponse(response);

        const rawContent = typeof parsed.content === 'string'
          ? parsed.content
          : (parsed.content?.memories || parsed.content?.result || JSON.stringify(parsed.content));

        const memories = this._parseExtractedMemories(rawContent, session, context);
        session._lastExtractionActionIndex = allActions.length;
        return memories;
      } catch (error) {
        lastError = error;

        // Auth errors: surface immediately, no retry
        if (this._isAuthError(error)) {
          console.error('[MemoryExtractor] AI extraction auth error:', error.message);
          session._lastExtractionActionIndex = allActions.length;
          this._setBadgeError();
          throw error;
        }

        // Transient errors: retry if attempts remain
        if (attempt < MAX_RETRIES && this._isTransientError(error)) {
          console.warn(`[MemoryExtractor] Transient error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${RETRY_DELAYS[attempt]}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
          continue;
        }

        // Non-retryable or retries exhausted
        break;
      }
    }

    // All attempts failed
    console.error('[MemoryExtractor] AI extraction failed:', lastError?.message);
    session._lastExtractionActionIndex = allActions.length;
    this._setBadgeError();
    throw lastError;
  }

  /**
   * Build the extraction prompt for the AI
   * @param {Object} session - Session object
   * @param {Object} context - Context object
   * @param {Array} newActions - Actions since last extraction (subset of actionHistory)
   */
  _buildExtractionPrompt(session, context, newActions) {
    const domain = context.domain || this._extractDomain(session);
    const status = session.status || 'unknown';
    const duration = session.startTime ? Date.now() - session.startTime : 0;

    // Use newActions for the summary if available, otherwise fall back to full history
    const actionsToSummarize = newActions && newActions.length > 0
      ? newActions
      : (session.actionHistory || []);
    const actionCount = actionsToSummarize.length;

    // Summarize actions (keep it concise for token efficiency)
    const actionSummary = actionsToSummarize
      .slice(-15) // last 15 actions
      .map(a => {
        const tool = a.tool || 'unknown';
        const success = a.result?.success !== false;
        const target = a.params?.selector || a.params?.url || a.params?.query || '';
        return `${tool}(${target.substring(0, 60)}) -> ${success ? 'ok' : 'fail'}`;
      })
      .join('\n');

    // Build enriched section from AI instance data if available
    let enrichedSection = '';
    if (session._enrichedData) {
      const ed = session._enrichedData;
      if (ed.hardFacts?.workingSelectors) {
        const ws = Object.entries(ed.hardFacts.workingSelectors);
        if (ws.length > 0) {
          enrichedSection += '\nWorking selectors discovered:\n' + ws.map(([k, v]) => `  ${k}: ${v}`).join('\n');
        }
      }
      if (ed.hardFacts?.criticalActions?.length > 0) {
        enrichedSection += '\nCritical actions:\n' + ed.hardFacts.criticalActions.map(a => `  ${a.description} (verified: ${a.verified})`).join('\n');
      }
      if (ed.sessionMemory?.stepsCompleted?.length > 0) {
        enrichedSection += '\nSteps completed:\n' + ed.sessionMemory.stepsCompleted.slice(-10).join('\n');
      }
    }

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
${enrichedSection}
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
      // Return whatever memories were successfully parsed so far (could be empty)
    }

    return memories;
  }

  /**
   * Load provider settings from chrome.storage.local, validate the API key
   * for the active provider, and return a fresh UniversalProvider instance.
   * Throws on missing config -- caller is responsible for error handling.
   * @param {Object} context - May contain a pre-built .provider
   * @returns {Promise<UniversalProvider>}
   */
  async _getProvider(context) {
    // Reuse provider from context if available
    if (context.provider) return context.provider;

    // Load config directly from chrome.storage.local (matches sitemap-refiner.js pattern)
    const cfg = await new Promise((resolve) => {
      chrome.storage.local.get([
        'modelProvider', 'modelName', 'apiKey',
        'geminiApiKey', 'openaiApiKey', 'anthropicApiKey',
        'customApiKey', 'customEndpoint'
      ], (result) => {
        resolve({
          modelProvider: result.modelProvider || 'xai',
          modelName: result.modelName || 'grok-4-1-fast',
          apiKey: result.apiKey || '',
          geminiApiKey: result.geminiApiKey || '',
          openaiApiKey: result.openaiApiKey || '',
          anthropicApiKey: result.anthropicApiKey || '',
          customApiKey: result.customApiKey || '',
          customEndpoint: result.customEndpoint || ''
        });
      });
    });

    // Validate API key for selected provider
    const providerName = cfg.modelProvider;
    const keyMap = {
      xai: cfg.apiKey,
      gemini: cfg.geminiApiKey,
      openai: cfg.openaiApiKey,
      anthropic: cfg.anthropicApiKey,
      custom: cfg.customApiKey
    };
    const activeKey = keyMap[providerName] || cfg.apiKey || '';

    if (!activeKey) {
      throw new Error(`[MemoryExtractor] No API key configured for ${providerName}. Memory extraction requires an AI provider.`);
    }

    if (!cfg.modelName) {
      throw new Error('[MemoryExtractor] No model name configured. Memory extraction requires a model selection.');
    }

    return new UniversalProvider(cfg);
  }

  /**
   * Enrich a single already-stored memory with AI analysis.
   * Returns a structured analysis object, or null on any failure.
   * This method never throws -- all errors are caught and logged.
   * Failures set the extension badge to red "!" so the user is aware.
   * @param {Object} memory - A stored memory object
   * @param {Object} context - Optional context (provider, etc.)
   * @returns {Promise<Object|null>} AI analysis object or null
   */
  async enrich(memory, context = {}) {
    try {
      if (!memory || !memory.type || !memory.text) {
        console.warn('[MemoryExtractor] enrich() called with invalid memory');
        return null;
      }

      const provider = await this._getProvider(context);

      const prompt = this._buildEnrichmentPrompt(memory);
      const requestBody = await provider.buildRequest(prompt, {});
      const response = await provider.sendRequest(requestBody, { attempt: 0 });
      const parsed = provider.parseResponse(response);

      const rawContent = typeof parsed.content === 'string'
        ? parsed.content
        : JSON.stringify(parsed.content);

      const analysis = this._parseEnrichmentResponse(rawContent);

      // Track AI usage for cost attribution
      const inputTokens = parsed.usage?.prompt_tokens || parsed.usage?.inputTokens || 0;
      const outputTokens = parsed.usage?.completion_tokens || parsed.usage?.outputTokens || 0;
      const model = parsed.model || 'unknown';
      if (typeof globalAnalytics !== 'undefined' && globalAnalytics) {
        globalAnalytics.trackUsage(model, inputTokens, outputTokens, true, 'memory')
          .catch(err => console.warn('[MemoryExtractor] Analytics tracking failed:', err.message));
      }

      return analysis;
    } catch (error) {
      console.error('[MemoryExtractor] Enrichment failed:', error.message);
      this._setBadgeError();
      return null;
    }
  }

  /**
   * Build a type-specific enrichment prompt for a memory.
   * Prompts are kept short (~50 tokens system, ~100 tokens user).
   * @param {Object} memory - The memory to analyze
   * @returns {Object} Prompt object with messages array
   */
  _buildEnrichmentPrompt(memory) {
    const typePrompts = {
      episodic: 'Analyze this automation session. Return JSON with: { lessonsLearned: string[], patterns: string[], riskFactors: string[], optimizationTips: string[] }',
      semantic: 'Analyze this learned fact. Return JSON with: { category: string, relatedPatterns: string[], reliability: string, usageContext: string }',
      procedural: 'Analyze this action workflow. Return JSON with: { optimizationSuggestions: string[], reliabilityAssessment: string, alternativeApproaches: string[], complexityRating: string }'
    };

    const systemPrompt = typePrompts[memory.type] || typePrompts.episodic;

    const typeDataStr = memory.typeData
      ? JSON.stringify(memory.typeData).substring(0, 500)
      : '{}';

    const userPrompt = `Memory: ${memory.text}\nType: ${memory.type}\nDomain: ${memory.metadata?.domain || 'unknown'}\nData: ${typeDataStr}`;

    return {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };
  }

  /**
   * Parse the AI enrichment response into a structured object.
   * Never throws -- returns a fallback object on parse failure.
   * @param {string} rawContent - Raw response content
   * @returns {Object} Parsed analysis object
   */
  _parseEnrichmentResponse(rawContent) {
    try {
      // Strip markdown code blocks if present
      const cleaned = rawContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      // Fallback: return raw content as minimal analysis
      return { rawAnalysis: (rawContent || '').substring(0, 500) };
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

  /**
   * Check if an error is an authentication/authorization error.
   * These should surface immediately without retry.
   */
  _isAuthError(error) {
    const msg = (error.message || '').toLowerCase();
    const status = error.status || error.statusCode || 0;
    return status === 401 || status === 403 ||
      msg.includes('unauthorized') || msg.includes('forbidden') ||
      /invalid.*key/i.test(error.message || '');
  }

  /**
   * Check if an error is transient and worth retrying.
   */
  _isTransientError(error) {
    const msg = (error.message || '').toLowerCase();
    const status = error.status || error.statusCode || 0;
    return status === 429 || status === 503 ||
      msg.includes('timeout') || msg.includes('econnreset') ||
      msg.includes('network') || msg.includes('rate limit');
  }

  /**
   * Set extension badge to red "!" to indicate extraction failure.
   */
  _setBadgeError() {
    try {
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      chrome.action.setBadgeText({ text: '!' });
    } catch (badgeErr) {
      // Badge API might not be available in all contexts
    }
  }
}

// Singleton
const memoryExtractor = new MemoryExtractor();

if (typeof self !== 'undefined') {
  self.MemoryExtractor = MemoryExtractor;
  self.memoryExtractor = memoryExtractor;
}
