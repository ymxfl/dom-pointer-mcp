import OverlayManagerService from '../../services/overlay-manager-service';

const HOVER_SELECTOR = '.dom-pointer-mcp__overlay--hover';
const SELECTION_SELECTOR = '.dom-pointer-mcp__overlay--selection';
const INSTANT_CLASS = 'dom-pointer-mcp__overlay--instant';
const GLOW_SELECTOR = '.dom-pointer-mcp__overlay-glow';
const GLASS_SELECTOR = '.dom-pointer-mcp__overlay-glass';

describe('OverlayManagerService', () => {
  let service: OverlayManagerService;

  beforeEach(() => {
    service = new OverlayManagerService();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    service.clearHover();
    service.clearAllSelections();
    document.body.innerHTML = '';
  });

  function makeTarget(id: string): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
    return el;
  }

  it('reuses one hover overlay and morphs it between targets', () => {
    const a = makeTarget('a');
    const b = makeTarget('b');

    service.overlayHover(a);
    const first = document.querySelector(HOVER_SELECTOR);
    expect(first).not.toBeNull();

    service.overlayHover(b);
    const overlays = document.querySelectorAll(HOVER_SELECTOR);
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toBe(first);
  });

  it('snaps on first hover then drops the instant class for later morphs', async () => {
    const a = makeTarget('a');
    service.overlayHover(a);

    const overlay = document.querySelector(HOVER_SELECTOR) as HTMLElement;
    expect(overlay.classList.contains(INSTANT_CLASS)).toBe(true);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    expect(overlay.classList.contains(INSTANT_CLASS)).toBe(false);
  });

  it('removes the hover overlay on clearHover', () => {
    const a = makeTarget('a');
    service.overlayHover(a);
    expect(document.querySelector(HOVER_SELECTOR)).not.toBeNull();

    service.clearHover();
    expect(document.querySelector(HOVER_SELECTOR)).toBeNull();
  });

  it('builds selection overlays without glow/glass children', () => {
    const a = makeTarget('a');
    service.overlaySelection(a, 1);

    const overlay = document.querySelector(SELECTION_SELECTOR) as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector(GLOW_SELECTOR)).toBeNull();
    expect(overlay.querySelector(GLASS_SELECTOR)).toBeNull();
    expect(overlay.querySelector('.dom-pointer-mcp__overlay-index')?.textContent).toBe('1');
  });

  it('clears selection overlays', () => {
    const a = makeTarget('a');
    const b = makeTarget('b');
    service.overlaySelection(a, 1);
    service.overlaySelection(b, 2);
    expect(document.querySelectorAll(SELECTION_SELECTOR)).toHaveLength(2);

    service.clearSelection(a);
    expect(document.querySelectorAll(SELECTION_SELECTOR)).toHaveLength(1);

    service.clearAllSelections();
    expect(document.querySelectorAll(SELECTION_SELECTOR)).toHaveLength(0);
  });
});
