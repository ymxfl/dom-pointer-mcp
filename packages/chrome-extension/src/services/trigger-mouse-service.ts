import { throttle } from '../utils/performance';

interface TriggerClickServiceParams {
  onHover: (element: HTMLElement) => void;
  onClick: (element: HTMLElement) => void;
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
    // pointerdown drives the selection callback. It fires before click,
    // and (unlike click) is not suppressed by Chrome on :disabled form
    // controls when pointer-events: auto is applied.
    document.addEventListener('pointerdown', this.handlePointerDown, true);
    // Suppress the follow-up events so the page's default action (navigation,
    // form submit, onClick handler) never runs.
    document.addEventListener('mousedown', this.suppressEvent, true);
    document.addEventListener('mouseup', this.suppressEvent, true);
    document.addEventListener('click', this.suppressEvent, true);

    // Simulate a hover event at registration time
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
    this.onHover(event.target as HTMLElement);
  }

  private handlePointerDown(event: PointerEvent): void {
    event.stopImmediatePropagation();
    event.preventDefault();
    this.onClick(event.target as HTMLElement);
  }

  private suppressEvent(event: Event): void {
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  private getElementUnderCursor() {
    const hovered = document.querySelectorAll(':hover');
    return hovered[hovered.length - 1]; // deepest element
  }
}
