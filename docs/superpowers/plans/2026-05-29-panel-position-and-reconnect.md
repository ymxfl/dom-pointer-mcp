# Panel Positioning, Send Retry, ESC-to-Clear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix off-screen note panel for viewport-filling elements, add automatic reconnect-and-retry on send failure, and let ESC clear the current selection.

**Architecture:** Three independent extension-side changes:
- `note-panel-service.ts`: swap floating-ui's anchor for a virtual element that clips to the viewport, and add a document-level ESC capture listener tied to panel lifetime.
- `element-sender-service.ts`: wrap send in a retry loop that closes and re-creates the WebSocket between attempts.

**Tech Stack:** TypeScript, Jest + jsdom, `@floating-ui/dom`, `reconnecting-websocket`.

**Spec:** `docs/superpowers/specs/2026-05-29-panel-position-and-reconnect-design.md`

---

## File Structure

- **Modify** `packages/chrome-extension/src/services/note-panel-service.ts` — panel positioning (Task 1) and ESC listener (Task 4)
- **Modify** `packages/chrome-extension/src/services/element-sender-service.ts` — send retry loop (Tasks 2–3)
- **Modify** `packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts` — positioning + ESC tests (Tasks 1, 4)
- **Create** `packages/chrome-extension/src/__tests__/services/element-sender-service.test.ts` — retry tests (Tasks 2–3)

---

## Task 1: Clip floating-ui anchor to viewport

**Files:**
- Modify: `packages/chrome-extension/src/services/note-panel-service.ts`
- Modify: `packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `note-panel-service.test.ts` inside the existing `describe('NotePanelService', ...)` block (just before the closing `});`):

```ts
  describe('positioning with virtual anchor', () => {
    const VIEW_W = 1000;
    const VIEW_H = 800;

    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEW_W });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_H });
    });

    function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
      const full: DOMRect = {
        x: rect.x ?? rect.left ?? 0,
        y: rect.y ?? rect.top ?? 0,
        left: rect.left ?? 0,
        top: rect.top ?? 0,
        right: rect.right ?? 0,
        bottom: rect.bottom ?? 0,
        width: rect.width ?? ((rect.right ?? 0) - (rect.left ?? 0)),
        height: rect.height ?? ((rect.bottom ?? 0) - (rect.top ?? 0)),
        toJSON() { return this; },
      };
      el.getBoundingClientRect = () => full;
    }

    async function panelPosition(): Promise<{ left: number; top: number }> {
      // Wait two animation frames for floating-ui autoUpdate to settle.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const panel = document.querySelector(PANEL_SELECTOR) as HTMLElement;
      return { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) };
    }

    it('keeps panel inside viewport when anchor fills the viewport', async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      stubRect(el, {
        left: 0, top: 0, right: VIEW_W, bottom: VIEW_H, width: VIEW_W, height: VIEW_H,
      });
      store.toggle(el);

      const { left, top } = await panelPosition();
      const panel = document.querySelector(PANEL_SELECTOR) as HTMLElement;
      const w = panel.offsetWidth || 280; // jsdom may report 0; floor-cap on viewport edge
      const h = panel.offsetHeight || 200;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + w).toBeLessThanOrEqual(VIEW_W + 1);
      expect(top + h).toBeLessThanOrEqual(VIEW_H + 1);
    });
  });
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd packages/chrome-extension && pnpm test -- --testPathPattern note-panel-service
```

Expected: the new `keeps panel inside viewport when anchor fills the viewport` test FAILS (panel `left`/`top` falls outside viewport bounds).

- [ ] **Step 3: Add viewport-clipping helper and switch to virtual element**

Open `packages/chrome-extension/src/services/note-panel-service.ts`.

Change the `@floating-ui/dom` import to include `limitShift`:

```ts
import {
  autoUpdate, computePosition, flip, limitShift, shift,
} from '@floating-ui/dom';
```

Add this helper at module scope (above the `PANEL_CLASS` constant):

```ts
function viewportClippedRect(el: HTMLElement): DOMRect {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(0, Math.min(r.left, vw));
  const top = Math.max(0, Math.min(r.top, vh));
  const right = Math.max(0, Math.min(r.right, vw));
  const bottom = Math.max(0, Math.min(r.bottom, vh));
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return new DOMRect(left, top, width, height);
}
```

Replace the `autoUpdate` block (currently `note-panel-service.ts:102-111`) with:

```ts
    const virtualAnchor = {
      getBoundingClientRect: () => viewportClippedRect(anchorEl),
      contextElement: anchorEl,
    };
    this.cleanupAutoUpdate = autoUpdate(anchorEl, this.root, async () => {
      const { root } = this;
      if (!root) return;
      const { x, y } = await computePosition(virtualAnchor, root, {
        placement: 'bottom-start',
        middleware: [flip(), shift({ padding: 8, limiter: limitShift() })],
      });
      if (!this.root) return;
      Object.assign(root.style, { left: `${x}px`, top: `${y}px` });
    });
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd packages/chrome-extension && pnpm test -- --testPathPattern note-panel-service
```

Expected: all tests PASS, including the new positioning test and all previously existing tests.

- [ ] **Step 5: Typecheck**

```bash
cd packages/chrome-extension && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/chrome-extension/src/services/note-panel-service.ts \
        packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts
git commit -m "fix(extension): clip note-panel anchor to viewport so panel stays on-screen"
```

---

## Task 2: Create the send-retry test scaffold (one-shot success path)

**Files:**
- Create: `packages/chrome-extension/src/__tests__/services/element-sender-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/chrome-extension/src/__tests__/services/element-sender-service.test.ts` with:

```ts
import { ConnectionStatus, RawPointedDOMElement } from '@dom-pointer-mcp/shared/types';
import { ElementSenderService } from '../../services/element-sender-service';

type RWSInstance = {
  readyState: number;
  send: jest.Mock;
  close: jest.Mock;
  listeners: Record<string, ((ev?: any) => void)[]>;
  addEventListener: (type: string, fn: (ev?: any) => void) => void;
  emit: (type: string, ev?: any) => void;
};

const createdSockets: RWSInstance[] = [];

jest.mock('reconnecting-websocket', () => {
  return jest.fn().mockImplementation(() => {
    const inst: RWSInstance = {
      readyState: 0, // CONNECTING
      send: jest.fn(),
      close: jest.fn(),
      listeners: {},
      addEventListener(type, fn) {
        (this.listeners[type] ||= []).push(fn);
      },
      emit(type, ev) {
        (this.listeners[type] || []).forEach((fn) => fn(ev));
      },
    };
    createdSockets.push(inst);
    return inst;
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

function makeElement(): RawPointedDOMElement {
  return {
    tagName: 'div',
    selector: 'div',
    classes: [],
    id: '',
    attributes: {},
    innerText: '',
    componentInfo: null,
    position: { x: 0, y: 0, width: 0, height: 0 },
  } as unknown as RawPointedDOMElement;
}

describe('ElementSenderService', () => {
  beforeEach(() => {
    createdSockets.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends successfully on the first attempt without retry delay', async () => {
    const svc = new ElementSenderService();
    const status = jest.fn();
    const promise = svc.sendElement(makeElement(), 7007, status);

    // Allow the constructor microtask to run, then open the socket.
    await flushMicrotasks();
    const sock = createdSockets[0];
    sock.readyState = 1; // OPEN
    sock.emit('open');

    // Allow the 300ms verify window to elapse with no close/error event.
    await flushMicrotasks();
    jest.advanceTimersByTime(300);
    await flushMicrotasks();

    await promise;

    expect(sock.send).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(ConnectionStatus.SENT);
    expect(status).not.toHaveBeenCalledWith(ConnectionStatus.ERROR, expect.anything());
    expect(createdSockets).toHaveLength(1); // no reconnect
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd packages/chrome-extension && pnpm test -- --testPathPattern element-sender-service
```

Expected: FAIL — the current `sendElement` does not wait the 300ms verify window, so the test will fail with either status not reaching SENT in the expected order, or with `sock.send` invoked at the wrong moment. Exact failure mode is acceptable as long as it is a real failure (not a syntax error).

- [ ] **Step 3: Add retry constants and `sleep` helper**

Open `packages/chrome-extension/src/services/element-sender-service.ts`.

Just below the existing imports, add:

```ts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}
```

Inside the class, just below the existing `MAX_RETRIES` constant, add:

```ts
  private readonly SEND_RETRY_MAX_ATTEMPTS = 5;

  private readonly SEND_RETRY_INTERVAL = 1000; // 1s between attempts

  private readonly SEND_VERIFY_WINDOW = 300; // 300ms post-send watch for close/error
```

- [ ] **Step 4: Extract `attemptSend` and rewrite `sendElement` with the retry loop**

Replace the entire existing `sendElement` method with the two methods below. Leave every other method (`handlePortChange`, `ensureConnection`, `waitForConnection`, `setupHandlers`, `startIdleTimer`, `clearIdleTimer`, `disconnect`, `isConnected`) untouched.

```ts
  async sendElement(
    element: RawPointedDOMElement,
    port: number,
    statusCallback?: StatusCallback,
  ): Promise<void> {
    this.clearIdleTimer();

    for (let attempt = 0; attempt < this.SEND_RETRY_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        this.disconnect();
        statusCallback?.(ConnectionStatus.CONNECTING);
        await sleep(this.SEND_RETRY_INTERVAL);
      }

      const ok = await this.attemptSend(element, port, statusCallback);
      if (ok) {
        statusCallback?.(ConnectionStatus.SENT);
        this.startIdleTimer();
        return;
      }
    }

    statusCallback?.(
      ConnectionStatus.ERROR,
      `Failed to send after ${this.SEND_RETRY_MAX_ATTEMPTS} attempts`,
    );
  }

  private async attemptSend(
    element: RawPointedDOMElement,
    port: number,
    statusCallback?: StatusCallback,
  ): Promise<boolean> {
    const connected = await this.ensureConnection(port, statusCallback);
    if (!connected) return false;

    statusCallback?.(ConnectionStatus.SENDING);

    const message: PointerMessage = {
      type: PointerMessageType.SELECTION_SENT,
      data: element,
      timestamp: Date.now(),
    };

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Synchronous send failure:', error);
      return false;
    }

    logger.info('📤 Element sent:', element);

    // Watch for late close/error from the server within a short window.
    const verified = await this.verifyDelivery();
    return verified;
  }

  private verifyDelivery(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve(false);
        return;
      }
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const onClose = () => settle(false);
      const onError = () => settle(false);
      this.ws.addEventListener('close', onClose);
      this.ws.addEventListener('error', onError);
      setTimeout(() => settle(true), this.SEND_VERIFY_WINDOW);
    });
  }
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
cd packages/chrome-extension && pnpm test -- --testPathPattern element-sender-service
```

Expected: PASS (one test).

- [ ] **Step 6: Typecheck**

```bash
cd packages/chrome-extension && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/chrome-extension/src/services/element-sender-service.ts \
        packages/chrome-extension/src/__tests__/services/element-sender-service.test.ts
git commit -m "feat(extension): retry sendElement with reconnect on failure"
```

---

## Task 3: Cover retry-after-failure and all-attempts-fail paths

**Files:**
- Modify: `packages/chrome-extension/src/__tests__/services/element-sender-service.test.ts`

- [ ] **Step 1: Add the two new tests**

Inside the existing `describe('ElementSenderService', ...)` block in `element-sender-service.test.ts`, just after the first `it(...)` block and before the closing `});`, add:

```ts
  it('retries after a failed first attempt and ends in SENT', async () => {
    const svc = new ElementSenderService();
    const status = jest.fn();
    const promise = svc.sendElement(makeElement(), 7007, status);

    // First attempt: socket opens, send happens, then server closes inside verify window.
    await flushMicrotasks();
    const first = createdSockets[0];
    first.readyState = 1;
    first.emit('open');
    await flushMicrotasks();
    first.emit('close');
    await flushMicrotasks();

    // Wait the 1s retry interval.
    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    // Second attempt: a fresh socket is created, opens, and stays open through the verify window.
    expect(createdSockets).toHaveLength(2);
    const second = createdSockets[1];
    second.readyState = 1;
    second.emit('open');
    await flushMicrotasks();
    jest.advanceTimersByTime(300);
    await flushMicrotasks();

    await promise;

    expect(first.send).toHaveBeenCalledTimes(1);
    expect(second.send).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(ConnectionStatus.SENT);
    expect(status).not.toHaveBeenCalledWith(ConnectionStatus.ERROR, expect.anything());
  });

  it('reports ERROR with "5 attempts" message after all attempts fail', async () => {
    const svc = new ElementSenderService();
    const status = jest.fn();
    const promise = svc.sendElement(makeElement(), 7007, status);

    for (let i = 0; i < 5; i++) {
      // Allow the constructor for this attempt.
      await flushMicrotasks();
      const sock = createdSockets[i];
      sock.readyState = 1;
      sock.emit('open');
      await flushMicrotasks();
      sock.emit('close'); // fail inside verify window
      await flushMicrotasks();
      if (i < 4) {
        // Retry interval before next attempt.
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();
      }
    }

    await promise;

    expect(createdSockets).toHaveLength(5);
    const lastCall = status.mock.calls[status.mock.calls.length - 1];
    expect(lastCall[0]).toBe(ConnectionStatus.ERROR);
    expect(lastCall[1]).toMatch(/5 attempts/);
  });
```

- [ ] **Step 2: Run the tests and verify they pass**

```bash
cd packages/chrome-extension && pnpm test -- --testPathPattern element-sender-service
```

Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/chrome-extension/src/__tests__/services/element-sender-service.test.ts
git commit -m "test(extension): cover retry-success and all-fail paths for sendElement"
```

---

## Task 4: ESC clears the selection

**Files:**
- Modify: `packages/chrome-extension/src/services/note-panel-service.ts`
- Modify: `packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `note-panel-service.test.ts` inside the existing `describe('NotePanelService', ...)` block, just before the closing `});`:

```ts
  describe('ESC closes the selection', () => {
    it('pressing ESC while panel is mounted clears the store and destroys the panel', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      store.toggle(el);
      expect(document.querySelector(PANEL_SELECTOR)).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(store.getAll()).toEqual([]);
      expect(document.querySelector(PANEL_SELECTOR)).toBeNull();
    });

    it('pressing ESC clears the store even when textarea is focused', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      store.toggle(el);

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      textarea.focus();
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(store.getAll()).toEqual([]);
    });

    it('removes its ESC listener when the panel is destroyed', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      store.toggle(el);   // mount
      store.toggle(el);   // unmount

      const spy = jest.spyOn(store, 'clear');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd packages/chrome-extension && pnpm test -- --testPathPattern note-panel-service
```

Expected: the three new ESC tests FAIL (no ESC handler exists yet).

- [ ] **Step 3: Add ESC handler to NotePanelService**

Open `packages/chrome-extension/src/services/note-panel-service.ts`.

Just below the existing `private feedbackTimer: ReturnType<typeof setTimeout> | null = null;` field, add:

```ts
  private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
```

Inside `buildPanel`, immediately before the line `this.textarea!.focus();`, add:

```ts
    this.handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.store.clear();
      }
    };
    document.addEventListener('keydown', this.handleKeyDown, true);
```

Inside `destroyPanel`, immediately after `this.cleanupAutoUpdate = null;`, add:

```ts
    if (this.handleKeyDown) {
      document.removeEventListener('keydown', this.handleKeyDown, true);
      this.handleKeyDown = null;
    }
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd packages/chrome-extension && pnpm test -- --testPathPattern note-panel-service
```

Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd packages/chrome-extension && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/chrome-extension/src/services/note-panel-service.ts \
        packages/chrome-extension/src/__tests__/services/note-panel-service.test.ts
git commit -m "feat(extension): ESC clears current selection (equivalent to panel close)"
```

---

## Task 5: Full test + typecheck sweep

- [ ] **Step 1: Run the full extension test suite**

```bash
cd packages/chrome-extension && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 2: Typecheck**

```bash
cd packages/chrome-extension && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test plan (for the human reviewer)**

Manual verification is not gated on this plan but is recommended before merging:
1. Build dev: `cd packages/chrome-extension && pnpm dev`
2. Load `dev/` as an unpacked extension in Chrome.
3. Alt-click `<body>` on any page → confirm note panel is fully visible inside the viewport.
4. Send a note, idle for >10 seconds, send again → no user-visible "Send failed" toast.
5. Stop the server, send → ~5 seconds later an error is reported.
6. Restart server, select an element, press ESC → selection cleared, panel disappears.

---

## Acceptance

- The extension's Jest suite passes.
- `pnpm typecheck` passes.
- The three behaviors described in `docs/superpowers/specs/2026-05-29-panel-position-and-reconnect-design.md` ("Acceptance" section) are met.
