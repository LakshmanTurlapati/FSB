/**
 * Configuration management for FSB v0.1
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
      modelName: 'grok-3-mini', // Current selected model
      
      // API Keys
      apiKey: '', // xAI API key (for Grok models)
      geminiApiKey: '', // Google Gemini API key
      
      // Legacy support
      speedMode: 'normal', // Deprecated - use modelName instead
      
      // CAPTCHA configuration
      captchaSolver: 'none',
      captchaApiKey: '',
      
      // Automation settings
      actionDelay: 1000,
      maxIterations: 20,
      confirmSensitive: true,
      debugMode: false
    };
    
    // Chrome extensions use storage API instead of environment variables
    
    // Available models configuration
    this.availableModels = {
      xai: [
        { id: 'grok-4', name: 'Grok 4', description: 'Most intelligent xAI model with 2M context' },
        { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast (Reasoning)', description: 'Fast with thinking tokens for better reasoning' },
        { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast (Non-Reasoning)', description: 'Fastest without thinking tokens' },
        { id: 'grok-code-fast-1', name: 'Grok Code Fast 1', description: 'Optimized for agentic coding workflows' },
        { id: 'grok-3', name: 'Grok 3', description: 'Previous generation model' },
        { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Fast and efficient budget option' },
        { id: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast', description: 'Optimized for speed' }
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
      
    } catch (error) {
      console.error('Error loading config from Chrome storage:', error);
    }
    
    return config;
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
  
  // Get CAPTCHA API key based on solver
  async getCaptchaApiKey(solver) {
    const config = await this.loadFromStorage();
    
    switch (solver) {
      case 'capsolver':
        return config.capsolverApiKey || config.captchaApiKey;
      case '2captcha':
        return config.twocaptchaApiKey || config.captchaApiKey;
      default:
        return config.captchaApiKey;
    }
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