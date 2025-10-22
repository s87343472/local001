/**
 * Translation API Handler
 * Supports Gemini API (primary) and Google Translate API (fallback)
 */

export class TranslationAPI {
  constructor() {
    // Use Gemini 2.5 Flash Lite - optimized for speed and cost-efficiency
    // Perfect for translation tasks: fast, lightweight, excellent quality
    this.geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
    this.googleTranslateEndpoint = 'https://translation.googleapis.com/language/translate/v2';

    // Rate limiting
    this.maxConcurrent = 3;
    this.activeRequests = 0;
    this.requestQueue = [];

    // Domain-specific dictionaries
    this.domainDictionaries = {
      computer: `
- Bus → 总线 (not 公交车)
- Thread → 线程 (not 线索)
- Memory → 内存 (not 记忆)
- Cache → 缓存 (not 现金)
- Object → 对象 (not 物体)
- Stack → 栈 (not 堆栈)
- Heap → 堆 (not 堆)
- Compile → 编译 (not 编辑)
- Deploy → 部署 (not 配置)
- Commit → 提交 (not 承诺)
- Repository → 仓库 (not 存储库)
- Branch → 分支 (not 树枝)
- Merge → 合并 (not 融合)
      `.trim(),
      business: `
- Revenue → 营收 (not 收入)
- Profit → 利润 (not 收益)
- Loss → 亏损 (not 损失)
- Asset → 资产 (not 财产)
- Liability → 负债 (not 责任)
- Equity → 权益 (not 公平)
- Stakeholder → 利益相关方 (not 股东)
- Shareholder → 股东 (not 利益相关方)
- ROI (Return on Investment) → 投资回报率
- KPI (Key Performance Indicator) → 关键绩效指标
- B2B → 企业对企业
- B2C → 企业对消费者
- Quarter → 季度 (not 四分之一)
- Fiscal Year → 财政年度
- Cash Flow → 现金流
      `.trim(),
      science: `
- Hypothesis → 假设 (not 猜想)
- Theory → 理论 (not 理论性)
- Experiment → 实验 (not 试验)
- Variable → 变量 (not 可变的)
- Control → 对照组 (not 控制)
- Sample → 样本 (not 样品)
- Population → 总体 (not 人口)
- Correlation → 相关性 (not 关联)
- Causation → 因果关系 (not 原因)
- Significant → 显著的 (not 重要的)
- Peer Review → 同行评审
- Methodology → 方法论
- Data Set → 数据集
- Observation → 观察 (not 观测)
- Conclusion → 结论 (not 总结)
      `.trim(),
      medical: `
- Symptom → 症状 (not 迹象)
- Diagnosis → 诊断 (not 诊断学)
- Prognosis → 预后 (not 预测)
- Treatment → 治疗 (not 处理)
- Therapy → 疗法 (not 治疗)
- Prescription → 处方 (not 规定)
- Syndrome → 综合征 (not 症候群)
- Chronic → 慢性的 (not 长期的)
- Acute → 急性的 (not 严重的)
- Benign → 良性的 (not 温和的)
- Malignant → 恶性的 (not 恶意的)
- Pathogen → 病原体 (not 病菌)
- Antibody → 抗体 (not 抗菌)
- Vaccine → 疫苗 (not 接种)
- Clinical Trial → 临床试验
      `.trim(),
      general: ''
    };
  }

  /**
   * Main translation function
   * @param {Object} data - Translation request data
   * @returns {Promise<Object>} - Translation result
   */
  async translate(data) {
    const { paragraphs, settings } = data;

    // Get settings with defaults
    const targetLang = settings?.targetLanguage || 'zh-CN';
    const engine = settings?.defaultEngine || 'gemini';
    const domain = settings?.professionalDomain || 'computer';
    const mode = settings?.translationMode || 'smart';

    // Batch paragraphs
    const batches = this.createBatches(paragraphs, 10, 5000);
    const results = [];

    console.log(`Translating ${paragraphs.length} paragraphs in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} paragraphs)`);

      try {
        let translations;

        // Choose engine based on mode
        if (mode === 'fast' || engine === 'google') {
          translations = await this.translateWithGoogle(batch, targetLang);
        } else {
          try {
            translations = await this.translateWithGemini(batch, targetLang, domain);
          } catch (error) {
            console.warn('Gemini failed, falling back to Google Translate:', error.message);
            translations = await this.translateWithGoogle(batch, targetLang);
          }
        }

        // Combine results
        results.push(...translations);

      } catch (error) {
        console.error('Batch translation failed:', error);
        // Add error placeholders
        batch.forEach(p => {
          results.push({
            hash: p.hash,
            translation: `[Translation failed: ${error.message}]`,
            error: true
          });
        });
      }
    }

    return {
      translations: results,
      totalChars: paragraphs.reduce((sum, p) => sum + p.text.length, 0)
    };
  }

  /**
   * Translate using Gemini API
   * @param {Array} paragraphs - Paragraphs to translate
   * @param {string} targetLang - Target language code
   * @param {string} domain - Professional domain
   * @returns {Promise<Array>} - Translations
   */
  async translateWithGemini(paragraphs, targetLang, domain) {
    // Get API key from storage
    const apiKey = await this.getApiKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Build prompt
    const prompt = this.buildGeminiPrompt(paragraphs, targetLang, domain);

    // Make request with retry
    const response = await this.retryRequest(async () => {
      const res = await fetch(`${this.geminiEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
          }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${res.status} - ${errorData.error?.message || res.statusText}`);
      }

      return res.json();
    }, 3);

    // Extract translations
    const translations = this.parseGeminiResponse(response, paragraphs);

    // Validate
    this.validateTranslations(translations, paragraphs);

    return translations;
  }

  /**
   * Build Gemini prompt
   * @param {Array} paragraphs - Paragraphs to translate
   * @param {string} targetLang - Target language
   * @param {string} domain - Professional domain
   * @returns {string} - Prompt text
   */
  buildGeminiPrompt(paragraphs, targetLang, domain) {
    const dictionary = this.domainDictionaries[domain] || this.domainDictionaries.general;
    const langName = this.getLanguageName(targetLang);

    const texts = paragraphs.map(p => p.text);

    return `You are a translation assistant. Translate these English texts to ${langName}.

${dictionary ? `Technical terminology (${domain} domain):\n${dictionary}\n\n` : ''}
English texts to translate:
${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Respond with ONLY a JSON array containing ${texts.length} ${langName} translations.
Format: ["translation1", "translation2", ...]
Do not include any explanations, labels, or markdown formatting.`;
  }

  /**
   * Parse Gemini API response
   * @param {Object} response - API response
   * @param {Array} paragraphs - Original paragraphs
   * @returns {Array} - Parsed translations
   */
  parseGeminiResponse(response, paragraphs) {
    try {
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        console.error('Gemini response structure:', JSON.stringify(response, null, 2));
        throw new Error('No content in Gemini response');
      }

      console.log('Gemini returned:', content.substring(0, 200) + (content.length > 200 ? '...' : ''));

      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Full Gemini response text:', content);
        throw new Error('No JSON array found in response');
      }

      const translations = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(translations)) {
        throw new Error('Response is not an array');
      }

      console.log(`Parsed ${translations.length} translations from Gemini`);

      // Map to paragraph hashes
      return paragraphs.map((p, i) => ({
        hash: p.hash,
        translation: translations[i] || p.text,
        engine: 'gemini'
      }));

    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      throw new Error(`Gemini response parsing failed: ${error.message}`);
    }
  }

  /**
   * Translate using Google Translate API
   * @param {Array} paragraphs - Paragraphs to translate
   * @param {string} targetLang - Target language code
   * @returns {Promise<Array>} - Translations
   */
  async translateWithGoogle(paragraphs, targetLang) {
    // Get API key from storage
    const apiKey = await this.getApiKey('googleTranslate');
    if (!apiKey) {
      // Use free public API endpoint (limited)
      return this.translateWithGoogleFree(paragraphs, targetLang);
    }

    const texts = paragraphs.map(p => p.text);

    const response = await this.retryRequest(async () => {
      const res = await fetch(`${this.googleTranslateEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: texts,
          target: targetLang,
          format: 'text'
        })
      });

      if (!res.ok) {
        throw new Error(`Google Translate API error: ${res.status}`);
      }

      return res.json();
    }, 3);

    // Parse response
    const translations = response.data.translations.map((t, i) => ({
      hash: paragraphs[i].hash,
      translation: t.translatedText,
      engine: 'google'
    }));

    return translations;
  }

  /**
   * Translate using free Google Translate (fallback)
   * Uses unofficial endpoint - for demo purposes only
   * @param {Array} paragraphs - Paragraphs to translate
   * @param {string} targetLang - Target language code
   * @returns {Promise<Array>} - Translations
   */
  async translateWithGoogleFree(paragraphs, targetLang) {
    console.warn('Using fallback translation (no API key configured)');

    // For MVP demo: return mock translations
    // In production, implement proper API call or require API key
    return paragraphs.map(p => ({
      hash: p.hash,
      translation: `[Translation to ${targetLang}]: ${p.text.substring(0, 50)}...`,
      engine: 'mock',
      mock: true
    }));
  }

  /**
   * Validate translations
   * @param {Array} translations - Translation results
   * @param {Array} paragraphs - Original paragraphs
   */
  validateTranslations(translations, paragraphs) {
    if (translations.length !== paragraphs.length) {
      throw new Error(`Translation count mismatch: expected ${paragraphs.length}, got ${translations.length}`);
    }

    for (let i = 0; i < translations.length; i++) {
      const trans = translations[i];
      const orig = paragraphs[i];

      // Check if translation is too short (likely error)
      if (trans.translation.length < orig.text.length * 0.2) {
        console.warn('Translation seems too short:', trans);
      }

      // Check if translation is identical (not translated)
      if (trans.translation === orig.text) {
        console.warn('Translation identical to original:', trans);
      }
    }
  }

  /**
   * Validate API key
   * @param {string} key - API key to validate
   * @param {string} engine - Engine type (gemini/google)
   * @returns {Promise<boolean>} - Whether key is valid
   */
  async validateKey(key, engine) {
    try {
      if (engine === 'gemini') {
        const res = await fetch(`${this.geminiEndpoint}?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'test' }] }]
          })
        });
        return res.ok || res.status === 400; // 400 is ok (invalid request but key works)
      } else if (engine === 'google') {
        const res = await fetch(`${this.googleTranslateEndpoint}?key=${key}&q=test&target=zh`);
        return res.ok;
      }
      return false;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  /**
   * Retry a request with exponential backoff
   * @param {Function} requestFn - Request function
   * @param {number} maxRetries - Maximum retries
   * @returns {Promise} - Request result
   */
  async retryRequest(requestFn, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Create batches from paragraphs
   * @param {Array} paragraphs - All paragraphs
   * @param {number} maxCount - Max paragraphs per batch
   * @param {number} maxChars - Max characters per batch
   * @returns {Array<Array>} - Batches
   */
  createBatches(paragraphs, maxCount, maxChars) {
    const batches = [];
    let currentBatch = [];
    let currentChars = 0;

    for (const para of paragraphs) {
      const paraLength = para.text.length;

      if (currentBatch.length >= maxCount || currentChars + paraLength > maxChars) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentChars = 0;
        }
      }

      currentBatch.push(para);
      currentChars += paraLength;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Get API key from storage
   * @param {string} engine - Engine name
   * @returns {Promise<string|null>} - API key
   */
  async getApiKey(engine) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['apiKeys'], (data) => {
        const apiKeys = data.apiKeys || {};

        // Support both 'google' and 'googleTranslate' naming conventions
        let encodedKey = apiKeys[engine];
        if (!encodedKey && engine === 'googleTranslate') {
          encodedKey = apiKeys.google;
        }

        if (!encodedKey) {
          encodedKey = null;
        }

        // Decode base64-encoded API key
        let key = null;
        if (encodedKey) {
          try {
            key = atob(encodedKey);
          } catch (e) {
            console.error(`Failed to decode API key for '${engine}':`, e);
            key = encodedKey; // Fallback to raw key if decode fails
          }
        }

        console.log(`[TranslationAPI] Getting API key for '${engine}':`, {
          hasKey: !!key,
          keyLength: key?.length,
          keyPrefix: key ? key.substring(0, 10) + '...' : 'none'
        });
        resolve(key);
      });
    });
  }

  /**
   * Get language name from code
   * @param {string} code - Language code
   * @returns {string} - Language name
   */
  getLanguageName(code) {
    const names = {
      'zh-CN': 'Simplified Chinese',
      'zh-TW': 'Traditional Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ru': 'Russian'
    };
    return names[code] || code;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
