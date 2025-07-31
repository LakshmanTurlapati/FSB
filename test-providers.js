// Test script for both AI providers
// Run this in a Chrome extension context with access to config.js

async function testProviders() {
  console.log('Testing AI Providers...\n');
  
  // Load configuration from Chrome storage like other extension files
  let settings;
  try {
    if (typeof config !== 'undefined') {
      // Use config.js if available (extension context)
      settings = await config.getAll();
      console.log('Loaded settings from config.js:', settings);
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      // Direct Chrome storage access if config.js not available
      settings = await chrome.storage.local.get();
      console.log('Loaded settings directly from Chrome storage:', Object.keys(settings));
    } else {
      throw new Error('No configuration system available');
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    console.log('Please run this in a Chrome extension context with proper permissions');
    return;
  }
  
  // Test configuration for Gemini using loaded settings
  const geminiConfig = {
    modelProvider: 'gemini', 
    modelName: settings.modelName || 'gemini-2.0-flash',
    geminiApiKey: settings.geminiApiKey || ''
  };
  
  // Test configuration for xAI using loaded settings
  const xaiConfig = {
    modelProvider: 'xai',
    modelName: settings.modelName || 'grok-3-mini',
    apiKey: settings.apiKey || ''
  };
  
  console.log('=== Testing Gemini Provider ===');
  if (!geminiConfig.geminiApiKey) {
    console.log('⚠️ No Gemini API key found in settings. Please configure it in the extension options.');
  } else {
    try {
      const geminiProvider = new GeminiProvider(geminiConfig);
      const result = await geminiProvider.testConnection();
      console.log('✅ Gemini test result:', result);
    } catch (error) {
      console.error('❌ Gemini test failed:', error);
    }
  }
  
  console.log('\n=== Testing xAI Provider ===');
  if (!xaiConfig.apiKey) {
    console.log('⚠️ No xAI API key found in settings. Please configure it in the extension options.');
  } else {
    try {
      const xaiProvider = new XAIProvider(xaiConfig);
      const result = await xaiProvider.testConnection();
      console.log('✅ xAI test result:', result);
    } catch (error) {
      console.error('❌ xAI test failed:', error);
    }
  }
}

// Run the test
if (typeof window !== 'undefined') {
  // Browser environment
  console.log('Run testProviders() in the console to test');
} else {
  // Node.js environment  
  testProviders();
}