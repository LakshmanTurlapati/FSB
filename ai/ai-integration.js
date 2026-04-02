/**
 * AI Integration module for Browser Agent
 * This module handles communication with multiple AI providers (xAI, Gemini)
 */

// Import provider implementations
if (typeof importScripts !== 'undefined') {
  importScripts('ai/ai-providers.js');
}

// Dead code removed: PROMPT_CHAR_LIMIT, CLI_COMMAND_TABLE (Phase 139.1 cleanup)
// These were only used by the deleted buildPrompt/getToolsDocumentation methods.

/**
 * Format a site map into a compact prompt section for AI context injection.
 * Budget: ~500-800 chars to fit within memory allocation.
 */
function formatSiteKnowledge(siteMap, domain) {
  if (!siteMap) return '';

  const lines = [`SITE KNOWLEDGE (${domain}):`];

  // Pages summary (compact)
  if (siteMap.pages) {
    const pageEntries = Object.entries(siteMap.pages);
    const pageList = pageEntries.slice(0, 15).map(([path, info]) => {
      const parts = [path];
      if (info.title) parts.push(info.title);
      if (info.formCount > 0) parts.push(`${info.formCount} forms`);
      return parts.join(' - ');
    }).join(', ');
    if (pageList) lines.push(`Pages: ${pageList}`);
  }

  // Navigation links
  if (siteMap.navigation && siteMap.navigation.length > 0) {
    const navItems = siteMap.navigation.slice(0, 10).map(n => n.label).join(', ');
    lines.push(`Navigation: ${navItems}`);
  }

  // Workflows (from AI refinement - Tier 2)
  if (siteMap.workflows && siteMap.workflows.length > 0) {
    lines.push('Workflows: ' + siteMap.workflows.slice(0, 5).join('; '));
  }

  // Tips (from AI refinement - Tier 2)
  if (siteMap.tips && siteMap.tips.length > 0) {
    lines.push('Tips: ' + siteMap.tips.slice(0, 5).join('; '));
  }

  // Navigation strategy (from AI refinement)
  if (siteMap.navigationStrategy) {
    lines.push('Nav strategy: ' + siteMap.navigationStrategy);
  }

  // Key selectors (compact)
  if (siteMap.keySelectors) {
    const selectorEntries = Object.entries(siteMap.keySelectors);
    if (selectorEntries.length > 0) {
      const selectorSummary = selectorEntries.slice(0, 5).map(([page, sels]) => {
        const selList = Array.isArray(sels) ? sels.slice(0, 3).join(', ') : sels;
        return `${page}: ${selList}`;
      }).join('; ');
      lines.push(`Key selectors: ${selectorSummary}`);
    }
  }

  // Cap total length at 800 chars
  let result = lines.join('\n');
  if (result.length > 800) {
    result = result.substring(0, 797) + '...';
  }
  return result;
}

if (typeof self !== 'undefined') {
  self.formatSiteKnowledge = formatSiteKnowledge;
}

/**
 * Standalone security sanitization for parsed actions.
 * Extracted from the former normalizeResponse method.
 * Blocks dangerous navigate URIs (data:, javascript:) and type actions
 * containing script injection patterns (<script, javascript:, onerror=).
 *
 * @param {Array<{tool: string, params: Object}>} actions - Parsed action array
 * @returns {Array<{tool: string, params: Object}>} Sanitized actions (dangerous ones removed)
 */
function sanitizeActions(actions) {
  if (!Array.isArray(actions)) return [];

  return actions.filter(action => {
    if (!action || !action.tool) return false;

    // Block navigate actions with data: or javascript: URIs
    if (action.tool === 'navigate' && action.params?.url) {
      const url = String(action.params.url).toLowerCase();
      if (url.startsWith('data:') || url.startsWith('javascript:')) {
        console.warn('[FSB] Blocked suspicious navigate action:', action.params.url.substring(0, 100));
        return false;
      }
    }

    // Block type actions containing script injection patterns
    if (action.tool === 'type' && action.params?.text) {
      const text = String(action.params.text).toLowerCase();
      if (text.includes('<script') || text.includes('javascript:') || text.includes('onerror=')) {
        console.warn('[FSB] Blocked suspicious type action with script content');
        return false;
      }
    }

    return true;
  });
}

// Dead code removed: TASK_PROMPTS, HYBRID_CONTINUATION_PROMPT, BATCH_ACTION_INSTRUCTIONS (Phase 139.1 cleanup)
// These were only used by the deleted buildPrompt/_buildTaskGuidance methods.
// TASK_PROMPTS was a large object of per-task-type system prompt templates.
// HYBRID_CONTINUATION_PROMPT was a minimal prompt for continuation iterations.
// BATCH_ACTION_INSTRUCTIONS was multi-command batching text for the system prompt.
// buildSheetsFormattingDirective was only referenced by the deleted buildPrompt method.


/**
 * AIIntegration class handles all AI-related functionality for browser automation
 * @class
 */
class AIIntegration {
  /**
   * Creates an instance of AIIntegration
   * @param {Object} settings - Configuration settings for the AI integration
   * @param {string} settings.modelProvider - The AI provider ('xai' or 'gemini')
   * @param {string} settings.modelName - The specific model to use
   * @param {string} settings.apiKey - The API key (for xAI)
   * @param {string} settings.geminiApiKey - The Gemini API key
   * @param {string} settings.speedMode - Legacy speed mode support
   */
  constructor(settings) {
    this.settings = this.migrateSettings(settings);

    // Initialize model name from settings (fix for undefined in analytics)
    // This ensures model is available before testConnection() completes
    this.model = this.settings.modelName || this.settings.model || 'unknown';

    // Set API endpoint for legacy fallback
    this.apiEndpoint = 'https://api.x.ai/v1/chat/completions';

    // Create appropriate provider instance
    this.provider = this.createProvider();

    // Request queue and cache
    // PERF: Max queue size to prevent unbounded growth if API is slow
    this.requestQueue = [];
    this.requestQueueMaxSize = 20;
    this.isProcessing = false;
    this.responseCache = new Map();
    this.cacheMaxSize = 50;
    this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes

    // Multi-turn conversation state for token efficiency
    // Stores message history per session to avoid rebuilding full context each iteration
    this.conversationHistory = [];
    this.conversationSessionId = null;
    this.maxConversationTurns = 4; // PERF: Reduced from 8 to 4 -- session memory and compacted summary preserve older context

    // Session memory: structured facts extracted locally each turn
    this.sessionMemory = null;

    // AI-compacted summary of older conversation turns
    this.compactedSummary = null;

    // In-flight compaction promise (null when no compaction running)
    this.pendingCompaction = null;

    // Compaction triggers when raw turns exceed this count
    this.compactionThreshold = 4; // trigger after 4 turn pairs

    // Number of raw turn pairs to keep verbatim
    this.rawTurnsToKeep = 3;

    // Long-term memories from past sessions (fetched once per session, injected synchronously)
    this._longTermMemories = [];
    this._longTermMemoriesSessionId = null;
    // Phase 101 (MEM-04): Cross-domain procedural memories pre-fetched for fallback
    this._crossDomainProcedural = [];
    // Phase 101 (MEM-05): Track last domain used for memory fetch
    this._lastMemoryDomain = null;

    // SM-22: Site map knowledge cache for synchronous injection in prompt building
    this._lastSiteKnowledgeDomain = null;
    this._cachedSiteMap = null;
    this._cachedSiteMapDomain = null;
    this._cachedSiteMapSource = null;
  }
  
  // Migrate legacy settings to new format
  migrateSettings(settings) {
    const migrated = { ...settings };

    // Handle legacy speedMode
    if (!migrated.modelName && migrated.speedMode) {
      migrated.modelProvider = 'xai';
      migrated.modelName = 'grok-4-1-fast-reasoning'; // All legacy modes map to new default
    }

    // Migrate legacy model names to new models
    const legacyModels = [
      'grok-3-fast',
      'grok-3-mini-fast-beta',
      'grok-3-mini-beta',
      'grok-4-fast',        // Old model that no longer exists
      'grok-3-fast-beta'    // Old beta model
    ];
    if (legacyModels.includes(migrated.modelName)) {
      migrated.modelName = 'grok-4-1-fast-reasoning'; // New recommended default
    }

    // Set defaults
    migrated.modelProvider = migrated.modelProvider || 'xai';
    migrated.modelName = migrated.modelName || 'grok-4-1-fast-reasoning';

    return migrated;
  }
  
  // Create provider instance based on settings
  createProvider() {
    automationLogger.logInit('ai_provider', 'loading', { provider: this.settings.modelProvider, model: this.settings.modelName });

    try {
      if (typeof createAIProvider !== 'undefined') {
        automationLogger.logInit('ai_provider', 'ready', { type: 'UniversalProvider', provider: this.settings.modelProvider });
        return createAIProvider(this.settings);
      }
    } catch (error) {
      automationLogger.logInit('ai_provider', 'failed', { error: error.message });
    }

    automationLogger.warn('AI providers not loaded, using legacy xAI implementation', {});
    return null;
  }

  /**
   * Clear conversation history for multi-turn sessions
   * Call this when a session ends or a new task starts
   */
  clearConversationHistory() {
    const previousLength = this.conversationHistory.length;
    this.conversationHistory = [];
    this.conversationSessionId = null;
    this.sessionMemory = null;
    this.compactedSummary = null;
    this.pendingCompaction = null;
    // MEM-03: Reset hard facts and selector tracking
    this.hardFacts = {
      taskGoal: '',
      criticalActions: [],   // { description, selector, verified, iteration }
      workingSelectors: {}   // { label: selector } -- max 10 entries
    };
    this._selectorUsageCount = {};
    // SM-22: Reset site map knowledge cache
    this._lastSiteKnowledgeDomain = null;
    this._cachedSiteMap = null;
    this._cachedSiteMapDomain = null;
    this._cachedSiteMapSource = null;
    if (previousLength > 0) {
      automationLogger.debug('Cleared conversation history', { previousLength });
    }
  }

  // Legacy follow-up bridge for non-agent automation paths.
  // Native tool-use sessions now carry follow-up continuity through
  // background.js -> session.followUpContext / session.agentResumeState.
  injectFollowUpContext(newTask) {
    this.conversationHistory.push({
      role: 'user',
      content: `[FOLLOW-UP COMMAND] My previous task is done. New follow-up request: ${newTask}`
    });

    this._currentTask = newTask;

    if (this.hardFacts) {
      this.hardFacts.taskGoal = newTask;
    }

    automationLogger.debug('Injected follow-up context', {
      newTask: newTask.substring(0, 100),
      conversationLength: this.conversationHistory.length,
      hasHardFacts: !!this.hardFacts,
      workingSelectors: this.hardFacts ? Object.keys(this.hardFacts.workingSelectors).length : 0
    });
  }

  /**
   * Format structured change information for AI prompts
   * Renders human-readable change summary from multi-signal detection
   * @param {Object} context - Automation context with changeSignals and domChanged
   * @returns {string} Formatted change info string
   */
  formatChangeInfo(context) {
    const cs = context?.changeSignals;
    if (!cs) {
      // Fallback for backward compatibility if changeSignals not present
      return `DOM changed: ${context?.domChanged ? 'Yes' : 'No'}`;
    }
    if (!cs.changed) {
      return 'DOM changed: No (page appears unchanged since your last action)';
    }
    let info = 'DOM changed: Yes';
    if (cs.summary && cs.summary.length > 0) {
      info += ' -- ' + cs.summary.join('; ');
    }
    return info;
  }
  // Dead code removed: buildMinimalUpdate (Phase 139.1 cleanup)
  // Was only called by getAutomationActions for continuation iterations.


  /**
   * Manage conversation history size to prevent unbounded growth
   * Keeps system message + last N turns
   */
  trimConversationHistory() {
    const rawKeepCount = this.rawTurnsToKeep * 2; // message pairs to keep raw
    const totalNonSystem = this.conversationHistory.length - 1; // exclude system msg
    const turnPairs = Math.floor(totalNonSystem / 2);

    // Only act when we have more turns than we want to keep raw
    if (turnPairs <= this.rawTurnsToKeep) return;

    // Trigger parallel compaction if threshold reached and none running
    if (turnPairs >= this.compactionThreshold && !this.pendingCompaction) {
      this.triggerCompaction();
    }

    // If we have compacted summary OR structured memory, we can safely trim
    if (this.compactedSummary || this.sessionMemory) {
      const systemMessage = this.conversationHistory[0];
      const recentMessages = this.conversationHistory.slice(-rawKeepCount);
      const memoryContext = this.buildMemoryContext();

      this.conversationHistory = [
        systemMessage,
        { role: 'user', content: memoryContext },
        { role: 'assistant', content: 'Understood. I have the full context of this session. Continuing with the task.' },
        ...recentMessages
      ];

      automationLogger.debug('Trimmed with compaction', {
        newLength: this.conversationHistory.length,
        hasCompactedSummary: !!this.compactedSummary,
        hasSessionMemory: !!this.sessionMemory,
        rawTurnsKept: this.rawTurnsToKeep
      });
    } else {
      // No memory available yet -- fall back to old behavior
      const maxMessages = this.maxConversationTurns * 2 + 1;
      if (this.conversationHistory.length > maxMessages) {
        const systemMessage = this.conversationHistory[0];
        const recentMessages = this.conversationHistory.slice(-(this.maxConversationTurns * 2));
        this.conversationHistory = [systemMessage, ...recentMessages];
      }
    }
  }

  /**
   * Update conversation history after a successful API call
   * @param {Object} prompt - The prompt that was sent
   * @param {Object} response - The AI response
   * @param {boolean} isFirstIteration - Whether this is the first iteration
   */
  updateConversationHistory(prompt, response, isFirstIteration) {
    try {
      // Store raw CLI text as-is (no JSON.stringify). The _rawCliText field is
      // attached from the raw AI output before CLI parsing.
      const responseContent = response._rawCliText || '';

      if (isFirstIteration) {
        // First iteration: store system + user + assistant
        if (prompt.systemPrompt && prompt.userPrompt) {
          this.conversationHistory = [
            { role: 'system', content: prompt.systemPrompt },
            { role: 'user', content: prompt.userPrompt },
            { role: 'assistant', content: responseContent }
          ];
        } else if (prompt.messages) {
          // Already in messages format
          this.conversationHistory = [
            ...prompt.messages,
            { role: 'assistant', content: responseContent }
          ];
        }
      } else if (this._domainChanged && prompt.systemPrompt) {
        // Domain change: replace system prompt with new site guide, keep recent exchanges for context
        this._domainChanged = false;
        const recentExchanges = this.conversationHistory.slice(1).slice(-4); // last 2 user-assistant pairs
        this.conversationHistory = [
          { role: 'system', content: prompt.systemPrompt },
          ...recentExchanges,
          { role: 'user', content: prompt.userPrompt },
          { role: 'assistant', content: responseContent }
        ];
        automationLogger.debug('Domain change: replaced system prompt, kept recent exchanges', {
          sessionId: this.currentSessionId,
          keptExchanges: recentExchanges.length,
          newHistoryLength: this.conversationHistory.length
        });
      } else {
        // Subsequent iterations: append user + assistant
        if (prompt.messages && prompt.messages.length > 0) {
          // Get the last user message from the prompt
          const lastUserMsg = prompt.messages[prompt.messages.length - 1];
          if (lastUserMsg.role === 'user') {
            this.conversationHistory.push(lastUserMsg);
          }
        }
        this.conversationHistory.push({ role: 'assistant', content: responseContent });
      }

      // Update structured session memory from this turn's response
      this.updateSessionMemory(
        typeof response === 'string' ? {} : response,
        { lastActionResult: this._lastActionResult, currentUrl: this._currentUrl }
      );

      // Trim history to prevent unbounded growth
      this.trimConversationHistory();

      automationLogger.debug('Updated conversation history', {
        sessionId: this.currentSessionId,
        historyLength: this.conversationHistory.length,
        messageRoles: this.conversationHistory.map(m => m.role)
      });
    } catch (error) {
      automationLogger.warn('Failed to update conversation history', {
        sessionId: this.currentSessionId,
        error: error.message
      });
    }
  }

  /**
   * Extract structured facts from each AI response locally (no API call).
   * Updates sessionMemory with steps completed, failures, pages visited, etc.
   */
  updateSessionMemory(aiResponse, context) {
    if (!this.sessionMemory) {
      this.sessionMemory = {
        taskGoal: '',
        stepsCompleted: [],
        currentPhase: '',
        failedApproaches: [],
        keyFindings: [],
        pagesVisited: [],
        openTabs: {}  // Track tabs with meaningful content: { tabId: "description" }
      };
    }

    const mem = this.sessionMemory;

    // MEM-02: Extract task goal from _currentTask (user's original input)
    if (!mem.taskGoal) {
      if (this._currentTask) {
        mem.taskGoal = this._currentTask;
      } else if (aiResponse.reasoning) {
        // Fallback: regex extraction from AI reasoning
        const goalMatch = aiResponse.reasoning.match(/(?:task|goal|objective)[:\s]+(.{10,80})/i);
        if (goalMatch) mem.taskGoal = goalMatch[1].trim();
      }
    }

    // MEM-03: Also set hardFacts.taskGoal (only once when empty)
    if (this.hardFacts && !this.hardFacts.taskGoal && this._currentTask) {
      this.hardFacts.taskGoal = this._currentTask;
    }

    // MEM-02: Track completed steps from the single most-recently-completed action
    // Uses context.lastActionResult (actionHistory entry: { tool, params, result: {slim}, iteration })
    const lastAction = context?.lastActionResult;
    if (lastAction && lastAction.result?.success) {
      const actionTool = lastAction.tool || lastAction.result?.tool || 'action';
      const stepDesc = this.describeAction(actionTool, lastAction.result);
      if (stepDesc && !mem.stepsCompleted.includes(stepDesc)) {
        mem.stepsCompleted.push(stepDesc);
        if (mem.stepsCompleted.length > 15) {
          mem.stepsCompleted = mem.stepsCompleted.slice(-15);
        }
      }

      // MEM-03: Detect critical actions (irrevocable verb clicks)
      if (this.hardFacts && actionTool === 'click') {
        const elemText = lastAction.result.elementText || '';
        if (/send|submit|purchase|order|delete|publish|post/i.test(elemText)) {
          const criticalEntry = {
            description: stepDesc,
            selector: lastAction.result.selectorUsed || lastAction.result.clicked || '',
            verified: lastAction.result.hadEffect !== false,
            iteration: this.currentIteration || 0
          };
          this.hardFacts.criticalActions.push(criticalEntry);
          // Cap at 10 entries, remove oldest
          if (this.hardFacts.criticalActions.length > 10) {
            this.hardFacts.criticalActions.shift();
          }
        }
      }

      // MEM-03: Track working selectors (promote after 2+ uses with success AND hadEffect)
      if (this.hardFacts && lastAction.result.success === true && lastAction.result.hadEffect === true && lastAction.result.selectorUsed) {
        const sel = lastAction.result.selectorUsed;
        if (!this._selectorUsageCount) this._selectorUsageCount = {};
        this._selectorUsageCount[sel] = (this._selectorUsageCount[sel] || 0) + 1;

        if (this._selectorUsageCount[sel] >= 2) {
          // Promote to hardFacts.workingSelectors
          const label = lastAction.result.elementText
            ? lastAction.result.elementText.substring(0, 30)
            : (actionTool || 'element');
          const selectorKeys = Object.keys(this.hardFacts.workingSelectors);
          if (selectorKeys.length >= 10) {
            // Evict least-used: find selector with lowest usage count
            let minKey = selectorKeys[0];
            let minCount = Infinity;
            for (const k of selectorKeys) {
              const kSel = this.hardFacts.workingSelectors[k];
              const kCount = this._selectorUsageCount[kSel] || 0;
              if (kCount < minCount) { minCount = kCount; minKey = k; }
            }
            delete this.hardFacts.workingSelectors[minKey];
          }
          this.hardFacts.workingSelectors[label] = sel;
        }
      }
    }

    // MEM-02: Track failed approaches with element text context
    if (lastAction && !lastAction.result?.success && lastAction.result?.error) {
      const actionTool = lastAction.tool || lastAction.result?.tool || 'action';
      const elemText = lastAction.result.elementText;
      const errorMsg = lastAction.result.error.substring(0, 80);
      const failDesc = elemText
        ? `${actionTool} on '${elemText}': ${errorMsg}`
        : `${actionTool}: ${errorMsg}`;
      if (!mem.failedApproaches.some(f => f.startsWith(actionTool + ' on') || f.startsWith(actionTool + ':'))) {
        mem.failedApproaches.push(failDesc);
        if (mem.failedApproaches.length > 8) {
          mem.failedApproaches = mem.failedApproaches.slice(-8);
        }
      }
    }

    // Track page visits
    const currentUrl = context?.currentUrl;
    if (currentUrl && !mem.pagesVisited.includes(currentUrl)) {
      mem.pagesVisited.push(currentUrl);
      if (mem.pagesVisited.length > 10) {
        mem.pagesVisited = mem.pagesVisited.slice(-10);
      }
    }

    // Track open tabs with meaningful content (survives context compaction)
    if (lastAction) {
      const actionTool = lastAction.tool || lastAction.result?.tool;
      const tabId = context?.tabId;

      // Track fillsheet/readsheet — the current tab has a sheet with data
      if ((actionTool === 'fillsheet' || actionTool === 'readsheet') && tabId && lastAction.result?.success) {
        const cellInfo = lastAction.result?.cellsFilled ? ` (${lastAction.result.cellsFilled} cells)` : '';
        mem.openTabs[tabId] = `Google Sheet${cellInfo} at ${(currentUrl || '').substring(0, 80)}`;
      }

      // Track openNewTab — record the new tab's purpose
      if (actionTool === 'openNewTab' && lastAction.result?.success) {
        const url = lastAction.params?.url || '';
        if (url) {
          mem.openTabs['_pending'] = `Opened tab: ${url.substring(0, 80)}`;
        }
      }

      // Track navigate — current tab now has this URL's content
      if (actionTool === 'navigate' && tabId && lastAction.result?.success) {
        const navUrl = lastAction.result?.navigatingTo || lastAction.params?.url || '';
        if (navUrl && /sheets\.google|docs\.google/i.test(navUrl)) {
          mem.openTabs[tabId] = `Google Sheet at ${navUrl.substring(0, 80)}`;
        }
      }

      // Cap tab entries
      const tabKeys = Object.keys(mem.openTabs);
      if (tabKeys.length > 8) {
        for (const k of tabKeys.slice(0, tabKeys.length - 8)) delete mem.openTabs[k];
      }
    }

    // Update current phase from reasoning
    if (aiResponse.situationAnalysis) {
      mem.currentPhase = aiResponse.situationAnalysis.substring(0, 100);
    } else if (aiResponse.reasoning) {
      mem.currentPhase = aiResponse.reasoning.substring(0, 100);
    }
  }

  /**
   * Short human-readable description of what an action did.
   * MEM-02: Enriched with element text and selector from slim result fields.
   * @param {string} tool - Action tool name
   * @param {Object} result - Slim action result with elementText, selectorUsed, clicked, typed, etc.
   */
  describeAction(tool, result) {
    const text = result?.elementText;
    const sel = (result?.selectorUsed || result?.clicked || '').substring(0, 40);
    const selSuffix = sel ? ` (${sel})` : '';
    const textPrefix = text ? `'${text}' ` : '';

    switch (tool) {
      case 'navigate': return `navigated to ${(result?.navigatingTo || result?.result || 'page').substring(0, 60)}`;
      case 'click': return `clicked ${textPrefix || 'element '}${selSuffix}`.trim();
      case 'type': return `typed '${(result?.typed || '').substring(0, 30)}' in${selSuffix || ' input'}`;
      case 'searchGoogle': return `searched Google for '${(result?.typed || result?.result || '').substring(0, 40)}'`;
      case 'selectOption': return `selected option in dropdown${selSuffix}`;
      case 'scroll': return `scrolled page ${result?.direction || 'down'}`;
      case 'pressEnter': return `pressed Enter${selSuffix}`;
      case 'clickSearchResult': return `clicked search result${result?.resultIndex ? ' #' + result.resultIndex : ''}`;
      default: return `${tool} ${textPrefix}${selSuffix}`.trim() || `${tool} action completed`;
    }
  }

  /**
   * Fire a parallel API call to compress old conversation turns into a summary.
   * Runs concurrently with the next main automation call (no latency hit).
   */
  async triggerCompaction() {
    // Don't double-trigger
    if (this.pendingCompaction) return;

    // Need enough history to compact
    const minMessages = 1 + (this.compactionThreshold * 2);
    if (this.conversationHistory.length < minMessages) return;

    // Identify messages to compact: everything except system + last rawTurnsToKeep pairs
    const keepCount = this.rawTurnsToKeep * 2;
    const messagesToCompact = this.conversationHistory.slice(1, -(keepCount));

    if (messagesToCompact.length < 4) return;

    // Format the old turns for the compaction prompt
    const turnsSummary = messagesToCompact.map(m => {
      const content = typeof m.content === 'string'
        ? m.content.substring(0, 500)
        : JSON.stringify(m.content).substring(0, 500);
      return `[${m.role}]: ${content}`;
    }).join('\n\n');

    const compactionPrompt = {
      messages: [
        {
          role: 'system',
          content: 'You are a context compactor. Summarize the following browser automation conversation turns into a concise context block. Preserve: actions taken, results observed, pages visited, errors encountered, key element selectors found, and current progress toward the task. CRITICAL: Include 1-2 VERBATIM CLI command examples from the conversation to maintain format consistency. For example:\n# Navigated to search page\nclick e5\ntype e12 "software engineer"\nOutput ONLY the summary, no preamble.'
        },
        {
          role: 'user',
          content: `Compact these automation turns. Include verbatim CLI command examples:\n\n${turnsSummary}`
        }
      ]
    };

    // Fire and forget -- runs parallel to next automation call
    this.pendingCompaction = (async () => {
      try {
        if (!this.provider) {
          // No provider -- use local fallback
          this.compactedSummary = this._localExtractiveFallback(messagesToCompact).substring(0, 1500);
          return this.compactedSummary;
        }

        const requestBody = await this.provider.buildRequest(compactionPrompt, {});
        const response = await this.provider.sendRequest(requestBody, { attempt: 0 });
        const parsed = this.provider.parseResponse(response);

        let summary = typeof parsed.content === 'string'
          ? parsed.content
          : (parsed.content?.reasoning || parsed.content?.result || JSON.stringify(parsed.content));

        // MEM-01: Validate summary length -- retry once if too short
        if (summary.length < 500) {
          automationLogger.warn('Compaction summary too short, retrying with stronger prompt', {
            sessionId: this.currentSessionId,
            originalLength: summary.length
          });

          try {
            const retryPrompt = {
              messages: [
                {
                  role: 'system',
                  content: 'You are a context compactor. Summarize the following browser automation conversation turns into a concise context block. Preserve: actions taken, results observed, pages visited, errors encountered, key element selectors found, and current progress toward the task. CRITICAL: Include 1-2 VERBATIM CLI command examples from the conversation to maintain format consistency. Output ONLY the summary, no preamble.'
                },
                {
                  role: 'user',
                  content: `Your summary was too short (${summary.length} chars). Produce at least 500 characters covering: 1) actions taken with element details, 2) selectors used, 3) pages visited, 4) errors encountered, 5) current progress toward the task. Be specific -- include element names, URLs, outcomes, and verbatim CLI command examples.\n\nOriginal turns:\n\n${turnsSummary}`
                }
              ]
            };

            const retryBody = await this.provider.buildRequest(retryPrompt, {});
            const retryResponse = await this.provider.sendRequest(retryBody, { attempt: 0 });
            const retryParsed = this.provider.parseResponse(retryResponse);

            const retrySummary = typeof retryParsed.content === 'string'
              ? retryParsed.content
              : (retryParsed.content?.reasoning || retryParsed.content?.result || JSON.stringify(retryParsed.content));

            if (retrySummary.length >= 500) {
              summary = retrySummary;
            }
            // If retry is still short, fall through to local fallback below
          } catch (retryError) {
            automationLogger.debug('Compaction retry failed', {
              sessionId: this.currentSessionId,
              error: retryError.message
            });
            // Fall through to local fallback below
          }
        }

        // MEM-01: Final safety net -- if summary is still < 500 chars, use local fallback
        if (summary.length < 500) {
          automationLogger.warn('Compaction still too short after retry, using local fallback', {
            sessionId: this.currentSessionId,
            summaryLength: summary.length
          });
          summary = this._localExtractiveFallback(messagesToCompact);
        }

        this.compactedSummary = summary.substring(0, 1500);

        automationLogger.debug('Compaction completed', {
          sessionId: this.currentSessionId,
          compactedTurns: messagesToCompact.length,
          summaryLength: this.compactedSummary.length
        });

        return this.compactedSummary;
      } catch (error) {
        automationLogger.debug('Compaction failed, using local extractive fallback', {
          sessionId: this.currentSessionId,
          error: error.message
        });
        // MEM-01: Fall back to local extraction instead of returning null
        this.compactedSummary = this._localExtractiveFallback(messagesToCompact).substring(0, 1500);
        return this.compactedSummary;
      } finally {
        this.pendingCompaction = null;
      }
    })();
  }

  /**
   * Local extractive fallback for compaction.
   * Scans raw conversation messages for CLI commands, URLs, and errors to produce
   * a structured summary without any API call.
   * Assistant messages now contain raw CLI text (not JSON), so extraction looks
   * for CLI command verbs and reasoning lines.
   * @param {Array} messagesToCompact - Array of conversation message objects
   * @returns {string} Extractive summary of at least 500 characters
   */
  _localExtractiveFallback(messagesToCompact) {
    const parts = ['Session progress (auto-extracted):'];

    // Collect all message text content (always strings now -- CLI text)
    const allText = (messagesToCompact || []).map(m => {
      if (typeof m.content === 'string') return m.content;
      try { return JSON.stringify(m.content); } catch { return ''; }
    }).join('\n');

    // Known CLI verbs from COMMAND_REGISTRY for extraction
    const cliVerbs = [
      'click', 'type', 'navigate', 'search', 'scroll', 'select', 'enter',
      'key', 'hover', 'focus', 'clear', 'back', 'forward', 'refresh',
      'wait', 'waitstable', 'gettext', 'getattr', 'done', 'fail',
      'opentab', 'switchtab', 'tabs', 'storejobdata', 'fillsheetdata',
      'check', 'doubleclick', 'rightclick', 'goto', 'scrolldown', 'scrollup',
      'scrolltotop', 'scrolltobottom', 'clicksearchresult', 'help',
      'fillsheet', 'readsheet'
    ];
    const verbPattern = new RegExp('^(' + cliVerbs.join('|') + ')\\b', 'i');

    // Extract URLs (deduplicated, ordered)
    const urlSet = new Set();
    const urlRegex = /https?:\/\/[^\s"'<>]+/g;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(allText)) !== null) {
      urlSet.add(urlMatch[0]);
    }
    if (urlSet.size > 0) {
      parts.push('Pages visited: ' + Array.from(urlSet).join(' -> '));
    }

    // Extract CLI commands from assistant messages (deduplicated, last 10)
    const cliCommands = [];
    for (const m of (messagesToCompact || [])) {
      if (m.role !== 'assistant') continue;
      const text = typeof m.content === 'string' ? m.content : '';
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && verbPattern.test(trimmed)) {
          cliCommands.push(trimmed);
        }
      }
    }
    if (cliCommands.length > 0) {
      const cmds = cliCommands.slice(-10);
      parts.push('CLI commands executed:');
      cmds.forEach(c => { parts.push('  ' + c); });
    }

    // Extract reasoning from assistant messages (# lines)
    const reasoningLines = [];
    for (const m of (messagesToCompact || [])) {
      if (m.role !== 'assistant') continue;
      const text = typeof m.content === 'string' ? m.content : '';
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
          reasoningLines.push(trimmed.substring(1).trim());
        }
      }
    }
    if (reasoningLines.length > 0) {
      const reasoning = reasoningLines.slice(-5);
      parts.push('AI reasoning:');
      reasoning.forEach(r => { parts.push('  - ' + r); });
    }

    // Extract errors (deduplicated, last 5)
    const errorRegex = /(?:error|failed|not found|timeout)[^.]{0,60}/gi;
    const errorSet = new Set();
    let errorMatch;
    while ((errorMatch = errorRegex.exec(allText)) !== null) {
      errorSet.add(errorMatch[0].trim());
    }
    if (errorSet.size > 0) {
      const errors = Array.from(errorSet).slice(-5);
      parts.push('Errors encountered:');
      errors.forEach(e => { parts.push('  - ' + e); });
    }

    let result = parts.join('\n');

    // Pad to minimum 500 characters if needed by including raw message excerpts
    if (result.length < 500) {
      result += '\n\nRaw context excerpts:';
      for (const m of (messagesToCompact || [])) {
        const text = typeof m.content === 'string'
          ? m.content : '';
        if (text) {
          result += '\n[' + (m.role || 'unknown') + ']: ' + text.substring(0, 200);
        }
        if (result.length >= 600) break;
      }
    }

    return result;
  }

  /**
   * Format structured memory + compacted summary into a context string for injection
   */
  buildMemoryContext() {
    // PERF: Use array + join instead of string concatenation in loop
    const parts = [];

    // MEM-03: HARD FACTS section -- always rebuilt from this.hardFacts, never compacted
    if (this.hardFacts) {
      const hf = this.hardFacts;
      const hfParts = [];
      hfParts.push('=== HARD FACTS (verified, do not repeat these actions) ===');
      if (hf.taskGoal) {
        hfParts.push(`Original task: ${hf.taskGoal}`);
      }
      if (hf.criticalActions.length > 0) {
        let actions = hf.criticalActions;
        // Pre-check: if total hard facts will exceed 800 chars, limit actions to 5
        if (actions.length > 5) {
          actions = actions.slice(-5);
        }
        hfParts.push('Critical actions completed:');
        actions.forEach(ca => {
          const verifiedTag = ca.verified ? '(VERIFIED)' : '(unverified)';
          hfParts.push(`  - [iter ${ca.iteration}] ${ca.description} ${verifiedTag}`);
        });
      }
      const wsKeys = Object.keys(hf.workingSelectors);
      if (wsKeys.length > 0) {
        hfParts.push('Working selectors:');
        wsKeys.forEach(label => {
          hfParts.push(`  - ${label}: ${hf.workingSelectors[label]}`);
        });
      }
      hfParts.push('=== END HARD FACTS ===');

      let hardFactsStr = hfParts.join('\n');

      // Cap at 800 chars: truncate working selectors first, then critical actions
      if (hardFactsStr.length > 800) {
        // Rebuild without working selectors
        const hfReduced = hfParts.filter(l => {
          // Keep all lines except working selector entries
          return !wsKeys.some(label => l.includes(`  - ${label}: `)) && l !== 'Working selectors:';
        });
        hardFactsStr = hfReduced.join('\n');
        if (hardFactsStr.length > 800) {
          hardFactsStr = hardFactsStr.substring(0, 797) + '...';
        }
      }

      // Only add if there is substantive content (more than just the header/footer)
      if (hf.taskGoal || hf.criticalActions.length > 0 || wsKeys.length > 0) {
        parts.push(hardFactsStr);
        parts.push(''); // blank line separator
      }
    }

    // Layer 1: Structured memory (always available)
    if (this.sessionMemory) {
      const mem = this.sessionMemory;
      parts.push('SESSION MEMORY (verified facts from this session):');
      if (mem.taskGoal) parts.push(`Goal: ${mem.taskGoal}`);
      if (mem.stepsCompleted.length > 0) {
        parts.push('Completed steps:');
        mem.stepsCompleted.forEach(s => { parts.push(`  - ${s}`); });
      }
      if (mem.currentPhase) parts.push(`Current phase: ${mem.currentPhase}`);
      if (mem.failedApproaches.length > 0) {
        parts.push('Failed approaches (DO NOT repeat):');
        mem.failedApproaches.forEach(f => { parts.push(`  - ${f}`); });
      }
      if (mem.keyFindings.length > 0) {
        parts.push('Key findings:');
        mem.keyFindings.forEach(f => { parts.push(`  - ${f}`); });
      }
      if (mem.pagesVisited.length > 0) {
        parts.push(`Pages visited: ${mem.pagesVisited.join(' -> ')}`);
      }
      // Include open tabs with meaningful content so AI remembers them after compaction
      const tabEntries = Object.entries(mem.openTabs || {});
      if (tabEntries.length > 0) {
        parts.push('Open tabs with your data:');
        tabEntries.forEach(([tabId, desc]) => {
          parts.push(`  - Tab ${tabId}: ${desc}`);
        });
        parts.push('USE switchToTab to return to these tabs instead of creating new ones.');
      }
    }

    // Layer 2: AI-compacted summary (available after first compaction)
    if (this.compactedSummary) {
      parts.push('', `PREVIOUS CONTEXT (AI-summarized from earlier turns):\n${this.compactedSummary}`);
    }

    // Layer 3: Long-term memories from past sessions
    if (this._longTermMemories && this._longTermMemories.length > 0) {
      parts.push('', 'LONG-TERM MEMORY (learned from past sessions):');
      this._longTermMemories.forEach(m => {
        parts.push(`  - ${m.text}`);
      });
    }

    let context = parts.join('\n');

    return context;
  }

  /**
   * Fetch long-term memories relevant to the current task and domain.
   * Results are cached on the instance for synchronous injection via buildMemoryContext().
   * @param {string} task - Current task description
   * @param {Object} context - Session context (may contain domain info)
   */
  async _fetchLongTermMemories(task, context = {}) {
    try {
      // Guard: memoryManager may not be loaded (e.g., in options page context)
      if (typeof memoryManager === 'undefined') return;

      const sessionId = context?.sessionId || null;
      // Skip if we already fetched for this session
      if (sessionId && sessionId === this._longTermMemoriesSessionId) return;

      // Extract domain from context
      let domain = null;
      if (context?.currentUrl) {
        try { domain = new URL(context.currentUrl).hostname; } catch {}
      }

      const filters = {};
      if (domain) filters.domain = domain;

      const memories = await memoryManager.search(task || '', filters, {
        topN: 5,
        minScore: 0.4
      });

      this._longTermMemories = memories;
      this._longTermMemoriesSessionId = sessionId;
      // Phase 101 (MEM-05): Track which domain these memories came from
      this._lastMemoryDomain = domain;

      if (memories.length > 0) {
        automationLogger.debug('Loaded long-term memories', {
          sessionId,
          count: memories.length,
          types: memories.map(m => m.type)
        });
      }

      // Phase 101 (MEM-04): Pre-fetch cross-domain procedural memories for fallback
      // NOTE: taskType is not available here. Store all cross-domain procedural memories
      // unfiltered. taskType filtering happens at consumption time where taskType is in scope.
      this._crossDomainProcedural = [];
      const hasSameDomainProcedural = memories.some(
        m => m.type === MEMORY_TYPES?.PROCEDURAL && m.typeData?.steps?.length > 0
      );
      if (!hasSameDomainProcedural && typeof memoryStorage !== 'undefined') {
        try {
          const allProcedural = await memoryStorage.query({ type: 'procedural' });
          this._crossDomainProcedural = allProcedural
            .filter(m => m.type === 'procedural' &&
                         m.typeData?.steps?.length > 0 &&
                         m.metadata?.domain !== domain)
            .sort((a, b) => (b.typeData?.successRate || 0) - (a.typeData?.successRate || 0));
          // NOTE: No .slice() here -- full sorted list stored. Limit applied at consumption.
          if (this._crossDomainProcedural.length > 0) {
            automationLogger.debug('Pre-fetched cross-domain procedural memories', {
              count: this._crossDomainProcedural.length,
              domains: [...new Set(this._crossDomainProcedural.map(m => m.metadata?.domain))].slice(0, 5)
            });
          }
        } catch (err) {
          console.warn('[AIIntegration] Cross-domain procedural pre-fetch failed:', err.message);
        }
      }
    } catch (error) {
      // Non-critical: proceed without long-term memories
      console.warn('[AIIntegration] Failed to fetch long-term memories:', error.message);
      this._longTermMemories = [];
    }
  }

  /**
   * SM-22: Fetch site map for the current domain if needed (first iteration or domain change).
   * Results cached on instance for synchronous injection in prompt building.
   */
  async _fetchSiteMap(context) {
    if (!context?.currentUrl) return;

    let currentDomain;
    try {
      currentDomain = new URL(context.currentUrl).hostname;
    } catch {
      return;
    }

    // Skip if same domain already fetched
    if (currentDomain === this._cachedSiteMapDomain) return;

    try {
      const mapResult = await chrome.runtime.sendMessage({
        action: 'getSiteMap',
        domain: currentDomain
      });
      if (mapResult && mapResult.success && mapResult.siteMap) {
        this._cachedSiteMap = mapResult.siteMap;
        this._cachedSiteMapDomain = currentDomain;
        this._cachedSiteMapSource = mapResult.source;
      } else {
        this._cachedSiteMap = null;
        this._cachedSiteMapDomain = currentDomain;
        this._cachedSiteMapSource = null;
      }
    } catch (e) {
      // Non-critical: proceed without site map
      this._cachedSiteMap = null;
      this._cachedSiteMapDomain = currentDomain;
    }
  }

  // Generate context-aware cache key
  generateCacheKey(task, domState, context = null) {
    // Base key components
    const taskHash = this.simpleHash(task);
    const urlHash = this.simpleHash(domState.url || '');
    const titleHash = this.simpleHash(domState.title || '');
    
    // Context components
    const contextParts = [];
    if (context) {
      if (context.isStuck) contextParts.push('stuck');
      if (context.iterationCount) contextParts.push(`iter${context.iterationCount}`);
      if (context.actionHistory?.length) contextParts.push(`acts${context.actionHistory.length}`);
    }
    
    // DOM state components
    const domParts = [];
    if (domState.elements?.length) domParts.push(`els${domState.elements.length}`);
    if (domState.forms?.length) domParts.push(`forms${domState.forms.length}`);
    
    // Combine all parts
    const key = `${taskHash}-${urlHash}-${titleHash}-${contextParts.join('-')}-${domParts.join('-')}`;
    return key;
  }
  
  // Simple hash function for strings
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  // Check if cached response is still valid with dynamic expiration
  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    if (!cached) return null;
    
    // Dynamic cache expiration based on key components
    let maxAge = this.cacheMaxAge;
    
    // Reduce cache time for stuck scenarios
    if (key.includes('stuck')) maxAge = 60 * 1000; // 1 minute
    
    // Reduce cache time for later iterations
    if (key.includes('iter') && parseInt(key.match(/iter(\d+)/)?.[1] || 0) > 5) {
      maxAge = 30 * 1000; // 30 seconds
    }
    
    // Check if still valid
    if (Date.now() - cached.timestamp < maxAge) {
      automationLogger.logCache(this.currentSessionId, 'hit', key, { expiresIn: Math.round((maxAge - (Date.now() - cached.timestamp)) / 1000) });
      return cached.response;
    }
    
    // Remove expired entry
    this.responseCache.delete(key);
    return null;
  }
  
  // Store response in cache
  setCachedResponse(key, response) {
    // PERF: Evict expired entries before adding new ones
    if (this.responseCache.size >= this.cacheMaxSize) {
      const now = Date.now();
      for (const [k, v] of this.responseCache) {
        if (now - v.timestamp > this.cacheMaxAge) {
          this.responseCache.delete(k);
        }
      }
      // If still full after TTL eviction, remove oldest
      if (this.responseCache.size >= this.cacheMaxSize) {
        const firstKey = this.responseCache.keys().next().value;
        this.responseCache.delete(firstKey);
      }
    }

    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }
  // Dead code removed: getAutomationActions, processQueue, decomposeTask, buildPrompt (Phase 139.1 cleanup)
  // These formed the old autopilot prompt-building and queue-processing pipeline.
  // callAPI() is preserved as the raw API call method.

  
  // Prompt injection protection -- sanitize untrusted page content before AI prompt insertion
  sanitizePageContent(text) {
    if (!text || typeof text !== 'string') return text || '';
    let cleaned = text;

    // Strip known prompt injection patterns
    const INJECTION_PATTERNS = [
      /ignore\s+(all\s+)?previous\s+instructions/gi,
      /you\s+are\s+now\s+(a|an)\b/gi,
      /system\s*prompt/gi,
      /\<\/?(?:system|instruction|prompt|override|admin|root|command|directive)\s*\>/gi,
      /IMPORTANT\s*:\s*(?:ignore|forget|disregard|override|bypass)/gi,
      /(?:disregard|forget)\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|rules|context)/gi,
      /you\s+must\s+(?:now|instead)\s+(?:act|behave|respond)\s+as/gi,
      /\[\s*(?:SYSTEM|INST|ADMIN|ROOT)\s*\]/gi,
      /BEGIN\s+(?:NEW\s+)?(?:SYSTEM|INSTRUCTIONS?|PROMPT)/gi,
      /END\s+(?:OF\s+)?(?:SYSTEM|INSTRUCTIONS?|PROMPT)/gi,
    ];

    for (const pattern of INJECTION_PATTERNS) {
      cleaned = cleaned.replace(pattern, '[FILTERED]');
    }

    // Strip javascript: protocol from any URLs
    cleaned = cleaned.replace(/javascript\s*:/gi, 'blocked:');

    // Truncate excessively long values (potential payload delivery)
    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 500) + '...[truncated]';
    }

    return cleaned;
  }

  // DOM-03: Adaptive text limits by element type
  getTextLimit(element, compressionLevel = 'none') {
    const baseLimits = {
      listItem: 150,  // "First Last - Title at Company"
      button: 80,
      a: 80,
      input: 80,
      textarea: 100,
      select: 80,
      default: 100
    };

    // Detect list items: actual li elements, or links inside list containers
    const isListItem = element.type === 'li' ||
      (element.type === 'a' && element.relationshipContext?.includes('list')) ||
      (element.type === 'div' && element.relationshipContext?.includes('list'));

    const baseLimit = isListItem ? baseLimits.listItem :
      (baseLimits[element.type] || baseLimits.default);

    const multipliers = { none: 1.0, moderate: 0.8, heavy: 0.5 };
    return Math.round(baseLimit * (multipliers[compressionLevel] || 1.0));
  }

  // DIF-03 + DOM-02: Task-aware element prioritization
  prioritizeForTask(elements, taskType) {
    return elements.map(el => {
      let score = 0;
      const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(el.type);
      const isInViewport = el.position?.inViewport;

      // Base: viewport + interactivity
      if (isInViewport) score += 10;
      if (isInteractive) score += 5;
      if (el.isNew) score += 8;

      // Task-specific boosts
      switch (taskType) {
        case 'form':
        case 'email':
          if (['input', 'textarea', 'select'].includes(el.type)) score += 20;
          if (el.labelText || el.placeholder) score += 5;
          if (el.formId) score += 3;
          break;
        case 'extraction':
          if (el.text && el.text.length > 50) score += 15;
          break;
        case 'search':
        case 'navigation':
          if (el.type === 'a') score += 15;
          if (el.href) score += 10;
          break;
        case 'shopping':
          if (el.text && /\$[\d.,]+/.test(el.text)) score += 10;
          if (el.type === 'button') score += 5;
          break;
      }

      return { element: el, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.element);
  }

  // DIF-03: Map task type to content mode for element selection and prioritization
  getContentMode(taskType) {
    switch (taskType) {
      case 'form':
      case 'email':
        return 'input_fields';
      case 'extraction':
        return 'text_only';
      case 'search':
      case 'navigation':
      case 'shopping':
      case 'general':
      case 'gaming':
      case 'multitab':
      default:
        return 'full';
    }
  }

  // DOM-02 + DOM-04: Budget-aware element formatting with priority and compression
  formatElements(elements, charBudget = Infinity, taskType = 'general') {
    if (!Array.isArray(elements)) {
      automationLogger.warn('formatElements received non-array', { sessionId: this.currentSessionId, type: typeof elements });
      return 'No elements available';
    }

    // DOM-04: Dynamic compression based on page complexity
    const complexity = elements.length;
    const compressionLevel = complexity <= 30 ? 'none' : complexity <= 60 ? 'moderate' : 'heavy';

    // DIF-03: Task-adaptive priority ordering (only when budget is finite)
    const ordered = charBudget < Infinity ? this.prioritizeForTask(elements, taskType) : elements;

    const SEPARATOR = '\\n';
    const lines = [];
    let usedChars = 0;

    for (const el of ordered) {
      const textLimit = this.getTextLimit(el, compressionLevel);
      let desc = `[${el.elementId}] ${el.type}`;
      if (el.isNew) desc += ` [NEW]`;

      // Human-readable description (skip in heavy compression)
      if (el.description && compressionLevel !== 'heavy') {
        desc += ` - ${this.sanitizePageContent(el.description)}`;
      }

      // Identifiers
      if (el.id) desc += ` #${el.id}`;
      if (el.class && compressionLevel === 'none') {
        desc += ` .${el.class.split(' ').slice(0, 2).join('.')}`;
      }

      // Text content with adaptive limit (DOM-03)
      if (el.text) {
        const sanitizedText = this.sanitizePageContent(el.text);
        desc += ` "${sanitizedText.substring(0, textLimit)}${sanitizedText.length > textLimit ? '...' : ''}"`;
      }

      // Element-specific details (skip some in heavy compression)
      if (el.inputType) desc += ` type="${el.inputType}"`;
      if (el.placeholder && compressionLevel !== 'heavy') {
        desc += ` placeholder="${this.sanitizePageContent(el.placeholder)}"`;
      }
      if (el.href && compressionLevel !== 'heavy') {
        desc += ` href="${this.sanitizePageContent(el.href)}"`;
      }
      if (el.labelText) desc += ` label="${this.sanitizePageContent(el.labelText)}"`;

      // State information
      const states = [];
      if (el.interactionState?.disabled) states.push('disabled');
      if (el.interactionState?.readonly) states.push('readonly');
      if (el.interactionState?.checked) states.push('checked');
      if (el.interactionState?.focused) states.push('focused');
      if (!el.position?.inViewport) states.push('off-screen');
      if (states.length > 0) desc += ` [${states.join(',')}]`;

      // Position (skip in heavy compression)
      if (el.position && compressionLevel !== 'heavy') {
        desc += ` at (${el.position.x}, ${el.position.y})`;
      }

      // Form association
      if (el.formId) desc += ` in ${el.formId}`;

      // Primary selector -- ALWAYS included (critical for AI action execution)
      if (el.selectors && el.selectors.length > 0) {
        const cssSelector = el.selectors.find(s => !s.startsWith('//'));
        const primarySelector = cssSelector || el.selectors[0];
        desc += ` selector: "${primarySelector}"`;
      }

      // DOM-02: Never cut mid-element -- include whole or exclude
      if (usedChars + desc.length + SEPARATOR.length > charBudget) {
        break;
      }

      lines.push(desc);
      usedChars += desc.length + SEPARATOR.length;
    }

    // Report excluded elements
    if (lines.length < ordered.length) {
      const remaining = ordered.length - lines.length;
      lines.push(`... ${remaining} more elements excluded by budget`);
    }

    return lines.join(SEPARATOR);
  }

  // Format delta elements (compressed format for changes)
  formatDeltaElements(elements, showChanges = false) {
    if (!Array.isArray(elements)) {
      return 'No elements';
    }
    
    return elements.map(el => {
      let desc = `[${el.elementId}] ${el.type}`;
      if (el.isNew) desc += ` [NEW]`;

      // Add key identifiers (sanitize untrusted page content)
      if (el.id) desc += ` #${this.sanitizePageContent(el.id)}`;
      if (el.testId) desc += ` testId="${this.sanitizePageContent(el.testId)}"`;

      // Add text (sanitize untrusted page content)
      if (el.text) desc += ` "${this.sanitizePageContent(el.text)}"`;

      // Interactive marker
      if (el.interactive) desc += ` [interactive]`;
      if (el.inViewport) desc += ` [in-view]`;

      // Selector
      if (el.selectors?.[0]) desc += ` sel: "${el.selectors[0]}"`;

      // Show changes if modified (sanitize old/new text values)
      if (showChanges && el._changes) {
        const changes = [];
        if (el._changes.text) changes.push(`text: "${this.sanitizePageContent(el._changes.text.old)}" -> "${this.sanitizePageContent(el._changes.text.new)}"`);
        if (el._changes.position) {
          const oldPos = el._changes.position.old;
          const newPos = el._changes.position.new;
          if (oldPos && newPos) {
            changes.push(`moved: (${oldPos.x},${oldPos.y}) -> (${newPos.x},${newPos.y})`);
          }
        }
        if (el._changes.attributes) changes.push('attributes changed');
        if (changes.length > 0) desc += ` CHANGES: ${changes.join(', ')}`;
      }

      return desc;
    }).join('\\n');
  }
  
  // Format HTML context for AI understanding (budget-aware)
  formatHTMLContext(htmlContext, charBudget = Infinity) {
    if (!htmlContext || typeof htmlContext !== 'object') {
      return 'No HTML context available';
    }

    let formatted = '[PAGE_CONTENT]\n';
    let usedChars = formatted.length;

    // Add comprehensive page structure context
    if (htmlContext.pageStructure) {
      const struct = htmlContext.pageStructure;

      // PAGE INFORMATION -- always included (small and essential)
      formatted += `PAGE INFORMATION:\n`;
      formatted += `- Title: ${this.sanitizePageContent(struct.title)}\n`;
      formatted += `- URL: ${struct.url}\n`;
      formatted += `- Domain: ${struct.domain}\n`;
      formatted += `- Path: ${struct.pathname}\n`;
      usedChars = formatted.length;

      // Meta information -- budget gated
      if (struct.meta) {
        const metaSection = this._buildHTMLSection(() => {
          let s = `\nMETA DATA:\n`;
          if (struct.meta.description) s += `- Description: ${this.sanitizePageContent(struct.meta.description)}\n`;
          if (struct.meta.ogTitle) s += `- OG Title: ${this.sanitizePageContent(struct.meta.ogTitle)}\n`;
          return s;
        });
        if (usedChars + metaSection.length <= charBudget) {
          formatted += metaSection;
          usedChars = formatted.length;
        } else {
          formatted += '\n... (HTML context truncated by budget)\n';
          formatted += '[/PAGE_CONTENT]';
          return formatted;
        }
      }

      // Forms with detailed structure -- budget gated
      if (struct.forms && struct.forms.length > 0) {
        const formsSection = this._buildHTMLSection(() => {
          let s = `\nFORMS (${struct.forms.length} found):\n`;
          struct.forms.forEach((form, i) => {
            s += `  Form "${form.id}": ${form.method} -> ${this.sanitizePageContent(form.action)}\n`;
            if (form.fields && form.fields.length > 0) {
              s += `  Fields:\n`;
              form.fields.forEach(field => {
                s += `    - ${field.type} "${this.sanitizePageContent(field.name || field.id)}" ${field.placeholder ? `placeholder="${this.sanitizePageContent(field.placeholder)}"` : ''} ${field.required ? '[required]' : ''}\n`;
              });
            }
            s += `  HTML: ${this.sanitizePageContent(form.html)}\n\n`;
          });
          return s;
        });
        if (usedChars + formsSection.length <= charBudget) {
          formatted += formsSection;
          usedChars = formatted.length;
        } else {
          formatted += '\n... (HTML context truncated by budget)\n';
          formatted += '[/PAGE_CONTENT]';
          return formatted;
        }
      }

      // Navigation structure -- budget gated
      if (struct.navigation && struct.navigation.length > 0) {
        const navSection = this._buildHTMLSection(() => {
          let s = `\nNAVIGATION AREAS:\n`;
          struct.navigation.forEach(nav => {
            s += `  - ${nav.ariaLabel || 'Navigation'} (${nav.linksCount} links)\n`;
            if (nav.links && nav.links.length > 0) {
              nav.links.forEach(link => {
                s += `    - "${this.sanitizePageContent(link.text)}" -> ${this.sanitizePageContent(link.href)}\n`;
              });
            }
          });
          return s;
        });
        if (usedChars + navSection.length <= charBudget) {
          formatted += navSection;
          usedChars = formatted.length;
        } else {
          formatted += '\n... (HTML context truncated by budget)\n';
          formatted += '[/PAGE_CONTENT]';
          return formatted;
        }
      }

      // Page headings for structure -- budget gated
      if (struct.headings && struct.headings.length > 0) {
        const headingsSection = this._buildHTMLSection(() => {
          let s = `\nPAGE STRUCTURE (Headings):\n`;
          struct.headings.forEach(h => {
            s += `  ${h.level}: ${this.sanitizePageContent(h.text)}${h.id ? ` #${h.id}` : ''}\n`;
          });
          return s;
        });
        if (usedChars + headingsSection.length <= charBudget) {
          formatted += headingsSection;
          usedChars = formatted.length;
        } else {
          formatted += '\n... (HTML context truncated by budget)\n';
          formatted += '[/PAGE_CONTENT]';
          return formatted;
        }
      }

      // Active element
      if (struct.activeElement) {
        formatted += `\nCURRENT FOCUS: ${struct.activeElement.tag}${struct.activeElement.id ? ` #${struct.activeElement.id}` : ''}\n`;
      }

      formatted += '\n';
      usedChars = formatted.length;
    }

    // Add relevant interactive elements with their HTML -- budget gated
    if (htmlContext.relevantElements && htmlContext.relevantElements.length > 0) {
      const elemHeader = `INTERACTIVE ELEMENTS WITH HTML MARKUP:\n` +
        `(Found ${htmlContext.totalElementsFound} total, showing ${htmlContext.relevantElements.length})\n\n`;

      if (usedChars + elemHeader.length <= charBudget) {
        formatted += elemHeader;
        usedChars = formatted.length;

        for (const element of htmlContext.relevantElements) {
          let entry = `${htmlContext.relevantElements.indexOf(element) + 1}. ${element.tag.toUpperCase()}`;
          if (element.position) {
            entry += ` at (${element.position.x}, ${element.position.y})`;
          }
          entry += '\n';
          entry += `   Selector: ${element.selector}\n`;
          if (element.text) {
            entry += `   Text: "${this.sanitizePageContent(element.text)}"\n`;
          }
          entry += `   HTML: ${this.sanitizePageContent(element.html)}\n\n`;

          if (usedChars + entry.length > charBudget) {
            formatted += '... (remaining elements truncated by budget)\n';
            break;
          }
          formatted += entry;
          usedChars = formatted.length;
        }
      }
    }

    formatted += '[/PAGE_CONTENT]';
    return formatted;
  }

  // Helper: build an HTML context section string via callback
  _buildHTMLSection(builderFn) {
    try {
      return builderFn();
    } catch (e) {
      return '';
    }
  }

  /**
   * Format a hierarchical page structure summary
   * @param {Object} pageContext - The page context from detectPageContext
   * @param {Array} elements - The filtered elements array
   * @returns {string} Formatted page structure summary
   */
  formatPageStructureSummary(pageContext, elements) {
    let summary = '\n=== PAGE STRUCTURE ===';

    // Forms summary
    const formElements = elements.filter(el => el.context?.formId || el.type === 'form');
    const forms = {};
    formElements.forEach(el => {
      const formId = el.context?.formId || el.formId || 'unnamed';
      if (!forms[formId]) {
        forms[formId] = { fields: [], hasSubmit: false };
      }
      if (el.type === 'input' || el.type === 'textarea' || el.type === 'select') {
        forms[formId].fields.push(el.purpose?.intent || el.inputType || 'field');
      }
      if (el.purpose?.intent === 'submit' || el.isButton) {
        forms[formId].hasSubmit = true;
      }
    });

    if (Object.keys(forms).length > 0) {
      summary += '\n\nFORMS:';
      Object.entries(forms).forEach(([id, form]) => {
        const fieldTypes = [...new Set(form.fields)].slice(0, 5);
        summary += `\n  - ${id}: ${form.fields.length} fields (${fieldTypes.join(', ')})`;
        summary += form.hasSubmit ? ' [has submit]' : ' [no submit button found]';
      });
    }

    // Navigation regions
    const navElements = elements.filter(el =>
      el.relationshipContext?.includes('navigation') ||
      el.purpose?.role?.includes('navigation')
    );
    if (navElements.length > 0) {
      summary += '\n\nNAVIGATION:';
      // Group by context
      const navGroups = {};
      navElements.forEach(el => {
        const ctx = el.relationshipContext || 'main navigation';
        if (!navGroups[ctx]) navGroups[ctx] = [];
        navGroups[ctx].push(el);
      });
      Object.entries(navGroups).forEach(([ctx, els]) => {
        summary += `\n  - ${ctx}: ${els.length} links`;
      });
    }

    // Main content areas
    const mainElements = elements.filter(el =>
      el.relationshipContext?.includes('main content') ||
      el.relationshipContext?.includes('article')
    );
    if (mainElements.length > 0) {
      summary += '\n\nMAIN CONTENT:';
      summary += `\n  - ${mainElements.length} interactive elements`;

      // Identify content type
      const hasArticle = mainElements.some(el => el.relationshipContext?.includes('article'));
      const hasCards = mainElements.some(el => el.relationshipContext?.includes('card'));
      const hasList = mainElements.some(el => el.relationshipContext?.includes('list'));

      if (hasArticle) summary += '\n  - Contains article content';
      if (hasCards) summary += '\n  - Contains cards/items';
      if (hasList) summary += '\n  - Contains list items';
    }

    // Modal/dialog present
    const modalElements = elements.filter(el => el.relationshipContext?.includes('modal'));
    if (modalElements.length > 0) {
      summary += '\n\n*** MODAL ACTIVE ***';
      summary += `\n  - ${modalElements.length} elements in modal`;
      summary += '\n  - Interact with modal first before underlying page';
    }

    return summary;
  }

  /**
   * Format action history for AI context
   * Shows what was attempted and results to prevent repeating failures
   * @param {Array} actionHistory - Array of past actions with results
   * @param {number} maxActions - Maximum number of actions to show (default 5)
   * @returns {string} Formatted action history
   */
  formatActionHistory(actionHistory, maxActions = 5) {
    if (!actionHistory || actionHistory.length === 0) {
      return '\n\n=== ACTION HISTORY ===\nNo actions taken yet.';
    }

    const recent = actionHistory.slice(-maxActions);
    const skipped = actionHistory.length - recent.length;

    let history = '\n\n=== ACTION HISTORY ===';
    history += `\nRecent actions (last ${recent.length} of ${actionHistory.length}):`;

    if (skipped > 0) {
      history += ` (${skipped} earlier actions omitted)`;
    }

    recent.forEach((action, i) => {
      const status = action.result?.success ? 'OK' : 'FAILED';
      const tool = action.tool || action.action || 'unknown';

      // Summarize target
      let target = '';
      if (action.params?.selector) {
        // Shorten long selectors
        const sel = action.params.selector;
        target = sel.length > 40 ? sel.substring(0, 37) + '...' : sel;
      } else if (action.params?.text) {
        target = `"${action.params.text.substring(0, 25)}..."`;
      } else if (action.params?.url) {
        // Extract last path segment
        target = action.params.url.split('/').slice(-2).join('/');
      } else {
        target = 'target';
      }

      history += `\n  ${i + 1}. ${tool}(${target}) -> ${status}`;

      // Add effect or error details
      if (action.result?.success) {
        if (action.result.hadEffect === false) {
          history += ' [no visible change]';
        } else if (action.result.navigationOccurred) {
          history += ' [page changed]';
        } else if (action.result.formSubmitted) {
          history += ' [form submitted]';
        }
      } else if (action.result?.error) {
        history += ` [${action.result.error.substring(0, 40)}]`;
      }
    });

    // Add guidance based on history
    const failures = recent.filter(a => !a.result?.success);
    if (failures.length >= 2) {
      history += '\n\n*** Multiple recent failures - try a different approach ***';

      // Identify repeated failures
      const failedSelectors = failures
        .map(f => f.params?.selector)
        .filter(Boolean);
      const uniqueSelectors = [...new Set(failedSelectors)];

      if (uniqueSelectors.length < failedSelectors.length) {
        history += '\n  - Same selector failing multiple times';
        history += '\n  - Consider: different selector, scroll to element, or wait for element';
      }
    }

    return history;
  }

  /**
   * Format semantic context for AI understanding
   * Creates a high-level summary of page type, state, and available actions
   * @param {Object} domState - The DOM state with pageContext
   * @returns {string} Formatted semantic context string
   */
  formatSemanticContext(domState) {
    let context = '';

    // Use elements from whatever source is available (full payload or delta viewport snapshot)
    const elementsForContext = domState.elements || domState.viewportElements || [];

    // 1. PAGE STRUCTURE SUMMARY (forms, navigation, regions)
    if (domState.pageContext && elementsForContext.length > 0) {
      context += this.formatPageStructureSummary(domState.pageContext, elementsForContext);
    }

    // 2. PAGE UNDERSTANDING (type, intent, state)
    if (domState.pageContext) {
      const pc = domState.pageContext;

      // Page type detection
      const detectedTypes = Object.entries(pc.pageTypes || {})
        .filter(([k, v]) => v)
        .map(([k]) => k);

      context += `\n=== PAGE UNDERSTANDING ===`;
      context += `\nPage Type: ${detectedTypes.length > 0 ? detectedTypes.join(', ') : 'general'}`;
      context += `\nPage Intent: ${pc.pageIntent || 'unknown'}`;

      // Page state
      const ps = pc.pageState || {};
      let stateDescription = 'ready';
      if (ps.isLoading) stateDescription = 'LOADING (wait for content)';
      else if (ps.hasErrors) stateDescription = 'HAS ERRORS (check messages)';
      else if (ps.hasSuccess) stateDescription = 'SUCCESS STATE (may be complete)';
      else if (ps.hasModal) stateDescription = 'MODAL/DIALOG OPEN';
      else if (ps.hasCaptcha) stateDescription = 'CAPTCHA PRESENT (use solveCaptcha tool)';

      context += `\nPage State: ${stateDescription}`;

      // Error messages if present (sanitize -- these come from page content)
      if (ps.errorMessages && ps.errorMessages.length > 0) {
        context += `\n\nERROR MESSAGES DETECTED:`;
        ps.errorMessages.forEach((msg, i) => {
          context += `\n  ${i + 1}. "${this.sanitizePageContent(msg)}"`;
        });
        context += `\n  --> You should address these errors before proceeding`;
      }

      // Surface "no search results" state
      if (ps.noSearchResults) {
        context += `\n\nSEARCH RETURNED NO RESULTS: ${ps.noSearchResults}`;
        context += `\n  --> Your search query found nothing. Try a DIFFERENT, broader query.`;
        context += `\n  --> Do NOT use clicksearchresult - there are no results to click.`;
        context += `\n  --> Remove restrictive operators like site:, exact quotes, etc.`;
      }

      // Primary actions available (sanitize text from page)
      if (pc.primaryActions && pc.primaryActions.length > 0) {
        context += `\n\nPRIMARY ACTIONS AVAILABLE:`;
        pc.primaryActions.forEach(a => {
          context += `\n  - "${this.sanitizePageContent(a.text)}" (${a.type}) selector: ${a.selector}`;
        });
      }
    }

    // Format elements by purpose if available (use fallback to viewportElements)
    if (elementsForContext.length > 0) {
      const purposefulElements = elementsForContext.filter(el => el.purpose && el.purpose.role !== 'unknown');

      if (purposefulElements.length > 0) {
        context += `\n\n=== KEY ELEMENTS BY PURPOSE ===`;

        // Group elements by role
        const grouped = {};
        purposefulElements.forEach(el => {
          const role = el.purpose.role;
          if (!grouped[role]) grouped[role] = [];
          grouped[role].push(el);
        });

        // Format each group
        Object.entries(grouped).forEach(([role, els]) => {
          // Limit to 5 per role
          const limited = els.slice(0, 5);
          context += `\n${role.toUpperCase()}:`;
          limited.forEach(el => {
            const text = this.sanitizePageContent((el.text || '').substring(0, 40));
            const selector = el.selectors?.[0] || 'unknown';
            const intent = el.purpose.intent || '';
            const relationship = el.relationshipContext ? ` ${el.relationshipContext}` : '';
            const newTag = el.isNew ? ' [NEW]' : '';
            context += `\n  - "${text || el.id || 'unnamed'}" [${intent}]${newTag}${relationship} -> ${selector}`;
          });
          if (els.length > 5) {
            context += `\n  ... and ${els.length - 5} more`;
          }
        });
      }

      // Highlight high-priority elements
      const highPriority = purposefulElements.filter(el => el.purpose.priority === 'high');
      if (highPriority.length > 0) {
        context += `\n\nHIGH-PRIORITY ELEMENTS (likely relevant to your task):`;
        highPriority.slice(0, 8).forEach(el => {
          const text = this.sanitizePageContent((el.text || el.placeholder || el.attributes?.['aria-label'] || '').substring(0, 30));
          context += `\n  * ${el.purpose.role}/${el.purpose.intent}: "${text}" -> ${el.selectors?.[0] || 'unknown'}`;
          if (el.purpose.sensitive) context += ` [SENSITIVE]`;
          if (el.purpose.danger) context += ` [DANGER]`;
        });
      }
    }

    // 4. ACTION HISTORY (what was tried, what worked/failed)
    if (domState.actionHistory) {
      context += this.formatActionHistory(domState.actionHistory);
    }

    // 5. PROGRESS CONTEXT (iterations, success rate)
    if (domState.progressContext) {
      const prog = domState.progressContext;
      context += `\n\n=== TASK PROGRESS ===`;
      context += `\nIterations: ${prog.iterationsUsed}/${prog.maxIterations} (${prog.progressPercent}%)`;
      context += `\nActions: ${prog.actionsSucceeded} succeeded, ${prog.actionsFailed} failed`;
      context += `\nMomentum: ${prog.momentum}`;
      context += `\nEstimated completion: ${Math.round(prog.estimatedCompletion * 100)}%`;

      if (prog.stuckDuration > 0) {
        context += `\n*** STUCK for ${prog.stuckDuration} iterations - try different approach ***`;
      }
    }

    return context;
  }

  /**
   * Helper to group array by key function
   */
  static groupBy(array, keyFn) {
    const result = {};
    array.forEach(item => {
      const key = keyFn(item);
      if (!result[key]) result[key] = [];
      result[key].push(item);
    });
    return result;
  }

  // Call AI API using the appropriate provider
  async callAPI(prompt, options = {}) {
    // Use provider if available, otherwise fallback to legacy implementation
    if (this.provider) {
      try {
        automationLogger.logAPI(this.currentSessionId, this.settings.modelProvider, 'call', { model: this.settings.modelName });

        // Set current provider for parsing context
        this.currentProvider = this.provider;

        // FSB TIMING: Track build request time
        const buildStart = Date.now();
        const requestBody = await this.provider.buildRequest(prompt, {});
        automationLogger.logTiming(this.currentSessionId, 'LLM', 'build_request', Date.now() - buildStart);

        // FSB TIMING: Track send request time (main API latency)
        // Pass attempt number for progressive timeout increase on retries
        const sendStart = Date.now();
        const response = await this.provider.sendRequest(requestBody, { attempt: options.attempt || 0 });
        automationLogger.logTiming(this.currentSessionId, 'LLM', 'send_request', Date.now() - sendStart);

        // FSB TIMING: Track parse response time
        const parseStart = Date.now();
        const parsed = this.provider.parseResponse(response);
        automationLogger.logTiming(this.currentSessionId, 'LLM', 'parse_response', Date.now() - parseStart);
        
        // Track token usage
        this.trackTokenUsage({
          usage: {
            prompt_tokens: parsed.usage.inputTokens,
            completion_tokens: parsed.usage.outputTokens,
            total_tokens: parsed.usage.totalTokens
          },
          model: parsed.model
        }, true);
        
        // parsed.content is raw text string -- caller handles CLI parsing
        return parsed.content;
      } catch (error) {
        automationLogger.error('API call failed', { sessionId: this.currentSessionId, provider: this.settings.modelProvider, error: error.message });
        this.trackTokenUsage(null, false);
        throw error;
      }
    }

    // Legacy xAI implementation for backward compatibility
    return this.legacyCallAPI(prompt);
  }

  // Legacy xAI API implementation
  async legacyCallAPI(prompt) {
    const { systemPrompt, userPrompt } = prompt;

    // Check if API key is provided
    if (!this.settings.apiKey) {
      throw new Error('xAI API key is not configured. Please set it in extension settings.');
    }

    const apiEndpoint = 'https://api.x.ai/v1/chat/completions';
    const model = this.settings.modelName || 'grok-3-fast';

    automationLogger.logAPI(this.currentSessionId, 'xai', 'legacy_call', { endpoint: apiEndpoint, model });
    
    const requestBody = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    };
    
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`xAI API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      this.trackTokenUsage(data, true);
      return this.extractContent(data);
      
    } catch (error) {
      automationLogger.error('xAI API call failed (legacy)', { sessionId: this.currentSessionId, error: error.message });
      this.trackTokenUsage(null, false);
      throw error;
    }
  }

  // Extract content from xAI API response
  extractContent(data) {
    automationLogger.logAPI(this.currentSessionId, 'xai', 'extract_content', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length
    });

    // Try multiple possible response formats for xAI Grok
    let messageContent = null;
    let contentFormat = null;

    // Standard OpenAI format
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      messageContent = data.choices[0].message.content;
      contentFormat = 'openai';
    }
    // Alternative xAI format - sometimes content is at root level
    else if (data.content) {
      messageContent = data.content;
      contentFormat = 'root_level';
    }
    // Another alternative - text field
    else if (data.choices && data.choices[0] && data.choices[0].text) {
      messageContent = data.choices[0].text;
      contentFormat = 'text_field';
    }
    // Direct message format
    else if (data.message) {
      messageContent = data.message;
      contentFormat = 'direct_message';
    }

    if (messageContent) {
      automationLogger.logAPI(this.currentSessionId, 'xai', 'content_extracted', {
        format: contentFormat,
        contentLength: messageContent?.length
      });
      return messageContent;
    } else {
      automationLogger.error('Could not find message content in xAI response', {
        sessionId: this.currentSessionId,
        availableKeys: Object.keys(data)
      });
      throw new Error('Could not extract message content from xAI API response');
    }
  }
  
  // JSON parsing pipeline deleted (Phase 18) -- CLI parser in cli-parser.js is the sole parser
  // Methods removed: parseResponse, parseCleanJSON, parseWithMarkdownBlocks,
  //   parseWithJSONExtraction, parseWithAdvancedCleaning, normalizeResponse, isValidParsedResponse
  // Additional deletions (Phase 139.1): processQueue which called parseCliResponse was removed
  
  // Check if tool name is valid
  isValidTool(tool) {
    return [
      // Basic DOM interaction tools
      'click', 'clickSearchResult', 'type', 'pressEnter', 'scroll', 'moveMouse', 'solveCaptcha',
      'navigate', 'searchGoogle', 'waitForElement', 'rightClick', 'doubleClick',
      'keyPress', 'pressKeySequence', 'typeWithKeys', 'sendSpecialKey', 
      'arrowUp', 'arrowDown', 'arrowLeft', 'arrowRight', 'gameControl',
      'selectText', 'focus', 'blur', 'hover', 'selectOption',
      'toggleCheckbox', 'refresh', 'goBack', 'goForward', 'getText',
      'getAttribute', 'setAttribute', 'clearInput',
      
      // Multi-tab management tools
      'openNewTab', 'switchToTab', 'closeTab', 'listTabs', 'waitForTabLoad', 'getCurrentTab',
      
      // Scroll tools
      'scrollToTop', 'scrollToBottom', 'scrollToElement',

      // Advanced DOM and verification tools
      'waitForDOMStable', 'detectLoadingState', 'verifyMessageSent',

      // Code editor verification
      'getEditorContent',

      // Data persistence tools (background-handled)
      'storeJobData', 'getStoredJobs', 'fillSheetData',

      // Google Sheets direct tools (content-script)
      'fillsheet', 'readsheet',

      // Mechanical tools (content-script)
      'dragdrop', 'togglecheck',

      // Content reading tools
      'readPage',

      // CDP coordinate tools (v0.9.8 -- tool parity with MCP)
      'cdpClickAt', 'cdpClickAndHold', 'cdpDrag', 'cdpDragVariableSpeed', 'cdpScrollAt',

      // CDP text insertion and double-click (v0.9.9 -- canvas text entry)
      'cdpInsertText', 'cdpDoubleClickAt',

      // Text selection and file tools (v0.9.8 -- tool parity with MCP)
      'selectTextRange', 'dropfile'
    ].includes(tool);
  }
  // Dead code removed: _buildTaskGuidance (Phase 139.1 cleanup)
  // Was only called by the deleted buildPrompt method.


  // Detect task type from user input, with optional URL and site guide signals
  detectTaskType(task, currentUrl = null, siteGuide = null) {
    const taskLower = task.toLowerCase();

    // Early detection: Sheets data entry rewritten task from startSheetsDataEntry
    // The orchestrator rewrites the task to "Write N job listings to Google Sheets..."
    // "write" is NOT in gatherActions arrays (which contain: find, search, research, get, look up, check, go to, visit),
    // so the hasOutputDest && hasGatherAction check would fail without this early return.
    // Sheets entry requires multitab tools (switchToTab, openNewTab, listTabs, waitForTabLoad).
    if (taskLower.includes('job listings to google sheets')) {
      return 'multitab';
    }

    // If a site guide matched, use its category as a signal for task type mapping
    if (siteGuide) {
      const guideToTaskType = {
        'E-Commerce & Shopping': 'shopping',
        'Social Media': 'general',
        'Coding Platforms': 'general',
        'Travel & Booking': 'form',
        'Finance & Trading': 'extraction',
        'Email Platforms': 'email',
        'Gaming Platforms': 'extraction',
        'Career & Job Search': 'career',
        'Productivity Tools': 'general',
        'Design': 'canvas'
      };
      const guideTaskType = guideToTaskType[siteGuide.category || siteGuide.name];
      // Guide provides a default, but explicit keywords can still override
      // (e.g., user says "search" on Amazon -> use 'shopping' not 'search')
      if (guideTaskType) {
        // Check for strong keyword overrides that should win over the guide default
        // FIX: Cross-site workflow detection -- if task mentions an output destination
        // (Google Docs, Sheets, Notion, etc.) AND a gather action (search, find, etc.),
        // this is a multi-site workflow regardless of the current site guide
        const outputDestinations = ['google doc', 'google sheet', 'google drive', 'google slide', 'notion', 'spreadsheet', 'my doc', 'my sheet'];
        const gatherActions = ['find', 'search', 'research', 'look up', 'check', 'summarize', 'compile'];
        const hasOutputDest = outputDestinations.some(kw => taskLower.includes(kw));
        const hasGatherAction = gatherActions.some(kw => taskLower.includes(kw));
        if (hasOutputDest && hasGatherAction) {
          return 'multitab';
        }
        // Sheets data entry: writing/entering data into Sheets (Phase 12 rewritten task)
        const sheetsTargetsGuide = ['google sheets', 'google sheet', 'spreadsheet'];
        const sheetsWriteActionsGuide = ['write', 'enter', 'fill', 'populate', 'put'];
        if (sheetsTargetsGuide.some(kw => taskLower.includes(kw)) && sheetsWriteActionsGuide.some(kw => taskLower.includes(kw))) {
          return 'multitab';
        }
        if (taskLower.includes('new tab') || taskLower.includes('open tab') || taskLower.includes('switch tab')) {
          return 'multitab';
        }
        // Media playback -- must precede gaming to prevent "play X on youtube" misclassification
        if (/play|watch|listen|stream/.test(taskLower) && /youtube|spotify|soundcloud|netflix|hulu|twitch|vimeo|apple.?music|pandora|deezer|tidal/.test(taskLower)) {
          return 'media';
        }
        if (taskLower.includes('play') || taskLower.includes('game') || taskLower.includes('start game') ||
            /demo.*play|asteroids|snake|pong|tetris/.test(taskLower)) {
          return 'gaming';
        }
        if (/\b(career|job|jobs|position|opening|hiring|employment|internship|internships)\b/.test(taskLower)) return 'career';
        if (taskLower.includes('search') || taskLower.includes('find')) return 'search';
        if (taskLower.includes('fill') || taskLower.includes('submit')) return 'form';
        return guideTaskType;
      }
    }

    // Canvas/drawing/map detection -- CDP coordinate tools needed
    if (/\b(draw|drag.*canvas|canvas|whiteboard|diagram|sketch|map.*interact|map.*click|map.*pin)\b/.test(taskLower)) {
      return 'canvas';
    }

    // Multi-site detection: sequential separator + 2+ distinct domain keywords
    const sequentialSeparators = [' and then ', ', then ', ' then ', ' after that ', ' afterwards '];
    const hasSequentialSep = sequentialSeparators.some(sep => taskLower.includes(sep));
    if (hasSequentialSep) {
      const domainKeywords = [
        'gmail', 'email', 'mail', 'outlook', 'amazon', 'ebay', 'etsy',
        'youtube', 'twitter', 'facebook', 'instagram', 'linkedin', 'reddit',
        'github', 'stackoverflow', 'google docs', 'google sheets', 'google drive',
        'netflix', 'spotify', 'twitch', 'discord', 'slack', 'whatsapp',
        'notion', 'dropbox', 'wikipedia'
      ];
      const matched = domainKeywords.filter(kw => taskLower.includes(kw));
      if (matched.length >= 2) {
        return 'multitab';
      }
    }

    // Output-destination detection: gathering info AND outputting to a known app
    const outputDestinations = ['google doc', 'google sheet', 'google drive', 'google slide', 'notion', 'spreadsheet', 'my doc', 'my sheet'];
    const gatherActions = ['find', 'search', 'research', 'get', 'look up', 'check', 'go to', 'visit'];
    const hasOutputDest = outputDestinations.some(kw => taskLower.includes(kw));
    const hasGatherAction = gatherActions.some(kw => taskLower.includes(kw));
    if (hasOutputDest && hasGatherAction) {
      return 'multitab';
    }

    // Sheets data entry detection: writing/entering data into Sheets or spreadsheet
    // Covers the rewritten task from startSheetsDataEntry ("Write X job listings to Google Sheets")
    const sheetsTargets = ['google sheets', 'google sheet', 'spreadsheet'];
    const sheetsWriteActions = ['write', 'enter', 'fill', 'populate', 'put'];
    const hasSheetsTarget = sheetsTargets.some(kw => taskLower.includes(kw));
    const hasSheetsWrite = sheetsWriteActions.some(kw => taskLower.includes(kw));
    if (hasSheetsTarget && hasSheetsWrite) {
      return 'multitab';
    }

    // Email detection - check before shopping/form to avoid "send" matching "submit"
    const emailKeywords = [
      'email', 'mail', 'gmail', 'outlook', 'compose', 'send email',
      'send mail', 'reply to', 'forward email', 'inbox', 'draft'
    ];
    const emailSites = ['mail.google', 'outlook.live', 'mail.yahoo', 'protonmail'];
    if (emailKeywords.some(kw => taskLower.includes(kw)) ||
        emailSites.some(site => taskLower.includes(site))) {
      return 'email';
    }

    // Shopping/e-commerce detection - check first as it's more specific
    const shoppingKeywords = [
      'buy', 'purchase', 'order', 'add to cart', 'checkout', 'shop for',
      'find a product', 'look for product', 'get me a', 'amazon', 'ebay',
      'walmart', 'best buy', 'target', 'shopping', 'product', 'item'
    ];
    const shoppingSites = ['amazon', 'ebay', 'walmart', 'bestbuy', 'target', 'newegg', 'etsy', 'aliexpress'];

    if (shoppingKeywords.some(kw => taskLower.includes(kw)) ||
        shoppingSites.some(site => taskLower.includes(site))) {
      return 'shopping';
    }

    if (taskLower.includes('new tab') || taskLower.includes('open tab') || taskLower.includes('switch tab') ||
        taskLower.includes('multiple tab') || taskLower.includes('other tab') || taskLower.includes('different tab') ||
        taskLower.includes('compare') || taskLower.includes('both sites') || taskLower.includes('cross-reference')) {
      return 'multitab';
    } else if (/play|watch|listen|stream/.test(taskLower) && /youtube|spotify|soundcloud|netflix|hulu|twitch|vimeo|apple.?music|pandora|deezer|tidal/.test(taskLower)) {
      // Media playback -- must precede gaming to prevent "play X on youtube" misclassification
      return 'media';
    } else if (taskLower.includes('play') || taskLower.includes('game') || taskLower.includes('win') ||
               taskLower.includes('control') || taskLower.includes('move') || taskLower.includes('press enter') ||
               taskLower.includes('arrow key') || taskLower.includes('keyboard') || taskLower.includes('key press') ||
               taskLower.includes('start game') || taskLower.includes('use keys') || taskLower.includes('wasd') ||
               taskLower.includes('spacebar') || /demo.*play|asteroids|snake|pong|tetris/.test(taskLower)) {
      return 'gaming';
    } else if (/\b(career|job|jobs|position|opening|hiring|employment|internship|internships)\b/.test(taskLower)) {
      return 'career';
    } else if (taskLower.includes('search') || taskLower.includes('find') || taskLower.includes('look for')) {
      return 'search';
    } else if (taskLower.includes('fill') || taskLower.includes('form') || taskLower.includes('submit')) {
      return 'form';
    } else if (taskLower.includes('price') || taskLower.includes('get') || taskLower.includes('extract') || taskLower.includes('what is')) {
      return 'extraction';
    } else if (taskLower.includes('go to') || taskLower.includes('navigate') || taskLower.includes('open')) {
      return 'navigation';
    }

    return 'general';
  }

  /**
   * Detect if task is an information-gathering task that requires navigating to a website
   * These tasks should click through search results, not extract from Google snippets
   */
  isInformationGatheringTask(task) {
    const taskLower = task.toLowerCase();
    const infoKeywords = [
      'check', 'find', 'look up', 'lookup', 'price', 'cost',
      'get info', 'get information', 'what is', 'how much',
      'tell me', 'show me', 'verify', 'confirm'
    ];
    return infoKeywords.some(kw => taskLower.includes(kw));
  }
  
  // getModelSpecificInstructions deleted (Phase 18) -- CLI format is model-agnostic
  
  // Get relevant tools for task type, with optional site guide override
  getRelevantTools(taskType, siteGuide = null) {
    // If a site guide specifies tool preferences, use those
    if (siteGuide && siteGuide.toolPreferences && siteGuide.toolPreferences.length > 0) {
      const tools = [...siteGuide.toolPreferences];
      // Career tasks always need data tools for job accumulation (storeJobData/getStoredJobs)
      if (taskType === 'career') {
        if (!tools.includes('storeJobData')) tools.push('storeJobData');
        if (!tools.includes('getStoredJobs')) tools.push('getStoredJobs');
        if (!tools.includes('fillSheetData')) tools.push('fillSheetData');
      }
      return tools;
    }

    switch (taskType) {
      case 'search':
        return ['type', 'click', 'pressEnter', 'getText', 'scroll'];
      case 'email':
        return ['type', 'click', 'keyPress', 'pressEnter', 'scroll', 'scrollToElement', 'waitForElement', 'getText', 'navigate'];
      case 'form':
        return ['type', 'click', 'selectOption', 'toggleCheckbox', 'clearInput', 'scroll', 'scrollToElement'];
      case 'extraction':
        return ['click', 'navigate', 'getText', 'getAttribute', 'scroll', 'scrollToTop', 'scrollToBottom', 'waitForElement'];
      case 'navigation':
        return ['navigate', 'click', 'searchGoogle', 'goBack', 'goForward', 'scroll'];
      case 'gaming':
        return ['arrowUp', 'arrowDown', 'arrowLeft', 'arrowRight', 'keyPress', 'gameControl', 'pressKeySequence', 'sendSpecialKey', 'typeWithKeys', 'focus', 'click', 'waitForElement'];
      case 'shopping':
        return ['navigate', 'click', 'type', 'scroll', 'scrollToBottom', 'getText', 'waitForElement', 'hover', 'selectOption'];
      case 'multitab':
        return ['navigate', 'click', 'type', 'scroll', 'scrollToBottom', 'getText',
                'waitForElement', 'pressEnter', 'keyPress', 'hover', 'selectOption',
                'openNewTab', 'switchToTab', 'closeTab', 'listTabs', 'getCurrentTab', 'waitForTabLoad'];
      case 'canvas':
        return ['cdpClickAt', 'cdpClickAndHold', 'cdpDrag', 'cdpDragVariableSpeed', 'cdpScrollAt',
                'click', 'hover', 'focus', 'keyPress', 'waitForElement', 'scroll', 'getText'];
      default:
        // Return all common tools
        return ['navigate', 'searchGoogle', 'click', 'type', 'hover', 'focus', 'getText',
                'getAttribute', 'selectOption', 'toggleCheckbox', 'clearInput', 'scroll',
                'scrollToTop', 'scrollToBottom', 'scrollToElement', 'waitForElement',
                'pressEnter', 'keyPress', 'refresh', 'goBack', 'goForward'];
    }
  }
  // Dead code removed: getToolsDocumentation (Phase 139.1 cleanup)
  // Was only called by the deleted buildPrompt method.

  
  // Validate response structure
  isValidResponse(response) {
    if (!response || typeof response !== 'object') {
      automationLogger.logValidation(this.currentSessionId, 'response', false, { reason: 'not_an_object' });
      return false;
    }

    // Check required fields
    if (!Array.isArray(response.actions)) {
      automationLogger.logValidation(this.currentSessionId, 'actions', false, { reason: 'not_an_array', type: typeof response.actions });
      return false;
    }

    if (typeof response.taskComplete !== 'boolean') {
      automationLogger.logValidation(this.currentSessionId, 'taskComplete', false, { reason: 'not_boolean', type: typeof response.taskComplete });
      return false;
    }

    // Validate each action
    for (let i = 0; i < response.actions.length; i++) {
      const action = response.actions[i];
      if (!action.tool || !this.isValidTool(action.tool)) {
        automationLogger.logValidation(this.currentSessionId, 'action_tool', false, { index: i, tool: action.tool });
        return false;
      }
      if (!action.params || typeof action.params !== 'object') {
        automationLogger.logValidation(this.currentSessionId, 'action_params', false, { index: i, params: action.params });
        return false;
      }

      // Validate required parameters for specific tools
      if (action.tool === 'openNewTab') {
        if (!action.params.url || typeof action.params.url !== 'string' || action.params.url.trim() === '') {
          automationLogger.logValidation(this.currentSessionId, 'openNewTab_url', false, { index: i, reason: 'missing_url' });
          return false;
        }
        if (!action.params.url.startsWith('http://') && !action.params.url.startsWith('https://')) {
          automationLogger.logValidation(this.currentSessionId, 'openNewTab_url', false, { index: i, reason: 'invalid_protocol', url: action.params.url });
          return false;
        }
      }

      if (action.tool === 'switchToTab' || action.tool === 'closeTab') {
        if (!action.params.tabId) {
          automationLogger.logValidation(this.currentSessionId, `${action.tool}_tabId`, false, { index: i, reason: 'missing_tabId' });
          return false;
        }
      }
    }

    return true;
  }
  // Dead code removed: enhancePromptForRetry, createFallbackResponse (Phase 139.1 cleanup)
  // Were only called by the deleted getAutomationActions method.

  
  /**
   * Tests the API connection
   * @returns {Promise<Object>} Test result with success status and model information
   */
  async testConnection() {
    // Use provider if available
    if (this.provider) {
      automationLogger.logAPI(null, this.settings.modelProvider, 'test_connection', { mode: 'provider' });
      return await this.provider.testConnection();
    }

    // Legacy xAI test implementation
    if (!this.settings.apiKey) {
      throw new Error('API key is required for testing');
    }

    const modelName = this.settings.modelName || 'grok-3-fast';
    automationLogger.logAPI(null, 'xai', 'test_connection', { mode: 'legacy', model: modelName });
      
      const testRequestBody = {
        model: modelName,
        messages: [
          { role: 'user', content: 'Hello, please respond with just "OK"' }
        ],
        max_tokens: 10,
        temperature: 0.1
      };
    
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.apiKey}`
          },
          body: JSON.stringify(testRequestBody)
        });
        
        const result = {
          model: modelName,
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        };
        
        if (response.ok) {
          const data = await response.json();
          result.data = data;
          automationLogger.logAPI(null, 'xai', 'test_success', { model: modelName, status: response.status });

          // Update the working model name
          this.model = modelName;
          return result;

        } else {
          const errorText = await response.text();
          result.error = errorText;
          automationLogger.logAPI(null, 'xai', 'test_failed', { model: modelName, status: response.status, error: errorText });

          // Return the error result
          return result;
        }

      } catch (error) {
        automationLogger.error('Connection test failed', { provider: 'xai', model: modelName, error: error.message });

        // Return the connection error
        return {
          error: error.message,
          connectionFailed: true,
          model: modelName
        };
      }
  }
  
  // Track token usage for analytics
  trackTokenUsage(apiResponse, success) {
    try {
      let inputTokens = 0;
      let outputTokens = 0;
      let tokenSource = 'none';

      automationLogger.debug('Tracking token usage', {
        sessionId: this.currentSessionId,
        hasUsage: !!(apiResponse && apiResponse.usage),
        success
      });

      if (apiResponse && apiResponse.usage) {
        // Standard OpenAI-compatible usage format
        inputTokens = apiResponse.usage.prompt_tokens || 0;
        outputTokens = apiResponse.usage.completion_tokens || 0;
        tokenSource = 'api';
        automationLogger.debug('Using API-provided token counts', { sessionId: this.currentSessionId, inputTokens, outputTokens });
      } else if (apiResponse && success) {
        // Estimate token usage if not provided
        const responseText = this.extractContent(apiResponse);

        // Improved estimation: GPT-style tokens are roughly 0.75 words or 4 characters
        const promptText = JSON.stringify(this.lastPrompt || '');
        inputTokens = Math.ceil(promptText.length / 3.5); // More accurate estimate
        outputTokens = Math.ceil((responseText?.length || 0) / 3.5);
        tokenSource = 'estimated';

        automationLogger.debug('Using estimated token counts', {
          sessionId: this.currentSessionId,
          inputTokens,
          outputTokens,
          promptLength: promptText.length,
          responseLength: responseText?.length || 0
        });
      } else if (!success) {
        // Failed request - estimate input tokens only
        const promptText = JSON.stringify(this.lastPrompt || '');
        inputTokens = Math.ceil(promptText.length / 3.5);
        outputTokens = 0;
        tokenSource = 'error';

        automationLogger.debug('Tracking failed request', { sessionId: this.currentSessionId, inputTokens, outputTokens });
      }

      // Use model name with fallback to ensure it's never undefined
      const modelName = this.model || this.settings?.modelName || 'unknown';

      // Log token usage for comprehensive session logging
      if (typeof automationLogger !== 'undefined' && this.currentSessionId) {
        automationLogger.logTokenUsage(
          this.currentSessionId,
          modelName,
          inputTokens,
          outputTokens,
          tokenSource,
          this.currentIteration
        );
      }

      automationLogger.debug('Final token tracking data', {
        sessionId: this.currentSessionId,
        model: modelName,
        inputTokens,
        outputTokens,
        success,
        tokenSource
      });

      // Check if analytics is available (from options page)
      if (typeof window !== 'undefined' && window.analytics) {
        automationLogger.debug('Tracking via window.analytics', { sessionId: this.currentSessionId });
        window.analytics.trackUsage(modelName, inputTokens, outputTokens, success);
      } else {
        automationLogger.debug('window.analytics not available - using background script', { sessionId: this.currentSessionId });
      }

      // Check if we're in the background script context
      if (typeof initializeAnalytics !== 'undefined') {
        // We're in the background script, track directly
        automationLogger.debug('In background context, tracking directly', { sessionId: this.currentSessionId });
        try {
          const analytics = initializeAnalytics();
          analytics.trackUsage(modelName, inputTokens, outputTokens, success).then(() => {
            automationLogger.debug('Direct usage tracking completed', { sessionId: this.currentSessionId });
          }).catch((error) => {
            automationLogger.error('Direct tracking failed', { sessionId: this.currentSessionId, error: error.message });
          });
          // Accumulate cost on the active session for history display
          if (typeof accumulateSessionCost !== 'undefined' && this.currentSessionId) {
            accumulateSessionCost(this.currentSessionId, modelName, inputTokens, outputTokens);
          }
        } catch (error) {
          automationLogger.error('Failed to initialize analytics', { sessionId: this.currentSessionId, error: error.message });
        }
      } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // We're in a content script or other context, send message
        const trackingData = {
          action: 'TRACK_USAGE',
          data: {
            model: modelName,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            success: success,
            tokenSource: tokenSource,
            timestamp: Date.now()
          }
        };

        automationLogger.logComm(this.currentSessionId, 'send', 'TRACK_USAGE', true, { model: modelName, inputTokens, outputTokens });

        chrome.runtime.sendMessage(trackingData).then((response) => {
          if (response && response.error) {
            automationLogger.error('Background returned error for tracking', { sessionId: this.currentSessionId, error: response.error });
          } else if (!response) {
            automationLogger.warn('Background returned no response for tracking', { sessionId: this.currentSessionId });
          } else if (response.success) {
            automationLogger.debug('Usage tracking confirmed by background', { sessionId: this.currentSessionId });
          }
        }).catch((error) => {
          automationLogger.error('Failed to send tracking message', {
            sessionId: this.currentSessionId,
            error: error.message,
            name: error.name
          });
        });
      } else {
        automationLogger.warn('Chrome runtime not available for usage tracking', { sessionId: this.currentSessionId });
      }
    } catch (error) {
      automationLogger.error('Failed to track token usage', { sessionId: this.currentSessionId, error: error.message });
    }
  }
  
  // Store last prompt for token estimation
  storePrompt(prompt) {
    this.lastPrompt = prompt;
  }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIIntegration;
}
