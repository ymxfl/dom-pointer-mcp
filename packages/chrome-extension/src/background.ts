import { ConnectionStatus, PointerMessageType } from '@dom-pointer-mcp/shared/types';
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

const ready = initialize();

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
  .addListener((request: any, sender: any, sendResponse: (response: any) => void) => {
    if (request.type === 'CAPTURE_VISIBLE_TAB_SCREENSHOT') {
      ready.then(() => {
        const windowId = sender.tab?.windowId;
        chrome.tabs.captureVisibleTab(
          windowId,
          { format: 'png' },
          (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError?.message ?? 'Unable to capture visible tab',
              });
              return;
            }
            sendResponse({ success: true, dataUrl });
          },
        );
      }).catch((error) => {
        sendResponse({ success: false, error: (error as Error).message });
      });
      return true;
    }

    if (request.type === 'SELECTION_SENT' && request.data) {
      ready.then(() => elementSender.sendSelection(
        request.data,
        currentConfig.websocket.port,
        (status, error) => {
          switch (status) {
            case ConnectionStatus.CONNECTING:
              logger.info('🔄 Connecting to WebSocket...');
              break;
            case ConnectionStatus.CONNECTED:
              logger.info('✅ Connected');
              break;
            case ConnectionStatus.SENDING:
              logger.info('📤 Sending selection...');
              break;
            case ConnectionStatus.SENT:
              logger.info('✓ Selection sent successfully');
              break;
            case ConnectionStatus.ERROR:
              logger.error('❌ Failed:', error);
              break;
            default:
              break;
          }
        },
      )).then((ack) => {
        sendResponse({ success: true, data: ack });
      }).catch((error) => {
        logger.error('❌ Failed to send selection:', error);
        sendResponse({ success: false, error: (error as Error).message });
      });
      return true;
    }

    if (request.type === PointerMessageType.HISTORY_LIST_REQUEST) {
      ready.then(() => elementSender.listHistory(currentConfig.websocket.port))
        .then((data) => {
          sendResponse({ success: true, data });
        })
        .catch((error) => {
          logger.error('❌ Failed to list history:', error);
          sendResponse({ success: false, error: (error as Error).message });
        });
      return true;
    }

    if (request.type === PointerMessageType.HISTORY_GET_REQUEST && request.selectionId) {
      ready.then(() => elementSender.getHistorySelection(
        request.selectionId,
        currentConfig.websocket.port,
      ))
        .then((data) => {
          sendResponse({ success: true, data });
        })
        .catch((error) => {
          logger.error('❌ Failed to get history selection:', error);
          sendResponse({ success: false, error: (error as Error).message });
        });
      return true;
    }

    if (request.type === PointerMessageType.HISTORY_CLEAR_REQUEST) {
      ready.then(() => elementSender.clearHistory(
        request.selectionId,
        currentConfig.websocket.port,
      ))
        .then((data) => {
          sendResponse({ success: true, data });
        })
        .catch((error) => {
          logger.error('❌ Failed to clear history:', error);
          sendResponse({ success: false, error: (error as Error).message });
        });
      return true;
    }

    return true; // Keep message channel open for async response
  });
