interface TriggerKeyServiceParams {
  onTriggerKeyStart: () => void;
  onTriggerKeyEnd: () => void;
}

export default class TriggerKeyService {
  private onTriggerKeyStart: () => void;

  private onTriggerKeyEnd: () => void;

  constructor({ onTriggerKeyStart, onTriggerKeyEnd }: TriggerKeyServiceParams) {
    this.onTriggerKeyStart = onTriggerKeyStart;
    this.onTriggerKeyEnd = onTriggerKeyEnd;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isOnlyTriggerKeyRelated(event)) {
      this.onTriggerKeyStart();
    } else {
      this.onTriggerKeyEnd();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (this.isTriggerKeyPressed(event) && this.isOnlyTriggerKeyRelated(event)) {
      this.onTriggerKeyStart();
    } else {
      this.onTriggerKeyEnd();
    }
  }

  private isTriggerKeyRelated(event: KeyboardEvent): boolean {
    return event.altKey || event.key === 'Alt';
  }

  private isOnlyTriggerKeyRelated(event: KeyboardEvent): boolean {
    return this.isTriggerKeyRelated(event)
      && !event.ctrlKey
      && !event.shiftKey
      && !event.metaKey;
  }

  private isTriggerKeyPressed(event: KeyboardEvent): boolean {
    return event.altKey;
  }

  registerListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  unregisterListeners(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }
}
