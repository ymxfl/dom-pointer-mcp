import { RawPointedSelection } from '@dom-pointer-mcp/shared/types';
import { ModifierKey } from '../utils/config';
import logger from '../utils/logger';
import TriggerMouseService from './trigger-mouse-service';
import TriggerKeyService from './trigger-key-service';
import OverlayManagerService from './overlay-manager-service';
import SelectionStoreService from './selection-store-service';
import NotePanelService from './note-panel-service';
import ConfigStorageService from './config-storage-service';
import { extractRawPointedDOMElement } from '../utils/element';

const POINTING_CLASS = 'dom-pointer-mcp--is-pointing';

const EXTENSION_RELOADED_MESSAGE = 'Extension was reloaded or updated. Please refresh this page to reconnect.';

function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined'
      && !!chrome.runtime
      && typeof chrome.runtime.sendMessage === 'function'
      // Accessing chrome.runtime.id throws if context invalidated
      && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

function assertExtensionContextValid(): void {
  if (!isExtensionContextValid()) {
    throw new Error(EXTENSION_RELOADED_MESSAGE);
  }
}

function translateRuntimeError(raw: string): Error {
  if (
    raw.includes('Extension context invalidated')
    || raw.includes("Cannot read properties of undefined (reading 'sendMessage')")
    || raw.includes('chrome.runtime is undefined')
  ) {
    return new Error(EXTENSION_RELOADED_MESSAGE);
  }
  return new Error(raw);
}

export default class ElementPointerService {
  private triggerKeyService: TriggerKeyService;

  private triggerMouseService: TriggerMouseService;

  private overlayManagerService: OverlayManagerService;

  private store: SelectionStoreService;

  // eslint-disable-next-line no-unused-vars
  private notePanel: NotePanelService;

  private pointing: boolean = false;

  private hoveredElement: HTMLElement | null = null;

  constructor(modifierKey: ModifierKey) {
    this.triggerKeyService = new TriggerKeyService({
      onTriggerKeyStart: this.startPointing.bind(this),
      onTriggerKeyEnd: this.stopPointing.bind(this),
      modifierKey,
    });
    this.triggerMouseService = new TriggerMouseService({
      onHover: this.onHover.bind(this),
      onClick: this.onClick.bind(this),
    });
    this.overlayManagerService = new OverlayManagerService();
    this.store = new SelectionStoreService();
    this.notePanel = new NotePanelService(
      this.store,
      (els, note) => this.sendSelection(els, note),
      (els, note) => this.buildSelectionJson(els, note),
    );
    this.store.subscribe(this.syncOverlays.bind(this));
  }

  private onHover(target: HTMLElement): void {
    if (this.hoveredElement === target) return;

    if (this.store.getAll().includes(target)) {
      this.overlayManagerService.clearHover();
      this.hoveredElement = null;
    } else {
      this.overlayManagerService.overlayHover(target);
      this.hoveredElement = target;
    }
  }

  private onClick(target: HTMLElement): void {
    logger.debug('🎯 Option+click detected on:', target);
    this.store.toggle(target);
  }

  private syncOverlays(elements: HTMLElement[]): void {
    const current = this.overlayManagerService.getSelectionElements();
    current.filter((e) => !elements.includes(e))
      .forEach((e) => this.overlayManagerService.clearSelection(e));
    elements.filter((e) => !current.includes(e))
      .forEach((e) => this.overlayManagerService.overlaySelection(e));
    if (this.hoveredElement && elements.includes(this.hoveredElement)) {
      this.overlayManagerService.clearHover();
      this.hoveredElement = null;
    }
  }

  public setModifierKey(key: ModifierKey): void {
    this.triggerKeyService.setModifierKey(key);
  }

  public enable(): void {
    this.triggerKeyService.registerListeners();
    logger.info('✅ Element pointer enabled');
  }

  public disable(): void {
    this.overlayManagerService.clearHover();
    this.overlayManagerService.clearAllSelections();
    this.store.clear();
    this.hoveredElement = null;
    this.triggerKeyService.unregisterListeners();
    logger.info('⏸️ Element pointer disabled');
  }

  private startPointing(): void {
    if (this.pointing) return;
    this.triggerMouseService.registerListeners();
    document.body.classList.add(POINTING_CLASS);
    this.pointing = true;
    logger.debug('Pointing started');
  }

  private stopPointing(): void {
    if (!this.pointing) return;
    this.triggerMouseService.unregisterListeners();
    this.overlayManagerService.clearHover();
    document.body.classList.remove(POINTING_CLASS);
    this.pointing = false;
    logger.debug('Pointing stopped');
  }

  private async sendSelection(elements: HTMLElement[], note: string): Promise<void> {
    logger.info(`📤 Sending selection (${elements.length} elements) to background`);

    assertExtensionContextValid();
    const payload = await this.buildPayload(elements, note);

    await new Promise<void>((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { type: 'SELECTION_SENT', data: payload },
          (response: any) => {
            if (chrome.runtime?.lastError) {
              const msg = chrome.runtime.lastError.message || 'unknown error';
              logger.error('❌ Error sending selection:', msg);
              reject(translateRuntimeError(msg));
            } else {
              logger.debug('✅ Selection sent successfully:', response);
              resolve();
            }
          },
        );
      } catch (err) {
        reject(translateRuntimeError((err as Error).message));
      }
    });

    try {
      const config = await ConfigStorageService.load();
      if (config.behavior.clearAfterSend) {
        this.store.clear();
      }
    } catch (err) {
      logger.warn('Failed to read clearAfterSend setting; leaving selection intact:', err);
    }
  }

  private async buildPayload(elements: HTMLElement[], note: string): Promise<RawPointedSelection> {
    const rawElements = await Promise.all(
      elements.map((el) => extractRawPointedDOMElement(el)),
    );
    return {
      url: window.location.href,
      timestamp: Date.now(),
      userNote: note,
      elements: rawElements,
    };
  }

  /**
   * Build a JSON string for the Copy button. This serializes the same
   * RawPointedSelection that goes to the server. Compared to what the
   * agent receives via mcp__dom-pointer__get-pointed-element, this is a
   * SUPERSET (contains outerHTML and full computedStyles instead of the
   * server's filtered cssProperties), so an agent can still consume it.
   * It does not include the server-generated `selector` field.
   */
  private async buildSelectionJson(elements: HTMLElement[], note: string): Promise<string> {
    const payload = await this.buildPayload(elements, note);
    return JSON.stringify(payload, null, 2);
  }
}
