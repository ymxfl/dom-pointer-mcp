import { withExtensionUiHidden } from '../../utils/screenshot';

describe('withExtensionUiHidden', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    document.documentElement.classList.remove('dom-pointer-mcp--capturing-screenshot');
  });

  it('hides extension UI while capturing and restores it afterwards', async () => {
    const operation = jest.fn(async () => {
      expect(document.documentElement.classList).toContain(
        'dom-pointer-mcp--capturing-screenshot',
      );
      return 'captured';
    });

    await expect(withExtensionUiHidden(operation)).resolves.toBe('captured');
    expect(document.documentElement.classList).not.toContain(
      'dom-pointer-mcp--capturing-screenshot',
    );
  });

  it('restores visibility when capture fails', async () => {
    await expect(withExtensionUiHidden(async () => {
      throw new Error('capture failed');
    })).rejects.toThrow('capture failed');

    expect(document.documentElement.classList).not.toContain(
      'dom-pointer-mcp--capturing-screenshot',
    );
  });
});
