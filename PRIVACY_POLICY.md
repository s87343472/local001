# Privacy Policy for Chrome Smart Translation Assistant

**Last Updated:** October 22, 2025
**Version:** 0.1.0

## Introduction

Chrome Smart Translation Assistant ("we", "our", or "the Extension") is committed to protecting your privacy. This privacy policy explains how we handle data in our Chrome extension.

## Data Collection

**We do NOT collect, store, or transmit any personal data to our servers.** Specifically:

- ❌ No analytics or tracking
- ❌ No user accounts or authentication
- ❌ No data sent to third-party servers (except translation APIs)
- ❌ No cookies or persistent identifiers
- ❌ No access to browsing history
- ❌ No keystroke logging or form data collection

## Data Storage

All data is stored **locally on your device** using Chrome's storage APIs:

### Local Storage (chrome.storage.local)
- **Translation Cache:** Temporarily stores translations you've requested (max 1000 entries, 7-day expiration)
- **Usage Statistics:** Character count and request count for display in the extension UI
- **Purpose:** Improve performance by avoiding redundant API calls

### Synced Storage (chrome.storage.sync)
- **Settings:** Your preferences (language, engine, domain, display style)
- **Blacklist:** Domains where you've disabled translation
- **API Keys:** Your personal API keys (encrypted using AES-256-GCM)
- **Purpose:** Maintain your settings across devices signed into Chrome

**Note:** Synced storage uses Chrome's built-in sync mechanism. We do not control or access this sync process.

## Data Processing

### Translation Text
- **What:** The text content you choose to translate on web pages
- **Where:** Sent **directly** to the translation API you selected (Gemini or Google Translate)
- **When:** Only when you click "Translate" or enable auto-translate
- **Retention:** Not stored by us; refer to the API provider's privacy policy:
  - [Google AI (Gemini) Privacy Policy](https://policies.google.com/privacy)
  - [Google Cloud Privacy Policy](https://cloud.google.com/terms/cloud-privacy-notice)

### API Keys
- **Storage:** Encrypted using AES-256-GCM with device-specific key derivation
- **Access:** Only accessible within the extension's background service worker
- **Transmission:** Only sent to the respective API endpoints (Gemini/Google Translate)
- **Security:** Never exposed to content scripts or web pages

## Third-Party Services

The Extension uses the following third-party services **only when you provide an API key**:

1. **Google Gemini API**
   - Purpose: Primary translation engine
   - Data sent: Text you choose to translate
   - Privacy Policy: https://policies.google.com/privacy

2. **Google Cloud Translation API** (Optional)
   - Purpose: Fallback translation engine
   - Data sent: Text you choose to translate
   - Privacy Policy: https://cloud.google.com/terms/cloud-privacy-notice

**Important:** You maintain direct control over your API keys. The Extension acts only as a client to these services.

## Permissions Justification

The Extension requests the following Chrome permissions:

- **storage:** Save your settings, cache, and encrypted API keys locally
- **activeTab:** Access content of the current tab when you click translate
- **scripting:** Inject translation rendering into web pages
- **contextMenus:** Add "Translate selection" to right-click menu
- **notifications:** Display translation results for selected text
- **https://*/*:** Required to translate content on HTTPS websites

## Data Retention

- **Translation Cache:** Automatically deleted after 7 days
- **Settings:** Retained until you uninstall the extension or manually clear Chrome storage
- **Statistics:** Retained locally until you uninstall or clear data

## Data Deletion

You can delete all extension data at any time:

1. **Via Extension:** Options page → Settings → "Clear All Data" (if implemented)
2. **Via Chrome:**
   - Right-click extension icon → "Remove from Chrome"
   - Or: chrome://extensions → Find extension → "Remove"
3. **Manual:** Chrome Settings → Privacy → Site Settings → Clear browsing data → "Cookies and other site data"

## User Rights

You have the right to:

- ✅ Use the Extension without providing any personal information
- ✅ Use your own API keys (we never collect or store our own keys)
- ✅ Disable auto-translate feature
- ✅ Add domains to blacklist to prevent injection
- ✅ Uninstall the Extension at any time
- ✅ Review the source code (open source: https://github.com/s87343472/local001)

## Children's Privacy

The Extension does not knowingly collect or process data from children under 13 years of age. The Extension is designed for professional use and does not target children.

## Changes to This Policy

We may update this privacy policy as the Extension evolves. Changes will be reflected with a new "Last Updated" date at the top of this policy. Continued use after changes constitutes acceptance of the updated policy.

## Security

We implement security measures including:

- AES-256-GCM encryption for API keys
- No transmission of sensitive data except to legitimate API endpoints
- XSS prevention in translation rendering
- Content Security Policy compliance
- No execution of remote code

## Contact

For questions, concerns, or data requests related to this Extension:

- **GitHub Issues:** https://github.com/s87343472/local001/issues
- **Email:** [Your contact email - to be added]

## Compliance

This Extension complies with:

- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) requirements

**Key Compliance Points:**

- No personal data collection
- Local-first data storage
- User control over all data
- Transparent data practices
- Minimal permissions requested

## Open Source

This Extension is open source. You can review the entire codebase at:
**https://github.com/s87343472/local001**

We encourage security researchers and privacy advocates to audit our code and report any concerns.

---

**Summary:**
Chrome Smart Translation Assistant is a **privacy-first** extension. We don't collect your data, we don't track you, and we don't sell anything. Your translation data goes directly to the API provider you choose, and your settings stay on your device. Simple as that.
