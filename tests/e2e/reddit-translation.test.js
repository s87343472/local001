/**
 * E2E Test: Reddit Homepage Translation
 *
 * Tests the complete translation workflow on Reddit.com homepage
 *
 * Prerequisites:
 * - npm install
 * - Extension loaded in Chrome
 * - Gemini API key configured in extension settings
 *
 * Usage:
 *   node tests/e2e/reddit-translation.test.js
 */

const puppeteer = require('puppeteer');
const path = require('path');

// Configuration
const CONFIG = {
  extensionPath: path.resolve(__dirname, '../../extension'),
  testUrl: 'https://www.reddit.com',
  timeouts: {
    pageLoad: 30000,
    translation: 60000,
    buttonAppear: 10000
  }
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * Utility: Wait for condition with timeout
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

/**
 * Test assertion helper
 */
function assert(condition, testName, message) {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`✅ PASS: ${testName}`);
    return true;
  } else {
    results.failed++;
    const error = `❌ FAIL: ${testName} - ${message}`;
    console.error(error);
    results.errors.push(error);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting E2E Test: Reddit Translation\n');
  console.log('Configuration:');
  console.log(`  Extension: ${CONFIG.extensionPath}`);
  console.log(`  Test URL: ${CONFIG.testUrl}\n`);

  let browser;
  let page;

  try {
    // Step 1: Launch browser with extension
    console.log('📦 Launching Chrome with extension...');
    browser = await puppeteer.launch({
      headless: false, // Must be false for extensions
      args: [
        `--disable-extensions-except=${CONFIG.extensionPath}`,
        `--load-extension=${CONFIG.extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      dumpio: false, // Suppress browser logs
      protocolTimeout: 60000 // Increase protocol timeout
    });

    // Wait for browser to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('✓ Browser launched\n');

    // Step 2: Navigate to Reddit
    console.log('🌐 Navigating to Reddit homepage...');
    await page.goto(CONFIG.testUrl, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeouts.pageLoad
    });

    console.log('✓ Page loaded\n');

    // Test 1: Check page loaded successfully
    const pageTitle = await page.title();
    assert(
      pageTitle.includes('reddit') || pageTitle.includes('Reddit'),
      'Page Load',
      `Expected Reddit in title, got: ${pageTitle}`
    );

    // Step 3: Wait for floating button to appear
    console.log('⏳ Waiting for floating button...');

    const buttonAppeared = await waitFor(async () => {
      const button = await page.$('#csta-floating-button');
      return button !== null;
    }, CONFIG.timeouts.buttonAppear);

    // Test 2: Floating button appears
    assert(
      buttonAppeared,
      'Floating Button Injection',
      'Button did not appear within timeout'
    );

    if (!buttonAppeared) {
      // Log console for debugging
      const logs = await page.evaluate(() => {
        return window.console.logs || [];
      });
      console.log('Console logs:', logs);
      throw new Error('Cannot continue without floating button');
    }

    console.log('✓ Floating button found\n');

    // Test 3: Button has Chinese text
    const buttonTitle = await page.$eval('#csta-floating-button',
      el => el.getAttribute('title')
    );
    assert(
      buttonTitle.includes('点击') || buttonTitle.includes('翻译'),
      'Chinese Localization',
      `Expected Chinese text, got: ${buttonTitle}`
    );

    // Test 4: Button is visible and clickable
    const buttonVisible = await page.$eval('#csta-floating-button',
      el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 &&
               rect.height > 0 &&
               style.display !== 'none' &&
               style.visibility !== 'hidden';
      }
    );
    assert(
      buttonVisible,
      'Button Visibility',
      'Button is not visible on page'
    );

    // Step 4: Click floating button to start translation
    console.log('🔘 Clicking floating button to start translation...');
    await page.click('#csta-floating-button');

    // Wait a moment for state change
    await page.waitForTimeout(1000);

    // Test 5: Button state changes to "translating"
    const buttonClass = await page.$eval('#csta-floating-button',
      el => el.className
    );
    assert(
      buttonClass.includes('translating') || buttonClass.includes('translated'),
      'Translation Started',
      `Expected translating state, got: ${buttonClass}`
    );

    // Step 5: Wait for translation to complete
    console.log('⏳ Waiting for translation to complete (max 60s)...');

    const translationComplete = await waitFor(async () => {
      const btnClass = await page.$eval('#csta-floating-button',
        el => el.className
      );
      return btnClass.includes('translated');
    }, CONFIG.timeouts.translation, 500);

    // Test 6: Translation completes successfully
    assert(
      translationComplete,
      'Translation Completion',
      'Translation did not complete within timeout'
    );

    if (!translationComplete) {
      // Check for error state
      const errorState = await page.$eval('#csta-floating-button',
        el => el.className.includes('error')
      );
      if (errorState) {
        console.error('❌ Translation failed - button in error state');
      }
    }

    console.log('✓ Translation completed\n');

    // Step 6: Check for translated content
    console.log('🔍 Checking for translated content...');

    const translationElements = await page.$$('.csta-translation');
    const translationCount = translationElements.length;

    // Test 7: Translations are rendered on page
    assert(
      translationCount > 0,
      'Translation Rendering',
      `Expected > 0 translations, found: ${translationCount}`
    );

    console.log(`✓ Found ${translationCount} translated elements\n`);

    // Test 8: Translations contain Chinese characters
    if (translationCount > 0) {
      const firstTranslation = await page.$eval('.csta-translation',
        el => el.textContent
      );
      const hasChinese = /[\u4e00-\u9fa5]/.test(firstTranslation);
      assert(
        hasChinese,
        'Chinese Content',
        `Expected Chinese characters, got: ${firstTranslation.slice(0, 50)}...`
      );
    }

    // Test 9: Translations are visible
    const visibleCount = await page.$$eval('.csta-translation',
      elements => elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).length
    );
    assert(
      visibleCount === translationCount,
      'Translation Visibility',
      `${visibleCount}/${translationCount} translations visible`
    );

    // Step 7: Test toggle functionality
    console.log('🔄 Testing toggle display...');

    // Click button to open panel
    await page.click('#csta-floating-button');
    await page.waitForTimeout(500);

    // Check panel appears
    const panelVisible = await page.$eval('#csta-floating-panel',
      el => !el.classList.contains('csta-panel-hidden')
    );

    // Test 10: Panel opens on click
    assert(
      panelVisible,
      'Panel Opens',
      'Panel did not open when clicking button'
    );

    if (panelVisible) {
      // Click toggle button
      await page.click('.csta-btn-toggle');
      await page.waitForTimeout(500);

      // Check if translations are hidden
      const hiddenCount = await page.$$eval('.csta-translation',
        elements => elements.filter(el => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden';
        }).length
      );

      // Test 11: Toggle hides translations
      assert(
        hiddenCount > 0,
        'Toggle Functionality',
        'Toggle did not hide translations'
      );

      console.log(`✓ Toggled ${hiddenCount}/${translationCount} translations\n`);
    }

    // Step 8: Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({
      path: 'tests/e2e/reddit-translation-result.png',
      fullPage: false
    });
    console.log('✓ Screenshot saved to: tests/e2e/reddit-translation-result.png\n');

    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Results Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Tests:  ${results.total}`);
    console.log(`✅ Passed:     ${results.passed}`);
    console.log(`❌ Failed:     ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.failed > 0) {
      console.log('❌ Failed Tests:');
      results.errors.forEach(error => console.log(`  ${error}`));
      console.log('');
    }

    // Overall result
    if (results.failed === 0) {
      console.log('🎉 All tests passed! Extension is working correctly.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Test execution error:');
    console.error(error);

    // Take error screenshot
    if (page) {
      try {
        await page.screenshot({
          path: 'tests/e2e/error-screenshot.png'
        });
        console.log('📸 Error screenshot saved to: tests/e2e/error-screenshot.png');
      } catch (screenshotError) {
        console.error('Failed to take error screenshot:', screenshotError);
      }
    }

    process.exit(1);
  } finally {
    if (browser) {
      console.log('\n🔚 Closing browser...');
      await browser.close();
    }
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
