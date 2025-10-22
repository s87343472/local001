/**
 * Background Service Worker for Chrome Smart Translation Assistant
 * Handles API calls, message routing, and storage management
 */

import { StorageManager } from '../lib/storage.js';
import { MessageRouter } from '../lib/message-router-es6.js';
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

  // Create context menu (for all install reasons)
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate selection',
    contexts: ['selection']
  });
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
});

// ===================================================================
// MANIFEST V3 COMPLIANCE:
// Service workers are event-driven and ephemeral by design.
// They wake on events (messages, alarms, etc.) and sleep when idle.
// No manual keep-alive needed - previous code removed.
// ===================================================================

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

      case 'OPEN_OPTIONS':
        let url = chrome.runtime.getURL('options/options.html');
        if (data?.tab) {
          url += `?tab=${data.tab}`;
        }
        chrome.tabs.create({ url });
        return { success: true };

      case 'SHOW_NOTIFICATION':
        // Create user notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: data.iconUrl || chrome.runtime.getURL('assets/icon-48.png'),
          title: data.title,
          message: data.message,
          priority: data.type === 'error' ? 2 : 1
        });
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

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'translate-selection') {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'TRANSLATE_SELECTION',
        data: { text: info.selectionText }
      });

      if (response && response.success && response.result) {
        // Show translation result in a notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
          title: 'Translation Result',
          message: response.result.translation,
          contextMessage: `Original: ${info.selectionText.substring(0, 50)}${info.selectionText.length > 50 ? '...' : ''}`,
          priority: 1
        });
      } else {
        console.error('Translation failed:', response?.error);
        // Show error notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
          title: 'Translation Failed',
          message: response?.error || 'Could not translate selected text. Please try again.',
          priority: 2
        });
      }
    } catch (error) {
      console.error('Failed to translate selection:', error);
      // Content script might not be loaded on this page
      if (error.message && error.message.includes('not establish connection')) {
        console.warn('Content script not loaded on this page');
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
          title: 'Extension Not Active',
          message: 'Translation is not available on this page. Try reloading the page or use a different page.',
          priority: 1
        });
      } else {
        // Generic error notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
          title: 'Translation Error',
          message: error.message || 'An unexpected error occurred while translating.',
          priority: 2
        });
      }
    }
  }
});

console.log('Background service worker loaded');
