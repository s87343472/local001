/**
 * Message Router
 * Handles message passing between extension components
 */

class MessageRouter {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register a message handler
   * @param {string} action - The action type
   * @param {Function} handler - The handler function
   */
  register(action, handler) {
    this.handlers.set(action, handler);
  }

  /**
   * Route a message to the appropriate handler
   * @param {Object} message - The message object
   * @param {Object} sender - The message sender
   * @returns {Promise<any>} - The handler result
   */
  async route(message, sender) {
    const { action, data, requestId } = message;

    if (!this.handlers.has(action)) {
      throw new Error(`No handler registered for action: ${action}`);
    }

    const handler = this.handlers.get(action);
    const result = await handler(data, sender);

    return {
      requestId,
      result,
      timestamp: Date.now()
    };
  }

  /**
   * Send a message to a specific tab
   * @param {number} tabId - The tab ID
   * @param {string} action - The action type
   * @param {Object} data - The message data
   * @returns {Promise<any>} - The response
   */
  static async sendToTab(tabId, action, data) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          action,
          data,
          requestId: this.generateRequestId(),
          timestamp: Date.now()
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Send a message to the background script with retry
   * @param {string} action - The action type
   * @param {Object} data - The message data
   * @param {number} retries - Number of retries (default: 2)
   * @returns {Promise<any>} - The response
   */
  static async sendToBackground(action, data, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await new Promise((resolve, reject) => {
          // Wake up service worker first
          chrome.runtime.getPlatformInfo(() => {
            chrome.runtime.sendMessage(
              {
                action,
                data,
                requestId: this.generateRequestId(),
                timestamp: Date.now()
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(response);
                }
              }
            );
          });
        });

        return response;
      } catch (error) {
        const isContextError = error.message.includes('Extension context invalidated');
        const isLastAttempt = attempt === retries;

        if (isContextError && !isLastAttempt) {
          console.warn(`Service worker not responding, retry ${attempt + 1}/${retries}...`);
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * Generate a unique request ID
   * @returns {string} - A unique ID
   */
  static generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// For content scripts only - no exports allowed
// ES6 modules should import from message-router-es6.js instead
