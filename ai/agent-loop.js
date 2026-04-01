/**
 * Agent Loop Engine for FSB v0.9.20
 *
 * Core tool_use protocol loop that replaces startAutomationLoop.
 * Each iteration is a separate setTimeout callback (not a blocking while-loop)
 * to survive Chrome MV3's 5-minute service worker kill.
 *
 * Uses Phase 135/136 modules:
 *   - tool-definitions.js: TOOL_REGISTRY for tool definitions
 *   - tool-use-adapter.js: format/parse for provider-specific tool_use messages
 *   - tool-executor.js: executeTool for unified tool dispatch
 *   - universal-provider.js: UniversalProvider for API calls
 *
 * Exports: runAgentLoop, runAgentIteration, buildSystemPrompt, callProviderWithTools
 *
 * @module agent-loop
 */

'use strict';

// Chrome extension importScripts-compatible loading
if (typeof importScripts !== 'undefined') {
  // These are already loaded by background.js, but declare dependency explicitly
  // in case agent-loop.js is loaded standalone in tests or other contexts
  try {
    if (typeof TOOL_REGISTRY === 'undefined') importScripts('ai/tool-definitions.js');
    if (typeof formatToolsForProvider === 'undefined') importScripts('ai/tool-use-adapter.js');
    if (typeof executeTool === 'undefined') importScripts('ai/tool-executor.js');
    if (typeof UniversalProvider === 'undefined') importScripts('ai/universal-provider.js');
  } catch (_e) {
    // Already loaded -- ignore
  }
}

// Node.js require for testing
let _toolDefs, _adapter, _executor, _provider;
if (typeof require !== 'undefined') {
  try {
    _toolDefs = require('./tool-definitions.js');
    _adapter = require('./tool-use-adapter.js');
    _executor = require('./tool-executor.js');
    _provider = require('./universal-provider.js');
  } catch (_e) {
    // Running in Chrome extension context -- globals already available
  }
}

// Resolve references for both Chrome (globals) and Node (require)
const _TOOL_REGISTRY = (typeof TOOL_REGISTRY !== 'undefined') ? TOOL_REGISTRY : (_toolDefs?.TOOL_REGISTRY || []);
const _formatToolsForProvider = (typeof formatToolsForProvider !== 'undefined') ? formatToolsForProvider : (_adapter?.formatToolsForProvider || (() => []));
const _parseToolCalls = (typeof parseToolCalls !== 'undefined') ? parseToolCalls : (_adapter?.parseToolCalls || (() => []));
const _formatToolResult = (typeof formatToolResult !== 'undefined') ? formatToolResult : (_adapter?.formatToolResult || (() => ({})));
const _isToolCallResponse = (typeof isToolCallResponse !== 'undefined') ? isToolCallResponse : (_adapter?.isToolCallResponse || (() => false));
const _formatAssistantMessage = (typeof formatAssistantMessage !== 'undefined') ? formatAssistantMessage : (_adapter?.formatAssistantMessage || (() => ({})));
const _extractUsage = (typeof extractUsage !== 'undefined') ? extractUsage : (_adapter?.extractUsage || (() => ({ input: 0, output: 0 })));
const _executeTool = (typeof executeTool !== 'undefined') ? executeTool : (_executor?.executeTool || (async () => ({ success: false, error: 'executeTool not available' })));
const _UniversalProvider = (typeof UniversalProvider !== 'undefined') ? UniversalProvider : (_provider?.UniversalProvider || null);
const _PROVIDER_CONFIGS = (typeof PROVIDER_CONFIGS !== 'undefined') ? PROVIDER_CONFIGS : (_provider?.PROVIDER_CONFIGS || {});


// ---------------------------------------------------------------------------
// Model pricing for cost estimation
// ---------------------------------------------------------------------------

/**
 * Pricing per 1M tokens (input / output) by model name.
 * Matches background.js analytics calculateCost pricing table.
 */
const MODEL_PRICING = {
  // xAI Current models
  'grok-4-0709':                    { input: 3.00, output: 15.00 },
  'grok-4-1-fast-reasoning':        { input: 0.20, output: 0.50 },
  'grok-4-1-fast-non-reasoning':    { input: 0.20, output: 0.50 },
  'grok-4-fast-reasoning':          { input: 3.00, output: 15.00 },
  'grok-4-fast-non-reasoning':      { input: 3.00, output: 15.00 },
  'grok-code-fast-1':               { input: 0.20, output: 1.50 },
  'grok-3':                         { input: 5.00, output: 25.00 },
  'grok-3-mini':                    { input: 0.30, output: 0.50 },
  // xAI Legacy
  'grok-4-1-fast':                  { input: 0.20, output: 0.50 },
  'grok-4-1':                       { input: 3.00, output: 15.00 },
  'grok-4':                         { input: 3.00, output: 15.00 },
  'grok-4-fast':                    { input: 3.00, output: 15.00 },
  'grok-3-fast':                    { input: 0.50, output: 2.50 },
  'grok-3-mini-beta':               { input: 0.30, output: 0.50 },
  'grok-3-mini-fast-beta':          { input: 0.20, output: 0.50 },
  // OpenAI
  'gpt-4o':                         { input: 2.50, output: 10.00 },
  'gpt-4o-mini':                    { input: 0.15, output: 0.60 },
  'chatgpt-4o-latest':              { input: 2.50, output: 10.00 },
  'gpt-4-turbo':                    { input: 10.00, output: 30.00 },
  // Anthropic
  'claude-sonnet-4-5-20250514':     { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20250514':      { input: 1.00, output: 5.00 },
  'claude-opus-4-1-20250414':       { input: 15.00, output: 75.00 },
  // Gemini
  'gemini-2.5-flash':               { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite':          { input: 0.10, output: 0.40 },
  'gemini-2.5-pro':                 { input: 1.25, output: 10.00 },
  'gemini-2.0-flash':               { input: 0.00, output: 0.00 }
};

/**
 * Estimate cost for an API call based on token usage.
 * @param {string} model - Model name (e.g. 'grok-4-1-fast')
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Estimated cost in USD
 */
function estimateCost(model, inputTokens, outputTokens) {
  // Try exact match first, then prefix match for versioned model names
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const modelLower = (model || '').toLowerCase();
    for (const [key, value] of Object.entries(MODEL_PRICING)) {
      if (modelLower.startsWith(key) || modelLower.includes(key)) {
        pricing = value;
        break;
      }
    }
  }
  // Default to grok-4-1-fast pricing if model not found
  if (!pricing) {
    pricing = MODEL_PRICING['grok-4-1-fast-reasoning'] || { input: 0.20, output: 0.50 };
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}


// ---------------------------------------------------------------------------
// getPublicTools -- strip internal routing metadata from tool definitions
// ---------------------------------------------------------------------------

/**
 * Get all tool definitions suitable for sending to the AI provider.
 * Strips internal routing metadata (_route, _readOnly, _contentVerb, _cdpVerb).
 *
 * @returns {Array<{name: string, description: string, inputSchema: Object}>}
 */
function getPublicTools() {
  return _TOOL_REGISTRY.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }));
}


// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Build a minimal system prompt for the agent loop.
 * Per D-05/D-06/D-07: ~1-2KB, no site guides, no conversation history instructions.
 *
 * @param {string} task - The user's task description
 * @param {string} pageUrl - Current page URL
 * @returns {string} System prompt string
 */
function buildSystemPrompt(task, pageUrl) {
  return `You are a browser automation agent. You control a web browser by calling tools.

Current task: ${task}
Current page: ${pageUrl}

Instructions:
- Call tools to interact with the page. Each tool returns a structured result.
- Call get_dom_snapshot to see page elements before interacting.
- When the task is complete, respond with a text message summarizing what you accomplished. Do NOT call any more tools.
- If you cannot complete the task, explain why in a text message.
- Do not ask the user questions. Execute the task autonomously.`;
}


// ---------------------------------------------------------------------------
// Gemini message format converter
// ---------------------------------------------------------------------------

/**
 * Convert standard {role, content} messages to Gemini's {role, parts} format.
 * Handles text messages, tool_use blocks, and tool_result blocks.
 *
 * @param {Object} msg - Standard message {role, content}
 * @returns {Object} Gemini-formatted message
 */
function convertToGeminiFormat(msg) {
  // Tool result messages (role: 'user' with tool_result content or role: 'tool')
  if (msg.role === 'tool' || (Array.isArray(msg.content) && msg.content.some(b => b.type === 'tool_result'))) {
    // Already in Gemini format (from formatToolResult)
    if (msg.parts) return msg;

    // Convert from OpenAI tool format
    if (msg.role === 'tool') {
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.name || '',
            response: typeof msg.content === 'string' ? { result: msg.content } : msg.content
          }
        }]
      };
    }

    // Convert Anthropic tool_result format
    const resultParts = (msg.content || []).filter(b => b.type === 'tool_result').map(b => ({
      functionResponse: {
        name: b.name || '',
        response: typeof b.content === 'string' ? { result: b.content } : b.content
      }
    }));
    return { role: 'user', parts: resultParts.length > 0 ? resultParts : [{ text: JSON.stringify(msg.content) }] };
  }

  // Assistant/model messages with tool calls
  if (msg.role === 'assistant' || msg.role === 'model') {
    // Already in Gemini format
    if (msg.parts) return { role: 'model', parts: msg.parts };

    // Has tool_calls (OpenAI format)
    if (msg.tool_calls) {
      const parts = msg.tool_calls.map(tc => ({
        functionCall: {
          name: tc.function.name,
          args: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments
        }
      }));
      if (msg.content) parts.unshift({ text: msg.content });
      return { role: 'model', parts };
    }

    // Has content array (Anthropic format)
    if (Array.isArray(msg.content)) {
      const parts = msg.content.map(block => {
        if (block.type === 'tool_use') {
          return { functionCall: { name: block.name, args: block.input || {} } };
        }
        return { text: block.text || JSON.stringify(block) };
      });
      return { role: 'model', parts };
    }

    return { role: 'model', parts: [{ text: msg.content || '' }] };
  }

  // User messages
  if (msg.role === 'user') {
    if (msg.parts) return msg;
    return { role: 'user', parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }] };
  }

  // System messages should be filtered out before calling this
  return { role: 'user', parts: [{ text: msg.content || '' }] };
}


// ---------------------------------------------------------------------------
// callProviderWithTools
// ---------------------------------------------------------------------------

/**
 * Make an API call with tool definitions to the configured provider.
 * Builds a provider-specific request body and uses UniversalProvider.sendRequest.
 *
 * NOTE: This builds the request body manually (not via buildRequest) because
 * buildRequest is designed for text completions, not tool_use conversations.
 *
 * @param {Object} providerInstance - UniversalProvider instance
 * @param {string} model - Model name
 * @param {string} apiKey - API key (unused, kept for interface consistency)
 * @param {Array<Object>} messages - Conversation history
 * @param {Array<Object>} tools - Public tool definitions
 * @param {string} providerKey - Provider identifier ('xai','openai','anthropic','gemini','openrouter','custom')
 * @returns {Promise<Object>} Raw API response object
 */
async function callProviderWithTools(providerInstance, model, apiKey, messages, tools, providerKey) {
  const formattedTools = _formatToolsForProvider(tools, providerKey);

  let requestBody;

  switch (providerKey) {
    case 'anthropic': {
      // Anthropic: system prompt separate, messages without system, tools as top-level
      const systemMsg = messages.find(m => m.role === 'system');
      const conversationMsgs = messages.filter(m => m.role !== 'system');
      requestBody = {
        model,
        system: systemMsg ? systemMsg.content : '',
        messages: conversationMsgs,
        tools: formattedTools,
        max_tokens: 4096
      };
      break;
    }

    case 'gemini': {
      // Gemini: contents array (no system role), systemInstruction, tools
      const systemMsg = messages.find(m => m.role === 'system');
      const nonSystemMsgs = messages.filter(m => m.role !== 'system');
      requestBody = {
        contents: nonSystemMsgs.map(convertToGeminiFormat),
        tools: formattedTools,
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        generationConfig: {
          temperature: 0
        }
      };
      break;
    }

    default: {
      // OpenAI/xAI/OpenRouter/Custom: standard messages + tools format
      requestBody = {
        model,
        messages,
        tools: formattedTools,
        temperature: 0
      };
      break;
    }
  }

  return providerInstance.sendRequest(requestBody);
}


// ---------------------------------------------------------------------------
// runAgentLoop
// ---------------------------------------------------------------------------

/**
 * Entry point for the agent loop. Called from handleStartAutomation.
 * Initializes session state and kicks off the first iteration.
 *
 * @param {string} sessionId - Session identifier
 * @param {Object} options - Background.js callbacks and dependencies
 * @param {Map} options.activeSessions - Map of sessionId -> session object
 * @param {Function} options.persistSession - (sessionId, session) => Promise<void>
 * @param {Function} options.sendSessionStatus - (tabId, statusData) => Promise<void>
 * @param {Function} options.broadcastDashboardProgress - (session) => void
 * @param {Function} options.endSessionOverlays - (session, reason) => Promise<void>
 * @param {Function} options.startKeepAlive - () => void
 * @param {Function|null} options.executeCDPToolDirect - CDP handler callback
 * @param {Function|null} options.handleDataTool - Data tool handler callback
 */
async function runAgentLoop(sessionId, options) {
  const { activeSessions, persistSession: persist, sendSessionStatus: sendStatus, startKeepAlive } = options;

  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error('[AgentLoop] Session not found:', sessionId);
    return;
  }

  try {
    // Get current tab URL
    let tabUrl = '';
    try {
      const tab = await chrome.tabs.get(session.tabId);
      tabUrl = tab?.url || '';
    } catch (_e) {
      tabUrl = 'unknown';
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(session.task, tabUrl);

    // Initialize conversation history
    session.messages = [{ role: 'system', content: systemPrompt }];

    // Initialize agent state
    session.agentState = {
      iterationCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      startTime: Date.now(),
      lastDOMHash: null,
      consecutiveNoChangeCount: 0
    };

    // Get public tool definitions (cached for the session)
    session.tools = getPublicTools();

    // Get provider configuration from chrome.storage.sync
    let settings = {};
    try {
      const stored = await chrome.storage.sync.get([
        'provider', 'modelProvider', 'modelName', 'model',
        'apiKey', 'openaiApiKey', 'anthropicApiKey', 'geminiApiKey', 'openrouterApiKey', 'customApiKey',
        'customEndpoint'
      ]);
      settings = stored || {};
    } catch (_e) {
      console.warn('[AgentLoop] Could not read provider settings from storage');
    }

    // Resolve provider key
    const providerKey = settings.modelProvider || settings.provider || 'xai';
    const modelName = settings.modelName || settings.model || 'grok-4-1-fast';

    // Create UniversalProvider instance
    const providerInstance = new (_UniversalProvider)({
      modelProvider: providerKey,
      modelName: modelName,
      ...settings
    });

    // Cache provider config in session for reuse across iterations
    session.providerConfig = {
      providerKey,
      model: modelName,
      apiKey: settings.apiKey || settings[_PROVIDER_CONFIGS[providerKey]?.keyField] || '',
      providerInstance
    };

    // Ensure keep-alive is running
    if (typeof startKeepAlive === 'function') {
      startKeepAlive();
    }

    console.log('[AgentLoop] Starting agent loop', {
      sessionId,
      provider: providerKey,
      model: modelName,
      toolCount: session.tools.length,
      tabUrl: tabUrl.substring(0, 80)
    });

    // Kick off the first iteration
    runAgentIteration(sessionId, options);

  } catch (error) {
    console.error('[AgentLoop] Failed to initialize agent loop:', error);
    session.status = 'error';
    session.error = error.message;
    if (typeof options.endSessionOverlays === 'function') {
      await options.endSessionOverlays(session, 'error');
    }
    await persist(sessionId, session);
  }
}


// ---------------------------------------------------------------------------
// runAgentIteration
// ---------------------------------------------------------------------------

/**
 * Execute one iteration of the agent loop.
 * Makes an API call, processes tool calls or end_turn, and schedules next iteration.
 *
 * Uses setTimeout-chaining (not while-loop) for Chrome MV3 service worker compatibility.
 * Each iteration is a separate event that resets Chrome's execution timer.
 *
 * @param {string} sessionId - Session identifier
 * @param {Object} options - Background.js callbacks (same as runAgentLoop)
 */
async function runAgentIteration(sessionId, options) {
  const {
    activeSessions,
    persistSession: persist,
    sendSessionStatus: sendStatus,
    broadcastDashboardProgress,
    endSessionOverlays,
    executeCDPToolDirect,
    handleDataTool
  } = options;

  // a. Retrieve session
  const session = activeSessions.get(sessionId);

  // b. Guard: session must exist and be running
  if (!session || session.status !== 'running') {
    return;
  }

  // c. Increment iteration count
  session.agentState.iterationCount++;
  const iterNum = session.agentState.iterationCount;

  // d. Send analyzing status
  if (typeof sendStatus === 'function') {
    sendStatus(session.tabId, {
      phase: 'analyzing',
      taskName: session.task,
      statusText: `Iteration ${iterNum}: analyzing...`,
      iteration: iterNum
    });
  }

  // e. Broadcast dashboard progress
  if (typeof broadcastDashboardProgress === 'function') {
    broadcastDashboardProgress(session);
  }

  try {
    // f. Get provider settings from cached session config
    const { providerKey, model, providerInstance } = session.providerConfig;

    // g. Make API call with tool definitions
    const response = await callProviderWithTools(
      providerInstance, model, null, session.messages, session.tools, providerKey
    );

    // h. Extract and accumulate usage
    const usage = _extractUsage(response, providerKey);
    const inputTokens = usage.input || 0;
    const outputTokens = usage.output || 0;
    session.agentState.totalInputTokens += inputTokens;
    session.agentState.totalOutputTokens += outputTokens;
    session.agentState.totalCost += estimateCost(model, inputTokens, outputTokens);

    // Also update session-level counters for backward compatibility
    session.totalInputTokens = session.agentState.totalInputTokens;
    session.totalOutputTokens = session.agentState.totalOutputTokens;
    session.totalCost = session.agentState.totalCost;
    session.iterationCount = iterNum;

    // i. Check if AI is done (end_turn) or wants to call tools
    if (!_isToolCallResponse(response, providerKey)) {
      // AI is done -- extract final text
      let finalText = '';
      try {
        if (providerKey === 'anthropic') {
          const textBlocks = (response.content || []).filter(b => b.type === 'text');
          finalText = textBlocks.map(b => b.text).join('\n');
        } else if (providerKey === 'gemini') {
          const parts = response.candidates?.[0]?.content?.parts || [];
          finalText = parts.filter(p => p.text).map(p => p.text).join('\n');
        } else {
          finalText = response.choices?.[0]?.message?.content || '';
        }
      } catch (_e) {
        finalText = 'Task completed.';
      }

      console.log('[AgentLoop] AI signaled end_turn', {
        sessionId, iteration: iterNum, finalTextLength: finalText.length
      });

      // End session
      session.status = 'completed';
      session.completionMessage = finalText;

      if (typeof endSessionOverlays === 'function') {
        await endSessionOverlays(session, 'complete');
      }

      if (typeof sendStatus === 'function') {
        sendStatus(session.tabId, {
          phase: 'complete',
          taskName: session.task,
          statusText: finalText.substring(0, 200),
          iteration: iterNum
        });
      }

      await persist(sessionId, session);

      // Broadcast completion
      if (typeof broadcastDashboardProgress === 'function') {
        broadcastDashboardProgress(session);
      }

      // Do NOT schedule next iteration -- AI decided to stop
      return;
    }

    // j. Push assistant message to history (BEFORE tool results, per Pitfall 5)
    const assistantMsg = _formatAssistantMessage(response, providerKey);
    session.messages.push(assistantMsg);

    // k. Parse tool calls
    const toolCalls = _parseToolCalls(response, providerKey);

    if (toolCalls.length === 0) {
      // No tool calls parsed but isToolCallResponse was true -- defensive fallback
      console.warn('[AgentLoop] isToolCallResponse=true but no tool calls parsed', { sessionId, iteration: iterNum });
      session.messages.push({ role: 'user', content: 'No tool calls were detected. Please either call a tool or provide your final answer.' });
      await persist(sessionId, session);
      setTimeout(() => runAgentIteration(sessionId, options), 100);
      return;
    }

    // l. Execute each tool call SEQUENTIALLY (browser actions must be serial)
    const toolResults = [];
    for (const call of toolCalls) {
      const result = await _executeTool(call.name, call.args, session.tabId, {
        cdpHandler: executeCDPToolDirect,
        dataHandler: handleDataTool
      });

      toolResults.push({ callId: call.id, name: call.name, result });

      // Update action history for progress tracking
      if (!session.actionHistory) session.actionHistory = [];
      session.actionHistory.push({
        tool: call.name,
        params: call.args,
        result: { success: result.success, hadEffect: result.hadEffect },
        timestamp: Date.now(),
        iteration: iterNum
      });

      // Send per-tool progress update
      if (typeof sendStatus === 'function') {
        sendStatus(session.tabId, {
          phase: 'executing',
          taskName: session.task,
          statusText: `${call.name}${call.args?.selector ? ' ' + call.args.selector : ''}`,
          iteration: iterNum
        });
      }
    }

    // m. Format tool results into messages and push to history
    for (const tr of toolResults) {
      const resultMsg = _formatToolResult(
        tr.callId,
        JSON.stringify(tr.result),
        providerKey,
        { name: tr.name }
      );
      session.messages.push(resultMsg);
    }

    // n. Persist session state after every iteration (per SAFE-04, D-09)
    await persist(sessionId, session);

    // o. Schedule next iteration via setTimeout (per D-08, P4)
    // 100ms delay: fast enough for responsive automation,
    // long enough to yield the event loop and reset Chrome's execution timer
    setTimeout(() => runAgentIteration(sessionId, options), 100);

  } catch (error) {
    // Error handling for API call failures
    const errMsg = error.message || String(error);
    const errStatus = error.status;

    console.error('[AgentLoop] Iteration error', {
      sessionId, iteration: iterNum, error: errMsg, status: errStatus
    });

    // Auth errors (401/403): terminal
    if (errStatus === 401 || errStatus === 403) {
      session.status = 'error';
      session.error = 'API key invalid or expired. Please check your API key in settings.';
      if (typeof endSessionOverlays === 'function') {
        await endSessionOverlays(session, 'error');
      }
      if (typeof sendStatus === 'function') {
        sendStatus(session.tabId, {
          phase: 'error',
          taskName: session.task,
          statusText: session.error,
          iteration: iterNum
        });
      }
      await persist(sessionId, session);
      return;
    }

    // Rate limit (429): wait 5s and retry once
    // (UniversalProvider handles retries internally, so this is a last-resort catch)
    if (errStatus === 429 || error.isRateLimited) {
      console.warn('[AgentLoop] Rate limited, waiting 5s before retry', { sessionId });
      setTimeout(() => runAgentIteration(sessionId, options), 5000);
      return;
    }

    // Network error / timeout: retry once after 2s
    if (!session._lastRetryIteration || session._lastRetryIteration < iterNum) {
      session._lastRetryIteration = iterNum;
      // Decrement iteration count since this will be retried
      session.agentState.iterationCount--;
      console.warn('[AgentLoop] Network error, retrying in 2s', { sessionId, error: errMsg });
      setTimeout(() => runAgentIteration(sessionId, options), 2000);
      return;
    }

    // Second failure on same iteration: terminal error
    session.status = 'error';
    session.error = `API call failed: ${errMsg}`;
    if (typeof endSessionOverlays === 'function') {
      await endSessionOverlays(session, 'error');
    }
    if (typeof sendStatus === 'function') {
      sendStatus(session.tabId, {
        phase: 'error',
        taskName: session.task,
        statusText: session.error,
        iteration: iterNum
      });
    }
    await persist(sessionId, session);
  }
}


// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// CommonJS for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAgentLoop, runAgentIteration, buildSystemPrompt, callProviderWithTools, estimateCost, getPublicTools };
}
