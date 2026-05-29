import {
  autoUpdate, computePosition, flip, limitShift, shift,
} from '@floating-ui/dom';
import SelectionStoreService from './selection-store-service';

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
const FLASH_CLASS = 'dom-pointer-mcp__overlay--flashing';

export type OnSend = (elements: HTMLElement[], note: string) => Promise<void>;
export type OnCopy = (elements: HTMLElement[], note: string) => Promise<string>;

export default class NotePanelService {
  private root: HTMLDivElement | null = null;

  private chipContainer: HTMLDivElement | null = null;

  private textarea: HTMLTextAreaElement | null = null;

  private sendBtn: HTMLButtonElement | null = null;

  private copyBtn: HTMLButtonElement | null = null;

  private closeBtn: HTMLButtonElement | null = null;

  private errorText: HTMLDivElement | null = null;

  private cleanupAutoUpdate: (() => void) | null = null;

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private store: SelectionStoreService,
    private onSend: OnSend,
    private onCopy: OnCopy,
  ) {
    this.store.subscribe(this.handleSelectionChange.bind(this));
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
      <button type="button" class="dom-pointer-mcp__note-close" aria-label="Close" title="Clear all selections">×</button>
      <div class="dom-pointer-mcp__note-chips"></div>
      <textarea class="dom-pointer-mcp__note-textarea"
        placeholder="Describe what you want to change..."></textarea>
      <div class="dom-pointer-mcp__note-error" hidden></div>
      <div class="dom-pointer-mcp__note-footer">
        <span class="dom-pointer-mcp__note-hint">⌘/Ctrl+Enter to send</span>
        <button type="button" class="dom-pointer-mcp__note-copy" title="Copy selection as JSON for manual paste into any agent">Copy</button>
        <button type="button" class="dom-pointer-mcp__note-send">Send</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.chipContainer = this.root.querySelector('.dom-pointer-mcp__note-chips');
    this.textarea = this.root.querySelector('textarea');
    this.sendBtn = this.root.querySelector('.dom-pointer-mcp__note-send');
    this.copyBtn = this.root.querySelector('.dom-pointer-mcp__note-copy');
    this.closeBtn = this.root.querySelector('.dom-pointer-mcp__note-close');
    this.errorText = this.root.querySelector('.dom-pointer-mcp__note-error');

    this.sendBtn!.addEventListener('click', () => { this.handleSend(); });
    this.copyBtn!.addEventListener('click', () => { this.handleCopy(); });
    this.closeBtn!.addEventListener('click', () => { this.store.clear(); });
    this.textarea!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.handleSend();
      }
    });

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
      if (!root) return;
      const { x, y } = await computePosition(virtualAnchor, root, {
        placement: 'bottom-start',
        middleware: [flip(), shift({ padding: 8, limiter: limitShift() })],
      });
      if (!this.root) return;
      Object.assign(root.style, { left: `${x}px`, top: `${y}px` });
    });

    this.textarea!.focus();
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

  private async handleSend(): Promise<void> {
    if (!this.sendBtn || !this.textarea || !this.errorText) return;
    if (this.sendBtn.disabled) return;
    const elements = this.store.getAll();
    if (elements.length === 0) return;

    const note = this.textarea.value;
    this.sendBtn.disabled = true;
    this.errorText.hidden = true;

    try {
      await this.onSend(elements, note);
      if (this.textarea) this.textarea.value = '';
    } catch (err) {
      if (this.errorText) {
        this.errorText.textContent = `Send failed: ${(err as Error).message}`;
        this.errorText.hidden = false;
      }
    } finally {
      if (this.sendBtn) this.sendBtn.disabled = false;
      this.textarea?.focus();
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
      await navigator.clipboard.writeText(json);
      this.flashCopyFeedback('Copied!');
    } catch (err) {
      if (this.errorText) {
        this.errorText.textContent = `Copy failed: ${(err as Error).message}`;
        this.errorText.hidden = false;
      }
    } finally {
      if (this.copyBtn) this.copyBtn.disabled = false;
    }
  }

  private flashCopyFeedback(text: string): void {
    if (!this.copyBtn) return;
    const original = 'Copy';
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
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.root?.remove();
    this.root = null;
    this.chipContainer = null;
    this.textarea = null;
    this.sendBtn = null;
    this.copyBtn = null;
    this.closeBtn = null;
    this.errorText = null;
  }
}
