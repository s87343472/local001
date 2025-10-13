---
name: chrome-translation-plugin
status: backlog
created: 2025-10-13T02:48:46Z
progress: 0%
prd: .claude/prds/chrome-translation-plugin.md
github: [Will be updated when synced to GitHub]
---

# Epic: Chrome Smart Translation Assistant

## Overview

A Chrome extension (Manifest V3) that provides professional-grade translation with bilingual parallel display. The system uses Gemini API as the primary translation engine with Google Translate as fallback, focusing on accurate technical terminology translation for computer science professionals. The architecture is fully client-side with no backend server required in MVP stage.

## Architecture Decisions

### Core Architecture
- **Chrome Extension Manifest V3**: Modern extension standard with background service worker
- **Pure Frontend Architecture**: No backend server - extension directly calls translation APIs
- **Modular Design**: Separate concerns across popup, options, background worker, and content script

### Technology Stack
- **Runtime**: Chrome Extension APIs (storage, scripting, tabs)
- **Translation**: Gemini 2.5 Flash API (primary), Google Translate API (fallback)
- **Storage**: chrome.storage.sync (settings), chrome.storage.local (cache)
- **Security**: Web Crypto API for API key encryption, CSP-compliant injection

### Key Technical Decisions
1. **Client-side only**: Reduces cost, enhances privacy, simplifies MVP deployment
2. **Bilingual parallel display**: Insert translations below original text without replacement
3. **Progressive rendering**: Render viewport content first, background translate remainder
4. **Content-first identification**: Use HTML5 semantic tags → common selectors → density algorithm
5. **Batch translation**: Group paragraphs (max 10/batch, 5000 chars) for API efficiency

## Technical Approach

### Frontend Components

**1. Content Script (content.js)**
- DOM content detection and paragraph extraction
- Bilingual rendering engine with progressive display
- Floating action button UI with state management
- MutationObserver for dynamic content (lazy-loaded pages)
- Translation cache integration

**2. Background Service Worker (background.js)**
- Translation API orchestration (Gemini/Google Translate)
- API key management and encryption/decryption
- Request queue and rate limiting (max 3 concurrent)
- Translation cache management (LRU, 1000 entries, 7-day expiry)
- Message routing between components

**3. Popup UI (popup.html/js)**
- Quick status display and controls
- Translation toggle (show/hide)
- Basic settings (engine, language, domain)
- Progress indicator

**4. Options Page (options.html/js)**
- API key configuration and validation
- Translation preferences (mode, domain, display style)
- Blacklist management
- Usage statistics display

### Core Algorithms

**Content Detection Algorithm** (Priority-based):
```
1. HTML5 semantic tags: <article>, <main>, [role="main"]
2. Common content selectors: #content, .content, .post, .article
3. Paragraph density: text_chars / (tag_count + link_count)
4. Exclude: <nav>, <aside>, <footer>, <code>, <pre>, buttons, inputs
```

**Translation Workflow**:
```
1. User clicks floating button
2. Content script extracts main content paragraphs
3. Check local cache for existing translations
4. Send uncached text to background worker
5. Background calls Gemini API with domain-specific prompt
6. Progressive rendering as results arrive (batches of 5 paragraphs)
7. Cache results locally
8. Update progress indicator
```

**Prompt Engineering** (for Gemini):
```
You are a professional {domain} translator.
Task: Translate {source} to {target}.
Requirements:
1. Accurate technical terminology for {domain}
2. Maintain tone and style
3. Context-aware disambiguation
4. Output: Pure JSON array format

Technical terms ({domain}):
- Bus → 总线 (not 公交车)
- Thread → 线程 (not 线索)
[domain-specific dictionary]

Input: [paragraphs]
Output format: ["translation1", "translation2", ...]
```

### Infrastructure

**Local Storage Schema**:
```javascript
// chrome.storage.sync (100KB limit)
{
  apiKeys: { gemini: encrypted, googleTranslate: encrypted },
  preferences: { targetLang, engine, domain, mode, autoTranslate },
  displaySettings: { color, style, fontSize },
  blacklist: ["bank.com", "paypal.com"]
}

// chrome.storage.local (10MB limit)
{
  translationCache: {
    [hash]: { translation, timestamp, engine }
  }, // max 1000 entries
  statistics: { totalChars, requests, monthlyUsage },
  siteConfigs: { [domain]: { lastTranslated, customSettings } }
}
```

**Security Measures**:
- API keys encrypted with AES-256 using device fingerprint-based key
- Keys only accessible in background service worker
- No key exposure to content scripts or page context
- HTTPS-only API calls
- XSS prevention: use textContent for translations, not innerHTML

**Performance Optimizations**:
- Viewport-first rendering (<2s for first screen)
- RequestIdleCallback for background translation
- DocumentFragment for batch DOM insertion
- Translation cache (30% hit rate target)
- Debounced MutationObserver for dynamic content

## Implementation Strategy

### Development Phases

**Phase 1: Foundation (Week 1)**
- Manifest V3 setup and basic extension structure
- Message passing architecture between components
- Local storage modules (encrypted for API keys)
- Empty UI shells (popup, options, floating button)

**Phase 2: Core Translation (Weeks 2-3)**
- Content detection algorithm implementation
- Gemini API integration with prompt engineering
- Bilingual rendering engine
- Translation cache with LRU eviction
- Error handling and retry logic

**Phase 3: UI & Settings (Week 4)**
- Complete popup and options page
- API key configuration and validation
- Display settings and preferences
- Floating button states and animations
- Progress indicators

**Phase 4: Polish & Testing (Weeks 5-6)**
- Cross-site compatibility testing (20+ major sites)
- Performance optimization and profiling
- Error recovery and edge cases
- Documentation and onboarding flow
- Chrome Web Store submission materials

### Risk Mitigation

1. **Translation Quality**: Implement output validation and fallback to Google Translate on format errors
2. **Site Compatibility**: Create site-specific adapters for top 10 sites, generic algorithm for others
3. **Performance**: Profile on large pages, implement progressive rendering, limit concurrent API calls
4. **API Key Onboarding**: Detailed tutorial with video, provide trial key for initial testing

### Testing Approach

- **Unit Tests**: Content detection, paragraph extraction, cache logic
- **Integration Tests**: Message passing, API calls, storage operations
- **E2E Tests**: Full translation flow on 20 major websites
- **Performance Tests**: First paint <2s, full page <10s on median hardware
- **Security Tests**: API key encryption, XSS prevention, CSP compliance

## Task Breakdown Preview

High-level task categories (aim for <10 total tasks):

- [ ] **T1: Extension Infrastructure** - Manifest V3 setup, service worker, message passing, storage modules
- [ ] **T2: Content Detection Engine** - DOM parsing, paragraph extraction, filter rules, cache integration
- [ ] **T3: Translation API Integration** - Gemini API client, prompt engineering, Google Translate fallback, retry logic
- [ ] **T4: Bilingual Rendering** - Progressive DOM insertion, styling, show/hide toggle, MutationObserver
- [ ] **T5: Floating Button UI** - Position, states, animations, expand panel, user interactions
- [ ] **T6: Settings & Configuration** - Options page, API key validation, preferences, blacklist management
- [ ] **T7: Popup Interface** - Status display, quick controls, progress indicator
- [ ] **T8: Security & Privacy** - API key encryption, CSP compliance, XSS prevention, blacklist enforcement
- [ ] **T9: Testing & Compatibility** - Cross-site testing, performance profiling, bug fixes
- [ ] **T10: Documentation & Publishing** - User guide, API key tutorial, Chrome Web Store materials

## Dependencies

**External Services**:
- Gemini 2.5 Flash API (https://generativelanguage.googleapis.com)
- Google Cloud Translation API (optional fallback)
- Chrome Web Store (distribution)

**Technical Prerequisites**:
- Chrome 88+ (Manifest V3 support)
- User-provided Gemini API key (or shared trial key)

**Development Tools**:
- Chrome Extension APIs: storage, scripting, tabs, activeTab
- Web Crypto API for encryption
- MutationObserver API for dynamic content

## Success Criteria (Technical)

### Performance Benchmarks
- First-screen translation: ≤2s (90th percentile)
- Full page translation: ≤10s for 5000-char medium page
- Floating button response: ≤100ms
- Cache hit rate: ≥30%
- Memory footprint: <100MB extension, <50MB per content script

### Quality Gates
- Content detection accuracy: ≥90% on top 20 sites
- Translation rendering: No layout breakage on tested sites
- API success rate: ≥99% (with retry logic)
- No code injection vulnerabilities (XSS, CSP violations)

### Acceptance Criteria
- Passes Chrome Web Store review on first submission
- User can configure API key and see successful translation
- Bilingual display preserves original layout
- Works on GitHub, Wikipedia, Medium, Stack Overflow (primary targets)
- Blacklist prevents injection on banking/payment sites
- Settings persist across browser sessions

## Estimated Effort

### Overall Timeline
- **Development**: 6 weeks (2 engineers)
- **Testing & Polish**: 2 weeks
- **Total to Launch**: 8 weeks

### Resource Requirements
- 2x Frontend developers (Chrome extension experience preferred)
- 0.5x Product manager (part-time)
- 1x UI designer (week 1 only)
- 1x QA engineer (weeks 5-6)

### Critical Path Items
1. Content detection algorithm (must work across diverse sites)
2. Gemini API integration with reliable prompt engineering
3. Bilingual rendering without layout breakage
4. Chrome Web Store compliance (privacy policy, permissions justification)

### Risk Buffer
- Additional 2 weeks for unforeseen compatibility issues
- Budget for API costs during testing (~$100)
- Contingency for Chrome Web Store review delays (1-2 weeks)

---

**Next Steps**: Run `/pm:epic-decompose chrome-translation-plugin` to break down into detailed implementation tasks.
