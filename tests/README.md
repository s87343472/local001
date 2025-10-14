# Chrome Translation Extension - Test Suite

## Overview

Automated E2E testing for Chrome Smart Translation Assistant using Puppeteer.

## Test Structure

```
tests/
├── e2e/
│   ├── reddit-translation.test.js  # Main E2E test
│   ├── reddit-translation-result.png  # Success screenshot (generated)
│   └── error-screenshot.png  # Error screenshot (if any)
└── README.md  # This file
```

## Prerequisites

### 1. Install Dependencies

```bash
cd /Users/sagasu/Downloads/epic-chrome-translation-plugin
npm install
```

This will install:
- `puppeteer` v21.0.0 (includes Chromium)

### 2. Configure Extension

Before running tests, ensure:

1. **Extension is built**: All files in `extension/` directory are ready
2. **API Key configured**:
   - Manually load extension in Chrome once
   - Open Settings and configure Gemini API key
   - Save settings
   - This persists in Chrome's storage for tests

## Running Tests

### Quick Start

```bash
npm run test:e2e
```

### Manual Execution

```bash
node tests/e2e/reddit-translation.test.js
```

### Expected Output

```
🚀 Starting E2E Test: Reddit Translation

Configuration:
  Extension: /path/to/extension
  Test URL: https://www.reddit.com

📦 Launching Chrome with extension...
✓ Browser launched

🌐 Navigating to Reddit homepage...
✓ Page loaded

✅ PASS: Page Load
⏳ Waiting for floating button...
✓ Floating button found

✅ PASS: Floating Button Injection
✅ PASS: Chinese Localization
✅ PASS: Button Visibility
🔘 Clicking floating button to start translation...
✅ PASS: Translation Started
⏳ Waiting for translation to complete (max 60s)...
✓ Translation completed

✅ PASS: Translation Completion
🔍 Checking for translated content...
✓ Found 15 translated elements

✅ PASS: Translation Rendering
✅ PASS: Chinese Content
✅ PASS: Translation Visibility
🔄 Testing toggle display...
✅ PASS: Panel Opens
✅ PASS: Toggle Functionality
✓ Toggled 15/15 translations

📸 Taking screenshot...
✓ Screenshot saved to: tests/e2e/reddit-translation-result.png

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Test Results Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Tests:  11
✅ Passed:     11
❌ Failed:     0
Success Rate: 100.0%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 All tests passed! Extension is working correctly.

🔚 Closing browser...
```

## Test Coverage

### reddit-translation.test.js

Tests the complete translation workflow:

#### 1. **Page Load** (Test 1)
- Navigates to Reddit homepage
- Verifies page loaded successfully

#### 2. **Extension Injection** (Tests 2-4)
- Floating button appears on page
- Button has Chinese localized text
- Button is visible and interactive

#### 3. **Translation Execution** (Tests 5-6)
- Button click triggers translation
- Button state changes to "translating"
- Translation completes within 60 seconds

#### 4. **Content Rendering** (Tests 7-9)
- Translated elements appear on page
- Content contains Chinese characters
- Translations are visible to user

#### 5. **Toggle Functionality** (Tests 10-11)
- Panel opens when clicking button
- Toggle button hides/shows translations

#### 6. **Visual Verification**
- Screenshot captured for manual review

## Test Configuration

Edit `reddit-translation.test.js` to customize:

```javascript
const CONFIG = {
  extensionPath: path.resolve(__dirname, '../../extension'),
  testUrl: 'https://www.reddit.com',  // Change test URL here
  timeouts: {
    pageLoad: 30000,      // Page load timeout (30s)
    translation: 60000,   // Translation timeout (60s)
    buttonAppear: 10000   // Button injection timeout (10s)
  }
};
```

## Troubleshooting

### Test Fails: "Floating button did not appear"

**Possible causes:**
1. Extension not loaded correctly
2. Content script injection failed
3. Page URL doesn't match `https://*/*`

**Debug steps:**
```bash
# Check extension files exist
ls -la extension/

# Check manifest.json content_scripts
cat extension/manifest.json | grep -A 10 content_scripts

# Run test with console logging
node tests/e2e/reddit-translation.test.js 2>&1 | tee test.log
```

### Test Fails: "Translation did not complete"

**Possible causes:**
1. API key not configured
2. API rate limit exceeded
3. Network issues
4. No translatable content detected

**Debug steps:**
1. Check `error-screenshot.png` for visual clues
2. Manually test extension in Chrome
3. Check browser console for errors:
   ```javascript
   chrome://extensions/ → Service Worker → Console
   ```

### Test Fails: "No translations rendered"

**Possible causes:**
1. Content detection algorithm found no content
2. Rendering failed
3. CSS not loaded

**Debug steps:**
1. Check screenshot: `reddit-translation-result.png`
2. Inspect element in manual test
3. Check console for renderer errors

### Browser doesn't launch

**Possible causes:**
1. Puppeteer not installed
2. Chrome/Chromium not found

**Fix:**
```bash
# Reinstall puppeteer
npm install puppeteer --save-dev

# Verify installation
npx puppeteer --version
```

## CI/CD Integration

### GitHub Actions (Example)

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-screenshots
          path: tests/e2e/*.png
```

## Adding More Tests

### Create a new test file

```javascript
// tests/e2e/github-translation.test.js
const puppeteer = require('puppeteer');
const path = require('path');

const CONFIG = {
  extensionPath: path.resolve(__dirname, '../../extension'),
  testUrl: 'https://github.com',
  timeouts: { pageLoad: 30000, translation: 60000 }
};

async function runTests() {
  // Your test logic here
}

runTests().catch(console.error);
```

### Register in package.json

```json
{
  "scripts": {
    "test:github": "node tests/e2e/github-translation.test.js",
    "test:all": "npm run test:e2e && npm run test:github"
  }
}
```

## Test Maintenance

### Update for code changes

When extension code changes:

1. **Content script changes**: Test button selectors, class names
2. **UI changes**: Update expected text, localization checks
3. **API changes**: Adjust timeout values if needed

### Version compatibility

- Puppeteer 21.0.0: Compatible with Chrome 119+
- Extension: Manifest V3
- Node.js: 16+ required

## Performance Benchmarks

Expected test execution times:

| Phase | Duration |
|-------|----------|
| Browser launch | 3-5s |
| Page load | 5-10s |
| Button injection | 1-2s |
| Translation | 10-30s |
| Verification | 2-3s |
| **Total** | **21-50s** |

## Future Enhancements

- [ ] Unit tests for individual modules
- [ ] Multiple site tests (GitHub, Wikipedia, Medium)
- [ ] Performance benchmarking
- [ ] Visual regression testing
- [ ] Parallel test execution
- [ ] Test coverage reporting

## CCPM Integration

This test suite follows CCPM principles:

- **Automated verification**: No manual testing required
- **Fast feedback**: Results in <60 seconds
- **Comprehensive coverage**: 11 test cases
- **Visual proof**: Screenshots for audit trail
- **CI-ready**: Easy integration with GitHub Actions

## Support

For issues with tests:
- GitHub Issues: https://github.com/s87343472/local001/issues
- Tag: `testing`, `e2e`

---

**Last Updated**: 2025-10-14
**Test Suite Version**: 1.0.0
**Extension Version**: 0.1.0
