/**
 * Unit tests for Storage Manager
 * Tests AES-256-GCM encryption and LRU cache
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock Web Crypto API
global.crypto = {
  subtle: {
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn()
  },
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

// Mock navigator
global.navigator = {
  userAgent: 'Test Browser',
  language: 'en-US'
};

global.screen = {
  width: 1920,
  height: 1080
};

// Import module to test
const fs = require('fs');
const path = require('path');
const storageCode = fs.readFileSync(
  path.join(__dirname, '../../../extension/lib/storage.js'),
  'utf-8'
);

// Execute in context to get StorageManager
eval(storageCode.replace('export class', 'class'));

describe('StorageManager', () => {
  let storage;

  beforeEach(() => {
    storage = new StorageManager();
    jest.clearAllMocks();
  });

  describe('Encryption Key Derivation', () => {
    test('should generate encryption key from device fingerprint', async () => {
      // Mock key material
      const mockKeyMaterial = {};
      const mockDerivedKey = {};

      crypto.subtle.importKey.mockResolvedValue(mockKeyMaterial);
      crypto.subtle.deriveKey.mockResolvedValue(mockDerivedKey);

      const key = await storage.getEncryptionKey();

      expect(crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      expect(crypto.subtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          iterations: 100000,
          hash: 'SHA-256'
        }),
        mockKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      expect(key).toBe(mockDerivedKey);
    });

    test('should cache encryption key after first generation', async () => {
      const mockKey = {};
      crypto.subtle.deriveKey.mockResolvedValue(mockKey);

      const key1 = await storage.getEncryptionKey();
      const key2 = await storage.getEncryptionKey();

      expect(key1).toBe(key2);
      // Should only derive once, then reuse
      expect(crypto.subtle.deriveKey).toHaveBeenCalledTimes(1);
    });
  });

  describe('API Key Encryption', () => {
    beforeEach(() => {
      // Mock encryption key
      const mockKey = {};
      crypto.subtle.deriveKey.mockResolvedValue(mockKey);
    });

    test('should encrypt API keys using AES-256-GCM', async () => {
      const mockCiphertext = new ArrayBuffer(32);
      crypto.subtle.encrypt.mockResolvedValue(mockCiphertext);

      const apiKeys = {
        gemini: 'test-api-key-123',
        google: 'google-api-key-456'
      };

      const encrypted = await storage.encryptApiKeys(apiKeys);

      expect(crypto.subtle.encrypt).toHaveBeenCalledTimes(2);
      expect(crypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array)
        }),
        expect.anything(),
        expect.any(Uint8Array)
      );

      // Should return encrypted keys with iv:ciphertext format
      expect(encrypted.gemini).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
      expect(encrypted.google).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    });

    test('should handle empty API keys', async () => {
      const apiKeys = {
        gemini: '',
        google: null
      };

      const encrypted = await storage.encryptApiKeys(apiKeys);

      expect(crypto.subtle.encrypt).not.toHaveBeenCalled();
      expect(encrypted).toEqual({});
    });

    test('should fallback to legacy format on encryption failure', async () => {
      crypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'));

      const apiKeys = { gemini: 'test-key' };
      const encrypted = await storage.encryptApiKeys(apiKeys);

      // Should fallback to legacy base64
      expect(encrypted.gemini).toMatch(/^legacy:/);
    });
  });

  describe('API Key Decryption', () => {
    beforeEach(() => {
      const mockKey = {};
      crypto.subtle.deriveKey.mockResolvedValue(mockKey);
    });

    test('should decrypt AES-256-GCM encrypted keys', async () => {
      const mockDecrypted = new ArrayBuffer(16);
      const mockDataView = new Uint8Array(mockDecrypted);
      mockDataView.set([116, 101, 115, 116]); // 'test' in ASCII

      crypto.subtle.decrypt.mockResolvedValue(mockDecrypted);

      const encryptedKeys = {
        gemini: 'aXY=:Y2lwaGVydGV4dA==' // Mock iv:ciphertext
      };

      const decrypted = await storage.decryptApiKeys(encryptedKeys);

      expect(crypto.subtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array)
        }),
        expect.anything(),
        expect.any(Uint8Array)
      );

      expect(decrypted.gemini).toBeDefined();
    });

    test('should handle legacy base64 format', async () => {
      const encryptedKeys = {
        gemini: 'legacy:dGVzdC1rZXk=' // base64 of 'test-key'
      };

      const decrypted = await storage.decryptApiKeys(encryptedKeys);

      expect(decrypted.gemini).toBe('test-key');
      expect(crypto.subtle.decrypt).not.toHaveBeenCalled();
    });

    test('should handle old base64-only format', async () => {
      const encryptedKeys = {
        gemini: 'dGVzdC1rZXk=' // base64 of 'test-key' (no prefix)
      };

      const decrypted = await storage.decryptApiKeys(encryptedKeys);

      expect(decrypted.gemini).toBe('test-key');
      expect(crypto.subtle.decrypt).not.toHaveBeenCalled();
    });

    test('should return null on decryption failure', async () => {
      crypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      const encryptedKeys = {
        gemini: 'iv:ciphertext'
      };

      const decrypted = await storage.decryptApiKeys(encryptedKeys);

      expect(decrypted.gemini).toBeNull();
    });
  });

  describe('LRU Cache', () => {
    test('should add entries to cache', async () => {
      chrome.storage.local.get.mockResolvedValue({
        translationCache: {},
        cacheMeta: { accessOrder: [] }
      });
      chrome.storage.local.set.mockResolvedValue();

      await storage.addToCache('hash1', {
        translation: 'translated text',
        engine: 'gemini'
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          translationCache: expect.objectContaining({
            hash1: expect.objectContaining({
              translation: 'translated text',
              engine: 'gemini',
              timestamp: expect.any(Number)
            })
          }),
          cacheMeta: {
            accessOrder: ['hash1']
          }
        })
      );
    });

    test('should update access order when entry already exists', async () => {
      chrome.storage.local.get.mockResolvedValue({
        translationCache: {
          hash1: { translation: 'old' },
          hash2: { translation: 'text2' }
        },
        cacheMeta: { accessOrder: ['hash1', 'hash2'] }
      });

      await storage.addToCache('hash1', { translation: 'updated' });

      const call = chrome.storage.local.set.mock.calls[0][0];
      expect(call.cacheMeta.accessOrder).toEqual(['hash2', 'hash1']);
    });

    test('should evict oldest entries when limit exceeded', async () => {
      const oldEntries = {};
      const oldOrder = [];

      // Create 1000 existing entries
      for (let i = 0; i < 1000; i++) {
        const hash = `hash${i}`;
        oldEntries[hash] = { translation: `text${i}` };
        oldOrder.push(hash);
      }

      chrome.storage.local.get.mockResolvedValue({
        translationCache: oldEntries,
        cacheMeta: { accessOrder: oldOrder }
      });

      await storage.addToCache('hash1000', { translation: 'new' });

      const call = chrome.storage.local.set.mock.calls[0][0];

      // Should remove hash0 (oldest)
      expect(call.translationCache.hash0).toBeUndefined();
      expect(call.translationCache.hash1000).toBeDefined();
      expect(call.cacheMeta.accessOrder).toHaveLength(1000);
      expect(call.cacheMeta.accessOrder[999]).toBe('hash1000');
    });

    test('should retrieve entry from cache', async () => {
      const now = Date.now();
      chrome.storage.local.get.mockResolvedValue({
        translationCache: {
          hash1: {
            translation: 'cached text',
            engine: 'gemini',
            timestamp: now
          }
        }
      });

      const result = await storage.getFromCache('hash1');

      expect(result).toEqual({
        translation: 'cached text',
        engine: 'gemini',
        timestamp: now
      });
    });

    test('should return null for expired cache entries', async () => {
      const sevenDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      chrome.storage.local.get.mockResolvedValue({
        translationCache: {
          hash1: {
            translation: 'old text',
            timestamp: sevenDaysAgo
          }
        }
      });

      const result = await storage.getFromCache('hash1');

      expect(result).toBeNull();
    });
  });

  describe('Base64 Conversion', () => {
    test('should convert ArrayBuffer to Base64', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]); // 'Hello'
      const base64 = storage.arrayBufferToBase64(buffer);

      expect(base64).toBe('SGVsbG8=');
    });

    test('should convert Base64 to ArrayBuffer', () => {
      const base64 = 'SGVsbG8='; // 'Hello'
      const buffer = storage.base64ToArrayBuffer(base64);

      expect(buffer).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    test('should roundtrip ArrayBuffer ↔ Base64', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255]);
      const base64 = storage.arrayBufferToBase64(original);
      const restored = storage.base64ToArrayBuffer(base64);

      expect(restored).toEqual(original);
    });
  });
});
