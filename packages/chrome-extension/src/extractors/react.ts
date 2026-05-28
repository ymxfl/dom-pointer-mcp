/* eslint-disable no-underscore-dangle */
import type { ComponentInfo } from '@mcp-pointer/shared/types';

export function extractReact(element: HTMLElement): ComponentInfo | undefined {
  const fiberKey = Object.keys(element).find((k) => k.startsWith('__reactFiber$')
    || k.startsWith('__reactInternalInstance$'));
  if (!fiberKey) return undefined;

  const fiber = (element as any)[fiberKey];
  const name = fiber?.type?.displayName || fiber?.type?.name;
  if (!name) return undefined;

  const info: ComponentInfo = { name, framework: 'react' };

  const debugSource = fiber?._debugSource;
  if (debugSource?.fileName) {
    const file = debugSource.fileName.split('/').pop() || debugSource.fileName;
    info.sourceFile = debugSource.lineNumber ? `${file}:${debugSource.lineNumber}` : file;
  }

  return info;
}
