import { throttle } from '../utils/performance';

interface TriggerClickServiceParams {
  onHover: (element: HTMLElement) => void;
  onClick: (element: HTMLElement) => void;
}

const PANEL_SELECTOR = '.dom-pointer-mcp__note-panel, .dom-pointer-mcp__history-drawer';

function isInsidePanel(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(PANEL_SELECTOR) !== null;
}

export default class TriggerClickService {
  private onHover: (element: HTMLElement) => void;

  private onClick: (element: HTMLElement) => void;

  constructor({ onHover, onClick }: TriggerClickServiceParams) {
    this.onHover = onHover;
    this.onClick = onClick;

    this.handleMouseOver = throttle(this.handleMouseOver.bind(this), 40);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.suppressEvent = this.suppressEvent.bind(this);
  }

  registerListeners(): void {
    document.addEventListener('mouseover', this.handleMouseOver);
    document.addEventListener('pointerdown', this.handlePointerDown, true);
    document.addEventListener('mousedown', this.suppressEvent, true);
    document.addEventListener('mouseup', this.suppressEvent, true);
    document.addEventListener('click', this.suppressEvent, true);

    const currentElement = this.getElementUnderCursor();
    if (currentElement) {
      this.onHover(currentElement as HTMLElement);
    }
  }

  unregisterListeners(): void {
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    document.removeEventListener('mousedown', this.suppressEvent, true);
    document.removeEventListener('mouseup', this.suppressEvent, true);
    document.removeEventListener('click', this.suppressEvent, true);
  }

  private handleMouseOver(event: MouseEvent): void {
    if (isInsidePanel(event.target)) return;
    this.onHover(event.target as HTMLElement);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (isInsidePanel(event.target)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    this.onClick(event.target as HTMLElement);
  }

  private suppressEvent(event: Event): void {
    if (isInsidePanel(event.target)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  private getElementUnderCursor() {
    const hovered = document.querySelectorAll(':hover');
    return hovered[hovered.length - 1];
  }
}
