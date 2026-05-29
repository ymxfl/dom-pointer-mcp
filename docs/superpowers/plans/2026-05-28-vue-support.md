# Vue 组件探测支持 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持 Vue 2/3 组件探测，并把现有 React 探测从 server 端 Fiber 序列化迁移到浏览器端 plain-object 提取，消除 JSON.stringify 循环引用隐患。

**Architecture:** 在 chrome-extension 新增 `extractors/` 模块，每个框架一个 extractor 文件，统一接口；编排器在 DOM 元素上按序尝试，第一个有 `name` 命中即返回。`RawPointedDOMElement.reactFiber` 字段移除，新增 `componentInfo` 字段；server `element-processor` 改为纯透传。

**Tech Stack:** TypeScript + esbuild（chrome-extension）、jest + ts-jest（server，已有；chrome-extension 本次新增）、pnpm workspace。

参考 spec: `docs/superpowers/specs/2026-05-28-vue-support-design.md`

---

## File Structure 概览

**chrome-extension（新增）**:
- `src/extractors/types.ts` — `ComponentExtractor` 接口（4 行）
- `src/extractors/react.ts` — React Fiber 提取（~30 行）
- `src/extractors/vue.ts` — Vue 2/3 提取，含回溯（~50 行）
- `src/extractors/index.ts` — 编排器，try/catch、按序调用（~20 行）
- `src/extractors/__tests__/react.test.ts` — 5 例
- `src/extractors/__tests__/vue.test.ts` — 8 例
- `src/extractors/__tests__/index.test.ts` — 3 例
- `jest.config.js` — chrome-extension 包 jest 配置（新增）

**chrome-extension（修改）**:
- `src/utils/element.ts` — 删 `getRawReactFiber`，调用 `extractComponentInfo`
- `package.json` — 加 `test` script + jest devDeps

**shared（修改）**:
- `src/types.ts` — `RawPointedDOMElement` 删 `reactFiber`，加 `componentInfo`

**server（修改）**:
- `src/services/element-processor.ts` — 删 `safeGet`/`getComponentInfo`，改透传
- `src/__tests__/services/element-processor.test.ts` — 新增，4 例

**文档（修改）**:
- `README.md` — Vue 移到 Supported；说明同版本约束

---

## Task 1: chrome-extension 增加 jest 测试基础设施

**Why first:** 后续所有 extractor 任务的 TDD 都依赖测试能跑起来。

**Files:**
- Create: `packages/chrome-extension/jest.config.js`
- Modify: `packages/chrome-extension/package.json`
- Create: `packages/chrome-extension/src/extractors/__tests__/smoke.test.ts`（用完即删）

- [ ] **Step 1: 创建 jest.config.js**

复制 server 的配置，调整 moduleNameMapper 指向 shared 的路径：

```js
// packages/chrome-extension/jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        target: 'es2020',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        strict: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@dom-pointer-mcp/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
};
```

注意：用 `jsdom` 环境而不是 `node`——extractor 测试需要 `HTMLElement` 类型。

- [ ] **Step 2: 在 package.json 加 test script 和 devDeps**

修改 `packages/chrome-extension/package.json`，在 `scripts` 加：

```json
"test": "jest"
```

在 `devDependencies` 加（jest-environment-jsdom 必须显式装，jest 30 不再 bundle）：

```json
"@types/jest": "^30.0.0",
"jest": "^30.1.3",
"jest-environment-jsdom": "^30.1.3",
"ts-jest": "^29.4.1"
```

- [ ] **Step 3: 安装依赖**

Run: `cd packages/chrome-extension && pnpm install`
Expected: 无报错；`node_modules/.bin/jest` 存在

- [ ] **Step 4: 写 smoke test 验证 jest 能跑**

```ts
// packages/chrome-extension/src/extractors/__tests__/smoke.test.ts
describe('jest infra smoke', () => {
  it('runs and has jsdom HTMLElement', () => {
    const div = document.createElement('div');
    expect(div).toBeInstanceOf(HTMLElement);
  });
});
```

- [ ] **Step 5: 运行 smoke test**

Run: `cd packages/chrome-extension && pnpm test`
Expected: PASS, 1 test passed

- [ ] **Step 6: 在 monorepo 根 test script 里加上 chrome-extension**

修改 `package.json` 根 `scripts.test`：

```json
"test": "pnpm -r --filter='./packages/*' run test --if-present"
```

Run: `pnpm test`
Expected: server 和 chrome-extension 的测试都被执行；smoke 通过

- [ ] **Step 7: 删除 smoke test**

```bash
rm packages/chrome-extension/src/extractors/__tests__/smoke.test.ts
```

- [ ] **Step 8: 提交**

```bash
git add packages/chrome-extension/jest.config.js packages/chrome-extension/package.json package.json pnpm-lock.yaml
git commit -m "test: add jest infra to chrome-extension package"
```

---

## Task 2: 定义 ComponentExtractor 接口

**Files:**
- Create: `packages/chrome-extension/src/extractors/types.ts`

- [ ] **Step 1: 写接口文件**

```ts
// packages/chrome-extension/src/extractors/types.ts
import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';

export interface ComponentExtractor {
  framework: 'react' | 'vue';
  /** 从 DOM 节点提取组件信息；不属于此框架返回 undefined */
  extract(element: HTMLElement): ComponentInfo | undefined;
}
```

- [ ] **Step 2: 验证 typecheck**

Run: `cd packages/chrome-extension && pnpm typecheck`
Expected: 无错误（注意 chrome-extension 的 typecheck 只检查 src/*.ts 顶层，新增子目录不影响）

- [ ] **Step 3: 提交**

```bash
git add packages/chrome-extension/src/extractors/types.ts
git commit -m "feat: add ComponentExtractor interface"
```

---

## Task 3: React extractor（TDD）

**Files:**
- Create: `packages/chrome-extension/src/extractors/__tests__/react.test.ts`
- Create: `packages/chrome-extension/src/extractors/react.ts`

- [ ] **Step 1: 写 5 个失败的测试**

```ts
// packages/chrome-extension/src/extractors/__tests__/react.test.ts
import { extractReact } from '../react';

function makeElementWithFiber(fiber: any, key = '__reactFiber$abc123'): HTMLElement {
  const el = document.createElement('div');
  (el as any)[key] = fiber;
  return el;
}

describe('extractReact', () => {
  it('returns undefined when element has no __reactFiber$* property', () => {
    const el = document.createElement('div');
    expect(extractReact(el)).toBeUndefined();
  });

  it('uses displayName when present', () => {
    const fiber = { type: { displayName: 'MyButton' } };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toEqual({ name: 'MyButton', framework: 'react' });
  });

  it('falls back to type.name when displayName missing', () => {
    const fiber = { type: { name: 'NamedFn' } };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toEqual({ name: 'NamedFn', framework: 'react' });
  });

  it('includes sourceFile with line number from _debugSource', () => {
    const fiber = {
      type: { displayName: 'MyComp' },
      _debugSource: { fileName: '/src/components/MyComp.tsx', lineNumber: 42 },
    };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toEqual({
      name: 'MyComp',
      framework: 'react',
      sourceFile: 'MyComp.tsx:42',
    });
  });

  it('omits sourceFile when _debugSource absent (React 19)', () => {
    const fiber = { type: { displayName: 'MyComp' } };
    const el = makeElementWithFiber(fiber);
    const result = extractReact(el);
    expect(result?.name).toBe('MyComp');
    expect(result?.sourceFile).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败**

Run: `cd packages/chrome-extension && pnpm test -- react.test`
Expected: 5 tests failed, "Cannot find module '../react'"

- [ ] **Step 3: 写实现**

```ts
// packages/chrome-extension/src/extractors/react.ts
/* eslint-disable no-underscore-dangle */
import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';

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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/chrome-extension && pnpm test -- react.test`
Expected: 5 tests passed

- [ ] **Step 5: 提交**

```bash
git add packages/chrome-extension/src/extractors/react.ts packages/chrome-extension/src/extractors/__tests__/react.test.ts
git commit -m "feat: add React component extractor"
```

---

## Task 4: Vue extractor（TDD）

**Files:**
- Create: `packages/chrome-extension/src/extractors/__tests__/vue.test.ts`
- Create: `packages/chrome-extension/src/extractors/vue.ts`

- [ ] **Step 1: 写 8 个失败的测试**

```ts
// packages/chrome-extension/src/extractors/__tests__/vue.test.ts
import { extractVue } from '../vue';

function makeElementWithVue3(type: any): HTMLElement {
  const el = document.createElement('div');
  (el as any).__vueParentComponent = { type };
  return el;
}

function makeElementWithVue2(options: any): HTMLElement {
  const el = document.createElement('div');
  (el as any).__vue__ = { $options: options };
  return el;
}

describe('extractVue', () => {
  describe('Vue 3', () => {
    it('uses type.name when present', () => {
      const el = makeElementWithVue3({ name: 'MyVue3' });
      expect(extractVue(el)).toEqual({ name: 'MyVue3', framework: 'vue' });
    });

    it('falls back to type.__name (script setup)', () => {
      const el = makeElementWithVue3({ __name: 'AutoName' });
      expect(extractVue(el)).toEqual({ name: 'AutoName', framework: 'vue' });
    });

    it('returns undefined when both name fields missing', () => {
      const el = makeElementWithVue3({});
      expect(extractVue(el)).toBeUndefined();
    });

    it('extracts sourceFile from type.__file (filename only, no line)', () => {
      const el = makeElementWithVue3({
        name: 'Foo',
        __file: '/src/components/Foo.vue',
      });
      expect(extractVue(el)).toEqual({
        name: 'Foo',
        framework: 'vue',
        sourceFile: 'Foo.vue',
      });
    });

    it('omits sourceFile when __file absent (prod build)', () => {
      const el = makeElementWithVue3({ name: 'Foo' });
      const result = extractVue(el);
      expect(result?.name).toBe('Foo');
      expect(result?.sourceFile).toBeUndefined();
    });
  });

  describe('Vue 2', () => {
    it('finds __vue__ directly on element', () => {
      const el = makeElementWithVue2({ name: 'MyVue2' });
      expect(extractVue(el)).toEqual({ name: 'MyVue2', framework: 'vue' });
    });

    it('walks up parent chain to find __vue__ on ancestor', () => {
      const parent = makeElementWithVue2({ name: 'Outer' });
      const child = document.createElement('span');
      parent.appendChild(child);
      expect(extractVue(child)).toEqual({ name: 'Outer', framework: 'vue' });
    });

    it('returns undefined when neither element nor ancestors have __vue__', () => {
      const root = document.createElement('div');
      const child = document.createElement('span');
      root.appendChild(child);
      expect(extractVue(child)).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败**

Run: `cd packages/chrome-extension && pnpm test -- vue.test`
Expected: 8 tests failed, "Cannot find module '../vue'"

- [ ] **Step 3: 写实现**

```ts
// packages/chrome-extension/src/extractors/vue.ts
/* eslint-disable no-underscore-dangle */
/**
 * Vue extractor — handles Vue 3 (__vueParentComponent) and Vue 2 (__vue__).
 *
 * IRONCLAD RULE: only read `instance.type.*` (Vue 3) or `instance.$options.*` (Vue 2).
 * Never touch proxy / ctx / setupState / refs — those are Reactive Proxies and
 * accessing them triggers getters / dependency collection / side effects.
 */
import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';

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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/chrome-extension && pnpm test -- vue.test`
Expected: 8 tests passed

- [ ] **Step 5: 提交**

```bash
git add packages/chrome-extension/src/extractors/vue.ts packages/chrome-extension/src/extractors/__tests__/vue.test.ts
git commit -m "feat: add Vue 2/3 component extractor"
```

---

## Task 5: 编排器（TDD）

**Files:**
- Create: `packages/chrome-extension/src/extractors/__tests__/index.test.ts`
- Create: `packages/chrome-extension/src/extractors/index.ts`

- [ ] **Step 1: 写 3 个失败的测试**

```ts
// packages/chrome-extension/src/extractors/__tests__/index.test.ts
import { extractComponentInfo } from '../index';

// jest.mock 必须在 import 之前；但 ESM 下用 unstable_mockModule 比较繁琐——
// 这里改用依赖注入风格：暴露内部 extractors 数组用于测试。
// 如果不想加 export，下面的测试可改为构造同时挂 vue/react 标记的元素。

describe('extractComponentInfo orchestrator', () => {
  it('returns Vue info when element has __vueParentComponent (Vue tried before React)', () => {
    const el = document.createElement('div');
    (el as any).__vueParentComponent = { type: { name: 'V' } };
    (el as any).__reactFiber$x = { type: { displayName: 'R' } };
    expect(extractComponentInfo(el)).toEqual({ name: 'V', framework: 'vue' });
  });

  it('returns undefined when no extractor matches', () => {
    const el = document.createElement('div');
    expect(extractComponentInfo(el)).toBeUndefined();
  });

  it('does not throw when an extractor throws — logs and continues', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, '__vueParentComponent', {
      get() { throw new Error('boom'); },
    });
    (el as any).__reactFiber$x = { type: { displayName: 'Fallback' } };
    expect(() => extractComponentInfo(el)).not.toThrow();
    expect(extractComponentInfo(el)).toEqual({ name: 'Fallback', framework: 'react' });
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败**

Run: `cd packages/chrome-extension && pnpm test -- index.test`
Expected: 3 tests failed, "Cannot find module '../index'"

- [ ] **Step 3: 写实现**

```ts
// packages/chrome-extension/src/extractors/index.ts
import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/chrome-extension && pnpm test -- index.test`
Expected: 3 tests passed

- [ ] **Step 5: 运行全部 chrome-extension 测试**

Run: `cd packages/chrome-extension && pnpm test`
Expected: 16 tests passed (5 react + 8 vue + 3 orchestrator)

- [ ] **Step 6: 提交**

```bash
git add packages/chrome-extension/src/extractors/index.ts packages/chrome-extension/src/extractors/__tests__/index.test.ts
git commit -m "feat: add extractor orchestrator"
```

---

## Task 6: 改 RawPointedDOMElement 类型

**Files:**
- Modify: `packages/shared/src/types.ts:59-71`

- [ ] **Step 1: 修改 RawPointedDOMElement**

把字段 `reactFiber?: any` 替换为 `componentInfo?: ComponentInfo`。

当前（`packages/shared/src/types.ts`）：
```ts
export interface RawPointedDOMElement {
  outerHTML: string;
  url: string;
  timestamp: number;
  boundingClientRect?: DOMRect;
  computedStyles?: Record<string, string>;
  reactFiber?: any; // React internals if available
}
```

改后：
```ts
export interface RawPointedDOMElement {
  outerHTML: string;
  url: string;
  timestamp: number;
  boundingClientRect?: DOMRect;
  computedStyles?: Record<string, string>;
  componentInfo?: ComponentInfo;
}
```

`ComponentInfo` 已在同文件 line 32 定义，无需 import。

- [ ] **Step 2: typecheck shared 包**

Run: `cd packages/shared && pnpm exec tsc --noEmit`
Expected: 无错误（shared 包没有 typecheck script，直接调 tsc）

注意：这一步暂时不要对整个 monorepo typecheck——server 端 element-processor 还引用 `raw.reactFiber`，会报错。下一个 task 修。

- [ ] **Step 3: 提交（暂不可编译 monorepo，需配合后续 task）**

为了让每个 commit 独立可读，本 commit 只改类型。后续 task 7、8 会让整体重新可编译。

```bash
git add packages/shared/src/types.ts
git commit -m "refactor: replace RawPointedDOMElement.reactFiber with componentInfo"
```

---

## Task 7: chrome-extension 用 extractComponentInfo

**Files:**
- Modify: `packages/chrome-extension/src/utils/element.ts`

- [ ] **Step 1: 改写 element.ts**

完全重写文件内容：

```ts
// packages/chrome-extension/src/utils/element.ts
import { RawPointedDOMElement } from '@dom-pointer-mcp/shared/types';
import { extractComponentInfo } from '../extractors';

/**
 * Get all computed styles as a plain object (Record)
 * CSSStyleDeclaration doesn't serialize properly with JSON.stringify,
 * so we convert it to a plain object
 */
export function getAllComputedStyles(element: HTMLElement): Record<string, string> {
  const computedStyle = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (let i = 0; i < computedStyle.length; i += 1) {
    const property = computedStyle[i];
    styles[property] = computedStyle.getPropertyValue(property);
  }

  return styles;
}

/**
 * Extract minimal raw DOM element data for server-side processing
 */
export function extractRawPointedDOMElement(element: HTMLElement): RawPointedDOMElement {
  const raw: RawPointedDOMElement = {
    outerHTML: element.outerHTML,
    url: window.location.href,
    timestamp: Date.now(),
    boundingClientRect: element.getBoundingClientRect(),
    computedStyles: getAllComputedStyles(element),
  };

  const componentInfo = extractComponentInfo(element);
  if (componentInfo) raw.componentInfo = componentInfo;

  return raw;
}
```

注意：完全删除了 `getRawReactFiber`。`logger` 不再用，删 import。

- [ ] **Step 2: 检查是否还有别处引用 getRawReactFiber**

Run: `grep -rn "getRawReactFiber\|reactFiber" packages/chrome-extension/src`
Expected: 无任何匹配（element.ts 已删，没有其他引用过它）

- [ ] **Step 3: typecheck chrome-extension**

Run: `cd packages/chrome-extension && pnpm typecheck`
Expected: 无错误

注意：chrome-extension 的 typecheck 仅检查 `src/*.ts`（顶层），子目录文件不会被检查。这个限制是包脚本既有的，本 plan 不修。运行 jest 时 ts-jest 会做语法检查。

- [ ] **Step 4: 跑 chrome-extension 测试**

Run: `cd packages/chrome-extension && pnpm test`
Expected: 16 tests passed

- [ ] **Step 5: 提交**

```bash
git add packages/chrome-extension/src/utils/element.ts
git commit -m "refactor: extract component info in browser, drop raw Fiber transport"
```

---

## Task 8: server element-processor 改透传 + 测试

**Files:**
- Modify: `packages/server/src/services/element-processor.ts`
- Create: `packages/server/src/__tests__/services/element-processor.test.ts`

- [ ] **Step 1: 写 4 个失败测试**

```ts
// packages/server/src/__tests__/services/element-processor.test.ts
import { RawPointedDOMElement, ComponentInfo } from '@dom-pointer-mcp/shared/types';
import ElementProcessor from '../../services/element-processor';

function makeRaw(overrides: Partial<RawPointedDOMElement> = {}): RawPointedDOMElement {
  return {
    outerHTML: '<div class="x" id="y">hi</div>',
    url: 'https://example.com',
    timestamp: 1700000000000,
    boundingClientRect: {
      x: 1, y: 2, width: 3, height: 4, top: 2, right: 4, bottom: 6, left: 1, toJSON: () => ({}),
    } as DOMRect,
    computedStyles: { color: 'red' },
    ...overrides,
  };
}

describe('ElementProcessor.processFromRaw', () => {
  const processor = new ElementProcessor();

  it('passes through componentInfo when present', () => {
    const componentInfo: ComponentInfo = { name: 'MyComp', framework: 'react', sourceFile: 'MyComp.tsx:42' };
    const result = processor.processFromRaw(makeRaw({ componentInfo }));
    expect(result.componentInfo).toEqual(componentInfo);
  });

  it('leaves componentInfo undefined when raw has none', () => {
    const result = processor.processFromRaw(makeRaw());
    expect(result.componentInfo).toBeUndefined();
  });

  it('does not affect other fields when componentInfo is present', () => {
    const componentInfo: ComponentInfo = { name: 'X', framework: 'vue' };
    const result = processor.processFromRaw(makeRaw({ componentInfo }));
    expect(result.tagName).toBe('DIV');
    expect(result.id).toBe('y');
    expect(result.classes).toEqual(['x']);
    expect(result.cssComputed).toEqual({ color: 'red' });
    expect(result.position).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('passes through malformed componentInfo without throwing (trusts browser-side source)', () => {
    const malformed = { name: 'OnlyName' } as ComponentInfo;
    expect(() => processor.processFromRaw(makeRaw({ componentInfo: malformed }))).not.toThrow();
    const result = processor.processFromRaw(makeRaw({ componentInfo: malformed }));
    expect(result.componentInfo).toEqual(malformed);
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败**

Run: `cd packages/server && pnpm test -- element-processor`
Expected: 4 tests failed（部分会因为 `raw.reactFiber` 已删 + `getComponentInfo` 签名不匹配而编译失败）

- [ ] **Step 3: 改写 element-processor.ts**

完全重写：

```ts
// packages/server/src/services/element-processor.ts
import { RawPointedDOMElement, ElementPosition } from '@dom-pointer-mcp/shared/types';
import { ProcessedPointedDOMElement } from '../types';
import { extractFromHTML, generateSelector } from '../utils/dom-extractor';
import logger from '../logger';

export default class ElementProcessor {
  processFromRaw(raw: RawPointedDOMElement): ProcessedPointedDOMElement {
    const { element, warnings } = extractFromHTML(raw.outerHTML);
    const allWarnings: string[] = [...warnings];

    const processed: ProcessedPointedDOMElement = {
      tagName: element?.tagName || 'UNKNOWN',
      id: element?.id || undefined,
      classes: element ? Array.from(element.classList) : [],
      attributes: element ? this.getAttributes(element) : {},
      innerText: element?.textContent || '',
      textContent: element?.textContent || undefined,
      selector: element ? generateSelector(element) : 'unknown',

      position: this.getPosition(raw.boundingClientRect),
      url: raw.url,
      timestamp: new Date(raw.timestamp).toISOString(),

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
```

注意删除：`safeGet`、`getComponentInfo`、`ComponentInfo` import。`safeGet` 在 `getPosition` 里也被替换成了原生 `??`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/server && pnpm test -- element-processor`
Expected: 4 tests passed

- [ ] **Step 5: 运行全部 server 测试**

Run: `cd packages/server && pnpm test`
Expected: 全部通过（原有 config + shared-state + element-detail + 新增 element-processor）

- [ ] **Step 6: server 端 typecheck**

Run: `cd packages/server && pnpm typecheck`
Expected: 无错误

- [ ] **Step 7: 全局 typecheck**

Run: `pnpm typecheck` （在 repo 根）
Expected: 无错误

- [ ] **Step 8: 提交**

```bash
git add packages/server/src/services/element-processor.ts packages/server/src/__tests__/services/element-processor.test.ts
git commit -m "refactor: server element-processor passes componentInfo through"
```

---

## Task 9: 更新 README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 把 Vue 从 Planned 移到 Supported**

定位 `README.md:129-131`（"⚛️ React" 那段），把内容改成：

```md
- ⚛️ **React** — Component names and source files via Fiber (experimental)
- 🟢 **Vue 2 / Vue 3** — Component names and source files via runtime instance (experimental)
```

删掉原来的 `- 🔮 **Planned** - Vue component detection (PRs appreciated)` 那一行。

如果 Roadmap 区（`README.md:171`）还列着 "Vue.js component detection"，也删掉。

- [ ] **Step 2: 在 React Component Detection 那段（约 README.md:25 / :122）加一句**

把 line 25 的描述更新为：
```md
- ⚛️ **Component Detection** — React / Vue component names and source files (experimental)
```

或者保留两行单列、表述同步即可。重点是不再只写 React。

- [ ] **Step 3: 加版本约束说明**

在 "How It Works" 或安装章节末尾加一段：
```md
> **Note:** The Chrome extension and the MCP server are released in lockstep.
> When upgrading, please update both to the same version to avoid wire-format mismatches.
```

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "docs: document Vue 2/3 support and same-version constraint"
```

---

## Task 10: 端到端手测

**Files:** 无（手测，结果记录在 PR 描述里）

按 spec 中的 checklist 在本地依次验证：

- [ ] **Step 1: 重新构建 chrome-extension**

Run: `cd packages/chrome-extension && pnpm build`
Expected: 无错误，`dist/` 下生成

- [ ] **Step 2: 重新加载插件 & 启动 server**

按 USAGE.md 把 `dist/` 在 Chrome `chrome://extensions` 重新加载；另起终端 `cd packages/server && pnpm dev`。

- [ ] **Step 3: 在 React 18 dev 页面验证**

随意打开一个 React dev 站点（或本地起 `npx create-react-app`）。Option+Click 一个组件渲染的元素。

Run（在 agent 侧）: 调用 `get-pointed-element` MCP 工具
Expected: `componentInfo: { name, framework: 'react', sourceFile: 'Foo.tsx:42' }`

- [ ] **Step 4: 在 React 18 prod 页面验证**

打开任意 prod React 站点（如 https://react.dev）。
Expected: `componentInfo: { name, framework: 'react' }`（无 sourceFile）

- [ ] **Step 5: 在 Vue 3 + Vite dev 页面验证**

本地起 `pnpm create vue@latest` 一个简单项目跑 dev 模式。
Expected: `componentInfo: { name, framework: 'vue', sourceFile: 'Foo.vue' }`

- [ ] **Step 6: 在 Vue 3 prod 页面验证**

打开 https://vuejs.org（Vue 3 官网）。
Expected: `componentInfo: { name, framework: 'vue' }`（无 sourceFile）

- [ ] **Step 7: 在 Vue 2 dev 页面验证**

如条件允许，启动一个 Vue 2 项目（`vue create -p Vue2`），点中组件**内部**的某个普通元素（非根节点）。
Expected: 回溯命中外层组件，返回 `componentInfo`

- [ ] **Step 8: 在纯 HTML 页面验证降级**

打开 https://example.com，Option+Click。
Expected: 返回正常 DOM 信息，`componentInfo` 缺失，不报错

- [ ] **Step 9: 记录手测结果**

把 checklist 状态填到 PR 描述里。如果有 step 失败，回到对应 task 修。

---

## Self-Review

**Spec coverage 复核** —— 对照 spec 各章节：

| Spec 章节 | 实现位置 |
|---|---|
| 架构（extractors/ 目录） | Task 2–5 |
| 数据流（raw.componentInfo 替代 raw.reactFiber） | Task 6, 7, 8 |
| React extractor 行为等价 | Task 3 |
| Vue 3 extractor + Proxy 铁律 | Task 4（含 `vue.ts` 顶部注释） |
| Vue 2 回溯逻辑 | Task 4（test 7 验证回溯） |
| sourceFile 格式统一（filename + 可选行号） | Task 3 + Task 4 |
| 编排器 try/catch、按序、Vue 在前 | Task 5（test 3 验证 try/catch） |
| 错误处理（半残记录不返回） | Task 3 test 2 + Task 4 tests 3/8 |
| server 端透传 | Task 8 |
| 单元测试 5+8+3+4=20 例 | Task 3/4/5/8 |
| 手测 checklist | Task 10 |
| README 更新 + 同版本约束 | Task 9 |

**Placeholder 扫描**：所有 step 都有具体代码 / 命令 / 路径，未使用 TBD / TODO / "类似 Task N" 等。

**类型一致性**：`ComponentInfo` / `RawPointedDOMElement` / `extractComponentInfo` 在所有 task 间命名一致；接口签名（`extract(element: HTMLElement) => ComponentInfo | undefined`）贯穿。

无需调整。
