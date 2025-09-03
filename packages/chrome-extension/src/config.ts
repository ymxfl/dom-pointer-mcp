import { LogLevel } from '@mcp-pointer/shared/Logger';

export interface ExtensionConfig {
  enabled: boolean;
  urlFilters: string[];
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
  urlFilters: ['<all_urls>'],
  websocket: {
    port: 7007,
  },
  logger: {
    enabled: IS_DEV,
    level: LogLevel.INFO,
  },
};

export default config;
