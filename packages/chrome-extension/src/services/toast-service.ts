const TOAST_DURATION_MS = 1000;

export interface ToastPosition {
  x: number;
  y: number;
}

export default class ToastService {
  private container: HTMLElement | null = null;

  private shadow: ShadowRoot | null = null;

  private shown = false;

  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  show(
    message: string,
    position?: ToastPosition,
    actionLabel?: string,
    onAction?: () => void,
  ): void {
    if (this.shown) return;
    this.shown = true;

    this.container = document.createElement('div');
    this.container.id = 'dom-pointer-mcp-toast-root';
    this.shadow = this.container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .toast {
        position: fixed;
        top: 50%;
        left: 50%;
        z-index: 2147483647;
        background: #1a1a2e;
        color: #eee;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        width: max-content;
        max-width: min(340px, calc(100vw - 24px));
        opacity: 0;
        transform: translate(-50%, calc(-50% + 10px));
        transition: opacity 0.3s, transform 0.3s;
      }
      .toast.visible {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
      .toast-action {
        color: #64b5f6;
        cursor: pointer;
        margin-left: 8px;
        text-decoration: underline;
        background: none;
        border: none;
        font-size: 13px;
        padding: 0;
      }
      .toast-action:hover {
        color: #90caf9;
      }
    `;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (position) {
      toast.style.left = `${position.x}px`;
      toast.style.top = `${position.y}px`;
    }

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    if (actionLabel && onAction) {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => {
        onAction();
        this.dismiss();
      });
      toast.appendChild(btn);
    }

    this.shadow.appendChild(style);
    this.shadow.appendChild(toast);
    document.body.appendChild(this.container);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    this.dismissTimer = setTimeout(() => this.dismiss(), TOAST_DURATION_MS);
  }

  private dismiss(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.shadow = null;
    this.shown = false;
  }
}
