export default class OverlayManager {
  private static instance: OverlayManager;

  private selectionOverlay: HTMLDivElement | null = null;

  private hoverOverlay: HTMLDivElement | null = null;

  private selectionTargetElement: HTMLElement | null = null;

  private hoverTargetElement: HTMLElement | null = null;

  static getInstance(): OverlayManager {
    if (!OverlayManager.instance) {
      OverlayManager.instance = new OverlayManager();
    }
    return OverlayManager.instance;
  }

  createOverlay(element: HTMLElement, type: 'selection' | 'hover' = 'selection'): void {
    if (type === 'selection') {
      this.removeSelectionOverlay();
      this.createSelectionOverlay(element);
    } else {
      this.removeHoverOverlay();
      this.createHoverOverlay(element);
    }
  }

  private createSelectionOverlay(element: HTMLElement): void {
    this.selectionTargetElement = element;
    this.selectionOverlay = this.createOverlayElement('mcp-pointer__overlay');

    // Create BEM elements for selection
    const border = document.createElement('div');
    border.className = 'mcp-pointer__overlay-border';

    const siriGlow = document.createElement('div');
    siriGlow.className = 'mcp-pointer__overlay-glow';

    const insideGlass = document.createElement('div');
    insideGlass.className = 'mcp-pointer__overlay-glass';

    this.selectionOverlay.appendChild(border);
    this.selectionOverlay.appendChild(siriGlow);
    this.selectionOverlay.appendChild(insideGlass);

    this.positionAndAppendOverlay(this.selectionOverlay, element, '999999');
    window.addEventListener('resize', this.handleSelectionResize);
  }

  private createHoverOverlay(element: HTMLElement): void {
    this.hoverTargetElement = element;
    this.hoverOverlay = this.createOverlayElement('mcp-pointer__overlay mcp-pointer__overlay--hover');
    this.positionAndAppendOverlay(this.hoverOverlay, element, '999998');
    window.addEventListener('resize', this.handleHoverResize);
  }

  private createOverlayElement(className: string): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = className;
    return overlay;
  }

  private positionAndAppendOverlay(
    overlay: HTMLDivElement,
    element: HTMLElement,
    zIndex: string,
  ): void {
    const rect = element.getBoundingClientRect();
    const { scrollX, scrollY } = window;

    // Check if this is a hover overlay to apply offset
    const isHoverOverlay = overlay.className.includes('--hover');
    const offset = isHoverOverlay ? 6 : 0; // 6px offset for hover, 0 for selection

    // Apply styles in batch
    Object.assign(overlay.style, {
      position: 'absolute',
      left: `${rect.left + scrollX - offset}px`,
      top: `${rect.top + scrollY - offset}px`,
      width: `${rect.width + (offset * 2)}px`,
      height: `${rect.height + (offset * 2)}px`,
      pointerEvents: 'none',
      zIndex,
    });

    // Add shimmer duration for selection overlays
    if (overlay.className.includes('mcp-pointer__overlay') && !isHoverOverlay) {
      const area = rect.width * rect.height;
      const baseDuration = 6;
      const maxDuration = 15;
      const durationMultiplier = Math.min(Math.sqrt(area / 10000), maxDuration / baseDuration);
      const shimmerDuration = Math.max(baseDuration * durationMultiplier, baseDuration);
      overlay.style.setProperty('--shimmer-duration', shimmerDuration.toString());
    }

    document.body.appendChild(overlay);

    // Trigger transition only for hover overlays
    if (isHoverOverlay) {
      requestAnimationFrame(() => {
        overlay.classList.add('mcp-pointer__overlay--visible');
      });
    }
  }

  private handleSelectionResize = (): void => {
    if (this.selectionOverlay && this.selectionTargetElement) {
      this.positionAndAppendOverlay(this.selectionOverlay, this.selectionTargetElement, '999999');
    }
  };

  private handleHoverResize = (): void => {
    if (this.hoverOverlay && this.hoverTargetElement) {
      this.positionAndAppendOverlay(this.hoverOverlay, this.hoverTargetElement, '999998');
    }
  };

  addAnimation(): void {
    if (this.selectionOverlay) {
      this.selectionOverlay.classList.add('mcp-pointer__overlay--animated');
    }
  }

  removeAnimation(): void {
    if (this.selectionOverlay) {
      this.selectionOverlay.classList.remove('mcp-pointer__overlay--animated');
    }
  }

  fadeOutAndRemove(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.selectionOverlay) {
        resolve();
        return;
      }

      this.selectionOverlay.classList.add('mcp-pointer__overlay--fading-out');

      // Wait for fade animation to complete
      setTimeout(() => {
        this.removeOverlay();
        resolve();
      }, 600); // Match CSS transition duration
    });
  }

  removeOverlay(): void {
    this.removeSelectionOverlay();
    this.removeHoverOverlay();
  }

  removeSelectionOverlay(): void {
    if (this.selectionOverlay) {
      this.selectionOverlay.remove();
      this.selectionOverlay = null;
    }
    window.removeEventListener('resize', this.handleSelectionResize);
    this.selectionTargetElement = null;
  }

  removeHoverOverlay(): void {
    if (this.hoverOverlay) {
      this.hoverOverlay.remove();
      this.hoverOverlay = null;
    }
    window.removeEventListener('resize', this.handleHoverResize);
    this.hoverTargetElement = null;
  }

  hasOverlay(): boolean {
    return this.selectionOverlay !== null;
  }

  hasHoverOverlay(): boolean {
    return this.hoverOverlay !== null;
  }
}
