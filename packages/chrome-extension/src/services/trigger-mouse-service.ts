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
    this.handleClick = this.handleClick.bind(this);
  }

  registerListeners(): void {
    document.addEventListener('mouseover', this.handleMouseOver);
    document.addEventListener('click', this.handleClick);

    // Simulate a hover event at registration time
    const currentElement = this.getElementUnderCursor();
    if (currentElement) {
      this.onHover(currentElement as HTMLElement);
    }
  }

  unregisterListeners(): void {
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('click', this.handleClick);
  }

  private handleMouseOver(event: MouseEvent): void {
    this.onHover(event.target as HTMLElement);
  }

  private handleClick(event: MouseEvent): void {
    // Stop the event from reaching any other handlers
    event.stopImmediatePropagation();
    event.preventDefault();

    this.onClick(event.target as HTMLElement);
  }

  private getElementUnderCursor() {
    const hovered = document.querySelectorAll(':hover');
    return hovered[hovered.length - 1]; // deepest element
  }
}
