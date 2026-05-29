import { RawPointedDOMElement } from '@dom-pointer-mcp/shared/types';
import { requestComponentInfo } from '../isolated-world/request-component-info';

export function getAllComputedStyles(element: HTMLElement): Record<string, string> {
  const computedStyle = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (let i = 0; i < computedStyle.length; i += 1) {
    const property = computedStyle[i];
    styles[property] = computedStyle.getPropertyValue(property);
  }

  return styles;
}

export async function extractRawPointedDOMElement(
  element: HTMLElement,
): Promise<RawPointedDOMElement> {
  const raw: RawPointedDOMElement = {
    outerHTML: element.outerHTML,
    url: window.location.href,
    timestamp: Date.now(),
    boundingClientRect: element.getBoundingClientRect(),
    computedStyles: getAllComputedStyles(element),
  };

  const componentInfo = await requestComponentInfo(element);
  if (componentInfo) raw.componentInfo = componentInfo;

  return raw;
}
