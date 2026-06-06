import { LogLevel } from '@dom-pointer-mcp/shared/logger';
import { Locale } from '../i18n/types';

export type ModifierKey = 'Alt' | 'Ctrl' | 'Meta';
export type { Locale } from '../i18n/types';

export interface ExtensionConfig {
  enabled: boolean;
  locale: Locale;
  websocket: {
    port: number;
  };
  logger: {
    enabled: boolean;
    level: LogLevel;
  };
  behavior: {
    clearAfterSend: boolean;
    captureScreenshot: boolean;
    showHistoryDrawer: boolean;
  };
  trigger: {
    modifierKey: ModifierKey;
  };
}

const config: ExtensionConfig = {
  enabled: true,
  locale: 'zh',
  websocket: {
    port: 7007,
  },
  logger: {
    enabled: IS_DEV,
    level: LogLevel.DEBUG,
  },
  behavior: {
    clearAfterSend: true,
    captureScreenshot: false,
    showHistoryDrawer: false,
  },
  trigger: {
    modifierKey: 'Alt',
  },
};

export default config;
