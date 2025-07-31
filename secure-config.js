// Secure configuration management for Chrome Extension
// This file handles encrypted API keys and sensitive data

class SecureConfig {
  constructor() {
    // Configuration keys that should be encrypted
    this.sensitiveKeys = [
      'apiKey',
      'openaiApiKey',
      'captchaApiKey',
      'capsolverApiKey',
      'twocaptchaApiKey'
    ];
    
    // Runtime decrypted values (never persisted)
    this.decryptedValues = new Map();
  }
  
  // Initialize with master password (stored in memory only)
  async initialize(masterPassword) {
    this.masterPassword = masterPassword;
    
    // Load and decrypt all sensitive values
    const stored = await chrome.storage.local.get();
    
    for (const [key, value] of Object.entries(stored)) {
      if (this.sensitiveKeys.includes(key) && this.isEncrypted(value)) {
        try {
          const decrypted = await this.decrypt(value, masterPassword);
          this.decryptedValues.set(key, decrypted);
        } catch (error) {
          console.error(`Failed to decrypt ${key}:`, error);
        }
      }
    }
  }
  
  // Check if a value is encrypted
  isEncrypted(value) {
    try {
      const parsed = JSON.parse(value);
      return parsed.encrypted && parsed.salt && parsed.iv;
    } catch {
      return false;
    }
  }
  
  // Get decrypted value
  async getSecureValue(key) {
    // First check runtime cache
    if (this.decryptedValues.has(key)) {
      return this.decryptedValues.get(key);
    }
    
    // Try to load and decrypt
    const stored = await chrome.storage.local.get(key);
    const value = stored[key];
    
    if (!value) return null;
    
    if (this.isEncrypted(value) && this.masterPassword) {
      const decrypted = await this.decrypt(value, this.masterPassword);
      this.decryptedValues.set(key, decrypted);
      return decrypted;
    }
    
    // Return as-is if not encrypted
    return value;
  }
  
  // Encrypt a value
  async encrypt(text, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Generate salt and derive key
    const salt = crypto.getRandomValues(new Uint8Array(64));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 10000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    return JSON.stringify({
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv))
    });
  }
  
  // Decrypt a value
  async decrypt(encryptedData, password) {
    const parsed = JSON.parse(encryptedData);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Decode base64
    const encrypted = Uint8Array.from(atob(parsed.encrypted), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(parsed.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));
    
    // Derive key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 10000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  }
  
  // Save encrypted configuration
  async saveSecure(key, value, password) {
    if (this.sensitiveKeys.includes(key)) {
      const encrypted = await this.encrypt(value, password || this.masterPassword);
      await chrome.storage.local.set({ [key]: encrypted });
      this.decryptedValues.set(key, value);
    } else {
      await chrome.storage.local.set({ [key]: value });
    }
  }
  
  // Get all configuration with decrypted values
  async getAllSecure() {
    const stored = await chrome.storage.local.get();
    const config = {};
    
    for (const [key, value] of Object.entries(stored)) {
      if (this.sensitiveKeys.includes(key)) {
        config[key] = await this.getSecureValue(key) || '';
      } else {
        config[key] = value;
      }
    }
    
    return config;
  }
  
  // Clear decrypted values from memory
  clearCache() {
    this.decryptedValues.clear();
    this.masterPassword = null;
  }
}

// Export singleton
const secureConfig = new SecureConfig();

if (typeof self !== 'undefined') {
  self.secureConfig = secureConfig;
}

if (typeof window !== 'undefined') {
  window.BrowserAgentSecureConfig = secureConfig;
}