import { OverlayType } from '../types';

interface Position {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Dimensions {
  width: number;
  height: number;
}

interface CachedPosition {
  rect: DOMRect;
  timestamp: number;
}

interface OverlayConfig {
  className: string;
  hasShimmer: boolean;
  hasBorder: boolean;
  hasGlow: boolean;
  hasGlass: boolean;
}

export default class StyleService {
  private static readonly OVERLAY_OFFSET = 6;

  private static readonly POSITION_CACHE_TTL = 16; // 1 frame

  private static instance: StyleService;

  // Performance optimization state
  private rafBatchId: number | null = null;

  private hoverSequence = 0;

  private pendingReads: Array<() => void> = [];

  private pendingWrites: Array<() => void> = [];

  private positionCache = new WeakMap<HTMLElement, CachedPosition>();

  private documentDimensions: Dimensions | null = null;

  // Observers
  private resizeObserver: ResizeObserver;

  // Internal overlay configuration
  private readonly OVERLAY_CONFIG: Record<OverlayType, OverlayConfig> = {
    [OverlayType.SELECTION]: {
      className: 'mcp-pointer__overlay',
      hasShimmer: true,
      hasBorder: true,
      hasGlow: true,
      hasGlass: true,
    },
    [OverlayType.HOVER]: {
      className: 'mcp-pointer__overlay mcp-pointer__overlay--hover',
      hasShimmer: false,
      hasBorder: false,
      hasGlow: false,
      hasGlass: false,
    },
  };

  constructor() {
    this.resizeObserver = this.createResizeObserver();
    this.initDocumentDimensions();
  }

  static getInstance(): StyleService {
    if (!StyleService.instance) {
      StyleService.instance = new StyleService();
    }
    return StyleService.instance;
  }

  // Public API - Simple and clean
  buildOverlay(type: OverlayType): HTMLDivElement {
    const config = this.OVERLAY_CONFIG[type];
    const overlay = document.createElement('div');
    overlay.className = config.className;

    // Build DOM structure based on type
    if (config.hasBorder) {
      const border = document.createElement('div');
      border.className = 'mcp-pointer__overlay-border';
      overlay.appendChild(border);
    }

    if (config.hasGlow) {
      const glow = document.createElement('div');
      glow.className = 'mcp-pointer__overlay-glow';
      overlay.appendChild(glow);
    }

    if (config.hasGlass) {
      const glass = document.createElement('div');
      glass.className = 'mcp-pointer__overlay-glass';
      overlay.appendChild(glass);
    }

    return overlay;
  }

  styleOverlay(overlay: HTMLDivElement, targetElement: HTMLElement, type: OverlayType): void {
    const isHover = type === OverlayType.HOVER;

    if (isHover) {
      // For hover overlays, use RAF to prevent forced reflows
      // Track sequence to handle race conditions with fast movements
      this.hoverSequence += 1;
      const currentSequence = this.hoverSequence;
      requestAnimationFrame(() => {
        // Only proceed if this is still the latest hover request
        if (currentSequence === this.hoverSequence) {
          this.performStyling(overlay, targetElement, type);
        } else {
          // This is stale, remove the overlay
          overlay.remove();
        }
      });
    } else {
      // Use batching for selection overlays
      this.batchRead(() => {
        const rect = this.getCachedElementRect(targetElement);
        const docDimensions = this.getCachedDocumentDimensions();
        const position = this.calculatePosition(rect, docDimensions);

        this.batchWrite(() => {
          this.applyStyles(overlay, position);
          this.setupOverlay(overlay, targetElement, type);
        });
      });
    }
  }

  updatePosition(overlay: HTMLDivElement, targetElement: HTMLElement, type: OverlayType): void {
    const isHover = type === OverlayType.HOVER;

    if (isHover) {
      // Immediate update for hover overlays
      const rect = targetElement.getBoundingClientRect();
      const docDimensions = this.getCachedDocumentDimensions();
      const position = this.calculatePosition(rect, docDimensions);
      this.applyStyles(overlay, position);
    } else {
      // Batched update for selection overlays
      this.batchRead(() => {
        const rect = this.getCachedElementRect(targetElement);
        const docDimensions = this.getCachedDocumentDimensions();
        const position = this.calculatePosition(rect, docDimensions);

        this.batchWrite(() => {
          this.applyStyles(overlay, position);
        });
      });
    }
  }

  animateIn(overlay: HTMLDivElement, type: OverlayType): void {
    if (type === OverlayType.HOVER) {
      requestAnimationFrame(() => {
        overlay.classList.add('mcp-pointer__overlay--visible');
      });
    }
  }

  animateOut(overlay: HTMLDivElement, type: OverlayType): Promise<void> {
    return new Promise((resolve) => {
      if (type === OverlayType.SELECTION) {
        overlay.classList.add('mcp-pointer__overlay--fading-out');
        setTimeout(() => {
          resolve();
        }, 600); // Match CSS transition duration
      } else {
        resolve();
      }
    });
  }

  addAnimation(overlay: HTMLDivElement): void {
    overlay.classList.add('mcp-pointer__overlay--animated');
  }

  removeAnimation(overlay: HTMLDivElement): void {
    overlay.classList.remove('mcp-pointer__overlay--animated');
  }

  invalidateCache(): void {
    this.documentDimensions = null;
    this.positionCache = new WeakMap();
  }

  destroy(): void {
    this.resizeObserver.disconnect();

    if (this.rafBatchId !== null) {
      cancelAnimationFrame(this.rafBatchId);
      this.rafBatchId = null;
    }

    this.pendingReads = [];
    this.pendingWrites = [];
    this.documentDimensions = null;
    this.positionCache = new WeakMap();
  }

  private performStyling(
    overlay: HTMLDivElement,
    targetElement: HTMLElement,
    type: OverlayType,
  ): void {
    const rect = targetElement.getBoundingClientRect();
    const docDimensions = this.getCachedDocumentDimensions();
    const position = this.calculatePosition(rect, docDimensions);

    this.applyStyles(overlay, position);
    this.setupOverlay(overlay, targetElement, type);
  }

  private setupOverlay(
    overlay: HTMLDivElement,
    targetElement: HTMLElement,
    type: OverlayType,
  ): void {
    const config = this.OVERLAY_CONFIG[type];

    // Selection overlay should allow clicks to pass through
    if (type === OverlayType.SELECTION) {
      Object.assign(overlay.style, { pointerEvents: 'none' });
    }

    // Add shimmer effect for selection overlays
    if (config.hasShimmer) {
      const rect = targetElement.getBoundingClientRect();
      this.applyShimmerEffect(overlay, rect.width * rect.height);
    }

    document.body.appendChild(overlay);
  }

  private batchRead(readFn: () => void): void {
    this.pendingReads.push(readFn);
    this.scheduleBatch();
  }

  private batchWrite(writeFn: () => void): void {
    this.pendingWrites.push(writeFn);
    this.scheduleBatch();
  }

  private scheduleBatch(): void {
    if (this.rafBatchId !== null) return;

    this.rafBatchId = requestAnimationFrame(() => {
      // Execute all reads first (DOM measurements)
      while (this.pendingReads.length > 0) {
        const readFn = this.pendingReads.shift()!;
        readFn();
      }

      // Then execute all writes (DOM modifications)
      while (this.pendingWrites.length > 0) {
        const writeFn = this.pendingWrites.shift()!;
        writeFn();
      }

      this.rafBatchId = null;
    });
  }

  private getCachedElementRect(element: HTMLElement): DOMRect {
    const now = performance.now();
    const cached = this.positionCache.get(element);

    // Use cached position if less than 16ms old (1 frame)
    if (cached && (now - cached.timestamp) < StyleService.POSITION_CACHE_TTL) {
      return cached.rect;
    }

    const rect = element.getBoundingClientRect();
    this.positionCache.set(element, { rect, timestamp: now });
    return rect;
  }

  private createResizeObserver(): ResizeObserver {
    return new ResizeObserver(() => {
      this.invalidateDocumentDimensions();
    });
  }

  private initDocumentDimensions(): void {
    this.calculateDocumentDimensions();
    this.resizeObserver.observe(document.documentElement);
  }

  private calculateDocumentDimensions(): void {
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
    this.documentDimensions = { width, height };
  }

  private invalidateDocumentDimensions(): void {
    this.documentDimensions = null;
    this.positionCache = new WeakMap();
  }

  private getCachedDocumentDimensions(): Dimensions {
    if (!this.documentDimensions) {
      this.calculateDocumentDimensions();
    }
    return this.documentDimensions!;
  }

  private calculatePosition(rect: DOMRect, docDimensions: Dimensions): Position {
    const { scrollX, scrollY } = window;
    const offset = StyleService.OVERLAY_OFFSET;
    const doubleOffset = offset * 2;

    // Calculate desired position with offset
    const desiredLeft = rect.left + scrollX - offset;
    const desiredTop = rect.top + scrollY - offset;

    // Clamp position to document boundaries
    const leftPos = Math.max(0, desiredLeft);
    const topPos = Math.max(0, desiredTop);

    // Pre-calculate differences to avoid redundant calculations
    const leftDiff = desiredLeft - leftPos;
    const topDiff = desiredTop - topPos;

    // Calculate final dimensions with optimized Math.min calls
    const width = Math.min(
      rect.width + doubleOffset + leftDiff,
      docDimensions.width - leftPos,
    );
    const height = Math.min(
      rect.height + doubleOffset + topDiff,
      docDimensions.height - topPos,
    );

    return {
      left: leftPos,
      top: topPos,
      width,
      height,
    };
  }

  private applyStyles(overlay: HTMLDivElement, position: Position): void {
    const styles: Record<string, string> = {
      position: 'absolute',
      left: `${position.left}px`,
      top: `${position.top}px`,
      width: `${position.width}px`,
      height: `${position.height}px`,
    };

    Object.assign(overlay.style, styles);
  }

  private applyShimmerEffect(overlay: HTMLDivElement, area: number): void {
    const baseDuration = 6;
    const maxDuration = 15;
    const durationMultiplier = Math.min(
      Math.sqrt(area / 10000),
      maxDuration / baseDuration,
    );
    const shimmerDuration = Math.max(baseDuration * durationMultiplier, baseDuration);
    overlay.style.setProperty('--shimmer-duration', shimmerDuration.toString());
  }
}
