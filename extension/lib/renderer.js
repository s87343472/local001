/**
 * Bilingual Rendering Engine
 * Progressive rendering with viewport detection and dynamic content support
 */

class BillingualRenderer {
  constructor() {
    this.observer = null;
    this.mutationObserver = null;
    this.isTranslationActive = false;
    this.renderedHashes = new Set();
  }

  /**
   * Render translations with progressive strategy
   * @param {Array} paragraphs - Paragraphs with translations
   * @returns {Promise<number>} - Number of rendered translations
   */
  async renderProgressive(paragraphs) {
    if (paragraphs.length === 0) return 0;

    // Step 1: Identify viewport-visible paragraphs
    const { visible, hidden } = this.categorizeByVisibility(paragraphs);

    console.log(`Progressive render: ${visible.length} visible, ${hidden.length} hidden`);

    // Step 2: Render visible paragraphs immediately (high priority)
    const visibleCount = this.renderBatch(visible);

    // Step 3: Render hidden paragraphs in background (low priority)
    if (hidden.length > 0) {
      // Use requestIdleCallback for non-blocking rendering
      this.renderInBackground(hidden);
    }

    return visibleCount;
  }

  /**
   * Categorize paragraphs by viewport visibility
   * @param {Array} paragraphs - All paragraphs
   * @returns {Object} - {visible, hidden}
   */
  categorizeByVisibility(paragraphs) {
    const visible = [];
    const hidden = [];

    for (const para of paragraphs) {
      if (!para.element) continue;

      if (this.isInViewport(para.element)) {
        visible.push(para);
      } else {
        hidden.push(para);
      }
    }

    return { visible, hidden };
  }

  /**
   * Check if element is in viewport
   * @param {Element} element - DOM element
   * @returns {boolean} - Is visible
   */
  isInViewport(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

    return (
      rect.top >= -100 && // Allow 100px buffer above
      rect.top <= windowHeight + 100 // Allow 100px buffer below
    );
  }

  /**
   * Render a batch of paragraphs
   * @param {Array} paragraphs - Paragraphs to render
   * @returns {number} - Number rendered
   */
  renderBatch(paragraphs) {
    let renderedCount = 0;

    // Use DocumentFragment for efficient batch insertion
    const fragments = new Map();

    for (const para of paragraphs) {
      if (!para.translation || !para.element) continue;

      // Skip if already rendered
      if (this.renderedHashes.has(para.hash)) continue;

      // Check if already has translation element
      const nextEl = para.element.nextElementSibling;
      if (nextEl && nextEl.classList.contains('csta-translation')) {
        this.renderedHashes.add(para.hash);
        continue;
      }

      // Create translation element
      const translationEl = this.createTranslationElement(para);

      // Get or create fragment for this parent
      const parent = para.element.parentNode;
      if (!fragments.has(parent)) {
        fragments.set(parent, { parent, elements: [] });
      }

      fragments.get(parent).elements.push({
        translation: translationEl,
        afterNode: para.element
      });

      // Mark original as translated
      para.element.setAttribute('data-translated', 'true');
      this.renderedHashes.add(para.hash);

      renderedCount++;
    }

    // Insert all fragments
    for (const { parent, elements } of fragments.values()) {
      for (const { translation, afterNode } of elements) {
        parent.insertBefore(translation, afterNode.nextSibling);
      }
    }

    return renderedCount;
  }

  /**
   * Render paragraphs in background (non-blocking)
   * @param {Array} paragraphs - Paragraphs to render
   */
  renderInBackground(paragraphs) {
    const batchSize = 5;
    let index = 0;

    const processBatch = (deadline) => {
      // Process while we have time
      while (index < paragraphs.length && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
        const batch = paragraphs.slice(index, index + batchSize);
        this.renderBatch(batch);
        index += batchSize;
      }

      // More work to do?
      if (index < paragraphs.length) {
        requestIdleCallback(processBatch, { timeout: 1000 });
      } else {
        console.log('Background rendering complete');
      }
    };

    requestIdleCallback(processBatch, { timeout: 1000 });
  }

  /**
   * Create translation DOM element
   * @param {Object} para - Paragraph object with translation
   * @returns {Element} - Translation element
   */
  createTranslationElement(para) {
    const el = document.createElement('div');
    el.className = 'csta-translation';
    el.textContent = para.translation;
    el.setAttribute('data-hash', para.hash);

    if (para.engine) {
      el.setAttribute('data-engine', para.engine);
    }

    if (para.mock) {
      el.classList.add('csta-mock');
      el.title = 'Mock translation (configure API key for real translation)';
    }

    return el;
  }

  /**
   * Toggle translation visibility
   * @returns {boolean} - New visibility state (true = visible)
   */
  toggleVisibility() {
    const translations = document.querySelectorAll('.csta-translation');

    if (translations.length === 0) return false;

    const isVisible = translations[0].style.display !== 'none';
    const newDisplay = isVisible ? 'none' : '';

    translations.forEach(el => {
      el.style.display = newDisplay;
    });

    console.log(`Translations ${isVisible ? 'hidden' : 'shown'}`);
    return !isVisible;
  }

  /**
   * Setup MutationObserver for dynamic content
   * @param {Element} rootElement - Root element to observe
   * @param {Function} onNewContent - Callback for new content
   */
  setupMutationObserver(rootElement, onNewContent) {
    // Disconnect existing observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    // Debounce callback
    let debounceTimer;
    const debouncedCallback = (mutations) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.handleMutations(mutations, onNewContent);
      }, 300);
    };

    // Create observer
    this.mutationObserver = new MutationObserver(debouncedCallback);

    // Start observing
    this.mutationObserver.observe(rootElement, {
      childList: true,
      subtree: true
    });

    this.isTranslationActive = true;
    console.log('MutationObserver active - watching for dynamic content');
  }

  /**
   * Handle DOM mutations
   * @param {Array} mutations - Mutation records
   * @param {Function} onNewContent - Callback for new content
   */
  handleMutations(mutations, onNewContent) {
    const addedNodes = [];

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Skip our own translation elements
        if (node.nodeType === Node.ELEMENT_NODE &&
            !node.classList?.contains('csta-translation')) {
          addedNodes.push(node);
        }
      }
    }

    if (addedNodes.length > 0) {
      console.log(`Detected ${addedNodes.length} new nodes`);
      onNewContent(addedNodes);
    }
  }

  /**
   * Stop observing mutations
   */
  stopObserving() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.isTranslationActive = false;
    console.log('MutationObserver stopped');
  }

  /**
   * Clear all rendered translations
   */
  clearAll() {
    const translations = document.querySelectorAll('.csta-translation');
    translations.forEach(el => el.remove());

    const translated = document.querySelectorAll('[data-translated="true"]');
    translated.forEach(el => el.removeAttribute('data-translated'));

    this.renderedHashes.clear();
    console.log('All translations cleared');
  }

  /**
   * Get rendering statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    const translations = document.querySelectorAll('.csta-translation');
    const visible = Array.from(translations).filter(el => el.style.display !== 'none');

    return {
      total: translations.length,
      visible: visible.length,
      hidden: translations.length - visible.length,
      observing: this.isTranslationActive
    };
  }
}
