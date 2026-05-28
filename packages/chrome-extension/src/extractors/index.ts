import type { ComponentInfo } from '@mcp-pointer/shared/types';
import logger from '../utils/logger';
import { extractVue } from './vue';
import { extractReact } from './react';

// Order matters: Vue first (O(1) for Vue 3, fast bail for non-Vue pages).
const extractors: Array<(el: HTMLElement) => ComponentInfo | undefined> = [
  extractVue,
  extractReact,
];

export function extractComponentInfo(el: HTMLElement): ComponentInfo | undefined {
  for (const extractor of extractors) {
    try {
      const info = extractor(el);
      if (info?.name) return info;
    } catch (err) {
      logger.error('🚨 extractor failed:', err);
    }
  }
  return undefined;
}
