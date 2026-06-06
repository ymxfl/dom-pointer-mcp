import { RawPointedDOMElement } from '@dom-pointer-mcp/shared/types';
import { requestComponentInfo } from '../isolated-world/request-component-info';

function escapeIdentifier(value: string): string {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildElementSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${escapeIdentifier(element.id)}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current instanceof HTMLElement && current !== document.body) {
    const node = current;
    let segment = node.tagName.toLowerCase();
    const stableAttr = ['data-testid', 'data-test', 'data-cy', 'name', 'aria-label']
      .find((attr) => node.hasAttribute(attr));

    if (node.id) {
      segment += `#${escapeIdentifier(node.id)}`;
      path.unshift(segment);
      break;
    }

    if (stableAttr) {
      const value = node.getAttribute(stableAttr);
      if (value) {
        segment += `[${stableAttr}="${escapeAttributeValue(value)}"]`;
      }
    } else {
      const classes = Array.from(node.classList).slice(0, 3);
      if (classes.length > 0) {
        segment += `.${classes.map(escapeIdentifier).join('.')}`;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children)
          .filter((child) => child.tagName === node.tagName);
        if (siblings.length > 1) {
          segment += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
    }

    path.unshift(segment);
    current = current.parentElement;
  }

  return path.join(' > ');
}

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
    selector: buildElementSelector(element),
    boundingClientRect: element.getBoundingClientRect(),
    computedStyles: getAllComputedStyles(element),
  };

  const componentInfo = await requestComponentInfo(element);
  if (componentInfo) raw.componentInfo = componentInfo;

  return raw;
}
