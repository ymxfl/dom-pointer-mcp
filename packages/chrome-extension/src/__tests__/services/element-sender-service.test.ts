import { ConnectionStatus, RawPointedDOMElement } from '@dom-pointer-mcp/shared/types';
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
    (ReconnectingWebSocket as unknown as jest.Mock).mockClear();
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
