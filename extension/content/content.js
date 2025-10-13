/**
 * Content Script
 * Handles content detection, translation requests, and rendering
 */

import { MessageRouter } from '../lib/message-router.js';
import { ContentDetector } from '../lib/content-detector.js';

console.log('Content script loaded - Chrome Smart Translation Assistant');

// Initialize
const detector = new ContentDetector();
let currentAnalysis = null;
let isTranslating = false;

/**
 * Analyze the current page
 * @returns {Promise<Object>} - Analysis result
 */
async function analyzePage() {
  console.log('Analyzing page content...');

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
 * Check cache for existing translations
 * @param {Array<Object>} paragraphs - Array of paragraph objects
 * @returns {Promise<Array<Object>>} - Paragraphs with cache status
 */
async function checkCache(paragraphs) {
  const results = [];

  for (const para of paragraphs) {
    try {
      // Request cache check from background
      const response = await MessageRouter.sendToBackground('GET_FROM_CACHE', {
        hash: para.hash
      });

      results.push({
        ...para,
        cached: response.success && response.result !== null,
        translation: response.result?.translation || null
      });
    } catch (error) {
      console.warn('Cache check failed for hash:', para.hash, error);
      results.push({
        ...para,
        cached: false,
        translation: null
      });
    }
  }

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
 * Render translations on the page
 * @param {Array<Object>} paragraphs - Paragraphs with translations
 */
function renderTranslations(paragraphs) {
  console.log('Rendering translations...');

  let renderedCount = 0;

  for (const para of paragraphs) {
    if (!para.translation || !para.element) continue;

    // Check if already rendered
    const existingTranslation = para.element.nextElementSibling;
    if (existingTranslation && existingTranslation.classList.contains('csta-translation')) {
      continue;
    }

    // Create translation element
    const translationEl = document.createElement('div');
    translationEl.className = 'csta-translation';
    translationEl.textContent = para.translation;
    translationEl.setAttribute('data-hash', para.hash);

    // Insert after original element
    para.element.parentNode.insertBefore(translationEl, para.element.nextSibling);

    // Mark original as translated
    para.element.setAttribute('data-translated', 'true');

    renderedCount++;
  }

  console.log(`Rendered ${renderedCount} translations`);
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

  try {
    // Step 1: Analyze page
    currentAnalysis = await analyzePage();

    if (currentAnalysis.count === 0) {
      console.warn('No translatable content found');
      return;
    }

    // Step 2: Request translations (with cache check)
    const translatedParagraphs = await requestTranslation(currentAnalysis.paragraphs);

    // Step 3: Render translations
    renderTranslations(translatedParagraphs);

    console.log('Translation complete!');
  } catch (error) {
    console.error('Translation failed:', error);
    // TODO: Show error UI
  } finally {
    isTranslating = false;
  }
}

/**
 * Toggle translation visibility
 */
function toggleTranslations() {
  const translations = document.querySelectorAll('.csta-translation');
  const isVisible = translations.length > 0 && translations[0].style.display !== 'none';

  translations.forEach(el => {
    el.style.display = isVisible ? 'none' : 'block';
  });

  console.log(`Translations ${isVisible ? 'hidden' : 'shown'}`);
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
      toggleTranslations();
      sendResponse({ success: true });
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

// Page loaded - ready for commands
console.log('Content script ready');
