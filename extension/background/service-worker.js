/**
 * Background Service Worker for Chrome Smart Translation Assistant
 * Handles API calls, message routing, and storage management
 */

import { StorageManager } from '../lib/storage.js';
import { MessageRouter } from '../lib/message-router.js';
import { TranslationAPI } from '../lib/translation-api.js';

// Initialize managers
const storage = new StorageManager();
const messageRouter = new MessageRouter();
const translationAPI = new TranslationAPI();

// Service worker lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Initialize default settings
    await storage.initializeDefaults();

    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html?welcome=true')
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async responses
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender) {
  const { action, data } = message;

  try {
    switch (action) {
      case 'GET_SETTINGS':
        return await storage.getSettings();

      case 'UPDATE_SETTINGS':
        await storage.updateSettings(data);
        return { success: true };

      case 'TRANSLATE_TEXT':
        // Get user settings
        const settings = await storage.getSettings();
        const result = await translationAPI.translate({
          ...data,
          settings: settings.preferences
        });
        // Update statistics
        await storage.updateStatistics(result.totalChars);
        // Cache translations
        for (const trans of result.translations) {
          if (!trans.error && !trans.mock) {
            await storage.addToCache(trans.hash, {
              translation: trans.translation,
              engine: trans.engine
            });
          }
        }
        return { success: true, result };

      case 'VALIDATE_API_KEY':
        const isValid = await translationAPI.validateKey(data.key, data.engine);
        return { success: true, isValid };

      case 'GET_STATISTICS':
        return await storage.getStatistics();

      case 'GET_FROM_CACHE':
        const cached = await storage.getFromCache(data.hash);
        return { success: true, result: cached };

      case 'ADD_TO_CACHE':
        await storage.addToCache(data.hash, data.translation);
        return { success: true };

      default:
        console.warn('Unknown action:', action);
        return { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { success: false, error: error.message };
  }
}

// Context menu setup (optional)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate selection',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'TRANSLATE_SELECTION',
      data: { text: info.selectionText }
    });
  }
});

console.log('Background service worker loaded');
