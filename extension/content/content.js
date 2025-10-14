/**
 * Content Script
 * Handles content detection, translation requests, and rendering
 *
 * Dependencies loaded via manifest.json content_scripts:
 * - lib/message-router.js (MessageRouter)
 * - lib/content-detector.js (ContentDetector)
 * - lib/renderer.js (BillingualRenderer)
 * - content/floating-button.js (FloatingButton)
 */

console.log('[Content Script] Loading...');
console.log('[Content Script] Testing class availability:', {
  MessageRouter: typeof MessageRouter,
  ContentDetector: typeof ContentDetector,
  BillingualRenderer: typeof BillingualRenderer,
  FloatingButton: typeof FloatingButton
});

// Utility: Simple hash function for text
function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Initialize
console.log('[Content Script] Creating detector...');
const detector = new ContentDetector();
console.log('[Content Script] Creating renderer...');
const renderer = new BillingualRenderer();
console.log('[Content Script] Creating floating button...');
const floatingButton = new FloatingButton();
console.log('[Content Script] All components initialized successfully');
let currentAnalysis = null;
let isTranslating = false;

// Inject floating button when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    floatingButton.inject();
  });
} else {
  floatingButton.inject();
}

/**
 * Analyze the current page
 * @returns {Promise<Object>} - Analysis result
 */
async function analyzePage() {
  console.log('Analyzing page content...');

  // Check if we're on Reddit - use specialized extraction
  if (window.location.hostname.includes('reddit.com')) {
    console.log('[Content] Detected Reddit, using specialized extraction');
    return await analyzeRedditPage();
  }

  const analysis = detector.analyze();

  console.log(`Content analysis complete:`, {
    paragraphs: analysis.count,
    chars: analysis.totalChars,
    time: analysis.processingTime + 'ms'
  });

  // Check cache for existing translations
  const paragraphsWithCache = await checkCache(analysis.paragraphs);

  return {
    ...analysis,
    paragraphs: paragraphsWithCache
  };
}

/**
 * Analyze Reddit page - extract post titles only
 * @returns {Promise<Object>} - Analysis result
 */
async function analyzeRedditPage() {
  const startTime = performance.now();
  const paragraphs = [];

  // Find all post elements
  const posts = document.querySelectorAll('shreddit-post');
  console.log(`[Reddit] Found ${posts.length} posts`);

  for (const post of posts) {
    // Extract post title (slot="title")
    const titleSlot = post.querySelector('[slot="title"]');
    if (titleSlot) {
      const text = titleSlot.textContent.trim();
      if (text && text.length > 10 && text.length < 500) {
        const hash = simpleHash(text);
        paragraphs.push({
          text,
          hash,
          element: titleSlot,
          length: text.length
        });
        console.log(`[Reddit] Extracted title: "${text.substring(0, 50)}..."`);
      }
    }
  }

  const processingTime = Math.round(performance.now() - startTime);
  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);

  console.log(`[Reddit] Extracted ${paragraphs.length} post titles in ${processingTime}ms`);

  // Check cache
  const paragraphsWithCache = await checkCache(paragraphs);

  return {
    paragraphs: paragraphsWithCache,
    count: paragraphs.length,
    totalChars,
    processingTime
  };
}

/**
 * Check cache for existing translations
 * Optimized to check all paragraphs in parallel
 * @param {Array<Object>} paragraphs - Array of paragraph objects
 * @returns {Promise<Array<Object>>} - Paragraphs with cache status
 */
async function checkCache(paragraphs) {
  // Check all paragraphs in parallel instead of sequentially
  const promises = paragraphs.map(para =>
    MessageRouter.sendToBackground('GET_FROM_CACHE', { hash: para.hash })
      .catch(error => {
        console.warn('Cache check failed for hash:', para.hash, error);
        return { success: false, result: null };
      })
  );

  const responses = await Promise.all(promises);

  const results = paragraphs.map((para, i) => ({
    ...para,
    cached: responses[i].success && responses[i].result !== null,
    translation: responses[i].result?.translation || null
  }));

  const cachedCount = results.filter(p => p.cached).length;
  if (cachedCount > 0) {
    console.log(`Found ${cachedCount}/${results.length} paragraphs in cache`);
  }

  return results;
}

/**
 * Handle translation request
 * @param {Array<Object>} paragraphs - Paragraphs to translate (non-cached only)
 * @returns {Promise<Array<Object>>} - Translation results
 */
async function requestTranslation(paragraphs) {
  // Filter out cached paragraphs
  const toTranslate = paragraphs.filter(p => !p.cached);

  if (toTranslate.length === 0) {
    console.log('All paragraphs found in cache, no translation needed');
    return paragraphs;
  }

  console.log(`Requesting translation for ${toTranslate.length} paragraphs...`);

  try {
    const response = await MessageRouter.sendToBackground('TRANSLATE_TEXT', {
      paragraphs: toTranslate.map(p => ({
        hash: p.hash,
        text: p.text
      }))
    });

    if (response.success) {
      console.log('Translation complete');

      // Merge translations with cached results
      const translationMap = new Map(
        response.result.translations.map(t => [t.hash, t.translation])
      );

      return paragraphs.map(p => ({
        ...p,
        translation: p.cached ? p.translation : translationMap.get(p.hash)
      }));
    } else {
      throw new Error(response.error || 'Translation failed');
    }
  } catch (error) {
    console.error('Translation request failed:', error);
    throw error;
  }
}

/**
 * Render translations on the page with progressive rendering
 * @param {Array<Object>} paragraphs - Paragraphs with translations
 */
async function renderTranslations(paragraphs) {
  console.log('Rendering translations with progressive strategy...');

  const startTime = performance.now();

  // Use progressive rendering
  const renderedCount = await renderer.renderProgressive(paragraphs);

  const endTime = performance.now();
  const renderTime = Math.round(endTime - startTime);

  console.log(`Rendered ${renderedCount} translations in ${renderTime}ms`);

  // Setup MutationObserver for dynamic content
  if (currentAnalysis?.mainContent) {
    renderer.setupMutationObserver(currentAnalysis.mainContent, handleDynamicContent);
  }
}

/**
 * Main translation function
 */
async function translatePage() {
  if (isTranslating) {
    console.log('Translation already in progress');
    return;
  }

  isTranslating = true;
  floatingButton.setState('translating');

  try {
    // Step 1: Analyze page
    currentAnalysis = await analyzePage();

    if (currentAnalysis.count === 0) {
      console.warn('No translatable content found');
      floatingButton.setState('error');
      return;
    }

    // Step 2: Request translations (with cache check)
    const translatedParagraphs = await requestTranslation(currentAnalysis.paragraphs);

    // Step 3: Render translations
    await renderTranslations(translatedParagraphs);

    floatingButton.setState('translated');
    await floatingButton.updateStats();

    console.log('Translation complete!');
  } catch (error) {
    console.error('Translation failed:', error);
    floatingButton.setState('error');
  } finally {
    isTranslating = false;
  }
}

/**
 * Toggle translation visibility
 */
function toggleTranslations() {
  const isVisible = renderer.toggleVisibility();
  return isVisible;
}

/**
 * Handle dynamically added content
 * @param {Array} addedNodes - New DOM nodes
 */
async function handleDynamicContent(addedNodes) {
  if (!renderer.isTranslationActive) return;

  console.log('Processing dynamic content...');

  // Extract paragraphs from new nodes
  const newParagraphs = [];

  for (const node of addedNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    // Use detector to extract paragraphs from this node
    const paragraphs = detector.extractParagraphs(node);
    newParagraphs.push(...paragraphs);
  }

  if (newParagraphs.length === 0) return;

  console.log(`Found ${newParagraphs.length} new paragraphs in dynamic content`);

  // Check cache and translate if needed
  try {
    const paragraphsWithCache = await checkCache(newParagraphs);
    const translatedParagraphs = await requestTranslation(paragraphsWithCache);
    await renderer.renderProgressive(translatedParagraphs);
  } catch (error) {
    console.error('Failed to translate dynamic content:', error);
  }
}

// Message handling from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message;

  switch (action) {
    case 'TRANSLATE_PAGE':
      translatePage().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'TOGGLE_TRANSLATIONS':
      const isVisible = toggleTranslations();
      sendResponse({ success: true, isVisible });
      break;

    case 'CLEAR_TRANSLATIONS':
      renderer.clearAll();
      renderer.stopObserving();
      currentAnalysis = null;
      sendResponse({ success: true });
      break;

    case 'GET_STATS':
      const stats = renderer.getStats();
      sendResponse({ success: true, stats });
      break;

    case 'ANALYZE_PAGE':
      analyzePage().then(analysis => {
        sendResponse({ success: true, analysis });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'TRANSLATE_SELECTION':
      // TODO: Implement selection translation
      console.log('Selection translation:', data.text);
      sendResponse({ success: true });
      break;

    default:
      console.warn('Unknown action:', action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Expose functions to window for floating button access
// Content scripts share global scope, but explicit assignment ensures availability
window.translatePage = translatePage;
window.toggleTranslations = toggleTranslations;
window.getTranslationStats = () => renderer.getStats();

// Page loaded - ready for commands
console.log('Content script ready');
