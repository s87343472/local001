# Chrome Smart Translation Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue)](https://github.com/s87343472/local001)
[![Version](https://img.shields.io/badge/version-0.1.0-green)](https://github.com/s87343472/local001)

> Professional translation with bilingual parallel display. Privacy-first design with AES-256 encryption. Accurate technical terminology for computer science, business, science, and medical domains.

## ✨ Features

### 🌐 **Bilingual Parallel Display**
- Translations appear **below** original text (never replace)
- Preserves page layout and formatting
- Toggle visibility with one click
- Progressive rendering (viewport-first)

### 🔒 **Privacy & Security**
- **Zero data collection** - no analytics, no tracking
- **AES-256-GCM encryption** for API keys
- Local-first storage (all data on your device)
- Open source - audit the code yourself

### 🎯 **Professional Accuracy**
- **4 domain-specific dictionaries**: Computer Science, Business, Science, Medical
- Context-aware translations (Gemini AI)
- Technical terminology precision
- Fallback to Google Translate

### ⚡ **Smart Features**
- **Auto-translate** pages on load (optional)
- **Selection translation** via right-click menu
- **Translation cache** (7-day, LRU eviction)
- **Blacklist** for sensitive sites (banking, etc.)
- **Dynamic content** support (infinite scroll)

### 🎨 **Customizable**
- 9 target languages
- Adjustable font size, color, style
- Multiple translation modes (Fast/Smart/Precise)
- Domain selection for specialized content

---

## 🚀 Installation

### Method 1: Load Unpacked (Development)

1. **Clone this repository**
   ```bash
   git clone https://github.com/s87343472/local001.git
   cd local001
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the `/extension` folder

3. **Configure API Key**
   - Click the extension icon → Settings
   - Get a **free** Gemini API key: [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Paste key and click "Validate"
   - Start translating! 🎉

### Method 2: Chrome Web Store (Coming Soon)

*Extension will be published to Chrome Web Store after final testing.*

---

## 📖 Usage

### Basic Translation

1. **Navigate to any webpage** (e.g., GitHub README, Medium article)
2. **Click the floating translate button** (bottom-right corner)
3. **Wait for translation** (progress shown on button)
4. **Toggle visibility** via the control panel

### Selection Translation

1. **Select text** on any webpage
2. **Right-click** → "Translate selection"
3. **View translation** in notification popup

### Auto-Translate

Enable in **Options** → **Translation Preferences** → "Auto-translate pages"
- Automatically translates pages when loaded
- Respects blacklist settings
- 1-second delay for page stability

---

## ⚙️ Configuration

### API Keys Tab
- **Gemini API Key**: Primary translation engine (required)
- **Google Translate API Key**: Fallback engine (optional)
- Both keys stored with AES-256-GCM encryption

### Translation Preferences
- **Target Language**: Chinese (Simplified/Traditional), Japanese, Korean, etc.
- **Engine**: Gemini (high quality) or Google Translate (fast)
- **Domain**: Computer Science, Business, Science, Medical, General
- **Mode**: Fast, Smart, or Precise
- **Auto-translate**: Enable/disable automatic translation

### Display Settings
- **Color**: Custom hex color for translations
- **Font Style**: Normal or Italic
- **Font Size**: 80% to 120%
- **Preview**: Real-time preview of your settings

### Blacklist
- Add domains to exclude from translation
- Built-in list: Banking, payment, login pages
- Prevents accidental injection on sensitive sites

### Statistics
- Total characters translated
- Monthly usage tracking
- Last used date
- Engine breakdown

---

## 🏗️ Architecture

```
Chrome Extension (Manifest V3)
├── Background Service Worker
│   ├── Translation API orchestration
│   ├── API key encryption/decryption
│   ├── Message routing
│   └── Cache management
│
├── Content Script
│   ├── DOM content detection
│   ├── Bilingual rendering engine
│   ├── Floating button UI
│   └── MutationObserver (dynamic content)
│
├── Popup UI
│   ├── Quick translate controls
│   ├── Settings shortcuts
│   └── Usage statistics
│
└── Options Page
    ├── API configuration
    ├── Translation preferences
    ├── Display customization
    └── Blacklist management
```

### Tech Stack
- **Manifest V3** (modern Chrome extension standard)
- **ES6 Modules** (clean, modular code)
- **Web Crypto API** (AES-256-GCM encryption)
- **Chrome Storage API** (sync + local)
- **Gemini 2.5 Flash API** (primary translation)
- **Google Cloud Translation API** (fallback)

---

## 🧪 Testing

### E2E Tests (Puppeteer)
```bash
npm install
npm run test:e2e
```

**Coverage**:
- ✅ Extension loading and injection
- ✅ Floating button rendering
- ✅ Translation workflow (Reddit)
- ✅ Bilingual display
- ✅ Toggle functionality

### Manual Testing
See [MANUAL-TEST.md](MANUAL-TEST.md) for comprehensive checklist.

### Test Sites
- GitHub (technical documentation)
- Wikipedia (reference content)
- Medium (blogging platform)
- Reddit (dynamic content)
- Stack Overflow (Q&A)

---

## 🔐 Privacy Policy

**TL;DR**: We don't collect anything. All data stays on your device.

- ❌ No analytics or tracking
- ❌ No user accounts
- ❌ No data sent to our servers (we don't have any)
- ✅ API keys encrypted locally
- ✅ Translation cache stored locally
- ✅ Settings synced via Chrome (optional)

[Read full privacy policy](PRIVACY_POLICY.md)

---

## 🛠️ Development

### Project Structure
```
extension/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js     # Background worker (API, storage)
├── content/
│   ├── content.js            # Content script (translation logic)
│   ├── floating-button.js    # Floating UI component
│   └── *.css                 # Styles
├── popup/
│   ├── popup.html/js/css     # Extension popup
├── options/
│   ├── options.html/js/css   # Settings page
└── lib/
    ├── storage.js            # Storage manager (encryption)
    ├── translation-api.js    # API wrapper (Gemini/Google)
    ├── content-detector.js   # Content extraction
    ├── renderer.js           # Bilingual rendering
    └── message-router.js     # Message passing
```

### Key Features Implementation

#### ✅ API Key Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 (100,000 iterations)
- **Key Material**: Device fingerprint
- **Storage**: chrome.storage.sync (encrypted)

#### ✅ Content Detection
- **Strategy 1**: HTML5 semantic tags (`<article>`, `<main>`)
- **Strategy 2**: Common selectors (`#content`, `.post`)
- **Strategy 3**: Paragraph density algorithm
- **Exclusions**: Nav, sidebar, ads, code blocks

#### ✅ Translation Cache
- **Algorithm**: LRU (Least Recently Used)
- **Capacity**: 1000 entries
- **Expiration**: 7 days
- **Complexity**: O(1) insertion (optimized)

#### ✅ Progressive Rendering
- **Priority**: Viewport-visible content first
- **Background**: RequestIdleCallback for hidden content
- **Batching**: DocumentFragment for efficient DOM updates
- **Target**: <2s for first screen translation

---

## 📊 Performance

### Benchmarks (Target)
- **First-screen translation**: <2s (90th percentile)
- **Full page (5000 chars)**: <10s
- **Cache hit rate**: ≥30%
- **Memory footprint**: <100MB extension, <50MB content script

### Optimizations
- ✅ Viewport-first rendering
- ✅ Translation cache (30%+ hit rate)
- ✅ Batch API requests (10 paragraphs/batch)
- ✅ Debounced MutationObserver (300ms)
- ✅ LRU cache with O(1) eviction

---

## 🤝 Contributing

This project follows the **Claude Code PM** workflow for spec-driven development.

### Development Workflow
1. **PRD Creation**: Define product requirements
2. **Epic Planning**: Break into technical tasks
3. **GitHub Issues**: Track progress transparently
4. **Parallel Execution**: Multiple agents working simultaneously
5. **Code Review**: Pull requests with full context

See [README-CCPM.md](README-CCPM.md) for details on the development system.

### How to Contribute
1. Check [GitHub Issues](https://github.com/s87343472/local001/issues) for open tasks
2. Comment on an issue to claim it
3. Fork and create a feature branch
4. Submit PR with description linking to issue
5. Wait for review and CI checks

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

**Summary**: Free to use, modify, and distribute. No warranty provided.

---

## 🙏 Acknowledgments

- **Google Gemini API**: Primary translation engine
- **Google Cloud Translation**: Fallback translation
- **Chrome Extension APIs**: Platform infrastructure
- **Claude Code PM**: Development workflow system
- **Open Source Community**: Inspiration and feedback

---

## 📞 Support

### Get Help
- 📖 **Documentation**: Check this README and [MANUAL-TEST.md](MANUAL-TEST.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/s87343472/local001/issues)
- 💡 **Feature Requests**: [GitHub Issues](https://github.com/s87343472/local001/issues)
- 🔒 **Security Issues**: Report privately via GitHub Security tab

### FAQ

**Q: Is this extension free?**
A: Yes! The extension is free and open source. You need your own (free) Gemini API key.

**Q: How much does the Gemini API cost?**
A: Gemini 2.5 Flash has a **free tier** with generous limits (1500 requests/day). Perfect for personal use.

**Q: Does this work offline?**
A: No, translation requires internet connection to API. Cache works offline for previously translated content.

**Q: Which sites are blacklisted by default?**
A: Banking, payment, and login pages (e.g., accounts.google.com, paypal.com). You can customize in settings.

**Q: Can I use my own translation API?**
A: Currently supports Gemini and Google Translate. Open an issue to request other providers.

**Q: Why does it need so many permissions?**
A: See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for detailed justification. All permissions are necessary for core functionality.

---

## 🗺️ Roadmap

### v0.2.0 (Next Release)
- [ ] Chrome Web Store publication
- [ ] Additional E2E tests (5+ websites)
- [ ] Performance profiling and optimization
- [ ] User onboarding tutorial
- [ ] API key acquisition video guide

### v0.3.0 (Future)
- [ ] Support for more translation providers
- [ ] Custom dictionary (user-defined terms)
- [ ] Translation history viewer
- [ ] Export translations to file
- [ ] Browser action keyboard shortcuts

### v1.0.0 (Stable)
- [ ] Multi-browser support (Firefox, Edge)
- [ ] Offline translation (local models)
- [ ] Collaborative translation memory
- [ ] Advanced caching strategies

---

## ⭐ Star History

If this project helps you, consider giving it a star! ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=s87343472/local001&type=Date)](https://github.com/s87343472/local001)

---

**Made with ❤️ using Claude Code**
