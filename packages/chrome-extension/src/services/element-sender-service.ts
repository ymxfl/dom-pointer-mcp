import ReconnectingWebSocket from 'reconnecting-websocket';
import {
  RawPointedSelection,
  PointerMessage,
  PointerMessageType,
  ConnectionStatus,
  PointerHistoryListResponse,
  PointerHistoryGetResponse,
  PointerHistoryClearResponse,
} from '@dom-pointer-mcp/shared/types';
import logger from '../utils/logger';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export type StatusCallback = (status: ConnectionStatus, error?: string) => void;

export class ElementSenderService {
  private ws: ReconnectingWebSocket | null = null;

  private currentPort: number | null = null;

  private idleTimeout: NodeJS.Timeout | null = null;

  private readonly IDLE_DURATION = 10000; // 10 seconds of inactivity

  private readonly CONNECTION_TIMEOUT = 10000; // 5 seconds to wait for connection

  private readonly MAX_RECONNECTION_DELAY = 10000; // 10 seconds max delay

  private readonly MIN_RECONNECTION_DELAY = 1000; // 1 second min delay

  private readonly RECONNECTION_DELAY_GROW_FACTOR = 1.5; // Exponential backoff factor

  private readonly MAX_RETRIES = 10; // Maximum connection retry attempts

  private readonly SEND_RETRY_MAX_ATTEMPTS = 5;

  private readonly SEND_RETRY_INTERVAL = 1000; // 1s between attempts

  private readonly SEND_VERIFY_WINDOW = 300; // 300ms post-send watch for close/error

  private readonly REQUEST_TIMEOUT = 5000;

  async sendSelection(
    selection: RawPointedSelection,
    port: number,
    statusCallback?: StatusCallback,
  ): Promise<void> {
    this.clearIdleTimer();

    for (let attempt = 0; attempt < this.SEND_RETRY_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        this.disconnect();
        statusCallback?.(ConnectionStatus.CONNECTING);
        await sleep(this.SEND_RETRY_INTERVAL);
      }

      const ok = await this.attemptSend(selection, port, statusCallback);
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
    this.disconnect();
  }

  async listHistory(port: number): Promise<PointerHistoryListResponse> {
    return this.sendRequest<PointerHistoryListResponse>(
      PointerMessageType.HISTORY_LIST_REQUEST,
      PointerMessageType.HISTORY_LIST_RESPONSE,
      {},
      port,
    );
  }

  async getHistorySelection(
    selectionId: string,
    port: number,
  ): Promise<PointerHistoryGetResponse> {
    return this.sendRequest<PointerHistoryGetResponse>(
      PointerMessageType.HISTORY_GET_REQUEST,
      PointerMessageType.HISTORY_GET_RESPONSE,
      { selectionId },
      port,
    );
  }

  async clearHistory(
    selectionId: string | undefined,
    port: number,
  ): Promise<PointerHistoryClearResponse> {
    return this.sendRequest<PointerHistoryClearResponse>(
      PointerMessageType.HISTORY_CLEAR_REQUEST,
      PointerMessageType.HISTORY_CLEAR_RESPONSE,
      selectionId ? { selectionId } : {},
      port,
    );
  }

  private async sendRequest<T extends { requestId: string }>(
    requestType: PointerMessageType,
    responseType: PointerMessageType,
    data: Record<string, any>,
    port: number,
  ): Promise<T> {
    this.clearIdleTimer();
    const connected = await this.ensureConnection(port);
    if (!connected) {
      throw new Error('Connection timeout');
    }

    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      return await new Promise<T>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket is not connected'));
          return;
        }

        const { ws } = this;
        let timer: ReturnType<typeof setTimeout> | undefined;

        function onClose() {
          if (timer) clearTimeout(timer);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          ws.removeEventListener('message', onMessage);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          ws.removeEventListener('error', onError);
          reject(new Error('WebSocket closed'));
        }

        function onError() {
          if (timer) clearTimeout(timer);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          ws.removeEventListener('message', onMessage);
          ws.removeEventListener('close', onClose);
          reject(new Error('WebSocket error'));
        }

        function onMessage(event: MessageEvent) {
          try {
            const message: PointerMessage = JSON.parse(String(event.data));
            if (message.type !== responseType || message.data?.requestId !== requestId) {
              return;
            }
            if (timer) clearTimeout(timer);
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            resolve(message.data as T);
          } catch (error) {
            if (timer) clearTimeout(timer);
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            reject(error);
          }
        }

        ws.addEventListener('message', onMessage);
        ws.addEventListener('close', onClose);
        ws.addEventListener('error', onError);

        timer = setTimeout(() => {
          cleanup();
          reject(new Error('History request timeout'));
        }, this.REQUEST_TIMEOUT);

        const message: PointerMessage = {
          type: requestType,
          data: { ...data, requestId },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(message));
      });
    } finally {
      if (this.isConnected) {
        this.startIdleTimer();
      } else {
        this.disconnect();
      }
    }
  }

  private async attemptSend(
    selection: RawPointedSelection,
    port: number,
    statusCallback?: StatusCallback,
  ): Promise<boolean> {
    const connected = await this.ensureConnection(port, statusCallback);
    if (!connected) return false;

    statusCallback?.(ConnectionStatus.SENDING);

    const message: PointerMessage = {
      type: PointerMessageType.SELECTION_SENT,
      data: selection,
      timestamp: Date.now(),
    };

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Synchronous send failure:', error);
      return false;
    }

    logger.info('📤 Selection sent:', selection);

    return this.verifyDelivery();
  }

  private verifyDelivery(): Promise<boolean> {
    return new Promise((resolve) => {
      const { ws } = this;
      if (!ws) {
        resolve(false);
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        ws.removeEventListener('close', onClose);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        ws.removeEventListener('error', onError);
        resolve(ok);
      };
      const onClose = () => settle(false);
      const onError = () => settle(false);
      ws.addEventListener('close', onClose);
      ws.addEventListener('error', onError);
      timer = setTimeout(() => settle(true), this.SEND_VERIFY_WINDOW);
    });
  }

  private handlePortChange(port: number, statusCallback?: StatusCallback): boolean {
    if (!port || port <= 0 || port > 65535) {
      statusCallback?.(ConnectionStatus.ERROR, 'Invalid port number');
      return false;
    }

    const portInitialization = this.currentPort === null;

    if (portInitialization) {
      this.currentPort = port;
      return true;
    }

    const portChanged = this.currentPort !== port;

    // Check if port changed - if so, disconnect old connection
    if (portChanged) {
      logger.info(`Port changed from ${this.currentPort} to ${port}, reconnecting...`);
      this.disconnect();
      this.currentPort = port;
    }

    return true;
  }

  private async ensureConnection(port: number, statusCallback?: StatusCallback): Promise<boolean> {
    // Handle port change or initialization
    const portHandled = this.handlePortChange(port, statusCallback);
    if (!portHandled) return false;

    // Create connection if needed
    if (!this.isConnected) {
      statusCallback?.(ConnectionStatus.CONNECTING);

      // Create ReconnectingWebSocket with options
      this.ws = new ReconnectingWebSocket(`ws://localhost:${port}`, [], {
        maxReconnectionDelay: this.MAX_RECONNECTION_DELAY,
        minReconnectionDelay: this.MIN_RECONNECTION_DELAY,
        reconnectionDelayGrowFactor: this.RECONNECTION_DELAY_GROW_FACTOR,
        connectionTimeout: this.CONNECTION_TIMEOUT,
        maxRetries: this.MAX_RETRIES,
      });

      this.setupHandlers();

      // Wait for connection to open
      const connected = await this.waitForConnection();
      if (!connected) {
        statusCallback?.(ConnectionStatus.ERROR, 'Connection timeout');
        this.disconnect();
        return false;
      }
    }

    // Connection established
    statusCallback?.(ConnectionStatus.CONNECTED);

    return true;
  }

  private waitForConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve(false);
        return;
      }

      if (this.ws.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        resolve(false);
      }, this.CONNECTION_TIMEOUT);

      const handleOpen = () => {
        clearTimeout(timeout);
        resolve(true);
      };

      this.ws.addEventListener('open', handleOpen);
    });
  }

  private setupHandlers(): void {
    if (!this.ws) return;

    this.ws.addEventListener('open', () => {
      logger.info('✅ WebSocket connected');
    });

    this.ws.addEventListener('close', () => {
      logger.info('WebSocket closed');
    });

    this.ws.addEventListener('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    this.ws.addEventListener('message', (event) => {
      logger.debug('Received:', event.data);
    });
  }

  private startIdleTimer(): void {
    this.idleTimeout = setTimeout(() => {
      this.disconnect();
      logger.info('🔌 Connection idle, disconnecting');
    }, this.IDLE_DURATION);
  }

  private clearIdleTimer(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  private disconnect(): void {
    this.clearIdleTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.debug('🔌 WS client disconnected');
  }

  private get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
