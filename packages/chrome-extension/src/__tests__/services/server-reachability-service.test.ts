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
