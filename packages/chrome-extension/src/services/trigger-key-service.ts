import { ModifierKey } from '../utils/config';

interface TriggerKeyServiceParams {
  onTriggerKeyStart: () => void;
  onTriggerKeyEnd: () => void;
  modifierKey: ModifierKey;
}

export default class TriggerKeyService {
  private onTriggerKeyStart: () => void;

  private onTriggerKeyEnd: () => void;

  private modifierKey: ModifierKey;

  constructor({ onTriggerKeyStart, onTriggerKeyEnd, modifierKey }: TriggerKeyServiceParams) {
    this.onTriggerKeyStart = onTriggerKeyStart;
    this.onTriggerKeyEnd = onTriggerKeyEnd;
    this.modifierKey = modifierKey;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  setModifierKey(key: ModifierKey): void {
    this.modifierKey = key;
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
    switch (this.modifierKey) {
      case 'Alt':
        return event.altKey || event.key === 'Alt';
      case 'Ctrl':
        return event.ctrlKey || event.key === 'Control';
      case 'Meta':
        return event.metaKey || event.key === 'Meta';
      default:
        return false;
    }
  }

  private isOnlyTriggerKeyRelated(event: KeyboardEvent): boolean {
    const related = this.isTriggerKeyRelated(event);
    if (!related) return false;

    switch (this.modifierKey) {
      case 'Alt':
        return !event.ctrlKey && !event.shiftKey && !event.metaKey;
      case 'Ctrl':
        return !event.altKey && !event.shiftKey && !event.metaKey;
      case 'Meta':
        return !event.altKey && !event.shiftKey && !event.ctrlKey;
      default:
        return false;
    }
  }

  private isTriggerKeyPressed(event: KeyboardEvent): boolean {
    switch (this.modifierKey) {
      case 'Alt':
        return event.altKey;
      case 'Ctrl':
        return event.ctrlKey;
      case 'Meta':
        return event.metaKey;
      default:
        return false;
    }
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
