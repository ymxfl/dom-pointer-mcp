import { WebSocketServer } from 'ws';
import { type PointerMessage } from '@mcp-pointer/shared';
import { config } from '../config';
import logger from '../logger';
import { sleep } from '../utils';

// WebSocket constants
const WEBSOCKET_RETRY_INTERVAL = 5000; // 5 seconds

type MessageHandler = (type: string, data: any) => void | Promise<void>;

export default class WebSocketService {
  private wss: WebSocketServer | null = null;

  private isLeader = false;

  private port: number;

  private messageHandler: MessageHandler | null = null;

  constructor(port: string | number = config.websocket.port) {
    const intPort = typeof port === 'string' ? parseInt(port, 10) : port;

    this.port = intPort;
  }

  public registerMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  public async start(): Promise<void> {
    return this.campaignForLeadership();
  }

  private async campaignForLeadership(): Promise<void> {
    while (!this.isLeader) {
      try {
        this.wss = new WebSocketServer({ port: this.port });
        this.setupHandlers();
        await this.waitForListening();
        this.isLeader = true;
        logger.info('🎯 This instance is now the LEADER (WebSocket server active)');
      } catch (err) {
        // Clean up failed attempt
        this.stop();

        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EADDRINUSE') {
          logger.info('👥 Running as FOLLOWER (port busy, retrying in 5s...)');
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

    ws.on('message', this.handleWebSocketMessage.bind(this));
    ws.on('close', this.handleWebSocketClose.bind(this));
  }

  private handleWebSocketMessage(data: any): void {
    try {
      const message: PointerMessage = JSON.parse(data.toString());
      logger.info('📨 Received message from browser:', message.type);

      if (this.messageHandler) {
        this.messageHandler(message.type, message.data);
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
