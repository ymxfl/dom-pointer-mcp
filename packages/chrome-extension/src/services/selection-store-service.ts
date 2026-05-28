type Listener = (elements: HTMLElement[]) => void;

export default class SelectionStoreService {
  private elements: HTMLElement[] = [];

  private listeners = new Set<Listener>();

  toggle(el: HTMLElement): void {
    const idx = this.elements.indexOf(el);
    if (idx >= 0) {
      this.elements.splice(idx, 1);
    } else {
      this.elements.push(el);
    }
    this.emit();
  }

  remove(el: HTMLElement): void {
    const idx = this.elements.indexOf(el);
    if (idx < 0) return;
    this.elements.splice(idx, 1);
    this.emit();
  }

  clear(): void {
    if (this.elements.length === 0) return;
    this.elements = [];
    this.emit();
  }

  getAll(): HTMLElement[] {
    return [...this.elements];
  }

  getFirst(): HTMLElement | undefined {
    return this.elements[0];
  }

  size(): number {
    return this.elements.length;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    const snapshot = this.getAll();
    this.listeners.forEach((fn) => fn(snapshot));
  }
}
