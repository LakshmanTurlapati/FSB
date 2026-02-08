// Secure configuration management for Chrome Extension
// This file handles encrypted API keys and sensitive data

class SecureConfig {
  constructor() {
    // Configuration keys that should be encrypted
    this.sensitiveKeys = [
      'apiKey',
      'openaiApiKey',
      'geminiApiKey',
      'anthropicApiKey',
      'customApiKey',
      'captchaApiKey'
    ];

    // Runtime decrypted values (never persisted)
    this.decryptedValues = new Map();

    // PERF: Singleton TextEncoder/TextDecoder to avoid per-call instantiation
    this._encoder = new TextEncoder();
    this._decoder = new TextDecoder();

    // PERF: Cache for credential metadata (avoids decrypting all creds just to list them)
    this._credentialMetadataCache = null;
    this._credentialMetadataCacheTime = 0;
    this._credentialMetadataCacheTTL = 30000; // 30 seconds
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
    const data = this._encoder.encode(text);

    // Generate salt and derive key
    const salt = crypto.getRandomValues(new Uint8Array(64));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this._encoder.encode(password),
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

    // Decode base64
    const encrypted = Uint8Array.from(atob(parsed.encrypted), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(parsed.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));

    // Derive key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this._encoder.encode(password),
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
    
    return this._decoder.decode(decrypted);
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

  // ==========================================
  // Credential Management (Beta)
  // ==========================================

  // Normalize a URL to its hostname, stripping 'www.' prefix
  normalizeDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '');
    } catch {
      // Validate: must look like a domain (alphanumeric, dots, hyphens only, must contain a dot)
      if (!/^[a-zA-Z0-9.-]+$/.test(url) || !url.includes('.')) return url;
      return url.replace(/^www\./, '');
    }
  }

  // Check if a string is an IP address (v4 or v6)
  _isIPAddress(domain) {
    // IPv4: digits and dots only, 4 octets
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return true;
    // IPv6: contains colons
    if (domain.includes(':')) return true;
    return false;
  }

  // Common multi-level TLDs where the last two parts are the TLD
  static MULTI_LEVEL_TLDS = new Set([
    'co.uk', 'co.jp', 'co.kr', 'co.in', 'co.nz', 'co.za', 'co.il',
    'com.br', 'com.au', 'com.mx', 'com.cn', 'com.tw', 'com.hk', 'com.sg',
    'com.ar', 'com.tr', 'com.eg', 'com.pk', 'com.ng', 'com.co',
    'gov.uk', 'gov.au', 'gov.in',
    'org.uk', 'org.au',
    'net.au', 'net.br',
    'ac.uk', 'ac.jp',
    'edu.au', 'edu.cn'
  ]);

  // Get parent domain (e.g., accounts.google.com -> google.com)
  getParentDomain(domain) {
    // No parent domain for IP addresses
    if (this._isIPAddress(domain)) return null;
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    // Check for multi-level TLDs (e.g., mail.google.co.uk -> google.co.uk)
    const lastTwo = parts.slice(-2).join('.');
    if (SecureConfig.MULTI_LEVEL_TLDS.has(lastTwo)) {
      return parts.length > 3 ? parts.slice(-3).join('.') : domain;
    }
    return lastTwo;
  }

  // Get the encryption password for credentials
  // Uses a fixed internal key derived from extension ID for credential encryption
  // This avoids requiring a master password while still encrypting at rest
  getCredentialPassword() {
    if (this.masterPassword) return this.masterPassword;
    // Fallback: use extension ID + fixed salt as encryption key
    const extId = chrome.runtime?.id || 'fsb-local';
    return 'fsb-cred-' + extId;
  }

  // Save a credential for a domain
  async saveCredential(domain, { username, password, notes }) {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const storageKey = 'cred_' + normalizedDomain;
      const credPassword = this.getCredentialPassword();

      const credentialData = JSON.stringify({
        username: username || '',
        password: password || '',
        notes: notes || '',
        domain: normalizedDomain,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const encrypted = await this.encrypt(credentialData, credPassword);
      await chrome.storage.local.set({ [storageKey]: encrypted });

      // Invalidate metadata cache on save
      this._credentialMetadataCache = null;

      return { success: true, domain: normalizedDomain };
    } catch (error) {
      return { success: false, error: 'Failed to save credential' };
    }
  }

  // Get a credential for a domain (checks exact match, then parent domain)
  async getCredential(domain) {
    const normalizedDomain = this.normalizeDomain(domain);
    const credPassword = this.getCredentialPassword();

    // Try exact domain first
    const exactKey = 'cred_' + normalizedDomain;
    const stored = await chrome.storage.local.get(exactKey);

    if (stored[exactKey]) {
      try {
        const decrypted = await this.decrypt(stored[exactKey], credPassword);
        return JSON.parse(decrypted);
      } catch (error) {
        console.error('Failed to decrypt credential for', normalizedDomain, error);
        return null;
      }
    }

    // Try parent domain (e.g., login.example.com -> example.com)
    const parentDomain = this.getParentDomain(normalizedDomain);
    if (parentDomain !== normalizedDomain) {
      const parentKey = 'cred_' + parentDomain;
      const parentStored = await chrome.storage.local.get(parentKey);

      if (parentStored[parentKey]) {
        try {
          const decrypted = await this.decrypt(parentStored[parentKey], credPassword);
          return JSON.parse(decrypted);
        } catch (error) {
          console.error('Failed to decrypt credential for parent domain', parentDomain, error);
          return null;
        }
      }
    }

    return null;
  }

  // Get all credentials (returns metadata only, NO passwords in the list)
  // PERF: Uses a short-lived cache to avoid decrypting all credentials on every call
  async getAllCredentials() {
    // Return cached metadata if still fresh
    const now = Date.now();
    if (this._credentialMetadataCache && (now - this._credentialMetadataCacheTime) < this._credentialMetadataCacheTTL) {
      return this._credentialMetadataCache;
    }

    const allStored = await chrome.storage.local.get();
    const credentials = [];
    const credPassword = this.getCredentialPassword();

    for (const [key, value] of Object.entries(allStored)) {
      if (key.startsWith('cred_')) {
        try {
          const decrypted = await this.decrypt(value, credPassword);
          const cred = JSON.parse(decrypted);
          // Return metadata only - no password in the list
          credentials.push({
            domain: cred.domain,
            username: cred.username,
            notes: cred.notes || '',
            createdAt: cred.createdAt,
            updatedAt: cred.updatedAt
          });
        } catch (error) {
          console.error('Failed to decrypt credential:', key, error);
        }
      }
    }

    // Sort by most recently updated
    credentials.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // Cache the result
    this._credentialMetadataCache = credentials;
    this._credentialMetadataCacheTime = now;

    return credentials;
  }

  // Delete a credential for a domain
  async deleteCredential(domain) {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const storageKey = 'cred_' + normalizedDomain;
      await chrome.storage.local.remove(storageKey);
      // Invalidate metadata cache on delete
      this._credentialMetadataCache = null;
      return { success: true, domain: normalizedDomain };
    } catch (error) {
      return { success: false, error: 'Failed to delete credential' };
    }
  }

  // Update a credential (merges updates into existing)
  async updateCredential(domain, updates) {
    const existing = await this.getCredential(domain);
    if (!existing) {
      return { success: false, error: 'Credential not found' };
    }

    const updated = {
      username: updates.username !== undefined ? updates.username : existing.username,
      password: updates.password !== undefined ? updates.password : existing.password,
      notes: updates.notes !== undefined ? updates.notes : existing.notes
    };

    const normalizedDomain = this.normalizeDomain(domain);
    const newDomain = updates.domain ? this.normalizeDomain(updates.domain) : normalizedDomain;

    if (newDomain !== normalizedDomain) {
      // Save new credential FIRST -- if this fails, old credential is untouched
      const saveResult = await this.saveCredential(newDomain, updated);
      if (!saveResult.success) {
        return { success: false, error: 'Failed to save updated credential' };
      }
      // Only delete old after successful save
      await this.deleteCredential(domain);
      return saveResult;
    }

    return await this.saveCredential(newDomain, updated);
  }

  // Get full credential including password (used for auto-fill, not for list display)
  async getFullCredential(domain) {
    return await this.getCredential(domain);
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