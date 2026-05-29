import NotePanelService from '../../services/note-panel-service';
import SelectionStoreService from '../../services/selection-store-service';

const PANEL_SELECTOR = '.dom-pointer-mcp__note-panel';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe('NotePanelService', () => {
  let store: SelectionStoreService;
  let onSend: jest.Mock;
  let onCopy: jest.Mock;
  let originalClipboard: any;
  let writeText: jest.Mock;

  beforeEach(() => {
    store = new SelectionStoreService();
    onSend = jest.fn().mockResolvedValue(undefined);
    onCopy = jest.fn().mockResolvedValue('{"copied":true}');

    // Stub navigator.clipboard for the Copy button
    originalClipboard = (navigator as any).clipboard;
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    // Constructor subscribes to store; instance kept alive by that subscription.
    // eslint-disable-next-line no-new
    new NotePanelService(store, onSend, onCopy);
  });

  afterEach(() => {
    document.querySelectorAll(PANEL_SELECTOR).forEach((el) => el.remove());
    if (originalClipboard === undefined) {
      delete (navigator as any).clipboard;
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('appends panel to body when selection goes 0 → 1', () => {
    expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);
    expect(document.querySelector(PANEL_SELECTOR)).not.toBeNull();
  });

  it('removes panel from body when selection goes N → 0', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);
    expect(document.querySelector(PANEL_SELECTOR)).not.toBeNull();
    store.toggle(el); // removes
    expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
  });

  it('clicking a chip × button calls store.remove for that element', () => {
    const a = document.createElement('div');
    const b = document.createElement('span');
    document.body.appendChild(a);
    document.body.appendChild(b);
    store.toggle(a);
    store.toggle(b);

    const chips = document.querySelectorAll('.dom-pointer-mcp__note-chip');
    expect(chips).toHaveLength(2);
    const removeBtn = chips[1].querySelector('button') as HTMLButtonElement;
    removeBtn.click();

    expect(store.getAll()).toEqual([a]);
  });

  it('Cmd+Enter on textarea triggers onSend; textarea is cleared after resolve', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'change me';
    const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, cancelable: true });
    textarea.dispatchEvent(event);

    expect(onSend).toHaveBeenCalledWith([el], 'change me');
    await flushMicrotasks();
    expect(textarea.value).toBe('');
  });

  it('onSend rejection does NOT clear textarea; sendBtn re-enabled', async () => {
    onSend.mockRejectedValueOnce(new Error('network down'));
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'keep me';
    const sendBtn = document.querySelector('.dom-pointer-mcp__note-send') as HTMLButtonElement;
    sendBtn.click();

    await flushMicrotasks();
    await flushMicrotasks();

    expect(textarea.value).toBe('keep me');
    expect(sendBtn.disabled).toBe(false);
    const errorBox = document.querySelector('.dom-pointer-mcp__note-error') as HTMLElement;
    expect(errorBox.hidden).toBe(false);
    expect(errorBox.textContent).toMatch(/network down/);
  });

  it('handleSend with empty selection is a noop (race protection)', async () => {
    expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);
    store.toggle(el); // back to 0 → panel destroyed
    store.toggle(el); // re-add → panel rebuilt
    const newSendBtn = document.querySelector('.dom-pointer-mcp__note-send') as HTMLButtonElement;
    store.toggle(el); // now 0 → panel destroyed again
    newSendBtn.click(); // detached button click; no panel to act on
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Copy button calls onCopy, writes to clipboard, and does NOT clear textarea', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'keep this note';
    const copyBtn = document.querySelector('.dom-pointer-mcp__note-copy') as HTMLButtonElement;
    copyBtn.click();

    await flushMicrotasks();
    await flushMicrotasks();

    expect(onCopy).toHaveBeenCalledWith([el], 'keep this note');
    expect(writeText).toHaveBeenCalledWith('{"copied":true}');
    expect(textarea.value).toBe('keep this note'); // unchanged
    expect(copyBtn.disabled).toBe(false);
  });

  it('Close button clears the store and destroys the panel', () => {
    const a = document.createElement('div');
    const b = document.createElement('span');
    document.body.appendChild(a);
    document.body.appendChild(b);
    store.toggle(a);
    store.toggle(b);
    expect(document.querySelector(PANEL_SELECTOR)).not.toBeNull();

    const closeBtn = document.querySelector('.dom-pointer-mcp__note-close') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(store.getAll()).toEqual([]);
    expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
  });

  describe('positioning with virtual anchor', () => {
    const VIEW_W = 1000;
    const VIEW_H = 800;

    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEW_W });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_H });
    });

    function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
      const full: DOMRect = {
        x: rect.x ?? rect.left ?? 0,
        y: rect.y ?? rect.top ?? 0,
        left: rect.left ?? 0,
        top: rect.top ?? 0,
        right: rect.right ?? 0,
        bottom: rect.bottom ?? 0,
        width: rect.width ?? ((rect.right ?? 0) - (rect.left ?? 0)),
        height: rect.height ?? ((rect.bottom ?? 0) - (rect.top ?? 0)),
        toJSON() { return this; },
      };
      el.getBoundingClientRect = () => full;
    }

    async function panelPosition(): Promise<{ left: number; top: number }> {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const panel = document.querySelector(PANEL_SELECTOR) as HTMLElement;
      return { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) };
    }

    it('keeps panel inside viewport when anchor fills the viewport', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      stubRect(el, {
        left: 0, top: 0, right: VIEW_W, bottom: VIEW_H, width: VIEW_W, height: VIEW_H,
      });
      store.toggle(el);

      const { left, top } = await panelPosition();
      const panel = document.querySelector(PANEL_SELECTOR) as HTMLElement;
      const w = panel.offsetWidth || 280;
      const h = panel.offsetHeight || 200;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + w).toBeLessThanOrEqual(VIEW_W + 1);
      expect(top + h).toBeLessThanOrEqual(VIEW_H + 1);
    });
  });
});
