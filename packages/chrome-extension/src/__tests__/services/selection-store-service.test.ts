import SelectionStoreService from '../../services/selection-store-service';

describe('SelectionStoreService', () => {
  it('toggle adds a new element and notifies listeners', () => {
    const store = new SelectionStoreService();
    const listener = jest.fn();
    store.subscribe(listener);

    const el = document.createElement('div');
    store.toggle(el);

    expect(store.getAll()).toEqual([el]);
    expect(listener).toHaveBeenCalledWith([el]);
  });

  it('toggle removes an existing element and notifies listeners', () => {
    const store = new SelectionStoreService();
    const el = document.createElement('div');
    store.toggle(el);
    const listener = jest.fn();
    store.subscribe(listener);

    store.toggle(el);

    expect(store.getAll()).toEqual([]);
    expect(listener).toHaveBeenCalledWith([]);
  });

  it('remove is a noop when element not present (no notification)', () => {
    const store = new SelectionStoreService();
    const el = document.createElement('div');
    const listener = jest.fn();
    store.subscribe(listener);

    store.remove(el);

    expect(listener).not.toHaveBeenCalled();
    expect(store.getAll()).toEqual([]);
  });

  it('getFirst / getAll / size return correct snapshot', () => {
    const store = new SelectionStoreService();
    const a = document.createElement('div');
    const b = document.createElement('span');
    store.toggle(a);
    store.toggle(b);

    expect(store.getFirst()).toBe(a);
    expect(store.getAll()).toEqual([a, b]);
    expect(store.size()).toBe(2);
    expect(store.getAll()).not.toBe(store.getAll());
  });

  it('subscribe returns unsubscribe that detaches the listener', () => {
    const store = new SelectionStoreService();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.toggle(document.createElement('div'));

    expect(listener).not.toHaveBeenCalled();
  });
});
