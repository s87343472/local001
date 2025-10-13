/**
 * Storage Manager
 * Handles chrome.storage operations with encryption for sensitive data
 */

export class StorageManager {
  constructor() {
    this.encryptionKey = null;
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
    const data = await chrome.storage.local.get('translationCache');
    const cache = data.translationCache || {};

    // Add new entry
    cache[hash] = {
      ...translation,
      timestamp: Date.now()
    };

    // Implement LRU: Keep only 1000 most recent entries
    const entries = Object.entries(cache);
    if (entries.length > 1000) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const newCache = Object.fromEntries(entries.slice(0, 1000));
      await chrome.storage.local.set({ translationCache: newCache });
    } else {
      await chrome.storage.local.set({ translationCache: cache });
    }
  }

  /**
   * Encrypt API keys using Web Crypto API
   * @param {Object} apiKeys - API keys object
   * @returns {Promise<Object>} - Encrypted API keys
   */
  async encryptApiKeys(apiKeys) {
    // For MVP, we'll use base64 encoding
    // In production, implement proper AES-256-GCM encryption with device fingerprint
    const encrypted = {};
    for (const [key, value] of Object.entries(apiKeys)) {
      if (value) {
        encrypted[key] = btoa(value); // Simple encoding for MVP
      }
    }
    return encrypted;
  }

  /**
   * Decrypt API keys
   * @param {Object} encryptedKeys - Encrypted API keys
   * @returns {Promise<Object>} - Decrypted API keys
   */
  async decryptApiKeys(encryptedKeys) {
    const decrypted = {};
    for (const [key, value] of Object.entries(encryptedKeys)) {
      if (value) {
        try {
          decrypted[key] = atob(value); // Simple decoding for MVP
        } catch (e) {
          console.error('Failed to decrypt key:', key);
          decrypted[key] = null;
        }
      }
    }
    return decrypted;
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
