# Isolated World 修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 通过新增 MAIN-world content script 和 CustomEvent 桥接，让 React/Vue extractor 真正能读到页面 expando 属性，从而在生产页面上生效。

**Architecture:** 新增第二个 content script (MAIN world)；ISOLATED 端用 `requestComponentInfo()` 异步函数通过 CustomEvent 请求/响应；临时 `data-mcp-pointer-extract-id` attribute 作为跨 world 元素引用。

参考 spec: `docs/superpowers/specs/2026-05-28-isolated-world-fix-design.md`

---

## Task 1: 共享常量 + 类型

**Files:**
- Create: `packages/chrome-extension/src/shared/bridge-events.ts`

- [ ] **Step 1: 写文件**

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

- [ ] **Step 2: 提交**

```bash
git add packages/chrome-extension/src/shared/bridge-events.ts
git commit -m "feat: add bridge event constants and types"
```

---

## Task 2: ISOLATED 侧 requestComponentInfo（TDD）

**Files:**
- Create: `packages/chrome-extension/src/__tests__/isolated-world/request-component-info.test.ts`
- Create: `packages/chrome-extension/src/isolated-world/request-component-info.ts`

- [ ] **Step 1: 写 5 个失败测试**

```ts
import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  ExtractRequestDetail,
  ExtractResponseDetail,
} from '../../shared/bridge-events';
import type { ComponentInfo } from '@mcp-pointer/shared/types';
import { requestComponentInfo } from '../../isolated-world/request-component-info';

function captureRequest(): Promise<string> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      window.removeEventListener(EXTRACT_REQUEST_EVENT, handler);
      resolve((e as CustomEvent<ExtractRequestDetail>).detail.requestId);
    };
    window.addEventListener(EXTRACT_REQUEST_EVENT, handler);
  });
}

function sendResponse(requestId: string, componentInfo?: ComponentInfo) {
  const detail: ExtractResponseDetail = { requestId, componentInfo };
  window.dispatchEvent(new CustomEvent(EXTRACT_RESPONSE_EVENT, { detail }));
}

describe('requestComponentInfo', () => {
  it('resolves with componentInfo when matching response arrives', async () => {
    const el = document.createElement('div');
    const capturedIdPromise = captureRequest();
    const resultPromise = requestComponentInfo(el, 1000);
    const requestId = await capturedIdPromise;
    sendResponse(requestId, { name: 'X', framework: 'react' });
    await expect(resultPromise).resolves.toEqual({ name: 'X', framework: 'react' });
    expect(el.hasAttribute(EXTRACT_ID_ATTR)).toBe(false);
  });

  it('resolves undefined and cleans attribute on timeout', async () => {
    jest.useFakeTimers();
    const el = document.createElement('div');
    const resultPromise = requestComponentInfo(el, 100);
    jest.advanceTimersByTime(100);
    await expect(resultPromise).resolves.toBeUndefined();
    expect(el.hasAttribute(EXTRACT_ID_ATTR)).toBe(false);
    jest.useRealTimers();
  });

  it('ignores responses with mismatched requestId', async () => {
    const el = document.createElement('div');
    const capturedIdPromise = captureRequest();
    const resultPromise = requestComponentInfo(el, 1000);
    const requestId = await capturedIdPromise;
    sendResponse('wrong-id', { name: 'WRONG', framework: 'react' });
    sendResponse(requestId, { name: 'RIGHT', framework: 'vue' });
    await expect(resultPromise).resolves.toEqual({ name: 'RIGHT', framework: 'vue' });
  });

  it('handles concurrent requests independently', async () => {
    const elA = document.createElement('div');
    const elB = document.createElement('div');
    const requestIds: string[] = [];
    const handler = (e: Event) => {
      requestIds.push((e as CustomEvent<ExtractRequestDetail>).detail.requestId);
    };
    window.addEventListener(EXTRACT_REQUEST_EVENT, handler);

    const promiseA = requestComponentInfo(elA, 1000);
    const promiseB = requestComponentInfo(elB, 1000);

    await new Promise((r) => setTimeout(r, 0));
    expect(requestIds).toHaveLength(2);
    const [idA, idB] = requestIds;

    sendResponse(idB, { name: 'B', framework: 'react' });
    sendResponse(idA, { name: 'A', framework: 'vue' });

    await expect(promiseA).resolves.toEqual({ name: 'A', framework: 'vue' });
    await expect(promiseB).resolves.toEqual({ name: 'B', framework: 'react' });

    window.removeEventListener(EXTRACT_REQUEST_EVENT, handler);
  });

  it('ignores late responses after timeout', async () => {
    jest.useFakeTimers();
    const el = document.createElement('div');
    let capturedId = '';
    const handler = (e: Event) => {
      capturedId = (e as CustomEvent<ExtractRequestDetail>).detail.requestId;
    };
    window.addEventListener(EXTRACT_REQUEST_EVENT, handler);

    const resultPromise = requestComponentInfo(el, 50);
    jest.advanceTimersByTime(50);
    const result = await resultPromise;
    expect(result).toBeUndefined();

    // Late response should not throw or cause any side effect
    expect(() => sendResponse(capturedId, { name: 'LATE', framework: 'react' })).not.toThrow();

    window.removeEventListener(EXTRACT_REQUEST_EVENT, handler);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: 跑测试，确认 5 个全失败**

`cd packages/chrome-extension && pnpm test -- request-component-info`
Expected: 5 failed, "Cannot find module"

- [ ] **Step 3: 实现**

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

- [ ] **Step 4: 跑测试，确认 5 个通过**

- [ ] **Step 5: 提交**

```bash
git add packages/chrome-extension/src/isolated-world/ packages/chrome-extension/src/__tests__/isolated-world/
git commit -m "feat: add requestComponentInfo cross-world bridge (ISOLATED side)"
```

---

## Task 3: MAIN 侧 extractor-main（TDD）

**Files:**
- Create: `packages/chrome-extension/src/__tests__/main-world/extractor-main.test.ts`
- Create: `packages/chrome-extension/src/main-world/extractor-main.ts`

- [ ] **Step 1: 写 2 个失败测试**

```ts
import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  ExtractResponseDetail,
} from '../../shared/bridge-events';

function captureResponse(): Promise<ExtractResponseDetail> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      window.removeEventListener(EXTRACT_RESPONSE_EVENT, handler);
      resolve((e as CustomEvent<ExtractResponseDetail>).detail);
    };
    window.addEventListener(EXTRACT_RESPONSE_EVENT, handler);
  });
}

describe('extractor-main', () => {
  beforeAll(() => {
    // Side-effect import: registers the listener
    require('../../main-world/extractor-main');
  });

  it('dispatches response with componentInfo when element found', async () => {
    const el = document.createElement('div');
    el.setAttribute(EXTRACT_ID_ATTR, 'req-1');
    (el as any).__vueParentComponent = { type: { name: 'Foo' } };
    document.body.appendChild(el);

    const responsePromise = captureResponse();
    window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, {
      detail: { requestId: 'req-1' },
    }));

    const response = await responsePromise;
    expect(response.requestId).toBe('req-1');
    expect(response.componentInfo).toEqual({ name: 'Foo', framework: 'vue' });

    el.remove();
  });

  it('dispatches response with undefined componentInfo when element not found', async () => {
    const responsePromise = captureResponse();
    window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, {
      detail: { requestId: 'req-missing' },
    }));

    const response = await responsePromise;
    expect(response.requestId).toBe('req-missing');
    expect(response.componentInfo).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试，确认 2 个失败**

`cd packages/chrome-extension && pnpm test -- extractor-main`

- [ ] **Step 3: 实现**

```ts
import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  ExtractRequestDetail,
  ExtractResponseDetail,
} from '../shared/bridge-events';
import { extractComponentInfo } from '../extractors';

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

- [ ] **Step 4: 跑测试，2 个通过**

- [ ] **Step 5: 全量 chrome-extension 测试，确认 16 + 5 + 2 = 23 通过**

`cd packages/chrome-extension && pnpm test`

- [ ] **Step 6: 提交**

```bash
git add packages/chrome-extension/src/main-world/ packages/chrome-extension/src/__tests__/main-world/
git commit -m "feat: add MAIN-world extractor listener"
```

---

## Task 4: element.ts 异步化

**Files:**
- Modify: `packages/chrome-extension/src/utils/element.ts`

- [ ] **Step 1: 完全重写文件**

```ts
import { RawPointedDOMElement } from '@mcp-pointer/shared/types';
import { requestComponentInfo } from '../isolated-world/request-component-info';

export function getAllComputedStyles(element: HTMLElement): Record<string, string> {
  const computedStyle = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (let i = 0; i < computedStyle.length; i += 1) {
    const property = computedStyle[i];
    styles[property] = computedStyle.getPropertyValue(property);
  }

  return styles;
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

变化：删除 `extractComponentInfo` 的 import 和直接调用，改成 `await requestComponentInfo`。整个函数变 `async`。

- [ ] **Step 2: 跑全量测试，确认没有回归**

`cd packages/chrome-extension && pnpm test`
Expected: 23 通过（所有 extractor 测试 + 桥接测试都不依赖 element.ts，无影响）

- [ ] **Step 3: 提交**

```bash
git add packages/chrome-extension/src/utils/element.ts
git commit -m "refactor: extractRawPointedDOMElement awaits cross-world componentInfo"
```

---

## Task 5: element-pointer-service 异步化 + 竞态保护

**Files:**
- Modify: `packages/chrome-extension/src/services/element-pointer-service.ts`

- [ ] **Step 1: 修改 sendToBackground**

把原来的 `private sendToBackground(target: HTMLElement): void` 改为：

```ts
private async sendToBackground(target: HTMLElement): Promise<void> {
  logger.info('📤 Sending target to background:', target);

  const raw = await extractRawPointedDOMElement(target);

  // Race protection: user may have clicked another element while awaiting
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

`onClick` 自身不需改 —— 它本来就是 fire-and-forget 调 `sendToBackground`，方法变 async 不影响 DOM event handler 行为（返回的 Promise 被丢弃）。

- [ ] **Step 2: typecheck**

`cd packages/chrome-extension && pnpm typecheck`
Expected: 无新错误（pre-existing shared module resolution errors 仍存在，与本任务无关）

- [ ] **Step 3: 跑全量测试**

`pnpm test`（从 repo 根）
Expected: chrome-extension 23 + server 27 = 50 通过

- [ ] **Step 4: 提交**

```bash
git add packages/chrome-extension/src/services/element-pointer-service.ts
git commit -m "refactor: sendToBackground awaits raw and discards stale clicks"
```

---

## Task 6: manifest + esbuild 配置

**Files:**
- Modify: `packages/chrome-extension/src/manifest.json`
- Modify: `packages/chrome-extension/package.json`

- [ ] **Step 1: 更新 manifest.json content_scripts**

替换 `"content_scripts"` 数组为：

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
    "js": ["main-world/extractor-main.js"],
    "run_at": "document_start",
    "world": "MAIN"
  }
]
```

- [ ] **Step 2: 更新 package.json build/dev**

把现有 `build` script 改为：

```json
"build": "pnpm clean && esbuild src/background.ts src/content.ts src/popup.ts src/main-world/extractor-main.ts src/styles.css src/popup.css src/manifest.json src/popup.html src/*.png --bundle --outdir=dist --outbase=src --format=iife --platform=browser --target=chrome111 --minify --define:IS_DEV=false --loader:.css=copy --loader:.html=copy --loader:.json=copy --loader:.png=copy"
```

把 `dev` script 改为（对称改动 + sourcemap 保留）：

```json
"dev": "pnpm clean-dev && esbuild src/background.ts src/content.ts src/popup.ts src/main-world/extractor-main.ts src/styles.css src/popup.css src/manifest.json src/popup.html src/*.png --bundle --outdir=dev --outbase=src --format=iife --platform=browser --target=chrome111 --sourcemap --define:IS_DEV=true --loader:.css=copy --loader:.html=copy --loader:.json=copy --loader:.png=copy --watch"
```

两处改动：
1. 新增 `src/main-world/extractor-main.ts` 入口
2. `--target=chrome100` → `--target=chrome111`

- [ ] **Step 3: 构建并验证产物结构**

```bash
cd packages/chrome-extension && pnpm build
ls -la dist/
ls -la dist/main-world/
```

Expected:
- `dist/content.js` 存在
- `dist/main-world/extractor-main.js` 存在（esbuild 用 `--outbase=src` 时会保留 main-world/ 子目录）
- `dist/manifest.json` 存在，路径与 manifest.json 中的 `main-world/extractor-main.js` 一致

如果 esbuild 把它平铺成 `dist/extractor-main.js`（没有保留子目录），调整 manifest.json 里的路径即可。

- [ ] **Step 4: 检查 manifest 是否被 esbuild 修改**

`cat dist/manifest.json`
确认 content_scripts 数组里两个 entry 都在，world: MAIN 还在。

- [ ] **Step 5: 提交**

```bash
git add packages/chrome-extension/src/manifest.json packages/chrome-extension/package.json
git commit -m "build: register MAIN-world content script and bump target to chrome111"
```

---

## Task 7: 手测验证

**Files:** 无（手测，结果记录给用户）

- [ ] **Step 1: 重载插件**

在 `chrome://extensions` 找到 MCP Pointer，点刷新图标。
如果加载的是旧路径，先 remove，再 "Load unpacked" `packages/chrome-extension/dist/`。

- [ ] **Step 2: 启动 server**

```bash
cd packages/server && pnpm dev
```
（如果已在跑，跳过）

- [ ] **Step 3: 刷新目标 Vue 3 页面**

刷新 `http://localhost:5173/`（或用户的 Vue 3 项目页面），让新版 content scripts 重新注入。

- [ ] **Step 4: 在 Vue 3 页面 Option+Click 一个组件元素**

- [ ] **Step 5: 验证 state.json**

```bash
cat /tmp/mcp-pointer-shared-state.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
proc = data['data']['processedPointedDOMElement']
raw = data['data']['rawPointedDOMElement']
print('raw.componentInfo:', json.dumps(raw.get('componentInfo'), indent=2, ensure_ascii=False))
print('processed.componentInfo:', json.dumps(proc.get('componentInfo'), indent=2, ensure_ascii=False))
"
```

Expected:
- `componentInfo` **不是 null**
- `name` 是真实 Vue 组件名（例如 `ContactList`）
- `framework: 'vue'`
- `sourceFile`: 文件名（例如 `ContactList.vue`）

**如果这一步成功**，桥接修复就 work 了。

- [ ] **Step 6（可选）：测异步竞态**

在 Vue 页面快速 Option+Click 元素 A，立刻 Option+Click 元素 B（< 100ms）。
Expected: state.json 最终包含 B 的 componentInfo，不是 A 的，也不是混淆。

- [ ] **Step 7（可选）：测降级**

在 https://github.com 上 Option+Click 任意元素。
Expected: 主流程不崩；componentInfo 为 null；其他字段（selector / tagName / cssComputed）正常。

---

## Self-Review

**Spec coverage**:

| Spec 章节 | 实现位置 |
|---|---|
| 共享常量 | Task 1 |
| ISOLATED 请求方 | Task 2 |
| MAIN 响应方 | Task 3 |
| element.ts 异步化 | Task 4 |
| sendToBackground 竞态保护 | Task 5 |
| manifest + esbuild 配置 | Task 6 |
| Chrome 111+ target | Task 6 |
| 单元测试 7 例 | Task 2/3 |
| 手测金标准 | Task 7 step 5 |

**Placeholder 扫描**：每个 step 都有完整代码/命令，无 TBD 类占位。

**类型一致性**：`ExtractRequestDetail` / `ExtractResponseDetail` / `EXTRACT_*` 常量在所有 task 间命名一致；`requestComponentInfo` 签名贯穿。

无需调整。
