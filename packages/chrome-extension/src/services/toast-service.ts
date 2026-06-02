const TOAST_DURATION_MS = 5000;

export default class ToastService {
  private container: HTMLElement | null = null;

  private shadow: ShadowRoot | null = null;

  private shown = false;

  show(message: string, actionLabel?: string, onAction?: () => void): void {
    if (this.shown) return;
    this.shown = true;

    this.container = document.createElement('div');
    this.container.id = 'dom-pointer-mcp-toast-root';
    this.shadow = this.container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        background: #1a1a2e;
        color: #eee;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 340px;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s, transform 0.3s;
      }
      .toast.visible {
        opacity: 1;
        transform: translateY(0);
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

    setTimeout(() => this.dismiss(), TOAST_DURATION_MS);
  }

  private dismiss(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.shadow = null;
  }
}
