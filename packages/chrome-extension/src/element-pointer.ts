import ElementStyleManager from './styles';
import {
  getReactFiberInfo,
  getElementAttributes,
  generateSelector,
  getElementPosition,
  getElementCSSProperties,
  getElementClasses,
} from './element-utils';
import type { TargetedElement } from './types';
import logger from './logger';

export default class ElementPointer {
  private styleManager: ElementStyleManager;

  private lastMouseEvent: MouseEvent | null = null;

  private boundHandleMouseOver: (event: MouseEvent) => void;

  private boundHandleMouseOut: (event: MouseEvent) => void;

  constructor() {
    this.styleManager = ElementStyleManager.getInstance();

    // Bind mouse event handlers once for consistent reference
    this.boundHandleMouseOver = this.handleMouseOver.bind(this);
    this.boundHandleMouseOut = this.handleMouseOut.bind(this);

    this.init();
  }

  private init(): void {
    // High-priority window listener to intercept Alt+clicks FIRST
    window.addEventListener('click', this.handleWindowClick.bind(this), true);

    // Always track mouse position for cursor detection
    document.addEventListener('mousemove', this.trackMousePosition.bind(this), true);

    // Only keyboard listeners are always active
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);

    logger.info('👆 Element pointer initialized');
  }

  private handleWindowClick(event: MouseEvent): void {
    if (!this.isOnlyTriggerKeyRelated(event)) return;

    // Stop the event from reaching any other handlers
    event.stopImmediatePropagation();
    event.preventDefault();

    // Call our Alt+click logic
    this.handleAltClick();
  }

  private handleAltClick(): void {
    console.log('Alt+click detected');
    const element = this.getElementUnderCursor();

    // Use the hovered element if available, fallback to event target
    // const element = this.styleManager.getHoveredElement() as HTMLElement;
    // if (!element) return;

    console.log('element', element);

    logger.info('🎯 Option+click detected on:', element);

    // Check if clicking on the same already selected element
    const currentlySelected = this.styleManager.getSelectedElement();
    if (currentlySelected === element) {
      logger.info('🔄 Deselecting same element:', element);
      this.styleManager.clearHighlight();
      return;
    }

    this.styleManager.highlightElement(element);
    const targetedElement = this.extractElementData(element);
    this.sendToBackground(targetedElement);
  }

  private handleMouseOver(event: MouseEvent): void {
    if (this.isOnlyTriggerKeyRelated(event)) {
      const element = event.target as HTMLElement;
      if (element) {
        this.styleManager.addHoverEffect(element);
      }
    }
  }

  private handleMouseOut(event: MouseEvent): void {
    if (this.isOnlyTriggerKeyRelated(event)) {
      const element = event.target as HTMLElement;
      if (element) {
        this.styleManager.removeHoverEffect();
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isOnlyTriggerKeyRelated(event)) {
      document.body.classList.add('mcp-pointer--trigger-key-pressed');
      this.attachMouseListeners();

      // Check what element is currently under the cursor and add hover effect
      const elementUnderCursor = this.getElementUnderCursor();
      if (elementUnderCursor) {
        this.styleManager.addHoverEffect(elementUnderCursor);
      }
    } else if (this.isTriggerKeyRelated(event) && document.body.classList.contains('mcp-pointer--trigger-key-pressed')) {
      document.body.classList.remove('mcp-pointer--trigger-key-pressed');
      this.styleManager.removeHoverEffect();
      this.removeMouseListeners();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (this.isTriggerKeyRelated(event)) {
      document.body.classList.remove('mcp-pointer--trigger-key-pressed');
      this.removeMouseListeners();
      this.styleManager.removeHoverEffect();
    }
  }

  private attachMouseListeners(): void {
    document.addEventListener('mouseover', this.boundHandleMouseOver, true);
    document.addEventListener('mouseout', this.boundHandleMouseOut, true);
  }

  private removeMouseListeners(): void {
    document.removeEventListener('mouseover', this.boundHandleMouseOver, true);
    document.removeEventListener('mouseout', this.boundHandleMouseOut, true);
  }

  private trackMousePosition(event: MouseEvent): void {
    this.lastMouseEvent = event;
  }

  private isTriggerKeyRelated(event: MouseEvent | KeyboardEvent): boolean {
    if (event instanceof KeyboardEvent) {
      return event.altKey || event.key === 'Alt';
    }

    return event.altKey;
  }

  private isOnlyTriggerKeyRelated(event: MouseEvent | KeyboardEvent): boolean {
    return this.isTriggerKeyRelated(event) && !event.ctrlKey
           && !event.shiftKey && !event.metaKey;
  }

  private getElementUnderCursor(): HTMLElement | null {
    // Get cursor position from last mouse event
    const mouseEvent = this.lastMouseEvent;
    if (mouseEvent) {
      return document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY) as HTMLElement;
    }
    return null;
  }

  private extractElementData(element: HTMLElement): TargetedElement {
    return {
      selector: generateSelector(element),
      tagName: element.tagName,
      id: element.id || undefined,
      classes: getElementClasses(element),
      innerText: element.innerText || element.textContent || '',
      attributes: getElementAttributes(element),
      position: getElementPosition(element),
      cssProperties: getElementCSSProperties(element),
      componentInfo: getReactFiberInfo(element),
      timestamp: Date.now(),
      url: window.location.href,
    };
  }

  private sendToBackground(element: TargetedElement): void {
    logger.debug('📤 Sending element to background:', element);

    // Send via window messaging (main world can't access chrome.runtime directly)
    window.postMessage({
      type: 'MCP_POINTER_ELEMENT_SELECTED',
      data: element,
    }, '*');
  }
}
