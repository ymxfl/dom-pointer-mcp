import StyleService from './style-service';
import { OverlayType } from '../types';

interface OverlayData {
  element: HTMLDivElement | null;
  targetElement: HTMLElement | null;
}

export default class OverlayService {
  private static instance: OverlayService;

  private overlays = new Map<OverlayType, OverlayData>();

  private styleService: StyleService;

  // Observers for overlay updates
  private intersectionObserver: IntersectionObserver;

  private mutationObserver: MutationObserver;

  // Update scheduling
  private rafId: number | null = null;

  private mutationTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.styleService = StyleService.getInstance();
    this.intersectionObserver = this.createIntersectionObserver();
    this.mutationObserver = this.createMutationObserver();
    this.initEventListeners();
    this.initOverlayMap();
    this.initNavigationObserver();
  }

  static getInstance(): OverlayService {
    if (!OverlayService.instance) {
      OverlayService.instance = new OverlayService();
    }
    return OverlayService.instance;
  }

  // Public API - Simple and clean
  create(element: HTMLElement, type: OverlayType): HTMLDivElement {
    // Remove existing overlay of this type
    this.remove(type);

    // Create new overlay
    const overlay = this.styleService.buildOverlay(type);

    // Store in map
    this.overlays.set(type, {
      element: overlay,
      targetElement: element,
    });

    // Style and position the overlay
    this.styleService.styleOverlay(overlay, element, type);

    // Setup intersection observation
    this.intersectionObserver.observe(element);

    // Trigger animation
    this.styleService.animateIn(overlay, type);

    return overlay;
  }

  remove(type: OverlayType): void {
    const overlayData = this.overlays.get(type);
    if (!overlayData) return;

    // Clean up intersection observer
    if (overlayData.targetElement) {
      this.intersectionObserver.unobserve(overlayData.targetElement);
    }

    // Remove DOM element
    if (overlayData.element) {
      overlayData.element.remove();
    }

    // Clear from map
    this.overlays.set(type, {
      element: null,
      targetElement: null,
    });
  }

  removeAll(): void {
    Object.values(OverlayType).forEach((type) => {
      this.remove(type as OverlayType);
    });
  }

  get(type: OverlayType): HTMLDivElement | null {
    return this.overlays.get(type)?.element || null;
  }

  getTarget(type: OverlayType): HTMLElement | null {
    return this.overlays.get(type)?.targetElement || null;
  }

  exists(type: OverlayType): boolean {
    const overlayData = this.overlays.get(type);
    return !!(overlayData?.element && overlayData?.targetElement);
  }

  // Animation methods
  addAnimation(type: OverlayType): void {
    const overlay = this.get(type);
    if (overlay) {
      this.styleService.addAnimation(overlay);
    }
  }

  removeAnimation(type: OverlayType): void {
    const overlay = this.get(type);
    if (overlay) {
      this.styleService.removeAnimation(overlay);
    }
  }

  async fadeOutAndRemove(type: OverlayType): Promise<void> {
    const overlay = this.get(type);
    if (overlay) {
      await this.styleService.animateOut(overlay, type);
      this.remove(type);
    }
  }

  destroy(): void {
    this.removeAll();
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

    this.styleService.destroy();
  }

  // Private methods
  private initOverlayMap(): void {
    // Initialize map with null values
    Object.values(OverlayType).forEach((type) => {
      this.overlays.set(type as OverlayType, {
        element: null,
        targetElement: null,
      });
    });
  }

  private initEventListeners(): void {
    window.addEventListener('resize', this.scheduleUpdate);
    window.addEventListener('scroll', this.scheduleUpdate, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private initNavigationObserver(): void {
    // Listen for URL changes (handles SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.handleNavigation();
      }
    }).observe(document, { subtree: true, childList: true });

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => this.handleNavigation());
  }

  private handleNavigation(): void {
    // Clean all overlays on navigation
    this.removeAll();
  }

  private createIntersectionObserver(): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        // Single threshold for better performance
        threshold: 0,
        // Moderate root margin for visibility detection
        rootMargin: '50px',
      },
    );
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

  private scheduleUpdate = (): void => {
    // Throttle updates using RAF (max 60fps)
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.updateAllOverlays();
      this.rafId = null;
    });
  };

  private scheduleMutationUpdate = (): void => {
    // Debounce mutation updates - increased to 100ms for better performance
    if (this.mutationTimer !== null) {
      clearTimeout(this.mutationTimer);
    }
    this.mutationTimer = setTimeout(() => {
      this.styleService.invalidateCache();
      this.updateAllOverlays();
      this.mutationTimer = null;
    }, 100); // 100ms debounce
  };

  private updateAllOverlays = (): void => {
    // Update positions for all active overlays
    this.overlays.forEach((overlayData, type) => {
      if (overlayData.element && overlayData.targetElement) {
        this.styleService.updatePosition(overlayData.element, overlayData.targetElement, type);
      }
    });
  };

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      const element = entry.target as HTMLElement;

      // Find which overlay this element belongs to
      this.overlays.forEach((overlayData) => {
        if (overlayData.targetElement === element && overlayData.element) {
          if (entry.isIntersecting) {
            // Element is visible, show overlay
            this.showOverlay(overlayData.element);
          } else {
            // Element is not visible, hide overlay
            this.hideOverlay(overlayData.element);
          }
        }
      });
    });
  }

  private showOverlay(overlay: HTMLDivElement): void {
    const element = overlay;
    element.style.opacity = '1';
    element.style.transition = 'opacity 0.2s ease-in-out';
  }

  private hideOverlay(overlay: HTMLDivElement): void {
    const element = overlay;
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.2s ease-in-out';
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // Page is hidden (tab switched, minimized, etc.), remove hover overlay
      this.remove(OverlayType.HOVER);
    }
  };
}

export { OverlayType };
