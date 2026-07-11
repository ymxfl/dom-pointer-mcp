import { WebSocketServer } from 'ws';
import { PointerMessage } from '@dom-pointer-mcp/shared/types';
import { config } from '../config';
import logger from '../logger';
import { sleep } from '../utils';
import parsePort from '../utils/port';

// WebSocket constants
const WEBSOCKET_RETRY_INTERVAL = 5000; // 5 seconds

type MessageResponder = (type: string, data: any) => void;
type MessageHandler = (
  type: string,
  data: any,
  respond: MessageResponder,
) => void | Promise<void>;

export default class WebSocketService {
  private wss: WebSocketServer | null = null;

  private isLeader = false;

  private port: number;

  private messageHandler: MessageHandler | null = null;

  constructor(port: string | number = config.websocket.port) {
    this.port = parsePort(port);
  }

  public registerMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  public async start(): Promise<void> {
    return this.campaignForLeadership();
  }

  private async campaignForLeadership(): Promise<void> {
    let announcedFollower = false;
    while (!this.isLeader) {
      try {
        this.wss = new WebSocketServer({ port: this.port });
        this.setupHandlers();
        await this.waitForListening();
        this.isLeader = true;
        if (announcedFollower) {
          logger.info(`🎯 Took over WebSocket server on :${this.port} (previous leader exited)`);
        } else {
          logger.info(`🎯 WebSocket server listening on :${this.port} (leader)`);
        }
      } catch (err) {
        // Clean up failed attempt
        this.stop();

        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EADDRINUSE') {
          if (!announcedFollower) {
            logger.info(
              `ℹ️  Port ${this.port} is already used by another dom-pointer-mcp instance — `
              + 'this is fine. MCP requests will be answered from the shared state file. '
              + 'Will take over WebSocket if the current leader exits.',
            );
            announcedFollower = true;
          } else {
            logger.debug('Still follower; leader still holds the port');
          }
          await sleep(WEBSOCKET_RETRY_INTERVAL);
        } else {
          logger.error('Failed to start WebSocket server:', err);
          throw err;
        }
      }
    }
  }

  private setupHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private async waitForListening(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.wss!.on('listening', resolve);
      this.wss!.on('error', reject);
    });
  }

  private handleConnection(ws: any): void {
    logger.info('👆 Browser extension connected to WebSocket server');

    ws.on('message', (data: any) => this.handleWebSocketMessage(ws, data));
    ws.on('close', this.handleWebSocketClose.bind(this));
  }

  private async handleWebSocketMessage(ws: any, data: any): Promise<void> {
    try {
      const message: PointerMessage = JSON.parse(data.toString());
      logger.info('📨 Received message from browser:', message.type);

      if (this.messageHandler) {
        const respond: MessageResponder = (type, responseData) => {
          ws.send(JSON.stringify({
            type,
            data: responseData,
            timestamp: Date.now(),
          }));
        };
        await this.messageHandler(message.type, message.data, respond);
      }
    } catch (error) {
      logger.error('Failed to parse message:', error);
    }
  }

  private handleWebSocketClose(): void {
    logger.info('👆 Browser extension disconnected from WebSocket server');
  }

  public isLeaderInstance(): boolean {
    return this.isLeader;
  }

  public stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.isLeader = false;
  }
}
