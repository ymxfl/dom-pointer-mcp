/* eslint-disable no-underscore-dangle */
/**
 * Vue extractor — handles Vue 3 (__vueParentComponent) and Vue 2 (__vue__).
 *
 * IRONCLAD RULE: only read `instance.type.*` (Vue 3) or `instance.$options.*` (Vue 2).
 * Never touch proxy / ctx / setupState / refs — those are Reactive Proxies and
 * accessing them triggers getters / dependency collection / side effects.
 */
import type { ComponentInfo, ComponentAncestor } from '@dom-pointer-mcp/shared/types';
import type { ComponentExtractor } from './types';

function isUserFile(filePath: string): boolean {
  if (filePath.includes('node_modules')) return false;
  return filePath.startsWith('src/') || filePath.startsWith('/');
}

function nameFromFile(filePath: string): string | undefined {
  const filename = filePath.split('/').pop();
  return filename?.replace(/\.vue$/, '') || undefined;
}

function toAncestor(name: string, filePath?: string): ComponentAncestor {
  const ancestor: ComponentAncestor = { name };
  if (filePath) {
    ancestor.sourceFile = filePath;
  }
  return ancestor;
}

function fromVue3Chain(instance: any): ComponentInfo | undefined {
  const ancestors: ComponentAncestor[] = [];
  let bestMatch: { name: string; file?: string } | undefined;
  let firstNamed: { name: string; file?: string } | undefined;
  let current = instance;

  while (current) {
    const { type } = current;
    const name = type?.name || type?.__name;
    const file = type?.__file;
    const resolvedName = name || (file ? nameFromFile(file) : undefined);

    if (resolvedName) {
      ancestors.push(toAncestor(resolvedName, file));
      if (!bestMatch && file && isUserFile(file)) {
        bestMatch = { name: resolvedName, file };
      }
      if (!firstNamed) {
        firstNamed = { name: resolvedName, file };
      }
    }
    current = current.parent;
  }

  const chosen = bestMatch || firstNamed;
  if (!chosen) return undefined;

  const info: ComponentInfo = { name: chosen.name, framework: 'vue' };
  if (chosen.file) {
    info.sourceFile = chosen.file;
  }
  if (ancestors.length > 0) {
    info.ancestors = ancestors;
  }
  return info;
}

function fromVue2Chain(instance: any): ComponentInfo | undefined {
  const ancestors: ComponentAncestor[] = [];
  let bestMatch: { name: string; file?: string } | undefined;
  let firstNamed: { name: string; file?: string } | undefined;
  let current = instance;

  while (current) {
    const options = current.$options;
    const name = options?.name || options?._componentTag;
    const file = options?.__file;
    const resolvedName = name || (file ? nameFromFile(file) : undefined);

    if (resolvedName) {
      ancestors.push(toAncestor(resolvedName, file));
      if (!bestMatch && file && isUserFile(file)) {
        bestMatch = { name: resolvedName, file };
      }
      if (!firstNamed) {
        firstNamed = { name: resolvedName, file };
      }
    }
    current = current.$parent;
  }

  const chosen = bestMatch || firstNamed;
  if (!chosen) return undefined;

  const info: ComponentInfo = { name: chosen.name, framework: 'vue' };
  if (chosen.file) {
    info.sourceFile = chosen.file;
  }
  if (ancestors.length > 0) {
    info.ancestors = ancestors;
  }
  return info;
}

export function extractVue(element: HTMLElement): ComponentInfo | undefined {
  const vue3 = (element as any).__vueParentComponent;
  if (vue3) return fromVue3Chain(vue3);

  let node: HTMLElement | null = element;
  while (node) {
    const vue2 = (node as any).__vue__;
    if (vue2) return fromVue2Chain(vue2);
    node = node.parentElement;
  }

  return undefined;
}

export const vueExtractor: ComponentExtractor = {
  framework: 'vue',
  extract: extractVue,
};
