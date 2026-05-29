import { ConnectionStatus } from '@dom-pointer-mcp/shared/types';
import logger from './utils/logger';
import { ElementSenderService } from './services/element-sender-service';
import { ExtensionConfig } from './utils/config';
import ConfigStorageService from './services/config-storage-service';

let elementSender: ElementSenderService;
let currentConfig: ExtensionConfig;

// Initialize when service worker starts
async function initialize() {
  currentConfig = await ConfigStorageService.load();

  // Create the service (no connection on startup)
  elementSender = new ElementSenderService();

  logger.info('🚀 DOM Pointer MCP background script loaded', {
    enabled: currentConfig.enabled,
    port: currentConfig.websocket.port,
  });
}

// Listen for config changes
ConfigStorageService.onChange((newConfig: ExtensionConfig) => {
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
    if (request.type === 'SELECTION_SENT' && request.data) {
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

    return true; // Keep message channel open for async response
  });

// Start initialization
initialize();
