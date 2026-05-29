# Popup Server Reachability 设计

## 背景

`dom-pointer-mcp` 的 chrome-extension popup 当前只展示三个控件：启用开关、端口、保存/重置按钮。用户**没有任何方式知道 server 是不是在跑**——只能通过"Option+Click 一个元素，看 agent 那边有没有反应"间接判断。

WebSocket 连接是按需建立的（`ElementSenderService` 在 `Option+Click` 时才连，空闲 10 秒自动断），所以"是否当前有 active WebSocket"对用户没有信息量——99% 时间都是 disconnected。

## 目标

在 popup 上显示 **server 可达性**（"我现在按 Option+Click，能传到 server 吗？"），并提供手动 Recheck 按钮。

## 非目标

- popup 关闭后的持续轮询 / 后台监控
- 强制 ElementSenderService 重建连接的按钮（按需模型下下一次 click 自然新建，按钮无用）
- 给 server 加 HTTP /health endpoint（保持只用 WebSocket）
- 显示历史发送日志、上次发送时间等
- "正在连接 / 正在发送" 这类实时状态（不是用户语言的关注点）

## 设计决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 状态语义 | 服务可达性（reachable / unreachable） | 用户真正关心的是"能不能用"，不是 WS 实时状态 |
| 探测方式 | 真实开 WebSocket，看 onopen / onerror | 与生产链路一致；不需要 server 改动 |
| 探测时机 | popup 打开 + Recheck 按钮 + 保存配置后 | 用户主动操作触发；不轮询、不常驻 |
| 失败回退 | 显示 unreachable 状态，无重试 | 重试是 ReconnectingWebSocket 在生产链路里做的事，可达性检测不重复 |

## 架构

新增一个**纯函数**模块 `server-reachability-service.ts`，导出 `checkReachability(port, timeoutMs?)` 返回 `Promise<boolean>`。`popup-manager-service.ts` 调它来更新 UI。

```
popup.html
  ├─ <status indicator>
  ├─ <Recheck button>
  └─ <existing form>

popup-manager-service.ts (orchestrator)
  ├─ checkServer()
  │   └─ checkReachability(port) ← pure function
  └─ updateStatusUI(state)
```

## 文件清单

**新增**：
- `packages/chrome-extension/src/services/server-reachability-service.ts`
- `packages/chrome-extension/src/__tests__/services/server-reachability-service.test.ts`

**修改**：
- `packages/chrome-extension/src/services/popup-manager-service.ts` — 注入 status 检查逻辑
- `packages/chrome-extension/src/popup.html` — 新增 status indicator + Recheck button
- `packages/chrome-extension/src/popup.css` — 三态样式

**不动**：
- `ElementSenderService` / `background.ts` / `content.ts` —— 0 改动
- server 包 / shared 包

## 关键代码

### `services/server-reachability-service.ts`

```ts
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
      // 端口越界等同步异常
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

设计要点：
- 单一 settled 标志避免 onopen → close 触发 onerror 重复 resolve
- `try { ws.close() }` 双重保护 close 异常
- WebSocket 构造可能同步抛错（端口非法），catch 后 resolve false
- 用 onclose 也不必要——onopen 命中后立即 close，正常路径已 resolve；onerror 处理失败路径

### `popup.html` 新增片段

放在 `<header>` 和 `<form>` 之间：

```html
<div class="server-status" id="serverStatus">
  <span class="status-indicator" id="statusIndicator">⏳</span>
  <span class="status-text" id="statusText">Checking server...</span>
  <button type="button" id="recheckBtn" class="btn-recheck">Recheck</button>
</div>
```

### `popup.css` 新增样式

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

.server-status.reachable { background: #e8f5e9; color: #2e7d32; }
.server-status.unreachable { background: #ffebee; color: #c62828; }
.server-status.checking { background: #f5f5f5; color: #666; }

.status-text { flex: 1; }

.btn-recheck {
  padding: 4px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}

.btn-recheck:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### `popup-manager-service.ts` 改动

在现有类里新增：

```ts
private serverStatus: HTMLElement;
private statusIndicator: HTMLElement;
private statusText: HTMLElement;
private recheckBtn: HTMLButtonElement;

// 构造函数追加：
this.serverStatus = document.getElementById('serverStatus') as HTMLElement;
this.statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
this.statusText = document.getElementById('statusText') as HTMLElement;
this.recheckBtn = document.getElementById('recheckBtn') as HTMLButtonElement;

// setupEventListeners 追加：
this.recheckBtn.addEventListener('click', () => this.checkServer());

// loadConfig 结尾追加：
this.checkServer();

// saveConfig 成功路径末尾追加：
this.checkServer();

private async checkServer(): Promise<void> {
  const port = parseInt(this.portInput.value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    this.setStatus('unreachable', `Invalid port: ${this.portInput.value}`);
    return;
  }

  this.setStatus('checking', 'Checking server...');
  const reachable = await checkReachability(port);
  this.setStatus(
    reachable ? 'reachable' : 'unreachable',
    reachable ? `Reachable on port ${port}` : `Cannot reach server on port ${port}`,
  );
}

private setStatus(state: ReachabilityState, text: string): void {
  this.serverStatus.className = `server-status ${state}`;
  this.statusIndicator.textContent =
    state === 'checking' ? '⏳' : state === 'reachable' ? '🟢' : '🔴';
  this.statusText.textContent = text;
  this.recheckBtn.disabled = (state === 'checking');
}
```

## 行为说明

### 触发时机
- popup 首次打开（DOMContentLoaded → 构造器 → loadConfig → checkServer）
- 用户点 Recheck 按钮
- 用户改 port 并 Save，成功保存后

### 状态显示
- `⏳ Checking server...` 灰色背景
- `🟢 Reachable on port 7007` 绿色背景
- `🔴 Cannot reach server on port 7007` 红色背景
- `🔴 Invalid port: <value>` 红色背景（端口格式不对，不发起 WebSocket）

### Recheck 按钮
- checking 状态下 disabled
- 其他状态下可点击

### 端口非法
- 不发 WebSocket（避免 WebSocket 构造异常）
- 直接显示 unreachable + 提示

### popup 关闭中
- WebSocket 会随 popup 销毁，无 leak

## 错误处理

| 场景 | 行为 |
|---|---|
| port 非数字 / 越界 | 显示 unreachable，不发 WebSocket |
| WebSocket 构造同步抛错 | catch → unreachable |
| onopen 成功但 close 抛错 | settled 标志已 set，不影响结果 |
| 2s timeout | unreachable |
| onerror 触发后 onclose 也触发 | settled 标志避免重复 resolve |

## 测试策略

### 单元测试

**`__tests__/services/server-reachability-service.test.ts`（3 例）**

1. `checkReachability` resolves true when WebSocket onopen fires
2. resolves false when WebSocket onerror fires
3. resolves false on timeout (fake timers + mock WebSocket)

Mock 策略：
```ts
let mockWs: { onopen?: () => void; onerror?: () => void; close: jest.Mock };
(global as any).WebSocket = jest.fn().mockImplementation(() => {
  mockWs = { close: jest.fn() } as any;
  return mockWs;
});
```
测试时手动触发 `mockWs.onopen!()` 或 `mockWs.onerror!()` 来模拟事件。

### 不测的部分
- `popup-manager-service.ts` 的 UI 编排：DOM 操作 + setTimeout，单元测试价值低；通过手测覆盖

### 手测清单

1. server 跑着 → 打开 popup → 显示 🟢 Reachable on port 7007
2. server 停掉 → 重新打开 popup → 显示 🔴 Cannot reach server on port 7007（≤2 秒内）
3. server 停掉 → 启动 server → 点 Recheck → 显示 🟢
4. 改 port 为没监听的端口 (8888) → Save → 自动显示 🔴 on port 8888
5. 输入非法 port (99999) → Save → 显示 Invalid port

## 不在本 spec 范围内

- 持续轮询 / 后台监控
- 强制 ElementSenderService 重建连接
- server 端 `/health` HTTP endpoint
- 上次发送时间 / 历史日志
- popup 显示 last error
- background service worker 改造

## 风险

| 风险 | 影响 | 处置 |
|---|---|---|
| Console 看到 WebSocket failed 红色 log | 视觉污染 | 只在 popup devtools 里可见，普通用户感知不到 |
| Server log 多一次连接事件 | log 噪声 | 可忽略；用户主动触发的 |
| 2s timeout 太短 / 太长 | 状态不准 / 等待感 | DEFAULT_TIMEOUT_MS 常量化，未来易调 |
| popup 打开瞬间网络抖动 → 显示假 unreachable | 误导用户 | 提供 Recheck 按钮自助 |
