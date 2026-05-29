# Selection Note Panel 设计

## 背景

当前 dom-pointer-mcp 的工作流是 "Option+Click 元素 → 立刻把数据发给 agent"。用户在 agent 那一侧仍需把"我想对这个元素做什么"重新打一遍。这一往返浪费精力，且常常出现"用户描述的元素"和"实际点中的元素"对不上。

需求改造工作流为：

1. 用户在页面上 **Option+Click 选中一个或多个元素**
2. 选中的元素旁出现一个**浮动输入面板**，里面有一个 textarea
3. 用户在 textarea 里写下"我想做什么"（例如"在按钮 A 和按钮 B 中间加分隔线"）
4. 按 Cmd/Ctrl+Enter 或点 Send → 元素信息 + 用户描述**一起**发给 agent
5. 发送后**保留选中状态和 textarea 清空**，支持继续追加描述

## 目标

- 多选元素 + 共用一个备注输入框 + 主动 Send 触发数据传输
- agent 一次拿到的 payload 包含：所有选中元素 + 用户的统一描述
- 用户描述 textarea 在 selection 全部被取消前**永远不消失**（保护内容不丢）

## 非目标

- 历史发送记录 / 多 session 管理
- 在 agent 端调用 dom-pointer-mcp 后**双向通知**（agent 修改完了不会反馈给浏览器）
- 单元素描述（已经 N 个选中后"对元素 [3] 单独说一句"——所有 elements 共享同一段 note）
- 向后兼容旧的 `RawPointedDOMElement` 单元素 wire 格式（同 monorepo 同步发版）
- 浮动面板的可拖拽 / 可缩放 / 主题切换

## 关键 UX 决策

| 维度 | 决定 |
|---|---|
| 输入框形态 | 多行 textarea，2-3 行默认高 |
| 触发显示 | 第一次有选中元素时出现，自动 focus textarea |
| Panel 位置 | 锚定**第一次选中的元素**（floating-ui 定位），之后选/取消都不重新 anchor |
| Enter 键 | 换行；Cmd/Ctrl+Enter = Send |
| 多选 | Option+Click 切换选中（toggle）；共用 1 个输入框 |
| chip 展示 | textarea 上方按选中顺序列 `[1] <button.btn-primary>` chip；带 × 按钮等价取消 |
| 取消单个 | Option+Click 该元素 或 点 chip × |
| Send 后 | textarea 清空，selection 保留（支持迭代） |
| 0 选中时 | panel 消失（textarea 内容丢失） |
| Esc / 点 panel 外 | 不消失（保护未发送内容） |
| 唯一关闭路径 | 用户主动 Option+Click 取消所有选中（或 chip × 全部取消） |
| Send 失败 | textarea 不清空，sendBtn 恢复，inline 错误提示 |

## 架构

### 新组件 vs 现有组件

```
┌── Page DOM ────────────────────────────────────────────────┐
│                                                            │
│  [Selection overlay on A]   [Selection overlay on B]      │
│  (existing OverlayManager, now multi-selection capable)   │
│                                                            │
│  ┌── NotePanel (anchored to first selected element) ────┐│
│  │  [1] <button.btn-primary> ×                          ││
│  │  [2] <input.search> ×                                ││
│  │  ┌────────────────────────────────────────────┐      ││
│  │  │ Describe changes...                        │      ││
│  │  └────────────────────────────────────────────┘      ││
│  │  Cmd+Enter to send                      [Send]       ││
│  └──────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

### 责任划分

| 组件 | 责任 |
|---|---|
| `SelectionStoreService` (新) | 维护选中元素**有序集合**；toggle / remove / clear / size；observer 回调 |
| `NotePanelService` (新) | 单例 floating panel：chip 列表 + textarea + Send；订阅 store；处理键盘 |
| `OverlayManagerService` (改) | 从单 selection overlay 扩展为多个并存（按 element 维度索引） |
| `ElementPointerService` (改) | onClick 改为 `store.toggle(target)`；不再直接 sendToBackground；新增 `sendSelection(els, note)` |
| `ElementSenderService` (改) | `sendElement` → `sendSelection`（参数和 payload 字段都变） |
| `element-processor` (server, 改) | `processFromRaw` → `processBatchFromRaw`，返回 `ProcessedPointedSelection` |
| MCP service (server, 改) | tool 返回从 `SerializedDOMElement` 单对象 → `{ userNote, elements[] }` |

### 数据流

```
旧:  Option+Click → sendToBackground(target) → server → state.json (单元素)
                                                       → MCP → agent

新:  Option+Click → SelectionStore.toggle(target)
                  → OverlayManager 增/删对应 selection overlay
                  → NotePanel 增/删 chip; 0→1 时创建 panel, N→0 时销毁
     用户输入 ───┐
     Send ─────┴→ NotePanel.handleSend()
                → element-pointer.sendSelection(elements, note)
                → extension wire SELECTION_SENT
                → server → state.json (selection 含数组 + note)
                → MCP get-pointed-element → agent
```

## 文件清单

**新增**：
- `packages/chrome-extension/src/services/selection-store-service.ts`
- `packages/chrome-extension/src/services/note-panel-service.ts`
- `packages/chrome-extension/src/__tests__/services/selection-store-service.test.ts` (5)
- `packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts` (6)
- `packages/server/src/__tests__/services/element-processor-batch.test.ts` (4) — 替换原 element-processor.test.ts

**修改**：
- `packages/shared/src/types.ts`
- `packages/chrome-extension/src/services/element-pointer-service.ts`
- `packages/chrome-extension/src/services/overlay-manager-service.ts`
- `packages/chrome-extension/src/services/element-sender-service.ts`
- `packages/chrome-extension/src/background.ts`
- `packages/chrome-extension/src/utils/element.ts`
- `packages/chrome-extension/src/styles.css` (追加 panel + chip 样式)
- `packages/server/src/types.ts`
- `packages/server/src/services/element-processor.ts`
- `packages/server/src/services/shared-state-service.ts`
- `packages/server/src/services/mcp-service.ts`
- `packages/server/src/utils/element-detail.ts` (新增 `serializeSelection`)
- `packages/server/src/message-handler.ts`
- `README.md`

**不动**：
- chrome-extension 的 manifest / popup / extractors / isolated-world / main-world / config-storage / trigger-mouse / trigger-key
- server 的 cli / start / config / logger
- 已有 26 个 chrome-extension 单元测试中除"element-processor.test.ts"外的 26 个全部不动

## 关键代码

### `shared/src/types.ts` — 新 wire format

```ts
// 保留 RawPointedDOMElement 作为单元素子结构
export interface RawPointedDOMElement { /* 不变 */ }

// 新增 selection 类型
export interface RawPointedSelection {
  url: string;
  timestamp: number;
  userNote: string;
  elements: RawPointedDOMElement[];
}

// 消息类型
export enum PointerMessageType {
  LEGACY_ELEMENT_SELECTED = 'element-selected',
  DOM_ELEMENT_POINTED = 'dom-element-pointed',  // 保留枚举值不破坏构建
  SELECTION_SENT = 'selection-sent',  // 新
}
```

### `services/selection-store-service.ts`

```ts
type Listener = (elements: HTMLElement[]) => void;

export default class SelectionStoreService {
  private elements: HTMLElement[] = [];
  private listeners = new Set<Listener>();

  toggle(el: HTMLElement): void {
    const idx = this.elements.indexOf(el);
    if (idx >= 0) this.elements.splice(idx, 1);
    else this.elements.push(el);
    this.emit();
  }

  remove(el: HTMLElement): void {
    const idx = this.elements.indexOf(el);
    if (idx >= 0) {
      this.elements.splice(idx, 1);
      this.emit();
    }
  }

  clear(): void {
    if (this.elements.length === 0) return;
    this.elements = [];
    this.emit();
  }

  getAll(): HTMLElement[] { return [...this.elements]; }
  getFirst(): HTMLElement | undefined { return this.elements[0]; }
  size(): number { return this.elements.length; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snapshot = this.getAll();
    this.listeners.forEach((fn) => fn(snapshot));
  }
}
```

### `services/note-panel-service.ts`

```ts
import { autoUpdate, computePosition, flip, shift } from '@floating-ui/dom';

const PANEL_CLASS = 'dom-pointer-mcp__note-panel';
const CHIP_CLASS = 'dom-pointer-mcp__note-chip';

export default class NotePanelService {
  private root: HTMLDivElement | null = null;
  private chipContainer!: HTMLDivElement;
  private textarea!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private errorText!: HTMLDivElement;
  private cleanupAutoUpdate: (() => void) | null = null;

  constructor(
    private store: SelectionStoreService,
    private onSend: (elements: HTMLElement[], note: string) => Promise<void>,
  ) {
    this.store.subscribe(this.handleSelectionChange.bind(this));
  }

  private handleSelectionChange(elements: HTMLElement[]): void {
    // Self-heal: panel was removed by page JS
    if (this.root && !document.body.contains(this.root)) {
      this.root = null;
      this.cleanupAutoUpdate?.();
      this.cleanupAutoUpdate = null;
    }

    if (elements.length === 0) {
      this.destroyPanel();
      return;
    }

    if (!this.root) {
      this.buildPanel(elements[0]);
    }
    this.renderChips(elements);
  }

  private buildPanel(anchorEl: HTMLElement): void {
    this.root = document.createElement('div');
    this.root.className = PANEL_CLASS;
    this.root.innerHTML = `
      <div class="dom-pointer-mcp__note-chips"></div>
      <textarea class="dom-pointer-mcp__note-textarea"
        placeholder="Describe what you want to change..."></textarea>
      <div class="dom-pointer-mcp__note-error" hidden></div>
      <div class="dom-pointer-mcp__note-footer">
        <span class="dom-pointer-mcp__note-hint">⌘/Ctrl+Enter to send</span>
        <button type="button" class="dom-pointer-mcp__note-send">Send</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.chipContainer = this.root.querySelector('.dom-pointer-mcp__note-chips')!;
    this.textarea = this.root.querySelector('textarea')!;
    this.sendBtn = this.root.querySelector('.dom-pointer-mcp__note-send')!;
    this.errorText = this.root.querySelector('.dom-pointer-mcp__note-error')!;

    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.handleSend();
      }
    });
    // Prevent capture-phase pointerdown suppression eating textarea/button events
    // (TriggerMouseService suppresses pointerdown on document in capture phase;
    // we need our own listener on panel to stopPropagation BEFORE that triggers)
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    this.root.addEventListener('click', (e) => e.stopPropagation(), true);

    Object.assign(this.root.style, {
      position: 'absolute', top: '0', left: '0', zIndex: '2147483647',
    });
    this.cleanupAutoUpdate = autoUpdate(anchorEl, this.root, async () => {
      const { x, y } = await computePosition(anchorEl, this.root!, {
        placement: 'bottom-start',
        middleware: [flip(), shift({ padding: 8 })],
      });
      Object.assign(this.root!.style, { left: `${x}px`, top: `${y}px` });
    });

    this.textarea.focus();
  }

  private renderChips(elements: HTMLElement[]): void {
    this.chipContainer.innerHTML = '';
    elements.forEach((el, idx) => {
      const chip = document.createElement('span');
      chip.className = CHIP_CLASS;
      chip.dataset.idx = String(idx);
      const tag = el.tagName.toLowerCase();
      const cls = el.classList[0] ? `.${el.classList[0]}` : '';
      chip.innerHTML = `<span>[${idx + 1}] &lt;${tag}${cls}&gt;</span>
        <button type="button" aria-label="Remove">&times;</button>`;
      chip.querySelector('button')!.addEventListener('click', () => {
        this.store.remove(el);
      });
      chip.addEventListener('mouseenter', () => el.classList.add('dom-pointer-mcp__overlay--flashing'));
      chip.addEventListener('mouseleave', () => el.classList.remove('dom-pointer-mcp__overlay--flashing'));
      this.chipContainer.appendChild(chip);
    });
  }

  private async handleSend(): Promise<void> {
    if (this.sendBtn.disabled) return;
    const elements = this.store.getAll();
    if (elements.length === 0) return;

    const note = this.textarea.value;
    this.sendBtn.disabled = true;
    this.errorText.hidden = true;

    try {
      await this.onSend(elements, note);
      this.textarea.value = '';
    } catch (err) {
      this.errorText.textContent = `Send failed: ${(err as Error).message}`;
      this.errorText.hidden = false;
    } finally {
      this.sendBtn.disabled = false;
      this.textarea.focus();
    }
  }

  private destroyPanel(): void {
    this.cleanupAutoUpdate?.();
    this.cleanupAutoUpdate = null;
    this.root?.remove();
    this.root = null;
  }
}
```

### `services/element-pointer-service.ts` 改动核心

```ts
constructor() {
  this.store = new SelectionStoreService();
  this.notePanel = new NotePanelService(
    this.store,
    (els, note) => this.sendSelection(els, note),
  );
  this.store.subscribe(this.onStoreChange.bind(this));
  // ... 其他既有初始化
}

private onClick(target: HTMLElement): void {
  this.store.toggle(target);
}

private onStoreChange(elements: HTMLElement[]): void {
  // 用 diff 增删 selection overlays（OverlayManager 改造支持多个）
  const current = this.overlayManagerService.getSelectionElements();
  current.filter((e) => !elements.includes(e))
    .forEach((e) => this.overlayManagerService.clearSelectionOverlay(e));
  elements.filter((e) => !current.includes(e))
    .forEach((e) => this.overlayManagerService.overlaySelection(e));
}

private async sendSelection(elements: HTMLElement[], note: string): Promise<void> {
  const rawElements = await Promise.all(
    elements.map((el) => extractRawPointedDOMElement(el)),
  );
  const payload: RawPointedSelection = {
    url: window.location.href,
    timestamp: Date.now(),
    userNote: note,
    elements: rawElements,
  };
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'SELECTION_SENT', data: payload },
      (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      },
    );
  });
}
```

### `OverlayManagerService` 改造

把 `Map<OverlayType, OverlayWrapper>` 拆成两条：
- `hoverOverlay: OverlayWrapper | null`（单个 hover）
- `selectionOverlays: Map<HTMLElement, OverlayWrapper>`（多个 selection）

新增方法：
- `overlaySelection(el)` / `clearSelectionOverlay(el)`
- `getSelectionElements(): HTMLElement[]`
- 现有 hover API 保持

### `styles.css` 新增

```css
.dom-pointer-mcp__note-panel {
  width: 360px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  color: #333;
}

.dom-pointer-mcp__note-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.dom-pointer-mcp__note-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #e3f2fd;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

.dom-pointer-mcp__note-chip button {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: #c62828;
  padding: 0 2px;
}

.dom-pointer-mcp__note-textarea {
  width: 100%;
  min-height: 60px;
  resize: vertical;
  box-sizing: border-box;
  padding: 6px;
  font-family: inherit;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.dom-pointer-mcp__note-error {
  color: #c62828;
  font-size: 12px;
  margin-top: 6px;
}

.dom-pointer-mcp__note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.dom-pointer-mcp__note-hint {
  color: #888;
  font-size: 11px;
}

.dom-pointer-mcp__note-send {
  padding: 4px 12px;
  background: #1976d2;
  color: white;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.dom-pointer-mcp__note-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes dom-pointer-mcp__overlay-flash {
  0%, 100% { box-shadow: 0 0 0 2px var(--dom-pointer-mcp-border-color); }
  50% { box-shadow: 0 0 0 6px var(--dom-pointer-mcp-border-color); }
}

.dom-pointer-mcp__overlay--flashing {
  animation: dom-pointer-mcp__overlay-flash 0.4s ease-in-out;
}
```

### server 端 `processBatchFromRaw`

```ts
processBatchFromRaw(raw: RawPointedSelection): ProcessedPointedSelection {
  return {
    userNote: raw.userNote,
    url: raw.url,
    timestamp: new Date(raw.timestamp).toISOString(),
    elements: raw.elements.map((el) => this.processSingleRaw(el)),
  };
}

private processSingleRaw(raw: RawPointedDOMElement): ProcessedPointedDOMElement {
  // 现有 processFromRaw 的逻辑搬过来
}
```

### MCP `getPointedSelection`

```ts
private async getPointedSelection(details: NormalizedDetailParameters) {
  const selection = await this.sharedState.getPointedSelection();
  if (!selection) {
    return { content: [{ type: 'text', text:
      'No element pointed. The user needs to Option+Click elements in their browser, write a note, and press Send.' }] };
  }
  const payload = {
    userNote: selection.userNote,
    url: selection.url,
    timestamp: selection.timestamp,
    elements: selection.elements.map((el) => serializeElement(el, details.textDetail, details.cssLevel)),
  };
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}
```

## 错误处理

| 场景 | 行为 |
|---|---|
| selection.length === 0 时按 Cmd+Enter | handleSend 早 return，不发请求 |
| Send 期间用户连点 | sendBtn disabled + handleSend 入口检查 |
| Send 失败 | textarea 不清空，sendBtn 恢复，inline error |
| 第一 anchor 元素被取消但还有选中 | panel 不重新 anchor，保持原位 |
| panel DOM 被页面 JS 移除 | handleSelectionChange 检测 `document.body.contains(this.root)`，丢失则重建 |
| 第一 anchor 元素被页面 JS 移除 | floating-ui 停止更新位置，panel 保持最后位置 |
| 选了 100 个元素 | 不限制，性能依赖浏览器 |
| 旧 chrome-extension + 新 server | server 收到 `DOM_ELEMENT_POINTED` log warn 提示升级；不兼容 |

## NotePanel 与既有事件拦截的相互作用

`TriggerMouseService` 在 document capture 阶段拦截 pointerdown/mousedown/mouseup/click。panel 内部的 textarea / button 必须能正常工作，所以 NotePanel 在自己 root 上注册 capture-phase `stopPropagation` listener，阻止事件冒泡到 document handler 之前先消化掉。

## 测试策略

### 单元测试

**`selection-store-service.test.ts`（5）**
1. toggle 添加 + 通知
2. toggle 已存在 → 移除 + 通知
3. remove 不存在 → noop
4. getFirst/getAll/size 快照正确
5. unsubscribe 解绑

**`note-panel-service.test.ts`（6）**
1. store 0→1 → panel 被 append
2. store N→0 → panel 移除
3. chip × 点击 → store.remove 调用
4. Cmd+Enter → onSend + textarea 清空
5. onSend reject → textarea 不清空，sendBtn 恢复
6. handleSend race: size===0 时早 return

**server `element-processor-batch.test.ts`（4）**
1. batch 含 2 elements → 透传 + 处理
2. userNote 透传
3. 单 element outerHTML 失败 → 只该 element 含 warnings
4. 空 elements 数组 → 防御性返回空 selection

### 不测
- OverlayManager 改造 → 手测
- ElementPointerService onClick toggle 编排 → 手测
- ElementSenderService wire 改 → 手测
- MCP getPointedSelection 返回 → 手测

### 手测清单（10 条）

1. 单选+空备注 → state.json 含 1 element + 空 userNote
2. 单选+备注 → state.json 含 userNote
3. 多选 3 个 → chip [1][2][3] → 带 userNote Send
4. 在已选 element 上 Option+Click → 该 element 消失 chip 重排
5. chip × 同上
6. 全部取消 → panel 消失 textarea 内容丢失
7. Send 后 → panel 保留 selection 保留 textarea 清空
8. Esc 不消失
9. 点页面其他地方不消失
10. First-anchor 保持：选 A→B，panel 在 A 旁；取消 A→panel 仍在 A 原位

## 不在本 spec 范围内

- 取消选中的撤销（如 Cmd+Z）
- chip 可拖拽改顺序
- 多 session / 历史
- panel 可拖拽 / 可缩放
- 备注内容持久化（页面刷新丢失）

## 风险

| 风险 | 影响 | 处置 |
|---|---|---|
| floating-ui anchor 元素消失后行为 | panel 位置漂移 | 接受 floating-ui 默认行为，保持最后位置 |
| 多个 selection overlay 性能 | 大量选中卡顿 | 不主动限制；实际场景 < 10 |
| capture-phase 事件相互干扰 | panel 内输入失效 | panel root 加 capture stopPropagation |
| Wire format 破坏性 | 旧 chrome-extension 用户升级前不工作 | server 收到旧消息 log warn 提示升级；README 红字 |
| Send 失败后内容丢失风险 | 用户输入白费 | textarea 在失败时不清空，可重发 |
