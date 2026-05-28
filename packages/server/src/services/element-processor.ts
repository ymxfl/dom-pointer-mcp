import { RawPointedDOMElement, ElementPosition } from '@mcp-pointer/shared/types';
import { ProcessedPointedDOMElement } from '../types';
import { extractFromHTML, generateSelector } from '../utils/dom-extractor';
import logger from '../logger';

export default class ElementProcessor {
  processFromRaw(raw: RawPointedDOMElement): ProcessedPointedDOMElement {
    const { element, warnings } = extractFromHTML(raw.outerHTML);
    const allWarnings: string[] = [...warnings];

    const processed: ProcessedPointedDOMElement = {
      tagName: element?.tagName || 'UNKNOWN',
      id: element?.id || undefined,
      classes: element ? Array.from(element.classList.values()) : [],
      attributes: element ? this.getAttributes(element) : {},
      innerText: element?.textContent || '',
      textContent: element?.textContent || undefined,
      selector: element ? generateSelector(element) : 'unknown',

      position: this.getPosition(raw.boundingClientRect),
      url: raw.url,
      timestamp: new Date(raw.timestamp).toISOString(),

      cssComputed: raw.computedStyles ? { ...raw.computedStyles } : undefined,
      componentInfo: raw.componentInfo,

      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };

    if (processed.warnings) {
      logger.warn('Element processing warnings:', processed.warnings);
    }

    return processed;
  }

  private getAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach((attr) => {
      attrs[attr.name] = attr.value;
    });
    return attrs;
  }

  private getPosition(rect?: DOMRect): ElementPosition {
    return {
      x: rect?.x ?? 0,
      y: rect?.y ?? 0,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
    };
  }
}
