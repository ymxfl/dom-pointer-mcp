import logger from './logger';
import { ConfigStorage } from './storage';

let isExtensionEnabled = true;
let urlFilters: string[] = ['<all_urls>'];

// Initialize config
async function initializeConfig() {
  try {
    const config = await ConfigStorage.load();
    isExtensionEnabled = config.enabled;
    urlFilters = config.urlFilters;

    logger.debug('🌉 Bridge config loaded:', { enabled: isExtensionEnabled, urlFilters });
  } catch (error) {
    logger.error('❌ Bridge failed to load config:', error);
  }
}

// Listen for config changes
ConfigStorage.onChange((newConfig) => {
  isExtensionEnabled = newConfig.enabled;
  urlFilters = newConfig.urlFilters;
  logger.debug('🌉 Bridge config updated:', { enabled: isExtensionEnabled, urlFilters });
});

// Check if current URL matches filters
function urlMatches(): boolean {
  const currentUrl = window.location.href;

  return urlFilters.some((filter) => {
    if (filter === '<all_urls>') return true;

    // Convert Chrome extension pattern to regex
    const pattern = filter
      .replace(/\*/g, '.*')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${pattern}$`);
    return regex.test(currentUrl);
  });
}

// Bridge script - runs in isolated world and forwards messages from main world to background
logger.info('🌉 Bridge script loaded');

// Initialize configuration
initializeConfig();

// Listen for messages from main world
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'MCP_POINTER_ELEMENT_SELECTED' && event.data.data) {
    if (!isExtensionEnabled) {
      logger.debug('🌉 Bridge: Extension disabled, ignoring element');
      return;
    }

    if (!urlMatches()) {
      logger.debug('🌉 Bridge: URL not in filters, ignoring element');
      return;
    }

    logger.debug('🌉 Bridge forwarding element to background:', event.data.data);

    // Forward to background script
    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTED',
      data: event.data.data,
    }, (response: any) => {
      if (chrome.runtime.lastError) {
        logger.error('❌ Bridge error sending to background:', chrome.runtime.lastError);
      } else {
        logger.debug('✅ Bridge forwarded successfully:', response);
      }
    });
  }
});
