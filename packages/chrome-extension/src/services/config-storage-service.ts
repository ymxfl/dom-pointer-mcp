import defaultConfig, { ExtensionConfig } from '../utils/config';
import logger from '../utils/logger';

const STORAGE_KEY = 'mcp_pointer_config';

export default class ConfigStorageService {
  static async load(): Promise<ExtensionConfig> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY];

      if (stored) {
        const config = { ...defaultConfig, ...stored };
        logger.debug('📁 Config loaded from storage:', config);
        return config;
      }

      logger.debug('📁 No config found, using defaults');
      return defaultConfig;
    } catch (error) {
      logger.error('❌ Failed to load config from storage:', error);
      return defaultConfig;
    }
  }

  static async save(config: ExtensionConfig): Promise<void> {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: config });
      logger.debug('💾 Config saved to storage:', config);
    } catch (error) {
      logger.error('❌ Failed to save config to storage:', error);
      throw error;
    }
  }

  static async update(updates: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
    const currentConfig = await this.load();
    const newConfig = { ...currentConfig, ...updates };
    await this.save(newConfig);
    return newConfig;
  }

  static onChange(callback: (config: ExtensionConfig) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes[STORAGE_KEY]) {
        const newConfig = changes[STORAGE_KEY].newValue;
        if (newConfig) {
          logger.debug('📁 Config changed:', newConfig);
          callback(newConfig);
        }
      }
    });
  }
}
