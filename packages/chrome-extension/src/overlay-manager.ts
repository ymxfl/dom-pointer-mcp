export enum OverlayType {
  SELECTION = 'selection',
  HOVER = 'hover',
}

export default class OverlayManager {
  private static readonly OVERLAY_OFFSET = 6;

  private static instance: OverlayManager;

  private selectionOverlay: HTMLDivElement | null = null;

  private hoverOverlay: HTMLDivElement | null = null;

  private selectionTargetElement: HTMLElement | null = null;

  private hoverTargetElement: HTMLElement | null = null;

  private intersectionObserver: IntersectionObserver;

  private mutationObserver: MutationObserver;

  private rafId: number | null = null;

  private mutationTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.intersectionObserver = this.createIntersectionObserver();
    this.mutationObserver = this.createMutationObserver();
    this.initResizeHandler();
  }

  static getInstance(): OverlayManager {
    if (!OverlayManager.instance) {
      OverlayManager.instance = new OverlayManager();
    }
    return OverlayManager.instance;
  }

  createOverlay(element: HTMLElement, type: OverlayType = OverlayType.SELECTION): void {
    if (type === OverlayType.SELECTION) {
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
    this.intersectionObserver.observe(element);
  }

  private createHoverOverlay(element: HTMLElement): void {
    this.hoverTargetElement = element;
    this.hoverOverlay = this.createOverlayElement('mcp-pointer__overlay mcp-pointer__overlay--hover');
    this.positionAndAppendOverlay(this.hoverOverlay, element, '999998');
    this.intersectionObserver.observe(element);
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
    const isHoverOverlay = overlay.className.includes('--hover');

    const docDimensions = this.getDocumentDimensions();
    const position = this.calculateOverlayPosition(rect, docDimensions);

    this.applyOverlayStyles(overlay, position, zIndex);

    // Selection overlay should allow clicks to pass through
    if (!isHoverOverlay) {
      Object.assign(overlay.style, { pointerEvents: 'none' });
    }

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

  destroy(): void {
    this.removeOverlay();
    this.intersectionObserver.disconnect();
    this.mutationObserver.disconnect();

    // Clean up event listeners
    window.removeEventListener('resize', this.scheduleUpdate);
    window.removeEventListener('scroll', this.scheduleUpdate);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    // Clean up pending timers
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mutationTimer !== null) {
      clearTimeout(this.mutationTimer);
      this.mutationTimer = null;
    }
  }

  removeSelectionOverlay(): void {
    if (this.selectionTargetElement) {
      this.intersectionObserver.unobserve(this.selectionTargetElement);
    }
    if (this.selectionOverlay) {
      this.selectionOverlay.remove();
      this.selectionOverlay = null;
    }
    this.selectionTargetElement = null;
  }

  removeHoverOverlay(): void {
    if (this.hoverTargetElement) {
      this.intersectionObserver.unobserve(this.hoverTargetElement);
    }
    if (this.hoverOverlay) {
      this.hoverOverlay.remove();
      this.hoverOverlay = null;
    }
    this.hoverTargetElement = null;
  }

  hasOverlay(): boolean {
    return this.selectionOverlay !== null;
  }

  getHoverTargetElement(): HTMLElement | null {
    return this.hoverTargetElement;
  }

  private createIntersectionObserver(): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        // Simple binary visibility detection - element is visible or not
        threshold: [0, 1.0],
        // Moderate root margin for visibility detection
        rootMargin: '50px',
      },
    );
  }

  private initResizeHandler(): void {
    window.addEventListener('resize', this.scheduleUpdate);
    window.addEventListener('scroll', this.scheduleUpdate, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private createMutationObserver(): MutationObserver {
    const mutationObserver = new MutationObserver(() => {
      this.scheduleMutationUpdate();
    });

    // Start observing DOM changes
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return mutationObserver;
  }

  private getOverlayInfo(
    element: HTMLElement,
  ): { overlay: HTMLDivElement; isHover: boolean } | null {
    if (element === this.selectionTargetElement && this.selectionOverlay) {
      return { overlay: this.selectionOverlay, isHover: false };
    }
    if (element === this.hoverTargetElement && this.hoverOverlay) {
      return { overlay: this.hoverOverlay, isHover: true };
    }
    return null;
  }

  private scheduleUpdate = (): void => {
    // Throttle updates using RAF (max 60fps)
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.updateAllOverlays();
      this.rafId = null;
    });
  };

  private scheduleMutationUpdate = (): void => {
    // Debounce mutation updates - wait for DOM changes to settle
    if (this.mutationTimer !== null) {
      clearTimeout(this.mutationTimer);
    }
    this.mutationTimer = setTimeout(() => {
      this.updateAllOverlays();
      this.mutationTimer = null;
    }, 50); // 50ms debounce
  };

  private updateAllOverlays = (): void => {
    // Update positions for all active overlays
    if (this.selectionTargetElement) {
      this.repositionOverlay(this.selectionTargetElement);
    }
    if (this.hoverTargetElement) {
      this.repositionOverlay(this.hoverTargetElement);
    }
  };

  private repositionOverlay(element: HTMLElement): void {
    const overlayInfo = this.getOverlayInfo(element);
    if (!overlayInfo) return;

    const rect = element.getBoundingClientRect();

    const docDimensions = this.getDocumentDimensions();
    const position = this.calculateOverlayPosition(rect, docDimensions);

    this.applyOverlayStyles(overlayInfo.overlay, position);
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      const element = entry.target as HTMLElement;

      if (entry.isIntersecting) {
        // Element is visible, show overlay
        this.showOverlayForElement(element);
      } else {
        // Element is not visible, hide overlay completely
        this.hideOverlayForElement(element);
      }
    });
  }

  private showOverlayForElement(element: HTMLElement): void {
    const overlayInfo = this.getOverlayInfo(element);
    if (overlayInfo) {
      overlayInfo.overlay.style.opacity = '1';
      overlayInfo.overlay.style.transition = 'opacity 0.2s ease-in-out';
    }
  }

  private getDocumentDimensions(): { width: number; height: number } {
    const width = Math.max(
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth,
    );
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight,
    );
    return { width, height };
  }

  private calculateOverlayPosition(
    rect: DOMRect,
    docDimensions: { width: number; height: number },
  ): { left: number; top: number; width: number; height: number } {
    const { scrollX, scrollY } = window;
    const offset = OverlayManager.OVERLAY_OFFSET;

    // Calculate desired position with offset
    const desiredLeft = rect.left + scrollX - offset;
    const desiredTop = rect.top + scrollY - offset;

    // Clamp position to document boundaries
    const leftPos = Math.max(0, desiredLeft);
    const topPos = Math.max(0, desiredTop);

    // Calculate max width/height to stay within document
    const maxWidth = docDimensions.width - leftPos;
    const maxHeight = docDimensions.height - topPos;

    // Adjust dimensions based on clamping
    const leftDiff = desiredLeft - leftPos;
    const topDiff = desiredTop - topPos;
    const desiredWidth = rect.width + (offset * 2) + leftDiff;
    const desiredHeight = rect.height + (offset * 2) + topDiff;

    // Apply max constraints
    const width = Math.min(desiredWidth, maxWidth);
    const height = Math.min(desiredHeight, maxHeight);

    return {
      left: leftPos,
      top: topPos,
      width,
      height,
    };
  }

  private applyOverlayStyles(
    overlay: HTMLDivElement,
    position: { left: number; top: number; width: number; height: number },
    zIndex?: string,
  ): void {
    const styles: Record<string, string> = {
      position: 'absolute',
      left: `${position.left}px`,
      top: `${position.top}px`,
      width: `${position.width}px`,
      height: `${position.height}px`,
    };

    if (zIndex) styles.zIndex = zIndex;

    Object.assign(overlay.style, styles);
  }

  private hideOverlayForElement(element: HTMLElement): void {
    const overlayInfo = this.getOverlayInfo(element);
    if (overlayInfo) {
      overlayInfo.overlay.style.opacity = '0';
      overlayInfo.overlay.style.transition = 'opacity 0.2s ease-in-out';
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // Page is hidden (tab switched, minimized, etc.), remove hover overlay
      this.removeHoverOverlay();
    }
  };
}
