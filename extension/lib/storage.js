/**
 * Storage Manager
 * Handles chrome.storage operations with encryption for sensitive data
 */

export class StorageManager {
  constructor() {
    this.encryptionKey = null;
    this.ENCRYPTION_SALT = 'csta-v1'; // Version-specific salt
  }

  /**
   * Generate encryption key from device fingerprint
   * @returns {Promise<CryptoKey>} - Encryption key
   */
  async getEncryptionKey() {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    // Use device-specific information as key material
    const keyMaterial = await this.getKeyMaterial();
    const salt = new TextEncoder().encode(this.ENCRYPTION_SALT);

    // Derive key using PBKDF2
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // not extractable
      ['encrypt', 'decrypt']
    );

    return this.encryptionKey;
  }

  /**
   * Get key material from device fingerprint
   * @returns {Promise<CryptoKey>} - Key material
   */
  async getKeyMaterial() {
    // Create device fingerprint from available information
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.width,
      screen.height
    ].join('|');

    const enc = new TextEncoder();
    const keyData = enc.encode(fingerprint);

    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
  }

  /**
   * Initialize default settings on first install
   */
  async initializeDefaults() {
    const defaults = {
      version: '0.1.0',
      preferences: {
        targetLanguage: 'zh-CN',
        defaultEngine: 'gemini',
        professionalDomain: 'computer',
        translationMode: 'smart',
        autoTranslate: false
      },
      displaySettings: {
        translationColor: '#666666',
        translationStyle: 'italic',
        fontSize: 100,
        paragraphSpacing: 4
      },
      blacklist: [
        'accounts.google.com',
        'login.live.com',
        'appleid.apple.com'
      ],
      statistics: {
        totalCharacters: 0,
        totalRequests: 0,
        lastUsedDate: null,
        monthlyUsage: {}
      }
    };

    await chrome.storage.sync.set(defaults);
    console.log('Default settings initialized');
  }

  /**
   * Get all settings
   * @returns {Promise<Object>} - All settings
   */
  async getSettings() {
    const data = await chrome.storage.sync.get(null);

    // Decrypt API keys if present
    if (data.apiKeys) {
      data.apiKeys = await this.decryptApiKeys(data.apiKeys);
    }

    return data;
  }

  /**
   * Update settings
   * @param {Object} updates - Settings to update
   */
  async updateSettings(updates) {
    // Encrypt API keys if present
    if (updates.apiKeys) {
      updates.apiKeys = await this.encryptApiKeys(updates.apiKeys);
    }

    await chrome.storage.sync.set(updates);
  }

  /**
   * Get statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getStatistics() {
    const data = await chrome.storage.local.get('statistics');
    return data.statistics || {
      totalCharacters: 0,
      totalRequests: 0,
      lastUsedDate: null,
      monthlyUsage: {}
    };
  }

  /**
   * Update statistics
   * @param {number} charCount - Number of characters translated
   */
  async updateStatistics(charCount) {
    const stats = await this.getStatistics();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    stats.totalCharacters += charCount;
    stats.totalRequests += 1;
    stats.lastUsedDate = now.toISOString();
    stats.monthlyUsage[monthKey] = (stats.monthlyUsage[monthKey] || 0) + charCount;

    await chrome.storage.local.set({ statistics: stats });
  }

  /**
   * Clear all statistics
   */
  async clearStatistics() {
    await chrome.storage.local.set({
      statistics: {
        totalCharacters: 0,
        totalRequests: 0,
        lastUsedDate: null,
        monthlyUsage: {}
      }
    });
  }

  /**
   * Get translation cache
   * @param {string} hash - The text hash
   * @returns {Promise<Object|null>} - Cached translation or null
   */
  async getFromCache(hash) {
    const data = await chrome.storage.local.get('translationCache');
    const cache = data.translationCache || {};

    if (cache[hash]) {
      const cached = cache[hash];
      // Check if cache is expired (7 days)
      const age = Date.now() - cached.timestamp;
      if (age < 7 * 24 * 60 * 60 * 1000) {
        return cached;
      }
    }

    return null;
  }

  /**
   * Store translation in cache
   * @param {string} hash - The text hash
   * @param {Object} translation - The translation data
   */
  async addToCache(hash, translation) {
    const data = await chrome.storage.local.get(['translationCache', 'cacheMeta']);
    const cache = data.translationCache || {};
    const meta = data.cacheMeta || { accessOrder: [] };

    // Update or add entry
    cache[hash] = {
      ...translation,
      timestamp: Date.now()
    };

    // Update LRU access order
    // Remove if already exists, then add to end (most recent)
    const index = meta.accessOrder.indexOf(hash);
    if (index > -1) {
      meta.accessOrder.splice(index, 1);
    }
    meta.accessOrder.push(hash);

    // Implement LRU: Keep only 1000 most recent entries
    if (meta.accessOrder.length > 1000) {
      // Remove oldest entries (from beginning of array)
      const toRemove = meta.accessOrder.slice(0, meta.accessOrder.length - 1000);
      for (const oldHash of toRemove) {
        delete cache[oldHash];
      }
      meta.accessOrder = meta.accessOrder.slice(-1000); // Keep last 1000
    }

    await chrome.storage.local.set({
      translationCache: cache,
      cacheMeta: meta
    });
  }

  /**
   * Encrypt API keys using AES-256-GCM
   * @param {Object} apiKeys - API keys object { gemini: 'key1', googleTranslate: 'key2' }
   * @returns {Promise<Object>} - Encrypted API keys with format { gemini: 'iv:ciphertext', ... }
   */
  async encryptApiKeys(apiKeys) {
    const encrypted = {};
    const key = await this.getEncryptionKey();

    for (const [keyName, plainKey] of Object.entries(apiKeys)) {
      if (!plainKey) continue;

      try {
        // Generate random IV (12 bytes for AES-GCM)
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt the API key
        const encoder = new TextEncoder();
        const data = encoder.encode(plainKey);

        const ciphertext = await crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          key,
          data
        );

        // Store as "iv:ciphertext" in base64
        const ivBase64 = this.arrayBufferToBase64(iv);
        const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);
        encrypted[keyName] = `${ivBase64}:${ciphertextBase64}`;

      } catch (error) {
        console.error(`Failed to encrypt API key '${keyName}':`, error);
        // Fall back to legacy base64 for compatibility
        encrypted[keyName] = `legacy:${btoa(plainKey)}`;
      }
    }

    return encrypted;
  }

  /**
   * Decrypt API keys using AES-256-GCM
   * @param {Object} encryptedKeys - Encrypted API keys
   * @returns {Promise<Object>} - Plain API keys
   */
  async decryptApiKeys(encryptedKeys) {
    const plain = {};
    const key = await this.getEncryptionKey();

    for (const [keyName, encryptedValue] of Object.entries(encryptedKeys)) {
      if (!encryptedValue) continue;

      try {
        // Check if this is legacy base64-only format
        if (encryptedValue.startsWith('legacy:')) {
          plain[keyName] = atob(encryptedValue.substring(7));
          continue;
        }

        // Check if this is old base64-only format (no prefix, no colon)
        if (!encryptedValue.includes(':')) {
          // Try to decode as base64 (legacy format)
          try {
            plain[keyName] = atob(encryptedValue);
            continue;
          } catch (e) {
            console.error(`Failed to decode legacy key '${keyName}':`, e);
            plain[keyName] = null;
            continue;
          }
        }

        // New encrypted format: "iv:ciphertext"
        const [ivBase64, ciphertextBase64] = encryptedValue.split(':');
        const iv = this.base64ToArrayBuffer(ivBase64);
        const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);

        const decrypted = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          key,
          ciphertext
        );

        const decoder = new TextDecoder();
        plain[keyName] = decoder.decode(decrypted);

      } catch (error) {
        console.error(`Failed to decrypt API key '${keyName}':`, error);
        plain[keyName] = null;
      }
    }

    return plain;
  }

  /**
   * Convert ArrayBuffer to Base64 string
   * @param {ArrayBuffer|Uint8Array} buffer - Buffer to convert
   * @returns {string} - Base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   * @param {string} base64 - Base64 string
   * @returns {Uint8Array} - Array buffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    await chrome.storage.local.remove('translationCache');
  }

  /**
   * Clear all data (for testing/debugging)
   */
  async clearAll() {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
  }
}
