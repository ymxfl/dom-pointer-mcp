import ToastService from '../../services/toast-service';

describe('ToastService', () => {
  const originalAttachShadow = HTMLElement.prototype.attachShadow;
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function attachShadow(
      this: HTMLElement,
    ) {
      return originalAttachShadow.call(this, { mode: 'open' });
    });
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    window.requestAnimationFrame = originalRequestAnimationFrame;
    document.querySelector('#dom-pointer-mcp-toast-root')?.remove();
  });

  it('shows feedback at the supplied panel position', () => {
    const service = new ToastService();
    service.show('Sent', { x: 280, y: 260 });

    const root = document.querySelector('#dom-pointer-mcp-toast-root') as HTMLElement;
    const toast = root.shadowRoot?.querySelector('.toast') as HTMLElement;
    expect(toast.style.left).toBe('280px');
    expect(toast.style.top).toBe('260px');
    expect(toast.classList).toContain('visible');

    jest.advanceTimersByTime(999);
    expect(document.querySelector('#dom-pointer-mcp-toast-root')).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(document.querySelector('#dom-pointer-mcp-toast-root')).toBeNull();
  });
});
