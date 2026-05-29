/* eslint-disable no-underscore-dangle */
/**
 * Vue extractor — handles Vue 3 (__vueParentComponent) and Vue 2 (__vue__).
 *
 * IRONCLAD RULE: only read `instance.type.*` (Vue 3) or `instance.$options.*` (Vue 2).
 * Never touch proxy / ctx / setupState / refs — those are Reactive Proxies and
 * accessing them triggers getters / dependency collection / side effects.
 */
import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';
import type { ComponentExtractor } from './types';

function fromVue3(instance: any): ComponentInfo | undefined {
  const type = instance?.type;
  const name = type?.name || type?.__name;
  if (!name) return undefined;

  const info: ComponentInfo = { name, framework: 'vue' };
  if (type.__file) {
    info.sourceFile = type.__file.split('/').pop() || type.__file;
  }
  return info;
}

function fromVue2(instance: any): ComponentInfo | undefined {
  const options = instance?.$options;
  const name = options?.name || options?._componentTag;
  if (!name) return undefined;

  const info: ComponentInfo = { name, framework: 'vue' };
  if (options.__file) {
    info.sourceFile = options.__file.split('/').pop() || options.__file;
  }
  return info;
}

export function extractVue(element: HTMLElement): ComponentInfo | undefined {
  const vue3 = (element as any).__vueParentComponent;
  if (vue3) return fromVue3(vue3);

  let node: HTMLElement | null = element;
  while (node) {
    const vue2 = (node as any).__vue__;
    if (vue2) return fromVue2(vue2);
    node = node.parentElement;
  }

  return undefined;
}

export const vueExtractor: ComponentExtractor = {
  framework: 'vue',
  extract: extractVue,
};
