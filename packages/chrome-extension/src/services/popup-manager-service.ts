import defaultConfig, { ExtensionConfig, ModifierKey, Locale } from '../utils/config';
import { getModifierLabel } from '../utils/platform';
import logger from '../utils/logger';
import ConfigStorageService from './config-storage-service';
import { checkReachability, ReachabilityState } from './server-reachability-service';
import { checkExtensionUpdate, UpdateCheckResult } from './update-check-service';
import { buildInstallPrompt } from '../utils/install-prompt';
import { t, setLocale, getLocale } from '../i18n';

const ALL_MODIFIER_KEYS: ModifierKey[] = ['Alt', 'Ctrl', 'Meta'];

export default class PopupManagerService {
  private enabledInput: HTMLInputElement;

  private clearAfterSendInput: HTMLInputElement;

  private captureScreenshotInput: HTMLInputElement;

  private showHistoryDrawerInput: HTMLInputElement;

  private portInput: HTMLInputElement;

  private triggerKeySelect: HTMLSelectElement;

  private localeSelect: HTMLSelectElement;

  private conflictWarning: HTMLElement;

  private aboutLink: HTMLAnchorElement;

  private saveBtn: HTMLButtonElement;

  private resetBtn: HTMLButtonElement;

  private status: HTMLElement;

  private serverStatus: HTMLElement;

  private statusIndicator: HTMLElement;

  private statusText: HTMLElement;

  private recheckBtn: HTMLButtonElement;

  private updateStatus: HTMLElement;

  private updateText: HTMLElement;

  private updateLink: HTMLAnchorElement;

  private checkUpdateBtn: HTMLButtonElement;

  private copyInstallBtn: HTMLButtonElement;

  private titleEl: HTMLElement;

  constructor() {
    this.enabledInput = document.getElementById('enabled') as HTMLInputElement;
    this.clearAfterSendInput = document.getElementById('clearAfterSend') as HTMLInputElement;
    this.captureScreenshotInput = document.getElementById('captureScreenshot') as HTMLInputElement;
    this.showHistoryDrawerInput = document.getElementById('showHistoryDrawer') as HTMLInputElement;
    this.portInput = document.getElementById('port') as HTMLInputElement;
    this.triggerKeySelect = document.getElementById('triggerKey') as HTMLSelectElement;
    this.localeSelect = document.getElementById('locale') as HTMLSelectElement;
    this.conflictWarning = document.getElementById('conflictWarning') as HTMLElement;
    this.aboutLink = document.getElementById('aboutLink') as HTMLAnchorElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.status = document.getElementById('status') as HTMLElement;
    this.serverStatus = document.getElementById('serverStatus') as HTMLElement;
    this.statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
    this.statusText = document.getElementById('statusText') as HTMLElement;
    this.recheckBtn = document.getElementById('recheckBtn') as HTMLButtonElement;
    this.updateStatus = document.getElementById('updateStatus') as HTMLElement;
    this.updateText = document.getElementById('updateText') as HTMLElement;
    this.updateLink = document.getElementById('updateLink') as HTMLAnchorElement;
    this.checkUpdateBtn = document.getElementById('checkUpdateBtn') as HTMLButtonElement;
    this.copyInstallBtn = document.getElementById('copyInstallBtn') as HTMLButtonElement;
    this.titleEl = document.getElementById('title') as HTMLElement;

    this.populateTriggerKeyOptions();
    this.setupEventListeners();
    this.loadConfig();
  }

  private applyLocaleToUI(): void {
    const currentVersion = chrome.runtime.getManifest().version;
    this.titleEl.textContent = t('popup.title', { version: currentVersion });

    document.getElementById('enabledLabel')!.textContent = t('popup.enabled');
    document.getElementById('clearAfterSendLabel')!.textContent = t('popup.clearAfterSend');
    document.getElementById('captureScreenshotLabel')!.textContent = t('popup.captureScreenshot');
    document.getElementById('showHistoryDrawerLabel')!.textContent = t('popup.showHistoryDrawer');
    document.getElementById('triggerKeyLabel')!.textContent = t('popup.triggerKey');
    document.getElementById('triggerKeyHint')!.textContent = t('popup.triggerKeyHint');
    document.getElementById('portLabel')!.textContent = t('popup.port');
    document.getElementById('portHint')!.textContent = t('popup.portHint');
    document.getElementById('localeLabel')!.textContent = t('popup.language');
    this.saveBtn.textContent = t('popup.save');
    this.resetBtn.textContent = t('popup.reset');
    this.recheckBtn.textContent = t('popup.recheck');

    this.copyInstallBtn.title = t('popup.copyInstall');
    this.copyInstallBtn.setAttribute('aria-label', t('popup.copyInstall'));
    this.checkUpdateBtn.title = t('popup.checkUpdate');
    this.checkUpdateBtn.setAttribute('aria-label', t('popup.checkUpdate'));
    this.aboutLink.title = t('popup.aboutTitle');
    this.aboutLink.setAttribute('aria-label', t('popup.aboutTitle'));
  }

  private populateTriggerKeyOptions(): void {
    this.triggerKeySelect.innerHTML = '';
    ALL_MODIFIER_KEYS.forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = getModifierLabel(key);
      this.triggerKeySelect.appendChild(option);
    });
  }

  private setupEventListeners(): void {
    this.saveBtn.addEventListener('click', () => this.saveConfig());
    this.resetBtn.addEventListener('click', () => this.resetToDefaults());
    this.recheckBtn.addEventListener('click', () => this.checkServer());
    this.checkUpdateBtn.addEventListener('click', () => this.checkForUpdates());
    this.copyInstallBtn.addEventListener('click', () => this.copyInstallPrompt());
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await ConfigStorageService.load();

      setLocale(config.locale);
      this.applyLocaleToUI();

      this.enabledInput.checked = config.enabled;
      this.clearAfterSendInput.checked = config.behavior.clearAfterSend;
      this.captureScreenshotInput.checked = config.behavior.captureScreenshot;
      this.showHistoryDrawerInput.checked = config.behavior.showHistoryDrawer;
      this.portInput.value = config.websocket.port.toString();
      this.triggerKeySelect.value = config.trigger.modifierKey;
      this.localeSelect.value = config.locale;
      this.checkServer();
      this.checkConflict(config.trigger.modifierKey);
    } catch (error) {
      this.showStatus(t('popup.loadError'), 'error');
      logger.error('Error loading config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const port = parseInt(this.portInput.value, 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        this.showStatus(t('popup.portError'), 'error');
        return;
      }

      const newLocale = this.localeSelect.value as Locale;

      const config: ExtensionConfig = {
        enabled: this.enabledInput.checked,
        locale: newLocale,
        websocket: {
          port,
        },
        logger: {
          enabled: defaultConfig.logger.enabled,
          level: defaultConfig.logger.level,
        },
        behavior: {
          clearAfterSend: this.clearAfterSendInput.checked,
          captureScreenshot: this.captureScreenshotInput.checked,
          showHistoryDrawer: this.showHistoryDrawerInput.checked,
        },
        trigger: {
          modifierKey: this.triggerKeySelect.value as ModifierKey,
        },
      };

      await ConfigStorageService.save(config);

      setLocale(newLocale);
      this.applyLocaleToUI();

      this.showStatus(t('popup.savedSuccess'), 'success');
      this.checkServer();
    } catch (error) {
      this.showStatus(t('popup.saveError'), 'error');
      logger.error('Error saving config:', error);
    }
  }

  private async resetToDefaults(): Promise<void> {
    try {
      await ConfigStorageService.save(defaultConfig);
      await this.loadConfig();
      this.showStatus(t('popup.resetSuccess'), 'success');
    } catch (error) {
      this.showStatus(t('popup.resetError'), 'error');
      logger.error('Error resetting config:', error);
    }
  }

  private checkConflict(currentKey: ModifierKey): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;

      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: 'CHECK_CONFLICT' },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            this.conflictWarning.classList.remove('visible');
            return;
          }

          if (response.hasConflict) {
            const currentLabel = getModifierLabel(currentKey);
            const suggestedLabel = response.suggestedKey
              ? getModifierLabel(response.suggestedKey)
              : null;
            const text = suggestedLabel
              ? t('conflict.warning', { key: currentLabel, suggested: suggestedLabel })
              : t('conflict.warningNoSuggestion', { key: currentLabel });
            this.conflictWarning.textContent = text;
            this.conflictWarning.classList.add('visible');
          } else {
            this.conflictWarning.classList.remove('visible');
          }
        },
      );
    });
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.status.textContent = message;
    this.status.className = `status ${type} visible`;

    setTimeout(() => {
      this.status.classList.remove('visible');
    }, 3000);
  }

  private async checkServer(): Promise<void> {
    const port = parseInt(this.portInput.value, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      this.setStatus('unreachable', t('popup.invalidPort', { port: this.portInput.value }));
      return;
    }

    this.setStatus('checking', t('popup.serverChecking'));
    const reachable = await checkReachability(port);
    this.setStatus(
      reachable ? 'reachable' : 'unreachable',
      reachable
        ? t('popup.serverReachable', { port })
        : t('popup.serverUnreachable', { port }),
    );
  }

  private setStatus(state: ReachabilityState, text: string): void {
    this.serverStatus.className = `server-status ${state}`;
    let indicator: string;
    if (state === 'checking') {
      indicator = '⏳';
    } else if (state === 'reachable') {
      indicator = '🟢';
    } else {
      indicator = '🔴';
    }
    this.statusIndicator.textContent = indicator;
    this.statusText.textContent = text;
    this.recheckBtn.disabled = (state === 'checking');
  }

  /**
   * Copy the agent install prompt to the clipboard.
   * @author zgx
   */
  private async copyInstallPrompt(): Promise<void> {
    const prompt = buildInstallPrompt(getLocale());
    try {
      await navigator.clipboard.writeText(prompt);
      this.showStatus(t('popup.copyInstallSuccess'), 'success');
    } catch (error) {
      this.showStatus(t('popup.copyInstallFailed'), 'error');
      logger.error('Error copying install prompt:', error);
    }
  }

  /**
   * Check extension updates via Chrome Web Store and/or GitHub Releases.
   * @author zgx
   */
  private async checkForUpdates(): Promise<void> {
    this.checkUpdateBtn.disabled = true;
    this.updateStatus.hidden = false;
    this.updateStatus.className = 'update-status checking';
    this.updateText.textContent = t('popup.updateChecking');
    this.updateLink.hidden = true;

    try {
      const result = await checkExtensionUpdate('auto');
      this.renderUpdateResult(result);
    } catch (error) {
      this.updateStatus.hidden = false;
      this.updateStatus.className = 'update-status error';
      this.updateText.textContent = t('popup.updateError');
      logger.error('Error checking updates:', error);
    } finally {
      this.checkUpdateBtn.disabled = false;
    }
  }

  private renderUpdateResult(result: UpdateCheckResult): void {
    this.updateStatus.hidden = false;

    if (result.status === 'update-available') {
      this.updateStatus.className = 'update-status available';
      this.updateText.textContent = result.messageKey === 'popup.updateCwsAvailable'
        ? t('popup.updateCwsAvailable')
        : t('popup.updateAvailable', {
          latest: result.latestVersion || '',
          current: result.currentVersion,
        });
      if (result.updateUrl) {
        this.updateLink.hidden = false;
        this.updateLink.href = result.updateUrl;
        this.updateLink.textContent = result.channel === 'chrome-web-store'
          ? t('popup.updateOpenStore')
          : t('popup.updateOpen');
      }
      return;
    }

    if (result.status === 'error') {
      this.updateStatus.className = 'update-status error';
      this.updateText.textContent = result.detail
        ? `${t('popup.updateError')}: ${result.detail}`
        : t('popup.updateError');
      this.updateLink.hidden = true;
      return;
    }

    this.updateStatus.className = result.status === 'throttled'
      ? 'update-status'
      : 'update-status ok';
    this.updateText.textContent = result.status === 'throttled'
      ? t('popup.updateThrottled')
      : t('popup.updateUpToDate');
    this.updateLink.hidden = true;
  }
}
