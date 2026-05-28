import NotePanelService from '../../services/note-panel-service';
import SelectionStoreService from '../../services/selection-store-service';

const PANEL_SELECTOR = '.mcp-pointer__note-panel';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe('NotePanelService', () => {
  let store: SelectionStoreService;
  let onSend: jest.Mock;

  beforeEach(() => {
    store = new SelectionStoreService();
    onSend = jest.fn().mockResolvedValue(undefined);
    // Constructor subscribes to store; instance kept alive by that subscription.
    // eslint-disable-next-line no-new
    new NotePanelService(store, onSend);
  });

  afterEach(() => {
    document.querySelectorAll(PANEL_SELECTOR).forEach((el) => el.remove());
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

    const chips = document.querySelectorAll('.mcp-pointer__note-chip');
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
    const sendBtn = document.querySelector('.mcp-pointer__note-send') as HTMLButtonElement;
    sendBtn.click();

    await flushMicrotasks();
    await flushMicrotasks();

    expect(textarea.value).toBe('keep me');
    expect(sendBtn.disabled).toBe(false);
    const errorBox = document.querySelector('.mcp-pointer__note-error') as HTMLElement;
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
    const newSendBtn = document.querySelector('.mcp-pointer__note-send') as HTMLButtonElement;
    store.toggle(el); // now 0 → panel destroyed again
    newSendBtn.click(); // detached button click; no panel to act on
    expect(onSend).not.toHaveBeenCalled();
  });
});
