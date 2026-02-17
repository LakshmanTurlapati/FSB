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

    const provider = await this._getProvider(context);
    if (!provider) {
      console.log('[MemoryExtractor] No AI provider, using local fallback extraction');
      const memories = this._localFallbackExtract(session, context, newActions);
      session._lastExtractionActionIndex = allActions.length;
      return memories;
    }

    try {
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
      console.error('[MemoryExtractor] AI extraction failed:', error.message);
      const memories = this._localFallbackExtract(session, context, newActions);
      session._lastExtractionActionIndex = allActions.length;
      return memories;
    }
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
   * Local fallback extraction: produces 1-3 memories from structured session
   * data without any AI call. Used when no provider is available or AI fails.
   * @param {Object} session - Session object
   * @param {Object} context - Context object
   * @param {Array} newActions - Actions since last extraction (for procedural steps)
   */
  _localFallbackExtract(session, context, newActions) {
    const memories = [];
    const domain = context.domain || this._extractDomain(session);
    const sessionId = session.sessionId || null;
    const isSuccess = session.status === 'completed';
    const taskText = (session.task || 'unknown task').substring(0, 100);
    const duration = session.startTime ? Date.now() - session.startTime : 0;

    // 1. Always create an episodic memory
    const episodicText = `${isSuccess ? 'Completed' : 'Failed'}: ${taskText}`;
    const stepsCompleted = session._enrichedData?.sessionMemory?.stepsCompleted || [];
    const failedApproaches = session._enrichedData?.sessionMemory?.failedApproaches || [];

    const episodic = createEpisodicMemory(episodicText, {
      domain,
      taskType: 'general',
      tags: ['auto-extracted'],
      confidence: 0.6,
      sourceSessionId: sessionId
    }, {
      task: session.task,
      outcome: isSuccess ? 'success' : 'failure',
      domain,
      duration,
      iterationCount: session.iterationCount || 0,
      stepsCompleted,
      failures: failedApproaches
    });

    const episodicValidation = validateMemory(episodic);
    if (episodicValidation.valid) {
      memories.push(episodic);
    }

    // 2. Create semantic memory if working selectors exist
    const workingSelectors = session._enrichedData?.hardFacts?.workingSelectors;
    if (workingSelectors && Object.keys(workingSelectors).length > 0) {
      const selectorEntries = Object.entries(workingSelectors)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      const selectorText = `Working selectors for ${domain || 'site'}: ${selectorEntries}`.substring(0, 150);

      const semantic = createSemanticMemory(selectorText, {
        domain,
        taskType: 'general',
        tags: ['selectors', 'auto-extracted'],
        confidence: 0.8,
        sourceSessionId: sessionId
      }, {
        category: 'selector',
        selectorInfo: workingSelectors
      });

      const semanticValidation = validateMemory(semantic);
      if (semanticValidation.valid) {
        memories.push(semantic);
      }
    }

    // 3. Create procedural memory if session completed and has 2+ successful actions.
    // Use newActions (since last extraction) for step generation to avoid duplicates.
    const actionsForSteps = newActions && newActions.length > 0
      ? newActions
      : (session.actionHistory || []);
    const successfulActions = actionsForSteps.filter(a => a.result?.success !== false);

    if (isSuccess && successfulActions.length >= 2) {
      const shortTask = (session.task || 'task').substring(0, 60);
      const steps = successfulActions.slice(-10).map(a => {
        const tool = a.tool || 'action';
        const param = a.params?.selector || a.params?.url || a.params?.query || '';
        return `${tool}(${param.substring(0, 40)})`;
      });

      const selectorValues = workingSelectors
        ? Object.values(workingSelectors)
        : [];

      const procedural = createProceduralMemory(
        `Workflow for '${shortTask}': ${steps.length} steps`,
        {
          domain,
          taskType: 'general',
          tags: ['workflow', 'auto-extracted'],
          confidence: 0.7,
          sourceSessionId: sessionId
        },
        {
          steps,
          selectors: selectorValues,
          successRate: 1.0,
          totalRuns: 1,
          targetUrl: null
        }
      );

      const proceduralValidation = validateMemory(procedural);
      if (proceduralValidation.valid) {
        memories.push(procedural);
      }
    }

    console.log(`[MemoryExtractor] Local fallback produced ${memories.length} memories`);
    return memories;
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
