import {
  autoUpdate, computePosition, flip, shift,
} from '@floating-ui/dom';
import SelectionStoreService from './selection-store-service';

const PANEL_CLASS = 'mcp-pointer__note-panel';
const CHIP_CLASS = 'mcp-pointer__note-chip';
const FLASH_CLASS = 'mcp-pointer__overlay--flashing';

export type OnSend = (elements: HTMLElement[], note: string) => Promise<void>;
export type OnCopy = (elements: HTMLElement[], note: string) => Promise<string>;

export default class NotePanelService {
  private root: HTMLDivElement | null = null;

  private chipContainer: HTMLDivElement | null = null;

  private textarea: HTMLTextAreaElement | null = null;

  private sendBtn: HTMLButtonElement | null = null;

  private copyBtn: HTMLButtonElement | null = null;

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
      <div class="mcp-pointer__note-chips"></div>
      <textarea class="mcp-pointer__note-textarea"
        placeholder="Describe what you want to change..."></textarea>
      <div class="mcp-pointer__note-error" hidden></div>
      <div class="mcp-pointer__note-footer">
        <span class="mcp-pointer__note-hint">⌘/Ctrl+Enter to send</span>
        <button type="button" class="mcp-pointer__note-copy" title="Copy selection as JSON for manual paste into any agent">Copy</button>
        <button type="button" class="mcp-pointer__note-send">Send</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.chipContainer = this.root.querySelector('.mcp-pointer__note-chips');
    this.textarea = this.root.querySelector('textarea');
    this.sendBtn = this.root.querySelector('.mcp-pointer__note-send');
    this.copyBtn = this.root.querySelector('.mcp-pointer__note-copy');
    this.errorText = this.root.querySelector('.mcp-pointer__note-error');

    this.sendBtn!.addEventListener('click', () => { void this.handleSend(); });
    this.copyBtn!.addEventListener('click', () => { void this.handleCopy(); });
    this.textarea!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.handleSend();
      }
    });

    // NOTE: TriggerMouseService listens at document level (capture phase) and
    // is BEFORE this panel root in the event path, so capture-phase
    // stopPropagation here cannot block it. ElementPointerService handles
    // skipping events whose target is inside the panel.

    Object.assign(this.root.style, {
      position: 'absolute', top: '0', left: '0', zIndex: '2147483647',
    });

    this.cleanupAutoUpdate = autoUpdate(anchorEl, this.root, async () => {
      const root = this.root;
      if (!root) return;
      const { x, y } = await computePosition(anchorEl, root, {
        placement: 'bottom-start',
        middleware: [flip(), shift({ padding: 8 })],
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
    this.errorText = null;
  }
}
