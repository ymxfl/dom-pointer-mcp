import autoAssignOverlayPositionAndSize from '../utils/position';

interface OverlayWrapper {
  overlay: HTMLDivElement;
  target: HTMLElement;
  cleanup: () => void;
}

const OVERLAY_BASE_CLASS = 'dom-pointer-mcp__overlay';
const HOVER_CLASS = 'dom-pointer-mcp__overlay--hover';
const SELECTION_CLASS = 'dom-pointer-mcp__overlay--selection';
const INSTANT_CLASS = 'dom-pointer-mcp__overlay--instant';
const INDEX_BADGE_CLASS = 'dom-pointer-mcp__overlay-index';

export default class OverlayManagerService {
  private hoverOverlay: OverlayWrapper | null = null;

  private selectionOverlays = new Map<HTMLElement, OverlayWrapper>();

  // --- Hover (single) ---

  overlayHover(target: HTMLElement): void {
    if (!this.hoverOverlay) {
      const overlay = this.buildOverlayElement(HOVER_CLASS);
      // Snap on first paint so the outline doesn't fly in from 0,0.
      overlay.classList.add(INSTANT_CLASS);
      this.hoverOverlay = {
        overlay,
        target,
        cleanup: autoAssignOverlayPositionAndSize(target, overlay),
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.classList.remove(INSTANT_CLASS);
        });
      });
      return;
    }

    if (this.hoverOverlay.target === target) return;

    this.hoverOverlay.cleanup();
    this.hoverOverlay.target = target;
    this.hoverOverlay.cleanup = autoAssignOverlayPositionAndSize(
      target,
      this.hoverOverlay.overlay,
    );
  }

  clearHover(): void {
    this.hoverOverlay?.cleanup();
    this.hoverOverlay?.overlay.remove();
    this.hoverOverlay = null;
  }

  // --- Selection (multi) ---

  overlaySelection(target: HTMLElement, index?: number): void {
    if (this.selectionOverlays.has(target)) return;
    const overlay = this.buildOverlayElement(SELECTION_CLASS);
    const wrapper: OverlayWrapper = {
      overlay,
      target,
      cleanup: autoAssignOverlayPositionAndSize(target, overlay),
    };
    this.selectionOverlays.set(target, wrapper);
    this.setOverlayIndex(wrapper.overlay, index);
  }

  updateSelectionIndexes(elements: HTMLElement[]): void {
    elements.forEach((element, index) => {
      const wrapper = this.selectionOverlays.get(element);
      if (!wrapper) return;
      this.setOverlayIndex(wrapper.overlay, index + 1);
    });
  }

  clearSelection(target: HTMLElement): void {
    const wrapper = this.selectionOverlays.get(target);
    if (!wrapper) return;
    wrapper.cleanup();
    wrapper.overlay.remove();
    this.selectionOverlays.delete(target);
  }

  clearAllSelections(): void {
    this.selectionOverlays.forEach((w) => {
      w.cleanup();
      w.overlay.remove();
    });
    this.selectionOverlays.clear();
  }

  getSelectionElements(): HTMLElement[] {
    return Array.from(this.selectionOverlays.keys());
  }

  // --- Shared ---

  private buildOverlayElement(typeClass: string): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = `${OVERLAY_BASE_CLASS} ${typeClass}`;
    document.body.appendChild(overlay);
    return overlay;
  }

  private setOverlayIndex(overlay: HTMLDivElement, index?: number): void {
    let badge = overlay.querySelector(`.${INDEX_BADGE_CLASS}`) as HTMLSpanElement | null;
    if (!index) {
      badge?.remove();
      return;
    }

    if (!badge) {
      badge = document.createElement('span');
      badge.className = INDEX_BADGE_CLASS;
      overlay.appendChild(badge);
    }
    badge.textContent = String(index);
  }
}
