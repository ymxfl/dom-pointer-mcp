import {
  ConnectionStatus,
  PointerMessageType,
  RawPointedSelection,
} from '@dom-pointer-mcp/shared/types';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { ElementSenderService } from '../../services/element-sender-service';

type RWSInstance = {
  readyState: number;
  send: jest.Mock;
  close: jest.Mock;
  listeners: Record<string, ((ev?: any) => void)[]>;
  addEventListener: (type: string, fn: (ev?: any) => void) => void;
  removeEventListener: (type: string, fn: (ev?: any) => void) => void;
  emit: (type: string, ev?: any) => void;
};

const createdSockets: RWSInstance[] = [];

jest.mock('reconnecting-websocket', () => jest.fn().mockImplementation(() => {
  const inst: RWSInstance = {
    readyState: 0, // CONNECTING
    send: jest.fn(),
    close: jest.fn(),
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = this.listeners[type];
      if (!arr) return;
      const idx = arr.indexOf(fn);
      if (idx !== -1) arr.splice(idx, 1);
    },
    emit(type, ev) {
      (this.listeners[type] || []).forEach((fn) => fn(ev));
    },
  };
  createdSockets.push(inst);
  return inst;
}));

function flushMicrotasks(): Promise<void> {
  // NOTE: plan specified `setTimeout(resolve, 0)`, but under jest.useFakeTimers()
  // that macrotask never fires without an explicit advanceTimersByTime call, so
  // the test hangs. Two awaited microtask ticks reliably drain the promise queue
  // and match the function's name/intent.
  return Promise.resolve().then(() => Promise.resolve());
}

function makeSelection(): RawPointedSelection {
  return {
    url: 'https://example.com',
    timestamp: 1672531200000,
    userNote: 'test note',
    elements: [
      {
        outerHTML: '<div>test</div>',
        url: 'https://example.com',
        timestamp: 1672531200000,
      },
    ],
  };
}

describe('ElementSenderService', () => {
  beforeEach(() => {
    createdSockets.length = 0;
    (ReconnectingWebSocket as unknown as jest.Mock).mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends successfully on the first attempt without retry delay', async () => {
    const svc = new ElementSenderService();
    const status = jest.fn();
    const promise = svc.sendSelection(makeSelection(), 7007, status);

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

  it('retries after a failed first attempt and ends in SENT', async () => {
    const svc = new ElementSenderService();
    const status = jest.fn();
    const promise = svc.sendSelection(makeSelection(), 7007, status);

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
    const promise = svc.sendSelection(makeSelection(), 7007, status);

    for (let i = 0; i < 5; i += 1) {
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

  it('requests history list and resolves the matching response', async () => {
    const svc = new ElementSenderService();
    const promise = svc.listHistory(7007);

    await flushMicrotasks();
    const sock = createdSockets[0];
    sock.readyState = 1;
    sock.emit('open');
    await flushMicrotasks();

    const sent = JSON.parse(sock.send.mock.calls[0][0]);
    expect(sent.type).toBe(PointerMessageType.HISTORY_LIST_REQUEST);
    expect(sent.data.requestId).toEqual(expect.any(String));

    sock.emit('message', {
      data: JSON.stringify({
        type: PointerMessageType.HISTORY_LIST_RESPONSE,
        data: {
          requestId: sent.data.requestId,
          selections: [{
            selectionId: 'sel_1',
            url: 'https://example.com',
            timestamp: '2026-06-06T10:00:00.000+08:00',
            userNotePreview: 'note',
            elementCount: 2,
          }],
        },
        timestamp: Date.now(),
      }),
    });

    await expect(promise).resolves.toMatchObject({
      requestId: sent.data.requestId,
      selections: [{ selectionId: 'sel_1', elementCount: 2 }],
    });
  });
});
