/**
 * Options Script for Chrome Smart Translation Assistant
 * Implements settings page functionality with tab navigation, API configuration,
 * preferences management, display settings, blacklist, and statistics
 */

import { MessageRouter } from '../lib/message-router.js';

class OptionsManager {
  constructor() {
    this.currentSettings = null;
    this.isLoading = false;
    this.isDirty = false;
    // Don't call init() synchronously - wait for it to be called from DOMContentLoaded
  }

  /**
   * Static factory method to create and initialize OptionsManager
   */
  static async create() {
    const manager = new OptionsManager();
    await manager.init();
    return manager;
  }

  /**
   * Initialize the options page
   */
  async init() {
    console.log('[Options] Starting initialization...');
    try {
      console.log('[Options] Loading settings...');
      await this.loadSettings();

      console.log('[Options] Initializing tab navigation...');
      this.initializeTabNavigation();

      console.log('[Options] Initializing event listeners...');
      this.initializeEventListeners();

      console.log('[Options] Handling URL parameters...');
      this.handleURLParameters();

      // Show success message if coming from welcome
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('welcome')) {
        this.showStatus('Welcome! Please configure your API key to start translating.', 'info');
      }

      console.log('[Options] Initialization complete!');
    } catch (error) {
      console.error('[Options] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      this.isLoading = true;
      const response = await MessageRouter.sendToBackground('GET_SETTINGS');
      this.currentSettings = response.result || response;
      this.populateUI();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings. Please refresh the page.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      this.showStatus('Saving settings...', 'info');

      const settings = this.collectSettings();
      await MessageRouter.sendToBackground('UPDATE_SETTINGS', settings);

      this.currentSettings = { ...this.currentSettings, ...settings };
      this.isDirty = false;
      this.updateSaveButton();
      this.showStatus('Settings saved successfully!', 'success');

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        const statusEl = document.getElementById('save-status');
        if (statusEl && statusEl.textContent.includes('successfully')) {
          statusEl.textContent = '';
          statusEl.className = 'save-status';
        }
      }, 3000);

    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings. Please try again.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Collect current settings from UI
   */
  collectSettings() {
    const settings = {};

    // API Keys
    const geminiKey = document.getElementById('gemini-api-key').value.trim();
    const googleKey = document.getElementById('google-api-key').value.trim();

    if (geminiKey || googleKey) {
      settings.apiKeys = {};
      if (geminiKey) settings.apiKeys.gemini = geminiKey;
      if (googleKey) settings.apiKeys.google = googleKey;
    }

    // Preferences
    settings.preferences = {
      targetLanguage: document.getElementById('target-language').value,
      defaultEngine: document.querySelector('input[name="engine"]:checked').value,
      professionalDomain: document.getElementById('domain').value,
      translationMode: document.querySelector('input[name="mode"]:checked').value,
      autoTranslate: document.getElementById('auto-translate').checked
    };

    // Display Settings
    settings.displaySettings = {
      translationColor: document.getElementById('translation-color').value,
      translationStyle: document.getElementById('font-style').value,
      fontSize: parseInt(document.getElementById('font-size').value, 10)
    };

    // Blacklist
    const blacklistChips = document.querySelectorAll('#blacklist-container .chip');
    settings.blacklist = Array.from(blacklistChips).map(chip =>
      chip.querySelector('.chip-text').textContent
    );

    // Include preset blacklist if enabled
    const includePreset = document.getElementById('blacklist-preset').checked;
    if (includePreset) {
      const presetDomains = [
        'accounts.google.com', 'login.live.com', 'appleid.apple.com',
        'paypal.com', 'stripe.com', 'banking.com', 'wellsfargo.com',
        'chase.com', 'bankofamerica.com', 'citibank.com'
      ];
      settings.blacklist = [...new Set([...settings.blacklist, ...presetDomains])];
    }

    return settings;
  }

  /**
   * Populate UI with loaded settings
   */
  populateUI() {
    if (!this.currentSettings) return;

    // API Keys
    if (this.currentSettings.apiKeys) {
      if (this.currentSettings.apiKeys.gemini) {
        document.getElementById('gemini-api-key').value = this.currentSettings.apiKeys.gemini;
      }
      if (this.currentSettings.apiKeys.google) {
        document.getElementById('google-api-key').value = this.currentSettings.apiKeys.google;
      }
    }

    // Preferences
    const prefs = this.currentSettings.preferences || {};
    document.getElementById('target-language').value = prefs.targetLanguage || 'zh-CN';

    const engineRadio = document.querySelector(`input[name="engine"][value="${prefs.defaultEngine || 'gemini'}"]`);
    if (engineRadio) engineRadio.checked = true;

    document.getElementById('domain').value = prefs.professionalDomain || 'computer';

    const modeRadio = document.querySelector(`input[name="mode"][value="${prefs.translationMode || 'smart'}"]`);
    if (modeRadio) modeRadio.checked = true;

    document.getElementById('auto-translate').checked = prefs.autoTranslate || false;

    // Display Settings
    const display = this.currentSettings.displaySettings || {};
    const color = display.translationColor || '#666666';
    document.getElementById('translation-color').value = color;
    document.getElementById('translation-color-hex').value = color;
    document.getElementById('font-style').value = display.translationStyle || 'italic';
    document.getElementById('font-size').value = display.fontSize || 95;
    document.getElementById('font-size-value').textContent = `${display.fontSize || 95}%`;

    // Update preview
    this.updatePreview();

    // Blacklist
    const blacklist = this.currentSettings.blacklist || [];
    this.renderBlacklist(blacklist);

    // Load statistics
    this.loadStatistics();
  }

  /**
   * Initialize tab navigation
   */
  initializeTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTab = item.dataset.tab;

        // Update navigation
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Update content
        tabContents.forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) {
          targetContent.classList.add('active');
        }

        // Special handling for stats tab
        if (targetTab === 'stats') {
          this.loadStatistics();
        }
      });
    });
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    // API key toggles
    this.initAPIKeyToggles();

    // Validation
    this.initValidation();

    // Display settings
    this.initDisplaySettings();

    // Blacklist management
    this.initBlacklistManagement();

    // Statistics
    this.initStatistics();

    // Save button
    document.getElementById('save-settings').addEventListener('click', () => {
      this.saveSettings();
    });

    // Mark as dirty when settings change
    this.initDirtyTracking();
  }

  /**
   * Initialize API key show/hide toggles
   */
  initAPIKeyToggles() {
    document.getElementById('toggle-gemini-key').addEventListener('click', () => {
      const input = document.getElementById('gemini-api-key');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      document.getElementById('toggle-gemini-key').textContent = isPassword ? '🙈' : '👁️';
    });

    document.getElementById('toggle-google-key').addEventListener('click', () => {
      const input = document.getElementById('google-api-key');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      document.getElementById('toggle-google-key').textContent = isPassword ? '🙈' : '👁️';
    });
  }

  /**
   * Initialize validation
   */
  initValidation() {
    document.getElementById('validate-gemini-key').addEventListener('click', async () => {
      const key = document.getElementById('gemini-api-key').value.trim();
      const statusEl = document.getElementById('gemini-key-status');

      if (!key) {
        statusEl.textContent = 'Please enter an API key';
        statusEl.className = 'status-message error';
        return;
      }

      try {
        statusEl.textContent = 'Validating...';
        statusEl.className = 'status-message info';

        const response = await MessageRouter.sendToBackground('VALIDATE_API_KEY', {
          key,
          engine: 'gemini'
        });

        if (response.result?.isValid || response.isValid) {
          statusEl.textContent = '✓ API key is valid';
          statusEl.className = 'status-message success';
        } else {
          statusEl.textContent = '✗ API key is invalid';
          statusEl.className = 'status-message error';
        }
      } catch (error) {
        console.error('Validation error:', error);
        statusEl.textContent = '✗ Validation failed';
        statusEl.className = 'status-message error';
      }
    });

    // Color input validation
    document.getElementById('translation-color-hex').addEventListener('input', (e) => {
      const value = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        document.getElementById('translation-color').value = value;
        this.updatePreview();
        this.markDirty();
      }
    });
  }

  /**
   * Initialize display settings
   */
  initDisplaySettings() {
    // Color picker
    document.getElementById('translation-color').addEventListener('input', (e) => {
      document.getElementById('translation-color-hex').value = e.target.value;
      this.updatePreview();
      this.markDirty();
    });

    // Font style
    document.getElementById('font-style').addEventListener('change', () => {
      this.updatePreview();
      this.markDirty();
    });

    // Font size
    document.getElementById('font-size').addEventListener('input', (e) => {
      const value = e.target.value;
      document.getElementById('font-size-value').textContent = `${value}%`;
      this.updatePreview();
      this.markDirty();
    });
  }

  /**
   * Update live preview
   */
  updatePreview() {
    const color = document.getElementById('translation-color').value;
    const style = document.getElementById('font-style').value;
    const size = document.getElementById('font-size').value;

    const preview = document.getElementById('preview-translation');
    preview.style.color = color;
    preview.style.fontStyle = style;
    preview.style.fontSize = `${size}%`;
  }

  /**
   * Initialize blacklist management
   */
  initBlacklistManagement() {
    const input = document.getElementById('blacklist-input');
    const addBtn = document.getElementById('add-blacklist');

    const addDomain = () => {
      const domain = input.value.trim().toLowerCase();
      if (!domain) return;

      // Validate domain format
      if (!this.isValidDomain(domain)) {
        this.showStatus('Please enter a valid domain (e.g., example.com)', 'error');
        return;
      }

      // Check if already exists
      const existingChips = Array.from(document.querySelectorAll('#blacklist-container .chip-text'));
      if (existingChips.some(chip => chip.textContent === domain)) {
        this.showStatus('Domain already in blacklist', 'error');
        return;
      }

      this.addBlacklistChip(domain);
      input.value = '';
      this.markDirty();
    };

    addBtn.addEventListener('click', addDomain);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDomain();
      }
    });

    // Export/Import
    document.getElementById('export-blacklist').addEventListener('click', () => {
      this.exportBlacklist();
    });

    document.getElementById('import-blacklist').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importBlacklist(file);
      }
    });

    // Preset toggle
    document.getElementById('blacklist-preset').addEventListener('change', () => {
      this.markDirty();
    });
  }

  /**
   * Validate domain format
   */
  isValidDomain(domain) {
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  /**
   * Add blacklist chip to UI
   */
  addBlacklistChip(domain) {
    const container = document.getElementById('blacklist-container');
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `
      <span class="chip-text">${this.escapeHtml(domain)}</span>
      <button class="chip-remove" title="Remove">×</button>
    `;

    chip.querySelector('.chip-remove').addEventListener('click', () => {
      chip.remove();
      this.markDirty();
    });

    container.appendChild(chip);
  }

  /**
   * Render blacklist from array
   */
  renderBlacklist(domains) {
    const container = document.getElementById('blacklist-container');
    container.innerHTML = '';
    domains.forEach(domain => this.addBlacklistChip(domain));
  }

  /**
   * Export blacklist to JSON file
   */
  exportBlacklist() {
    const chips = document.querySelectorAll('#blacklist-container .chip-text');
    const domains = Array.from(chips).map(chip => chip.textContent);

    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      domains: domains
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-blacklist-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import blacklist from JSON file
   */
  async importBlacklist(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.domains || !Array.isArray(data.domains)) {
        throw new Error('Invalid file format');
      }

      const validDomains = data.domains.filter(domain =>
        typeof domain === 'string' && this.isValidDomain(domain.trim())
      );

      if (validDomains.length === 0) {
        this.showStatus('No valid domains found in file', 'error');
        return;
      }

      // Get existing domains
      const existingChips = Array.from(document.querySelectorAll('#blacklist-container .chip-text'));
      const existingDomains = new Set(existingChips.map(chip => chip.textContent));

      // Add new domains
      let addedCount = 0;
      validDomains.forEach(domain => {
        if (!existingDomains.has(domain)) {
          this.addBlacklistChip(domain);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        this.markDirty();
        this.showStatus(`Imported ${addedCount} domains`, 'success');
      } else {
        this.showStatus('All domains already exist in blacklist', 'info');
      }

    } catch (error) {
      console.error('Import error:', error);
      this.showStatus('Failed to import blacklist file', 'error');
    }
  }

  /**
   * Initialize statistics
   */
  initStatistics() {
    document.getElementById('clear-stats').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all statistics? This action cannot be undone.')) {
        this.clearStatistics();
      }
    });
  }

  /**
   * Load and display statistics
   */
  async loadStatistics() {
    try {
      const response = await MessageRouter.sendToBackground('GET_STATISTICS');
      const stats = response.result || response;

      // Calculate cache hit rate (mock for now)
      const cacheHitRate = stats.totalRequests > 0 ?
        Math.round((stats.totalRequests * 0.15) / stats.totalRequests * 100) : 0;

      // Current month usage
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthlyChars = stats.monthlyUsage?.[currentMonthKey] || 0;

      // Update UI
      document.getElementById('stat-total-chars').textContent = this.formatNumber(stats.totalCharacters || 0);
      document.getElementById('stat-total-requests').textContent = this.formatNumber(stats.totalRequests || 0);
      document.getElementById('stat-month-chars').textContent = this.formatNumber(monthlyChars);
      document.getElementById('stat-cache-hit').textContent = `${cacheHitRate}%`;

    } catch (error) {
      console.error('Failed to load statistics:', error);
      this.showStatus('Failed to load statistics', 'error');
    }
  }

  /**
   * Clear all statistics
   */
  async clearStatistics() {
    try {
      await MessageRouter.sendToBackground('UPDATE_SETTINGS', {
        statistics: {
          totalCharacters: 0,
          totalRequests: 0,
          lastUsedDate: null,
          monthlyUsage: {}
        }
      });

      // Refresh display
      this.loadStatistics();
      this.showStatus('Statistics cleared successfully', 'success');

    } catch (error) {
      console.error('Failed to clear statistics:', error);
      this.showStatus('Failed to clear statistics', 'error');
    }
  }

  /**
   * Initialize dirty tracking
   */
  initDirtyTracking() {
    // Track all form inputs
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.markDirty());
      input.addEventListener('change', () => this.markDirty());
    });
  }

  /**
   * Mark settings as dirty
   */
  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      this.updateSaveButton();
    }
  }

  /**
   * Update save button state
   */
  updateSaveButton() {
    const saveBtn = document.getElementById('save-settings');
    if (this.isLoading) {
      saveBtn.disabled = true;
      saveBtn.textContent = '💾 Saving...';
    } else if (this.isDirty) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Settings';
      saveBtn.style.background = '#007cba';
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = '✓ Saved';
      saveBtn.style.background = '#28a745';
    }
  }

  /**
   * Handle URL parameters for direct tab access
   */
  handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');

    if (tab) {
      const navItem = document.querySelector(`[data-tab="${tab}"]`);
      if (navItem) {
        navItem.click();
      }
    }
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = message;
    statusEl.className = `save-status ${type}`;

    // Auto-clear error messages after 5 seconds
    if (type === 'error') {
      setTimeout(() => {
        if (statusEl.textContent === message) {
          statusEl.textContent = '';
          statusEl.className = 'save-status';
        }
      }, 5000);
    }
  }

  /**
   * Format large numbers with commas
   */
  formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Error handler for module loading
window.addEventListener('error', (e) => {
  console.error('Global error:', e);
  if (e.message && e.message.includes('module')) {
    document.body.innerHTML = '<div style="padding: 40px; background: #f8d7da; color: #721c24; border-radius: 8px; margin: 20px; font-family: Arial, sans-serif;"><h2>⚠️ Settings Page Error</h2><p>Failed to load required modules. Please try:</p><ul><li>Refresh the page (Cmd/Ctrl + R)</li><li>Reload the extension from chrome://extensions/</li><li>Check browser console for details</li></ul></div>';
  }
});

console.log('Options module loaded successfully');

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('DOM ready, initializing OptionsManager...');
    await OptionsManager.create();
    console.log('OptionsManager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OptionsManager:', error);
    document.body.innerHTML = '<div style="padding: 40px; background: #f8d7da; color: #721c24; border-radius: 8px; margin: 20px; font-family: Arial, sans-serif;"><h2>⚠️ Initialization Error</h2><p>' + error.message + '</p><p>Error details: ' + error.stack + '</p><p>Please reload the extension and try again.</p></div>';
  }
});