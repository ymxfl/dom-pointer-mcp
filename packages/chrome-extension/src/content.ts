// Main world script - has full access to React Fiber and can communicate with background
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

logger.info('🌍 MCP Pointer content script loaded');

class MainWorldElementPointer {
  private styleManager: ElementStyleManager;

  private lastMouseEvent: MouseEvent | null = null;

  constructor() {
    this.styleManager = ElementStyleManager.getInstance();
    this.init();
  }

  private init(): void {
    // Use capture phase (true) to intercept events before they reach target
    document.addEventListener('click', this.handleClick.bind(this), true);
    document.addEventListener('mousedown', this.handleMouseDown.bind(this), true);
    document.addEventListener('mouseover', this.handleMouseOver.bind(this), true);
    document.addEventListener('mouseout', this.handleMouseOut.bind(this), true);
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
    logger.info('👆 Element pointer initialized');
  }

  private handleClick(event: MouseEvent): void {
    if (!event.altKey) return;

    // Prevent the click event to stop navigation and button actions
    event.preventDefault();
    event.stopPropagation();

    const element = event.target as HTMLElement;
    if (!element) return;

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

  private handleMouseDown(event: MouseEvent): void {
    if (!event.altKey) return;

    // Prevent mousedown to stop link navigation and button press
    event.preventDefault();
    event.stopPropagation();
  }

  private handleMouseOver(event: MouseEvent): void {
    this.lastMouseEvent = event; // Track mouse position
    if (event.altKey) {
      const element = event.target as HTMLElement;
      if (element) {
        this.styleManager.addHoverEffect(element);
      }
    }
  }

  private handleMouseOut(event: MouseEvent): void {
    if (event.altKey) {
      const element = event.target as HTMLElement;
      if (element) {
        this.styleManager.removeHoverEffect(element);
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Alt') {
      document.body.classList.add('mcp-pointer--alt-pressed');

      // Check what element is currently under the cursor and add hover effect
      const elementUnderCursor = this.getElementUnderCursor();
      if (elementUnderCursor) {
        this.styleManager.addHoverEffect(elementUnderCursor);
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    // When Alt key is released, clean up all hover effects
    if (event.key === 'Alt') {
      document.body.classList.remove('mcp-pointer--alt-pressed');
      // Remove hover overlay
      this.styleManager.removeHoverEffect(document.body); // Pass dummy element
    }
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

// Initialize
const pointer = new MainWorldElementPointer();
// Export for potential debugging
(window as any).pointerTargeter = pointer;
