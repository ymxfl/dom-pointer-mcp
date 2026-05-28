# Isolated World 修复：让组件 extractor 真正生效 设计

## 背景

`docs/superpowers/specs/2026-05-28-vue-support-design.md` 已落地（commit `ab65238`），实现了 React + Vue 2/3 的组件信息提取。但**手测发现 extractor 在真实页面上从未生效过**：`/tmp/mcp-pointer-shared-state.json` 里 `componentInfo` 永远是 `null`。

### 根因

Chrome 扩展的 content script 默认运行在 **ISOLATED world**，与页面 JS 共享 DOM，但**不共享 DOM 节点上的 JS expando 属性**。这是浏览器安全模型，不是 bug。

具体验证：在 Vue 3 页面的 isolated-world devtools context 跑

```js
const btn = document.querySelector('button[data-v-dc0096cf]');
Object.keys(btn);  // [] —— 看不到 __vueParentComponent
btn.__vueParentComponent;  // undefined
```

而在 page world 同一个 btn 上 `__vueParentComponent` 是一个完整的 Vue ComponentInternalInstance。

意味着：
- 现有 React extractor 在真实生产页面**从未真正工作过**——只是没人发现
- Vue extractor 同样的问题
- 既有 16 个 extractor 单元测试用的是 jsdom（无 world 概念），所以测试都过，但生产不工作

## 目标

让 ISOLATED 世界的 content script 能拿到 page-world expando 属性的提取结果，使现有 React/Vue extractor 真正在生产页面上生效。

## 非目标

- 重构 extractor 逻辑（已有 16 测试覆盖，逻辑没问题）
- 改 server / shared 包（接口不变）
- 改 MCP 输出格式（`componentInfo` 字段已存在）
- 解决其他不可见对象问题（如 page-world 的 globalThis；本 spec 只解决"读 DOM 节点上的 expando"）

## 架构

新增第二个 content script，跑在 **MAIN world**，专门做 expando 读取。两个 world 之间走 `CustomEvent` 请求-响应。

```
manifest.json content_scripts:
  [ { content.js,         world: ISOLATED (默认), run_at: document_end }   ← 既有
    { extractor-main.js,  world: MAIN,             run_at: document_start } ← 新增
  ]

ISOLATED (content.js)                    MAIN (extractor-main.js)
─────────────────────                    ─────────────────────────
Option+Click on <button>                 [启动时注册一个永久 listener]
  ↓                                            │
extractRawPointedDOMElement(el)                │
  ↓                                            │
requestComponentInfo(el)  ────CustomEvent────▶ │ listen 'extract-request'
                          extract-request      │   ↓
                          { requestId }        │ querySelector('[data-id=...]')
                                               │   ↓
                                               │ extractComponentInfo(el)
                                               │   ↓
  resolve(componentInfo) ◀───CustomEvent────── │ dispatch 'extract-response'
                          extract-response       { requestId, componentInfo }
  ↓
raw.componentInfo = ...
  ↓
sendToBackground(raw)
```

### 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 注入方式 | 声明式 MAIN content script | 比 chrome.scripting.executeScript 简单；不需要新增 `"scripting"` 权限；与现有 manifest 模型一致 |
| 通信通道 | `CustomEvent` + `dispatchEvent` | Chrome 文档推荐；命名空间事件名天然过滤；payload 直接走 `detail` |
| 通信模式 | ISOLATED 请求 / MAIN 响应 | 显式可追踪；不依赖事件时序；click 判定逻辑只在 ISOLATED 里写一次 |
| 跨 world 元素引用 | 临时 `data-mcp-pointer-extract-id` attribute | DOM 节点对象不跨 world，但 attribute 跨 world 可见，是唯一可靠机制 |
| MAIN script 加载时机 | `run_at: document_start` | 早于 ISOLATED 的 `document_end`，确保 listener 在用户点击前 ready |
| 已有 extractor 模块 | 0 修改 | 桥接层在它们外面，extractor 纯函数和 16 个单元测试全部继续 work |

### Chrome 版本

`content_scripts[].world: "MAIN"` 需 Chrome 111+（2023-03）。当前 esbuild target 已是 `chrome100`，需上调到 `chrome111`。三年前发布的版本，对实际用户无影响。

## 文件清单

**新增**：
- `packages/chrome-extension/src/main-world/extractor-main.ts` — MAIN world 入口；注册 `extract-request` listener；收到请求后 querySelector + 调用 extractComponentInfo + dispatch response
- `packages/chrome-extension/src/isolated-world/request-component-info.ts` — `requestComponentInfo(el, timeoutMs?)` 异步函数
- `packages/chrome-extension/src/shared/bridge-events.ts` — 跨 world 共享事件名、attribute 名、payload 类型
- `packages/chrome-extension/src/__tests__/isolated-world/request-component-info.test.ts` — 5 例
- `packages/chrome-extension/src/__tests__/main-world/extractor-main.test.ts` — 2 例

**修改**：
- `packages/chrome-extension/src/manifest.json` — content_scripts 新增第二个 entry（MAIN world + document_start）
- `packages/chrome-extension/package.json` — esbuild build/dev 命令加 `src/main-world/extractor-main.ts` 入口；target 改 `chrome111`
- `packages/chrome-extension/src/utils/element.ts` — `extractRawPointedDOMElement` 改 `async`；用 `await requestComponentInfo(el)` 替代 `extractComponentInfo(el)`
- `packages/chrome-extension/src/services/element-pointer-service.ts` — `sendToBackground` 改 `async`；await raw 后比对 `this.pointedElement === target` 做竞态检查；丢弃过时请求

**不动**：
- `packages/chrome-extension/src/extractors/{react,vue,index,types}.ts` — 0 修改
- `packages/chrome-extension/src/extractors/__tests__/*.test.ts` — 16 个测试 0 修改
- server / shared 包
- chrome-extension 的 background / trigger / overlay / popup

**目录结构变化**：

```
packages/chrome-extension/src/
├── isolated-world/                    (新)
│   └── request-component-info.ts
├── main-world/                         (新)
│   └── extractor-main.ts
├── shared/                             (新)
│   └── bridge-events.ts
├── extractors/                         (不动)
│   ├── react.ts / vue.ts / index.ts / types.ts
│   └── __tests__/  (16 个 test 不动)
├── services/                           (微改 element-pointer-service)
├── utils/                              (微改 element.ts)
├── __tests__/                          (新增子目录)
│   ├── isolated-world/
│   └── main-world/
├── content.ts / background.ts / popup.ts ...  (不动)
```

3 个新目录把"ISOLATED-only / MAIN-only / 跨 world 共享"的物理边界显式化——防止后续在 main-world 脚本里 import 用到 `chrome.*` API 的代码（会运行时崩）。

## 关键代码

### `shared/bridge-events.ts`

```ts
import type { ComponentInfo } from '@mcp-pointer/shared/types';

export const EXTRACT_REQUEST_EVENT = 'mcp-pointer:extract-request';
export const EXTRACT_RESPONSE_EVENT = 'mcp-pointer:extract-response';
export const EXTRACT_ID_ATTR = 'data-mcp-pointer-extract-id';
export const DEFAULT_TIMEOUT_MS = 100;

export interface ExtractRequestDetail {
  requestId: string;
}

export interface ExtractResponseDetail {
  requestId: string;
  componentInfo?: ComponentInfo;
}
```

### `main-world/extractor-main.ts`

```ts
import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  ExtractRequestDetail,
  ExtractResponseDetail,
} from '../shared/bridge-events';
import { extractComponentInfo } from '../extractors';

// MAIN world: 不能 import chrome.* 代码，所以不能用现有 logger
// 直接 console.warn 兜底极少数错误场景

window.addEventListener(EXTRACT_REQUEST_EVENT, (e: Event) => {
  const detail = (e as CustomEvent<ExtractRequestDetail>).detail;
  if (!detail?.requestId) return;

  const el = document.querySelector(
    `[${EXTRACT_ID_ATTR}="${detail.requestId}"]`,
  );
  const componentInfo = el instanceof HTMLElement
    ? extractComponentInfo(el)
    : undefined;

  const responseDetail: ExtractResponseDetail = {
    requestId: detail.requestId,
    componentInfo,
  };
  window.dispatchEvent(new CustomEvent(EXTRACT_RESPONSE_EVENT, {
    detail: responseDetail,
  }));
});
```

### `isolated-world/request-component-info.ts`

```ts
import type { ComponentInfo } from '@mcp-pointer/shared/types';
import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  DEFAULT_TIMEOUT_MS,
  ExtractResponseDetail,
} from '../shared/bridge-events';

export async function requestComponentInfo(
  el: HTMLElement,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ComponentInfo | undefined> {
  const requestId = crypto.randomUUID();
  el.setAttribute(EXTRACT_ID_ATTR, requestId);

  try {
    return await new Promise<ComponentInfo | undefined>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;

      const listener = (e: Event) => {
        const detail = (e as CustomEvent<ExtractResponseDetail>).detail;
        if (detail?.requestId !== requestId) return;
        window.removeEventListener(EXTRACT_RESPONSE_EVENT, listener);
        clearTimeout(timer);
        resolve(detail.componentInfo);
      };

      timer = setTimeout(() => {
        window.removeEventListener(EXTRACT_RESPONSE_EVENT, listener);
        resolve(undefined);
      }, timeoutMs);

      window.addEventListener(EXTRACT_RESPONSE_EVENT, listener);
      window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, {
        detail: { requestId },
      }));
    });
  } finally {
    el.removeAttribute(EXTRACT_ID_ATTR);
  }
}
```

### `utils/element.ts`（异步化）

```ts
import { RawPointedDOMElement } from '@mcp-pointer/shared/types';
import { requestComponentInfo } from '../isolated-world/request-component-info';

export function getAllComputedStyles(element: HTMLElement): Record<string, string> {
  // 不变
}

export async function extractRawPointedDOMElement(
  element: HTMLElement,
): Promise<RawPointedDOMElement> {
  const raw: RawPointedDOMElement = {
    outerHTML: element.outerHTML,
    url: window.location.href,
    timestamp: Date.now(),
    boundingClientRect: element.getBoundingClientRect(),
    computedStyles: getAllComputedStyles(element),
  };

  const componentInfo = await requestComponentInfo(element);
  if (componentInfo) raw.componentInfo = componentInfo;

  return raw;
}
```

### `services/element-pointer-service.ts`（异步竞态保护）

```ts
private async sendToBackground(target: HTMLElement): Promise<void> {
  logger.info('📤 Sending target to background:', target);

  const raw = await extractRawPointedDOMElement(target);

  // 竞态保护：用户在 await 期间已经点了别的元素
  if (this.pointedElement !== target) {
    logger.debug('🚫 Discarding stale extraction (user clicked another element)');
    return;
  }

  chrome.runtime.sendMessage({
    type: 'DOM_ELEMENT_POINTED',
    data: raw as RawPointedDOMElement,
  }, (response: any) => {
    if (chrome.runtime.lastError) {
      logger.error('❌ Error sending to background:', chrome.runtime.lastError);
    } else {
      logger.debug('✅ Element sent successfully:', response);
    }
  });
}
```

`onClick` 自身不需改动——它本来就是 fire-and-forget 调 `sendToBackground`，方法异步化对 DOM event handler 无影响（Promise 被丢弃即可，所有内部 error 已被 try/catch 或 callback 处理）。

### `manifest.json`

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["styles.css"],
    "run_at": "document_end"
  },
  {
    "matches": ["<all_urls>"],
    "js": ["extractor-main.js"],
    "run_at": "document_start",
    "world": "MAIN"
  }
]
```

### `package.json` esbuild 命令

```json
"build": "pnpm clean && esbuild src/background.ts src/content.ts src/popup.ts src/main-world/extractor-main.ts src/styles.css ... --target=chrome111 ..."
```

`--target=chrome100` → `--target=chrome111`。增加 `src/main-world/extractor-main.ts` 输入。esbuild 输出文件名规则会根据 `--outbase=src` 生成 `dist/main-world/extractor-main.js`——manifest 的 path 要相应写 `main-world/extractor-main.js`，或者用 esbuild 的 `--out-extension` 调整。**plan 阶段验证哪个写法更顺手**。

## 行为说明

### 错误处理总结

| 场景 | 行为 |
|---|---|
| MAIN script 未加载（旧 Chrome / 严格 CSP） | timeout 100ms → resolve undefined → componentInfo 字段不写入 |
| element 在 100ms 内被页面 JS 移除 | querySelector 找不到 → response.componentInfo = undefined |
| extractor 内部抛错 | orchestrator try/catch → response.componentInfo = undefined |
| 用户快速连点 | sequence number 检查（this.pointedElement === target）丢弃过时请求 |
| MAIN script 抛错 | console.warn；不发 response → ISOLATED 100ms 超时降级 |
| 临时 attribute 被页面 JS 擦除 | querySelector 找不到 → 降级路径 |

### 临时 attribute 的可观察性

- 100ms 内 setAttribute → removeAttribute
- 触发页面 MutationObserver。多数业务 JS 不监听 `data-mcp-pointer-*` 这类 attribute
- 如有页面强制清理 attribute（罕见），querySelector 失败 → 降级
- 不做额外防护

### 超时阈值

100ms 是经验值：
- 单次 querySelector + Object property 读取 + dispatchEvent 通常 <5ms
- 留 95ms buffer 容忍偶发 GC 或主线程阻塞
- 用户感知阈值约 100ms，超过会觉得"卡"
- 100ms 仍未响应 → 几乎可以确定是 MAIN script 没加载（永久失败而非偶发延迟），不值得等更久

### 安全

CustomEvent 是 window-level，页面 JS 也能 listen 和 dispatch：
- **页面伪造 response**：理论上恶意页面可监听 `extract-request` 然后 dispatch 假 `extract-response`。但 mcp-pointer 是开发工具，extractor 数据只送给用户自己的 agent，无敏感数据可被诱骗。**不防御**。
- **页面拦截 request**：页面能看到我们发的 requestId 和 attribute，但这些都不是秘密。**不防御**。
- **结论**：威胁模型与现有 content script 共存于 page DOM 的威胁模型一致，无新增风险。

## 测试策略

### 新增单元测试（7 例）

**`__tests__/isolated-world/request-component-info.test.ts`（5 例）**

1. 响应到达 → resolve 正确值；attribute 已清理
2. 超时 → resolve undefined；attribute 已清理（用 jest fake timers）
3. response requestId 不匹配 → 忽略，等真正匹配的
4. 并发请求互不干扰：两个 `requestComponentInfo` 同时跑，响应乱序，各自 resolve 自己的值
5. 超时后晚到的 response 被忽略，不再 resolve、不出错

**`__tests__/main-world/extractor-main.test.ts`（2 例）**

1. 收到 extract-request，能找到 element → dispatch 带 componentInfo 的 response
2. 收到 extract-request，querySelector 找不到 element → dispatch 带 undefined 的 response

mock 策略：jsdom 原生支持 CustomEvent + dispatchEvent。`crypto.randomUUID` 在 jest-environment-jsdom 30 原生可用；若不可用用 `jest.spyOn(crypto, 'randomUUID').mockReturnValue('test-id-1')` 桩出可预测值。

### 已有测试

- `extractors/__tests__/*.test.ts`（16 例）：**0 修改**
- `server/__tests__/services/element-processor.test.ts`（4 例）：**0 修改**
- 其他 server 测试：**0 修改**

### 手测清单（扩充原 Task 10 的 7 条 → 10 条）

原 7 条手测继续保留。新增 3 条**专门验证桥接**：

8. **桥接联通性（金标准）**：Vue 3 dev 页面 Option+Click 任意元素 → `cat /tmp/mcp-pointer-shared-state.json | grep componentInfo` → **非 null**，name 是真实组件名
9. **快速连点不乱序**：Option+Click 元素 A，立即（<100ms 内）Option+Click 元素 B → 最终 state.json 是 B 的 componentInfo（不是 A 也不是混淆）
10. **严格 CSP 站点降级**：在 https://github.com 等严格 CSP 站点 Option+Click → 主流程不崩；componentInfo 缺失或 null，其他字段（selector/tagName/cssComputed）正常

第 8 条是这次修复的**通过/失败判定线**。

## 不在本 spec 范围内

- React 19 `_debugSource` 移除后的替代探测（既有 React extractor 无关 isolated world 问题，已 work，留待独立 spec）
- 共享 page-world 其他对象（如 `window.__INITIAL_STATE__`）—— 本 spec 只解决 DOM 节点上的 expando
- e2e 自动化测试（playwright/puppeteer）—— 项目体量不需要重型 e2e 设施
- 解决"既有 React extractor 同样从未真正生效"的历史问题——本 spec 的修复**同时**让 React 真正生效（同一条桥接路径），但不单独拎出来做"修复 React"的子项

## 风险

| 风险 | 影响 | 处置 |
|---|---|---|
| MAIN script 在某些 CSP 极严格的页面被拦截 | extractor 在那些页面失效 | 降级路径（超时返回 undefined）已覆盖；不影响其他字段 |
| 100ms 超时太短 | 偶发漏拿 componentInfo | 阈值在 `shared/bridge-events.ts` 集中，调整成本低 |
| Chrome <111 用户 | content_scripts[].world: "MAIN" 被忽略 → 永久失效 | Chrome 111 已 3 年；用户拒绝升级是其他问题 |
| MAIN script 启动顺序晚于第一次 click | 第一次 click 拿不到 componentInfo | 实际不可能：document_start 早于用户能点击的 document_end |
| 临时 attribute 触发页面 MutationObserver 风暴 | 页面性能问题 | 单次请求只 set + remove 一次；100ms 内完成；多数页面不监听 data-* |
