import {
  RawPointedDOMElement,
  RawPointedSelection,
  ElementPosition,
} from '@dom-pointer-mcp/shared/types';
import { ProcessedPointedDOMElement, ProcessedPointedSelection } from '../types';
import { extractFromHTML, generateSelector } from '../utils/dom-extractor';
import { formatLocalTimestamp } from '../utils/time';
import logger from '../logger';

export interface ProcessBatchOptions {
  selectionId?: string;
  screenshot?: ProcessedPointedSelection['screenshot'];
}

export default class ElementProcessor {
  processBatchFromRaw(
    raw: RawPointedSelection,
    options: ProcessBatchOptions = {},
  ): ProcessedPointedSelection {
    return {
      selectionId: options.selectionId,
      userNote: raw.userNote,
      url: raw.url,
      timestamp: formatLocalTimestamp(raw.timestamp),
      elements: raw.elements.map((el) => this.processSingleRaw(el)),
      screenshot: options.screenshot,
    };
  }

  private processSingleRaw(raw: RawPointedDOMElement): ProcessedPointedDOMElement {
    const { element, warnings } = extractFromHTML(raw.outerHTML);
    const allWarnings: string[] = [...warnings];

    let tagName = 'UNKNOWN';
    let id: string | undefined;
    let classes: string[] = [];
    let attributes: Record<string, string> = {};
    let innerText = '';
    let textContent: string | undefined;
    let selector = 'unknown';

    if (element) {
      try {
        tagName = element.tagName || 'UNKNOWN';
        id = element.id || undefined;
        classes = element.classList ? Array.from(element.classList.values()) : [];
        attributes = element.attributes ? this.getAttributes(element) : {};
        innerText = element.textContent || '';
        textContent = element.textContent || undefined;
        selector = raw.selector || generateSelector(element);
      } catch (err) {
        allWarnings.push(`Element extraction failed: ${(err as Error).message}`);
      }
    }

    const processed: ProcessedPointedDOMElement = {
      tagName,
      id,
      classes,
      attributes,
      innerText,
      textContent,
      selector,

      position: this.getPosition(raw.boundingClientRect),
      url: raw.url,
      timestamp: formatLocalTimestamp(raw.timestamp),

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
