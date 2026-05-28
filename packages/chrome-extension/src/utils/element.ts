import { RawPointedDOMElement } from '@mcp-pointer/shared/types';
import { extractComponentInfo } from '../extractors';

/**
 * Get all computed styles as a plain object (Record)
 * CSSStyleDeclaration doesn't serialize properly with JSON.stringify,
 * so we convert it to a plain object
 */
export function getAllComputedStyles(element: HTMLElement): Record<string, string> {
  const computedStyle = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (let i = 0; i < computedStyle.length; i += 1) {
    const property = computedStyle[i];
    styles[property] = computedStyle.getPropertyValue(property);
  }

  return styles;
}

/**
 * Extract minimal raw DOM element data for server-side processing
 */
export function extractRawPointedDOMElement(element: HTMLElement): RawPointedDOMElement {
  const raw: RawPointedDOMElement = {
    outerHTML: element.outerHTML,
    url: window.location.href,
    timestamp: Date.now(),
    boundingClientRect: element.getBoundingClientRect(),
    computedStyles: getAllComputedStyles(element),
  };

  const componentInfo = extractComponentInfo(element);
  if (componentInfo) raw.componentInfo = componentInfo;

  return raw;
}
