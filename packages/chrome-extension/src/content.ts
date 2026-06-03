import ConfigStorageService from './services/config-storage-service';
import ElementPointerService from './services/element-pointer-service';
import { detectConflict } from './services/conflict-detection-service';
import ToastService from './services/toast-service';
import { setLocale, t } from './i18n';
import logger from './utils/logger';

logger.debug('🌍 DOM Pointer MCP content script loaded');

let pointer: ElementPointerService | null = null;
const toast = new ToastService();

async function initializePointer() {
  try {
    const config = await ConfigStorageService.load();
    setLocale(config.locale);

    if (!pointer) {
      pointer = new ElementPointerService(config.trigger.modifierKey);

      if (IS_DEV) {
        (window as any).pointerTargeter = pointer;
      }
    }

    if (config.enabled) {
      pointer.enable();
    } else {
      pointer.disable();
    }
  } catch (error) {
    logger.error('❌ Failed to initialize pointer:', error);
  }
}

ConfigStorageService.onChange((newConfig) => {
  setLocale(newConfig.locale);
  if (pointer) {
    pointer.setModifierKey(newConfig.trigger.modifierKey);

    if (newConfig.enabled) {
      pointer.enable();
    } else {
      pointer.disable();
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_CONFLICT') {
    ConfigStorageService.load().then((config) => {
      const result = detectConflict(config.trigger.modifierKey);
      sendResponse(result);
    });
    return true;
  }
  return false;
});

function checkConflictOnLoad() {
  ConfigStorageService.load().then((config) => {
    const result = detectConflict(config.trigger.modifierKey);
    if (result.hasConflict && result.message) {
      toast.show(result.message, t('conflict.toastAction'), () => {
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
      });
    }
  });
}

initializePointer();

if (document.readyState === 'complete') {
  setTimeout(checkConflictOnLoad, 500);
} else {
  window.addEventListener('load', () => setTimeout(checkConflictOnLoad, 500));
}
