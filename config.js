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
        { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Fast and efficient' },
        { id: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast', description: 'Optimized for speed' }
      ],
      gemini: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest Gemini model' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Stable and reliable' }
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