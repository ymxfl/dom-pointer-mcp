import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';

export interface ComponentExtractor {
  framework: 'react' | 'vue';
  /** 从 DOM 节点提取组件信息；不属于此框架返回 undefined */
  extract(element: HTMLElement): ComponentInfo | undefined;
}
