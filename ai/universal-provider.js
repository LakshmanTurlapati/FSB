/**
 * Universal AI Provider for FSB v0.9.31
 * A model-agnostic provider that works with any OpenAI-compatible API
 */

// Provider configurations for known services
const PROVIDER_CONFIGS = {
  xai: {
    endpoint: 'https://api.x.ai/v1/chat/completions',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    keyField: 'apiKey'
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    keyField: 'openaiApiKey'
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    authHeader: 'x-api-key',
    authPrefix: '',
    keyField: 'anthropicApiKey',
    customFormat: true // Uses different message format
  },
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    authQuery: 'key', // API key in query string
    keyField: 'geminiApiKey',
    customFormat: true // Uses different request format
  },
  custom: {
    // For custom OpenAI-compatible endpoints
    endpoint: '{customEndpoint}',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    keyField: 'customApiKey'
  },
  lmstudio: {
    // Local LM Studio server - no API key required
    endpoint: '{lmstudioBaseUrl}/v1/chat/completions',
    keyField: null,
    noAuth: true
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    keyField: 'openrouterApiKey'
  }
};

// Cache for successful parameter configurations per model
// PERF: Size-limited to prevent unbounded growth
const parameterCache = new Map();
const PARAM_CACHE_MAX = 50;

// Rate limit tracking per provider
// PERF: Entries expire after 10 minutes
const rateLimitState = new Map();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * PERF: Set a value in a size-limited Map, evicting oldest if over limit.
 */
function boundedMapSet(map, key, value, maxSize) {
  map.set(key, value);
  if (map.size > maxSize) {
    const firstKey = map.keys().next().value;
    map.delete(firstKey);
  }
}

// Default request timeout in milliseconds
// Increased from 20s: later iterations with longer history can take 15-25s
// Adaptive timeout scales with prompt size to handle multi-turn conversations
const DEFAULT_REQUEST_TIMEOUT = 30000;

// Maximum timeout cap - never wait longer than this
// Increased from 35s: API calls to large-context models can take 40-50s on first attempt
const MAX_REQUEST_TIMEOUT = 60000;

// Higher base timeout for reasoning models (internal chain-of-thought takes longer)
const REASONING_MODEL_TIMEOUT = 45000;

// Higher cap for reasoning models
const MAX_REASONING_TIMEOUT = 90000;

/**
 * Calculate adaptive timeout based on prompt/request size, model type, and retry attempt.
 * Base 30s + 5s per estimated 5K input tokens (45s base for reasoning models).
 * Progressive increase on retries: attempt 0 = base, attempt 1 = base * 1.5, attempt 2 = base * 2
 * @param {Object} requestBody - The request body to estimate size from
 * @param {string} modelName - The model name to check for reasoning model patterns
 * @param {number} attempt - Retry attempt number (0-based), increases timeout progressively
 * @returns {number} Timeout in milliseconds
 */
function calculateAdaptiveTimeout(requestBody, modelName = '', attempt = 0) {
  const isReasoning = /reasoning|grok-4(?!.*(?:fast|mini))/.test(modelName);
  const baseTimeout = isReasoning ? REASONING_MODEL_TIMEOUT : DEFAULT_REQUEST_TIMEOUT;
  const maxTimeout = isReasoning ? MAX_REASONING_TIMEOUT : MAX_REQUEST_TIMEOUT;

  // Progressive multiplier: 1x, 1.5x, 2x for attempts 0, 1, 2+
  const retryMultiplier = 1 + (Math.min(attempt, 2) * 0.5);

  try {
    // PERF: Estimate size from messages array length instead of serializing entire body
    let estimatedChars = 0;
    if (requestBody.messages && Array.isArray(requestBody.messages)) {
      for (const msg of requestBody.messages) {
        estimatedChars += (msg.content || '').length;
      }
    } else {
      // Fallback: rough estimate from stringify (only if no messages array)
      estimatedChars = JSON.stringify(requestBody).length;
    }
    const estimatedTokens = estimatedChars / 4;
    const extra = Math.floor(estimatedTokens / 5000) * 5000;
    return Math.min(Math.round((baseTimeout + extra) * retryMultiplier), maxTimeout);
  } catch {
    return Math.min(Math.round(baseTimeout * retryMultiplier), maxTimeout);
  }
}

// Maximum retry attempts for rate-limited requests
const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * Universal AI Provider that adapts to any model
 */
class UniversalProvider {
  constructor(settings) {
    this.settings = settings;
    this.model = settings.modelName;
    this.provider = settings.modelProvider || 'xai';
    this.config = PROVIDER_CONFIGS[this.provider] || PROVIDER_CONFIGS.custom;
    
    // Initialize parameter cache for this model if not exists
    const cacheKey = `${this.provider}:${this.model}`;
    if (!parameterCache.has(cacheKey)) {
      boundedMapSet(parameterCache, cacheKey, null, PARAM_CACHE_MAX);
    }
  }
  
  /**
   * Build request with automatic parameter discovery
   */
  async buildRequest(prompt, options = {}) {
    const cacheKey = `${this.provider}:${this.model}`;
    const cachedParams = parameterCache.get(cacheKey);

    // Start with minimal base request
    // Support pre-built messages array for multi-turn conversations
    // Falls back to systemPrompt/userPrompt for backward compatibility
    let request = {
      model: this.model,
      messages: prompt.messages || [
        {
          role: "system",
          content: prompt.systemPrompt
        },
        {
          role: "user",
          content: prompt.userPrompt
        }
      ],
      max_tokens: 2000
    };
    
    // If we have cached successful parameters, use them
    if (cachedParams) {
      request = { ...request, ...cachedParams };
      return this.formatForProvider(request);
    }
    
    // Otherwise, try with common parameters if not in retry mode
    if (!options.retry) {
      request = {
        ...request,
        temperature: 0.7,
        top_p: 0.9
        // Don't add frequency_penalty or presence_penalty by default
      };
      
    }
    
    return this.formatForProvider(request);
  }
  
  /**
   * Format request for specific providers
   */
  formatForProvider(request) {
    switch (this.provider) {
      case 'gemini':
        return this.formatGeminiRequest(request);
      case 'anthropic':
        return this.formatAnthropicRequest(request);
      default:
        return request; // OpenAI-compatible format
    }
  }
  
  /**
   * Convert to Gemini format
   * Handles both single-shot and multi-turn conversation formats
   */
  formatGeminiRequest(request) {
    // Check if this is a multi-turn conversation (more than 2 messages)
    const messages = request.messages;
    let contents;

    if (messages.length <= 2) {
      // Legacy single-shot format: combine system + user
      contents = [{
        role: "user",
        parts: [{
          text: messages[0].content + "\\n\\n" + messages[1].content
        }]
      }];
    } else {
      // Multi-turn format: convert to Gemini's expected format
      // Gemini uses "user" and "model" roles (not "assistant")
      contents = [];
      let systemPrompt = '';

      for (const msg of messages) {
        if (msg.role === 'system') {
          // Prepend system prompt to first user message
          systemPrompt = msg.content + "\\n\\n";
        } else if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: systemPrompt + msg.content }]
          });
          systemPrompt = ''; // Only prepend to first user message
        } else if (msg.role === 'assistant') {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
    }

    return {
      contents,
      generationConfig: {
        temperature: request.temperature || 0.7,
        topP: request.top_p || 0.9,
        maxOutputTokens: request.max_tokens || 2000
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };
  }

  /**
   * Convert to Anthropic format
   * Handles both single-shot and multi-turn conversation formats
   */
  formatAnthropicRequest(request) {
    const messages = request.messages;

    // Extract system prompt (first message with role 'system')
    const systemMsg = messages.find(m => m.role === 'system');
    const systemPrompt = systemMsg ? systemMsg.content : '';

    // Filter out system messages for the messages array
    const conversationMessages = messages.filter(m => m.role !== 'system');

    return {
      model: request.model,
      messages: conversationMessages,
      system: systemPrompt,
      max_tokens: request.max_tokens || 2000,
      temperature: request.temperature || 0.7
    };
  }
  
  /**
   * Get API endpoint
   */
  getEndpoint() {
    let endpoint = this.config.endpoint;

    // Replace placeholders
    endpoint = endpoint.replace('{model}', this.model);
    endpoint = endpoint.replace('{customEndpoint}', this.settings.customEndpoint || '');
    endpoint = endpoint.replace('{lmstudioBaseUrl}',
      normalizeProviderBaseUrl('lmstudio', this.settings.lmstudioBaseUrl));

    // Add API key to query string if needed
    if (this.config.authQuery) {
      const separator = endpoint.includes('?') ? '&' : '?';
      endpoint += `${separator}${this.config.authQuery}=${this.settings[this.config.keyField]}`;
    }

    return endpoint;
  }
  
  /**
   * Get request headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Skip auth for local providers (e.g. LM Studio)
    if (this.config.noAuth) {
      return headers;
    }

    // Add auth header if not using query string auth
    if (this.config.authHeader && !this.config.authQuery) {
      const apiKey = this.settings[this.config.keyField];
      const authValue = this.config.authPrefix
        ? `${this.config.authPrefix} ${apiKey}`
        : apiKey;
      headers[this.config.authHeader] = authValue;
    }

    return headers;
  }
  
  /**
   * Create a fetch request with timeout
   * @param {string} endpoint - The API endpoint
   * @param {Object} fetchOptions - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>}
   */
  async fetchWithTimeout(endpoint, fetchOptions, timeout = DEFAULT_REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`API request timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Handle rate-limited responses with exponential backoff
   * @param {Response} response - The HTTP response
   * @param {number} attemptNumber - Current attempt number
   * @returns {Promise<{shouldRetry: boolean, waitTime: number}>}
   */
  async handleRateLimit(response, attemptNumber = 1) {
    const providerKey = this.provider;

    // Get current rate limit state
    let state = rateLimitState.get(providerKey) || { backoff: 1000, lastError: 0 };

    // Parse Retry-After header if present
    const retryAfter = response.headers.get('Retry-After');
    let waitTime;

    if (retryAfter) {
      // Retry-After can be seconds (number) or HTTP date
      if (/^\d+$/.test(retryAfter)) {
        waitTime = parseInt(retryAfter) * 1000;
      } else {
        const retryDate = new Date(retryAfter);
        waitTime = Math.max(0, retryDate.getTime() - Date.now());
      }
    } else {
      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      waitTime = Math.min(state.backoff * Math.pow(2, attemptNumber - 1), 60000);
    }

    // Update rate limit state
    state.backoff = waitTime;
    state.lastError = Date.now();
    boundedMapSet(rateLimitState, providerKey, state, RATE_LIMIT_MAX);

    console.log(`[FSB API] Rate limited by ${this.provider}. Waiting ${waitTime}ms before retry (attempt ${attemptNumber}/${MAX_RATE_LIMIT_RETRIES})`);

    return {
      shouldRetry: attemptNumber < MAX_RATE_LIMIT_RETRIES,
      waitTime
    };
  }

  /**
   * Send request with automatic retry on parameter errors
   * Enhanced with timeout and rate-limit handling
   */
  async sendRequest(requestBody, options = {}) {
    // Use adaptive timeout based on request size and retry attempt if no explicit timeout provided
    const attempt = options.attempt || 0;
    const defaultTimeout = options.timeout || calculateAdaptiveTimeout(requestBody, this.model, attempt);
    const { retry = false, rateLimitAttempt = 0, timeout = defaultTimeout } = options;

    try {
      const response = await this.fetchWithTimeout(
        this.getEndpoint(),
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(requestBody)
        },
        timeout
      );

      // Handle rate limiting (429) and service unavailable (503)
      if (response.status === 429 || response.status === 503) {
        const { shouldRetry, waitTime } = await this.handleRateLimit(response, rateLimitAttempt + 1);

        if (shouldRetry) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return this.sendRequest(requestBody, {
            ...options,
            rateLimitAttempt: rateLimitAttempt + 1
          });
        } else {
          const errorText = await response.text().catch(() => 'Rate limit exceeded');
          const error = new Error(`${this.provider} API rate limit exceeded after ${MAX_RATE_LIMIT_RETRIES} retries: ${errorText}`);
          error.isRateLimited = true;
          throw error;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`${this.provider} API error: ${response.status} - ${errorText}`);
        error.status = response.status;
        error.responseText = errorText;
        throw error;
      }

      const result = await response.json();

      // Reset rate limit backoff on success
      rateLimitState.delete(this.provider);

      // Cache successful parameters
      if (!retry && requestBody.temperature !== undefined) {
        const cacheKey = `${this.provider}:${this.model}`;
        const paramsToCache = {
          temperature: requestBody.temperature,
          top_p: requestBody.top_p
        };
        boundedMapSet(parameterCache, cacheKey, paramsToCache, PARAM_CACHE_MAX);
      }

      return result;

    } catch (error) {
      // Check if error is due to unsupported parameters
      if (error.status === 400 && error.responseText) {
        const unsupportedParam = this.extractUnsupportedParameter(error.responseText);
        if (unsupportedParam && !retry) {
          console.log(`Parameter '${unsupportedParam}' not supported, retrying without it`);

          // Rebuild request without the problematic parameter
          const cleanedRequest = this.removeParameter(requestBody, unsupportedParam);

          // Retry with cleaned request
          return this.sendRequest(cleanedRequest, { ...options, retry: true });
        }
      }

      throw error;
    }
  }
  
  /**
   * Extract unsupported parameter from error message
   */
  extractUnsupportedParameter(errorText) {
    // Common patterns for parameter errors
    const patterns = [
      /not supported.*?:\s*(\w+)/i,
      /invalid.*?argument.*?:\s*(\w+)/i,
      /unknown.*?parameter.*?:\s*(\w+)/i,
      /(\w+).*?not.*?supported/i,
      /argument.*?(\w+).*?invalid/i
    ];
    
    for (const pattern of patterns) {
      const match = errorText.match(pattern);
      if (match) {
        // Convert camelCase to snake_case if needed
        const param = match[1];
        const snakeCase = param.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        return snakeCase;
      }
    }
    
    return null;
  }
  
  /**
   * Remove parameter from request
   */
  removeParameter(request, param) {
    const cleaned = { ...request };
    
    // Remove both snake_case and camelCase versions
    delete cleaned[param];
    delete cleaned[param.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())];
    
    // For Gemini format
    if (cleaned.generationConfig) {
      delete cleaned.generationConfig[param];
      const camelCase = param.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      delete cleaned.generationConfig[camelCase];
    }
    
    return cleaned;
  }
  
  /**
   * Parse response from any provider
   */
  parseResponse(response) {
    let content, usage;
    
    switch (this.provider) {
      case 'gemini':
        if (!response.candidates || response.candidates.length === 0) {
          throw new Error('No response from Gemini API');
        }
        content = response.candidates[0].content.parts[0].text;
        
        // Debug: Log raw Gemini response before cleaning (only in debug mode)
        
        usage = {
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0
        };
        break;
        
      case 'anthropic':
        content = response.content[0].text;
        usage = {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        };
        break;
        
      default:
        // OpenAI-compatible format (including xAI)
        if (!response.choices || response.choices.length === 0) {
          throw new Error(`No response from ${this.provider} API`);
        }
        content = response.choices[0].message.content;
        
        // Debug: raw xAI response logging removed for performance
        
        // Handle xAI's separate reasoning token counting
        if (this.provider === 'xai' && response.usage?.completion_tokens_details?.reasoning_tokens) {
          const reasoningTokens = response.usage.completion_tokens_details.reasoning_tokens;
          const completionTokens = response.usage.completion_tokens || 0;
          
          usage = {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: completionTokens,
            reasoningTokens: reasoningTokens,
            totalTokens: (response.usage?.prompt_tokens || 0) + completionTokens + reasoningTokens
          };
        } else {
          usage = {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0
          };
        }
    }
    
    // Clean the response
    const originalContent = content;
    content = this.cleanResponse(content);
    
    // Debug: xAI cleaning effect logging removed for performance
    
    // Parse the cleaned content -- may be JSON or CLI format
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      // Not valid JSON -- return raw text for CLI parser downstream
      // FSB uses CLI format (not JSON) as the primary AI response format since v10.0
      return {
        content: content,
        usage,
        model: response.model || this.model
      };
    }

    return {
      content: parsedContent,
      usage,
      model: response.model || this.model
    };
  }
  
  /**
   * Provider-aware response cleaner
   */
  cleanResponse(content) {
    // Use the universal JSON parser instead of provider-specific methods
    return this.parseJSONSafely(content);
  }
  
  /**
   * Enhanced universal JSON parser that handles various malformations
   */
  parseJSONSafely(content) {
    const parseStartTime = Date.now();

    // Stage 0: Quick validation for empty/null content
    if (!content || content.trim().length === 0) {
      console.warn('parseJSONSafely: Empty content provided');
      return '{ "success": false, "error": "Empty response", "actions": [], "taskComplete": false }';
    }

    // Stage 1: Try raw parsing first - EXIT IMMEDIATELY if already valid
    // This is the fast path for well-formed responses
    try {
      JSON.parse(content);
      return content; // Already valid - no cleaning needed
    } catch (e) {
      // Continue with cleaning only if raw parse fails
    }
    
    let cleaned = content;
    
    // Stage 2: Remove common wrappers
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```(?:json|JSON|Json)?\s*\n?/g, '');
    cleaned = cleaned.replace(/```\s*$/g, '');
    
    // Remove conversational prefixes only (not suffixes that might truncate JSON)
    cleaned = cleaned.replace(/^[^{]*?(?=\{)/, ''); // Everything before first {
    
    // Stage 3: Check for and fix truncation
    cleaned = this.fixTruncatedJSON(cleaned);
    
    // Stage 3.5: Fix common malformations before tokenization
    cleaned = this.fixCommonMalformations(cleaned);
    
    // Stage 4: Tokenize and fix structure
    cleaned = this.fixJSONStructure(cleaned);
    
    // Stage 5: Validate and return
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch (e) {
      console.error('parseJSONSafely failed after all attempts:', e.message);
      console.error('Failed JSON (first 200 chars):', cleaned.substring(0, 200));
      
      // Stage 6: Try fallback extraction
      const fallback = this.extractJSONFallback(content);
      if (fallback) {
        try {
          JSON.parse(fallback);
          return fallback;
        } catch (fe) {
          // Fallback extraction also failed
        }
      }
      
      // Last resort: return the original content as-is (may be CLI format, not JSON)
      // The downstream CLI parser (parseCliResponse) handles non-JSON responses.
      console.warn('All JSON parsing attempts failed, returning original content for CLI parser');
      return content;
    }
  }
  
  /**
   * Fix common malformations in JSON
   */
  fixCommonMalformations(input) {
    let fixed = input;
    
    // PERF: Debug logging removed from hot parsing path
    
    // Fix unquoted string values with special characters or units
    // This regex looks for patterns like: "key": 29%, "key": 8 mph, etc.
    fixed = fixed.replace(/("[^"]+"\s*:\s*)(\d+[^,\d\s}\]]+[^,}\]]*)/g, '$1"$2"');
    
    // Fix unquoted non-numeric values, but EXCLUDE boolean and null values
    // Use negative lookahead to exclude true, false, null
    fixed = fixed.replace(/("[^"]+"\s*:\s*)(?!(true|false|null)([,}\]\s]))([^"\[\{\-\d\s][^,}\]]*?)([,}\]])/g, '$1"$4"$5');
    
    // PERF: Post-fix logging removed from hot parsing path
    
    return fixed;
  }
  
  /**
   * Fix truncated JSON by adding missing closing characters
   */
  fixTruncatedJSON(input) {
    if (!input.trim()) return input;
    
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let lastStringStart = -1;
    let bracketStack = []; // Track opening brackets/braces
    
    // Analyze the JSON structure
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if (!escapeNext) {
        if (char === '"' && !inString) {
          inString = true;
          lastStringStart = i;
        } else if (char === '"' && inString) {
          inString = false;
          lastStringStart = -1;
        } else if (char === '\\' && inString) {
          escapeNext = true;
        } else if (!inString) {
          if (char === '{') {
            bracketStack.push('}');
            depth++;
          } else if (char === '[') {
            bracketStack.push(']');
            depth++;
          } else if (char === '}' || char === ']') {
            if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === char) {
              bracketStack.pop();
              depth--;
            }
          }
        }
      } else {
        escapeNext = false;
      }
    }
    
    let fixed = input;
    
    // If we're in the middle of a string, close it
    if (inString) {
      // Check if the truncation happened in the middle of a value
      // Look for common patterns like: "result": "The weather is 102°F with
      const lastPortion = input.substring(Math.max(0, lastStringStart));
      if (!lastPortion.includes('"')) {
        // String was cut off, close it
        fixed += '"';
      }
    }
    
    // Add missing closing brackets/braces intelligently
    // If we're in an actions array, ensure it's properly closed
    if (fixed.includes('"actions"') && !fixed.includes('"taskComplete"')) {
      // We're truncated in the middle of the response
      // Ensure actions array is closed
      const hasOpenActionArray = fixed.includes('"actions": [') && 
                                  !fixed.substring(fixed.lastIndexOf('"actions": [')).includes(']');
      
      if (hasOpenActionArray) {
        // Check if we need to close an action object first
        const lastActionStart = fixed.lastIndexOf('{"tool":');
        if (lastActionStart > fixed.lastIndexOf('}')) {
          // Incomplete action object
          if (!fixed.includes('"params"', lastActionStart)) {
            fixed += ', "params": {}';
          }
          if (!fixed.includes('"description"', lastActionStart)) {
            fixed += ', "description": "Truncated action"';
          }
          fixed += '}'; // Close action object
        }
        fixed += ']'; // Close actions array
      }
      
      // Add missing required fields
      if (!fixed.includes('"taskComplete"')) {
        fixed += ', "taskComplete": false';
      }
      if (!fixed.includes('"result"')) {
        fixed += ', "result": "Response truncated - retrying"';
      }
    }
    
    // Now add remaining closing brackets/braces
    while (bracketStack.length > 0) {
      const closingChar = bracketStack.pop();
      fixed += closingChar;
    }
    
    // PERF: Truncation fix logging removed from hot parsing path
    return fixed;
  }
  
  /**
   * Fix JSON structure using tokenization
   */
  fixJSONStructure(input) {
    // This is a simplified tokenizer that identifies JSON elements
    let result = '';
    let inString = false;
    let escapeNext = false;
    let lastNonWhitespace = '';
    let depth = 0;
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const nextChar = input[i + 1] || '';
      
      // Handle string literals carefully
      if (!escapeNext) {
        if (char === '"' && !inString) {
          inString = true;
          result += char;
        } else if (char === '"' && inString) {
          inString = false;
          result += char;
        } else if (char === '\\' && inString) {
          escapeNext = true;
          result += char;
        } else if (inString) {
          // Inside string - preserve everything
          result += char;
        } else {
          // Outside string - apply fixes
          if (char === '{' || char === '[') {
            depth++;
            result += char;
            lastNonWhitespace = char;
          } else if (char === '}' || char === ']') {
            // Remove trailing commas before closing braces/brackets
            if (lastNonWhitespace === ',') {
              result = result.slice(0, -1);
            }
            depth--;
            result += char;
            lastNonWhitespace = char;
          } else if (char === ':') {
            result += char;
            lastNonWhitespace = char;
          } else if (char === ',') {
            // Don't add comma if next non-whitespace is closing brace/bracket
            let j = i + 1;
            while (j < input.length && /\s/.test(input[j])) j++;
            if (input[j] === '}' || input[j] === ']') {
              // Skip this comma
            } else {
              result += char;
              lastNonWhitespace = char;
            }
          } else if (char === "'") {
            // Replace single quotes with double quotes (outside strings)
            result += '"';
          } else if (/\s/.test(char)) {
            result += char;
            // Don't update lastNonWhitespace for whitespace
          } else {
            result += char;
            if (!/\s/.test(char)) {
              lastNonWhitespace = char;
            }
          }
        }
      } else {
        // After escape character
        escapeNext = false;
        result += char;
      }
    }
    
    // Final fixes
    // Ensure property names are quoted
    result = this.ensureQuotedPropertyNames(result);
    
    // Fix missing commas between properties
    result = this.fixMissingCommas(result);
    
    return result;
  }
  
  /**
   * Ensure all property names are quoted
   */
  ensureQuotedPropertyNames(input) {
    // This regex matches unquoted property names outside of strings
    // It's conservative to avoid breaking valid JSON
    return input.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
  }
  
  /**
   * Fix missing commas between properties and array elements
   */
  fixMissingCommas(input) {
    // Fix missing commas between properties: "}" followed by """
    input = input.replace(/}\s*"/g, '},"');
    
    // Fix missing commas between array elements: "}" followed by "{"
    input = input.replace(/}\s*{/g, '},{');
    
    // Fix missing commas between string values: """ followed by """
    // But be careful not to break escaped quotes
    input = input.replace(/(?<!\\)"\s+(?<!\\)"/g, '","');
    
    // Fix missing commas between ] and [
    input = input.replace(/]\s*\[/g, '],[');
    
    return input;
  }
  
  /**
   * Extract JSON using fallback strategies
   */
  extractJSONFallback(content) {
    // Try to extract a valid JSON object even from severely malformed content
    const patterns = [
      // Look for JSON-like structure
      /\{[^{}]*"reasoning"[^{}]*"actions"[^{}]*\}/s,
      // Look for any object with reasoning
      /\{[^{}]*"reasoning"[^{}]*\}/s,
      // Any JSON object
      /\{[\s\S]*\}/
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        let extracted = match[0];
        
        // Try to fix common issues in the extracted content
        // Fix truncated strings by closing them
        let quoteCount = (extracted.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          // Odd number of quotes, add a closing quote
          extracted += '"';
        }
        
        // Ensure the object is closed
        const openBraces = (extracted.match(/\{/g) || []).length;
        const closeBraces = (extracted.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          extracted += '}'.repeat(openBraces - closeBraces);
        }
        
        // Try to parse the fixed version
        try {
          JSON.parse(extracted);
          return extracted;
        } catch (e) {
          // Continue to next pattern
        }
      }
    }
    
    // If all else fails, create a minimal valid response
    console.warn('[FSB] Creating minimal fallback response');
    return JSON.stringify({
      reasoning: "Failed to parse AI response",
      actions: [],
      taskComplete: false,
      error: "Response parsing failed"
    });
  }
  
  
  /**
   * Test connection
   */
  async testConnection() {
    const testPrompt = {
      systemPrompt: "You are a helpful assistant. Respond with only valid JSON.",
      userPrompt: "Test connection. Respond with exactly: {\"status\": \"ok\"}"
    };

    const startTime = Date.now();

    try {
      const request = await this.buildRequest(testPrompt);
      const response = await this.sendRequest(request);
      const parsed = this.parseResponse(response);
      const responseTime = Date.now() - startTime;

      return {
        ok: true,
        success: true,  // Keep for backward compatibility
        message: parsed.content,
        model: parsed.model || this.model,
        responseTime,
        data: parsed.content
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        ok: false,
        success: false,  // Keep for backward compatibility
        error: error.message,
        message: error.message,
        model: this.model,
        responseTime
      };
    }
  }
}

/**
 * Normalize a provider base URL by stripping path suffixes and ensuring http:// prefix.
 * @param {string} provider - Provider key (e.g. 'lmstudio')
 * @param {string} baseUrl - Raw base URL from settings
 * @returns {string} Normalized base URL
 */
function normalizeProviderBaseUrl(provider, baseUrl) {
  const defaultUrl = provider === 'lmstudio' ? 'http://localhost:1234' : '';
  if (!baseUrl) return defaultUrl;

  let url = baseUrl.trim();
  // Strip known path suffixes
  url = url.replace(/\/v1\/chat\/completions\/?$/, '');
  url = url.replace(/\/v1\/?$/, '');
  // Remove trailing slashes
  url = url.replace(/\/+$/, '');
  // Prepend http:// if no protocol
  if (!/^https?:\/\//i.test(url)) {
    url = 'http://' + url;
  }
  return url;
}

/**
 * Build the /v1/models discovery endpoint for a provider.
 * @param {string} provider - Provider key
 * @param {string} baseUrl - Raw base URL from settings
 * @returns {string} Full models endpoint URL
 */
function buildProviderModelsEndpoint(provider, baseUrl) {
  return normalizeProviderBaseUrl(provider, baseUrl) + '/v1/models';
}

/**
 * Parse an OpenAI-compatible model list response into unique model IDs.
 * @param {Object} response - Response object with data array of {id: string}
 * @returns {string[]} Deduplicated array of model IDs
 */
function parseOpenAICompatibleModelList(response) {
  if (!response || !Array.isArray(response.data)) return [];
  const seen = new Set();
  const ids = [];
  for (const entry of response.data) {
    if (entry && entry.id && !seen.has(entry.id)) {
      seen.add(entry.id);
      ids.push(entry.id);
    }
  }
  return ids;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UniversalProvider,
    PROVIDER_CONFIGS,
    normalizeProviderBaseUrl,
    buildProviderModelsEndpoint,
    parseOpenAICompatibleModelList
  };
}