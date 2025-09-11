import { LogLevel } from '@mcp-pointer/shared/logger';

export interface ExtensionConfig {
  enabled: boolean;
  websocket: {
    port: number;
  };
  logger: {
    enabled: boolean;
    level: LogLevel;
  };
}

const config: ExtensionConfig = {
  enabled: true,
  websocket: {
    port: 7007,
  },
  logger: {
    enabled: IS_DEV,
    level: LogLevel.INFO,
  },
};

export default config;
