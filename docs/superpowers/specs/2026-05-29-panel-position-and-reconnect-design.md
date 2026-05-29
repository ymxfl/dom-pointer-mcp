# Panel Positioning, Send Retry, ESC-to-Clear — Design

Date: 2026-05-29

## Background

Two issues reported plus one UX addition:

1. **Panel off-screen for large/viewport-filling elements.** When the selected element is `<body>`, `<html>`, or a hero that fills the viewport, the note panel is placed outside the viewport, making its textarea unreachable.
2. **First send after idle fails.** The WebSocket client disconnects after 10s of inactivity (`IDLE_DURATION`). On the next send the user sees a "Send failed" toast; a second send succeeds because the failure path triggers reconnect. There is no automatic reconnect-and-retry.
3. **(New) ESC should clear the current selection,** equivalent to clicking the panel's top-right ×.

## Root Causes

### Issue 1 — `packages/chrome-extension/src/services/note-panel-service.ts:102-111`

`autoUpdate(anchorEl, root, ...)` calls `computePosition(anchorEl, root, { placement: 'bottom-start', middleware: [flip(), shift({ padding: 8 })] })`. When `anchorEl.getBoundingClientRect()` is as large as or larger than the viewport:

- `bottom-start` places the panel below the element → off-screen
- `flip()` flips to `top-start` → also off-screen (element fills viewport)
- `shift()` adjusts only along the cross-axis; cannot bring the panel back along the main axis

Net effect: the panel sits outside the visible viewport with no recovery.

### Issue 2 — `packages/chrome-extension/src/services/element-sender-service.ts`

`IDLE_DURATION = 10_000` (line 16) closes the socket after 10s of inactivity. On the next send the socket is recreated via `ensureConnection`. The user-reported "first failure" most often happens when the local `readyState === OPEN` but the server side has already dropped the connection (e.g. server restart, network hiccup) — the synchronous `ws.send()` does not throw, the close event fires later, and the caller's status callback ends up at `ERROR`. The second send succeeds because the failure path leaves the socket usable for a clean reconnect.

Today, on failure the code only reports `ConnectionStatus.ERROR` via callback. There is no retry.

### Issue 3

No code currently handles ESC. `TriggerKeyService` only watches the Alt trigger key.

## Designs

### A. Panel positioning — clip anchor to viewport

**File:** `packages/chrome-extension/src/services/note-panel-service.ts`

Replace the DOM element passed to `computePosition` with a [floating-ui virtual element](https://floating-ui.com/docs/virtual-elements) whose `getBoundingClientRect()` returns the intersection of the anchor's rect and the viewport. `autoUpdate`'s first argument keeps the real DOM element so scroll/resize listeners still fire.

Helper (same file, module scope):

```ts
function viewportClippedRect(el: HTMLElement): DOMRect {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(0, Math.min(r.left, vw));
  const top = Math.max(0, Math.min(r.top, vh));
  const right = Math.max(0, Math.min(r.right, vw));
  const bottom = Math.max(0, Math.min(r.bottom, vh));
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}
```

Wire-up inside `autoUpdate`:

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

Import `limitShift` alongside the existing `shift` from `@floating-ui/dom`.

**Behaviour:**

- Anchor wholly inside viewport → clipped rect = original rect → no behaviour change.
- Anchor fills the viewport (e.g. `<body>`) → clipped rect = viewport rect → `flip()` + `shift()` push the panel inside the viewport (typically just inside the bottom-start corner).
- Anchor partially scrolled out → clipped rect = visible portion → panel hugs the visible region.
- Anchor fully scrolled out → clipped rect has zero width/height at the nearest viewport edge → panel docks at that edge.

### B. Send retry with reconnect

**File:** `packages/chrome-extension/src/services/element-sender-service.ts`

Add constants:

```ts
private readonly SEND_RETRY_MAX_ATTEMPTS = 5;
private readonly SEND_RETRY_INTERVAL = 1000;   // 1s between attempts
private readonly SEND_VERIFY_WINDOW = 300;     // 300ms post-send watch
```

Extract a private `attemptSend(element, port, statusCallback): Promise<boolean>` that:

1. Calls `ensureConnection(port, statusCallback)`. If false, return false.
2. Emits `ConnectionStatus.SENDING`.
3. Calls `this.ws!.send(JSON.stringify(message))` in a try/catch — synchronous throw → return false.
4. Waits up to `SEND_VERIFY_WINDOW` ms while listening for `close` / `error` on `this.ws`. If either fires, return false; otherwise return true.

Rewrite `sendElement`:

```ts
async sendElement(element, port, statusCallback) {
  this.clearIdleTimer();
  for (let attempt = 0; attempt < this.SEND_RETRY_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      this.disconnect();                                  // force fresh socket
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
  statusCallback?.(ConnectionStatus.ERROR, `Failed to send after ${this.SEND_RETRY_MAX_ATTEMPTS} attempts`);
}
```

`sleep` is a local helper (`(ms) => new Promise(r => setTimeout(r, ms))`) since the server has its own `sleep` util but extension does not — add a small helper near the top of the file rather than introducing a shared utility module just for this.

**Timing budget:** worst case = 5 × (≤300ms verify + 1000ms gap) − one gap ≈ 5.5s. Idle disconnect (`IDLE_DURATION = 10s`) is unchanged.

**Why not rely on `reconnecting-websocket`'s own retry:** calling `disconnect()` (close + null) between attempts is the cleanest way to force a brand-new socket each retry. The library would otherwise hold a `CLOSING`/`CLOSED` state internally and we'd race with its backoff schedule.

### C. ESC clears selection

**File:** `packages/chrome-extension/src/services/note-panel-service.ts`

Add a document-level capture-phase `keydown` listener for the lifetime of the panel.

New field:

```ts
private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
```

Register at the end of `buildPanel`:

```ts
this.handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    this.store.clear();
  }
};
document.addEventListener('keydown', this.handleKeyDown, true);
```

Unregister in `destroyPanel`:

```ts
if (this.handleKeyDown) {
  document.removeEventListener('keydown', this.handleKeyDown, true);
  this.handleKeyDown = null;
}
```

**Rationale for placement:** ESC's semantic is "cancel current selection", which is meaningful only while a selection exists. `NotePanelService` already owns the panel's lifecycle and subscribes to `SelectionStoreService`, so listener install/teardown lines up exactly with selection presence. Keeping it out of `TriggerKeyService` preserves that service's narrow responsibility (Alt trigger).

**Capture phase** is used so the listener wins over page-level ESC handlers; preventDefault avoids the host page reacting (e.g. closing its own modal as a side effect).

## Out of Scope

- Application-level ack protocol for sends (would obsolete the 300ms verify window but requires server changes).
- Changing `IDLE_DURATION`.
- Reworking `TriggerKeyService`.

## Test Plan

`packages/chrome-extension/src/__tests__/`:

- **`note-panel-service.test.ts`** (extend existing):
  - Anchor fully inside viewport → panel positioned using anchor rect.
  - Anchor rect = full viewport (mock `getBoundingClientRect` and `window.innerWidth/Height`) → panel `left`/`top` lie within viewport.
  - Anchor partially clipped → panel positioned relative to visible intersection.
  - Pressing ESC while panel mounted → `store.clear()` called.
  - Pressing ESC after panel destroyed → no listener active.
- **`element-sender-service.test.ts`** (new file):
  - First `attemptSend` returns false, second returns true → final status SENT, no ERROR emitted.
  - All 5 attempts fail → final status ERROR with message containing `5 attempts`.
  - First attempt succeeds → no retry delays incurred (mock timers).

## Acceptance

- Selecting `<body>` or a viewport-filling element shows the panel inside the viewport with the textarea reachable.
- After ≥10s idle, the first send either succeeds transparently or, on persistent failure, errors only after ~5s of retries.
- ESC while a selection is active clears the selection and destroys the panel (same as ×).
- ESC has no effect when no selection is active.
- Existing unit tests still pass.
