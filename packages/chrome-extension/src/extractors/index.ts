import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';
import logger from '../utils/logger';
import type { ComponentExtractor } from './types';
import { vueExtractor } from './vue';
import { reactExtractor } from './react';

// Order matters: Vue first (O(1) for Vue 3, fast bail for non-Vue pages).
const extractors: ComponentExtractor[] = [
  vueExtractor,
  reactExtractor,
];

export function extractComponentInfo(el: HTMLElement): ComponentInfo | undefined {
  return extractors.reduce<ComponentInfo | undefined>((found, extractor) => {
    if (found) return found;

    try {
      const info = extractor.extract(el);
      return info?.name ? info : undefined;
    } catch (err) {
      logger.error('🚨 extractor failed:', err);
      return undefined;
    }
  }, undefined);
}
