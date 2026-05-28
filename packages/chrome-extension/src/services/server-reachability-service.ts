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
