import ArrowNavigationService from '../../services/arrow-navigation-service';
import SelectionStoreService from '../../services/selection-store-service';

jest.mock('../../utils/dom-navigation', () => ({
  getParent: jest.fn(),
  getFirstChild: jest.fn(),
  getPrevSibling: jest.fn(),
  getNextSibling: jest.fn(),
}));

import {
  getParent,
  getFirstChild,
  getPrevSibling,
  getNextSibling,
} from '../../utils/dom-navigation';

function press(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
}

describe('ArrowNavigationService', () => {
  let store: SelectionStoreService;
  let service: ArrowNavigationService;

  beforeEach(() => {
    store = new SelectionStoreService();
    service = new ArrowNavigationService(store);
    service.registerListeners();
    (getParent as jest.Mock).mockReset();
    (getFirstChild as jest.Mock).mockReset();
    (getPrevSibling as jest.Mock).mockReset();
    (getNextSibling as jest.Mock).mockReset();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    service.unregisterListeners();
  });

  it('does nothing when selection is empty', () => {
    const event = press('ArrowUp');
    expect(event.defaultPrevented).toBe(false);
    expect(getParent).not.toHaveBeenCalled();
  });

  it('ArrowUp replaces last element with its parent', () => {
    const child = document.createElement('span');
    const parent = document.createElement('div');
    store.toggle(child);
    (getParent as jest.Mock).mockReturnValue(parent);

    const event = press('ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(getParent).toHaveBeenCalledWith(child);
    expect(store.getAll()).toEqual([parent]);
  });

  it('ArrowDown uses getFirstChild, ArrowLeft getPrevSibling, ArrowRight getNextSibling', () => {
    const el = document.createElement('div');
    const down = document.createElement('div');
    const left = document.createElement('div');
    const right = document.createElement('div');

    store.toggle(el);
    (getFirstChild as jest.Mock).mockReturnValue(down);
    press('ArrowDown');
    expect(store.getLast()).toBe(down);

    (getPrevSibling as jest.Mock).mockReturnValue(left);
    press('ArrowLeft');
    expect(store.getLast()).toBe(left);

    (getNextSibling as jest.Mock).mockReturnValue(right);
    press('ArrowRight');
    expect(store.getLast()).toBe(right);
  });

  it('preventDefault but no replace when no target found', () => {
    const el = document.createElement('div');
    store.toggle(el);
    (getParent as jest.Mock).mockReturnValue(null);

    const event = press('ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(store.getAll()).toEqual([el]);
  });

  it('does not intercept when focus is in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    store.toggle(document.createElement('div'));

    const event = press('ArrowUp');

    expect(event.defaultPrevented).toBe(false);
    expect(getParent).not.toHaveBeenCalled();
  });

  it('ignores non-arrow keys', () => {
    store.toggle(document.createElement('div'));
    const event = press('Enter');
    expect(event.defaultPrevented).toBe(false);
    expect(getParent).not.toHaveBeenCalled();
  });

  it('unregisterListeners stops handling', () => {
    store.toggle(document.createElement('div'));
    service.unregisterListeners();
    const event = press('ArrowUp');
    expect(event.defaultPrevented).toBe(false);
  });
});
