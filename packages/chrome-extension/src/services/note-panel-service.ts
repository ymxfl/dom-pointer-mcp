import {
  autoUpdate, computePosition, flip, limitShift, shift,
} from '@floating-ui/dom';
import { RawReferenceImage } from '@dom-pointer-mcp/shared/types';
import SelectionStoreService from './selection-store-service';
import buildReferenceImage from '../utils/reference-image';
import logger from '../utils/logger';
import { t } from '../i18n';

function viewportClippedRect(el: HTMLElement): DOMRect {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(0, Math.min(r.left, vw));
  const top = Math.max(0, Math.min(r.top, vh));
  const right = Math.max(0, Math.min(r.right, vw));
  const bottom = Math.max(0, Math.min(r.bottom, vh));
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return new DOMRect(left, top, width, height);
}

const PANEL_CLASS = 'dom-pointer-mcp__note-panel';
const CHIP_CLASS = 'dom-pointer-mcp__note-chip';
const THUMB_CLASS = 'dom-pointer-mcp__note-thumb';
const FLASH_CLASS = 'dom-pointer-mcp__overlay--flashing';

export type OnSend = (
  elements: HTMLElement[],
  note: string,
  includeScreenshot: boolean,
  referenceImages: RawReferenceImage[],
) => Promise<void>;
export type OnCopy = (elements: HTMLElement[], note: string) => Promise<string>;

export default class NotePanelService {
  private root: HTMLDivElement | null = null;

  private chipContainer: HTMLDivElement | null = null;

  private thumbContainer: HTMLDivElement | null = null;

  private referenceImages: RawReferenceImage[] = [];

  private handlePaste: ((e: ClipboardEvent) => void) | null = null;

  private textarea: HTMLTextAreaElement | null = null;

  private sendBtn: HTMLButtonElement | null = null;

  private copyBtn: HTMLButtonElement | null = null;

  private screenshotBtn: HTMLButtonElement | null = null;

  private closeBtn: HTMLButtonElement | null = null;

  private errorText: HTMLDivElement | null = null;

  private cleanupAutoUpdate: (() => void) | null = null;

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;

  private handleDragStart: ((e: MouseEvent) => void) | null = null;

  private handleDragMove: ((e: MouseEvent) => void) | null = null;

  private handleDragEnd: (() => void) | null = null;

  private dragOrigin: { mouseX: number; mouseY: number; left: number; top: number } | null = null;

  private positionFrozen = false;

  private includeScreenshot: boolean;

  constructor(
    private store: SelectionStoreService,
    private onSend: OnSend,
    private onCopy: OnCopy,
    captureScreenshotDefault: boolean,
  ) {
    this.includeScreenshot = captureScreenshotDefault;
    this.store.subscribe(this.handleSelectionChange.bind(this));
  }

  public setCaptureScreenshotDefault(enabled: boolean): void {
    this.includeScreenshot = enabled;
    this.updateScreenshotButton();
  }

  public getCenterPosition(): { x: number; y: number } | undefined {
    if (!this.root) return undefined;
    const rect = this.root.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  private handleSelectionChange(elements: HTMLElement[]): void {
    // Self-heal: page JS may have removed our panel
    if (this.root && !document.body.contains(this.root)) {
      this.cleanupAutoUpdate?.();
      this.cleanupAutoUpdate = null;
      this.root = null;
    }

    if (elements.length === 0) {
      this.destroyPanel();
      return;
    }

    if (!this.root) {
      this.buildPanel(elements[0]);
    }
    this.renderChips(elements);
  }

  private buildPanel(anchorEl: HTMLElement): void {
    this.root = document.createElement('div');
    this.root.className = PANEL_CLASS;
    this.root.innerHTML = `
      <button type="button" class="dom-pointer-mcp__note-close" aria-label="Close" title="${t('notePanel.closeTitle')}">×</button>
      <div class="dom-pointer-mcp__note-chips"></div>
      <textarea class="dom-pointer-mcp__note-textarea"
        placeholder="${t('notePanel.placeholder')}"></textarea>
      <div class="dom-pointer-mcp__note-thumbs" hidden></div>
      <div class="dom-pointer-mcp__note-error" hidden></div>
      <div class="dom-pointer-mcp__note-footer">
        <span class="dom-pointer-mcp__note-hint">${t('notePanel.hint')}</span>
        <div class="dom-pointer-mcp__note-actions">
          <button type="button" class="dom-pointer-mcp__note-screenshot" title="${t('notePanel.screenshotTooltip')}" aria-label="${t('notePanel.screenshotTooltip')}" aria-pressed="false">
            <span class="dom-pointer-mcp__camera-icon" aria-hidden="true"></span>
          </button>
          <button type="button" class="dom-pointer-mcp__note-copy" title="${t('notePanel.copyTooltip')}">${t('notePanel.copy')}</button>
          <button type="button" class="dom-pointer-mcp__note-send">${t('notePanel.send')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.chipContainer = this.root.querySelector('.dom-pointer-mcp__note-chips');
    this.thumbContainer = this.root.querySelector('.dom-pointer-mcp__note-thumbs');
    this.textarea = this.root.querySelector('textarea');
    this.sendBtn = this.root.querySelector('.dom-pointer-mcp__note-send');
    this.copyBtn = this.root.querySelector('.dom-pointer-mcp__note-copy');
    this.screenshotBtn = this.root.querySelector('.dom-pointer-mcp__note-screenshot');
    this.closeBtn = this.root.querySelector('.dom-pointer-mcp__note-close');
    this.errorText = this.root.querySelector('.dom-pointer-mcp__note-error');

    this.sendBtn!.addEventListener('click', () => { this.handleSend(); });
    this.copyBtn!.addEventListener('click', () => { this.handleCopy(); });
    this.screenshotBtn!.addEventListener('click', () => {
      this.includeScreenshot = !this.includeScreenshot;
      this.updateScreenshotButton();
    });
    this.closeBtn!.addEventListener('click', () => { this.store.clear(); });
    this.textarea!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.handleSend();
      }
    });

    this.handlePaste = (e: ClipboardEvent) => { this.onPaste(e); };
    this.root.addEventListener('paste', this.handlePaste);

    // NOTE: TriggerMouseService listens at document level (capture phase) and
    // is BEFORE this panel root in the event path, so capture-phase
    // stopPropagation here cannot block it. ElementPointerService handles
    // skipping events whose target is inside the panel.

    Object.assign(this.root.style, {
      position: 'absolute', top: '0', left: '0', zIndex: '2147483647',
    });

    const virtualAnchor = {
      getBoundingClientRect: () => viewportClippedRect(anchorEl),
      contextElement: anchorEl,
    };
    this.cleanupAutoUpdate = autoUpdate(anchorEl, this.root, async () => {
      const { root } = this;
      if (!root || this.positionFrozen) return;
      const { x, y } = await computePosition(virtualAnchor, root, {
        placement: 'bottom-start',
        middleware: [flip(), shift({
          padding: 8, mainAxis: true, crossAxis: true, limiter: limitShift(),
        })],
      });
      if (!this.root) return;
      Object.assign(root.style, { left: `${x}px`, top: `${y}px` });
    });

    this.handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.store.clear();
      }
    };
    document.addEventListener('keydown', this.handleKeyDown, true);

    this.setupDragging();

    this.textarea!.focus({ preventScroll: true });
    this.updateScreenshotButton();
  }

  private setupDragging(): void {
    if (!this.root) return;

    const isInteractive = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return !!target.closest('button, textarea, input, select, a');
    };

    this.handleDragStart = (e: MouseEvent) => {
      if (e.button !== 0 || !this.root || isInteractive(e.target)) return;
      e.preventDefault();
      // Freeze floating-ui auto-positioning so the panel stays where dropped.
      this.cleanupAutoUpdate?.();
      this.cleanupAutoUpdate = null;
      this.positionFrozen = true;
      this.dragOrigin = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        left: parseFloat(this.root.style.left) || 0,
        top: parseFloat(this.root.style.top) || 0,
      };
      document.addEventListener('mousemove', this.handleDragMove!, true);
      document.addEventListener('mouseup', this.handleDragEnd!, true);
    };

    this.handleDragMove = (e: MouseEvent) => {
      if (!this.root || !this.dragOrigin) return;
      e.preventDefault();
      const left = this.dragOrigin.left + (e.clientX - this.dragOrigin.mouseX);
      const top = this.dragOrigin.top + (e.clientY - this.dragOrigin.mouseY);
      Object.assign(this.root.style, { left: `${left}px`, top: `${top}px` });
    };

    this.handleDragEnd = () => {
      this.dragOrigin = null;
      document.removeEventListener('mousemove', this.handleDragMove!, true);
      document.removeEventListener('mouseup', this.handleDragEnd!, true);
    };

    this.root.addEventListener('mousedown', this.handleDragStart, true);
  }

  private updateScreenshotButton(): void {
    if (!this.screenshotBtn) return;
    this.screenshotBtn.classList.toggle('is-active', this.includeScreenshot);
    this.screenshotBtn.setAttribute('aria-pressed', String(this.includeScreenshot));
  }

  private renderChips(elements: HTMLElement[]): void {
    if (!this.chipContainer) return;
    this.chipContainer.innerHTML = '';
    elements.forEach((el, idx) => {
      const chip = document.createElement('span');
      chip.className = CHIP_CLASS;
      const tag = el.tagName.toLowerCase();
      const cls = el.classList[0] ? `.${el.classList[0]}` : '';
      const label = document.createElement('span');
      label.textContent = `[${idx + 1}] <${tag}${cls}>`;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Remove');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        this.store.remove(el);
      });
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      chip.addEventListener('mouseenter', () => el.classList.add(FLASH_CLASS));
      chip.addEventListener('mouseleave', () => el.classList.remove(FLASH_CLASS));
      this.chipContainer!.appendChild(chip);
    });
  }

  private async onPaste(e: ClipboardEvent): Promise<void> {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItems = items.filter((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    // Prevent the image (or its file path) from landing in the textarea.
    e.preventDefault();

    const blobs = imageItems
      .map((item) => item.getAsFile())
      .filter((blob): blob is File => blob !== null);

    await Promise.all(blobs.map(async (blob) => {
      try {
        const image = await buildReferenceImage(blob);
        if (image) this.referenceImages.push(image);
      } catch (err) {
        logger.warn('Failed to process pasted image:', err);
      }
    }));

    this.renderThumbnails();
  }

  private renderThumbnails(): void {
    if (!this.thumbContainer) return;
    this.thumbContainer.innerHTML = '';
    this.thumbContainer.hidden = this.referenceImages.length === 0;

    this.referenceImages.forEach((image, idx) => {
      const thumb = document.createElement('span');
      thumb.className = THUMB_CLASS;
      const img = document.createElement('img');
      img.src = image.dataUrl;
      img.alt = `reference ${idx + 1}`;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Remove');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        this.referenceImages.splice(idx, 1);
        this.renderThumbnails();
      });
      thumb.appendChild(img);
      thumb.appendChild(removeBtn);
      this.thumbContainer!.appendChild(thumb);
    });
  }

  private async handleSend(): Promise<void> {
    if (!this.sendBtn || !this.textarea || !this.errorText) return;
    if (this.sendBtn.disabled) return;
    const elements = this.store.getAll();
    if (elements.length === 0) return;

    const note = this.textarea.value;
    this.sendBtn.disabled = true;
    this.errorText.hidden = true;

    try {
      await this.onSend(elements, note, this.includeScreenshot, this.referenceImages);
      if (this.textarea) this.textarea.value = '';
      this.referenceImages = [];
      this.renderThumbnails();
    } catch (err) {
      if (this.errorText) {
        this.errorText.textContent = t('notePanel.sendFailed', { error: (err as Error).message });
        this.errorText.hidden = false;
      }
    } finally {
      if (this.sendBtn) this.sendBtn.disabled = false;
      this.textarea?.focus({ preventScroll: true });
    }
  }

  private async handleCopy(): Promise<void> {
    if (!this.copyBtn || !this.textarea || !this.errorText) return;
    if (this.copyBtn.disabled) return;
    const elements = this.store.getAll();
    if (elements.length === 0) return;

    const note = this.textarea.value;
    this.copyBtn.disabled = true;
    this.errorText.hidden = true;

    try {
      const json = await this.onCopy(elements, note);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(json);
      } else {
        const ta = document.createElement('textarea');
        ta.value = json;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      this.flashCopyFeedback(t('notePanel.copied'));
    } catch (err) {
      if (this.errorText) {
        this.errorText.textContent = t('notePanel.copyFailed', { error: (err as Error).message });
        this.errorText.hidden = false;
      }
    } finally {
      if (this.copyBtn) this.copyBtn.disabled = false;
    }
  }

  private flashCopyFeedback(text: string): void {
    if (!this.copyBtn) return;
    const original = t('notePanel.copy');
    this.copyBtn.textContent = text;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      if (this.copyBtn) this.copyBtn.textContent = original;
      this.feedbackTimer = null;
    }, 1500);
  }

  private destroyPanel(): void {
    this.cleanupAutoUpdate?.();
    this.cleanupAutoUpdate = null;
    if (this.handleKeyDown) {
      document.removeEventListener('keydown', this.handleKeyDown, true);
      this.handleKeyDown = null;
    }
    if (this.handleDragMove) {
      document.removeEventListener('mousemove', this.handleDragMove, true);
      this.handleDragMove = null;
    }
    if (this.handleDragEnd) {
      document.removeEventListener('mouseup', this.handleDragEnd, true);
      this.handleDragEnd = null;
    }
    this.handleDragStart = null;
    this.dragOrigin = null;
    this.positionFrozen = false;
    this.handlePaste = null;
    this.referenceImages = [];
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.root?.remove();
    this.root = null;
    this.chipContainer = null;
    this.thumbContainer = null;
    this.textarea = null;
    this.sendBtn = null;
    this.copyBtn = null;
    this.screenshotBtn = null;
    this.closeBtn = null;
    this.errorText = null;
  }
}
