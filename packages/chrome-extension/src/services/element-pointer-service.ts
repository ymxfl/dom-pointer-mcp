import { RawPointedSelection } from '@mcp-pointer/shared/types';
import logger from '../utils/logger';
import TriggerMouseService from './trigger-mouse-service';
import TriggerKeyService from './trigger-key-service';
import OverlayManagerService from './overlay-manager-service';
import SelectionStoreService from './selection-store-service';
import NotePanelService from './note-panel-service';
import { extractRawPointedDOMElement } from '../utils/element';

const POINTING_CLASS = 'mcp-pointer--is-pointing';

export default class ElementPointerService {
  private triggerKeyService: TriggerKeyService;

  private triggerMouseService: TriggerMouseService;

  private overlayManagerService: OverlayManagerService;

  private store: SelectionStoreService;

  // eslint-disable-next-line no-unused-vars
  private notePanel: NotePanelService;

  private pointing: boolean = false;

  private hoveredElement: HTMLElement | null = null;

  constructor() {
    this.triggerKeyService = new TriggerKeyService({
      onTriggerKeyStart: this.startPointing.bind(this),
      onTriggerKeyEnd: this.stopPointing.bind(this),
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

    const rawElements = await Promise.all(
      elements.map((el) => extractRawPointedDOMElement(el)),
    );
    const payload: RawPointedSelection = {
      url: window.location.href,
      timestamp: Date.now(),
      userNote: note,
      elements: rawElements,
    };

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'SELECTION_SENT', data: payload },
        (response: any) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || 'unknown error';
            logger.error('❌ Error sending selection:', msg);
            reject(new Error(msg));
          } else {
            logger.debug('✅ Selection sent successfully:', response);
            resolve();
          }
        },
      );
    });
  }
}
