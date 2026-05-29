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
    const PANEL_W = 280;
    const PANEL_H = 200;

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

    function stubPanelRect(): HTMLElement {
      const panel = document.querySelector(PANEL_SELECTOR) as HTMLElement;
      // Track the latest left/top floating-ui assigned via style so the stubbed
      // rect reflects the panel's current position. jsdom otherwise returns 0x0.
      panel.getBoundingClientRect = () => {
        const left = parseFloat(panel.style.left) || 0;
        const top = parseFloat(panel.style.top) || 0;
        return {
          x: left, y: top, left, top,
          right: left + PANEL_W, bottom: top + PANEL_H,
          width: PANEL_W, height: PANEL_H,
          toJSON() { return this; },
        } as DOMRect;
      };
      // floating-ui-dom reads offsetWidth/offsetHeight for floating element
      // dimensions (see getCssDimensions). jsdom returns 0 for both, so we
      // must override these as well or shift sees a 0x0 panel and never moves it.
      Object.defineProperty(panel, 'offsetWidth', { configurable: true, value: PANEL_W });
      Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: PANEL_H });
      return panel;
    }

    async function waitForPositioning(): Promise<void> {
      // floating-ui's autoUpdate may run multiple async passes; flush a few frames.
      for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    it('keeps a realistically-sized panel inside the viewport when anchor fills it', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      stubRect(el, {
        left: 0, top: 0, right: VIEW_W, bottom: VIEW_H, width: VIEW_W, height: VIEW_H,
      });
      store.toggle(el);
      stubPanelRect();
      await waitForPositioning();

      const panel = document.querySelector(PANEL_SELECTOR) as HTMLElement;
      const left = parseFloat(panel.style.left);
      const top = parseFloat(panel.style.top);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + PANEL_W).toBeLessThanOrEqual(VIEW_W);
      expect(top + PANEL_H).toBeLessThanOrEqual(VIEW_H);
    });

    it('keeps a realistically-sized panel inside the viewport when anchor extends past it', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      // Long body scrolled half-way: extends beyond viewport in both directions.
      stubRect(el, {
        left: 0, top: -500, right: VIEW_W, bottom: 2500, width: VIEW_W, height: 3000,
      });
      store.toggle(el);
      stubPanelRect();
      await waitForPositioning();

      const panel = document.querySelector(PANEL_SELECTOR) as HTMLElement;
      const left = parseFloat(panel.style.left);
      const top = parseFloat(panel.style.top);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + PANEL_W).toBeLessThanOrEqual(VIEW_W);
      expect(top + PANEL_H).toBeLessThanOrEqual(VIEW_H);
    });
  });
});
