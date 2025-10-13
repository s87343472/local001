/**
 * Popup Script
 * Implements the popup interface functionality for Chrome Smart Translation Assistant
 */

import { MessageRouter } from '../lib/message-router.js';
import { StorageManager } from '../lib/storage.js';

console.log('Popup loaded - Chrome Smart Translation Assistant');

class PopupManager {
  constructor() {
    this.storage = new StorageManager();
    this.currentTab = null;
    this.translationState = 'idle'; // idle, translating, translated, error
    this.isBlacklisted = false;
    this.progressInterval = null;

    // UI Elements
    this.elements = {
      currentPage: document.getElementById('current-page'),
      statusSection: document.getElementById('status-section'),
      statusIcon: document.getElementById('status-icon'),
      statusText: document.getElementById('status-text'),
      progressSection: document.getElementById('progress-section'),
      progressFill: document.getElementById('progress-fill'),
      progressText: document.getElementById('progress-text'),
      btnTranslate: document.getElementById('btn-translate'),
      btnToggle: document.getElementById('btn-toggle'),
      quickEngine: document.getElementById('quick-engine'),
      quickLanguage: document.getElementById('quick-language'),
      statMonth: document.getElementById('stat-month'),
      btnSettings: document.getElementById('btn-settings'),
      btnStats: document.getElementById('btn-stats'),
      blacklistNotice: document.getElementById('blacklist-notice')
    };
  }

  /**
   * Static factory method to create and initialize PopupManager
   */
  static async create() {
    const manager = new PopupManager();
    await manager.init();
    return manager;
  }

  /**
   * Initialize the popup
   */
  async init() {
    try {
      // Get current active tab
      await this.getCurrentTab();

      // Load settings and populate quick settings
      await this.loadSettings();

      // Load statistics
      await this.loadStatistics();

      // Check if current page is blacklisted
      await this.checkBlacklist();

      // Query translation status from content script
      await this.queryTranslationStatus();

      // Setup event listeners
      this.setupEventListeners();

      console.log('Popup initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize popup');
    }
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          this.currentTab = tabs[0];
          this.updatePageInfo();
          resolve();
        } else {
          console.error('No active tab found');
          this.elements.currentPage.textContent = 'No active tab';
          resolve();
        }
      });
    });
  }

  /**
   * Update page information display
   */
  updatePageInfo() {
    if (!this.currentTab) return;

    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      const displayUrl = domain.length > 30 ? domain.substring(0, 27) + '...' : domain;
      this.elements.currentPage.textContent = displayUrl;
      this.elements.currentPage.title = this.currentTab.url;
    } catch (error) {
      console.error('Invalid URL:', this.currentTab.url);
      this.elements.currentPage.textContent = 'Invalid URL';
    }
  }

  /**
   * Load settings from storage and populate UI
   */
  async loadSettings() {
    try {
      const settings = await this.storage.getSettings();

      // Populate quick settings
      if (settings.preferences) {
        this.elements.quickEngine.value = settings.preferences.defaultEngine || 'gemini';
        this.elements.quickLanguage.value = settings.preferences.targetLanguage || 'zh-CN';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Load statistics from storage
   */
  async loadStatistics() {
    try {
      const stats = await this.storage.getStatistics();
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthlyChars = stats.monthlyUsage[monthKey] || 0;

      this.elements.statMonth.textContent = this.formatNumber(monthlyChars) + ' chars';
    } catch (error) {
      console.error('Failed to load statistics:', error);
      this.elements.statMonth.textContent = '0 chars';
    }
  }

  /**
   * Check if current page is blacklisted
   */
  async checkBlacklist() {
    if (!this.currentTab) return;

    try {
      const settings = await this.storage.getSettings();
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;

      this.isBlacklisted = settings.blacklist && settings.blacklist.some(
        blacklistDomain => domain.includes(blacklistDomain)
      );

      if (this.isBlacklisted) {
        this.elements.blacklistNotice.style.display = 'block';
        this.elements.btnTranslate.disabled = true;
        this.elements.btnToggle.disabled = true;
        this.updateStatus('disabled', '🚫', 'Translation disabled on this site');
      }
    } catch (error) {
      console.error('Failed to check blacklist:', error);
    }
  }

  /**
   * Query translation status from content script
   */
  async queryTranslationStatus() {
    if (!this.currentTab || this.isBlacklisted) return;

    try {
      // Try to get translation status from content script
      const response = await MessageRouter.sendToTab(this.currentTab.id, 'GET_STATS', {});

      if (response && response.result) {
        const stats = response.result.stats;
        if (stats.translatedCount > 0) {
          this.translationState = 'translated';
          this.elements.btnToggle.disabled = false;
          this.updateStatus('translated', '✅', `${stats.translatedCount} paragraphs translated`);
        }
      }
    } catch (error) {
      // Content script might not be loaded - this is normal
      console.log('Content script not available or not loaded yet');
      this.updateStatus('idle', '⚪', 'Ready to translate');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Translate button
    this.elements.btnTranslate.addEventListener('click', () => {
      this.handleTranslateClick();
    });

    // Toggle button
    this.elements.btnToggle.addEventListener('click', () => {
      this.handleToggleClick();
    });

    // Quick settings
    this.elements.quickEngine.addEventListener('change', () => {
      this.updateQuickSetting('defaultEngine', this.elements.quickEngine.value);
    });

    this.elements.quickLanguage.addEventListener('change', () => {
      this.updateQuickSetting('targetLanguage', this.elements.quickLanguage.value);
    });

    // Footer buttons
    this.elements.btnSettings.addEventListener('click', () => {
      this.openOptionsPage();
    });

    this.elements.btnStats.addEventListener('click', () => {
      this.openOptionsPage('stats');
    });
  }

  /**
   * Handle translate button click
   */
  async handleTranslateClick() {
    if (!this.currentTab || this.isBlacklisted || this.translationState === 'translating') {
      return;
    }

    try {
      this.translationState = 'translating';
      this.updateStatus('translating', '🔄', 'Translating page...');
      this.elements.btnTranslate.disabled = true;
      this.showProgress();

      // Send translate message to content script
      const response = await MessageRouter.sendToTab(this.currentTab.id, 'TRANSLATE_PAGE', {});

      if (response && response.success) {
        this.translationState = 'translated';
        this.elements.btnToggle.disabled = false;
        this.updateStatus('translated', '✅', 'Translation complete');

        // Reload statistics
        await this.loadStatistics();
      } else {
        throw new Error(response?.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation failed:', error);
      this.translationState = 'error';
      this.updateStatus('error', '❌', error.message.includes('Could not establish connection')
        ? 'Please refresh the page and try again'
        : 'Translation failed'
      );
    } finally {
      this.elements.btnTranslate.disabled = false;
      this.hideProgress();
    }
  }

  /**
   * Handle toggle visibility button click
   */
  async handleToggleClick() {
    if (!this.currentTab || this.translationState !== 'translated') {
      return;
    }

    try {
      const response = await MessageRouter.sendToTab(this.currentTab.id, 'TOGGLE_TRANSLATIONS', {});

      if (response && response.success) {
        const isVisible = response.isVisible;
        this.updateStatus('translated', '✅',
          isVisible ? 'Translations visible' : 'Translations hidden'
        );

        // Update toggle button text
        const btnText = this.elements.btnToggle.querySelector('.btn-text');
        if (btnText) {
          btnText.textContent = isVisible ? 'Hide Translations' : 'Show Translations';
        }
      }
    } catch (error) {
      console.error('Toggle failed:', error);
      this.showError('Failed to toggle translations');
    }
  }

  /**
   * Update quick setting
   */
  async updateQuickSetting(key, value) {
    try {
      const updates = {
        preferences: {
          [key]: value
        }
      };

      // Get current settings first to merge
      const currentSettings = await this.storage.getSettings();
      updates.preferences = {
        ...currentSettings.preferences,
        [key]: value
      };

      await this.storage.updateSettings(updates);
      console.log(`Updated ${key}:`, value);
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  }

  /**
   * Update status display
   */
  updateStatus(state, icon, text) {
    this.elements.statusIcon.textContent = icon;
    this.elements.statusText.textContent = text;

    // Update status section class for styling
    this.elements.statusSection.className = `status-section status-${state}`;
  }

  /**
   * Show progress bar with animation
   */
  showProgress() {
    this.elements.progressSection.style.display = 'block';
    this.elements.progressFill.style.width = '0%';
    this.elements.progressText.textContent = 'Translating 0%';

    // Simulate progress for better UX
    let progress = 0;
    this.progressInterval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90; // Stop at 90% until actual completion

      this.elements.progressFill.style.width = progress + '%';
      this.elements.progressText.textContent = `Translating ${Math.round(progress)}%`;
    }, 200);
  }

  /**
   * Hide progress bar
   */
  hideProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    // Complete the progress bar
    this.elements.progressFill.style.width = '100%';
    this.elements.progressText.textContent = 'Complete 100%';

    setTimeout(() => {
      this.elements.progressSection.style.display = 'none';
    }, 1000);
  }

  /**
   * Show error message
   */
  showError(message) {
    this.updateStatus('error', '❌', message);
  }

  /**
   * Format numbers with commas
   */
  formatNumber(num) {
    return num.toLocaleString();
  }

  /**
   * Open options page
   */
  openOptionsPage(section = '') {
    const url = chrome.runtime.getURL(`options/options.html${section ? '#' + section : ''}`);
    chrome.tabs.create({ url });
    window.close();
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await PopupManager.create();
      console.log('Popup initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
    }
  });
} else {
  PopupManager.create().then(() => {
    console.log('Popup initialized successfully');
  }).catch(error => {
    console.error('Failed to initialize popup:', error);
  });
}