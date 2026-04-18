'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.error('  FAIL:', msg);
  }
}

function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg} (expected: ${expected}, got: ${actual})`);
}

function createStorageArea(initial = {}) {
  const store = { ...initial };
  return {
    async get(keys) {
      if (keys == null) return { ...store };
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) out[key] = store[key];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
      }
      if (typeof keys === 'object') {
        const out = {};
        Object.keys(keys).forEach((key) => {
          out[key] = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : keys[key];
        });
        return out;
      }
      return { ...store };
    },
    async set(values) {
      Object.assign(store, values);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => {
        delete store[key];
      });
    },
    _dump() {
      return { ...store };
    }
  };
}

function loadSecureConfig(localSeed = {}, sessionSeed = {}) {
  const local = createStorageArea(localSeed);
  const session = createStorageArea(sessionSeed);
  const context = {
    chrome: {
      runtime: { id: 'test-extension-id' },
      storage: { local, session }
    },
    crypto: webcrypto,
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    TextEncoder,
    TextDecoder,
    console,
    self: {},
    window: undefined,
    module: undefined,
    exports: undefined,
    require: undefined,
    setTimeout,
    clearTimeout
  };

  const source = fs.readFileSync(path.join(__dirname, '..', 'config', 'secure-config.js'), 'utf8');
  vm.runInNewContext(`${source}\nthis.__secureConfig = secureConfig;`, context, { filename: 'secure-config.js' });

  return {
    secureConfig: context.__secureConfig,
    storageLocal: local,
    storageSession: session
  };
}

async function run() {
  console.log('\n--- credential vault setup and locking ---');
  {
    const { secureConfig, storageSession } = loadSecureConfig();

    const setup = await secureConfig.createCredentialVault('vault-passphrase');
    assert(setup.success, 'createCredentialVault succeeds with a strong passphrase');

    const status = await secureConfig.getCredentialVaultStatus();
    assert(status.configured && status.unlocked, 'vault status reports configured and unlocked after setup');

    const save = await secureConfig.saveCredential('example.com', {
      username: 'user@example.com',
      password: 'secret',
      notes: 'primary',
      allowSubdomains: false
    });
    assert(save.success, 'saveCredential succeeds while vault is unlocked');

    const metadata = await secureConfig.getAllCredentials();
    assertEqual(metadata.length, 1, 'getAllCredentials returns one saved credential');
    assert(!('password' in metadata[0]), 'metadata list does not expose passwords');

    await secureConfig.lockCredentialVault();
    const lockedStatus = await secureConfig.getCredentialVaultStatus();
    assert(lockedStatus.configured && !lockedStatus.unlocked, 'lockCredentialVault clears unlocked state');

    const lockedSave = await secureConfig.saveCredential('example.com', {
      username: 'user@example.com',
      password: 'new-secret'
    });
    assertEqual(lockedSave.errorCode, 'locked', 'saveCredential fails closed while vault is locked');

    const sessionDump = storageSession._dump();
    assert(!sessionDump.fsbCredentialVaultSessionKey, 'locking removes the session key from chrome.storage.session');
  }

  console.log('\n--- subdomain matching policy ---');
  {
    const { secureConfig } = loadSecureConfig();
    await secureConfig.createCredentialVault('vault-passphrase');

    await secureConfig.saveCredential('example.com', {
      username: 'parent-user',
      password: 'parent-pass',
      allowSubdomains: false
    });

    const noSubdomainMatch = await secureConfig.getCredential('login.example.com');
    assert(noSubdomainMatch === null, 'parent-domain credentials do not match subdomains by default');

    await secureConfig.updateCredential('example.com', { allowSubdomains: true });
    const subdomainMatch = await secureConfig.getCredential('login.example.com');
    assertEqual(subdomainMatch.username, 'parent-user', 'allowSubdomains enables parent-domain matching');
  }

  console.log('\n--- legacy migration ---');
  {
    const { secureConfig, storageLocal } = loadSecureConfig();
    const legacyPayload = {
      username: 'legacy-user',
      password: 'legacy-pass',
      notes: '',
      domain: 'legacy.example.com',
      createdAt: 123,
      updatedAt: 456
    };
    const legacyEncrypted = await secureConfig.encrypt(
      JSON.stringify(legacyPayload),
      secureConfig.getLegacyCredentialPassword()
    );
    await storageLocal.set({ 'cred_legacy.example.com': legacyEncrypted });

    const setup = await secureConfig.createCredentialVault('vault-passphrase');
    assertEqual(setup.migratedCount, 1, 'creating the vault migrates legacy credential entries');

    const migratedCredential = await secureConfig.getCredential('legacy.example.com');
    assertEqual(migratedCredential.username, 'legacy-user', 'migrated credential remains readable with the vault key');
    assertEqual(migratedCredential.allowSubdomains, false, 'migration normalizes allowSubdomains to false');

    const rawStore = storageLocal._dump();
    let legacyDecryptFailed = false;
    try {
      await secureConfig.decrypt(rawStore['cred_legacy.example.com'], secureConfig.getLegacyCredentialPassword());
    } catch (_error) {
      legacyDecryptFailed = true;
    }
    assert(legacyDecryptFailed, 'migrated credentials are no longer decryptable with the legacy fallback key');
  }

  console.log('\n--- payment methods require separate unlock ---');
  {
    const { secureConfig, storageSession } = loadSecureConfig();
    await secureConfig.createCredentialVault('vault-passphrase');

    const initialStatus = await secureConfig.getPaymentVaultStatus();
    assert(initialStatus.configured && initialStatus.unlocked && !initialStatus.paymentUnlocked, 'payment vault status starts locked even when the credential vault is unlocked');

    const lockedSave = await secureConfig.savePaymentMethod({
      nickname: 'Primary Visa',
      cardholderName: 'Test User',
      cardNumber: '4111111111111111',
      expiryMonth: '07',
      expiryYear: '2029',
      cvv: '123',
      billingName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Chicago',
      stateRegion: 'IL',
      postalCode: '60601',
      country: 'United States'
    });
    assertEqual(lockedSave.errorCode, 'payment_locked', 'savePaymentMethod fails closed until saved payment methods are explicitly unlocked');

    const wrongPassphrase = await secureConfig.unlockPaymentMethods('wrong-passphrase');
    assertEqual(wrongPassphrase.errorCode, 'invalid_passphrase', 'unlockPaymentMethods rejects an incorrect passphrase');

    const unlock = await secureConfig.unlockPaymentMethods('vault-passphrase');
    assert(unlock.success, 'unlockPaymentMethods succeeds with the vault passphrase');

    const saved = await secureConfig.savePaymentMethod({
      nickname: 'Primary Visa',
      cardholderName: 'Test User',
      cardNumber: '4111111111111111',
      expiryMonth: '07',
      expiryYear: '2029',
      cvv: '123',
      billingName: 'Test User',
      addressLine1: '123 Main St',
      addressLine2: 'Suite 400',
      city: 'Chicago',
      stateRegion: 'IL',
      postalCode: '60601',
      country: 'United States'
    });
    assert(saved.success, 'savePaymentMethod succeeds once saved payment methods are unlocked');

    const metadata = await secureConfig.getAllPaymentMethods();
    assertEqual(metadata.length, 1, 'getAllPaymentMethods returns one saved card');
    assert(!('cardNumber' in metadata[0]), 'payment metadata list does not expose raw card numbers');
    assert(!('cvv' in metadata[0]), 'payment metadata list does not expose CVV');
    assertEqual(metadata[0].cardBrand, 'visa', 'payment metadata includes detected card brand');
    assertEqual(metadata[0].last4, '1111', 'payment metadata includes last four digits');

    const full = await secureConfig.getFullPaymentMethod(saved.id);
    assertEqual(full.cardNumber, '4111111111111111', 'getFullPaymentMethod returns the stored card number while payment access is unlocked');
    assertEqual(full.cvv, '123', 'getFullPaymentMethod returns the stored CVV while payment access is unlocked');

    await secureConfig.lockPaymentMethods();
    const lockedStatus = await secureConfig.getPaymentVaultStatus();
    assert(lockedStatus.unlocked && !lockedStatus.paymentUnlocked, 'lockPaymentMethods clears the separate payment access gate');

    const lockedUpdate = await secureConfig.updatePaymentMethod(saved.id, { nickname: 'Updated' });
    assertEqual(lockedUpdate.errorCode, 'payment_locked', 'updatePaymentMethod fails closed while payment access is locked');

    const sessionDump = storageSession._dump();
    assert(!sessionDump.fsbPaymentAccessUnlocked, 'locking payment methods removes the separate payment-access session flag');
  }

  console.log('\n--- payment access resets when the credential vault locks ---');
  {
    const { secureConfig, storageSession } = loadSecureConfig();
    await secureConfig.createCredentialVault('vault-passphrase');
    await secureConfig.unlockPaymentMethods('vault-passphrase');
    await secureConfig.lockCredentialVault();

    const status = await secureConfig.getPaymentVaultStatus();
    assert(status.configured && !status.unlocked && !status.paymentUnlocked, 'locking the credential vault also clears saved payment method access');

    const sessionDump = storageSession._dump();
    assert(!sessionDump.fsbCredentialVaultSessionKey, 'credential vault session key is cleared after lock');
    assert(!sessionDump.fsbPaymentAccessUnlocked, 'payment access flag is cleared when the credential vault locks');
  }

  console.log('\n--- payment card brand and validation helpers ---');
  {
    const { secureConfig } = loadSecureConfig();
    assertEqual(secureConfig.detectCardBrand('4111111111111111'), 'visa', 'detectCardBrand identifies Visa numbers');
    assertEqual(secureConfig.detectCardBrand('5555555555554444'), 'mastercard', 'detectCardBrand identifies Mastercard numbers');
    assertEqual(secureConfig.detectCardBrand('378282246310005'), 'amex', 'detectCardBrand identifies American Express numbers');
    assertEqual(secureConfig.getMaskedCardNumber('4111111111111111'), '**** **** **** 1111', 'getMaskedCardNumber preserves only the last four digits');
    assert(secureConfig.isValidCardNumber('4111111111111111'), 'isValidCardNumber accepts a valid Luhn card number');
    assert(!secureConfig.isValidCardNumber('4111111111111112'), 'isValidCardNumber rejects an invalid Luhn card number');
  }

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
