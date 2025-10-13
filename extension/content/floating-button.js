class FloatingButton {
  constructor() {
    this.container = null;
    this.button = null;
    this.panel = null;
    this.state = 'idle';
    this.progress = 0;
    this.stats = null;
  }

  inject() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'csta-floating-container';

    this.button = this.createButton();
    this.panel = this.createPanel();

    this.container.appendChild(this.button);
    this.container.appendChild(this.panel);

    document.body.appendChild(this.container);

    this.attachEventListeners();

    console.log('Floating button injected');
  }

  createButton() {
    const button = document.createElement('button');
    button.id = 'csta-floating-button';
    button.className = 'csta-btn csta-btn-idle';
    button.setAttribute('aria-label', 'Smart Translator');
    button.setAttribute('title', 'Click to translate page');

    button.innerHTML = `
      <svg class="csta-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
        <path d="M12 8v8m-4-4h8"/>
      </svg>
      <div class="csta-btn-progress-ring">
        <svg viewBox="0 0 36 36">
          <path class="csta-progress-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="csta-progress-bar" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
      </div>
      <span class="csta-btn-progress-text"></span>
    `;

    return button;
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'csta-floating-panel';
    panel.className = 'csta-panel csta-panel-hidden';

    panel.innerHTML = `
      <div class="csta-panel-header">
        <h3>🌐 Smart Translator</h3>
        <button class="csta-panel-close" aria-label="Close panel">×</button>
      </div>

      <div class="csta-panel-body">
        <div class="csta-status-section">
          <div class="csta-status-label">Status:</div>
          <div class="csta-status-value">
            <span class="csta-status-icon">⚪</span>
            <span class="csta-status-text">Ready</span>
          </div>
        </div>

        <div class="csta-controls-section">
          <button class="csta-control-btn csta-btn-translate">
            <span class="csta-btn-icon">🌐</span>
            Translate Page
          </button>
          <button class="csta-control-btn csta-btn-toggle" disabled>
            <span class="csta-btn-icon">⇄</span>
            Toggle Display
          </button>
          <button class="csta-control-btn csta-btn-retranslate" disabled>
            <span class="csta-btn-icon">🔄</span>
            Retranslate
          </button>
        </div>

        <div class="csta-info-section">
          <div class="csta-info-item">
            <span class="csta-info-label">Engine:</span>
            <span class="csta-info-value csta-engine">-</span>
          </div>
          <div class="csta-info-item">
            <span class="csta-info-label">Language:</span>
            <span class="csta-info-value csta-language">-</span>
          </div>
          <div class="csta-info-item">
            <span class="csta-info-label">Translated:</span>
            <span class="csta-info-value csta-count">0</span>
          </div>
        </div>
      </div>

      <div class="csta-panel-footer">
        <button class="csta-footer-btn csta-btn-settings">
          <span>⚙️</span> Settings
        </button>
        <button class="csta-footer-btn csta-btn-stats">
          <span>📊</span> Stats
        </button>
      </div>
    `;

    return panel;
  }

  attachEventListeners() {
    this.button.addEventListener('click', () => this.handleButtonClick());

    const closeBtn = this.panel.querySelector('.csta-panel-close');
    closeBtn.addEventListener('click', () => this.closePanel());

    const translateBtn = this.panel.querySelector('.csta-btn-translate');
    translateBtn.addEventListener('click', () => this.translate());

    const toggleBtn = this.panel.querySelector('.csta-btn-toggle');
    toggleBtn.addEventListener('click', () => this.toggleTranslations());

    const retranslateBtn = this.panel.querySelector('.csta-btn-retranslate');
    retranslateBtn.addEventListener('click', () => this.retranslate());

    const settingsBtn = this.panel.querySelector('.csta-btn-settings');
    settingsBtn.addEventListener('click', () => this.openSettings());

    const statsBtn = this.panel.querySelector('.csta-btn-stats');
    statsBtn.addEventListener('click', () => this.openStats());

    document.addEventListener('click', (e) => this.handleOutsideClick(e));
  }

  handleButtonClick() {
    if (this.state === 'idle') {
      this.translate();
    } else if (this.state === 'translated') {
      this.togglePanel();
    } else if (this.state === 'translating') {
      this.togglePanel();
    } else if (this.state === 'error') {
      this.retranslate();
    }
  }

  togglePanel() {
    const isHidden = this.panel.classList.contains('csta-panel-hidden');

    if (isHidden) {
      this.panel.classList.remove('csta-panel-hidden');
      this.updatePanelContent();
    } else {
      this.closePanel();
    }
  }

  closePanel() {
    this.panel.classList.add('csta-panel-hidden');
  }

  handleOutsideClick(event) {
    if (!this.container.contains(event.target)) {
      this.closePanel();
    }
  }

  async translate() {
    this.setState('translating');
    this.closePanel();

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TRANSLATE_PAGE'
      });

      if (response.success) {
        this.setState('translated');
        await this.updateStats();
      } else {
        this.setState('error');
        console.error('Translation failed:', response.error);
      }
    } catch (error) {
      this.setState('error');
      console.error('Translation request failed:', error);
    }
  }

  async toggleTranslations() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TOGGLE_TRANSLATIONS'
      });

      if (response.success) {
        await this.updateStats();
        this.updatePanelContent();
      }
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  }

  async retranslate() {
    await chrome.runtime.sendMessage({ action: 'CLEAR_TRANSLATIONS' });
    this.translate();
  }

  async updateStats() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'GET_STATS'
      });

      if (response.success) {
        this.stats = response.stats;
        this.updatePanelContent();
      }
    } catch (error) {
      console.error('Failed to get stats:', error);
    }
  }

  updatePanelContent() {
    if (!this.stats) return;

    const countEl = this.panel.querySelector('.csta-count');
    countEl.textContent = this.stats.total || 0;

    const statusText = this.panel.querySelector('.csta-status-text');
    const statusIcon = this.panel.querySelector('.csta-status-icon');

    if (this.state === 'translated') {
      statusText.textContent = `Translated (${this.stats.visible} visible)`;
      statusIcon.textContent = '✓';
    }

    const toggleBtn = this.panel.querySelector('.csta-btn-toggle');
    const retranslateBtn = this.panel.querySelector('.csta-btn-retranslate');

    if (this.state === 'translated') {
      toggleBtn.disabled = false;
      retranslateBtn.disabled = false;
    } else {
      toggleBtn.disabled = true;
      retranslateBtn.disabled = true;
    }
  }

  setState(newState) {
    this.state = newState;

    this.button.className = `csta-btn csta-btn-${newState}`;

    const statusText = this.panel.querySelector('.csta-status-text');
    const statusIcon = this.panel.querySelector('.csta-status-icon');
    const translateBtn = this.panel.querySelector('.csta-btn-translate');

    switch (newState) {
      case 'idle':
        this.button.setAttribute('title', 'Click to translate page');
        statusText.textContent = 'Ready';
        statusIcon.textContent = '⚪';
        translateBtn.disabled = false;
        this.setProgress(0);
        break;

      case 'translating':
        this.button.setAttribute('title', 'Translating...');
        statusText.textContent = 'Translating...';
        statusIcon.textContent = '⏳';
        translateBtn.disabled = true;
        this.simulateProgress();
        break;

      case 'translated':
        this.button.setAttribute('title', 'Translation complete (click to toggle)');
        statusText.textContent = 'Translated';
        statusIcon.textContent = '✓';
        translateBtn.disabled = true;
        this.setProgress(100);
        break;

      case 'error':
        this.button.setAttribute('title', 'Translation failed (click to retry)');
        statusText.textContent = 'Error occurred';
        statusIcon.textContent = '⚠️';
        translateBtn.disabled = false;
        this.setProgress(0);
        break;
    }
  }

  setProgress(percent) {
    this.progress = percent;

    const progressBar = this.button.querySelector('.csta-progress-bar');
    const progressText = this.button.querySelector('.csta-btn-progress-text');

    const circumference = 2 * Math.PI * 15.9155;
    const offset = circumference - (percent / 100) * circumference;

    progressBar.style.strokeDasharray = `${circumference} ${circumference}`;
    progressBar.style.strokeDashoffset = offset;

    if (percent > 0 && percent < 100) {
      progressText.textContent = `${Math.round(percent)}%`;
      progressText.style.display = 'block';
    } else {
      progressText.style.display = 'none';
    }
  }

  simulateProgress() {
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 15;

      if (progress >= 95) {
        progress = 95;
        clearInterval(interval);
      }

      this.setProgress(progress);
    }, 500);
  }

  openSettings() {
    chrome.runtime.sendMessage({
      action: 'OPEN_OPTIONS'
    });
  }

  openStats() {
    chrome.runtime.sendMessage({
      action: 'OPEN_OPTIONS',
      data: { tab: 'stats' }
    });
  }

  remove() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.button = null;
      this.panel = null;
    }
  }
}
