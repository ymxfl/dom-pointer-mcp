import SelectionStoreService from './selection-store-service';
import {
  getParent,
  getFirstChild,
  getPrevSibling,
  getNextSibling,
} from '../utils/dom-navigation';

type NavFn = (el: HTMLElement) => HTMLElement | null;

const DIRECTION_MAP: Record<string, NavFn> = {
  ArrowUp: getParent,
  ArrowDown: getFirstChild,
  ArrowLeft: getPrevSibling,
  ArrowRight: getNextSibling,
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export default class ArrowNavigationService {
  private store: SelectionStoreService;

  constructor(store: SelectionStoreService) {
    this.store = store;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.store.size() === 0) return;

    const navFn = DIRECTION_MAP[event.key];
    if (!navFn) return;

    if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return;

    event.preventDefault();

    const last = this.store.getLast();
    if (!last) return;

    const target = navFn(last);
    if (!target) return;

    this.store.replace(last, target);
  }

  registerListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  unregisterListeners(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}
