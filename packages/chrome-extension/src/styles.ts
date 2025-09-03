import OverlayManager, { OverlayType } from './overlay-manager';

export default class ElementStyleManager {
  private static instance: ElementStyleManager;

  private overlayManager: OverlayManager;

  private selectedElement: HTMLElement | null = null;

  constructor() {
    this.overlayManager = OverlayManager.getInstance();
  }

  static getInstance(): ElementStyleManager {
    if (!ElementStyleManager.instance) {
      ElementStyleManager.instance = new ElementStyleManager();
    }
    return ElementStyleManager.instance;
  }

  highlightElement(element: HTMLElement): void {
    this.clearHighlight();
    // Remove any lingering hover effect from the element being selected
    element.classList.remove('mcp-pointer__hover');
    this.selectedElement = element;
    this.overlayManager.createOverlay(element);
  }

  addHoverEffect(element: HTMLElement): void {
    if (element === this.selectedElement) return;
    // Always remove existing hover overlay first, then create new one
    this.overlayManager.removeHoverOverlay();
    this.overlayManager.createOverlay(element, OverlayType.HOVER);
  }

  removeHoverEffect(): void {
    this.overlayManager.removeHoverOverlay();
  }

  clearHighlight(): void {
    this.overlayManager.removeOverlay();
    this.selectedElement = null;
  }

  addAnimation(): void {
    this.overlayManager.addAnimation();
  }

  removeAnimation(): void {
    this.overlayManager.removeAnimation();
  }

  getSelectedElement(): HTMLElement | null {
    return this.selectedElement;
  }

  getHoveredElement(): HTMLElement | null {
    return this.overlayManager.getHoverTargetElement();
  }

  fadeOutAndRemove(): Promise<void> {
    const promise = this.overlayManager.fadeOutAndRemove();
    this.selectedElement = null;
    return promise;
  }
}
