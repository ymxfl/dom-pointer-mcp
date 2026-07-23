import {
  RawPointedSelection,
  RawReferenceImage,
  RawSelectionScreenshot,
  ScreenshotBounds,
} from '@dom-pointer-mcp/shared/types';
import { ModifierKey } from '../utils/config';
import { t } from '../i18n';
import logger from '../utils/logger';
import TriggerMouseService from './trigger-mouse-service';
import TriggerKeyService from './trigger-key-service';
import OverlayManagerService from './overlay-manager-service';
import SelectionStoreService from './selection-store-service';
import ArrowNavigationService from './arrow-navigation-service';
import NotePanelService from './note-panel-service';
import ConfigStorageService from './config-storage-service';
import { extractRawPointedDOMElement, dedupeElements } from '../utils/element';
import { withExtensionUiHidden } from '../utils/screenshot';

const POINTING_CLASS = 'dom-pointer-mcp--is-pointing';
const SCREENSHOT_PADDING = 12;

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
    throw new Error(t('extension.reloaded'));
  }
}

function translateRuntimeError(raw: string): Error {
  if (
    raw.includes('Extension context invalidated')
    || raw.includes("Cannot read properties of undefined (reading 'sendMessage')")
    || raw.includes('chrome.runtime is undefined')
  ) {
    return new Error(t('extension.reloaded'));
  }
  return new Error(raw);
}

export default class ElementPointerService {
  private triggerKeyService: TriggerKeyService;

  private triggerMouseService: TriggerMouseService;

  private overlayManagerService: OverlayManagerService;

  private store: SelectionStoreService;

  private arrowNavigationService: ArrowNavigationService;

  // eslint-disable-next-line no-unused-vars
  private notePanel: NotePanelService;

  private pointing: boolean = false;

  private hoveredElement: HTMLElement | null = null;

  constructor(
    modifierKey: ModifierKey,
    captureScreenshotDefault: boolean,
    private onSendSuccess: (position?: { x: number; y: number }) => void = () => {},
  ) {
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
    this.arrowNavigationService = new ArrowNavigationService(this.store);
    this.notePanel = new NotePanelService(
      this.store,
      (els, note, includeScreenshot, referenceImages) => this.sendSelection(
        els,
        note,
        includeScreenshot,
        referenceImages,
      ),
      (els, note) => this.buildSelectionJson(els, note),
      captureScreenshotDefault,
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
      .forEach((e) => this.overlayManagerService.overlaySelection(e, elements.indexOf(e) + 1));
    this.overlayManagerService.updateSelectionIndexes(elements);
    if (this.hoveredElement && elements.includes(this.hoveredElement)) {
      this.overlayManagerService.clearHover();
      this.hoveredElement = null;
    }
  }

  public setModifierKey(key: ModifierKey): void {
    this.triggerKeyService.setModifierKey(key);
  }

  public setCaptureScreenshotDefault(enabled: boolean): void {
    this.notePanel.setCaptureScreenshotDefault(enabled);
  }

  public enable(): void {
    this.triggerKeyService.registerListeners();
    this.arrowNavigationService.registerListeners();
    logger.info('✅ Element pointer enabled');
  }

  public disable(): void {
    this.overlayManagerService.clearHover();
    this.overlayManagerService.clearAllSelections();
    this.store.clear();
    this.hoveredElement = null;
    this.triggerKeyService.unregisterListeners();
    this.arrowNavigationService.unregisterListeners();
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

  private async sendSelection(
    elements: HTMLElement[],
    note: string,
    includeScreenshot: boolean,
    referenceImages: RawReferenceImage[],
  ): Promise<void> {
    logger.info(`📤 Sending selection (${elements.length} elements) to background`);

    assertExtensionContextValid();
    const payload = await this.buildPayload(elements, note, includeScreenshot, referenceImages);

    await new Promise<void>((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { type: 'SELECTION_SENT', data: payload },
          (response: { success?: boolean; error?: string } | undefined) => {
            if (chrome.runtime?.lastError) {
              const msg = chrome.runtime.lastError.message || 'unknown error';
              logger.error('❌ Error sending selection:', msg);
              reject(translateRuntimeError(msg));
            } else if (!response?.success) {
              const msg = response?.error || 'unknown error';
              logger.error('❌ Server rejected selection:', msg);
              reject(new Error(msg));
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

    this.onSendSuccess(this.notePanel.getCenterPosition());

    try {
      const config = await ConfigStorageService.load();
      if (config.behavior.clearAfterSend) {
        this.store.clear();
      }
    } catch (err) {
      logger.warn('Failed to read clearAfterSend setting; leaving selection intact:', err);
    }
  }

  private async buildPayload(
    elements: HTMLElement[],
    note: string,
    includeScreenshot: boolean,
    referenceImages: RawReferenceImage[] = [],
  ): Promise<RawPointedSelection> {
    const uniqueElements = dedupeElements(elements);
    const rawElements = await Promise.all(
      uniqueElements.map((el) => extractRawPointedDOMElement(el)),
    );
    const screenshot = includeScreenshot
      ? await this.captureSelectionScreenshot(elements)
      : undefined;
    return {
      url: window.location.href,
      timestamp: Date.now(),
      userNote: note,
      elements: rawElements,
      screenshot,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    };
  }

  private async captureSelectionScreenshot(
    elements: HTMLElement[],
  ): Promise<RawSelectionScreenshot | undefined> {
    const bounds = this.getSelectionBounds(elements);
    if (!bounds) return undefined;

    try {
      const response = await withExtensionUiHidden(
        () => this.requestVisibleTabScreenshot(),
      );
      if (!response.success || !response.dataUrl) {
        logger.warn('Unable to capture screenshot:', response.error);
        return undefined;
      }

      return await this.cropScreenshot(response.dataUrl, bounds);
    } catch (err) {
      logger.warn('Unable to capture screenshot:', err);
      return undefined;
    }
  }

  private getSelectionBounds(elements: HTMLElement[]): ScreenshotBounds | undefined {
    const rects = elements
      .map((el) => el.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) return undefined;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.max(
      0,
      Math.min(...rects.map((rect) => rect.left)) - SCREENSHOT_PADDING,
    );
    const top = Math.max(
      0,
      Math.min(...rects.map((rect) => rect.top)) - SCREENSHOT_PADDING,
    );
    const right = Math.min(
      viewportWidth,
      Math.max(...rects.map((rect) => rect.right)) + SCREENSHOT_PADDING,
    );
    const bottom = Math.min(
      viewportHeight,
      Math.max(...rects.map((rect) => rect.bottom)) + SCREENSHOT_PADDING,
    );

    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) return undefined;

    return {
      x: left,
      y: top,
      width,
      height,
      devicePixelRatio: window.devicePixelRatio,
    };
  }

  private requestVisibleTabScreenshot(): Promise<{
    success: boolean;
    dataUrl?: string;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { type: 'CAPTURE_VISIBLE_TAB_SCREENSHOT' },
          (response) => {
            if (chrome.runtime?.lastError) {
              reject(translateRuntimeError(chrome.runtime.lastError.message || 'unknown error'));
              return;
            }
            resolve(response);
          },
        );
      } catch (err) {
        reject(translateRuntimeError((err as Error).message));
      }
    });
  }

  private cropScreenshot(
    dataUrl: string,
    bounds: ScreenshotBounds,
  ): Promise<RawSelectionScreenshot | undefined> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const scaleX = image.naturalWidth / window.innerWidth;
        const scaleY = image.naturalHeight / window.innerHeight;
        const sourceX = Math.round(bounds.x * scaleX);
        const sourceY = Math.round(bounds.y * scaleY);
        const sourceWidth = Math.max(1, Math.round(bounds.width * scaleX));
        const sourceHeight = Math.max(1, Math.round(bounds.height * scaleY));
        const canvas = document.createElement('canvas');
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          sourceWidth,
          sourceHeight,
        );
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          mimeType: 'image/png',
          width: sourceWidth,
          height: sourceHeight,
          bounds: {
            ...bounds,
            devicePixelRatio: scaleX,
          },
          capturedAt: Date.now(),
        });
      };
      image.onerror = () => resolve(undefined);
      image.src = dataUrl;
    });
  }

  /**
   * Build a JSON string for the Copy button. This serializes the same
   * RawPointedSelection shape that goes to the server. Compared to what the
   * agent receives via mcp__dom-pointer__get-pointed-element, this is a
   * SUPERSET (contains outerHTML and full computedStyles instead of the
   * server's filtered cssProperties), so an agent can still consume it.
   * It does not include the server-generated `selector` field or screenshot.
   */
  private async buildSelectionJson(elements: HTMLElement[], note: string): Promise<string> {
    const payload = await this.buildPayload(elements, note, false);
    return JSON.stringify(payload, null, 2);
  }
}
