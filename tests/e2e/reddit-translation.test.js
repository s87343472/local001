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
    pageLoad: 60000,  // Increased to 60s for slow networks
    translation: 90000,  // Increased to 90s
    buttonAppear: 15000  // Increased to 15s
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
 * Get extension ID from loaded extensions
 */
async function getExtensionId(page) {
  try {
    // Method 1: Try chrome://extensions/ page
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);

    let extensionId = await page.evaluate(() => {
      try {
        const manager = document.querySelector('extensions-manager');
        if (!manager || !manager.shadowRoot) return null;

        const itemList = manager.shadowRoot.querySelector('extensions-item-list');
        if (!itemList || !itemList.shadowRoot) return null;

        const items = itemList.shadowRoot.querySelectorAll('extensions-item');

        for (const item of items) {
          if (!item.shadowRoot) continue;

          const nameEl = item.shadowRoot.querySelector('#name');
          const name = nameEl?.textContent || '';

          // Match our extension name
          if (name.includes('Translation') || name.includes('Smart')) {
            // Extension ID is in the item's id attribute
            return item.id;
          }
        }
      } catch (e) {
        console.error('Shadow DOM query error:', e);
      }
      return null;
    });

    if (extensionId) {
      return extensionId;
    }

    // Method 2: Extract from extension path (fallback)
    console.log('Trying fallback method: scanning filesystem...');
    const { execSync } = require('child_process');

    try {
      // Chrome stores extension IDs based on path hash
      // For unpacked extensions loaded via --load-extension, ID is deterministic
      const extPath = CONFIG.extensionPath;

      // Generate extension ID (Chrome uses first 32 chars of SHA256 of path, converted to a-p)
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(extPath).digest('hex');

      // Chrome converts hex to letters a-p (representing 0-f)
      extensionId = hash.substring(0, 32).split('').map(c => {
        const code = parseInt(c, 16);
        return String.fromCharCode(97 + code); // 'a' = 97
      }).join('');

      return extensionId;
    } catch (e) {
      console.error('Fallback method failed:', e.message);
    }

    return null;
  } catch (error) {
    console.error('Error getting extension ID:', error.message);
    return null;
  }
}

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
    // Step 0: Verify extension path exists
    const fs = require('fs');
    if (!fs.existsSync(CONFIG.extensionPath)) {
      throw new Error(`Extension path does not exist: ${CONFIG.extensionPath}`);
    }
    const manifestPath = path.join(CONFIG.extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`manifest.json not found in: ${CONFIG.extensionPath}`);
    }
    console.log('✓ Extension path verified\n');

    // Step 1: Launch browser with extension
    console.log('📦 Launching Chrome with extension...');
    console.log(`   Extension path: ${CONFIG.extensionPath}`);

    // Create temp user data dir for this test run
    const os = require('os');
    const userDataDir = path.join(os.tmpdir(), `chrome-test-${Date.now()}`);
    console.log(`   User data dir: ${userDataDir}`);

    browser = await puppeteer.launch({
      headless: false, // Must be false for extensions
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Use system Chrome
      userDataDir: userDataDir, // Use dedicated profile
      args: [
        `--disable-extensions-except=${CONFIG.extensionPath}`,
        `--load-extension=${CONFIG.extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
      ],
      dumpio: false, // Disable verbose logs
      protocolTimeout: 120000 // Increase protocol timeout to 120s
    });

    // Wait for browser and extension to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('✓ Browser launched\n');

    // Step 1.5: Check if extension loaded via chrome://extensions/
    console.log('🔍 Verifying extension loaded in chrome://extensions/...');

    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);

    // Enable developer mode if needed
    const devModeEnabled = await page.evaluate(() => {
      const manager = document.querySelector('extensions-manager');
      if (!manager || !manager.shadowRoot) return false;

      const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
      if (!toolbar || !toolbar.shadowRoot) return false;

      const toggle = toolbar.shadowRoot.querySelector('#devMode');
      if (toggle && !toggle.checked) {
        toggle.click();
        return true;
      }
      return toggle?.checked || false;
    });
    console.log(`   Developer mode: ${devModeEnabled ? 'enabled' : 'already enabled'}`);

    await page.waitForTimeout(1000);

    // Check for loaded extensions
    const extensionInfo = await page.evaluate(() => {
      const manager = document.querySelector('extensions-manager');
      if (!manager || !manager.shadowRoot) return { found: false };

      const itemList = manager.shadowRoot.querySelector('extensions-item-list');
      if (!itemList || !itemList.shadowRoot) return { found: false };

      const items = Array.from(itemList.shadowRoot.querySelectorAll('extensions-item'));
      const extensions = items.map(item => {
        if (!item.shadowRoot) return null;
        const name = item.shadowRoot.querySelector('#name')?.textContent || '';
        const id = item.id;
        const errors = item.shadowRoot.querySelector('#errors-button')?.textContent || '0 errors';
        return { name, id, errors };
      }).filter(e => e !== null);

      return { found: true, extensions };
    });

    console.log('   Extensions found:', extensionInfo);

    // Try to find and use a service worker target for configuration
    await page.goto('https://example.com');
    await page.waitForTimeout(3000);

    const targets = await browser.targets();
    console.log(`   Found ${targets.length} targets:`, targets.map(t => ({
      type: t.type(),
      url: t.url().substring(0, 60) + (t.url().length > 60 ? '...' : '')
    })));

    // Look for our extension in the loaded extensions
    let extensionId = null;
    if (extensionInfo.found && extensionInfo.extensions.length > 0) {
      const ourExt = extensionInfo.extensions.find(e =>
        e.name.includes('Translation') || e.name.includes('Smart')
      );
      if (ourExt) {
        extensionId = ourExt.id;
        console.log(`   Extension found: ${ourExt.name} (${extensionId})`);
        if (ourExt.errors !== '0 errors') {
          console.warn(`   ⚠️  Extension has errors: ${ourExt.errors}`);
        }
      }
    }

    const extensionTarget = targets.find(target =>
      target.type() === 'service_worker' &&
      target.url().includes('chrome-extension://')
    );

    if (extensionTarget || extensionId) {
      if (!extensionId) {
        extensionId = new URL(extensionTarget.url()).hostname;
      }
      console.log(`✓ Extension ID: ${extensionId}\n`);

      // Navigate to options page and configure
      await page.goto(`chrome-extension://${extensionId}/options/options.html`);
      await page.waitForTimeout(2000);

      // Set API key via page evaluation
      const geminiApiKey = process.env.GEMINI_API_KEY || 'test-api-key-for-e2e';

      await page.evaluate((apiKey) => {
        return new Promise((resolve) => {
          chrome.storage.sync.set({
            apiKeys: {
              gemini: btoa(apiKey)
            },
            preferences: {
              targetLanguage: 'zh-CN',
              defaultEngine: 'gemini',
              professionalDomain: 'computer',
              translationMode: 'smart',
              autoTranslate: false
            }
          }, () => {
            console.log('[E2E] Extension configured');
            resolve();
          });
        });
      }, geminiApiKey);

      console.log('✓ Extension configured\n');
    } else {
      console.warn('⚠️  Extension service worker not found');
      console.log('Available targets:', targets.map(t => ({type: t.type(), url: t.url()})));
    }

    // Step 2: Navigate to Reddit
    console.log('🌐 Navigating to Reddit homepage...');
    try {
      await page.goto(CONFIG.testUrl, {
        waitUntil: 'domcontentloaded',  // Less strict than networkidle2
        timeout: CONFIG.timeouts.pageLoad
      });
    } catch (navError) {
      console.warn('⚠️  Initial navigation timeout, checking if page loaded...');
      // Check if page actually loaded despite timeout
      const currentUrl = page.url();
      if (!currentUrl.includes('reddit')) {
        throw navError;
      }
    }

    // Wait for page to be interactive
    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✓ Page loaded\n');

    // Test 1: Check page loaded successfully
    const pageTitle = await page.title();
    assert(
      pageTitle.includes('reddit') || pageTitle.includes('Reddit'),
      'Page Load',
      `Expected Reddit in title, got: ${pageTitle}`
    );

    // Debug: Check if content script loaded
    console.log('🔍 Checking content script status...');
    const contentScriptLoaded = await page.evaluate(() => {
      return {
        hasMessageRouter: typeof MessageRouter !== 'undefined',
        hasContentDetector: typeof ContentDetector !== 'undefined',
        hasFloatingButton: typeof FloatingButton !== 'undefined',
        hasWindow: typeof window !== 'undefined',
        scripts: Array.from(document.scripts).map(s => s.src).filter(s => s.includes('content'))
      };
    });
    console.log('Content script status:', JSON.stringify(contentScriptLoaded, null, 2));

    // Check for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

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
      // Log console errors
      console.log('Console errors:', errors);

      // Check DOM for any extension elements
      const domCheck = await page.evaluate(() => {
        return {
          allDivs: document.querySelectorAll('div[id*="csta"]').length,
          allElements: document.querySelectorAll('[class*="csta"]').length,
          bodyChildren: document.body.childElementCount,
          lastChildren: Array.from(document.body.children).slice(-5).map(el => ({
            tag: el.tagName,
            id: el.id,
            classes: el.className
          }))
        };
      });
      console.log('DOM check:', JSON.stringify(domCheck, null, 2));

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
