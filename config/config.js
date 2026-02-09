/**
 * Configuration management for FSB v0.9
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
      modelName: 'grok-4-1-fast', // Current selected model - fast and efficient for automation
      
      // API Keys
      apiKey: '', // xAI API key (for Grok models)
      geminiApiKey: '', // Google Gemini API key
      
      // Legacy support
      speedMode: 'normal', // Deprecated - use modelName instead

      // Automation settings
      maxIterations: 20,
      debugMode: false,

      // DOM Optimization settings
      domOptimization: true,
      maxDOMElements: 2000,
      prioritizeViewport: true,
      animatedActionHighlights: true,

      // Credential Manager (Beta)
      enableLogin: false,

      // CAPTCHA Solver
      captchaSolverEnabled: false,
      captchaApiKey: ''
    };
    
    // Chrome extensions use storage API instead of environment variables
    
    // Available models configuration
    this.availableModels = {
      xai: [
        { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', description: 'High-speed with reasoning, 2M context (Recommended)' },
        { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast Non-Reasoning', description: 'Without reasoning for faster responses' },
        { id: 'grok-4', name: 'Grok 4', description: 'Complex reasoning model' },
        { id: 'grok-code-fast-1', name: 'Grok Code Fast 1', description: 'Dedicated code generation & debugging' },
        { id: 'grok-3', name: 'Grok 3', description: 'Legacy flagship model' },
        { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Budget option with reasoning' }
      ],
      gemini: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Latest with thinking capabilities' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Budget option with 1M context' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most powerful with 2M context' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental', description: 'FREE experimental until May 2025' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and efficient' }
      ],
      openai: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal model' },
        { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest', description: 'Always newest GPT-4o version' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Affordable and fast, better than GPT-3.5' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship' }
      ],
      anthropic: [
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Latest flagship model with 200K context' },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fast and cost-effective with 200K context' },
        { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', description: 'Most powerful reasoning model' },
        { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Previous Sonnet version' },
        { id: 'claude-opus-4', name: 'Claude Opus 4', description: 'Previous Opus version' },
        { id: 'claude-sonnet-3.7', name: 'Claude Sonnet 3.7', description: 'Extended thinking variant' }
      ]
    };
  }
  
  /**
   * Loads configuration from Chrome storage
   * @returns {Promise<Object>} Complete configuration object with defaults applied
   */
  async loadFromStorage() {
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
      'grok-3-fast': 'grok-4-1-fast',
      'grok-3-fast-beta': 'grok-4-1-fast',
      'grok-3-mini-fast-beta': 'grok-4-1-fast',
      'grok-3-mini-beta': 'grok-3-mini',
      'grok-3-mini-fast': 'grok-4-1-fast',
      'grok-4-fast': 'grok-4-1-fast',
      'grok-4-1': 'grok-4',  // grok-4-1 doesn't exist, map to grok-4
      'grok-beta': 'grok-3'
    };

    // Check if we have a known correction
    if (provider === 'xai' && xaiCorrections[modelName]) {
      return xaiCorrections[modelName];
    }

    // Default fallbacks per provider
    const defaultModels = {
      'xai': 'grok-4-1-fast',
      'gemini': 'gemini-2.5-flash',
      'openai': 'gpt-4o',
      'anthropic': 'claude-sonnet-4-5'
    };

    return defaultModels[provider] || 'grok-4-1-fast';
  }
  
  // Check if running in development mode
  isDevelopment() {
    return !('update_url' in chrome.runtime.getManifest());
  }
  
  // Get API key based on current provider
  async getApiKey(provider = null) {
    const config = await this.loadFromStorage();
    const currentProvider = provider || config.modelProvider;
    
    switch (currentProvider) {
      case 'gemini':
        return config.geminiApiKey;
      case 'xai':
      default:
        return config.apiKey; // xAI API key
    }
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