jest.mock('@floating-ui/dom', () => ({
  size: (options: { apply: Function }) => ({ name: 'size', options }),
  autoUpdate: (_t: HTMLElement, _o: HTMLElement, update: () => void) => {
    update();
    return jest.fn();
  },
  computePosition: async (
    _target: HTMLElement,
    overlay: HTMLElement,
    options: { middleware?: Array<{ options?: { apply?: Function } }> },
  ) => {
    const sizeMw = options.middleware?.find((m) => m?.options?.apply);
    sizeMw?.options?.apply?.({
      rects: {
        reference: {
          x: 40, y: 60, width: 100, height: 100,
        },
      },
      elements: { floating: overlay },
    });
    return {
      x: 0,
      y: 0,
      placement: 'bottom',
      strategy: 'absolute',
      middlewareData: {},
    };
  },
}));

// Import after mock so position.ts picks up mocked floating-ui.
// eslint-disable-next-line import/first
import autoAssignOverlayPositionAndSize from '../../utils/position';

describe('autoAssignOverlayPositionAndSize', () => {
  it('writes explicit width/height so overlays can CSS-transition', async () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1200 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'scrollWidth', { configurable: true, value: 1200 });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'offsetWidth', { configurable: true, value: 1200 });
    Object.defineProperty(document.documentElement, 'offsetHeight', { configurable: true, value: 800 });

    const target = document.createElement('div');
    const overlay = document.createElement('div');
    document.body.appendChild(target);
    document.body.appendChild(overlay);

    const cleanup = autoAssignOverlayPositionAndSize(target, overlay);
    await Promise.resolve();

    // offset = 6 → 100 + 12 = 112; left/top inset by offset
    expect(overlay.style.width).toBe('112px');
    expect(overlay.style.height).toBe('112px');
    expect(overlay.style.left).toBe('34px');
    expect(overlay.style.top).toBe('54px');
    expect(typeof cleanup).toBe('function');
  });
});
