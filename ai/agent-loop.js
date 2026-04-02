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

// Node.js require for testing -- use var to avoid redeclaration with tool-executor.js in shared scope
var _al_toolDefs, _al_adapter, _al_executor, _al_provider;
if (typeof require !== 'undefined') {
  try {
    _al_toolDefs = require('./tool-definitions.js');
    _al_adapter = require('./tool-use-adapter.js');
    _al_executor = require('./tool-executor.js');
    _al_provider = require('./universal-provider.js');
  } catch (_e) {
    // Running in Chrome extension context -- globals already available
  }
}

// Resolve references for both Chrome (globals) and Node (require)
// Use var throughout to avoid const/let redeclaration errors in importScripts shared scope
var _al_TOOL_REGISTRY = (typeof TOOL_REGISTRY !== 'undefined') ? TOOL_REGISTRY : (_al_toolDefs?.TOOL_REGISTRY || []);
var _formatToolsForProvider = (typeof formatToolsForProvider !== 'undefined') ? formatToolsForProvider : (_al_adapter?.formatToolsForProvider || (() => []));
var _parseToolCalls = (typeof parseToolCalls !== 'undefined') ? parseToolCalls : (_al_adapter?.parseToolCalls || (() => []));
var _formatToolResult = (typeof formatToolResult !== 'undefined') ? formatToolResult : (_al_adapter?.formatToolResult || (() => ({})));
var _isToolCallResponse = (typeof isToolCallResponse !== 'undefined') ? isToolCallResponse : (_al_adapter?.isToolCallResponse || (() => false));
var _formatAssistantMessage = (typeof formatAssistantMessage !== 'undefined') ? formatAssistantMessage : (_al_adapter?.formatAssistantMessage || (() => ({})));
var _extractUsage = (typeof extractUsage !== 'undefined') ? extractUsage : (_al_adapter?.extractUsage || (() => ({ input: 0, output: 0 })));
var _executeTool = (typeof executeTool !== 'undefined') ? executeTool : (_al_executor?.executeTool || (async () => ({ success: false, error: 'executeTool not available' })));
var _UniversalProvider = (typeof UniversalProvider !== 'undefined') ? UniversalProvider : (_al_provider?.UniversalProvider || null);
var _PROVIDER_CONFIGS = (typeof PROVIDER_CONFIGS !== 'undefined') ? PROVIDER_CONFIGS : (_al_provider?.PROVIDER_CONFIGS || {});


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
// Safety Breakers (SAFE-01, SAFE-02)
// ---------------------------------------------------------------------------

/**
 * Check cost and time safety limits before each iteration.
 * Called at the START of runAgentIteration, BEFORE the API call.
 *
 * @param {Object} session - Session object with agentState and safetyConfig
 * @returns {{ shouldStop: boolean, reason: string|null }}
 */
function checkSafetyBreakers(session) {
  const state = session.agentState || {};

  // Cost circuit breaker (SAFE-01, D-01)
  const costLimit = session.safetyConfig?.costLimit || 2.00;
  if ((state.totalCost || 0) >= costLimit) {
    return {
      shouldStop: true,
      reason: `Session cost ($${(state.totalCost || 0).toFixed(2)}) exceeded limit ($${costLimit.toFixed(2)}). Stopping to prevent excess spending.`
    };
  }

  // Time limit (SAFE-02, D-02)
  const timeLimit = session.safetyConfig?.timeLimit || 10 * 60 * 1000; // Default 10 minutes
  const elapsed = Date.now() - (state.startTime || Date.now());
  if (elapsed >= timeLimit) {
    const minutes = Math.floor(elapsed / 60000);
    return {
      shouldStop: true,
      reason: `Session duration (${minutes} min) exceeded limit (${Math.floor(timeLimit / 60000)} min). Stopping automation.`
    };
  }

  return { shouldStop: false, reason: null };
}


// ---------------------------------------------------------------------------
// Stuck Detection (SAFE-03, D-03, P8)
// ---------------------------------------------------------------------------

/**
 * Detect whether the AI is stuck (consecutive tool calls with no DOM change).
 * Called AFTER tool execution, BEFORE scheduling the next iteration.
 *
 * @param {Object} session - Session object with agentState and actionHistory
 * @param {Array<{callId: string, name: string, result: Object}>} toolResults - Results from this iteration
 * @returns {{ isStuck: boolean, hint: string|null }}
 */
function detectStuck(session, toolResults) {
  const state = session.agentState || {};

  // Check if ANY tool result had effect -- if yes, reset counter
  const anyEffect = toolResults.some(tr => tr.result && tr.result.hadEffect === true);

  if (anyEffect) {
    state.consecutiveNoChangeCount = 0;
    return { isStuck: false, hint: null };
  }

  // No tool had effect -- increment counter
  state.consecutiveNoChangeCount = (state.consecutiveNoChangeCount || 0) + 1;

  if (state.consecutiveNoChangeCount >= 3) {
    // Build recent actions summary from actionHistory
    const history = session.actionHistory || [];
    const recentEntries = history.slice(-5);
    const recentActions = recentEntries.map(entry => {
      const paramStr = entry.params?.selector || entry.params?.text || entry.params?.url || '';
      return paramStr ? `${entry.tool}(${paramStr})` : entry.tool;
    });

    return {
      isStuck: true,
      hint: `WARNING: The last ${state.consecutiveNoChangeCount} tool calls produced no visible change on the page. ` +
        `Previous actions: [${recentActions.join(', ')}]. ` +
        `Suggestions: (1) Call get_dom_snapshot to refresh your view of the page -- elements may have changed. ` +
        `(2) Try scrolling to reveal hidden elements. ` +
        `(3) Try a completely different approach to the task. ` +
        `(4) If the task appears complete, respond with a summary instead of calling more tools.`
    };
  }

  return { isStuck: false, hint: null };
}


// ---------------------------------------------------------------------------
// History Compression (CTX-03, D-07 through D-10)
// ---------------------------------------------------------------------------

/**
 * Estimate token count for a message array using char/4 heuristic.
 * @param {Array<Object>} messages - Conversation messages
 * @returns {number} Estimated token count
 */
function estimateTokens(messages) {
  let chars = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        chars += JSON.stringify(block).length;
      }
    } else if (msg.parts) {
      // Gemini format
      chars += JSON.stringify(msg.parts).length;
    }
    // Tool call messages (OpenAI format)
    if (msg.tool_calls) {
      chars += JSON.stringify(msg.tool_calls).length;
    }
  }
  return Math.ceil(chars / 4);
}

/**
 * Compact old tool_result messages when history exceeds 80% of token budget.
 * Per D-08: Keep the most recent 5 tool_result messages intact.
 * Per D-09: System prompt and current iteration messages are never compressed.
 * Per D-10: Token estimation uses char/4 heuristic.
 *
 * @param {Array<Object>} messages - Conversation history (mutated in place)
 * @param {number} tokenBudget - Max token budget for the model (default 128000)
 * @returns {{ compacted: boolean, removedCount: number, estimatedTokens: number }}
 */
function compactHistory(messages, tokenBudget = 128000) {
  const threshold = tokenBudget * 0.8;
  const currentTokens = estimateTokens(messages);

  if (currentTokens <= threshold) {
    return { compacted: false, removedCount: 0, estimatedTokens: currentTokens };
  }

  // Find all tool_result messages (role: 'tool' for OpenAI, or content array with type: 'tool_result' for Anthropic)
  // Also find Gemini functionResponse messages
  const toolResultIndices = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'tool') {
      toolResultIndices.push(i);
    } else if (Array.isArray(msg.content) && msg.content.some(b => b.type === 'tool_result')) {
      toolResultIndices.push(i);
    } else if (msg.role === 'user' && msg.parts && msg.parts.some(p => p.functionResponse)) {
      toolResultIndices.push(i);
    }
  }

  // Keep the most recent 5 tool_result messages intact (per D-08)
  const compactableIndices = toolResultIndices.slice(0, -5);

  if (compactableIndices.length === 0) {
    return { compacted: false, removedCount: 0, estimatedTokens: currentTokens };
  }

  // Compact each old tool_result to a one-liner summary
  let removedCount = 0;
  for (const idx of compactableIndices) {
    const msg = messages[idx];
    let toolName = 'unknown_tool';
    let status = 'completed';

    // Extract tool name and status from various formats
    if (msg.role === 'tool') {
      toolName = msg.name || 'unknown_tool';
      try {
        const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        status = parsed?.success === false ? 'error' : 'success';
      } catch (_) { /* keep default */ }
    } else if (Array.isArray(msg.content)) {
      const resultBlock = msg.content.find(b => b.type === 'tool_result');
      if (resultBlock) {
        toolName = resultBlock.name || 'unknown_tool';
        try {
          const parsed = typeof resultBlock.content === 'string' ? JSON.parse(resultBlock.content) : resultBlock.content;
          status = parsed?.success === false ? 'error' : 'success';
        } catch (_) { /* keep default */ }
      }
    } else if (msg.parts) {
      const frPart = msg.parts.find(p => p.functionResponse);
      if (frPart) {
        toolName = frPart.functionResponse.name || 'unknown_tool';
        const resp = frPart.functionResponse.response;
        status = resp?.success === false ? 'error' : 'success';
      }
    }

    // Replace with compact summary (per D-08)
    const summary = `${toolName} returned ${status}`;
    if (msg.role === 'tool') {
      msg.content = summary;
    } else if (Array.isArray(msg.content)) {
      msg.content = [{ type: 'tool_result', tool_use_id: msg.content[0]?.tool_use_id || '', content: summary }];
    } else if (msg.parts) {
      const frPart = msg.parts.find(p => p.functionResponse);
      if (frPart) {
        frPart.functionResponse.response = { result: summary };
      }
    }
    removedCount++;
  }

  const newTokens = estimateTokens(messages);
  console.log(`[AgentLoop] History compacted: removed ${removedCount} old tool results, tokens ${currentTokens} -> ${newTokens}`);

  return { compacted: true, removedCount, estimatedTokens: newTokens };
}

const TURN_WINDOW_MESSAGES = 12;
const TURN_WINDOW_SUMMARY_LINES = 8;
const TURN_WINDOW_SUMMARY_CHARS = 1800;

function truncatePromptWindowText(value, maxChars = TURN_WINDOW_SUMMARY_CHARS) {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function isToolResultMessage(message) {
  return message?.role === 'tool' ||
    (Array.isArray(message?.content) && message.content.some(block => block.type === 'tool_result')) ||
    (Array.isArray(message?.parts) && message.parts.some(part => part.functionResponse));
}

function hasToolCallMessage(message) {
  return Array.isArray(message?.tool_calls) ||
    (Array.isArray(message?.content) && message.content.some(block => block.type === 'tool_use')) ||
    (Array.isArray(message?.parts) && message.parts.some(part => part.functionCall));
}

function getPromptWindowStart(messages) {
  let startIndex = Math.max(0, messages.length - TURN_WINDOW_MESSAGES);

  while (startIndex > 0 && isToolResultMessage(messages[startIndex])) {
    startIndex--;
  }

  if (startIndex > 0 && isToolResultMessage(messages[startIndex - 1])) {
    while (startIndex > 0 && isToolResultMessage(messages[startIndex - 1])) {
      startIndex--;
    }
    if (startIndex > 0 && hasToolCallMessage(messages[startIndex - 1])) {
      startIndex--;
    }
  }

  return startIndex;
}

function summarizePromptWindowMessage(message) {
  if (!message || typeof message !== 'object') {
    return '';
  }

  if (message.role === 'tool') {
    const toolName = message.name || 'unknown_tool';
    let status = 'completed';
    try {
      const parsed = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
      status = parsed?.success === false ? 'error' : 'success';
    } catch (_error) {
      status = typeof message.content === 'string' && message.content.includes('error') ? 'error' : 'success';
    }
    return `${toolName} returned ${status}`;
  }

  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const toolNames = message.tool_calls
      .map(call => call.function?.name || null)
      .filter(Boolean);
    return `Assistant requested tools: ${toolNames.join(', ')}`;
  }

  if (Array.isArray(message.content)) {
    const toolNames = message.content
      .filter(block => block.type === 'tool_use')
      .map(block => block.name)
      .filter(Boolean);
    if (toolNames.length > 0) {
      return `Assistant requested tools: ${toolNames.join(', ')}`;
    }
    const textBlock = message.content.find(block => block.type === 'text' && typeof block.text === 'string');
    if (textBlock?.text) {
      return `${message.role || 'message'}: ${truncatePromptWindowText(textBlock.text, 120)}`;
    }
  }

  if (Array.isArray(message.parts)) {
    const functionNames = message.parts
      .map(part => part.functionCall?.name || part.functionResponse?.name || null)
      .filter(Boolean);
    if (functionNames.length > 0) {
      return `${message.role || 'message'}: ${functionNames.join(', ')}`;
    }
    const textPart = message.parts.find(part => typeof part.text === 'string');
    if (textPart?.text) {
      return `${message.role || 'message'}: ${truncatePromptWindowText(textPart.text, 120)}`;
    }
  }

  if (typeof message.content === 'string') {
    return `${message.role || 'message'}: ${truncatePromptWindowText(message.content, 120)}`;
  }

  return `${message.role || 'message'} update`;
}

function buildTurnMessages(session) {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const systemMessage = messages.find(message => message.role === 'system') || {
    role: 'system',
    content: buildSystemPrompt(session.task, 'unknown')
  };
  const nonSystemMessages = messages.filter(message => message.role !== 'system');
  const startIndex = getPromptWindowStart(nonSystemMessages);
  const olderMessages = nonSystemMessages.slice(0, startIndex);
  const recentMessages = nonSystemMessages.slice(startIndex).map(cloneAgentMessage).filter(Boolean);
  const summaryParts = [];
  const persistedSummary = session.resumeSummary || session.agentResumeState?.historySummary || null;

  if (persistedSummary) {
    summaryParts.push(persistedSummary);
  }

  const olderSummaryLines = olderMessages
    .slice(-TURN_WINDOW_SUMMARY_LINES)
    .map(summarizePromptWindowMessage)
    .filter(Boolean);

  if (olderSummaryLines.length > 0) {
    summaryParts.push(`Earlier turns omitted ${olderMessages.length} message(s).\n${olderSummaryLines.join('\n')}`);
  }

  const turnMessages = [cloneAgentMessage(systemMessage)];
  const historySummary = truncatePromptWindowText(summaryParts.filter(Boolean).join('\n'), TURN_WINDOW_SUMMARY_CHARS);

  if (historySummary) {
    turnMessages.push({
      role: 'user',
      content: `Earlier automation context:\n${historySummary}`
    });
  }

  turnMessages.push(...recentMessages);
  return turnMessages;
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
  return _al_TOOL_REGISTRY.map(t => ({
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
  return `You are a browser automation agent. Your job is to COMPLETE the user's task end-to-end, not just browse.

TASK: ${task}
CURRENT PAGE: ${pageUrl}

WORKFLOW -- follow these steps in order:
1. Navigate to the relevant page if not already there.
2. Use read_page to extract the actual text content of the page. This is how you read what's on screen.
3. Use get_page_snapshot ONLY when you need to find element selectors for clicking or typing.
4. Perform actions (click, type, scroll, select_option) to interact with the page.
5. If the task involves collecting data: use read_page to extract ALL data, scroll and read again for more.
6. If the task involves entering data into Google Sheets: open a new sheet (navigate to sheets.google.com/create), then use fill_sheet with CSV data.
7. Use report_progress to keep the user informed of what you are doing.
8. Call complete_task with a summary when the FULL task is done.
9. Call fail_task with a reason if you cannot complete it.

CRITICAL RULES:
- Do NOT stop after just navigating and scrolling. That is only the first step.
- Do NOT end your turn with a text message. Always call complete_task or fail_task when done.
- read_page gives you the actual text content (titles, descriptions, data to extract).
- get_page_snapshot gives you DOM element IDs and selectors (for click/type targets).
- For data collection: scroll through ALL results, reading each page of content.
- For Google Sheets entry: use fill_sheet tool with startCell and csvData parameters.
- When on Google Sheets, call fill_sheet directly. Do NOT interact with Tables sidebar or any overlays.
- Execute autonomously. Do not ask the user questions.`;
}

function cloneAgentMessage(message) {
  if (!message || typeof message !== 'object') {
    return message || null;
  }

  try {
    return JSON.parse(JSON.stringify(message));
  } catch (_error) {
    return message;
  }
}

function buildFollowUpBoundaryMessage(followUpContext) {
  const previousTask = followUpContext?.previousTask
    ? `PREVIOUS TASK: ${followUpContext.previousTask}\n`
    : '';

  return `[FOLLOW-UP COMMAND]
${previousTask}NEW TASK: ${followUpContext?.newTask || ''}
Continue from the existing automation context when it is still relevant. Re-check the live page before acting if the UI may have changed.`;
}

function hydrateAgentRunState(session, systemPrompt) {
  const resumeState = session.agentResumeState || {};
  const hadExistingMessages = Array.isArray(session.messages) && session.messages.length > 0;
  const restoredMessages = Array.isArray(resumeState.recentMessages)
    ? resumeState.recentMessages.map(cloneAgentMessage).filter(Boolean)
    : [];

  if (hadExistingMessages) {
    const nonSystemMessages = session.messages.filter((message, index) => !(index === 0 && message?.role === 'system'));
    session.messages = [{ role: 'system', content: systemPrompt }, ...nonSystemMessages];
  } else {
    session.messages = [{ role: 'system', content: systemPrompt }, ...restoredMessages];
  }

  if (!hadExistingMessages) {
    session.resumeSummary = session.resumeSummary || resumeState.historySummary || null;
  } else if (session.isRestored) {
    session.resumeSummary = session.resumeSummary || resumeState.historySummary || null;
  } else if (!session.resumeSummary) {
    session.resumeSummary = null;
  }

  if (session.followUpContext) {
    session.messages.push({
      role: 'user',
      content: buildFollowUpBoundaryMessage(session.followUpContext)
    });
    session.followUpContext = null;
  }

  const restoredAgentState = session.agentState || resumeState.agentState || {};
  session.agentState = {
    iterationCount: 0,
    completedIterations: restoredAgentState.completedIterations || 0,
    totalInputTokens: restoredAgentState.totalInputTokens || session.totalInputTokens || 0,
    totalOutputTokens: restoredAgentState.totalOutputTokens || session.totalOutputTokens || 0,
    totalCost: restoredAgentState.totalCost || session.totalCost || 0,
    startTime: Date.now(),
    lastDOMHash: null,
    consecutiveNoChangeCount: 0
  };

  session.totalInputTokens = session.agentState.totalInputTokens;
  session.totalOutputTokens = session.agentState.totalOutputTokens;
  session.totalCost = session.agentState.totalCost;
  session.isRestored = false;

  if (!Array.isArray(session.tools) || session.tools.length === 0) {
    session.tools = getPublicTools();
  }

  return session;
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

      // CTX-04 / D-14: Enable prompt caching for system prompt and tool definitions
      const systemContent = systemMsg ? systemMsg.content : '';
      const cachedSystem = [{
        type: 'text',
        text: systemContent,
        cache_control: { type: 'ephemeral' }
      }];

      // Mark last tool definition for caching (Anthropic caches up to the marked block)
      const cachedTools = formattedTools.map((tool, i) => {
        if (i === formattedTools.length - 1) {
          return { ...tool, cache_control: { type: 'ephemeral' } };
        }
        return tool;
      });

      requestBody = {
        model,
        system: cachedSystem,
        messages: conversationMsgs,
        tools: cachedTools,
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

    // Build the current-command system prompt and hydrate any persisted thread state.
    const systemPrompt = buildSystemPrompt(session.task, tabUrl);
    hydrateAgentRunState(session, systemPrompt);

    // Initialize safety thresholds from chrome.storage.local (SAFE-01, SAFE-02)
    try {
      const storedSettings = await chrome.storage.local.get({
        costLimit: 2.00,
        timeLimit: 10
      });
      session.safetyConfig = {
        costLimit: parseFloat(storedSettings.costLimit) || 2.00,
        timeLimit: (parseInt(storedSettings.timeLimit) || 10) * 60 * 1000 // Convert minutes to ms
      };
    } catch (_e) {
      // Fallback to defaults if storage unavailable
      session.safetyConfig = { costLimit: 2.00, timeLimit: 10 * 60 * 1000 };
    }

    // Get provider configuration from chrome.storage.local (where options page saves them)
    let settings = {};
    try {
      const stored = await chrome.storage.local.get([
        'provider', 'modelProvider', 'modelName', 'model',
        'apiKey', 'openaiApiKey', 'anthropicApiKey', 'geminiApiKey', 'openrouterApiKey', 'customApiKey',
        'customEndpoint'
      ]);
      settings = stored || {};
    } catch (_e) {
      console.warn('[AgentLoop] Could not read provider settings from storage');
    }

    const persistedProviderConfig = session.providerConfig || session.agentResumeState?.providerConfig || {};

    // Resolve provider key
    const providerKey = persistedProviderConfig.providerKey || settings.modelProvider || settings.provider || 'xai';
    const modelName = persistedProviderConfig.model || settings.modelName || settings.model || 'grok-4-1-fast';

    // Create or reuse the session provider instance
    let providerInstance = session.providerConfig?.providerInstance || null;
    if (!providerInstance ||
        session.providerConfig?.providerKey !== providerKey ||
        session.providerConfig?.model !== modelName) {
      providerInstance = new (_UniversalProvider)({
        modelProvider: providerKey,
        modelName: modelName,
        ...settings
      });
    }

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
      resumedMessages: Math.max(0, (session.messages?.length || 1) - 1),
      hasResumeSummary: !!session.resumeSummary,
      tabUrl: tabUrl.substring(0, 80),
      endpoint: providerInstance.getEndpoint()
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
    cleanupSession,
    executeCDPToolDirect,
    handleDataTool
  } = options;

  // Helper: save session to automation logger so MCP list_sessions/get_session_detail can find it
  function saveToLogger(sid, sess, status) {
    try {
      if (typeof automationLogger !== 'undefined' && automationLogger.saveSession) {
        const duration = Date.now() - (sess.startTime || Date.now());
        automationLogger.logSessionEnd(sid, status, (sess.actionHistory || []).length, duration);
        automationLogger.saveSession(sid, sess);
      }
    } catch (_e) { /* non-fatal */ }
  }

  // Helper: notify sidepanel that automation is done (sidepanel listens for 'automationComplete')
  function notifySidepanel(sid, sess, resultText, isError) {
    try {
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId: sid,
        result: resultText || (isError ? sess.error : sess.completionMessage) || 'Task completed.',
        partial: isError,
        reason: isError ? 'error' : 'completed',
        task: sess.task
      }).catch(() => {});
    } catch (_e) { /* non-fatal -- sidepanel may not be open */ }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function describeToolCall(name, args) {
    var toolNameMap = {
      search: 'searchGoogle',
      go_back: 'goBack',
      go_forward: 'goForward',
      type_text: 'type',
      press_enter: 'pressEnter',
      press_key: 'keyPress',
      select_option: 'selectOption',
      check_box: 'toggleCheckbox',
      right_click: 'rightClick',
      double_click: 'doubleClick',
      clear_input: 'clearInput',
      wait_for_element: 'waitForElement',
      open_tab: 'openNewTab',
      switch_tab: 'switchToTab',
      fill_sheet: 'fillSheetData',
      read_sheet: 'readsheet',
      read_page: 'readPage',
      get_text: 'getText',
      get_attribute: 'getAttribute',
      set_attribute: 'setAttribute'
    };

    var mappedName = toolNameMap[name] || name;
    if (typeof getActionStatus === 'function') {
      return getActionStatus(mappedName, args);
    }
    return String(name || 'working').replace(/_/g, ' ');
  }

  // Helper: full session finalization (overlays + logger + sidepanel + cleanup)
  async function finalizeSession(sid, sess, resultText, isError) {
    saveToLogger(sid, sess, isError ? 'error' : 'completed');
    notifySidepanel(sid, sess, resultText, isError);
    // Give the final overlay state a moment to render before cleanup clears it.
    await sleep(900);
    // cleanupSession removes from activeSessions, persistent storage, and sends overlay cleanup
    if (typeof cleanupSession === 'function') {
      try { await cleanupSession(sid); } catch (_e) { /* non-fatal */ }
    }
  }

  // a. Retrieve session
  const session = activeSessions.get(sessionId);

  // b. Guard: session must exist and be running
  if (!session || session.status !== 'running') {
    return;
  }

  // b2. Safety breaker check (SAFE-01 cost, SAFE-02 time)
  const safety = checkSafetyBreakers(session);
  if (safety.shouldStop) {
    session.status = 'stopped';
    if (typeof sendStatus === 'function') {
      sendStatus(session.tabId, {
        phase: 'ended', reason: 'safety',
        taskName: session.task,
        statusText: safety.reason,
        cost: (session.agentState.totalCost || 0).toFixed(4)
      });
    }
    if (typeof endSessionOverlays === 'function') {
      await endSessionOverlays(session, 'safety');
    }
    await persist(sessionId, session);
    return; // Do NOT schedule next iteration
  }

  // c. Increment iteration count
  session.agentState.iterationCount++;
  const iterNum = session.agentState.iterationCount;

  // d. Send analyzing status with cost (PROG-01, PROG-03)
  if (typeof sendStatus === 'function') {
    sendStatus(session.tabId, {
      phase: 'analyzing',
      taskName: session.task,
      statusText: 'Reviewing page state',
      iteration: iterNum,
      cost: (session.agentState.totalCost || 0).toFixed(4)
    });
  }

  // e. Broadcast dashboard progress
  if (typeof broadcastDashboardProgress === 'function') {
    broadcastDashboardProgress(session);
  }

  try {
    // f. Get provider settings from cached session config
    const { providerKey, model, providerInstance } = session.providerConfig;

    // f2. Compact history if approaching token budget (CTX-03)
    compactHistory(session.messages);
    const turnMessages = buildTurnMessages(session);

    // g. Make API call with tool definitions
    const response = await callProviderWithTools(
      providerInstance, model, null, turnMessages, session.tools, providerKey
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
        sessionId, iteration: iterNum, finalTextLength: finalText.length,
        finalText: finalText.substring(0, 500)
      });

      // End session
      session.status = 'completed';
      session.completionMessage = finalText;

      if (typeof sendStatus === 'function') {
        sendStatus(session.tabId, {
          phase: 'complete',
          taskName: session.task,
          statusText: finalText.substring(0, 200),
          iteration: iterNum,
          cost: (session.agentState.totalCost || 0).toFixed(4)
        });
      }

      await persist(sessionId, session);
      await finalizeSession(sessionId, session, finalText.substring(0, 500), false);

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
      session._nextIterationTimer = setTimeout(() => runAgentIteration(sessionId, options), 100);
      return;
    }

    // l. Execute each tool call SEQUENTIALLY (browser actions must be serial)
    const toolResults = [];
    for (const call of toolCalls) {
      let result;

      // --- Local tool interception (Phase 138 on-demand context) ---
      if (call.name === 'get_page_snapshot') {
        // CTX-01: Fetch markdown snapshot from content script
        try {
          const mdResponse = await chrome.tabs.sendMessage(session.tabId, {
            action: 'getMarkdownSnapshot',
            options: { charBudget: 12000, maxElements: 80 }
          }, { frameId: 0 });
          if (mdResponse?.success && mdResponse.markdownSnapshot) {
            result = { success: true, hadEffect: false, error: null, navigationTriggered: false,
              result: { snapshot: mdResponse.markdownSnapshot, elementCount: mdResponse.elementCount || 0 } };
          } else {
            result = { success: false, hadEffect: false, error: mdResponse?.error || 'Snapshot unavailable', navigationTriggered: false, result: null };
          }
        } catch (err) {
          result = { success: false, hadEffect: false, error: `get_page_snapshot failed: ${err.message}`, navigationTriggered: false, result: null };
        }
      } else if (call.name === 'get_site_guide') {
        // CTX-02: Load site guide for domain
        const domain = call.args?.domain || '';
        try {
          const guide = (typeof getGuideForTask === 'function')
            ? getGuideForTask('', `https://${domain}`)
            : null;
          if (guide) {
            result = { success: true, hadEffect: false, error: null, navigationTriggered: false,
              result: { domain, site: guide.site || guide.name || domain, guidance: JSON.stringify(guide.selectors || guide) } };
          } else {
            result = { success: true, hadEffect: false, error: null, navigationTriggered: false,
              result: { domain, guidance: `No site guide available for ${domain}. Use get_page_snapshot and get_dom_snapshot to discover elements.` } };
          }
        } catch (err) {
          result = { success: true, hadEffect: false, error: null, navigationTriggered: false,
            result: { domain, guidance: `No site guide available for ${domain}.` } };
        }
      } else if (call.name === 'complete_task') {
        // Task lifecycle: complete
        const summary = call.args?.summary || 'Task completed';
        console.log('[AgentLoop] Task completed:', summary);
        session.status = 'completed';
        session.result = summary;
        if (typeof sendStatus === 'function') {
          sendStatus(session.tabId, {
            phase: 'complete',
            taskName: session.task,
            statusText: summary,
            iteration: iterNum,
            cost: (session.agentState.totalCost || 0).toFixed(4)
          });
        }
        await persist(sessionId, session);
        await finalizeSession(sessionId, session, summary, false);
        return; // End the loop -- task is done
      } else if (call.name === 'fail_task') {
        // Task lifecycle: failure
        const reason = call.args?.reason || 'Task failed';
        console.log('[AgentLoop] Task failed:', reason);
        session.status = 'error';
        session.error = reason;
        if (typeof sendStatus === 'function') {
          sendStatus(session.tabId, {
            phase: 'error',
            taskName: session.task,
            statusText: reason,
            iteration: iterNum,
            cost: (session.agentState.totalCost || 0).toFixed(4)
          });
        }
        await persist(sessionId, session);
        await finalizeSession(sessionId, session, reason, true);
        return; // End the loop -- task failed
      } else if (call.name === 'report_progress') {
        // PROG-02: Update progress overlay with AI reasoning and cost
        const msg = call.args?.message || '';
        if (typeof sendStatus === 'function') {
          sendStatus(session.tabId, {
            phase: 'progress',
            taskName: session.task,
            statusText: msg,
            iteration: iterNum,
            cost: (session.agentState.totalCost || 0).toFixed(4),
            aiReasoning: msg
          });
        }
        session.lastAiReasoning = msg;
        result = { success: true, hadEffect: false, error: null, navigationTriggered: false, result: { displayed: true } };
      } else {
        if (typeof sendStatus === 'function') {
          sendStatus(session.tabId, {
            phase: (call.name === 'open_tab' || call.name === 'switch_tab') ? 'switching_tab' : 'acting',
            taskName: session.task,
            statusText: describeToolCall(call.name, call.args),
            iteration: iterNum,
            cost: (session.agentState.totalCost || 0).toFixed(4),
            currentTool: call.name
          });
        }

        // Standard tool: dispatch through unified executor
        result = await _executeTool(call.name, call.args, session.tabId, {
          cdpHandler: executeCDPToolDirect
            ? (verb, params, tabId) => executeCDPToolDirect({ tool: verb, params }, tabId)
            : null,
          dataHandler: handleDataTool
        });
      }

      // Tab-switching tools: update session.tabId so subsequent tools target the new tab
      if ((call.name === 'open_tab' || call.name === 'switch_tab') && result.success && result.result?.tabId) {
        const newTabId = result.result.tabId;
        console.log('[AgentLoop] Tab changed', { from: session.tabId, to: newTabId, tool: call.name });
        session.tabId = newTabId;

        // Ensure content script is injected on the new tab
        try {
          await chrome.scripting.executeScript({
            target: { tabId: newTabId },
            files: ['content/messaging.js']
          });
        } catch (_e) {
          // Content script may already be injected or tab may be restricted
        }
      }

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
    }

    // m2. Update session progress fields for dashboard broadcast (PROG-03)
    session.currentTool = toolResults.length > 0 ? toolResults[toolResults.length - 1].name : null;
    if (!session.lastAiReasoning) session.lastAiReasoning = null; // Reset if not set by report_progress

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

    // n. Stuck detection -- inject recovery hint if AI is stuck (SAFE-03, D-03)
    const stuckCheck = detectStuck(session, toolResults);
    if (stuckCheck.isStuck && stuckCheck.hint) {
      // Inject recovery hint as an additional message after tool results
      session.messages.push({
        role: 'user',
        content: stuckCheck.hint
      });
    }

    // o2. Broadcast updated progress to dashboard (includes cost from session.totalCost)
    if (typeof broadcastDashboardProgress === 'function') {
      broadcastDashboardProgress(session);
    }

    // o. Persist session state after every iteration (per SAFE-04, D-09)
    await persist(sessionId, session);

    // p. Schedule next iteration via setTimeout (per D-08, P4)
    // 100ms delay: fast enough for responsive automation,
    // long enough to yield the event loop and reset Chrome's execution timer
    session._nextIterationTimer = setTimeout(() => runAgentIteration(sessionId, options), 100);

  } catch (error) {
    // Error handling for API call failures
    const errMsg = error.message || String(error);
    const errStatus = error.status;

    console.error('[AgentLoop] Iteration error', {
      sessionId, iteration: iterNum, error: errMsg, status: errStatus,
      responseText: error.responseText || 'no response body'
    });

    // Auth errors (401/403): terminal
    if (errStatus === 401 || errStatus === 403) {
      session.status = 'error';
      session.error = 'API key invalid or expired. Please check your API key in settings.';
      if (typeof sendStatus === 'function') {
        sendStatus(session.tabId, {
          phase: 'error',
          taskName: session.task,
          statusText: session.error,
          iteration: iterNum,
          cost: (session.agentState.totalCost || 0).toFixed(4)
        });
      }
      await persist(sessionId, session);
      await finalizeSession(sessionId, session, session.error, true);
      return;
    }

    // Bad request (400): terminal -- tool format or schema issue, don't retry
    if (errStatus === 400) {
      const errorDetail = (error.responseText || errMsg).substring(0, 300);
      session.status = 'error';
      session.error = `API rejected request (400): ${errorDetail}`;
      console.error('[AgentLoop] 400 Bad Request -- check tool definitions or request format:', errorDetail);
      if (typeof sendStatus === 'function') {
        sendStatus(session.tabId, {
          phase: 'error',
          taskName: session.task,
          statusText: `Request rejected by API: ${errorDetail.substring(0, 100)}`,
          iteration: iterNum,
          cost: (session.agentState.totalCost || 0).toFixed(4)
        });
      }
      await persist(sessionId, session);
      await finalizeSession(sessionId, session, session.error, true);
      return;
    }

    // Rate limit (429): wait 5s and retry once
    // (UniversalProvider handles retries internally, so this is a last-resort catch)
    if (errStatus === 429 || error.isRateLimited) {
      console.warn('[AgentLoop] Rate limited, waiting 5s before retry', { sessionId });
      session._nextIterationTimer = setTimeout(() => runAgentIteration(sessionId, options), 5000);
      return;
    }

    // Network error / timeout: retry once after 2s
    if (!session._lastRetryIteration || session._lastRetryIteration < iterNum) {
      session._lastRetryIteration = iterNum;
      // Decrement iteration count since this will be retried
      session.agentState.iterationCount--;
      console.warn('[AgentLoop] Network error, retrying in 2s', { sessionId, error: errMsg });
      session._nextIterationTimer = setTimeout(() => runAgentIteration(sessionId, options), 2000);
      return;
    }

    // Second failure on same iteration: terminal error
    session.status = 'error';
    session.error = `API call failed: ${errMsg}`;
    if (typeof sendStatus === 'function') {
      sendStatus(session.tabId, {
        phase: 'error',
        taskName: session.task,
        statusText: session.error,
        iteration: iterNum,
        cost: (session.agentState.totalCost || 0).toFixed(4)
      });
    }
    await persist(sessionId, session);
    await finalizeSession(sessionId, session, session.error, true);
  }
}


// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// CommonJS for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAgentLoop, runAgentIteration, buildSystemPrompt, callProviderWithTools, estimateCost, getPublicTools, checkSafetyBreakers, detectStuck };
}
