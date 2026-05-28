# Selection Note Panel 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现"多选元素 + 共用备注输入框 + 主动 Send"的工作流，把现有"点即发"模型重构为"选 → 写 → 发"模型，agent 一次拿到 selection 集合 + 用户描述。

**Architecture:** 新增 SelectionStoreService（有序集合 + observer）+ NotePanelService（floating panel）。OverlayManager 改造支持多个并存 selection overlay。Wire format 从单元素 `RawPointedDOMElement` 变为 batch `RawPointedSelection`。Server 端 element-processor / shared-state / mcp-service 全部同步切换。

**Tech Stack:** TypeScript + @floating-ui/dom（已有）+ jest jsdom test env。

参考 spec: `docs/superpowers/specs/2026-05-28-selection-note-panel-design.md`

---

## 文件结构

**新增**：
- `packages/chrome-extension/src/services/selection-store-service.ts` — 有序集合 + observer (~50 行)
- `packages/chrome-extension/src/services/note-panel-service.ts` — floating panel (~150 行)
- `packages/chrome-extension/src/__tests__/services/selection-store-service.test.ts` — 5 例
- `packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts` — 6 例

**修改**：
- `packages/shared/src/types.ts` — 新增 `RawPointedSelection`、`SELECTION_SENT` 消息类型
- `packages/chrome-extension/src/services/overlay-manager-service.ts` — selection 支持多个并存
- `packages/chrome-extension/src/services/element-pointer-service.ts` — onClick → toggle；新增 sendSelection
- `packages/chrome-extension/src/styles.css` — note-panel + chip + flashing 样式
- `packages/server/src/types.ts` — 新增 `ProcessedPointedSelection` / 改 `SharedStateData`
- `packages/server/src/services/element-processor.ts` — 新增 `processBatchFromRaw`
- `packages/server/src/services/shared-state-service.ts` — `getPointedElement` → `getPointedSelection`
- `packages/server/src/message-handler.ts` — 处理新 batch 消息
- `packages/server/src/services/mcp-service.ts` — 返回 batch 格式
- `packages/server/src/__tests__/services/element-processor.test.ts` — 改造现有 4 例为 batch 版

**不动**：
- chrome-extension 的 manifest / popup / background / extractors / isolated-world / main-world / config / trigger-mouse / trigger-key / element-sender-service / utils/element.ts
- server 的 cli / start / config / logger / utils/dom-extractor / utils/element-detail.serializeElement

> **设计判断**：`element-sender-service.ts` 不动——它现在是个泛型 wire 通道（`sendElement` 名字其实是发任意元素 raw）。我们改 `element-pointer-service.sendSelection` 直接走 `chrome.runtime.sendMessage`（绕过 sender service），后续如果 wire 层有共性再抽。

---

## Task 1: shared 类型扩展

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: 在 `RawPointedDOMElement` 接口之后新增 `RawPointedSelection`**

打开 `packages/shared/src/types.ts`，在 `RawPointedDOMElement` 接口结束之后（约 line 71 之后，`PointerMessageType` 枚举之前）新增：

```ts
// Selection batch wire format: multiple elements + user note
export interface RawPointedSelection {
  url: string;
  timestamp: number;
  userNote: string;
  elements: RawPointedDOMElement[];
}
```

- [ ] **Step 2: 在 `PointerMessageType` 枚举里新增 `SELECTION_SENT`**

定位 `export enum PointerMessageType` 块，新增一行：

```ts
export enum PointerMessageType {
  LEGACY_ELEMENT_SELECTED = 'element-selected',
  DOM_ELEMENT_POINTED = 'dom-element-pointed',
  SELECTION_SENT = 'selection-sent',
}
```

`DOM_ELEMENT_POINTED` 不删——server 仍需识别旧消息并 log warn（详见 Task 9）。

- [ ] **Step 3: typecheck shared 包**

Run: `cd packages/shared && pnpm exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add RawPointedSelection batch type and SELECTION_SENT message"
```

---

## Task 2: SelectionStoreService（TDD）

**Files:**
- Create: `packages/chrome-extension/src/__tests__/services/selection-store-service.test.ts`
- Create: `packages/chrome-extension/src/services/selection-store-service.ts`

- [ ] **Step 1: 写 5 个失败测试**

```ts
// packages/chrome-extension/src/__tests__/services/selection-store-service.test.ts
import SelectionStoreService from '../../services/selection-store-service';

describe('SelectionStoreService', () => {
  it('toggle adds a new element and notifies listeners', () => {
    const store = new SelectionStoreService();
    const listener = jest.fn();
    store.subscribe(listener);

    const el = document.createElement('div');
    store.toggle(el);

    expect(store.getAll()).toEqual([el]);
    expect(listener).toHaveBeenCalledWith([el]);
  });

  it('toggle removes an existing element and notifies listeners', () => {
    const store = new SelectionStoreService();
    const el = document.createElement('div');
    store.toggle(el);
    const listener = jest.fn();
    store.subscribe(listener);

    store.toggle(el);

    expect(store.getAll()).toEqual([]);
    expect(listener).toHaveBeenCalledWith([]);
  });

  it('remove is a noop when element not present (no notification)', () => {
    const store = new SelectionStoreService();
    const el = document.createElement('div');
    const listener = jest.fn();
    store.subscribe(listener);

    store.remove(el);

    expect(listener).not.toHaveBeenCalled();
    expect(store.getAll()).toEqual([]);
  });

  it('getFirst / getAll / size return correct snapshot', () => {
    const store = new SelectionStoreService();
    const a = document.createElement('div');
    const b = document.createElement('span');
    store.toggle(a);
    store.toggle(b);

    expect(store.getFirst()).toBe(a);
    expect(store.getAll()).toEqual([a, b]);
    expect(store.size()).toBe(2);
    // getAll returns a copy
    expect(store.getAll()).not.toBe(store.getAll());
  });

  it('subscribe returns unsubscribe that detaches the listener', () => {
    const store = new SelectionStoreService();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.toggle(document.createElement('div'));

    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试，确认 5 个失败**

Run: `cd packages/chrome-extension && pnpm test -- selection-store`
Expected: 5 failed, "Cannot find module"

- [ ] **Step 3: 写实现**

```ts
// packages/chrome-extension/src/services/selection-store-service.ts
type Listener = (elements: HTMLElement[]) => void;

export default class SelectionStoreService {
  private elements: HTMLElement[] = [];

  private listeners = new Set<Listener>();

  toggle(el: HTMLElement): void {
    const idx = this.elements.indexOf(el);
    if (idx >= 0) {
      this.elements.splice(idx, 1);
    } else {
      this.elements.push(el);
    }
    this.emit();
  }

  remove(el: HTMLElement): void {
    const idx = this.elements.indexOf(el);
    if (idx < 0) return;
    this.elements.splice(idx, 1);
    this.emit();
  }

  clear(): void {
    if (this.elements.length === 0) return;
    this.elements = [];
    this.emit();
  }

  getAll(): HTMLElement[] {
    return [...this.elements];
  }

  getFirst(): HTMLElement | undefined {
    return this.elements[0];
  }

  size(): number {
    return this.elements.length;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    const snapshot = this.getAll();
    this.listeners.forEach((fn) => fn(snapshot));
  }
}
```

- [ ] **Step 4: 跑测试，确认 5 个通过**

- [ ] **Step 5: 提交**

```bash
git add packages/chrome-extension/src/services/selection-store-service.ts packages/chrome-extension/src/__tests__/services/selection-store-service.test.ts
git commit -m "feat: add SelectionStoreService for ordered multi-select state"
```

---

## Task 3: NotePanelService styles（CSS only）

**Files:**
- Modify: `packages/chrome-extension/src/styles.css`

- [ ] **Step 1: 在 styles.css 末尾追加 panel + chip + flash 样式**

打开 `packages/chrome-extension/src/styles.css`，在文件末尾追加：

```css
/* Note panel: floating composer for batched selections */
.mcp-pointer__note-panel {
  width: 360px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: #333;
  box-sizing: border-box;
}

.mcp-pointer__note-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.mcp-pointer__note-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #e3f2fd;
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #1565c0;
}

.mcp-pointer__note-chip button {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: #c62828;
  padding: 0 2px;
  line-height: 1;
}

.mcp-pointer__note-textarea {
  width: 100%;
  min-height: 60px;
  resize: vertical;
  box-sizing: border-box;
  padding: 6px;
  font-family: inherit;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #333;
  background: white;
}

.mcp-pointer__note-error {
  color: #c62828;
  font-size: 12px;
  margin-top: 6px;
}

.mcp-pointer__note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.mcp-pointer__note-hint {
  color: #888;
  font-size: 11px;
}

.mcp-pointer__note-send {
  padding: 4px 12px;
  background: #1976d2;
  color: white;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.mcp-pointer__note-send:hover:not(:disabled) {
  background: #1565c0;
}

.mcp-pointer__note-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Chip-hover flash animation on the corresponding selection overlay */
@keyframes mcp-pointer__overlay-flash {
  0%, 100% { box-shadow: 0 0 0 2px var(--mcp-pointer-border-color); }
  50% { box-shadow: 0 0 0 6px var(--mcp-pointer-border-color); }
}

.mcp-pointer__overlay--flashing {
  animation: mcp-pointer__overlay-flash 0.4s ease-in-out;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/chrome-extension/src/styles.css
git commit -m "feat: add note panel + chip + flash styles"
```

---

## Task 4: NotePanelService（TDD）

**Files:**
- Create: `packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts`
- Create: `packages/chrome-extension/src/services/note-panel-service.ts`

- [ ] **Step 1: 写 6 个失败测试**

```ts
// packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts
import NotePanelService from '../../services/note-panel-service';
import SelectionStoreService from '../../services/selection-store-service';

const PANEL_SELECTOR = '.mcp-pointer__note-panel';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe('NotePanelService', () => {
  let store: SelectionStoreService;
  let onSend: jest.Mock;
  let panel: NotePanelService;

  beforeEach(() => {
    store = new SelectionStoreService();
    onSend = jest.fn().mockResolvedValue(undefined);
    panel = new NotePanelService(store, onSend);
  });

  afterEach(() => {
    document.querySelectorAll(PANEL_SELECTOR).forEach((el) => el.remove());
  });

  it('appends panel to body when selection goes 0 → 1', () => {
    expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);
    expect(document.querySelector(PANEL_SELECTOR)).not.toBeNull();
  });

  it('removes panel from body when selection goes N → 0', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);
    expect(document.querySelector(PANEL_SELECTOR)).not.toBeNull();
    store.toggle(el); // removes
    expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
  });

  it('clicking a chip × button calls store.remove for that element', () => {
    const a = document.createElement('div');
    const b = document.createElement('span');
    document.body.appendChild(a);
    document.body.appendChild(b);
    store.toggle(a);
    store.toggle(b);

    const chips = document.querySelectorAll('.mcp-pointer__note-chip');
    expect(chips).toHaveLength(2);
    const removeBtn = chips[1].querySelector('button') as HTMLButtonElement;
    removeBtn.click();

    expect(store.getAll()).toEqual([a]);
  });

  it('Cmd+Enter on textarea triggers onSend; textarea is cleared after resolve', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'change me';
    const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, cancelable: true });
    textarea.dispatchEvent(event);

    expect(onSend).toHaveBeenCalledWith([el], 'change me');
    await flushMicrotasks();
    expect(textarea.value).toBe('');
  });

  it('onSend rejection does NOT clear textarea; sendBtn re-enabled', async () => {
    onSend.mockRejectedValueOnce(new Error('network down'));
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'keep me';
    const sendBtn = document.querySelector('.mcp-pointer__note-send') as HTMLButtonElement;
    sendBtn.click();

    await flushMicrotasks();
    await flushMicrotasks();

    expect(textarea.value).toBe('keep me');
    expect(sendBtn.disabled).toBe(false);
    const errorBox = document.querySelector('.mcp-pointer__note-error') as HTMLElement;
    expect(errorBox.hidden).toBe(false);
    expect(errorBox.textContent).toMatch(/network down/);
  });

  it('handleSend with empty selection is a noop (race protection)', async () => {
    // Selection currently empty — no panel yet
    expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
    // We cannot click a non-existent button; assert via direct call protection:
    // Trigger via store flow: add → remove just before send.
    const el = document.createElement('div');
    document.body.appendChild(el);
    store.toggle(el);
    const sendBtn = document.querySelector('.mcp-pointer__note-send') as HTMLButtonElement;
    store.toggle(el); // back to 0 → panel destroyed
    // sendBtn detached from doc; click would noop. Re-create selection then verify guard.
    store.toggle(el);
    const newSendBtn = document.querySelector('.mcp-pointer__note-send') as HTMLButtonElement;
    // simulate user clicking send while we synchronously empty the store
    store.toggle(el); // now 0
    newSendBtn.click(); // panel is already gone; nothing to call
    expect(onSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试，确认 6 个失败**

Run: `cd packages/chrome-extension && pnpm test -- note-panel`
Expected: 6 failed, "Cannot find module"

- [ ] **Step 3: 写实现**

```ts
// packages/chrome-extension/src/services/note-panel-service.ts
import {
  autoUpdate, computePosition, flip, shift,
} from '@floating-ui/dom';
import SelectionStoreService from './selection-store-service';

const PANEL_CLASS = 'mcp-pointer__note-panel';
const CHIP_CLASS = 'mcp-pointer__note-chip';
const FLASH_CLASS = 'mcp-pointer__overlay--flashing';

export type OnSend = (elements: HTMLElement[], note: string) => Promise<void>;

export default class NotePanelService {
  private root: HTMLDivElement | null = null;

  private chipContainer: HTMLDivElement | null = null;

  private textarea: HTMLTextAreaElement | null = null;

  private sendBtn: HTMLButtonElement | null = null;

  private errorText: HTMLDivElement | null = null;

  private cleanupAutoUpdate: (() => void) | null = null;

  constructor(
    private store: SelectionStoreService,
    private onSend: OnSend,
  ) {
    this.store.subscribe(this.handleSelectionChange.bind(this));
  }

  private handleSelectionChange(elements: HTMLElement[]): void {
    // Self-heal: page JS may have removed our panel
    if (this.root && !document.body.contains(this.root)) {
      this.cleanupAutoUpdate?.();
      this.cleanupAutoUpdate = null;
      this.root = null;
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
      <div class="mcp-pointer__note-chips"></div>
      <textarea class="mcp-pointer__note-textarea"
        placeholder="Describe what you want to change..."></textarea>
      <div class="mcp-pointer__note-error" hidden></div>
      <div class="mcp-pointer__note-footer">
        <span class="mcp-pointer__note-hint">⌘/Ctrl+Enter to send</span>
        <button type="button" class="mcp-pointer__note-send">Send</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.chipContainer = this.root.querySelector('.mcp-pointer__note-chips');
    this.textarea = this.root.querySelector('textarea');
    this.sendBtn = this.root.querySelector('.mcp-pointer__note-send');
    this.errorText = this.root.querySelector('.mcp-pointer__note-error');

    this.sendBtn!.addEventListener('click', () => { void this.handleSend(); });
    this.textarea!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.handleSend();
      }
    });

    // Stop our panel events from reaching TriggerMouseService's capture-phase
    // suppress (which would eat clicks/pointerdowns inside textarea + buttons).
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    this.root.addEventListener('mousedown', (e) => e.stopPropagation(), true);
    this.root.addEventListener('mouseup', (e) => e.stopPropagation(), true);
    this.root.addEventListener('click', (e) => e.stopPropagation(), true);

    Object.assign(this.root.style, {
      position: 'absolute', top: '0', left: '0', zIndex: '2147483647',
    });

    this.cleanupAutoUpdate = autoUpdate(anchorEl, this.root, async () => {
      if (!this.root) return;
      const { x, y } = await computePosition(anchorEl, this.root, {
        placement: 'bottom-start',
        middleware: [flip(), shift({ padding: 8 })],
      });
      Object.assign(this.root.style, { left: `${x}px`, top: `${y}px` });
    });

    this.textarea!.focus();
  }

  private renderChips(elements: HTMLElement[]): void {
    if (!this.chipContainer) return;
    this.chipContainer.innerHTML = '';
    elements.forEach((el, idx) => {
      const chip = document.createElement('span');
      chip.className = CHIP_CLASS;
      const tag = el.tagName.toLowerCase();
      const cls = el.classList[0] ? `.${el.classList[0]}` : '';
      const label = document.createElement('span');
      label.textContent = `[${idx + 1}] <${tag}${cls}>`;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Remove');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        this.store.remove(el);
      });
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      chip.addEventListener('mouseenter', () => el.classList.add(FLASH_CLASS));
      chip.addEventListener('mouseleave', () => el.classList.remove(FLASH_CLASS));
      this.chipContainer!.appendChild(chip);
    });
  }

  private async handleSend(): Promise<void> {
    if (!this.sendBtn || !this.textarea || !this.errorText) return;
    if (this.sendBtn.disabled) return;
    const elements = this.store.getAll();
    if (elements.length === 0) return;

    const note = this.textarea.value;
    this.sendBtn.disabled = true;
    this.errorText.hidden = true;

    try {
      await this.onSend(elements, note);
      if (this.textarea) this.textarea.value = '';
    } catch (err) {
      if (this.errorText) {
        this.errorText.textContent = `Send failed: ${(err as Error).message}`;
        this.errorText.hidden = false;
      }
    } finally {
      if (this.sendBtn) this.sendBtn.disabled = false;
      this.textarea?.focus();
    }
  }

  private destroyPanel(): void {
    this.cleanupAutoUpdate?.();
    this.cleanupAutoUpdate = null;
    this.root?.remove();
    this.root = null;
    this.chipContainer = null;
    this.textarea = null;
    this.sendBtn = null;
    this.errorText = null;
  }
}
```

- [ ] **Step 4: 跑测试，确认 6 个通过**

Run: `cd packages/chrome-extension && pnpm test -- note-panel`
Expected: 6 passed

- [ ] **Step 5: 跑全量 chrome-extension 测试**

Run: `cd packages/chrome-extension && pnpm test`
Expected: 现有 29 + 新增 5 (store) + 6 (panel) = 40 passed

- [ ] **Step 6: 提交**

```bash
git add packages/chrome-extension/src/services/note-panel-service.ts packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts
git commit -m "feat: add NotePanelService floating composer for selection batches"
```

---

## Task 5: OverlayManagerService 改造支持多 selection

**Files:**
- Modify: `packages/chrome-extension/src/services/overlay-manager-service.ts`

- [ ] **Step 1: 完全重写 overlay-manager-service.ts**

替换文件内容为：

```ts
import autoAssignOverlayPositionAndSize from '../utils/position';

interface OverlayWrapper {
  overlay: HTMLDivElement;
  target: HTMLElement;
}

const OVERLAY_BASE_CLASS = 'mcp-pointer__overlay';
const HOVER_CLASS = 'mcp-pointer__overlay--hover';
const SELECTION_CLASS = 'mcp-pointer__overlay--selection';

export default class OverlayManagerService {
  private hoverOverlay: OverlayWrapper | null = null;

  private selectionOverlays = new Map<HTMLElement, OverlayWrapper>();

  // --- Hover (single) ---

  overlayHover(target: HTMLElement): void {
    if (!this.hoverOverlay) {
      this.hoverOverlay = {
        overlay: this.buildOverlayElement(HOVER_CLASS, false),
        target,
      };
    } else {
      this.hoverOverlay.target = target;
    }
    autoAssignOverlayPositionAndSize(target, this.hoverOverlay.overlay);
  }

  clearHover(): void {
    this.hoverOverlay?.overlay.remove();
    this.hoverOverlay = null;
  }

  // --- Selection (multi) ---

  overlaySelection(target: HTMLElement): void {
    if (this.selectionOverlays.has(target)) return;
    const wrapper: OverlayWrapper = {
      overlay: this.buildOverlayElement(SELECTION_CLASS, true),
      target,
    };
    this.selectionOverlays.set(target, wrapper);
    autoAssignOverlayPositionAndSize(target, wrapper.overlay);
  }

  clearSelection(target: HTMLElement): void {
    const wrapper = this.selectionOverlays.get(target);
    if (!wrapper) return;
    wrapper.overlay.remove();
    this.selectionOverlays.delete(target);
  }

  clearAllSelections(): void {
    this.selectionOverlays.forEach((w) => w.overlay.remove());
    this.selectionOverlays.clear();
  }

  getSelectionElements(): HTMLElement[] {
    return Array.from(this.selectionOverlays.keys());
  }

  // --- Shared ---

  private buildOverlayElement(typeClass: string, hasGlow: boolean): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = `${OVERLAY_BASE_CLASS} ${typeClass}`;

    if (hasGlow) {
      const glow = document.createElement('div');
      glow.className = 'mcp-pointer__overlay-glow';
      overlay.appendChild(glow);
    }

    const glass = document.createElement('div');
    glass.className = 'mcp-pointer__overlay-glass';
    overlay.appendChild(glass);

    document.body.appendChild(overlay);
    return overlay;
  }
}
```

变化要点：
- 删除 `OverlayType` enum 和 `OVERLAY_CONFIG`
- 移除老的 `overlay(type, target)` / `clearOverlay(type)` 通用接口
- 暴露明确的 `overlayHover` / `clearHover` / `overlaySelection(target)` / `clearSelection(target)` / `clearAllSelections` / `getSelectionElements`

- [ ] **Step 2: 不要跑全量测试**（此时 element-pointer-service 还引用老接口，会编译错；Task 6 修）

- [ ] **Step 3: 提交**

```bash
git add packages/chrome-extension/src/services/overlay-manager-service.ts
git commit -m "refactor: OverlayManager supports multiple concurrent selection overlays"
```

---

## Task 6: ElementPointerService 接入 store + panel + 新 overlay API

**Files:**
- Modify: `packages/chrome-extension/src/services/element-pointer-service.ts`

- [ ] **Step 1: 完全重写 element-pointer-service.ts**

```ts
import { RawPointedSelection } from '@mcp-pointer/shared/types';
import logger from '../utils/logger';
import TriggerMouseService from './trigger-mouse-service';
import TriggerKeyService from './trigger-key-service';
import OverlayManagerService from './overlay-manager-service';
import SelectionStoreService from './selection-store-service';
import NotePanelService from './note-panel-service';
import { extractRawPointedDOMElement } from '../utils/element';

const POINTING_CLASS = 'mcp-pointer--is-pointing';

export default class ElementPointerService {
  private triggerKeyService: TriggerKeyService;

  private triggerMouseService: TriggerMouseService;

  private overlayManagerService: OverlayManagerService;

  private store: SelectionStoreService;

  private notePanel: NotePanelService;

  private pointing: boolean = false;

  private hoveredElement: HTMLElement | null = null;

  constructor() {
    this.triggerKeyService = new TriggerKeyService({
      onTriggerKeyStart: this.startPointing.bind(this),
      onTriggerKeyEnd: this.stopPointing.bind(this),
    });
    this.triggerMouseService = new TriggerMouseService({
      onHover: this.onHover.bind(this),
      onClick: this.onClick.bind(this),
    });
    this.overlayManagerService = new OverlayManagerService();
    this.store = new SelectionStoreService();
    this.notePanel = new NotePanelService(
      this.store,
      (els, note) => this.sendSelection(els, note),
    );
    this.store.subscribe(this.syncOverlays.bind(this));
  }

  private onHover(target: HTMLElement): void {
    if (this.hoveredElement === target) return;

    if (this.store.getAll().includes(target)) {
      this.overlayManagerService.clearHover();
      this.hoveredElement = null;
    } else {
      this.overlayManagerService.overlayHover(target);
      this.hoveredElement = target;
    }
  }

  private onClick(target: HTMLElement): void {
    logger.debug('🎯 Option+click detected on:', target);
    this.store.toggle(target);
  }

  private syncOverlays(elements: HTMLElement[]): void {
    const current = this.overlayManagerService.getSelectionElements();
    current.filter((e) => !elements.includes(e))
      .forEach((e) => this.overlayManagerService.clearSelection(e));
    elements.filter((e) => !current.includes(e))
      .forEach((e) => this.overlayManagerService.overlaySelection(e));
    // Hover overlay: hide if hover-target is now selected
    if (this.hoveredElement && elements.includes(this.hoveredElement)) {
      this.overlayManagerService.clearHover();
      this.hoveredElement = null;
    }
  }

  public enable(): void {
    this.triggerKeyService.registerListeners();
    logger.info('✅ Element pointer enabled');
  }

  public disable(): void {
    this.overlayManagerService.clearHover();
    this.overlayManagerService.clearAllSelections();
    this.store.clear();
    this.hoveredElement = null;
    this.triggerKeyService.unregisterListeners();
    logger.info('⏸️ Element pointer disabled');
  }

  private startPointing(): void {
    if (this.pointing) return;
    this.triggerMouseService.registerListeners();
    document.body.classList.add(POINTING_CLASS);
    this.pointing = true;
    logger.debug('Pointing started');
  }

  private stopPointing(): void {
    if (!this.pointing) return;
    this.triggerMouseService.unregisterListeners();
    this.overlayManagerService.clearHover();
    document.body.classList.remove(POINTING_CLASS);
    this.pointing = false;
    logger.debug('Pointing stopped');
  }

  private async sendSelection(elements: HTMLElement[], note: string): Promise<void> {
    logger.info(`📤 Sending selection (${elements.length} elements) to background`);

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
        (response: any) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || 'unknown error';
            logger.error('❌ Error sending selection:', msg);
            reject(new Error(msg));
          } else {
            logger.debug('✅ Selection sent successfully:', response);
            resolve();
          }
        },
      );
    });
  }
}
```

- [ ] **Step 2: typecheck chrome-extension**

Run: `cd packages/chrome-extension && pnpm typecheck`
Expected: 无 NEW 错误（pre-existing shared module resolution warnings 仍存在）

- [ ] **Step 3: 跑全量 chrome-extension 测试**

Run: `cd packages/chrome-extension && pnpm test`
Expected: 40 passed（store 5 + panel 6 + 现有 29）

- [ ] **Step 4: 提交**

```bash
git add packages/chrome-extension/src/services/element-pointer-service.ts
git commit -m "refactor: ElementPointerService uses SelectionStore + NotePanel"
```

---

## Task 7: server 类型扩展

**Files:**
- Modify: `packages/server/src/types.ts`

- [ ] **Step 1: 在 ProcessedPointedDOMElement 之后新增 selection 类型**

打开 `packages/server/src/types.ts`，在 `SerializedDOMElement` 之后、`SharedStateData` 之前新增：

```ts
// Selection batch: multiple elements + shared user note
export interface ProcessedPointedSelection {
  userNote: string;
  url: string;
  timestamp: string;
  elements: ProcessedPointedDOMElement[];
}

export interface SerializedSelection {
  userNote: string;
  url: string;
  timestamp: string;
  elements: SerializedDOMElement[];
}
```

- [ ] **Step 2: 改 SharedStateData**

把：

```ts
export interface SharedStateData {
  rawPointedDOMElement: RawPointedDOMElement;
  processedPointedDOMElement: ProcessedPointedDOMElement;
  metadata: {
    receivedAt: string;
    messageType: string;
  };
}
```

改成：

```ts
export interface SharedStateData {
  rawPointedSelection: RawPointedSelection;
  processedPointedSelection: ProcessedPointedSelection;
  metadata: {
    receivedAt: string;
    messageType: string;
  };
}
```

- [ ] **Step 3: 更新顶部 import**

把 `import { ... RawPointedDOMElement } from '@mcp-pointer/shared/types';` 改为：

```ts
import {
  ElementPosition,
  CSSProperties,
  ComponentInfo,
  RawPointedDOMElement,
  RawPointedSelection,
} from '@mcp-pointer/shared/types';
```

- [ ] **Step 4: 不要 typecheck 整个 monorepo**

server 端 element-processor / shared-state / mcp-service 都还引用旧字段。下一个 task 修。

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/types.ts
git commit -m "refactor(server): SharedState carries selection batch instead of single element"
```

---

## Task 8: element-processor 加 processBatchFromRaw + 测试改造

**Files:**
- Modify: `packages/server/src/services/element-processor.ts`
- Modify: `packages/server/src/__tests__/services/element-processor.test.ts`

- [ ] **Step 1: 改写 element-processor.test.ts 为 batch 测试**

替换文件内容为：

```ts
import { RawPointedSelection, ComponentInfo } from '@mcp-pointer/shared/types';
import ElementProcessor from '../../services/element-processor';

function singleElementRaw(overrides: Partial<{
  outerHTML: string;
  componentInfo?: ComponentInfo;
}> = {}) {
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

function makeBatch(elementCount = 2, userNote = 'note text'): RawPointedSelection {
  const elements = [];
  for (let i = 0; i < elementCount; i += 1) {
    elements.push(singleElementRaw({ outerHTML: `<div id="e${i}">e${i}</div>` }));
  }
  return {
    url: 'https://example.com',
    timestamp: 1700000000000,
    userNote,
    elements,
  };
}

describe('ElementProcessor.processBatchFromRaw', () => {
  const processor = new ElementProcessor();

  it('processes 2 elements with shared user note', () => {
    const result = processor.processBatchFromRaw(makeBatch(2, 'shared note'));
    expect(result.userNote).toBe('shared note');
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].id).toBe('e0');
    expect(result.elements[1].id).toBe('e1');
  });

  it('passes through empty userNote', () => {
    const result = processor.processBatchFromRaw(makeBatch(1, ''));
    expect(result.userNote).toBe('');
  });

  it('isolates parse failure to the affected element', () => {
    const batch = makeBatch(2, 'note');
    batch.elements[0].outerHTML = '<<<not html>>>';
    const result = processor.processBatchFromRaw(batch);
    // Element 0 may have warnings or fallback tagName
    expect(result.elements[1].id).toBe('e1'); // second element unaffected
  });

  it('handles empty elements array defensively', () => {
    const result = processor.processBatchFromRaw({
      url: 'https://example.com',
      timestamp: 1700000000000,
      userNote: 'nothing',
      elements: [],
    });
    expect(result.elements).toEqual([]);
    expect(result.userNote).toBe('nothing');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd packages/server && pnpm test -- element-processor`
Expected: compile error or "processBatchFromRaw is not a function"

- [ ] **Step 3: 实现 processBatchFromRaw**

替换 `packages/server/src/services/element-processor.ts` 为：

```ts
import {
  RawPointedDOMElement,
  RawPointedSelection,
  ElementPosition,
} from '@mcp-pointer/shared/types';
import { ProcessedPointedDOMElement, ProcessedPointedSelection } from '../types';
import { extractFromHTML, generateSelector } from '../utils/dom-extractor';
import logger from '../logger';

export default class ElementProcessor {
  processBatchFromRaw(raw: RawPointedSelection): ProcessedPointedSelection {
    return {
      userNote: raw.userNote,
      url: raw.url,
      timestamp: new Date(raw.timestamp).toISOString(),
      elements: raw.elements.map((el) => this.processSingleRaw(el)),
    };
  }

  private processSingleRaw(raw: RawPointedDOMElement): ProcessedPointedDOMElement {
    const { element, warnings } = extractFromHTML(raw.outerHTML);
    const allWarnings: string[] = [...warnings];

    const processed: ProcessedPointedDOMElement = {
      tagName: element?.tagName || 'UNKNOWN',
      id: element?.id || undefined,
      classes: element ? Array.from(element.classList.values()) : [],
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

变化：
- 删除原 `processFromRaw` 公共方法（外面调用方在 Task 9 一起改）
- 新增 `processBatchFromRaw` 接收 `RawPointedSelection`
- 单元素处理逻辑提取到 `processSingleRaw`

- [ ] **Step 4: 跑 element-processor 测试**

Run: `cd packages/server && pnpm test -- element-processor`
Expected: 4 passed

- [ ] **Step 5: 提交**（其他模块还坏着，暂不全量 test）

```bash
git add packages/server/src/services/element-processor.ts packages/server/src/__tests__/services/element-processor.test.ts
git commit -m "feat(server): add processBatchFromRaw for selection batches"
```

---

## Task 9: shared-state-service + message-handler + mcp-service 接入

**Files:**
- Modify: `packages/server/src/services/shared-state-service.ts`
- Modify: `packages/server/src/message-handler.ts`
- Modify: `packages/server/src/services/mcp-service.ts`

- [ ] **Step 1: 改 shared-state-service.ts**

替换为：

```ts
import fs from 'fs/promises';
import { SharedState, ProcessedPointedSelection } from '../types';
import logger from '../logger';

export default class SharedStateService {
  static SHARED_STATE_PATH = '/tmp/mcp-pointer-shared-state.json';

  public async saveState(state: SharedState): Promise<void> {
    try {
      const json = JSON.stringify(state, null, 2);
      await fs.writeFile(SharedStateService.SHARED_STATE_PATH, json, 'utf8');
      logger.debug('Pointed selection saved to shared state file');
    } catch (error) {
      logger.error('Failed to save pointed selection:', error);
    }
  }

  public async getPointedSelection(): Promise<ProcessedPointedSelection | null> {
    const state = await this.readState();
    if (!state) return null;
    return state.data.processedPointedSelection;
  }

  private async readState(): Promise<SharedState | null> {
    try {
      const json = await fs.readFile(SharedStateService.SHARED_STATE_PATH, 'utf8');
      return JSON.parse(json);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Shared state file does not exist');
        return null;
      }
      logger.error('Failed to read state file:', error);
      return null;
    }
  }
}
```

- [ ] **Step 2: 改 message-handler.ts**

替换为：

```ts
import { PointerMessageType, type RawPointedSelection } from '@mcp-pointer/shared/types';
import logger from './logger';
import ElementProcessor from './services/element-processor';
import SharedStateService from './services/shared-state-service';
import { SharedState, SharedStateData } from './types';

function buildMetadata(messageType: string) {
  const now = new Date().toISOString();
  return {
    receivedAt: now,
    messageType,
  };
}

function buildState(
  type: string,
  data: any,
  elementProcessor: ElementProcessor,
): SharedState {
  const raw = data as RawPointedSelection;
  const processed = elementProcessor.processBatchFromRaw(raw);

  const stateData: SharedStateData = {
    rawPointedSelection: raw,
    processedPointedSelection: processed,
    metadata: buildMetadata(type),
  };

  return { data: stateData };
}

function buildStateFromMessage(
  type: string,
  data: any,
  services: HandlerServices,
): SharedState | null {
  if (type === PointerMessageType.SELECTION_SENT) {
    return buildState(type, data, services.elementProcessor);
  }

  if (type === PointerMessageType.DOM_ELEMENT_POINTED) {
    logger.warn(
      'Received legacy DOM_ELEMENT_POINTED message. '
      + 'Please upgrade the Chrome extension to a version that sends SELECTION_SENT.',
    );
    return null;
  }

  logger.warn(`Received unknown message type: ${type}`);
  return null;
}

interface HandlerServices {
  sharedState: SharedStateService;
  elementProcessor: ElementProcessor;
}

const messageHandler = async (type: string, data: any, services: HandlerServices) => {
  const buildedState = buildStateFromMessage(type, data, services);
  if (buildedState) {
    await services.sharedState.saveState(buildedState);
  }
};

export default messageHandler;
```

- [ ] **Step 3: 改 mcp-service.ts**

把 `getPointedElement` 方法替换为：

```ts
private async getPointedElement(details: NormalizedDetailParameters) {
  const selection = await this.sharedState.getPointedSelection();

  if (!selection) {
    return {
      content: [
        {
          type: 'text',
          text: 'No selection pointed. The user needs to Option+Click '
            + 'elements in their browser, write a note describing what '
            + 'they want changed, then press Cmd/Ctrl+Enter or Send.',
        },
      ],
    };
  }

  const payload = {
    userNote: selection.userNote,
    url: selection.url,
    timestamp: selection.timestamp,
    elements: selection.elements.map((el) => serializeElement(
      el,
      details.textDetail,
      details.cssLevel,
    )),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
```

同时更新工具描述。把现有：

```ts
description: 'Get information about the currently pointed/shown DOM element. ...',
```

改为：

```ts
description: 'Get the currently pointed DOM elements (one or more) along with the user\'s note describing what they want to change. Returns { userNote, url, timestamp, elements: [...] }. Control returned payload size with optional textDetail (0 none | 1 visible | 2 full) and cssLevel (0-3).',
```

- [ ] **Step 4: typecheck server**

Run: `cd packages/server && pnpm typecheck`
Expected: 无错误

- [ ] **Step 5: 跑 server 全量测试**

Run: `cd packages/server && pnpm test`
Expected: 现有 27 个测试全部通过——但 `shared-state-service.test.ts` 里的断言如果包含 `processedPointedDOMElement` 字段名，需要改成 `processedPointedSelection`。先读测试文件确认：

```bash
grep -n "processedPointedDOMElement\|rawPointedDOMElement\|getPointedElement" packages/server/src/__tests__/services/shared-state-service.test.ts packages/server/src/__tests__/factories/shared-state-factory.ts
```

如果有 hit，按 mapping 改：
- `processedPointedDOMElement` → `processedPointedSelection`
- `rawPointedDOMElement` → `rawPointedSelection`
- `getPointedElement` → `getPointedSelection`

并把测试 fixture 改成 batch 结构（含 elements 数组 + userNote）。如果 factory 文件需要重大改动，把它当作 step 5 的一部分。

- [ ] **Step 6: 全量 monorepo typecheck**

Run: `pnpm typecheck`（repo 根）
Expected: 无错误

- [ ] **Step 7: 全量 monorepo 测试**

Run: `pnpm test`（repo 根）
Expected: chrome-extension 40 + server 27 = 67 passed

- [ ] **Step 8: 提交**

```bash
git add packages/server/src/
git commit -m "refactor(server): SharedState + MCP return batch selection format"
```

---

## Task 10: README 更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 找到"How It Works"/Element Data Extracted 章节**

Run: `grep -n "How It Works\|Element Data Extracted\|Component Detection" README.md | head -10`

- [ ] **Step 2: 添加新工作流说明**

在描述工作流的地方（约 line 100-130 附近）添加：

```md
## Workflow

1. Hold **Option** (Alt) and click any element on the page — it becomes selected (highlighted).
2. (Optional) Hold **Option** and click more elements — multi-select adds them to a batch.
3. A floating note panel appears next to the first selected element with a textarea.
4. Type a description of what you want changed (e.g. "make these buttons primary blue").
5. Press **⌘/Ctrl+Enter** (or click Send) to send the selection + your note to the MCP server.
6. Your AI agent calls `get-pointed-element` to receive `{ userNote, url, timestamp, elements: [...] }`.

To cancel a selected element, Option+Click it again or click the × on its chip.
The note panel stays visible until ALL selections are cancelled — your typed text is never lost from incidental clicks.
```

- [ ] **Step 3: 更新 MCP 输出 schema 描述**

如果 README 有 MCP 输出示例，更新为新的 `{ userNote, elements: [...] }` 形态。

- [ ] **Step 4: 添加版本不兼容警告**

在 Installation 或 Compatibility 章节添加：

```md
> **⚠️ Breaking change in this version:** The wire format changed from
> single-element to batched selection (`{ userNote, elements }`). The
> Chrome extension and the MCP server must be the same version. Agent
> prompts that consumed the old `get-pointed-element` single-object
> format need to be updated to handle the new batch structure.
```

- [ ] **Step 5: 提交**

```bash
git add README.md
git commit -m "docs: document selection note panel workflow and batch MCP output"
```

---

## Task 11: 手测验证（10 条 checklist）

**Files:** 无

- [ ] **Step 1: rebuild + reload**

```bash
cd packages/chrome-extension && pnpm build
# 然后 chrome://extensions 刷新插件 + 刷新目标页面
```

启动 server: `cd packages/server && pnpm dev`

- [ ] **Step 2: 手测 1 — 单选+空备注**

Vue/React/任意页 Option+Click 一个元素 → panel 出现 + textarea focus → 直接 Cmd+Enter
Expected: state.json 含 `processedPointedSelection.elements` 长度 1 + `userNote: ""`

- [ ] **Step 3: 手测 2 — 单选+备注**

Option+Click → 输入"改成蓝色" → Send
Expected: state.json 含 userNote "改成蓝色"

- [ ] **Step 4: 手测 3 — 多选**

Option+Click A → Option+Click B → Option+Click C → panel chip 列表显示 [1][2][3] → 输入"在 [1] 和 [2] 之间加 X" → Send
Expected: state.json elements 长度 3 + userNote 完整

- [ ] **Step 5: 手测 4 — 取消单个（Option+Click）**

选 A B C 后在 B 上 Option+Click
Expected: B 消失，A/C 保留；panel 仍存在；chip 重排为 [1]A [2]C

- [ ] **Step 6: 手测 5 — chip × 取消**

选 A B C 后点 chip [2] 的 ×
Expected: 同手测 4

- [ ] **Step 7: 手测 6 — 全部取消**

选 A B 后 Option+Click A、再 Option+Click B
Expected: panel 消失，textarea 内容丢失

- [ ] **Step 8: 手测 7 — Send 后保留**

选 A B + 输入 → Send → state.json 出现
Expected: panel 仍在，selection 仍在，textarea 已清空

- [ ] **Step 9: 手测 8 — Esc 不消失**

选 A + 输入 → 按 Esc
Expected: panel 不变

- [ ] **Step 10: 手测 9 — 点页面不消失**

选 A + 输入 → 鼠标点页面其他空白处
Expected: panel 不变

- [ ] **Step 11: 手测 10 — First-element anchor**

选 A（panel 出现在 A 旁）→ Option+Click B → panel 位置不动；Option+Click 取消 A → panel 位置仍不动（floating-ui autoUpdate 继续运行但 anchor 元素已删除，panel 停在最后位置）

---

## Self-Review

**Spec coverage** —— 对照 spec 各章节：

| Spec 章节 | 实现位置 |
|---|---|
| SelectionStoreService 接口 | Task 2 |
| NotePanelService（panel/chip/textarea/Send/Esc/click outside）| Task 4 + Task 3 (CSS) |
| OverlayManager 改造支持多 selection | Task 5 |
| ElementPointerService onClick → toggle, sendSelection | Task 6 |
| Wire format `RawPointedSelection` + `SELECTION_SENT` | Task 1 |
| server `ProcessedPointedSelection` + processBatchFromRaw | Task 7 + Task 8 |
| shared-state getPointedSelection | Task 9 |
| message-handler 处理 SELECTION_SENT + log legacy warn | Task 9 |
| MCP tool 返回 batch | Task 9 |
| 单元测试 5 + 6 + 4 = 15 例 | Task 2 + 4 + 8 |
| 样式 | Task 3 |
| README workflow + breaking change | Task 10 |
| 手测 10 条 | Task 11 |
| First-anchor 不重新 anchor | Task 4 (buildPanel 用 elements[0]，handleSelectionChange 不重新调 buildPanel) |
| 0→1 创建 / N→0 销毁 panel | Task 4 (handleSelectionChange 分支) |
| panel DOM self-heal | Task 4 (handleSelectionChange 检查 document.body.contains) |
| Send 失败保留 textarea + inline error | Task 4 (handleSend try/catch/finally) |
| Cmd/Ctrl+Enter | Task 4 (textarea keydown) |
| Capture-phase 事件 stopPropagation | Task 4 (root listeners) |
| chip hover 闪烁 | Task 4 (chip mouseenter/leave) + Task 3 (CSS @keyframes) |

**Placeholder 扫描**：所有 step 都有完整代码 / 命令 / 路径。

**类型一致性**：`RawPointedSelection`、`ProcessedPointedSelection`、`SelectionStoreService`、`NotePanelService`、`OverlayManagerService` 方法签名贯穿一致。`processBatchFromRaw` 名称在 Task 8 和 Task 9 一致。

无需调整。
