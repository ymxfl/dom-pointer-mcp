import autoAssignOverlayPositionAndSize from '../utils/position';

interface OverlayWrapper {
  overlay: HTMLDivElement;
  target: HTMLElement;
}

const OVERLAY_BASE_CLASS = 'mcp-pointer__overlay';
const HOVER_CLASS = 'mcp-pointer__overlay--hover';
const SELECTION_CLASS = 'mcp-pointer__overlay--selection';

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

  overlaySelection(target: HTMLElement): void {
    if (this.selectionOverlays.has(target)) return;
    const wrapper: OverlayWrapper = {
      overlay: this.buildOverlayElement(SELECTION_CLASS, true),
      target,
    };
    this.selectionOverlays.set(target, wrapper);
    autoAssignOverlayPositionAndSize(target, wrapper.overlay);
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
      glow.className = 'mcp-pointer__overlay-glow';
      overlay.appendChild(glow);
    }

    const glass = document.createElement('div');
    glass.className = 'mcp-pointer__overlay-glass';
    overlay.appendChild(glass);

    document.body.appendChild(overlay);
    return overlay;
  }
}
