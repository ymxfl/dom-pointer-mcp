import autoAssignOverlayPositionAndSize from '../utils/position';

interface OverlayWrapper {
  overlay: HTMLDivElement;
  target: HTMLElement | null;
}

export enum OverlayType {
  SELECTION = 'selection',
  HOVER = 'hover',
}

// defines common class for overlay elements
const OVERLAY_BASE_CLASS = 'mcp-pointer__overlay';
const OVERLAY_CONFIG = {
  [OverlayType.SELECTION]: {
    typeClassName: 'mcp-pointer__overlay--selection',
    hasGlow: true,
    hasGlass: true,
  },
  [OverlayType.HOVER]: {
    typeClassName: 'mcp-pointer__overlay--hover',
    hasGlow: false,
    hasGlass: true,
  },
};

export default class OverlayManagerService {
  private overlayWrappers = new Map<OverlayType, OverlayWrapper>();

  overlay(type: OverlayType, target: HTMLElement): void {
    this.assignTargetToOverlay(type, target);
    this.positionOverlay(type);
  }

  clearOverlay(type: OverlayType): void {
    const wrapper = this.overlayWrappers.get(type);
    const overlay = wrapper?.overlay;

    if (overlay) {
      overlay.remove();
      this.overlayWrappers.delete(type);
    }
  }

  private assignTargetToOverlay(type: OverlayType, target: HTMLElement): void {
    const wrapper = this.overlayWrappers.get(type);

    const overlay = wrapper?.overlay || this.buildOverlayElement(type);

    this.overlayWrappers.set(type, { overlay, target });
  }

  private buildOverlayElement(type: OverlayType): HTMLDivElement {
    const overlayConfig = OVERLAY_CONFIG[type];
    const identifier = overlayConfig.typeClassName;
    const overlayClassName = `${OVERLAY_BASE_CLASS} ${identifier}`;

    const overlay = document.createElement('div');
    overlay.className = overlayClassName;

    // Build DOM structure based on type
    if (overlayConfig.hasGlow) {
      const glow = document.createElement('div');
      glow.className = 'mcp-pointer__overlay-glow';
      overlay.appendChild(glow);
    }

    if (overlayConfig.hasGlass) {
      const glass = document.createElement('div');
      glass.className = 'mcp-pointer__overlay-glass';
      overlay.appendChild(glass);
    }

    document.body.appendChild(overlay);

    return overlay;
  }

  private positionOverlay(type: OverlayType): void {
    const wrapper = this.overlayWrappers.get(type);
    const overlay = wrapper?.overlay;
    const target = wrapper?.target;

    if (!overlay || !target) return;

    autoAssignOverlayPositionAndSize(target, overlay);
  }
}
