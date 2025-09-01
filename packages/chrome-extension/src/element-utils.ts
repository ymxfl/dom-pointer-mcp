// Disable ESLint rule for underscore dangle usage in this file (React internals)
/* eslint-disable no-underscore-dangle */

import logger from './logger';

export interface ReactSourceInfo {
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface ComponentInfo {
  name: string;
  sourceFile?: string;
  framework: string;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CSSProperties {
  display: string;
  position: string;
  fontSize: string;
  color: string;
  backgroundColor: string;
}

/**
 * Get source file information from a DOM element's React component
 */
export function getSourceFromElement(element: HTMLElement): ReactSourceInfo | null {
  // Find React Fiber key
  const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$')
    || key.startsWith('__reactInternalInstance$'));

  if (!fiberKey) return null;

  const fiber = (element as any)[fiberKey];
  if (!fiber) return null;

  // Walk up fiber tree to find component fiber (skip DOM fibers)
  let componentFiber = fiber;
  while (componentFiber && typeof componentFiber.type === 'string') {
    componentFiber = componentFiber.return;
  }

  if (!componentFiber) return null;

  // Try multiple source locations (React version differences)
  // React 18: _debugSource
  if (componentFiber._debugSource) {
    return {
      fileName: componentFiber._debugSource.fileName,
      lineNumber: componentFiber._debugSource.lineNumber,
      columnNumber: componentFiber._debugSource.columnNumber,
    };
  }

  // React 19: _debugInfo (often null)
  if (componentFiber._debugInfo) {
    return componentFiber._debugInfo;
  }

  // Babel plugin: __source on element type
  if (componentFiber.elementType?.__source) {
    return {
      fileName: componentFiber.elementType.__source.fileName,
      lineNumber: componentFiber.elementType.__source.lineNumber,
      columnNumber: componentFiber.elementType.__source.columnNumber,
    };
  }

  // Alternative: _owner chain
  if (componentFiber._debugOwner?._debugSource) {
    return {
      fileName: componentFiber._debugOwner._debugSource.fileName,
      lineNumber: componentFiber._debugOwner._debugSource.lineNumber,
      columnNumber: componentFiber._debugOwner._debugSource.columnNumber,
    };
  }

  // Check pendingProps for __source
  if (componentFiber.pendingProps?.__source) {
    return {
      fileName: componentFiber.pendingProps.__source.fileName,
      lineNumber: componentFiber.pendingProps.__source.lineNumber,
      columnNumber: componentFiber.pendingProps.__source.columnNumber,
    };
  }

  return null;
}

/**
 * Extract React Fiber information from an element
 */
export function getReactFiberInfo(element: HTMLElement): ComponentInfo | undefined {
  try {
    // Use comprehensive source detection
    const sourceInfo = getSourceFromElement(element);

    // Also get component name
    const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$')
      || key.startsWith('__reactInternalInstance$'));

    if (fiberKey) {
      const fiber = (element as any)[fiberKey];
      if (fiber) {
        // Find component fiber
        let componentFiber = fiber;
        while (componentFiber && typeof componentFiber.type === 'string') {
          componentFiber = componentFiber.return;
        }

        if (componentFiber && componentFiber.type && typeof componentFiber.type === 'function') {
          const componentName = componentFiber.type.displayName
                               || componentFiber.type.name
                               || 'Unknown';

          let sourceFile: string | undefined;
          if (sourceInfo) {
            const fileName = sourceInfo.fileName.split('/').pop() || sourceInfo.fileName;
            sourceFile = sourceInfo.lineNumber
              ? `${fileName}:${sourceInfo.lineNumber}`
              : fileName;
          }

          const result = {
            name: componentName,
            sourceFile,
            framework: 'react' as const,
          };

          logger.debug('🧬 Found React Fiber info:', result);
          return result;
        }
      }
    }

    return undefined;
  } catch (error) {
    logger.error('🚨 Error extracting Fiber info:', error);
    return undefined;
  }
}

/**
 * Extract all attributes from an HTML element
 */
export function getElementAttributes(element: HTMLElement): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i += 1) {
    const attr = element.attributes[i];
    attributes[attr.name] = attr.value;
  }
  return attributes;
}

/**
 * Generate a CSS selector for an element
 */
export function generateSelector(element: HTMLElement): string {
  let selector = element.tagName.toLowerCase();
  if (element.id) selector += `#${element.id}`;
  if (element.className) {
    const classNameStr = typeof element.className === 'string'
      ? element.className
      : (element.className as any).baseVal || '';
    const classes = classNameStr.split(' ').filter((c: string) => c.trim());
    if (classes.length > 0) selector += `.${classes.join('.')}`;
  }
  return selector;
}

/**
 * Get element position relative to the page
 */
export function getElementPosition(element: HTMLElement): ElementPosition {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Extract relevant CSS properties from an element
 */
export function getElementCSSProperties(element: HTMLElement): CSSProperties {
  const computedStyle = window.getComputedStyle(element);
  return {
    display: computedStyle.display,
    position: computedStyle.position,
    fontSize: computedStyle.fontSize,
    color: computedStyle.color,
    backgroundColor: computedStyle.backgroundColor,
  };
}

/**
 * Extract CSS classes from an element as an array
 */
export function getElementClasses(element: HTMLElement): string[] {
  if (!element.className) return [];
  const classNameStr = typeof element.className === 'string'
    ? element.className
    : (element.className as any).baseVal || '';
  return classNameStr.split(' ').filter((c: string) => c.trim());
}
