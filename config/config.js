/**
 * Configuration management for FSB v0.9.8.1
 * This file handles loading configuration from environment variables and Chrome storage
 */

/**
 * Configuration manager class for FSB extension
 * @class
 */
class Config {
  /**
   * Creates an instance of Config with default settings
   */
  constructor() {
    // Default configuration - Multi-model support
    this.defaults = {
      // Model configuration
      modelProvider: 'xai', // 'xai' or 'gemini'
      modelName: 'grok-4-1-fast-reasoning', // Current selected model - fast and efficient for automation
      
      // API Keys
      apiKey: '', // xAI API key (for Grok models)
      geminiApiKey: '', // Google Gemini API key
      openrouterApiKey: '', // OpenRouter API key

      // Legacy support
      speedMode: 'normal', // Deprecated - use modelName instead

      // Automation settings
      maxIterations: 20,
      debugMode: false,

      // DOM Optimization settings
      domOptimization: true,
      maxDOMElements: 2000,
      elementCacheSize: 200,
      prioritizeViewport: true,
      animatedActionHighlights: true,
      showSidepanelProgress: false,

      // Credential Manager (Beta)
      enableLogin: false,

      // CAPTCHA Solver
      captchaSolverEnabled: false,
      captchaApiKey: '',

      // Speech-to-Text
      sttProvider: 'browser', // 'browser' (Web Speech API) or 'whisper' (OpenAI)

      // Background Agents Server
      serverUrl: 'https://full-selfbrowsing.com',
      serverHashKey: '',
      serverSyncEnabled: false
    };

    // PERF: In-memory config cache with TTL to avoid repeated chrome.storage reads
    this._cachedConfig = null;
    this._cacheTimestamp = 0;
    this._cacheTTL = 10000; // 10 seconds

    // Invalidate cache when storage changes externally
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          this._cachedConfig = null;
          this._cacheTimestamp = 0;
        }
      });
    }

    // Chrome extensions use storage API instead of environment variables
    
    // Available models configuration
    this.availableModels = {
      xai: [
        { id: 'grok-4-0709', name: 'Grok 4', description: 'Most capable reasoning model' },
        { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast', description: 'High-speed with reasoning (Recommended)' },
        { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast Non-Reasoning', description: 'Without reasoning for faster responses' },
        { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast', description: 'Fast with reasoning capabilities' },
        { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast Non-Reasoning', description: 'Fast without reasoning' },
        { id: 'grok-code-fast-1', name: 'Grok Code Fast 1', description: 'Dedicated code generation & debugging' },
        { id: 'grok-3', name: 'Grok 3', description: 'Legacy flagship model' },
        { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Budget option with reasoning' }
      ],
      gemini: [
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: 'Latest pro preview model' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most powerful with 2M context' },
        { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro Preview', description: 'Pro preview variant' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', description: 'Next-gen flash preview' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Latest with thinking capabilities' },
        { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash Preview', description: 'Flash preview variant' },
        { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview', description: 'Lightweight next-gen preview' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Budget option with 1M context' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and efficient' }
      ],
      openai: [
        { id: 'gpt-5.4', name: 'GPT-5.4', description: 'Latest flagship model' },
        { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', description: 'Pro tier of latest flagship' },
        { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Previous generation flagship' },
        { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', description: 'Pro tier previous generation' },
        { id: 'gpt-5.1', name: 'GPT-5.1', description: 'GPT-5 series model' },
        { id: 'gpt-5', name: 'GPT-5', description: 'GPT-5 base model' },
        { id: 'gpt-5-pro', name: 'GPT-5 Pro', description: 'GPT-5 pro tier' },
        { id: 'o3', name: 'o3', description: 'Advanced reasoning model' },
        { id: 'o3-pro', name: 'o3 Pro', description: 'Pro reasoning model' },
        { id: 'o1', name: 'o1', description: 'Reasoning model' },
        { id: 'o1-pro', name: 'o1 Pro', description: 'Pro reasoning model' },
        { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Balanced capability model' },
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal model' },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast and affordable GPT-5' },
        { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Ultra-fast GPT-5 variant' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast GPT-4.1 variant' },
        { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Ultra-fast GPT-4.1 variant' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Affordable and fast' },
        { id: 'o3-mini', name: 'o3 Mini', description: 'Fast reasoning model' },
        { id: 'o4-mini', name: 'o4 Mini', description: 'Latest mini reasoning model' },
        { id: 'o1-mini', name: 'o1 Mini', description: 'Budget reasoning model' }
      ],
      anthropic: [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most powerful reasoning model' },
        { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Previous Opus flagship' },
        { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: 'Opus 4.1 model' },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Opus 4 model' },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Latest balanced model' },
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Previous Sonnet flagship' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Sonnet 4 model' },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fast and cost-effective' },
        { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', description: 'Legacy fast model' }
      ],
      openrouter: [
        { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)', description: 'OpenAI GPT-4o routed through OpenRouter' },
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (via OpenRouter)', description: 'Anthropic Claude via OpenRouter' },
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (via OpenRouter)', description: 'Google Gemini via OpenRouter' },
        { id: 'x-ai/grok-4-1-fast', name: 'Grok 4.1 Fast (via OpenRouter)', description: 'xAI Grok via OpenRouter' },
        { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick (via OpenRouter)', description: 'Meta Llama 4 via OpenRouter' },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (via OpenRouter)', description: 'DeepSeek reasoning model via OpenRouter' }
      ]
    };
  }
  
  /**
   * Loads configuration from Chrome storage
   * @returns {Promise<Object>} Complete configuration object with defaults applied
   */
  async loadFromStorage() {
    // PERF: Return cached config if still fresh
    if (this._cachedConfig && (Date.now() - this._cacheTimestamp) < this._cacheTTL) {
      return { ...this._cachedConfig };
    }

    const config = { ...this.defaults };

    try {
      // Load settings from Chrome storage
      const stored = await chrome.storage.local.get(Object.keys(this.defaults));
      Object.assign(config, stored);

      // Validate and auto-correct model name if invalid
      const correctedModel = this.validateAndCorrectModel(config.modelName, config.modelProvider);
      if (correctedModel !== config.modelName) {
        console.warn(`[Config] Invalid model name "${config.modelName}" auto-corrected to "${correctedModel}"`);
        config.modelName = correctedModel;
        // Save the corrected value back to storage
        await chrome.storage.local.set({ modelName: correctedModel });
      }

    } catch (error) {
      console.error('Error loading config from Chrome storage:', error);
    }

    // Update cache
    this._cachedConfig = { ...config };
    this._cacheTimestamp = Date.now();

    return config;
  }

  /**
   * Validates model name and returns corrected version if invalid
   * @param {string} modelName - The model name to validate
   * @param {string} provider - The model provider (xai, gemini, openai, anthropic)
   * @returns {string} Valid model name (corrected if necessary)
   */
  validateAndCorrectModel(modelName, provider = 'xai') {
    // Get valid models for the provider
    const validModels = this.availableModels[provider] || [];
    const validModelIds = validModels.map(m => m.id);

    // Check if current model is valid
    if (validModelIds.includes(modelName)) {
      return modelName;
    }

    // Model is invalid - attempt to correct it
    console.warn(`[Config] Model "${modelName}" is not valid for provider "${provider}"`);

    // Common corrections for xAI models - map legacy/invalid models to valid ones
    const xaiCorrections = {
      'grok-3-fast': 'grok-4-1-fast-reasoning',
      'grok-3-fast-beta': 'grok-4-1-fast-reasoning',
      'grok-3-mini-fast-beta': 'grok-4-1-fast-reasoning',
      'grok-3-mini-beta': 'grok-3-mini',
      'grok-3-mini-fast': 'grok-4-1-fast-reasoning',
      'grok-4-fast': 'grok-4-1-fast-reasoning',
      'grok-4-1': 'grok-4-0709',
      'grok-4-1-fast': 'grok-4-1-fast-reasoning',
      'grok-4': 'grok-4-0709',
      'grok-beta': 'grok-3'
    };

    // Check if we have a known correction
    if (provider === 'xai' && xaiCorrections[modelName]) {
      return xaiCorrections[modelName];
    }

    // Default fallbacks per provider
    const defaultModels = {
      'xai': 'grok-4-1-fast-reasoning',
      'gemini': 'gemini-2.5-flash',
      'openai': 'gpt-4o',
      'anthropic': 'claude-sonnet-4-6',
      'openrouter': 'openai/gpt-4o'
    };

    return defaultModels[provider] || 'grok-4-1-fast-reasoning';
  }
  
  // Check if running in development mode
  isDevelopment() {
    return !('update_url' in chrome.runtime.getManifest());
  }
  
  // Get API key based on current provider
  async getApiKey(provider = null) {
    const config = await this.loadFromStorage();
    const currentProvider = provider || config.modelProvider;
    const keyMap = {
      xai: config.apiKey,
      gemini: config.geminiApiKey,
      openai: config.openaiApiKey,
      anthropic: config.anthropicApiKey,
      openrouter: config.openrouterApiKey,
      custom: config.customApiKey
    };
    return keyMap[currentProvider] || config.apiKey;
  }
  
  // Legacy method - returns xAI key for backward compatibility
  async getXAIApiKey() {
    const config = await this.loadFromStorage();
    return config.apiKey;
  }
  
  // Get CAPTCHA API key (2Captcha)
  async getCaptchaApiKey() {
    const config = await this.loadFromStorage();
    return config.captchaApiKey || null;
  }
  
  // Save configuration to storage
  async save(newConfig) {
    try {
      // Invalidate cache before saving to ensure next read gets fresh data
      this._cachedConfig = null;
      this._cacheTimestamp = 0;
      await chrome.storage.local.set(newConfig);
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }
  
  /**
   * Gets all configuration settings
   * @returns {Promise<Object>} Complete configuration object
   */
  async getAll() {
    return await this.loadFromStorage();
  }
  
  // Update specific configuration values
  async update(updates) {
    const current = await this.getAll();
    const updated = { ...current, ...updates };
    return await this.save(updated);
  }
}

// Export singleton instance
const config = new Config();

// For use in service workers
if (typeof self !== 'undefined') {
  self.config = config;
}

// For use in content scripts
if (typeof window !== 'undefined') {
  window.BrowserAgentConfig = config;
}