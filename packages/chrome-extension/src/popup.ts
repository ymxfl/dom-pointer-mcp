import { ConfigStorage } from './storage';
import defaultConfig, { ExtensionConfig } from './config';
import logger from './logger';

class PopupManager {
  private enabledInput: HTMLInputElement;

  private portInput: HTMLInputElement;

  private urlFiltersTextarea: HTMLTextAreaElement;

  private saveBtn: HTMLButtonElement;

  private resetBtn: HTMLButtonElement;

  private status: HTMLElement;

  constructor() {
    this.enabledInput = document.getElementById('enabled') as HTMLInputElement;
    this.portInput = document.getElementById('port') as HTMLInputElement;
    this.urlFiltersTextarea = document.getElementById('urlFilters') as HTMLTextAreaElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.status = document.getElementById('status') as HTMLElement;

    this.setupEventListeners();
    this.loadConfig();
  }

  private setupEventListeners(): void {
    this.saveBtn.addEventListener('click', () => this.saveConfig());
    this.resetBtn.addEventListener('click', () => this.resetToDefaults());
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await ConfigStorage.load();

      this.enabledInput.checked = config.enabled;
      this.portInput.value = config.websocket.port.toString();
      this.urlFiltersTextarea.value = config.urlFilters.join('\n');
    } catch (error) {
      this.showStatus('Failed to load configuration', 'error');
      logger.error('Error loading config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const urlFilters = this.urlFiltersTextarea.value
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const port = parseInt(this.portInput.value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        this.showStatus('Port must be a number between 1 and 65535', 'error');
        return;
      }

      if (urlFilters.length === 0) {
        this.showStatus('At least one URL filter is required', 'error');
        return;
      }

      const config: ExtensionConfig = {
        enabled: this.enabledInput.checked,
        urlFilters,
        websocket: {
          port,
        },
        logger: {
          enabled: defaultConfig.logger.enabled,
          level: defaultConfig.logger.level,
        },
      };

      await ConfigStorage.save(config);
      this.showStatus('Settings saved successfully', 'success');
    } catch (error) {
      this.showStatus('Failed to save configuration', 'error');
      logger.error('Error saving config:', error);
    }
  }

  private async resetToDefaults(): Promise<void> {
    try {
      await ConfigStorage.save(defaultConfig);
      await this.loadConfig();
      this.showStatus('Settings reset to defaults', 'success');
    } catch (error) {
      this.showStatus('Failed to reset configuration', 'error');
      logger.error('Error resetting config:', error);
    }
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.status.textContent = message;
    this.status.className = `status ${type} visible`;

    setTimeout(() => {
      this.status.classList.remove('visible');
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-new
  new PopupManager();
});
