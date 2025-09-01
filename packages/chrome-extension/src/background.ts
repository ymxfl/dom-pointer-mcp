import { ConnectionStatus } from '@mcp-pointer/shared';
import logger from './logger';
import { ElementSenderService } from './element-sender-service';
import { ConfigStorage } from './storage';
import { ExtensionConfig } from './config';

let elementSender: ElementSenderService;
let currentConfig: ExtensionConfig;

// Initialize when service worker starts
async function initialize() {
  currentConfig = await ConfigStorage.load();

  // Create the service (no connection on startup)
  elementSender = new ElementSenderService();

  logger.info('🚀 AI Glasses background script loaded', {
    enabled: currentConfig.enabled,
    port: currentConfig.websocket.port,
  });
}

// Listen for config changes
ConfigStorage.onChange((newConfig: ExtensionConfig) => {
  logger.info('⚙️ Config changed:', newConfig);

  // Simply update the config - ElementSenderService handles port changes automatically
  currentConfig = newConfig;

  if (newConfig.enabled) {
    logger.info('✅ Extension enabled');
  } else {
    logger.info('❌ Extension disabled');
  }
});

// Listen for messages from content script
chrome.runtime.onMessage
  .addListener((request: any, _sender: any, sendResponse: (response: any) => void) => {
    if (!currentConfig?.enabled) {
      sendResponse({ success: false, error: 'Extension is disabled' });
      return;
    }

    if (request.type === 'ELEMENT_SELECTED' && request.data) {
      // Send element with current port and status callback
      elementSender.sendElement(
        request.data,
        currentConfig.websocket.port,
        (status, error) => {
          // Status flow: CONNECTING -> CONNECTED -> SENDING -> SENT
          switch (status) {
            case ConnectionStatus.CONNECTING:
              logger.info('🔄 Connecting to WebSocket...');
              break;
            case ConnectionStatus.CONNECTED:
              logger.info('✅ Connected');
              break;
            case ConnectionStatus.SENDING:
              logger.info('📤 Sending element...');
              break;
            case ConnectionStatus.SENT:
              logger.info('✓ Element sent successfully');
              break;
            case ConnectionStatus.ERROR:
              logger.error('❌ Failed:', error);
              break;
            default:
              break;
          }
        },
      );

      sendResponse({ success: true });
    }
  });

// Start initialization
initialize();
