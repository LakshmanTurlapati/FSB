/**
 * Universal AI Provider for FSB v0.1
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
  }
};

// Cache for successful parameter configurations per model
const parameterCache = new Map();

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
      parameterCache.set(cacheKey, null);
    }
  }
  
  /**
   * Build request with automatic parameter discovery
   */
  async buildRequest(prompt, options = {}) {
    const cacheKey = `${this.provider}:${this.model}`;
    const cachedParams = parameterCache.get(cacheKey);
    
    // Start with minimal base request
    let request = {
      model: this.model,
      messages: [
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
      
      // Add reasoning_effort for xAI Grok models that support it
      if (this.provider === 'xai' && this.supportsReasoningEffort()) {
        request.reasoning_effort = this.settings.reasoningEffort || 'low';
      }
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
   */
  formatGeminiRequest(request) {
    return {
      contents: [{
        role: "user",
        parts: [{ 
          text: request.messages[0].content + "\\n\\n" + request.messages[1].content 
        }]
      }],
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
   */
  formatAnthropicRequest(request) {
    return {
      model: request.model,
      messages: request.messages.slice(1), // Anthropic doesn't use system role in messages
      system: request.messages[0].content, // System prompt as separate field
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
   * Send request with automatic retry on parameter errors
   */
  async sendRequest(requestBody, options = {}) {
    try {
      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`${this.provider} API error: ${response.status} - ${errorText}`);
        error.status = response.status;
        error.responseText = errorText;
        throw error;
      }
      
      const result = await response.json();
      
      // Cache successful parameters
      if (!options.retry && requestBody.temperature !== undefined) {
        const cacheKey = `${this.provider}:${this.model}`;
        const paramsToCache = {
          temperature: requestBody.temperature,
          top_p: requestBody.top_p
        };
        parameterCache.set(cacheKey, paramsToCache);
      }
      
      return result;
      
    } catch (error) {
      // Check if error is due to unsupported parameters
      if (error.status === 400 && error.responseText) {
        const unsupportedParam = this.extractUnsupportedParameter(error.responseText);
        if (unsupportedParam && !options.retry) {
          console.log(`Parameter '${unsupportedParam}' not supported, retrying without it`);
          
          // Rebuild request without the problematic parameter
          const cleanedRequest = this.removeParameter(requestBody, unsupportedParam);
          
          // Retry with cleaned request
          return this.sendRequest(cleanedRequest, { retry: true });
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
        
        // Debug: Log raw Gemini response before cleaning
        console.log('Raw Gemini response content (first 500 chars):', content.substring(0, 500));
        
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
        
        // Debug: Log raw xAI response before cleaning
        if (this.provider === 'xai') {
          console.log('Raw xAI response content (first 500 chars):', content.substring(0, 500));
        }
        
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
    
    // Debug: Show cleaning effect for xAI
    if (this.provider === 'xai' && originalContent !== content) {
      console.log('xAI content was modified during cleaning');
      console.log('After cleaning (first 500 chars):', content.substring(0, 500));
    }
    
    // Parse the cleaned JSON content
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to parse cleaned ${this.provider} response:`, error.message);
      console.error('Cleaned content:', content.substring(0, 500));
      throw new Error(`Invalid JSON from ${this.provider} after cleaning: ${error.message}`);
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
   * Universal JSON parser that handles various malformations
   */
  parseJSONSafely(content) {
    // Debug log
    console.log('parseJSONSafely input (first 300 chars):', content.substring(0, 300));
    
    // Stage 1: Try raw parsing first
    try {
      JSON.parse(content);
      return content; // Already valid
    } catch (e) {
      // Continue with cleaning
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
      console.log('parseJSONSafely success');
      return cleaned;
    } catch (e) {
      console.error('parseJSONSafely failed after all attempts:', e.message);
      console.error('Failed JSON (first 200 chars):', cleaned.substring(0, 200));
      
      // Stage 6: Try fallback extraction
      const fallback = this.extractJSONFallback(content);
      if (fallback) {
        try {
          JSON.parse(fallback);
          console.log('Fallback extraction succeeded');
          return fallback;
        } catch (fe) {
          console.log('Fallback extraction also failed:', fe.message);
        }
      }
      
      // Last resort: return a minimal valid JSON if everything fails
      console.warn('All JSON parsing attempts failed, returning minimal fallback');
      return '{ "success": false, "error": "JSON parsing failed", "actions": [], "taskComplete": false }';
    }
  }
  
  /**
   * Fix common malformations in JSON
   */
  fixCommonMalformations(input) {
    let fixed = input;
    
    // Debug log
    console.log('fixCommonMalformations input sample:', fixed.substring(200, 400));
    
    // Fix unquoted string values with special characters or units
    // This regex looks for patterns like: "key": 29%, "key": 8 mph, etc.
    fixed = fixed.replace(/("[^"]+"\s*:\s*)(\d+[^,\d\s}\]]+[^,}\]]*)/g, '$1"$2"');
    
    // Fix unquoted non-numeric values, but EXCLUDE boolean and null values
    // Use negative lookahead to exclude true, false, null
    fixed = fixed.replace(/("[^"]+"\s*:\s*)(?!(true|false|null)([,}\]\s]))([^"\[\{\-\d\s][^,}\]]*?)([,}\]])/g, '$1"$4"$5');
    
    console.log('After malformation fixes:', fixed.substring(200, 400));
    
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
    
    // Add missing closing brackets/braces
    while (bracketStack.length > 0) {
      const closingChar = bracketStack.pop();
      fixed += closingChar;
    }
    
    console.log(`Fixed truncation: added ${depth} closing chars, inString: ${inString}`);
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
    console.log('Creating minimal fallback response');
    return JSON.stringify({
      reasoning: "Failed to parse AI response",
      actions: [],
      taskComplete: false,
      error: "Response parsing failed"
    });
  }
  
  /**
   * Check if current model supports reasoning_effort parameter
   */
  supportsReasoningEffort() {
    if (this.provider !== 'xai') return false;
    
    // Grok models that support reasoning_effort
    const supportedModels = [
      'grok-3-mini',
      'grok-3-mini-beta', 
      'grok-3-mini-fast-beta'
    ];
    
    return supportedModels.some(model => this.model.includes(model));
  }
  
  /**
   * Test connection
   */
  async testConnection() {
    const testPrompt = {
      systemPrompt: "You are a helpful assistant.",
      userPrompt: "Test connection. Respond with 'Connected successfully!'"
    };
    
    try {
      const request = await this.buildRequest(testPrompt);
      const response = await this.sendRequest(request);
      const parsed = this.parseResponse(response);
      
      return {
        success: true,
        message: parsed.content,
        model: parsed.model
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UniversalProvider, PROVIDER_CONFIGS };
}