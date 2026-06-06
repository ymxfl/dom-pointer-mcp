import autoAssignOverlayPositionAndSize from '../utils/position';

interface OverlayWrapper {
  overlay: HTMLDivElement;
  target: HTMLElement;
}

const OVERLAY_BASE_CLASS = 'dom-pointer-mcp__overlay';
const HOVER_CLASS = 'dom-pointer-mcp__overlay--hover';
const SELECTION_CLASS = 'dom-pointer-mcp__overlay--selection';
const INDEX_BADGE_CLASS = 'dom-pointer-mcp__overlay-index';

export default class OverlayManagerService {
  private hoverOverlay: OverlayWrapper | null = null;

  private selectionOverlays = new Map<HTMLElement, OverlayWrapper>();

  // --- Hover (single) ---

  overlayHover(target: HTMLElement): void {
    if (!this.hoverOverlay) {
      this.hoverOverlay = {
        overlay: this.buildOverlayElement(HOVER_CLASS, false),
        target,
      };
    } else {
      this.hoverOverlay.target = target;
    }
    autoAssignOverlayPositionAndSize(target, this.hoverOverlay.overlay);
  }

  clearHover(): void {
    this.hoverOverlay?.overlay.remove();
    this.hoverOverlay = null;
  }

  // --- Selection (multi) ---

  overlaySelection(target: HTMLElement, index?: number): void {
    if (this.selectionOverlays.has(target)) return;
    const wrapper: OverlayWrapper = {
      overlay: this.buildOverlayElement(SELECTION_CLASS, true),
      target,
    };
    this.selectionOverlays.set(target, wrapper);
    this.setOverlayIndex(wrapper.overlay, index);
    autoAssignOverlayPositionAndSize(target, wrapper.overlay);
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
    wrapper.overlay.remove();
    this.selectionOverlays.delete(target);
  }

  clearAllSelections(): void {
    this.selectionOverlays.forEach((w) => w.overlay.remove());
    this.selectionOverlays.clear();
  }

  getSelectionElements(): HTMLElement[] {
    return Array.from(this.selectionOverlays.keys());
  }

  // --- Shared ---

  private buildOverlayElement(typeClass: string, hasGlow: boolean): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = `${OVERLAY_BASE_CLASS} ${typeClass}`;

    if (hasGlow) {
      const glow = document.createElement('div');
      glow.className = 'dom-pointer-mcp__overlay-glow';
      overlay.appendChild(glow);
    }

    const glass = document.createElement('div');
    glass.className = 'dom-pointer-mcp__overlay-glass';
    overlay.appendChild(glass);

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
