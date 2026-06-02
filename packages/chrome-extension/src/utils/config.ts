import { LogLevel } from '@dom-pointer-mcp/shared/logger';

export type ModifierKey = 'Alt' | 'Ctrl' | 'Meta';

export interface ExtensionConfig {
  enabled: boolean;
  websocket: {
    port: number;
  };
  logger: {
    enabled: boolean;
    level: LogLevel;
  };
  behavior: {
    clearAfterSend: boolean;
  };
  trigger: {
    modifierKey: ModifierKey;
  };
}

const config: ExtensionConfig = {
  enabled: true,
  websocket: {
    port: 7007,
  },
  logger: {
    enabled: IS_DEV,
    level: LogLevel.DEBUG,
  },
  behavior: {
    clearAfterSend: true,
  },
  trigger: {
    modifierKey: 'Alt',
  },
};

export default config;
