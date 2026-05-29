/* eslint-disable no-underscore-dangle */
import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';
import type { ComponentExtractor } from './types';

/**
 * The fiber found on a DOM node usually represents the HTML element itself
 * (fiber.type === 'div' / 'code' / etc — a string). Walk up fiber.return
 * to the nearest fiber whose type is a component (function or object with
 * displayName/name), since that's the meaningful React component for the
 * clicked element.
 */
function findComponentFiber(fiber: any): any | undefined {
  let current = fiber;
  while (current) {
    const { type } = current;
    if (type && typeof type !== 'string') {
      const name = type.displayName || type.name;
      if (name) return current;
    }
    current = current.return;
  }
  return undefined;
}

export function extractReact(element: HTMLElement): ComponentInfo | undefined {
  const fiberKey = Object.keys(element).find((k) => k.startsWith('__reactFiber$')
    || k.startsWith('__reactInternalInstance$'));
  if (!fiberKey) return undefined;

  const startFiber = (element as any)[fiberKey];
  const componentFiber = findComponentFiber(startFiber);
  if (!componentFiber) return undefined;

  const name = componentFiber.type.displayName || componentFiber.type.name;
  const info: ComponentInfo = { name, framework: 'react' };

  const debugSource = componentFiber._debugSource;
  if (debugSource?.fileName) {
    const file = debugSource.fileName.split('/').pop() || debugSource.fileName;
    info.sourceFile = debugSource.lineNumber ? `${file}:${debugSource.lineNumber}` : file;
  }

  return info;
}

export const reactExtractor: ComponentExtractor = {
  framework: 'react',
  extract: extractReact,
};
