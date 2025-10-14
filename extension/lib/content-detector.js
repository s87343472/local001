/**
 * Content Detection Engine
 * Identifies main content areas and extracts paragraphs for translation
 */

class ContentDetector {
  constructor() {
    // Priority-based selectors
    this.semanticSelectors = [
      'article',
      'main',
      '[role="main"]',
      '[role="article"]'
    ];

    this.commonSelectors = [
      '#content',
      '#main',
      '#post',
      '.content',
      '.main',
      '.post',
      '.article',
      '.entry-content',
      '.post-content',
      '.article-content'
    ];

    // Elements to exclude
    this.excludeSelectors = [
      'nav',
      'aside',
      'footer',
      'header',
      'button',
      'input',
      'textarea',
      'select',
      'code',
      'pre',
      'script',
      'style',
      'noscript',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[role="complementary"]',
      '[aria-hidden="true"]',
      '[class*="nav"]',
      '[class*="menu"]',
      '[class*="sidebar"]',
      '[class*="ad"]',
      '[id*="ad"]',
      '[class*="comment"]',
      '[id*="comment"]'
    ];
  }

  /**
   * Detect main content area on the page
   * @returns {Element|null} - The main content container
   */
  detectMainContent() {
    // Strategy 1: HTML5 semantic tags
    for (const selector of this.semanticSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const textLength = element.textContent.trim().length;
        console.log(`[ContentDetector] Checking selector "${selector}":`, {
          found: true,
          textLength: textLength,
          hasSignificantContent: textLength > 100
        });
        if (this.hasSignificantContent(element)) {
          console.log('Content detected via semantic tag:', selector);
          return element;
        }
      }
    }

    // Strategy 2: Common content selectors
    for (const selector of this.commonSelectors) {
      const element = document.querySelector(selector);
      if (element && this.hasSignificantContent(element)) {
        console.log('Content detected via common selector:', selector);
        return element;
      }
    }

    // Strategy 3: Paragraph density algorithm
    const densityResult = this.findByDensity();
    if (densityResult) {
      console.log('Content detected via density algorithm');
      return densityResult;
    }

    // Fallback: Use body
    console.log('Fallback: Using document.body');
    return document.body;
  }

  /**
   * Check if element has significant content
   * @param {Element} element - The element to check
   * @returns {boolean} - Whether element has significant content
   */
  hasSignificantContent(element) {
    const text = element.textContent.trim();
    // At least 100 characters of text
    return text.length > 100;
  }

  /**
   * Find content area using paragraph density algorithm
   * @returns {Element|null} - The element with highest density
   */
  findByDensity() {
    const candidates = document.querySelectorAll('div, section, article');
    let bestElement = null;
    let bestDensity = 0;

    for (const element of candidates) {
      // Skip if too small
      if (element.offsetHeight < 100) continue;

      // Calculate density
      const density = this.calculateDensity(element);

      if (density > bestDensity) {
        bestDensity = density;
        bestElement = element;
      }
    }

    return bestDensity > 0.5 ? bestElement : null;
  }

  /**
   * Calculate text density for an element
   * @param {Element} element - The element to analyze
   * @returns {number} - Density score (0-1)
   */
  calculateDensity(element) {
    const text = element.textContent.trim();
    const textLength = text.length;

    if (textLength === 0) return 0;

    // Count tags and links
    const tagCount = element.getElementsByTagName('*').length;
    const linkCount = element.getElementsByTagName('a').length;

    // Density formula: text_chars / (tags + links)
    // Normalized to 0-1 range
    const density = textLength / (tagCount + linkCount + 1);

    // Normalize: longer text gets bonus
    const lengthBonus = Math.min(textLength / 5000, 1);

    return Math.min(density / 100 * lengthBonus, 1);
  }

  /**
   * Extract paragraphs from content area
   * @param {Element} contentArea - The main content container
   * @returns {Array<Object>} - Array of paragraph objects
   */
  extractParagraphs(contentArea) {
    // Debug: Log all child elements of contentArea
    console.log('[ContentDetector] Content area tag:', contentArea.tagName);
    console.log('[ContentDetector] Content area class:', contentArea.className);
    console.log('[ContentDetector] Content area ID:', contentArea.id);
    console.log('[ContentDetector] Direct children count:', contentArea.children.length);
    const childTags = Array.from(contentArea.children).map(c => c.tagName.toLowerCase());
    console.log('[ContentDetector] Child tags:', childTags);

    const paragraphs = [];
    let processedCount = 0;
    let acceptedCount = 0;

    const walker = document.createTreeWalker(
      contentArea,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          processedCount++;
          const result = this.shouldProcessNode(node, contentArea);
          if (result === NodeFilter.FILTER_ACCEPT) {
            acceptedCount++;
          }
          return result;
        }
      }
    );

    let currentNode;
    let extractedCount = 0;
    let tooShortCount = 0;
    while ((currentNode = walker.nextNode())) {
      const text = this.getNodeText(currentNode);

      if (text && text.length >= 20) {
        paragraphs.push({
          element: currentNode,
          text: text,
          hash: this.hashText(text)
        });
        extractedCount++;
      } else if (text) {
        tooShortCount++;
      }
    }

    console.log(`[ContentDetector] TreeWalker results:`, {
      processedCount,
      acceptedCount,
      extractedCount,
      tooShortCount,
      finalParagraphs: paragraphs.length
    });

    console.log(`[ContentDetector] Processed ${processedCount} nodes, accepted ${acceptedCount}, extracted ${paragraphs.length} paragraphs`);

    // Merge short consecutive paragraphs
    return this.mergeParagraphs(paragraphs);
  }

  /**
   * Check if node should be processed
   * @param {Node} node - The node to check
   * @param {Element} contentArea - The content container (to stop closest() traversal)
   * @returns {number} - NodeFilter result
   */
  shouldProcessNode(node, contentArea) {
    const tagName = node.tagName ? node.tagName.toLowerCase() : '';

    // Check if element itself matches exclude selectors
    for (const selector of this.excludeSelectors) {
      if (node.matches && node.matches(selector)) {
        console.log(`[ContentDetector] REJECTED ${tagName} - matches exclude selector: ${selector}`);
        return NodeFilter.FILTER_REJECT;
      }
    }

    // Check if parent matches exclude selectors, but stop at contentArea
    // This prevents contentArea's own classes from excluding its children
    if (node !== contentArea) {
      let current = node.parentElement;
      while (current && current !== contentArea) {
        for (const selector of this.excludeSelectors) {
          if (current.matches && current.matches(selector)) {
            console.log(`[ContentDetector] REJECTED ${tagName} - parent ${current.tagName} matches exclude selector: ${selector}`);
            return NodeFilter.FILTER_REJECT;
          }
        }
        current = current.parentElement;
      }
    }

    // Only process paragraph-like elements
    const paragraphTags = ['p', 'div', 'section', 'article', 'li', 'dd', 'dt', 'td', 'th', 'blockquote', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

    if (paragraphTags.includes(tagName)) {
      console.log(`[ContentDetector] ACCEPTED ${tagName} - is paragraph-like element`);
      return NodeFilter.FILTER_ACCEPT;
    }

    // For custom elements (like shreddit-post), skip but continue traversing children
    console.log(`[ContentDetector] SKIPPED ${tagName} - not a paragraph-like element (will traverse children)`);
    return NodeFilter.FILTER_SKIP;
  }

  /**
   * Get text content from node, excluding nested excluded elements
   * @param {Node} node - The node to extract text from
   * @returns {string} - Cleaned text
   */
  getNodeText(node) {
    // Clone node to avoid modifying DOM
    const clone = node.cloneNode(true);

    // Remove excluded elements
    for (const selector of this.excludeSelectors) {
      const excluded = clone.querySelectorAll(selector);
      excluded.forEach(el => el.remove());
    }

    // Get text and clean
    let text = clone.textContent || '';
    text = text.trim();
    text = text.replace(/\s+/g, ' '); // Normalize whitespace

    return text;
  }

  /**
   * Merge short consecutive paragraphs
   * @param {Array<Object>} paragraphs - Array of paragraph objects
   * @returns {Array<Object>} - Merged paragraphs
   */
  mergeParagraphs(paragraphs) {
    const merged = [];
    let i = 0;

    while (i < paragraphs.length) {
      const current = paragraphs[i];

      // If paragraph is short and next exists, consider merging
      if (current.text.length < 50 && i + 1 < paragraphs.length) {
        const next = paragraphs[i + 1];

        // Merge if combined length is reasonable
        if ((current.text.length + next.text.length) < 500) {
          merged.push({
            element: current.element,
            text: current.text + ' ' + next.text,
            hash: this.hashText(current.text + ' ' + next.text),
            merged: true
          });
          i += 2; // Skip next
          continue;
        }
      }

      // Split if too long
      if (current.text.length > 5000) {
        const chunks = this.splitLongParagraph(current.text);
        chunks.forEach(chunk => {
          merged.push({
            element: current.element,
            text: chunk,
            hash: this.hashText(chunk),
            split: true
          });
        });
      } else {
        merged.push(current);
      }

      i++;
    }

    return merged;
  }

  /**
   * Split a long paragraph into chunks
   * @param {string} text - The text to split
   * @returns {Array<string>} - Array of chunks
   */
  splitLongParagraph(text) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > 4000) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
  }

  /**
   * Generate hash for text (simple hash for MVP)
   * @param {string} text - The text to hash
   * @returns {string} - Hash string
   */
  hashText(text) {
    // Simple hash function for MVP
    // In production, use crypto.subtle.digest('SHA-256', ...)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Filter paragraphs that are likely not content
   * @param {Array<Object>} paragraphs - Array of paragraph objects
   * @returns {Array<Object>} - Filtered paragraphs
   */
  filterNonContent(paragraphs) {
    return paragraphs.filter(para => {
      const text = para.text;

      // Too short
      if (text.length < 20) return false;

      // Mostly numbers (likely metadata)
      const digitRatio = (text.match(/\d/g) || []).length / text.length;
      if (digitRatio > 0.5) return false;

      // Mostly punctuation
      const punctRatio = (text.match(/[^\w\s]/g) || []).length / text.length;
      if (punctRatio > 0.3) return false;

      // Likely URL or code
      if (text.includes('://') || text.includes('function') || text.includes('=>')) {
        return false;
      }

      return true;
    });
  }

  /**
   * Analyze page and extract all translatable content
   * @returns {Object} - Content analysis result
   */
  analyze() {
    const startTime = performance.now();

    const mainContent = this.detectMainContent();
    let paragraphs = this.extractParagraphs(mainContent);
    paragraphs = this.filterNonContent(paragraphs);

    const endTime = performance.now();

    return {
      mainContent,
      paragraphs,
      count: paragraphs.length,
      totalChars: paragraphs.reduce((sum, p) => sum + p.text.length, 0),
      processingTime: Math.round(endTime - startTime)
    };
  }
}

// For content scripts only - no exports allowed
