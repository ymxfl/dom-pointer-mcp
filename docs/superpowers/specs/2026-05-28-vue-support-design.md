# Vue 组件探测支持设计

## 背景

`dom-pointer-mcp` 当前支持 React 组件探测：Chrome 插件读取 DOM 元素上挂载的 `__reactFiber$*` 属性，把整个 Fiber 对象塞进 `RawPointedDOMElement.reactFiber` 通过 WebSocket 发到 server，server 端 `element-processor` 从 Fiber 里提取组件名和源码位置。

`README.md` 把 Vue 列在 Roadmap 中（"🔮 Planned - Vue component detection"）。本 spec 设计 Vue 2 / Vue 3 的支持方案。

## 调研发现的现状问题

设计 Vue 方案前，发现现有 React 实现存在两个问题，本次一并修复：

1. **序列化隐患**：`packages/chrome-extension/src/services/element-sender-service.ts:53` 用 `JSON.stringify` 序列化整个消息，而 React Fiber 节点含循环引用（`return / child / sibling / alternate` 相互指）。`JSON.stringify` 遇到循环引用会抛 `TypeError`。当前没崩可能是 Fiber 形状偶然不含循环，但不可依赖。Vue 3 的 `ComponentInternalInstance` 也含循环引用，更复杂。

2. **耦合到 React 内部对象**：`RawPointedDOMElement.reactFiber: any` 把框架内部对象当作传输契约的一部分，未来扩展（Vue/Svelte/Solid）每加一个都要在 `RawPointedDOMElement` 加字段、在 `element-processor` 加分支。

## 目标

1. 支持 Vue 3 和 Vue 2 的组件探测，行为对齐 React（拿到组件名、可选源码文件名）
2. 修复 React Fiber 序列化隐患
3. 把"框架探测"抽象成可扩展模块，未来加 Svelte / Solid / 适配 React 19 只需新增 extractor 文件

## 非目标

- React 19 兼容（`_debugSource` 已移除，需要新探测机制）—— Roadmap 单独项
- 跨框架冲突仲裁（同一 DOM 同时挂 React 和 Vue 内部对象）—— 实际不会发生
- 改 MCP 输出格式 —— `ComponentInfo` 类型保持

## 架构

把"框架探测 + 组件信息提取"整体下沉到 **Chrome 插件浏览器端**。新增 `packages/chrome-extension/src/extractors/` 模块：

```
extractors/
├── types.ts        # ComponentExtractor 接口
├── react.ts        # React Fiber → ComponentInfo
├── vue.ts          # Vue 2/3 → ComponentInfo
├── index.ts        # extractComponentInfo(element) 编排器
└── __tests__/
    ├── react.test.ts
    ├── vue.test.ts
    └── index.test.ts
```

数据流变化：

```
旧:  element → extractRawPointedDOMElement → raw.reactFiber(整个 Fiber)
                                            ↓
                                    WebSocket(JSON.stringify 隐患)
                                            ↓
                            server: element-processor.getComponentInfo

新:  element → extractRawPointedDOMElement → raw.componentInfo({name, sourceFile?, framework})
                                            ↓
                                    WebSocket(plain object，安全)
                                            ↓
                            server: element-processor 仅透传
```

## 文件清单

**新增**：
- `packages/chrome-extension/src/extractors/types.ts`
- `packages/chrome-extension/src/extractors/react.ts`
- `packages/chrome-extension/src/extractors/vue.ts`
- `packages/chrome-extension/src/extractors/index.ts`
- `packages/chrome-extension/src/extractors/__tests__/react.test.ts`
- `packages/chrome-extension/src/extractors/__tests__/vue.test.ts`
- `packages/chrome-extension/src/extractors/__tests__/index.test.ts`
- `packages/server/src/__tests__/services/element-processor.test.ts`

**修改**：
- `packages/chrome-extension/src/utils/element.ts` —— 删除 `getRawReactFiber`；`extractRawPointedDOMElement` 改为调用 `extractComponentInfo(element)`，写入 `raw.componentInfo`
- `packages/shared/src/types.ts` —— `RawPointedDOMElement` 删 `reactFiber?: any`，新增 `componentInfo?: ComponentInfo`
- `packages/server/src/services/element-processor.ts` —— 删除 `getComponentInfo` / `fromReact` / `safeGet`，`componentInfo` 改为透传 `raw.componentInfo`
- `README.md` —— Vue 从 Planned 移到 Supported；说明 chrome-extension 与 server 必须同版本

**删除**：
- `getRawReactFiber`（在 `chrome-extension/src/utils/element.ts`）
- `safeGet` + `getComponentInfo`（在 `server/src/services/element-processor.ts`）

## 关键接口

### `ComponentExtractor`

```ts
// extractors/types.ts
import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';

export interface ComponentExtractor {
  framework: 'react' | 'vue';
  /** 从 DOM 节点提取组件信息；不属于此框架返回 undefined */
  extract(element: HTMLElement): ComponentInfo | undefined;
}
```

### 编排器

```ts
// extractors/index.ts
const extractors = [extractVue, extractReact];

export function extractComponentInfo(el: HTMLElement): ComponentInfo | undefined {
  for (const extractor of extractors) {
    try {
      const info = extractor(el);
      if (info?.name) return info;
    } catch (err) {
      logger.error('extractor failed', err);
    }
  }
  return undefined;
}
```

顺序：Vue 在前（Vue 3 命中 O(1)，能尽早排除非 Vue 页面 / 命中 Vue 2 时少走 React 这一支）。

### React extractor（行为等价于现状）

```ts
// extractors/react.ts
export function extractReact(element: HTMLElement): ComponentInfo | undefined {
  const fiberKey = Object.keys(element).find((k) =>
    k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  if (!fiberKey) return undefined;

  const fiber = (element as any)[fiberKey];
  const name = fiber?.type?.displayName || fiber?.type?.name;
  if (!name) return undefined;

  const info: ComponentInfo = { name, framework: 'react' };
  const debugSource = fiber?._debugSource;
  if (debugSource?.fileName) {
    const file = debugSource.fileName.split('/').pop();
    info.sourceFile = debugSource.lineNumber
      ? `${file}:${debugSource.lineNumber}`
      : file;
  }
  return info;
}
```

### Vue extractor

```ts
// extractors/vue.ts
/**
 * 铁律：只读 instance.type.* / instance.$options.* 这条静态路径。
 * 禁止访问 proxy / ctx / setupState / refs 等字段——它们是 Reactive Proxy，
 * 访问会触发 getter / 依赖收集等副作用。
 */
export function extractVue(element: HTMLElement): ComponentInfo | undefined {
  // Vue 3: __vueParentComponent 直接命中
  const vue3 = (element as any).__vueParentComponent;
  if (vue3) return fromVue3(vue3);

  // Vue 2: __vue__ 只挂在组件根节点，向上回溯
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
  if (type.__file) info.sourceFile = type.__file.split('/').pop();
  return info;
}

function fromVue2(instance: any): ComponentInfo | undefined {
  const options = instance?.$options;
  const name = options?.name || options?._componentTag;
  if (!name) return undefined;

  const info: ComponentInfo = { name, framework: 'vue' };
  if (options.__file) info.sourceFile = options.__file.split('/').pop();
  return info;
}
```

### `extractRawPointedDOMElement` 改动

```ts
// utils/element.ts (改后)
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

### `RawPointedDOMElement` 类型

```ts
// shared/src/types.ts (改后)
export interface RawPointedDOMElement {
  outerHTML: string;
  url: string;
  timestamp: number;
  boundingClientRect?: DOMRect;
  computedStyles?: Record<string, string>;
  componentInfo?: ComponentInfo;  // 新增，取代 reactFiber
}
```

### Server 端 `element-processor` 简化

```ts
// element-processor.ts (改后核心片段)
processFromRaw(raw: RawPointedDOMElement): ProcessedPointedDOMElement {
  const { element, warnings } = extractFromHTML(raw.outerHTML);
  return {
    tagName: element?.tagName || 'UNKNOWN',
    // ...其他字段...
    componentInfo: raw.componentInfo,  // 纯透传
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
```

## 行为说明

### 字段缺失（生产构建）
- React `_debugSource` 不存在 / Vue `__file` 不存在 → `sourceFile` 字段不写入，只剩 `{ name, framework }`
- 整个组件无 name（匿名、`<script setup>` 无 `__name`）→ extractor 返回 `undefined`，**不**返回半残记录 `{ framework }`

### Vue 2 回溯
- 不设深度上限。`while (node)` 自然在 `body.parentElement === null` 时停止，最坏遍历 DOM 深度（通常 < 30）

### Vue 3 Proxy 规避
- 只读 `instance.type.*` 这条路径。`vue.ts` 顶部注释明确这条铁律，code review 必查

### sourceFile 格式约定
- React：`Foo.tsx:42`（文件名 + 可选行号）
- Vue：`Foo.vue`（仅文件名，Vue 编译器不提供行号）
- 路径前缀（src/components/...）一律剥掉，避免构建工具差异

### 错误处理
- 单个 extractor 抛错 → 编排器记 error log、跳到下一个，不冒泡到主流程
- 用户点击始终能拿到 DOM 数据，组件信息缺失是可降级的

### 版本耦合
- `RawPointedDOMElement.reactFiber` 移除是破坏性变更
- chrome-extension 与 server 是同 monorepo 同步发版，用户升级时一起换，不会出现版本错配
- README 加一句"chrome-extension 与 server 必须同版本"

## 测试策略

### 单元测试

**`extractors/__tests__/react.test.ts`**（5 例）
1. 无 `__reactFiber$*` → `undefined`
2. 有 Fiber、有 `displayName` → `{ name, framework: 'react' }`
3. 有 Fiber、无 `displayName` 但有 `type.name` → 用 `type.name`
4. 有 Fiber、有 `_debugSource` → `sourceFile: 'MyComp.tsx:42'`
5. 有 Fiber、无 `_debugSource`（React 19 场景）→ `sourceFile` 缺失，name 仍有

**`extractors/__tests__/vue.test.ts`**（8 例）

Vue 3：
1. `__vueParentComponent` + `type.name` → 命中
2. `__vueParentComponent` 仅 `type.__name`（`<script setup>`）→ 用 `__name`
3. `__vueParentComponent` 无 name → `undefined`
4. `__vueParentComponent` + `type.__file` → `sourceFile: 'Foo.vue'`
5. `__vueParentComponent` 无 `__file` → `sourceFile` 缺失

Vue 2：
6. `__vue__` 直接挂在点中元素上 → 命中
7. `__vue__` 在祖先节点上，点中元素本身没有 → 回溯命中
8. 整条 parent 链都没 `__vue__` → `undefined`

**`extractors/__tests__/index.test.ts`**（3 例）
1. Vue 命中时不再调用 React extractor
2. 单个 extractor 抛错 → 记 log、跳到下一个、不冒泡
3. 全部 extractor 返回 undefined → 编排器返回 undefined

**`server/__tests__/services/element-processor.test.ts`**（4 例）
1. `raw.componentInfo` 存在 → `processed.componentInfo` 字段值相等（透传）
2. `raw.componentInfo` 缺失 → `processed.componentInfo === undefined`
3. 含 `componentInfo` 时不影响其他字段（selector/tagName/cssComputed）
4. 含异常 `componentInfo`（缺 framework 字段）→ 仍透传，不抛错

### Mock 策略
- React 测试：mock element 是 plain object 加 `__reactFiber$abc` 属性，fiber 也是 plain object —— 不装 React
- Vue 测试：mock `__vueParentComponent` / `__vue__` 为 plain object —— 不装 Vue
- element-processor 测试：mock 一个完整 `RawPointedDOMElement`

### 手测 checklist
- [ ] React 18 dev 页面 → name + sourceFile 带行号
- [ ] React 18 prod 页面 → 只看到 name
- [ ] Vue 3 + Vite dev → name + sourceFile 仅文件名
- [ ] Vue 3 prod → 只看到 name
- [ ] Vue 2 + vue-loader dev → 同上
- [ ] Vue 2 点中组件内部的普通元素 → 回溯命中外层组件
- [ ] 纯 HTML 页面 → componentInfo 缺失，其他字段正常

## 不在本 spec 范围内

- React 19 `_debugSource` 移除后的替代探测
- Svelte / Solid 等其他框架
- 跨框架同 DOM 仲裁
- MCP 输出格式变化（sourceFile 格式拆字段等）

## 风险

| 风险 | 影响 | 处置 |
|---|---|---|
| Vue 3 Proxy 字段被误读 | 触发副作用 / 抛错 | extractor 顶部铁律注释，code review 强制 |
| 破坏性变更影响下游 | reactFiber 字段消失 | monorepo 同步发版；README 说明 |
| 极深 DOM 树 Vue 2 回溯慢 | 用户感知微卡 | 实际 DOM 深度通常 < 30，不优化 |
| Vue 内部 API 在新版本变 | extractor 失效 | 失败时返回 undefined，降级而非崩溃 |
