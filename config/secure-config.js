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

    // PERF: Cache for saved payment method metadata
    this._paymentMethodMetadataCache = null;
    this._paymentMethodMetadataCacheTime = 0;
    this._paymentMethodMetadataCacheTTL = 30000; // 30 seconds

    // Session-scoped credential vault key (persisted in chrome.storage.session)
    this._credentialSessionKey = null;

    // Separate browser-session gate for saved payment methods
    this._paymentAccessUnlocked = null;
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

  static CREDENTIAL_STORAGE_PREFIX = 'cred_';
  static CREDENTIAL_VAULT_CONFIG_KEY = 'credentialVaultConfig';
  static CREDENTIAL_VAULT_SESSION_KEY = 'fsbCredentialVaultSessionKey';
  static CREDENTIAL_VAULT_VERIFIER = 'FSB_CREDENTIAL_VAULT_V1';
  static PAYMENT_METHOD_STORAGE_PREFIX = 'payment_method_';
  static PAYMENT_ACCESS_SESSION_KEY = 'fsbPaymentAccessUnlocked';

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

  getLegacyCredentialPassword() {
    const extId = chrome.runtime?.id || 'fsb-local';
    return 'fsb-cred-' + extId;
  }

  async getCredentialVaultConfig() {
    const stored = await chrome.storage.local.get(SecureConfig.CREDENTIAL_VAULT_CONFIG_KEY);
    return stored[SecureConfig.CREDENTIAL_VAULT_CONFIG_KEY] || null;
  }

  async _loadCredentialSessionKey() {
    if (this._credentialSessionKey) {
      return this._credentialSessionKey;
    }

    try {
      const stored = await chrome.storage.session.get(SecureConfig.CREDENTIAL_VAULT_SESSION_KEY);
      this._credentialSessionKey = stored[SecureConfig.CREDENTIAL_VAULT_SESSION_KEY] || null;
    } catch (_error) {
      this._credentialSessionKey = null;
    }

    return this._credentialSessionKey;
  }

  async _setCredentialSessionKey(sessionKey) {
    this._credentialSessionKey = sessionKey || null;

    try {
      if (sessionKey) {
        await chrome.storage.session.set({ [SecureConfig.CREDENTIAL_VAULT_SESSION_KEY]: sessionKey });
      } else {
        await chrome.storage.session.remove(SecureConfig.CREDENTIAL_VAULT_SESSION_KEY);
      }
    } catch (_error) {
      // Non-fatal. Session storage is best-effort persistence across service worker restarts.
    }
  }

  async _loadPaymentAccessState() {
    if (this._paymentAccessUnlocked !== null) {
      return this._paymentAccessUnlocked === true;
    }

    try {
      const stored = await chrome.storage.session.get(SecureConfig.PAYMENT_ACCESS_SESSION_KEY);
      this._paymentAccessUnlocked = stored[SecureConfig.PAYMENT_ACCESS_SESSION_KEY] === true;
    } catch (_error) {
      this._paymentAccessUnlocked = false;
    }

    return this._paymentAccessUnlocked === true;
  }

  async _setPaymentAccessState(unlocked) {
    this._paymentAccessUnlocked = unlocked === true;

    try {
      if (unlocked) {
        await chrome.storage.session.set({ [SecureConfig.PAYMENT_ACCESS_SESSION_KEY]: true });
      } else {
        await chrome.storage.session.remove(SecureConfig.PAYMENT_ACCESS_SESSION_KEY);
      }
    } catch (_error) {
      // Non-fatal. Session storage is best-effort persistence across service worker restarts.
    }
  }

  async deriveCredentialSessionKey(passphrase, saltBase64) {
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this._encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 120000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  }

  async getCredentialVaultStatus() {
    const config = await this.getCredentialVaultConfig();
    const sessionKey = await this._loadCredentialSessionKey();

    return {
      configured: !!config,
      unlocked: !!(config && sessionKey),
      pinLength: config?.pinLength || null
    };
  }

  async getPaymentVaultStatus() {
    const vaultStatus = await this.getCredentialVaultStatus();
    const paymentUnlocked = vaultStatus.unlocked
      ? await this._loadPaymentAccessState()
      : false;

    return {
      configured: vaultStatus.configured,
      unlocked: vaultStatus.unlocked,
      paymentUnlocked: paymentUnlocked === true
    };
  }

  async ensureCredentialVaultUnlocked() {
    const config = await this.getCredentialVaultConfig();
    if (!config) {
      return {
        ok: false,
        errorCode: 'vault_not_configured',
        error: 'Credential vault is not configured'
      };
    }

    const sessionKey = await this._loadCredentialSessionKey();
    if (!sessionKey) {
      return {
        ok: false,
        errorCode: 'locked',
        error: 'Credential vault is locked'
      };
    }

    return { ok: true, sessionKey };
  }

  async ensurePaymentAccessUnlocked() {
    const ready = await this.ensureCredentialVaultUnlocked();
    if (!ready.ok) {
      return ready;
    }

    const paymentUnlocked = await this._loadPaymentAccessState();
    if (!paymentUnlocked) {
      return {
        ok: false,
        errorCode: 'payment_locked',
        error: 'Saved payment methods are locked'
      };
    }

    return ready;
  }

  _normalizeCredentialRecord(domain, data) {
    const normalizedDomain = this.normalizeDomain(data?.domain || domain);
    const createdAt = Number.isFinite(data?.createdAt) ? data.createdAt : Date.now();
    const updatedAt = Number.isFinite(data?.updatedAt) ? data.updatedAt : createdAt;

    return {
      username: data?.username || '',
      password: data?.password || '',
      notes: data?.notes || '',
      allowSubdomains: data?.allowSubdomains === true,
      domain: normalizedDomain,
      createdAt,
      updatedAt
    };
  }

  async createCredentialVault(passphrase) {
    if (!passphrase || !/^\d{4}$|^\d{6}$/.test(passphrase)) {
      return { success: false, errorCode: 'invalid_pin', error: 'PIN must be exactly 4 or 6 digits' };
    }

    const existing = await this.getCredentialVaultConfig();
    if (existing) {
      return { success: false, errorCode: 'vault_exists', error: 'Credential vault is already configured' };
    }

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const saltBase64 = btoa(String.fromCharCode(...salt));
    const sessionKey = await this.deriveCredentialSessionKey(passphrase, saltBase64);
    const verifier = await this.encrypt(SecureConfig.CREDENTIAL_VAULT_VERIFIER, sessionKey);

    await chrome.storage.local.set({
      [SecureConfig.CREDENTIAL_VAULT_CONFIG_KEY]: {
        version: 2,
        salt: saltBase64,
        verifier,
        pinLength: passphrase.length,
        createdAt: Date.now()
      }
    });

    await this._setCredentialSessionKey(sessionKey);
    await this._setPaymentAccessState(false);
    const migration = await this.migrateLegacyCredentials(sessionKey);

    return {
      success: true,
      configured: true,
      unlocked: true,
      migratedCount: migration.migratedCount || 0
    };
  }

  async unlockCredentialVault(passphrase) {
    const config = await this.getCredentialVaultConfig();
    if (!config?.salt || !config?.verifier) {
      return { success: false, errorCode: 'vault_not_configured', error: 'Credential vault is not configured' };
    }

    try {
      const sessionKey = await this.deriveCredentialSessionKey(passphrase, config.salt);
      const verifier = await this.decrypt(config.verifier, sessionKey);

      if (verifier !== SecureConfig.CREDENTIAL_VAULT_VERIFIER) {
        return { success: false, errorCode: 'invalid_passphrase', error: 'Incorrect credential vault passphrase' };
      }

      await this._setCredentialSessionKey(sessionKey);
      const migration = await this.migrateLegacyCredentials(sessionKey);

      return {
        success: true,
        configured: true,
        unlocked: true,
        migratedCount: migration.migratedCount || 0
      };
    } catch (_error) {
      return { success: false, errorCode: 'invalid_passphrase', error: 'Incorrect credential vault passphrase' };
    }
  }

  async lockCredentialVault() {
    await this._setCredentialSessionKey(null);
    await this._setPaymentAccessState(false);
    this._credentialMetadataCache = null;
    this._credentialMetadataCacheTime = 0;
    this._paymentMethodMetadataCache = null;
    this._paymentMethodMetadataCacheTime = 0;
    return { success: true };
  }

  async migrateLegacyCredentials(sessionKeyOverride = null) {
    const sessionKey = sessionKeyOverride || await this._loadCredentialSessionKey();
    if (!sessionKey) {
      return { success: false, migratedCount: 0 };
    }

    const allStored = await chrome.storage.local.get();
    const updates = {};
    const legacyPassword = this.getLegacyCredentialPassword();
    let migratedCount = 0;

    for (const [key, value] of Object.entries(allStored)) {
      if (!key.startsWith(SecureConfig.CREDENTIAL_STORAGE_PREFIX)) continue;

      try {
        const decrypted = await this.decrypt(value, sessionKey);
        const normalized = this._normalizeCredentialRecord(key.slice(SecureConfig.CREDENTIAL_STORAGE_PREFIX.length), JSON.parse(decrypted));
        if (decrypted !== JSON.stringify(normalized)) {
          updates[key] = await this.encrypt(JSON.stringify(normalized), sessionKey);
        }
        continue;
      } catch (_error) {
        // Not encrypted with the current vault key. Try the legacy fallback once.
      }

      try {
        const decryptedLegacy = await this.decrypt(value, legacyPassword);
        const normalized = this._normalizeCredentialRecord(key.slice(SecureConfig.CREDENTIAL_STORAGE_PREFIX.length), JSON.parse(decryptedLegacy));
        updates[key] = await this.encrypt(JSON.stringify(normalized), sessionKey);
        migratedCount += 1;
      } catch (_error) {
        // Leave unreadable credentials untouched so users can delete them manually later.
      }
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }

    this._credentialMetadataCache = null;
    this._credentialMetadataCacheTime = 0;

    return { success: true, migratedCount };
  }

  // Save a credential for a domain
  async saveCredential(domain, data = {}) {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const ready = await this.ensureCredentialVaultUnlocked();
      if (!ready.ok) {
        return { success: false, errorCode: ready.errorCode, error: ready.error };
      }

      const storageKey = SecureConfig.CREDENTIAL_STORAGE_PREFIX + normalizedDomain;
      const existing = await this.getExactCredential(normalizedDomain);
      const normalized = this._normalizeCredentialRecord(normalizedDomain, {
        username: data.username,
        password: data.password,
        notes: data.notes,
        allowSubdomains: data.allowSubdomains,
        createdAt: existing?.createdAt,
        updatedAt: Date.now()
      });
      const encrypted = await this.encrypt(JSON.stringify(normalized), ready.sessionKey);
      await chrome.storage.local.set({ [storageKey]: encrypted });

      // Invalidate metadata cache on save
      this._credentialMetadataCache = null;
      this._credentialMetadataCacheTime = 0;

      return { success: true, domain: normalizedDomain };
    } catch (error) {
      return { success: false, error: 'Failed to save credential' };
    }
  }

  async getExactCredential(domain) {
    const ready = await this.ensureCredentialVaultUnlocked();
    if (!ready.ok) return null;

    const normalizedDomain = this.normalizeDomain(domain);
    const exactKey = SecureConfig.CREDENTIAL_STORAGE_PREFIX + normalizedDomain;
    const stored = await chrome.storage.local.get(exactKey);

    if (!stored[exactKey]) return null;

    try {
      const decrypted = await this.decrypt(stored[exactKey], ready.sessionKey);
      return this._normalizeCredentialRecord(normalizedDomain, JSON.parse(decrypted));
    } catch (error) {
      console.error('Failed to decrypt credential for', normalizedDomain, error);
      return null;
    }
  }

  // Get a credential for a domain (checks exact match, then parent domain)
  async getCredential(domain) {
    const normalizedDomain = this.normalizeDomain(domain);
    const exactCredential = await this.getExactCredential(normalizedDomain);
    if (exactCredential) {
      return exactCredential;
    }

    // Try parent domain (e.g., login.example.com -> example.com)
    const parentDomain = this.getParentDomain(normalizedDomain);
    if (parentDomain !== normalizedDomain) {
      const parentCredential = await this.getExactCredential(parentDomain);
      if (parentCredential?.allowSubdomains) {
        return parentCredential;
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

    const ready = await this.ensureCredentialVaultUnlocked();
    if (!ready.ok) {
      return [];
    }

    const allStored = await chrome.storage.local.get();
    const credentials = [];

    for (const [key, value] of Object.entries(allStored)) {
      if (key.startsWith(SecureConfig.CREDENTIAL_STORAGE_PREFIX)) {
        try {
          const decrypted = await this.decrypt(value, ready.sessionKey);
          const cred = this._normalizeCredentialRecord(key.slice(SecureConfig.CREDENTIAL_STORAGE_PREFIX.length), JSON.parse(decrypted));
          // Return metadata only - no password in the list
          credentials.push({
            domain: cred.domain,
            username: cred.username,
            notes: cred.notes || '',
            allowSubdomains: cred.allowSubdomains === true,
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
      const ready = await this.ensureCredentialVaultUnlocked();
      if (!ready.ok) {
        return { success: false, errorCode: ready.errorCode, error: ready.error };
      }

      const normalizedDomain = this.normalizeDomain(domain);
      const storageKey = SecureConfig.CREDENTIAL_STORAGE_PREFIX + normalizedDomain;
      await chrome.storage.local.remove(storageKey);
      // Invalidate metadata cache on delete
      this._credentialMetadataCache = null;
      this._credentialMetadataCacheTime = 0;
      return { success: true, domain: normalizedDomain };
    } catch (error) {
      return { success: false, error: 'Failed to delete credential' };
    }
  }

  // Update a credential (merges updates into existing)
  async updateCredential(domain, updates) {
    const ready = await this.ensureCredentialVaultUnlocked();
    if (!ready.ok) {
      return { success: false, errorCode: ready.errorCode, error: ready.error };
    }

    const existing = await this.getCredential(domain);
    if (!existing) {
      return { success: false, error: 'Credential not found' };
    }

    const updated = {
      username: updates.username !== undefined ? updates.username : existing.username,
      password: updates.password !== undefined ? updates.password : existing.password,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      allowSubdomains: updates.allowSubdomains !== undefined ? updates.allowSubdomains : existing.allowSubdomains,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
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

  normalizeCardNumber(cardNumber) {
    return String(cardNumber || '').replace(/\D/g, '');
  }

  formatCardNumber(cardNumber) {
    const digits = this.normalizeCardNumber(cardNumber);
    if (!digits) return '';

    if (/^3[47]/.test(digits)) {
      const parts = [
        digits.slice(0, 4),
        digits.slice(4, 10),
        digits.slice(10, 15)
      ].filter(Boolean);
      return parts.join(' ');
    }

    return digits.match(/.{1,4}/g)?.join(' ') || digits;
  }

  detectCardBrand(cardNumber) {
    const digits = this.normalizeCardNumber(cardNumber);
    if (!digits) return 'unknown';

    if (/^4\d{12}(\d{3}){0,2}$/.test(digits)) return 'visa';
    if (/^(5[1-5]\d{14}|2(2[2-9]\d{12}|[3-6]\d{13}|7([01]\d{12}|20\d{12})))$/.test(digits)) return 'mastercard';
    if (/^3[47]\d{13}$/.test(digits)) return 'amex';
    if (/^(6011\d{12}|65\d{14}|64[4-9]\d{13})$/.test(digits)) return 'discover';
    if (/^(30[0-5]\d{11}|36\d{12}|38\d{12}|39\d{12})$/.test(digits)) return 'diners';
    if (/^(2131|1800|35\d{3})\d{11}$/.test(digits)) return 'jcb';
    return 'unknown';
  }

  isValidCardNumber(cardNumber) {
    const digits = this.normalizeCardNumber(cardNumber);
    if (!/^\d{12,19}$/.test(digits)) {
      return false;
    }

    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let digit = Number(digits[i]);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  normalizeExpiryMonth(month) {
    const digits = String(month || '').replace(/\D/g, '');
    if (!digits) return '';
    const numeric = Number(digits.slice(0, 2));
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 12) {
      return '';
    }
    return String(numeric).padStart(2, '0');
  }

  normalizeExpiryYear(year) {
    const digits = String(year || '').replace(/\D/g, '');
    if (!digits) return '';

    if (digits.length === 2) {
      return `20${digits}`;
    }

    if (digits.length === 4) {
      return digits;
    }

    return '';
  }

  isValidPaymentExpiry(month, year) {
    const normalizedMonth = this.normalizeExpiryMonth(month);
    const normalizedYear = this.normalizeExpiryYear(year);
    if (!normalizedMonth || !normalizedYear) {
      return false;
    }

    const monthNumber = Number(normalizedMonth);
    const yearNumber = Number(normalizedYear);
    if (!Number.isInteger(monthNumber) || !Number.isInteger(yearNumber)) {
      return false;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (yearNumber < currentYear) return false;
    if (yearNumber === currentYear && monthNumber < currentMonth) return false;
    return true;
  }

  getCardLast4(cardNumber) {
    const digits = this.normalizeCardNumber(cardNumber);
    return digits.slice(-4);
  }

  getMaskedCardNumber(cardNumber) {
    const digits = this.normalizeCardNumber(cardNumber);
    if (!digits) return '****';

    const last4 = digits.slice(-4);
    if (/^3[47]/.test(digits)) {
      return `**** ****** ${last4}`;
    }
    return `**** **** **** ${last4}`;
  }

  _buildBillingSummary(record) {
    const parts = [
      record.city || '',
      record.stateRegion || '',
      record.postalCode || '',
      record.country || ''
    ].filter(Boolean);

    return parts.join(', ');
  }

  _generatePaymentMethodId() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `pm_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  _normalizePaymentMethodRecord(id, data = {}) {
    const cardNumber = this.normalizeCardNumber(data.cardNumber);
    const expiryMonth = this.normalizeExpiryMonth(data.expiryMonth);
    const expiryYear = this.normalizeExpiryYear(data.expiryYear);
    const createdAt = Number.isFinite(data.createdAt) ? data.createdAt : Date.now();
    const updatedAt = Number.isFinite(data.updatedAt) ? data.updatedAt : createdAt;
    const cardholderName = String(data.cardholderName || '').trim();

    return {
      id: String(data.id || id || this._generatePaymentMethodId()),
      nickname: String(data.nickname || '').trim(),
      cardholderName,
      cardNumber,
      cardBrand: this.detectCardBrand(cardNumber),
      expiryMonth,
      expiryYear,
      cvv: String(data.cvv || '').replace(/\D/g, '').slice(0, 4),
      billingName: String(data.billingName || cardholderName).trim(),
      addressLine1: String(data.addressLine1 || '').trim(),
      addressLine2: String(data.addressLine2 || '').trim(),
      city: String(data.city || '').trim(),
      stateRegion: String(data.stateRegion || '').trim(),
      postalCode: String(data.postalCode || '').trim(),
      country: String(data.country || '').trim(),
      createdAt,
      updatedAt
    };
  }

  validatePaymentMethodRecord(record) {
    if (!record.cardholderName) {
      return { ok: false, errorCode: 'missing_cardholder', error: 'Cardholder name is required' };
    }

    if (!this.isValidCardNumber(record.cardNumber)) {
      return { ok: false, errorCode: 'invalid_card_number', error: 'Enter a valid card number' };
    }

    if (!this.isValidPaymentExpiry(record.expiryMonth, record.expiryYear)) {
      return { ok: false, errorCode: 'invalid_expiry', error: 'Enter a valid expiration date' };
    }

    if (!/^\d{3,4}$/.test(record.cvv)) {
      return { ok: false, errorCode: 'invalid_cvv', error: 'Enter a valid CVV/CVC' };
    }

    if (!record.billingName || !record.addressLine1 || !record.city || !record.stateRegion || !record.postalCode || !record.country) {
      return {
        ok: false,
        errorCode: 'missing_billing_profile',
        error: 'Full billing profile is required for saved payment methods'
      };
    }

    return { ok: true };
  }

  buildPaymentMethodMetadata(record) {
    const last4 = this.getCardLast4(record.cardNumber);

    return {
      id: record.id,
      nickname: record.nickname,
      cardholderName: record.cardholderName,
      cardBrand: record.cardBrand,
      last4,
      maskedNumber: this.getMaskedCardNumber(record.cardNumber),
      expiryMonth: record.expiryMonth,
      expiryYearLast2: record.expiryYear ? record.expiryYear.slice(-2) : '',
      billingSummary: this._buildBillingSummary(record),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async unlockPaymentMethods(passphrase) {
    const ready = await this.ensureCredentialVaultUnlocked();
    if (!ready.ok) {
      if (ready.errorCode === 'locked') {
        return {
          success: false,
          errorCode: 'locked',
          error: 'Unlock the credential vault before unlocking saved payment methods'
        };
      }
      return { success: false, errorCode: ready.errorCode, error: ready.error };
    }

    const config = await this.getCredentialVaultConfig();
    if (!config?.salt) {
      return { success: false, errorCode: 'vault_not_configured', error: 'Credential vault is not configured' };
    }

    try {
      const sessionKey = await this.deriveCredentialSessionKey(passphrase || '', config.salt);
      if (sessionKey !== ready.sessionKey) {
        return { success: false, errorCode: 'invalid_passphrase', error: 'Incorrect credential vault passphrase' };
      }

      await this._setPaymentAccessState(true);
      return {
        success: true,
        configured: true,
        unlocked: true,
        paymentUnlocked: true
      };
    } catch (_error) {
      return { success: false, errorCode: 'invalid_passphrase', error: 'Incorrect credential vault passphrase' };
    }
  }

  async lockPaymentMethods() {
    await this._setPaymentAccessState(false);
    this._paymentMethodMetadataCache = null;
    this._paymentMethodMetadataCacheTime = 0;
    return { success: true };
  }

  async _getStoredPaymentMethod(id, sessionKey) {
    const paymentId = String(id || '').trim();
    if (!paymentId) return null;

    const storageKey = SecureConfig.PAYMENT_METHOD_STORAGE_PREFIX + paymentId;
    const stored = await chrome.storage.local.get(storageKey);
    if (!stored[storageKey]) return null;

    try {
      const decrypted = await this.decrypt(stored[storageKey], sessionKey);
      return this._normalizePaymentMethodRecord(paymentId, JSON.parse(decrypted));
    } catch (error) {
      console.error('Failed to decrypt payment method:', paymentId, error);
      return null;
    }
  }

  async savePaymentMethod(data = {}) {
    try {
      const ready = await this.ensurePaymentAccessUnlocked();
      if (!ready.ok) {
        return { success: false, errorCode: ready.errorCode, error: ready.error };
      }

      const paymentId = String(data.id || '').trim() || this._generatePaymentMethodId();
      const existing = await this._getStoredPaymentMethod(paymentId, ready.sessionKey);
      const normalized = this._normalizePaymentMethodRecord(paymentId, {
        ...data,
        createdAt: existing?.createdAt,
        updatedAt: Date.now()
      });
      const validation = this.validatePaymentMethodRecord(normalized);
      if (!validation.ok) {
        return { success: false, errorCode: validation.errorCode, error: validation.error };
      }

      const storageKey = SecureConfig.PAYMENT_METHOD_STORAGE_PREFIX + normalized.id;
      const encrypted = await this.encrypt(JSON.stringify(normalized), ready.sessionKey);
      await chrome.storage.local.set({ [storageKey]: encrypted });

      this._paymentMethodMetadataCache = null;
      this._paymentMethodMetadataCacheTime = 0;

      return { success: true, id: normalized.id };
    } catch (_error) {
      return { success: false, error: 'Failed to save payment method' };
    }
  }

  async getFullPaymentMethod(id) {
    const ready = await this.ensurePaymentAccessUnlocked();
    if (!ready.ok) return null;
    return await this._getStoredPaymentMethod(id, ready.sessionKey);
  }

  async getAllPaymentMethods() {
    const now = Date.now();
    if (this._paymentMethodMetadataCache && (now - this._paymentMethodMetadataCacheTime) < this._paymentMethodMetadataCacheTTL) {
      return this._paymentMethodMetadataCache;
    }

    const ready = await this.ensurePaymentAccessUnlocked();
    if (!ready.ok) {
      return [];
    }

    const allStored = await chrome.storage.local.get();
    const paymentMethods = [];

    for (const [key, value] of Object.entries(allStored)) {
      if (!key.startsWith(SecureConfig.PAYMENT_METHOD_STORAGE_PREFIX)) continue;

      try {
        const decrypted = await this.decrypt(value, ready.sessionKey);
        const record = this._normalizePaymentMethodRecord(
          key.slice(SecureConfig.PAYMENT_METHOD_STORAGE_PREFIX.length),
          JSON.parse(decrypted)
        );
        paymentMethods.push(this.buildPaymentMethodMetadata(record));
      } catch (error) {
        console.error('Failed to decrypt payment method metadata:', key, error);
      }
    }

    paymentMethods.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    this._paymentMethodMetadataCache = paymentMethods;
    this._paymentMethodMetadataCacheTime = now;

    return paymentMethods;
  }

  async updatePaymentMethod(id, updates = {}) {
    const ready = await this.ensurePaymentAccessUnlocked();
    if (!ready.ok) {
      return { success: false, errorCode: ready.errorCode, error: ready.error };
    }

    const existing = await this._getStoredPaymentMethod(id, ready.sessionKey);
    if (!existing) {
      return { success: false, error: 'Payment method not found' };
    }

    return await this.savePaymentMethod({
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    });
  }

  async deletePaymentMethod(id) {
    try {
      const ready = await this.ensurePaymentAccessUnlocked();
      if (!ready.ok) {
        return { success: false, errorCode: ready.errorCode, error: ready.error };
      }

      const paymentId = String(id || '').trim();
      if (!paymentId) {
        return { success: false, error: 'Payment method not found' };
      }

      const storageKey = SecureConfig.PAYMENT_METHOD_STORAGE_PREFIX + paymentId;
      await chrome.storage.local.remove(storageKey);

      this._paymentMethodMetadataCache = null;
      this._paymentMethodMetadataCacheTime = 0;

      return { success: true, id: paymentId };
    } catch (_error) {
      return { success: false, error: 'Failed to delete payment method' };
    }
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
