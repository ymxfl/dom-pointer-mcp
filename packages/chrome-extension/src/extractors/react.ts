/* eslint-disable no-underscore-dangle */
import type { ComponentInfo, ComponentAncestor } from '@dom-pointer-mcp/shared/types';
import type { ComponentExtractor } from './types';

function getSourceFile(fiber: any): string | undefined {
  const debugSource = fiber._debugSource;
  if (!debugSource?.fileName) return undefined;
  return debugSource.lineNumber
    ? `${debugSource.fileName}:${debugSource.lineNumber}`
    : debugSource.fileName;
}

export function extractReact(element: HTMLElement): ComponentInfo | undefined {
  const fiberKey = Object.keys(element).find((k) => k.startsWith('__reactFiber$')
    || k.startsWith('__reactInternalInstance$'));
  if (!fiberKey) return undefined;

  const startFiber = (element as any)[fiberKey];
  const ancestors: ComponentAncestor[] = [];
  let current = startFiber;

  while (current) {
    const { type } = current;
    if (type && typeof type !== 'string') {
      const name = type.displayName || type.name;
      if (name) {
        const sourceFile = getSourceFile(current);
        const ancestor: ComponentAncestor = { name };
        if (sourceFile) ancestor.sourceFile = sourceFile;
        ancestors.push(ancestor);
      }
    }
    current = current.return;
  }

  if (ancestors.length === 0) return undefined;

  const first = ancestors[0];
  const info: ComponentInfo = { name: first.name, framework: 'react' };
  if (first.sourceFile) info.sourceFile = first.sourceFile;
  if (ancestors.length > 0) info.ancestors = ancestors;
  return info;
}

export const reactExtractor: ComponentExtractor = {
  framework: 'react',
  extract: extractReact,
};
