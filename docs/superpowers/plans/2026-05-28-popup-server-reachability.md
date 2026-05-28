# Popup Server Reachability 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** popup 上显示 server 可达性（reachable/unreachable），提供手动 Recheck 按钮。

**Architecture:** 纯函数 `checkReachability(port)` 用一次性 WebSocket 探测；`popup-manager-service` 在打开、点 Recheck、Save 后 3 个时机调用，更新 UI 三态显示。

**Tech Stack:** TypeScript + jsdom test env，jest fake timers 测超时路径。

参考 spec: `docs/superpowers/specs/2026-05-28-popup-server-reachability-design.md`

---

## 文件结构

**新增**：
- `packages/chrome-extension/src/services/server-reachability-service.ts` — 纯函数 `checkReachability(port, timeoutMs?)` (~30 行)
- `packages/chrome-extension/src/__tests__/services/server-reachability-service.test.ts` — 3 例

**修改**：
- `packages/chrome-extension/src/popup.html` — 插入 status indicator + Recheck button
- `packages/chrome-extension/src/popup.css` — 三态样式
- `packages/chrome-extension/src/services/popup-manager-service.ts` — 加 DOM 引用、setStatus、checkServer 方法；3 处触发点

---

## Task 1: `server-reachability-service`（TDD）

**Files:**
- Create: `packages/chrome-extension/src/__tests__/services/server-reachability-service.test.ts`
- Create: `packages/chrome-extension/src/services/server-reachability-service.ts`

- [ ] **Step 1: 写 3 个失败测试**

```ts
// packages/chrome-extension/src/__tests__/services/server-reachability-service.test.ts
import { checkReachability } from '../../services/server-reachability-service';

interface MockWebSocket {
  onopen?: () => void;
  onerror?: () => void;
  close: jest.Mock;
}

let mockWs: MockWebSocket;
let originalWebSocket: typeof WebSocket;

beforeEach(() => {
  originalWebSocket = (global as any).WebSocket;
  (global as any).WebSocket = jest.fn().mockImplementation(() => {
    mockWs = { close: jest.fn() };
    return mockWs;
  });
});

afterEach(() => {
  (global as any).WebSocket = originalWebSocket;
});

describe('checkReachability', () => {
  it('resolves true when WebSocket onopen fires', async () => {
    const resultPromise = checkReachability(7007);
    // Wait a microtask so the function attaches its handlers
    await Promise.resolve();
    mockWs.onopen!();
    await expect(resultPromise).resolves.toBe(true);
    expect(mockWs.close).toHaveBeenCalled();
  });

  it('resolves false when WebSocket onerror fires', async () => {
    const resultPromise = checkReachability(7007);
    await Promise.resolve();
    mockWs.onerror!();
    await expect(resultPromise).resolves.toBe(false);
  });

  it('resolves false on timeout', async () => {
    jest.useFakeTimers();
    const resultPromise = checkReachability(7007, 100);
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await expect(resultPromise).resolves.toBe(false);
    expect(mockWs.close).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: 跑测试，确认 3 个失败**

Run: `cd packages/chrome-extension && pnpm test -- server-reachability`
Expected: 3 failed, "Cannot find module"

- [ ] **Step 3: 写实现**

```ts
// packages/chrome-extension/src/services/server-reachability-service.ts
export type ReachabilityState = 'checking' | 'reachable' | 'unreachable';

export const DEFAULT_TIMEOUT_MS = 2000;

export async function checkReachability(
  port: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://localhost:${port}`);
    } catch {
      finish(false);
      return;
    }

    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      finish(false);
    }, timeoutMs);

    ws.onopen = () => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      finish(true);
    };

    ws.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
  });
}
```

- [ ] **Step 4: 跑测试，确认 3 个通过**

Run: `cd packages/chrome-extension && pnpm test -- server-reachability`
Expected: 3 passed

- [ ] **Step 5: 提交**

```bash
git add packages/chrome-extension/src/services/server-reachability-service.ts packages/chrome-extension/src/__tests__/services/server-reachability-service.test.ts
git commit -m "feat: add server reachability probe service"
```

---

## Task 2: 更新 popup.html 加 status UI

**Files:**
- Modify: `packages/chrome-extension/src/popup.html`

- [ ] **Step 1: 在 `<header>` 和 `<form>` 之间插入 status 区块**

打开 `packages/chrome-extension/src/popup.html`，在 `</header>` 后、`<form class="config-form">` 前插入：

```html
    <div class="server-status checking" id="serverStatus">
      <span class="status-indicator" id="statusIndicator">⏳</span>
      <span class="status-text" id="statusText">Checking server...</span>
      <button type="button" id="recheckBtn" class="btn-recheck">Recheck</button>
    </div>
```

完整的 body 部分应该是：

```html
<body>
  <div class="container">
    <header class="header">
      <h1>MCP Pointer Settings</h1>
    </header>

    <div class="server-status checking" id="serverStatus">
      <span class="status-indicator" id="statusIndicator">⏳</span>
      <span class="status-text" id="statusText">Checking server...</span>
      <button type="button" id="recheckBtn" class="btn-recheck">Recheck</button>
    </div>

    <form class="config-form">
      ... (existing)
    </form>

    <div class="status" id="status"></div>
  </div>

  <script src="popup.js"></script>
</body>
```

- [ ] **Step 2: 提交**

```bash
git add packages/chrome-extension/src/popup.html
git commit -m "feat: add server status UI to popup"
```

---

## Task 3: 加 popup.css 样式

**Files:**
- Modify: `packages/chrome-extension/src/popup.css`

- [ ] **Step 1: 先读现有 popup.css，找到合适位置**

```bash
cat packages/chrome-extension/src/popup.css | head -20
```

了解现有样式结构。下面的新样式追加到文件末尾即可（前面文件类成员选择器都是字符串里的内容，新增不会冲突）。

- [ ] **Step 2: 追加样式到文件末尾**

在 `packages/chrome-extension/src/popup.css` 末尾追加：

```css
.server-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 16px;
  border-radius: 6px;
  background: #f5f5f5;
  font-size: 13px;
}

.server-status.reachable {
  background: #e8f5e9;
  color: #2e7d32;
}

.server-status.unreachable {
  background: #ffebee;
  color: #c62828;
}

.server-status.checking {
  background: #f5f5f5;
  color: #666;
}

.status-text {
  flex: 1;
}

.btn-recheck {
  padding: 4px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}

.btn-recheck:hover:not(:disabled) {
  background: #fafafa;
}

.btn-recheck:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/chrome-extension/src/popup.css
git commit -m "feat: add styles for server status indicator"
```

---

## Task 4: 接入 popup-manager-service

**Files:**
- Modify: `packages/chrome-extension/src/services/popup-manager-service.ts`

- [ ] **Step 1: 读现有 popup-manager-service 全文**

```bash
cat packages/chrome-extension/src/services/popup-manager-service.ts
```

熟悉现有的字段、构造函数、方法格式。

- [ ] **Step 2: 顶部新增 import**

把第一行的 imports 之后增加：

```ts
import { checkReachability, ReachabilityState } from './server-reachability-service';
```

完整的 import 区域将变成：

```ts
import defaultConfig, { ExtensionConfig } from '../utils/config';
import logger from '../utils/logger';
import ConfigStorageService from './config-storage-service';
import { checkReachability, ReachabilityState } from './server-reachability-service';
```

- [ ] **Step 3: 类里新增字段**

在 `private status: HTMLElement;` 之后增加：

```ts
private serverStatus: HTMLElement;

private statusIndicator: HTMLElement;

private statusText: HTMLElement;

private recheckBtn: HTMLButtonElement;
```

- [ ] **Step 4: 构造函数里新增 DOM 引用**

在 `this.status = document.getElementById('status') as HTMLElement;` 之后增加：

```ts
this.serverStatus = document.getElementById('serverStatus') as HTMLElement;
this.statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
this.statusText = document.getElementById('statusText') as HTMLElement;
this.recheckBtn = document.getElementById('recheckBtn') as HTMLButtonElement;
```

- [ ] **Step 5: setupEventListeners 加 recheck listener**

修改 `setupEventListeners` 方法，追加一行：

```ts
private setupEventListeners(): void {
  this.saveBtn.addEventListener('click', () => this.saveConfig());
  this.resetBtn.addEventListener('click', () => this.resetToDefaults());
  this.recheckBtn.addEventListener('click', () => this.checkServer());
}
```

- [ ] **Step 6: loadConfig 结尾触发首次检测**

修改 `loadConfig` 方法，在 try 块 `this.portInput.value = config.websocket.port.toString();` 后追加：

```ts
this.checkServer();
```

完整方法变成：

```ts
private async loadConfig(): Promise<void> {
  try {
    const config = await ConfigStorageService.load();

    this.enabledInput.checked = config.enabled;
    this.portInput.value = config.websocket.port.toString();
    this.checkServer();
  } catch (error) {
    this.showStatus('Failed to load configuration', 'error');
    logger.error('Error loading config:', error);
  }
}
```

- [ ] **Step 7: saveConfig 成功路径末尾触发检测**

修改 `saveConfig` 方法，在 `this.showStatus('Settings saved successfully', 'success');` 后追加：

```ts
this.checkServer();
```

- [ ] **Step 8: 在类末尾添加 checkServer 和 setStatus 方法**

在 `showStatus` 方法之后、类的 `}` 之前增加：

```ts
private async checkServer(): Promise<void> {
  const port = parseInt(this.portInput.value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    this.setStatus('unreachable', `Invalid port: ${this.portInput.value}`);
    return;
  }

  this.setStatus('checking', 'Checking server...');
  const reachable = await checkReachability(port);
  this.setStatus(
    reachable ? 'reachable' : 'unreachable',
    reachable
      ? `Reachable on port ${port}`
      : `Cannot reach server on port ${port}`,
  );
}

private setStatus(state: ReachabilityState, text: string): void {
  this.serverStatus.className = `server-status ${state}`;
  let indicator: string;
  if (state === 'checking') {
    indicator = '⏳';
  } else if (state === 'reachable') {
    indicator = '🟢';
  } else {
    indicator = '🔴';
  }
  this.statusIndicator.textContent = indicator;
  this.statusText.textContent = text;
  this.recheckBtn.disabled = (state === 'checking');
}
```

- [ ] **Step 9: 跑全量测试，确认无回归**

Run: `cd packages/chrome-extension && pnpm test`
Expected: 全部通过（26 现有 + 3 新增 = 29 tests pass）

- [ ] **Step 10: 提交**

```bash
git add packages/chrome-extension/src/services/popup-manager-service.ts
git commit -m "feat: wire popup to check server reachability on open/recheck/save"
```

---

## Task 5: 手测验证

**Files:** 无（手测）

- [ ] **Step 1: 重新 build**

```bash
cd packages/chrome-extension && pnpm build
```
Expected: 无错误

- [ ] **Step 2: 重载插件**

`chrome://extensions` → MCP Pointer → 点刷新图标

- [ ] **Step 3: server 跑着时打开 popup**

确认 server 在跑（`cd packages/server && pnpm dev`）。
点击 chrome 工具栏的 MCP Pointer 图标。
Expected: popup 上半显示 🟢 `Reachable on port 7007`（绿底）

- [ ] **Step 4: 停止 server**

终端 Ctrl+C 停掉 server。
关闭 popup（点别处）。重新打开 popup。
Expected: 显示 🔴 `Cannot reach server on port 7007`（红底），≤2 秒内出结果

- [ ] **Step 5: 启动 server 后点 Recheck**

`cd packages/server && pnpm dev` 重启 server。
popup 仍开着（显示红）。点 `Recheck` 按钮。
Expected:
- 按钮立刻 disabled，显示 ⏳ `Checking server...`
- ≤2 秒内显示 🟢 `Reachable on port 7007`

- [ ] **Step 6: 改 port 为没监听的端口 → Save**

popup 里改 port 输入框为 `8888`，点 Save。
Expected: status 显示 "Settings saved successfully"，server-status 自动跳到 🔴 `Cannot reach server on port 8888`

- [ ] **Step 7: 改回正常端口**

把 port 改回 `7007`，Save。
Expected: 🟢 `Reachable on port 7007`

- [ ] **Step 8: 输入非法 port**

把 port 改成 `99999`，Save。
Expected:
- save 那行报错"Port must be a number between 1 and 65535"（已有逻辑）
- server-status 区显示什么？—— 这是个边缘案例：当 save 失败时 checkServer 不会被调用（因为 save 在 invalid port 时早 return），所以 server-status 保持之前的状态。这是 acceptable behavior。

---

## Self-Review

**Spec coverage 复核**：

| Spec 章节 | 实现位置 |
|---|---|
| 服务可达性 (reachable / unreachable) | Task 1 (`checkReachability`) |
| WebSocket 探测方式 | Task 1 (WebSocket onopen / onerror) |
| 探测时机：popup 打开 | Task 4 step 6 (`loadConfig` 末尾) |
| 探测时机：Recheck 按钮 | Task 4 step 5 (recheck listener) |
| 探测时机：Save 后 | Task 4 step 7 (`saveConfig` 末尾) |
| 三态 UI (checking / reachable / unreachable) | Task 4 step 8 (`setStatus`) |
| 端口非法处理 | Task 4 step 8 (NaN/range check) |
| Recheck 按钮 disabled 在 checking | Task 4 step 8 (`recheckBtn.disabled`) |
| 单元测试 3 例 | Task 1 |
| 手测清单 | Task 5 |

**Placeholder 扫描**：每个 step 都有具体代码 / 命令 / 路径，无 TBD。

**类型一致性**：`ReachabilityState`、`checkReachability` 签名、`DEFAULT_TIMEOUT_MS` 名称在任务间一致。

**未覆盖的 spec 提及**：
- "WebSocket 构造同步抛错"路径：在 Task 1 的实现里有 try/catch，但**没有专门测试覆盖**。这是 minor — 实际触发需要 port 越界，而我们调用前已经做了 1-65535 范围检查。Spec 写了"不在测试范围内"是合理的；如果觉得需要补，可加一个第 4 例：用 mock WebSocket 构造时抛错验证 catch path。

判断：现有 3 例已足够，跳过额外测试。
